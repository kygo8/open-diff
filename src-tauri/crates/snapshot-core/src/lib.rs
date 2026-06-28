use serde::{Deserialize, Serialize};
use std::collections::BTreeMap;

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SnapshotMetadata {
    pub name: String,
    pub source_root: Option<String>,
    pub created_at_ms: Option<u128>,
}

impl SnapshotMetadata {
    pub fn new(name: impl Into<String>) -> Self {
        Self {
            name: name.into(),
            source_root: None,
            created_at_ms: None,
        }
    }

    pub fn with_source_root(mut self, source_root: impl Into<String>) -> Self {
        self.source_root = Some(source_root.into());

        self
    }

    pub fn with_created_at_ms(mut self, created_at_ms: u128) -> Self {
        self.created_at_ms = Some(created_at_ms);

        self
    }
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SnapshotEntry {
    pub path: String,
    pub kind: SnapshotEntryKind,
    pub size: u64,
    pub modified_at_ms: Option<u128>,
    pub content_hash: Option<String>,
}

impl SnapshotEntry {
    pub fn file(path: impl AsRef<str>, size: u64) -> Self {
        Self {
            path: normalize_snapshot_path(path.as_ref()),
            kind: SnapshotEntryKind::File,
            size,
            modified_at_ms: None,
            content_hash: None,
        }
    }

    pub fn directory(path: impl AsRef<str>) -> Self {
        Self {
            path: normalize_snapshot_path(path.as_ref()),
            kind: SnapshotEntryKind::Directory,
            size: 0,
            modified_at_ms: None,
            content_hash: None,
        }
    }

    pub fn with_modified_at_ms(mut self, modified_at_ms: u128) -> Self {
        self.modified_at_ms = Some(modified_at_ms);

        self
    }

    pub fn with_content_hash(mut self, content_hash: impl Into<String>) -> Self {
        self.content_hash = Some(content_hash.into());

        self
    }
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "kebab-case")]
pub enum SnapshotEntryKind {
    File,
    Directory,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub enum SnapshotError {
    NotFound(String),
    NotDirectory(String),
    OutsideRoot(String),
    Serialization(String),
}

pub type SnapshotResult<T> = Result<T, SnapshotError>;

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SnapshotDocument {
    pub metadata: SnapshotMetadata,
    entries: BTreeMap<String, SnapshotEntry>,
}

impl SnapshotDocument {
    pub fn new(metadata: SnapshotMetadata) -> Self {
        Self {
            metadata,
            entries: BTreeMap::new(),
        }
    }

    pub fn with_entry(mut self, entry: SnapshotEntry) -> Self {
        self.entries.insert(entry.path.clone(), entry);

        self
    }

    pub fn entries(&self) -> Vec<&SnapshotEntry> {
        self.entries.values().collect()
    }

    pub fn entry(&self, path: impl AsRef<str>) -> SnapshotResult<&SnapshotEntry> {
        let path = normalize_snapshot_path(path.as_ref());

        self.entries.get(&path).ok_or(SnapshotError::NotFound(path))
    }

    pub fn list(&self, path: impl AsRef<str>) -> SnapshotResult<Vec<&SnapshotEntry>> {
        let directory = normalize_snapshot_path(path.as_ref());

        if directory != "/" {
            let entry = self.entry(&directory)?;

            if entry.kind != SnapshotEntryKind::Directory {
                return Err(SnapshotError::NotDirectory(directory));
            }
        }

        let mut entries = self
            .entries
            .values()
            .filter(|entry| is_direct_child(&directory, &entry.path))
            .collect::<Vec<_>>();

        entries.sort_by(|left, right| left.path.cmp(&right.path));

        Ok(entries)
    }
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct SnapshotScanEntry {
    pub path: String,
    pub kind: SnapshotEntryKind,
    pub size: u64,
    pub modified_at_ms: Option<u128>,
    pub content_hash: Option<String>,
}

impl SnapshotScanEntry {
    pub fn file(path: impl AsRef<str>, size: u64) -> Self {
        Self {
            path: normalize_snapshot_path(path.as_ref()),
            kind: SnapshotEntryKind::File,
            size,
            modified_at_ms: None,
            content_hash: None,
        }
    }

