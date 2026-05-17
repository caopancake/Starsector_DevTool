use crate::{
    models::{AppData, GameOverviewData, OpenDirectoryResult},
    services,
};
use std::path::Path;

#[tauri::command]
pub fn load_mod_data(mod_root: String) -> Result<AppData, String> {
    services::project::load_all_data(Path::new(&mod_root)).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn load_mod_data_with_root(
    mod_root: String,
    starsector_root: Option<String>,
) -> Result<AppData, String> {
    services::project::load_all_data_with_root(
        Path::new(&mod_root),
        starsector_root.as_deref().map(Path::new),
    )
    .map_err(|e| e.to_string())
}

#[tauri::command]
pub fn detect_directory(
    path: String,
    fallback_starsector_root: Option<String>,
) -> OpenDirectoryResult {
    services::project::detect_directory(Path::new(&path), fallback_starsector_root.as_deref())
}

#[tauri::command]
pub fn scan_game_overview(starsector_root: String) -> GameOverviewData {
    services::project::scan_game_overview(Path::new(&starsector_root))
}
