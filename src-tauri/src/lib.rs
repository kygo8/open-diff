pub use shell_startup::{prepare_shell_startup, ShellStartupDecision};

mod commands;
#[cfg(target_os = "linux")]
mod linux_dnd;
mod shell_startup;
mod sources;

pub fn run() {
    tauri::Builder::default()
        .setup(|_app| {
            #[cfg(target_os = "linux")]
            {
                use tauri::Manager;

                if let Some(main) = _app.get_webview_window("main") {
                    if let Err(error) = linux_dnd::install_linux_desktop_drop_bridge(&main) {
                        eprintln!("[OpenDiff] Linux desktop drop bridge unavailable: {error}");
                    }
                }
            }

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            commands::apply_live_registry_value,
            commands::apply_text_patch,
            commands::apply_text_patch_to_file,
            commands::check_text_file_changed,
            commands::classify_paths,
            commands::build_folder_merge_plan,
            commands::change_folder_entry_attributes,
            commands::app_runtime_info,
            commands::compare_folder_paths,
            commands::compare_hex_files,
            commands::compare_media_files,
            commands::compare_picture_files,
            commands::compare_registry_exports,
            commands::compare_registry_live_keys,
            commands::compare_registry_hive_files,
            commands::compare_table,
            commands::compare_table_csv,
            commands::compare_version_files,
            commands::copy_folder_compare_entry,
            commands::copy_folder_entry,
            commands::create_folder_snapshot,
            commands::create_folder_entry,
            commands::delete_folder_entry,
            commands::delete_remote_profile,
            commands::diff_text,
            commands::execute_folder_merge_plan,
            commands::execute_folder_sync,
            commands::export_folder_compare_report,
            commands::export_text_compare_report,
            commands::find_hex_in_file,
            commands::list_archive,
            commands::set_archive_extensions,
            commands::list_remote_path,
            commands::list_remote_profiles,
            commands::load_admin_policy,
            commands::merge_text_files,
            commands::move_folder_entry,
            commands::parse_text_patch,
            commands::path_file_stamp,
            commands::path_volume_info,
            commands::pick_path,
            commands::preview_folder_sync,
            commands::query_live_windows_registry,
            commands::read_text_file,
            commands::register_windows_shell_extension,
            commands::register_unix_shell_integration,
            commands::open_path_external,
            commands::take_shell_compare_launch,
            commands::unregister_windows_shell_extension,
            commands::unregister_unix_shell_integration,
            commands::rename_folder_entry,
            commands::run_script,
            commands::stop_script,
            commands::save_hex_edits,
            commands::save_remote_profile,
            commands::save_text_file,
            commands::test_remote_profile,
            commands::touch_folder_entry,
            commands::write_git_integration,
            commands::write_svn_integration
        ])
        .run(tauri::generate_context!())
        .expect("failed to run Open Diff application");
}
