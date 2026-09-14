use archive_core::{is_archive_path, ArchiveDocument, ArchiveReader, ArchiveVfs};
use folder_core::{FolderNodeKind, FolderScanNode};
use remote_core::{
    is_remote_uri, parse_remote_uri, RemoteFileProvider, RemoteProfileStore, RemoteUri,
};
use snapshot_core::{load_snapshot_file, SnapshotDocument, SnapshotEntryKind};
use std::collections::BTreeMap;
use std::path::{Path, PathBuf};
use vfs_core::VfsMetadata;

#[derive(Clone)]
pub enum CompareSource {
    Local(PathBuf),
    Archive(ArchiveDocument),
    Snapshot(SnapshotDocument),
}

pub fn default_config_dir() -> PathBuf {
    if let Ok(path) = std::env::var("OPEN_DIFF_CONFIG_DIR") {
        return PathBuf::from(path);
    }

    let home = std::env::var("HOME")
        .or_else(|_| std::env::var("USERPROFILE"))
        .unwrap_or_else(|_| std::env::temp_dir().display().to_string());

    PathBuf::from(home).join(".config").join("open-diff")
}

pub fn load_compare_source(path: &str) -> Result<CompareSource, String> {
    if is_remote_uri(path) {
        return materialize_remote_source(path);
    }

    let path_buf = PathBuf::from(path);
    if is_archive_path(path) {
        return Ok(CompareSource::Archive(
            ArchiveReader::open_path(&path_buf).map_err(|error| error.to_string())?,
        ));
    }

    if is_snapshot_compare_path(path) {
        return Ok(CompareSource::Snapshot(
            load_snapshot_file(&path_buf).map_err(|error| format!("{error:?}"))?,
        ));
    }

    Ok(CompareSource::Local(path_buf))
}

pub fn scan_compare_source_with_options(
    source: &CompareSource,
    follow_symlinks: bool,
    show_hidden_files: bool,
) -> Result<FolderScanNode, String> {
    match source {
        CompareSource::Local(path) => {
            let options = folder_core::FolderCompareOptions {
                follow_symlinks,
                show_hidden_files,
                ..folder_core::FolderCompareOptions::default()
            };
            folder_core::scan_local_folder_with_options(
                path,
                &job_core::CancellationToken::default(),
                &options,
            )
            .map_err(|error| format!("{error:?}"))
        }
        CompareSource::Archive(document) => Ok(folder_tree_from_archive(document)),
        CompareSource::Snapshot(snapshot) => Ok(folder_tree_from_snapshot(snapshot)),
    }
}

pub fn read_compare_file(source: &CompareSource, relative_path: &str) -> Result<Vec<u8>, String> {
    match source {
        CompareSource::Local(root) => {
            let path = if relative_path.is_empty() {
                root.clone()
            } else {
                root.join(relative_path)
            };
            std::fs::read(&path).map_err(|error| error.to_string())
        }
        CompareSource::Archive(document) => ArchiveVfs::from_document(document.clone())
            .read(relative_path)
            .map_err(|error| error.to_string()),
        CompareSource::Snapshot(snapshot) => {
            let entry = snapshot
                .entry(relative_path)
                .map_err(|error| format!("{error:?}"))?;
            Ok(format!(
                "{}:{}:{}",
                entry.path,
                entry.size,
                entry.content_hash.clone().unwrap_or_default()
            )
            .into_bytes())
        }
    }
}

fn folder_tree_from_archive(document: &ArchiveDocument) -> FolderScanNode {
    let vfs = ArchiveVfs::from_document(document.clone());
    let mut children_by_parent: BTreeMap<String, Vec<FolderScanNode>> = BTreeMap::new();

    for entry in vfs.list_recursive() {
        let parent = parent_archive_path(&entry.path);
        let name = entry
            .path
            .rsplit('/')
            .next()
            .unwrap_or(&entry.path)
            .to_owned();
        let relative = entry.path.trim_start_matches('/').to_owned();
        let node = match entry.kind {
            archive_core::ArchiveEntryKind::Directory => FolderScanNode::new_directory(
                relative,
                name,
                synthetic_metadata(&entry.path, entry.size, true),
                Vec::new(),
            ),
            archive_core::ArchiveEntryKind::File => FolderScanNode::new_file(
                relative,
                name,
                synthetic_metadata(&entry.path, entry.size, false),
            ),
        };
        children_by_parent.entry(parent).or_default().push(node);
    }

    assemble_folder_tree(document.name.clone(), &mut children_by_parent)
}

fn folder_tree_from_snapshot(snapshot: &SnapshotDocument) -> FolderScanNode {
    let mut children_by_parent: BTreeMap<String, Vec<FolderScanNode>> = BTreeMap::new();

    for entry in snapshot.entries() {
        let parent = parent_archive_path(&entry.path);
        let name = entry
            .path
            .rsplit('/')
            .next()
            .unwrap_or(&entry.path)
            .to_owned();
        let relative = entry.path.trim_start_matches('/').to_owned();
        let node = match entry.kind {
            SnapshotEntryKind::Directory => FolderScanNode::new_directory(
                relative,
                name,
                synthetic_metadata(&entry.path, entry.size, true),
                Vec::new(),
            ),
            SnapshotEntryKind::File => FolderScanNode::new_file(
                relative,
                name,
                synthetic_metadata(&entry.path, entry.size, false),
            ),
        };
        children_by_parent.entry(parent).or_default().push(node);
    }

    assemble_folder_tree(snapshot.metadata.name.clone(), &mut children_by_parent)
}

