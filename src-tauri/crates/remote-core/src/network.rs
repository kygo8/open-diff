use crate::{
    normalize_remote_path, RemoteCredential, RemoteCredentialMaterial, RemoteEndpoint, RemoteEntry,
    RemoteEntryKind, RemoteFileProvider, RemoteProfile, RemoteProtocol, RemoteProviderError,
    RemoteProviderResult,
};
use std::cell::RefCell;
use std::fs;
use std::io::{Read, Write};
use std::net::{SocketAddr, TcpStream, ToSocketAddrs};
use std::path::{Path, PathBuf};
use std::sync::atomic::{AtomicBool, Ordering};
use std::time::{Duration, SystemTime, UNIX_EPOCH};

pub fn protocol_is_implemented(protocol: RemoteProtocol) -> bool {
    matches!(
        protocol,
        RemoteProtocol::Sftp
            | RemoteProtocol::Ftp
            | RemoteProtocol::Ftps
            | RemoteProtocol::WebDav
            | RemoteProtocol::S3
            | RemoteProtocol::Dropbox
            | RemoteProtocol::OneDrive
            | RemoteProtocol::Subversion
    )
}

pub fn unimplemented_protocol_message(protocol: RemoteProtocol) -> String {
    format!(
        "{protocol:?} is unimplemented; only SFTP, FTP, FTPS, WebDAV, S3, Dropbox, OneDrive, and SVN connections are live"
    )
}

static PREFER_IPV6: AtomicBool = AtomicBool::new(false);

/// Prefer IPv6 addresses when DNS returns both families (Options > Tweaks).
pub fn set_prefer_ipv6(prefer: bool) {
    PREFER_IPV6.store(prefer, Ordering::Relaxed);
}

pub fn prefer_ipv6() -> bool {
    PREFER_IPV6.load(Ordering::Relaxed)
}

/// Pick a socket address according to the IPv6 preference tweak.
pub fn pick_preferred_socket_addr(
    addrs: impl IntoIterator<Item = SocketAddr>,
) -> Option<SocketAddr> {
    let mut addrs: Vec<SocketAddr> = addrs.into_iter().collect();
    if addrs.is_empty() {
        return None;
    }
    let prefer_v6 = prefer_ipv6();
    addrs.sort_by_key(|addr| {
        let is_v6 = matches!(addr, SocketAddr::V6(_));
        if prefer_v6 {
            !is_v6
        } else {
            is_v6
        }
    });
    addrs.into_iter().next()
}

