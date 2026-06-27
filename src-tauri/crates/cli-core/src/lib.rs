use serde::{Deserialize, Serialize};
use shared_types::TextDiffRequest;
use std::path::Path;

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CliInvocation {
    pub command: CliCommand,
    pub exit_code: CliExitCode,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum CliCommand {
    Help,
    CompareFiles { left: String, right: String },
    CompareFolders { left: String, right: String },
    OpenSession { store_root: String, name: String },
    MergeText(CliTextMergeArgs),
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CliTextMergeArgs {
    pub base: String,
    pub left: String,
    pub right: String,
    pub output: Option<String>,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum CliExitCode {
    Success = 0,
    Different = 1,
    UsageError = 2,
    RuntimeError = 3,
    Cancelled = 4,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CliParseError {
    pub message: String,
    pub exit_code: CliExitCode,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CliFileCompareResult {
    pub exit_code: CliExitCode,
    pub added: usize,
    pub deleted: usize,
    pub modified: usize,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CliFolderCompareResult {
    pub exit_code: CliExitCode,
    pub total: usize,
    pub same: usize,
    pub different: usize,
    pub left_only: usize,
    pub right_only: usize,
    pub error: usize,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CliOpenSessionResult {
    pub exit_code: CliExitCode,
    pub id: String,
    pub name: String,
    pub session_type: String,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CliRuntimeError {
    pub message: String,
    pub exit_code: CliExitCode,
}

pub fn parse_cli_args<I, S>(args: I) -> Result<CliInvocation, CliParseError>
where
    I: IntoIterator<Item = S>,
    S: Into<String>,
{
    let mut args = args.into_iter().map(Into::into);
    let _program = args.next();
    let Some(command) = args.next() else {
        return Ok(help_invocation());
    };

    match command.as_str() {
        "--help" | "-h" | "help" => Ok(help_invocation()),
        "compare" => parse_compare_files(args.collect()),
        "compare-folders" => parse_compare_folders(args.collect()),
        "open-session" => parse_open_session(args.collect()),
        "merge-text" => parse_merge_text(args.collect()),
        unknown => Err(usage_error(format!("unknown command: {unknown}"))),
    }
}

pub fn cli_exit_code_value(exit_code: CliExitCode) -> i32 {
    exit_code as i32
}

pub fn compare_text_files(
    left: impl AsRef<Path>,
    right: impl AsRef<Path>,
) -> Result<CliFileCompareResult, CliRuntimeError> {
    let left = file_core::read_text_file(left).map_err(runtime_error)?;
    let right = file_core::read_text_file(right).map_err(runtime_error)?;
    let diff = diff_core::diff_text(&TextDiffRequest {
        left: left.text,
        right: right.text,
        algorithm: None,
        ignore_whitespace: false,
        ignore_case: false,
        ignore_line_endings: false,
        ignore_regexes: Vec::new(),
    });
    let has_difference = diff.stats.added > 0 || diff.stats.deleted > 0 || diff.stats.modified > 0;

    Ok(CliFileCompareResult {
        exit_code: if has_difference {
            CliExitCode::Different
        } else {
            CliExitCode::Success
        },
        added: diff.stats.added,
        deleted: diff.stats.deleted,
        modified: diff.stats.modified,
    })
}

pub fn compare_folders(
    left: impl AsRef<Path>,
    right: impl AsRef<Path>,
) -> Result<CliFolderCompareResult, CliRuntimeError> {
    let cancel_token = job_core::CancellationToken::default();
    let left = folder_core::scan_local_folder(left, &cancel_token).map_err(runtime_error)?;
    let right = folder_core::scan_local_folder(right, &cancel_token).map_err(runtime_error)?;
    let rows = folder_core::align_folder_trees(&left, &right);
    let report = folder_core::build_folder_report_model(
        &rows,
        &folder_core::FolderCompareOptions::default(),
        true,
    );
    let has_difference = report.summary.different > 0
        || report.summary.left_only > 0
        || report.summary.right_only > 0
        || report.summary.error > 0;

    Ok(CliFolderCompareResult {
        exit_code: if has_difference {
            CliExitCode::Different
        } else {
            CliExitCode::Success
        },
        total: report.summary.total,
        same: report.summary.same,
        different: report.summary.different,
        left_only: report.summary.left_only,
        right_only: report.summary.right_only,
        error: report.summary.error,
    })
}

pub fn open_named_session(
    store_root: impl AsRef<Path>,
    name: impl AsRef<str>,
) -> Result<CliOpenSessionResult, CliRuntimeError> {
    let session = session_core::SessionStore::new(store_root)
        .load_named(name)
        .map_err(runtime_error)?;

    Ok(CliOpenSessionResult {
        exit_code: CliExitCode::Success,
        id: session.id,
        name: session.name,
        session_type: session_type_label(&session.session_type).to_owned(),
    })
}

fn help_invocation() -> CliInvocation {
    CliInvocation {
        command: CliCommand::Help,
        exit_code: CliExitCode::Success,
    }
}

fn parse_compare_files(args: Vec<String>) -> Result<CliInvocation, CliParseError> {
    if args.len() != 2 {
        return Err(usage_error("compare requires LEFT and RIGHT paths"));
    }

    Ok(CliInvocation {
        command: CliCommand::CompareFiles {
            left: args[0].clone(),
            right: args[1].clone(),
        },
        exit_code: CliExitCode::Success,
    })
}

fn parse_compare_folders(args: Vec<String>) -> Result<CliInvocation, CliParseError> {
    if args.len() != 2 {
        return Err(usage_error("compare-folders requires LEFT and RIGHT paths"));
    }

    Ok(CliInvocation {
        command: CliCommand::CompareFolders {
            left: args[0].clone(),
            right: args[1].clone(),
        },
        exit_code: CliExitCode::Success,
    })
}

fn parse_open_session(args: Vec<String>) -> Result<CliInvocation, CliParseError> {
    if args.len() != 2 {
        return Err(usage_error("open-session requires STORE_ROOT and NAME"));
    }

    Ok(CliInvocation {
        command: CliCommand::OpenSession {
            store_root: args[0].clone(),
            name: args[1].clone(),
        },
        exit_code: CliExitCode::Success,
    })
}

fn parse_merge_text(args: Vec<String>) -> Result<CliInvocation, CliParseError> {
    if !(args.len() == 3 || args.len() == 4) {
        return Err(usage_error(
            "merge-text requires BASE LEFT RIGHT [OUTPUT] paths",
        ));
    }

    Ok(CliInvocation {
        command: CliCommand::MergeText(CliTextMergeArgs {
            base: args[0].clone(),
            left: args[1].clone(),
            right: args[2].clone(),
            output: args.get(3).cloned(),
        }),
        exit_code: CliExitCode::Success,
    })
}

fn usage_error(message: impl Into<String>) -> CliParseError {
    CliParseError {
        message: message.into(),
        exit_code: CliExitCode::UsageError,
    }
}

fn session_type_label(session_type: &session_core::SessionType) -> &'static str {
    match session_type {
        session_core::SessionType::FolderCompare => "folder-compare",
        session_core::SessionType::FolderMerge => "folder-merge",
        session_core::SessionType::FolderSync => "folder-sync",
        session_core::SessionType::TextCompare => "text-compare",
        session_core::SessionType::TextMerge => "text-merge",
        session_core::SessionType::TableCompare => "table-compare",
        session_core::SessionType::HexCompare => "hex-compare",
        session_core::SessionType::PictureCompare => "picture-compare",
        session_core::SessionType::RegistryCompare => "registry-compare",
        session_core::SessionType::TextEdit => "text-edit",
        session_core::SessionType::TextPatch => "text-patch",
        session_core::SessionType::MediaCompare => "media-compare",
        session_core::SessionType::VersionCompare => "version-compare",
    }
}

fn runtime_error(error: impl std::fmt::Debug) -> CliRuntimeError {
    CliRuntimeError {
        message: format!("{error:?}"),
        exit_code: CliExitCode::RuntimeError,
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::fs;
    use std::time::{SystemTime, UNIX_EPOCH};

    #[test]
    fn parses_help_and_command_arguments() {
        let help = parse_cli_args(["open-diff-cli", "--help"]).expect("help should parse");
        assert_eq!(help.command, CliCommand::Help);
        assert_eq!(help.exit_code, CliExitCode::Success);

        let compare = parse_cli_args(["open-diff-cli", "compare", "left.txt", "right.txt"])
            .expect("compare should parse");
        assert_eq!(
            compare.command,
            CliCommand::CompareFiles {
                left: "left.txt".to_owned(),
                right: "right.txt".to_owned(),
            }
        );

        let folders = parse_cli_args(["open-diff-cli", "compare-folders", "left", "right"])
            .expect("folder compare should parse");
        assert_eq!(
            folders.command,
            CliCommand::CompareFolders {
                left: "left".to_owned(),
                right: "right".to_owned(),
            }
        );

        let session = parse_cli_args(["open-diff-cli", "open-session", ".open-diff", "team/demo"])
            .expect("session open should parse");
        assert_eq!(
            session.command,
            CliCommand::OpenSession {
                store_root: ".open-diff".to_owned(),
                name: "team/demo".to_owned(),
            }
        );

        let merge_three = parse_cli_args(["open-diff-cli", "merge-text", "base", "left", "right"])
            .expect("3 file merge should parse");
        assert_eq!(
            merge_three.command,
            CliCommand::MergeText(CliTextMergeArgs {
                base: "base".to_owned(),
                left: "left".to_owned(),
                right: "right".to_owned(),
                output: None,
            })
        );

        let merge_four = parse_cli_args([
            "open-diff-cli",
            "merge-text",
            "base",
            "left",
            "right",
            "output",
        ])
        .expect("4 file merge should parse");
        assert_eq!(
            merge_four.command,
            CliCommand::MergeText(CliTextMergeArgs {
                base: "base".to_owned(),
                left: "left".to_owned(),
                right: "right".to_owned(),
                output: Some("output".to_owned()),
            })
        );
    }

    #[test]
    fn unknown_or_incomplete_arguments_return_usage_error() {
        let error = parse_cli_args(["open-diff-cli", "compare", "left.txt"])
            .expect_err("missing right path should fail");

        assert_eq!(error.exit_code, CliExitCode::UsageError);
        assert!(error.message.contains("compare requires"));
    }

    #[test]
    fn compares_text_files_and_returns_stable_difference_codes() {
        let left = temp_file_path("left");
        let same = temp_file_path("same");
        let different = temp_file_path("different");

        fs::write(&left, "one\ntwo\n").expect("fixture should be writable");
        fs::write(&same, "one\ntwo\n").expect("fixture should be writable");
        fs::write(&different, "one\nchanged\n").expect("fixture should be writable");

        let equal = compare_text_files(&left, &same).expect("comparison should run");
        assert_eq!(equal.exit_code, CliExitCode::Success);
        assert_eq!(equal.modified, 0);

        let changed = compare_text_files(&left, &different).expect("comparison should run");
        assert_eq!(changed.exit_code, CliExitCode::Different);
        assert_eq!(changed.modified, 1);

        fs::remove_file(left).expect("fixture should be removable");
        fs::remove_file(same).expect("fixture should be removable");
        fs::remove_file(different).expect("fixture should be removable");
    }

    #[test]
    fn compares_folders_and_returns_summary() {
        let left = temp_dir_path("left-folder");
        let right = temp_dir_path("right-folder");

        fs::create_dir_all(&left).expect("fixture directory should be writable");
        fs::create_dir_all(&right).expect("fixture directory should be writable");
        fs::write(left.join("same.txt"), "same").expect("fixture should be writable");
        fs::write(right.join("same.txt"), "same").expect("fixture should be writable");
        fs::write(left.join("changed.txt"), "left").expect("fixture should be writable");
        fs::write(right.join("changed.txt"), "right").expect("fixture should be writable");
        fs::write(left.join("left-only.txt"), "left").expect("fixture should be writable");

        let result = compare_folders(&left, &right).expect("folder comparison should run");

        assert_eq!(result.exit_code, CliExitCode::Different);
        assert_eq!(result.total, 3);
        assert_eq!(result.same, 1);
        assert_eq!(result.different, 1);
        assert_eq!(result.left_only, 1);
        assert_eq!(result.right_only, 0);

        fs::remove_dir_all(left).expect("fixture should be removable");
        fs::remove_dir_all(right).expect("fixture should be removable");
    }

    #[test]
    fn opens_named_session_from_store_root() {
        let root = temp_dir_path("session-store");
        let store = session_core::SessionStore::new(&root);
        let session = session_core::SessionDocument::new(
            "session-1",
            "Daily compare",
            session_core::SessionType::TextCompare,
            session_core::SessionLocations::two_way(
                session_core::SessionLocation::local_path("left.txt"),
                session_core::SessionLocation::local_path("right.txt"),
            ),
        );

        store
            .save_named("team/daily", &session)
            .expect("session should save");

        let opened = open_named_session(&root, "team/daily").expect("session should open");

        assert_eq!(opened.exit_code, CliExitCode::Success);
        assert_eq!(opened.id, "session-1");
        assert_eq!(opened.name, "Daily compare");
        assert_eq!(opened.session_type, "text-compare");

        fs::remove_dir_all(root).expect("fixture should be removable");
    }

    fn temp_file_path(name: &str) -> std::path::PathBuf {
        let stamp = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .expect("system time should be after epoch")
            .as_nanos();

        std::env::temp_dir().join(format!("open-diff-cli-{name}-{stamp}.txt"))
    }

    fn temp_dir_path(name: &str) -> std::path::PathBuf {
        let stamp = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .expect("system time should be after epoch")
            .as_nanos();

        std::env::temp_dir().join(format!("open-diff-cli-{name}-{stamp}"))
    }
}
