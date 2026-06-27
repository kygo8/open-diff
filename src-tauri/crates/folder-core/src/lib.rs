use serde::{Deserialize, Serialize};
use std::path::Path;
use vfs_core::{LocalVfs, VfsEntryKind, VfsMetadata, VfsPath, VfsProvider};

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

#[derive(Debug, Clone, PartialEq, Eq)]
pub enum FolderScanError {
    Cancelled,
    Vfs(String),
}

pub fn scan_local_folder(
    root: impl AsRef<Path>,
    cancel_token: &job_core::CancellationToken,
) -> Result<FolderScanNode, FolderScanError> {
    let root = root.as_ref();
    let vfs = LocalVfs::new();
    let root_path = VfsPath::new(root.display().to_string());

    scan_path(&vfs, root, &root_path, cancel_token)
}

fn scan_path(
    vfs: &LocalVfs,
    root: &Path,
    path: &VfsPath,
    cancel_token: &job_core::CancellationToken,
) -> Result<FolderScanNode, FolderScanError> {
    if cancel_token.is_cancelled() {
        return Err(FolderScanError::Cancelled);
    }

    let metadata = vfs
        .metadata(path)
        .map_err(|error| FolderScanError::Vfs(format!("{error:?}")))?;
    let relative_path = relative_path(root, Path::new(path.as_str()));

    if metadata.kind == VfsEntryKind::File {
        return Ok(FolderScanNode::new_file(
            relative_path,
            metadata.name.clone(),
            metadata,
        ));
    }

    let mut children = vfs
        .list(path)
        .map_err(|error| FolderScanError::Vfs(format!("{error:?}")))?
        .into_iter()
        .map(|entry| scan_path(vfs, root, &entry.path, cancel_token))
        .collect::<Result<Vec<_>, _>>()?;

    children.sort_by(|left, right| left.name.cmp(&right.name));

    Ok(FolderScanNode::new_directory(
        relative_path,
        metadata.name.clone(),
        metadata,
        children,
    ))
}

fn relative_path(root: &Path, path: &Path) -> String {
    path.strip_prefix(root)
        .unwrap_or(path)
        .to_string_lossy()
        .replace('\\', "/")
}

#[cfg(test)]
mod tests {
    use super::*;
    use job_core::CancellationToken;
    use std::fs;
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

    #[test]
    fn recursively_scans_local_folder_tree() {
        let root = unique_temp_dir("folder-scan");

        fs::create_dir_all(root.join("src")).expect("directory should be created");
        fs::write(root.join("src").join("main.rs"), b"fn main() {}")
            .expect("file should be written");

        let scanned =
            scan_local_folder(&root, &CancellationToken::default()).expect("scan should succeed");

        assert_eq!(scanned.kind, FolderNodeKind::Directory);
        assert_eq!(scanned.children[0].name, "src");
        assert_eq!(scanned.children[0].children[0].name, "main.rs");

        let _ = fs::remove_dir_all(root);
    }

    #[test]
    fn stops_scanning_when_cancelled() {
        let root = unique_temp_dir("folder-scan-cancelled");
        let token = CancellationToken::default();

        fs::create_dir_all(&root).expect("directory should be created");
        token.cancel();

        assert_eq!(
            scan_local_folder(&root, &token).expect_err("scan should be cancelled"),
            FolderScanError::Cancelled
        );

        let _ = fs::remove_dir_all(root);
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

    fn unique_temp_dir(label: &str) -> std::path::PathBuf {
        let stamp = std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .expect("system clock should be after epoch")
            .as_nanos();

        std::env::temp_dir().join(format!("open-diff-{label}-{stamp}"))
    }
}
