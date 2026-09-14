use crate::dropbox::extract_access_token;
use crate::{
    normalize_remote_path, RemoteCredential, RemoteEntry, RemoteEntryKind, RemoteFileProvider,
    RemoteProfile, RemoteProtocol, RemoteProviderError, RemoteProviderResult,
};
use serde_json::{json, Value};
use std::io::Read;
use std::time::Duration;

#[derive(Debug)]
pub struct OneDriveNetworkProvider {
    agent: ureq::Agent,
    access_token: String,
    graph_host: String,
    root_prefix: String,
    drive_id: Option<String>,
}

impl OneDriveNetworkProvider {
    pub fn connect(
        profile: &RemoteProfile,
        credential: &RemoteCredential,
    ) -> RemoteProviderResult<Self> {
        if profile.protocol != RemoteProtocol::OneDrive {
            return Err(RemoteProviderError::UnsupportedProtocol(profile.protocol));
        }

        let access_token = extract_access_token(
            credential,
            "OneDrive requires a Microsoft Graph access token (paste into the password / token field)",
        )?;
        let graph_host = resolve_graph_host(profile);
        let root_prefix = profile
            .endpoint
            .root_path
            .as_deref()
            .map(normalize_remote_path)
            .transpose()?
            .unwrap_or_else(|| "/".to_owned());
        let drive_id = profile
            .options
            .get("driveId")
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
            graph_host,
            root_prefix,
            drive_id,
        })
    }

    pub fn graph_host(&self) -> &str {
        &self.graph_host
    }

    pub fn root_prefix(&self) -> &str {
        &self.root_prefix
    }

    pub fn drive_id(&self) -> Option<&str> {
        self.drive_id.as_deref()
    }

    fn absolute_path(&self, path: &str) -> RemoteProviderResult<String> {
        join_onedrive_paths(&self.root_prefix, path)
    }

    fn authorized(&self, request: ureq::Request) -> ureq::Request {
        request.set("Authorization", &format!("Bearer {}", self.access_token))
    }

    fn drive_root(&self) -> String {
        match &self.drive_id {
            Some(drive_id) => format!("/v1.0/drives/{drive_id}/root"),
            None => "/v1.0/me/drive/root".to_owned(),
        }
    }

    fn item_url(&self, absolute: &str, suffix: &str) -> String {
        let base = if absolute == "/" {
            format!("https://{}{}", self.graph_host, self.drive_root())
        } else {
            format!(
                "https://{}{}:{}:",
                self.graph_host,
                self.drive_root(),
                encode_graph_path(absolute)
            )
        };
        if suffix.is_empty() {
            base
        } else {
            format!("{base}{suffix}")
        }
    }

    fn children_url(&self, absolute: &str) -> String {
        self.item_url(absolute, "/children")
    }

    fn content_url(&self, absolute: &str) -> String {
        self.item_url(absolute, "/content")
    }

    fn map_error(path: &str, error: ureq::Error) -> RemoteProviderError {
        match error {
            ureq::Error::Status(404, _) => RemoteProviderError::NotFound(path.to_owned()),
            ureq::Error::Status(409, _) => RemoteProviderError::AlreadyExists(path.to_owned()),
            ureq::Error::Status(code, response) => {
                let body = response.into_string().unwrap_or_default();
                RemoteProviderError::Backend(format!("HTTP {code}: {body}"))
            }
            other => RemoteProviderError::Backend(other.to_string()),
        }
    }
}

impl RemoteFileProvider for OneDriveNetworkProvider {
    fn list(&self, path: &str) -> RemoteProviderResult<Vec<RemoteEntry>> {
        let absolute = self.absolute_path(path)?;
        let response = self
            .authorized(self.agent.get(&self.children_url(&absolute)))
            .call()
            .map_err(|error| Self::map_error(&absolute, error))?;
        let text = response
            .into_string()
            .map_err(|error| RemoteProviderError::Backend(error.to_string()))?;
        let value: Value = serde_json::from_str(&text)
            .map_err(|error| RemoteProviderError::Backend(error.to_string()))?;
        Ok(parse_onedrive_children(&value, &absolute))
    }

    fn download(&self, path: &str) -> RemoteProviderResult<Vec<u8>> {
        let absolute = self.absolute_path(path)?;
        if absolute == "/" {
            return Err(RemoteProviderError::InvalidPath(
                "OneDrive download requires a file path".to_owned(),
            ));
        }
        let response = self
            .authorized(self.agent.get(&self.content_url(&absolute)))
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
                "OneDrive upload requires a file path".to_owned(),
            ));
        }
        self.authorized(
            self.agent
                .request("PUT", &self.content_url(&absolute))
                .set("Content-Type", "application/octet-stream"),
        )
        .send_bytes(&bytes)
        .map_err(|error| Self::map_error(&absolute, error))?;
        Ok(())
    }

    fn delete(&mut self, path: &str) -> RemoteProviderResult<()> {
        let absolute = self.absolute_path(path)?;
        if absolute == "/" {
            return Err(RemoteProviderError::InvalidPath(
                "OneDrive delete requires a path".to_owned(),
            ));
        }
        self.authorized(self.agent.request("DELETE", &self.item_url(&absolute, "")))
            .call()
            .map_err(|error| Self::map_error(&absolute, error))?;
        Ok(())
    }

    fn rename(&mut self, from: &str, to: &str) -> RemoteProviderResult<()> {
        let from_path = self.absolute_path(from)?;
        let to_path = self.absolute_path(to)?;
        if from_path == "/" || to_path == "/" {
            return Err(RemoteProviderError::InvalidPath(
                "OneDrive rename requires file paths".to_owned(),
            ));
        }
        let name = to_path
            .rsplit('/')
            .next()
            .filter(|value| !value.is_empty())
            .ok_or_else(|| {
                RemoteProviderError::InvalidPath("OneDrive rename target name is empty".to_owned())
            })?;
        let body = json!({ "name": name });
        self.authorized(
            self.agent
                .request("PATCH", &self.item_url(&from_path, ""))
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
        let parent = parent_path(&absolute);
        let name = absolute
            .rsplit('/')
            .next()
            .filter(|value| !value.is_empty())
            .ok_or_else(|| {
                RemoteProviderError::InvalidPath("OneDrive mkdir name is empty".to_owned())
            })?;
        let body = json!({
            "name": name,
            "folder": {},
            "@microsoft.graph.conflictBehavior": "fail",
        });
        self.authorized(
            self.agent
                .post(&self.children_url(&parent))
                .set("Content-Type", "application/json"),
        )
        .send_string(&body.to_string())
        .map_err(|error| Self::map_error(&absolute, error))?;
        Ok(())
    }
}