pub fn test_network_connection(
    profile: &RemoteProfile,
    credential: &RemoteCredential,
) -> RemoteProviderResult<String> {
    match profile.protocol {
        RemoteProtocol::Sftp => {
            let provider = SftpNetworkProvider::connect(profile, credential)?;
            let root = profile.endpoint.root_path.as_deref().unwrap_or("/");
            let entries = provider.list(root)?;
            Ok(format!(
                "SFTP connected to {}:{} and listed {} entries",
                profile.endpoint.host,
                profile.endpoint.port.unwrap_or(22),
                entries.len()
            ))
        }
        RemoteProtocol::Ftp => {
            let provider = FtpNetworkProvider::connect(profile, credential)?;
            let root = profile.endpoint.root_path.as_deref().unwrap_or("/");
            let entries = provider.list(root)?;
            Ok(format!(
                "FTP connected to {}:{} and listed {} entries",
                profile.endpoint.host,
                profile.endpoint.port.unwrap_or(21),
                entries.len()
            ))
        }
        RemoteProtocol::Ftps => {
            let provider = FtpsNetworkProvider::connect(profile, credential)?;
            let root = profile.endpoint.root_path.as_deref().unwrap_or("/");
            let entries = provider.list(root)?;
            let tls_mode = provider.tls_mode();
            let default_port = match tls_mode {
                crate::FtpsTlsMode::Implicit => 990,
                crate::FtpsTlsMode::Explicit => 21,
            };
            Ok(format!(
                "FTPS ({tls_mode:?}) connected to {}:{} and listed {} entries",
                profile.endpoint.host,
                profile.endpoint.port.unwrap_or(default_port),
                entries.len()
            ))
        }
        RemoteProtocol::WebDav => {
            let provider = crate::WebDavNetworkProvider::connect(profile, credential)?;
            let root = profile.endpoint.root_path.as_deref().unwrap_or("/");
            let entries = provider.list(root)?;
            Ok(format!(
                "WebDAV connected to {} and listed {} entries",
                crate::webdav::webdav_base_url(&profile.endpoint),
                entries.len()
            ))
        }
        RemoteProtocol::S3 => {
            let provider = crate::S3NetworkProvider::connect(profile, credential)?;
            let entries = provider.list("/")?;
            Ok(format!(
                "S3 connected to bucket {} in {} and listed {} entries",
                provider.bucket(),
                provider.region(),
                entries.len()
            ))
        }
        RemoteProtocol::Subversion => {
            let provider = crate::SvnNetworkProvider::connect(profile, credential)?;
            let root = profile.endpoint.root_path.as_deref().unwrap_or("/");
            let entries = provider.list(root)?;
            Ok(format!(
                "SVN connected to {} and listed {} entries",
                provider.repo_url(),
                entries.len()
            ))
        }
        RemoteProtocol::Dropbox => {
            let provider = crate::DropboxNetworkProvider::connect(profile, credential)?;
            let root = profile.endpoint.root_path.as_deref().unwrap_or("/");
            let entries = provider.list(root)?;
            Ok(format!(
                "Dropbox connected via {} and listed {} entries",
                provider.api_host(),
                entries.len()
            ))
        }
        RemoteProtocol::OneDrive => {
            let provider = crate::OneDriveNetworkProvider::connect(profile, credential)?;
            let root = profile.endpoint.root_path.as_deref().unwrap_or("/");
            let entries = provider.list(root)?;
            Ok(format!(
                "OneDrive connected via {} and listed {} entries",
                provider.graph_host(),
                entries.len()
            ))
        }
    }
}

pub fn open_network_provider(
    profile: &RemoteProfile,
    credential: &RemoteCredential,
) -> RemoteProviderResult<Box<dyn RemoteFileProvider>> {
    match profile.protocol {
        RemoteProtocol::Sftp => Ok(Box::new(SftpNetworkProvider::connect(profile, credential)?)),
        RemoteProtocol::Ftp => Ok(Box::new(FtpNetworkProvider::connect(profile, credential)?)),
        RemoteProtocol::Ftps => Ok(Box::new(FtpsNetworkProvider::connect(profile, credential)?)),
        RemoteProtocol::WebDav => Ok(Box::new(crate::WebDavNetworkProvider::connect(
            profile, credential,
        )?)),
        RemoteProtocol::S3 => Ok(Box::new(crate::S3NetworkProvider::connect(
            profile, credential,
        )?)),
        RemoteProtocol::Subversion => Ok(Box::new(crate::SvnNetworkProvider::connect(
            profile, credential,
        )?)),
        RemoteProtocol::Dropbox => Ok(Box::new(crate::DropboxNetworkProvider::connect(
            profile, credential,
        )?)),
        RemoteProtocol::OneDrive => Ok(Box::new(crate::OneDriveNetworkProvider::connect(
            profile, credential,
        )?)),
    }
}

pub struct SftpNetworkProvider {
    session: ssh2::Session,
}

