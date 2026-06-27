use serde::{Deserialize, Serialize};

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
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ScriptParseError {
    pub line: usize,
    pub message: String,
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
}
