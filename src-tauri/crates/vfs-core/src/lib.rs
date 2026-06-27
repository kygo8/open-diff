use serde::{Deserialize, Serialize};
use std::fs;
use std::path::{Path, PathBuf};
use std::time::UNIX_EPOCH;

#[derive(Debug, Clone, PartialEq, Eq, PartialOrd, Ord, Hash, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct VfsPath(String);

impl VfsPath {
    pub fn new(value: impl Into<String>) -> Self {
        Self(value.into())
    }

    pub fn as_str(&self) -> &str {
        &self.0
    }

    pub fn normalized(&self) -> Self {
        normalize_vfs_path(&self.0)
    }

    pub fn join(&self, child: impl AsRef<str>) -> Self {
        let mut base = self.normalized().0;
        let child = normalize_vfs_path(child.as_ref()).0;

        if base.ends_with('/') {
            base.push_str(child.trim_start_matches('/'));
        } else {
            base.push('/');
            base.push_str(child.trim_start_matches('/'));
        }

        normalize_vfs_path(&base)
    }
}

impl From<&str> for VfsPath {
    fn from(value: &str) -> Self {
        Self::new(value)
    }
}

impl From<String> for VfsPath {
    fn from(value: String) -> Self {
        Self::new(value)
    }
}

fn normalize_vfs_path(value: &str) -> VfsPath {
    let unified = value.replace('\\', "/");
    let (prefix, rest) = split_path_prefix(&unified);
    let mut segments = Vec::<&str>::new();

    for segment in rest.split('/') {
        match segment {
            "" | "." => {}
            ".." => {
                let can_pop = segments.last().is_some_and(|previous| *previous != "..");

                if can_pop {
                    segments.pop();
                } else if prefix.is_empty() {
                    segments.push("..");
                }
            }
            _ => segments.push(segment),
        }
    }

    let joined = segments.join("/");

    if prefix.is_empty() {
        if joined.is_empty() {
            return VfsPath::new(".");
        }

        return VfsPath::new(joined);
    }

    if joined.is_empty() {
        return VfsPath::new(prefix);
    }

    VfsPath::new(format!("{prefix}{joined}"))
}

