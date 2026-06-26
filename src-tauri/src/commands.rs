use shared_types::{TextDiffRequest, TextDiffResponse};

#[tauri::command]
pub fn diff_text(left: String, right: String) -> TextDiffResponse {
    let request = TextDiffRequest { left, right };
    diff_core::diff_text(&request)
}
