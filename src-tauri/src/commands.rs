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
use serde::Serialize;
use shared_types::{
    AppErrorCode, AppErrorPayload, FileStamp, ReadTextFileResponse, SaveTextFileResponse,
    TextDiffRequest, TextDiffResponse, TextPatchResponse,
};
use std::collections::{BTreeMap, BTreeSet};
use std::fs;
use std::path::Path;
use table_core::{
    ColumnMappingSource, RowAlignmentOptions, TableCellValue, TableDiffStatus, TableParseError,
};
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

#[derive(Debug, Clone, Serialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct FolderCompareRow {
    pub relative_path: String,
    pub depth: usize,
    pub status: String,
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
    let left_workbook = table_core::parse_csv(&left).map_err(table_parse_error)?;
    let right_workbook = table_core::parse_csv(&right).map_err(table_parse_error)?;
    let left_sheet = left_workbook.sheets.first().ok_or_else(empty_table_error)?;
    let right_sheet = right_workbook
        .sheets
        .first()
        .ok_or_else(empty_table_error)?;
    let column_mappings = table_core::map_columns(
        left_sheet,
        right_sheet,
        &table_core::ColumnMappingOptions {
            case_sensitive: false,
            ignore_whitespace: true,
        },
    );
    let alignments = table_core::align_rows_by_key_columns(
        left_sheet,
        right_sheet,
        &RowAlignmentOptions {
            key_column_indices: vec![0],
            case_sensitive: false,
        },
    );
    let row_diffs = table_core::compare_aligned_rows(left_sheet, right_sheet, &alignments);
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
        left_columns: left_sheet
            .columns
            .iter()
            .map(|column| TableCompareColumn {
                name: column.name.clone(),
                side: "left".to_owned(),
            })
            .collect(),
        right_columns: right_sheet
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
    })
}