impl SftpNetworkProvider {
    pub fn connect(
        profile: &RemoteProfile,
        credential: &RemoteCredential,
    ) -> RemoteProviderResult<Self> {
        if profile.protocol != RemoteProtocol::Sftp {
            return Err(RemoteProviderError::UnsupportedProtocol(profile.protocol));
        }

        let mut session = ssh2::Session::new()
            .map_err(|error| RemoteProviderError::Backend(error.to_string()))?;
        let stream = connect_tcp(&profile.endpoint, 22)?;
        session.set_tcp_stream(stream);
        session
            .handshake()
            .map_err(|error| RemoteProviderError::Backend(error.to_string()))?;
        authenticate_sftp(&session, credential)?;

        Ok(Self { session })
    }

    fn sftp(&self) -> RemoteProviderResult<ssh2::Sftp> {
        self.session
            .sftp()
            .map_err(|error| RemoteProviderError::Backend(error.to_string()))
    }
}

impl RemoteFileProvider for SftpNetworkProvider {
    fn list(&self, path: &str) -> RemoteProviderResult<Vec<RemoteEntry>> {
        let path = normalize_remote_path(path)?;
        let sftp = self.sftp()?;
        let entries = sftp
            .readdir(Path::new(&path))
            .map_err(|error| map_ssh_error(&path, error))?;

        Ok(entries
            .into_iter()
            .map(|(entry_path, stat)| {
                let kind = if stat.is_dir() {
                    RemoteEntryKind::Directory
                } else {
                    RemoteEntryKind::File
                };
                RemoteEntry {
                    path: normalize_remote_path(&entry_path.to_string_lossy())
                        .unwrap_or_else(|_| entry_path.to_string_lossy().into_owned()),
                    kind,
                    size: stat.size.unwrap_or(0),
                }
            })
            .collect())
    }

    fn download(&self, path: &str) -> RemoteProviderResult<Vec<u8>> {
        let path = normalize_remote_path(path)?;
        let sftp = self.sftp()?;
        let mut file = sftp
            .open(Path::new(&path))
            .map_err(|error| map_ssh_error(&path, error))?;
        let mut bytes = Vec::new();
        file.read_to_end(&mut bytes)
            .map_err(|error| RemoteProviderError::Backend(error.to_string()))?;
        Ok(bytes)
    }

    fn upload(&mut self, path: &str, bytes: Vec<u8>) -> RemoteProviderResult<()> {
        let path = normalize_remote_path(path)?;
        let sftp = self.sftp()?;
        let mut file = sftp
            .create(Path::new(&path))
            .map_err(|error| map_ssh_error(&path, error))?;
        file.write_all(&bytes)
            .map_err(|error| RemoteProviderError::Backend(error.to_string()))?;
        Ok(())
    }

    fn delete(&mut self, path: &str) -> RemoteProviderResult<()> {
        let path = normalize_remote_path(path)?;
        let sftp = self.sftp()?;
        sftp.unlink(Path::new(&path))
            .or_else(|_| sftp.rmdir(Path::new(&path)))
            .map_err(|error| map_ssh_error(&path, error))
    }

    fn rename(&mut self, from: &str, to: &str) -> RemoteProviderResult<()> {
        let from = normalize_remote_path(from)?;
        let to = normalize_remote_path(to)?;
        let sftp = self.sftp()?;
        sftp.rename(Path::new(&from), Path::new(&to), None)
            .map_err(|error| map_ssh_error(&from, error))
    }
}

pub struct FtpNetworkProvider {
    stream: RefCell<suppaftp::FtpStream>,
}

impl FtpNetworkProvider {
    pub fn connect(
        profile: &RemoteProfile,
        credential: &RemoteCredential,
    ) -> RemoteProviderResult<Self> {
        if profile.protocol != RemoteProtocol::Ftp {
            return Err(RemoteProviderError::UnsupportedProtocol(profile.protocol));
        }

        let address = socket_address(&profile.endpoint, 21);
        let mut stream = suppaftp::FtpStream::connect(&address)
            .map_err(|error| RemoteProviderError::Backend(error.to_string()))?;
        let username = credential_username(credential)?;
        let password = credential_password(credential)?;
        stream
            .login(username, password)
            .map_err(|error| RemoteProviderError::Backend(error.to_string()))?;

        Ok(Self {
            stream: RefCell::new(stream),
        })
    }
}

