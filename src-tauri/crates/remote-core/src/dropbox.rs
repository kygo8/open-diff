use crate::{
    normalize_remote_path, RemoteCredential, RemoteCredentialMaterial, RemoteEntry,
    RemoteEntryKind, RemoteFileProvider, RemoteProfile, RemoteProtocol, RemoteProviderError,
    RemoteProviderResult,
};
use serde_json::{json, Value};
use std::io::Read;
use std::time::Duration;

#[derive(Debug)]
pub struct DropboxNetworkProvider {
    agent: ureq::Agent,
    access_token: String,
    api_host: String,
    content_host: String,
    root_prefix: String,
    namespace_id: Option<String>,
}

impl DropboxNetworkProvider {
    pub fn connect(
        profile: &RemoteProfile,
        credential: &RemoteCredential,
    ) -> RemoteProviderResult<Self> {
        if profile.protocol != RemoteProtocol::Dropbox {
            return Err(RemoteProviderError::UnsupportedProtocol(profile.protocol));
        }

        let access_token = extract_access_token(
            credential,
            "Dropbox requires an OAuth access token (paste into the password / token field)",
        )?;
        let api_host = resolve_dropbox_api_host(profile);
        let content_host = resolve_dropbox_content_host(&api_host);
        let root_prefix = profile
            .endpoint
            .root_path
            .as_deref()
            .map(normalize_remote_path)
            .transpose()?
            .unwrap_or_else(|| "/".to_owned());
        let namespace_id = profile
            .options
            .get("namespaceId")
            .cloned()
            .filter(|value| !value.trim().is_empty());
        let agent = ureq::AgentBuilder::new()
            .timeout_connect(Duration::from_secs(8))
            .timeout_read(Duration::from_secs(30))
            .timeout_write(Duration::from_secs(30))
            .build();

        Ok(Self {
            agent,
            access_token,
            api_host,
            content_host,
            root_prefix,
            namespace_id,
        })
    }

    pub fn api_host(&self) -> &str {
        &self.api_host
    }

    pub fn content_host(&self) -> &str {
        &self.content_host
    }

    pub fn root_prefix(&self) -> &str {
        &self.root_prefix
    }

    fn absolute_path(&self, path: &str) -> RemoteProviderResult<String> {
        join_dropbox_paths(&self.root_prefix, path)
    }

    fn api_path_arg(path: &str) -> String {
        if path == "/" || path.is_empty() {
            String::new()
        } else {
            path.to_owned()
        }
    }

    fn authorized(&self, request: ureq::Request) -> ureq::Request {
        let request = request.set("Authorization", &format!("Bearer {}", self.access_token));
        if let Some(namespace_id) = &self.namespace_id {
            let header = json!({
                ".tag": "namespace_id",
                "namespace_id": namespace_id,
            })
            .to_string();
            request.set("Dropbox-API-Path-Root", &header)
        } else {
            request
        }
    }

    fn api_url(&self, endpoint: &str) -> String {
        format!("https://{}{}", self.api_host, endpoint)
    }

    fn content_url(&self, endpoint: &str) -> String {
        format!("https://{}{}", self.content_host, endpoint)
    }

    fn map_error(path: &str, error: ureq::Error) -> RemoteProviderError {
        match error {
            ureq::Error::Status(404, _) => RemoteProviderError::NotFound(path.to_owned()),
            ureq::Error::Status(409, response) => {
                let body = response.into_string().unwrap_or_default();
                if body.contains("not_found") {
                    RemoteProviderError::NotFound(path.to_owned())
                } else if body.contains("conflict") {
                    RemoteProviderError::AlreadyExists(path.to_owned())
                } else {
                    RemoteProviderError::Backend(format!("HTTP 409: {body}"))
                }
            }
            ureq::Error::Status(code, response) => {
                let body = response.into_string().unwrap_or_default();
                RemoteProviderError::Backend(format!("HTTP {code}: {body}"))
            }
            other => RemoteProviderError::Backend(other.to_string()),
        }
    }
}

impl RemoteFileProvider for DropboxNetworkProvider {
    fn list(&self, path: &str) -> RemoteProviderResult<Vec<RemoteEntry>> {
        let absolute = self.absolute_path(path)?;
        let api_path = Self::api_path_arg(&absolute);
        let body = json!({
            "path": api_path,
            "recursive": false,
            "include_deleted": false,
        });
        let response = self
            .authorized(
                self.agent
                    .post(&self.api_url("/2/files/list_folder"))
                    .set("Content-Type", "application/json"),
            )
            .send_string(&body.to_string())
            .map_err(|error| Self::map_error(&absolute, error))?;
        let text = response
            .into_string()
            .map_err(|error| RemoteProviderError::Backend(error.to_string()))?;
        let value: Value = serde_json::from_str(&text)
            .map_err(|error| RemoteProviderError::Backend(error.to_string()))?;
        Ok(parse_dropbox_list_folder(&value, &absolute))
    }

