use serde::{Deserialize, Serialize};
use std::collections::BTreeMap;

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ArchiveDocument {
    pub name: String,
    files: BTreeMap<String, Vec<u8>>,
}

impl ArchiveDocument {
    pub fn new(name: impl Into<String>) -> Self {
        Self {
            name: name.into(),
            files: BTreeMap::new(),
        }
    }

    pub fn with_file(mut self, path: impl AsRef<str>, bytes: Vec<u8>) -> Self {
        self.files
            .insert(normalize_archive_path(path.as_ref()), bytes);

        self
    }
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ArchiveEntry {
    pub path: String,
    pub kind: ArchiveEntryKind,
    pub size: u64,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "kebab-case")]
pub enum ArchiveEntryKind {
    File,
    Directory,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub enum ArchiveError {
    NotFound(String),
    NotDirectory(String),
}

pub type ArchiveResult<T> = Result<T, ArchiveError>;

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct ArchiveVfs {
    document: ArchiveDocument,
}

impl ArchiveVfs {
    pub fn from_document(document: ArchiveDocument) -> Self {
        Self { document }
    }

    pub fn list(&self, path: impl AsRef<str>) -> ArchiveResult<Vec<ArchiveEntry>> {
        let directory = normalize_archive_path(path.as_ref());
        let prefix = if directory == "/" {
            "/".to_owned()
        } else {
            format!("{}/", directory.trim_end_matches('/'))
        };
        let mut entries = BTreeMap::<String, ArchiveEntry>::new();

        for (file_path, bytes) in &self.document.files {
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
                ArchiveEntryKind::File
            } else {
                ArchiveEntryKind::Directory
            };
            let size = if kind == ArchiveEntryKind::File {
                bytes.len() as u64
            } else {
                0
            };

            entries.entry(entry_path.clone()).or_insert(ArchiveEntry {
                path: entry_path,
                kind,
                size,
            });
        }

        if entries.is_empty() && !self.is_directory(&directory) {
            return Err(ArchiveError::NotFound(directory));
        }

        Ok(entries.into_values().collect())
    }

    pub fn read(&self, path: impl AsRef<str>) -> ArchiveResult<Vec<u8>> {
        let path = normalize_archive_path(path.as_ref());

        self.document
            .files
            .get(&path)
            .cloned()
            .ok_or(ArchiveError::NotFound(path))
    }

    pub fn metadata(&self, path: impl AsRef<str>) -> ArchiveResult<ArchiveEntry> {
        let path = normalize_archive_path(path.as_ref());

        if let Some(bytes) = self.document.files.get(&path) {
            return Ok(ArchiveEntry {
                path,
                kind: ArchiveEntryKind::File,
                size: bytes.len() as u64,
            });
        }

        if self.is_directory(&path) {
            return Ok(ArchiveEntry {
                path,
                kind: ArchiveEntryKind::Directory,
                size: 0,
            });
        }

        Err(ArchiveError::NotFound(path))
    }

    fn is_directory(&self, path: &str) -> bool {
        if path == "/" {
            return true;
        }

        let prefix = format!("{}/", path.trim_end_matches('/'));

        self.document
            .files
            .keys()
            .any(|file_path| file_path.starts_with(&prefix))
    }
}

fn normalize_archive_path(path: &str) -> String {
    let normalized = path.replace('\\', "/");
    let mut segments = Vec::<&str>::new();

    for segment in normalized.split('/') {
        match segment {
            "" | "." => {}
            ".." => {
                segments.pop();
            }
            _ => segments.push(segment),
        }
    }

    if segments.is_empty() {
        return "/".to_owned();
    }

    format!("/{}", segments.join("/"))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn archive_vfs_lists_archive_entries_as_directory_tree() {
        let archive = ArchiveDocument::new("release.zip")
            .with_file("bin/app.exe", b"binary".to_vec())
            .with_file("docs/readme.md", b"# Readme".to_vec());
        let vfs = ArchiveVfs::from_document(archive);

        let root_entries = vfs.list("/").unwrap();
        let docs_entries = vfs.list("/docs").unwrap();

        assert_eq!(root_entries.len(), 2);
        assert_eq!(root_entries[0].path, "/bin");
        assert_eq!(root_entries[0].kind, ArchiveEntryKind::Directory);
        assert_eq!(docs_entries[0].path, "/docs/readme.md");
        assert_eq!(docs_entries[0].kind, ArchiveEntryKind::File);
        assert_eq!(docs_entries[0].size, 8);
    }

    #[test]
    fn archive_vfs_reads_file_content_and_metadata() {
        let archive =
            ArchiveDocument::new("release.zip").with_file("/docs/readme.md", b"# Readme".to_vec());
        let vfs = ArchiveVfs::from_document(archive);

        assert_eq!(vfs.read("/docs/readme.md").unwrap(), b"# Readme");
        assert_eq!(
            vfs.metadata("/docs").unwrap().kind,
            ArchiveEntryKind::Directory
        );
        assert_eq!(vfs.metadata("/docs/readme.md").unwrap().size, 8);
    }

    #[test]
    fn archive_vfs_reports_missing_paths() {
        let archive = ArchiveDocument::new("release.zip");
        let vfs = ArchiveVfs::from_document(archive);

        let error = vfs.read("/missing.txt").unwrap_err();

        assert!(matches!(
            error,
            ArchiveError::NotFound(path) if path == "/missing.txt"
        ));
    }
}
