use crate::{
    normalize_remote_path, RemoteCredential, RemoteCredentialMaterial, RemoteEndpoint, RemoteEntry,
    RemoteEntryKind, RemoteFileProvider, RemoteProfile, RemoteProtocol, RemoteProviderError,
    RemoteProviderResult,
};
use std::fs;
use std::io::Write;
use std::path::PathBuf;
use std::process::{Command, Stdio};
use std::time::{SystemTime, UNIX_EPOCH};

#[derive(Debug)]
pub struct SvnNetworkProvider {
    repo_url: String,
    username: Option<String>,
    password: Option<String>,
    revision: Option<String>,
}

impl SvnNetworkProvider {
    pub fn connect(
        profile: &RemoteProfile,
        credential: &RemoteCredential,
    ) -> RemoteProviderResult<Self> {
        if profile.protocol != RemoteProtocol::Subversion {
            return Err(RemoteProviderError::UnsupportedProtocol(profile.protocol));
        }

        ensure_svn_cli_available()?;

        let repo_url = build_svn_repo_url(&profile.endpoint, &profile.options)?;
        let username = credential
            .username
            .as_deref()
            .map(str::trim)
            .filter(|value| !value.is_empty())
            .map(str::to_owned);
        let password =
            match &credential.material {
                RemoteCredentialMaterial::Password(secret) => {
                    let value = secret.expose_secret();
                    if value.is_empty() {
                        None
                    } else {
                        Some(value.to_owned())
                    }
                }
                _ => return Err(RemoteProviderError::Backend(
                    "SVN requires a password credential (or empty password for anonymous access)"
                        .to_owned(),
                )),
            };
        let revision = profile.options.get("revision").cloned();

        Ok(Self {
            repo_url,
            username,
            password,
            revision,
        })
    }

    pub fn repo_url(&self) -> &str {
        &self.repo_url
    }

    pub fn revision(&self) -> Option<&str> {
        self.revision.as_deref()
    }

    fn url_for(&self, path: &str) -> RemoteProviderResult<String> {
        let path = normalize_remote_path(path)?;
        Ok(join_svn_url(&self.repo_url, &path))
    }

    fn svn_command(&self) -> Command {
        let mut command = Command::new("svn");
        command
            .arg("--non-interactive")
            .arg("--no-auth-cache")
            .stdout(Stdio::piped())
            .stderr(Stdio::piped());
        if let Some(username) = &self.username {
            command.arg("--username").arg(username);
        }
        if let Some(password) = &self.password {
            command.arg("--password").arg(password);
        }
        command
    }

    fn run_svn(&self, args: &[&str]) -> RemoteProviderResult<String> {
        let bytes = self.run_svn_bytes(args)?;
        Ok(String::from_utf8_lossy(&bytes).into_owned())
    }

    fn run_svn_bytes(&self, args: &[&str]) -> RemoteProviderResult<Vec<u8>> {
        let mut command = self.svn_command();
        for arg in args {
            command.arg(arg);
        }
        let output = command
            .output()
            .map_err(|error| RemoteProviderError::Backend(format!("failed to run svn: {error}")))?;
        if output.status.success() {
            return Ok(output.stdout);
        }
        let stderr = String::from_utf8_lossy(&output.stderr);
        let stdout = String::from_utf8_lossy(&output.stdout);
        let detail = if stderr.trim().is_empty() {
            stdout.trim().to_owned()
        } else {
            stderr.trim().to_owned()
        };
        if detail.to_ascii_lowercase().contains("not found")
            || detail.to_ascii_lowercase().contains("doesn't exist")
            || detail.to_ascii_lowercase().contains("non-existent")
        {
            let path = args
                .last()
                .map(|value| (*value).to_owned())
                .unwrap_or_default();
            return Err(RemoteProviderError::NotFound(path));
        }
        Err(RemoteProviderError::Backend(format!(
            "svn {} failed: {detail}",
            args.first().copied().unwrap_or("command")
        )))
    }
}

