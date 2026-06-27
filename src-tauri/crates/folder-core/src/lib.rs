use serde::{Deserialize, Serialize};
use std::collections::BTreeMap;
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

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct FolderAlignmentRow {
    pub relative_path: String,
    pub depth: usize,
    pub left: Option<FolderScanNode>,
    pub right: Option<FolderScanNode>,
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

pub fn align_folder_trees(
    left: &FolderScanNode,
    right: &FolderScanNode,
) -> Vec<FolderAlignmentRow> {
    let mut rows = BTreeMap::<String, (Option<FolderScanNode>, Option<FolderScanNode>)>::new();

    collect_alignment_side(left, true, &mut rows);
    collect_alignment_side(right, false, &mut rows);

    rows.into_iter()
        .map(|(relative_path, (left, right))| {
            let status = classify_folder_alignment(left.as_ref(), right.as_ref());

            FolderAlignmentRow {
                depth: path_depth(&relative_path),
                relative_path,
                left: left.map(|node| with_status(node, status.clone())),
                right: right.map(|node| with_status(node, status)),
            }
        })
        .collect()
}

pub fn classify_folder_alignment(
    left: Option<&FolderScanNode>,
    right: Option<&FolderScanNode>,
) -> FolderCompareStatus {
    match (left, right) {
        (Some(_), None) => FolderCompareStatus::LeftOnly,
        (None, Some(_)) => FolderCompareStatus::RightOnly,
        (Some(left), Some(right))
            if left.kind == right.kind && left.metadata.size == right.metadata.size =>
        {
            FolderCompareStatus::Same
        }
        (Some(_), Some(_)) => FolderCompareStatus::Different,
        (None, None) => FolderCompareStatus::Unknown,
    }
}

fn with_status(mut node: FolderScanNode, status: FolderCompareStatus) -> FolderScanNode {
    node.status = status;
    node
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

fn collect_alignment_side(
    node: &FolderScanNode,
    is_left: bool,
    rows: &mut BTreeMap<String, (Option<FolderScanNode>, Option<FolderScanNode>)>,
) {
    for child in &node.children {
        let entry = rows.entry(child.relative_path.clone()).or_default();
        if is_left {
            entry.0 = Some(child.clone());
        } else {
            entry.1 = Some(child.clone());
        }

        collect_alignment_side(child, is_left, rows);
    }
}

fn path_depth(relative_path: &str) -> usize {
    if relative_path.is_empty() {
        0
    } else {
        relative_path.matches('/').count()
    }
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

    #[test]
    fn aligns_matching_paths_and_preserves_orphans() {
        let left = FolderScanNode::new_directory(
            "",
            "left",
            metadata(VfsEntryKind::Directory, "left", None, 0),
            vec![
                FolderScanNode::new_file(
                    "left-only.txt",
                    "left-only.txt",
                    metadata(VfsEntryKind::File, "left-only.txt", Some("txt"), 10),
                ),
                FolderScanNode::new_file(
                    "shared.txt",
                    "shared.txt",
                    metadata(VfsEntryKind::File, "shared.txt", Some("txt"), 20),
                ),
            ],
        );
        let right = FolderScanNode::new_directory(
            "",
            "right",
            metadata(VfsEntryKind::Directory, "right", None, 0),
            vec![
                FolderScanNode::new_file(
                    "right-only.txt",
                    "right-only.txt",
                    metadata(VfsEntryKind::File, "right-only.txt", Some("txt"), 30),
                ),
                FolderScanNode::new_file(
                    "shared.txt",
                    "shared.txt",
                    metadata(VfsEntryKind::File, "shared.txt", Some("txt"), 20),
                ),
            ],
        );

        let aligned = align_folder_trees(&left, &right);

        assert_eq!(aligned.len(), 3);
        assert_eq!(aligned[0].relative_path, "left-only.txt");
        assert!(aligned[0].left.is_some());
        assert!(aligned[0].right.is_none());
        assert_eq!(aligned[1].relative_path, "right-only.txt");
        assert!(aligned[1].left.is_none());
        assert!(aligned[1].right.is_some());
        assert_eq!(aligned[2].relative_path, "shared.txt");
        assert!(aligned[2].left.is_some());
        assert!(aligned[2].right.is_some());
    }

    #[test]
    fn classifies_aligned_folder_rows_by_presence_kind_and_size() {
        let same_left = FolderScanNode::new_file(
            "same.txt",
            "same.txt",
            metadata(VfsEntryKind::File, "same.txt", Some("txt"), 20),
        );
        let same_right = FolderScanNode::new_file(
            "same.txt",
            "same.txt",
            metadata(VfsEntryKind::File, "same.txt", Some("txt"), 20),
        );
        let different_right = FolderScanNode::new_file(
            "same.txt",
            "same.txt",
            metadata(VfsEntryKind::File, "same.txt", Some("txt"), 21),
        );

        assert_eq!(
            classify_folder_alignment(Some(&same_left), Some(&same_right)),
            FolderCompareStatus::Same
        );
        assert_eq!(
            classify_folder_alignment(Some(&same_left), Some(&different_right)),
            FolderCompareStatus::Different
        );
        assert_eq!(
            classify_folder_alignment(Some(&same_left), None),
            FolderCompareStatus::LeftOnly
        );
        assert_eq!(
            classify_folder_alignment(None, Some(&same_right)),
            FolderCompareStatus::RightOnly
        );
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
