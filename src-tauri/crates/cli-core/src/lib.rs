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
        select_left: bool,
    },
    GitDifftoolConfig {
        executable_path: String,
        scope: GitConfigScope,
        write: bool,
    },
    GitMergetoolConfig {
        executable_path: String,
        scope: GitConfigScope,
        write: bool,
    },
    SvnDiff {
        left: String,
        right: String,
    },
    SvnDiffConfig {
        executable_path: String,
        wrapper_path: String,
        write: bool,
    },
    CompareFiles {
        left: String,
        right: String,
        quiet: bool,
    },
    CompareFolders {
        left: String,
        right: String,
        quiet: bool,
    },
    OpenSession {
        store_root: String,
        name: String,
    },
    OpenCompare {
        session_type: String,
        left: String,
        right: String,
        route: String,
        options: CliOpenOptions,
    },
    SyncPreview {
        left: String,
        right: String,
        quiet: bool,
    },
    MergeText(CliTextMergeArgs),
    Script {
        path: String,
    },
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

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct CliOpenOptions {
    pub center: Option<String>,
    pub output: Option<String>,
    pub title: Option<String>,
    pub left_readonly: bool,
    pub right_readonly: bool,
    pub readonly: bool,
    pub silent: bool,
    pub favor: Option<CliTextMergeFavor>,
    pub edit: bool,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum CliExitCode {
    Success = 0,
    Different = 1,
    Conflict = 2,
    UsageError = 3,
    IoError = 4,
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
    pub left: Option<String>,
    pub right: Option<String>,
    pub center: Option<String>,
    pub output: Option<String>,
    pub note: String,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CliOpenCompareResult {
    pub exit_code: CliExitCode,
    pub session_type: String,
    pub route: String,
    pub left: String,
    pub right: String,
    pub options: CliOpenOptions,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CliSyncPreviewResult {
    pub exit_code: CliExitCode,
    pub total: usize,
    pub copy: usize,
    pub delete: usize,
    pub leave: usize,
    pub conflict: usize,
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
        "script" => parse_script_file(args.collect()),
        "compare" => parse_compare_files(args.collect()),
        "compare-folders" => parse_compare_folders(args.collect()),
        "open-session" => parse_open_session(args.collect()),
        "open" => parse_open_compare(args.collect()),
        "sync-preview" | "sync" => parse_sync_preview(args.collect()),
        "merge-text" => parse_merge_text(args.collect()),
        unknown => Err(usage_error(format!("unknown command: {unknown}"))),
    }
}

pub fn cli_exit_code_value(exit_code: CliExitCode) -> i32 {
    exit_code as i32
}

pub fn cli_help_text() -> String {
    let mut lines = vec![
        "Usage: open-diff-cli <command> [args]".to_owned(),
        "Commands:".to_owned(),
        "  compare [--quiet] <left> <right>".to_owned(),
        "  compare-folders [--quiet] <left> <right>".to_owned(),
        "  shell-compare [--select-left] <path>".to_owned(),
        "  git-difftool-config [--global|--local] [--write] <executable-path>".to_owned(),
        "  git-mergetool-config [--global|--local] [--write] <executable-path>".to_owned(),
        "  svn-diff <svn external diff args>".to_owned(),
        "  svn-diff-config [--write] <executable-path> <wrapper-path>".to_owned(),
        "  script <script-path>".to_owned(),
        "  open-session <store-root> <name>".to_owned(),
        "  open [options] <left> <right>".to_owned(),
        "      --session <type>   folder-compare, folder-sync, folder-merge,".to_owned(),
        "                         text-compare, text-merge, text-edit, text-patch,".to_owned(),
        "                         table-compare, hex-compare, picture-compare,".to_owned(),
        "                         registry-compare, media-compare, version-compare".to_owned(),
        "      --fv <type>        alias for --session (accepts spaced names)".to_owned(),
        "      --title <text>     set the session / window title".to_owned(),
        "      --left <path>      left side path (or positional)".to_owned(),
        "      --right <path>     right side path (or positional)".to_owned(),
        "      --center <path>    center/base path for merge sessions".to_owned(),
        "      --output <path>    output path for merge sessions".to_owned(),
        "      --readonly         mark both sides read-only".to_owned(),
        "      --left-readonly    mark left side read-only".to_owned(),
        "      --right-readonly   mark right side read-only".to_owned(),
        "      --silent           suppress launch chatter when staging UI open".to_owned(),
        "      --favor-left       prefer left on merge conflicts".to_owned(),
        "      --favor-right      prefer right on merge conflicts".to_owned(),
        "      --edit             open in an editable session when applicable".to_owned(),
        "  sync-preview|sync [--quiet] <left> <right>".to_owned(),
        "  merge-text --automerge [--favor-left|--favor-right] <base> <left> <right> [output]"
            .to_owned(),
        "Switches accept --name, -name, or /name forms.".to_owned(),
        "Exit codes:".to_owned(),
    ];
    for spec in cli_exit_code_contract() {
        lines.push(format!("  {} {}", spec.value, spec.meaning));
    }
    lines.join("\n")
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
            code: CliExitCode::Conflict,
            value: 2,
            meaning: "conflicts or partial failure",
        },
        CliExitCodeSpec {
            code: CliExitCode::UsageError,
            value: 3,
            meaning: "usage error",
        },
        CliExitCodeSpec {
            code: CliExitCode::IoError,
            value: 4,
            meaning: "IO, network, permission or conversion error",
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
        left: session
            .locations
            .left
            .as_ref()
            .map(|location| location.uri.clone()),
        right: session
            .locations
            .right
            .as_ref()
            .map(|location| location.uri.clone()),
        center: session
            .locations
            .center
            .as_ref()
            .map(|location| location.uri.clone()),
        output: session
            .locations
            .output
            .as_ref()
            .map(|location| location.uri.clone()),
        note: "Desktop handoff is not available from this CLI; open the session file in the app."
            .to_owned(),
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
            exit_code: CliExitCode::Conflict,
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
        "{} merge-text --automerge \"$BASE\" \"$LOCAL\" \"$REMOTE\" \"$MERGED\"",
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

pub fn write_git_tool_config(config: &GitToolConfigDocument) -> Result<String, CliRuntimeError> {
    write_git_tool_config_to_file(config, None)
}

pub fn write_git_tool_config_to_file(
    config: &GitToolConfigDocument,
    file: Option<&Path>,
) -> Result<String, CliRuntimeError> {
    for command in &config.commands {
        let command = match file {
            Some(path) => rewrite_git_config_command_to_file(command, path),
            None => command.to_owned(),
        };
        run_git_config_command(&command)?;
    }

    Ok(format!(
        "Wrote {} git config entries for {}",
        config.commands.len(),
        config.tool_name
    ))
}

fn rewrite_git_config_command_to_file(command: &str, file: &Path) -> String {
    command
        .replacen("--global", &format!("--file {}", file.display()), 1)
        .replacen("--local", &format!("--file {}", file.display()), 1)
}

pub fn write_svn_diff_config(
    config: &SvnDiffConfigDocument,
    wrapper_path: &str,
) -> Result<String, CliRuntimeError> {
    let wrapper = Path::new(wrapper_path);
    if let Some(parent) = wrapper.parent() {
        std::fs::create_dir_all(parent).map_err(|error| CliRuntimeError {
            message: error.to_string(),
            exit_code: CliExitCode::IoError,
        })?;
    }

    std::fs::write(wrapper, &config.wrapper_script).map_err(|error| CliRuntimeError {
        message: error.to_string(),
        exit_code: CliExitCode::IoError,
    })?;

    let snippet_path = wrapper.with_extension("svnconfig");
    std::fs::write(&snippet_path, &config.config_snippet).map_err(|error| CliRuntimeError {
        message: error.to_string(),
        exit_code: CliExitCode::IoError,
    })?;

    Ok(format!(
        "Wrote SVN wrapper to {} and config snippet to {}",
        wrapper.display(),
        snippet_path.display()
    ))
}

fn run_git_config_command(command: &str) -> Result<(), CliRuntimeError> {
    let tokens = tokenize_git_config_command(command).ok_or_else(|| CliRuntimeError {
        message: format!("invalid git config command: {command}"),
        exit_code: CliExitCode::UsageError,
    })?;

    let output = std::process::Command::new(&tokens[0])
        .args(&tokens[1..])
        .output()
        .map_err(|error| CliRuntimeError {
            message: format!("failed to run git config: {error}"),
            exit_code: CliExitCode::IoError,
        })?;

    if output.status.success() {
        return Ok(());
    }

    Err(CliRuntimeError {
        message: format!(
            "git config failed: {}",
            String::from_utf8_lossy(&output.stderr).trim()
        ),
        exit_code: CliExitCode::IoError,
    })
}

fn tokenize_git_config_command(command: &str) -> Option<Vec<String>> {
    let mut tokens = Vec::new();
    let mut current = String::new();
    let mut chars = command.chars().peekable();
    let mut in_single = false;

    while let Some(ch) = chars.next() {
        match ch {
            '\'' if !in_single => in_single = true,
            '\'' if in_single => {
                if chars.peek() == Some(&'\'') {
                    current.push('\'');
                    chars.next();
                } else {
                    in_single = false;
                }
            }
            value if value.is_whitespace() && !in_single => {
                if !current.is_empty() {
                    tokens.push(std::mem::take(&mut current));
                }
            }
            value => current.push(value),
        }
    }

    if in_single {
        return None;
    }

    if !current.is_empty() {
        tokens.push(current);
    }

    if tokens.len() < 3 || tokens[0] != "git" {
        return None;
    }

    Some(tokens)
}

fn help_invocation() -> CliInvocation {
    CliInvocation {
        command: CliCommand::Help,
        exit_code: CliExitCode::Success,
    }
}

fn parse_shell_compare(args: Vec<String>) -> Result<CliInvocation, CliParseError> {
    let mut select_left = false;
    let mut path = None;

    for arg in args {
        if arg == "--select-left" || arg == "select-left" {
            select_left = true;
            continue;
        }

        if path.is_some() {
            return Err(usage_error(
                "shell-compare accepts optional --select-left and a single PATH",
            ));
        }

        path = Some(arg);
    }

    let Some(path) = path else {
        return Err(usage_error("shell-compare requires PATH"));
    };

    Ok(CliInvocation {
        command: CliCommand::ShellCompare { path, select_left },
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
    let mut write = false;
    let mut paths = Vec::new();

    for arg in args {
        match normalized_switch(&arg).as_deref() {
            Some("write") => write = true,
            Some(unknown) => {
                return Err(usage_error(format!(
                    "unknown svn-diff-config switch: {unknown}"
                )))
            }
            None => paths.push(arg),
        }
    }

    if paths.len() != 2 {
        return Err(usage_error(
            "svn-diff-config requires EXECUTABLE_PATH and WRAPPER_PATH",
        ));
    }

    Ok(CliInvocation {
        command: CliCommand::SvnDiffConfig {
            executable_path: paths[0].clone(),
            wrapper_path: paths[1].clone(),
            write,
        },
        exit_code: CliExitCode::Success,
    })
}

fn parse_script_file(args: Vec<String>) -> Result<CliInvocation, CliParseError> {
    if args.len() != 1 {
        return Err(usage_error("script requires SCRIPT_PATH"));
    }

    Ok(CliInvocation {
        command: CliCommand::Script {
            path: args[0].clone(),
        },
        exit_code: CliExitCode::Success,
    })
}

fn parse_git_mergetool_config(args: Vec<String>) -> Result<CliInvocation, CliParseError> {
    let (executable_path, scope, write) = parse_git_tool_config_args(
        args,
        "git-mergetool-config",
        "git-mergetool-config requires EXECUTABLE_PATH",
    )?;

    Ok(CliInvocation {
        command: CliCommand::GitMergetoolConfig {
            executable_path,
            scope,
            write,
        },
        exit_code: CliExitCode::Success,
    })
}

fn parse_git_difftool_config(args: Vec<String>) -> Result<CliInvocation, CliParseError> {
    let (executable_path, scope, write) = parse_git_tool_config_args(
        args,
        "git-difftool-config",
        "git-difftool-config requires EXECUTABLE_PATH",
    )?;

    Ok(CliInvocation {
        command: CliCommand::GitDifftoolConfig {
            executable_path,
            scope,
            write,
        },
        exit_code: CliExitCode::Success,
    })
}

fn parse_git_tool_config_args(
    args: Vec<String>,
    command_name: &str,
    missing_path_message: &str,
) -> Result<(String, GitConfigScope, bool), CliParseError> {
    let mut scope = GitConfigScope::Global;
    let mut write = false;
    let mut paths = Vec::new();

    for arg in args {
        match normalized_switch(&arg).as_deref() {
            Some("global") => scope = GitConfigScope::Global,
            Some("local") => scope = GitConfigScope::Local,
            Some("write") => write = true,
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

    Ok((paths[0].clone(), scope, write))
}

fn parse_compare_files(args: Vec<String>) -> Result<CliInvocation, CliParseError> {
    let mut quiet = false;
    let mut positionals = Vec::new();
    for arg in args {
        match normalized_switch(&arg).as_deref() {
            Some("quiet") | Some("q") => quiet = true,
            Some(unknown) => {
                return Err(usage_error(format!("unknown compare switch: {unknown}")));
            }
            None => positionals.push(arg),
        }
    }
    if positionals.len() != 2 {
        return Err(usage_error("compare requires LEFT and RIGHT paths"));
    }

    Ok(CliInvocation {
        command: CliCommand::CompareFiles {
            left: positionals[0].clone(),
            right: positionals[1].clone(),
            quiet,
        },
        exit_code: CliExitCode::Success,
    })
}

fn parse_compare_folders(args: Vec<String>) -> Result<CliInvocation, CliParseError> {
    let mut quiet = false;
    let mut positionals = Vec::new();
    for arg in args {
        match normalized_switch(&arg).as_deref() {
            Some("quiet") | Some("q") => quiet = true,
            Some(unknown) => {
                return Err(usage_error(format!(
                    "unknown compare-folders switch: {unknown}"
                )));
            }
            None => positionals.push(arg),
        }
    }
    if positionals.len() != 2 {
        return Err(usage_error("compare-folders requires LEFT and RIGHT paths"));
    }

    Ok(CliInvocation {
        command: CliCommand::CompareFolders {
            left: positionals[0].clone(),
            right: positionals[1].clone(),
            quiet,
        },
        exit_code: CliExitCode::Success,
    })
}

fn parse_open_compare(args: Vec<String>) -> Result<CliInvocation, CliParseError> {
    let mut session_type = None;
    let mut left = None;
    let mut right = None;
    let mut options = CliOpenOptions::default();
    let mut positionals = Vec::new();
    let mut index = 0;

    while index < args.len() {
        let arg = &args[index];
        match normalized_switch(arg).as_deref() {
            Some("session") | Some("type") | Some("fv") => {
                index += 1;
                let value = args
                    .get(index)
                    .ok_or_else(|| usage_error("open --session/--fv requires a session type"))?;
                session_type = Some(value.clone());
            }
            Some(switch)
                if switch.starts_with("session=")
                    || switch.starts_with("type=")
                    || switch.starts_with("fv=") =>
            {
                let value = switch.split_once('=').map(|(_, value)| value).unwrap_or("");
                session_type = Some(value.to_owned());
            }
            Some("left") => {
                index += 1;
                let value = args
                    .get(index)
                    .ok_or_else(|| usage_error("open --left requires a path"))?;
                left = Some(value.clone());
            }
            Some(switch) if switch.starts_with("left=") => {
                left = Some(switch[5..].to_owned());
            }
            Some("right") => {
                index += 1;
                let value = args
                    .get(index)
                    .ok_or_else(|| usage_error("open --right requires a path"))?;
                right = Some(value.clone());
            }
            Some(switch) if switch.starts_with("right=") => {
                right = Some(switch[6..].to_owned());
            }
            Some("center") | Some("base") => {
                index += 1;
                let value = args
                    .get(index)
                    .ok_or_else(|| usage_error("open --center requires a path"))?;
                options.center = Some(value.clone());
            }
            Some(switch) if switch.starts_with("center=") || switch.starts_with("base=") => {
                let value = switch.split_once('=').map(|(_, value)| value).unwrap_or("");
                options.center = Some(value.to_owned());
            }
            Some("output") | Some("out") => {
                index += 1;
                let value = args
                    .get(index)
                    .ok_or_else(|| usage_error("open --output requires a path"))?;
                options.output = Some(value.clone());
            }
            Some(switch) if switch.starts_with("output=") || switch.starts_with("out=") => {
                let value = switch.split_once('=').map(|(_, value)| value).unwrap_or("");
                options.output = Some(value.to_owned());
            }
            Some("readonly") | Some("ro") => options.readonly = true,
            Some("left-readonly") | Some("leftreadonly") => options.left_readonly = true,
            Some("right-readonly") | Some("rightreadonly") => options.right_readonly = true,
            Some("silent") => options.silent = true,
            Some("title") => {
                index += 1;
                let value = args
                    .get(index)
                    .ok_or_else(|| usage_error("open --title requires a value"))?;
                options.title = Some(value.clone());
            }
            Some(switch) if switch.starts_with("title=") => {
                let value = switch.split_once('=').map(|(_, value)| value).unwrap_or("");
                options.title = Some(value.to_owned());
            }
            Some("favor-left") | Some("favorleft") => {
                options.favor = Some(CliTextMergeFavor::Left);
            }
            Some("favor-right") | Some("favorright") => {
                options.favor = Some(CliTextMergeFavor::Right);
            }
            Some("edit") => options.edit = true,
            Some(unknown) => {
                return Err(usage_error(format!("unknown open switch: {unknown}")));
            }
            None => positionals.push(arg.clone()),
        }
        index += 1;
    }

    if options.readonly {
        options.left_readonly = true;
        options.right_readonly = true;
    }

    if left.is_none() && right.is_none() {
        if positionals.len() != 2 {
            return Err(usage_error(
                "open requires LEFT and RIGHT paths (or --left/--right)",
            ));
        }
        left = Some(positionals[0].clone());
        right = Some(positionals[1].clone());
    } else if left.is_none() || right.is_none() {
        return Err(usage_error("open requires both --left and --right"));
    } else if !positionals.is_empty() {
        return Err(usage_error(
            "open does not accept extra positional paths with --left/--right",
        ));
    }

    let left = left.expect("left path");
    let right = right.expect("right path");
    let (session_type, route) =
        resolve_open_session_type(session_type.as_deref(), &left, &right, options.edit)?;

    Ok(CliInvocation {
        command: CliCommand::OpenCompare {
            session_type: session_type.to_owned(),
            left,
            right,
            route: route.to_owned(),
            options,
        },
        exit_code: CliExitCode::Success,
    })
}

fn parse_sync_preview(args: Vec<String>) -> Result<CliInvocation, CliParseError> {
    let mut quiet = false;
    let mut positionals = Vec::new();
    for arg in args {
        match normalized_switch(&arg).as_deref() {
            Some("quiet") | Some("q") => quiet = true,
            Some(unknown) => {
                return Err(usage_error(format!(
                    "unknown sync-preview switch: {unknown}"
                )));
            }
            None => positionals.push(arg),
        }
    }
    if positionals.len() != 2 {
        return Err(usage_error("sync-preview requires LEFT and RIGHT paths"));
    }

    Ok(CliInvocation {
        command: CliCommand::SyncPreview {
            left: positionals[0].clone(),
            right: positionals[1].clone(),
            quiet,
        },
        exit_code: CliExitCode::Success,
    })
}

fn resolve_open_session_type(
    explicit: Option<&str>,
    left: &str,
    right: &str,
    edit: bool,
) -> Result<(&'static str, &'static str), CliParseError> {
    let key = explicit.map(normalize_session_type_key).unwrap_or_else(|| {
        if edit {
            "text-edit".to_owned()
        } else {
            infer_open_session_type(left, right)
        }
    });

    match key.as_str() {
        "folder" | "folder-compare" | "fc" => Ok(("folder-compare", "/compare/folder")),
        "folder-sync" | "sync" => Ok(("folder-sync", "/sync/folder")),
        "folder-merge" => Ok(("folder-merge", "/merge/folder")),
        "text" | "text-compare" | "tc" => Ok(("text-compare", "/compare/text")),
        "text-merge" | "merge" => Ok(("text-merge", "/merge/text")),
        "text-edit" | "edit" => Ok(("text-edit", "/edit/text")),
        "text-patch" | "patch" => Ok(("text-patch", "/patch/text")),
        "table" | "table-compare" => Ok(("table-compare", "/compare/table")),
        "hex" | "hex-compare" => Ok(("hex-compare", "/compare/hex")),
        "picture" | "picture-compare" | "image" => Ok(("picture-compare", "/compare/picture")),
        "registry" | "registry-compare" => Ok(("registry-compare", "/compare/registry")),
        "media" | "media-compare" => Ok(("media-compare", "/compare/media")),
        "version" | "version-compare" => Ok(("version-compare", "/compare/version")),
        other => Err(usage_error(format!("unknown session type: {other}"))),
    }
}

fn normalize_session_type_key(value: &str) -> String {
    let mut trimmed = value.trim();
    if trimmed.len() >= 2 {
        let bytes = trimmed.as_bytes();
        let first = bytes[0];
        let last = bytes[trimmed.len() - 1];
        let double_quoted = first == b'"' && last == b'"';
        let single_quoted = first == 39 && last == 39;
        if double_quoted || single_quoted {
            trimmed = trimmed[1..trimmed.len() - 1].trim();
        }
    }
    trimmed
        .chars()
        .map(|ch| {
            if ch.is_ascii_whitespace() || ch == '_' {
                '-'
            } else {
                ch.to_ascii_lowercase()
            }
        })
        .collect::<String>()
        .split('-')
        .filter(|part| !part.is_empty())
        .collect::<Vec<_>>()
        .join("-")
}

fn infer_open_session_type(left: &str, right: &str) -> String {
    let left_dir = Path::new(left).is_dir();
    let right_dir = Path::new(right).is_dir();
    if left_dir || right_dir {
        "folder-compare".to_owned()
    } else {
        "text-compare".to_owned()
    }
}

pub fn describe_open_compare(
    session_type: impl Into<String>,
    left: impl Into<String>,
    right: impl Into<String>,
    route: impl Into<String>,
    options: CliOpenOptions,
) -> CliOpenCompareResult {
    CliOpenCompareResult {
        exit_code: CliExitCode::Success,
        session_type: session_type.into(),
        route: route.into(),
        left: left.into(),
        right: right.into(),
        options,
    }
}

pub fn preview_folder_sync_cli(
    left: impl AsRef<Path>,
    right: impl AsRef<Path>,
) -> Result<CliSyncPreviewResult, CliRuntimeError> {
    let cancel_token = job_core::CancellationToken::default();
    let left_path = left.as_ref();
    let right_path = right.as_ref();
    let left_tree =
        folder_core::scan_local_folder(left_path, &cancel_token).map_err(runtime_error)?;
    let right_tree =
        folder_core::scan_local_folder(right_path, &cancel_token).map_err(runtime_error)?;
    let rows = folder_core::align_folder_trees(&left_tree, &right_tree);
    let plan = sync_core::build_update_right_plan(
        left_path.display().to_string(),
        right_path.display().to_string(),
        &rows,
    );
    let mut copy = 0usize;
    let mut delete = 0usize;
    let mut leave = 0usize;
    let mut conflict = 0usize;
    for item in &plan.items {
        match &item.action {
            sync_core::SyncAction::Copy { .. } => copy += 1,
            sync_core::SyncAction::Delete { .. } => delete += 1,
            sync_core::SyncAction::Leave => leave += 1,
            sync_core::SyncAction::Conflict { .. } => conflict += 1,
        }
    }
    let has_work = copy > 0 || delete > 0 || conflict > 0;
    Ok(CliSyncPreviewResult {
        exit_code: if has_work {
            CliExitCode::Different
        } else {
            CliExitCode::Success
        },
        total: plan.items.len(),
        copy,
        delete,
        leave,
        conflict,
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
    if let Some(value) = arg.strip_prefix("--") {
        return Some(value.to_ascii_lowercase());
    }
    if let Some(value) = arg.strip_prefix('/') {
        // Windows-style /switch. Absolute Unix paths like /tmp/a stay positional.
        if value.is_empty() || value.contains('/') || value.contains('\\') {
            return None;
        }
        return Some(value.to_ascii_lowercase());
    }
    if let Some(value) = arg.strip_prefix('-') {
        if value.is_empty() {
            return None;
        }
        // Keep numeric positional values like -1 from becoming switches.
        if value.chars().next().is_some_and(|ch| ch.is_ascii_digit()) {
            return None;
        }
        return Some(value.to_ascii_lowercase());
    }
    None
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
        exit_code: CliExitCode::IoError,
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
                quiet: false,
            }
        );

        let shell_compare =
            parse_cli_args(["open-diff-app", "--shell-compare", "D:/work/file.txt"])
                .expect("shell compare should parse");
        assert_eq!(
            shell_compare.command,
            CliCommand::ShellCompare {
                path: "D:/work/file.txt".to_owned(),
                select_left: false,
            }
        );

        let select_left = parse_cli_args([
            "open-diff-app",
            "--shell-compare",
            "--select-left",
            "D:/work/left.txt",
        ])
        .expect("select-left shell compare should parse");
        assert_eq!(
            select_left.command,
            CliCommand::ShellCompare {
                path: "D:/work/left.txt".to_owned(),
                select_left: true,
            }
        );

        let folders = parse_cli_args(["open-diff-cli", "compare-folders", "left", "right"])
            .expect("folder compare should parse");
        assert_eq!(
            folders.command,
            CliCommand::CompareFolders {
                left: "left".to_owned(),
                right: "right".to_owned(),
                quiet: false,
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

        let open = parse_cli_args([
            "open-diff-cli",
            "open",
            "--session",
            "folder-compare",
            "--left",
            "/tmp/a",
            "--right",
            "/tmp/b",
        ])
        .expect("open should parse");
        assert_eq!(
            open.command,
            CliCommand::OpenCompare {
                session_type: "folder-compare".to_owned(),
                left: "/tmp/a".to_owned(),
                right: "/tmp/b".to_owned(),
                route: "/compare/folder".to_owned(),
                options: CliOpenOptions::default(),
            }
        );

        let open_pos = parse_cli_args([
            "open-diff-cli",
            "open",
            "--session",
            "text",
            "left.txt",
            "right.txt",
        ])
        .expect("open positional should parse");
        assert_eq!(
            open_pos.command,
            CliCommand::OpenCompare {
                session_type: "text-compare".to_owned(),
                left: "left.txt".to_owned(),
                right: "right.txt".to_owned(),
                route: "/compare/text".to_owned(),
                options: CliOpenOptions::default(),
            }
        );

        let sync = parse_cli_args(["open-diff-cli", "sync-preview", "/tmp/a", "/tmp/b"])
            .expect("sync-preview should parse");
        assert_eq!(
            sync.command,
            CliCommand::SyncPreview {
                left: "/tmp/a".to_owned(),
                right: "/tmp/b".to_owned(),
                quiet: false,
            }
        );

        let sync_alias = parse_cli_args(["open-diff-cli", "sync", "/tmp/a", "/tmp/b"])
            .expect("sync alias should parse as sync-preview");
        assert_eq!(
            sync_alias.command,
            CliCommand::SyncPreview {
                left: "/tmp/a".to_owned(),
                right: "/tmp/b".to_owned(),
                quiet: false,
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
    fn parses_open_session_flags_and_help_text() {
        let help = cli_help_text();
        assert!(help.contains("open [options]"));
        assert!(help.contains("--center <path>"));
        assert!(help.contains("--left-readonly"));
        assert!(help.contains("Exit codes:"));
        assert!(help.contains("0 success"));
        assert!(help.contains("1 differences detected"));

        let open = parse_cli_args([
            "open-diff-cli",
            "open",
            "-session",
            "text-merge",
            "--left",
            "L.txt",
            "--right",
            "R.txt",
            "--center",
            "B.txt",
            "--output",
            "O.txt",
            "--readonly",
            "--silent",
            "--favor-left",
        ])
        .expect("flagged open should parse");
        assert_eq!(
            open.command,
            CliCommand::OpenCompare {
                session_type: "text-merge".to_owned(),
                left: "L.txt".to_owned(),
                right: "R.txt".to_owned(),
                route: "/merge/text".to_owned(),
                options: CliOpenOptions {
                    center: Some("B.txt".to_owned()),
                    title: None,
                    output: Some("O.txt".to_owned()),
                    left_readonly: true,
                    right_readonly: true,
                    readonly: true,
                    silent: true,
                    favor: Some(CliTextMergeFavor::Left),
                    edit: false,
                },
            }
        );

        let edit = parse_cli_args(["open-diff-cli", "open", "--edit", "notes.txt", "notes.txt"])
            .expect("edit open should parse");
        assert_eq!(
            edit.command,
            CliCommand::OpenCompare {
                session_type: "text-edit".to_owned(),
                left: "notes.txt".to_owned(),
                right: "notes.txt".to_owned(),
                route: "/edit/text".to_owned(),
                options: CliOpenOptions {
                    edit: true,
                    ..CliOpenOptions::default()
                },
            }
        );

        let quiet = parse_cli_args(["open-diff-cli", "compare", "--quiet", "a.txt", "b.txt"])
            .expect("quiet compare should parse");
        assert_eq!(
            quiet.command,
            CliCommand::CompareFiles {
                left: "a.txt".to_owned(),
                right: "b.txt".to_owned(),
                quiet: true,
            }
        );

        let slash = parse_cli_args([
            "open-diff-cli",
            "open",
            "/session",
            "hex",
            "/left",
            "a.bin",
            "/right",
            "b.bin",
        ])
        .expect("slash open should parse");
        assert_eq!(
            slash.command,
            CliCommand::OpenCompare {
                session_type: "hex-compare".to_owned(),
                left: "a.bin".to_owned(),
                right: "b.bin".to_owned(),
                route: "/compare/hex".to_owned(),
                options: CliOpenOptions::default(),
            }
        );

        assert!(help.contains("--fv <type>"));
        assert!(help.contains("--title <text>"));
    }

    #[test]
    fn parses_open_title_switch() {
        let parsed = parse_cli_args([
            "open-diff",
            "open",
            "--session",
            "text-compare",
            "--title",
            "Release Notes",
            "left.txt",
            "right.txt",
        ])
        .expect("title open should parse");
        match parsed.command {
            CliCommand::OpenCompare { options, .. } => {
                assert_eq!(options.title.as_deref(), Some("Release Notes"));
            }
            other => panic!("unexpected command: {other:?}"),
        }
    }

    #[test]
    fn parses_open_fv_alias_with_spaced_session_names() {
        let fv = parse_cli_args([
            "open-diff-cli",
            "open",
            "/fv",
            "Text Compare",
            "left.txt",
            "right.txt",
        ])
        .expect("fv open should parse");
        assert_eq!(
            fv.command,
            CliCommand::OpenCompare {
                session_type: "text-compare".to_owned(),
                left: "left.txt".to_owned(),
                right: "right.txt".to_owned(),
                route: "/compare/text".to_owned(),
                options: CliOpenOptions::default(),
            }
        );

        let inline = parse_cli_args([
            "open-diff-cli",
            "open",
            r#"/fv=Media Compare"#,
            "--left",
            "a.mp3",
            "--right",
            "b.mp3",
        ])
        .expect("inline fv open should parse");
        assert_eq!(
            inline.command,
            CliCommand::OpenCompare {
                session_type: "media-compare".to_owned(),
                left: "a.mp3".to_owned(),
                right: "b.mp3".to_owned(),
                route: "/compare/media".to_owned(),
                options: CliOpenOptions::default(),
            }
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
                write: false,
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
                write: false,
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
                write: false,
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
                "git config --global mergetool.open-diff.cmd '\"C:/Program Files/OpenDiff/open-diff-cli.exe\" merge-text --automerge \"$BASE\" \"$LOCAL\" \"$REMOTE\" \"$MERGED\"'".to_owned(),
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
                write: false,
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
                write: false,
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
        assert_eq!(cli_exit_code_value(CliExitCode::Conflict), 2);
        assert_eq!(cli_exit_code_value(CliExitCode::UsageError), 3);
        assert_eq!(cli_exit_code_value(CliExitCode::IoError), 4);

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
                    code: CliExitCode::Conflict,
                    value: 2,
                    meaning: "conflicts or partial failure",
                },
                CliExitCodeSpec {
                    code: CliExitCode::UsageError,
                    value: 3,
                    meaning: "usage error",
                },
                CliExitCodeSpec {
                    code: CliExitCode::IoError,
                    value: 4,
                    meaning: "IO, network, permission or conversion error",
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
        assert_eq!(opened.left.as_deref(), Some("left.txt"));
        assert_eq!(opened.right.as_deref(), Some("right.txt"));
        assert!(opened.note.contains("Desktop handoff"));

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

        assert_eq!(result.exit_code, CliExitCode::Conflict);
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

    #[test]
    fn merge_text_without_automerge_returns_usage_error() {
        let error = automerge_text_files(CliTextMergeArgs {
            base: "base.txt".to_owned(),
            left: "left.txt".to_owned(),
            right: "right.txt".to_owned(),
            output: Some("out.txt".to_owned()),
            automerge: false,
            favor: None,
        })
        .expect_err("merge-text without --automerge should not pretend to succeed");

        assert_eq!(error.exit_code, CliExitCode::UsageError);
        assert!(error.message.contains("--automerge"));
    }

    #[test]
    fn write_git_tool_config_to_file_writes_a_temp_gitconfig() {
        let gitconfig = temp_file_path("gitconfig");
        let config = build_git_difftool_config("/tmp/open-diff-cli", GitConfigScope::Global)
            .expect("difftool config should build");

        let message = write_git_tool_config_to_file(&config, Some(&gitconfig))
            .expect("git config should write to the temp file");
        let written = fs::read_to_string(&gitconfig).expect("temp gitconfig should exist");

        assert!(message.contains("Wrote"));
        assert!(written.contains("open-diff"));
        assert!(written.contains("difftool") || written.contains("diff.tool"));

        let mergetool = build_git_mergetool_config("/tmp/open-diff-cli", GitConfigScope::Global)
            .expect("mergetool config should build");
        write_git_tool_config_to_file(&mergetool, Some(&gitconfig))
            .expect("mergetool git config should write to the temp file");
        let merged = fs::read_to_string(&gitconfig).expect("temp gitconfig should exist");
        assert!(merged.contains("mergetool"));
        assert!(merged.contains("--automerge"));

        let _ = fs::remove_file(gitconfig);
    }

    #[test]
    fn write_svn_diff_config_writes_wrapper_and_snippet_files() {
        let root = temp_dir_path("svn-write");
        fs::create_dir_all(&root).expect("temp dir should be created");
        let wrapper = root.join("svn-diff.cmd");
        let config = build_svn_diff_config("/tmp/open-diff-cli", wrapper.to_string_lossy())
            .expect("svn config should build");

        let message = write_svn_diff_config(&config, &wrapper.to_string_lossy())
            .expect("svn wrapper should be written");
        let snippet = wrapper.with_extension("svnconfig");

        assert!(message.contains("Wrote"));
        assert!(fs::read_to_string(&wrapper)
            .expect("wrapper should exist")
            .contains("svn-diff"));
        assert!(fs::read_to_string(&snippet)
            .expect("svnconfig snippet should exist")
            .contains("diff-cmd"));

        let _ = fs::remove_dir_all(root);
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
