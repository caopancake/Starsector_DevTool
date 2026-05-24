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
            commands::open_project_session,
            commands::close_project_session,
            commands::query_csv_table_window,
            commands::query_csv_source_options,
            commands::query_csv_row_preview,
            commands::query_hull_references,
            commands::query_entity,
            commands::query_entity_list,
            commands::query_resource_data_urls,
            commands::invalidate_project_session,
            commands::invalidate_core_cache,
            commands::detect_directory,
            commands::scan_game_overview,
            commands::save_csv_patch_with_history,
            commands::upload_sprite,
            commands::load_workspace,
            commands::save_workspace,
            commands::append_app_log,
            commands::get_app_log_status,
            commands::open_config_dir,
            commands::open_app_log_file,
            commands::clear_config_files,
            commands::clear_app_log_file,
            commands::load_app_settings,
            commands::save_app_settings,
            commands::save_indexed_config_entity_with_history,
            commands::create_indexed_config_entity_with_history,
            commands::delete_indexed_config_entity_with_history,
            commands::save_variant_entity_with_history,
            commands::create_variant_entity_with_history,
            commands::delete_variant_entity_with_history,
            commands::save_skin_entity_with_history,
            commands::create_skin_entity_with_history,
            commands::delete_skin_entity_with_history,
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