    fn download(&self, path: &str) -> RemoteProviderResult<Vec<u8>> {
        let absolute = self.absolute_path(path)?;
        if absolute == "/" {
            return Err(RemoteProviderError::InvalidPath(
                "Dropbox download requires a file path".to_owned(),
            ));
        }
        let arg = json!({ "path": absolute }).to_string();
        let response = self
            .authorized(
                self.agent
                    .post(&self.content_url("/2/files/download"))
                    .set("Dropbox-API-Arg", &arg),
            )
            .call()
            .map_err(|error| Self::map_error(&absolute, error))?;
        let mut bytes = Vec::new();
        response
            .into_reader()
            .read_to_end(&mut bytes)
            .map_err(|error| RemoteProviderError::Backend(error.to_string()))?;
        Ok(bytes)
    }

    fn upload(&mut self, path: &str, bytes: Vec<u8>) -> RemoteProviderResult<()> {
        let absolute = self.absolute_path(path)?;
        if absolute == "/" {
            return Err(RemoteProviderError::InvalidPath(
                "Dropbox upload requires a file path".to_owned(),
            ));
        }
        let arg = json!({
            "path": absolute,
            "mode": "overwrite",
            "autorename": false,
            "mute": true,
        })
        .to_string();
        self.authorized(
            self.agent
                .post(&self.content_url("/2/files/upload"))
                .set("Content-Type", "application/octet-stream")
                .set("Dropbox-API-Arg", &arg),
        )
        .send_bytes(&bytes)
        .map_err(|error| Self::map_error(&absolute, error))?;
        Ok(())
    }

    fn delete(&mut self, path: &str) -> RemoteProviderResult<()> {
        let absolute = self.absolute_path(path)?;
        if absolute == "/" {
            return Err(RemoteProviderError::InvalidPath(
                "Dropbox delete requires a path".to_owned(),
            ));
        }
        let body = json!({ "path": absolute });
        self.authorized(
            self.agent
                .post(&self.api_url("/2/files/delete_v2"))
                .set("Content-Type", "application/json"),
        )
        .send_string(&body.to_string())
        .map_err(|error| Self::map_error(&absolute, error))?;
        Ok(())
    }

    fn rename(&mut self, from: &str, to: &str) -> RemoteProviderResult<()> {
        let from_path = self.absolute_path(from)?;
        let to_path = self.absolute_path(to)?;
        if from_path == "/" || to_path == "/" {
            return Err(RemoteProviderError::InvalidPath(
                "Dropbox rename requires file paths".to_owned(),
            ));
        }
        let body = json!({
            "from_path": from_path,
            "to_path": to_path,
            "allow_shared_folder": false,
            "autorename": false,
            "allow_ownership_transfer": false,
        });
        self.authorized(
            self.agent
                .post(&self.api_url("/2/files/move_v2"))
                .set("Content-Type", "application/json"),
        )
        .send_string(&body.to_string())
        .map_err(|error| Self::map_error(&from_path, error))?;
        Ok(())
    }

    fn mkdir(&mut self, path: &str) -> RemoteProviderResult<()> {
        let absolute = self.absolute_path(path)?;
        if absolute == "/" {
            return Ok(());
        }
        let body = json!({
            "path": absolute,
            "autorename": false,
        });
        self.authorized(
            self.agent
                .post(&self.api_url("/2/files/create_folder_v2"))
                .set("Content-Type", "application/json"),
        )
        .send_string(&body.to_string())
        .map_err(|error| Self::map_error(&absolute, error))?;
        Ok(())
    }
}

pub(crate) fn extract_access_token(
    credential: &RemoteCredential,
    missing_message: &str,
) -> RemoteProviderResult<String> {
    let token = match &credential.material {
        RemoteCredentialMaterial::BearerToken(secret)
        | RemoteCredentialMaterial::Password(secret) => secret.expose_secret().trim().to_owned(),
        RemoteCredentialMaterial::PrivateKey { .. } => {
            return Err(RemoteProviderError::Backend(missing_message.to_owned()));
        }
    };
    if token.is_empty() {
        return Err(RemoteProviderError::Backend(missing_message.to_owned()));
    }
    Ok(token)
}

fn resolve_dropbox_api_host(profile: &RemoteProfile) -> String {
    let host = profile.endpoint.host.trim();
    let base = if host.is_empty()
        || host.eq_ignore_ascii_case("dropbox")
        || host.eq_ignore_ascii_case("www.dropbox.com")
    {
        "api.dropboxapi.com".to_owned()
    } else {
        strip_scheme(host)
    };
    match profile.endpoint.port {
        Some(port) if port != 443 && port != 80 => format!("{base}:{port}"),
        _ => base,
    }
}

