use serde::{Deserialize, Serialize};
use std::collections::BTreeMap;
use std::fmt::{Debug, Formatter};

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

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq, PartialOrd, Ord)]
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

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq, PartialOrd, Ord)]
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

#[derive(Clone, PartialEq, Eq)]
pub struct SecretString(String);

impl SecretString {
    pub fn new(value: impl Into<String>) -> Self {
        Self(value.into())
    }

    pub fn expose_secret(&self) -> &str {
        &self.0
    }
}

impl Debug for SecretString {
    fn fmt(&self, formatter: &mut Formatter<'_>) -> std::fmt::Result {
        formatter.write_str("SecretString(**redacted**)")
    }
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct RemoteCredential {
    pub username: Option<String>,
    pub secret: SecretString,
}

impl RemoteCredential {
    pub fn username_password(username: impl Into<String>, password: impl Into<String>) -> Self {
        Self {
            username: Some(username.into()),
            secret: SecretString::new(password),
        }
    }

    pub fn bearer_token(token: impl Into<String>) -> Self {
        Self {
            username: None,
            secret: SecretString::new(token),
        }
    }
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub enum CredentialStoreError {
    NotFound(CredentialReference),
    Backend(String),
}

pub type CredentialStoreResult<T> = Result<T, CredentialStoreError>;

pub trait CredentialStore {
    fn put(
        &mut self,
        credential_ref: CredentialReference,
        credential: RemoteCredential,
    ) -> CredentialStoreResult<()>;

    fn resolve(
        &self,
        credential_ref: &CredentialReference,
    ) -> CredentialStoreResult<RemoteCredential>;

    fn delete(&mut self, credential_ref: &CredentialReference) -> CredentialStoreResult<()>;
}

#[derive(Debug, Clone, Default)]
pub struct MemoryCredentialStore {
    credentials: BTreeMap<CredentialReference, RemoteCredential>,
}

impl CredentialStore for MemoryCredentialStore {
    fn put(
        &mut self,
        credential_ref: CredentialReference,
        credential: RemoteCredential,
    ) -> CredentialStoreResult<()> {
        self.credentials.insert(credential_ref, credential);

        Ok(())
    }

    fn resolve(
        &self,
        credential_ref: &CredentialReference,
    ) -> CredentialStoreResult<RemoteCredential> {
        self.credentials
            .get(credential_ref)
            .cloned()
            .ok_or_else(|| CredentialStoreError::NotFound(credential_ref.clone()))
    }

