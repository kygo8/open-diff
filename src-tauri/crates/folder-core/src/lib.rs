use serde::{Deserialize, Serialize};
use std::collections::{BTreeMap, HashSet};
use std::fs;
use std::io::{self, Read};
use std::path::{Path, PathBuf};
use std::time::{Duration, UNIX_EPOCH};
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

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct FolderCompareOptions {
    pub compare_size: bool,
    pub compare_modified_time: bool,
    pub case_sensitive_names: bool,
    pub compare_contents: bool,
    pub compare_crc: bool,
    /// Compare readonly (and related) file attributes when classifying rows.
    #[serde(default)]
    pub compare_attributes: bool,
    /// When true, size-only metadata mismatches surface as unimportant (Minor).
    #[serde(default)]
    pub size_only_unimportant: bool,
    /// Allowed absolute difference when comparing modified times (milliseconds).
    #[serde(default)]
    pub timestamp_tolerance_ms: u128,
    /// Treat a one-hour modified-time skew as equal (DST / clock skew).
    #[serde(default)]
    pub ignore_daylight_saving_hour_offset: bool,
    /// Additional whole-hour timezone offsets to treat as equal when comparing times.
    #[serde(default)]
    pub ignored_timezone_hour_offsets: Vec<i32>,
    /// When true, directory/file symbolic links are resolved during folder scans.
    #[serde(default)]
    pub follow_symlinks: bool,
}

