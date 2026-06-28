use serde::{Deserialize, Serialize};
use std::collections::BTreeMap;

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TextDiffRequest {
    pub left: String,
    pub right: String,
    pub algorithm: Option<String>,
    #[serde(default)]
    pub ignore_whitespace: bool,
    #[serde(default)]
    pub ignore_case: bool,
    #[serde(default)]
    pub ignore_line_endings: bool,
    #[serde(default)]
    pub ignore_regexes: Vec<String>,
}

#[derive(Debug, Clone, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct TextDiffResponse {
    pub lines: Vec<DiffLine>,
    pub stats: DiffStats,
}

#[derive(Debug, Clone, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct ReadTextFileResponse {
    pub path: String,
    pub text: String,
    pub encoding: String,
    pub line_ending: String,
    pub file_stamp: FileStamp,
}

#[derive(Debug, Clone, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct SaveTextFileResponse {
    pub path: String,
    pub bytes_written: u64,
    pub backup_path: Option<String>,
    pub file_stamp: FileStamp,
}

#[derive(Debug, Clone, Deserialize, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct FileStamp {
    pub size: u64,
    pub modified_at_ms: u128,
}

#[derive(Debug, Clone, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct DiffLine {
    pub left_number: Option<usize>,
    pub right_number: Option<usize>,
    pub left_text: String,
    pub right_text: String,
    pub kind: DiffLineKind,
    pub inline_segments: InlineDiffSegments,
    pub important: bool,
}

#[derive(Debug, Clone, Serialize, PartialEq, Eq, Default)]
#[serde(rename_all = "camelCase")]
pub struct InlineDiffSegments {
    pub left: Vec<InlineDiffSegment>,
    pub right: Vec<InlineDiffSegment>,
}

#[derive(Debug, Clone, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct InlineDiffSegment {
    pub text: String,
    pub changed: bool,
}

#[derive(Debug, Clone, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct DiffStats {
    pub added: usize,
    pub deleted: usize,
    pub modified: usize,
    pub equal: usize,
}

#[derive(Debug, Clone, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub enum DiffLineKind {
    Equal,
    Added,
    Deleted,
    Modified,
}

#[derive(Debug, Clone, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct TextPatchResponse {
    pub files: Vec<PatchFile>,
}

#[derive(Debug, Clone, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct PatchFile {
    pub old_path: String,
    pub new_path: String,
    pub hunks: Vec<PatchHunk>,
}

#[derive(Debug, Clone, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct PatchHunk {
    pub old_start: usize,
    pub old_count: usize,
    pub new_start: usize,
    pub new_count: usize,
    pub heading: String,
    pub lines: Vec<PatchLine>,
}

#[derive(Debug, Clone, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct PatchLine {
    pub kind: PatchLineKind,
    pub old_number: Option<usize>,
    pub new_number: Option<usize>,
    pub text: String,
}

#[derive(Debug, Clone, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub enum PatchLineKind {
    Context,
    Added,
    Removed,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct AppErrorPayload {
    pub code: AppErrorCode,
    pub message_key: String,
    pub params: BTreeMap<String, String>,
    pub debug_message: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub suggestion_key: Option<String>,
}

impl AppErrorPayload {
    pub fn new(
        code: AppErrorCode,
        message_key: impl Into<String>,
        debug_message: impl Into<String>,
    ) -> Self {
        Self {
            code,
            message_key: message_key.into(),
            params: BTreeMap::new(),
            debug_message: debug_message.into(),
            suggestion_key: None,
        }
    }

    pub fn with_param(mut self, key: impl Into<String>, value: impl Into<String>) -> Self {
        self.params.insert(key.into(), value.into());

        self
    }

    pub fn with_suggestion_key(mut self, suggestion_key: impl Into<String>) -> Self {
        self.suggestion_key = Some(suggestion_key.into());

        self
    }
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub enum AppErrorCode {
    #[serde(rename = "app.unknown")]
    Unknown,
    #[serde(rename = "file.notFound")]
    FileNotFound,
    #[serde(rename = "file.readFailed")]
    FileReadFailed,
    #[serde(rename = "file.writeFailed")]
    FileWriteFailed,
    #[serde(rename = "file.unsupportedEncoding")]
    FileUnsupportedEncoding,
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    #[test]
    fn app_error_payload_serializes_with_stable_code_and_localization_fields() {
        let error = AppErrorPayload::new(
            AppErrorCode::FileNotFound,
            "error.file.notFound.message",
            "file is missing",
        )
        .with_param("path", "C:/work/missing.txt")
        .with_suggestion_key("error.file.notFound.suggestion");

        assert_eq!(
            serde_json::to_value(error).expect("error payload should serialize"),
            json!({
                "code": "file.notFound",
                "messageKey": "error.file.notFound.message",
                "params": {
                    "path": "C:/work/missing.txt"
                },
                "debugMessage": "file is missing",
                "suggestionKey": "error.file.notFound.suggestion"
            })
        );
    }
}
