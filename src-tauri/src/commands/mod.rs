use crate::{
    filesystem,
    models::{
        AddCsvRowPayload, AddShipRowPayload, AddWeaponRowPayload, AppData, CsvTable, DeletePayload,
        EditableFileData, FactionPayload, GameOverviewData, MissionData, MissionListCsvPayload,
        MissionPayload, OpenDirectoryResult, PersistedWorkspace, SaveCsvPayload,
        SaveEditableFilePayload, SaveJsonPayload, SaveModInfoPayload, UploadSpritePayload,
        UploadSpriteResult,
    },
    services,
};
use serde_json::Value;
use std::collections::BTreeMap;
use std::path::Path;
use tauri::Manager;

#[tauri::command]
pub fn load_mod_data(mod_root: String) -> Result<AppData, String> {
    services::load_all_data(Path::new(&mod_root)).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn load_mod_data_with_root(
    mod_root: String,
    starsector_root: Option<String>,
) -> Result<AppData, String> {
    services::load_all_data_with_root(
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
    services::detect_directory(Path::new(&path), fallback_starsector_root.as_deref())
}

#[tauri::command]
pub fn scan_game_overview(starsector_root: String) -> GameOverviewData {
    services::scan_game_overview(Path::new(&starsector_root))
}

#[tauri::command]
pub fn save_csv(payload: SaveCsvPayload) -> Result<String, String> {
    services::save_csv(payload).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn add_csv_row(payload: AddCsvRowPayload) -> Result<(), String> {
    services::add_csv_row(payload).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn delete_csv_row(payload: DeletePayload) -> Result<(), String> {
    let table = payload.table.ok_or_else(|| "missing table".to_string())?;
    services::delete_csv_row(&payload.mod_root, &table, &payload.id).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn add_ship_row(payload: AddShipRowPayload) -> Result<(), String> {
    services::add_ship_row(payload).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn delete_ship_row(payload: DeletePayload) -> Result<(), String> {
    services::delete_ship_row(&payload.mod_root, &payload.id).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn add_weapon_row(payload: AddWeaponRowPayload) -> Result<(), String> {
    services::add_weapon_row(payload).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn delete_weapon_row(payload: DeletePayload) -> Result<(), String> {
    services::delete_weapon_row(&payload.mod_root, &payload.id).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn save_ship(payload: SaveJsonPayload) -> Result<String, String> {
    services::save_ship(&payload.mod_root, &payload.id, &payload.data).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn save_wpn(payload: SaveJsonPayload) -> Result<String, String> {
    services::save_weapon(&payload.mod_root, &payload.id, &payload.data).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn save_proj(payload: SaveJsonPayload) -> Result<String, String> {
    services::save_projectile(&payload.mod_root, &payload.id, &payload.data)
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub fn upload_sprite(payload: UploadSpritePayload) -> Result<UploadSpriteResult, String> {
    filesystem::upload_sprite(payload).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn save_mod_info(payload: SaveModInfoPayload) -> Result<(), String> {
    services::save_mod_info(&payload.mod_root, &payload.data).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn load_workspace(app_handle: tauri::AppHandle) -> Result<PersistedWorkspace, String> {
    let app_data = app_handle
        .path()
        .app_data_dir()
        .map_err(|e| e.to_string())?;
    Ok(services::workspace::load_workspace(&app_data))
}

#[tauri::command]
pub fn save_workspace(
    app_handle: tauri::AppHandle,
    state: PersistedWorkspace,
) -> Result<(), String> {
    let app_data = app_handle
        .path()
        .app_data_dir()
        .map_err(|e| e.to_string())?;
    services::workspace::save_workspace(&app_data, &state).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn save_faction(payload: FactionPayload) -> Result<(), String> {
    let data = payload.data.ok_or_else(|| "missing data".to_string())?;
    services::save_faction(&payload.mod_root, &payload.id, &data).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn create_faction(payload: FactionPayload) -> Result<Value, String> {
    services::create_faction(&payload.mod_root, &payload.id).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn delete_faction(payload: FactionPayload) -> Result<(), String> {
    services::delete_faction(
        &payload.mod_root,
        &payload.id,
        payload.delete_file.unwrap_or(false),
    )
    .map_err(|e| e.to_string())
}

#[tauri::command]
pub fn scan_mission_list(mod_root: String) -> Vec<String> {
    services::scan_mission_list_files(&mod_root)
}

#[tauri::command]
pub fn load_mission_list_csv(payload: MissionListCsvPayload) -> Result<CsvTable, String> {
    services::load_mission_list_csv(&payload.mod_root, &payload.rel_path).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn save_mission_list_csv(payload: MissionListCsvPayload) -> Result<(), String> {
    let header = payload.header.ok_or_else(|| "missing header".to_string())?;
    let rows = payload.rows.ok_or_else(|| "missing rows".to_string())?;
    services::save_mission_list_csv(&payload.mod_root, &payload.rel_path, &header, &rows)
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub fn load_mission(payload: MissionPayload) -> Result<MissionData, String> {
    services::load_mission(&payload.mod_root, &payload.mission).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn save_mission(payload: MissionPayload) -> Result<(), String> {
    let descriptor = payload
        .descriptor
        .ok_or_else(|| "missing descriptor".to_string())?;
    let text = payload.text.ok_or_else(|| "missing text".to_string())?;
    services::save_mission(&payload.mod_root, &payload.mission, &descriptor, &text)
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub fn delete_mission_dir(payload: MissionPayload) -> Result<(), String> {
    services::delete_mission_dir(&payload.mod_root, &payload.mission).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn load_image_data_url(
    mod_root: String,
    rel_path: String,
    starsector_root: Option<String>,
) -> Result<Option<String>, String> {
    services::load_image_as_data_url(&mod_root, &rel_path, starsector_root.as_deref())
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub fn scan_core_fields(starsector_root: String) -> BTreeMap<String, Vec<Value>> {
    services::scan_core_fields(&starsector_root)
}

#[tauri::command]
pub fn scan_core_graphics(starsector_root: String) -> Vec<String> {
    services::scan_core_graphics(&starsector_root)
}

#[tauri::command]
pub fn load_editable_file(path: String) -> Result<EditableFileData, String> {
    let target = Path::new(&path);
    filesystem::read_utf8_no_bom(target)
        .map(|text| EditableFileData {
            path: target.display().to_string(),
            text,
        })
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub fn save_editable_file(payload: SaveEditableFilePayload) -> Result<(), String> {
    filesystem::write_utf8_no_bom(Path::new(&payload.path), &payload.text)
        .map_err(|e| e.to_string())
}
