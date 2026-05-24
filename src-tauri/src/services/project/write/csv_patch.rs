use super::super::cache::{
    ensure_session_table_rows, session_for_mut, session_table, session_table_mut, sessions,
};
use super::super::model::{SessionCsvRow, WriteResult};
use crate::{
    errors::{AppError, AppResult},
    io::FileChangeSetBuilder,
    models::{
        CsvRowKeyMapping, CsvRowPatchPayload, SaveCsvPatchResult, SaveCsvPatchWithHistoryPayload,
    },
    parsers::render_csv_text,
};
use serde_json::{Map, Value};
use std::path::Path;

pub fn save_csv_patch_for_command(
    payload: SaveCsvPatchWithHistoryPayload,
) -> AppResult<SaveCsvPatchResult> {
    let mut guard = sessions()
        .lock()
        .map_err(|_| AppError::message("project session lock poisoned"))?;
    let session = session_for_mut(&mut guard, &payload.session_id)?;
    ensure_session_table_rows(session, &payload.table)?;
    let (mod_root, rel_path, header, mut rows) = {
        let table = session_table(session, &payload.table)?;
        (
            session.manifest.mod_root.clone(),
            table.path.clone(),
            table.header.clone(),
            table.rows.clone().unwrap_or_default(),
        )
    };
    let key_map = apply_csv_row_patches(&payload.table, &mut rows, payload.patches)?;
    let row_values: Vec<Map<String, Value>> = rows.iter().map(|row| row.row.clone()).collect();
    let csv_text = render_csv_text(&header, &row_values)?;
    let mut builder = FileChangeSetBuilder::new(Path::new(&mod_root));
    builder.text_file(&rel_path, Some(csv_text))?;
    for file in payload.associated_files {
        builder.file(&file.rel_path, file.after_text, file.after_data_base64)?;
    }
    let changes = builder.apply()?;
    {
        let table = session_table_mut(session, &payload.table)?;
        table.rows = Some(rows);
        table.header = header;
    }
    let write_result: WriteResult<()> = WriteResult {
        changes,
        invalidated_paths: vec![rel_path],
        key_map,
        refreshed_entity: None,
        warnings: Vec::new(),
    };
    debug_assert!(write_result
        .invalidated_paths()
        .iter()
        .all(|path| !path.is_empty()));
    debug_assert!(write_result.refreshed_entity().is_none());
    debug_assert!(write_result.warnings().is_empty());
    Ok(SaveCsvPatchResult {
        changes: write_result.changes,
        key_map: write_result.key_map,
    })
}