fn resolve_graph_host(profile: &RemoteProfile) -> String {
    let host = profile.endpoint.host.trim();
    let base = if host.is_empty()
        || host.eq_ignore_ascii_case("onedrive")
        || host.eq_ignore_ascii_case("one-drive")
        || host.eq_ignore_ascii_case("login.microsoftonline.com")
    {
        "graph.microsoft.com".to_owned()
    } else {
        host.strip_prefix("https://")
            .or_else(|| host.strip_prefix("http://"))
            .unwrap_or(host)
            .split('/')
            .next()
            .unwrap_or(host)
            .to_owned()
    };
    match profile.endpoint.port {
        Some(port) if port != 443 && port != 80 => format!("{base}:{port}"),
        _ => base,
    }
}

pub fn join_onedrive_paths(root: &str, path: &str) -> RemoteProviderResult<String> {
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

fn parent_path(path: &str) -> String {
    let trimmed = path.trim_end_matches('/');
    match trimmed.rsplit_once('/') {
        None | Some(("", _)) => "/".to_owned(),
        Some((parent, _)) => parent.to_owned(),
    }
}

fn encode_graph_path(path: &str) -> String {
    path.trim_start_matches('/')
        .split('/')
        .map(|segment| {
            let mut out = String::new();
            for byte in segment.bytes() {
                match byte {
                    b'A'..=b'Z' | b'a'..=b'z' | b'0'..=b'9' | b'-' | b'_' | b'.' | b'~' => {
                        out.push(byte as char);
                    }
                    _ => {
                        out.push('%');
                        out.push(format!("{byte:02X}").chars().next().unwrap());
                        out.push(format!("{byte:02X}").chars().nth(1).unwrap());
                    }
                }
            }
            out
        })
        .collect::<Vec<_>>()
        .join("/")
}

pub fn parse_onedrive_children(value: &Value, request_path: &str) -> Vec<RemoteEntry> {
    let mut entries = Vec::new();
    let Some(items) = value.get("value").and_then(Value::as_array) else {
        return entries;
    };
    for item in items {
        let name = item.get("name").and_then(Value::as_str).unwrap_or_default();
        if name.is_empty() {
            continue;
        }
        let path = if request_path == "/" {
            format!("/{name}")
        } else {
            format!("{}/{}", request_path.trim_end_matches('/'), name)
        };
        let kind = if item.get("folder").is_some() {
            RemoteEntryKind::Directory
        } else {
            RemoteEntryKind::File
        };
        let size = item.get("size").and_then(Value::as_u64).unwrap_or(0);
        entries.push(RemoteEntry { path, kind, size });
    }
    entries.sort_by(|left, right| left.path.cmp(&right.path));
    entries
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::{CredentialReference, RemoteEndpoint, RemoteProfile};

    #[test]
    fn join_onedrive_paths_combines_root_prefix() {
        assert_eq!(join_onedrive_paths("/", "/docs").unwrap(), "/docs");
        assert_eq!(join_onedrive_paths("/Apps", "/docs").unwrap(), "/Apps/docs");
    }

    #[test]
    fn parse_onedrive_children_reads_files_and_folders() {
        let value = json!({
            "value": [
                {"name": "docs", "folder": {}, "size": 0},
                {"name": "readme.md", "size": 12, "file": {}}
            ]
        });
        let entries = parse_onedrive_children(&value, "/");
        assert_eq!(entries.len(), 2);
        assert_eq!(entries[0].kind, RemoteEntryKind::Directory);
        assert_eq!(entries[1].path, "/readme.md");
        assert_eq!(entries[1].size, 12);
    }

    #[test]
    fn connect_accepts_bearer_or_password_token() {
        let profile = RemoteProfile::new(
            "work-onedrive",
            "Work OneDrive",
            RemoteProtocol::OneDrive,
            RemoteEndpoint::new("onedrive").with_root_path("/"),
            CredentialReference::profile_store("work-onedrive"),
        );
        let provider = OneDriveNetworkProvider::connect(
            &profile,
            &RemoteCredential::bearer_token("ms-graph-token"),
        )
        .unwrap();
        assert_eq!(provider.graph_host(), "graph.microsoft.com");
    }
}