fn assemble_folder_tree(
    name: String,
    children_by_parent: &mut BTreeMap<String, Vec<FolderScanNode>>,
) -> FolderScanNode {
    fn attach(
        path: &str,
        children_by_parent: &mut BTreeMap<String, Vec<FolderScanNode>>,
    ) -> Vec<FolderScanNode> {
        let mut children = children_by_parent.remove(path).unwrap_or_default();
        for child in &mut children {
            if child.kind == FolderNodeKind::Directory {
                let child_path = if child.relative_path.is_empty() {
                    "/".to_owned()
                } else {
                    format!("/{}", child.relative_path)
                };
                child.children = attach(&child_path, children_by_parent);
            }
        }
        children.sort_by(|left, right| left.name.cmp(&right.name));
        children
    }

    FolderScanNode::new_directory(
        "",
        name,
        synthetic_metadata("/", 0, true),
        attach("/", children_by_parent),
    )
}

fn parent_archive_path(path: &str) -> String {
    let trimmed = path.trim_end_matches('/');
    match trimmed.rsplit_once('/') {
        Some(("", _)) | None => "/".to_owned(),
        Some((parent, _)) => parent.to_owned(),
    }
}

fn synthetic_metadata(path: &str, size: u64, directory: bool) -> VfsMetadata {
    let name = Path::new(path)
        .file_name()
        .map(|name| name.to_string_lossy().into_owned())
        .unwrap_or_else(|| path.to_owned());

    VfsMetadata {
        kind: if directory {
            vfs_core::VfsEntryKind::Directory
        } else {
            vfs_core::VfsEntryKind::File
        },
        name,
        extension: Path::new(path)
            .extension()
            .map(|extension| extension.to_string_lossy().into_owned()),
        size,
        readonly: true,
        created_at_ms: None,
        modified_at_ms: None,
        accessed_at_ms: None,
    }
}

pub fn read_remote_file(uri: &str) -> Result<Vec<u8>, String> {
    let parsed = parse_remote_uri(uri).map_err(|error| format!("{error:?}"))?;
    let store = RemoteProfileStore::new(default_config_dir());
    let profile = store
        .find_profile(&parsed.profile_ref)
        .map_err(|error| format!("{error:?}"))?
        .ok_or_else(|| format!("remote profile not found: {}", parsed.profile_ref))?;
    let credential = store
        .load_secret(&profile.id)
        .map_err(|error| format!("{error:?}"))?
        .ok_or_else(|| format!("no stored secret for profile {}", profile.id))?;
    let provider = remote_core::open_network_provider(&profile, &credential)
        .map_err(|error| format!("{error:?}"))?;
    provider
        .download(&parsed.remote_path)
        .map_err(|error| format!("{error:?}"))
}

fn materialize_remote_source(uri: &str) -> Result<CompareSource, String> {
    let parsed = parse_remote_uri(uri).map_err(|error| format!("{error:?}"))?;
    let store = RemoteProfileStore::new(default_config_dir());
    let profile = store
        .find_profile(&parsed.profile_ref)
        .map_err(|error| format!("{error:?}"))?
        .ok_or_else(|| format!("remote profile not found: {}", parsed.profile_ref))?;
    let credential = store
        .load_secret(&profile.id)
        .map_err(|error| format!("{error:?}"))?
        .ok_or_else(|| format!("no stored secret for profile {}", profile.id))?;
    let provider = remote_core::open_network_provider(&profile, &credential)
        .map_err(|error| format!("{error:?}"))?;
    Ok(CompareSource::Archive(remote_listing_to_document(
        &*provider,
        &parsed,
        &profile.name,
    )?))
}

fn remote_listing_to_document(
    provider: &dyn RemoteFileProvider,
    uri: &RemoteUri,
    name: &str,
) -> Result<ArchiveDocument, String> {
    let mut document = ArchiveDocument::new(name);
    collect_remote_files(provider, &uri.remote_path, &uri.remote_path, &mut document)?;
    Ok(document)
}

fn collect_remote_files(
    provider: &dyn RemoteFileProvider,
    root: &str,
    path: &str,
    document: &mut ArchiveDocument,
) -> Result<(), String> {
    let entries = provider.list(path).map_err(|error| format!("{error:?}"))?;

    for entry in entries {
        let relative = entry
            .path
            .strip_prefix(root)
            .unwrap_or(&entry.path)
            .to_owned();
        match entry.kind {
            remote_core::RemoteEntryKind::Directory => {
                collect_remote_files(provider, root, &entry.path, document)?;
            }
            remote_core::RemoteEntryKind::File => {
                let bytes = provider
                    .download(&entry.path)
                    .map_err(|error| format!("{error:?}"))?;
                *document = std::mem::take(document).with_file(relative, bytes);
            }
        }
    }

    Ok(())
}

fn is_snapshot_compare_path(path: &str) -> bool {
    let lower = path.replace('\\', "/").to_ascii_lowercase();
    if lower.ends_with(".snapshot.json") || lower.ends_with(".opendiff-snapshot.json") {
        return true;
    }
    let base = lower.rsplit('/').next().unwrap_or("");
    base == "open-diff-snapshot.json"
}

#[cfg(test)]
mod snapshot_path_tests {
    use super::is_snapshot_compare_path;

    #[test]
    fn recognizes_reloadable_and_legacy_snapshot_names() {
        assert!(is_snapshot_compare_path("/tmp/tree.snapshot.json"));
        assert!(is_snapshot_compare_path(
            r"C:\data\workspace.opendiff-snapshot.json"
        ));
        assert!(is_snapshot_compare_path("/tmp/open-diff-snapshot.json"));
        assert!(is_snapshot_compare_path("/tmp/OPEN-DIFF-SNAPSHOT.JSON"));
        assert!(!is_snapshot_compare_path("/tmp/folder"));
        assert!(!is_snapshot_compare_path("/tmp/notes.json"));
    }
}