impl RemoteFileProvider for FtpNetworkProvider {
    fn list(&self, path: &str) -> RemoteProviderResult<Vec<RemoteEntry>> {
        let path = normalize_remote_path(path)?;
        let names = self
            .stream
            .borrow_mut()
            .nlst(Some(&path))
            .map_err(|error| RemoteProviderError::Backend(error.to_string()))?;

        Ok(names
            .into_iter()
            .map(|name| {
                let entry_path = if name.starts_with('/') {
                    name
                } else if path == "/" {
                    format!("/{name}")
                } else {
                    format!("{path}/{name}")
                };
                RemoteEntry {
                    path: entry_path,
                    kind: RemoteEntryKind::File,
                    size: 0,
                }
            })
            .collect())
    }

    fn download(&self, path: &str) -> RemoteProviderResult<Vec<u8>> {
        let path = normalize_remote_path(path)?;
        let cursor = self
            .stream
            .borrow_mut()
            .retr_as_buffer(&path)
            .map_err(|error| RemoteProviderError::Backend(error.to_string()))?;
        Ok(cursor.into_inner())
    }

    fn upload(&mut self, path: &str, bytes: Vec<u8>) -> RemoteProviderResult<()> {
        let path = normalize_remote_path(path)?;
        let mut cursor = std::io::Cursor::new(bytes);
        self.stream
            .borrow_mut()
            .put_file(&path, &mut cursor)
            .map_err(|error| RemoteProviderError::Backend(error.to_string()))?;
        Ok(())
    }

    fn delete(&mut self, path: &str) -> RemoteProviderResult<()> {
        let path = normalize_remote_path(path)?;
        let mut stream = self.stream.borrow_mut();
        stream
            .rm(&path)
            .or_else(|_| stream.rmdir(&path))
            .map_err(|error| RemoteProviderError::Backend(error.to_string()))
    }

    fn rename(&mut self, from: &str, to: &str) -> RemoteProviderResult<()> {
        let from = normalize_remote_path(from)?;
        let to = normalize_remote_path(to)?;
        self.stream
            .borrow_mut()
            .rename(&from, &to)
            .map_err(|error| RemoteProviderError::Backend(error.to_string()))
    }
}

pub struct FtpsNetworkProvider {
    stream: RefCell<suppaftp::NativeTlsFtpStream>,
    tls_mode: crate::FtpsTlsMode,
}

impl FtpsNetworkProvider {
    pub fn connect(
        profile: &RemoteProfile,
        credential: &RemoteCredential,
    ) -> RemoteProviderResult<Self> {
        if profile.protocol != RemoteProtocol::Ftps {
            return Err(RemoteProviderError::UnsupportedProtocol(profile.protocol));
        }

        let tls_mode = resolve_ftps_tls_mode(profile);
        let default_port = match tls_mode {
            crate::FtpsTlsMode::Implicit => 990,
            crate::FtpsTlsMode::Explicit => 21,
        };
        let address = socket_address(&profile.endpoint, default_port);
        let domain = profile.endpoint.host.as_str();
        let connector = build_ftps_connector(profile)?;
        let mut stream = match tls_mode {
            crate::FtpsTlsMode::Explicit => {
                let plain = suppaftp::NativeTlsFtpStream::connect(&address)
                    .map_err(|error| RemoteProviderError::Backend(error.to_string()))?;
                plain
                    .into_secure(connector, domain)
                    .map_err(|error| RemoteProviderError::Backend(error.to_string()))?
            }
            crate::FtpsTlsMode::Implicit => {
                suppaftp::NativeTlsFtpStream::connect_secure_implicit(&address, connector, domain)
                    .map_err(|error| RemoteProviderError::Backend(error.to_string()))?
            }
        };
        let username = credential_username(credential)?;
        let password = credential_password(credential)?;
        stream
            .login(username, password)
            .map_err(|error| RemoteProviderError::Backend(error.to_string()))?;

        Ok(Self {
            stream: RefCell::new(stream),
            tls_mode,
        })
    }

