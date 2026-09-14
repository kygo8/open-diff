use file_core::FileReadError;
use folder_core::{
    FolderAlignmentRow, FolderCompareStatus, FolderNodeKind, FolderScanError, FolderScanNode,
};
use image_core::{
    DecodedImage, ImageDecodeError, ImageFormat, ImageMetadata, ImageRect, PixelDiffError,
};
use media_core::{
    AudioCodec, MediaCodec, MediaContainer, MediaDiffStatistics, MediaDocument, MediaFieldStatus,
    MediaReadError, MediaStream, VideoCodec,
};
use serde::{Deserialize, Serialize};
use shared_types::{
    AppErrorCode, AppErrorPayload, FileStamp, ReadTextFileResponse, SaveTextFileResponse,
    TextDiffRequest, TextDiffResponse, TextPatchResponse,
};
use std::collections::{BTreeMap, BTreeSet};
use std::fs;
use std::fs::File;
use std::io::{Read, Seek, SeekFrom};
use std::path::{Component, Path, PathBuf};
use table_core::{
    ColumnMapping, ColumnMappingSource, RowAlignmentOptions, TableCellValue, TableDiffStatus,
    TableParseError, TableSheet, TableWorkbook,
};
#[cfg(any(windows, test))]
use version_core::{
    NativeVersionInfoReader, VersionDiffStatistics, VersionDocument, VersionFieldStatus,
    VersionFileType, VersionReadError, VersionTargetOs,
};

#[derive(Debug, Clone, Serialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct TableCompareColumn {
    pub name: String,
    pub side: String,
}

#[derive(Debug, Clone, Serialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct TableCompareColumnMapping {
    pub left_column: Option<String>,
    pub right_column: Option<String>,
    pub source: String,
}

#[derive(Debug, Clone, Serialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct TableCompareRow {
    pub index: usize,
    pub left_cells: Vec<String>,
    pub right_cells: Vec<String>,
    pub status: String,
}

#[derive(Debug, Clone, Serialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct TableCompareChangedCell {
    pub row_index: usize,
    pub column_index: usize,
    pub left_value: Option<String>,
    pub right_value: Option<String>,
    pub status: String,
}

#[derive(Debug, Clone, Serialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct TableCompareSummary {
    pub row_count: usize,
    pub changed_row_count: usize,
    pub changed_cell_count: usize,
}

#[derive(Debug, Clone, Serialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct TableCompareResponse {
    pub left_columns: Vec<TableCompareColumn>,
    pub right_columns: Vec<TableCompareColumn>,
    pub column_mappings: Vec<TableCompareColumnMapping>,
    pub rows: Vec<TableCompareRow>,
    pub changed_cells: Vec<TableCompareChangedCell>,
    pub summary: TableCompareSummary,
    pub left_sheets: Vec<String>,
    pub right_sheets: Vec<String>,
    pub left_sheet: String,
    pub right_sheet: String,
}

#[derive(Debug, Clone, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct TableManualColumnMapping {
    pub left_column: Option<String>,
    pub right_column: Option<String>,
}

#[derive(Debug, Clone, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct TextMergeConflictRow {
    pub line_index: usize,
    pub title: String,
    pub base: String,
    pub left: String,
    pub right: String,
    pub output_span: usize,
}

#[derive(Debug, Clone, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct TextMergeCommandResponse {
    pub left_path: String,
    pub right_path: String,
    pub center_path: Option<String>,
    pub output_path: Option<String>,
    pub left_text: String,
    pub right_text: String,
    pub center_text: String,
    pub output_text: String,
    pub conflicts: Vec<TextMergeConflictRow>,
}

#[derive(Debug, Clone, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct ExportReportResponse {
    pub format: String,
    pub content: String,
    pub output_path: Option<String>,
    pub bytes_written: Option<u64>,
}

#[derive(Debug, Clone, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct ApplyTextPatchResponse {
    pub text: String,
    pub applied_hunks: usize,
    pub files: usize,
}

#[derive(Debug, Clone, Serialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct MediaCompareResponse {
    pub left: MediaSideSummary,
    pub right: MediaSideSummary,
    pub fields: Vec<MediaFieldRow>,
    pub summary: MediaCompareSummary,
}

#[derive(Debug, Clone, Serialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct MediaSideSummary {
    pub name: String,
    pub container: String,
    pub duration: String,
    pub stream: MediaStreamSummary,
}

#[derive(Debug, Clone, Serialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct MediaStreamSummary {
    pub codec: String,
    pub sample_rate: String,
    pub channels: String,
    pub bitrate: String,
}

#[derive(Debug, Clone, Serialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct MediaFieldRow {
    pub field: String,
    pub left: Option<String>,
    pub right: Option<String>,
    pub status: String,
}

#[derive(Debug, Clone, Serialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct MediaCompareSummary {
    pub added: u32,
    pub removed: u32,
    pub modified: u32,
    pub unchanged: u32,
}

#[derive(Debug, Clone, Serialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct HexCompareResponse {
    pub left: HexSideWindow,
    pub right: HexSideWindow,
    pub diff_ranges: Vec<hex_core::BinaryDiffRange>,
    pub summary: HexCompareSummary,
}

#[derive(Debug, Clone, Serialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct HexSideWindow {
    pub path: String,
    pub total_len: u64,
    pub cells: Vec<hex_core::HexViewCell>,
}

#[derive(Debug, Clone, Serialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct HexCompareSummary {
    pub left_bytes: u64,
    pub right_bytes: u64,
    pub different_ranges: usize,
}

#[derive(Debug, Clone, Serialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct PictureCompareResponse {
    pub left: PictureSideSummary,
    pub right: PictureSideSummary,
    pub statistics: PictureCompareStatistics,
    pub metadata_rows: Vec<PictureMetadataRow>,
}

#[derive(Debug, Clone, Serialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct PictureSideSummary {
    pub path: String,
    pub name: String,
    pub format: String,
    pub dimensions: String,
    pub color_depth: String,
}

#[derive(Debug, Clone, Serialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct PictureCompareStatistics {
    pub total_pixels: u64,
    pub different_pixels: u64,
    pub difference_ratio: f64,
    pub bounding_rect: Option<ImageRect>,
}

#[derive(Debug, Clone, Serialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct PictureMetadataRow {
    pub key: String,
    pub label: String,
    pub left: String,
    pub right: String,
    pub status: String,
}

#[derive(Debug, Clone, Serialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct RegistryCompareResponse {
    pub left_name: String,
    pub right_name: String,
    pub tree: Vec<RegistryKeyNode>,
    pub summary: RegistryCompareSummary,
}

#[derive(Debug, Clone, Serialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct RegistryKeyNode {
    pub path: String,
    pub label: String,
    pub status: String,
    pub values: Vec<RegistryValueRow>,
    pub children: Vec<RegistryKeyNode>,
}

#[derive(Debug, Clone, Serialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct RegistryValueRow {
    pub key_path: String,
    pub name: String,
    pub status: String,
    pub left: Option<RegistryValueSide>,
    pub right: Option<RegistryValueSide>,
}

#[derive(Debug, Clone, Serialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct RegistryValueSide {
    pub kind: String,
    pub data: String,
}

#[derive(Debug, Clone, Serialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct RegistryCompareSummary {
    pub added: u32,
    pub removed: u32,
    pub modified: u32,
    pub unchanged: u32,
}

#[derive(Debug, Clone, Serialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct VersionCompareResponse {
    pub left: VersionSideSummary,
    pub right: VersionSideSummary,
    pub fields: Vec<VersionFieldRow>,
    pub summary: VersionCompareSummary,
}

#[derive(Debug, Clone, Serialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct VersionSideSummary {
    pub name: String,
    pub file_type: String,
    pub target_os: String,
    pub file_version: String,
    pub product_version: String,
}

#[derive(Debug, Clone, Serialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct VersionFieldRow {
    pub field: String,
    pub group: String,
    pub left: Option<String>,
    pub right: Option<String>,
    pub status: String,
}

#[derive(Debug, Clone, Serialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct VersionCompareSummary {
    pub added: u32,
    pub removed: u32,
    pub modified: u32,
    pub unchanged: u32,
}

#[derive(Debug, Clone, Serialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct FolderCompareResponse {
    pub left_root: String,
    pub right_root: String,
    pub rows: Vec<FolderCompareRow>,
    pub summary: FolderCompareSummary,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct FolderCompareCriteria {
    pub compare_size: bool,
    pub compare_modified_time: bool,
    pub compare_contents: bool,
    pub compare_crc: bool,
    /// Compare readonly attributes; attribute-only diffs surface as Minor.
    #[serde(default)]
    pub compare_attributes: bool,
    /// Size-only metadata diffs surface as Minor when enabled.
    #[serde(default)]
    pub size_only_unimportant: bool,
    #[serde(default)]
    pub follow_symlinks: bool,
    /// Allowed absolute modified-time skew in milliseconds.
    #[serde(default)]
    pub timestamp_tolerance_ms: u128,
    /// Treat a one-hour modified-time skew as equal (DST / clock skew).
    #[serde(default)]
    pub ignore_daylight_saving_hour_offset: bool,
}

impl Default for FolderCompareCriteria {
    fn default() -> Self {
        Self {
            compare_size: true,
            compare_modified_time: false,
            compare_contents: true,
            compare_crc: false,
            compare_attributes: false,
            size_only_unimportant: false,
            follow_symlinks: false,
            timestamp_tolerance_ms: 0,
            ignore_daylight_saving_hour_offset: false,
        }
    }
}

impl FolderCompareCriteria {
    fn to_options(&self) -> folder_core::FolderCompareOptions {
        folder_core::FolderCompareOptions {
            compare_size: self.compare_size,
            compare_modified_time: self.compare_modified_time,
            case_sensitive_names: true,
            compare_contents: self.compare_contents,
            compare_crc: self.compare_crc,
            compare_attributes: self.compare_attributes,
            size_only_unimportant: self.size_only_unimportant,
            follow_symlinks: self.follow_symlinks,
            timestamp_tolerance_ms: self.timestamp_tolerance_ms,
            ignore_daylight_saving_hour_offset: self.ignore_daylight_saving_hour_offset,
            ..Default::default()
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq, Default)]
#[serde(rename_all = "camelCase")]
pub struct FolderNameFilters {
    #[serde(default)]
    pub include: Vec<String>,
    #[serde(default)]
    pub exclude: Vec<String>,
    #[serde(default)]
    pub case_sensitive: bool,
}

impl FolderNameFilters {
    fn to_file_filters(&self) -> folder_core::FileFilters {
        folder_core::FileFilters {
            include: self.include.clone(),
            exclude: self.exclude.clone(),
            case_sensitive: self.case_sensitive,
        }
    }

    fn is_active(&self) -> bool {
        !self.include.is_empty() || !self.exclude.is_empty()
    }
}

#[derive(Debug, Clone, Serialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct FolderCompareRow {
    pub relative_path: String,
    pub depth: usize,
    pub status: String,
    /// Timestamp/attribute-only (or equivalent) difference — surfaces under Folder Compare Minor.
    #[serde(default)]
    pub unimportant: bool,
    pub left: Option<FolderCompareSideEntry>,
    pub right: Option<FolderCompareSideEntry>,
}

#[derive(Debug, Clone, Serialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct FolderCompareSideEntry {
    pub name: String,
    pub kind: String,
    pub size: u64,
    pub modified_at_ms: Option<u128>,
    pub path: String,
}

#[derive(Debug, Clone, Default, Serialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct FolderCompareSummary {
    pub total: usize,
    pub same: usize,
    pub different: usize,
    pub left_only: usize,
    pub right_only: usize,
}

#[derive(Debug, Clone, Serialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct FolderSyncPreviewResponse {
    pub name: String,
    pub left_root: String,
    pub right_root: String,
    pub strategy: String,
    pub rows: Vec<FolderSyncPreviewRow>,
    pub summary: FolderSyncPreviewSummary,
}

#[derive(Debug, Clone, Serialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct FolderSyncPreviewRow {
    pub id: String,
    pub relative_path: String,
    pub action: String,
    pub source_path: Option<String>,
    pub target_path: Option<String>,
    pub detail: String,
}

#[derive(Debug, Clone, Default, Serialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct FolderSyncPreviewSummary {
    pub total: usize,
    pub copy: usize,
    pub delete: usize,
    pub leave: usize,
    pub conflict: usize,
}

#[derive(Debug, Clone, Serialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct FolderSyncExecutionResponse {
    pub name: String,
    pub left_root: String,
    pub right_root: String,
    pub strategy: String,
    pub total: usize,
    pub succeeded: usize,
    pub failed: usize,
    pub cancelled: usize,
    pub logs: Vec<sync_core::SyncExecutionLogEntry>,
}

#[derive(Debug, Clone, Serialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct FolderMergePlanResponse {
    pub left_root: String,
    pub base_root: String,
    pub right_root: String,
    pub output_root: String,
    pub rows: Vec<FolderMergePlanRow>,
    pub summary: FolderMergePlanSummary,
}

#[derive(Debug, Clone, Serialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct FolderMergePlanRow {
    pub id: String,
    pub path: String,
    pub base: FolderMergeSideEntry,
    pub left: FolderMergeSideEntry,
    pub right: FolderMergeSideEntry,
    pub action: String,
    pub detail: String,
    pub conflict: Option<FolderMergeConflictDetail>,
}

#[derive(Debug, Clone, Serialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct FolderMergeSideEntry {
    pub role: String,
    pub kind: String,
    pub size: Option<String>,
    pub modified: Option<String>,
}

#[derive(Debug, Clone, Serialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct FolderMergeConflictDetail {
    pub path: String,
    pub reason: String,
    pub base_context: String,
    pub left_context: String,
    pub right_context: String,
}

#[derive(Debug, Clone, Default, Serialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct FolderMergePlanSummary {
    pub actions: usize,
    pub automatic: usize,
    pub conflicts: usize,
}

#[derive(Debug, Clone, Serialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct FolderMergeExecutionResponse {
    pub left_root: String,
    pub base_root: String,
    pub right_root: String,
    pub output_root: String,
    pub rows: Vec<FolderMergeExecutionRow>,
    pub summary: FolderMergeExecutionSummary,
}

#[derive(Debug, Clone, Serialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct FolderMergeExecutionRow {
    pub path: String,
    pub action: String,
    pub status: FolderMergeExecutionStatus,
    pub detail: String,
}

#[derive(Debug, Clone, Copy, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub enum FolderMergeExecutionStatus {
    Executed,
    Skipped,
    Conflict,
    Failed,
}

#[derive(Debug, Clone, Default, Serialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct FolderMergeExecutionSummary {
    pub total: usize,
    pub executed: usize,
    pub skipped: usize,
    pub conflicts: usize,
    pub failed: usize,
}

#[tauri::command]
pub fn diff_text(
    left: String,
    right: String,
    algorithm: Option<String>,
    ignore_whitespace: Option<bool>,
    ignore_case: Option<bool>,
    ignore_line_endings: Option<bool>,
    ignore_regexes: Option<Vec<String>>,
) -> TextDiffResponse {
    let request = TextDiffRequest {
        left,
        right,
        algorithm,
        ignore_whitespace: ignore_whitespace.unwrap_or(false),
        ignore_case: ignore_case.unwrap_or(false),
        ignore_line_endings: ignore_line_endings.unwrap_or(false),
        ignore_regexes: ignore_regexes.unwrap_or_default(),
    };
    diff_core::diff_text(&request)
}

#[tauri::command]
pub fn parse_text_patch(input: String) -> TextPatchResponse {
    diff_core::parse_text_patch(&input)
}

#[tauri::command]
pub fn compare_table_csv(
    left: String,
    right: String,
) -> Result<TableCompareResponse, AppErrorPayload> {
    compare_table(
        left, right, None, None, None, None, None, None, None, None, None,
    )
}

#[tauri::command]
#[allow(clippy::too_many_arguments)]
pub fn compare_table(
    left: String,
    right: String,
    format: Option<String>,
    left_path: Option<String>,
    right_path: Option<String>,
    left_sheet: Option<String>,
    right_sheet: Option<String>,
    key_column_indices: Option<Vec<usize>>,
    ignored_columns: Option<Vec<String>>,
    manual_mappings: Option<Vec<TableManualColumnMapping>>,
    delimiter: Option<String>,
) -> Result<TableCompareResponse, AppErrorPayload> {
    let left_workbook = load_table_workbook(
        &left,
        left_path.as_deref(),
        format.as_deref(),
        delimiter.as_deref(),
    )?;
    let right_workbook = load_table_workbook(
        &right,
        right_path.as_deref(),
        format.as_deref(),
        delimiter.as_deref(),
    )?;
    let left_sheet_names = workbook_sheet_names(&left_workbook);
    let right_sheet_names = workbook_sheet_names(&right_workbook);
    let (left_sheet, right_sheet) = resolve_compared_table_sheets(
        &left_workbook,
        &right_workbook,
        left_sheet.as_deref(),
        right_sheet.as_deref(),
    )?;
    let mut column_mappings = table_core::map_columns(
        left_sheet,
        right_sheet,
        &table_core::ColumnMappingOptions {
            case_sensitive: false,
            ignore_whitespace: true,
        },
    );
    apply_manual_table_mappings(
        &mut column_mappings,
        left_sheet,
        right_sheet,
        &manual_mappings,
    );
    if let Some(ignored) = ignored_columns.as_ref() {
        column_mappings.retain(|mapping| {
            !column_name_ignored(mapping.left_column.as_deref(), ignored)
                && !column_name_ignored(mapping.right_column.as_deref(), ignored)
        });
    }
    let projected_left = project_table_sheet(left_sheet, &column_mappings, true);
    let projected_right = project_table_sheet(right_sheet, &column_mappings, false);
    let alignments = table_core::align_rows_by_key_columns(
        &projected_left,
        &projected_right,
        &RowAlignmentOptions {
            key_column_indices: key_column_indices.unwrap_or_else(|| vec![0]),
            case_sensitive: false,
        },
    );
    let row_diffs =
        table_core::compare_aligned_rows(&projected_left, &projected_right, &alignments);
    let changed_cells = row_diffs
        .iter()
        .flat_map(|row| {
            row.cells
                .iter()
                .filter(|cell| cell.status != TableDiffStatus::Same)
                .map(|cell| TableCompareChangedCell {
                    row_index: row.row_index,
                    column_index: cell.column_index,
                    left_value: cell.left.as_ref().map(table_cell_value_to_text),
                    right_value: cell.right.as_ref().map(table_cell_value_to_text),
                    status: table_diff_status_label(&cell.status),
                })
        })
        .collect::<Vec<_>>();
    let changed_row_count = row_diffs
        .iter()
        .filter(|row| row.status != TableDiffStatus::Same)
        .count();

    Ok(TableCompareResponse {
        left_columns: projected_left
            .columns
            .iter()
            .map(|column| TableCompareColumn {
                name: column.name.clone(),
                side: "left".to_owned(),
            })
            .collect(),
        right_columns: projected_right
            .columns
            .iter()
            .map(|column| TableCompareColumn {
                name: column.name.clone(),
                side: "right".to_owned(),
            })
            .collect(),
        column_mappings: column_mappings
            .into_iter()
            .map(|mapping| TableCompareColumnMapping {
                left_column: mapping.left_column,
                right_column: mapping.right_column,
                source: column_mapping_source_label(&mapping.source),
            })
            .collect(),
        rows: row_diffs
            .iter()
            .map(|row| TableCompareRow {
                index: row.row_index,
                left_cells: row
                    .cells
                    .iter()
                    .map(|cell| {
                        cell.left
                            .as_ref()
                            .map(table_cell_value_to_text)
                            .unwrap_or_default()
                    })
                    .collect(),
                right_cells: row
                    .cells
                    .iter()
                    .map(|cell| {
                        cell.right
                            .as_ref()
                            .map(table_cell_value_to_text)
                            .unwrap_or_default()
                    })
                    .collect(),
                status: table_diff_status_label(&row.status),
            })
            .collect(),
        changed_cells,
        summary: TableCompareSummary {
            row_count: row_diffs.len(),
            changed_row_count,
            changed_cell_count: row_diffs
                .iter()
                .flat_map(|row| row.cells.iter())
                .filter(|cell| cell.status != TableDiffStatus::Same)
                .count(),
        },
        left_sheets: left_sheet_names,
        right_sheets: right_sheet_names,
        left_sheet: left_sheet.name.clone(),
        right_sheet: right_sheet.name.clone(),
    })
}

#[tauri::command]
pub fn compare_folder_paths(
    left_root: String,
    right_root: String,
    criteria: Option<FolderCompareCriteria>,
    filters: Option<FolderNameFilters>,
) -> Result<FolderCompareResponse, AppErrorPayload> {
    let criteria = criteria.unwrap_or_default();
    let options = criteria.to_options();
    let name_filters = filters.unwrap_or_default();
    let left_source = crate::sources::load_compare_source(&left_root)
        .map_err(|error| compare_source_error(&left_root, error))?;
    let right_source = crate::sources::load_compare_source(&right_root)
        .map_err(|error| compare_source_error(&right_root, error))?;
    let left_tree =
        crate::sources::scan_compare_source_with_options(&left_source, options.follow_symlinks)
            .map_err(|error| compare_source_error(&left_root, error))?;
    let right_tree =
        crate::sources::scan_compare_source_with_options(&right_source, options.follow_symlinks)
            .map_err(|error| compare_source_error(&right_root, error))?;
    let alignment_rows =
        folder_core::align_folder_trees_with_options(&left_tree, &right_tree, &options);
    let alignment_rows = if name_filters.is_active() {
        folder_core::filter_alignment_rows(alignment_rows, &name_filters.to_file_filters())
    } else {
        alignment_rows
    };
    let rows = alignment_rows
        .iter()
        .map(|row| {
            folder_compare_row(
                row,
                &left_source,
                &right_source,
                &left_root,
                &right_root,
                &criteria,
            )
        })
        .collect::<Result<Vec<_>, _>>()?;
    let mut summary = FolderCompareSummary {
        total: rows.len(),
        ..FolderCompareSummary::default()
    };

    for row in &rows {
        increment_folder_summary(&mut summary, &row.status);
    }

    Ok(FolderCompareResponse {
        left_root,
        right_root,
        rows,
        summary,
    })
}

#[tauri::command]
pub fn copy_folder_compare_entry(
    left_root: String,
    right_root: String,
    relative_path: String,
    direction: folder_core::CopyDirection,
) -> Result<folder_core::CopySideResult, AppErrorPayload> {
    validate_folder_relative_path(&relative_path)?;
    let left_path = side_path(&left_root, &relative_path);
    let right_path = side_path(&right_root, &relative_path);

    let left_source = crate::sources::load_compare_source(&left_root).map_err(|error| {
        AppErrorPayload::new(AppErrorCode::Unknown, "error.app.unknown.title", error)
            .with_param("path", &left_root)
    })?;
    let right_source = crate::sources::load_compare_source(&right_root).map_err(|error| {
        AppErrorPayload::new(AppErrorCode::Unknown, "error.app.unknown.title", error)
            .with_param("path", &right_root)
    })?;

    let (source, target, source_path, target_path) = match direction {
        folder_core::CopyDirection::ToLeft => (
            &right_source,
            &left_source,
            right_path.clone(),
            left_path.clone(),
        ),
        folder_core::CopyDirection::ToRight => (
            &left_source,
            &right_source,
            left_path.clone(),
            right_path.clone(),
        ),
    };

    match (source, target) {
        (crate::sources::CompareSource::Local(_), crate::sources::CompareSource::Local(_)) => {
            folder_core::copy_between_sides(folder_core::CopySideRequest {
                direction,
                left_path,
                right_path,
            })
            .map_err(|error| folder_scan_error(&relative_path, error))
        }
        (
            crate::sources::CompareSource::Archive(_),
            crate::sources::CompareSource::Local(target_root),
        ) => extract_archive_entry_to_folder(
            source,
            target_root.as_path(),
            &relative_path,
            direction,
            source_path,
            target_path,
        ),
        (_, crate::sources::CompareSource::Archive(_))
        | (_, crate::sources::CompareSource::Snapshot(_)) => Err(AppErrorPayload::new(
            AppErrorCode::Unknown,
            "error.app.unknown.title",
            format!("cannot copy into archive or snapshot side: {target_path}"),
        )
        .with_param("path", &target_path)),
        (crate::sources::CompareSource::Snapshot(_), _) => Err(AppErrorPayload::new(
            AppErrorCode::Unknown,
            "error.app.unknown.title",
            format!("cannot copy from snapshot side: {source_path}"),
        )
        .with_param("path", &source_path)),
    }
}

