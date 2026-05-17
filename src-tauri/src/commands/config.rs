use crate::{
    models::{
        CsvTable, FactionHistoryResult, FactionPayload, FileChangeRecord, MissionData,
        MissionListCsvPayload, MissionPayload,
    },
    services,
};

#[tauri::command]
pub fn save_faction_with_history(payload: FactionPayload) -> Result<Vec<FileChangeRecord>, String> {
    let data = payload.data.ok_or_else(|| "missing data".to_string())?;
    services::config::save_faction_with_history(
        &payload.mod_root,
        payload.previous_id.as_deref(),
        &payload.id,
        &data,
        payload
            .delete_previous_file
            .or(payload.delete_file)
            .unwrap_or(false),
    )
    .map_err(|e| e.to_string())
}

#[tauri::command]
pub fn create_faction_with_history(
    payload: FactionPayload,
) -> Result<FactionHistoryResult, String> {
    let (data, changes) =
        services::config::create_faction_with_history(&payload.mod_root, &payload.id)
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
    services::config::delete_faction_with_history(
        &payload.mod_root,
        &payload.id,
        payload.delete_file.unwrap_or(false),
    )
    .map_err(|e| e.to_string())
}

#[tauri::command]
pub fn scan_mission_list(mod_root: String) -> Vec<String> {
    services::config::scan_mission_list_files(&mod_root)
}

#[tauri::command]
pub fn load_mission_list_csv(payload: MissionListCsvPayload) -> Result<CsvTable, String> {
    services::config::load_mission_list_csv(&payload.mod_root, &payload.rel_path)
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub fn load_mission(payload: MissionPayload) -> Result<MissionData, String> {
    services::config::load_mission(&payload.mod_root, &payload.mission).map_err(|e| e.to_string())
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
    services::config::save_mission_with_history(services::config::MissionHistorySaveInput {
        mod_root: &payload.mod_root,
        mission: &payload.mission,
        previous_mission_id: payload.previous_mission_id.as_deref(),
        descriptor: &descriptor,
        text: &text,
        mission_list_rel_path: &mission_list_rel_path,
        header: &header,
        rows: &rows,
        delete_previous_directory: payload.delete_previous_directory.unwrap_or(false),
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
    services::config::delete_mission_with_history(
        &payload.mod_root,
        &payload.mission,
        &mission_list_rel_path,
        &header,
        &rows,
        payload.delete_mission_directory.unwrap_or(false),
    )
    .map_err(|e| e.to_string())
}
