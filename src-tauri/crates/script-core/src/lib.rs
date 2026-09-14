use logging_core::{LogDomain, LogStatus, StructuredLogEvent};
use serde::{Deserialize, Serialize};
use std::fmt;

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ScriptDocument {
    pub commands: Vec<ScriptCommand>,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ScriptCommand {
    pub line: usize,
    pub kind: ScriptCommandKind,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum ScriptCommandKind {
    Load { paths: Vec<String> },
    Filter { patterns: Vec<String> },
    Compare,
    TextReport { output: String },
    FolderReport { output: String },
    FileReport { output: String },
    HexReport { output: String },
    TableReport { output: String },
    PictureReport { output: String },
    VersionReport { output: String },
    RegistryReport { output: String },
    MediaReport { output: String },
    Log { message: String },
    Beep,
    Option { key: String, value: String },
    Select { query: String },
    Copy { source: String, destination: String },
    CopyTo { destination: String },
    Move { source: String, destination: String },
    MoveTo { destination: String },
    Delete { path: String },
    Rename { from: String, to: String },
    Touch { path: String },
    Attrib { path: String, readonly: bool },
    Expand { path: Option<String> },
    Collapse { path: Option<String> },
    Snapshot { output: String },
    Sync { strategy: Option<String> },
    Criteria { tokens: Vec<String> },
    Unsupported { name: String },
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ScriptParseError {
    pub line: usize,
    pub message: String,
}

#[derive(Debug, Clone, Default, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ScriptVariables {
    pub date: String,
    pub time: String,
    pub fn_time: String,
    pub left_path: Option<String>,
    pub right_path: Option<String>,
    pub selection: Option<String>,
}

#[derive(Debug, Clone, Default, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ScriptExecutionContext {
    pub variables: ScriptVariables,
    pub mode: ScriptExecutionMode,
}

#[derive(Debug, Clone, Copy, Default, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum ScriptExecutionMode {
    #[default]
    Visible,
    Silent,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct ScriptCommandContext<'a> {
    pub line: usize,
    pub command_name: &'static str,
    pub command: &'a ScriptCommandKind,
    pub execution: &'a ScriptExecutionContext,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ScriptExecutionResult {
    pub executed: usize,
}

#[derive(Debug, Clone, Default, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ScriptRuntimeState {
    pub load_paths: Vec<String>,
    pub filters: Vec<String>,
    pub last_compare: Option<ScriptCompareSummary>,
    pub reports_written: usize,
    pub logs: Vec<String>,
    pub beeps: usize,
    pub options: Vec<ScriptOption>,
    pub selection: Option<String>,
    pub file_operations: Vec<String>,
    /// True after EXPAND with no path (expand all folder prefixes).
    pub folder_tree_expand_all: bool,
    /// Explicit folder prefixes expanded via EXPAND path (ignored when expand_all).
    pub expanded_paths: Vec<String>,
    /// Folder Session Settings comparison flags set by CRITERIA.
    pub criteria: Option<ScriptFolderCriteria>,
    /// Legacy CRITERIA tokens accepted but not applied to compare results.
    pub criteria_acknowledged: Vec<String>,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ScriptOption {
    pub key: String,
    pub value: String,
}

/// Folder-compare criteria mirrored from Session Settings (size / timestamp / contents / CRC).
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ScriptFolderCriteria {
    pub compare_size: bool,
    pub compare_modified_time: bool,
    pub compare_contents: bool,
    pub compare_crc: bool,
    #[serde(default)]
    pub compare_attributes: bool,
    /// Treat size-only metadata mismatches as unimportant (Minor).
    #[serde(default)]
    pub size_only_unimportant: bool,
    #[serde(default)]
    pub timestamp_tolerance_ms: u128,
    #[serde(default)]
    pub ignore_daylight_saving_hour_offset: bool,
    #[serde(default)]
    pub ignored_timezone_hour_offsets: Vec<i32>,
    /// When contents are compared, treat whitespace / case / EOL as unimportant.
    #[serde(default)]
    pub ignore_unimportant: bool,
    /// Resolve nested symbolic links while scanning folder trees.
    #[serde(default)]
    pub follow_symlinks: bool,
}

impl Default for ScriptFolderCriteria {
    fn default() -> Self {
        Self {
            compare_size: true,
            compare_modified_time: false,
            compare_contents: true,
            compare_crc: false,
            compare_attributes: false,
            size_only_unimportant: false,
            timestamp_tolerance_ms: 0,
            ignore_daylight_saving_hour_offset: false,
            ignored_timezone_hour_offsets: Vec::new(),
            ignore_unimportant: false,
            follow_symlinks: false,
        }
    }
}

