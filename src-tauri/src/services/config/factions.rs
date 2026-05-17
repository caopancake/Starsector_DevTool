use crate::{
    errors::{AppError, AppResult},
    filesystem::strip_internal_fields,
    models::{AssociatedFileChangePayload, FileChangeRecord, SaveModFilesWithHistoryPayload},
    parsers::{read_csv_data, render_csv_text},
    services::file_changes::save_mod_files_with_history,
};
use serde_json::{Map, Value};
use std::path::Path;

use super::validate_config_id;

type FactionIndexTable = (Vec<String>, Vec<Map<String, Value>>);

pub fn save_faction_with_history(
    mod_root: &str,
    old_id: Option<&str>,
    id: &str,
    data: &Value,
    delete_old_file: bool,
) -> AppResult<Vec<FileChangeRecord>> {
    let id = validate_config_id(id, "无效势力 ID")?;
    let old_id = old_id
        .filter(|value| !value.trim().is_empty())
        .map(|value| validate_config_id(value, "无效势力 ID"))
        .transpose()?;
    let clean = strip_internal_fields(data);
    let faction_text = serde_json::to_string_pretty(&clean)?;
    let mut files = vec![AssociatedFileChangePayload {
        rel_path: format!("data/world/factions/{id}.faction"),
        after_text: Some(faction_text),
    }];
    files.push(faction_index_change(mod_root, |header, rows| {
        if let Some(old) = old_id {
            remove_faction_index_row(header, rows, old);
        }
        upsert_faction_index_row(header, rows, id);
    })?);
    if delete_old_file && old_id.is_some_and(|old| old != id) {
        files.push(AssociatedFileChangePayload {
            rel_path: format!("data/world/factions/{}.faction", old_id.unwrap()),
            after_text: None,
        });
    }
    save_mod_files_with_history(SaveModFilesWithHistoryPayload {
        mod_root: mod_root.to_string(),
        files,
    })
}

pub fn create_faction_with_history(
    mod_root: &str,
    id: &str,
) -> AppResult<(Value, Vec<FileChangeRecord>)> {
    let id = validate_config_id(id, "无效势力 ID")?;
    let path = Path::new(mod_root)
        .join("data/world/factions")
        .join(format!("{id}.faction"));
    if path.exists() {
        return Err(AppError::message(format!("势力文件已存在: {id}.faction")));
    }
    let default = default_faction_value(id);
    let changes = save_faction_with_history(mod_root, None, id, &default, false)?;
    Ok((default, changes))
}

pub fn delete_faction_with_history(
    mod_root: &str,
    id: &str,
    delete_file: bool,
) -> AppResult<Vec<FileChangeRecord>> {
    let id = validate_config_id(id, "无效势力 ID")?;
    let mut files = vec![faction_index_change(mod_root, |header, rows| {
        remove_faction_index_row(header, rows, id);
    })?];
    if delete_file {
        files.push(AssociatedFileChangePayload {
            rel_path: format!("data/world/factions/{id}.faction"),
            after_text: None,
        });
    }
    save_mod_files_with_history(SaveModFilesWithHistoryPayload {
        mod_root: mod_root.to_string(),
        files,
    })
}

fn faction_index_change(
    mod_root: &str,
    mutate: impl FnOnce(&[String], &mut Vec<Map<String, Value>>),
) -> AppResult<AssociatedFileChangePayload> {
    let path = faction_index_path(mod_root);
    let (header, mut rows) = read_faction_index_table(&path)?;
    mutate(&header, &mut rows);
    Ok(AssociatedFileChangePayload {
        rel_path: "data/world/factions/factions.csv".to_string(),
        after_text: Some(render_csv_text(&header, &rows)?),
    })
}

fn upsert_faction_index_row(header: &[String], rows: &mut Vec<Map<String, Value>>, id: &str) {
    let id_col = faction_id_col(header);
    let file_col = faction_file_col(header);
    if rows.iter().any(|row| faction_row_matches(row, &id_col, id)) {
        return;
    }
    let mut row = Map::new();
    for col in header {
        row.insert(col.clone(), Value::String(String::new()));
    }
    let rel_path = format!("data/world/factions/{id}.faction");
    if let Some(col) = file_col {
        row.insert(id_col, Value::String(id.to_string()));
        row.insert(col, Value::String(rel_path));
    } else if faction_id_col_is_path(&id_col) {
        row.insert(id_col, Value::String(rel_path));
    } else {
        row.insert(id_col, Value::String(id.to_string()));
    }
    rows.push(row);
}

fn remove_faction_index_row(header: &[String], rows: &mut Vec<Map<String, Value>>, id: &str) {
    let id_col = faction_id_col(header);
    rows.retain(|row| !faction_row_matches(row, &id_col, id));
}

