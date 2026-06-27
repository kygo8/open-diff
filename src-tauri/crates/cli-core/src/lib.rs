use serde::{Deserialize, Serialize};

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

#[cfg(test)]
mod tests {
    use super::*;

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
}
