use crate::{
    filesystem,
    models::{
        AddCsvRowPayload, AddShipRowPayload, AddWeaponRowPayload, AppData, DeletePayload,
        SaveCsvPayload, SaveJsonPayload, UploadSpritePayload, UploadSpriteResult,
    },
    services,
};
use std::path::Path;

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
