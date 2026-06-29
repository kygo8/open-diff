mod commands;

pub fn run() {
    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![
            commands::check_text_file_changed,
            commands::build_folder_merge_plan,
            commands::compare_folder_paths,
            commands::compare_hex_files,
            commands::compare_media_files,
            commands::compare_picture_files,
            commands::compare_registry_exports,
            commands::compare_table_csv,
            commands::compare_version_files,
            commands::diff_text,
            commands::parse_text_patch,
            commands::preview_folder_sync,
            commands::read_text_file,
            commands::save_text_file
        ])
        .run(tauri::generate_context!())
        .expect("failed to run Open Diff application");
}
