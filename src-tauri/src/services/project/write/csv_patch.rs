use super::super::cache::{
    ensure_registered_session_table_rows, loaded_registered_csv_rows, registered_session_table,
    registered_session_table_mut, session_for_mut, sessions,
};
use super::super::model::SessionCsvRow;
use crate::{
    errors::{AppError, AppResult},
    io::{read_json_file, strip_internal_fields, FileChangeSetBuilder},
    models::{
        AssociatedFileChange, CsvRowKeyMapping, CsvRowPatch, CsvRowPatchAction, CsvTableKey,
        WriteResult,
    },
    parsers::render_csv_text,
};
use serde_json::{Map, Value};
use std::path::Path;

pub fn save_csv_patch(
    session_id: &str,
    table: CsvTableKey,
    patches: Vec<CsvRowPatch>,
    associated_files: Vec<AssociatedFileChange>,
) -> AppResult<WriteResult> {
    let mut guard = sessions()
        .lock()
        .map_err(|_| AppError::message("project session lock poisoned"))?;
    let session = session_for_mut(&mut guard, session_id)?;
    ensure_registered_session_table_rows(session, table)?;
    let (mod_root, rel_path, header, mut rows) = {
        let table_data = registered_session_table(session, table)?;
        (
            session.manifest.mod_root.clone(),
            table_data.path.clone(),
            table_data.header.clone(),
            loaded_registered_csv_rows(session, table)?.to_vec(),
        )
    };
    let key_map = apply_csv_row_patches(table, &mut rows, patches)?;
    let row_values: Vec<Map<String, Value>> = rows.iter().map(|row| row.row.clone()).collect();
    let csv_text = render_csv_text(&header, &row_values)?;
    let associated_rel_paths: Vec<String> = associated_files
        .iter()
        .flat_map(|f| {
            let mut paths = vec![f.rel_path.clone()];
            if let Some(prev) = &f.previous_rel_path {
                paths.push(prev.clone());
            }
            paths
        })
        .collect();
    let mut builder = FileChangeSetBuilder::new(Path::new(&mod_root));
    builder.text_file(&rel_path, Some(csv_text))?;
    for file in &associated_files {
        if let Some(prev_path) = &file.previous_rel_path {
            let prev_full = Path::new(&mod_root).join(prev_path);
            let content = if prev_full.exists() {
                let new_id = associated_spec_id_from_path(&file.rel_path)?;
                rewrite_associated_spec_id(table, &prev_full, new_id)?
            } else {
                required_associated_file_text(file, "关联 spec 重命名缺少新建内容")?
            };
            builder.text_file(prev_path, None)?;
            builder.text_file(&file.rel_path, Some(content))?;
        } else {
            builder.file(
                &file.rel_path,
                file.after_text.clone(),
                file.after_data_base64.clone(),
            )?;
        }
    }
    let changes = builder.apply()?;
    {
        let table_data = registered_session_table_mut(session, table)?;
        table_data.rows = Some(rows);
        table_data.header = header;
    }
    let mut invalidated_paths = vec![rel_path];
    invalidated_paths.extend(associated_rel_paths);
    let write_result: WriteResult<()> = WriteResult {
        changes,
        invalidated_paths,
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
    Ok(write_result)
}

fn apply_csv_row_patches(
    table: CsvTableKey,
    rows: &mut Vec<SessionCsvRow>,
    patches: Vec<CsvRowPatch>,
) -> AppResult<Vec<CsvRowKeyMapping>> {
    let table_key = table.as_str();
    let mut key_map = Vec::new();
    for patch in patches {
        match patch.action {
            CsvRowPatchAction::Delete => rows.retain(|row| row.row_key != patch.row_key),
            CsvRowPatchAction::Upsert => {
                if let Some(row) = rows.iter_mut().find(|row| row.row_key == patch.row_key) {
                    row.row = patch.row;
                } else if is_new_csv_row_key(table_key, &patch.row_key) {
                    let next_key = format!("{table_key}:row:{}", rows.len());
                    key_map.push(CsvRowKeyMapping {
                        previous_key: patch.row_key,
                        next_key: next_key.clone(),
                    });
                    rows.push(SessionCsvRow {
                        row_key: next_key,
                        row: patch.row,
                    });
                } else {
                    return Err(AppError::message(format!(
                        "CSV upsert row key does not exist: {}",
                        patch.row_key
                    )));
                }
            }
        }
    }
    Ok(key_map)
}

fn is_new_csv_row_key(table_key: &str, row_key: &str) -> bool {
    let Some(rest) = row_key.strip_prefix(&format!("{table_key}:new:")) else {
        return false;
    };
    !rest.is_empty() && !rest.contains(':')
}

fn associated_spec_id_from_path(rel_path: &str) -> AppResult<&str> {
    Path::new(rel_path)
        .file_stem()
        .and_then(|stem| stem.to_str())
        .filter(|stem| !stem.trim().is_empty())
        .ok_or_else(|| AppError::message(format!("关联 spec 路径缺少文件名: {rel_path}")))
}

fn required_associated_file_text(file: &AssociatedFileChange, message: &str) -> AppResult<String> {
    file.after_text
        .clone()
        .ok_or_else(|| AppError::message(format!("{message}: {}", file.rel_path)))
}

fn rewrite_associated_spec_id(table: CsvTableKey, path: &Path, new_id: &str) -> AppResult<String> {
    let mut value = strip_internal_fields(&read_json_file(path)?);
    let Some(object) = value.as_object_mut() else {
        return Err(AppError::message(format!(
            "关联 spec 文件不是 JSON object: {}",
            path.display()
        )));
    };
    object.insert(
        associated_spec_id_field(table)?.to_string(),
        Value::String(new_id.to_string()),
    );
    serde_json::to_string_pretty(&value).map_err(AppError::from)
}

fn associated_spec_id_field(table: CsvTableKey) -> AppResult<&'static str> {
    match table {
        CsvTableKey::Ships => Ok("hullId"),
        CsvTableKey::Weapons | CsvTableKey::ShipSystems | CsvTableKey::Skills => Ok("id"),
        _ => Err(AppError::message(format!(
            "CSV 表没有关联 spec ID 字段: {}",
            table.as_str()
        ))),
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::{
        io::{read_utf8_no_bom, write_utf8_no_bom},
        models::{AssociatedFileChange, CsvFactionFilter, CsvRowPatch, CsvRowPatchAction},
        services::project::{
            query::query_csv_table_window,
            session::{close_project_session, open_project_session_traced},
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
        let result = save_csv_patch(
            &session_id,
            CsvTableKey::Ships,
            vec![CsvRowPatch {
                row_key: "ships:new:1".to_string(),
                action: CsvRowPatchAction::Upsert,
                row,
            }],
            vec![AssociatedFileChange {
                rel_path: "data/hulls/new_ship.ship".to_string(),
                after_text: Some("{\r\n  \"hullId\": \"new_ship\"\r\n}".to_string()),
                after_data_base64: None,
                previous_rel_path: None,
            }],
        )
        .unwrap();

        let csv = read_utf8_no_bom(&root.join("data/hulls/ship_data.csv")).unwrap();
        let spec = read_utf8_no_bom(&root.join("data/hulls/new_ship.ship")).unwrap();

        let _ = close_project_session(session_id);
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
        let window = query_csv_table_window(
            &manifest.session_id,
            CsvTableKey::Weapons,
            0,
            10,
            None,
            CsvFactionFilter::All,
        )
        .unwrap();
        let result = save_csv_patch(
            &manifest.session_id,
            CsvTableKey::Weapons,
            vec![CsvRowPatch {
                row_key: window.rows[0].row_key.clone(),
                action: CsvRowPatchAction::Delete,
                row: Map::new(),
            }],
            vec![AssociatedFileChange {
                rel_path: "data/weapons/old_weapon.wpn".to_string(),
                after_text: None,
                after_data_base64: None,
                previous_rel_path: None,
            }],
        )
        .unwrap();

        let csv = read_utf8_no_bom(&root.join("data/weapons/weapon_data.csv")).unwrap();
        let spec_exists = root.join("data/weapons/old_weapon.wpn").exists();

        let _ = close_project_session(manifest.session_id);
        let _ = std::fs::remove_dir_all(root);
        assert_eq!(result.changes.len(), 2);
        assert!(!csv.contains("old_weapon,Old Weapon"));
        assert!(!spec_exists);
    }

    #[test]
    fn save_csv_patch_renames_associated_file_through_json_parser() {
        let root = temp_dir("save_csv_patch_rename_assoc_parser");
        std::fs::create_dir_all(root.join("data/weapons")).unwrap();
        write_utf8_no_bom(
            &root.join("data/weapons/weapon_data.csv"),
            "id,name\r\nold_weapon,Old Weapon\r\n",
        )
        .unwrap();
        write_utf8_no_bom(
            &root.join("data/weapons/old_weapon.wpn"),
            "{\r\n  id: 'old_weapon',\r\n  weaponType: BALLISTIC,\r\n}\r\n",
        )
        .unwrap();

        let mut trace =
            crate::services::project::performance::PerformanceTrace::new("project.openSession");
        let manifest = open_project_session_traced(&root, None, &mut trace).unwrap();
        let window = query_csv_table_window(
            &manifest.session_id,
            CsvTableKey::Weapons,
            0,
            10,
            None,
            CsvFactionFilter::All,
        )
        .unwrap();
        let mut row = window.rows[0].row.clone();
        row.insert("id".to_string(), Value::String("new_weapon".to_string()));
        let result = save_csv_patch(
            &manifest.session_id,
            CsvTableKey::Weapons,
            vec![CsvRowPatch {
                row_key: window.rows[0].row_key.clone(),
                action: CsvRowPatchAction::Upsert,
                row,
            }],
            vec![AssociatedFileChange {
                rel_path: "data/weapons/new_weapon.wpn".to_string(),
                after_text: Some("{\"id\":\"new_weapon\"}".to_string()),
                after_data_base64: None,
                previous_rel_path: Some("data/weapons/old_weapon.wpn".to_string()),
            }],
        )
        .unwrap();

        let renamed = read_utf8_no_bom(&root.join("data/weapons/new_weapon.wpn")).unwrap();

        let _ = close_project_session(manifest.session_id);
        let _ = std::fs::remove_dir_all(root);
        assert_eq!(result.changes.len(), 3);
        assert!(!renamed.contains("old_weapon"));
        assert!(renamed.contains("\"id\": \"new_weapon\""));
        assert!(renamed.contains("\"weaponType\": \"BALLISTIC\""));
    }

    #[test]
    fn save_csv_patch_rejects_rename_without_source_or_new_text() {
        let root = temp_dir("save_csv_patch_rename_missing_content");
        std::fs::create_dir_all(root.join("data/weapons")).unwrap();
        write_utf8_no_bom(
            &root.join("data/weapons/weapon_data.csv"),
            "id,name\r\nold_weapon,Old Weapon\r\n",
        )
        .unwrap();

        let mut trace =
            crate::services::project::performance::PerformanceTrace::new("project.openSession");
        let manifest = open_project_session_traced(&root, None, &mut trace).unwrap();
        let window = query_csv_table_window(
            &manifest.session_id,
            CsvTableKey::Weapons,
            0,
            10,
            None,
            CsvFactionFilter::All,
        )
        .unwrap();
        let mut row = window.rows[0].row.clone();
        row.insert("id".to_string(), Value::String("new_weapon".to_string()));
        let error = save_csv_patch(
            &manifest.session_id,
            CsvTableKey::Weapons,
            vec![CsvRowPatch {
                row_key: window.rows[0].row_key.clone(),
                action: CsvRowPatchAction::Upsert,
                row,
            }],
            vec![AssociatedFileChange {
                rel_path: "data/weapons/new_weapon.wpn".to_string(),
                after_text: None,
                after_data_base64: None,
                previous_rel_path: Some("data/weapons/missing.wpn".to_string()),
            }],
        )
        .unwrap_err()
        .to_string();

        let _ = close_project_session(manifest.session_id);
        let _ = std::fs::remove_dir_all(root);
        assert!(error.contains("关联 spec 重命名缺少新建内容"));
    }

    #[test]
    fn save_csv_patch_rejects_unknown_non_new_row_key() {
        let root = temp_dir("save_csv_patch_unknown_row_key");
        std::fs::create_dir_all(root.join("data/hulls")).unwrap();
        write_utf8_no_bom(&root.join("data/hulls/ship_data.csv"), "id,name\r\n").unwrap();

        let mut trace =
            crate::services::project::performance::PerformanceTrace::new("project.openSession");
        let manifest = open_project_session_traced(&root, None, &mut trace).unwrap();
        let mut row = Map::new();
        row.insert("id".to_string(), Value::String("new_ship".to_string()));
        let error = save_csv_patch(
            &manifest.session_id,
            CsvTableKey::Ships,
            vec![CsvRowPatch {
                row_key: "ships:row:missing:new:1".to_string(),
                action: CsvRowPatchAction::Upsert,
                row,
            }],
            Vec::new(),
        )
        .unwrap_err()
        .to_string();

        let _ = close_project_session(manifest.session_id);
        let _ = std::fs::remove_dir_all(root);
        assert!(error.contains("CSV upsert row key does not exist"));
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
