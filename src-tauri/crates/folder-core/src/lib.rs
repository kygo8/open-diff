use serde::{Deserialize, Serialize};
use std::collections::BTreeMap;
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
}

impl Default for FolderCompareOptions {
    fn default() -> Self {
        Self {
            compare_size: true,
            compare_modified_time: false,
            case_sensitive_names: true,
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
        let included = self.include.is_empty()
            || self
                .include
                .iter()
                .any(|pattern| wildcard_matches(&filter_path(pattern, self.case_sensitive), &path));
        let excluded = self
            .exclude
            .iter()
            .any(|pattern| wildcard_matches(&filter_path(pattern, self.case_sensitive), &path));

        included && !excluded
    }
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

fn folder_metadata_matches(
    left: &FolderScanNode,
    right: &FolderScanNode,
    options: &FolderCompareOptions,
) -> bool {
    left.kind == right.kind
        && (!options.compare_size || left.metadata.size == right.metadata.size)
        && (!options.compare_modified_time
            || left.metadata.modified_at_ms == right.metadata.modified_at_ms)
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
                },
            ),
            FolderCompareStatus::Same
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
            },
        );
        let sensitive = align_folder_trees_with_options(
            &left,
            &right,
            &FolderCompareOptions {
                compare_size: true,
                compare_modified_time: false,
                case_sensitive_names: true,
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
