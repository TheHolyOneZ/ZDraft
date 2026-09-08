pub mod commands;
pub mod error;
pub mod events;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_clipboard_manager::init())
        .invoke_handler(tauri::generate_handler![
            commands::export::outline_svg,
            commands::export::write_pdf,
            commands::files::list_folder,
            commands::files::read_file,
            commands::files::write_file,
            commands::files::write_bytes,
            commands::files::path_exists,
            commands::git::git_head_blob,
            commands::git::git_status,
            commands::layout::read_layout,
            commands::layout::write_layout,
            commands::layout::resolve_layout_conflict,
            commands::layout::parse_layout,
            commands::layout::delete_layout,
            commands::layout::layout_path_for,
            commands::plantuml::plantuml_probe,
            commands::plantuml::plantuml_install,
            commands::plantuml::plantuml_install_dir,
            commands::plantuml::plantuml_render,
            commands::startup::startup_args,
        ])
        .run(tauri::generate_context!())
        .expect("error while running ZDraft");
}