impl Default for FolderCompareOptions {
    fn default() -> Self {
        Self {
            compare_size: true,
            compare_modified_time: false,
            case_sensitive_names: true,
            compare_contents: true,
            compare_crc: false,
            compare_attributes: false,
            size_only_unimportant: false,
            timestamp_tolerance_ms: 0,
            ignore_daylight_saving_hour_offset: false,
            ignored_timezone_hour_offsets: Vec::new(),
            follow_symlinks: false,
        }
    }
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct BinaryCompareResult {
    pub status: FolderCompareStatus,
    pub compared_bytes: u64,
    pub first_difference_offset: Option<u64>,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct FolderTextRuleCompareOptions {
    pub ignore_whitespace: bool,
    pub ignore_case: bool,
    pub ignore_line_endings: bool,
    pub ignore_regexes: Vec<String>,
    pub algorithm: Option<String>,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct FolderTextRuleCompareResult {
    pub status: FolderCompareStatus,
    pub different_lines: usize,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum QuickCompareMode {
    Text,
    Binary,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct QuickCompareResult {
    pub mode: QuickCompareMode,
    pub status: FolderCompareStatus,
    pub different_units: usize,
    pub first_difference_offset: Option<u64>,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CompareToResult {
    pub source_path: String,
    pub target_path: String,
    pub quick: QuickCompareResult,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum CopyDirection {
    ToLeft,
    ToRight,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CopySideRequest {
    pub direction: CopyDirection,
    pub left_path: String,
    pub right_path: String,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CopySideResult {
    pub direction: CopyDirection,
    pub source_path: String,
    pub target_path: String,
    pub target_metadata: VfsMetadata,
    pub refreshed_status: FolderCompareStatus,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum FileOperationRequest {
    Move {
        source_path: String,
        target_path: String,
    },
    Delete {
        path: String,
    },
    Rename {
        path: String,
        new_name: String,
    },
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum FileOperationKind {
    Move,
    Delete,
    Rename,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum FileOperationStatus {
    Moved,
    Deleted,
    Renamed,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct FileOperationResult {
    pub operation: FileOperationKind,
    pub status: FileOperationStatus,
    pub source_path: String,
    pub target_path: Option<String>,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ChangeAttributesRequest {
    pub path: String,
    pub readonly: Option<bool>,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TouchFileRequest {
    pub path: String,
    pub modified_at_ms: u128,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct FileMetadataUpdateResult {
    pub path: String,
    pub metadata: VfsMetadata,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct FolderReportModel {
    pub summary: FolderReportSummary,
    pub rows: Vec<FolderReportRow>,
}

#[derive(Debug, Clone, Default, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct FolderReportSummary {
    pub total: usize,
    pub same: usize,
    pub different: usize,
    pub left_only: usize,
    pub right_only: usize,
    pub error: usize,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct FolderReportRow {
    pub relative_path: String,
    pub depth: usize,
    pub status: FolderCompareStatus,
    pub left_path: Option<String>,
    pub right_path: Option<String>,
    pub left_size: Option<u64>,
    pub right_size: Option<u64>,
    pub left_kind: Option<FolderNodeKind>,
    pub right_kind: Option<FolderNodeKind>,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct FileFilters {
    pub include: Vec<String>,
    pub exclude: Vec<String>,
    pub case_sensitive: bool,
}

impl Default for FileFilters {
    fn default() -> Self {
        Self {
            include: Vec::new(),
            exclude: Vec::new(),
            case_sensitive: true,
        }
    }
}

impl FileFilters {
    pub fn allows(&self, relative_path: &str) -> bool {
        let path = filter_path(relative_path, self.case_sensitive);
        let name = path.rsplit('/').next().unwrap_or(path.as_str()).to_owned();
        let included = self.include.is_empty()
            || self.include.iter().any(|pattern| {
                let normalized = filter_path(pattern, self.case_sensitive);
                wildcard_matches(&normalized, &path) || wildcard_matches(&normalized, &name)
            });
        let excluded = self.exclude.iter().any(|pattern| {
            let normalized = filter_path(pattern, self.case_sensitive);
            wildcard_matches(&normalized, &path) || wildcard_matches(&normalized, &name)
        });

        included && !excluded
    }
}

pub fn filter_alignment_rows(
    rows: Vec<FolderAlignmentRow>,
    filters: &FileFilters,
) -> Vec<FolderAlignmentRow> {
    if filters.include.is_empty() && filters.exclude.is_empty() {
        return rows;
    }

    let matched: std::collections::HashSet<String> = rows
        .iter()
        .filter(|row| filters.allows(&row.relative_path))
        .map(|row| row.relative_path.clone())
        .collect();

    let mut keep = matched.clone();
    for path in &matched {
        let mut end = path.len();
        while let Some(slash) = path[..end].rfind('/') {
            keep.insert(path[..slash].to_owned());
            end = slash;
        }
    }

    rows.into_iter()
        .filter(|row| keep.contains(&row.relative_path))
        .collect()
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

    fn with_children(mut self, children: Vec<FolderScanNode>) -> Self {
        self.children = children;
        self
    }
}

pub fn align_folder_trees(
    left: &FolderScanNode,
    right: &FolderScanNode,
) -> Vec<FolderAlignmentRow> {
    align_folder_trees_with_options(left, right, &FolderCompareOptions::default())
}

pub fn align_folder_trees_with_options(
    left: &FolderScanNode,
    right: &FolderScanNode,
    options: &FolderCompareOptions,
) -> Vec<FolderAlignmentRow> {
    let mut rows = BTreeMap::<String, (Option<FolderScanNode>, Option<FolderScanNode>)>::new();

    collect_alignment_side(left, true, options, &mut rows);
    collect_alignment_side(right, false, options, &mut rows);

    rows.into_iter()
        .map(|(relative_path, (left, right))| {
            let status =
                classify_folder_alignment_with_options(left.as_ref(), right.as_ref(), options);

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
    classify_folder_alignment_with_options(left, right, &FolderCompareOptions::default())
}

pub fn classify_folder_alignment_with_options(
    left: Option<&FolderScanNode>,
    right: Option<&FolderScanNode>,
    options: &FolderCompareOptions,
) -> FolderCompareStatus {
    match (left, right) {
        (Some(_), None) => FolderCompareStatus::LeftOnly,
        (None, Some(_)) => FolderCompareStatus::RightOnly,
        (Some(left), Some(right)) if folder_metadata_matches(left, right, options) => {
            FolderCompareStatus::Same
        }
        (Some(_left), Some(_right)) => FolderCompareStatus::Different,
        (None, None) => FolderCompareStatus::Unknown,
    }
}

pub fn classify_folder_alignment_with_crc32(
    left: Option<&FolderScanNode>,
    right: Option<&FolderScanNode>,
    options: &FolderCompareOptions,
    left_crc32: Option<u32>,
    right_crc32: Option<u32>,
) -> FolderCompareStatus {
    let metadata_status = classify_folder_alignment_with_options(left, right, options);

    if metadata_status != FolderCompareStatus::Same {
        return metadata_status;
    }

    if !matches!((left, right), (Some(left), Some(right)) if left.kind == FolderNodeKind::File && right.kind == FolderNodeKind::File)
    {
        return metadata_status;
    }

    match (left_crc32, right_crc32) {
        (Some(left), Some(right)) if left == right => FolderCompareStatus::Same,
        (Some(_), Some(_)) => FolderCompareStatus::Different,
        _ => metadata_status,
    }
}

pub fn calculate_crc32(bytes: &[u8]) -> u32 {
    let mut crc = 0xffff_ffffu32;

    for byte in bytes {
        crc ^= u32::from(*byte);
        for _ in 0..8 {
            let mask = (crc & 1).wrapping_neg();
            crc = (crc >> 1) ^ (0xedb8_8320 & mask);
        }
    }

    !crc
}

pub fn compare_binary_streams(
    mut left: impl Read,
    mut right: impl Read,
    chunk_size: usize,
) -> io::Result<BinaryCompareResult> {
    let chunk_size = chunk_size.max(1);
    let mut left_buffer = vec![0; chunk_size];
    let mut right_buffer = vec![0; chunk_size];
    let mut compared_bytes = 0u64;

    loop {
        let left_read = left.read(&mut left_buffer)?;
        let right_read = right.read(&mut right_buffer)?;
        let compared_in_chunk = left_read.min(right_read);

        if let Some(index) = left_buffer[..compared_in_chunk]
            .iter()
            .zip(&right_buffer[..compared_in_chunk])
            .position(|(left, right)| left != right)
        {
            return Ok(BinaryCompareResult {
                status: FolderCompareStatus::Different,
                compared_bytes: compared_bytes + index as u64,
                first_difference_offset: Some(compared_bytes + index as u64),
            });
        }

        compared_bytes += compared_in_chunk as u64;

        if left_read != right_read {
            return Ok(BinaryCompareResult {
                status: FolderCompareStatus::Different,
                compared_bytes,
                first_difference_offset: Some(compared_bytes),
            });
        }

        if left_read == 0 {
            return Ok(BinaryCompareResult {
                status: FolderCompareStatus::Same,
                compared_bytes,
                first_difference_offset: None,
            });
        }
    }
}

pub fn compare_text_content_with_rules(
    left: &str,
    right: &str,
    options: &FolderTextRuleCompareOptions,
) -> FolderTextRuleCompareResult {
    let response = diff_core::diff_text(&shared_types::TextDiffRequest {
        left: left.to_owned(),
        right: right.to_owned(),
        ignore_whitespace: options.ignore_whitespace,
        ignore_case: options.ignore_case,
        ignore_line_endings: options.ignore_line_endings,
        ignore_regexes: options.ignore_regexes.clone(),
        algorithm: options.algorithm.clone(),
    });
    let different_lines = response.stats.added + response.stats.deleted + response.stats.modified;

    FolderTextRuleCompareResult {
        status: if different_lines == 0 {
            FolderCompareStatus::Same
        } else {
            FolderCompareStatus::Different
        },
        different_lines,
    }
}

pub fn quick_compare_text(
    left: &str,
    right: &str,
    options: &FolderTextRuleCompareOptions,
) -> QuickCompareResult {
    let result = compare_text_content_with_rules(left, right, options);

    QuickCompareResult {
        mode: QuickCompareMode::Text,
        status: result.status,
        different_units: result.different_lines,
        first_difference_offset: None,
    }
}

pub fn quick_compare_binary(
    left: impl Read,
    right: impl Read,
    chunk_size: usize,
) -> io::Result<QuickCompareResult> {
    let result = compare_binary_streams(left, right, chunk_size)?;

    Ok(QuickCompareResult {
        mode: QuickCompareMode::Binary,
        status: result.status,
        different_units: usize::from(result.first_difference_offset.is_some()),
        first_difference_offset: result.first_difference_offset,
    })
}

pub fn compare_text_to_target(
    source_path: impl Into<String>,
    target_path: impl Into<String>,
    source: &str,
    target: &str,
    options: &FolderTextRuleCompareOptions,
) -> CompareToResult {
    CompareToResult {
        source_path: source_path.into(),
        target_path: target_path.into(),
        quick: quick_compare_text(source, target, options),
    }
}

pub fn copy_between_sides(request: CopySideRequest) -> Result<CopySideResult, FolderScanError> {
    let mut vfs = LocalVfs::new();
    let (source_path, target_path) = match request.direction {
        CopyDirection::ToLeft => (&request.right_path, &request.left_path),
        CopyDirection::ToRight => (&request.left_path, &request.right_path),
    };
    let source = VfsPath::new(source_path);
    let target = VfsPath::new(target_path);
    let bytes = vfs
        .read(&source)
        .map_err(|error| FolderScanError::Vfs(format!("{error:?}")))?;

    vfs.write(&target, &bytes)
        .map_err(|error| FolderScanError::Vfs(format!("{error:?}")))?;

    let target_metadata = vfs
        .metadata(&target)
        .map_err(|error| FolderScanError::Vfs(format!("{error:?}")))?;
    let refreshed_status = refresh_copied_file_status(&vfs, &source, &target)?;

    Ok(CopySideResult {
        direction: request.direction,
        source_path: source_path.to_owned(),
        target_path: target_path.to_owned(),
        target_metadata,
        refreshed_status,
    })
}

fn refresh_copied_file_status(
    vfs: &LocalVfs,
    source: &VfsPath,
    target: &VfsPath,
) -> Result<FolderCompareStatus, FolderScanError> {
    let source_bytes = vfs
        .read(source)
        .map_err(|error| FolderScanError::Vfs(format!("{error:?}")))?;
    let target_bytes = vfs
        .read(target)
        .map_err(|error| FolderScanError::Vfs(format!("{error:?}")))?;

    Ok(
        compare_binary_streams(&source_bytes[..], &target_bytes[..], 8192)
            .map_err(|error| FolderScanError::Vfs(error.to_string()))?
            .status,
    )
}

pub fn perform_file_operation(
    request: FileOperationRequest,
) -> Result<FileOperationResult, FolderScanError> {
    match request {
        FileOperationRequest::Move {
            source_path,
            target_path,
        } => {
            move_path(&source_path, &target_path)?;

            Ok(FileOperationResult {
                operation: FileOperationKind::Move,
                status: FileOperationStatus::Moved,
                source_path,
                target_path: Some(target_path),
            })
        }
        FileOperationRequest::Delete { path } => {
            let mut vfs = LocalVfs::new();

            vfs.delete(&VfsPath::new(&path))
                .map_err(|error| FolderScanError::Vfs(format!("{error:?}")))?;

            Ok(FileOperationResult {
                operation: FileOperationKind::Delete,
                status: FileOperationStatus::Deleted,
                source_path: path,
                target_path: None,
            })
        }
        FileOperationRequest::Rename { path, new_name } => {
            let source = PathBuf::from(&path);
            let target = source
                .parent()
                .map(|parent| parent.join(&new_name))
                .unwrap_or_else(|| PathBuf::from(&new_name));
            let target_path = target.display().to_string();

            move_path(&path, &target_path)?;

            Ok(FileOperationResult {
                operation: FileOperationKind::Rename,
                status: FileOperationStatus::Renamed,
                source_path: path,
                target_path: Some(target_path),
            })
        }
    }
}

fn move_path(source_path: &str, target_path: &str) -> Result<(), FolderScanError> {
    let target = Path::new(target_path);

    if let Some(parent) = target.parent() {
        fs::create_dir_all(parent).map_err(|error| FolderScanError::Vfs(error.to_string()))?;
    }

    fs::rename(source_path, target_path).map_err(|error| FolderScanError::Vfs(error.to_string()))
}

pub fn change_file_attributes(
    request: ChangeAttributesRequest,
) -> Result<FileMetadataUpdateResult, FolderScanError> {
    if let Some(readonly) = request.readonly {
        let mut permissions = fs::metadata(&request.path)
            .map_err(|error| FolderScanError::Vfs(error.to_string()))?
            .permissions();

        permissions.set_readonly(readonly);
        fs::set_permissions(&request.path, permissions)
            .map_err(|error| FolderScanError::Vfs(error.to_string()))?;
    }

    refreshed_metadata_result(request.path)
}

pub fn touch_file(request: TouchFileRequest) -> Result<FileMetadataUpdateResult, FolderScanError> {
    let file = fs::OpenOptions::new()
        .write(true)
        .open(&request.path)
        .map_err(|error| FolderScanError::Vfs(error.to_string()))?;
    let modified_at = UNIX_EPOCH + Duration::from_millis(request.modified_at_ms as u64);

    file.set_modified(modified_at)
        .map_err(|error| FolderScanError::Vfs(error.to_string()))?;

    refreshed_metadata_result(request.path)
}

fn refreshed_metadata_result(path: String) -> Result<FileMetadataUpdateResult, FolderScanError> {
    let vfs = LocalVfs::new();
    let metadata = vfs
        .metadata(&VfsPath::new(&path))
        .map_err(|error| FolderScanError::Vfs(format!("{error:?}")))?;

    Ok(FileMetadataUpdateResult { path, metadata })
}

pub fn build_folder_report_model(
    rows: &[FolderAlignmentRow],
    options: &FolderCompareOptions,
    include_same: bool,
) -> FolderReportModel {
    let mut summary = FolderReportSummary {
        total: rows.len(),
        ..FolderReportSummary::default()
    };
    let rows = rows
        .iter()
        .filter_map(|row| {
            let status = classify_folder_alignment_with_options(
                row.left.as_ref(),
                row.right.as_ref(),
                options,
            );

            increment_report_summary(&mut summary, &status);

            (include_same || status != FolderCompareStatus::Same).then(|| FolderReportRow {
                relative_path: row.relative_path.clone(),
                depth: row.depth,
                status,
                left_path: row.left.as_ref().map(|node| node.relative_path.clone()),
                right_path: row.right.as_ref().map(|node| node.relative_path.clone()),
                left_size: row.left.as_ref().map(|node| node.metadata.size),
                right_size: row.right.as_ref().map(|node| node.metadata.size),
                left_kind: row.left.as_ref().map(|node| node.kind.clone()),
                right_kind: row.right.as_ref().map(|node| node.kind.clone()),
            })
        })
        .collect();

    FolderReportModel { summary, rows }
}

fn increment_report_summary(summary: &mut FolderReportSummary, status: &FolderCompareStatus) {
    match status {
        FolderCompareStatus::Unknown => {}
        FolderCompareStatus::Same => summary.same += 1,
        FolderCompareStatus::Different => summary.different += 1,
        FolderCompareStatus::LeftOnly => summary.left_only += 1,
        FolderCompareStatus::RightOnly => summary.right_only += 1,
        FolderCompareStatus::Error => summary.error += 1,
    }
}

pub fn render_folder_report_html(report: &FolderReportModel, title: &str) -> String {
    let title = escape_html(title);
    let mut html = String::from("<!doctype html><html><head><meta charset=\"utf-8\">");

    html.push_str("<title>");
    html.push_str(&title);
    html.push_str("</title>");
    html.push_str("<style>body{font-family:system-ui,sans-serif;margin:24px}table{border-collapse:collapse;width:100%}th,td{border:1px solid #d0d7de;padding:6px 8px;text-align:left}.different{background:#fff8c5}.left-only,.right-only{background:#ffebe9}.same{background:#dafbe1}</style>");
    html.push_str("</head><body><h1>");
    html.push_str(&title);
    html.push_str("</h1><section>");
    html.push_str(&format!(
        "Total: {} | Same: {} | Different: {} | Left only: {} | Right only: {} | Error: {}",
        report.summary.total,
        report.summary.same,
        report.summary.different,
        report.summary.left_only,
        report.summary.right_only,
        report.summary.error
    ));
    html.push_str("</section><table><thead><tr><th>Path</th><th>Status</th><th>Left</th><th>Right</th><th>Left Size</th><th>Right Size</th></tr></thead><tbody>");

    for row in &report.rows {
        let status_class = status_css_class(&row.status);

        html.push_str("<tr class=\"");
        html.push_str(status_class);
        html.push_str("\"><td>");
        html.push_str(&escape_html(&row.relative_path));
        html.push_str("</td><td>");
        html.push_str(&escape_html(&status_label(&row.status)));
        html.push_str("</td><td>");
        html.push_str(&linked_path(row.left_path.as_deref()));
        html.push_str("</td><td>");
        html.push_str(&linked_path(row.right_path.as_deref()));
        html.push_str("</td><td>");
        html.push_str(
            &row.left_size
                .map_or_else(|| "-".to_owned(), |size| size.to_string()),
        );
        html.push_str("</td><td>");
        html.push_str(
            &row.right_size
                .map_or_else(|| "-".to_owned(), |size| size.to_string()),
        );
        html.push_str("</td></tr>");
    }

    html.push_str("</tbody></table></body></html>");
    html
}

pub fn render_folder_report_xml(report: &FolderReportModel) -> String {
    let mut xml = String::from("<?xml version=\"1.0\" encoding=\"utf-8\"?>");

    xml.push_str(&format!(
        "<folderReport total=\"{}\" same=\"{}\" different=\"{}\" leftOnly=\"{}\" rightOnly=\"{}\" error=\"{}\">",
        report.summary.total,
        report.summary.same,
        report.summary.different,
        report.summary.left_only,
        report.summary.right_only,
        report.summary.error
    ));
    xml.push_str("<rows>");

    for row in &report.rows {
        xml.push_str("<row");
        push_xml_attribute(&mut xml, "relativePath", &row.relative_path);
        push_xml_attribute(&mut xml, "status", &status_label(&row.status));
        push_xml_attribute(&mut xml, "depth", &row.depth.to_string());

        if let Some(path) = &row.left_path {
            push_xml_attribute(&mut xml, "leftPath", path);
        }

        if let Some(path) = &row.right_path {
            push_xml_attribute(&mut xml, "rightPath", path);
        }

        if let Some(size) = row.left_size {
            push_xml_attribute(&mut xml, "leftSize", &size.to_string());
        }

        if let Some(size) = row.right_size {
            push_xml_attribute(&mut xml, "rightSize", &size.to_string());
        }

        xml.push_str("/>");
    }

    xml.push_str("</rows></folderReport>");
    xml
}

pub fn render_folder_report_text(report: &FolderReportModel, title: &str) -> String {
    let mut text = String::new();

    text.push_str(title);
    text.push('\n');
    text.push_str(&format!(
        "Total: {} | Same: {} | Different: {} | Left only: {} | Right only: {} | Error: {}\n",
        report.summary.total,
        report.summary.same,
        report.summary.different,
        report.summary.left_only,
        report.summary.right_only,
        report.summary.error
    ));
    text.push_str("Status | Path | Left | Right | Left Size | Right Size\n");

    for row in &report.rows {
        text.push_str(&format!(
            "{} | {} | {} | {} | {} | {}\n",
            status_label(&row.status),
            row.relative_path,
            row.left_path.as_deref().unwrap_or("-"),
            row.right_path.as_deref().unwrap_or("-"),
            row.left_size
                .map_or_else(|| "-".to_owned(), |size| size.to_string()),
            row.right_size
                .map_or_else(|| "-".to_owned(), |size| size.to_string())
        ));
    }

    text
}

fn push_xml_attribute(xml: &mut String, key: &str, value: &str) {
    xml.push(' ');
    xml.push_str(key);
    xml.push_str("=\"");
    xml.push_str(&escape_html(value));
    xml.push('"');
}

fn status_css_class(status: &FolderCompareStatus) -> &'static str {
    match status {
        FolderCompareStatus::Unknown => "unknown",
        FolderCompareStatus::Same => "same",
        FolderCompareStatus::Different => "different",
        FolderCompareStatus::LeftOnly => "left-only",
        FolderCompareStatus::RightOnly => "right-only",
        FolderCompareStatus::Error => "error",
    }
}

fn status_label(status: &FolderCompareStatus) -> String {
    match status {
        FolderCompareStatus::Unknown => "unknown",
        FolderCompareStatus::Same => "same",
        FolderCompareStatus::Different => "different",
        FolderCompareStatus::LeftOnly => "left only",
        FolderCompareStatus::RightOnly => "right only",
        FolderCompareStatus::Error => "error",
    }
    .to_owned()
}

fn linked_path(path: Option<&str>) -> String {
    path.map_or_else(
        || "-".to_owned(),
        |path| {
            format!(
                "<a href=\"file://{}\">{}</a>",
                encode_file_link(path),
                escape_html(path)
            )
        },
    )
}

fn escape_html(value: &str) -> String {
    value
        .replace('&', "&amp;")
        .replace('<', "&lt;")
        .replace('>', "&gt;")
        .replace('"', "&quot;")
        .replace('\'', "&#39;")
}

fn encode_file_link(value: &str) -> String {
    value
        .chars()
        .flat_map(|character| match character {
            ' ' => "%20".chars().collect::<Vec<_>>(),
            '<' => "%3C".chars().collect(),
            '>' => "%3E".chars().collect(),
            '"' => "%22".chars().collect(),
            '\'' => "%27".chars().collect(),
            '#' => "%23".chars().collect(),
            '?' => "%3F".chars().collect(),
            _ => vec![character],
        })
        .collect()
}

/// True when both sides share kind and size but modified times do not match under `options`.
/// Used to classify timestamp-only folder differences as unimportant (Minor).
pub fn is_timestamp_only_metadata_difference(
    left: &FolderScanNode,
    right: &FolderScanNode,
    options: &FolderCompareOptions,
) -> bool {
    left.kind == right.kind
        && left.metadata.size == right.metadata.size
        && !modified_times_match(
            left.metadata.modified_at_ms,
            right.metadata.modified_at_ms,
            options,
        )
}

/// True when both sides share kind, size, and modified time (under `options`) but readonly differs.
pub fn is_attribute_only_metadata_difference(
    left: &FolderScanNode,
    right: &FolderScanNode,
    options: &FolderCompareOptions,
) -> bool {
    left.kind == right.kind
        && left.metadata.size == right.metadata.size
        && modified_times_match(
            left.metadata.modified_at_ms,
            right.metadata.modified_at_ms,
            options,
        )
        && left.metadata.readonly != right.metadata.readonly
}

/// True when both sides share kind, modified time (under `options`), and attributes
/// (when compared) but reported sizes differ.
pub fn is_size_only_metadata_difference(
    left: &FolderScanNode,
    right: &FolderScanNode,
    options: &FolderCompareOptions,
) -> bool {
    left.kind == right.kind
        && left.metadata.size != right.metadata.size
        && (!options.compare_modified_time
            || modified_times_match(
                left.metadata.modified_at_ms,
                right.metadata.modified_at_ms,
                options,
            ))
        && (!options.compare_attributes || left.metadata.readonly == right.metadata.readonly)
}

/// Timestamp, attribute, and/or size-only mismatches that should surface under Minor.
pub fn is_minor_metadata_difference(
    left: &FolderScanNode,
    right: &FolderScanNode,
    options: &FolderCompareOptions,
) -> bool {
    if left.kind != right.kind {
        return false;
    }

    let size_differs = left.metadata.size != right.metadata.size;
    let timestamp_differs = options.compare_modified_time
        && !modified_times_match(
            left.metadata.modified_at_ms,
            right.metadata.modified_at_ms,
            options,
        );
    let attribute_differs =
        options.compare_attributes && left.metadata.readonly != right.metadata.readonly;

    if !size_differs && (timestamp_differs || attribute_differs) {
        return true;
    }

    options.size_only_unimportant && size_differs && !timestamp_differs && !attribute_differs
}

fn folder_metadata_matches(
    left: &FolderScanNode,
    right: &FolderScanNode,
    options: &FolderCompareOptions,
) -> bool {
    left.kind == right.kind
        && (!options.compare_size || left.metadata.size == right.metadata.size)
        && (!options.compare_modified_time
            || modified_times_match(
                left.metadata.modified_at_ms,
                right.metadata.modified_at_ms,
                options,
            ))
        && (!options.compare_attributes || left.metadata.readonly == right.metadata.readonly)
}

fn modified_times_match(
    left: Option<u128>,
    right: Option<u128>,
    options: &FolderCompareOptions,
) -> bool {
    let (Some(left), Some(right)) = (left, right) else {
        return left == right;
    };
    let difference = left.abs_diff(right);
    if difference <= options.timestamp_tolerance_ms {
        return true;
    }
    ignored_hour_offsets_ms(options)
        .into_iter()
        .any(|offset_ms| offset_matches_difference(difference, offset_ms, options))
}

fn ignored_hour_offsets_ms(options: &FolderCompareOptions) -> Vec<u128> {
    let mut offsets = options
        .ignored_timezone_hour_offsets
        .iter()
        .map(|hours| u128::from(hours.unsigned_abs()) * 3_600_000)
        .collect::<Vec<_>>();
    if options.ignore_daylight_saving_hour_offset {
        offsets.push(3_600_000);
    }
    offsets
}

fn offset_matches_difference(
    difference: u128,
    offset_ms: u128,
    options: &FolderCompareOptions,
) -> bool {
    if offset_ms == 0 {
        return false;
    }
    difference.abs_diff(offset_ms) <= options.timestamp_tolerance_ms
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
    scan_local_folder_with_options(root, cancel_token, &FolderCompareOptions::default())
}

pub fn scan_local_folder_with_options(
    root: impl AsRef<Path>,
    cancel_token: &job_core::CancellationToken,
    options: &FolderCompareOptions,
) -> Result<FolderScanNode, FolderScanError> {
    let root = root.as_ref();
    let mut visiting = HashSet::new();
    if let Ok(canonical) = fs::canonicalize(root) {
        visiting.insert(canonical);
    }
    // Always enter the requested root; follow_symlinks applies to nested entries.
    scan_resolved_path(
        root,
        root,
        cancel_token,
        options.follow_symlinks,
        &mut visiting,
    )
}

fn scan_path_entry(
    root: &Path,
    path: &Path,
    cancel_token: &job_core::CancellationToken,
    follow_symlinks: bool,
    visiting: &mut HashSet<PathBuf>,
) -> Result<FolderScanNode, FolderScanError> {
    if cancel_token.is_cancelled() {
        return Err(FolderScanError::Cancelled);
    }

    let symlink_meta =
        fs::symlink_metadata(path).map_err(|error| FolderScanError::Vfs(error.to_string()))?;

    if symlink_meta.file_type().is_symlink() {
        if !follow_symlinks {
            return Ok(folder_node_from_fs_meta(root, path, &symlink_meta, true));
        }

        let canonical = match fs::canonicalize(path) {
            Ok(canonical) => canonical,
            Err(_) => return Ok(folder_node_from_fs_meta(root, path, &symlink_meta, true)),
        };
        if !visiting.insert(canonical.clone()) {
            return Ok(folder_node_from_fs_meta(root, path, &symlink_meta, true));
        }
        let scanned = scan_resolved_path(root, path, cancel_token, follow_symlinks, visiting);
        visiting.remove(&canonical);
        return scanned;
    }

    scan_resolved_path(root, path, cancel_token, follow_symlinks, visiting)
}

fn scan_resolved_path(
    root: &Path,
    path: &Path,
    cancel_token: &job_core::CancellationToken,
    follow_symlinks: bool,
    visiting: &mut HashSet<PathBuf>,
) -> Result<FolderScanNode, FolderScanError> {
    if cancel_token.is_cancelled() {
        return Err(FolderScanError::Cancelled);
    }

    let metadata = fs::metadata(path).map_err(|error| FolderScanError::Vfs(error.to_string()))?;
    if metadata.is_file() || metadata.file_type().is_symlink() {
        return Ok(folder_node_from_fs_meta(root, path, &metadata, true));
    }

    let mut children = fs::read_dir(path)
        .map_err(|error| FolderScanError::Vfs(error.to_string()))?
        .map(|entry| {
            let entry = entry.map_err(|error| FolderScanError::Vfs(error.to_string()))?;
            scan_path_entry(root, &entry.path(), cancel_token, follow_symlinks, visiting)
        })
        .collect::<Result<Vec<_>, _>>()?;

    children.sort_by(|left, right| left.name.cmp(&right.name));
    Ok(folder_node_from_fs_meta(root, path, &metadata, false).with_children(children))
}

fn folder_node_from_fs_meta(
    root: &Path,
    path: &Path,
    metadata: &fs::Metadata,
    as_file: bool,
) -> FolderScanNode {
    let relative = relative_path(root, path);
    let name = path
        .file_name()
        .map(|value| value.to_string_lossy().into_owned())
        .unwrap_or_else(|| path.display().to_string());
    let vfs_meta = vfs_metadata_from_fs(path, metadata, as_file);
    if as_file || metadata.is_file() {
        FolderScanNode::new_file(relative, name, vfs_meta)
    } else {
        FolderScanNode::new_directory(relative, name, vfs_meta, Vec::new())
    }
}

fn vfs_metadata_from_fs(path: &Path, metadata: &fs::Metadata, force_file: bool) -> VfsMetadata {
    let kind = if !force_file && metadata.is_dir() {
        VfsEntryKind::Directory
    } else {
        VfsEntryKind::File
    };
    VfsMetadata {
        kind,
        name: path
            .file_name()
            .map(|value| value.to_string_lossy().into_owned())
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
    }
}

fn collect_alignment_side(
    node: &FolderScanNode,
    is_left: bool,
    options: &FolderCompareOptions,
    rows: &mut BTreeMap<String, (Option<FolderScanNode>, Option<FolderScanNode>)>,
) {
    for child in &node.children {
        let entry = rows
            .entry(alignment_key(&child.relative_path, options))
            .or_default();
        if is_left {
            entry.0 = Some(child.clone());
        } else {
            entry.1 = Some(child.clone());
        }

        collect_alignment_side(child, is_left, options, rows);
    }
}

fn alignment_key(relative_path: &str, options: &FolderCompareOptions) -> String {
    if options.case_sensitive_names {
        relative_path.to_owned()
    } else {
        relative_path.to_lowercase()
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

fn filter_path(value: &str, case_sensitive: bool) -> String {
    let normalized = value.replace('\\', "/");

    if case_sensitive {
        normalized
    } else {
        normalized.to_lowercase()
    }
}

fn wildcard_matches(pattern: &str, value: &str) -> bool {
    if let Some(inner) = pattern.strip_prefix("**/") {
        return wildcard_matches(inner, value)
            || value
                .split_once('/')
                .is_some_and(|(_, rest)| wildcard_matches(pattern, rest));
    }

    wildcard_match_segments(
        &pattern.split('/').collect::<Vec<_>>(),
        &value.split('/').collect::<Vec<_>>(),
    )
}

fn wildcard_match_segments(pattern: &[&str], value: &[&str]) -> bool {
    match pattern {
        [] => value.is_empty(),
        ["**", rest @ ..] => {
            wildcard_match_segments(rest, value)
                || (!value.is_empty() && wildcard_match_segments(pattern, &value[1..]))
        }
        [head, rest @ ..] => {
            !value.is_empty()
                && wildcard_match_component(head, value[0])
                && wildcard_match_segments(rest, &value[1..])
        }
    }
}

fn wildcard_match_component(pattern: &str, value: &str) -> bool {
    let pattern_chars = pattern.chars().collect::<Vec<_>>();
    let value_chars = value.chars().collect::<Vec<_>>();
    let mut matches = vec![vec![false; value_chars.len() + 1]; pattern_chars.len() + 1];

    matches[0][0] = true;

    for pattern_index in 1..=pattern_chars.len() {
        if pattern_chars[pattern_index - 1] == '*' {
            matches[pattern_index][0] = matches[pattern_index - 1][0];
        }
    }

    for pattern_index in 1..=pattern_chars.len() {
        for value_index in 1..=value_chars.len() {
            matches[pattern_index][value_index] = match pattern_chars[pattern_index - 1] {
                '*' => {
                    matches[pattern_index - 1][value_index]
                        || matches[pattern_index][value_index - 1]
                }
                '?' => matches[pattern_index - 1][value_index - 1],
                expected => {
                    expected == value_chars[value_index - 1]
                        && matches[pattern_index - 1][value_index - 1]
                }
            };
        }
    }

    matches[pattern_chars.len()][value_chars.len()]
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

    #[cfg(unix)]
    #[test]
    fn skips_directory_symlinks_unless_follow_symlinks_enabled() {
        let root = unique_temp_dir("folder-symlink");
        let real = root.join("real");
        fs::create_dir_all(real.join("nested")).expect("directory should be created");
        fs::write(real.join("nested").join("a.txt"), b"a").expect("file should be written");
        std::os::unix::fs::symlink(&real, root.join("link")).expect("symlink should be created");

        let skipped = scan_local_folder(&root, &CancellationToken::default()).expect("scan");
        let link = skipped
            .children
            .iter()
            .find(|child| child.name == "link")
            .expect("link entry");
        assert_eq!(link.kind, FolderNodeKind::File);
        assert!(link.children.is_empty());

        let followed = scan_local_folder_with_options(
            &root,
            &CancellationToken::default(),
            &FolderCompareOptions {
                follow_symlinks: true,
                ..FolderCompareOptions::default()
            },
        )
        .expect("follow scan");
        let link = followed
            .children
            .iter()
            .find(|child| child.name == "link")
            .expect("followed link");
        assert_eq!(link.kind, FolderNodeKind::Directory);
        assert_eq!(link.children[0].name, "nested");
        assert_eq!(link.children[0].children[0].name, "a.txt");

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

    #[test]
    fn detects_timestamp_only_metadata_differences_for_minor_filter() {
        let left = FolderScanNode::new_file(
            "same.txt",
            "same.txt",
            metadata_with_modified_at(VfsEntryKind::File, "same.txt", Some("txt"), 20, Some(1_000)),
        );
        let right_time = FolderScanNode::new_file(
            "same.txt",
            "same.txt",
            metadata_with_modified_at(VfsEntryKind::File, "same.txt", Some("txt"), 20, Some(2_000)),
        );
        let right_size = FolderScanNode::new_file(
            "same.txt",
            "same.txt",
            metadata_with_modified_at(VfsEntryKind::File, "same.txt", Some("txt"), 21, Some(2_000)),
        );
        let options = FolderCompareOptions {
            compare_size: true,
            compare_modified_time: true,
            case_sensitive_names: true,
            compare_contents: false,
            compare_crc: false,
            ..Default::default()
        };

        assert!(is_timestamp_only_metadata_difference(
            &left,
            &right_time,
            &options
        ));
        assert!(!is_timestamp_only_metadata_difference(
            &left,
            &right_size,
            &options
        ));
    }

    #[test]
    fn detects_attribute_only_metadata_differences_for_minor_filter() {
        let left = FolderScanNode::new_file(
            "same.txt",
            "same.txt",
            metadata_with_modified_at(VfsEntryKind::File, "same.txt", Some("txt"), 20, Some(1_000)),
        );
        let mut right_attr = FolderScanNode::new_file(
            "same.txt",
            "same.txt",
            metadata_with_modified_at(VfsEntryKind::File, "same.txt", Some("txt"), 20, Some(1_000)),
        );
        right_attr.metadata.readonly = true;
        let right_size = FolderScanNode::new_file(
            "same.txt",
            "same.txt",
            metadata_with_modified_at(VfsEntryKind::File, "same.txt", Some("txt"), 21, Some(1_000)),
        );
        let options = FolderCompareOptions {
            compare_size: true,
            compare_modified_time: false,
            compare_attributes: true,
            case_sensitive_names: true,
            compare_contents: false,
            compare_crc: false,
            ..Default::default()
        };

        assert!(is_attribute_only_metadata_difference(
            &left,
            &right_attr,
            &options
        ));
        assert!(is_minor_metadata_difference(&left, &right_attr, &options));
        assert!(!is_attribute_only_metadata_difference(
            &left,
            &right_size,
            &options
        ));
        assert!(!is_minor_metadata_difference(&left, &right_size, &options));
        assert_eq!(
            classify_folder_alignment_with_options(Some(&left), Some(&right_attr), &options),
            FolderCompareStatus::Different
        );
    }

    #[test]
    fn detects_size_only_metadata_differences_for_minor_filter() {
        let left = FolderScanNode::new_file(
            "same.txt",
            "same.txt",
            metadata_with_modified_at(VfsEntryKind::File, "same.txt", Some("txt"), 20, Some(1_000)),
        );
        let right_size = FolderScanNode::new_file(
            "same.txt",
            "same.txt",
            metadata_with_modified_at(VfsEntryKind::File, "same.txt", Some("txt"), 21, Some(1_000)),
        );
        let right_time = FolderScanNode::new_file(
            "same.txt",
            "same.txt",
            metadata_with_modified_at(VfsEntryKind::File, "same.txt", Some("txt"), 21, Some(2_000)),
        );
        let options = FolderCompareOptions {
            compare_size: true,
            compare_modified_time: true,
            compare_attributes: false,
            size_only_unimportant: true,
            case_sensitive_names: true,
            compare_contents: false,
            compare_crc: false,
            ..Default::default()
        };

        assert!(is_size_only_metadata_difference(
            &left,
            &right_size,
            &options
        ));
        assert!(is_minor_metadata_difference(&left, &right_size, &options));
        assert!(!is_size_only_metadata_difference(
            &left,
            &right_time,
            &options
        ));
        assert!(!is_minor_metadata_difference(&left, &right_time, &options));

        let disabled = FolderCompareOptions {
            size_only_unimportant: false,
            ..options.clone()
        };
        assert!(is_size_only_metadata_difference(
            &left,
            &right_size,
            &disabled
        ));
        assert!(!is_minor_metadata_difference(&left, &right_size, &disabled));
        assert_eq!(
            classify_folder_alignment_with_options(Some(&left), Some(&right_size), &options),
            FolderCompareStatus::Different
        );
    }

    #[test]
    fn supports_size_and_modified_time_comparison_options() {
        let left = FolderScanNode::new_file(
            "same.txt",
            "same.txt",
            metadata_with_modified_at(VfsEntryKind::File, "same.txt", Some("txt"), 20, Some(1_000)),
        );
        let right = FolderScanNode::new_file(
            "same.txt",
            "same.txt",
            metadata_with_modified_at(VfsEntryKind::File, "same.txt", Some("txt"), 20, Some(2_000)),
        );

        assert_eq!(
            classify_folder_alignment_with_options(
                Some(&left),
                Some(&right),
                &FolderCompareOptions {
                    compare_size: true,
                    compare_modified_time: true,
                    case_sensitive_names: true,
                    compare_contents: false,
                    compare_crc: false,
                    ..Default::default()
                },
            ),
            FolderCompareStatus::Different
        );
        assert_eq!(
            classify_folder_alignment_with_options(
                Some(&left),
                Some(&right),
                &FolderCompareOptions {
                    compare_size: true,
                    compare_modified_time: false,
                    case_sensitive_names: true,
                    compare_contents: false,
                    compare_crc: false,
                    ..Default::default()
                },
            ),
            FolderCompareStatus::Same
        );
    }

    #[test]
    fn honors_timestamp_tolerance_and_ignore_dst_hour_offset() {
        let left = FolderScanNode::new_file(
            "same.txt",
            "same.txt",
            metadata_with_modified_at(VfsEntryKind::File, "same.txt", Some("txt"), 20, Some(1_000)),
        );
        let near = FolderScanNode::new_file(
            "same.txt",
            "same.txt",
            metadata_with_modified_at(VfsEntryKind::File, "same.txt", Some("txt"), 20, Some(1_500)),
        );
        let dst = FolderScanNode::new_file(
            "same.txt",
            "same.txt",
            metadata_with_modified_at(
                VfsEntryKind::File,
                "same.txt",
                Some("txt"),
                20,
                Some(1_000 + 3_600_000),
            ),
        );

        assert_eq!(
            classify_folder_alignment_with_options(
                Some(&left),
                Some(&near),
                &FolderCompareOptions {
                    compare_size: true,
                    compare_modified_time: true,
                    case_sensitive_names: true,
                    compare_contents: false,
                    compare_crc: false,
                    timestamp_tolerance_ms: 1_000,
                    ..Default::default()
                },
            ),
            FolderCompareStatus::Same
        );
        assert_eq!(
            classify_folder_alignment_with_options(
                Some(&left),
                Some(&dst),
                &FolderCompareOptions {
                    compare_size: true,
                    compare_modified_time: true,
                    case_sensitive_names: true,
                    compare_contents: false,
                    compare_crc: false,
                    ignore_daylight_saving_hour_offset: true,
                    ..Default::default()
                },
            ),
            FolderCompareStatus::Same
        );
        assert_eq!(
            classify_folder_alignment_with_options(
                Some(&left),
                Some(&dst),
                &FolderCompareOptions {
                    compare_size: true,
                    compare_modified_time: true,
                    case_sensitive_names: true,
                    compare_contents: false,
                    compare_crc: false,
                    ..Default::default()
                },
            ),
            FolderCompareStatus::Different
        );
    }

    #[test]
    fn aligns_names_with_configurable_case_sensitivity() {
        let left = FolderScanNode::new_directory(
            "",
            "left",
            metadata(VfsEntryKind::Directory, "left", None, 0),
            vec![FolderScanNode::new_file(
                "Readme.md",
                "Readme.md",
                metadata(VfsEntryKind::File, "Readme.md", Some("md"), 20),
            )],
        );
        let right = FolderScanNode::new_directory(
            "",
            "right",
            metadata(VfsEntryKind::Directory, "right", None, 0),
            vec![FolderScanNode::new_file(
                "README.md",
                "README.md",
                metadata(VfsEntryKind::File, "README.md", Some("md"), 20),
            )],
        );

        let insensitive = align_folder_trees_with_options(
            &left,
            &right,
            &FolderCompareOptions {
                compare_size: true,
                compare_modified_time: false,
                case_sensitive_names: false,
                compare_contents: false,
                compare_crc: false,
                ..Default::default()
            },
        );
        let sensitive = align_folder_trees_with_options(
            &left,
            &right,
            &FolderCompareOptions {
                compare_size: true,
                compare_modified_time: false,
                case_sensitive_names: true,
                compare_contents: false,
                compare_crc: false,
                ..Default::default()
            },
        );

        assert_eq!(insensitive.len(), 1);
        assert!(insensitive[0].left.is_some());
        assert!(insensitive[0].right.is_some());
        assert_eq!(sensitive.len(), 2);
        assert!(sensitive
            .iter()
            .any(|row| row.left.is_some() && row.right.is_none()));
        assert!(sensitive
            .iter()
            .any(|row| row.left.is_none() && row.right.is_some()));
    }

    #[test]
    fn calculates_crc32_with_standard_vector() {
        assert_eq!(calculate_crc32(b"123456789"), 0xcbf4_3926);
    }

    #[test]
    fn updates_file_status_from_crc32_content_comparison() {
        let left = FolderScanNode::new_file(
            "same-size.bin",
            "same-size.bin",
            metadata(VfsEntryKind::File, "same-size.bin", Some("bin"), 3),
        );
        let right = FolderScanNode::new_file(
            "same-size.bin",
            "same-size.bin",
            metadata(VfsEntryKind::File, "same-size.bin", Some("bin"), 3),
        );

        assert_eq!(
            classify_folder_alignment_with_crc32(
                Some(&left),
                Some(&right),
                &FolderCompareOptions::default(),
                Some(calculate_crc32(b"abc")),
                Some(calculate_crc32(b"abd")),
            ),
            FolderCompareStatus::Different
        );
    }

    #[test]
    fn compares_binary_streams_by_chunks() {
        let same =
            compare_binary_streams(&b"abcdef"[..], &b"abcdef"[..], 2).expect("compare should work");
        let different =
            compare_binary_streams(&b"abcdef"[..], &b"abcxef"[..], 2).expect("compare should work");
        let length_mismatch =
            compare_binary_streams(&b"abc"[..], &b"abcd"[..], 2).expect("compare should work");

        assert_eq!(same.status, FolderCompareStatus::Same);
        assert_eq!(same.first_difference_offset, None);
        assert_eq!(different.status, FolderCompareStatus::Different);
        assert_eq!(different.first_difference_offset, Some(3));
        assert_eq!(length_mismatch.status, FolderCompareStatus::Different);
        assert_eq!(length_mismatch.first_difference_offset, Some(3));
    }

    #[test]
    fn compares_text_content_with_file_format_rules() {
        let result = compare_text_content_with_rules(
            "timestamp=100\nstatus=ok",
            "timestamp=200\nstatus=ok",
            &FolderTextRuleCompareOptions {
                ignore_whitespace: false,
                ignore_case: false,
                ignore_line_endings: false,
                ignore_regexes: vec!["timestamp=\\d+".to_owned()],
                algorithm: Some("myers".to_owned()),
            },
        );

        assert_eq!(result.status, FolderCompareStatus::Same);
        assert_eq!(result.different_lines, 0);
    }

    #[test]
    fn quick_compare_reports_text_and_binary_status_for_selected_files() {
        let text_result = quick_compare_text(
            "line one\nline two",
            "line one\nline 2",
            &FolderTextRuleCompareOptions {
                ignore_whitespace: false,
                ignore_case: false,
                ignore_line_endings: false,
                ignore_regexes: Vec::new(),
                algorithm: Some("myers".to_owned()),
            },
        );
        let binary_result =
            quick_compare_binary(&b"abcdef"[..], &b"abcdef"[..], 3).expect("binary compare works");

        assert_eq!(text_result.mode, QuickCompareMode::Text);
        assert_eq!(text_result.status, FolderCompareStatus::Different);
        assert_eq!(text_result.different_units, 1);
        assert_eq!(binary_result.mode, QuickCompareMode::Binary);
        assert_eq!(binary_result.status, FolderCompareStatus::Same);
        assert_eq!(binary_result.different_units, 0);
    }

    #[test]
    fn compare_to_preserves_selected_source_target_and_status() {
        let result = compare_text_to_target(
            "D:/workspace/left/README.md",
            "D:/workspace/archive/README.md",
            "same\ncontent",
            "same\nchanged",
            &FolderTextRuleCompareOptions {
                ignore_whitespace: false,
                ignore_case: false,
                ignore_line_endings: false,
                ignore_regexes: Vec::new(),
                algorithm: Some("myers".to_owned()),
            },
        );

        assert_eq!(result.source_path, "D:/workspace/left/README.md");
        assert_eq!(result.target_path, "D:/workspace/archive/README.md");
        assert_eq!(result.quick.status, FolderCompareStatus::Different);
        assert_eq!(result.quick.mode, QuickCompareMode::Text);
    }

    #[test]
    fn copies_selected_file_between_sides_and_returns_refreshed_metadata() {
        let root = unique_temp_dir("folder-copy");
        let left = root.join("left").join("note.txt");
        let right = root.join("right").join("note.txt");

        fs::create_dir_all(left.parent().expect("left parent")).expect("left dir");
        fs::create_dir_all(right.parent().expect("right parent")).expect("right dir");
        fs::write(&left, b"left version").expect("left write");
        fs::write(&right, b"right").expect("right write");

        let result = copy_between_sides(CopySideRequest {
            direction: CopyDirection::ToRight,
            left_path: left.display().to_string(),
            right_path: right.display().to_string(),
        })
        .expect("copy should work");

        assert_eq!(fs::read(&right).expect("right read"), b"left version");
        assert_eq!(result.direction, CopyDirection::ToRight);
        assert_eq!(result.source_path, left.display().to_string());
        assert_eq!(result.target_path, right.display().to_string());
        assert_eq!(result.refreshed_status, FolderCompareStatus::Same);
        assert_eq!(result.target_metadata.size, 12);

        let _ = fs::remove_dir_all(root);
    }

    #[test]
    fn moves_deletes_and_renames_files_with_diagnostic_results() {
        let root = unique_temp_dir("folder-operations");
        let source = root.join("source.txt");
        let renamed = root.join("renamed.txt");
        let moved = root.join("archive").join("renamed.txt");

        fs::create_dir_all(&root).expect("root dir");
        fs::write(&source, b"operation bytes").expect("source write");

        let rename_result = perform_file_operation(FileOperationRequest::Rename {
            path: source.display().to_string(),
            new_name: "renamed.txt".to_owned(),
        })
        .expect("rename works");

        assert_eq!(rename_result.operation, FileOperationKind::Rename);
        assert_eq!(
            rename_result.target_path.as_deref(),
            Some(renamed.to_string_lossy().as_ref())
        );
        assert!(renamed.exists());
        assert!(!source.exists());

        let move_result = perform_file_operation(FileOperationRequest::Move {
            source_path: renamed.display().to_string(),
            target_path: moved.display().to_string(),
        })
        .expect("move works");

        assert_eq!(move_result.operation, FileOperationKind::Move);
        assert_eq!(fs::read(&moved).expect("moved read"), b"operation bytes");
        assert_eq!(
            move_result.target_path.as_deref(),
            Some(moved.to_string_lossy().as_ref())
        );

        let delete_result = perform_file_operation(FileOperationRequest::Delete {
            path: moved.display().to_string(),
        })
        .expect("delete works");

        assert_eq!(delete_result.operation, FileOperationKind::Delete);
        assert_eq!(delete_result.status, FileOperationStatus::Deleted);
        assert!(!moved.exists());

        let _ = fs::remove_dir_all(root);
    }

    #[test]
    fn changes_readonly_attribute_and_touches_modified_time() {
        let root = unique_temp_dir("folder-attributes");
        let file = root.join("attributes.txt");
        let modified_at_ms = 1_900_000_000_000_u128;

        fs::create_dir_all(&root).expect("root dir");
        fs::write(&file, b"attributes").expect("file write");

        let attribute_result = change_file_attributes(ChangeAttributesRequest {
            path: file.display().to_string(),
            readonly: Some(true),
        })
        .expect("attribute change works");

        assert!(attribute_result.metadata.readonly);
        set_readonly(&file, false);

        let touch_result = touch_file(TouchFileRequest {
            path: file.display().to_string(),
            modified_at_ms,
        })
        .expect("touch works");

        assert_eq!(touch_result.metadata.modified_at_ms, Some(modified_at_ms));

        let _ = fs::remove_dir_all(root);
    }

    #[test]
    fn builds_folder_report_summary_and_side_by_side_rows() {
        let rows = vec![
            FolderAlignmentRow {
                relative_path: "same.txt".to_owned(),
                depth: 0,
                left: Some(FolderScanNode::new_file(
                    "same.txt",
                    "same.txt",
                    metadata(VfsEntryKind::File, "same.txt", Some("txt"), 10),
                )),
                right: Some(FolderScanNode::new_file(
                    "same.txt",
                    "same.txt",
                    metadata(VfsEntryKind::File, "same.txt", Some("txt"), 10),
                )),
            },
            FolderAlignmentRow {
                relative_path: "changed.txt".to_owned(),
                depth: 0,
                left: Some(FolderScanNode::new_file(
                    "changed.txt",
                    "changed.txt",
                    metadata(VfsEntryKind::File, "changed.txt", Some("txt"), 10),
                )),
                right: Some(FolderScanNode::new_file(
                    "changed.txt",
                    "changed.txt",
                    metadata(VfsEntryKind::File, "changed.txt", Some("txt"), 12),
                )),
            },
            FolderAlignmentRow {
                relative_path: "left-only.txt".to_owned(),
                depth: 0,
                left: Some(FolderScanNode::new_file(
                    "left-only.txt",
                    "left-only.txt",
                    metadata(VfsEntryKind::File, "left-only.txt", Some("txt"), 8),
                )),
                right: None,
            },
        ];

        let report = build_folder_report_model(&rows, &FolderCompareOptions::default(), false);

        assert_eq!(report.summary.total, 3);
        assert_eq!(report.summary.same, 1);
        assert_eq!(report.summary.different, 1);
        assert_eq!(report.summary.left_only, 1);
        assert_eq!(report.summary.right_only, 0);
        assert_eq!(report.rows.len(), 2);
        assert_eq!(report.rows[0].relative_path, "changed.txt");
        assert_eq!(report.rows[0].status, FolderCompareStatus::Different);
        assert_eq!(report.rows[0].left_size, Some(10));
        assert_eq!(report.rows[0].right_size, Some(12));
        assert_eq!(report.rows[1].status, FolderCompareStatus::LeftOnly);
    }

    #[test]
    fn renders_folder_report_as_escaped_html_with_file_links() {
        let report = FolderReportModel {
            summary: FolderReportSummary {
                total: 2,
                same: 0,
                different: 1,
                left_only: 1,
                right_only: 0,
                error: 0,
            },
            rows: vec![
                FolderReportRow {
                    relative_path: "src/<main>.rs".to_owned(),
                    depth: 1,
                    status: FolderCompareStatus::Different,
                    left_path: Some("left/src/<main>.rs".to_owned()),
                    right_path: Some("right/src/<main>.rs".to_owned()),
                    left_size: Some(10),
                    right_size: Some(12),
                    left_kind: Some(FolderNodeKind::File),
                    right_kind: Some(FolderNodeKind::File),
                },
                FolderReportRow {
                    relative_path: "notes.md".to_owned(),
                    depth: 0,
                    status: FolderCompareStatus::LeftOnly,
                    left_path: Some("left/notes.md".to_owned()),
                    right_path: None,
                    left_size: Some(8),
                    right_size: None,
                    left_kind: Some(FolderNodeKind::File),
                    right_kind: None,
                },
            ],
        };

        let html = render_folder_report_html(&report, "Release <Report>");

        assert!(html.contains("<title>Release &lt;Report&gt;</title>"));
        assert!(html.contains("Total: 2"));
        assert!(html.contains("Different: 1"));
        assert!(html.contains("src/&lt;main&gt;.rs"));
        assert!(html.contains("href=\"file://left/src/%3Cmain%3E.rs\""));
        assert!(html.contains("left only"));
    }

    #[test]
    fn renders_folder_report_as_xml_and_plain_text() {
        let report = FolderReportModel {
            summary: FolderReportSummary {
                total: 1,
                same: 0,
                different: 1,
                left_only: 0,
                right_only: 0,
                error: 0,
            },
            rows: vec![FolderReportRow {
                relative_path: "src/&main.rs".to_owned(),
                depth: 1,
                status: FolderCompareStatus::Different,
                left_path: Some("left/src/&main.rs".to_owned()),
                right_path: Some("right/src/&main.rs".to_owned()),
                left_size: Some(10),
                right_size: Some(12),
                left_kind: Some(FolderNodeKind::File),
                right_kind: Some(FolderNodeKind::File),
            }],
        };

        let xml = render_folder_report_xml(&report);
        let text = render_folder_report_text(&report, "Release Report");

        assert!(xml.contains("<folderReport"));
        assert!(xml.contains("relativePath=\"src/&amp;main.rs\""));
        assert!(xml.contains("status=\"different\""));
        assert!(text.contains("Release Report"));
        assert!(text.contains("Total: 1"));
        assert!(text.contains("different | src/&main.rs | left/src/&main.rs | right/src/&main.rs"));
    }

    #[test]
    fn file_filters_support_include_exclude_wildcards_and_paths() {
        let filters = FileFilters {
            include: vec!["src/**/*.rs".to_owned()],
            exclude: vec!["target/**".to_owned(), "*.tmp".to_owned()],
            case_sensitive: true,
        };

        assert!(filters.allows("src/main.rs"));
        assert!(filters.allows("src/bin/tool.rs"));
        assert!(!filters.allows("src/main.ts"));
        assert!(!filters.allows("target/debug/app.rs"));
        assert!(!filters.allows("notes.tmp"));
        assert!(!filters.allows("build/notes.tmp"));
    }

    #[test]
    fn filter_alignment_rows_keeps_matches_and_ancestors() {
        let filters = FileFilters {
            include: vec!["*.rs".to_owned()],
            exclude: Vec::new(),
            case_sensitive: true,
        };
        let rows = vec![
            FolderAlignmentRow {
                relative_path: "src".to_owned(),
                depth: 0,
                left: None,
                right: None,
            },
            FolderAlignmentRow {
                relative_path: "src/main.rs".to_owned(),
                depth: 1,
                left: None,
                right: None,
            },
            FolderAlignmentRow {
                relative_path: "src/main.ts".to_owned(),
                depth: 1,
                left: None,
                right: None,
            },
            FolderAlignmentRow {
                relative_path: "README.md".to_owned(),
                depth: 0,
                left: None,
                right: None,
            },
        ];

        let filtered = filter_alignment_rows(rows, &filters);
        let paths: Vec<_> = filtered
            .iter()
            .map(|row| row.relative_path.as_str())
            .collect();

        assert_eq!(paths, vec!["src", "src/main.rs"]);
    }

    fn metadata(kind: VfsEntryKind, name: &str, extension: Option<&str>, size: u64) -> VfsMetadata {
        metadata_with_modified_at(kind, name, extension, size, None)
    }

    fn metadata_with_modified_at(
        kind: VfsEntryKind,
        name: &str,
        extension: Option<&str>,
        size: u64,
        modified_at_ms: Option<u128>,
    ) -> VfsMetadata {
        VfsMetadata {
            kind,
            name: name.to_owned(),
            extension: extension.map(ToOwned::to_owned),
            size,
            readonly: false,
            created_at_ms: None,
            modified_at_ms,
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

    fn set_readonly(path: &std::path::Path, readonly: bool) {
        let mut permissions = fs::metadata(path)
            .expect("metadata should be readable")
            .permissions();

        permissions.set_readonly(readonly);
        fs::set_permissions(path, permissions).expect("permissions should update");
    }
}