fn extract_archive_entry_to_folder(
    source: &crate::sources::CompareSource,
    target_root: &Path,
    relative_path: &str,
    direction: folder_core::CopyDirection,
    source_path: String,
    target_path: String,
) -> Result<folder_core::CopySideResult, AppErrorPayload> {
    let bytes = crate::sources::read_compare_file(source, relative_path).map_err(|error| {
        AppErrorPayload::new(AppErrorCode::Unknown, "error.app.unknown.title", error)
            .with_param("path", &source_path)
    })?;

    let destination = if relative_path.is_empty() {
        target_root.to_path_buf()
    } else {
        target_root.join(relative_path)
    };

    if let Some(parent) = destination.parent() {
        fs::create_dir_all(parent).map_err(|error| {
            AppErrorPayload::new(
                AppErrorCode::FileWriteFailed,
                "error.app.unknown.title",
                error.to_string(),
            )
            .with_param("path", destination.display().to_string())
        })?;
    }

    fs::write(&destination, &bytes).map_err(|error| {
        AppErrorPayload::new(
            AppErrorCode::FileWriteFailed,
            "error.app.unknown.title",
            error.to_string(),
        )
        .with_param("path", destination.display().to_string())
    })?;

    let written = fs::read(&destination).map_err(|error| {
        AppErrorPayload::new(
            AppErrorCode::Unknown,
            "error.app.unknown.title",
            error.to_string(),
        )
        .with_param("path", destination.display().to_string())
    })?;
    let refreshed_status = if written == bytes {
        folder_core::FolderCompareStatus::Same
    } else {
        folder_core::FolderCompareStatus::Different
    };

    let name = destination
        .file_name()
        .map(|value| value.to_string_lossy().into_owned())
        .unwrap_or_else(|| relative_path.to_owned());
    let extension = destination
        .extension()
        .map(|value| value.to_string_lossy().into_owned());

    Ok(folder_core::CopySideResult {
        direction,
        source_path,
        target_path,
        target_metadata: vfs_core::VfsMetadata {
            kind: vfs_core::VfsEntryKind::File,
            name,
            extension,
            size: written.len() as u64,
            readonly: false,
            created_at_ms: None,
            modified_at_ms: None,
            accessed_at_ms: None,
        },
        refreshed_status,
    })
}

#[tauri::command]
pub fn rename_folder_entry(
    path: String,
    new_name: String,
) -> Result<folder_core::FileOperationResult, AppErrorPayload> {
    let error_path = path.clone();

    folder_core::perform_file_operation(folder_core::FileOperationRequest::Rename {
        path,
        new_name,
    })
    .map_err(|error| folder_scan_error(&error_path, error))
}

#[tauri::command]
pub fn delete_folder_entry(
    path: String,
) -> Result<folder_core::FileOperationResult, AppErrorPayload> {
    let error_path = path.clone();

    folder_core::perform_file_operation(folder_core::FileOperationRequest::Delete { path })
        .map_err(|error| folder_scan_error(&error_path, error))
}

#[tauri::command]
pub fn change_folder_entry_attributes(
    path: String,
    readonly: Option<bool>,
) -> Result<folder_core::FileMetadataUpdateResult, AppErrorPayload> {
    let error_path = path.clone();

    folder_core::change_file_attributes(folder_core::ChangeAttributesRequest { path, readonly })
        .map_err(|error| folder_scan_error(&error_path, error))
}

#[tauri::command]
pub fn touch_folder_entry(
    path: String,
    modified_at_ms: u128,
) -> Result<folder_core::FileMetadataUpdateResult, AppErrorPayload> {
    let error_path = path.clone();

    folder_core::touch_file(folder_core::TouchFileRequest {
        path,
        modified_at_ms,
    })
    .map_err(|error| folder_scan_error(&error_path, error))
}

#[tauri::command]
pub fn preview_folder_sync(
    left_root: String,
    right_root: String,
    strategy: String,
) -> Result<FolderSyncPreviewResponse, AppErrorPayload> {
    let cancellation_token = job_core::CancellationToken::default();
    let left_tree = folder_core::scan_local_folder(&left_root, &cancellation_token)
        .map_err(|error| folder_scan_error(&left_root, error))?;
    let right_tree = folder_core::scan_local_folder(&right_root, &cancellation_token)
        .map_err(|error| folder_scan_error(&right_root, error))?;
    let alignment_rows = folder_core::align_folder_trees(&left_tree, &right_tree);
    let plan = folder_sync_plan(&left_root, &right_root, &strategy, &alignment_rows)?;
    let rows = plan
        .items
        .iter()
        .map(folder_sync_preview_row)
        .collect::<Vec<_>>();
    let mut summary = FolderSyncPreviewSummary {
        total: rows.len(),
        ..FolderSyncPreviewSummary::default()
    };

    for row in &rows {
        increment_folder_sync_summary(&mut summary, &row.action);
    }

    Ok(FolderSyncPreviewResponse {
        name: plan.name,
        left_root,
        right_root,
        strategy,
        rows,
        summary,
    })
}

#[tauri::command]
pub fn execute_folder_sync(
    left_root: String,
    right_root: String,
    strategy: String,
    overrides: Option<Vec<sync_core::SyncActionOverride>>,
) -> Result<FolderSyncExecutionResponse, AppErrorPayload> {
    let cancellation_token = job_core::CancellationToken::default();
    let left_tree = folder_core::scan_local_folder(&left_root, &cancellation_token)
        .map_err(|error| folder_scan_error(&left_root, error))?;
    let right_tree = folder_core::scan_local_folder(&right_root, &cancellation_token)
        .map_err(|error| folder_scan_error(&right_root, error))?;
    let alignment_rows = folder_core::align_folder_trees(&left_tree, &right_tree);
    let mut plan = folder_sync_plan(&left_root, &right_root, &strategy, &alignment_rows)?;
    if let Some(overrides) = overrides {
        plan = sync_core::apply_sync_overrides(plan, &left_root, &right_root, &overrides);
    }
    let execution = execute_local_folder_sync_plan(&plan);

    Ok(FolderSyncExecutionResponse {
        name: plan.name,
        left_root,
        right_root,
        strategy,
        total: execution.total,
        succeeded: execution.succeeded,
        failed: execution.failed,
        cancelled: execution.cancelled,
        logs: execution.logs,
    })
}

#[tauri::command]
pub fn build_folder_merge_plan(
    left_root: String,
    base_root: String,
    right_root: String,
    output_root: String,
) -> Result<FolderMergePlanResponse, AppErrorPayload> {
    let document = folder_merge_document(&left_root, &base_root, &right_root, &output_root)?;
    let rows = folder_merge_rows(&document);
    let conflicts = rows.iter().filter(|row| row.conflict.is_some()).count();

    Ok(FolderMergePlanResponse {
        left_root,
        base_root,
        right_root,
        output_root,
        summary: FolderMergePlanSummary {
            actions: rows.len(),
            automatic: rows.len().saturating_sub(conflicts),
            conflicts,
        },
        rows,
    })
}

#[tauri::command]
pub fn execute_folder_merge_plan(
    left_root: String,
    base_root: String,
    right_root: String,
    output_root: String,
) -> Result<FolderMergeExecutionResponse, AppErrorPayload> {
    let document = folder_merge_document(&left_root, &base_root, &right_root, &output_root)?;
    let plan = folder_merge_core::build_folder_merge_plan(&document);

    fs::create_dir_all(&output_root).map_err(|error| file_io_error(&output_root, error))?;

    let rows = plan
        .actions
        .iter()
        .map(|action| {
            execute_folder_merge_action(action, &left_root, &base_root, &right_root, &output_root)
        })
        .collect::<Vec<_>>();
    let summary = summarize_folder_merge_execution(&rows);

    Ok(FolderMergeExecutionResponse {
        left_root,
        base_root,
        right_root,
        output_root,
        rows,
        summary,
    })
}

#[tauri::command]
pub fn compare_media_files(
    left_path: String,
    right_path: String,
) -> Result<MediaCompareResponse, AppErrorPayload> {
    let left_document = read_media_path(&left_path)?;
    let right_document = read_media_path(&right_path)?;
    let diff = media_core::compare_media_documents(&left_document, &right_document);

    Ok(MediaCompareResponse {
        left: media_side_summary(&left_document),
        right: media_side_summary(&right_document),
        fields: diff
            .fields
            .into_iter()
            .map(|field| MediaFieldRow {
                field: field.field,
                left: field.left,
                right: field.right,
                status: media_field_status_label(field.status),
            })
            .collect(),
        summary: media_compare_summary(diff.statistics),
    })
}

#[derive(Debug, Deserialize)]
#[serde(untagged)]
pub enum HexOffsetArg {
    Unsigned(u64),
    Signed(i64),
    Float(f64),
    Text(String),
}

fn parse_hex_offset_arg(value: Option<HexOffsetArg>) -> Result<u64, AppErrorPayload> {
    match value {
        None => Ok(0),
        Some(HexOffsetArg::Unsigned(number)) => Ok(number),
        Some(HexOffsetArg::Signed(number)) => {
            if number < 0 {
                return Err(AppErrorPayload::new(
                    AppErrorCode::Unknown,
                    "error.generic.message",
                    "hex offset out of range",
                ));
            }
            Ok(number as u64)
        }
        Some(HexOffsetArg::Float(float)) => {
            if !float.is_finite() || float < 0.0 || float > u64::MAX as f64 {
                return Err(AppErrorPayload::new(
                    AppErrorCode::Unknown,
                    "error.generic.message",
                    "hex offset out of range",
                ));
            }
            Ok(float as u64)
        }
        Some(HexOffsetArg::Text(raw)) => {
            let trimmed = raw.trim();
            if trimmed.is_empty() {
                return Ok(0);
            }
            let parsed = if let Some(hex) = trimmed
                .strip_prefix("0x")
                .or_else(|| trimmed.strip_prefix("0X"))
            {
                u64::from_str_radix(hex, 16)
            } else if let Some(hex) = trimmed
                .strip_suffix('h')
                .or_else(|| trimmed.strip_suffix('H'))
            {
                u64::from_str_radix(hex, 16)
            } else {
                trimmed.parse::<u64>()
            };
            parsed.map_err(|error| {
                AppErrorPayload::new(
                    AppErrorCode::Unknown,
                    "error.generic.message",
                    format!("invalid hex offset: {error}"),
                )
            })
        }
    }
}

#[tauri::command]
pub fn compare_hex_files(
    left_path: String,
    right_path: String,
    offset: Option<HexOffsetArg>,
    length: Option<usize>,
) -> Result<HexCompareResponse, AppErrorPayload> {
    let offset = parse_hex_offset_arg(offset)?;
    let length = length.unwrap_or(256);
    let left_len = file_len(&left_path)?;
    let right_len = file_len(&right_path)?;
    let left_bytes = read_file_window(&left_path, offset, length)?;
    let right_bytes = read_file_window(&right_path, offset, length)?;
    let window_diff = hex_core::scan_binary_differences(&left_bytes, &right_bytes);
    let left_window =
        hex_core::build_hex_view_window(&left_bytes, 0, left_bytes.len(), Some(&window_diff));
    let right_window =
        hex_core::build_hex_view_window(&right_bytes, 0, right_bytes.len(), Some(&window_diff));
    let left_cells = shift_hex_cells(left_window.cells, offset);
    let right_cells = shift_hex_cells(right_window.cells, offset);
    let diff_ranges = shift_binary_diff_ranges(window_diff.ranges, offset);
    let different_ranges = diff_ranges.len();

    Ok(HexCompareResponse {
        left: HexSideWindow {
            path: left_path,
            total_len: left_len,
            cells: left_cells,
        },
        right: HexSideWindow {
            path: right_path,
            total_len: right_len,
            cells: right_cells,
        },
        diff_ranges,
        summary: HexCompareSummary {
            left_bytes: left_len,
            right_bytes: right_len,
            different_ranges,
        },
    })
}

#[tauri::command]
pub fn find_hex_in_file(
    path: String,
    query_kind: String,
    query: String,
) -> Result<Vec<hex_core::HexFindMatch>, AppErrorPayload> {
    let query = match query_kind.to_ascii_lowercase().as_str() {
        "hex" => hex_core::HexFindQuery::Hex(query),
        _ => hex_core::HexFindQuery::Text(query),
    };

    find_hex_matches_in_file(&path, query)
}

#[tauri::command]
pub fn save_hex_edits(
    path: String,
    edits: Vec<hex_core::HexByteEdit>,
    create_backup: Option<bool>,
) -> Result<hex_core::HexSaveResult, AppErrorPayload> {
    hex_core::save_hex_byte_edits_with_backup(&path, &edits, create_backup.unwrap_or(true)).map_err(
        |error| {
            AppErrorPayload::new(
                AppErrorCode::FileWriteFailed,
                "error.file.writeFailed.message",
                format!("{error:?}"),
            )
            .with_param("path", &path)
            .with_suggestion_key("error.file.writeFailed.suggestion")
        },
    )
}

#[tauri::command]
pub fn merge_text_files(
    left_path: String,
    right_path: String,
    center_path: Option<String>,
    output_path: Option<String>,
    conflict_policy: Option<String>,
) -> Result<TextMergeCommandResponse, AppErrorPayload> {
    let left = file_core::read_text_file(&left_path)
        .map_err(|error| file_error("read", &left_path, error))?;
    let right = file_core::read_text_file(&right_path)
        .map_err(|error| file_error("read", &right_path, error))?;
    let (center_path, center_text) =
        if let Some(path) = center_path.filter(|value| !value.is_empty()) {
            let document = file_core::read_text_file(&path)
                .map_err(|error| file_error("read", &path, error))?;
            (Some(path), document.text)
        } else {
            (None, left.text.clone())
        };
    let document = merge_core::TextMergeDocument::from_inputs(merge_core::TextMergeInput {
        base: merge_core::TextMergeSide::new(
            center_path.clone().unwrap_or_else(|| left_path.clone()),
            center_text.clone(),
        ),
        left: merge_core::TextMergeSide::new(left_path.clone(), left.text.clone()),
        right: merge_core::TextMergeSide::new(right_path.clone(), right.text.clone()),
        output_path: output_path.clone(),
    });
    let policy = match conflict_policy.as_deref() {
        Some("favorLeft") => merge_core::TextMergeConflictPolicy::FavorLeft,
        Some("favorRight") => merge_core::TextMergeConflictPolicy::FavorRight,
        _ => merge_core::TextMergeConflictPolicy::MarkConflict,
    };
    let result = merge_core::auto_merge_text_with_options(
        &document,
        merge_core::TextMergeOptions {
            conflict_policy: policy,
        },
    );
    let conflicts = result
        .sections
        .iter()
        .filter_map(|section| {
            section.conflict.as_ref().map(|conflict| {
                let end_line = section.line_index + section.output.len().saturating_sub(1);
                let title = if section.output.len() <= 1 {
                    format!("Line {}", section.line_index + 1)
                } else {
                    format!("Lines {}-{}", section.line_index + 1, end_line + 1)
                };
                TextMergeConflictRow {
                    line_index: section.line_index,
                    title,
                    base: conflict.base.join(
                        "
",
                    ),
                    left: conflict.left.join(
                        "
",
                    ),
                    right: conflict.right.join(
                        "
",
                    ),
                    output_span: section.output.len(),
                }
            })
        })
        .collect();

    Ok(TextMergeCommandResponse {
        left_path,
        right_path,
        center_path,
        output_path,
        left_text: left.text,
        right_text: right.text,
        center_text,
        output_text: result.output_text,
        conflicts,
    })
}

#[tauri::command]
pub fn move_folder_entry(
    source_path: String,
    target_path: String,
) -> Result<folder_core::FileOperationResult, AppErrorPayload> {
    let error_path = source_path.clone();

    folder_core::perform_file_operation(folder_core::FileOperationRequest::Move {
        source_path,
        target_path,
    })
    .map_err(|error| folder_scan_error(&error_path, error))
}

#[tauri::command]
#[allow(clippy::too_many_arguments)]
pub fn export_text_compare_report(
    left: String,
    right: String,
    left_source: Option<String>,
    right_source: Option<String>,
    format: String,
    output_path: Option<String>,
    algorithm: Option<String>,
    ignore_whitespace: Option<bool>,
    ignore_case: Option<bool>,
    ignore_line_endings: Option<bool>,
    ignore_regexes: Option<Vec<String>>,
) -> Result<ExportReportResponse, AppErrorPayload> {
    let diff = diff_text(
        left,
        right,
        algorithm,
        ignore_whitespace,
        ignore_case,
        ignore_line_endings,
        ignore_regexes,
    );
    let report = report_core::UnifiedReport::new(
        report_core::ReportKind::Text,
        "Text Compare",
        report_core::ReportMetadata {
            generated_at: current_timestamp(),
            left_source,
            right_source,
        },
    )
    .with_section(report_core::ReportSection {
        kind: report_core::ReportSectionKind::Summary,
        title: "Summary".to_owned(),
        rows: vec![
            report_row(
                "Added",
                Some(diff.stats.added.to_string()),
                None,
                report_core::ReportRowStatus::Added,
            ),
            report_row(
                "Deleted",
                Some(diff.stats.deleted.to_string()),
                None,
                report_core::ReportRowStatus::Removed,
            ),
            report_row(
                "Modified",
                Some(diff.stats.modified.to_string()),
                None,
                report_core::ReportRowStatus::Different,
            ),
            report_row(
                "Equal",
                Some(diff.stats.equal.to_string()),
                None,
                report_core::ReportRowStatus::Equal,
            ),
        ],
    })
    .with_section(report_core::ReportSection {
        kind: report_core::ReportSectionKind::Differences,
        title: "Lines".to_owned(),
        rows: diff
            .lines
            .iter()
            .filter(|line| line.kind != shared_types::DiffLineKind::Equal)
            .map(|line| report_core::ReportRow {
                label: format!(
                    "L{} / R{}",
                    line.left_number.unwrap_or(0),
                    line.right_number.unwrap_or(0)
                ),
                left: Some(line.left_text.clone()),
                right: Some(line.right_text.clone()),
                status: match line.kind {
                    shared_types::DiffLineKind::Added => report_core::ReportRowStatus::Added,
                    shared_types::DiffLineKind::Deleted => report_core::ReportRowStatus::Removed,
                    _ => report_core::ReportRowStatus::Different,
                },
            })
            .collect(),
    });

    write_rendered_report(&report, &format, output_path)
}

#[tauri::command]
pub fn export_folder_compare_report(
    left_root: String,
    right_root: String,
    format: String,
    output_path: Option<String>,
) -> Result<ExportReportResponse, AppErrorPayload> {
    let cancellation_token = job_core::CancellationToken::default();
    let left_tree = folder_core::scan_local_folder(&left_root, &cancellation_token)
        .map_err(|error| folder_scan_error(&left_root, error))?;
    let right_tree = folder_core::scan_local_folder(&right_root, &cancellation_token)
        .map_err(|error| folder_scan_error(&right_root, error))?;
    let alignment_rows = folder_core::align_folder_trees(&left_tree, &right_tree);
    let model = folder_core::build_folder_report_model(
        &alignment_rows,
        &folder_core::FolderCompareOptions::default(),
        true,
    );
    let content = match format.to_ascii_lowercase().as_str() {
        "text" | "txt" => folder_core::render_folder_report_text(&model, "Folder Compare"),
        "xml" => folder_core::render_folder_report_xml(&model),
        "json" => {
            let report = folder_report_to_unified(&model, &left_root, &right_root);
            report_core::render_json_report(&report).map_err(|error| {
                AppErrorPayload::new(
                    AppErrorCode::Unknown,
                    "error.app.unknown.title",
                    error.to_string(),
                )
            })?
        }
        _ => folder_core::render_folder_report_html(&model, "Folder Compare"),
    };

    persist_report_content(format, content, output_path)
}

#[tauri::command]
pub fn apply_text_patch(
    source: String,
    patch: String,
) -> Result<ApplyTextPatchResponse, AppErrorPayload> {
    let result = diff_core::apply_text_patch(&source, &patch).map_err(|error| {
        AppErrorPayload::new(
            AppErrorCode::Unknown,
            "error.app.unknown.title",
            error.to_string(),
        )
    })?;

    Ok(ApplyTextPatchResponse {
        text: result.text,
        applied_hunks: result.applied_hunks,
        files: result.files,
    })
}

#[tauri::command]
pub fn apply_text_patch_to_file(
    source_path: String,
    patch: String,
    output_path: Option<String>,
) -> Result<ApplyTextPatchResponse, AppErrorPayload> {
    let source = file_core::read_text_file(&source_path).map_err(|error| {
        AppErrorPayload::new(
            AppErrorCode::Unknown,
            "error.file.readFailed.title",
            format!("{error:?}"),
        )
        .with_param("path", &source_path)
    })?;
    let result = diff_core::apply_text_patch(&source.text, &patch).map_err(|error| {
        AppErrorPayload::new(
            AppErrorCode::Unknown,
            "error.app.unknown.title",
            error.to_string(),
        )
    })?;
    let target = output_path.unwrap_or(source_path);
    file_core::save_text_file(&target, &result.text).map_err(|error| {
        AppErrorPayload::new(
            AppErrorCode::Unknown,
            "error.file.writeFailed.title",
            format!("{error:?}"),
        )
        .with_param("path", &target)
    })?;

    Ok(ApplyTextPatchResponse {
        text: result.text,
        applied_hunks: result.applied_hunks,
        files: result.files,
    })
}

#[derive(Debug, Clone, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct ArchiveListResponse {
    pub name: String,
    pub format: String,
    pub entries: Vec<archive_core::ArchiveEntry>,
}