#[tauri::command]
pub fn compare_folder_paths(
    left_root: String,
    right_root: String,
) -> Result<FolderCompareResponse, AppErrorPayload> {
    let cancellation_token = job_core::CancellationToken::default();
    let left_tree = folder_core::scan_local_folder(&left_root, &cancellation_token)
        .map_err(|error| folder_scan_error(&left_root, error))?;
    let right_tree = folder_core::scan_local_folder(&right_root, &cancellation_token)
        .map_err(|error| folder_scan_error(&right_root, error))?;
    let alignment_rows = folder_core::align_folder_trees(&left_tree, &right_tree);
    let rows = alignment_rows
        .iter()
        .map(|row| folder_compare_row(row, &left_root, &right_root))
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

#[tauri::command]
pub fn compare_hex_files(
    left_path: String,
    right_path: String,
    offset: Option<u64>,
    length: Option<usize>,
) -> Result<HexCompareResponse, AppErrorPayload> {
    let left_bytes = fs::read(&left_path).map_err(|error| file_io_error(&left_path, error))?;
    let right_bytes = fs::read(&right_path).map_err(|error| file_io_error(&right_path, error))?;
    let diff = hex_core::scan_binary_differences(&left_bytes, &right_bytes);
    let offset = offset.unwrap_or(0);
    let length = length.unwrap_or(256);
    let left_window = hex_core::build_hex_view_window(&left_bytes, offset, length, Some(&diff));
    let right_window = hex_core::build_hex_view_window(&right_bytes, offset, length, Some(&diff));
    let different_ranges = diff.ranges.len();

    Ok(HexCompareResponse {
        left: HexSideWindow {
            path: left_path,
            total_len: left_window.total_len,
            cells: left_window.cells,
        },
        right: HexSideWindow {
            path: right_path,
            total_len: right_window.total_len,
            cells: right_window.cells,
        },
        diff_ranges: diff.ranges,
        summary: HexCompareSummary {
            left_bytes: diff.left_len,
            right_bytes: diff.right_len,
            different_ranges,
        },
    })
}

#[tauri::command]
pub fn compare_picture_files(
    left_path: String,
    right_path: String,
) -> Result<PictureCompareResponse, AppErrorPayload> {
    let left = read_picture_path(&left_path)?;
    let right = read_picture_path(&right_path)?;
    let metadata_rows = picture_metadata_rows(&left.metadata, &right.metadata);
    let total_pixels = u64::from(left.metadata.width) * u64::from(left.metadata.height);
    let diff = if left.metadata.width == right.metadata.width
        && left.metadata.height == right.metadata.height
    {
        image_core::scan_pixel_differences(
            &left.pixels,
            &right.pixels,
            left.metadata.width,
            left.metadata.height,
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
    file_core::read_text_file(&path).map_err(|error| file_error("read", &path, error))
}

#[tauri::command]
pub fn save_text_file(path: String, text: String) -> Result<SaveTextFileResponse, AppErrorPayload> {
    file_core::save_text_file(&path, text).map_err(|error| file_error("write", &path, error))
}

#[tauri::command]
pub fn check_text_file_changed(
    path: String,
    previous_stamp: FileStamp,
) -> Result<bool, AppErrorPayload> {
    file_core::check_text_file_changed(&path, &previous_stamp)
        .map_err(|error| file_error("read", &path, error))
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
    left_root: &str,
    right_root: &str,
) -> Result<FolderCompareRow, AppErrorPayload> {
    let status = folder_row_status(row, left_root, right_root)?;

    Ok(FolderCompareRow {
        relative_path: row.relative_path.clone(),
        depth: row.depth,
        status: folder_status_label(&status),
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

fn folder_row_status(
    row: &FolderAlignmentRow,
    left_root: &str,
    right_root: &str,
) -> Result<FolderCompareStatus, AppErrorPayload> {
    let metadata_status =
        folder_core::classify_folder_alignment(row.left.as_ref(), row.right.as_ref());

    if metadata_status != FolderCompareStatus::Same || !row_is_file_pair(row) {
        return Ok(metadata_status);
    }

    let left_path = side_path(left_root, &row.relative_path);
    let right_path = side_path(right_root, &row.relative_path);
    let left_bytes = fs::read(&left_path).map_err(|error| file_io_error(&left_path, error))?;
    let right_bytes = fs::read(&right_path).map_err(|error| file_io_error(&right_path, error))?;

    Ok(
        folder_core::compare_binary_streams(&left_bytes[..], &right_bytes[..], 8192)
            .map_err(|error| file_io_error(&left_path, error))?
            .status,
    )
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

fn version_read_error(path: &str, error: VersionReadError) -> AppErrorPayload {
    AppErrorPayload::new(
        AppErrorCode::FileReadFailed,
        "error.version.readFailed.message",
        error.to_string(),
    )
    .with_param("path", path)
    .with_suggestion_key("error.version.readFailed.suggestion")
}

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

fn version_compare_summary(statistics: VersionDiffStatistics) -> VersionCompareSummary {
    VersionCompareSummary {
        added: statistics.added,
        removed: statistics.removed,
        modified: statistics.modified,
        unchanged: statistics.unchanged,
    }
}

fn version_field_group(field: &str) -> String {
    match field {
        "FileVersion" | "ProductVersion" => "Fixed Info",
        _ => "String Info",
    }
    .to_owned()
}

fn version_field_status_label(status: VersionFieldStatus) -> String {
    match status {
        VersionFieldStatus::Added => "added",
        VersionFieldStatus::Removed => "removed",
        VersionFieldStatus::Modified => "modified",
        VersionFieldStatus::Unchanged => "unchanged",
    }
    .to_owned()
}

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

#[cfg(test)]
mod tests {
    use super::*;
    use std::fs;
    use std::path::PathBuf;
    use std::time::{SystemTime, UNIX_EPOCH};

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

        let response =
            compare_folder_paths(left.display().to_string(), right.display().to_string())
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
            Some(0),
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

        let response =
            compare_picture_files(left.display().to_string(), right.display().to_string())
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

    fn unique_temp_dir(label: &str) -> PathBuf {
        let stamp = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .expect("system clock should be after UNIX_EPOCH")
            .as_nanos();

        std::env::temp_dir().join(format!("open-diff-{label}-{stamp}"))
    }
}
