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

fn usage_error(message: impl Into<String>) -> CliParseError {
    CliParseError {
        message: message.into(),
        exit_code: CliExitCode::UsageError,
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

    fn temp_file_path(name: &str) -> std::path::PathBuf {
        let stamp = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .expect("system time should be after epoch")
            .as_nanos();

        std::env::temp_dir().join(format!("open-diff-cli-{name}-{stamp}.txt"))
    }
}
