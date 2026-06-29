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
    ShellCompare {
        path: String,
    },
    GitDifftoolConfig {
        executable_path: String,
        scope: GitConfigScope,
    },
    GitMergetoolConfig {
        executable_path: String,
        scope: GitConfigScope,
    },
    SvnDiff {
        left: String,
        right: String,
    },
    SvnDiffConfig {
        executable_path: String,
        wrapper_path: String,
    },
    CompareFiles {
        left: String,
        right: String,
    },
    CompareFolders {
        left: String,
        right: String,
    },
    OpenSession {
        store_root: String,
        name: String,
    },
    MergeText(CliTextMergeArgs),
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum GitConfigScope {
    Global,
    Local,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CliTextMergeArgs {
    pub base: String,
    pub left: String,
    pub right: String,
    pub output: Option<String>,
    pub automerge: bool,
    pub favor: Option<CliTextMergeFavor>,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum CliTextMergeFavor {
    Left,
    Right,
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

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CliExitCodeSpec {
    pub code: CliExitCode,
    pub value: i32,
    pub meaning: &'static str,
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
pub struct CliTextMergeResult {
    pub exit_code: CliExitCode,
    pub conflicts: usize,
    pub output_path: Option<String>,
    pub backup_path: Option<String>,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct GitToolConfigDocument {
    pub tool_name: String,
    pub description: String,
    pub commands: Vec<String>,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SvnDiffConfigDocument {
    pub description: String,
    pub config_snippet: String,
    pub wrapper_script: String,
    pub example_command: String,
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
        "--shell-compare" | "shell-compare" => parse_shell_compare(args.collect()),
        "git-difftool-config" => parse_git_difftool_config(args.collect()),
        "git-mergetool-config" => parse_git_mergetool_config(args.collect()),
        "svn-diff" => parse_svn_diff(args.collect()),
        "svn-diff-config" => parse_svn_diff_config(args.collect()),
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

pub fn cli_exit_code_contract() -> [CliExitCodeSpec; 5] {
    [
        CliExitCodeSpec {
            code: CliExitCode::Success,
            value: 0,
            meaning: "success",
        },
        CliExitCodeSpec {
            code: CliExitCode::Different,
            value: 1,
            meaning: "differences detected",
        },
        CliExitCodeSpec {
            code: CliExitCode::UsageError,
            value: 2,
            meaning: "usage error",
        },
        CliExitCodeSpec {
            code: CliExitCode::RuntimeError,
            value: 3,
            meaning: "runtime error",
        },
        CliExitCodeSpec {
            code: CliExitCode::Cancelled,
            value: 4,
            meaning: "cancelled",
        },
    ]
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

pub fn automerge_text_files(args: CliTextMergeArgs) -> Result<CliTextMergeResult, CliRuntimeError> {
    if !args.automerge {
        return Err(CliRuntimeError {
            message: "merge-text automerge requires --automerge".to_owned(),
            exit_code: CliExitCode::UsageError,
        });
    }

    let output_path = args.output.clone().ok_or_else(|| CliRuntimeError {
        message: "merge-text automerge requires an output path".to_owned(),
        exit_code: CliExitCode::UsageError,
    })?;
    let base = file_core::read_text_file(&args.base).map_err(runtime_error)?;
    let left = file_core::read_text_file(&args.left).map_err(runtime_error)?;
    let right = file_core::read_text_file(&args.right).map_err(runtime_error)?;
    let document = merge_core::TextMergeDocument::from_inputs(merge_core::TextMergeInput {
        base: merge_core::TextMergeSide::new(args.base, base.text),
        left: merge_core::TextMergeSide::new(args.left, left.text),
        right: merge_core::TextMergeSide::new(args.right, right.text),
        output_path: Some(output_path.clone()),
    });
    let result =
        merge_core::auto_merge_text_with_options(&document, merge_options_for_favor(args.favor));

    if result.conflicts > 0 {
        return Ok(CliTextMergeResult {
            exit_code: CliExitCode::Different,
            conflicts: result.conflicts,
            output_path: Some(output_path),
            backup_path: None,
        });
    }

    let save =
        file_core::save_text_file(&output_path, result.output_text).map_err(runtime_error)?;

    Ok(CliTextMergeResult {
        exit_code: CliExitCode::Success,
        conflicts: 0,
        output_path: Some(save.path),
        backup_path: save.backup_path,
    })
}

pub fn build_git_difftool_config(
    executable_path: impl AsRef<str>,
    scope: GitConfigScope,
) -> Result<GitToolConfigDocument, CliRuntimeError> {
    let executable_path = executable_path.as_ref().trim();

    if executable_path.is_empty() {
        return Err(CliRuntimeError {
            message: "git difftool executable path is required".to_owned(),
            exit_code: CliExitCode::UsageError,
        });
    }

    let scope_flag = git_config_scope_flag(scope);
    let compare_command = format!(
        "{} compare \"$LOCAL\" \"$REMOTE\"",
        quote_executable_for_git_command(executable_path)
    );

    Ok(GitToolConfigDocument {
        tool_name: "open-diff".to_owned(),
        description: "Git difftool configuration for Open Diff text comparisons.".to_owned(),
        commands: vec![
            format!("git config {scope_flag} diff.tool open-diff"),
            format!(
                "git config {scope_flag} difftool.open-diff.cmd {}",
                quote_shell_argument(&compare_command)
            ),
            format!("git config {scope_flag} difftool.open-diff.prompt false"),
            format!("git config {scope_flag} difftool.open-diff.trustExitCode true"),
        ],
    })
}

pub fn build_git_mergetool_config(
    executable_path: impl AsRef<str>,
    scope: GitConfigScope,
) -> Result<GitToolConfigDocument, CliRuntimeError> {
    let executable_path = executable_path.as_ref().trim();

    if executable_path.is_empty() {
        return Err(CliRuntimeError {
            message: "git mergetool executable path is required".to_owned(),
            exit_code: CliExitCode::UsageError,
        });
    }

    let scope_flag = git_config_scope_flag(scope);
    let merge_command = format!(
        "{} merge-text \"$BASE\" \"$LOCAL\" \"$REMOTE\" \"$MERGED\"",
        quote_executable_for_git_command(executable_path)
    );

    Ok(GitToolConfigDocument {
        tool_name: "open-diff".to_owned(),
        description: "Git mergetool configuration for Open Diff text merges.".to_owned(),
        commands: vec![
            format!("git config {scope_flag} merge.tool open-diff"),
            format!(
                "git config {scope_flag} mergetool.open-diff.cmd {}",
                quote_shell_argument(&merge_command)
            ),
            format!("git config {scope_flag} mergetool.open-diff.prompt false"),
            format!("git config {scope_flag} mergetool.open-diff.trustExitCode true"),
            format!("git config {scope_flag} mergetool.open-diff.keepBackup false"),
        ],
    })
}

pub fn build_svn_diff_config(
    executable_path: impl AsRef<str>,
    wrapper_path: impl AsRef<str>,
) -> Result<SvnDiffConfigDocument, CliRuntimeError> {
    let executable_path = executable_path.as_ref().trim();
    let wrapper_path = wrapper_path.as_ref().trim();

    if executable_path.is_empty() {
        return Err(CliRuntimeError {
            message: "svn diff executable path is required".to_owned(),
            exit_code: CliExitCode::UsageError,
        });
    }

    if wrapper_path.is_empty() {
        return Err(CliRuntimeError {
            message: "svn diff wrapper path is required".to_owned(),
            exit_code: CliExitCode::UsageError,
        });
    }

    Ok(SvnDiffConfigDocument {
        description: "Subversion external diff configuration for Open Diff.".to_owned(),
        config_snippet: format!("[helpers]\ndiff-cmd = {wrapper_path}\ndiff-extensions = -u"),
        wrapper_script: format!(
            "@echo off\r\n{} svn-diff %*\r\n",
            quote_windows_command_path(executable_path)
        ),
        example_command: format!("svn diff --diff-cmd {}", quote_shell_argument(wrapper_path)),
    })
}

fn help_invocation() -> CliInvocation {
    CliInvocation {
        command: CliCommand::Help,
        exit_code: CliExitCode::Success,
    }
}

fn parse_shell_compare(args: Vec<String>) -> Result<CliInvocation, CliParseError> {
    if args.len() != 1 {
        return Err(usage_error("shell-compare requires PATH"));
    }

    Ok(CliInvocation {
        command: CliCommand::ShellCompare {
            path: args[0].clone(),
        },
        exit_code: CliExitCode::Success,
    })
}

fn parse_svn_diff(args: Vec<String>) -> Result<CliInvocation, CliParseError> {
    if args.len() < 2 {
        return Err(usage_error("svn-diff requires SVN external diff arguments"));
    }

    let right = args[args.len() - 1].clone();
    let left = args[args.len() - 2].clone();

    Ok(CliInvocation {
        command: CliCommand::SvnDiff { left, right },
        exit_code: CliExitCode::Success,
    })
}

fn parse_svn_diff_config(args: Vec<String>) -> Result<CliInvocation, CliParseError> {
    if args.len() != 2 {
        return Err(usage_error(
            "svn-diff-config requires EXECUTABLE_PATH and WRAPPER_PATH",
        ));
    }

    Ok(CliInvocation {
        command: CliCommand::SvnDiffConfig {
            executable_path: args[0].clone(),
            wrapper_path: args[1].clone(),
        },
        exit_code: CliExitCode::Success,
    })
}

fn parse_git_mergetool_config(args: Vec<String>) -> Result<CliInvocation, CliParseError> {
    let (executable_path, scope) = parse_git_tool_config_args(
        args,
        "git-mergetool-config",
        "git-mergetool-config requires EXECUTABLE_PATH",
    )?;

    Ok(CliInvocation {
        command: CliCommand::GitMergetoolConfig {
            executable_path,
            scope,
        },
        exit_code: CliExitCode::Success,
    })
}

fn parse_git_difftool_config(args: Vec<String>) -> Result<CliInvocation, CliParseError> {
    let (executable_path, scope) = parse_git_tool_config_args(
        args,
        "git-difftool-config",
        "git-difftool-config requires EXECUTABLE_PATH",
    )?;

    Ok(CliInvocation {
        command: CliCommand::GitDifftoolConfig {
            executable_path,
            scope,
        },
        exit_code: CliExitCode::Success,
    })
}

fn parse_git_tool_config_args(
    args: Vec<String>,
    command_name: &str,
    missing_path_message: &str,
) -> Result<(String, GitConfigScope), CliParseError> {
    let mut scope = GitConfigScope::Global;
    let mut paths = Vec::new();

    for arg in args {
        match normalized_switch(&arg).as_deref() {
            Some("global") => scope = GitConfigScope::Global,
            Some("local") => scope = GitConfigScope::Local,
            Some(unknown) => {
                return Err(usage_error(format!(
                    "unknown {command_name} switch: {unknown}"
                )))
            }
            None => paths.push(arg),
        }
    }

    if paths.len() != 1 {
        return Err(usage_error(missing_path_message));
    }

    Ok((paths[0].clone(), scope))
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
    let mut automerge = false;
    let mut favor = None;
    let mut paths = Vec::new();

    for arg in args {
        match normalized_switch(&arg).as_deref() {
            Some("automerge") => automerge = true,
            Some("favorleft") | Some("favor-left") => favor = Some(CliTextMergeFavor::Left),
            Some("favorright") | Some("favor-right") => favor = Some(CliTextMergeFavor::Right),
            Some(unknown) => {
                return Err(usage_error(format!("unknown merge-text switch: {unknown}")))
            }
            None => paths.push(arg),
        }
    }

    if !(paths.len() == 3 || paths.len() == 4) {
        return Err(usage_error(
            "merge-text requires BASE LEFT RIGHT [OUTPUT] paths",
        ));
    }

    Ok(CliInvocation {
        command: CliCommand::MergeText(CliTextMergeArgs {
            base: paths[0].clone(),
            left: paths[1].clone(),
            right: paths[2].clone(),
            output: paths.get(3).cloned(),
            automerge,
            favor,
        }),
        exit_code: CliExitCode::Success,
    })
}

fn normalized_switch(arg: &str) -> Option<String> {
    arg.strip_prefix("--")
        .or_else(|| arg.strip_prefix('/'))
        .map(|value| value.to_ascii_lowercase())
}

fn git_config_scope_flag(scope: GitConfigScope) -> &'static str {
    match scope {
        GitConfigScope::Global => "--global",
        GitConfigScope::Local => "--local",
    }
}

fn quote_executable_for_git_command(executable_path: &str) -> String {
    format!("\"{}\"", executable_path.replace('"', "\\\""))
}

fn quote_shell_argument(value: &str) -> String {
    format!("'{}'", value.replace('\'', "''"))
}

fn quote_windows_command_path(value: &str) -> String {
    format!("\"{}\"", value.replace('"', "\"\""))
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

fn merge_options_for_favor(favor: Option<CliTextMergeFavor>) -> merge_core::TextMergeOptions {
    merge_core::TextMergeOptions {
        conflict_policy: match favor {
            Some(CliTextMergeFavor::Left) => merge_core::TextMergeConflictPolicy::FavorLeft,
            Some(CliTextMergeFavor::Right) => merge_core::TextMergeConflictPolicy::FavorRight,
            None => merge_core::TextMergeConflictPolicy::MarkConflict,
        },
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

        let shell_compare =
            parse_cli_args(["open-diff-app", "--shell-compare", "D:/work/file.txt"])
                .expect("shell compare should parse");
        assert_eq!(
            shell_compare.command,
            CliCommand::ShellCompare {
                path: "D:/work/file.txt".to_owned(),
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
                automerge: false,
                favor: None,
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
                automerge: false,
                favor: None,
            })
        );
    }

    #[test]
    fn parses_automerge_and_favor_switches_for_text_merge() {
        let invocation = parse_cli_args([
            "open-diff-cli",
            "merge-text",
            "--automerge",
            "/favorleft",
            "base",
            "left",
            "right",
            "output",
        ])
        .expect("automerge switches should parse");

        assert_eq!(
            invocation.command,
            CliCommand::MergeText(CliTextMergeArgs {
                base: "base".to_owned(),
                left: "left".to_owned(),
                right: "right".to_owned(),
                output: Some("output".to_owned()),
                automerge: true,
                favor: Some(CliTextMergeFavor::Left),
            })
        );
    }

    #[test]
    fn builds_git_difftool_configuration_commands() {
        let invocation = parse_cli_args([
            "open-diff-cli",
            "git-difftool-config",
            "C:/Program Files/OpenDiff/open-diff-cli.exe",
        ])
        .expect("git difftool config should parse");

        assert_eq!(
            invocation.command,
            CliCommand::GitDifftoolConfig {
                executable_path: "C:/Program Files/OpenDiff/open-diff-cli.exe".to_owned(),
                scope: GitConfigScope::Global,
            }
        );

        let config = build_git_difftool_config(
            "C:/Program Files/OpenDiff/open-diff-cli.exe",
            GitConfigScope::Global,
        )
        .expect("config should build");

        assert_eq!(config.tool_name, "open-diff");
        assert!(config.description.contains("Git difftool"));
        assert_eq!(
            config.commands,
            vec![
                "git config --global diff.tool open-diff".to_owned(),
                "git config --global difftool.open-diff.cmd '\"C:/Program Files/OpenDiff/open-diff-cli.exe\" compare \"$LOCAL\" \"$REMOTE\"'".to_owned(),
                "git config --global difftool.open-diff.prompt false".to_owned(),
                "git config --global difftool.open-diff.trustExitCode true".to_owned(),
            ]
        );

        let local = parse_cli_args([
            "open-diff-cli",
            "git-difftool-config",
            "--local",
            "D:/tools/open-diff-cli.exe",
        ])
        .expect("local git difftool config should parse");
        assert_eq!(
            local.command,
            CliCommand::GitDifftoolConfig {
                executable_path: "D:/tools/open-diff-cli.exe".to_owned(),
                scope: GitConfigScope::Local,
            }
        );
    }

    #[test]
    fn builds_git_mergetool_configuration_commands() {
        let invocation = parse_cli_args([
            "open-diff-cli",
            "git-mergetool-config",
            "C:/Program Files/OpenDiff/open-diff-cli.exe",
        ])
        .expect("git mergetool config should parse");

        assert_eq!(
            invocation.command,
            CliCommand::GitMergetoolConfig {
                executable_path: "C:/Program Files/OpenDiff/open-diff-cli.exe".to_owned(),
                scope: GitConfigScope::Global,
            }
        );

        let config = build_git_mergetool_config(
            "C:/Program Files/OpenDiff/open-diff-cli.exe",
            GitConfigScope::Global,
        )
        .expect("config should build");

        assert_eq!(config.tool_name, "open-diff");
        assert!(config.description.contains("Git mergetool"));
        assert_eq!(
            config.commands,
            vec![
                "git config --global merge.tool open-diff".to_owned(),
                "git config --global mergetool.open-diff.cmd '\"C:/Program Files/OpenDiff/open-diff-cli.exe\" merge-text \"$BASE\" \"$LOCAL\" \"$REMOTE\" \"$MERGED\"'".to_owned(),
                "git config --global mergetool.open-diff.prompt false".to_owned(),
                "git config --global mergetool.open-diff.trustExitCode true".to_owned(),
                "git config --global mergetool.open-diff.keepBackup false".to_owned(),
            ]
        );

        let local = parse_cli_args([
            "open-diff-cli",
            "git-mergetool-config",
            "--local",
            "D:/tools/open-diff-cli.exe",
        ])
        .expect("local git mergetool config should parse");
        assert_eq!(
            local.command,
            CliCommand::GitMergetoolConfig {
                executable_path: "D:/tools/open-diff-cli.exe".to_owned(),
                scope: GitConfigScope::Local,
            }
        );
    }

    #[test]
    fn parses_svn_diff_wrapper_arguments_and_builds_config() {
        let invocation = parse_cli_args([
            "open-diff-cli",
            "svn-diff",
            "-u",
            "-L",
            "file.txt (revision 1)",
            "-L",
            "file.txt (working copy)",
            "C:/work/.svn/text-base/file.txt.svn-base",
            "C:/work/file.txt",
        ])
        .expect("svn diff wrapper arguments should parse");

        assert_eq!(
            invocation.command,
            CliCommand::SvnDiff {
                left: "C:/work/.svn/text-base/file.txt.svn-base".to_owned(),
                right: "C:/work/file.txt".to_owned(),
            }
        );

        let config = build_svn_diff_config(
            "C:/Program Files/OpenDiff/open-diff-cli.exe",
            "C:/Tools/open-diff-svn-diff.cmd",
        )
        .expect("svn config should build");

        assert!(config.description.contains("Subversion external diff"));
        assert_eq!(
            config.config_snippet,
            "[helpers]\ndiff-cmd = C:/Tools/open-diff-svn-diff.cmd\ndiff-extensions = -u"
        );
        assert_eq!(
            config.wrapper_script,
            "@echo off\r\n\"C:/Program Files/OpenDiff/open-diff-cli.exe\" svn-diff %*\r\n"
        );
        assert_eq!(
            config.example_command,
            "svn diff --diff-cmd 'C:/Tools/open-diff-svn-diff.cmd'"
        );

        let config_invocation = parse_cli_args([
            "open-diff-cli",
            "svn-diff-config",
            "C:/Program Files/OpenDiff/open-diff-cli.exe",
            "C:/Tools/open-diff-svn-diff.cmd",
        ])
        .expect("svn diff config should parse");
        assert_eq!(
            config_invocation.command,
            CliCommand::SvnDiffConfig {
                executable_path: "C:/Program Files/OpenDiff/open-diff-cli.exe".to_owned(),
                wrapper_path: "C:/Tools/open-diff-svn-diff.cmd".to_owned(),
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
    fn exposes_stable_exit_code_contract() {
        assert_eq!(cli_exit_code_value(CliExitCode::Success), 0);
        assert_eq!(cli_exit_code_value(CliExitCode::Different), 1);
        assert_eq!(cli_exit_code_value(CliExitCode::UsageError), 2);
        assert_eq!(cli_exit_code_value(CliExitCode::RuntimeError), 3);
        assert_eq!(cli_exit_code_value(CliExitCode::Cancelled), 4);

        assert_eq!(
            cli_exit_code_contract(),
            [
                CliExitCodeSpec {
                    code: CliExitCode::Success,
                    value: 0,
                    meaning: "success",
                },
                CliExitCodeSpec {
                    code: CliExitCode::Different,
                    value: 1,
                    meaning: "differences detected",
                },
                CliExitCodeSpec {
                    code: CliExitCode::UsageError,
                    value: 2,
                    meaning: "usage error",
                },
                CliExitCodeSpec {
                    code: CliExitCode::RuntimeError,
                    value: 3,
                    meaning: "runtime error",
                },
                CliExitCodeSpec {
                    code: CliExitCode::Cancelled,
                    value: 4,
                    meaning: "cancelled",
                },
            ]
        );
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

    #[test]
    fn automerges_non_conflicting_text_to_output() {
        let base = temp_file_path("merge-base");
        let left = temp_file_path("merge-left");
        let right = temp_file_path("merge-right");
        let output = temp_file_path("merge-output");

        fs::write(&base, "one\ntwo\nthree").expect("base fixture should be writable");
        fs::write(&left, "ONE\ntwo\nthree").expect("left fixture should be writable");
        fs::write(&right, "one\ntwo\nTHREE").expect("right fixture should be writable");

        let result = automerge_text_files(CliTextMergeArgs {
            base: base.to_string_lossy().into_owned(),
            left: left.to_string_lossy().into_owned(),
            right: right.to_string_lossy().into_owned(),
            output: Some(output.to_string_lossy().into_owned()),
            automerge: true,
            favor: None,
        })
        .expect("automerge should run");

        assert_eq!(result.exit_code, CliExitCode::Success);
        assert_eq!(result.conflicts, 0);
        assert_eq!(
            fs::read_to_string(&output).expect("output should be saved"),
            "ONE\ntwo\nTHREE"
        );

        fs::remove_file(base).expect("base fixture should be removable");
        fs::remove_file(left).expect("left fixture should be removable");
        fs::remove_file(right).expect("right fixture should be removable");
        fs::remove_file(output).expect("output fixture should be removable");
    }

    #[test]
    fn automerge_reports_conflicts_without_overwriting_output() {
        let base = temp_file_path("conflict-base");
        let left = temp_file_path("conflict-left");
        let right = temp_file_path("conflict-right");
        let output = temp_file_path("conflict-output");

        fs::write(&base, "one\ntwo\nthree").expect("base fixture should be writable");
        fs::write(&left, "one\nleft change\nthree").expect("left fixture should be writable");
        fs::write(&right, "one\nright change\nthree").expect("right fixture should be writable");
        fs::write(&output, "existing output").expect("output fixture should be writable");

        let result = automerge_text_files(CliTextMergeArgs {
            base: base.to_string_lossy().into_owned(),
            left: left.to_string_lossy().into_owned(),
            right: right.to_string_lossy().into_owned(),
            output: Some(output.to_string_lossy().into_owned()),
            automerge: true,
            favor: None,
        })
        .expect("automerge should report conflicts");

        assert_eq!(result.exit_code, CliExitCode::Different);
        assert_eq!(result.conflicts, 1);
        assert_eq!(
            fs::read_to_string(&output).expect("output should remain unchanged"),
            "existing output"
        );

        fs::remove_file(base).expect("base fixture should be removable");
        fs::remove_file(left).expect("left fixture should be removable");
        fs::remove_file(right).expect("right fixture should be removable");
        fs::remove_file(output).expect("output fixture should be removable");
    }

    #[test]
    fn automerge_favor_left_writes_conflicting_left_side() {
        let base = temp_file_path("favor-base");
        let left = temp_file_path("favor-left");
        let right = temp_file_path("favor-right");
        let output = temp_file_path("favor-output");

        fs::write(&base, "one\ntwo\nthree").expect("base fixture should be writable");
        fs::write(&left, "one\nleft change\nthree").expect("left fixture should be writable");
        fs::write(&right, "one\nright change\nthree").expect("right fixture should be writable");

        let result = automerge_text_files(CliTextMergeArgs {
            base: base.to_string_lossy().into_owned(),
            left: left.to_string_lossy().into_owned(),
            right: right.to_string_lossy().into_owned(),
            output: Some(output.to_string_lossy().into_owned()),
            automerge: true,
            favor: Some(CliTextMergeFavor::Left),
        })
        .expect("favor-left automerge should run");

        assert_eq!(result.exit_code, CliExitCode::Success);
        assert_eq!(result.conflicts, 0);
        assert_eq!(
            fs::read_to_string(&output).expect("output should be saved"),
            "one\nleft change\nthree"
        );

        fs::remove_file(base).expect("base fixture should be removable");
        fs::remove_file(left).expect("left fixture should be removable");
        fs::remove_file(right).expect("right fixture should be removable");
        fs::remove_file(output).expect("output fixture should be removable");
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