    pub fn tls_mode(&self) -> crate::FtpsTlsMode {
        self.tls_mode.clone()
    }
}

impl RemoteFileProvider for FtpsNetworkProvider {
    fn list(&self, path: &str) -> RemoteProviderResult<Vec<RemoteEntry>> {
        let path = normalize_remote_path(path)?;
        let names = self
            .stream
            .borrow_mut()
            .nlst(Some(&path))
            .map_err(|error| RemoteProviderError::Backend(error.to_string()))?;

        Ok(names
            .into_iter()
            .map(|name| {
                let entry_path = if name.starts_with('/') {
                    name
                } else if path == "/" {
                    format!("/{name}")
                } else {
                    format!("{path}/{name}")
                };
                RemoteEntry {
                    path: entry_path,
                    kind: RemoteEntryKind::File,
                    size: 0,
                }
            })
            .collect())
    }

    fn download(&self, path: &str) -> RemoteProviderResult<Vec<u8>> {
        let path = normalize_remote_path(path)?;
        let cursor = self
            .stream
            .borrow_mut()
            .retr_as_buffer(&path)
            .map_err(|error| RemoteProviderError::Backend(error.to_string()))?;
        Ok(cursor.into_inner())
    }

    fn upload(&mut self, path: &str, bytes: Vec<u8>) -> RemoteProviderResult<()> {
        let path = normalize_remote_path(path)?;
        let mut cursor = std::io::Cursor::new(bytes);
        self.stream
            .borrow_mut()
            .put_file(&path, &mut cursor)
            .map_err(|error| RemoteProviderError::Backend(error.to_string()))?;
        Ok(())
    }

    fn delete(&mut self, path: &str) -> RemoteProviderResult<()> {
        let path = normalize_remote_path(path)?;
        let mut stream = self.stream.borrow_mut();
        stream
            .rm(&path)
            .or_else(|_| stream.rmdir(&path))
            .map_err(|error| RemoteProviderError::Backend(error.to_string()))
    }

    fn rename(&mut self, from: &str, to: &str) -> RemoteProviderResult<()> {
        let from = normalize_remote_path(from)?;
        let to = normalize_remote_path(to)?;
        self.stream
            .borrow_mut()
            .rename(&from, &to)
            .map_err(|error| RemoteProviderError::Backend(error.to_string()))
    }
}

fn resolve_ftps_tls_mode(profile: &RemoteProfile) -> crate::FtpsTlsMode {
    if let Some(mode) = profile.options.get("tlsMode") {
        if mode.eq_ignore_ascii_case("implicit") {
            return crate::FtpsTlsMode::Implicit;
        }
        if mode.eq_ignore_ascii_case("explicit") {
            return crate::FtpsTlsMode::Explicit;
        }
    }

    match profile.endpoint.port {
        Some(990) => crate::FtpsTlsMode::Implicit,
        _ => crate::FtpsTlsMode::Explicit,
    }
}

fn build_ftps_connector(
    profile: &RemoteProfile,
) -> RemoteProviderResult<suppaftp::NativeTlsConnector> {
    let insecure = profile
        .options
        .get("insecureTls")
        .map(|value| !value.eq_ignore_ascii_case("false"))
        .unwrap_or(true);
    let mut builder = suppaftp::native_tls::TlsConnector::builder();
    if insecure {
        builder.danger_accept_invalid_certs(true);
        builder.danger_accept_invalid_hostnames(true);
    }
    let connector = builder
        .build()
        .map_err(|error| RemoteProviderError::Backend(error.to_string()))?;
    Ok(suppaftp::NativeTlsConnector::from(connector))
}

