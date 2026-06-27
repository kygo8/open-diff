use serde::{Deserialize, Serialize};

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
    pub size: u64,
    pub readonly: bool,
    pub modified_at_ms: Option<u128>,
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
                                    size: bytes.len() as u64,
                                    readonly: false,
                                    modified_at_ms: None,
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
                size: bytes.len() as u64,
                readonly: false,
                modified_at_ms: None,
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
}
