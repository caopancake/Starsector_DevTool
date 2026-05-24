use super::super::{
    cache::{ensure_session_table_rows, session_for_mut, session_table, sessions},
    model::SessionCsvRow,
};
use super::resources_shared::table_row_resource_ref;
use crate::{
    errors::{AppError, AppResult},
    models::{
        CsvRowPreview, CsvRowPreviewPayload, CsvTableWindow, CsvTableWindowPayload, CsvWindowRow,
    },
};

pub fn query_csv_table_window_for_command(
    payload: CsvTableWindowPayload,
) -> AppResult<CsvTableWindow> {
    let mut guard = sessions()
        .lock()
        .map_err(|_| AppError::message("project session lock poisoned"))?;
    let session = session_for_mut(&mut guard, &payload.session_id)?;
    ensure_session_table_rows(session, &payload.table)?;
    let table = session_table(session, &payload.table)?;
    let rows_ref = table.rows.as_deref().unwrap_or(&[]);
    let search = payload.search.unwrap_or_default().trim().to_lowercase();
    let faction = payload.faction.unwrap_or_default();
    let filtered: Vec<(usize, &SessionCsvRow)> = table
        .rows
        .as_deref()
        .unwrap_or(&[])
        .iter()
        .enumerate()
        .filter(|(_, row)| csv_row_matches(row, &search, &faction, &payload.table))
        .collect();
    let rows = filtered
        .iter()
        .skip(payload.start)
        .take(payload.count)
        .map(|(index, row)| CsvWindowRow {
            row_key: row.row_key.clone(),
            row_index: *index,
            row: row.row.clone(),
        })
        .collect();
    Ok(CsvTableWindow {
        table: payload.table,
        header: table.header.clone(),
        total_rows: rows_ref.len(),
        filtered_rows: filtered.len(),
        start: payload.start,
        rows,
    })
}

pub fn query_csv_row_preview_for_command(
    payload: CsvRowPreviewPayload,
) -> AppResult<CsvRowPreview> {
    let mut guard = sessions()
        .lock()
        .map_err(|_| AppError::message("project session lock poisoned"))?;
    let session = session_for_mut(&mut guard, &payload.session_id)?;
    ensure_session_table_rows(session, &payload.table)?;
    let row = session_table(session, &payload.table)?
        .rows
        .as_deref()
        .unwrap_or(&[])
        .iter()
        .find(|row| row.row_key == payload.row_key);
    Ok(CsvRowPreview {
        resource_ref: row.and_then(|row| table_row_resource_ref(session, &payload.table, &row.row)),
    })
}

fn csv_row_matches(row: &SessionCsvRow, search: &str, faction: &str, table: &str) -> bool {
    if !faction.is_empty()
        && faction != "all"
        && (table == "ships" || table == "weapons")
        && row
            .row
            .get("_faction")
            .and_then(serde_json::Value::as_str)
            .unwrap_or_default()
            != faction
    {
        return false;
    }
    if search.is_empty() {
        return true;
    }
    row.row
        .values()
        .filter_map(serde_json::Value::as_str)
        .any(|value| value.to_lowercase().contains(search))
}