    pub fn directory(path: impl AsRef<str>) -> Self {
        Self {
            path: normalize_snapshot_path(path.as_ref()),
            kind: SnapshotEntryKind::Directory,
            size: 0,
            modified_at_ms: None,
            content_hash: None,
        }
    }

    pub fn with_modified_at_ms(mut self, modified_at_ms: u128) -> Self {
        self.modified_at_ms = Some(modified_at_ms);

        self
    }

    pub fn with_content_hash(mut self, content_hash: impl Into<String>) -> Self {
        self.content_hash = Some(content_hash.into());

        self
    }
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct SnapshotGenerator {
    name: String,
    source_root: String,
    created_at_ms: Option<u128>,
}

impl SnapshotGenerator {
    pub fn new(name: impl Into<String>, source_root: impl AsRef<str>) -> Self {
        Self {
            name: name.into(),
            source_root: normalize_snapshot_path(source_root.as_ref()),
            created_at_ms: None,
        }
    }

    pub fn with_created_at_ms(mut self, created_at_ms: u128) -> Self {
        self.created_at_ms = Some(created_at_ms);

        self
    }

    pub fn generate(
        &self,
        scan_entries: Vec<SnapshotScanEntry>,
    ) -> SnapshotResult<SnapshotDocument> {
        let mut metadata = SnapshotMetadata::new(&self.name).with_source_root(&self.source_root);

        if let Some(created_at_ms) = self.created_at_ms {
            metadata = metadata.with_created_at_ms(created_at_ms);
        }

        let mut snapshot = SnapshotDocument::new(metadata);

        for scan_entry in scan_entries {
            let relative_path = self.relative_snapshot_path(&scan_entry.path)?;
            let mut entry = match scan_entry.kind {
                SnapshotEntryKind::File => SnapshotEntry::file(&relative_path, scan_entry.size),
                SnapshotEntryKind::Directory => SnapshotEntry::directory(&relative_path),
            };

            entry.modified_at_ms = scan_entry.modified_at_ms;
            entry.content_hash = scan_entry.content_hash;
            snapshot = snapshot.with_entry(entry);
        }

        Ok(snapshot)
    }

    fn relative_snapshot_path(&self, path: &str) -> SnapshotResult<String> {
        if path == self.source_root {
            return Ok("/".to_owned());
        }

        let prefix = format!("{}/", self.source_root.trim_end_matches('/'));
        let Some(relative) = path.strip_prefix(&prefix) else {
            return Err(SnapshotError::OutsideRoot(path.to_owned()));
        };

        Ok(normalize_snapshot_path(relative))
    }
}

pub struct SnapshotStore;

impl SnapshotStore {
    pub fn save_to_bytes(snapshot: &SnapshotDocument) -> SnapshotResult<Vec<u8>> {
        serde_json::to_vec_pretty(snapshot)
            .map_err(|error| SnapshotError::Serialization(error.to_string()))
    }

