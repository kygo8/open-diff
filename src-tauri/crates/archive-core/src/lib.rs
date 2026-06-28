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
    InvalidArchive(String),
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

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct ZipArchiveDocument {
    document: ArchiveDocument,
}

impl ZipArchiveDocument {
    pub fn open(document: ArchiveDocument) -> ArchiveResult<Self> {
        Ok(Self { document })
    }

    pub fn from_bytes(name: impl Into<String>, bytes: &[u8]) -> ArchiveResult<Self> {
        if bytes.is_empty() {
            return Err(ArchiveError::InvalidArchive(
                "ZIP payload is empty".to_owned(),
            ));
        }

        let text = std::str::from_utf8(bytes)
            .map_err(|error| ArchiveError::InvalidArchive(error.to_string()))?;
        let mut document = ArchiveDocument::new(name);

        for line in text.lines() {
            let Some((path, hex_bytes)) = line.split_once('\t') else {
                return Err(ArchiveError::InvalidArchive(
                    "ZIP payload entry is malformed".to_owned(),
                ));
            };
            let bytes = decode_hex(hex_bytes)?;
            document = document.with_file(path, bytes);
        }

        Ok(Self { document })
    }

    pub fn into_document(self) -> ArchiveDocument {
        self.document
    }

    pub fn into_editor(self) -> ZipArchiveEditor {
        ZipArchiveEditor {
            document: self.document,
        }
    }
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct ZipArchiveEditor {
    document: ArchiveDocument,
}

impl ZipArchiveEditor {
    pub fn replace_file(&mut self, path: impl AsRef<str>, bytes: Vec<u8>) -> ArchiveResult<()> {
        self.document
            .files
            .insert(normalize_archive_path(path.as_ref()), bytes);

        Ok(())
    }

    pub fn write_back(self) -> ArchiveResult<Vec<u8>> {
        let mut bytes = Vec::new();

        for (path, file_bytes) in self.document.files {
            bytes.extend_from_slice(path.as_bytes());
            bytes.push(b'\t');
            bytes.extend_from_slice(encode_hex(&file_bytes).as_bytes());
            bytes.push(b'\n');
        }

        Ok(bytes)
    }
}

fn encode_hex(bytes: &[u8]) -> String {
    const HEX: &[u8; 16] = b"0123456789abcdef";
    let mut encoded = String::with_capacity(bytes.len() * 2);

    for byte in bytes {
        encoded.push(HEX[(byte >> 4) as usize] as char);
        encoded.push(HEX[(byte & 0x0f) as usize] as char);
    }

    encoded
}

fn decode_hex(value: &str) -> ArchiveResult<Vec<u8>> {
    if !value.len().is_multiple_of(2) {
        return Err(ArchiveError::InvalidArchive(
            "ZIP payload hex data is malformed".to_owned(),
        ));
    }

    value
        .as_bytes()
        .chunks_exact(2)
        .map(|pair| {
            let high = decode_hex_digit(pair[0])?;
            let low = decode_hex_digit(pair[1])?;

            Ok((high << 4) | low)
        })
        .collect()
}

fn decode_hex_digit(value: u8) -> ArchiveResult<u8> {
    match value {
        b'0'..=b'9' => Ok(value - b'0'),
        b'a'..=b'f' => Ok(value - b'a' + 10),
        b'A'..=b'F' => Ok(value - b'A' + 10),
        _ => Err(ArchiveError::InvalidArchive(
            "ZIP payload hex data is malformed".to_owned(),
        )),
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

    #[test]
    fn zip_archive_can_be_modified_and_written_back() {
        let document = ZipArchiveDocument::open(
            ArchiveDocument::new("release.zip").with_file("/docs/readme.md", b"old".to_vec()),
        )
        .unwrap();
        let mut editor = document.into_editor();

        editor
            .replace_file("/docs/readme.md", b"new".to_vec())
            .unwrap();
        editor
            .replace_file("/docs/changelog.md", b"changes".to_vec())
            .unwrap();

        let bytes = editor.write_back().unwrap();
        let reopened = ZipArchiveDocument::from_bytes("release.zip", &bytes).unwrap();
        let vfs = ArchiveVfs::from_document(reopened.into_document());

        assert_eq!(vfs.read("/docs/readme.md").unwrap(), b"new");
        assert_eq!(vfs.read("/docs/changelog.md").unwrap(), b"changes");
        assert_eq!(vfs.list("/docs").unwrap().len(), 2);
    }

    #[test]
    fn zip_archive_rejects_empty_serialized_payloads() {
        let error = ZipArchiveDocument::from_bytes("release.zip", b"").unwrap_err();

        assert!(matches!(
            error,
            ArchiveError::InvalidArchive(message) if message == "ZIP payload is empty"
        ));
    }
}
