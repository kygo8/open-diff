use serde::{Deserialize, Serialize};
use vfs_core::VfsMetadata;

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct FolderScanNode {
    pub relative_path: String,
    pub name: String,
    pub kind: FolderNodeKind,
    pub status: FolderCompareStatus,
    pub metadata: VfsMetadata,
    pub children: Vec<FolderScanNode>,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum FolderNodeKind {
    File,
    Directory,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum FolderCompareStatus {
    Unknown,
    Same,
    Different,
    LeftOnly,
    RightOnly,
    Error,
}

impl FolderScanNode {
    pub fn new_directory(
        relative_path: impl Into<String>,
        name: impl Into<String>,
        metadata: VfsMetadata,
        children: Vec<FolderScanNode>,
    ) -> Self {
        Self {
            relative_path: relative_path.into(),
            name: name.into(),
            kind: FolderNodeKind::Directory,
            status: FolderCompareStatus::Unknown,
            metadata,
            children,
        }
    }

    pub fn new_file(
        relative_path: impl Into<String>,
        name: impl Into<String>,
        metadata: VfsMetadata,
    ) -> Self {
        Self {
            relative_path: relative_path.into(),
            name: name.into(),
            kind: FolderNodeKind::File,
            status: FolderCompareStatus::Unknown,
            metadata,
            children: Vec::new(),
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use vfs_core::{VfsEntryKind, VfsMetadata};

    #[test]
    fn folder_scan_dto_represents_directories_files_status_and_metadata() {
        let file = FolderScanNode::new_file(
            "src/main.rs",
            "main.rs",
            metadata(VfsEntryKind::File, "main.rs", Some("rs"), 123),
        );
        let root = FolderScanNode::new_directory(
            "src",
            "src",
            metadata(VfsEntryKind::Directory, "src", None, 0),
            vec![file],
        );

        assert_eq!(root.kind, FolderNodeKind::Directory);
        assert_eq!(root.status, FolderCompareStatus::Unknown);
        assert_eq!(root.children[0].kind, FolderNodeKind::File);
        assert_eq!(root.children[0].metadata.size, 123);
    }

    fn metadata(kind: VfsEntryKind, name: &str, extension: Option<&str>, size: u64) -> VfsMetadata {
        VfsMetadata {
            kind,
            name: name.to_owned(),
            extension: extension.map(ToOwned::to_owned),
            size,
            readonly: false,
            created_at_ms: None,
            modified_at_ms: None,
            accessed_at_ms: None,
        }
    }
}
