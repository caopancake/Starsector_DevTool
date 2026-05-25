use super::super::{
    cache::{
        ensure_registered_session_table_rows, loaded_registered_csv_rows, registered_session_table,
        session_for_mut, sessions,
    },
    model::SessionCsvRow,
};
use super::resources_shared::table_row_resource_ref;
use crate::{
    errors::{AppError, AppResult},
    models::{
        CsvFactionFilter, CsvRowPreview, CsvTableKey, CsvTableWindow, CsvWindowRow,
        CSV_FACTION_FIELD,
    },
};

pub fn query_csv_table_window(
    session_id: &str,
    table: CsvTableKey,
    start: usize,
    count: usize,
    search: Option<String>,
    faction: CsvFactionFilter,
) -> AppResult<CsvTableWindow> {
    let mut guard = sessions()
        .lock()
        .map_err(|_| AppError::message("project session lock poisoned"))?;
    let session = session_for_mut(&mut guard, session_id)?;
    ensure_registered_session_table_rows(session, table)?;
    let table_data = registered_session_table(session, table)?;
    let rows_ref = loaded_registered_csv_rows(session, table)?;
    let search = search.unwrap_or_default().trim().to_lowercase();
    let filtered: Vec<(usize, &SessionCsvRow)> = rows_ref
        .iter()
        .enumerate()
        .filter(|(_, row)| csv_row_matches(row, &search, &faction, table))
        .collect();
    let rows = filtered
        .iter()
        .skip(start)
        .take(count)
        .map(|(index, row)| CsvWindowRow {
            row_key: row.row_key.clone(),
            row_index: *index,
            row: row.row.clone(),
        })
        .collect();
    Ok(CsvTableWindow {
        table,
        header: table_data.header.clone(),
        total_rows: rows_ref.len(),
        filtered_rows: filtered.len(),
        start,
        rows,
    })
}

pub fn query_csv_row_preview(
    session_id: &str,
    table: CsvTableKey,
    row_key: &str,
) -> AppResult<CsvRowPreview> {
    let mut guard = sessions()
        .lock()
        .map_err(|_| AppError::message("project session lock poisoned"))?;
    let session = session_for_mut(&mut guard, session_id)?;
    ensure_registered_session_table_rows(session, table)?;
    let row = loaded_registered_csv_rows(session, table)?
        .iter()
        .find(|row| row.row_key == row_key);
    Ok(CsvRowPreview {
        resource_ref: row.and_then(|row| table_row_resource_ref(session, table, &row.row)),
    })
}

fn csv_row_matches(
    row: &SessionCsvRow,
    search: &str,
    faction: &CsvFactionFilter,
    table: CsvTableKey,
) -> bool {
    if let Some(faction_id) = faction.faction_id_for_table(table) {
        let row_faction = row
            .row
            .get(CSV_FACTION_FIELD)
            .and_then(serde_json::Value::as_str)
            .unwrap_or_default();
        if row_faction != faction_id {
            return false;
        }
    }
    if search.is_empty() {
        return true;
    }
    row.row
        .values()
        .filter_map(serde_json::Value::as_str)
        .any(|value| value.to_lowercase().contains(search))
}