impl ScriptFolderCriteria {
    pub fn to_folder_options(&self) -> folder_core::FolderCompareOptions {
        folder_core::FolderCompareOptions {
            compare_size: self.compare_size,
            compare_modified_time: self.compare_modified_time,
            case_sensitive_names: true,
            compare_contents: self.compare_contents,
            compare_crc: self.compare_crc,
            compare_attributes: self.compare_attributes,
            size_only_unimportant: self.size_only_unimportant,
            timestamp_tolerance_ms: self.timestamp_tolerance_ms,
            ignore_daylight_saving_hour_offset: self.ignore_daylight_saving_hour_offset,
            ignored_timezone_hour_offsets: self.ignored_timezone_hour_offsets.clone(),
            follow_symlinks: self.follow_symlinks,
        }
    }
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ScriptCompareExecutionResult {
    pub executed: usize,
    pub state: ScriptRuntimeState,
    pub mode: ScriptExecutionMode,
    pub progress: Vec<ScriptProgressEvent>,
    pub structured_logs: Vec<StructuredLogEvent>,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ScriptProgressEvent {
    pub line: usize,
    pub command: String,
    pub completed: usize,
    pub total: usize,
}

#[derive(Debug, Clone, Default, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ScriptCompareSummary {
    pub compared: usize,
    pub different: usize,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ScriptCompareRequest {
    pub load_paths: Vec<String>,
    pub filters: Vec<String>,
    pub criteria: Option<ScriptFolderCriteria>,
}

pub trait ScriptCompareEngine {
    fn compare(&mut self, request: ScriptCompareRequest) -> Result<ScriptCompareSummary, String>;
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum ScriptReportType {
    Text,
    Folder,
    File,
    Hex,
    Table,
    Picture,
    Version,
    Registry,
    Media,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ScriptReportRequest {
    pub report_type: ScriptReportType,
    pub output: String,
    pub compare_summary: ScriptCompareSummary,
}

pub trait ScriptReportEngine {
    fn write_report(&mut self, request: ScriptReportRequest) -> Result<(), String>;
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ScriptExecutionError {
    pub line: usize,
    pub command: String,
    pub reason: String,
}

pub fn parse_script(source: &str) -> Result<ScriptDocument, ScriptParseError> {
    let mut commands = Vec::new();

    for (index, raw_line) in source.lines().enumerate() {
        let line = index + 1;
        let tokens = tokenize_script_line(raw_line, line)?;
        let Some((command, args)) = tokens.split_first() else {
            continue;
        };

        commands.push(ScriptCommand {
            line,
            kind: parse_command(command, args, line)?,
        });
    }

    Ok(ScriptDocument { commands })
}

pub fn expand_script_variables(
    input: &str,
    variables: &ScriptVariables,
) -> Result<String, ScriptParseError> {
    let mut output = String::new();
    let mut rest = input;

    while let Some(start) = rest.find('%') {
        output.push_str(&rest[..start]);
        let after_start = &rest[start + 1..];
        let Some(end) = after_start.find('%') else {
            return Err(parse_error(0, "unterminated variable"));
        };

        let name = &after_start[..end];
        output.push_str(resolve_script_variable(name, variables)?);
        rest = &after_start[end + 1..];
    }

    output.push_str(rest);
    Ok(output)
}

pub fn execute_script_with_handler<F>(
    script: &ScriptDocument,
    execution: ScriptExecutionContext,
    mut handler: F,
) -> Result<ScriptExecutionResult, ScriptExecutionError>
where
    F: FnMut(ScriptCommandContext<'_>) -> Result<(), String>,
{
    let mut executed = 0;

    for command in &script.commands {
        let command_name = command.kind.command_name();
        let context = ScriptCommandContext {
            line: command.line,
            command_name,
            command: &command.kind,
            execution: &execution,
        };

        handler(context).map_err(|reason| ScriptExecutionError {
            line: command.line,
            command: command_name.to_owned(),
            reason,
        })?;
        executed += 1;
    }

    Ok(ScriptExecutionResult { executed })
}

pub fn execute_compare_script<E>(
    script: &ScriptDocument,
    execution: ScriptExecutionContext,
    engine: &mut E,
) -> Result<ScriptCompareExecutionResult, ScriptExecutionError>
where
    E: ScriptCompareEngine,
{
    let mut state = ScriptRuntimeState::default();
    let mut executed = 0;

    for command in &script.commands {
        match &command.kind {
            ScriptCommandKind::Load { paths } => {
                let expanded_paths =
                    expand_values(paths, &execution.variables).map_err(|error| {
                        execution_error(
                            command,
                            format!("{} at line {}", error.message, error.line),
                        )
                    })?;
                state.load_paths = expanded_paths;
            }
            ScriptCommandKind::Filter { patterns } => {
                let expanded_patterns =
                    expand_values(patterns, &execution.variables).map_err(|error| {
                        execution_error(
                            command,
                            format!("{} at line {}", error.message, error.line),
                        )
                    })?;
                state.filters = expanded_patterns;
            }
            ScriptCommandKind::Compare => {
                if state.load_paths.is_empty() {
                    return Err(execution_error(command, "COMPARE requires LOAD first"));
                }

                let summary = engine
                    .compare(ScriptCompareRequest {
                        load_paths: state.load_paths.clone(),
                        filters: state.filters.clone(),
                        criteria: state.criteria.clone(),
                    })
                    .map_err(|reason| execution_error(command, reason))?;
                state.last_compare = Some(summary);
            }
            ScriptCommandKind::Criteria { tokens } => {
                apply_criteria_command(command, &mut state, tokens, &execution.variables)?;
            }
            other => {
                return Err(execution_error(
                    command,
                    format!(
                        "{} is not supported by compare execution",
                        other.command_name()
                    ),
                ));
            }
        }

        executed += 1;
    }

    Ok(ScriptCompareExecutionResult {
        executed,
        state,
        mode: execution.mode,
        progress: Vec::new(),
        structured_logs: Vec::new(),
    })
}

pub fn execute_automation_script<C, R>(
    script: &ScriptDocument,
    execution: ScriptExecutionContext,
    compare_engine: &mut C,
    report_engine: &mut R,
) -> Result<ScriptCompareExecutionResult, ScriptExecutionError>
where
    C: ScriptCompareEngine,
    R: ScriptReportEngine,
{
    let mut state = ScriptRuntimeState::default();
    let mut executed = 0;
    let mut progress = Vec::new();
    let mut structured_logs = Vec::new();
    let total = script.commands.len();

    for command in &script.commands {
        match &command.kind {
            ScriptCommandKind::Load { paths } => {
                state.load_paths = expand_command_values(command, paths, &execution.variables)?;
            }
            ScriptCommandKind::Filter { patterns } => {
                state.filters = expand_command_values(command, patterns, &execution.variables)?;
            }
            ScriptCommandKind::Compare => {
                run_compare_command(command, &mut state, compare_engine)?;
            }
            ScriptCommandKind::TextReport { output } => {
                run_report_command(
                    command,
                    &mut state,
                    report_engine,
                    ScriptReportType::Text,
                    output,
                    &execution.variables,
                )?;
            }
            ScriptCommandKind::FolderReport { output } => {
                run_report_command(
                    command,
                    &mut state,
                    report_engine,
                    ScriptReportType::Folder,
                    output,
                    &execution.variables,
                )?;
            }
            ScriptCommandKind::FileReport { output } => {
                run_report_command(
                    command,
                    &mut state,
                    report_engine,
                    ScriptReportType::File,
                    output,
                    &execution.variables,
                )?;
            }
            ScriptCommandKind::HexReport { output } => {
                run_hex_report_command(
                    command,
                    &mut state,
                    report_engine,
                    output,
                    &execution.variables,
                )?;
            }
            ScriptCommandKind::TableReport { output } => {
                run_report_command(
                    command,
                    &mut state,
                    report_engine,
                    ScriptReportType::Table,
                    output,
                    &execution.variables,
                )?;
            }
            ScriptCommandKind::PictureReport { output } => {
                run_picture_report_command(
                    command,
                    &mut state,
                    report_engine,
                    output,
                    &execution.variables,
                )?;
            }
            ScriptCommandKind::VersionReport { output } => {
                run_report_command(
                    command,
                    &mut state,
                    report_engine,
                    ScriptReportType::Version,
                    output,
                    &execution.variables,
                )?;
            }
            ScriptCommandKind::RegistryReport { output } => {
                run_report_command(
                    command,
                    &mut state,
                    report_engine,
                    ScriptReportType::Registry,
                    output,
                    &execution.variables,
                )?;
            }
            ScriptCommandKind::Log { message } => {
                state.logs.push(
                    expand_script_variables(message, &execution.variables).map_err(|error| {
                        execution_error(
                            command,
                            format!("{} at line {}", error.message, error.line),
                        )
                    })?,
                );
            }
            ScriptCommandKind::Beep => {
                state.beeps += 1;
            }
            ScriptCommandKind::Option { key, value } => {
                state.options.push(ScriptOption {
                    key: expand_script_variables(key, &execution.variables).map_err(|error| {
                        execution_error(
                            command,
                            format!("{} at line {}", error.message, error.line),
                        )
                    })?,
                    value: expand_script_variables(value, &execution.variables).map_err(
                        |error| {
                            execution_error(
                                command,
                                format!("{} at line {}", error.message, error.line),
                            )
                        },
                    )?,
                });
            }
            ScriptCommandKind::Select { query } => {
                state.selection = Some(
                    expand_script_variables(query, &execution.variables).map_err(|error| {
                        execution_error(
                            command,
                            format!("{} at line {}", error.message, error.line),
                        )
                    })?,
                );
            }
            ScriptCommandKind::Copy {
                source,
                destination,
            } => {
                let source =
                    expand_script_variables(source, &execution.variables).map_err(|error| {
                        execution_error(
                            command,
                            format!("{} at line {}", error.message, error.line),
                        )
                    })?;
                let destination = expand_script_variables(destination, &execution.variables)
                    .map_err(|error| {
                        execution_error(
                            command,
                            format!("{} at line {}", error.message, error.line),
                        )
                    })?;
                copy_path_recursive(
                    std::path::Path::new(&source),
                    std::path::Path::new(&destination),
                )
                .map_err(|reason| execution_error(command, reason))?;
                state
                    .file_operations
                    .push(format!("COPY {source} {destination}"));
            }
            ScriptCommandKind::CopyTo { destination } => {
                let destination = expand_script_variables(destination, &execution.variables)
                    .map_err(|error| {
                        execution_error(
                            command,
                            format!("{} at line {}", error.message, error.line),
                        )
                    })?;
                let source = state
                    .selection
                    .clone()
                    .or_else(|| state.load_paths.first().cloned())
                    .ok_or_else(|| {
                        execution_error(command, "COPYTO requires SELECT or LOAD first")
                    })?;
                copy_path_recursive(
                    std::path::Path::new(&source),
                    std::path::Path::new(&destination),
                )
                .map_err(|reason| execution_error(command, reason))?;
                state
                    .file_operations
                    .push(format!("COPYTO {source} {destination}"));
            }
            ScriptCommandKind::Delete { path } => {
                let path =
                    expand_script_variables(path, &execution.variables).map_err(|error| {
                        execution_error(
                            command,
                            format!("{} at line {}", error.message, error.line),
                        )
                    })?;
                delete_path(&path).map_err(|reason| execution_error(command, reason))?;
                state.file_operations.push(format!("DELETE {path}"));
            }
            ScriptCommandKind::Rename { from, to } => {
                let from =
                    expand_script_variables(from, &execution.variables).map_err(|error| {
                        execution_error(
                            command,
                            format!("{} at line {}", error.message, error.line),
                        )
                    })?;
                let to = expand_script_variables(to, &execution.variables).map_err(|error| {
                    execution_error(command, format!("{} at line {}", error.message, error.line))
                })?;
                std::fs::rename(&from, &to)
                    .map_err(|error| execution_error(command, error.to_string()))?;
                state.file_operations.push(format!("RENAME {from} {to}"));
            }
            ScriptCommandKind::Touch { path } => {
                let path =
                    expand_script_variables(path, &execution.variables).map_err(|error| {
                        execution_error(
                            command,
                            format!("{} at line {}", error.message, error.line),
                        )
                    })?;
                touch_path(&path).map_err(|reason| execution_error(command, reason))?;
                state.file_operations.push(format!("TOUCH {path}"));
            }
            ScriptCommandKind::Snapshot { output } => {
                let output =
                    expand_script_variables(output, &execution.variables).map_err(|error| {
                        execution_error(
                            command,
                            format!("{} at line {}", error.message, error.line),
                        )
                    })?;
                let source = state
                    .load_paths
                    .first()
                    .cloned()
                    .ok_or_else(|| execution_error(command, "SNAPSHOT requires LOAD first"))?;
                let snapshot = snapshot_core::scan_directory_snapshot("script-snapshot", &source)
                    .map_err(|error| execution_error(command, format!("{error:?}")))?;
                snapshot_core::save_snapshot_file(&output, &snapshot)
                    .map_err(|error| execution_error(command, format!("{error:?}")))?;
                state.file_operations.push(format!("SNAPSHOT {output}"));
            }
            ScriptCommandKind::Sync { strategy } => {
                if state.load_paths.len() < 2 {
                    return Err(execution_error(command, "SYNC requires two LOAD paths"));
                }
                let strategy = strategy
                    .as_deref()
                    .or_else(|| {
                        state
                            .options
                            .iter()
                            .find(|option| option.key.eq_ignore_ascii_case("sync-strategy"))
                            .map(|option| option.value.as_str())
                    })
                    .unwrap_or("updateRight");
                run_script_sync(&state.load_paths[0], &state.load_paths[1], strategy)
                    .map_err(|reason| execution_error(command, reason))?;
                state.file_operations.push(format!("SYNC {strategy}"));
            }
            ScriptCommandKind::MediaReport { output } => {
                run_media_report_command(
                    command,
                    &mut state,
                    report_engine,
                    output,
                    &execution.variables,
                )?;
            }
            ScriptCommandKind::Move {
                source,
                destination,
            } => {
                let source =
                    expand_script_variables(source, &execution.variables).map_err(|error| {
                        execution_error(
                            command,
                            format!("{} at line {}", error.message, error.line),
                        )
                    })?;
                let destination = expand_script_variables(destination, &execution.variables)
                    .map_err(|error| {
                        execution_error(
                            command,
                            format!("{} at line {}", error.message, error.line),
                        )
                    })?;
                move_path_entry(&source, &destination)
                    .map_err(|reason| execution_error(command, reason))?;
                state
                    .file_operations
                    .push(format!("MOVE {source} {destination}"));
            }
            ScriptCommandKind::MoveTo { destination } => {
                let destination = expand_script_variables(destination, &execution.variables)
                    .map_err(|error| {
                        execution_error(
                            command,
                            format!("{} at line {}", error.message, error.line),
                        )
                    })?;
                let source = state
                    .selection
                    .clone()
                    .or_else(|| state.load_paths.first().cloned())
                    .ok_or_else(|| {
                        execution_error(command, "MOVETO requires SELECT or LOAD first")
                    })?;
                move_path_entry(&source, &destination)
                    .map_err(|reason| execution_error(command, reason))?;
                state
                    .file_operations
                    .push(format!("MOVETO {source} {destination}"));
            }
            ScriptCommandKind::Attrib { path, readonly } => {
                let path =
                    expand_script_variables(path, &execution.variables).map_err(|error| {
                        execution_error(
                            command,
                            format!("{} at line {}", error.message, error.line),
                        )
                    })?;
                folder_core::change_file_attributes(folder_core::ChangeAttributesRequest {
                    path: path.clone(),
                    readonly: Some(*readonly),
                })
                .map_err(|error| execution_error(command, format!("{error:?}")))?;
                state.file_operations.push(format!(
                    "ATTRIB {path} {}",
                    if *readonly { "+R" } else { "-R" }
                ));
            }
            ScriptCommandKind::Expand { path } => {
                apply_expand_collapse(
                    &mut state,
                    true,
                    path.as_deref(),
                    &execution.variables,
                    command,
                )?;
            }
            ScriptCommandKind::Collapse { path } => {
                apply_expand_collapse(
                    &mut state,
                    false,
                    path.as_deref(),
                    &execution.variables,
                    command,
                )?;
            }
            ScriptCommandKind::Criteria { tokens } => {
                apply_criteria_command(command, &mut state, tokens, &execution.variables)?;
            }
            ScriptCommandKind::Unsupported { name } => {
                return Err(execution_error(command, format!("{name} is unsupported")));
            }
        }

        executed += 1;
        structured_logs.push(script_command_log_event(command, executed, total));
        if execution.mode == ScriptExecutionMode::Visible {
            progress.push(ScriptProgressEvent {
                line: command.line,
                command: command.kind.command_name().to_owned(),
                completed: executed,
                total,
            });
        }
    }

    Ok(ScriptCompareExecutionResult {
        executed,
        state,
        mode: execution.mode,
        progress,
        structured_logs,
    })
}

fn resolve_script_variable<'a>(
    name: &str,
    variables: &'a ScriptVariables,
) -> Result<&'a str, ScriptParseError> {
    match name.to_ascii_lowercase().as_str() {
        "date" => Ok(&variables.date),
        "time" => Ok(&variables.time),
        "fn_time" => Ok(&variables.fn_time),
        "left_path" => Ok(variables.left_path.as_deref().unwrap_or("")),
        "right_path" => Ok(variables.right_path.as_deref().unwrap_or("")),
        "selection" => Ok(variables.selection.as_deref().unwrap_or("")),
        unknown => Err(parse_error(0, format!("unknown variable: {unknown}"))),
    }
}

fn expand_values(
    values: &[String],
    variables: &ScriptVariables,
) -> Result<Vec<String>, ScriptParseError> {
    values
        .iter()
        .map(|value| expand_script_variables(value, variables))
        .collect()
}

fn expand_command_values(
    command: &ScriptCommand,
    values: &[String],
    variables: &ScriptVariables,
) -> Result<Vec<String>, ScriptExecutionError> {
    expand_values(values, variables).map_err(|error| {
        execution_error(command, format!("{} at line {}", error.message, error.line))
    })
}

fn run_compare_command<E>(
    command: &ScriptCommand,
    state: &mut ScriptRuntimeState,
    engine: &mut E,
) -> Result<(), ScriptExecutionError>
where
    E: ScriptCompareEngine,
{
    if state.load_paths.is_empty() {
        return Err(execution_error(command, "COMPARE requires LOAD first"));
    }

    let summary = engine
        .compare(ScriptCompareRequest {
            load_paths: state.load_paths.clone(),
            filters: state.filters.clone(),
            criteria: state.criteria.clone(),
        })
        .map_err(|reason| execution_error(command, reason))?;
    state.last_compare = Some(summary);

    Ok(())
}

fn apply_criteria_command(
    command: &ScriptCommand,
    state: &mut ScriptRuntimeState,
    tokens: &[String],
    variables: &ScriptVariables,
) -> Result<(), ScriptExecutionError> {
    let expanded = expand_command_values(command, tokens, variables)?;
    let (criteria, acknowledged) = parse_folder_criteria_tokens(&expanded)
        .map_err(|reason| execution_error(command, reason))?;
    state.criteria = Some(criteria.clone());
    state.criteria_acknowledged = acknowledged.clone();
    // Persist as OPTION-like keys so script state mirrors Session Settings flags.
    for (key, value) in [
        ("compare-size", criteria.compare_size),
        ("compare-timestamp", criteria.compare_modified_time),
        ("compare-contents", criteria.compare_contents),
        ("compare-crc", criteria.compare_crc),
        ("compare-attributes", criteria.compare_attributes),
        ("size-only-unimportant", criteria.size_only_unimportant),
        ("ignore-unimportant", criteria.ignore_unimportant),
        ("ignore-dst", criteria.ignore_daylight_saving_hour_offset),
        ("follow-symlinks", criteria.follow_symlinks),
    ] {
        state
            .options
            .retain(|option| !option.key.eq_ignore_ascii_case(key));
        state.options.push(ScriptOption {
            key: key.to_owned(),
            value: if value {
                "true".to_owned()
            } else {
                "false".to_owned()
            },
        });
    }
    if criteria.timestamp_tolerance_ms > 0 {
        state
            .options
            .retain(|option| !option.key.eq_ignore_ascii_case("timestamp-tolerance-ms"));
        state.options.push(ScriptOption {
            key: "timestamp-tolerance-ms".to_owned(),
            value: criteria.timestamp_tolerance_ms.to_string(),
        });
    }
    for hours in &criteria.ignored_timezone_hour_offsets {
        let key = format!("timezone:{hours}");
        state
            .options
            .retain(|option| !option.key.eq_ignore_ascii_case(&key));
        state.options.push(ScriptOption {
            key,
            value: "true".to_owned(),
        });
    }
    for token in &acknowledged {
        state
            .options
            .retain(|option| !option.key.eq_ignore_ascii_case(token));
        state.options.push(ScriptOption {
            key: token.clone(),
            value: "acknowledged".to_owned(),
        });
    }
    Ok(())
}

/// Map CRITERIA tokens onto folder Session Settings comparison flags.
/// Supported: timestamp[:seconds], size, crc, binary, rules-based, attributes/attrib,
/// sizeonly / size-only, ignore-unimportant, IgnoreDST / ignore-dst, timezone:<hours>,
/// follow-symlinks.
/// Other legacy script tokens are acknowledged without changing compare results.
pub fn parse_folder_criteria_tokens(
    tokens: &[String],
) -> Result<(ScriptFolderCriteria, Vec<String>), String> {
    let mut criteria = ScriptFolderCriteria {
        compare_size: false,
        compare_modified_time: false,
        compare_contents: false,
        compare_crc: false,
        compare_attributes: false,
        size_only_unimportant: false,
        timestamp_tolerance_ms: 0,
        ignore_daylight_saving_hour_offset: false,
        ignored_timezone_hour_offsets: Vec::new(),
        ignore_unimportant: false,
        follow_symlinks: false,
    };
    let mut acknowledged = Vec::new();
    let mut saw_content_method = false;

    if tokens.is_empty() {
        return Ok((ScriptFolderCriteria::default(), acknowledged));
    }

    for raw in tokens {
        let token = raw.trim();
        if token.is_empty() {
            continue;
        }
        let lower = token.to_ascii_lowercase();
        if lower == "timestamp" || lower.starts_with("timestamp:") {
            criteria.compare_modified_time = true;
            if let Some(rest) = lower.strip_prefix("timestamp:") {
                if !rest.is_empty() {
                    let seconds: u128 = rest
                        .parse()
                        .map_err(|_| format!("invalid CRITERIA timestamp tolerance: {token}"))?;
                    criteria.timestamp_tolerance_ms = seconds.saturating_mul(1_000);
                }
            }
            continue;
        }
        if lower == "size" {
            if saw_content_method {
                return Err("CRITERIA accepts only one of size|CRC|binary|rules-based".to_owned());
            }
            saw_content_method = true;
            criteria.compare_size = true;
            continue;
        }
        if lower == "crc" {
            if saw_content_method {
                return Err("CRITERIA accepts only one of size|CRC|binary|rules-based".to_owned());
            }
            saw_content_method = true;
            criteria.compare_crc = true;
            criteria.compare_size = true;
            continue;
        }
        if lower == "binary" || lower == "rules-based" || lower == "rulesbased" {
            if saw_content_method {
                return Err("CRITERIA accepts only one of size|CRC|binary|rules-based".to_owned());
            }
            saw_content_method = true;
            criteria.compare_contents = true;
            criteria.compare_size = true;
            continue;
        }
        if lower == "ignore-unimportant" {
            criteria.ignore_unimportant = true;
            continue;
        }
        if lower == "ignoredst" || lower == "ignore-dst" {
            criteria.compare_modified_time = true;
            criteria.ignore_daylight_saving_hour_offset = true;
            continue;
        }
        if let Some(rest) = lower.strip_prefix("timezone:") {
            let hours: i32 = rest
                .parse()
                .map_err(|_| format!("invalid CRITERIA timezone offset: {token}"))?;
            criteria.compare_modified_time = true;
            criteria.ignored_timezone_hour_offsets.push(hours);
            continue;
        }
        if lower == "follow-symlinks" {
            criteria.follow_symlinks = true;
            continue;
        }
        if lower == "attributes" || lower == "attrib" {
            criteria.compare_attributes = true;
            continue;
        }
        if lower == "sizeonly" || lower == "size-only" {
            criteria.compare_size = true;
            criteria.size_only_unimportant = true;
            continue;
        }
        if lower.starts_with("attrib:")
            || lower == "version"
            || lower == "owner"
            || lower == "group"
            || lower == "permissions"
        {
            acknowledged.push(token.to_owned());
            continue;
        }
        return Err(format!("unsupported CRITERIA token: {token}"));
    }

    Ok((criteria, acknowledged))
}

fn run_report_command<R>(
    command: &ScriptCommand,
    state: &mut ScriptRuntimeState,
    engine: &mut R,
    report_type: ScriptReportType,
    output: &str,
    variables: &ScriptVariables,
) -> Result<(), ScriptExecutionError>
where
    R: ScriptReportEngine,
{
    let Some(compare_summary) = state.last_compare.clone() else {
        return Err(execution_error(
            command,
            "report command requires COMPARE first",
        ));
    };
    let output = expand_script_variables(output, variables).map_err(|error| {
        execution_error(command, format!("{} at line {}", error.message, error.line))
    })?;

    engine
        .write_report(ScriptReportRequest {
            report_type,
            output,
            compare_summary,
        })
        .map_err(|reason| execution_error(command, reason))?;
    state.reports_written += 1;

    Ok(())
}

fn execution_error(command: &ScriptCommand, reason: impl Into<String>) -> ScriptExecutionError {
    ScriptExecutionError {
        line: command.line,
        command: command.kind.command_name().to_owned(),
        reason: reason.into(),
    }
}

fn script_command_log_event(
    command: &ScriptCommand,
    completed: usize,
    total: usize,
) -> StructuredLogEvent {
    StructuredLogEvent::new(
        LogDomain::Script,
        command.kind.command_name(),
        script_command_log_status(&command.kind),
        format!("Executed script command {}", command.kind.command_name()),
    )
    .with_detail("line", command.line)
    .with_detail("completed", completed)
    .with_detail("total", total)
}

fn script_command_log_status(command: &ScriptCommandKind) -> LogStatus {
    match command {
        ScriptCommandKind::Log { .. }
        | ScriptCommandKind::Option { .. }
        | ScriptCommandKind::Criteria { .. }
        | ScriptCommandKind::Select { .. }
        | ScriptCommandKind::Expand { .. }
        | ScriptCommandKind::Collapse { .. } => LogStatus::Info,
        _ => LogStatus::Succeeded,
    }
}

impl ScriptCommandKind {
    pub fn command_name(&self) -> &'static str {
        match self {
            ScriptCommandKind::Load { .. } => "LOAD",
            ScriptCommandKind::Filter { .. } => "FILTER",
            ScriptCommandKind::Compare => "COMPARE",
            ScriptCommandKind::TextReport { .. } => "TEXT-REPORT",
            ScriptCommandKind::FolderReport { .. } => "FOLDER-REPORT",
            ScriptCommandKind::FileReport { .. } => "FILE-REPORT",
            ScriptCommandKind::HexReport { .. } => "HEX-REPORT",
            ScriptCommandKind::TableReport { .. } => "TABLE-REPORT",
            ScriptCommandKind::PictureReport { .. } => "PICTURE-REPORT",
            ScriptCommandKind::VersionReport { .. } => "VERSION-REPORT",
            ScriptCommandKind::RegistryReport { .. } => "REGISTRY-REPORT",
            ScriptCommandKind::MediaReport { .. } => "MEDIA-REPORT",
            ScriptCommandKind::Log { .. } => "LOG",
            ScriptCommandKind::Beep => "BEEP",
            ScriptCommandKind::Option { .. } => "OPTION",
            ScriptCommandKind::Select { .. } => "SELECT",
            ScriptCommandKind::Copy { .. } => "COPY",
            ScriptCommandKind::CopyTo { .. } => "COPYTO",
            ScriptCommandKind::Move { .. } => "MOVE",
            ScriptCommandKind::MoveTo { .. } => "MOVETO",
            ScriptCommandKind::Delete { .. } => "DELETE",
            ScriptCommandKind::Rename { .. } => "RENAME",
            ScriptCommandKind::Touch { .. } => "TOUCH",
            ScriptCommandKind::Attrib { .. } => "ATTRIB",
            ScriptCommandKind::Expand { .. } => "EXPAND",
            ScriptCommandKind::Collapse { .. } => "COLLAPSE",
            ScriptCommandKind::Snapshot { .. } => "SNAPSHOT",
            ScriptCommandKind::Sync { .. } => "SYNC",
            ScriptCommandKind::Criteria { .. } => "CRITERIA",
            ScriptCommandKind::Unsupported { .. } => "UNSUPPORTED",
        }
    }
}

impl fmt::Display for ScriptExecutionError {
    fn fmt(&self, formatter: &mut fmt::Formatter<'_>) -> fmt::Result {
        write!(
            formatter,
            "script error at line {} in {}: {}",
            self.line, self.command, self.reason
        )
    }
}

impl std::error::Error for ScriptExecutionError {}

#[derive(Debug, Default)]
pub struct FilesystemScriptEngine {
    last_request: Option<ScriptCompareRequest>,
}

impl FilesystemScriptEngine {
    pub fn new() -> Self {
        Self::default()
    }
}

impl ScriptCompareEngine for FilesystemScriptEngine {
    fn compare(&mut self, request: ScriptCompareRequest) -> Result<ScriptCompareSummary, String> {
        if request.load_paths.len() < 2 {
            return Err("COMPARE requires two LOAD paths".to_owned());
        }

        let left = &request.load_paths[0];
        let right = &request.load_paths[1];
        let summary =
            compare_script_paths(left, right, &request.filters, request.criteria.as_ref())?;
        self.last_request = Some(request);
        Ok(summary)
    }
}

impl ScriptReportEngine for FilesystemScriptEngine {
    fn write_report(&mut self, request: ScriptReportRequest) -> Result<(), String> {
        let label = match request.report_type {
            ScriptReportType::Text => "TEXT-REPORT",
            ScriptReportType::Folder => "FOLDER-REPORT",
            ScriptReportType::File => "FILE-REPORT",
            ScriptReportType::Hex => "HEX-REPORT",
            ScriptReportType::Table => "TABLE-REPORT",
            ScriptReportType::Picture => "PICTURE-REPORT",
            ScriptReportType::Version => "VERSION-REPORT",
            ScriptReportType::Registry => "REGISTRY-REPORT",
            ScriptReportType::Media => "MEDIA-REPORT",
        };
        let content = format!(
            "{label}\ncompared: {}\ndifferent: {}\n",
            request.compare_summary.compared, request.compare_summary.different
        );

        if let Some(parent) = std::path::Path::new(&request.output).parent() {
            std::fs::create_dir_all(parent).map_err(|error| error.to_string())?;
        }

        std::fs::write(&request.output, content).map_err(|error| error.to_string())
    }
}

pub fn run_script_source(
    source: &str,
    execution: ScriptExecutionContext,
) -> Result<ScriptCompareExecutionResult, ScriptExecutionError> {
    let script = parse_script(source).map_err(|error| ScriptExecutionError {
        line: error.line,
        command: "PARSE".to_owned(),
        reason: error.message,
    })?;
    let mut engine = FilesystemScriptEngine::new();
    let mut report_engine = FilesystemScriptEngine::new();
    execute_automation_script(&script, execution, &mut engine, &mut report_engine)
}

pub fn run_script_file(
    path: impl AsRef<std::path::Path>,
    execution: ScriptExecutionContext,
) -> Result<ScriptCompareExecutionResult, ScriptExecutionError> {
    let path = path.as_ref();
    let source = std::fs::read_to_string(path).map_err(|error| ScriptExecutionError {
        line: 0,
        command: "LOAD".to_owned(),
        reason: format!("failed to read script {}: {error}", path.display()),
    })?;
    run_script_source(&source, execution)
}

fn compare_script_paths(
    left: &str,
    right: &str,
    filters: &[String],
    criteria: Option<&ScriptFolderCriteria>,
) -> Result<ScriptCompareSummary, String> {
    let left_path = std::path::Path::new(left);
    let right_path = std::path::Path::new(right);

    if left_path.is_file() && right_path.is_file() {
        let left_name = left_path
            .file_name()
            .and_then(|value| value.to_str())
            .unwrap_or_default()
            .to_ascii_lowercase();
        let right_name = right_path
            .file_name()
            .and_then(|value| value.to_str())
            .unwrap_or_default()
            .to_ascii_lowercase();
        let looks_tabular = [left_name.as_str(), right_name.as_str()]
            .iter()
            .any(|name| {
                name.ends_with(".csv")
                    || name.ends_with(".tsv")
                    || name.ends_with(".xlsx")
                    || name.ends_with(".xls")
            });

        match (
            file_core::read_text_file(left),
            file_core::read_text_file(right),
        ) {
            (Ok(left_text), Ok(right_text)) if !looks_tabular => {
                let diff = diff_core::diff_text(&shared_types::TextDiffRequest {
                    left: left_text.text,
                    right: right_text.text,
                    algorithm: None,
                    ignore_whitespace: false,
                    ignore_case: false,
                    ignore_line_endings: false,
                    ignore_regexes: Vec::new(),
                });
                let different = diff.stats.added + diff.stats.deleted + diff.stats.modified;

                return Ok(ScriptCompareSummary {
                    compared: 2,
                    different,
                });
            }
            (Ok(left_text), Ok(right_text)) => {
                // Tabular files still compare as text rows for script automation.
                let left_rows = left_text.text.lines().count();
                let right_rows = right_text.text.lines().count();
                let diff = diff_core::diff_text(&shared_types::TextDiffRequest {
                    left: left_text.text,
                    right: right_text.text,
                    algorithm: None,
                    ignore_whitespace: false,
                    ignore_case: false,
                    ignore_line_endings: false,
                    ignore_regexes: Vec::new(),
                });
                let different = diff.stats.added + diff.stats.deleted + diff.stats.modified;

                return Ok(ScriptCompareSummary {
                    compared: left_rows.max(right_rows).max(1),
                    different,
                });
            }
            _ => {
                let left_bytes = std::fs::read(left).map_err(|error| error.to_string())?;
                let right_bytes = std::fs::read(right).map_err(|error| error.to_string())?;
                let shared = left_bytes.len().min(right_bytes.len());
                let mut different = left_bytes.len().abs_diff(right_bytes.len());
                different += left_bytes[..shared]
                    .iter()
                    .zip(right_bytes[..shared].iter())
                    .filter(|(left_byte, right_byte)| left_byte != right_byte)
                    .count();

                return Ok(ScriptCompareSummary {
                    compared: left_bytes.len().max(right_bytes.len()).max(1),
                    different,
                });
            }
        }
    }

    if left_path.is_dir() && right_path.is_dir() {
        let cancellation = job_core::CancellationToken::default();
        let follow = criteria.map(|value| value.follow_symlinks).unwrap_or(false);
        let scan_options = folder_core::FolderCompareOptions {
            follow_symlinks: follow,
            ..folder_core::FolderCompareOptions::default()
        };
        let left_tree =
            folder_core::scan_local_folder_with_options(left, &cancellation, &scan_options)
                .map_err(|error| format!("{error:?}"))?;
        let right_tree =
            folder_core::scan_local_folder_with_options(right, &cancellation, &scan_options)
                .map_err(|error| format!("{error:?}"))?;
        let rows =
            folder_core::align_folder_trees_with_options(&left_tree, &right_tree, &scan_options);
        let filtered = if filters.is_empty() {
            rows
        } else {
            rows.into_iter()
                .filter(|row| {
                    filters.iter().any(|pattern| {
                        let include = !pattern.starts_with('-');
                        let needle = pattern.trim_start_matches('-');
                        let matches = row.relative_path.contains(needle.trim_start_matches('*'));
                        if include {
                            matches
                        } else {
                            !matches
                        }
                    })
                })
                .collect()
        };
        let criteria = criteria.cloned().unwrap_or_default();
        let different = filtered
            .iter()
            .filter(|row| {
                !matches!(
                    classify_script_folder_row(left_path, right_path, row, &criteria),
                    folder_core::FolderCompareStatus::Same
                )
            })
            .count();

        return Ok(ScriptCompareSummary {
            compared: filtered.len(),
            different,
        });
    }

    Err(format!(
        "LOAD paths must be two files or two folders: {left} / {right}"
    ))
}

fn classify_script_folder_row(
    left_root: &std::path::Path,
    right_root: &std::path::Path,
    row: &folder_core::FolderAlignmentRow,
    criteria: &ScriptFolderCriteria,
) -> folder_core::FolderCompareStatus {
    let mut options = criteria.to_folder_options();
    // Whitespace / EOL ignores can change byte length; don't hard-fail on size first.
    if criteria.ignore_unimportant && criteria.compare_contents {
        options.compare_size = false;
    }
    let metadata_status = folder_core::classify_folder_alignment_with_options(
        row.left.as_ref(),
        row.right.as_ref(),
        &options,
    );

    if metadata_status != folder_core::FolderCompareStatus::Same {
        return metadata_status;
    }

    let is_file_pair = matches!(
        (&row.left, &row.right),
        (Some(left), Some(right))
            if left.kind == folder_core::FolderNodeKind::File
                && right.kind == folder_core::FolderNodeKind::File
    );
    if !is_file_pair || (!criteria.compare_contents && !criteria.compare_crc) {
        return metadata_status;
    }

    let left_bytes = match std::fs::read(left_root.join(&row.relative_path)) {
        Ok(bytes) => bytes,
        Err(_) => return folder_core::FolderCompareStatus::Error,
    };
    let right_bytes = match std::fs::read(right_root.join(&row.relative_path)) {
        Ok(bytes) => bytes,
        Err(_) => return folder_core::FolderCompareStatus::Error,
    };

    if criteria.compare_crc {
        let status = folder_core::classify_folder_alignment_with_crc32(
            row.left.as_ref(),
            row.right.as_ref(),
            &options,
            Some(folder_core::calculate_crc32(&left_bytes)),
            Some(folder_core::calculate_crc32(&right_bytes)),
        );
        if status != folder_core::FolderCompareStatus::Same || !criteria.compare_contents {
            return status;
        }
    }

    if criteria.compare_contents {
        if criteria.ignore_unimportant {
            let left_text = String::from_utf8_lossy(&left_bytes);
            let right_text = String::from_utf8_lossy(&right_bytes);
            return folder_core::compare_text_content_with_rules(
                &left_text,
                &right_text,
                &folder_core::FolderTextRuleCompareOptions {
                    ignore_whitespace: true,
                    ignore_case: true,
                    ignore_line_endings: true,
                    ignore_regexes: Vec::new(),
                    algorithm: None,
                },
            )
            .status;
        }
        return folder_core::compare_binary_streams(&left_bytes[..], &right_bytes[..], 8192)
            .map(|result| result.status)
            .unwrap_or(folder_core::FolderCompareStatus::Error);
    }

    metadata_status
}

fn parse_command(
    command: &str,
    args: &[String],
    line: usize,
) -> Result<ScriptCommandKind, ScriptParseError> {
    match command.to_ascii_uppercase().as_str() {
        "LOAD" => {
            if args.is_empty() {
                return Err(parse_error(line, "LOAD requires at least one path"));
            }

            Ok(ScriptCommandKind::Load {
                paths: args.to_vec(),
            })
        }
        "FILTER" => {
            if args.is_empty() {
                return Err(parse_error(line, "FILTER requires at least one pattern"));
            }

            Ok(ScriptCommandKind::Filter {
                patterns: args.to_vec(),
            })
        }
        "COMPARE" => {
            if !args.is_empty() {
                return Err(parse_error(line, "COMPARE does not accept arguments"));
            }

            Ok(ScriptCommandKind::Compare)
        }
        "TEXT-REPORT" => parse_single_output_command(line, args, |output| {
            ScriptCommandKind::TextReport { output }
        }),
        "FOLDER-REPORT" => parse_single_output_command(line, args, |output| {
            ScriptCommandKind::FolderReport { output }
        }),
        "FILE-REPORT" | "REPORT" => parse_single_output_command(line, args, |output| {
            ScriptCommandKind::FileReport { output }
        }),
        "HEX-REPORT" => parse_single_output_command(line, args, |output| {
            ScriptCommandKind::HexReport { output }
        }),
        "TABLE-REPORT" => parse_single_output_command(line, args, |output| {
            ScriptCommandKind::TableReport { output }
        }),
        "PICTURE-REPORT" => parse_single_output_command(line, args, |output| {
            ScriptCommandKind::PictureReport { output }
        }),
        "VERSION-REPORT" => parse_single_output_command(line, args, |output| {
            ScriptCommandKind::VersionReport { output }
        }),
        "REGISTRY-REPORT" => parse_single_output_command(line, args, |output| {
            ScriptCommandKind::RegistryReport { output }
        }),
        "LOG" => {
            parse_single_output_command(line, args, |message| ScriptCommandKind::Log { message })
        }
        "BEEP" => {
            if !args.is_empty() {
                return Err(parse_error(line, "BEEP does not accept arguments"));
            }

            Ok(ScriptCommandKind::Beep)
        }
        "OPTION" => {
            if args.len() != 2 {
                return Err(parse_error(line, "OPTION requires KEY and VALUE"));
            }

            Ok(ScriptCommandKind::Option {
                key: args[0].clone(),
                value: args[1].clone(),
            })
        }
        "SELECT" => {
            parse_single_output_command(line, args, |query| ScriptCommandKind::Select { query })
        }
        "COPY" => {
            if args.len() != 2 {
                return Err(parse_error(line, "COPY requires source and destination"));
            }

            Ok(ScriptCommandKind::Copy {
                source: args[0].clone(),
                destination: args[1].clone(),
            })
        }
        "COPYTO" => parse_single_output_command(line, args, |destination| {
            ScriptCommandKind::CopyTo { destination }
        }),
        "DELETE" => {
            parse_single_output_command(line, args, |path| ScriptCommandKind::Delete { path })
        }
        "RENAME" => {
            if args.len() != 2 {
                return Err(parse_error(line, "RENAME requires source and destination"));
            }

            Ok(ScriptCommandKind::Rename {
                from: args[0].clone(),
                to: args[1].clone(),
            })
        }
        "TOUCH" => {
            parse_single_output_command(line, args, |path| ScriptCommandKind::Touch { path })
        }
        "SNAPSHOT" => {
            parse_single_output_command(line, args, |output| ScriptCommandKind::Snapshot { output })
        }
        "MEDIA-REPORT" => parse_single_output_command(line, args, |output| {
            ScriptCommandKind::MediaReport { output }
        }),
        "MOVE" => {
            if args.len() != 2 {
                return Err(parse_error(line, "MOVE requires source and destination"));
            }

            Ok(ScriptCommandKind::Move {
                source: args[0].clone(),
                destination: args[1].clone(),
            })
        }
        "MOVETO" => parse_single_output_command(line, args, |destination| {
            ScriptCommandKind::MoveTo { destination }
        }),
        "ATTRIB" => parse_attrib_command(line, args),
        "EXPAND" => parse_expand_collapse_command(line, args, true),
        "COLLAPSE" => parse_expand_collapse_command(line, args, false),
        "SYNC" => {
            if args.len() > 1 {
                return Err(parse_error(line, "SYNC accepts at most one strategy"));
            }

            Ok(ScriptCommandKind::Sync {
                strategy: args.first().cloned(),
            })
        }
        "CRITERIA" => Ok(ScriptCommandKind::Criteria {
            tokens: args.to_vec(),
        }),
        unsupported if is_unsupported_script_command(unsupported) => {
            Ok(ScriptCommandKind::Unsupported {
                name: unsupported.to_owned(),
            })
        }
        unknown => Err(parse_error(line, format!("unsupported command: {unknown}"))),
    }
}

fn is_unsupported_script_command(command: &str) -> bool {
    unsupported_script_commands()
        .iter()
        .any(|name| name.eq_ignore_ascii_case(command))
}

/// Commands that parse and execute for real in the automation runner.
pub fn supported_script_commands() -> &'static [&'static str] {
    &[
        "LOAD",
        "FILTER",
        "COMPARE",
        "TEXT-REPORT",
        "FOLDER-REPORT",
        "FILE-REPORT",
        "REPORT",
        "HEX-REPORT",
        "TABLE-REPORT",
        "PICTURE-REPORT",
        "VERSION-REPORT",
        "REGISTRY-REPORT",
        "MEDIA-REPORT",
        "LOG",
        "BEEP",
        "OPTION",
        "SELECT",
        "COPY",
        "COPYTO",
        "MOVE",
        "MOVETO",
        "DELETE",
        "RENAME",
        "TOUCH",
        "ATTRIB",
        "EXPAND",
        "COLLAPSE",
        "SNAPSHOT",
        "SYNC",
        "CRITERIA",
    ]
}

/// Known legacy commands that parse but fail at execution with an honest unsupported error.
pub fn unsupported_script_commands() -> &'static [&'static str] {
    &[]
}

fn copy_path_recursive(source: &std::path::Path, target: &std::path::Path) -> Result<(), String> {
    if source.is_dir() {
        std::fs::create_dir_all(target).map_err(|error| error.to_string())?;
        for entry in std::fs::read_dir(source).map_err(|error| error.to_string())? {
            let entry = entry.map_err(|error| error.to_string())?;
            copy_path_recursive(&entry.path(), &target.join(entry.file_name()))?;
        }
        return Ok(());
    }

    if let Some(parent) = target.parent() {
        std::fs::create_dir_all(parent).map_err(|error| error.to_string())?;
    }

    std::fs::copy(source, target)
        .map(|_| ())
        .map_err(|error| error.to_string())
}

fn delete_path(path: &str) -> Result<(), String> {
    let path = std::path::Path::new(path);
    if path.is_dir() {
        std::fs::remove_dir_all(path).map_err(|error| error.to_string())
    } else {
        std::fs::remove_file(path).map_err(|error| error.to_string())
    }
}

fn run_hex_report_command<R>(
    command: &ScriptCommand,
    state: &mut ScriptRuntimeState,
    report_engine: &mut R,
    output: &str,
    variables: &ScriptVariables,
) -> Result<(), ScriptExecutionError>
where
    R: ScriptReportEngine,
{
    let output = expand_script_variables(output, variables).map_err(|error| {
        execution_error(command, format!("{} at line {}", error.message, error.line))
    })?;

    if state.load_paths.len() >= 2 {
        let left = &state.load_paths[0];
        let right = &state.load_paths[1];
        let left_path = std::path::Path::new(left);
        let right_path = std::path::Path::new(right);
        if left_path.is_file() && right_path.is_file() {
            if let Ok((summary, report_text)) = compare_hex_script_paths(left, right) {
                state.last_compare = Some(summary.clone());
                write_script_report_file(&output, &report_text)
                    .map_err(|reason| execution_error(command, reason))?;
                state.reports_written += 1;
                return Ok(());
            }
        }
    }

    let Some(compare_summary) = state.last_compare.clone() else {
        return Err(execution_error(
            command,
            "HEX-REPORT requires binary LOAD paths or COMPARE first",
        ));
    };

    report_engine
        .write_report(ScriptReportRequest {
            report_type: ScriptReportType::Hex,
            output,
            compare_summary,
        })
        .map_err(|reason| execution_error(command, reason))?;
    state.reports_written += 1;
    Ok(())
}

fn compare_hex_script_paths(
    left: &str,
    right: &str,
) -> Result<(ScriptCompareSummary, String), String> {
    let left_bytes = std::fs::read(left).map_err(|error| error.to_string())?;
    let right_bytes = std::fs::read(right).map_err(|error| error.to_string())?;
    let report = hex_core::build_hex_report(&left_bytes, &right_bytes);
    let row_lines = report
        .rows
        .iter()
        .map(|row| {
            format!(
                "{:08X}\t{}\t{}",
                row.offset,
                row.original_hex.as_deref().unwrap_or("--"),
                row.modified_hex.as_deref().unwrap_or("--"),
            )
        })
        .collect::<Vec<_>>();
    let report_text = format!(
        "HEX-REPORT\nleft: {left}\nright: {right}\noriginalLen: {}\nmodifiedLen: {}\nchangedRows: {}\n\nrows:\n{}\n",
        report.summary.original_len,
        report.summary.modified_len,
        report.summary.changed_rows,
        row_lines.join("\n"),
    );
    let summary = ScriptCompareSummary {
        compared: report
            .summary
            .original_len
            .max(report.summary.modified_len)
            .max(1) as usize,
        different: report.summary.changed_rows as usize,
    };

    Ok((summary, report_text))
}

fn run_picture_report_command<R>(
    command: &ScriptCommand,
    state: &mut ScriptRuntimeState,
    report_engine: &mut R,
    output: &str,
    variables: &ScriptVariables,
) -> Result<(), ScriptExecutionError>
where
    R: ScriptReportEngine,
{
    let output = expand_script_variables(output, variables).map_err(|error| {
        execution_error(command, format!("{} at line {}", error.message, error.line))
    })?;

    if state.load_paths.len() >= 2 {
        let left = &state.load_paths[0];
        let right = &state.load_paths[1];
        let left_path = std::path::Path::new(left);
        let right_path = std::path::Path::new(right);
        if left_path.is_file() && right_path.is_file() {
            if let Ok((summary, report_text)) = compare_picture_script_paths(left, right) {
                state.last_compare = Some(summary.clone());
                write_script_report_file(&output, &report_text)
                    .map_err(|reason| execution_error(command, reason))?;
                state.reports_written += 1;
                return Ok(());
            }
        }
    }

    let Some(compare_summary) = state.last_compare.clone() else {
        return Err(execution_error(
            command,
            "PICTURE-REPORT requires picture LOAD paths or COMPARE first",
        ));
    };

    report_engine
        .write_report(ScriptReportRequest {
            report_type: ScriptReportType::Picture,
            output,
            compare_summary,
        })
        .map_err(|reason| execution_error(command, reason))?;
    state.reports_written += 1;
    Ok(())
}

fn write_script_report_file(output: &str, content: &str) -> Result<(), String> {
    if let Some(parent) = std::path::Path::new(output).parent() {
        if !parent.as_os_str().is_empty() {
            std::fs::create_dir_all(parent).map_err(|error| error.to_string())?;
        }
    }
    std::fs::write(output, content).map_err(|error| error.to_string())
}

fn compare_picture_script_paths(
    left: &str,
    right: &str,
) -> Result<(ScriptCompareSummary, String), String> {
    let left_bytes = std::fs::read(left).map_err(|error| error.to_string())?;
    let right_bytes = std::fs::read(right).map_err(|error| error.to_string())?;
    let left_image = image_core::decode_image(&left_bytes).map_err(|error| format!("{error:?}"))?;
    let right_image =
        image_core::decode_image(&right_bytes).map_err(|error| format!("{error:?}"))?;

    let total_pixels = u64::from(left_image.metadata.width) * u64::from(left_image.metadata.height);
    let diff = if left_image.metadata.width == right_image.metadata.width
        && left_image.metadata.height == right_image.metadata.height
    {
        image_core::scan_pixel_differences(
            &left_image.pixels,
            &right_image.pixels,
            left_image.metadata.width,
            left_image.metadata.height,
        )
        .map_err(|error| format!("{error:?}"))?
    } else {
        image_core::PixelDiff {
            different_pixels: total_pixels,
            bounding_rect: Some(image_core::ImageRect {
                x: 0,
                y: 0,
                width: left_image.metadata.width,
                height: left_image.metadata.height,
            }),
        }
    };

    let report = image_core::build_image_report(
        left_image.metadata.clone(),
        right_image.metadata.clone(),
        diff.clone(),
        None,
    );
    let metadata_rows = report
        .metadata_differences
        .iter()
        .map(|row| format!("{}\t{}\t{}\tmodified", row.field, row.left, row.right))
        .collect::<Vec<_>>();
    let bounding = match report.statistics.bounding_rect {
        Some(rect) => format!("{}, {}, {} x {}", rect.x, rect.y, rect.width, rect.height),
        None => "--".to_owned(),
    };
    let report_text = format!(
        "PICTURE-REPORT\nleft: {left}\nright: {right}\ntotalPixels: {}\ndifferentPixels: {}\ndifferenceRatio: {}\nboundingRect: {bounding}\n\nmetadata:\n{}\ncompared: {}\ndifferent: {}\n",
        report.statistics.total_pixels,
        report.statistics.different_pixels,
        report.statistics.difference_ratio,
        metadata_rows.join("\n"),
        total_pixels.max(1) as usize,
        report.statistics.different_pixels as usize,
    );

    let summary = ScriptCompareSummary {
        compared: total_pixels.max(1) as usize,
        different: report.statistics.different_pixels as usize,
    };

    Ok((summary, report_text))
}

fn run_media_report_command<R>(
    command: &ScriptCommand,
    state: &mut ScriptRuntimeState,
    report_engine: &mut R,
    output: &str,
    variables: &ScriptVariables,
) -> Result<(), ScriptExecutionError>
where
    R: ScriptReportEngine,
{
    let output = expand_script_variables(output, variables).map_err(|error| {
        execution_error(command, format!("{} at line {}", error.message, error.line))
    })?;

    if state.load_paths.len() >= 2 {
        let left = &state.load_paths[0];
        let right = &state.load_paths[1];
        let left_path = std::path::Path::new(left);
        let right_path = std::path::Path::new(right);
        if left_path.is_file() && right_path.is_file() {
            if let Ok(summary) = compare_media_script_paths(left, right) {
                state.last_compare = Some(summary.clone());
                report_engine
                    .write_report(ScriptReportRequest {
                        report_type: ScriptReportType::Media,
                        output,
                        compare_summary: summary,
                    })
                    .map_err(|reason| execution_error(command, reason))?;
                state.reports_written += 1;
                return Ok(());
            }
        }
    }

    let Some(compare_summary) = state.last_compare.clone() else {
        return Err(execution_error(
            command,
            "MEDIA-REPORT requires media LOAD paths or COMPARE first",
        ));
    };

    report_engine
        .write_report(ScriptReportRequest {
            report_type: ScriptReportType::Media,
            output,
            compare_summary,
        })
        .map_err(|reason| execution_error(command, reason))?;
    state.reports_written += 1;
    Ok(())
}

fn compare_media_script_paths(left: &str, right: &str) -> Result<ScriptCompareSummary, String> {
    let left_bytes = std::fs::read(left).map_err(|error| error.to_string())?;
    let right_bytes = std::fs::read(right).map_err(|error| error.to_string())?;
    let left_name = std::path::Path::new(left)
        .file_name()
        .and_then(|name| name.to_str())
        .unwrap_or(left);
    let right_name = std::path::Path::new(right)
        .file_name()
        .and_then(|name| name.to_str())
        .unwrap_or(right);
    let left_doc = media_core::read_media_document(left_name, &left_bytes)
        .map_err(|error| format!("{error:?}"))?;
    let right_doc = media_core::read_media_document(right_name, &right_bytes)
        .map_err(|error| format!("{error:?}"))?;
    let diff = media_core::compare_media_documents(&left_doc, &right_doc);
    let different =
        (diff.statistics.added + diff.statistics.removed + diff.statistics.modified) as usize;
    let compared = diff.fields.len();

    Ok(ScriptCompareSummary {
        compared,
        different,
    })
}

fn move_path_entry(source: &str, destination: &str) -> Result<(), String> {
    folder_core::perform_file_operation(folder_core::FileOperationRequest::Move {
        source_path: source.to_owned(),
        target_path: destination.to_owned(),
    })
    .map(|_| ())
    .map_err(|error| format!("{error:?}"))
}

fn apply_expand_collapse(
    state: &mut ScriptRuntimeState,
    expand: bool,
    path: Option<&str>,
    variables: &ScriptVariables,
    command: &ScriptCommand,
) -> Result<(), ScriptExecutionError> {
    let label = if expand { "EXPAND" } else { "COLLAPSE" };
    match path {
        None => {
            state.folder_tree_expand_all = expand;
            state.expanded_paths.clear();
            state.file_operations.push(label.to_owned());
        }
        Some(raw) => {
            let path = expand_script_variables(raw, variables).map_err(|error| {
                execution_error(command, format!("{} at line {}", error.message, error.line))
            })?;
            state.folder_tree_expand_all = false;
            if expand {
                if !state.expanded_paths.iter().any(|entry| entry == &path) {
                    state.expanded_paths.push(path.clone());
                }
            } else {
                state.expanded_paths.retain(|entry| entry != &path);
            }
            state.file_operations.push(format!("{label} {path}"));
        }
    }
    Ok(())
}

fn parse_attrib_command(
    line: usize,
    args: &[String],
) -> Result<ScriptCommandKind, ScriptParseError> {
    if args.len() != 2 {
        return Err(parse_error(
            line,
            "ATTRIB requires PATH and +R/-R (or readonly/writable)",
        ));
    }

    let (path, flag) = if looks_like_attrib_flag(&args[0]) {
        (args[1].clone(), args[0].as_str())
    } else if looks_like_attrib_flag(&args[1]) {
        (args[0].clone(), args[1].as_str())
    } else {
        return Err(parse_error(
            line,
            "ATTRIB flag must be +R, -R, readonly, or writable",
        ));
    };

    let readonly = parse_attrib_readonly_flag(flag)
        .ok_or_else(|| parse_error(line, "ATTRIB flag must be +R, -R, readonly, or writable"))?;

    Ok(ScriptCommandKind::Attrib { path, readonly })
}

fn looks_like_attrib_flag(value: &str) -> bool {
    parse_attrib_readonly_flag(value).is_some()
}

fn parse_attrib_readonly_flag(value: &str) -> Option<bool> {
    match value.trim().to_ascii_uppercase().as_str() {
        "+R" | "R" | "+READONLY" | "READONLY" | "TRUE" | "1" => Some(true),
        "-R" | "-READONLY" | "WRITABLE" | "FALSE" | "0" => Some(false),
        _ => None,
    }
}

fn parse_expand_collapse_command(
    line: usize,
    args: &[String],
    expand: bool,
) -> Result<ScriptCommandKind, ScriptParseError> {
    if args.len() > 1 {
        return Err(parse_error(
            line,
            if expand {
                "EXPAND accepts at most one path"
            } else {
                "COLLAPSE accepts at most one path"
            },
        ));
    }

    let path = args.first().cloned();
    if expand {
        Ok(ScriptCommandKind::Expand { path })
    } else {
        Ok(ScriptCommandKind::Collapse { path })
    }
}

fn touch_path(path: &str) -> Result<(), String> {
    let path = std::path::Path::new(path);
    if !path.exists() {
        if let Some(parent) = path.parent() {
            std::fs::create_dir_all(parent).map_err(|error| error.to_string())?;
        }
        std::fs::write(path, []).map_err(|error| error.to_string())?;
    }

    let now = std::time::SystemTime::now();
    let file = std::fs::OpenOptions::new()
        .write(true)
        .open(path)
        .map_err(|error| error.to_string())?;
    file.set_modified(now).map_err(|error| error.to_string())
}

fn run_script_sync(left: &str, right: &str, strategy: &str) -> Result<(), String> {
    let cancellation = job_core::CancellationToken::default();
    let left_tree = folder_core::scan_local_folder(left, &cancellation)
        .map_err(|error| format!("{error:?}"))?;
    let right_tree = folder_core::scan_local_folder(right, &cancellation)
        .map_err(|error| format!("{error:?}"))?;
    let rows = folder_core::align_folder_trees(&left_tree, &right_tree);
    let plan = match strategy {
        "updateLeft" => sync_core::build_update_left_plan(left, right, &rows),
        "updateBoth" => sync_core::build_update_both_plan(left, right, &rows),
        "mirrorRight" => sync_core::build_mirror_to_right_plan(left, right, &rows),
        "mirrorLeft" => sync_core::build_mirror_to_left_plan(left, right, &rows),
        _ => sync_core::build_update_right_plan(left, right, &rows),
    };

    for item in plan.items {
        match item.action {
            sync_core::SyncAction::Copy {
                source_path,
                target_path,
                ..
            } => copy_path_recursive(
                std::path::Path::new(&source_path),
                std::path::Path::new(&target_path),
            )?,
            sync_core::SyncAction::Delete { target_path } => delete_path(&target_path)?,
            sync_core::SyncAction::Leave | sync_core::SyncAction::Conflict { .. } => {}
        }
    }

    Ok(())
}

fn parse_single_output_command(
    line: usize,
    args: &[String],
    build: fn(String) -> ScriptCommandKind,
) -> Result<ScriptCommandKind, ScriptParseError> {
    if args.len() != 1 {
        return Err(parse_error(line, "report command requires one output path"));
    }

    Ok(build(args[0].clone()))
}

fn tokenize_script_line(raw_line: &str, line: usize) -> Result<Vec<String>, ScriptParseError> {
    let mut tokens = Vec::new();
    let mut current = String::new();
    let mut chars = raw_line.trim().chars().peekable();
    let mut in_quote = false;

    while let Some(ch) = chars.next() {
        match ch {
            '"' => {
                in_quote = !in_quote;
            }
            '\\' if in_quote && chars.peek() == Some(&'"') => {
                current.push('"');
                chars.next();
            }
            '#' | ';' if !in_quote && current.is_empty() => {
                break;
            }
            value if value.is_whitespace() && !in_quote => {
                if !current.is_empty() {
                    tokens.push(std::mem::take(&mut current));
                }
            }
            value => current.push(value),
        }
    }

    if in_quote {
        return Err(parse_error(line, "unterminated quoted string"));
    }

    if !current.is_empty() {
        tokens.push(current);
    }

    Ok(tokens)
}

fn parse_error(line: usize, message: impl Into<String>) -> ScriptParseError {
    ScriptParseError {
        line,
        message: message.into(),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn parses_foundational_script_commands_with_line_numbers() {
        let script = parse_script(
            r#"
            # nightly comparison
            LOAD "left folder" "right folder"
            FILTER "*.rs" "-target"
            COMPARE
            TEXT-REPORT "reports/text.txt"
            FOLDER-REPORT "reports/folder.html"
            "#,
        )
        .expect("script should parse");

        assert_eq!(
            script.commands,
            vec![
                ScriptCommand {
                    line: 3,
                    kind: ScriptCommandKind::Load {
                        paths: vec!["left folder".to_owned(), "right folder".to_owned()],
                    },
                },
                ScriptCommand {
                    line: 4,
                    kind: ScriptCommandKind::Filter {
                        patterns: vec!["*.rs".to_owned(), "-target".to_owned()],
                    },
                },
                ScriptCommand {
                    line: 5,
                    kind: ScriptCommandKind::Compare,
                },
                ScriptCommand {
                    line: 6,
                    kind: ScriptCommandKind::TextReport {
                        output: "reports/text.txt".to_owned(),
                    },
                },
                ScriptCommand {
                    line: 7,
                    kind: ScriptCommandKind::FolderReport {
                        output: "reports/folder.html".to_owned(),
                    },
                },
            ]
        );
    }

    #[test]
    fn lists_supported_and_unsupported_script_commands_honestly() {
        assert!(supported_script_commands().contains(&"HEX-REPORT"));
        assert!(supported_script_commands().contains(&"TABLE-REPORT"));
        assert!(supported_script_commands().contains(&"REPORT"));
        assert!(supported_script_commands().contains(&"MEDIA-REPORT"));
        assert!(supported_script_commands().contains(&"PICTURE-REPORT"));
        assert!(supported_script_commands().contains(&"ATTRIB"));
        assert!(supported_script_commands().contains(&"EXPAND"));
        assert!(supported_script_commands().contains(&"COLLAPSE"));
        assert!(supported_script_commands().contains(&"MOVE"));
        assert!(supported_script_commands().contains(&"MOVETO"));
        assert!(supported_script_commands().contains(&"CRITERIA"));
        assert!(!unsupported_script_commands().contains(&"CRITERIA"));
        assert!(!unsupported_script_commands().contains(&"MEDIA-REPORT"));
        assert!(!unsupported_script_commands().contains(&"PICTURE-REPORT"));
        assert!(!unsupported_script_commands().contains(&"ATTRIB"));
        assert!(!unsupported_script_commands().contains(&"HEX-REPORT"));
        assert!(!unsupported_script_commands().contains(&"FILE-REPORT"));
    }

    #[test]
    fn parses_extended_compare_report_commands() {
        let script = parse_script(
            r#"
            LOAD "a.bin" "b.bin"
            COMPARE
            HEX-REPORT "out/hex.txt"
            TABLE-REPORT "out/table.txt"
            FILE-REPORT "out/file.txt"
            REPORT "out/report.txt"
            PICTURE-REPORT "out/picture.txt"
            VERSION-REPORT "out/version.txt"
            REGISTRY-REPORT "out/registry.txt"
            "#,
        )
        .expect("extended reports should parse");

        assert!(script
            .commands
            .iter()
            .any(|command| matches!(command.kind, ScriptCommandKind::HexReport { .. })));
        assert!(script
            .commands
            .iter()
            .any(|command| matches!(command.kind, ScriptCommandKind::TableReport { .. })));
        assert!(script
            .commands
            .iter()
            .any(|command| matches!(command.kind, ScriptCommandKind::FileReport { .. })));
        assert_eq!(
            script
                .commands
                .iter()
                .filter(|command| matches!(command.kind, ScriptCommandKind::FileReport { .. }))
                .count(),
            2
        );
    }

    #[test]
    fn rejects_unknown_script_commands_with_line_number() {
        let error = parse_script("LOAD left right\nNOPE").expect_err("unknown command should fail");

        assert_eq!(error.line, 2);
        assert!(error.message.contains("unsupported command"));
    }

    #[test]
    fn parses_and_applies_criteria_tokens_to_runtime_state() {
        #[derive(Default)]
        struct RecordingCompareEngine {
            requests: Vec<ScriptCompareRequest>,
        }

        impl ScriptCompareEngine for RecordingCompareEngine {
            fn compare(
                &mut self,
                request: ScriptCompareRequest,
            ) -> Result<ScriptCompareSummary, String> {
                self.requests.push(request);
                Ok(ScriptCompareSummary {
                    compared: 1,
                    different: 0,
                })
            }
        }

        struct NoopReportEngine;

        impl ScriptReportEngine for NoopReportEngine {
            fn write_report(&mut self, _request: ScriptReportRequest) -> Result<(), String> {
                Ok(())
            }
        }

        let script = parse_script("LOAD left right\nCRITERIA timestamp size\nCOMPARE\n")
            .expect("criteria script parses");
        let mut engine = RecordingCompareEngine::default();
        let result = execute_automation_script(
            &script,
            ScriptExecutionContext::default(),
            &mut engine,
            &mut NoopReportEngine,
        )
        .expect("criteria script runs");

        assert_eq!(
            result.state.criteria,
            Some(ScriptFolderCriteria {
                compare_size: true,
                compare_modified_time: true,
                compare_contents: false,
                compare_crc: false,
                compare_attributes: false,
                ..Default::default()
            })
        );
        assert!(result
            .state
            .options
            .iter()
            .any(|option| option.key == "compare-timestamp" && option.value == "true"));
        assert_eq!(
            engine.requests[0].criteria,
            Some(ScriptFolderCriteria {
                compare_size: true,
                compare_modified_time: true,
                compare_contents: false,
                compare_crc: false,
                compare_attributes: false,
                ..Default::default()
            })
        );
    }

    #[test]
    fn criteria_rejects_unknown_tokens_and_duplicate_content_methods() {
        let error = parse_folder_criteria_tokens(&[
            "timestamp".to_owned(),
            "size".to_owned(),
            "crc".to_owned(),
        ])
        .expect_err("duplicate content methods");
        assert!(error.contains("only one"));

        let error = parse_folder_criteria_tokens(&["nope".to_owned()]).expect_err("unknown");
        assert!(error.contains("unsupported CRITERIA token"));

        let (criteria, acknowledged) = parse_folder_criteria_tokens(&[
            "rules-based".to_owned(),
            "ignore-unimportant".to_owned(),
            "follow-symlinks".to_owned(),
            "attributes".to_owned(),
            "sizeonly".to_owned(),
        ])
        .expect("applied + ack tokens");
        assert!(criteria.compare_contents);
        assert!(criteria.ignore_unimportant);
        assert!(criteria.follow_symlinks);
        assert!(criteria.compare_attributes);
        assert!(criteria.size_only_unimportant);
        assert!(criteria.compare_size);
        assert!(acknowledged.is_empty());

        let (timed, _) = parse_folder_criteria_tokens(&[
            "timestamp:2".to_owned(),
            "IgnoreDST".to_owned(),
            "timezone:8".to_owned(),
            "size".to_owned(),
        ])
        .expect("time tokens");
        assert!(timed.compare_modified_time);
        assert_eq!(timed.timestamp_tolerance_ms, 2_000);
        assert!(timed.ignore_daylight_saving_hour_offset);
        assert_eq!(timed.ignored_timezone_hour_offsets, vec![8]);
        assert!(timed.compare_size);
    }

    #[test]
    fn criteria_size_skips_same_sized_files_with_different_contents() {
        let root = unique_temp_dir("script-criteria-size");
        let left = root.join("left");
        let right = root.join("right");
        std::fs::create_dir_all(&left).expect("left");
        std::fs::create_dir_all(&right).expect("right");
        std::fs::write(left.join("a.txt"), "aaaa").expect("left file");
        std::fs::write(right.join("a.txt"), "bbbb").expect("right file");

        let same_size = run_script_source(
            &format!(
                "LOAD \"{}\" \"{}\"\nCRITERIA size\nCOMPARE\n",
                left.display(),
                right.display()
            ),
            ScriptExecutionContext::default(),
        )
        .expect("size criteria");
        assert_eq!(same_size.state.last_compare.map(|s| s.different), Some(0));

        let content = run_script_source(
            &format!(
                "LOAD \"{}\" \"{}\"\nCRITERIA binary\nCOMPARE\n",
                left.display(),
                right.display()
            ),
            ScriptExecutionContext::default(),
        )
        .expect("binary criteria");
        assert_eq!(content.state.last_compare.map(|s| s.different), Some(1));
        let _ = std::fs::remove_dir_all(root);
    }

    #[test]
    fn criteria_ignore_unimportant_treats_whitespace_case_as_same() {
        let root = unique_temp_dir("script-criteria-unimportant");
        let left = root.join("left");
        let right = root.join("right");
        std::fs::create_dir_all(&left).expect("left");
        std::fs::create_dir_all(&right).expect("right");
        std::fs::write(left.join("a.txt"), "Hello World").expect("left file");
        std::fs::write(right.join("a.txt"), "hello   world").expect("right file");

        let ignored = run_script_source(
            &format!(
                "LOAD \"{}\" \"{}\"\nCRITERIA rules-based ignore-unimportant\nCOMPARE\n",
                left.display(),
                right.display()
            ),
            ScriptExecutionContext::default(),
        )
        .expect("ignore-unimportant");
        assert_eq!(ignored.state.last_compare.map(|s| s.different), Some(0));

        let strict = run_script_source(
            &format!(
                "LOAD \"{}\" \"{}\"\nCRITERIA binary\nCOMPARE\n",
                left.display(),
                right.display()
            ),
            ScriptExecutionContext::default(),
        )
        .expect("binary strict");
        assert_eq!(strict.state.last_compare.map(|s| s.different), Some(1));
        let _ = std::fs::remove_dir_all(root);
    }

    #[test]
    fn expands_dynamic_script_variables_from_clock_and_context() {
        let variables = ScriptVariables {
            date: "2026-06-27".to_owned(),
            time: "03:59:42".to_owned(),
            fn_time: "20260627-035942".to_owned(),
            left_path: Some("left/root".to_owned()),
            right_path: Some("right/root".to_owned()),
            selection: Some("src/main.rs".to_owned()),
        };

        let expanded = expand_script_variables(
            "report-%date%-%time%-%fn_time%-%left_path%-%right_path%-%selection%",
            &variables,
        )
        .expect("variables should expand");

        assert_eq!(
            expanded,
            "report-2026-06-27-03:59:42-20260627-035942-left/root-right/root-src/main.rs"
        );
    }

    #[test]
    fn rejects_unknown_dynamic_variables() {
        let error = expand_script_variables("%missing%", &ScriptVariables::default())
            .expect_err("unknown variable should fail");

        assert_eq!(error.line, 0);
        assert!(error.message.contains("unknown variable"));
    }

    #[test]
    fn executes_script_with_context_and_records_each_command() {
        let script = parse_script("LOAD left right\nFILTER *.rs\nCOMPARE").expect("script parses");
        let mut executed = Vec::new();
        let result =
            execute_script_with_handler(&script, ScriptExecutionContext::default(), |ctx| {
                executed.push((ctx.line, ctx.command_name.to_owned()));
                Ok(())
            })
            .expect("script should execute");

        assert_eq!(result.executed, 3);
        assert_eq!(
            executed,
            vec![
                (1, "LOAD".to_owned()),
                (2, "FILTER".to_owned()),
                (3, "COMPARE".to_owned()),
            ]
        );
    }

    #[test]
    fn execution_errors_include_command_line_and_reason() {
        let script = parse_script("LOAD left right\nCOMPARE").expect("script parses");
        let error =
            execute_script_with_handler(&script, ScriptExecutionContext::default(), |ctx| {
                if ctx.command_name == "COMPARE" {
                    return Err("comparison source is not loaded".to_owned());
                }

                Ok(())
            })
            .expect_err("handler error should fail execution");

        assert_eq!(error.line, 2);
        assert_eq!(error.command, "COMPARE");
        assert_eq!(error.reason, "comparison source is not loaded");
        assert!(error.to_string().contains("line 2"));
        assert!(error.to_string().contains("COMPARE"));
    }

    #[test]
    fn runs_load_filter_and_compare_with_compare_engine() {
        #[derive(Default)]
        struct RecordingCompareEngine {
            requests: Vec<ScriptCompareRequest>,
        }

        impl ScriptCompareEngine for RecordingCompareEngine {
            fn compare(
                &mut self,
                request: ScriptCompareRequest,
            ) -> Result<ScriptCompareSummary, String> {
                self.requests.push(request);
                Ok(ScriptCompareSummary {
                    compared: 2,
                    different: 1,
                })
            }
        }

        let script = parse_script(
            r#"
            LOAD "left/root" "right/root"
            FILTER "*.rs" "-target"
            COMPARE
            "#,
        )
        .expect("script parses");
        let mut engine = RecordingCompareEngine::default();
        let result =
            execute_compare_script(&script, ScriptExecutionContext::default(), &mut engine)
                .expect("script should execute");

        assert_eq!(result.executed, 3);
        assert_eq!(
            result.state,
            ScriptRuntimeState {
                load_paths: vec!["left/root".to_owned(), "right/root".to_owned()],
                filters: vec!["*.rs".to_owned(), "-target".to_owned()],
                last_compare: Some(ScriptCompareSummary {
                    compared: 2,
                    different: 1,
                }),
                reports_written: 0,
                logs: Vec::new(),
                beeps: 0,
                options: Vec::new(),
                selection: None,
                file_operations: Vec::new(),
                folder_tree_expand_all: false,
                expanded_paths: Vec::new(),
                criteria: None,
                criteria_acknowledged: Vec::new(),
            }
        );
        assert_eq!(
            engine.requests,
            vec![ScriptCompareRequest {
                load_paths: vec!["left/root".to_owned(), "right/root".to_owned()],
                filters: vec!["*.rs".to_owned(), "-target".to_owned()],
                criteria: None,
            }]
        );
    }

    #[test]
    fn compare_requires_loaded_paths() {
        struct NoopCompareEngine;

        impl ScriptCompareEngine for NoopCompareEngine {
            fn compare(
                &mut self,
                _request: ScriptCompareRequest,
            ) -> Result<ScriptCompareSummary, String> {
                Ok(ScriptCompareSummary::default())
            }
        }

        let script = parse_script("COMPARE").expect("script parses");
        let error = execute_compare_script(
            &script,
            ScriptExecutionContext::default(),
            &mut NoopCompareEngine,
        )
        .expect_err("compare without LOAD should fail");

        assert_eq!(error.line, 1);
        assert_eq!(error.command, "COMPARE");
        assert!(error.reason.contains("LOAD"));
    }

    #[test]
    fn runs_text_and_folder_report_commands_after_compare() {
        struct StaticCompareEngine;

        impl ScriptCompareEngine for StaticCompareEngine {
            fn compare(
                &mut self,
                _request: ScriptCompareRequest,
            ) -> Result<ScriptCompareSummary, String> {
                Ok(ScriptCompareSummary {
                    compared: 4,
                    different: 2,
                })
            }
        }

        #[derive(Default)]
        struct RecordingReportEngine {
            requests: Vec<ScriptReportRequest>,
        }

        impl ScriptReportEngine for RecordingReportEngine {
            fn write_report(&mut self, request: ScriptReportRequest) -> Result<(), String> {
                self.requests.push(request);
                Ok(())
            }
        }

        let script = parse_script(
            r#"
            LOAD left right
            COMPARE
            TEXT-REPORT "reports/text.txt"
            FOLDER-REPORT "reports/folder.html"
            "#,
        )
        .expect("script parses");
        let mut compare_engine = StaticCompareEngine;
        let mut report_engine = RecordingReportEngine::default();
        let result = execute_automation_script(
            &script,
            ScriptExecutionContext::default(),
            &mut compare_engine,
            &mut report_engine,
        )
        .expect("script should execute");

        assert_eq!(result.executed, 4);
        assert_eq!(result.state.reports_written, 2);
        assert_eq!(
            report_engine.requests,
            vec![
                ScriptReportRequest {
                    report_type: ScriptReportType::Text,
                    output: "reports/text.txt".to_owned(),
                    compare_summary: ScriptCompareSummary {
                        compared: 4,
                        different: 2,
                    },
                },
                ScriptReportRequest {
                    report_type: ScriptReportType::Folder,
                    output: "reports/folder.html".to_owned(),
                    compare_summary: ScriptCompareSummary {
                        compared: 4,
                        different: 2,
                    },
                },
            ]
        );
    }

    #[test]
    fn report_requires_previous_compare() {
        struct NoopCompareEngine;
        struct NoopReportEngine;

        impl ScriptCompareEngine for NoopCompareEngine {
            fn compare(
                &mut self,
                _request: ScriptCompareRequest,
            ) -> Result<ScriptCompareSummary, String> {
                Ok(ScriptCompareSummary::default())
            }
        }

        impl ScriptReportEngine for NoopReportEngine {
            fn write_report(&mut self, _request: ScriptReportRequest) -> Result<(), String> {
                Ok(())
            }
        }

        let script = parse_script("TEXT-REPORT out.txt").expect("script parses");
        let error = execute_automation_script(
            &script,
            ScriptExecutionContext::default(),
            &mut NoopCompareEngine,
            &mut NoopReportEngine,
        )
        .expect_err("report before compare should fail");

        assert_eq!(error.line, 1);
        assert_eq!(error.command, "TEXT-REPORT");
        assert!(error.reason.contains("COMPARE"));
    }

    #[test]
    fn parses_log_beep_option_and_select_commands() {
        let script = parse_script(
            r#"
            LOG "starting compare"
            BEEP
            OPTION "ignore-case" "true"
            SELECT "diff-only"
            "#,
        )
        .expect("script parses");

        assert_eq!(
            script.commands,
            vec![
                ScriptCommand {
                    line: 2,
                    kind: ScriptCommandKind::Log {
                        message: "starting compare".to_owned(),
                    },
                },
                ScriptCommand {
                    line: 3,
                    kind: ScriptCommandKind::Beep,
                },
                ScriptCommand {
                    line: 4,
                    kind: ScriptCommandKind::Option {
                        key: "ignore-case".to_owned(),
                        value: "true".to_owned(),
                    },
                },
                ScriptCommand {
                    line: 5,
                    kind: ScriptCommandKind::Select {
                        query: "diff-only".to_owned(),
                    },
                },
            ]
        );
    }

    #[test]
    fn runs_log_beep_option_and_select_commands() {
        struct NoopCompareEngine;
        struct NoopReportEngine;

        impl ScriptCompareEngine for NoopCompareEngine {
            fn compare(
                &mut self,
                _request: ScriptCompareRequest,
            ) -> Result<ScriptCompareSummary, String> {
                Ok(ScriptCompareSummary::default())
            }
        }

        impl ScriptReportEngine for NoopReportEngine {
            fn write_report(&mut self, _request: ScriptReportRequest) -> Result<(), String> {
                Ok(())
            }
        }

        let script = parse_script(
            r#"
            LOG "run %date%"
            BEEP
            OPTION ignore-case true
            SELECT "*.rs"
            "#,
        )
        .expect("script parses");
        let result = execute_automation_script(
            &script,
            ScriptExecutionContext {
                variables: ScriptVariables {
                    date: "2026-06-27".to_owned(),
                    ..ScriptVariables::default()
                },
                ..ScriptExecutionContext::default()
            },
            &mut NoopCompareEngine,
            &mut NoopReportEngine,
        )
        .expect("script should execute");

        assert_eq!(result.executed, 4);
        assert_eq!(result.state.logs, vec!["run 2026-06-27".to_owned()]);
        assert_eq!(result.state.beeps, 1);
        assert_eq!(
            result.state.options,
            vec![ScriptOption {
                key: "ignore-case".to_owned(),
                value: "true".to_owned(),
            }]
        );
        assert_eq!(result.state.selection, Some("*.rs".to_owned()));
    }

    #[test]
    fn visible_mode_records_progress_for_each_command() {
        struct NoopCompareEngine;
        struct NoopReportEngine;

        impl ScriptCompareEngine for NoopCompareEngine {
            fn compare(
                &mut self,
                _request: ScriptCompareRequest,
            ) -> Result<ScriptCompareSummary, String> {
                Ok(ScriptCompareSummary::default())
            }
        }

        impl ScriptReportEngine for NoopReportEngine {
            fn write_report(&mut self, _request: ScriptReportRequest) -> Result<(), String> {
                Ok(())
            }
        }

        let script = parse_script("LOG start\nBEEP").expect("script parses");
        let result = execute_automation_script(
            &script,
            ScriptExecutionContext {
                mode: ScriptExecutionMode::Visible,
                ..ScriptExecutionContext::default()
            },
            &mut NoopCompareEngine,
            &mut NoopReportEngine,
        )
        .expect("script should execute");

        assert_eq!(result.mode, ScriptExecutionMode::Visible);
        assert_eq!(
            result.progress,
            vec![
                ScriptProgressEvent {
                    line: 1,
                    command: "LOG".to_owned(),
                    completed: 1,
                    total: 2,
                },
                ScriptProgressEvent {
                    line: 2,
                    command: "BEEP".to_owned(),
                    completed: 2,
                    total: 2,
                },
            ]
        );
    }

    #[test]
    fn automation_script_records_structured_logs_for_commands() {
        struct NoopCompareEngine;
        struct NoopReportEngine;

        impl ScriptCompareEngine for NoopCompareEngine {
            fn compare(
                &mut self,
                _request: ScriptCompareRequest,
            ) -> Result<ScriptCompareSummary, String> {
                Ok(ScriptCompareSummary::default())
            }
        }

        impl ScriptReportEngine for NoopReportEngine {
            fn write_report(&mut self, _request: ScriptReportRequest) -> Result<(), String> {
                Ok(())
            }
        }

        let script = parse_script("LOG start\nBEEP").expect("script parses");
        let result = execute_automation_script(
            &script,
            ScriptExecutionContext::default(),
            &mut NoopCompareEngine,
            &mut NoopReportEngine,
        )
        .expect("script should execute");

        assert_eq!(result.structured_logs.len(), 2);
        assert_eq!(
            result.structured_logs[0].domain,
            logging_core::LogDomain::Script
        );
        assert_eq!(result.structured_logs[0].action, "LOG");
        assert_eq!(
            result.structured_logs[0].status,
            logging_core::LogStatus::Info
        );
        assert_eq!(result.structured_logs[0].details["line"], 1);
        assert_eq!(result.structured_logs[1].action, "BEEP");
    }

    #[test]
    fn silent_mode_executes_without_progress_events() {
        struct NoopCompareEngine;
        struct NoopReportEngine;

        impl ScriptCompareEngine for NoopCompareEngine {
            fn compare(
                &mut self,
                _request: ScriptCompareRequest,
            ) -> Result<ScriptCompareSummary, String> {
                Ok(ScriptCompareSummary::default())
            }
        }

        impl ScriptReportEngine for NoopReportEngine {
            fn write_report(&mut self, _request: ScriptReportRequest) -> Result<(), String> {
                Ok(())
            }
        }

        let script = parse_script("LOG start\nBEEP").expect("script parses");
        let result = execute_automation_script(
            &script,
            ScriptExecutionContext {
                mode: ScriptExecutionMode::Silent,
                ..ScriptExecutionContext::default()
            },
            &mut NoopCompareEngine,
            &mut NoopReportEngine,
        )
        .expect("script should execute");

        assert_eq!(result.mode, ScriptExecutionMode::Silent);
        assert!(result.progress.is_empty());
        assert_eq!(result.executed, 2);
    }

    #[test]
    fn filesystem_engine_compares_text_files_and_writes_report() {
        let root = unique_temp_dir("script-engine");
        let left = root.join("left.txt");
        let right = root.join("right.txt");
        let report = root.join("out.txt");
        std::fs::write(&left, "alpha\n").expect("left should write");
        std::fs::write(&right, "beta\n").expect("right should write");

        let result = run_script_source(
            &format!(
                "LOAD \"{}\" \"{}\"\nCOMPARE\nTEXT-REPORT \"{}\"\n",
                left.display(),
                right.display(),
                report.display()
            ),
            ScriptExecutionContext::default(),
        )
        .expect("script should run");

        assert_eq!(result.state.reports_written, 1);
        assert_eq!(
            result.state.last_compare,
            Some(ScriptCompareSummary {
                compared: 2,
                different: 1,
            })
        );
        let content = std::fs::read_to_string(&report).expect("report should exist");
        assert!(content.contains("compared: 2"));
        assert!(content.contains("different: 1"));
        let _ = std::fs::remove_dir_all(root);
    }

    #[test]
    fn copies_a_file_and_writes_a_folder_report() {
        let root = unique_temp_dir("script-copy-report");
        let left = root.join("left");
        let right = root.join("right");
        let dest = root.join("copied.txt");
        let report = root.join("folder-report.txt");
        std::fs::create_dir_all(&left).expect("left dir");
        std::fs::create_dir_all(&right).expect("right dir");
        std::fs::write(left.join("notes.txt"), "alpha").expect("left file");
        std::fs::write(right.join("notes.txt"), "beta").expect("right file");

        let result = run_script_source(
            &format!(
                "LOAD \"{}\" \"{}\"\nCOPY \"{}\" \"{}\"\nCOMPARE\nFOLDER-REPORT \"{}\"\n",
                left.display(),
                right.display(),
                left.join("notes.txt").display(),
                dest.display(),
                report.display()
            ),
            ScriptExecutionContext::default(),
        )
        .expect("script should run");

        assert_eq!(
            result.state.file_operations,
            vec![format!(
                "COPY {} {}",
                left.join("notes.txt").display(),
                dest.display()
            )]
        );
        assert_eq!(
            std::fs::read_to_string(&dest).expect("copied file"),
            "alpha"
        );
        assert_eq!(result.state.reports_written, 1);
        let content = std::fs::read_to_string(&report).expect("report should exist");
        assert!(content.contains("FOLDER-REPORT"));
        let _ = std::fs::remove_dir_all(root);
    }

    #[test]
    fn parses_media_attrib_expand_collapse_and_move_commands() {
        let script = parse_script(
            r#"
            MEDIA-REPORT "out/media.txt"
            ATTRIB "file.txt" +R
            ATTRIB -R "other.txt"
            EXPAND "src"
            COLLAPSE
            MOVE "a.txt" "b.txt"
            MOVETO "dest"
            "#,
        )
        .expect("commands should parse");

        assert!(script
            .commands
            .iter()
            .any(|command| matches!(command.kind, ScriptCommandKind::MediaReport { .. })));
        assert!(script.commands.iter().any(|command| matches!(
            command.kind,
            ScriptCommandKind::Attrib { readonly: true, .. }
        )));
        assert!(script.commands.iter().any(|command| matches!(
            command.kind,
            ScriptCommandKind::Attrib {
                readonly: false,
                ..
            }
        )));
        assert!(script
            .commands
            .iter()
            .any(|command| matches!(command.kind, ScriptCommandKind::Expand { path: Some(_) })));
        assert!(script
            .commands
            .iter()
            .any(|command| matches!(command.kind, ScriptCommandKind::Collapse { path: None })));
        assert!(script
            .commands
            .iter()
            .any(|command| matches!(command.kind, ScriptCommandKind::Move { .. })));
        assert!(script
            .commands
            .iter()
            .any(|command| matches!(command.kind, ScriptCommandKind::MoveTo { .. })));
    }

    #[test]
    fn executes_attrib_expand_collapse_move_and_media_report() {
        let root = unique_temp_dir("script-media-attrib-move");
        let left = root.join("left.txt");
        let right = root.join("right.txt");
        let movable = root.join("notes.txt");
        let moved = root.join("archive").join("notes.txt");
        let attrib_target = root.join("locked.txt");
        let report = root.join("media-report.txt");
        std::fs::write(&left, "alpha\n").expect("left");
        std::fs::write(&right, "beta\n").expect("right");
        std::fs::write(&movable, "move-me").expect("movable");
        std::fs::write(&attrib_target, "lock-me").expect("attrib");

        let script = format!(
            "LOAD \"{left}\" \"{right}\"\nCOMPARE\nMEDIA-REPORT \"{report}\"\nATTRIB \"{attrib}\" +R\nEXPAND src\nCOLLAPSE\nSELECT \"{movable}\"\nMOVETO \"{moved}\"\n",
            left = left.display(),
            right = right.display(),
            report = report.display(),
            attrib = attrib_target.display(),
            movable = movable.display(),
            moved = moved.display(),
        );

        let result =
            run_script_source(&script, ScriptExecutionContext::default()).expect("script runs");

        assert_eq!(result.state.reports_written, 1);
        let content = std::fs::read_to_string(&report).expect("report");
        assert!(content.contains("MEDIA-REPORT"));
        assert!(std::fs::metadata(&attrib_target)
            .expect("meta")
            .permissions()
            .readonly());
        assert!(!movable.exists());
        assert_eq!(
            std::fs::read_to_string(&moved).expect("moved file"),
            "move-me"
        );
        assert!(!result.state.folder_tree_expand_all);
        assert!(result
            .state
            .file_operations
            .iter()
            .any(|entry| entry == "EXPAND src"));
        assert!(result
            .state
            .file_operations
            .iter()
            .any(|entry| entry == "COLLAPSE"));

        set_readonly(&attrib_target, false);

        let move_result = run_script_source(
            &format!(
                "MOVE \"{}\" \"{}\"\nEXPAND\n",
                moved.display(),
                root.join("final.txt").display()
            ),
            ScriptExecutionContext::default(),
        )
        .expect("move runs");
        assert!(move_result.state.folder_tree_expand_all);
        assert_eq!(
            std::fs::read_to_string(root.join("final.txt")).expect("final"),
            "move-me"
        );

        let _ = std::fs::remove_dir_all(root);
    }

    #[test]
    fn media_report_compares_media_tags_when_load_paths_are_media_files() {
        let root = unique_temp_dir("script-media-tags");
        let left = root.join("left.mp3");
        let right = root.join("right.mp3");
        let report = root.join("out.txt");

        std::fs::write(&left, id3_fixture("Alpha")).expect("left media");
        std::fs::write(&right, id3_fixture("Beta")).expect("right media");

        let result = run_script_source(
            &format!(
                "LOAD \"{}\" \"{}\"\nMEDIA-REPORT \"{}\"\n",
                left.display(),
                right.display(),
                report.display()
            ),
            ScriptExecutionContext::default(),
        )
        .expect("media report runs");

        assert_eq!(result.state.reports_written, 1);
        assert_eq!(
            result.state.last_compare,
            Some(ScriptCompareSummary {
                compared: 1,
                different: 1,
            })
        );
        let content = std::fs::read_to_string(&report).expect("report");
        assert!(content.contains("MEDIA-REPORT"));
        assert!(content.contains("different: 1"));
        let _ = std::fs::remove_dir_all(root);
    }

    #[test]
    fn hex_report_compares_binaries_when_load_paths_are_files() {
        let root = unique_temp_dir("script-hex-report");
        let left = root.join("left.bin");
        let right = root.join("right.bin");
        let report = root.join("out.txt");

        std::fs::write(&left, b"ABCD").expect("left binary");
        std::fs::write(&right, b"AxCD").expect("right binary");

        let result = run_script_source(
            &format!(
                "LOAD \"{}\" \"{}\"\nHEX-REPORT \"{}\"\n",
                left.display(),
                right.display(),
                report.display()
            ),
            ScriptExecutionContext::default(),
        )
        .expect("hex report runs");

        assert_eq!(result.state.reports_written, 1);
        assert_eq!(
            result.state.last_compare,
            Some(ScriptCompareSummary {
                compared: 4,
                different: 1,
            })
        );
        let content = std::fs::read_to_string(&report).expect("report");
        assert!(content.contains("HEX-REPORT"));
        assert!(content.contains("changedRows: 1"));
        assert!(content.contains("00000001\t42\t78"));
        assert!(content.contains(&format!("left: {}", left.display())));
        let _ = std::fs::remove_dir_all(root);
    }

    #[test]
    fn hex_report_falls_back_to_compare_summary_after_folder_compare() {
        let root = unique_temp_dir("script-hex-fallback");
        let left_dir = root.join("left");
        let right_dir = root.join("right");
        let report = root.join("hex.txt");
        std::fs::create_dir_all(&left_dir).expect("left dir");
        std::fs::create_dir_all(&right_dir).expect("right dir");
        std::fs::write(left_dir.join("a.txt"), "a").expect("left file");
        std::fs::write(right_dir.join("a.txt"), "b").expect("right file");

        let result = run_script_source(
            &format!(
                "LOAD \"{}\" \"{}\"\nCOMPARE\nHEX-REPORT \"{}\"\n",
                left_dir.display(),
                right_dir.display(),
                report.display()
            ),
            ScriptExecutionContext::default(),
        )
        .expect("hex report after folder compare");

        assert_eq!(result.state.reports_written, 1);
        let content = std::fs::read_to_string(&report).expect("report");
        assert!(content.contains("HEX-REPORT"));
        assert!(content.contains("compared:"));
        assert!(!content.contains("rows:"));
        let _ = std::fs::remove_dir_all(root);
    }

    #[test]
    fn picture_report_compares_images_when_load_paths_are_picture_files() {
        let root = unique_temp_dir("script-picture-tags");
        let left = root.join("left.png");
        let right = root.join("right.png");
        let report = root.join("out.txt");

        std::fs::write(&left, RED_PNG).expect("left picture");
        std::fs::write(&right, BLUE_PNG).expect("right picture");

        let result = run_script_source(
            &format!(
                "LOAD \"{}\" \"{}\"\nPICTURE-REPORT \"{}\"\n",
                left.display(),
                right.display(),
                report.display()
            ),
            ScriptExecutionContext::default(),
        )
        .expect("picture report runs");

        assert_eq!(result.state.reports_written, 1);
        assert_eq!(
            result.state.last_compare,
            Some(ScriptCompareSummary {
                compared: 4,
                different: 4,
            })
        );
        let content = std::fs::read_to_string(&report).expect("report");
        assert!(content.contains("PICTURE-REPORT"));
        assert!(content.contains("differentPixels: 4"));
        assert!(content.contains("totalPixels: 4"));
        assert!(content.contains(&format!("left: {}", left.display())));
        let _ = std::fs::remove_dir_all(root);
    }

    #[test]
    fn picture_report_falls_back_to_compare_summary_for_non_images() {
        let root = unique_temp_dir("script-picture-fallback");
        let left = root.join("left.txt");
        let right = root.join("right.txt");
        let report = root.join("picture.txt");
        std::fs::write(&left, "alpha\n").expect("left");
        std::fs::write(&right, "beta\n").expect("right");

        let result = run_script_source(
            &format!(
                "LOAD \"{}\" \"{}\"\nCOMPARE\nPICTURE-REPORT \"{}\"\n",
                left.display(),
                right.display(),
                report.display()
            ),
            ScriptExecutionContext::default(),
        )
        .expect("picture report after compare");

        assert_eq!(result.state.reports_written, 1);
        let content = std::fs::read_to_string(&report).expect("report");
        assert!(content.contains("PICTURE-REPORT"));
        assert!(content.contains("compared:"));
        let _ = std::fs::remove_dir_all(root);
    }

    const RED_PNG: &[u8] = &[
        137, 80, 78, 71, 13, 10, 26, 10, 0, 0, 0, 13, 73, 72, 68, 82, 0, 0, 0, 2, 0, 0, 0, 2, 8, 6,
        0, 0, 0, 114, 182, 13, 36, 0, 0, 0, 17, 73, 68, 65, 84, 120, 156, 99, 248, 207, 192, 240,
        31, 132, 25, 96, 12, 0, 71, 202, 7, 249, 103, 89, 110, 183, 0, 0, 0, 0, 73, 69, 78, 68,
        174, 66, 96, 130,
    ];
    const BLUE_PNG: &[u8] = &[
        137, 80, 78, 71, 13, 10, 26, 10, 0, 0, 0, 13, 73, 72, 68, 82, 0, 0, 0, 2, 0, 0, 0, 2, 8, 6,
        0, 0, 0, 114, 182, 13, 36, 0, 0, 0, 16, 73, 68, 65, 84, 120, 156, 99, 96, 96, 248, 255, 31,
        130, 161, 12, 0, 63, 210, 7, 249, 180, 18, 79, 205, 0, 0, 0, 0, 73, 69, 78, 68, 174, 66,
        96, 130,
    ];

    fn id3_fixture(title: &str) -> Vec<u8> {
        let mut payload = vec![0];
        payload.extend(title.as_bytes());
        let mut frame = b"TIT2".to_vec();
        frame.extend((payload.len() as u32).to_be_bytes());
        frame.extend([0, 0]);
        frame.extend(payload);
        let mut bytes = b"ID3\x03\x00\x00".to_vec();
        bytes.extend([
            ((frame.len() >> 21) & 0x7f) as u8,
            ((frame.len() >> 14) & 0x7f) as u8,
            ((frame.len() >> 7) & 0x7f) as u8,
            (frame.len() & 0x7f) as u8,
        ]);
        bytes.extend(frame);
        bytes.extend(b"MPEG");
        bytes
    }

    fn set_readonly(path: &std::path::Path, readonly: bool) {
        let mut permissions = std::fs::metadata(path)
            .expect("metadata should be readable")
            .permissions();

        permissions.set_readonly(readonly);
        std::fs::set_permissions(path, permissions).expect("permissions should update");
    }

    fn unique_temp_dir(label: &str) -> std::path::PathBuf {
        let stamp = std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .expect("clock")
            .as_nanos();
        let path = std::env::temp_dir().join(format!("open-diff-{label}-{stamp}"));
        std::fs::create_dir_all(&path).expect("temp dir");
        path
    }
}
