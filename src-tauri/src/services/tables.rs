use crate::{
    errors::{AppError, AppResult},
    models::{csv_path_for, SaveCsvPayload},
    parsers::{append_csv_row, delete_csv_id, save_csv_file},
};
use std::path::Path;

pub fn save_csv(payload: SaveCsvPayload) -> AppResult<String> {
    let rel = csv_path_for(&payload.table).ok_or_else(|| AppError::message(format!("unknown table: {}", payload.table)))?;
    let target = Path::new(&payload.mod_root).join(rel);
    save_csv_file(&target, &payload.header, &payload.rows)?;
    Ok(rel.to_string())
}

pub fn add_csv_row(payload: SaveCsvPayload) -> AppResult<()> {
    let rel = csv_path_for(&payload.table).ok_or_else(|| AppError::message(format!("unknown table: {}", payload.table)))?;
    let target = Path::new(&payload.mod_root).join(rel);
    let row = payload.rows.first().cloned().unwrap_or_default();
    append_csv_row(&target, &row)
}

pub fn delete_csv_row(mod_root: &str, table: &str, id: &str) -> AppResult<()> {
    let rel = csv_path_for(table).ok_or_else(|| AppError::message(format!("unknown table: {table}")))?;
    let target = Path::new(mod_root).join(rel);
    delete_csv_id(&target, id)
}
