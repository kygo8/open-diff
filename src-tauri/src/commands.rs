use shared_types::{FileStamp, ReadTextFileResponse, TextDiffRequest, TextDiffResponse};

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
pub fn read_text_file(path: String) -> Result<ReadTextFileResponse, String> {
    file_core::read_text_file(path).map_err(|error| format!("{error:?}"))
}

#[tauri::command]
pub fn check_text_file_changed(path: String, previous_stamp: FileStamp) -> Result<bool, String> {
    file_core::check_text_file_changed(path, &previous_stamp).map_err(|error| format!("{error:?}"))
}
