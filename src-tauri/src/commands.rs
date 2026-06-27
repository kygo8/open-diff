use shared_types::{FileStamp, ReadTextFileResponse, TextDiffRequest, TextDiffResponse};

#[tauri::command]
pub fn diff_text(left: String, right: String, algorithm: Option<String>) -> TextDiffResponse {
    let request = TextDiffRequest {
        left,
        right,
        algorithm,
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