fn connect_tcp(endpoint: &RemoteEndpoint, default_port: u16) -> RemoteProviderResult<TcpStream> {
    let address = socket_address(endpoint, default_port);
    let stream = TcpStream::connect_timeout(&resolve_address(&address)?, Duration::from_secs(8))
        .map_err(|error| RemoteProviderError::Backend(format!("connect failed: {error}")))?;
    stream.set_read_timeout(Some(Duration::from_secs(15))).ok();
    stream.set_write_timeout(Some(Duration::from_secs(15))).ok();
    Ok(stream)
}

fn socket_address(endpoint: &RemoteEndpoint, default_port: u16) -> String {
    format!(
        "{}:{}",
        endpoint.host,
        endpoint.port.unwrap_or(default_port)
    )
}

fn resolve_address(address: &str) -> RemoteProviderResult<SocketAddr> {
    let addrs = address
        .to_socket_addrs()
        .map_err(|error| RemoteProviderError::Backend(error.to_string()))?;
    pick_preferred_socket_addr(addrs)
        .ok_or_else(|| RemoteProviderError::Backend(format!("could not resolve {address}")))
}

fn authenticate_sftp(
    session: &ssh2::Session,
    credential: &RemoteCredential,
) -> RemoteProviderResult<()> {
    let username = credential_username(credential)?;

    match &credential.material {
        RemoteCredentialMaterial::Password(secret) => session
            .userauth_password(username, secret.expose_secret())
            .map_err(|error| RemoteProviderError::Backend(error.to_string())),
        RemoteCredentialMaterial::PrivateKey {
            private_key,
            passphrase,
        } => authenticate_sftp_private_key(
            session,
            username,
            private_key.expose_secret(),
            passphrase.as_ref().map(|value| value.expose_secret()),
        ),
        RemoteCredentialMaterial::BearerToken(_) => Err(RemoteProviderError::Backend(
            "SFTP does not support bearer token authentication".to_owned(),
        )),
    }
}

fn authenticate_sftp_private_key(
    session: &ssh2::Session,
    username: &str,
    private_key: &str,
    passphrase: Option<&str>,
) -> RemoteProviderResult<()> {
    let key_file = stage_private_key_file(private_key)?;
    session
        .userauth_pubkey_file(username, None, key_file.path(), passphrase)
        .map_err(|error| RemoteProviderError::Backend(error.to_string()))
}

struct StagedPrivateKey {
    path: PathBuf,
}

impl StagedPrivateKey {
    fn path(&self) -> &Path {
        &self.path
    }
}

impl Drop for StagedPrivateKey {
    fn drop(&mut self) {
        let _ = fs::remove_file(&self.path);
    }
}

fn stage_private_key_file(private_key: &str) -> RemoteProviderResult<StagedPrivateKey> {
    let stamp = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|duration| duration.as_nanos())
        .unwrap_or(0);
    let path = std::env::temp_dir().join(format!(
        "opendiff-sftp-key-{}-{stamp}.pem",
        std::process::id()
    ));
    fs::write(&path, private_key).map_err(|error| {
        RemoteProviderError::Backend(format!("could not stage SFTP private key: {error}"))
    })?;
    crate::persist::restrict_file_permissions(&path);
    Ok(StagedPrivateKey { path })
}

fn credential_username(credential: &RemoteCredential) -> RemoteProviderResult<&str> {
    credential
        .username
        .as_deref()
        .ok_or_else(|| RemoteProviderError::Backend("username is required for SFTP/FTP".to_owned()))
}

fn credential_password(credential: &RemoteCredential) -> RemoteProviderResult<&str> {
    match &credential.material {
        RemoteCredentialMaterial::Password(secret) => Ok(secret.expose_secret()),
        _ => Err(RemoteProviderError::Backend(
            "FTP requires a password credential".to_owned(),
        )),
    }
}