    fn delete(&mut self, credential_ref: &CredentialReference) -> CredentialStoreResult<()> {
        self.credentials
            .remove(credential_ref)
            .map(|_| ())
            .ok_or_else(|| CredentialStoreError::NotFound(credential_ref.clone()))
    }
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct RemoteEntry {
    pub path: String,
    pub kind: RemoteEntryKind,
    pub size: u64,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub enum RemoteEntryKind {
    File,
    Directory,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub enum RemoteProviderError {
    UnsupportedProtocol(RemoteProtocol),
    NotFound(String),
    AlreadyExists(String),
    InvalidPath(String),
    Backend(String),
}

pub type RemoteProviderResult<T> = Result<T, RemoteProviderError>;

pub trait RemoteFileProvider {
    fn list(&self, path: &str) -> RemoteProviderResult<Vec<RemoteEntry>>;

    fn download(&self, path: &str) -> RemoteProviderResult<Vec<u8>>;

    fn upload(&mut self, path: &str, bytes: Vec<u8>) -> RemoteProviderResult<()>;

    fn delete(&mut self, path: &str) -> RemoteProviderResult<()>;

    fn rename(&mut self, from: &str, to: &str) -> RemoteProviderResult<()>;
}

#[derive(Debug, Clone)]
pub struct MemoryFtpProvider {
    profile: RemoteProfile,
    files: BTreeMap<String, Vec<u8>>,
}

impl MemoryFtpProvider {
    pub fn connect(profile: RemoteProfile) -> RemoteProviderResult<Self> {
        if profile.protocol != RemoteProtocol::Ftp {
            return Err(RemoteProviderError::UnsupportedProtocol(profile.protocol));
        }

        Ok(Self {
            profile,
            files: BTreeMap::new(),
        })
    }

    pub fn profile(&self) -> &RemoteProfile {
        &self.profile
    }
}

impl RemoteFileProvider for MemoryFtpProvider {
    fn list(&self, path: &str) -> RemoteProviderResult<Vec<RemoteEntry>> {
        let directory = normalize_remote_path(path)?;
        let prefix = if directory == "/" {
            "/".to_owned()
        } else {
            format!("{}/", directory.trim_end_matches('/'))
        };
        let mut entries = BTreeMap::<String, RemoteEntry>::new();

        for (file_path, bytes) in &self.files {
            let Some(relative) = file_path.strip_prefix(&prefix) else {
                continue;
            };

            if relative.is_empty() {
                continue;
            }

            let entry_path = if let Some((directory_name, _)) = relative.split_once('/') {
                format!("{prefix}{directory_name}")
            } else {
                file_path.clone()
            };
            let kind = if entry_path == *file_path {
                RemoteEntryKind::File
            } else {
                RemoteEntryKind::Directory
            };
            let size = if kind == RemoteEntryKind::File {
                bytes.len() as u64
            } else {
                0
            };

            entries.entry(entry_path.clone()).or_insert(RemoteEntry {
                path: entry_path,
                kind,
                size,
            });
        }

        Ok(entries.into_values().collect())
    }

    fn download(&self, path: &str) -> RemoteProviderResult<Vec<u8>> {
        let path = normalize_remote_path(path)?;

        self.files
            .get(&path)
            .cloned()
            .ok_or(RemoteProviderError::NotFound(path))
    }

    fn upload(&mut self, path: &str, bytes: Vec<u8>) -> RemoteProviderResult<()> {
        let path = normalize_remote_path(path)?;

        self.files.insert(path, bytes);

        Ok(())
    }

    fn delete(&mut self, path: &str) -> RemoteProviderResult<()> {
        let path = normalize_remote_path(path)?;

        self.files
            .remove(&path)
            .map(|_| ())
            .ok_or(RemoteProviderError::NotFound(path))
    }

    fn rename(&mut self, from: &str, to: &str) -> RemoteProviderResult<()> {
        let from = normalize_remote_path(from)?;
        let to = normalize_remote_path(to)?;

        if self.files.contains_key(&to) {
            return Err(RemoteProviderError::AlreadyExists(to));
        }

        let bytes = self
            .files
            .remove(&from)
            .ok_or_else(|| RemoteProviderError::NotFound(from.clone()))?;

        self.files.insert(to, bytes);

        Ok(())
    }
}

fn normalize_remote_path(path: &str) -> RemoteProviderResult<String> {
    let normalized = path.replace('\\', "/");
    let mut segments = Vec::<&str>::new();

    for segment in normalized.split('/') {
        match segment {
            "" | "." => {}
            ".." => {
                segments.pop().ok_or_else(|| {
                    RemoteProviderError::InvalidPath("path escapes remote root".to_owned())
                })?;
            }
            _ => segments.push(segment),
        }
    }

    if segments.is_empty() {
        return Ok("/".to_owned());
    }

    Ok(format!("/{}", segments.join("/")))
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

    #[test]
    fn credential_store_resolves_secret_material_by_reference() {
        let mut store = MemoryCredentialStore::default();
        let credential_ref = CredentialReference::profile_store("release-ftp");

        store
            .put(
                credential_ref.clone(),
                RemoteCredential::username_password("deploy", "correct-horse"),
            )
            .unwrap();

        let resolved = store.resolve(&credential_ref).unwrap();

        assert_eq!(resolved.username.as_deref(), Some("deploy"));
        assert_eq!(resolved.secret.expose_secret(), "correct-horse");
    }

    #[test]
    fn missing_credentials_return_structured_errors() {
        let store = MemoryCredentialStore::default();
        let missing_ref = CredentialReference::system_keychain("missing-sftp");

        let error = store.resolve(&missing_ref).unwrap_err();

        assert!(matches!(
            error,
            CredentialStoreError::NotFound(CredentialReference { key, .. }) if key == "missing-sftp"
        ));
    }

    #[test]
    fn ftp_provider_uploads_lists_downloads_renames_and_deletes_files() {
        let profile = RemoteProfile::new(
            "release-ftp",
            "Release FTP",
            RemoteProtocol::Ftp,
            RemoteEndpoint::new("ftp.example.com")
                .with_port(21)
                .with_root_path("/releases"),
            CredentialReference::profile_store("release-ftp"),
        );
        let mut provider = MemoryFtpProvider::connect(profile).unwrap();

        provider
            .upload("/releases/app.zip", b"package".to_vec())
            .unwrap();

        let entries = provider.list("/releases").unwrap();

        assert_eq!(entries.len(), 1);
        assert_eq!(entries[0].path, "/releases/app.zip");
        assert_eq!(entries[0].kind, RemoteEntryKind::File);
        assert_eq!(entries[0].size, 7);
        assert_eq!(provider.download("/releases/app.zip").unwrap(), b"package");

        provider
            .rename("/releases/app.zip", "/releases/app-1.0.zip")
            .unwrap();

        assert!(matches!(
            provider.download("/releases/app.zip"),
            Err(RemoteProviderError::NotFound(path)) if path == "/releases/app.zip"
        ));
        assert_eq!(
            provider.download("/releases/app-1.0.zip").unwrap(),
            b"package"
        );

        provider.delete("/releases/app-1.0.zip").unwrap();

        assert!(provider.list("/releases").unwrap().is_empty());
    }

    #[test]
    fn ftp_provider_rejects_non_ftp_profiles() {
        let profile = RemoteProfile::new(
            "team-webdav",
            "Team WebDAV",
            RemoteProtocol::WebDav,
            RemoteEndpoint::new("dav.example.com"),
            CredentialReference::environment("OPEN_DIFF_WEBDAV_CREDENTIAL"),
        );

        let error = MemoryFtpProvider::connect(profile).unwrap_err();

        assert!(matches!(
            error,
            RemoteProviderError::UnsupportedProtocol(RemoteProtocol::WebDav)
        ));
    }
}
