use file_core::FileReadError;
use serde::Serialize;
use shared_types::{
    AppErrorCode, AppErrorPayload, FileStamp, ReadTextFileResponse, SaveTextFileResponse,
    TextDiffRequest, TextDiffResponse, TextPatchResponse,
};
use table_core::{
    ColumnMappingSource, RowAlignmentOptions, TableCellValue, TableDiffStatus, TableParseError,
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

#[cfg(test)]
mod tests {
    use super::*;

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
}
