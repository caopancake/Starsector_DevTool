use crate::{
    errors::{AppError, AppResult},
    io::read_csv_data,
    models::CsvTable,
};
use serde_json::Value;
use std::path::Path;

use super::super::{
    factions,
    model::{ProjectSession, SessionCsvRow, SessionCsvTable},
};
use super::core::load_core_csv_table;

pub(crate) fn session_table<'a>(
    session: &'a ProjectSession,
    table: &str,
) -> AppResult<&'a SessionCsvTable> {
    session
        .csv_tables
        .get(table)
        .ok_or_else(|| AppError::message(format!("unknown table: {table}")))
}

pub(crate) fn session_table_mut<'a>(
    session: &'a mut ProjectSession,
    table: &str,
) -> AppResult<&'a mut SessionCsvTable> {
    session
        .csv_tables
        .get_mut(table)
        .ok_or_else(|| AppError::message(format!("unknown table: {table}")))
}

pub(crate) fn ensure_session_table_rows(
    session: &mut ProjectSession,
    table: &str,
) -> AppResult<()> {
    let needs_load = session
        .csv_tables
        .get(table)
        .map(|csv| csv.rows.is_none())
        .unwrap_or(false);
    if !needs_load {
        return Ok(());
    }
    let rel_path = session_table(session, table)?.path.clone();
    let path = Path::new(&session.manifest.mod_root).join(&rel_path);
    let mut csv = if path.exists() {
        read_csv_data(&path)?
    } else {
        CsvTable {
            header: if table == "missions" {
                vec!["mission".to_string()]
            } else {
                Vec::new()
            },
            rows: Vec::new(),
            path: rel_path.clone(),
        }
    };
    if csv.header.is_empty() {
        if let Some(root) = session.manifest.starsector_root.as_ref() {
            if let Some(core_table) = load_core_csv_table(root, table)? {
                csv.header = core_table.header.clone();
            }
        }
    }
    for row in &mut csv.rows {
        let id = row
            .get("id")
            .and_then(Value::as_str)
            .unwrap_or_default()
            .to_string();
        let tags = row
            .get("tags")
            .and_then(Value::as_str)
            .unwrap_or_default()
            .to_string();
        row.insert(
            "_faction".to_string(),
            Value::String(factions::detect_faction(&id, &tags, &session.tag_map)),
        );
    }
    let rows = csv
        .rows
        .into_iter()
        .enumerate()
        .map(|(index, row)| SessionCsvRow {
            row_key: format!("{table}:row:{index}"),
            row,
        })
        .collect();
    let table_state = session_table_mut(session, table)?;
    if table_state.header.is_empty() {
        table_state.header = csv.header;
    }
    table_state.rows = Some(rows);
    Ok(())
}
