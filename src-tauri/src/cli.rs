use cli_core::{
    automerge_text_files, cli_exit_code_contract, cli_exit_code_value, compare_folders,
    compare_text_files, open_named_session, parse_cli_args, CliCommand,
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
            println!("  open-session <store-root> <name>");
            println!("  merge-text <base> <left> <right> [output]");
            println!("Exit codes:");
            for spec in cli_exit_code_contract() {
                println!("  {} {}", spec.value, spec.meaning);
            }
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
        CliCommand::OpenSession { store_root, name } => {
            let result = match open_named_session(&store_root, &name) {
                Ok(result) => result,
                Err(error) => {
                    eprintln!("{}", error.message);
                    std::process::exit(cli_exit_code_value(error.exit_code));
                }
            };

            println!(
                "session: {} | name: {} | type: {}",
                result.id, result.name, result.session_type
            );
            std::process::exit(cli_exit_code_value(result.exit_code));
        }
        CliCommand::MergeText(args) => {
            if args.automerge {
                let result = match automerge_text_files(args) {
                    Ok(result) => result,
                    Err(error) => {
                        eprintln!("{}", error.message);
                        std::process::exit(cli_exit_code_value(error.exit_code));
                    }
                };

                println!(
                    "merge conflicts: {}, output: {}, backup: {}",
                    result.conflicts,
                    result.output_path.as_deref().unwrap_or("<none>"),
                    result.backup_path.as_deref().unwrap_or("<none>")
                );
                std::process::exit(cli_exit_code_value(result.exit_code));
            }

            println!(
                "merge base: {}, left: {}, right: {}, output: {}",
                args.base,
                args.left,
                args.right,
                args.output.as_deref().unwrap_or("<none>")
            );
        }
    }

    std::process::exit(cli_exit_code_value(invocation.exit_code));
}
