use crate::{
    models::{AppData, GameOverviewData, OpenDirectoryResult},
    services,
};

#[tauri::command]
pub fn load_mod_data(app_handle: tauri::AppHandle, mod_root: String) -> Result<AppData, String> {
    services::project::load_mod_data_for_command(app_handle, mod_root).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn load_mod_data_with_root(
    app_handle: tauri::AppHandle,
    mod_root: String,
    starsector_root: Option<String>,
) -> Result<AppData, String> {
    services::project::load_mod_data_with_root_for_command(app_handle, mod_root, starsector_root)
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub fn detect_directory(
    path: String,
    fallback_starsector_root: Option<String>,
) -> OpenDirectoryResult {
    services::project::detect_directory_for_command(path, fallback_starsector_root)
}

#[tauri::command]
pub fn scan_game_overview(starsector_root: String) -> GameOverviewData {
    services::project::scan_game_overview_for_command(starsector_root)
}
