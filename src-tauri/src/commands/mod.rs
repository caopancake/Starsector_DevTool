use crate::{
    filesystem,
    models::{
        AppData, ApplyFileChangeSetPayload, CsvTable, EditableFileData, FactionHistoryResult,
        FactionPayload, FileChangeRecord, GameOverviewData, MissionData, MissionListCsvPayload,
        MissionPayload, OpenDirectoryResult, PersistedWorkspace, SaveCsvWithHistoryPayload,
        SaveJsonWithHistoryPayload, SaveModFilesWithHistoryPayload, SaveTextFileWithHistoryPayload,
        UploadSpritePayload, UploadSpriteResult,
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
pub fn save_csv_with_history(
    payload: SaveCsvWithHistoryPayload,
) -> Result<Vec<FileChangeRecord>, String> {
    services::save_csv_with_history(payload).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn upload_sprite(payload: UploadSpritePayload) -> Result<UploadSpriteResult, String> {
    filesystem::upload_sprite(payload).map_err(|e| e.to_string())
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
pub fn save_faction_with_history(payload: FactionPayload) -> Result<Vec<FileChangeRecord>, String> {
    let data = payload.data.ok_or_else(|| "missing data".to_string())?;
    services::save_faction_with_history(
        &payload.mod_root,
        payload.old_id.as_deref(),
        &payload.id,
        &data,
        payload.delete_file.unwrap_or(false),
    )
    .map_err(|e| e.to_string())
}

#[tauri::command]
pub fn create_faction_with_history(
    payload: FactionPayload,
) -> Result<FactionHistoryResult, String> {
    let (data, changes) = services::create_faction_with_history(&payload.mod_root, &payload.id)
        .map_err(|e| e.to_string())?;
    Ok(FactionHistoryResult {
        data: Some(data),
        changes,
    })
}

#[tauri::command]
pub fn delete_faction_with_history(
    payload: FactionPayload,
) -> Result<Vec<FileChangeRecord>, String> {
    services::delete_faction_with_history(
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
pub fn load_mission(payload: MissionPayload) -> Result<MissionData, String> {
    services::load_mission(&payload.mod_root, &payload.mission).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn save_mission_with_history(payload: MissionPayload) -> Result<Vec<FileChangeRecord>, String> {
    let descriptor = payload
        .descriptor
        .ok_or_else(|| "missing descriptor".to_string())?;
    let text = payload.text.ok_or_else(|| "missing text".to_string())?;
    let mission_list_rel_path = payload
        .mission_list_rel_path
        .ok_or_else(|| "missing mission list path".to_string())?;
    let header = payload.header.ok_or_else(|| "missing header".to_string())?;
    let rows = payload.rows.ok_or_else(|| "missing rows".to_string())?;
    services::save_mission_with_history(services::config::MissionHistorySaveInput {
        mod_root: &payload.mod_root,
        mission: &payload.mission,
        old_mission: payload.old_mission.as_deref(),
        descriptor: &descriptor,
        text: &text,
        mission_list_rel_path: &mission_list_rel_path,
        header: &header,
        rows: &rows,
        delete_old_directory: payload.delete_old_directory.unwrap_or(false),
    })
    .map_err(|e| e.to_string())
}

#[tauri::command]
pub fn delete_mission_with_history(
    payload: MissionPayload,
) -> Result<Vec<FileChangeRecord>, String> {
    let mission_list_rel_path = payload
        .mission_list_rel_path
        .ok_or_else(|| "missing mission list path".to_string())?;
    let header = payload.header.ok_or_else(|| "missing header".to_string())?;
    let rows = payload.rows.ok_or_else(|| "missing rows".to_string())?;
    services::delete_mission_with_history(
        &payload.mod_root,
        &payload.mission,
        &mission_list_rel_path,
        &header,
        &rows,
        payload.delete_old_directory.unwrap_or(false),
    )
    .map_err(|e| e.to_string())
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
pub fn save_text_file_with_history(
    payload: SaveTextFileWithHistoryPayload,
) -> Result<Vec<FileChangeRecord>, String> {
    services::save_text_file_with_history(payload).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn save_json_with_history(
    payload: SaveJsonWithHistoryPayload,
) -> Result<Vec<FileChangeRecord>, String> {
    services::save_json_with_history(payload).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn save_mod_files_with_history(
    payload: SaveModFilesWithHistoryPayload,
) -> Result<Vec<FileChangeRecord>, String> {
    services::save_mod_files_with_history(payload).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn apply_file_change_set(payload: ApplyFileChangeSetPayload) -> Result<(), String> {
    services::apply_file_change_set(payload).map_err(|e| e.to_string())
}
