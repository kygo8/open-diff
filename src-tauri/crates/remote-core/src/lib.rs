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
    pub material: RemoteCredentialMaterial,
}

impl RemoteCredential {
    pub fn username_password(username: impl Into<String>, password: impl Into<String>) -> Self {
        Self {
            username: Some(username.into()),
            material: RemoteCredentialMaterial::Password(SecretString::new(password)),
        }
    }

    pub fn bearer_token(token: impl Into<String>) -> Self {
        Self {
            username: None,
            material: RemoteCredentialMaterial::BearerToken(SecretString::new(token)),
        }
    }

    pub fn private_key(
        username: impl Into<String>,
        private_key: impl Into<String>,
        passphrase: Option<impl Into<String>>,
    ) -> Self {
        Self {
            username: Some(username.into()),
            material: RemoteCredentialMaterial::PrivateKey {
                private_key: SecretString::new(private_key),
                passphrase: passphrase.map(SecretString::new),
            },
        }
    }

    pub fn secret(&self) -> &SecretString {
        match &self.material {
            RemoteCredentialMaterial::Password(secret)
            | RemoteCredentialMaterial::BearerToken(secret) => secret,
            RemoteCredentialMaterial::PrivateKey { private_key, .. } => private_key,
        }
    }
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub enum RemoteCredentialMaterial {
    Password(SecretString),
    BearerToken(SecretString),
    PrivateKey {
        private_key: SecretString,
        passphrase: Option<SecretString>,
    },
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

#[derive(Debug, Clone, PartialEq, Eq)]
pub enum FtpsTlsMode {
    Explicit,
    Implicit,
}

#[derive(Debug, Clone)]
pub struct MemoryFtpsProvider {
    profile: RemoteProfile,
    tls_mode: FtpsTlsMode,
    files: BTreeMap<String, Vec<u8>>,
}

impl MemoryFtpsProvider {
    pub fn connect(profile: RemoteProfile) -> RemoteProviderResult<Self> {
        if profile.protocol != RemoteProtocol::Ftps {
            return Err(RemoteProviderError::UnsupportedProtocol(profile.protocol));
        }

        let tls_mode = profile
            .options
            .get("tlsMode")
            .filter(|mode| mode.eq_ignore_ascii_case("implicit"))
            .map(|_| FtpsTlsMode::Implicit)
            .unwrap_or(FtpsTlsMode::Explicit);

        Ok(Self {
            profile,
            tls_mode,
            files: BTreeMap::new(),
        })
    }

    pub fn profile(&self) -> &RemoteProfile {
        &self.profile
    }

    pub fn tls_mode(&self) -> FtpsTlsMode {
        self.tls_mode.clone()
    }
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub enum WebDavOverwritePolicy {
    Allow,
    Deny,
}

#[derive(Debug, Clone)]
pub struct MemoryWebDavProvider {
    profile: RemoteProfile,
    overwrite_policy: WebDavOverwritePolicy,
    files: BTreeMap<String, Vec<u8>>,
}

impl MemoryWebDavProvider {
    pub fn connect(profile: RemoteProfile) -> RemoteProviderResult<Self> {
        if profile.protocol != RemoteProtocol::WebDav {
            return Err(RemoteProviderError::UnsupportedProtocol(profile.protocol));
        }

        let overwrite_policy = profile
            .options
            .get("allowOverwrite")
            .filter(|value| value.eq_ignore_ascii_case("false"))
            .map(|_| WebDavOverwritePolicy::Deny)
            .unwrap_or(WebDavOverwritePolicy::Allow);

        Ok(Self {
            profile,
            overwrite_policy,
            files: BTreeMap::new(),
        })
    }

    pub fn profile(&self) -> &RemoteProfile {
        &self.profile
    }

    pub fn overwrite_policy(&self) -> WebDavOverwritePolicy {
        self.overwrite_policy.clone()
    }
}

#[derive(Debug, Clone)]
pub struct MemoryS3Provider {
    profile: RemoteProfile,
    bucket: String,
    region: Option<String>,
    objects: BTreeMap<String, Vec<u8>>,
}

impl MemoryS3Provider {
    pub fn connect(profile: RemoteProfile) -> RemoteProviderResult<Self> {
        if profile.protocol != RemoteProtocol::S3 {
            return Err(RemoteProviderError::UnsupportedProtocol(profile.protocol));
        }

        let bucket = profile
            .endpoint
            .root_path
            .as_deref()
            .map(str::trim)
            .map(|path| path.trim_matches('/'))
            .filter(|path| !path.is_empty())
            .map(str::to_owned)
            .ok_or_else(|| RemoteProviderError::InvalidPath("S3 bucket is required".to_owned()))?;
        let region = profile.options.get("region").cloned();

        Ok(Self {
            profile,
            bucket,
            region,
            objects: BTreeMap::new(),
        })
    }

    pub fn profile(&self) -> &RemoteProfile {
        &self.profile
    }

    pub fn bucket(&self) -> &str {
        &self.bucket
    }

    pub fn region(&self) -> Option<&str> {
        self.region.as_deref()
    }
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct OAuthAuthentication {
    pub token_present: bool,
}

#[derive(Debug, Clone)]
pub struct MemoryDropboxProvider {
    profile: RemoteProfile,
    authentication: OAuthAuthentication,
    root_path: String,
    namespace_id: Option<String>,
    files: BTreeMap<String, Vec<u8>>,
}

impl MemoryDropboxProvider {
    pub fn connect(
        profile: RemoteProfile,
        credential: RemoteCredential,
    ) -> RemoteProviderResult<Self> {
        if profile.protocol != RemoteProtocol::Dropbox {
            return Err(RemoteProviderError::UnsupportedProtocol(profile.protocol));
        }

        let authentication = OAuthAuthentication::from_credential(
            &credential,
            "Dropbox requires OAuth bearer token authentication",
        )?;
        let root_path = profile
            .endpoint
            .root_path
            .as_deref()
            .map(normalize_remote_path)
            .transpose()?
            .unwrap_or_else(|| "/".to_owned());
        let namespace_id = profile.options.get("namespaceId").cloned();

        Ok(Self {
            profile,
            authentication,
            root_path,
            namespace_id,
            files: BTreeMap::new(),
        })
    }

    pub fn profile(&self) -> &RemoteProfile {
        &self.profile
    }

    pub fn authentication(&self) -> OAuthAuthentication {
        self.authentication.clone()
    }

    pub fn root_path(&self) -> &str {
        &self.root_path
    }

    pub fn namespace_id(&self) -> Option<&str> {
        self.namespace_id.as_deref()
    }
}

impl OAuthAuthentication {
    fn from_credential(
        credential: &RemoteCredential,
        bearer_required_message: &str,
    ) -> RemoteProviderResult<Self> {
        match credential.material {
            RemoteCredentialMaterial::BearerToken(_) => Ok(Self {
                token_present: true,
            }),
            _ => Err(RemoteProviderError::Backend(
                bearer_required_message.to_owned(),
            )),
        }
    }
}

#[derive(Debug, Clone)]
pub struct MemorySftpProvider {
    profile: RemoteProfile,
    authentication: SftpAuthentication,
    files: BTreeMap<String, Vec<u8>>,
}

impl MemorySftpProvider {
    pub fn connect(
        profile: RemoteProfile,
        credential: RemoteCredential,
    ) -> RemoteProviderResult<Self> {
        if profile.protocol != RemoteProtocol::Sftp {
            return Err(RemoteProviderError::UnsupportedProtocol(profile.protocol));
        }

        let authentication = SftpAuthentication::from_credential(&credential)?;

        Ok(Self {
            profile,
            authentication,
            files: BTreeMap::new(),
        })
    }

    pub fn profile(&self) -> &RemoteProfile {
        &self.profile
    }

    pub fn authentication(&self) -> SftpAuthentication {
        self.authentication.clone()
    }
}

impl RemoteFileProvider for MemorySftpProvider {
    fn list(&self, path: &str) -> RemoteProviderResult<Vec<RemoteEntry>> {
        list_memory_remote_entries(&self.files, path)
    }

    fn download(&self, path: &str) -> RemoteProviderResult<Vec<u8>> {
        download_memory_remote_file(&self.files, path)
    }

    fn upload(&mut self, path: &str, bytes: Vec<u8>) -> RemoteProviderResult<()> {
        upload_memory_remote_file(&mut self.files, path, bytes)
    }

    fn delete(&mut self, path: &str) -> RemoteProviderResult<()> {
        delete_memory_remote_file(&mut self.files, path)
    }

    fn rename(&mut self, from: &str, to: &str) -> RemoteProviderResult<()> {
        rename_memory_remote_file(&mut self.files, from, to)
    }
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub enum SftpAuthentication {
    Password {
        username: String,
    },
    PrivateKey {
        username: String,
        passphrase_protected: bool,
    },
}

impl SftpAuthentication {
    fn from_credential(credential: &RemoteCredential) -> RemoteProviderResult<Self> {
        let username = credential.username.clone().ok_or_else(|| {
            RemoteProviderError::Backend("SFTP authentication requires a username".to_owned())
        })?;

        match &credential.material {
            RemoteCredentialMaterial::Password(_) => Ok(Self::Password { username }),
            RemoteCredentialMaterial::PrivateKey { passphrase, .. } => Ok(Self::PrivateKey {
                username,
                passphrase_protected: passphrase.is_some(),
            }),
            RemoteCredentialMaterial::BearerToken(_) => Err(RemoteProviderError::Backend(
                "SFTP does not support bearer token authentication".to_owned(),
            )),
        }
    }
}

fn list_memory_remote_entries(
    files: &BTreeMap<String, Vec<u8>>,
    path: &str,
) -> RemoteProviderResult<Vec<RemoteEntry>> {
    let directory = normalize_remote_path(path)?;
    let prefix = if directory == "/" {
        "/".to_owned()
    } else {
        format!("{}/", directory.trim_end_matches('/'))
    };
    let mut entries = BTreeMap::<String, RemoteEntry>::new();

    for (file_path, bytes) in files {
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

fn download_memory_remote_file(
    files: &BTreeMap<String, Vec<u8>>,
    path: &str,
) -> RemoteProviderResult<Vec<u8>> {
    let path = normalize_remote_path(path)?;

    files
        .get(&path)
        .cloned()
        .ok_or(RemoteProviderError::NotFound(path))
}

fn upload_memory_remote_file(
    files: &mut BTreeMap<String, Vec<u8>>,
    path: &str,
    bytes: Vec<u8>,
) -> RemoteProviderResult<()> {
    let path = normalize_remote_path(path)?;

    files.insert(path, bytes);

    Ok(())
}

fn delete_memory_remote_file(
    files: &mut BTreeMap<String, Vec<u8>>,
    path: &str,
) -> RemoteProviderResult<()> {
    let path = normalize_remote_path(path)?;

    files
        .remove(&path)
        .map(|_| ())
        .ok_or(RemoteProviderError::NotFound(path))
}

fn rename_memory_remote_file(
    files: &mut BTreeMap<String, Vec<u8>>,
    from: &str,
    to: &str,
) -> RemoteProviderResult<()> {
    let from = normalize_remote_path(from)?;
    let to = normalize_remote_path(to)?;

    if files.contains_key(&to) {
        return Err(RemoteProviderError::AlreadyExists(to));
    }

    let bytes = files
        .remove(&from)
        .ok_or_else(|| RemoteProviderError::NotFound(from.clone()))?;

    files.insert(to, bytes);

    Ok(())
}

impl RemoteFileProvider for MemoryFtpProvider {
    fn list(&self, path: &str) -> RemoteProviderResult<Vec<RemoteEntry>> {
        list_memory_remote_entries(&self.files, path)
    }

    fn download(&self, path: &str) -> RemoteProviderResult<Vec<u8>> {
        download_memory_remote_file(&self.files, path)
    }

    fn upload(&mut self, path: &str, bytes: Vec<u8>) -> RemoteProviderResult<()> {
        upload_memory_remote_file(&mut self.files, path, bytes)
    }

    fn delete(&mut self, path: &str) -> RemoteProviderResult<()> {
        delete_memory_remote_file(&mut self.files, path)
    }

    fn rename(&mut self, from: &str, to: &str) -> RemoteProviderResult<()> {
        rename_memory_remote_file(&mut self.files, from, to)
    }
}

impl RemoteFileProvider for MemoryFtpsProvider {
    fn list(&self, path: &str) -> RemoteProviderResult<Vec<RemoteEntry>> {
        list_memory_remote_entries(&self.files, path)
    }

    fn download(&self, path: &str) -> RemoteProviderResult<Vec<u8>> {
        download_memory_remote_file(&self.files, path)
    }

    fn upload(&mut self, path: &str, bytes: Vec<u8>) -> RemoteProviderResult<()> {
        upload_memory_remote_file(&mut self.files, path, bytes)
    }

    fn delete(&mut self, path: &str) -> RemoteProviderResult<()> {
        delete_memory_remote_file(&mut self.files, path)
    }

    fn rename(&mut self, from: &str, to: &str) -> RemoteProviderResult<()> {
        rename_memory_remote_file(&mut self.files, from, to)
    }
}

impl RemoteFileProvider for MemoryWebDavProvider {
    fn list(&self, path: &str) -> RemoteProviderResult<Vec<RemoteEntry>> {
        list_memory_remote_entries(&self.files, path)
    }

    fn download(&self, path: &str) -> RemoteProviderResult<Vec<u8>> {
        download_memory_remote_file(&self.files, path)
    }

    fn upload(&mut self, path: &str, bytes: Vec<u8>) -> RemoteProviderResult<()> {
        let normalized_path = normalize_remote_path(path)?;

        if self.overwrite_policy == WebDavOverwritePolicy::Deny
            && self.files.contains_key(&normalized_path)
        {
            return Err(RemoteProviderError::AlreadyExists(normalized_path));
        }

        self.files.insert(normalized_path, bytes);

        Ok(())
    }

    fn delete(&mut self, path: &str) -> RemoteProviderResult<()> {
        delete_memory_remote_file(&mut self.files, path)
    }

    fn rename(&mut self, from: &str, to: &str) -> RemoteProviderResult<()> {
        rename_memory_remote_file(&mut self.files, from, to)
    }
}

impl RemoteFileProvider for MemoryS3Provider {
    fn list(&self, path: &str) -> RemoteProviderResult<Vec<RemoteEntry>> {
        list_memory_remote_entries(&self.objects, path)
    }

    fn download(&self, path: &str) -> RemoteProviderResult<Vec<u8>> {
        download_memory_remote_file(&self.objects, path)
    }

    fn upload(&mut self, path: &str, bytes: Vec<u8>) -> RemoteProviderResult<()> {
        upload_memory_remote_file(&mut self.objects, path, bytes)
    }

    fn delete(&mut self, path: &str) -> RemoteProviderResult<()> {
        delete_memory_remote_file(&mut self.objects, path)
    }

    fn rename(&mut self, from: &str, to: &str) -> RemoteProviderResult<()> {
        rename_memory_remote_file(&mut self.objects, from, to)
    }
}

impl RemoteFileProvider for MemoryDropboxProvider {
    fn list(&self, path: &str) -> RemoteProviderResult<Vec<RemoteEntry>> {
        list_memory_remote_entries(&self.files, path)
    }

    fn download(&self, path: &str) -> RemoteProviderResult<Vec<u8>> {
        download_memory_remote_file(&self.files, path)
    }

    fn upload(&mut self, path: &str, bytes: Vec<u8>) -> RemoteProviderResult<()> {
        upload_memory_remote_file(&mut self.files, path, bytes)
    }

    fn delete(&mut self, path: &str) -> RemoteProviderResult<()> {
        delete_memory_remote_file(&mut self.files, path)
    }

    fn rename(&mut self, from: &str, to: &str) -> RemoteProviderResult<()> {
        rename_memory_remote_file(&mut self.files, from, to)
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
        assert_eq!(resolved.secret().expose_secret(), "correct-horse");
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

    #[test]
    fn sftp_provider_connects_with_password_credentials_and_file_operations() {
        let profile = RemoteProfile::new(
            "release-sftp",
            "Release SFTP",
            RemoteProtocol::Sftp,
            RemoteEndpoint::new("sftp.example.com")
                .with_port(22)
                .with_root_path("/incoming"),
            CredentialReference::profile_store("release-sftp"),
        );
        let credential = RemoteCredential::username_password("deploy", "correct-horse");
        let mut provider = MemorySftpProvider::connect(profile, credential).unwrap();

        provider
            .upload("/incoming/app.tar.gz", b"archive".to_vec())
            .unwrap();

        assert_eq!(
            provider.authentication(),
            SftpAuthentication::Password {
                username: "deploy".to_owned()
            }
        );
        assert_eq!(
            provider.download("/incoming/app.tar.gz").unwrap(),
            b"archive"
        );
        assert_eq!(
            provider.list("/incoming").unwrap()[0].path,
            "/incoming/app.tar.gz"
        );
    }

    #[test]
    fn sftp_provider_connects_with_private_key_credentials() {
        let profile = RemoteProfile::new(
            "build-sftp",
            "Build SFTP",
            RemoteProtocol::Sftp,
            RemoteEndpoint::new("build.example.com").with_port(22),
            CredentialReference::profile_store("build-sftp-key"),
        );
        let credential =
            RemoteCredential::private_key("builder", "OPENSSH-PRIVATE-KEY", Some("pin"));
        let provider = MemorySftpProvider::connect(profile, credential).unwrap();

        assert_eq!(
            provider.authentication(),
            SftpAuthentication::PrivateKey {
                username: "builder".to_owned(),
                passphrase_protected: true,
            }
        );
    }

    #[test]
    fn sftp_provider_rejects_non_sftp_profiles() {
        let profile = RemoteProfile::new(
            "release-ftp",
            "Release FTP",
            RemoteProtocol::Ftp,
            RemoteEndpoint::new("ftp.example.com"),
            CredentialReference::profile_store("release-ftp"),
        );
        let credential = RemoteCredential::username_password("deploy", "correct-horse");

        let error = MemorySftpProvider::connect(profile, credential).unwrap_err();

        assert!(matches!(
            error,
            RemoteProviderError::UnsupportedProtocol(RemoteProtocol::Ftp)
        ));
    }

    #[test]
    fn ftps_provider_connects_with_explicit_tls_and_file_operations() {
        let profile = RemoteProfile::new(
            "release-ftps",
            "Release FTPS",
            RemoteProtocol::Ftps,
            RemoteEndpoint::new("ftps.example.com")
                .with_port(21)
                .with_root_path("/secure"),
            CredentialReference::profile_store("release-ftps"),
        )
        .with_option("tlsMode", "explicit");
        let mut provider = MemoryFtpsProvider::connect(profile).unwrap();

        provider
            .upload("/secure/app.zip", b"secure".to_vec())
            .unwrap();

        assert_eq!(provider.tls_mode(), FtpsTlsMode::Explicit);
        assert_eq!(provider.download("/secure/app.zip").unwrap(), b"secure");
        assert_eq!(provider.list("/secure").unwrap()[0].path, "/secure/app.zip");
    }

    #[test]
    fn ftps_provider_supports_implicit_tls_mode() {
        let profile = RemoteProfile::new(
            "legacy-ftps",
            "Legacy FTPS",
            RemoteProtocol::Ftps,
            RemoteEndpoint::new("legacy.example.com").with_port(990),
            CredentialReference::profile_store("legacy-ftps"),
        )
        .with_option("tlsMode", "implicit");

        let provider = MemoryFtpsProvider::connect(profile).unwrap();

        assert_eq!(provider.tls_mode(), FtpsTlsMode::Implicit);
    }

    #[test]
    fn ftps_provider_rejects_non_ftps_profiles() {
        let profile = RemoteProfile::new(
            "release-ftp",
            "Release FTP",
            RemoteProtocol::Ftp,
            RemoteEndpoint::new("ftp.example.com"),
            CredentialReference::profile_store("release-ftp"),
        );

        let error = MemoryFtpsProvider::connect(profile).unwrap_err();

        assert!(matches!(
            error,
            RemoteProviderError::UnsupportedProtocol(RemoteProtocol::Ftp)
        ));
    }

    #[test]
    fn webdav_provider_uploads_lists_and_downloads_remote_resources() {
        let profile = RemoteProfile::new(
            "team-webdav",
            "Team WebDAV",
            RemoteProtocol::WebDav,
            RemoteEndpoint::new("dav.example.com")
                .with_port(443)
                .with_root_path("/shared"),
            CredentialReference::profile_store("team-webdav"),
        )
        .with_option("allowOverwrite", "false");
        let mut provider = MemoryWebDavProvider::connect(profile).unwrap();

        provider
            .upload("/shared/specs/readme.md", b"# Docs".to_vec())
            .unwrap();

        assert_eq!(provider.overwrite_policy(), WebDavOverwritePolicy::Deny);
        assert_eq!(
            provider.download("/shared/specs/readme.md").unwrap(),
            b"# Docs"
        );
        assert_eq!(provider.list("/shared/specs").unwrap()[0].size, 6);
    }

    #[test]
    fn webdav_provider_rejects_overwrite_when_policy_denies_it() {
        let profile = RemoteProfile::new(
            "locked-webdav",
            "Locked WebDAV",
            RemoteProtocol::WebDav,
            RemoteEndpoint::new("dav.example.com"),
            CredentialReference::profile_store("locked-webdav"),
        )
        .with_option("allowOverwrite", "false");
        let mut provider = MemoryWebDavProvider::connect(profile).unwrap();

        provider
            .upload("/shared/plan.txt", b"one".to_vec())
            .unwrap();
        let error = provider
            .upload("/shared/plan.txt", b"two".to_vec())
            .unwrap_err();

        assert!(matches!(
            error,
            RemoteProviderError::AlreadyExists(path) if path == "/shared/plan.txt"
        ));
    }

    #[test]
    fn webdav_provider_rejects_non_webdav_profiles() {
        let profile = RemoteProfile::new(
            "release-sftp",
            "Release SFTP",
            RemoteProtocol::Sftp,
            RemoteEndpoint::new("sftp.example.com"),
            CredentialReference::profile_store("release-sftp"),
        );

        let error = MemoryWebDavProvider::connect(profile).unwrap_err();

        assert!(matches!(
            error,
            RemoteProviderError::UnsupportedProtocol(RemoteProtocol::Sftp)
        ));
    }

    #[test]
    fn s3_provider_lists_and_downloads_bucket_objects() {
        let profile = RemoteProfile::new(
            "release-s3",
            "Release S3",
            RemoteProtocol::S3,
            RemoteEndpoint::new("s3.amazonaws.com").with_root_path("open-diff-release"),
            CredentialReference::profile_store("release-s3"),
        )
        .with_option("region", "us-east-1");
        let mut provider = MemoryS3Provider::connect(profile).unwrap();

        provider
            .upload("/builds/app.zip", b"package".to_vec())
            .unwrap();

        assert_eq!(provider.bucket(), "open-diff-release");
        assert_eq!(provider.region(), Some("us-east-1"));
        assert_eq!(provider.download("/builds/app.zip").unwrap(), b"package");
        assert_eq!(provider.list("/builds").unwrap()[0].path, "/builds/app.zip");
    }

    #[test]
    fn s3_provider_rejects_profiles_without_bucket_name() {
        let profile = RemoteProfile::new(
            "release-s3",
            "Release S3",
            RemoteProtocol::S3,
            RemoteEndpoint::new("s3.amazonaws.com"),
            CredentialReference::profile_store("release-s3"),
        );

        let error = MemoryS3Provider::connect(profile).unwrap_err();

        assert!(matches!(
            error,
            RemoteProviderError::InvalidPath(message) if message == "S3 bucket is required"
        ));
    }

    #[test]
    fn s3_provider_rejects_non_s3_profiles() {
        let profile = RemoteProfile::new(
            "team-webdav",
            "Team WebDAV",
            RemoteProtocol::WebDav,
            RemoteEndpoint::new("dav.example.com"),
            CredentialReference::profile_store("team-webdav"),
        );

        let error = MemoryS3Provider::connect(profile).unwrap_err();

        assert!(matches!(
            error,
            RemoteProviderError::UnsupportedProtocol(RemoteProtocol::WebDav)
        ));
    }

    #[test]
    fn dropbox_provider_connects_with_oauth_token_and_file_operations() {
        let profile = RemoteProfile::new(
            "team-dropbox",
            "Team Dropbox",
            RemoteProtocol::Dropbox,
            RemoteEndpoint::new("api.dropboxapi.com").with_root_path("/OpenDiff"),
            CredentialReference::profile_store("team-dropbox"),
        )
        .with_option("namespaceId", "ns:123");
        let credential = RemoteCredential::bearer_token("dropbox-oauth-token");
        let mut provider = MemoryDropboxProvider::connect(profile, credential).unwrap();

        provider
            .upload("/OpenDiff/report.txt", b"report".to_vec())
            .unwrap();

        assert_eq!(provider.root_path(), "/OpenDiff");
        assert_eq!(provider.namespace_id(), Some("ns:123"));
        assert_eq!(
            provider.authentication(),
            OAuthAuthentication {
                token_present: true,
            }
        );
        assert_eq!(
            provider.download("/OpenDiff/report.txt").unwrap(),
            b"report"
        );
        assert_eq!(
            provider.list("/OpenDiff").unwrap()[0].path,
            "/OpenDiff/report.txt"
        );
    }

    #[test]
    fn dropbox_provider_rejects_password_credentials() {
        let profile = RemoteProfile::new(
            "team-dropbox",
            "Team Dropbox",
            RemoteProtocol::Dropbox,
            RemoteEndpoint::new("api.dropboxapi.com"),
            CredentialReference::profile_store("team-dropbox"),
        );
        let credential = RemoteCredential::username_password("user", "password");

        let error = MemoryDropboxProvider::connect(profile, credential).unwrap_err();

        assert!(matches!(
            error,
            RemoteProviderError::Backend(message) if message == "Dropbox requires OAuth bearer token authentication"
        ));
    }

    #[test]
    fn dropbox_provider_rejects_non_dropbox_profiles() {
        let profile = RemoteProfile::new(
            "team-webdav",
            "Team WebDAV",
            RemoteProtocol::WebDav,
            RemoteEndpoint::new("dav.example.com"),
            CredentialReference::profile_store("team-webdav"),
        );
        let credential = RemoteCredential::bearer_token("dropbox-oauth-token");

        let error = MemoryDropboxProvider::connect(profile, credential).unwrap_err();

        assert!(matches!(
            error,
            RemoteProviderError::UnsupportedProtocol(RemoteProtocol::WebDav)
        ));
    }
}
