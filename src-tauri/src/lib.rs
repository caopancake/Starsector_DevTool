mod commands;
mod domain;
mod errors;
mod io;
mod models;
mod parsers;
mod services;

use tauri::Manager;

pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_single_instance::init(|app, _argv, _cwd| {
            if let Some(window) = app.get_webview_window("main") {
                let _ = window.unminimize();
                let _ = window.set_focus();
            }
        }))
        .plugin(tauri_plugin_dialog::init())
        .invoke_handler(tauri::generate_handler![
            commands::load_mod_data,
            commands::load_mod_data_with_root,
            commands::detect_directory,
            commands::scan_game_overview,
            commands::save_csv_with_history,
            commands::load_csv_table,
            commands::upload_sprite,
            commands::load_workspace,
            commands::save_workspace,
            commands::save_indexed_config_entity_with_history,
            commands::create_indexed_config_entity_with_history,
            commands::delete_indexed_config_entity_with_history,
            commands::save_variant_entity_with_history,
            commands::create_variant_entity_with_history,
            commands::delete_variant_entity_with_history,
            commands::save_skin_entity_with_history,
            commands::create_skin_entity_with_history,
            commands::delete_skin_entity_with_history,
            commands::scan_mission_list,
            commands::load_mission_list_csv,
            commands::load_mission,
            commands::load_image_data_url,
            commands::scan_core_fields,
            commands::scan_core_graphics,
            commands::load_editable_file,
            commands::save_text_file_with_history,
            commands::save_json_with_history,
            commands::save_mod_files_with_history,
            commands::apply_file_change_set,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