#[tauri::command]
pub fn list_archive(path: String) -> Result<ArchiveListResponse, AppErrorPayload> {
    let document = archive_core::ArchiveReader::open_path(&path).map_err(|error| {
        AppErrorPayload::new(
            AppErrorCode::Unknown,
            "error.app.unknown.title",
            error.to_string(),
        )
        .with_param("path", &path)
    })?;
    let format = archive_core::ArchiveFormat::detect(&document.name)
        .map(|format| format!("{format:?}").to_ascii_lowercase())
        .unwrap_or_else(|_| "unknown".to_owned());
    let vfs = archive_core::ArchiveVfs::from_document(document.clone());

    Ok(ArchiveListResponse {
        name: document.name,
        format,
        entries: vfs.list_recursive(),
    })
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct ScriptRunResponse {
    pub executed: usize,
    pub compared: usize,
    pub different: usize,
    pub reports_written: usize,
    pub logs: Vec<String>,
}

#[tauri::command]
pub fn run_script(
    source: String,
    path: Option<String>,
) -> Result<ScriptRunResponse, AppErrorPayload> {
    let result = if let Some(path) = path.filter(|value| !value.trim().is_empty()) {
        script_core::run_script_file(&path, script_core::ScriptExecutionContext::default())
    } else {
        script_core::run_script_source(&source, script_core::ScriptExecutionContext::default())
    }
    .map_err(|error| {
        AppErrorPayload::new(
            AppErrorCode::Unknown,
            "error.app.unknown.title",
            error.to_string(),
        )
    })?;
    let summary = result.state.last_compare.unwrap_or_default();

    Ok(ScriptRunResponse {
        executed: result.executed,
        compared: summary.compared,
        different: summary.different,
        reports_written: result.state.reports_written,
        logs: result.state.logs,
    })
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct RemoteProfileDraft {
    pub id: String,
    pub name: String,
    pub protocol: remote_core::RemoteProtocol,
    pub host: String,
    pub port: Option<u16>,
    pub root_path: String,
    pub username: Option<String>,
    pub password: Option<String>,
}

#[derive(Debug, Clone, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct RemoteProfileView {
    pub id: String,
    pub name: String,
    pub protocol: remote_core::RemoteProtocol,
    pub host: String,
    pub port: Option<u16>,
    pub root_path: String,
    pub implemented: bool,
    pub uri: String,
    pub username: Option<String>,
}

#[tauri::command]
pub fn list_remote_profiles() -> Result<Vec<RemoteProfileView>, AppErrorPayload> {
    let store = remote_core::RemoteProfileStore::new(crate::sources::default_config_dir());
    let profiles = store.load_profiles().map_err(profile_store_error)?;
    Ok(profiles
        .into_iter()
        .map(|profile| remote_profile_view(&store, profile))
        .collect())
}

#[tauri::command]
pub fn save_remote_profile(
    draft: RemoteProfileDraft,
) -> Result<Vec<RemoteProfileView>, AppErrorPayload> {
    let store = remote_core::RemoteProfileStore::new(crate::sources::default_config_dir());
    let profile_id = if draft.id.trim().is_empty() {
        draft
            .name
            .trim()
            .to_ascii_lowercase()
            .chars()
            .map(|ch| if ch.is_ascii_alphanumeric() { ch } else { '-' })
            .collect::<String>()
            .trim_matches('-')
            .to_owned()
    } else {
        draft.id.clone()
    };
    let profile_id = if profile_id.is_empty() {
        format!(
            "remote-profile-{}",
            store
                .load_profiles()
                .map(|items| items.len() + 1)
                .unwrap_or(1)
        )
    } else {
        profile_id
    };
    let mut profile = remote_core::RemoteProfile::new(
        profile_id.clone(),
        draft.name,
        draft.protocol,
        remote_core::RemoteEndpoint::new(draft.host).with_root_path(draft.root_path),
        remote_core::CredentialReference::profile_store(&profile_id),
    );
    if let Some(port) = draft.port {
        profile.endpoint.port = Some(port);
    }
    let policy = policy_core::load_effective_policy(crate::sources::default_config_dir());
    if !policy.allows(policy_core::PolicyCapability::RemoteProfiles) {
        return Err(AppErrorPayload::new(
            AppErrorCode::Unknown,
            "error.app.unknown.title",
            "remote profiles are disabled by administrator policy".to_owned(),
        ));
    }
    store.upsert_profile(profile).map_err(profile_store_error)?;
    if let Some(password) = draft.password.filter(|value| !value.is_empty()) {
        if policy.allows(policy_core::PolicyCapability::SavePasswords) {
            store
                .save_secret(&profile_id, draft.username.as_deref(), &password)
                .map_err(profile_store_error)?;
        }
    } else if let Some(username) = draft.username.filter(|value| !value.is_empty()) {
        if let Ok(Some(existing)) = store.load_secret(&profile_id) {
            if let remote_core::RemoteCredentialMaterial::Password(secret) = existing.material {
                store
                    .save_secret(&profile_id, Some(&username), secret.expose_secret())
                    .map_err(profile_store_error)?;
            }
        }
    }
    list_remote_profiles()
}

#[tauri::command]
pub fn delete_remote_profile(id: String) -> Result<Vec<RemoteProfileView>, AppErrorPayload> {
    let store = remote_core::RemoteProfileStore::new(crate::sources::default_config_dir());
    store.delete_profile(&id).map_err(profile_store_error)?;
    list_remote_profiles()
}

#[tauri::command]
pub fn test_remote_profile(id: String) -> Result<String, AppErrorPayload> {
    let store = remote_core::RemoteProfileStore::new(crate::sources::default_config_dir());
    let profile = store
        .find_profile(&id)
        .map_err(profile_store_error)?
        .ok_or_else(|| {
            AppErrorPayload::new(
                AppErrorCode::Unknown,
                "error.app.unknown.title",
                format!("remote profile not found: {id}"),
            )
        })?;
    if !remote_core::protocol_is_implemented(profile.protocol) {
        return Err(AppErrorPayload::new(
            AppErrorCode::Unknown,
            "error.app.unknown.title",
            remote_core::unimplemented_protocol_message(profile.protocol),
        ));
    }
    let credential = store
        .load_secret(&profile.id)
        .map_err(profile_store_error)?
        .ok_or_else(|| {
            AppErrorPayload::new(
                AppErrorCode::Unknown,
                "error.app.unknown.title",
                "no stored username/password for this profile".to_owned(),
            )
        })?;
    remote_core::test_network_connection(&profile, &credential).map_err(|error| {
        AppErrorPayload::new(
            AppErrorCode::Unknown,
            "error.app.unknown.title",
            format!("{error:?}"),
        )
    })
}

#[tauri::command]
pub fn list_remote_path(
    profile_id: String,
    path: String,
) -> Result<Vec<remote_core::RemoteEntry>, AppErrorPayload> {
    let store = remote_core::RemoteProfileStore::new(crate::sources::default_config_dir());
    let profile = store
        .find_profile(&profile_id)
        .map_err(profile_store_error)?
        .ok_or_else(|| {
            AppErrorPayload::new(
                AppErrorCode::Unknown,
                "error.app.unknown.title",
                format!("remote profile not found: {profile_id}"),
            )
        })?;
    let credential = store
        .load_secret(&profile.id)
        .map_err(profile_store_error)?
        .ok_or_else(|| {
            AppErrorPayload::new(
                AppErrorCode::Unknown,
                "error.app.unknown.title",
                "no stored username/password for this profile".to_owned(),
            )
        })?;
    let provider = remote_core::open_network_provider(&profile, &credential).map_err(|error| {
        AppErrorPayload::new(
            AppErrorCode::Unknown,
            "error.app.unknown.title",
            format!("{error:?}"),
        )
    })?;
    provider.list(&path).map_err(|error| {
        AppErrorPayload::new(
            AppErrorCode::Unknown,
            "error.app.unknown.title",
            format!("{error:?}"),
        )
    })
}

#[tauri::command]
pub fn write_git_integration(
    kind: String,
    executable_path: String,
    scope: Option<String>,
    config_path: Option<String>,
) -> Result<String, AppErrorPayload> {
    let scope = if scope.as_deref() == Some("local") {
        cli_core::GitConfigScope::Local
    } else {
        cli_core::GitConfigScope::Global
    };
    let config = if kind == "mergetool" {
        cli_core::build_git_mergetool_config(&executable_path, scope)
    } else {
        cli_core::build_git_difftool_config(&executable_path, scope)
    }
    .map_err(|error| {
        AppErrorPayload::new(
            AppErrorCode::Unknown,
            "error.app.unknown.title",
            error.message,
        )
    })?;
    cli_core::write_git_tool_config_to_file(&config, config_path.as_deref().map(Path::new)).map_err(
        |error| {
            AppErrorPayload::new(
                AppErrorCode::Unknown,
                "error.app.unknown.title",
                error.message,
            )
        },
    )
}

#[tauri::command]
pub fn write_svn_integration(
    executable_path: String,
    wrapper_path: String,
) -> Result<String, AppErrorPayload> {
    let config =
        cli_core::build_svn_diff_config(&executable_path, &wrapper_path).map_err(|error| {
            AppErrorPayload::new(
                AppErrorCode::Unknown,
                "error.app.unknown.title",
                error.message,
            )
        })?;
    cli_core::write_svn_diff_config(&config, &wrapper_path).map_err(|error| {
        AppErrorPayload::new(
            AppErrorCode::Unknown,
            "error.app.unknown.title",
            error.message,
        )
    })
}

#[tauri::command]
pub fn load_admin_policy() -> policy_core::PolicyFlags {
    policy_core::load_effective_policy(crate::sources::default_config_dir()).flags()
}

#[tauri::command]
pub fn app_runtime_info() -> AppRuntimeInfo {
    AppRuntimeInfo {
        os: std::env::consts::OS.to_owned(),
        family: std::env::consts::FAMILY.to_owned(),
    }
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct AppRuntimeInfo {
    pub os: String,
    pub family: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct ShellRegistrationResult {
    pub windows: bool,
    pub applied: bool,
    pub script: String,
    pub message: String,
}

#[tauri::command]
pub fn register_windows_shell_extension(
    executable_path: Option<String>,
) -> Result<ShellRegistrationResult, AppErrorPayload> {
    let executable = resolve_shell_extension_executable(executable_path);
    let config = shell_core::WindowsShellExtensionConfig::new("Open Diff", executable);
    let script = shell_core::WindowsShellExtensionScriptBuilder::new(config).registration_script();

    #[cfg(windows)]
    {
        apply_windows_powershell_script(&script, "open-diff-register-shell.ps1")?;

        Ok(ShellRegistrationResult {
            windows: true,
            applied: true,
            script,
            message: "Windows Explorer context menu installed".to_owned(),
        })
    }

    #[cfg(not(windows))]
    {
        Ok(ShellRegistrationResult {
            windows: false,
            applied: false,
            script,
            message: "Windows only. Registration script generated but not applied.".to_owned(),
        })
    }
}

fn resolve_shell_extension_executable(executable_path: Option<String>) -> String {
    executable_path.unwrap_or_else(|| {
        std::env::current_exe()
            .map(|path| path.display().to_string())
            .unwrap_or_else(|_| "open-diff".to_owned())
    })
}

#[cfg(windows)]
fn apply_windows_powershell_script(script: &str, temp_name: &str) -> Result<(), AppErrorPayload> {
    let temp = std::env::temp_dir().join(temp_name);
    fs::write(&temp, script).map_err(|error| {
        AppErrorPayload::new(
            AppErrorCode::Unknown,
            "error.app.unknown.title",
            error.to_string(),
        )
    })?;
    let output = std::process::Command::new("powershell")
        .args([
            "-NoProfile",
            "-ExecutionPolicy",
            "Bypass",
            "-File",
            &temp.display().to_string(),
        ])
        .output()
        .map_err(|error| {
            AppErrorPayload::new(
                AppErrorCode::Unknown,
                "error.app.unknown.title",
                error.to_string(),
            )
        })?;
    if !output.status.success() {
        return Err(AppErrorPayload::new(
            AppErrorCode::Unknown,
            "error.app.unknown.title",
            String::from_utf8_lossy(&output.stderr).into_owned(),
        ));
    }

    Ok(())
}

#[tauri::command]
pub fn unregister_windows_shell_extension(
    executable_path: Option<String>,
) -> Result<ShellRegistrationResult, AppErrorPayload> {
    let executable = resolve_shell_extension_executable(executable_path);
    let config = shell_core::WindowsShellExtensionConfig::new("Open Diff", executable);
    let script = shell_core::WindowsShellExtensionScriptBuilder::new(config).uninstall_script();

    #[cfg(windows)]
    {
        apply_windows_powershell_script(&script, "open-diff-unregister-shell.ps1")?;

        Ok(ShellRegistrationResult {
            windows: true,
            applied: true,
            script,
            message: "Windows Explorer context menu removed".to_owned(),
        })
    }

    #[cfg(not(windows))]
    {
        let _ = executable;
        Ok(ShellRegistrationResult {
            windows: false,
            applied: false,
            script,
            message: "Windows only. Unregister script generated but not applied.".to_owned(),
        })
    }
}

#[tauri::command]
pub fn register_unix_shell_integration(
    executable_path: Option<String>,
) -> Result<ShellRegistrationResult, AppErrorPayload> {
    let executable = resolve_shell_extension_executable(executable_path);
    let config = shell_core::UnixShellIntegrationConfig::new("Open Diff", executable);

    #[cfg(target_os = "linux")]
    {
        let script = shell_core::LinuxDesktopIntegrationBuilder::new(config).install_script();
        apply_unix_shell_script(&script, "open-diff-register-unix-shell.sh")?;
        Ok(ShellRegistrationResult {
            windows: false,
            applied: true,
            script,
            message: "Linux Open With / shell-compare desktop entry installed".to_owned(),
        })
    }

    #[cfg(target_os = "macos")]
    {
        let script = shell_core::MacOsShellIntegrationBuilder::new(config).install_script();
        apply_unix_shell_script(&script, "open-diff-register-unix-shell.sh")?;
        return Ok(ShellRegistrationResult {
            windows: false,
            applied: true,
            script,
            message: "macOS shell-compare helper and Open With app installed".to_owned(),
        });
    }

    #[cfg(not(any(target_os = "linux", target_os = "macos")))]
    {
        let script = shell_core::LinuxDesktopIntegrationBuilder::new(config).install_script();
        Ok(ShellRegistrationResult {
            windows: false,
            applied: false,
            script,
            message: "Unix shell integration applies on Linux or macOS only.".to_owned(),
        })
    }
}

#[tauri::command]
pub fn unregister_unix_shell_integration(
    executable_path: Option<String>,
) -> Result<ShellRegistrationResult, AppErrorPayload> {
    let executable = resolve_shell_extension_executable(executable_path);
    let config = shell_core::UnixShellIntegrationConfig::new("Open Diff", executable);

    #[cfg(target_os = "linux")]
    {
        let script = shell_core::LinuxDesktopIntegrationBuilder::new(config).uninstall_script();
        apply_unix_shell_script(&script, "open-diff-unregister-unix-shell.sh")?;
        Ok(ShellRegistrationResult {
            windows: false,
            applied: true,
            script,
            message: "Linux Open With / shell-compare desktop entry removed".to_owned(),
        })
    }

    #[cfg(target_os = "macos")]
    {
        let script = shell_core::MacOsShellIntegrationBuilder::new(config).uninstall_script();
        apply_unix_shell_script(&script, "open-diff-unregister-unix-shell.sh")?;
        return Ok(ShellRegistrationResult {
            windows: false,
            applied: true,
            script,
            message: "macOS shell-compare helper removed".to_owned(),
        });
    }

    #[cfg(not(any(target_os = "linux", target_os = "macos")))]
    {
        let _ = executable;
        let script = shell_core::LinuxDesktopIntegrationBuilder::new(config).uninstall_script();
        Ok(ShellRegistrationResult {
            windows: false,
            applied: false,
            script,
            message: "Unix shell integration applies on Linux or macOS only.".to_owned(),
        })
    }
}

#[cfg(any(target_os = "linux", target_os = "macos"))]
fn apply_unix_shell_script(script: &str, temp_name: &str) -> Result<(), AppErrorPayload> {
    let temp = std::env::temp_dir().join(temp_name);
    fs::write(&temp, script).map_err(|error| {
        AppErrorPayload::new(
            AppErrorCode::Unknown,
            "error.app.unknown.title",
            error.to_string(),
        )
    })?;
    #[cfg(unix)]
    {
        use std::os::unix::fs::PermissionsExt;
        let mut perms = fs::metadata(&temp)
            .map_err(|error| {
                AppErrorPayload::new(
                    AppErrorCode::Unknown,
                    "error.app.unknown.title",
                    error.to_string(),
                )
            })?
            .permissions();
        perms.set_mode(0o755);
        fs::set_permissions(&temp, perms).map_err(|error| {
            AppErrorPayload::new(
                AppErrorCode::Unknown,
                "error.app.unknown.title",
                error.to_string(),
            )
        })?;
    }
    let output = std::process::Command::new("bash")
        .arg(&temp)
        .output()
        .map_err(|error| {
            AppErrorPayload::new(
                AppErrorCode::Unknown,
                "error.app.unknown.title",
                error.to_string(),
            )
        })?;
    if !output.status.success() {
        return Err(AppErrorPayload::new(
            AppErrorCode::Unknown,
            "error.app.unknown.title",
            String::from_utf8_lossy(&output.stderr).into_owned(),
        ));
    }

    Ok(())
}

#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct OpenPathExternalResult {
    pub path: String,
    pub executable: Option<String>,
    pub launched: bool,
}

#[tauri::command]
pub fn open_path_external(
    path: String,
    executable: Option<String>,
) -> Result<OpenPathExternalResult, AppErrorPayload> {
    let trimmed = path.trim();
    if trimmed.is_empty() {
        return Err(AppErrorPayload::new(
            AppErrorCode::Unknown,
            "error.app.unknown.title",
            "Path is required".to_owned(),
        ));
    }

    let result = if let Some(exe) = executable
        .as_deref()
        .map(str::trim)
        .filter(|value| !value.is_empty())
    {
        std::process::Command::new(exe)
            .arg(trimmed)
            .spawn()
            .map(|_| OpenPathExternalResult {
                path: trimmed.to_owned(),
                executable: Some(exe.to_owned()),
                launched: true,
            })
    } else {
        open_path_with_system_default(trimmed).map(|_| OpenPathExternalResult {
            path: trimmed.to_owned(),
            executable: None,
            launched: true,
        })
    };

    result.map_err(|error| {
        AppErrorPayload::new(
            AppErrorCode::Unknown,
            "error.app.unknown.title",
            error.to_string(),
        )
    })
}

fn open_path_with_system_default(path: &str) -> std::io::Result<std::process::Child> {
    #[cfg(target_os = "windows")]
    {
        std::process::Command::new("cmd")
            .args(["/C", "start", "", path])
            .spawn()
    }

    #[cfg(target_os = "macos")]
    {
        std::process::Command::new("open").arg(path).spawn()
    }

    #[cfg(all(unix, not(target_os = "macos")))]
    {
        std::process::Command::new("xdg-open").arg(path).spawn()
    }

    #[cfg(not(any(target_os = "windows", target_os = "macos", unix)))]
    {
        Err(std::io::Error::new(
            std::io::ErrorKind::Unsupported,
            "Opening paths is unsupported on this platform",
        ))
    }
}

#[tauri::command]
pub fn take_shell_compare_launch(
) -> Result<Option<crate::shell_startup::ShellCompareLaunchPayload>, AppErrorPayload> {
    crate::shell_startup::take_shell_compare_launch().map_err(|error| {
        AppErrorPayload::new(AppErrorCode::Unknown, "error.app.unknown.title", error)
    })
}

#[tauri::command]
pub fn query_live_windows_registry(key: String) -> Result<String, AppErrorPayload> {
    #[cfg(windows)]
    {
        let output = std::process::Command::new("reg")
            .args(["query", &key])
            .output()
            .map_err(|error| {
                AppErrorPayload::new(
                    AppErrorCode::Unknown,
                    "error.app.unknown.title",
                    error.to_string(),
                )
            })?;
        if !output.status.success() {
            return Err(AppErrorPayload::new(
                AppErrorCode::Unknown,
                "error.app.unknown.title",
                String::from_utf8_lossy(&output.stderr).into_owned(),
            ));
        }

        Ok(String::from_utf8_lossy(&output.stdout).into_owned())
    }

    #[cfg(not(windows))]
    {
        let _ = key;
        Err(AppErrorPayload::new(
            AppErrorCode::Unknown,
            "error.app.unknown.title",
            "Live registry query is available on Windows only".to_owned(),
        ))
    }
}

#[tauri::command]
pub fn create_folder_snapshot(
    source_root: String,
    output_path: String,
    name: Option<String>,
) -> Result<String, AppErrorPayload> {
    let snapshot = snapshot_core::scan_directory_snapshot(
        name.unwrap_or_else(|| "folder-snapshot".to_owned()),
        &source_root,
    )
    .map_err(|error| {
        AppErrorPayload::new(
            AppErrorCode::Unknown,
            "error.app.unknown.title",
            format!("{error:?}"),
        )
    })?;
    snapshot_core::save_snapshot_file(&output_path, &snapshot).map_err(|error| {
        AppErrorPayload::new(
            AppErrorCode::Unknown,
            "error.app.unknown.title",
            format!("{error:?}"),
        )
    })?;
    Ok(output_path)
}

fn remote_profile_view(
    store: &remote_core::RemoteProfileStore,
    profile: remote_core::RemoteProfile,
) -> RemoteProfileView {
    let username = store
        .load_secret(&profile.id)
        .ok()
        .flatten()
        .and_then(|credential| credential.username);
    RemoteProfileView {
        uri: remote_core::format_remote_uri(
            profile.protocol,
            &profile.id,
            profile.endpoint.root_path.as_deref().unwrap_or("/"),
        ),
        implemented: remote_core::protocol_is_implemented(profile.protocol),
        id: profile.id,
        name: profile.name,
        protocol: profile.protocol,
        host: profile.endpoint.host,
        port: profile.endpoint.port,
        root_path: profile.endpoint.root_path.unwrap_or_else(|| "/".to_owned()),
        username,
    }
}

fn profile_store_error(error: remote_core::ProfileStoreError) -> AppErrorPayload {
    AppErrorPayload::new(
        AppErrorCode::Unknown,
        "error.app.unknown.title",
        format!("{error:?}"),
    )
}

fn compare_source_error(path: &str, error: impl std::fmt::Display) -> AppErrorPayload {
    AppErrorPayload::new(
        AppErrorCode::Unknown,
        "error.app.unknown.title",
        error.to_string(),
    )
    .with_param("path", path)
}

#[tauri::command]
pub fn compare_picture_files(
    left_path: String,
    right_path: String,
    rgb_tolerance: Option<u8>,
    compare_alpha: Option<bool>,
    alpha_tolerance: Option<u8>,
    ignore_color_from: Option<Vec<u8>>,
    ignore_color_to: Option<Vec<u8>>,
) -> Result<PictureCompareResponse, AppErrorPayload> {
    let left = read_picture_path(&left_path)?;
    let right = read_picture_path(&right_path)?;
    let metadata_rows = picture_metadata_rows(&left.metadata, &right.metadata);
    let total_pixels = u64::from(left.metadata.width) * u64::from(left.metadata.height);
    let options = image_core::PixelDiffOptions {
        rgb_tolerance: rgb_tolerance.unwrap_or(0),
        compare_alpha: compare_alpha.unwrap_or(true),
        alpha_tolerance: alpha_tolerance.unwrap_or(0),
        ignored_replacements: picture_ignore_replacements(ignore_color_from, ignore_color_to),
    };
    let diff = if left.metadata.width == right.metadata.width
        && left.metadata.height == right.metadata.height
    {
        image_core::scan_pixel_differences_with_options(
            &left.pixels,
            &right.pixels,
            left.metadata.width,
            left.metadata.height,
            options,
        )
        .map_err(picture_pixel_error)?
    } else {
        image_core::PixelDiff {
            different_pixels: total_pixels,
            bounding_rect: Some(ImageRect {
                x: 0,
                y: 0,
                width: left.metadata.width,
                height: left.metadata.height,
            }),
        }
    };

    Ok(PictureCompareResponse {
        left: picture_side_summary(&left_path, &left.metadata),
        right: picture_side_summary(&right_path, &right.metadata),
        statistics: PictureCompareStatistics {
            total_pixels,
            different_pixels: diff.different_pixels,
            difference_ratio: if total_pixels == 0 {
                0.0
            } else {
                diff.different_pixels as f64 / total_pixels as f64
            },
            bounding_rect: diff.bounding_rect,
        },
        metadata_rows,
    })
}

#[tauri::command]
pub fn compare_registry_exports(
    left: String,
    right: String,
    left_name: Option<String>,
    right_name: Option<String>,
) -> Result<RegistryCompareResponse, AppErrorPayload> {
    let left_name = left_name.unwrap_or_else(|| "left.reg".to_owned());
    let right_name = right_name.unwrap_or_else(|| "right.reg".to_owned());
    let left_document =
        registry_core::RegFileParser::parse(left_name.clone(), &left).map_err(registry_error)?;
    let right_document =
        registry_core::RegFileParser::parse(right_name.clone(), &right).map_err(registry_error)?;

    Ok(compare_registry_documents(
        &left_name,
        &right_name,
        &left_document,
        &right_document,
    ))
}

#[tauri::command]
pub fn compare_version_files(
    left_path: String,
    right_path: String,
) -> Result<VersionCompareResponse, AppErrorPayload> {
    #[cfg(windows)]
    {
        let reader = version_core::WindowsVersionInfoReader;

        compare_version_files_from_reader(&reader, &left_path, &right_path)
    }

    #[cfg(not(windows))]
    {
        let _ = (left_path, right_path);

        Err(AppErrorPayload::new(
            AppErrorCode::Unknown,
            "error.version.unsupportedPlatform.message",
            "native version resource reading is only available on Windows",
        )
        .with_suggestion_key("error.version.unsupportedPlatform.suggestion"))
    }
}

#[tauri::command]
pub fn read_text_file(path: String) -> Result<ReadTextFileResponse, AppErrorPayload> {
    if remote_core::is_remote_uri(&path) {
        let bytes = crate::sources::read_remote_file(&path).map_err(|error| {
            AppErrorPayload::new(AppErrorCode::Unknown, "error.file.readFailed.title", error)
                .with_param("path", &path)
        })?;
        return file_core::read_text_from_bytes(
            path.clone(),
            &bytes,
            shared_types::FileStamp {
                size: bytes.len() as u64,
                modified_at_ms: 0,
            },
        )
        .map_err(|error| file_error("read", &path, error));
    }

    file_core::read_text_file(&path).map_err(|error| file_error("read", &path, error))
}

#[tauri::command]
pub fn save_text_file(
    path: String,
    text: String,
    create_backup: Option<bool>,
) -> Result<SaveTextFileResponse, AppErrorPayload> {
    file_core::save_text_file_with_backup(&path, text, create_backup.unwrap_or(true))
        .map_err(|error| file_error("write", &path, error))
}

#[tauri::command]
pub fn check_text_file_changed(
    path: String,
    previous_stamp: FileStamp,
) -> Result<bool, AppErrorPayload> {
    file_core::check_text_file_changed(&path, &previous_stamp)
        .map_err(|error| file_error("read", &path, error))
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ClassifiedPathEntry {
    pub path: String,
    pub kind: String,
}

#[tauri::command]
pub fn classify_paths(paths: Vec<String>) -> Vec<ClassifiedPathEntry> {
    paths
        .into_iter()
        .map(|path| {
            let kind = path_kind_label(Path::new(&path));
            ClassifiedPathEntry { path, kind }
        })
        .collect()
}

#[tauri::command]
pub fn pick_path(directory: bool) -> Result<Option<String>, AppErrorPayload> {
    // ponytail: rfd native dialog; cancelled selection returns None
    let dialog = rfd::FileDialog::new();
    let picked = if directory {
        dialog.pick_folder()
    } else {
        dialog.pick_file()
    };

    Ok(picked.map(|path| path.to_string_lossy().into_owned()))
}

fn path_kind_label(path: &Path) -> String {
    if path.is_dir() {
        "directory".to_owned()
    } else if path.is_file() {
        "file".to_owned()
    } else {
        "unknown".to_owned()
    }
}

fn file_error(operation: &str, path: &str, error: FileReadError) -> AppErrorPayload {
    match error {
        FileReadError::NotFound(message) => AppErrorPayload::new(
            AppErrorCode::FileNotFound,
            "error.file.notFound.message",
            message,
        )
        .with_param("path", path)
        .with_suggestion_key("error.file.notFound.suggestion"),
        FileReadError::UnsupportedEncoding => AppErrorPayload::new(
            AppErrorCode::FileUnsupportedEncoding,
            "error.file.unsupportedEncoding.message",
            "unsupported text encoding",
        )
        .with_param("path", path)
        .with_suggestion_key("error.file.unsupportedEncoding.suggestion"),
        FileReadError::Io(message) if operation == "write" => AppErrorPayload::new(
            AppErrorCode::FileWriteFailed,
            "error.file.writeFailed.message",
            message,
        )
        .with_param("path", path)
        .with_suggestion_key("error.file.writeFailed.suggestion"),
        FileReadError::Io(message) => AppErrorPayload::new(
            AppErrorCode::FileReadFailed,
            "error.file.readFailed.message",
            message,
        )
        .with_param("path", path)
        .with_suggestion_key("error.file.readFailed.suggestion"),
    }
}

fn empty_table_error() -> AppErrorPayload {
    AppErrorPayload::new(
        AppErrorCode::Unknown,
        "error.table.empty.message",
        "CSV input does not contain a readable sheet",
    )
    .with_suggestion_key("error.table.empty.suggestion")
}

fn table_parse_error(error: TableParseError) -> AppErrorPayload {
    AppErrorPayload::new(
        AppErrorCode::Unknown,
        "error.table.parseFailed.message",
        format!("{error:?}"),
    )
    .with_suggestion_key("error.table.parseFailed.suggestion")
}

fn column_mapping_source_label(source: &ColumnMappingSource) -> String {
    match source {
        ColumnMappingSource::Automatic => "Automatic",
        ColumnMappingSource::LeftOnly => "Left Only",
        ColumnMappingSource::RightOnly => "Right Only",
    }
    .to_owned()
}

fn table_diff_status_label(status: &TableDiffStatus) -> String {
    match status {
        TableDiffStatus::Same => "Same",
        TableDiffStatus::Added => "Added",
        TableDiffStatus::Removed => "Removed",
        TableDiffStatus::Modified => "Modified",
        TableDiffStatus::Conflict => "Conflict",
    }
    .to_owned()
}

fn table_cell_value_to_text(value: &TableCellValue) -> String {
    match value {
        TableCellValue::Empty => String::new(),
        TableCellValue::Text(value) | TableCellValue::DateTime(value) => value.clone(),
        TableCellValue::Number(value) => {
            if value.fract() == 0.0 {
                format!("{value:.0}")
            } else {
                value.to_string()
            }
        }
        TableCellValue::Boolean(value) => value.to_string(),
    }
}

fn read_media_path(path: &str) -> Result<MediaDocument, AppErrorPayload> {
    let bytes = fs::read(path).map_err(|error| file_io_error(path, error))?;
    let name = Path::new(path)
        .file_name()
        .and_then(|name| name.to_str())
        .unwrap_or(path);

    media_core::read_media_document(name, &bytes).map_err(|error| media_read_error(path, error))
}

fn file_io_error(path: &str, error: std::io::Error) -> AppErrorPayload {
    let message = error.to_string();

    if error.kind() == std::io::ErrorKind::NotFound {
        return AppErrorPayload::new(
            AppErrorCode::FileNotFound,
            "error.file.notFound.message",
            message,
        )
        .with_param("path", path)
        .with_suggestion_key("error.file.notFound.suggestion");
    }

    AppErrorPayload::new(
        AppErrorCode::FileReadFailed,
        "error.file.readFailed.message",
        message,
    )
    .with_param("path", path)
    .with_suggestion_key("error.file.readFailed.suggestion")
}

fn folder_scan_error(path: &str, error: FolderScanError) -> AppErrorPayload {
    match error {
        FolderScanError::Cancelled => AppErrorPayload::new(
            AppErrorCode::Unknown,
            "error.folder.scanCancelled.message",
            "folder scan was cancelled",
        )
        .with_param("path", path)
        .with_suggestion_key("error.folder.scanCancelled.suggestion"),
        FolderScanError::Vfs(message) => AppErrorPayload::new(
            AppErrorCode::FileReadFailed,
            "error.folder.scanFailed.message",
            message,
        )
        .with_param("path", path)
        .with_suggestion_key("error.folder.scanFailed.suggestion"),
    }
}

fn folder_compare_row(
    row: &FolderAlignmentRow,
    left_source: &crate::sources::CompareSource,
    right_source: &crate::sources::CompareSource,
    left_root: &str,
    right_root: &str,
    criteria: &FolderCompareCriteria,
) -> Result<FolderCompareRow, AppErrorPayload> {
    let (status, unimportant) = folder_row_classification(
        row,
        left_source,
        right_source,
        left_root,
        right_root,
        criteria,
    )?;

    Ok(FolderCompareRow {
        relative_path: row.relative_path.clone(),
        depth: row.depth,
        status: folder_status_label(&status),
        unimportant,
        left: row
            .left
            .as_ref()
            .map(|node| folder_side_entry(node, left_root)),
        right: row
            .right
            .as_ref()
            .map(|node| folder_side_entry(node, right_root)),
    })
}

fn folder_row_classification(
    row: &FolderAlignmentRow,
    left_source: &crate::sources::CompareSource,
    right_source: &crate::sources::CompareSource,
    left_root: &str,
    right_root: &str,
    criteria: &FolderCompareCriteria,
) -> Result<(FolderCompareStatus, bool), AppErrorPayload> {
    let options = criteria.to_options();
    let metadata_status = folder_core::classify_folder_alignment_with_options(
        row.left.as_ref(),
        row.right.as_ref(),
        &options,
    );

    if matches!(
        metadata_status,
        FolderCompareStatus::LeftOnly
            | FolderCompareStatus::RightOnly
            | FolderCompareStatus::Unknown
            | FolderCompareStatus::Error
    ) {
        return Ok((metadata_status, false));
    }

    let minor_metadata = matches!(
        (&row.left, &row.right),
        (Some(left), Some(right))
            if folder_core::is_minor_metadata_difference(left, right, &options)
    );

    if metadata_status == FolderCompareStatus::Different && !minor_metadata {
        return Ok((FolderCompareStatus::Different, false));
    }

    if !row_is_file_pair(row) {
        return Ok((metadata_status, false));
    }

    if !criteria.compare_contents && !criteria.compare_crc {
        let unimportant = metadata_status == FolderCompareStatus::Different && minor_metadata;
        return Ok((metadata_status, unimportant));
    }

    let left_bytes = crate::sources::read_compare_file(left_source, &row.relative_path)
        .map_err(|error| compare_source_error(left_root, error))?;
    let right_bytes = crate::sources::read_compare_file(right_source, &row.relative_path)
        .map_err(|error| compare_source_error(right_root, error))?;

    let mut content_status = FolderCompareStatus::Same;

    if criteria.compare_crc {
        content_status = folder_core::classify_folder_alignment_with_crc32(
            row.left.as_ref(),
            row.right.as_ref(),
            &folder_core::FolderCompareOptions {
                compare_modified_time: false,
                compare_size: false,
                ..options.clone()
            },
            Some(folder_core::calculate_crc32(&left_bytes)),
            Some(folder_core::calculate_crc32(&right_bytes)),
        );
        if content_status != FolderCompareStatus::Same && !criteria.compare_contents {
            return Ok((FolderCompareStatus::Different, false));
        }
    }

    if criteria.compare_contents {
        content_status =
            folder_core::compare_binary_streams(&left_bytes[..], &right_bytes[..], 8192)
                .map_err(|error| file_io_error(left_root, error))?
                .status;
    }

    if content_status != FolderCompareStatus::Same {
        return Ok((FolderCompareStatus::Different, false));
    }

    if metadata_status == FolderCompareStatus::Same {
        return Ok((FolderCompareStatus::Same, false));
    }

    // Content matches; metadata differs only by timestamp/attributes/size under active criteria.
    let unimportant = minor_metadata;
    Ok((FolderCompareStatus::Different, unimportant))
}

fn row_is_file_pair(row: &FolderAlignmentRow) -> bool {
    matches!(
        (&row.left, &row.right),
        (Some(left), Some(right))
            if left.kind == FolderNodeKind::File && right.kind == FolderNodeKind::File
    )
}

fn folder_side_entry(node: &FolderScanNode, root: &str) -> FolderCompareSideEntry {
    FolderCompareSideEntry {
        name: node.name.clone(),
        kind: folder_kind_label(&node.kind),
        size: node.metadata.size,
        modified_at_ms: node.metadata.modified_at_ms,
        path: side_path(root, &node.relative_path),
    }
}

fn side_path(root: &str, relative_path: &str) -> String {
    if relative_path.is_empty() {
        return root.to_owned();
    }

    Path::new(root)
        .join(relative_path)
        .display()
        .to_string()
        .replace('\\', "/")
}

fn validate_folder_relative_path(relative_path: &str) -> Result<(), AppErrorPayload> {
    let has_invalid_component = Path::new(relative_path).components().any(|component| {
        matches!(
            component,
            Component::ParentDir | Component::RootDir | Component::Prefix(_)
        )
    });

    if has_invalid_component {
        return Err(AppErrorPayload::new(
            AppErrorCode::Unknown,
            "error.folder.invalidRelativePath.message",
            format!("invalid folder relative path: {relative_path}"),
        )
        .with_param("path", relative_path)
        .with_suggestion_key("error.folder.invalidRelativePath.suggestion"));
    }

    Ok(())
}

fn folder_kind_label(kind: &FolderNodeKind) -> String {
    match kind {
        FolderNodeKind::File => "file",
        FolderNodeKind::Directory => "directory",
    }
    .to_owned()
}

fn folder_status_label(status: &FolderCompareStatus) -> String {
    match status {
        FolderCompareStatus::Same => "Same",
        FolderCompareStatus::Different => "Different",
        FolderCompareStatus::LeftOnly => "Left only",
        FolderCompareStatus::RightOnly => "Right only",
        FolderCompareStatus::Unknown | FolderCompareStatus::Error => "Different",
    }
    .to_owned()
}

fn increment_folder_summary(summary: &mut FolderCompareSummary, status: &str) {
    match status {
        "Same" => summary.same += 1,
        "Different" => summary.different += 1,
        "Left only" => summary.left_only += 1,
        "Right only" => summary.right_only += 1,
        _ => {}
    }
}

fn folder_sync_plan(
    left_root: &str,
    right_root: &str,
    strategy: &str,
    rows: &[FolderAlignmentRow],
) -> Result<sync_core::SyncPlan, AppErrorPayload> {
    match strategy {
        "updateRight" => Ok(sync_core::build_update_right_plan(
            left_root, right_root, rows,
        )),
        "updateLeft" => Ok(sync_core::build_update_left_plan(
            left_root, right_root, rows,
        )),
        "updateBoth" => Ok(sync_core::build_update_both_plan(
            left_root, right_root, rows,
        )),
        "mirrorRight" => Ok(sync_core::build_mirror_to_right_plan(
            left_root, right_root, rows,
        )),
        "mirrorLeft" => Ok(sync_core::build_mirror_to_left_plan(
            left_root, right_root, rows,
        )),
        unknown => Err(AppErrorPayload::new(
            AppErrorCode::Unknown,
            "error.folderSync.invalidStrategy.message",
            format!("unknown folder sync strategy: {unknown}"),
        )
        .with_param("strategy", unknown)
        .with_suggestion_key("error.folderSync.invalidStrategy.suggestion")),
    }
}

fn folder_sync_preview_row(item: &sync_core::SyncPlanItem) -> FolderSyncPreviewRow {
    let (action, source_path, target_path) = match &item.action {
        sync_core::SyncAction::Copy {
            source_path,
            target_path,
            ..
        } => (
            "Copy".to_owned(),
            Some(source_path.clone()),
            Some(target_path.clone()),
        ),
        sync_core::SyncAction::Delete { target_path } => {
            ("Delete".to_owned(), None, Some(target_path.clone()))
        }
        sync_core::SyncAction::Leave => ("Leave".to_owned(), None, None),
        sync_core::SyncAction::Conflict {
            left_path,
            right_path,
            ..
        } => (
            "Conflict".to_owned(),
            Some(left_path.clone()),
            Some(right_path.clone()),
        ),
    };

    FolderSyncPreviewRow {
        id: row_id_from_relative_path(&item.relative_path),
        relative_path: item.relative_path.clone(),
        action,
        source_path,
        target_path,
        detail: item.reason.clone(),
    }
}

fn row_id_from_relative_path(relative_path: &str) -> String {
    let mut id = String::new();

    for character in relative_path.chars() {
        if character.is_ascii_alphanumeric() {
            id.push(character.to_ascii_lowercase());
        } else if !id.ends_with('-') {
            id.push('-');
        }
    }

    let trimmed = id.trim_matches('-');

    if trimmed.is_empty() {
        "root".to_owned()
    } else {
        trimmed.to_owned()
    }
}

fn increment_folder_sync_summary(summary: &mut FolderSyncPreviewSummary, action: &str) {
    match action {
        "Copy" => summary.copy += 1,
        "Delete" => summary.delete += 1,
        "Leave" => summary.leave += 1,
        "Conflict" => summary.conflict += 1,
        _ => {}
    }
}

#[derive(Debug, Clone, PartialEq)]
struct LocalFolderSyncExecution {
    total: usize,
    succeeded: usize,
    failed: usize,
    cancelled: usize,
    logs: Vec<sync_core::SyncExecutionLogEntry>,
}

fn execute_local_folder_sync_plan(plan: &sync_core::SyncPlan) -> LocalFolderSyncExecution {
    let logs = plan
        .items
        .iter()
        .map(execute_local_folder_sync_item)
        .collect::<Vec<_>>();
    let succeeded = logs
        .iter()
        .filter(|log| log.status == sync_core::SyncExecutionStatus::Succeeded)
        .count();
    let failed = logs
        .iter()
        .filter(|log| log.status == sync_core::SyncExecutionStatus::Failed)
        .count();

    LocalFolderSyncExecution {
        total: logs.len(),
        succeeded,
        failed,
        cancelled: 0,
        logs,
    }
}

fn execute_local_folder_sync_item(
    item: &sync_core::SyncPlanItem,
) -> sync_core::SyncExecutionLogEntry {
    let (action, source_path, target_path, result) = match &item.action {
        sync_core::SyncAction::Copy {
            direction,
            source_path,
            target_path,
        } => (
            sync_direction_action_label(direction).to_owned(),
            Some(source_path.clone()),
            Some(target_path.clone()),
            copy_path_recursive(Path::new(source_path), Path::new(target_path))
                .map_err(|error| error.to_string()),
        ),
        sync_core::SyncAction::Delete { target_path } => (
            "delete".to_owned(),
            None,
            Some(target_path.clone()),
            delete_sync_target(target_path).map_err(|error| error.to_string()),
        ),
        sync_core::SyncAction::Leave => ("leave".to_owned(), None, None, Ok(())),
        sync_core::SyncAction::Conflict {
            left_path,
            right_path,
            ..
        } => (
            "leave".to_owned(),
            Some(left_path.clone()),
            Some(right_path.clone()),
            // Conflicts stay on disk until the user overrides them.
            Ok(()),
        ),
    };
    let (status, error) = match result {
        Ok(()) => (sync_core::SyncExecutionStatus::Succeeded, None),
        Err(error) => (sync_core::SyncExecutionStatus::Failed, Some(error)),
    };

    sync_core::SyncExecutionLogEntry {
        relative_path: item.relative_path.clone(),
        action,
        source_path,
        target_path,
        status,
        error,
    }
}

fn sync_direction_action_label(direction: &sync_core::SyncDirection) -> &'static str {
    match direction {
        sync_core::SyncDirection::LeftToRight => "copyLeftToRight",
        sync_core::SyncDirection::RightToLeft => "copyRightToLeft",
    }
}

fn delete_sync_target(target_path: &str) -> std::io::Result<()> {
    let target = Path::new(target_path);

    if !target.exists() {
        return Ok(());
    }

    if target.is_dir() {
        fs::remove_dir_all(target)
    } else {
        fs::remove_file(target)
    }
}

fn folder_merge_document(
    left_root: &str,
    base_root: &str,
    right_root: &str,
    output_root: &str,
) -> Result<folder_merge_core::FolderMergeDocument, AppErrorPayload> {
    let cancellation_token = job_core::CancellationToken::default();
    let base_tree = folder_core::scan_local_folder(base_root, &cancellation_token)
        .map_err(|error| folder_scan_error(base_root, error))?;
    let left_tree = folder_core::scan_local_folder(left_root, &cancellation_token)
        .map_err(|error| folder_scan_error(left_root, error))?;
    let right_tree = folder_core::scan_local_folder(right_root, &cancellation_token)
        .map_err(|error| folder_scan_error(right_root, error))?;

    Ok(folder_merge_core::FolderMergeDocument::from_inputs(
        folder_merge_core::FolderMergeInput {
            base: folder_merge_side(
                folder_merge_core::FolderMergeRole::Base,
                base_root,
                &base_tree,
            ),
            left: folder_merge_side(
                folder_merge_core::FolderMergeRole::Left,
                left_root,
                &left_tree,
            ),
            right: folder_merge_side(
                folder_merge_core::FolderMergeRole::Right,
                right_root,
                &right_tree,
            ),
            output_root: output_root.to_owned(),
        },
    ))
}

fn folder_merge_side(
    role: folder_merge_core::FolderMergeRole,
    root_path: &str,
    tree: &FolderScanNode,
) -> folder_merge_core::FolderMergeSide {
    let mut side = folder_merge_core::FolderMergeSide::new(role, root_path);

    collect_folder_merge_entries(tree, Path::new(root_path), &mut side.entries);

    side
}

fn collect_folder_merge_entries(
    node: &FolderScanNode,
    root: &Path,
    entries: &mut Vec<folder_merge_core::FolderMergeEntry>,
) {
    for child in &node.children {
        let kind = folder_merge_entry_kind(&child.kind);
        let content_fingerprint = match kind {
            folder_merge_core::FolderMergeEntryKind::File => {
                folder_merge_file_fingerprint(&root.join(&child.relative_path))
            }
            folder_merge_core::FolderMergeEntryKind::Directory => None,
        };

        entries.push(folder_merge_core::FolderMergeEntry {
            relative_path: child.relative_path.clone(),
            kind,
            content_fingerprint,
        });
        collect_folder_merge_entries(child, root, entries);
    }
}

fn folder_merge_file_fingerprint(path: &Path) -> Option<String> {
    let bytes = fs::read(path).ok()?;
    Some(stable_content_fingerprint(&bytes))
}

fn stable_content_fingerprint(bytes: &[u8]) -> String {
    let mut checksum: u64 = 0xcbf29ce484222325;

    for &byte in bytes {
        checksum ^= u64::from(byte);
        checksum = checksum.wrapping_mul(0x100000001b3);
    }

    format!("{checksum:016x}:{}", bytes.len())
}

fn folder_merge_entry_kind(kind: &FolderNodeKind) -> folder_merge_core::FolderMergeEntryKind {
    match kind {
        FolderNodeKind::File => folder_merge_core::FolderMergeEntryKind::File,
        FolderNodeKind::Directory => folder_merge_core::FolderMergeEntryKind::Directory,
    }
}

fn folder_merge_rows(document: &folder_merge_core::FolderMergeDocument) -> Vec<FolderMergePlanRow> {
    let side_index = folder_merge_side_index(document);
    let plan = folder_merge_core::build_folder_merge_plan(document);

    plan.actions
        .iter()
        .map(|action| folder_merge_row(action, &side_index))
        .collect()
}

fn folder_merge_side_index(
    document: &folder_merge_core::FolderMergeDocument,
) -> BTreeMap<String, FolderMergeIndexedSides> {
    let mut index = BTreeMap::<String, FolderMergeIndexedSides>::new();

    index_folder_merge_side(
        &document.base,
        |sides, entry| sides.base = Some(entry),
        &mut index,
    );
    index_folder_merge_side(
        &document.left,
        |sides, entry| sides.left = Some(entry),
        &mut index,
    );
    index_folder_merge_side(
        &document.right,
        |sides, entry| sides.right = Some(entry),
        &mut index,
    );

    index
}

#[derive(Debug, Clone, Default)]
struct FolderMergeIndexedSides {
    base: Option<folder_merge_core::FolderMergeEntry>,
    left: Option<folder_merge_core::FolderMergeEntry>,
    right: Option<folder_merge_core::FolderMergeEntry>,
}

fn index_folder_merge_side(
    side: &folder_merge_core::FolderMergeSide,
    apply: impl Fn(&mut FolderMergeIndexedSides, folder_merge_core::FolderMergeEntry),
    index: &mut BTreeMap<String, FolderMergeIndexedSides>,
) {
    for entry in &side.entries {
        let sides = index.entry(entry.relative_path.clone()).or_default();

        apply(sides, entry.clone());
    }
}

fn folder_merge_row(
    action: &folder_merge_core::FolderMergeAction,
    side_index: &BTreeMap<String, FolderMergeIndexedSides>,
) -> FolderMergePlanRow {
    let sides = side_index
        .get(&action.relative_path)
        .cloned()
        .unwrap_or_default();
    let path = action.relative_path.clone();

    FolderMergePlanRow {
        id: row_id_from_relative_path(&path),
        path: path.clone(),
        base: folder_merge_side_entry("Base", sides.base.as_ref()),
        left: folder_merge_side_entry("Left", sides.left.as_ref()),
        right: folder_merge_side_entry("Right", sides.right.as_ref()),
        action: folder_merge_action_label(&action.kind),
        detail: folder_merge_action_detail(action),
        conflict: action
            .conflict_detail
            .as_ref()
            .map(|conflict| folder_merge_conflict_detail(&path, conflict)),
    }
}

fn folder_merge_side_entry(
    role: &str,
    entry: Option<&folder_merge_core::FolderMergeEntry>,
) -> FolderMergeSideEntry {
    FolderMergeSideEntry {
        role: role.to_owned(),
        kind: entry
            .map(|entry| folder_merge_entry_kind_label(&entry.kind))
            .unwrap_or_else(|| "Missing".to_owned()),
        size: None,
        modified: None,
    }
}

fn folder_merge_entry_kind_label(kind: &folder_merge_core::FolderMergeEntryKind) -> String {
    match kind {
        folder_merge_core::FolderMergeEntryKind::File => "File",
        folder_merge_core::FolderMergeEntryKind::Directory => "Directory",
    }
    .to_owned()
}

fn folder_merge_action_label(kind: &folder_merge_core::FolderMergeActionKind) -> String {
    match kind {
        folder_merge_core::FolderMergeActionKind::KeepOutput => "Keep output",
        folder_merge_core::FolderMergeActionKind::CopyLeftToOutput => "Copy left to output",
        folder_merge_core::FolderMergeActionKind::CopyRightToOutput => "Copy right to output",
        folder_merge_core::FolderMergeActionKind::DeleteOutput => "Delete output",
        folder_merge_core::FolderMergeActionKind::MarkConflict => "Mark conflict",
    }
    .to_owned()
}

fn folder_merge_action_detail(action: &folder_merge_core::FolderMergeAction) -> String {
    match action.kind {
        folder_merge_core::FolderMergeActionKind::KeepOutput => {
            "All sides match; output keeps the current item."
        }
        folder_merge_core::FolderMergeActionKind::CopyLeftToOutput => {
            "Left added or retained an item that should be copied to output."
        }
        folder_merge_core::FolderMergeActionKind::CopyRightToOutput => {
            "Right added or retained an item that should be copied to output."
        }
        folder_merge_core::FolderMergeActionKind::DeleteOutput => {
            "The output item should be deleted for this path."
        }
        folder_merge_core::FolderMergeActionKind::MarkConflict => {
            "Left and right changed the same path differently."
        }
    }
    .to_owned()
}

fn folder_merge_conflict_detail(
    path: &str,
    conflict: &folder_merge_core::FolderMergeConflict,
) -> FolderMergeConflictDetail {
    FolderMergeConflictDetail {
        path: path.to_owned(),
        reason: folder_merge_conflict_reason_label(&conflict.reason),
        base_context: folder_merge_conflict_context("Base", conflict.base.as_ref()),
        left_context: folder_merge_conflict_context("Left", conflict.left.as_ref()),
        right_context: folder_merge_conflict_context("Right", conflict.right.as_ref()),
    }
}

fn folder_merge_conflict_reason_label(
    reason: &folder_merge_core::FolderMergeConflictReason,
) -> String {
    match reason {
        folder_merge_core::FolderMergeConflictReason::BothSidesChanged => {
            "Left and right changed the same path differently"
        }
        folder_merge_core::FolderMergeConflictReason::IncompatibleEntryKind => {
            "Entry kinds are incompatible across merge sides"
        }
    }
    .to_owned()
}

fn folder_merge_conflict_context(
    role: &str,
    entry: Option<&folder_merge_core::FolderMergeEntry>,
) -> String {
    match entry {
        Some(entry) => format!("{role}: {}", folder_merge_entry_kind_label(&entry.kind)),
        None => format!("{role}: Missing"),
    }
}

fn execute_folder_merge_action(
    action: &folder_merge_core::FolderMergeAction,
    left_root: &str,
    base_root: &str,
    right_root: &str,
    output_root: &str,
) -> FolderMergeExecutionRow {
    let execution = match action.kind {
        folder_merge_core::FolderMergeActionKind::CopyLeftToOutput => copy_folder_merge_source(
            left_root,
            output_root,
            &action.relative_path,
            "Copied from left to output.",
        ),
        folder_merge_core::FolderMergeActionKind::CopyRightToOutput => copy_folder_merge_source(
            right_root,
            output_root,
            &action.relative_path,
            "Copied from right to output.",
        ),
        folder_merge_core::FolderMergeActionKind::KeepOutput => {
            keep_or_seed_folder_merge_output(left_root, base_root, right_root, output_root, action)
        }
        folder_merge_core::FolderMergeActionKind::DeleteOutput => {
            delete_folder_merge_output(output_root, &action.relative_path)
        }
        folder_merge_core::FolderMergeActionKind::MarkConflict => (
            FolderMergeExecutionStatus::Conflict,
            "Skipped conflicting item.".to_owned(),
        ),
    };

    FolderMergeExecutionRow {
        path: action.relative_path.clone(),
        action: folder_merge_action_label(&action.kind),
        status: execution.0,
        detail: execution.1,
    }
}

fn copy_folder_merge_source(
    source_root: &str,
    output_root: &str,
    relative_path: &str,
    success_detail: &str,
) -> (FolderMergeExecutionStatus, String) {
    let source = folder_merge_path(source_root, relative_path);
    let target = folder_merge_path(output_root, relative_path);

    match copy_path_recursive(&source, &target) {
        Ok(()) => (
            FolderMergeExecutionStatus::Executed,
            success_detail.to_owned(),
        ),
        Err(error) => (
            FolderMergeExecutionStatus::Failed,
            format!("Failed: {error}"),
        ),
    }
}

fn keep_or_seed_folder_merge_output(
    left_root: &str,
    base_root: &str,
    right_root: &str,
    output_root: &str,
    action: &folder_merge_core::FolderMergeAction,
) -> (FolderMergeExecutionStatus, String) {
    let target = folder_merge_path(output_root, &action.relative_path);

    if target.exists() {
        return (
            FolderMergeExecutionStatus::Skipped,
            "Output already contains unchanged item.".to_owned(),
        );
    }

    [left_root, base_root, right_root]
        .iter()
        .map(|root| folder_merge_path(root, &action.relative_path))
        .find(|path| path.exists())
        .map(|source| match copy_path_recursive(&source, &target) {
            Ok(()) => (
                FolderMergeExecutionStatus::Executed,
                "Copied unchanged item to output.".to_owned(),
            ),
            Err(error) => (
                FolderMergeExecutionStatus::Failed,
                format!("Failed: {error}"),
            ),
        })
        .unwrap_or((
            FolderMergeExecutionStatus::Skipped,
            "No unchanged source item was found.".to_owned(),
        ))
}

fn delete_folder_merge_output(
    output_root: &str,
    relative_path: &str,
) -> (FolderMergeExecutionStatus, String) {
    let target = folder_merge_path(output_root, relative_path);

    if !target.exists() {
        return (
            FolderMergeExecutionStatus::Skipped,
            "Output item already absent.".to_owned(),
        );
    }

    let result = if target.is_dir() {
        fs::remove_dir_all(&target)
    } else {
        fs::remove_file(&target)
    };

    match result {
        Ok(()) => (
            FolderMergeExecutionStatus::Executed,
            "Deleted output item.".to_owned(),
        ),
        Err(error) => (
            FolderMergeExecutionStatus::Failed,
            format!("Failed: {error}"),
        ),
    }
}

fn copy_path_recursive(source: &Path, target: &Path) -> std::io::Result<()> {
    if source.is_dir() {
        if target.is_file() {
            fs::remove_file(target)?;
        }

        fs::create_dir_all(target)?;

        for entry in fs::read_dir(source)? {
            let entry = entry?;
            copy_path_recursive(&entry.path(), &target.join(entry.file_name()))?;
        }

        return Ok(());
    }

    if target.is_dir() {
        fs::remove_dir_all(target)?;
    }

    if let Some(parent) = target.parent() {
        fs::create_dir_all(parent)?;
    }

    fs::copy(source, target).map(|_| ())
}

fn folder_merge_path(root: &str, relative_path: &str) -> PathBuf {
    if relative_path.is_empty() {
        return PathBuf::from(root);
    }

    Path::new(root).join(relative_path)
}

fn summarize_folder_merge_execution(
    rows: &[FolderMergeExecutionRow],
) -> FolderMergeExecutionSummary {
    let mut summary = FolderMergeExecutionSummary {
        total: rows.len(),
        ..FolderMergeExecutionSummary::default()
    };

    for row in rows {
        match row.status {
            FolderMergeExecutionStatus::Executed => summary.executed += 1,
            FolderMergeExecutionStatus::Skipped => summary.skipped += 1,
            FolderMergeExecutionStatus::Conflict => summary.conflicts += 1,
            FolderMergeExecutionStatus::Failed => summary.failed += 1,
        }
    }

    summary
}

fn media_read_error(path: &str, error: MediaReadError) -> AppErrorPayload {
    AppErrorPayload::new(
        AppErrorCode::FileReadFailed,
        "error.media.readFailed.message",
        error.to_string(),
    )
    .with_param("path", path)
    .with_suggestion_key("error.media.readFailed.suggestion")
}

fn media_side_summary(document: &MediaDocument) -> MediaSideSummary {
    let stream = document.streams.first();

    MediaSideSummary {
        name: document.name.clone(),
        container: media_container_label(&document.container),
        duration: format_duration(document.duration.millis),
        stream: stream
            .map(media_stream_summary)
            .unwrap_or_else(empty_media_stream_summary),
    }
}

fn media_stream_summary(stream: &MediaStream) -> MediaStreamSummary {
    MediaStreamSummary {
        codec: media_codec_label(&stream.codec),
        sample_rate: stream
            .sample_rate_hz
            .filter(|value| *value > 0)
            .map(|value| format!("{:.1} kHz", value as f64 / 1000.0))
            .unwrap_or_else(|| "Unknown".to_owned()),
        channels: stream
            .channels
            .filter(|value| *value > 0)
            .map(|value| format!("{value} channels"))
            .unwrap_or_else(|| "Unknown".to_owned()),
        bitrate: stream
            .bitrate_bps
            .filter(|value| *value > 0)
            .map(|value| format!("{} kbps", value / 1000))
            .unwrap_or_else(|| "Unknown".to_owned()),
    }
}

fn empty_media_stream_summary() -> MediaStreamSummary {
    MediaStreamSummary {
        codec: "Unknown".to_owned(),
        sample_rate: "Unknown".to_owned(),
        channels: "Unknown".to_owned(),
        bitrate: "Unknown".to_owned(),
    }
}

fn format_duration(millis: u64) -> String {
    let minutes = millis / 60_000;
    let seconds = (millis % 60_000) / 1000;
    let remainder = millis % 1000;

    format!("{minutes:02}:{seconds:02}.{remainder:03}")
}

fn media_compare_summary(statistics: MediaDiffStatistics) -> MediaCompareSummary {
    MediaCompareSummary {
        added: statistics.added,
        removed: statistics.removed,
        modified: statistics.modified,
        unchanged: statistics.unchanged,
    }
}

fn media_container_label(container: &MediaContainer) -> String {
    match container {
        MediaContainer::Mp3 => "MP3",
        MediaContainer::Flac => "FLAC",
        MediaContainer::Mp4 => "MP4",
        MediaContainer::Ogg => "OGG",
        MediaContainer::Unknown => "Unknown",
    }
    .to_owned()
}

fn media_codec_label(codec: &MediaCodec) -> String {
    match codec {
        MediaCodec::Audio(codec) => audio_codec_label(codec),
        MediaCodec::Video(codec) => video_codec_label(codec),
        MediaCodec::Unknown(value) => value.clone(),
    }
}

fn audio_codec_label(codec: &AudioCodec) -> String {
    match codec {
        AudioCodec::Mp3 => "MP3",
        AudioCodec::Flac => "FLAC",
        AudioCodec::Aac => "AAC",
        AudioCodec::Vorbis => "Vorbis",
        AudioCodec::Opus => "Opus",
        AudioCodec::Pcm => "PCM",
        AudioCodec::Unknown(value) => value,
    }
    .to_owned()
}

fn video_codec_label(codec: &VideoCodec) -> String {
    match codec {
        VideoCodec::H264 => "H.264",
        VideoCodec::H265 => "H.265",
        VideoCodec::Av1 => "AV1",
        VideoCodec::Vp9 => "VP9",
        VideoCodec::Unknown(value) => value,
    }
    .to_owned()
}

fn media_field_status_label(status: MediaFieldStatus) -> String {
    match status {
        MediaFieldStatus::Added => "added",
        MediaFieldStatus::Removed => "removed",
        MediaFieldStatus::Modified => "modified",
        MediaFieldStatus::Unchanged => "unchanged",
    }
    .to_owned()
}

fn read_picture_path(path: &str) -> Result<DecodedImage, AppErrorPayload> {
    let bytes = fs::read(path).map_err(|error| file_io_error(path, error))?;

    image_core::decode_image(&bytes).map_err(|error| picture_read_error(path, error))
}

fn picture_read_error(path: &str, error: ImageDecodeError) -> AppErrorPayload {
    AppErrorPayload::new(
        AppErrorCode::FileReadFailed,
        "error.picture.readFailed.message",
        error.to_string(),
    )
    .with_param("path", path)
    .with_suggestion_key("error.picture.readFailed.suggestion")
}

fn picture_pixel_error(error: PixelDiffError) -> AppErrorPayload {
    AppErrorPayload::new(
        AppErrorCode::Unknown,
        "error.picture.readFailed.message",
        error.to_string(),
    )
    .with_suggestion_key("error.picture.readFailed.suggestion")
}

fn picture_side_summary(path: &str, metadata: &ImageMetadata) -> PictureSideSummary {
    PictureSideSummary {
        path: path.to_owned(),
        name: Path::new(path)
            .file_name()
            .and_then(|name| name.to_str())
            .unwrap_or(path)
            .to_owned(),
        format: image_format_label(&metadata.format),
        dimensions: picture_dimensions(metadata),
        color_depth: format!("{}-bit", metadata.color_depth_bits),
    }
}

fn picture_metadata_rows(left: &ImageMetadata, right: &ImageMetadata) -> Vec<PictureMetadataRow> {
    [
        (
            "dimensions",
            "Dimensions",
            picture_dimensions(left),
            picture_dimensions(right),
        ),
        (
            "format",
            "Format",
            image_format_label(&left.format),
            image_format_label(&right.format),
        ),
        (
            "color-depth",
            "Color Depth",
            format!("{}-bit", left.color_depth_bits),
            format!("{}-bit", right.color_depth_bits),
        ),
        (
            "alpha",
            "Alpha",
            left.color.has_alpha.to_string(),
            right.color.has_alpha.to_string(),
        ),
    ]
    .into_iter()
    .map(|(key, label, left, right)| PictureMetadataRow {
        key: key.to_owned(),
        label: label.to_owned(),
        status: if left == right { "equal" } else { "different" }.to_owned(),
        left,
        right,
    })
    .collect()
}

fn picture_dimensions(metadata: &ImageMetadata) -> String {
    format!("{} x {}", metadata.width, metadata.height)
}

fn image_format_label(format: &ImageFormat) -> String {
    match format {
        ImageFormat::Png => "PNG",
        ImageFormat::Jpeg => "JPEG",
        ImageFormat::WebP => "WebP",
        ImageFormat::Unknown => "Unknown",
    }
    .to_owned()
}

fn registry_error(error: registry_core::RegistryError) -> AppErrorPayload {
    AppErrorPayload::new(
        AppErrorCode::Unknown,
        "error.registry.parseFailed.message",
        format!("{error:?}"),
    )
    .with_suggestion_key("error.registry.parseFailed.suggestion")
}

fn compare_registry_documents(
    left_name: &str,
    right_name: &str,
    left: &registry_core::RegistryDocument,
    right: &registry_core::RegistryDocument,
) -> RegistryCompareResponse {
    let values = registry_value_rows(left, right);
    let mut summary = RegistryCompareSummary {
        added: 0,
        removed: 0,
        modified: 0,
        unchanged: 0,
    };

    for value in &values {
        increment_registry_summary(&mut summary, &value.status);
    }

    RegistryCompareResponse {
        left_name: left_name.to_owned(),
        right_name: right_name.to_owned(),
        tree: registry_key_tree(left, right, values),
        summary,
    }
}

fn registry_value_rows(
    left: &registry_core::RegistryDocument,
    right: &registry_core::RegistryDocument,
) -> Vec<RegistryValueRow> {
    let left_values = registry_value_map(left);
    let right_values = registry_value_map(right);
    let ids = left_values
        .keys()
        .chain(right_values.keys())
        .cloned()
        .collect::<BTreeSet<_>>();

    ids.into_iter()
        .filter_map(|id| {
            let left_value = left_values.get(&id);
            let right_value = right_values.get(&id);
            let value = left_value.or(right_value)?;
            let left_side = left_value.map(registry_value_side);
            let right_side = right_value.map(registry_value_side);
            let status = match (&left_side, &right_side) {
                (None, Some(_)) => "added",
                (Some(_), None) => "removed",
                (Some(left), Some(right)) if left == right => "unchanged",
                (Some(_), Some(_)) => "modified",
                (None, None) => "unchanged",
            };

            Some(RegistryValueRow {
                key_path: registry_key_display(value.hive, &value.key_path),
                name: value.name.clone(),
                status: status.to_owned(),
                left: left_side,
                right: right_side,
            })
        })
        .collect()
}

fn registry_value_map(
    document: &registry_core::RegistryDocument,
) -> BTreeMap<String, registry_core::RegistryValue> {
    document
        .all_values()
        .into_iter()
        .map(|value| {
            (
                format!(
                    "{}/{}",
                    registry_key_display(value.hive, &value.key_path),
                    value.name
                ),
                value.clone(),
            )
        })
        .collect()
}

fn registry_key_tree(
    left: &registry_core::RegistryDocument,
    right: &registry_core::RegistryDocument,
    values: Vec<RegistryValueRow>,
) -> Vec<RegistryKeyNode> {
    let value_groups = values.into_iter().fold(
        BTreeMap::<String, Vec<RegistryValueRow>>::new(),
        |mut groups, value| {
            groups
                .entry(value.key_path.clone())
                .or_default()
                .push(value);
            groups
        },
    );
    let key_paths = left
        .keys()
        .into_iter()
        .map(|key| registry_key_display(key.hive, &key.path))
        .chain(
            right
                .keys()
                .into_iter()
                .map(|key| registry_key_display(key.hive, &key.path)),
        )
        .chain(value_groups.keys().cloned())
        .collect::<BTreeSet<_>>();

    let child_map = key_paths.iter().fold(
        BTreeMap::<String, Vec<String>>::new(),
        |mut children, path| {
            let parent = registry_parent_key(path)
                .filter(|parent| key_paths.contains(parent))
                .unwrap_or_default();

            children.entry(parent).or_default().push(path.clone());
            children
        },
    );
    let left_key_paths = left
        .keys()
        .into_iter()
        .map(|key| registry_key_display(key.hive, &key.path))
        .collect::<BTreeSet<_>>();
    let right_key_paths = right
        .keys()
        .into_iter()
        .map(|key| registry_key_display(key.hive, &key.path))
        .collect::<BTreeSet<_>>();

    child_map
        .get("")
        .cloned()
        .unwrap_or_default()
        .into_iter()
        .map(|path| {
            registry_key_node(
                path,
                &child_map,
                &value_groups,
                &left_key_paths,
                &right_key_paths,
            )
        })
        .collect()
}

fn registry_key_node(
    path: String,
    child_map: &BTreeMap<String, Vec<String>>,
    value_groups: &BTreeMap<String, Vec<RegistryValueRow>>,
    left_key_paths: &BTreeSet<String>,
    right_key_paths: &BTreeSet<String>,
) -> RegistryKeyNode {
    let children = child_map
        .get(&path)
        .cloned()
        .unwrap_or_default()
        .into_iter()
        .map(|child| {
            registry_key_node(
                child,
                child_map,
                value_groups,
                left_key_paths,
                right_key_paths,
            )
        })
        .collect::<Vec<_>>();
    let values = value_groups.get(&path).cloned().unwrap_or_default();
    let status = registry_key_status(&path, &values, &children, left_key_paths, right_key_paths);

    RegistryKeyNode {
        label: registry_key_label(&path),
        path,
        status,
        values,
        children,
    }
}

fn registry_key_status(
    path: &str,
    values: &[RegistryValueRow],
    children: &[RegistryKeyNode],
    left_key_paths: &BTreeSet<String>,
    right_key_paths: &BTreeSet<String>,
) -> String {
    if left_key_paths.contains(path) && !right_key_paths.contains(path) {
        return "removed".to_owned();
    }

    if !left_key_paths.contains(path) && right_key_paths.contains(path) {
        return "added".to_owned();
    }

    if values.iter().any(|value| value.status != "unchanged")
        || children.iter().any(|child| child.status != "unchanged")
    {
        return "modified".to_owned();
    }

    "unchanged".to_owned()
}

fn registry_parent_key(path: &str) -> Option<String> {
    path.rsplit_once('/').map(|(parent, _)| parent.to_owned())
}

fn registry_key_label(path: &str) -> String {
    path.rsplit('/').next().unwrap_or(path).to_owned()
}

fn registry_key_display(hive: registry_core::RegistryHive, path: &str) -> String {
    if path.is_empty() {
        hive.short_name().to_owned()
    } else {
        format!("{}/{}", hive.short_name(), path)
    }
}

fn registry_value_side(value: &registry_core::RegistryValue) -> RegistryValueSide {
    let (kind, data) = registry_value_data_text(&value.data);

    RegistryValueSide { kind, data }
}

fn registry_value_data_text(data: &registry_core::RegistryValueData) -> (String, String) {
    match data {
        registry_core::RegistryValueData::String(value) => ("REG_SZ".to_owned(), value.clone()),
        registry_core::RegistryValueData::ExpandString(value) => {
            ("REG_EXPAND_SZ".to_owned(), value.clone())
        }
        registry_core::RegistryValueData::Dword(value) => {
            ("REG_DWORD".to_owned(), value.to_string())
        }
        registry_core::RegistryValueData::Qword(value) => {
            ("REG_QWORD".to_owned(), value.to_string())
        }
        registry_core::RegistryValueData::Binary(bytes) => (
            "REG_BINARY".to_owned(),
            bytes
                .iter()
                .map(|byte| format!("{byte:02x}"))
                .collect::<Vec<_>>()
                .join(" "),
        ),
        registry_core::RegistryValueData::MultiString(values) => {
            ("REG_MULTI_SZ".to_owned(), values.join("; "))
        }
        registry_core::RegistryValueData::None => ("REG_NONE".to_owned(), String::new()),
    }
}

fn increment_registry_summary(summary: &mut RegistryCompareSummary, status: &str) {
    match status {
        "added" => summary.added += 1,
        "removed" => summary.removed += 1,
        "modified" => summary.modified += 1,
        "unchanged" => summary.unchanged += 1,
        _ => {}
    }
}

#[cfg(any(windows, test))]
fn compare_version_files_from_reader(
    reader: &impl NativeVersionInfoReader,
    left_path: &str,
    right_path: &str,
) -> Result<VersionCompareResponse, AppErrorPayload> {
    let left = version_core::NativeVersionLoader::load_file(reader, left_path)
        .map_err(|error| version_read_error(left_path, error))?;
    let right = version_core::NativeVersionLoader::load_file(reader, right_path)
        .map_err(|error| version_read_error(right_path, error))?;
    let diff = version_core::compare_version_documents(&left, &right);

    Ok(VersionCompareResponse {
        left: version_side_summary(&left),
        right: version_side_summary(&right),
        fields: diff
            .fields
            .into_iter()
            .map(|field| VersionFieldRow {
                group: version_field_group(&field.field),
                field: field.field,
                left: field.left,
                right: field.right,
                status: version_field_status_label(field.status),
            })
            .collect(),
        summary: version_compare_summary(diff.statistics),
    })
}

#[cfg(any(windows, test))]
fn version_read_error(path: &str, error: VersionReadError) -> AppErrorPayload {
    AppErrorPayload::new(
        AppErrorCode::FileReadFailed,
        "error.version.readFailed.message",
        error.to_string(),
    )
    .with_param("path", path)
    .with_suggestion_key("error.version.readFailed.suggestion")
}

#[cfg(any(windows, test))]
fn version_side_summary(document: &VersionDocument) -> VersionSideSummary {
    let fixed_info = document.fixed_info.as_ref();

    VersionSideSummary {
        name: document.name.clone(),
        file_type: fixed_info
            .map(|info| version_file_type_label(&info.file_type))
            .unwrap_or_else(|| "Unknown".to_owned()),
        target_os: fixed_info
            .map(|info| version_target_os_label(&info.os))
            .unwrap_or_else(|| "Unknown".to_owned()),
        file_version: fixed_info
            .map(|info| info.file_version.to_string())
            .unwrap_or_else(|| "Unknown".to_owned()),
        product_version: fixed_info
            .map(|info| info.product_version.to_string())
            .unwrap_or_else(|| "Unknown".to_owned()),
    }
}

#[cfg(any(windows, test))]
fn version_compare_summary(statistics: VersionDiffStatistics) -> VersionCompareSummary {
    VersionCompareSummary {
        added: statistics.added,
        removed: statistics.removed,
        modified: statistics.modified,
        unchanged: statistics.unchanged,
    }
}

#[cfg(any(windows, test))]
fn version_field_group(field: &str) -> String {
    match field {
        "FileVersion" | "ProductVersion" => "Fixed Info",
        _ => "String Info",
    }
    .to_owned()
}

#[cfg(any(windows, test))]
fn version_field_status_label(status: VersionFieldStatus) -> String {
    match status {
        VersionFieldStatus::Added => "added",
        VersionFieldStatus::Removed => "removed",
        VersionFieldStatus::Modified => "modified",
        VersionFieldStatus::Unchanged => "unchanged",
    }
    .to_owned()
}

#[cfg(any(windows, test))]
fn version_file_type_label(file_type: &VersionFileType) -> String {
    match file_type {
        VersionFileType::Application => "Application",
        VersionFileType::DynamicLibrary => "Dynamic Library",
        VersionFileType::Driver => "Driver",
        VersionFileType::Font => "Font",
        VersionFileType::Unknown => "Unknown",
    }
    .to_owned()
}

#[cfg(any(windows, test))]
fn version_target_os_label(target_os: &VersionTargetOs) -> String {
    match target_os {
        VersionTargetOs::Windows16 => "Windows 16-bit",
        VersionTargetOs::Windows32 => "Windows 32-bit",
        VersionTargetOs::Dos => "DOS",
        VersionTargetOs::Os2 => "OS/2",
        VersionTargetOs::Unknown => "Unknown",
    }
    .to_owned()
}

fn file_len(path: &str) -> Result<u64, AppErrorPayload> {
    fs::metadata(path)
        .map(|metadata| metadata.len())
        .map_err(|error| file_io_error(path, error))
}

fn read_file_window(path: &str, offset: u64, length: usize) -> Result<Vec<u8>, AppErrorPayload> {
    let mut file = File::open(path).map_err(|error| file_io_error(path, error))?;
    file.seek(SeekFrom::Start(offset))
        .map_err(|error| file_io_error(path, error))?;
    let mut buffer = vec![0_u8; length];
    let read = file
        .read(&mut buffer)
        .map_err(|error| file_io_error(path, error))?;
    buffer.truncate(read);
    Ok(buffer)
}

fn shift_hex_cells(cells: Vec<hex_core::HexViewCell>, offset: u64) -> Vec<hex_core::HexViewCell> {
    cells
        .into_iter()
        .map(|mut cell| {
            cell.offset += offset;
            cell
        })
        .collect()
}

fn shift_binary_diff_ranges(
    ranges: Vec<hex_core::BinaryDiffRange>,
    offset: u64,
) -> Vec<hex_core::BinaryDiffRange> {
    ranges
        .into_iter()
        .map(|mut range| {
            range.offset += offset;
            range
        })
        .collect()
}

fn find_hex_matches_in_file(
    path: &str,
    query: hex_core::HexFindQuery,
) -> Result<Vec<hex_core::HexFindMatch>, AppErrorPayload> {
    let pattern = match &query {
        hex_core::HexFindQuery::Text(value) if value.is_empty() => {
            return Err(AppErrorPayload::new(
                AppErrorCode::Unknown,
                "error.app.unknown.title",
                "empty hex find query",
            ))
        }
        hex_core::HexFindQuery::Hex(value) if value.trim().is_empty() => {
            return Err(AppErrorPayload::new(
                AppErrorCode::Unknown,
                "error.app.unknown.title",
                "empty hex find query",
            ))
        }
        _ => hex_core::find_hex_matches(&[], query.clone())
            .map(|_| Vec::<hex_core::HexFindMatch>::new()),
    };
    let _ = pattern;
    let total_len = file_len(path)?;
    let mut matches = Vec::new();
    let mut offset = 0_u64;
    let chunk_size = 64 * 1024;

    while offset < total_len {
        let overlap = 64_u64;
        let read_offset = offset.saturating_sub(if offset == 0 { 0 } else { overlap });
        let bytes = read_file_window(path, read_offset, chunk_size + overlap as usize)?;
        let found = hex_core::find_hex_matches(&bytes, query.clone()).map_err(|error| {
            AppErrorPayload::new(
                AppErrorCode::Unknown,
                "error.app.unknown.title",
                format!("{error:?}"),
            )
        })?;

        for mut found_match in found {
            found_match.offset += read_offset;
            if found_match.offset >= offset {
                matches.push(found_match);
            }
        }

        if bytes.len() < chunk_size + if offset == 0 { 0 } else { overlap as usize } {
            break;
        }
        offset += chunk_size as u64;
    }

    Ok(matches)
}

fn load_table_workbook(
    content: &str,
    path: Option<&str>,
    format: Option<&str>,
    delimiter: Option<&str>,
) -> Result<TableWorkbook, AppErrorPayload> {
    let inferred = path
        .and_then(|value| Path::new(value).extension())
        .and_then(|value| value.to_str())
        .unwrap_or("")
        .to_ascii_lowercase();
    let format = format.unwrap_or("").to_ascii_lowercase();
    let is_excel = format == "xlsx"
        || format == "xls"
        || inferred == "xlsx"
        || inferred == "xls"
        || path.is_some_and(|value| value.ends_with(".xlsx") || value.ends_with(".xls"));

    if is_excel {
        let path = path.ok_or_else(|| {
            AppErrorPayload::new(
                AppErrorCode::Unknown,
                "error.table.parseFailed.message",
                "Excel compare requires a file path",
            )
            .with_suggestion_key("error.table.parseFailed.suggestion")
        })?;
        return table_core::read_excel_workbook(path).map_err(table_parse_error);
    }

    let source = if content.is_empty() {
        if let Some(path) = path {
            fs::read_to_string(path).map_err(|error| file_io_error(path, error))?
        } else {
            String::new()
        }
    } else {
        content.to_owned()
    };

    if format == "html" || inferred == "html" || inferred == "htm" {
        return table_core::parse_html_tables(&source).map_err(table_parse_error);
    }

    if let Some(delimiter) = delimiter.and_then(|value| value.chars().next()) {
        return table_core::parse_delimited_table(&source, delimiter).map_err(table_parse_error);
    }

    if format == "tsv" || inferred == "tsv" || inferred == "tab" {
        return table_core::parse_tsv(&source).map_err(table_parse_error);
    }

    table_core::parse_csv(&source).map_err(table_parse_error)
}

fn workbook_sheet_names(workbook: &TableWorkbook) -> Vec<String> {
    workbook
        .sheets
        .iter()
        .map(|sheet| sheet.name.clone())
        .collect()
}

fn resolve_compared_table_sheets<'a>(
    left_workbook: &'a TableWorkbook,
    right_workbook: &'a TableWorkbook,
    left_sheet: Option<&str>,
    right_sheet: Option<&str>,
) -> Result<(&'a TableSheet, &'a TableSheet), AppErrorPayload> {
    let left_name = left_sheet.filter(|value| !value.is_empty());
    let right_name = right_sheet.filter(|value| !value.is_empty());

    match (left_name, right_name) {
        (Some(left_name), Some(right_name)) => Ok((
            select_table_sheet(left_workbook, Some(left_name))?,
            select_table_sheet(right_workbook, Some(right_name))?,
        )),
        (Some(left_name), None) => {
            let left = select_table_sheet(left_workbook, Some(left_name))?;
            let right = select_table_sheet(right_workbook, Some(&left.name))
                .or_else(|_| select_table_sheet(right_workbook, None))?;
            Ok((left, right))
        }
        (None, Some(right_name)) => {
            let right = select_table_sheet(right_workbook, Some(right_name))?;
            let left = select_table_sheet(left_workbook, Some(&right.name))
                .or_else(|_| select_table_sheet(left_workbook, None))?;
            Ok((left, right))
        }
        (None, None) => {
            let mappings = table_core::map_sheets(
                left_workbook,
                right_workbook,
                &table_core::SheetMappingOptions {
                    case_sensitive: false,
                    manual_mappings: Vec::new(),
                },
            );
            if let Some(mapping) = mappings
                .iter()
                .find(|mapping| mapping.left_sheet.is_some() && mapping.right_sheet.is_some())
            {
                return Ok((
                    select_table_sheet(left_workbook, mapping.left_sheet.as_deref())?,
                    select_table_sheet(right_workbook, mapping.right_sheet.as_deref())?,
                ));
            }

            Ok((
                select_table_sheet(left_workbook, None)?,
                select_table_sheet(right_workbook, None)?,
            ))
        }
    }
}

fn select_table_sheet<'a>(
    workbook: &'a TableWorkbook,
    name: Option<&str>,
) -> Result<&'a TableSheet, AppErrorPayload> {
    if let Some(name) = name.filter(|value| !value.is_empty()) {
        return workbook
            .sheets
            .iter()
            .find(|sheet| sheet.name.eq_ignore_ascii_case(name))
            .ok_or_else(empty_table_error);
    }

    workbook.sheets.first().ok_or_else(empty_table_error)
}

