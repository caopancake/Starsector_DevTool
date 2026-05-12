mod commands;
mod errors;
mod filesystem;
mod models;
mod parsers;
mod services;

pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .invoke_handler(tauri::generate_handler![
            commands::load_mod_data,
            commands::save_csv,
            commands::add_csv_row,
            commands::delete_csv_row,
            commands::save_ship,
            commands::delete_ship,
            commands::save_wpn,
            commands::save_proj,
            commands::upload_sprite,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
