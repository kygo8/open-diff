mod commands;

pub fn run() {
    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![
            commands::check_text_file_changed,
            commands::diff_text,
            commands::parse_text_patch,
            commands::read_text_file
        ])
        .run(tauri::generate_context!())
        .expect("failed to run Open Diff application");
}