fn apply_manual_table_mappings(
    mappings: &mut Vec<ColumnMapping>,
    left_sheet: &TableSheet,
    right_sheet: &TableSheet,
    manual_mappings: &Option<Vec<TableManualColumnMapping>>,
) {
    let Some(manual_mappings) = manual_mappings else {
        return;
    };

    for manual in manual_mappings {
        let left_name = manual.left_column.as_deref();
        let right_name = manual.right_column.as_deref();
        let left_column = left_name.and_then(|name| {
            left_sheet
                .columns
                .iter()
                .find(|column| column.name.eq_ignore_ascii_case(name))
        });
        let right_column = right_name.and_then(|name| {
            right_sheet
                .columns
                .iter()
                .find(|column| column.name.eq_ignore_ascii_case(name))
        });

        mappings.retain(|mapping| {
            mapping.left_column.as_deref() != left_name
                && mapping.right_column.as_deref() != right_name
        });
        mappings.push(ColumnMapping {
            left_column_index: left_column.map(|column| column.index),
            right_column_index: right_column.map(|column| column.index),
            left_column: left_column.map(|column| column.name.clone()),
            right_column: right_column.map(|column| column.name.clone()),
            source: ColumnMappingSource::Automatic,
        });
    }
}

fn column_name_ignored(name: Option<&str>, ignored: &[String]) -> bool {
    name.is_some_and(|value| {
        ignored
            .iter()
            .any(|ignored_name| ignored_name.eq_ignore_ascii_case(value))
    })
}

