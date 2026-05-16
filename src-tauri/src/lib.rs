mod commands;
mod errors;
mod filesystem;
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
            commands::save_csv,
            commands::add_csv_row,
            commands::delete_csv_row,
            commands::add_ship_row,
            commands::delete_ship_row,
            commands::add_weapon_row,
            commands::delete_weapon_row,
            commands::save_ship,
            commands::save_wpn,
            commands::save_proj,
            commands::upload_sprite,
            commands::save_mod_info,
            commands::load_workspace,
            commands::save_workspace,
            commands::save_faction,
            commands::create_faction,
            commands::delete_faction,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