impl RemoteFileProvider for SvnNetworkProvider {
    fn list(&self, path: &str) -> RemoteProviderResult<Vec<RemoteEntry>> {
        let path = normalize_remote_path(path)?;
        let url = self.url_for(&path)?;
        let revision = self.revision.clone().unwrap_or_default();
        let mut args = vec!["list", "--xml"];
        if self.revision.is_some() {
            args.push("--revision");
            args.push(revision.as_str());
        }
        args.push(&url);
        let xml = self.run_svn(&args)?;
        Ok(parse_svn_list_xml(&xml, &path))
    }

    fn download(&self, path: &str) -> RemoteProviderResult<Vec<u8>> {
        let path = normalize_remote_path(path)?;
        let url = self.url_for(&path)?;
        let revision = self.revision.clone().unwrap_or_default();
        let mut args = vec!["cat"];
        if self.revision.is_some() {
            args.push("--revision");
            args.push(revision.as_str());
        }
        args.push(&url);
        self.run_svn_bytes(&args)
    }

    fn upload(&mut self, path: &str, bytes: Vec<u8>) -> RemoteProviderResult<()> {
        let path = normalize_remote_path(path)?;
        let url = self.url_for(&path)?;
        let temp_path = write_temp_upload_file(&bytes)?;
        let result = self.run_svn(&[
            "import",
            temp_path.to_string_lossy().as_ref(),
            &url,
            "-m",
            "open-diff upload",
        ]);
        let _ = fs::remove_file(&temp_path);
        result.map(|_| ())
    }

    fn delete(&mut self, path: &str) -> RemoteProviderResult<()> {
        let path = normalize_remote_path(path)?;
        let url = self.url_for(&path)?;
        self.run_svn(&["delete", &url, "-m", "open-diff delete"])
            .map(|_| ())
    }

    fn rename(&mut self, from: &str, to: &str) -> RemoteProviderResult<()> {
        let from = normalize_remote_path(from)?;
        let to = normalize_remote_path(to)?;
        let from_url = self.url_for(&from)?;
        let to_url = self.url_for(&to)?;
        self.run_svn(&["move", &from_url, &to_url, "-m", "open-diff rename"])
            .map(|_| ())
    }
}

pub fn build_svn_repo_url(
    endpoint: &RemoteEndpoint,
    options: &std::collections::BTreeMap<String, String>,
) -> RemoteProviderResult<String> {
    let host = endpoint.host.trim();
    if host.is_empty() {
        return Err(RemoteProviderError::Backend(
            "SVN profile requires a host or repository URL".to_owned(),
        ));
    }

    let root = endpoint
        .root_path
        .as_deref()
        .map(str::trim)
        .filter(|value| !value.is_empty() && *value != "/")
        .map(|value| {
            if value.starts_with('/') {
                value.to_owned()
            } else {
                format!("/{value}")
            }
        })
        .unwrap_or_default();

    // Full repository URLs may optionally append root_path.
    if host.contains("://") {
        let base = host.trim_end_matches('/').to_owned();
        return Ok(format!("{base}{root}"));
    }

    // Plain hosts keep root_path on list/download paths (like WebDAV/SFTP).
    let scheme = options
        .get("scheme")
        .or_else(|| options.get("url_scheme"))
        .map(|value| value.trim().to_ascii_lowercase())
        .filter(|value| !value.is_empty())
        .unwrap_or_else(|| match endpoint.port {
            Some(443) => "https".to_owned(),
            Some(80) => "http".to_owned(),
            Some(3690) | None => "svn".to_owned(),
            _ => "svn".to_owned(),
        });

    let authority = match endpoint.port {
        Some(port) => format!("{host}:{port}"),
        None => host.to_owned(),
    };

    Ok(format!("{scheme}://{authority}"))
}

fn join_svn_url(base: &str, path: &str) -> String {
    let base = base.trim_end_matches('/');
    if path == "/" {
        return base.to_owned();
    }
    let trimmed = path.trim_start_matches('/');
    format!("{base}/{trimmed}")
}

