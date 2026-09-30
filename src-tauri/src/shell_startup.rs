use cli_core::{parse_cli_args, CliCommand, CliTextMergeFavor};
use serde::{Deserialize, Serialize};
use shell_core::{
    ShellCompareAction, ShellCompareOutcome, ShellCompareSessionType, ShellCompareStateStore,
};

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum ShellStartupDecision {
    /// No shell-compare args; start the normal UI.
    Continue,
    /// Left side recorded; exit without opening a window (Explorer dual-select / Select Left).
    ExitQuiet,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct ShellCompareLaunchPayload {
    pub left: String,
    pub right: String,
    pub route: String,
    pub session_type: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub center: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub output: Option<String>,
    #[serde(default, skip_serializing_if = "std::ops::Not::not")]
    pub left_read_only: bool,
    #[serde(default, skip_serializing_if = "std::ops::Not::not")]
    pub right_read_only: bool,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub favor: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub title: Option<String>,
}

pub fn prepare_shell_startup(args: impl IntoIterator<Item = String>) -> ShellStartupDecision {
    let invocation = match parse_cli_args(args) {
        Ok(invocation) => invocation,
        Err(_) => return ShellStartupDecision::Continue,
    };

    match invocation.command {
        CliCommand::ShellCompare { path, select_left } => {
            let store = ShellCompareStateStore::new(shell_compare_state_path());
            let outcome = if select_left {
                store.select_left_only(&path)
            } else {
                store.select_path(&path)
            };

            match outcome {
                Ok(ShellCompareOutcome::PendingLeft { left }) => {
                    let _ = left;
                    ShellStartupDecision::ExitQuiet
                }
                Ok(ShellCompareOutcome::Ready(action)) => {
                    if let Err(error) = write_shell_compare_launch(&action) {
                        eprintln!("Open Diff: failed to stage shell compare launch: {error}");
                    }
                    ShellStartupDecision::Continue
                }
                Err(error) => {
                    eprintln!("Open Diff: shell compare failed: {error:?}");
                    ShellStartupDecision::ExitQuiet
                }
            }
        }
        CliCommand::OpenCompare {
            session_type,
            left,
            right,
            route,
            options,
        } => {
            let favor = match options.favor {
                Some(CliTextMergeFavor::Left) => Some("left".to_owned()),
                Some(CliTextMergeFavor::Right) => Some("right".to_owned()),
                None => None,
            };
            let payload = ShellCompareLaunchPayload {
                left,
                right,
                route,
                session_type,
                center: options.center,
                output: options.output,
                left_read_only: options.left_readonly || options.readonly,
                right_read_only: options.right_readonly || options.readonly,
                favor,
                title: options.title,
            };
            if let Err(error) = write_open_compare_launch(&payload) {
                eprintln!("Open Diff: failed to stage open compare launch: {error}");
            }
            ShellStartupDecision::Continue
        }
        _ => ShellStartupDecision::Continue,
    }
}

pub fn take_shell_compare_launch() -> Result<Option<ShellCompareLaunchPayload>, String> {
    let path = shell_compare_launch_path();
    match std::fs::read_to_string(&path) {
        Ok(raw) => {
            let _ = std::fs::remove_file(&path);
            Ok(Some(parse_shell_compare_launch(&raw)?))
        }
        Err(error) if error.kind() == std::io::ErrorKind::NotFound => Ok(None),
        Err(error) => Err(error.to_string()),
    }
}

fn write_shell_compare_launch(action: &ShellCompareAction) -> Result<(), String> {
    let payload = ShellCompareLaunchPayload {
        left: action.left.clone(),
        right: action.right.clone(),
        route: action.route.clone(),
        session_type: session_type_name(action.session_type).to_owned(),
        center: None,
        output: None,
        left_read_only: false,
        right_read_only: false,
        favor: None,
        title: None,
    };
    write_open_compare_launch(&payload)
}

fn write_open_compare_launch(payload: &ShellCompareLaunchPayload) -> Result<(), String> {
    let path = shell_compare_launch_path();
    if let Some(parent) = path.parent() {
        std::fs::create_dir_all(parent).map_err(|error| error.to_string())?;
    }
    std::fs::write(path, encode_shell_compare_launch(payload)).map_err(|error| error.to_string())
}

fn encode_shell_compare_launch(payload: &ShellCompareLaunchPayload) -> String {
    // Line payload avoids a direct serde_json dependency in the app crate.
    // Lines 1-4 are required; optional fields follow when present.
    let mut lines = vec![
        escape_launch_line(&payload.left),
        escape_launch_line(&payload.right),
        escape_launch_line(&payload.route),
        escape_launch_line(&payload.session_type),
    ];
    if payload.center.is_some()
        || payload.output.is_some()
        || payload.left_read_only
        || payload.right_read_only
        || payload.favor.is_some()
        || payload.title.is_some()
    {
        lines.push(escape_launch_line(payload.center.as_deref().unwrap_or("")));
        lines.push(escape_launch_line(payload.output.as_deref().unwrap_or("")));
        lines.push(if payload.left_read_only { "1" } else { "0" }.to_owned());
        lines.push(if payload.right_read_only { "1" } else { "0" }.to_owned());
        lines.push(escape_launch_line(payload.favor.as_deref().unwrap_or("")));
        lines.push(escape_launch_line(payload.title.as_deref().unwrap_or("")));
    }
    format!("{}\n", lines.join("\n"))
}

fn parse_shell_compare_launch(raw: &str) -> Result<ShellCompareLaunchPayload, String> {
    let mut lines = raw.lines();
    let left = unescape_launch_line(lines.next().ok_or("missing left path")?);
    let right = unescape_launch_line(lines.next().ok_or("missing right path")?);
    let route = unescape_launch_line(lines.next().ok_or("missing route")?);
    let session_type = unescape_launch_line(lines.next().ok_or("missing session type")?);
    let center_raw = lines.next().map(unescape_launch_line);
    let output_raw = lines.next().map(unescape_launch_line);
    let left_read_only = lines
        .next()
        .map(|value| value.trim() == "1")
        .unwrap_or(false);
    let right_read_only = lines
        .next()
        .map(|value| value.trim() == "1")
        .unwrap_or(false);
    let favor_raw = lines.next().map(unescape_launch_line);
    let title_raw = lines.next().map(unescape_launch_line);

    Ok(ShellCompareLaunchPayload {
        left,
        right,
        route,
        session_type,
        center: center_raw.filter(|value| !value.is_empty()),
        output: output_raw.filter(|value| !value.is_empty()),
        left_read_only,
        right_read_only,
        favor: favor_raw.filter(|value| !value.is_empty()),
        title: title_raw.filter(|value| !value.is_empty()),
    })
}

fn escape_launch_line(value: &str) -> String {
    value.replace('\\', "\\\\").replace('\n', "\\n")
}

fn unescape_launch_line(value: &str) -> String {
    let mut out = String::with_capacity(value.len());
    let mut chars = value.chars();
    while let Some(ch) = chars.next() {
        if ch == '\\' {
            match chars.next() {
                Some('n') => out.push('\n'),
                Some('\\') => out.push('\\'),
                Some(other) => {
                    out.push('\\');
                    out.push(other);
                }
                None => out.push('\\'),
            }
        } else {
            out.push(ch);
        }
    }
    out
}

fn session_type_name(session_type: ShellCompareSessionType) -> &'static str {
    match session_type {
        ShellCompareSessionType::Text => "text-compare",
        ShellCompareSessionType::Folder => "folder-compare",
        ShellCompareSessionType::Hex => "hex-compare",
    }
}

pub fn shell_compare_state_path() -> std::path::PathBuf {
    open_diff_config_dir().join("shell-compare-pending")
}

pub fn shell_compare_launch_path() -> std::path::PathBuf {
    open_diff_config_dir().join("shell-compare-launch.txt")
}

fn open_diff_config_dir() -> std::path::PathBuf {
    if let Ok(path) = std::env::var("OPEN_DIFF_CONFIG_DIR") {
        return std::path::PathBuf::from(path);
    }

    let home = std::env::var("HOME")
        .or_else(|_| std::env::var("USERPROFILE"))
        .unwrap_or_else(|_| std::env::temp_dir().display().to_string());

    std::path::PathBuf::from(home)
        .join(".config")
        .join("open-diff")
}
