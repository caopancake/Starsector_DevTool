use crate::{
    models::{CsvTable, FileChangeRecord, LoadCsvTablePayload, SaveCsvWithHistoryPayload},
    services,
};

#[tauri::command]
pub fn save_csv_with_history(
    payload: SaveCsvWithHistoryPayload,
) -> Result<Vec<FileChangeRecord>, String> {
    services::tables::save_csv(
        &payload.mod_root,
        &payload.table,
        &payload.header,
        &payload.rows,
        payload.associated_files,
    )
    .map_err(|e| e.to_string())
}

#[tauri::command]
pub fn load_csv_table(payload: LoadCsvTablePayload) -> Result<CsvTable, String> {
    services::project::load_csv_table_for_command(payload).map_err(|e| e.to_string())
}