fn ensure_svn_cli_available() -> RemoteProviderResult<()> {
    let output = Command::new("svn")
        .arg("--version")
        .arg("--quiet")
        .stdout(Stdio::null())
        .stderr(Stdio::null())
        .status();
    match output {
        Ok(status) if status.success() => Ok(()),
        Ok(_) | Err(_) => Err(RemoteProviderError::Backend(
            "svn CLI is required for Subversion remotes but was not found on PATH".to_owned(),
        )),
    }
}

fn write_temp_upload_file(bytes: &[u8]) -> RemoteProviderResult<PathBuf> {
    let nanos = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|duration| duration.as_nanos())
        .unwrap_or(0);
    let path = std::env::temp_dir().join(format!("open-diff-svn-upload-{nanos}"));
    let mut file = fs::File::create(&path).map_err(|error| {
        RemoteProviderError::Backend(format!("failed to create temp upload file: {error}"))
    })?;
    file.write_all(bytes).map_err(|error| {
        RemoteProviderError::Backend(format!("failed to write temp upload file: {error}"))
    })?;
    Ok(path)
}

fn parse_svn_list_xml(xml: &str, parent_path: &str) -> Vec<RemoteEntry> {
    let mut entries = Vec::new();
    let parent = if parent_path == "/" {
        String::new()
    } else {
        parent_path.trim_end_matches('/').to_owned()
    };
    let mut rest = xml;

    while let Some(start) = find_ci(rest, "<entry") {
        let after = &rest[start..];
        let end = find_ci(after, "</entry>")
            .map(|index| index + "</entry>".len())
            .unwrap_or(after.len());
        let block = &after[..end.min(after.len())];
        let kind = if contains_ci(block, "kind=\"dir\"") || contains_ci(block, "kind='dir'") {
            RemoteEntryKind::Directory
        } else {
            RemoteEntryKind::File
        };
        if let Some(name) = extract_tagged_text(block, "name") {
            let name = name.trim();
            if !name.is_empty() {
                let path = if parent.is_empty() {
                    format!("/{name}")
                } else {
                    format!("{parent}/{name}")
                };
                let size = extract_tagged_text(block, "size")
                    .and_then(|value| value.trim().parse().ok())
                    .unwrap_or(0);
                entries.push(RemoteEntry { path, kind, size });
            }
        }
        rest = if end < after.len() { &after[end..] } else { "" };
        if rest.is_empty() {
            break;
        }
    }

    entries
}

fn extract_tagged_text(xml: &str, tag: &str) -> Option<String> {
    let open = format!("<{tag}>");
    let close = format!("</{tag}>");
    let start = find_ci(xml, &open)?;
    let after = &xml[start + open.len()..];
    let end = find_ci(after, &close)?;
    Some(after[..end].to_owned())
}

fn find_ci(haystack: &str, needle: &str) -> Option<usize> {
    haystack
        .to_ascii_lowercase()
        .find(&needle.to_ascii_lowercase())
}

