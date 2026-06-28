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
    Log { message: String },
    Beep,
    Option { key: String, value: String },
    Select { query: String },
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
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ScriptOption {
    pub key: String,
    pub value: String,
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
}

pub trait ScriptCompareEngine {
    fn compare(&mut self, request: ScriptCompareRequest) -> Result<ScriptCompareSummary, String>;
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum ScriptReportType {
    Text,
    Folder,
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
                    })
                    .map_err(|reason| execution_error(command, reason))?;
                state.last_compare = Some(summary);
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
        })
        .map_err(|reason| execution_error(command, reason))?;
    state.last_compare = Some(summary);

    Ok(())
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
        | ScriptCommandKind::Select { .. } => LogStatus::Info,
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
            ScriptCommandKind::Log { .. } => "LOG",
            ScriptCommandKind::Beep => "BEEP",
            ScriptCommandKind::Option { .. } => "OPTION",
            ScriptCommandKind::Select { .. } => "SELECT",
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
        unknown => Err(parse_error(line, format!("unknown command: {unknown}"))),
    }
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
    fn rejects_unknown_script_commands_with_line_number() {
        let error = parse_script("LOAD left right\nNOPE").expect_err("unknown command should fail");

        assert_eq!(error.line, 2);
        assert!(error.message.contains("unknown command"));
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
            }
        );
        assert_eq!(
            engine.requests,
            vec![ScriptCompareRequest {
                load_paths: vec!["left/root".to_owned(), "right/root".to_owned()],
                filters: vec!["*.rs".to_owned(), "-target".to_owned()],
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
}
