use cli_core::{
    automerge_text_files, build_git_difftool_config, build_git_mergetool_config,
    build_svn_diff_config, cli_exit_code_value, cli_help_text, compare_folders, compare_text_files,
    describe_open_compare, open_named_session, parse_cli_args, preview_folder_sync_cli,
    write_git_tool_config, write_svn_diff_config, CliCommand, CliExitCode,
};
use shell_core::{ShellCompareOutcome, ShellCompareSessionType, ShellCompareStateStore};

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
            println!("{}", cli_help_text());
        }
        CliCommand::CompareFiles { left, right, quiet } => {
            let result = match compare_text_files(&left, &right) {
                Ok(result) => result,
                Err(error) => {
                    eprintln!("{}", error.message);
                    std::process::exit(cli_exit_code_value(error.exit_code));
                }
            };

            if !quiet {
                println!(
                    "added: {}, deleted: {}, modified: {}",
                    result.added, result.deleted, result.modified
                );
            }
            std::process::exit(cli_exit_code_value(result.exit_code));
        }
        CliCommand::ShellCompare { path, select_left } => {
            let store = ShellCompareStateStore::new(shell_compare_state_path());
            let outcome = if select_left {
                store.select_left_only(&path)
            } else {
                store.select_path(&path)
            };
            match outcome {
                Ok(ShellCompareOutcome::PendingLeft { left }) => {
                    println!("shell compare pending left: {left}");
                }
                Ok(ShellCompareOutcome::Ready(action)) => match action.session_type {
                    ShellCompareSessionType::Folder => {
                        let result = match compare_folders(&action.left, &action.right) {
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
                    ShellCompareSessionType::Text | ShellCompareSessionType::Hex => {
                        let result = match compare_text_files(&action.left, &action.right) {
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
                },
                Err(error) => {
                    eprintln!("{error:?}");
                    std::process::exit(cli_exit_code_value(CliExitCode::UsageError));
                }
            }
        }
        CliCommand::GitDifftoolConfig {
            executable_path,
            scope,
            write,
        } => {
            let config = match build_git_difftool_config(&executable_path, scope) {
                Ok(config) => config,
                Err(error) => {
                    eprintln!("{}", error.message);
                    std::process::exit(cli_exit_code_value(error.exit_code));
                }
            };

            if write {
                match write_git_tool_config(&config) {
                    Ok(message) => println!("{message}"),
                    Err(error) => {
                        eprintln!("{}", error.message);
                        std::process::exit(cli_exit_code_value(error.exit_code));
                    }
                }
            } else {
                println!("{}", config.description);
                for command in config.commands {
                    println!("{command}");
                }
            }
        }
        CliCommand::GitMergetoolConfig {
            executable_path,
            scope,
            write,
        } => {
            let config = match build_git_mergetool_config(&executable_path, scope) {
                Ok(config) => config,
                Err(error) => {
                    eprintln!("{}", error.message);
                    std::process::exit(cli_exit_code_value(error.exit_code));
                }
            };

            if write {
                match write_git_tool_config(&config) {
                    Ok(message) => println!("{message}"),
                    Err(error) => {
                        eprintln!("{}", error.message);
                        std::process::exit(cli_exit_code_value(error.exit_code));
                    }
                }
            } else {
                println!("{}", config.description);
                for command in config.commands {
                    println!("{command}");
                }
            }
        }
        CliCommand::SvnDiff { left, right } => {
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
        CliCommand::SvnDiffConfig {
            executable_path,
            wrapper_path,
            write,
        } => {
            let config = match build_svn_diff_config(&executable_path, &wrapper_path) {
                Ok(config) => config,
                Err(error) => {
                    eprintln!("{}", error.message);
                    std::process::exit(cli_exit_code_value(error.exit_code));
                }
            };

            if write {
                match write_svn_diff_config(&config, &wrapper_path) {
                    Ok(message) => println!("{message}"),
                    Err(error) => {
                        eprintln!("{}", error.message);
                        std::process::exit(cli_exit_code_value(error.exit_code));
                    }
                }
            } else {
                println!("{}", config.description);
                println!("Subversion config:");
                println!("{}", config.config_snippet);
                println!("Wrapper script:");
                println!("{}", config.wrapper_script);
                println!("One-off command:");
                println!("{}", config.example_command);
            }
        }
        CliCommand::Script { path } => {
            match script_core::run_script_file(
                &path,
                script_core::ScriptExecutionContext::default(),
            ) {
                Ok(result) => {
                    let summary = result.state.last_compare.unwrap_or_default();
                    println!(
                        "executed: {}, compared: {}, different: {}, reports: {}",
                        result.executed,
                        summary.compared,
                        summary.different,
                        result.state.reports_written
                    );
                    for log in result.state.logs {
                        println!("{log}");
                    }
                }
                Err(error) => {
                    eprintln!("{error}");
                    std::process::exit(4);
                }
            }
        }
        CliCommand::CompareFolders { left, right, quiet } => {
            let result = match compare_folders(&left, &right) {
                Ok(result) => result,
                Err(error) => {
                    eprintln!("{}", error.message);
                    std::process::exit(cli_exit_code_value(error.exit_code));
                }
            };

            if !quiet {
                println!(
                    "total: {}, same: {}, different: {}, left-only: {}, right-only: {}, error: {}",
                    result.total,
                    result.same,
                    result.different,
                    result.left_only,
                    result.right_only,
                    result.error
                );
            }
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
            if let Some(left) = &result.left {
                println!("left: {left}");
            }
            if let Some(right) = &result.right {
                println!("right: {right}");
            }
            if let Some(center) = &result.center {
                println!("center: {center}");
            }
            if let Some(output) = &result.output {
                println!("output: {output}");
            }
            println!("{}", result.note);
            std::process::exit(cli_exit_code_value(result.exit_code));
        }
        CliCommand::OpenCompare {
            session_type,
            left,
            right,
            route,
            options,
        } => {
            let silent = options.silent;
            let result = describe_open_compare(session_type, left, right, route, options);
            if !silent {
                println!(
                    "open session: {} | route: {} | left: {} | right: {}",
                    result.session_type, result.route, result.left, result.right
                );
                if let Some(center) = &result.options.center {
                    println!("center: {center}");
                }
                if let Some(output) = &result.options.output {
                    println!("output: {output}");
                }
                if result.options.left_readonly || result.options.right_readonly {
                    println!(
                        "readonly: left={} right={}",
                        result.options.left_readonly, result.options.right_readonly
                    );
                }
                if result.options.edit {
                    println!("edit: true");
                }
                if let Some(favor) = result.options.favor {
                    println!("favor: {favor:?}");
                }
                if let Some(title) = &result.options.title {
                    println!("title: {title}");
                }
            }
            std::process::exit(cli_exit_code_value(result.exit_code));
        }
        CliCommand::SyncPreview { left, right, quiet } => {
            let result = match preview_folder_sync_cli(&left, &right) {
                Ok(result) => result,
                Err(error) => {
                    eprintln!("{}", error.message);
                    std::process::exit(cli_exit_code_value(error.exit_code));
                }
            };
            if !quiet {
                println!(
                    "sync-preview total: {}, copy: {}, delete: {}, leave: {}, conflict: {}",
                    result.total, result.copy, result.delete, result.leave, result.conflict
                );
            }
            std::process::exit(cli_exit_code_value(result.exit_code));
        }
        CliCommand::MergeText(args) => {
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
    }

    std::process::exit(cli_exit_code_value(invocation.exit_code));
}

fn shell_compare_state_path() -> std::path::PathBuf {
    if let Ok(path) = std::env::var("OPEN_DIFF_CONFIG_DIR") {
        return std::path::PathBuf::from(path).join("shell-compare-pending");
    }

    let home = std::env::var("HOME")
        .or_else(|_| std::env::var("USERPROFILE"))
        .unwrap_or_else(|_| std::env::temp_dir().display().to_string());

    std::path::PathBuf::from(home)
        .join(".config")
        .join("open-diff")
        .join("shell-compare-pending")
}