fn contains_ci(haystack: &str, needle: &str) -> bool {
    find_ci(haystack, needle).is_some()
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::{CredentialReference, RemoteProfile};
    use std::collections::BTreeMap;
    use std::process::Command;

    fn svn_available() -> bool {
        Command::new("svn")
            .arg("--version")
            .arg("--quiet")
            .stdout(Stdio::null())
            .stderr(Stdio::null())
            .status()
            .map(|status| status.success())
            .unwrap_or(false)
    }

    #[test]
    fn build_svn_repo_url_joins_host_root_and_scheme_options() {
        let endpoint = RemoteEndpoint::new("svn.example.com")
            .with_port(3690)
            .with_root_path("/repos/project/trunk");
        let mut options = BTreeMap::new();
        options.insert("scheme".to_owned(), "svn".to_owned());

        assert_eq!(
            build_svn_repo_url(&endpoint, &options).unwrap(),
            "svn://svn.example.com:3690"
        );

        let full =
            RemoteEndpoint::new("https://svn.example.com/svn").with_root_path("/project/trunk");
        assert_eq!(
            build_svn_repo_url(&full, &BTreeMap::new()).unwrap(),
            "https://svn.example.com/svn/project/trunk"
        );
    }

    #[test]
    fn parse_svn_list_xml_reads_file_and_directory_entries() {
        let xml = r#"<?xml version="1.0"?>
<lists>
<list path="file:///tmp/repo">
<entry kind="file"><name>readme.txt</name><size>11</size></entry>
<entry kind="dir"><name>src</name></entry>
</list>
</lists>"#;
        let entries = parse_svn_list_xml(xml, "/repos/trunk");
        assert_eq!(entries.len(), 2);
        assert_eq!(entries[0].path, "/repos/trunk/readme.txt");
        assert_eq!(entries[0].kind, RemoteEntryKind::File);
        assert_eq!(entries[0].size, 11);
        assert_eq!(entries[1].path, "/repos/trunk/src");
        assert_eq!(entries[1].kind, RemoteEntryKind::Directory);
    }

    #[test]
    fn svn_network_provider_lists_and_downloads_from_file_url_repo() {
        if !svn_available() {
            return;
        }

        let root = std::env::temp_dir().join(format!(
            "open-diff-svn-fixture-{}",
            SystemTime::now()
                .duration_since(UNIX_EPOCH)
                .map(|d| d.as_nanos())
                .unwrap_or(0)
        ));
        let repo = root.join("repo");
        fs::create_dir_all(&root).unwrap();
        assert!(Command::new("svnadmin")
            .arg("create")
            .arg(&repo)
            .status()
            .unwrap()
            .success());

        let repo_url = format!("file://{}", repo.display());
        let seed = root.join("seed");
        fs::create_dir_all(seed.join("trunk").join("src")).unwrap();
        fs::write(seed.join("trunk").join("readme.txt"), b"hello svn").unwrap();
        fs::write(
            seed.join("trunk").join("src").join("main.rs"),
            b"fn main() {}",
        )
        .unwrap();
        assert!(Command::new("svn")
            .args([
                "import",
                seed.to_str().unwrap(),
                &format!("{repo_url}/project"),
                "-m",
                "seed",
            ])
            .status()
            .unwrap()
            .success());

        let profile = RemoteProfile::new(
            "project-svn",
            "Project SVN",
            RemoteProtocol::Subversion,
            RemoteEndpoint::new(format!("{repo_url}/project/trunk")).with_root_path("/"),
            CredentialReference::profile_store("project-svn"),
        );
        let credential = RemoteCredential::username_password("", "");
        let mut provider = SvnNetworkProvider::connect(&profile, &credential).unwrap();

        let entries = provider.list("/").unwrap();
        assert!(entries.iter().any(|entry| entry.path == "/readme.txt"));
        assert!(entries.iter().any(|entry| entry.path == "/src"));
        assert_eq!(provider.download("/readme.txt").unwrap(), b"hello svn");
        assert_eq!(provider.download("/src/main.rs").unwrap(), b"fn main() {}");

        provider.upload("/notes.txt", b"uploaded".to_vec()).unwrap();
        assert_eq!(provider.download("/notes.txt").unwrap(), b"uploaded");

        let _ = fs::remove_dir_all(&root);
    }

    #[test]
    fn svn_network_provider_rejects_non_subversion_profiles() {
        if !svn_available() {
            return;
        }
        let profile = RemoteProfile::new(
            "release-s3",
            "Release S3",
            RemoteProtocol::S3,
            RemoteEndpoint::new("s3.amazonaws.com").with_root_path("release"),
            CredentialReference::profile_store("release-s3"),
        );
        let credential = RemoteCredential::username_password("key", "secret");
        let error = SvnNetworkProvider::connect(&profile, &credential).unwrap_err();
        assert!(matches!(
            error,
            RemoteProviderError::UnsupportedProtocol(RemoteProtocol::S3)
        ));
    }
}