fn split_path_prefix(value: &str) -> (String, &str) {
    if let Some(rest) = value.strip_prefix('/') {
        return ("/".to_owned(), rest);
    }

    let bytes = value.as_bytes();

    if bytes.len() >= 2 && bytes[1] == b':' {
        let drive = &value[..2];
        let rest = value[2..].trim_start_matches('/');

        return (format!("{drive}/"), rest);
    }

    (String::new(), value)
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct VfsEntry {
    pub path: VfsPath,
    pub metadata: VfsMetadata,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct VfsMetadata {
    pub kind: VfsEntryKind,
    pub name: String,
    pub extension: Option<String>,
    pub size: u64,
    pub readonly: bool,
    pub created_at_ms: Option<u128>,
    pub modified_at_ms: Option<u128>,
    pub accessed_at_ms: Option<u128>,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum VfsEntryKind {
    File,
    Directory,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub enum VfsError {
    NotFound(VfsPath),
    AlreadyExists(VfsPath),
    NotDirectory(VfsPath),
    Readonly(VfsPath),
    Io(String),
}

pub type VfsResult<T> = Result<T, VfsError>;

pub trait VfsProvider {
    fn list(&self, path: &VfsPath) -> VfsResult<Vec<VfsEntry>>;

    fn read(&self, path: &VfsPath) -> VfsResult<Vec<u8>>;

    fn write(&mut self, path: &VfsPath, bytes: &[u8]) -> VfsResult<()>;

    fn metadata(&self, path: &VfsPath) -> VfsResult<VfsMetadata>;

    fn delete(&mut self, path: &VfsPath) -> VfsResult<()>;
}

#[derive(Debug, Clone, Default)]
pub struct LocalVfs;

impl LocalVfs {
    pub fn new() -> Self {
        Self
    }
}

impl VfsProvider for LocalVfs {
    fn list(&self, path: &VfsPath) -> VfsResult<Vec<VfsEntry>> {
        let path_buf = path_buf(path);
        let metadata = fs::metadata(&path_buf).map_err(|error| fs_error(path, error))?;

        if !metadata.is_dir() {
            return Err(VfsError::NotDirectory(path.clone()));
        }

        let mut entries = fs::read_dir(&path_buf)
            .map_err(|error| fs_error(path, error))?
            .map(|entry| {
                let entry = entry.map_err(|error| VfsError::Io(error.to_string()))?;
                let entry_path = entry.path();
                let metadata = entry
                    .metadata()
                    .map_err(|error| VfsError::Io(error.to_string()))?;

                Ok(VfsEntry {
                    path: VfsPath::new(entry_path.display().to_string()),
                    metadata: metadata_from_fs(&entry_path, &metadata)?,
                })
            })
            .collect::<VfsResult<Vec<_>>>()?;

        entries.sort_by(|left, right| left.path.cmp(&right.path));

        Ok(entries)
    }

    fn read(&self, path: &VfsPath) -> VfsResult<Vec<u8>> {
        fs::read(path_buf(path)).map_err(|error| fs_error(path, error))
    }

    fn write(&mut self, path: &VfsPath, bytes: &[u8]) -> VfsResult<()> {
        let path_buf = path_buf(path);

        if let Some(parent) = path_buf.parent() {
            fs::create_dir_all(parent).map_err(|error| VfsError::Io(error.to_string()))?;
        }

        fs::write(path_buf, bytes).map_err(|error| fs_error(path, error))
    }

    fn metadata(&self, path: &VfsPath) -> VfsResult<VfsMetadata> {
        let metadata = fs::metadata(path_buf(path)).map_err(|error| fs_error(path, error))?;

        metadata_from_fs(&path_buf(path), &metadata)
    }

    fn delete(&mut self, path: &VfsPath) -> VfsResult<()> {
        let metadata = fs::metadata(path_buf(path)).map_err(|error| fs_error(path, error))?;

        if metadata.is_dir() {
            fs::remove_dir_all(path_buf(path)).map_err(|error| fs_error(path, error))
        } else {
            fs::remove_file(path_buf(path)).map_err(|error| fs_error(path, error))
        }
    }
}

fn path_buf(path: &VfsPath) -> PathBuf {
    Path::new(path.as_str()).to_path_buf()
}

fn metadata_from_fs(path: &Path, metadata: &fs::Metadata) -> VfsResult<VfsMetadata> {
    Ok(VfsMetadata {
        kind: if metadata.is_dir() {
            VfsEntryKind::Directory
        } else {
            VfsEntryKind::File
        },
        name: path
            .file_name()
            .map(|name| name.to_string_lossy().into_owned())
            .unwrap_or_else(|| path.display().to_string()),
        extension: path
            .extension()
            .map(|extension| extension.to_string_lossy().into_owned()),
        size: metadata.len(),
        readonly: metadata.permissions().readonly(),
        created_at_ms: metadata
            .created()
            .ok()
            .and_then(|created| created.duration_since(UNIX_EPOCH).ok())
            .map(|duration| duration.as_millis()),
        modified_at_ms: metadata
            .modified()
            .ok()
            .and_then(|modified| modified.duration_since(UNIX_EPOCH).ok())
            .map(|duration| duration.as_millis()),
        accessed_at_ms: metadata
            .accessed()
            .ok()
            .and_then(|accessed| accessed.duration_since(UNIX_EPOCH).ok())
            .map(|duration| duration.as_millis()),
    })
}

fn fs_error(path: &VfsPath, error: std::io::Error) -> VfsError {
    if error.kind() == std::io::ErrorKind::NotFound {
        return VfsError::NotFound(path.clone());
    }

    if error.kind() == std::io::ErrorKind::PermissionDenied {
        return VfsError::Readonly(path.clone());
    }

    VfsError::Io(error.to_string())
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::collections::BTreeMap;

    #[derive(Default)]
    struct MemoryVfs {
        files: BTreeMap<VfsPath, Vec<u8>>,
    }

    impl VfsProvider for MemoryVfs {
        fn list(&self, path: &VfsPath) -> VfsResult<Vec<VfsEntry>> {
            let prefix = format!("{}/", path.as_str().trim_end_matches('/'));

            Ok(self
                .files
                .iter()
                .filter_map(|(file_path, bytes)| {
                    file_path
                        .as_str()
                        .strip_prefix(&prefix)
                        .and_then(|relative| {
                            (!relative.contains('/')).then_some(VfsEntry {
                                path: file_path.clone(),
                                metadata: VfsMetadata {
                                    kind: VfsEntryKind::File,
                                    name: file_path
                                        .as_str()
                                        .rsplit('/')
                                        .next()
                                        .unwrap_or(file_path.as_str())
                                        .to_owned(),
                                    extension: file_path.as_str().rsplit('/').next().and_then(
                                        |name| {
                                            name.rsplit_once('.')
                                                .map(|(_, extension)| extension.to_owned())
                                        },
                                    ),
                                    size: bytes.len() as u64,
                                    readonly: false,
                                    created_at_ms: None,
                                    modified_at_ms: None,
                                    accessed_at_ms: None,
                                },
                            })
                        })
                })
                .collect())
        }

        fn read(&self, path: &VfsPath) -> VfsResult<Vec<u8>> {
            self.files
                .get(path)
                .cloned()
                .ok_or_else(|| VfsError::NotFound(path.clone()))
        }

        fn write(&mut self, path: &VfsPath, bytes: &[u8]) -> VfsResult<()> {
            self.files.insert(path.clone(), bytes.to_vec());

            Ok(())
        }

        fn metadata(&self, path: &VfsPath) -> VfsResult<VfsMetadata> {
            let bytes = self
                .files
                .get(path)
                .ok_or_else(|| VfsError::NotFound(path.clone()))?;

            Ok(VfsMetadata {
                kind: VfsEntryKind::File,
                name: path
                    .as_str()
                    .rsplit('/')
                    .next()
                    .unwrap_or(path.as_str())
                    .to_owned(),
                extension: path.as_str().rsplit('/').next().and_then(|name| {
                    name.rsplit_once('.')
                        .map(|(_, extension)| extension.to_owned())
                }),
                size: bytes.len() as u64,
                readonly: false,
                created_at_ms: None,
                modified_at_ms: None,
                accessed_at_ms: None,
            })
        }

        fn delete(&mut self, path: &VfsPath) -> VfsResult<()> {
            self.files
                .remove(path)
                .map(|_| ())
                .ok_or_else(|| VfsError::NotFound(path.clone()))
        }
    }

    #[test]
    fn vfs_trait_covers_file_lifecycle_operations() {
        let mut vfs = MemoryVfs::default();
        let root = VfsPath::from("/work");
        let file = VfsPath::from("/work/example.txt");

        vfs.write(&file, b"hello").expect("write should work");

        assert_eq!(vfs.read(&file).expect("read should work"), b"hello");
        assert_eq!(vfs.metadata(&file).expect("metadata should work").size, 5);
        assert_eq!(vfs.list(&root).expect("list should work").len(), 1);

        vfs.delete(&file).expect("delete should work");

        assert!(matches!(vfs.read(&file), Err(VfsError::NotFound(_))));
    }

    #[test]
    fn local_vfs_reads_writes_lists_metadata_and_deletes_files() {
        let root = unique_temp_dir("local-vfs");
        let mut vfs = LocalVfs::new();
        let file = VfsPath::new(
            root.join("nested")
                .join("example.txt")
                .display()
                .to_string(),
        );
        let directory = VfsPath::new(root.join("nested").display().to_string());

        vfs.write(&file, b"local bytes")
            .expect("local write should work");

        assert_eq!(
            vfs.read(&file).expect("local read should work"),
            b"local bytes"
        );
        assert_eq!(
            vfs.metadata(&file)
                .expect("local metadata should work")
                .kind,
            VfsEntryKind::File
        );
        assert_eq!(
            vfs.list(&directory).expect("local list should work")[0].path,
            file
        );

        vfs.delete(&file).expect("local delete should work");

        assert!(matches!(vfs.read(&file), Err(VfsError::NotFound(_))));
        let _ = std::fs::remove_dir_all(root);
    }

    #[test]
    fn normalizes_platform_paths_predictably() {
        assert_eq!(
            VfsPath::new(r"C:\work\.\left\..\right//file.txt")
                .normalized()
                .as_str(),
            "C:/work/right/file.txt"
        );
        assert_eq!(
            VfsPath::new("/work//left/../right/./file.txt")
                .normalized()
                .as_str(),
            "/work/right/file.txt"
        );
        assert_eq!(
            VfsPath::new("/work").join("child/file.txt").as_str(),
            "/work/child/file.txt"
        );
    }

    #[test]
    fn local_vfs_metadata_includes_file_identity_time_and_attributes() {
        let root = unique_temp_dir("metadata");
        let mut vfs = LocalVfs::new();
        let file = VfsPath::new(root.join("report.txt").display().to_string());

        vfs.write(&file, b"metadata").expect("write should work");

        let metadata = vfs.metadata(&file).expect("metadata should work");

        assert_eq!(metadata.name, "report.txt");
        assert_eq!(metadata.extension.as_deref(), Some("txt"));
        assert_eq!(metadata.kind, VfsEntryKind::File);
        assert_eq!(metadata.size, 8);
        assert!(!metadata.readonly);
        assert!(metadata.modified_at_ms.is_some());

        let _ = std::fs::remove_dir_all(root);
    }

    fn unique_temp_dir(label: &str) -> std::path::PathBuf {
        let stamp = std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .expect("system clock should be after epoch")
            .as_nanos();

        std::env::temp_dir().join(format!("open-diff-{label}-{stamp}"))
    }
}
