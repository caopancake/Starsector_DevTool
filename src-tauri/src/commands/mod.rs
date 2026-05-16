use crate::{
    filesystem,
    models::{
        AddCsvRowPayload, AddShipRowPayload, AddWeaponRowPayload, AppData, CampaignCsvPayload,
        CsvTable, DeletePayload, FactionPayload, PersistedWorkspace, SaveCsvPayload,
        SaveJsonPayload, SaveModInfoPayload, UploadSpritePayload, UploadSpriteResult,
        WorldFilePayload,
    },
    services,
};
use serde_json::Value;
use std::path::Path;
use tauri::Manager;

#[tauri::command]
pub fn load_mod_data(mod_root: String) -> Result<AppData, String> {
    services::load_all_data(Path::new(&mod_root)).map_err(|e| e.to_string())
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
    services::delete_faction(&payload.mod_root, &payload.id).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn scan_campaign(mod_root: String) -> Vec<String> {
    services::scan_campaign_files(&mod_root)
}

#[tauri::command]
pub fn load_campaign_csv(payload: CampaignCsvPayload) -> Result<CsvTable, String> {
    services::load_campaign_csv(&payload.mod_root, &payload.rel_path).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn save_campaign_csv(payload: CampaignCsvPayload) -> Result<(), String> {
    let header = payload.header.ok_or_else(|| "missing header".to_string())?;
    let rows = payload.rows.ok_or_else(|| "missing rows".to_string())?;
    services::save_campaign_csv(&payload.mod_root, &payload.rel_path, &header, &rows)
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub fn scan_world_files(mod_root: String) -> Vec<String> {
    services::scan_world_files(&mod_root)
}

#[tauri::command]
pub fn load_world_file(payload: WorldFilePayload) -> Result<Value, String> {
    services::load_world_file(&payload.mod_root, &payload.rel_path).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn save_world_file(payload: WorldFilePayload) -> Result<(), String> {
    let data = payload.data.ok_or_else(|| "missing data".to_string())?;
    services::save_world_file(&payload.mod_root, &payload.rel_path, &data)
        .map_err(|e| e.to_string())
}
