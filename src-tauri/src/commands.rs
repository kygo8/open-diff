use file_core::FileReadError;
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