fn faction_index_path(mod_root: &str) -> std::path::PathBuf {
    Path::new(mod_root).join("data/world/factions/factions.csv")
}

fn read_faction_index_table(path: &Path) -> AppResult<FactionIndexTable> {
    let table = read_csv_data(path)?;
    if table.header.is_empty() {
        Ok((vec!["id".to_string(), "file".to_string()], table.rows))
    } else {
        Ok((table.header, table.rows))
    }
}

fn faction_id_col(header: &[String]) -> String {
    find_header_col(header, &["id", "faction", "factionId"])
        .unwrap_or_else(|| header.first().cloned().unwrap_or_else(|| "id".to_string()))
}

fn faction_file_col(header: &[String]) -> Option<String> {
    find_header_col(header, &["file", "path", "filename", "factionFile"]).or_else(|| {
        header
            .iter()
            .find(|col| *col != &faction_id_col(header))
            .cloned()
    })
}

fn find_header_col(header: &[String], candidates: &[&str]) -> Option<String> {
    candidates.iter().find_map(|candidate| {
        header
            .iter()
            .find(|col| col.eq_ignore_ascii_case(candidate))
            .cloned()
    })
}

fn faction_row_matches(row: &Map<String, Value>, id_col: &str, id: &str) -> bool {
    let Some(value) = row.get(id_col).and_then(Value::as_str).map(str::trim) else {
        return false;
    };
    value == id || faction_id_from_index_value(value) == id
}

fn faction_id_col_is_path(id_col: &str) -> bool {
    id_col.eq_ignore_ascii_case("faction")
}

fn faction_id_from_index_value(value: &str) -> String {
    Path::new(value)
        .file_stem()
        .and_then(|stem| stem.to_str())
        .unwrap_or(value)
        .to_string()
}

fn default_faction_value(id: &str) -> Value {
    serde_json::json!({
        "id": id,
        "displayName": id,
        "displayNameLong": id,
        "color": [128, 128, 128, 255],
        "baseColor": [128, 128, 128, 255],
        "darkColor": [64, 64, 64, 255],
        "shipNamePrefix": "",
        "knownShips": {"tags": []},
        "knownWeapons": {"tags": []},
        "knownFighters": {"tags": []}
    })
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::filesystem::write_utf8_no_bom;
    use std::{
        fs,
        path::PathBuf,
        time::{SystemTime, UNIX_EPOCH},
    };

    #[test]
    fn create_faction_with_history_rejects_path_traversal() {
        let root = temp_dir("faction_id_rejects");
        fs::create_dir_all(root.join("data/world/factions")).unwrap();

        let result = create_faction_with_history(&root.to_string_lossy(), "../demo");

        assert!(result.is_err());
        let _ = fs::remove_dir_all(root);
    }

    #[test]
    fn delete_faction_can_remove_index_without_deleting_file() {
        let root = temp_dir("delete_faction_index_only");
        let dir = root.join("data/world/factions");
        fs::create_dir_all(&dir).unwrap();
        write_utf8_no_bom(
            &dir.join("factions.csv"),
            "id,file\r\ndemo,data/world/factions/demo.faction\r\n",
        )
        .unwrap();
        write_utf8_no_bom(&dir.join("demo.faction"), "{}").unwrap();

        let changes = delete_faction_with_history(&root.to_string_lossy(), "demo", false).unwrap();

        assert!(dir.join("demo.faction").exists());
        let table = read_csv_data(&dir.join("factions.csv")).unwrap();
        assert!(table.rows.is_empty());
        assert_eq!(changes.len(), 1);
        let _ = fs::remove_dir_all(root);
    }

    #[test]
    fn delete_faction_can_remove_index_and_file() {
        let root = temp_dir("delete_faction_with_file");
        let dir = root.join("data/world/factions");
        fs::create_dir_all(&dir).unwrap();
        write_utf8_no_bom(
            &dir.join("factions.csv"),
            "id,file\r\ndemo,data/world/factions/demo.faction\r\n",
        )
        .unwrap();
        write_utf8_no_bom(&dir.join("demo.faction"), "{}").unwrap();

        let changes = delete_faction_with_history(&root.to_string_lossy(), "demo", true).unwrap();

        assert!(!dir.join("demo.faction").exists());
        let table = read_csv_data(&dir.join("factions.csv")).unwrap();
        assert!(table.rows.is_empty());
        assert_eq!(changes.len(), 2);
        let _ = fs::remove_dir_all(root);
    }

    fn temp_dir(name: &str) -> PathBuf {
        let stamp = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap()
            .as_nanos();
        let path = std::env::temp_dir().join(format!("{stamp}_{name}"));
        fs::create_dir_all(&path).unwrap();
        path
    }
}