fn project_table_sheet(sheet: &TableSheet, mappings: &[ColumnMapping], left: bool) -> TableSheet {
    let columns = mappings
        .iter()
        .enumerate()
        .map(|(index, mapping)| table_core::TableColumn {
            index,
            name: if left {
                mapping
                    .left_column
                    .clone()
                    .or_else(|| mapping.right_column.clone())
                    .unwrap_or_else(|| format!("Column {index}"))
            } else {
                mapping
                    .right_column
                    .clone()
                    .or_else(|| mapping.left_column.clone())
                    .unwrap_or_else(|| format!("Column {index}"))
            },
        })
        .collect::<Vec<_>>();
    let rows = sheet
        .rows
        .iter()
        .map(|row| table_core::TableRow {
            index: row.index,
            cells: mappings
                .iter()
                .enumerate()
                .map(|(column_index, mapping)| {
                    let source_index = if left {
                        mapping.left_column_index
                    } else {
                        mapping.right_column_index
                    };
                    let value = source_index
                        .and_then(|index| {
                            row.cells
                                .iter()
                                .find(|cell| cell.column_index == index)
                                .map(|cell| cell.value.clone())
                        })
                        .unwrap_or(TableCellValue::Empty);

                    table_core::TableCell {
                        row_index: row.index,
                        column_index,
                        value,
                    }
                })
                .collect(),
        })
        .collect();

    TableSheet {
        name: sheet.name.clone(),
        index: sheet.index,
        columns,
        rows,
    }
}