    pub fn load_from_bytes(bytes: &[u8]) -> SnapshotResult<SnapshotDocument> {
        serde_json::from_slice(bytes)
            .map_err(|error| SnapshotError::Serialization(error.to_string()))
    }
}

fn is_direct_child(directory: &str, path: &str) -> bool {
    if path == directory {
        return false;
    }

    let prefix = if directory == "/" {
        "/".to_owned()
    } else {
        format!("{}/", directory.trim_end_matches('/'))
    };

    path.strip_prefix(&prefix)
        .is_some_and(|relative| !relative.is_empty() && !relative.contains('/'))
}

fn normalize_snapshot_path(path: &str) -> String {
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
    fn snapshot_document_stores_tree_entries_and_metadata() {
        let snapshot = SnapshotDocument::new(
            SnapshotMetadata::new("left-folder")
                .with_created_at_ms(1_700_000_000_000)
                .with_source_root("/work/left"),
        )
        .with_entry(SnapshotEntry::directory("/src"))
        .with_entry(
            SnapshotEntry::file("/src/main.rs", 12)
                .with_modified_at_ms(1_700_000_000_123)
                .with_content_hash("sha256:abc"),
        );

        assert_eq!(snapshot.metadata.name, "left-folder");
        assert_eq!(snapshot.metadata.source_root.as_deref(), Some("/work/left"));
        assert_eq!(snapshot.entries().len(), 2);
        assert_eq!(
            snapshot.entry("/src/main.rs").unwrap().kind,
            SnapshotEntryKind::File
        );
        assert_eq!(snapshot.entry("/src/main.rs").unwrap().size, 12);
    }

    #[test]
    fn snapshot_document_lists_direct_children() {
        let snapshot = SnapshotDocument::new(SnapshotMetadata::new("tree"))
            .with_entry(SnapshotEntry::directory("/src"))
            .with_entry(SnapshotEntry::file("/src/main.rs", 12))
            .with_entry(SnapshotEntry::file("/README.md", 6));

        let root_entries = snapshot.list("/").unwrap();
        let src_entries = snapshot.list("/src").unwrap();

        assert_eq!(root_entries.len(), 2);
        assert_eq!(root_entries[0].path, "/README.md");
        assert_eq!(root_entries[1].path, "/src");
        assert_eq!(src_entries[0].path, "/src/main.rs");
    }

    #[test]
    fn snapshot_document_reports_missing_paths() {
        let snapshot = SnapshotDocument::new(SnapshotMetadata::new("tree"));

        let error = snapshot.entry("/missing.txt").unwrap_err();

        assert!(matches!(
            error,
            SnapshotError::NotFound(path) if path == "/missing.txt"
        ));
    }

    #[test]
    fn snapshot_generator_builds_snapshot_from_scan_entries() {
        let generator =
            SnapshotGenerator::new("workspace", "/work").with_created_at_ms(1_700_000_000_000);
        let snapshot = generator
            .generate(vec![
                SnapshotScanEntry::directory("/work/src"),
                SnapshotScanEntry::file("/work/src/main.rs", 12)
                    .with_modified_at_ms(1_700_000_000_123)
                    .with_content_hash("sha256:abc"),
            ])
            .unwrap();

        assert_eq!(snapshot.metadata.name, "workspace");
        assert_eq!(snapshot.metadata.source_root.as_deref(), Some("/work"));
        assert_eq!(
            snapshot.entry("/src").unwrap().kind,
            SnapshotEntryKind::Directory
        );
        assert_eq!(snapshot.entry("/src/main.rs").unwrap().size, 12);
        assert_eq!(
            snapshot
                .entry("/src/main.rs")
                .unwrap()
                .content_hash
                .as_deref(),
            Some("sha256:abc")
        );
    }

    #[test]
    fn snapshot_store_serializes_and_restores_snapshot_documents() {
        let snapshot = SnapshotDocument::new(SnapshotMetadata::new("workspace"))
            .with_entry(SnapshotEntry::file("/README.md", 6).with_content_hash("sha256:readme"));

        let bytes = SnapshotStore::save_to_bytes(&snapshot).unwrap();
        let restored = SnapshotStore::load_from_bytes(&bytes).unwrap();

        assert_eq!(restored.metadata.name, "workspace");
        assert_eq!(
            restored
                .entry("/README.md")
                .unwrap()
                .content_hash
                .as_deref(),
            Some("sha256:readme")
        );
    }

    #[test]
    fn snapshot_generator_rejects_entries_outside_source_root() {
        let generator = SnapshotGenerator::new("workspace", "/work");

        let error = generator
            .generate(vec![SnapshotScanEntry::file("/other/file.txt", 4)])
            .unwrap_err();

        assert!(matches!(
            error,
            SnapshotError::OutsideRoot(path) if path == "/other/file.txt"
        ));
    }
}
