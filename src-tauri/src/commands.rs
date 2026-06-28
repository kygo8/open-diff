use file_core::FileReadError;
use shared_types::{
    AppErrorCode, AppErrorPayload, FileStamp, ReadTextFileResponse, SaveTextFileResponse,
    TextDiffRequest, TextDiffResponse, TextPatchResponse,
};

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
}