fn apply_csv_row_patches(
    table: &str,
    rows: &mut Vec<SessionCsvRow>,
    patches: Vec<CsvRowPatchPayload>,
) -> AppResult<Vec<CsvRowKeyMapping>> {
    let mut key_map = Vec::new();
    for patch in patches {
        match patch.action.as_str() {
            "delete" => rows.retain(|row| row.row_key != patch.row_key),
            "upsert" => {
                if let Some(row) = rows.iter_mut().find(|row| row.row_key == patch.row_key) {
                    row.row = patch.row;
                } else {
                    let next_key = if patch.row_key.contains(":new:") {
                        format!("{table}:row:{}", rows.len())
                    } else {
                        patch.row_key.clone()
                    };
                    key_map.push(CsvRowKeyMapping {
                        previous_key: patch.row_key,
                        next_key: next_key.clone(),
                    });
                    rows.push(SessionCsvRow {
                        row_key: next_key,
                        row: patch.row,
                    });
                }
            }
            other => {
                return Err(AppError::message(format!(
                    "unknown CSV row patch action: {other}"
                )));
            }
        }
    }
    Ok(key_map)
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::{
        io::{read_utf8_no_bom, write_utf8_no_bom},
        models::{AssociatedFileChangePayload, CsvRowPatchPayload, CsvTableWindowPayload},
        services::project::{
            query::query_csv_table_window_for_command,
            session::{close_project_session_for_command, open_project_session_traced},
        },
    };
    use serde_json::{Map, Value};
    use std::time::{SystemTime, UNIX_EPOCH};

    #[test]
    fn save_csv_patch_creates_associated_file_in_one_changeset() {
        let root = temp_dir("save_csv_patch_create_assoc");
        std::fs::create_dir_all(root.join("data/hulls")).unwrap();
        write_utf8_no_bom(&root.join("data/hulls/ship_data.csv"), "id,name\r\n").unwrap();

        let mut trace =
            crate::services::project::performance::PerformanceTrace::new("project.openSession");
        let manifest = open_project_session_traced(&root, None, &mut trace).unwrap();
        let mut row = Map::new();
        row.insert("id".to_string(), Value::String("new_ship".to_string()));
        row.insert("name".to_string(), Value::String("New Ship".to_string()));
        let session_id = manifest.session_id.clone();
        let result = save_csv_patch_for_command(SaveCsvPatchWithHistoryPayload {
            session_id: session_id.clone(),
            table: "ships".to_string(),
            patches: vec![CsvRowPatchPayload {
                row_key: "ships:new:1".to_string(),
                action: "upsert".to_string(),
                row,
            }],
            associated_files: vec![AssociatedFileChangePayload {
                rel_path: "data/hulls/new_ship.ship".to_string(),
                after_text: Some("{\r\n  \"hullId\": \"new_ship\"\r\n}".to_string()),
                after_data_base64: None,
            }],
        })
        .unwrap();

        let csv = read_utf8_no_bom(&root.join("data/hulls/ship_data.csv")).unwrap();
        let spec = read_utf8_no_bom(&root.join("data/hulls/new_ship.ship")).unwrap();

        let _ = close_project_session_for_command(session_id);
        let _ = std::fs::remove_dir_all(root);
        assert_eq!(result.changes.len(), 2);
        assert_eq!(result.key_map[0].previous_key, "ships:new:1");
        assert!(csv.contains("new_ship,New Ship"));
        assert!(spec.contains("\"hullId\": \"new_ship\""));
    }

    #[test]
    fn save_csv_patch_deletes_associated_file_in_one_changeset() {
        let root = temp_dir("save_csv_patch_delete_assoc");
        std::fs::create_dir_all(root.join("data/weapons")).unwrap();
        write_utf8_no_bom(
            &root.join("data/weapons/weapon_data.csv"),
            "id,name\r\nold_weapon,Old Weapon\r\n",
        )
        .unwrap();
        write_utf8_no_bom(
            &root.join("data/weapons/old_weapon.wpn"),
            "{\r\n  \"id\": \"old_weapon\"\r\n}",
        )
        .unwrap();

        let mut trace =
            crate::services::project::performance::PerformanceTrace::new("project.openSession");
        let manifest = open_project_session_traced(&root, None, &mut trace).unwrap();
        let window = query_csv_table_window_for_command(CsvTableWindowPayload {
            session_id: manifest.session_id.clone(),
            table: "weapons".to_string(),
            start: 0,
            count: 10,
            search: None,
            faction: None,
        })
        .unwrap();
        let result = save_csv_patch_for_command(SaveCsvPatchWithHistoryPayload {
            session_id: manifest.session_id.clone(),
            table: "weapons".to_string(),
            patches: vec![CsvRowPatchPayload {
                row_key: window.rows[0].row_key.clone(),
                action: "delete".to_string(),
                row: Map::new(),
            }],
            associated_files: vec![AssociatedFileChangePayload {
                rel_path: "data/weapons/old_weapon.wpn".to_string(),
                after_text: None,
                after_data_base64: None,
            }],
        })
        .unwrap();

        let csv = read_utf8_no_bom(&root.join("data/weapons/weapon_data.csv")).unwrap();
        let spec_exists = root.join("data/weapons/old_weapon.wpn").exists();

        let _ = close_project_session_for_command(manifest.session_id);
        let _ = std::fs::remove_dir_all(root);
        assert_eq!(result.changes.len(), 2);
        assert!(!csv.contains("old_weapon,Old Weapon"));
        assert!(!spec_exists);
    }

    fn temp_dir(name: &str) -> std::path::PathBuf {
        let stamp = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap()
            .as_nanos();
        let path = std::env::temp_dir().join(format!("{stamp}_{name}"));
        std::fs::create_dir_all(&path).unwrap();
        path
    }
}
