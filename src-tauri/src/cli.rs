use cli_core::{
    cli_exit_code_value, compare_folders, compare_text_files, parse_cli_args, CliCommand,
};

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
            println!("  compare-folders <left> <right>");
        }
        CliCommand::CompareFiles { left, right } => {
            let result = match compare_text_files(&left, &right) {
                Ok(result) => result,
                Err(error) => {
                    eprintln!("{}", error.message);
                    std::process::exit(cli_exit_code_value(error.exit_code));
                }
            };

            println!(
                "added: {}, deleted: {}, modified: {}",
                result.added, result.deleted, result.modified
            );
            std::process::exit(cli_exit_code_value(result.exit_code));
        }
        CliCommand::CompareFolders { left, right } => {
            let result = match compare_folders(&left, &right) {
                Ok(result) => result,
                Err(error) => {
                    eprintln!("{}", error.message);
                    std::process::exit(cli_exit_code_value(error.exit_code));
                }
            };

            println!(
                "total: {}, same: {}, different: {}, left-only: {}, right-only: {}, error: {}",
                result.total,
                result.same,
                result.different,
                result.left_only,
                result.right_only,
                result.error
            );
            std::process::exit(cli_exit_code_value(result.exit_code));
        }
    }

    std::process::exit(cli_exit_code_value(invocation.exit_code));
}