fn picture_ignore_replacements(
    from: Option<Vec<u8>>,
    to: Option<Vec<u8>>,
) -> Vec<image_core::ColorReplacementRule> {
    match (rgba_from_bytes(from), rgba_from_bytes(to)) {
        (Some(from), Some(to)) => vec![image_core::ColorReplacementRule { from, to }],
        _ => Vec::new(),
    }
}

fn rgba_from_bytes(value: Option<Vec<u8>>) -> Option<[u8; 4]> {
    let value = value.filter(|bytes| bytes.len() >= 3)?;
    Some([
        value[0],
        value[1],
        value[2],
        value.get(3).copied().unwrap_or(255),
    ])
}

fn current_timestamp() -> String {
    std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map(|duration| duration.as_secs().to_string())
        .unwrap_or_else(|_| "0".to_owned())
}

fn report_row(
    label: &str,
    left: Option<String>,
    right: Option<String>,
    status: report_core::ReportRowStatus,
) -> report_core::ReportRow {
    report_core::ReportRow {
        label: label.to_owned(),
        left,
        right,
        status,
    }
}

fn write_rendered_report(
    report: &report_core::UnifiedReport,
    format: &str,
    output_path: Option<String>,
) -> Result<ExportReportResponse, AppErrorPayload> {
    let content = match format.to_ascii_lowercase().as_str() {
        "text" | "txt" => report_core::render_text_report(report),
        "json" => report_core::render_json_report(report).map_err(|error| {
            AppErrorPayload::new(
                AppErrorCode::Unknown,
                "error.app.unknown.title",
                error.to_string(),
            )
        })?,
        "xml" => report_core::render_xml_report(report),
        _ => report_core::render_html_report(report),
    };

    persist_report_content(format.to_owned(), content, output_path)
}

fn persist_report_content(
    format: String,
    content: String,
    output_path: Option<String>,
) -> Result<ExportReportResponse, AppErrorPayload> {
    if let Some(path) = output_path.as_ref() {
        if let Some(parent) = Path::new(path).parent() {
            if !parent.as_os_str().is_empty() {
                fs::create_dir_all(parent).map_err(|error| file_io_error(path, error))?;
            }
        }
        fs::write(path, &content).map_err(|error| file_io_error(path, error))?;
        let bytes_written = content.len() as u64;
        return Ok(ExportReportResponse {
            format,
            content,
            output_path,
            bytes_written: Some(bytes_written),
        });
    }

    Ok(ExportReportResponse {
        format,
        content,
        output_path: None,
        bytes_written: None,
    })
}

