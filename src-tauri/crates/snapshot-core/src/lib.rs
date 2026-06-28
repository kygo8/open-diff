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
}
