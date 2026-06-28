use serde::{Deserialize, Serialize};
use std::collections::BTreeMap;

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq, PartialOrd, Ord)]
#[serde(rename_all = "kebab-case")]
pub enum RemoteProtocol {
    Ftp,
    Ftps,
    Sftp,
    WebDav,
    S3,
    Dropbox,
    OneDrive,
    Subversion,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct RemoteEndpoint {
    pub host: String,
    pub port: Option<u16>,
    pub root_path: Option<String>,
}

impl RemoteEndpoint {
    pub fn new(host: impl Into<String>) -> Self {
        Self {
            host: host.into(),
            port: None,
            root_path: None,
        }
    }

    pub fn with_port(mut self, port: u16) -> Self {
        self.port = Some(port);

        self
    }

    pub fn with_root_path(mut self, root_path: impl Into<String>) -> Self {
        self.root_path = Some(root_path.into());

        self
    }
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct CredentialReference {
    pub kind: CredentialReferenceKind,
    pub key: String,
}

impl CredentialReference {
    pub fn system_keychain(key: impl Into<String>) -> Self {
        Self {
            kind: CredentialReferenceKind::SystemKeychain,
            key: key.into(),
        }
    }

    pub fn environment(key: impl Into<String>) -> Self {
        Self {
            kind: CredentialReferenceKind::Environment,
            key: key.into(),
        }
    }

    pub fn profile_store(key: impl Into<String>) -> Self {
        Self {
            kind: CredentialReferenceKind::ProfileStore,
            key: key.into(),
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "kebab-case")]
pub enum CredentialReferenceKind {
    SystemKeychain,
    Environment,
    ProfileStore,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct RemoteProfile {
    pub id: String,
    pub name: String,
    pub protocol: RemoteProtocol,
    pub endpoint: RemoteEndpoint,
    pub credential_ref: CredentialReference,
    pub options: BTreeMap<String, String>,
}

impl RemoteProfile {
    pub fn new(
        id: impl Into<String>,
        name: impl Into<String>,
        protocol: RemoteProtocol,
        endpoint: RemoteEndpoint,
        credential_ref: CredentialReference,
    ) -> Self {
        Self {
            id: id.into(),
            name: name.into(),
            protocol,
            endpoint,
            credential_ref,
            options: BTreeMap::new(),
        }
    }

    pub fn with_option(mut self, key: impl Into<String>, value: impl Into<String>) -> Self {
        self.options.insert(key.into(), value.into());

        self
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn profile_serializes_credential_references_without_plaintext_secrets() {
        let profile = RemoteProfile::new(
            "prod-sftp",
            "Production SFTP",
            RemoteProtocol::Sftp,
            RemoteEndpoint::new("files.example.com").with_port(22),
            CredentialReference::system_keychain("prod-sftp-main"),
        );

        let json = serde_json::to_string(&profile).unwrap();

        assert!(json.contains("prod-sftp-main"));
        assert!(json.contains("credentialRef"));
        assert!(!json.contains("password"));
        assert!(!json.contains("token"));
        assert!(!json.contains("secret"));
    }

    #[test]
    fn profile_carries_protocol_endpoint_defaults_and_options() {
        let profile = RemoteProfile::new(
            "team-webdav",
            "Team WebDAV",
            RemoteProtocol::WebDav,
            RemoteEndpoint::new("dav.example.com")
                .with_port(443)
                .with_root_path("/shared/releases"),
            CredentialReference::environment("OPEN_DIFF_WEBDAV_CREDENTIAL"),
        )
        .with_option("tlsMode", "required")
        .with_option("timeoutSeconds", "30");

        assert_eq!(profile.id, "team-webdav");
        assert_eq!(profile.protocol, RemoteProtocol::WebDav);
        assert_eq!(profile.endpoint.host, "dav.example.com");
        assert_eq!(profile.endpoint.port, Some(443));
        assert_eq!(
            profile.endpoint.root_path.as_deref(),
            Some("/shared/releases")
        );
        assert_eq!(
            profile.options.get("tlsMode").map(String::as_str),
            Some("required")
        );
        assert_eq!(
            profile.credential_ref.kind,
            CredentialReferenceKind::Environment
        );
    }
}