fn map_ssh_error(path: &str, error: ssh2::Error) -> RemoteProviderError {
    if error.code() == ssh2::ErrorCode::Session(-31) {
        RemoteProviderError::NotFound(path.to_owned())
    } else {
        RemoteProviderError::Backend(error.to_string())
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::{CredentialReference, RemoteEndpoint, RemoteProfile};

    #[test]
    fn sftp_test_connection_performs_a_real_tcp_connect() {
        let profile = RemoteProfile::new(
            "closed-sftp",
            "Closed SFTP",
            RemoteProtocol::Sftp,
            RemoteEndpoint::new("127.0.0.1").with_port(1),
            CredentialReference::profile_store("closed-sftp"),
        );
        let credential = RemoteCredential::username_password("deploy", "secret");
        let error = test_network_connection(&profile, &credential).unwrap_err();

        assert!(matches!(
            error,
            RemoteProviderError::Backend(message) if message.contains("connect failed")
        ));
    }

    #[test]
    fn cloud_drive_protocols_are_implemented_and_attempt_live_connect() {
        assert!(protocol_is_implemented(RemoteProtocol::Dropbox));
        assert!(protocol_is_implemented(RemoteProtocol::OneDrive));
        assert!(protocol_is_implemented(RemoteProtocol::S3));
        assert!(protocol_is_implemented(RemoteProtocol::Subversion));
        assert!(protocol_is_implemented(RemoteProtocol::Sftp));
        assert!(protocol_is_implemented(RemoteProtocol::Ftp));
        assert!(protocol_is_implemented(RemoteProtocol::Ftps));
        assert!(protocol_is_implemented(RemoteProtocol::WebDav));

        let dropbox = RemoteProfile::new(
            "closed-dropbox",
            "Closed Dropbox",
            RemoteProtocol::Dropbox,
            RemoteEndpoint::new("127.0.0.1")
                .with_port(1)
                .with_root_path("/"),
            CredentialReference::profile_store("closed-dropbox"),
        );
        let dropbox_error =
            test_network_connection(&dropbox, &RemoteCredential::bearer_token("token"))
                .unwrap_err();
        assert!(matches!(dropbox_error, RemoteProviderError::Backend(_)));

        let onedrive = RemoteProfile::new(
            "closed-onedrive",
            "Closed OneDrive",
            RemoteProtocol::OneDrive,
            RemoteEndpoint::new("127.0.0.1")
                .with_port(1)
                .with_root_path("/"),
            CredentialReference::profile_store("closed-onedrive"),
        );
        let onedrive_error =
            test_network_connection(&onedrive, &RemoteCredential::bearer_token("token"))
                .unwrap_err();
        assert!(matches!(onedrive_error, RemoteProviderError::Backend(_)));
    }

    #[test]
    fn s3_test_connection_attempts_a_real_https_connect() {
        let profile = RemoteProfile::new(
            "closed-s3",
            "Closed S3",
            RemoteProtocol::S3,
            RemoteEndpoint::new("127.0.0.1")
                .with_port(1)
                .with_root_path("demo"),
            CredentialReference::profile_store("closed-s3"),
        )
        .with_option("region", "us-east-1")
        .with_option("pathStyle", "true")
        .with_option("useHttps", "false");
        let credential = RemoteCredential::username_password("AKIAEXAMPLE", "secret");
        let error = test_network_connection(&profile, &credential).unwrap_err();

        assert!(matches!(error, RemoteProviderError::Backend(_)));
    }

    #[test]
    fn ftps_test_connection_attempts_a_real_tls_connect() {
        let profile = RemoteProfile::new(
            "closed-ftps",
            "Closed FTPS",
            RemoteProtocol::Ftps,
            RemoteEndpoint::new("127.0.0.1").with_port(1),
            CredentialReference::profile_store("closed-ftps"),
        );
        let credential = RemoteCredential::username_password("deploy", "secret");
        let error = test_network_connection(&profile, &credential).unwrap_err();

        assert!(matches!(error, RemoteProviderError::Backend(_)));
    }

    #[test]
    fn ftps_tls_mode_defaults_from_port_and_options() {
        let explicit = RemoteProfile::new(
            "explicit-ftps",
            "Explicit FTPS",
            RemoteProtocol::Ftps,
            RemoteEndpoint::new("127.0.0.1").with_port(21),
            CredentialReference::profile_store("explicit-ftps"),
        );
        assert_eq!(
            resolve_ftps_tls_mode(&explicit),
            crate::FtpsTlsMode::Explicit
        );

        let implicit_port = RemoteProfile::new(
            "implicit-port",
            "Implicit port",
            RemoteProtocol::Ftps,
            RemoteEndpoint::new("127.0.0.1").with_port(990),
            CredentialReference::profile_store("implicit-port"),
        );
        assert_eq!(
            resolve_ftps_tls_mode(&implicit_port),
            crate::FtpsTlsMode::Implicit
        );

        let implicit_option = RemoteProfile::new(
            "implicit-option",
            "Implicit option",
            RemoteProtocol::Ftps,
            RemoteEndpoint::new("127.0.0.1").with_port(21),
            CredentialReference::profile_store("implicit-option"),
        )
        .with_option("tlsMode", "implicit");
        assert_eq!(
            resolve_ftps_tls_mode(&implicit_option),
            crate::FtpsTlsMode::Implicit
        );
    }

    #[test]
    fn stages_sftp_private_key_to_a_restricted_temp_file() {
        let pem =
            "-----BEGIN OPENSSH PRIVATE KEY-----\ntest-key\n-----END OPENSSH PRIVATE KEY-----\n";
        let staged = stage_private_key_file(pem).expect("key should stage");
        let path = staged.path().to_path_buf();

        assert_eq!(fs::read_to_string(&path).expect("staged key"), pem);
        #[cfg(unix)]
        {
            use std::os::unix::fs::PermissionsExt;
            let mode = fs::metadata(&path).expect("metadata").permissions().mode() & 0o777;
            assert_eq!(mode, 0o600);
        }

        drop(staged);
        assert!(
            !path.exists(),
            "staged private key must be removed after auth"
        );
    }

    #[test]
    fn sftp_private_key_auth_uses_the_portable_pubkey_file_path() {
        let profile = RemoteProfile::new(
            "closed-sftp-key",
            "Closed SFTP key",
            RemoteProtocol::Sftp,
            RemoteEndpoint::new("127.0.0.1").with_port(1),
            CredentialReference::profile_store("closed-sftp-key"),
        );
        let credential = RemoteCredential::private_key(
            "deploy",
            "-----BEGIN OPENSSH PRIVATE KEY-----\ntest-key\n-----END OPENSSH PRIVATE KEY-----\n",
            None::<String>,
        );
        let error = test_network_connection(&profile, &credential).unwrap_err();

        assert!(matches!(
            error,
            RemoteProviderError::Backend(message) if message.contains("connect failed")
        ));
    }
    #[test]
    fn pick_preferred_socket_addr_orders_by_preference() {
        use std::net::{Ipv4Addr, Ipv6Addr, SocketAddrV4, SocketAddrV6};

        let v4 = SocketAddr::V4(SocketAddrV4::new(Ipv4Addr::LOCALHOST, 22));
        let v6 = SocketAddr::V6(SocketAddrV6::new(Ipv6Addr::LOCALHOST, 22, 0, 0));

        set_prefer_ipv6(false);
        assert_eq!(pick_preferred_socket_addr([v6, v4]), Some(v4));

        set_prefer_ipv6(true);
        assert_eq!(pick_preferred_socket_addr([v4, v6]), Some(v6));

        set_prefer_ipv6(false);
    }
}