fn resolve_dropbox_content_host(api_host: &str) -> String {
    if api_host.eq_ignore_ascii_case("api.dropboxapi.com") {
        "content.dropboxapi.com".to_owned()
    } else {
        api_host.to_owned()
    }
}

fn strip_scheme(value: &str) -> String {
    value
        .strip_prefix("https://")
        .or_else(|| value.strip_prefix("http://"))
        .unwrap_or(value)
        .split('/')
        .next()
        .unwrap_or(value)
        .to_owned()
}

pub fn join_dropbox_paths(root: &str, path: &str) -> RemoteProviderResult<String> {
    let root = normalize_remote_path(root)?;
    let path = normalize_remote_path(path)?;
    if root == "/" {
        return Ok(path);
    }
    if path == "/" {
        return Ok(root);
    }
    Ok(format!(
        "{}/{}",
        root.trim_end_matches('/'),
        path.trim_start_matches('/')
    ))
}

pub fn parse_dropbox_list_folder(value: &Value, request_path: &str) -> Vec<RemoteEntry> {
    let mut entries = Vec::new();
    let Some(entries_value) = value.get("entries").and_then(Value::as_array) else {
        return entries;
    };
    for entry in entries_value {
        let tag = entry
            .get(".tag")
            .and_then(Value::as_str)
            .unwrap_or_default();
        let name = entry
            .get("name")
            .and_then(Value::as_str)
            .unwrap_or_default();
        if name.is_empty() {
            continue;
        }
        let path_display = entry
            .get("path_display")
            .and_then(Value::as_str)
            .map(|value| {
                if value.starts_with('/') {
                    value.to_owned()
                } else {
                    format!("/{value}")
                }
            })
            .unwrap_or_else(|| {
                if request_path == "/" {
                    format!("/{name}")
                } else {
                    format!(
                        "{}/{}",
                        request_path.trim_end_matches('/'),
                        name.trim_start_matches('/')
                    )
                }
            });
        let kind = if tag == "folder" {
            RemoteEntryKind::Directory
        } else {
            RemoteEntryKind::File
        };
        let size = entry.get("size").and_then(Value::as_u64).unwrap_or(0);
        entries.push(RemoteEntry {
            path: path_display,
            kind,
            size,
        });
    }
    entries.sort_by(|left, right| left.path.cmp(&right.path));
    entries
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::{CredentialReference, RemoteEndpoint, RemoteProfile};

    #[test]
    fn join_dropbox_paths_combines_root_prefix() {
        assert_eq!(join_dropbox_paths("/", "/docs").unwrap(), "/docs");
        assert_eq!(
            join_dropbox_paths("/OpenDiff", "/docs").unwrap(),
            "/OpenDiff/docs"
        );
        assert_eq!(join_dropbox_paths("/OpenDiff", "/").unwrap(), "/OpenDiff");
    }

    #[test]
    fn parse_dropbox_list_folder_reads_files_and_folders() {
        let value = json!({
            "entries": [
                {".tag": "folder", "name": "docs", "path_display": "/OpenDiff/docs"},
                {".tag": "file", "name": "readme.md", "path_display": "/OpenDiff/readme.md", "size": 12}
            ]
        });
        let entries = parse_dropbox_list_folder(&value, "/OpenDiff");
        assert_eq!(entries.len(), 2);
        assert_eq!(entries[0].path, "/OpenDiff/docs");
        assert_eq!(entries[0].kind, RemoteEntryKind::Directory);
        assert_eq!(entries[1].path, "/OpenDiff/readme.md");
        assert_eq!(entries[1].size, 12);
    }

    #[test]
    fn connect_requires_access_token() {
        let profile = RemoteProfile::new(
            "team-dropbox",
            "Team Dropbox",
            RemoteProtocol::Dropbox,
            RemoteEndpoint::new("api.dropboxapi.com").with_root_path("/OpenDiff"),
            CredentialReference::profile_store("team-dropbox"),
        );
        let error = DropboxNetworkProvider::connect(
            &profile,
            &RemoteCredential::username_password("user", ""),
        )
        .unwrap_err();
        assert!(matches!(error, RemoteProviderError::Backend(_)));
    }

    #[test]
    fn connect_accepts_password_field_as_access_token() {
        let profile = RemoteProfile::new(
            "team-dropbox",
            "Team Dropbox",
            RemoteProtocol::Dropbox,
            RemoteEndpoint::new("dropbox").with_root_path("/"),
            CredentialReference::profile_store("team-dropbox"),
        );
        let provider = DropboxNetworkProvider::connect(
            &profile,
            &RemoteCredential::username_password("", "dbx-token"),
        )
        .unwrap();
        assert_eq!(provider.api_host(), "api.dropboxapi.com");
        assert_eq!(provider.content_host(), "content.dropboxapi.com");
    }
}
