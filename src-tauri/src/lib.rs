mod commands;

pub fn run() {
    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![
            commands::diff_text,
            commands::read_text_file
        ])
        .run(tauri::generate_context!())
        .expect("failed to run Open Diff application");
}
