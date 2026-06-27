use cli_core::{cli_exit_code_value, parse_cli_args, CliCommand};

fn main() {
    let invocation = match parse_cli_args(std::env::args()) {
        Ok(invocation) => invocation,
        Err(error) => {
            eprintln!("{}", error.message);
            std::process::exit(cli_exit_code_value(error.exit_code));
        }
    };

    match invocation.command {
        CliCommand::Help => {
            println!("Usage: open-diff-cli <command> [args]");
            println!("Commands:");
            println!("  compare <left> <right>");
        }
        CliCommand::CompareFiles { left, right } => {
            println!("compare {left} {right}");
        }
    }

    std::process::exit(cli_exit_code_value(invocation.exit_code));
}