fn folder_report_to_unified(
    model: &folder_core::FolderReportModel,
    left_root: &str,
    right_root: &str,
) -> report_core::UnifiedReport {
    report_core::UnifiedReport::new(
        report_core::ReportKind::Folder,
        "Folder Compare",
        report_core::ReportMetadata {
            generated_at: current_timestamp(),
            left_source: Some(left_root.to_owned()),
            right_source: Some(right_root.to_owned()),
        },
    )
    .with_section(report_core::ReportSection {
        kind: report_core::ReportSectionKind::Summary,
        title: "Summary".to_owned(),
        rows: vec![
            report_row(
                "Same",
                Some(model.summary.same.to_string()),
                None,
                report_core::ReportRowStatus::Equal,
            ),
            report_row(
                "Different",
                Some(model.summary.different.to_string()),
                None,
                report_core::ReportRowStatus::Different,
            ),
            report_row(
                "Left only",
                Some(model.summary.left_only.to_string()),
                None,
                report_core::ReportRowStatus::Removed,
            ),
            report_row(
                "Right only",
                Some(model.summary.right_only.to_string()),
                None,
                report_core::ReportRowStatus::Added,
            ),
        ],
    })
    .with_section(report_core::ReportSection {
        kind: report_core::ReportSectionKind::Differences,
        title: "Paths".to_owned(),
        rows: model
            .rows
            .iter()
            .map(|row| report_core::ReportRow {
                label: row.relative_path.clone(),
                left: row.left_path.clone(),
                right: row.right_path.clone(),
                status: match row.status {
                    FolderCompareStatus::Same => report_core::ReportRowStatus::Equal,
                    FolderCompareStatus::LeftOnly => report_core::ReportRowStatus::Removed,
                    FolderCompareStatus::RightOnly => report_core::ReportRowStatus::Added,
                    _ => report_core::ReportRowStatus::Different,
                },
            })
            .collect(),
    })
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::fs;
    use std::path::PathBuf;
    use std::time::{Duration, SystemTime, UNIX_EPOCH};

    #[test]
    fn read_text_file_returns_localizable_not_found_error() {
        let error = read_text_file("C:/open-diff/missing.txt".to_owned())
            .expect_err("missing file should return a structured error");

        assert_eq!(error.code, AppErrorCode::FileNotFound);
        assert_eq!(error.message_key, "error.file.notFound.message");
        assert_eq!(
            error.params.get("path").map(String::as_str),
            Some("C:/open-diff/missing.txt")
        );
        assert_eq!(
            error.suggestion_key.as_deref(),
            Some("error.file.notFound.suggestion")
        );
    }

    #[test]
    fn compare_table_csv_returns_column_mappings_and_changed_cells() {
        let response = compare_table_csv(
            "SKU,Quantity\nA-1,12\n".to_owned(),
            "sku,Quantity\nA-1,14\n".to_owned(),
        )
        .expect("valid csv inputs should compare");

        assert_eq!(response.summary.row_count, 1);
        assert_eq!(response.summary.changed_cell_count, 1);
        assert_eq!(
            response.column_mappings[0].left_column.as_deref(),
            Some("SKU")
        );
        assert_eq!(
            response.column_mappings[0].right_column.as_deref(),
            Some("sku")
        );
        assert_eq!(response.changed_cells[0].left_value.as_deref(), Some("12"));
        assert_eq!(response.changed_cells[0].right_value.as_deref(), Some("14"));
    }

    #[test]
    fn compare_folder_paths_scans_local_roots_and_returns_alignment_rows() {
        let root = unique_temp_dir("folder-command");
        let left = root.join("left");
        let right = root.join("right");
        fs::create_dir_all(left.join("src")).expect("left fixture directory should be created");
        fs::create_dir_all(right.join("src")).expect("right fixture directory should be created");
        fs::write(left.join("src").join("main.ts"), "left").expect("left file should be writable");
        fs::write(right.join("src").join("main.ts"), "right")
            .expect("right file should be writable");
        fs::write(left.join("README.md"), "same").expect("left readme should be writable");
        fs::write(right.join("README.md"), "same").expect("right readme should be writable");

        let response = compare_folder_paths(
            left.display().to_string(),
            right.display().to_string(),
            None,
            None,
        )
        .expect("valid folders should compare");

        assert_eq!(response.left_root, left.display().to_string());
        assert_eq!(response.right_root, right.display().to_string());
        assert!(response.summary.total >= 2);
        assert!(response.summary.different >= 1);
        assert!(response
            .rows
            .iter()
            .any(|row| row.relative_path == "src/main.ts" && row.status == "Different"));
    }

    #[test]
    fn compare_folder_paths_uses_visible_criteria_instead_of_hidden_defaults() {
        let root = unique_temp_dir("folder-criteria");
        let left = root.join("left");
        let right = root.join("right");
        fs::create_dir_all(&left).expect("left");
        fs::create_dir_all(&right).expect("right");
        fs::write(left.join("same-size.bin"), b"aaaa").expect("left file");
        fs::write(right.join("same-size.bin"), b"bbbb").expect("right file");

        let size_only = compare_folder_paths(
            left.display().to_string(),
            right.display().to_string(),
            Some(FolderCompareCriteria {
                compare_size: true,
                compare_modified_time: false,
                compare_contents: false,
                compare_crc: false,
                compare_attributes: false,
                size_only_unimportant: false,
                follow_symlinks: false,
                timestamp_tolerance_ms: 0,
                ignore_daylight_saving_hour_offset: false,
            }),
            None,
        )
        .expect("size-only compare");
        let contents = compare_folder_paths(
            left.display().to_string(),
            right.display().to_string(),
            Some(FolderCompareCriteria {
                compare_size: true,
                compare_modified_time: false,
                compare_contents: true,
                compare_crc: false,
                compare_attributes: false,
                size_only_unimportant: false,
                follow_symlinks: false,
                timestamp_tolerance_ms: 0,
                ignore_daylight_saving_hour_offset: false,
            }),
            None,
        )
        .expect("contents compare");
        let crc = compare_folder_paths(
            left.display().to_string(),
            right.display().to_string(),
            Some(FolderCompareCriteria {
                compare_size: false,
                compare_modified_time: false,
                compare_contents: false,
                compare_crc: true,
                compare_attributes: false,
                size_only_unimportant: false,
                follow_symlinks: false,
                timestamp_tolerance_ms: 0,
                ignore_daylight_saving_hour_offset: false,
            }),
            None,
        )
        .expect("crc compare");

        assert!(size_only
            .rows
            .iter()
            .any(|row| row.relative_path == "same-size.bin" && row.status == "Same"));
        assert!(contents
            .rows
            .iter()
            .any(|row| row.relative_path == "same-size.bin" && row.status == "Different"));
        assert!(crc
            .rows
            .iter()
            .any(|row| row.relative_path == "same-size.bin" && row.status == "Different"));
        let _ = fs::remove_dir_all(root);
    }

    #[test]
    fn compare_folder_paths_honors_timestamp_tolerance_from_criteria() {
        let root = unique_temp_dir("folder-timestamp-tolerance");
        let left = root.join("left");
        let right = root.join("right");
        fs::create_dir_all(&left).expect("left");
        fs::create_dir_all(&right).expect("right");
        let left_file = left.join("note.txt");
        let right_file = right.join("note.txt");
        fs::write(&left_file, b"same").expect("left file");
        fs::write(&right_file, b"same").expect("right file");

        let left_time = UNIX_EPOCH + Duration::from_millis(1_000_000);
        let right_time = UNIX_EPOCH + Duration::from_millis(1_001_500);
        File::options()
            .write(true)
            .open(&left_file)
            .expect("open left")
            .set_modified(left_time)
            .expect("left mtime");
        File::options()
            .write(true)
            .open(&right_file)
            .expect("open right")
            .set_modified(right_time)
            .expect("right mtime");

        let strict = compare_folder_paths(
            left.display().to_string(),
            right.display().to_string(),
            Some(FolderCompareCriteria {
                compare_size: true,
                compare_modified_time: true,
                compare_contents: false,
                compare_crc: false,
                compare_attributes: false,
                size_only_unimportant: false,
                follow_symlinks: false,
                timestamp_tolerance_ms: 0,
                ignore_daylight_saving_hour_offset: false,
            }),
            None,
        )
        .expect("strict timestamp compare");
        let tolerant = compare_folder_paths(
            left.display().to_string(),
            right.display().to_string(),
            Some(FolderCompareCriteria {
                compare_size: true,
                compare_modified_time: true,
                compare_contents: false,
                compare_crc: false,
                compare_attributes: false,
                size_only_unimportant: false,
                follow_symlinks: false,
                timestamp_tolerance_ms: 2_000,
                ignore_daylight_saving_hour_offset: false,
            }),
            None,
        )
        .expect("tolerant timestamp compare");

        assert!(strict.rows.iter().any(|row| {
            row.relative_path == "note.txt" && row.status == "Different" && row.unimportant
        }));
        assert!(tolerant
            .rows
            .iter()
            .any(|row| row.relative_path == "note.txt"
                && row.status == "Same"
                && !row.unimportant));
        let _ = fs::remove_dir_all(root);
    }

    #[test]
    fn compare_folder_paths_marks_content_diffs_as_important_even_with_mtime_skew() {
        let root = unique_temp_dir("folder-minor-content");
        let left = root.join("left");
        let right = root.join("right");
        fs::create_dir_all(&left).expect("left");
        fs::create_dir_all(&right).expect("right");
        let left_file = left.join("note.txt");
        let right_file = right.join("note.txt");
        fs::write(&left_file, b"same-size!").expect("left file");
        fs::write(&right_file, b"different!").expect("right file");

        let left_time = UNIX_EPOCH + Duration::from_millis(1_000_000);
        let right_time = UNIX_EPOCH + Duration::from_millis(2_000_000);
        File::options()
            .write(true)
            .open(&left_file)
            .expect("open left")
            .set_modified(left_time)
            .expect("left mtime");
        File::options()
            .write(true)
            .open(&right_file)
            .expect("open right")
            .set_modified(right_time)
            .expect("right mtime");

        let response = compare_folder_paths(
            left.display().to_string(),
            right.display().to_string(),
            Some(FolderCompareCriteria {
                compare_size: true,
                compare_modified_time: true,
                compare_contents: true,
                compare_crc: false,
                compare_attributes: false,
                size_only_unimportant: false,
                follow_symlinks: false,
                timestamp_tolerance_ms: 0,
                ignore_daylight_saving_hour_offset: false,
            }),
            None,
        )
        .expect("content+mtime compare");

        assert!(response.rows.iter().any(|row| {
            row.relative_path == "note.txt" && row.status == "Different" && !row.unimportant
        }));
        let _ = fs::remove_dir_all(root);
    }

    #[test]
    fn compare_folder_paths_marks_attribute_only_diffs_as_minor() {
        let root = unique_temp_dir("folder-minor-attrib");
        let left = root.join("left");
        let right = root.join("right");
        fs::create_dir_all(&left).expect("left");
        fs::create_dir_all(&right).expect("right");
        let left_file = left.join("note.txt");
        let right_file = right.join("note.txt");
        fs::write(&left_file, b"same-bytes").expect("left file");
        fs::write(&right_file, b"same-bytes").expect("right file");
        let mut permissions = fs::metadata(&right_file)
            .expect("right metadata")
            .permissions();
        permissions.set_readonly(true);
        fs::set_permissions(&right_file, permissions).expect("set readonly");

        let response = compare_folder_paths(
            left.display().to_string(),
            right.display().to_string(),
            Some(FolderCompareCriteria {
                compare_size: true,
                compare_modified_time: false,
                compare_contents: true,
                compare_crc: false,
                compare_attributes: true,
                size_only_unimportant: false,
                follow_symlinks: false,
                timestamp_tolerance_ms: 0,
                ignore_daylight_saving_hour_offset: false,
            }),
            None,
        )
        .expect("attribute compare");

        assert!(response.rows.iter().any(|row| {
            row.relative_path == "note.txt" && row.status == "Different" && row.unimportant
        }));

        let ignored = compare_folder_paths(
            left.display().to_string(),
            right.display().to_string(),
            Some(FolderCompareCriteria {
                compare_size: true,
                compare_modified_time: false,
                compare_contents: true,
                compare_crc: false,
                compare_attributes: false,
                size_only_unimportant: false,
                follow_symlinks: false,
                timestamp_tolerance_ms: 0,
                ignore_daylight_saving_hour_offset: false,
            }),
            None,
        )
        .expect("attributes off");

        assert!(ignored.rows.iter().any(|row| {
            row.relative_path == "note.txt" && row.status == "Same" && !row.unimportant
        }));

        #[cfg(unix)]
        {
            use std::os::unix::fs::PermissionsExt;
            let mut permissions = fs::metadata(&right_file)
                .expect("right metadata cleanup")
                .permissions();
            permissions.set_mode(0o644);
            fs::set_permissions(&right_file, permissions).expect("clear readonly");
        }
        #[cfg(not(unix))]
        {
            let mut permissions = fs::metadata(&right_file)
                .expect("right metadata cleanup")
                .permissions();
            #[allow(clippy::permissions_set_readonly_false)]
            {
                permissions.set_readonly(false);
            }
            fs::set_permissions(&right_file, permissions).expect("clear readonly");
        }
        let _ = fs::remove_dir_all(root);
    }

    #[test]
    fn compare_folder_paths_marks_size_only_diffs_as_minor_when_enabled() {
        let root = unique_temp_dir("folder-minor-size");
        let left = root.join("left");
        let right = root.join("right");
        fs::create_dir_all(&left).expect("left");
        fs::create_dir_all(&right).expect("right");
        fs::write(left.join("note.txt"), b"short").expect("left file");
        fs::write(right.join("note.txt"), b"longer-bytes").expect("right file");

        let enabled = compare_folder_paths(
            left.display().to_string(),
            right.display().to_string(),
            Some(FolderCompareCriteria {
                compare_size: true,
                compare_modified_time: false,
                compare_contents: false,
                compare_crc: false,
                compare_attributes: false,
                size_only_unimportant: true,
                follow_symlinks: false,
                timestamp_tolerance_ms: 0,
                ignore_daylight_saving_hour_offset: false,
            }),
            None,
        )
        .expect("size-only minor");

        assert!(enabled.rows.iter().any(|row| {
            row.relative_path == "note.txt" && row.status == "Different" && row.unimportant
        }));

        let disabled = compare_folder_paths(
            left.display().to_string(),
            right.display().to_string(),
            Some(FolderCompareCriteria {
                compare_size: true,
                compare_modified_time: false,
                compare_contents: false,
                compare_crc: false,
                compare_attributes: false,
                size_only_unimportant: false,
                follow_symlinks: false,
                timestamp_tolerance_ms: 0,
                ignore_daylight_saving_hour_offset: false,
            }),
            None,
        )
        .expect("size-only off");

        assert!(disabled.rows.iter().any(|row| {
            row.relative_path == "note.txt" && row.status == "Different" && !row.unimportant
        }));

        let _ = fs::remove_dir_all(root);
    }

    #[test]
    fn preview_folder_sync_scans_local_roots_and_returns_sync_actions() {
        let root = unique_temp_dir("folder-sync-command");
        let left = root.join("left");
        let right = root.join("right");
        fs::create_dir_all(left.join("package")).expect("left fixture directory should be created");
        fs::create_dir_all(right.join("prod")).expect("right fixture directory should be created");
        fs::write(left.join("package").join("app.exe"), "left")
            .expect("left app should be writable");
        fs::write(right.join("prod").join("old.dll"), "right")
            .expect("right old file should be writable");

        let response = preview_folder_sync(
            left.display().to_string(),
            right.display().to_string(),
            "mirrorRight".to_owned(),
        )
        .expect("valid folders should build a sync preview");

        assert_eq!(response.left_root, left.display().to_string());
        assert_eq!(response.right_root, right.display().to_string());
        assert_eq!(response.strategy, "mirrorRight");
        assert!(response.summary.copy >= 1);
        assert!(response.summary.delete >= 1);
        assert!(response
            .rows
            .iter()
            .any(|row| row.relative_path == "package/app.exe" && row.action == "Copy"));
        assert!(response
            .rows
            .iter()
            .any(|row| row.relative_path == "prod/old.dll" && row.action == "Delete"));
    }

    #[test]
    fn execute_folder_sync_applies_copy_and_delete_actions() {
        let root = unique_temp_dir("folder-sync-execute-command");
        let left = root.join("left");
        let right = root.join("right");
        fs::create_dir_all(left.join("package")).expect("left fixture directory should be created");
        fs::create_dir_all(right.join("prod")).expect("right fixture directory should be created");
        fs::write(left.join("package").join("app.exe"), "left")
            .expect("left app should be writable");
        fs::write(right.join("prod").join("old.dll"), "right")
            .expect("right old file should be writable");

        let response = execute_folder_sync(
            left.display().to_string(),
            right.display().to_string(),
            "mirrorRight".to_owned(),
            None,
        )
        .expect("valid folders should execute a sync plan");

        assert_eq!(response.strategy, "mirrorRight");
        assert_eq!(response.failed, 0);
        assert!(response.succeeded >= 2);
        assert_eq!(
            fs::read_to_string(right.join("package").join("app.exe"))
                .expect("copied app should be readable"),
            "left"
        );
        assert!(!right.join("prod").join("old.dll").exists());
    }

    #[test]
    fn build_folder_merge_plan_scans_local_roots_and_returns_actions() {
        let root = unique_temp_dir("folder-merge-command");
        let base = root.join("base");
        let left = root.join("left");
        let right = root.join("right");
        let output = root.join("output");

        fs::create_dir_all(&base).expect("base directory should be created");
        fs::create_dir_all(&left).expect("left directory should be created");
        fs::create_dir_all(&right).expect("right directory should be created");
        fs::create_dir_all(base.join("config")).expect("base config directory should be created");
        fs::create_dir_all(right.join("config")).expect("right config directory should be created");
        fs::create_dir_all(&output).expect("output directory should be created");
        fs::write(base.join("same.txt"), "same").expect("base same file should be writable");
        fs::write(left.join("same.txt"), "same").expect("left same file should be writable");
        fs::write(right.join("same.txt"), "same").expect("right same file should be writable");
        fs::write(left.join("left-add.txt"), "left").expect("left add file should be writable");
        fs::write(right.join("right-add.txt"), "right").expect("right add file should be writable");
        fs::write(base.join("delete.txt"), "base").expect("base delete file should be writable");
        fs::write(left.join("delete.txt"), "left").expect("left delete file should be writable");
        fs::write(left.join("config"), "file").expect("left config file should be writable");

        let response = build_folder_merge_plan(
            left.display().to_string(),
            base.display().to_string(),
            right.display().to_string(),
            output.display().to_string(),
        )
        .expect("valid folders should build a merge plan");

        assert_eq!(response.left_root, left.display().to_string());
        assert_eq!(response.base_root, base.display().to_string());
        assert_eq!(response.right_root, right.display().to_string());
        assert_eq!(response.output_root, output.display().to_string());
        assert_eq!(response.summary.conflicts, 1);
        assert!(response
            .rows
            .iter()
            .any(|row| row.path == "same.txt" && row.action == "Keep output"));
        assert!(response
            .rows
            .iter()
            .any(|row| row.path == "left-add.txt" && row.action == "Copy left to output"));
        assert!(response
            .rows
            .iter()
            .any(|row| row.path == "right-add.txt" && row.action == "Copy right to output"));
        assert!(response
            .rows
            .iter()
            .any(|row| row.path == "delete.txt" && row.action == "Delete output"));
        assert!(response.rows.iter().any(|row| {
            row.path == "config"
                && row.action == "Mark conflict"
                && row
                    .conflict
                    .as_ref()
                    .map(|conflict| conflict.left_context.as_str())
                    == Some("Left: File")
        }));
    }

    #[test]
    fn folder_compare_file_operation_commands_apply_local_changes() {
        let root = unique_temp_dir("folder-operation-command");
        let left = root.join("left");
        let right = root.join("right");
        fs::create_dir_all(left.join("src")).expect("left fixture directory should be created");
        fs::create_dir_all(right.join("src")).expect("right fixture directory should be created");
        fs::write(left.join("src").join("main.ts"), "left").expect("left file should be writable");
        fs::write(right.join("src").join("main.ts"), "right")
            .expect("right file should be writable");

        let copy = copy_folder_compare_entry(
            left.display().to_string(),
            right.display().to_string(),
            "src/main.ts".to_owned(),
            folder_core::CopyDirection::ToRight,
        )
        .expect("folder compare copy should overwrite the target side");

        assert_eq!(
            copy.refreshed_status,
            folder_core::FolderCompareStatus::Same
        );
        assert_eq!(
            fs::read_to_string(right.join("src").join("main.ts"))
                .expect("copied file should be readable"),
            "left"
        );

        let renamed = rename_folder_entry(
            right.join("src").join("main.ts").display().to_string(),
            "app.ts".to_owned(),
        )
        .expect("rename should move the selected file");

        assert_eq!(renamed.status, folder_core::FileOperationStatus::Renamed);
        assert!(right.join("src").join("app.ts").exists());

        let metadata = change_folder_entry_attributes(
            right.join("src").join("app.ts").display().to_string(),
            Some(true),
        )
        .expect("attribute update should refresh metadata");

        assert!(metadata.metadata.readonly);

        change_folder_entry_attributes(
            right.join("src").join("app.ts").display().to_string(),
            Some(false),
        )
        .expect("attribute update should restore writable metadata");

        let touched = touch_folder_entry(
            right.join("src").join("app.ts").display().to_string(),
            1_782_864_000_000,
        )
        .expect("touch should update modified timestamp");

        assert_eq!(
            touched.path,
            right.join("src").join("app.ts").display().to_string()
        );

        let deleted = delete_folder_entry(right.join("src").join("app.ts").display().to_string())
            .expect("delete should remove the selected file");

        assert_eq!(deleted.status, folder_core::FileOperationStatus::Deleted);
        assert!(!right.join("src").join("app.ts").exists());
    }

    #[test]
    fn execute_folder_merge_plan_writes_automatic_actions_to_output() {
        let root = unique_temp_dir("folder-merge-execute-command");
        let base = root.join("base");
        let left = root.join("left");
        let right = root.join("right");
        let output = root.join("output");

        fs::create_dir_all(base.join("config")).expect("base config directory should be created");
        fs::create_dir_all(&left).expect("left directory should be created");
        fs::create_dir_all(right.join("config")).expect("right config directory should be created");
        fs::create_dir_all(&output).expect("output directory should be created");
        fs::write(base.join("same.txt"), "same").expect("base same file should be writable");
        fs::write(left.join("same.txt"), "same").expect("left same file should be writable");
        fs::write(right.join("same.txt"), "same").expect("right same file should be writable");
        fs::write(left.join("left-add.txt"), "left").expect("left add file should be writable");
        fs::write(right.join("right-add.txt"), "right").expect("right add file should be writable");
        fs::write(base.join("delete.txt"), "base").expect("base delete file should be writable");
        fs::write(right.join("delete.txt"), "right").expect("right delete file should be writable");
        fs::write(output.join("delete.txt"), "output")
            .expect("output delete file should be writable");
        fs::write(left.join("config"), "file").expect("left config file should be writable");

        let response = execute_folder_merge_plan(
            left.display().to_string(),
            base.display().to_string(),
            right.display().to_string(),
            output.display().to_string(),
        )
        .expect("valid folders should execute automatic merge actions");

        assert_eq!(response.summary.conflicts, 1);
        assert_eq!(response.summary.failed, 0);
        assert!(response.summary.executed >= 4);
        assert_eq!(
            fs::read_to_string(output.join("same.txt")).expect("same output should be readable"),
            "same"
        );
        assert_eq!(
            fs::read_to_string(output.join("left-add.txt"))
                .expect("left add output should be readable"),
            "left"
        );
        assert_eq!(
            fs::read_to_string(output.join("right-add.txt"))
                .expect("right add output should be readable"),
            "right"
        );
        assert!(!output.join("delete.txt").exists());
    }

    #[test]
    fn execute_folder_merge_plan_marks_content_conflicts_and_skips_them() {
        let root = unique_temp_dir("folder-merge-content-conflict");
        let base = root.join("base");
        let left = root.join("left");
        let right = root.join("right");
        let output = root.join("output");

        fs::create_dir_all(&base).expect("base directory should be created");
        fs::create_dir_all(&left).expect("left directory should be created");
        fs::create_dir_all(&right).expect("right directory should be created");
        fs::create_dir_all(&output).expect("output directory should be created");
        fs::write(base.join("notes.txt"), "base notes").expect("base notes should be writable");
        fs::write(left.join("notes.txt"), "left notes").expect("left notes should be writable");
        fs::write(right.join("notes.txt"), "right notes").expect("right notes should be writable");
        fs::write(left.join("left-only.txt"), "only left").expect("left-only should be writable");

        let plan = build_folder_merge_plan(
            left.display().to_string(),
            base.display().to_string(),
            right.display().to_string(),
            output.display().to_string(),
        )
        .expect("valid folders should build a merge plan");

        assert!(plan.rows.iter().any(|row| {
            row.path == "notes.txt" && row.action == "Mark conflict" && row.conflict.is_some()
        }));
        assert!(plan
            .rows
            .iter()
            .any(|row| row.path == "left-only.txt" && row.action == "Copy left to output"));

        let response = execute_folder_merge_plan(
            left.display().to_string(),
            base.display().to_string(),
            right.display().to_string(),
            output.display().to_string(),
        )
        .expect("valid folders should execute automatic merge actions");

        assert_eq!(response.summary.conflicts, 1);
        assert_eq!(response.summary.failed, 0);
        assert!(!output.join("notes.txt").exists());
        assert_eq!(
            fs::read_to_string(output.join("left-only.txt"))
                .expect("left-only output should be readable"),
            "only left"
        );
    }

    #[test]
    fn compare_registry_exports_returns_key_tree_and_value_diffs() {
        let left = r#"Windows Registry Editor Version 5.00

[HKEY_CURRENT_USER\Software\OpenDiff]
"Theme"="dark"
"AutoSave"=dword:00000001
"#;
        let right = r#"Windows Registry Editor Version 5.00

[HKEY_CURRENT_USER\Software\OpenDiff]
"Theme"="light"
"AutoSave"=dword:00000001
"#;

        let response = compare_registry_exports(
            left.to_owned(),
            right.to_owned(),
            Some("left.reg".to_owned()),
            Some("right.reg".to_owned()),
        )
        .expect("valid registry exports should compare");

        assert_eq!(response.left_name, "left.reg");
        assert_eq!(response.right_name, "right.reg");
        assert_eq!(response.summary.modified, 1);
        assert_eq!(response.summary.unchanged, 1);
        assert_eq!(response.tree[0].path, "HKCU/Software/OpenDiff");
        assert_eq!(response.tree[0].status, "modified");
        assert_eq!(response.tree[0].values[0].name, "AutoSave");
        assert_eq!(response.tree[0].values[1].name, "Theme");
        assert_eq!(response.tree[0].values[1].status, "modified");
        assert_eq!(
            response.tree[0].values[1]
                .right
                .as_ref()
                .map(|side| side.data.as_str()),
            Some("light")
        );
    }

    #[test]
    fn compare_hex_files_reads_binary_windows_and_marks_diffs() {
        let root = unique_temp_dir("hex-command");
        fs::create_dir_all(&root).expect("fixture directory should be created");
        let left = root.join("left.bin");
        let right = root.join("right.bin");

        fs::write(&left, b"ABCD").expect("left fixture should be writable");
        fs::write(&right, b"AXCD").expect("right fixture should be writable");

        let response = compare_hex_files(
            left.display().to_string(),
            right.display().to_string(),
            Some(HexOffsetArg::Unsigned(0)),
            Some(16),
        )
        .expect("valid binary fixtures should compare");

        assert_eq!(response.summary.left_bytes, 4);
        assert_eq!(response.summary.right_bytes, 4);
        assert_eq!(response.summary.different_ranges, 1);
        assert_eq!(response.left.cells[1].hex, "42");
        assert_eq!(response.right.cells[1].hex, "58");
        assert!(response.left.cells[1].different);
        assert!(response.right.cells[1].different);
        assert_eq!(response.diff_ranges[0].offset, 1);
    }

    #[test]
    fn compare_media_files_reads_tags_and_returns_field_diffs() {
        let root = unique_temp_dir("media-command");
        fs::create_dir_all(&root).expect("fixture directory should be created");
        let left = root.join("left.mp3");
        let right = root.join("right.mp3");

        fs::write(
            &left,
            fixture_mp3_with_text_frames(&[("TIT2", "Left Song"), ("TPE1", "Aster")]),
        )
        .expect("left fixture should be writable");
        fs::write(
            &right,
            fixture_mp3_with_text_frames(&[("TIT2", "Right Song"), ("TPE1", "Aster")]),
        )
        .expect("right fixture should be writable");

        let response = compare_media_files(left.display().to_string(), right.display().to_string())
            .expect("valid media fixtures should compare");

        assert_eq!(response.left.name, "left.mp3");
        assert_eq!(response.right.name, "right.mp3");
        assert_eq!(response.summary.modified, 1);
        assert_eq!(response.summary.unchanged, 1);
        assert_eq!(
            response
                .fields
                .iter()
                .find(|field| field.field == "Title")
                .expect("title row should exist")
                .left
                .as_deref(),
            Some("Left Song")
        );
    }

    #[test]
    fn compare_picture_files_reads_images_and_returns_pixel_statistics() {
        let root = unique_temp_dir("picture-command");
        fs::create_dir_all(&root).expect("fixture directory should be created");
        let left = root.join("left.png");
        let right = root.join("right.png");

        fs::write(&left, fixture_png(&[[255, 0, 0, 255], [0, 128, 255, 255]]))
            .expect("left fixture should be writable");
        fs::write(&right, fixture_png(&[[255, 0, 0, 255], [0, 255, 0, 255]]))
            .expect("right fixture should be writable");

        let response = compare_picture_files(
            left.display().to_string(),
            right.display().to_string(),
            None,
            None,
            None,
            None,
            None,
        )
        .expect("valid image fixtures should compare");

        assert_eq!(response.left.name, "left.png");
        assert_eq!(response.right.name, "right.png");
        assert_eq!(response.statistics.total_pixels, 2);
        assert_eq!(response.statistics.different_pixels, 1);
        assert_eq!(
            response
                .statistics
                .bounding_rect
                .expect("bounding rect should exist")
                .x,
            1
        );
        assert!(response
            .metadata_rows
            .iter()
            .any(|row| row.key == "dimensions"));
    }

    #[test]
    fn compare_version_files_from_reader_returns_fixed_and_string_diffs() {
        let reader = version_core::MemoryVersionInfoReader::new()
            .with_document(
                "C:/apps/left.exe",
                version_core::VersionDocument::new("left.exe")
                    .with_fixed_info(version_core::VersionFixedInfo {
                        file_version: version_core::VersionNumber::new(1, 0, 0, 0),
                        product_version: version_core::VersionNumber::new(1, 0, 0, 0),
                        file_flags: Vec::new(),
                        file_type: version_core::VersionFileType::Application,
                        os: version_core::VersionTargetOs::Windows32,
                    })
                    .with_string("CompanyName", "Open Diff"),
            )
            .with_document(
                "C:/apps/right.exe",
                version_core::VersionDocument::new("right.exe")
                    .with_fixed_info(version_core::VersionFixedInfo {
                        file_version: version_core::VersionNumber::new(1, 1, 0, 0),
                        product_version: version_core::VersionNumber::new(1, 0, 0, 0),
                        file_flags: Vec::new(),
                        file_type: version_core::VersionFileType::Application,
                        os: version_core::VersionTargetOs::Windows32,
                    })
                    .with_string("CompanyName", "Open Diff"),
            );

        let response =
            compare_version_files_from_reader(&reader, "C:/apps/left.exe", "C:/apps/right.exe")
                .expect("fixtures should compare");

        assert_eq!(response.left.name, "left.exe");
        assert_eq!(response.right.name, "right.exe");
        assert_eq!(response.summary.modified, 1);
        assert_eq!(response.summary.unchanged, 2);
        assert_eq!(
            response
                .fields
                .iter()
                .find(|field| field.field == "FileVersion")
                .expect("file version row should exist")
                .right
                .as_deref(),
            Some("1.1.0.0")
        );
    }

    fn fixture_mp3_with_text_frames(frames: &[(&str, &str)]) -> Vec<u8> {
        let frame_bytes = frames
            .iter()
            .flat_map(|(id, value)| id3_text_frame(id, value))
            .collect::<Vec<_>>();
        let mut bytes = b"ID3\x03\x00\x00".to_vec();

        bytes.extend(syncsafe(frame_bytes.len() as u32));
        bytes.extend(frame_bytes);
        bytes.extend(b"MPEG");
        bytes
    }

    fn id3_text_frame(id: &str, value: &str) -> Vec<u8> {
        let mut payload = vec![0];
        payload.extend(value.as_bytes());
        let mut frame = id.as_bytes().to_vec();

        frame.extend((payload.len() as u32).to_be_bytes());
        frame.extend([0, 0]);
        frame.extend(payload);
        frame
    }

    fn fixture_png(pixels: &[[u8; 4]; 2]) -> Vec<u8> {
        let mut bytes = std::io::Cursor::new(Vec::new());

        image::RgbaImage::from_raw(2, 1, pixels.iter().flatten().copied().collect())
            .expect("fixture pixels should match dimensions")
            .write_to(&mut bytes, image::ImageFormat::Png)
            .expect("fixture image should encode");

        bytes.into_inner()
    }

    fn syncsafe(value: u32) -> [u8; 4] {
        [
            ((value >> 21) & 0x7f) as u8,
            ((value >> 14) & 0x7f) as u8,
            ((value >> 7) & 0x7f) as u8,
            (value & 0x7f) as u8,
        ]
    }

    #[test]
    fn compare_table_supports_tsv_key_columns_and_ignored_columns() {
        let response = compare_table(
            "id\tname\tnote\n1\talpha\tkeep\n".to_owned(),
            "id\tname\tnote\n1\tbeta\tdrop\n".to_owned(),
            Some("tsv".to_owned()),
            None,
            None,
            None,
            None,
            Some(vec![0]),
            Some(vec!["note".to_owned()]),
            None,
            None,
        )
        .expect("valid tsv inputs should compare");

        assert_eq!(response.left_sheet, "Sheet1");
        assert_eq!(response.summary.changed_cell_count, 1);
        assert_eq!(
            response.changed_cells[0].left_value.as_deref(),
            Some("alpha")
        );
        assert_eq!(
            response.changed_cells[0].right_value.as_deref(),
            Some("beta")
        );
        assert!(response
            .column_mappings
            .iter()
            .all(|mapping| mapping.left_column.as_deref() != Some("note")));
    }

    #[test]
    fn merge_text_files_loads_real_conflicts() {
        let root = unique_temp_dir("merge-command");
        fs::create_dir_all(&root).expect("fixture directory should be created");
        let base = root.join("base.txt");
        let left = root.join("left.txt");
        let right = root.join("right.txt");
        fs::write(&base, "one\ntwo\nthree").expect("base should be writable");
        fs::write(&left, "one\nleft change\nthree").expect("left should be writable");
        fs::write(&right, "one\nright change\nthree").expect("right should be writable");

        let response = merge_text_files(
            left.display().to_string(),
            right.display().to_string(),
            Some(base.display().to_string()),
            Some(root.join("out.txt").display().to_string()),
            None,
        )
        .expect("valid merge inputs should load");

        assert_eq!(response.conflicts.len(), 1);
        assert_eq!(response.conflicts[0].left, "left change");
        assert_eq!(response.conflicts[0].right, "right change");
        assert!(response.output_text.contains("<<<<<<< Left"));
        assert!(response.output_text.contains("left change"));
        assert!(response.output_text.contains("right change"));
        assert!(response.conflicts[0].output_span >= 4);
    }

    #[test]
    fn export_text_compare_report_writes_html() {
        let root = unique_temp_dir("text-report-command");
        fs::create_dir_all(&root).expect("fixture directory should be created");
        let output = root.join("report.html");

        let response = export_text_compare_report(
            "line one\nline two".to_owned(),
            "line one\nline 2".to_owned(),
            Some("left.txt".to_owned()),
            Some("right.txt".to_owned()),
            "html".to_owned(),
            Some(output.display().to_string()),
            None,
            Some(true),
            None,
            None,
            None,
        )
        .expect("text report should render");

        assert!(response.content.contains("Text Compare"));
        assert_eq!(
            fs::read_to_string(&output).expect("report should be written"),
            response.content
        );
    }

    #[test]
    fn move_folder_entry_moves_a_local_file() {
        let root = unique_temp_dir("move-command");
        fs::create_dir_all(root.join("archive")).expect("archive directory should be created");
        let source = root.join("notes.txt");
        let target = root.join("archive").join("notes.txt");
        fs::write(&source, "moved").expect("source should be writable");

        let result = move_folder_entry(source.display().to_string(), target.display().to_string())
            .expect("move should succeed");

        assert_eq!(result.status, folder_core::FileOperationStatus::Moved);
        assert!(!source.exists());
        assert_eq!(
            fs::read_to_string(&target).expect("target should exist"),
            "moved"
        );
    }

    #[test]
    fn find_hex_in_file_returns_text_matches() {
        let root = unique_temp_dir("hex-find-command");
        fs::create_dir_all(&root).expect("fixture directory should be created");
        let path = root.join("data.bin");
        fs::write(&path, b"AAAABCDEAAAA").expect("fixture should be writable");

        let matches = find_hex_in_file(
            path.display().to_string(),
            "text".to_owned(),
            "BCDE".to_owned(),
        )
        .expect("find should succeed");

        assert_eq!(matches.len(), 1);
        assert_eq!(matches[0].offset, 4);
    }

    #[test]
    fn compare_folder_paths_compares_real_zip_archives() {
        let root = unique_temp_dir("zip-compare-command");
        fs::create_dir_all(&root).expect("fixture directory should be created");
        let left_doc = archive_core::ArchiveDocument::new("left.zip")
            .with_file("/readme.txt", b"left".to_vec())
            .with_file("/same.txt", b"same".to_vec());
        let right_doc = archive_core::ArchiveDocument::new("right.zip")
            .with_file("/readme.txt", b"right".to_vec())
            .with_file("/same.txt", b"same".to_vec());
        let left = root.join("left.zip");
        let right = root.join("right.zip");
        fs::write(&left, archive_core::write_zip_bytes(&left_doc).unwrap()).unwrap();
        fs::write(&right, archive_core::write_zip_bytes(&right_doc).unwrap()).unwrap();

        let response = compare_folder_paths(
            left.display().to_string(),
            right.display().to_string(),
            None,
            None,
        )
        .expect("zip archives should compare as folders");

        assert!(response
            .rows
            .iter()
            .any(|row| row.relative_path == "readme.txt" && row.status == "Different"));
        assert!(response
            .rows
            .iter()
            .any(|row| row.relative_path == "same.txt" && row.status == "Same"));
    }

    #[test]
    fn copy_folder_compare_entry_extracts_from_zip_into_folder() {
        let root = unique_temp_dir("zip-extract-copy-command");
        fs::create_dir_all(&root).expect("fixture directory should be created");
        let archive_doc = archive_core::ArchiveDocument::new("bundle.zip")
            .with_file("/nested/readme.txt", b"from-archive".to_vec())
            .with_file("/solo.txt", b"solo".to_vec());
        let archive = root.join("bundle.zip");
        let folder = root.join("out");
        fs::create_dir_all(&folder).expect("output folder should be created");
        fs::write(
            &archive,
            archive_core::write_zip_bytes(&archive_doc).unwrap(),
        )
        .unwrap();

        let copy = copy_folder_compare_entry(
            archive.display().to_string(),
            folder.display().to_string(),
            "nested/readme.txt".to_owned(),
            folder_core::CopyDirection::ToRight,
        )
        .expect("archive file should extract into the folder side");

        assert_eq!(
            copy.refreshed_status,
            folder_core::FolderCompareStatus::Same
        );
        assert_eq!(
            fs::read_to_string(folder.join("nested").join("readme.txt"))
                .expect("extracted file should be readable"),
            "from-archive"
        );

        let rejected = copy_folder_compare_entry(
            folder.display().to_string(),
            archive.display().to_string(),
            "solo.txt".to_owned(),
            folder_core::CopyDirection::ToRight,
        )
        .expect_err("copy into an archive side should stay rejected");
        assert!(rejected.debug_message.contains("cannot copy into archive"));
    }

    #[test]
    fn run_script_compares_files_and_writes_a_report() {
        let root = unique_temp_dir("script-command");
        fs::create_dir_all(&root).expect("fixture directory should be created");
        let left = root.join("left.txt");
        let right = root.join("right.txt");
        let report = root.join("out.txt");
        fs::write(&left, "one\n").unwrap();
        fs::write(&right, "two\n").unwrap();
        let source = format!(
            "LOAD \"{}\" \"{}\"\nCOMPARE\nTEXT-REPORT \"{}\"\n",
            left.display(),
            right.display(),
            report.display()
        );

        let response = run_script(source, None).expect("script should run");

        assert_eq!(response.reports_written, 1);
        assert!(response.different >= 1);
        assert!(fs::read_to_string(&report).unwrap().contains("compared:"));
    }

    #[test]
    fn apply_text_patch_to_file_writes_reconstructed_source() {
        let root = unique_temp_dir("patch-file-command");
        fs::create_dir_all(&root).expect("fixture directory should be created");
        let source = root.join("main.txt");
        let output = root.join("patched.txt");
        fs::write(&source, "const a = 1\nold\n").unwrap();
        let patch = "\
--- a/main.txt
+++ b/main.txt
@@ -1,2 +1,2 @@
 const a = 1
-old
+new
";

        apply_text_patch_to_file(
            source.display().to_string(),
            patch.to_owned(),
            Some(output.display().to_string()),
        )
        .expect("patch should apply");

        assert_eq!(fs::read_to_string(&output).unwrap(), "const a = 1\nnew");
    }

    #[test]
    fn execute_folder_sync_honors_per_item_overrides() {
        let root = unique_temp_dir("sync-override-command");
        let left = root.join("left");
        let right = root.join("right");
        fs::create_dir_all(&left).unwrap();
        fs::create_dir_all(&right).unwrap();
        fs::write(left.join("copy.txt"), "left").unwrap();
        fs::write(left.join("leave.txt"), "left-leave").unwrap();

        let response = execute_folder_sync(
            left.display().to_string(),
            right.display().to_string(),
            "updateRight".to_owned(),
            Some(vec![sync_core::SyncActionOverride {
                relative_path: "leave.txt".to_owned(),
                action: sync_core::SyncOverrideAction::Leave,
            }]),
        )
        .expect("sync with overrides should run");

        assert!(right.join("copy.txt").exists());
        assert!(!right.join("leave.txt").exists());
        assert!(response.succeeded >= 1);
    }

    #[test]
    fn diff_text_command_forwards_ignore_whitespace_case_line_endings_and_regex() {
        let ignored = diff_text(
            "Alpha  one\r\nstamp=123\n".to_owned(),
            "alpha one\nstamp=999\n".to_owned(),
            None,
            Some(true),
            Some(true),
            Some(true),
            Some(vec!["stamp=\\d+".to_owned()]),
        );

        assert_eq!(ignored.stats.added, 0);
        assert_eq!(ignored.stats.deleted, 0);
        assert_eq!(ignored.stats.modified, 0);

        let compared = diff_text(
            "Alpha  one\r\nstamp=123\n".to_owned(),
            "alpha one\nstamp=999\n".to_owned(),
            None,
            Some(false),
            Some(false),
            Some(false),
            None,
        );

        assert!(compared.stats.modified >= 1 || compared.stats.added >= 1);
    }

    #[test]
    fn compare_picture_files_forwards_rgb_tolerance() {
        let root = unique_temp_dir("picture-tolerance-command");
        fs::create_dir_all(&root).expect("fixture directory should be created");
        let left = root.join("left.png");
        let right = root.join("right.png");

        fs::write(&left, fixture_png(&[[255, 0, 0, 255], [0, 128, 255, 255]]))
            .expect("left fixture should be writable");
        fs::write(&right, fixture_png(&[[250, 0, 0, 255], [0, 128, 255, 255]]))
            .expect("right fixture should be writable");

        let strict = compare_picture_files(
            left.display().to_string(),
            right.display().to_string(),
            Some(0),
            Some(true),
            None,
            None,
            None,
        )
        .expect("strict compare should run");
        let tolerant = compare_picture_files(
            left.display().to_string(),
            right.display().to_string(),
            Some(10),
            Some(true),
            None,
            None,
            None,
        )
        .expect("tolerant compare should run");

        assert_eq!(strict.statistics.different_pixels, 1);
        assert_eq!(tolerant.statistics.different_pixels, 0);
    }

    #[test]
    fn compare_picture_files_forwards_alpha_tolerance() {
        let root = unique_temp_dir("picture-alpha-tolerance-command");
        fs::create_dir_all(&root).expect("fixture directory should be created");
        let left = root.join("left.png");
        let right = root.join("right.png");

        fs::write(&left, fixture_png(&[[10, 20, 30, 200], [10, 20, 30, 200]]))
            .expect("left fixture should be writable");
        fs::write(&right, fixture_png(&[[10, 20, 30, 210], [10, 20, 30, 210]]))
            .expect("right fixture should be writable");

        let strict = compare_picture_files(
            left.display().to_string(),
            right.display().to_string(),
            Some(0),
            Some(true),
            Some(0),
            None,
            None,
        )
        .expect("strict alpha compare should run");
        let tolerant = compare_picture_files(
            left.display().to_string(),
            right.display().to_string(),
            Some(0),
            Some(true),
            Some(10),
            None,
            None,
        )
        .expect("tolerant alpha compare should run");

        assert_eq!(strict.statistics.different_pixels, 2);
        assert_eq!(tolerant.statistics.different_pixels, 0);
    }

    #[test]
    fn compare_table_supports_html_tables() {
        let left =
            "<table><tr><th>id</th><th>name</th></tr><tr><td>1</td><td>alpha</td></tr></table>";
        let right =
            "<table><tr><th>id</th><th>name</th></tr><tr><td>1</td><td>beta</td></tr></table>";

        let response = compare_table(
            left.to_owned(),
            right.to_owned(),
            Some("html".to_owned()),
            None,
            None,
            None,
            None,
            Some(vec![0]),
            None,
            None,
            None,
        )
        .expect("html tables should compare");

        assert_eq!(response.summary.changed_cell_count, 1);
        assert_eq!(
            response.changed_cells[0].left_value.as_deref(),
            Some("alpha")
        );
        assert_eq!(
            response.changed_cells[0].right_value.as_deref(),
            Some("beta")
        );
    }

    #[test]
    fn compare_table_reads_excel_workbooks_from_path() {
        let root = unique_temp_dir("excel-command");
        fs::create_dir_all(&root).expect("fixture directory should be created");
        let left = root.join("left.xlsx");
        let right = root.join("right.xlsx");
        write_excel_fixture(&left, "1", "alpha");
        write_excel_fixture(&right, "1", "beta");

        let response = compare_table(
            String::new(),
            String::new(),
            Some("xlsx".to_owned()),
            Some(left.display().to_string()),
            Some(right.display().to_string()),
            None,
            None,
            Some(vec![0]),
            None,
            None,
            None,
        )
        .expect("excel workbooks should compare");

        assert_eq!(response.left_sheet, "Sheet1");
        assert_eq!(response.summary.changed_cell_count, 1);
        assert_eq!(
            response.changed_cells[0].left_value.as_deref(),
            Some("alpha")
        );
        assert_eq!(
            response.changed_cells[0].right_value.as_deref(),
            Some("beta")
        );
    }

    #[test]
    fn compare_table_pairs_excel_sheets_by_name_and_honors_selection() {
        let root = unique_temp_dir("excel-sheets-command");
        fs::create_dir_all(&root).expect("fixture directory should be created");
        let left = root.join("left.xlsx");
        let right = root.join("right.xlsx");
        write_multi_sheet_excel_fixture(
            &left,
            &[("Inventory", "1", "alpha"), ("Flags", "yes", "left-flag")],
        );
        write_multi_sheet_excel_fixture(
            &right,
            &[("Flags", "yes", "right-flag"), ("Inventory", "1", "beta")],
        );

        let automatic = compare_table(
            String::new(),
            String::new(),
            Some("xlsx".to_owned()),
            Some(left.display().to_string()),
            Some(right.display().to_string()),
            None,
            None,
            Some(vec![0]),
            None,
            None,
            None,
        )
        .expect("excel sheets should pair by name");

        assert_eq!(automatic.left_sheets, vec!["Inventory", "Flags"]);
        assert_eq!(automatic.right_sheets, vec!["Flags", "Inventory"]);
        assert_eq!(automatic.left_sheet, "Inventory");
        assert_eq!(automatic.right_sheet, "Inventory");
        assert_eq!(automatic.summary.changed_cell_count, 1);
        assert_eq!(
            automatic.changed_cells[0].left_value.as_deref(),
            Some("alpha")
        );
        assert_eq!(
            automatic.changed_cells[0].right_value.as_deref(),
            Some("beta")
        );

        let selected = compare_table(
            String::new(),
            String::new(),
            Some("xlsx".to_owned()),
            Some(left.display().to_string()),
            Some(right.display().to_string()),
            Some("Flags".to_owned()),
            Some("Flags".to_owned()),
            Some(vec![0]),
            None,
            None,
            None,
        )
        .expect("selected excel sheets should compare");

        assert_eq!(selected.left_sheet, "Flags");
        assert_eq!(selected.right_sheet, "Flags");
        assert_eq!(selected.summary.changed_cell_count, 1);
        assert_eq!(
            selected.changed_cells[0].left_value.as_deref(),
            Some("left-flag")
        );
        assert_eq!(
            selected.changed_cells[0].right_value.as_deref(),
            Some("right-flag")
        );
    }

    #[test]
    fn compare_table_selects_named_html_tables() {
        let left = r#"
            <table id="people"><tr><th>id</th><th>name</th></tr><tr><td>1</td><td>alpha</td></tr></table>
            <table id="pets"><tr><th>id</th><th>name</th></tr><tr><td>9</td><td>dog</td></tr></table>
        "#;
        let right = r#"
            <table id="pets"><tr><th>id</th><th>name</th></tr><tr><td>9</td><td>cat</td></tr></table>
            <table id="people"><tr><th>id</th><th>name</th></tr><tr><td>1</td><td>beta</td></tr></table>
        "#;

        let automatic = compare_table(
            left.to_owned(),
            right.to_owned(),
            Some("html".to_owned()),
            None,
            None,
            None,
            None,
            Some(vec![0]),
            None,
            None,
            None,
        )
        .expect("html tables should pair by name");

        assert_eq!(automatic.left_sheets, vec!["people", "pets"]);
        assert_eq!(automatic.right_sheets, vec!["pets", "people"]);
        assert_eq!(automatic.left_sheet, "people");
        assert_eq!(automatic.right_sheet, "people");
        assert_eq!(
            automatic.changed_cells[0].right_value.as_deref(),
            Some("beta")
        );

        let selected = compare_table(
            left.to_owned(),
            right.to_owned(),
            Some("html".to_owned()),
            None,
            None,
            Some("pets".to_owned()),
            Some("pets".to_owned()),
            Some(vec![0]),
            None,
            None,
            None,
        )
        .expect("selected html tables should compare");

        assert_eq!(selected.left_sheet, "pets");
        assert_eq!(selected.right_sheet, "pets");
        assert_eq!(
            selected.changed_cells[0].right_value.as_deref(),
            Some("cat")
        );
    }

    #[test]
    fn compare_hex_files_accepts_string_offsets_past_signed_32bit() {
        let root = unique_temp_dir("hex-large-offset-command");
        fs::create_dir_all(&root).expect("fixture directory should be created");
        let left = root.join("left.bin");
        let right = root.join("right.bin");
        // Verify string/hex offset parsing (incl. values representable past 0x7FFFFFFF).
        fs::write(&left, b"ABCDEFGH").expect("left fixture should be writable");
        fs::write(&right, b"ABCDEFGH").expect("right fixture should be writable");
        let response = compare_hex_files(
            left.display().to_string(),
            right.display().to_string(),
            Some(HexOffsetArg::Text("0x4".to_owned())),
            Some(2),
        )
        .expect("string offset should compare");
        assert_eq!(response.left.cells[0].offset, 4);
        assert_eq!(response.left.cells.len(), 2);

        let parsed = parse_hex_offset_arg(Some(HexOffsetArg::Text("0x80000000".to_owned())))
            .expect("large hex offset should parse");
        assert_eq!(parsed, 0x8000_0000);
    }

    #[test]
    fn compare_hex_files_honors_offset_and_length() {
        let root = unique_temp_dir("hex-offset-command");
        fs::create_dir_all(&root).expect("fixture directory should be created");
        let left = root.join("left.bin");
        let right = root.join("right.bin");
        fs::write(&left, b"XXABCD").expect("left fixture should be writable");
        fs::write(&right, b"XXAXCD").expect("right fixture should be writable");

        let response = compare_hex_files(
            left.display().to_string(),
            right.display().to_string(),
            Some(HexOffsetArg::Unsigned(2)),
            Some(4),
        )
        .expect("offset window should compare");

        assert_eq!(response.left.cells[0].offset, 2);
        assert_eq!(response.left.cells[0].hex, "41");
        assert_eq!(response.left.cells.len(), 4);
        assert_eq!(response.summary.different_ranges, 1);
        assert!(response.left.cells.iter().all(|cell| cell.hex != "58"));
    }

    #[test]
    fn merge_text_files_automerge_favor_left_resolves_conflicts() {
        let root = unique_temp_dir("merge-automerge-command");
        fs::create_dir_all(&root).expect("fixture directory should be created");
        let base = root.join("base.txt");
        let left = root.join("left.txt");
        let right = root.join("right.txt");
        fs::write(&base, "one\ntwo\nthree").expect("base should be writable");
        fs::write(&left, "one\nleft change\nthree").expect("left should be writable");
        fs::write(&right, "one\nright change\nthree").expect("right should be writable");

        let response = merge_text_files(
            left.display().to_string(),
            right.display().to_string(),
            Some(base.display().to_string()),
            None,
            Some("favorLeft".to_owned()),
        )
        .expect("favor-left merge should run");

        assert!(response.conflicts.is_empty());
        assert_eq!(response.output_text, "one\nleft change\nthree");
    }

    #[test]
    fn create_folder_snapshot_scans_a_real_temp_dir() {
        let root = unique_temp_dir("snapshot-command");
        fs::create_dir_all(root.join("src")).expect("fixture directory should be created");
        fs::write(root.join("src").join("main.rs"), "fn main() {}")
            .expect("file should be writable");
        let output = root.join("tree.snapshot.json");

        let written = create_folder_snapshot(
            root.display().to_string(),
            output.display().to_string(),
            Some("workspace".to_owned()),
        )
        .expect("snapshot should write");

        let bytes = fs::read_to_string(&output).expect("snapshot file should exist");
        assert_eq!(written, output.display().to_string());
        assert!(bytes.contains("workspace"));
        assert!(bytes.contains("main.rs"));
        assert!(!bytes.contains("generated-"));
    }

    #[test]
    fn compare_registry_exports_rejects_live_hive_text_that_is_not_a_reg_file() {
        let error = compare_registry_exports(
            "HKLM\\Software\\OpenDiff".to_owned(),
            "HKCU\\Software\\OpenDiff".to_owned(),
            Some("left-hive".to_owned()),
            Some("right-hive".to_owned()),
        )
        .expect_err("live hive paths should not parse as .reg exports");

        assert!(
            error.debug_message.to_ascii_lowercase().contains("reg")
                || error.message_key.contains("registry")
                || error.message_key.contains("unknown")
        );
    }

    #[test]
    fn list_archive_lists_seven_zip_and_rejects_hex_tab_zip_payloads() {
        let root = unique_temp_dir("archive-reject-command");
        fs::create_dir_all(&root).expect("fixture directory should be created");
        let seven = root.join("pkg.7z");
        let hex_zip = root.join("fake.zip");
        let seven_doc = archive_core::ArchiveDocument::new("pkg.7z")
            .with_file("/docs/readme.md", b"hello 7z".to_vec());
        let seven_bytes =
            archive_core::write_seven_zip_bytes(&seven_doc).expect("7z fixture should encode");
        fs::write(&seven, seven_bytes).expect("7z fixture should be writable");
        fs::write(&hex_zip, b"/docs/readme.md\t6e6577\n").expect("hex zip should be writable");

        let listed = list_archive(seven.display().to_string()).expect("7z should list");
        assert!(
            listed
                .entries
                .iter()
                .any(|entry| entry.path.contains("readme.md")),
            "expected listed 7z entries: {:?}",
            listed.entries
        );

        let hex_error = list_archive(hex_zip.display().to_string())
            .expect_err("hex-tab zip should not compare as a real archive");
        let hex_text = hex_error.debug_message;
        assert!(hex_text.contains("PK") || hex_text.to_ascii_lowercase().contains("zip"));
    }

    #[test]
    fn read_text_file_reads_a_real_temp_file() {
        let root = unique_temp_dir("read-text-command");
        fs::create_dir_all(&root).expect("fixture directory should be created");
        let path = root.join("note.txt");
        fs::write(&path, "hello from disk").expect("file should be writable");

        let response = read_text_file(path.display().to_string()).expect("temp file should read");

        assert_eq!(response.text, "hello from disk");
        assert!(!response.text.contains("line one"));
        assert!(!response.text.contains("generated-"));
    }

    #[test]
    fn run_script_unknown_command_fails_clearly() {
        let error = run_script("NOPE left right\n".to_owned(), None)
            .expect_err("unknown script command should fail");

        assert!(error
            .debug_message
            .to_ascii_lowercase()
            .contains("unsupported"));
    }

    #[test]
    fn write_git_integration_writes_to_temp_gitconfig() {
        let root = unique_temp_dir("git-integration-command");
        fs::create_dir_all(&root).expect("fixture directory should be created");
        let gitconfig = root.join("gitconfig");

        let message = write_git_integration(
            "mergetool".to_owned(),
            "/tmp/open-diff-cli".to_owned(),
            Some("global".to_owned()),
            Some(gitconfig.display().to_string()),
        )
        .expect("git integration should write to a temp file");

        assert!(message.contains("Wrote"));
        let written = fs::read_to_string(&gitconfig).expect("temp gitconfig should exist");
        assert!(written.contains("open-diff"));
        assert!(written.contains("mergetool") || written.contains("merge.tool"));
        assert!(written.contains("--automerge"));
    }

    #[test]
    fn test_remote_profile_missing_id_is_a_real_error() {
        let error = test_remote_profile("missing-linkage-profile".to_owned())
            .expect_err("missing remote profile should fail");

        assert!(error.debug_message.contains("not found"));
    }

    #[test]
    fn save_text_file_writes_a_real_temp_file() {
        let root = unique_temp_dir("save-text-command");
        fs::create_dir_all(&root).expect("fixture directory should be created");
        let path = root.join("note.txt");

        let response = save_text_file(
            path.display().to_string(),
            "saved from command".to_owned(),
            Some(true),
        )
        .expect("temp file should save");

        assert_eq!(response.bytes_written, "saved from command".len() as u64);
        assert_eq!(
            fs::read_to_string(&path).expect("saved file should exist"),
            "saved from command"
        );
        assert!(!response.path.contains("generated-"));
    }

    #[test]
    fn write_svn_integration_writes_wrapper_to_temp_path() {
        let root = unique_temp_dir("svn-integration-command");
        fs::create_dir_all(&root).expect("fixture directory should be created");
        let wrapper = root.join("svn-diff.sh");

        let message = write_svn_integration(
            "/tmp/open-diff-cli".to_owned(),
            wrapper.display().to_string(),
        )
        .expect("svn wrapper should write");

        assert!(message.contains("Wrote"));
        assert!(wrapper.exists());
        assert!(fs::read_to_string(&wrapper)
            .expect("wrapper should exist")
            .contains("svn"));
    }

    #[cfg(not(windows))]
    #[test]
    fn compare_version_files_is_unsupported_off_windows() {
        let error = compare_version_files("left.exe".to_owned(), "right.exe".to_owned())
            .expect_err("native version compare should stay Windows-only");

        assert!(
            error.debug_message.to_ascii_lowercase().contains("windows")
                || error.message_key.contains("unsupported")
        );
    }

    fn write_excel_fixture(path: &Path, id: &str, name: &str) {
        write_multi_sheet_excel_fixture(path, &[("Sheet1", id, name)]);
    }

    fn write_multi_sheet_excel_fixture(path: &Path, sheets: &[(&str, &str, &str)]) {
        let mut workbook = rust_xlsxwriter::Workbook::new();
        for (sheet_name, id, name) in sheets {
            let sheet = workbook.add_worksheet();
            sheet.set_name(*sheet_name).expect("sheet name");
            sheet.write_string(0, 0, "id").expect("header");
            sheet.write_string(0, 1, "name").expect("header");
            sheet.write_string(1, 0, *id).expect("id");
            sheet.write_string(1, 1, *name).expect("name");
        }
        workbook.save(path).expect("xlsx should write");
    }

    fn unique_temp_dir(label: &str) -> PathBuf {
        let stamp = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .expect("system clock should be after UNIX_EPOCH")
            .as_nanos();

        std::env::temp_dir().join(format!("open-diff-{label}-{stamp}"))
    }
}
