use shared_types::{ReadTextFileResponse, TextDiffRequest, TextDiffResponse};

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
