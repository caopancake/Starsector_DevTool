use crate::{
    errors::{AppError, AppResult},
    filesystem::{delete_json_by_id, read_utf8_no_bom, save_json_by_id, write_utf8_no_bom},
    models::specs::{validate_ship_spec, validate_weapon_spec},
    models::{
        csv_path_for, AddCsvRowPayload, AddShipRowPayload, AddWeaponRowPayload, SaveCsvPayload,
    },
    parsers::{append_csv_row, delete_csv_id, save_csv_file},
};
use serde_json::{Map, Value};
use std::path::Path;

pub fn save_csv(payload: SaveCsvPayload) -> AppResult<String> {
    let rel = csv_path_for(&payload.table)
        .ok_or_else(|| AppError::message(format!("unknown table: {}", payload.table)))?;
    let target = Path::new(&payload.mod_root).join(rel);
    save_csv_file(&target, &payload.header, &payload.rows)?;
    Ok(rel.to_string())
}

pub fn add_csv_row(payload: AddCsvRowPayload) -> AppResult<()> {
    let rel = csv_path_for(&payload.table)
        .ok_or_else(|| AppError::message(format!("unknown table: {}", payload.table)))?;
    let target = Path::new(&payload.mod_root).join(rel);
    append_csv_row(&target, &payload.header, &payload.row)
}

pub fn delete_csv_row(mod_root: &str, table: &str, id: &str) -> AppResult<()> {
    let rel =
        csv_path_for(table).ok_or_else(|| AppError::message(format!("unknown table: {table}")))?;
    let target = Path::new(mod_root).join(rel);
    delete_csv_id(&target, id)
}

pub fn add_ship_row(payload: AddShipRowPayload) -> AppResult<()> {
    add_row_with_spec(
        Path::new(&payload.mod_root),
        "ships",
        &payload.header,
        &payload.row,
        &payload.ship,
        "hullId",
        "data/hulls",
        "ship",
        |spec| validate_ship_spec(spec).map(|_| ()),
    )
}

pub fn delete_ship_row(mod_root: &str, id: &str) -> AppResult<()> {
    delete_row_with_spec(mod_root, "ships", id, "data/hulls", "ship", "hullId")
}

pub fn add_weapon_row(payload: AddWeaponRowPayload) -> AppResult<()> {
    add_row_with_spec(
        Path::new(&payload.mod_root),
        "weapons",
        &payload.header,
        &payload.row,
        &payload.weapon,
        "id",
        "data/weapons",
        "wpn",
        |spec| validate_weapon_spec(spec).map(|_| ()),
    )
}

pub fn delete_weapon_row(mod_root: &str, id: &str) -> AppResult<()> {
    delete_row_with_spec(mod_root, "weapons", id, "data/weapons", "wpn", "id")
}

/// Append CSV row, validate spec, save JSON; rollback CSV on failure.
#[allow(clippy::too_many_arguments)]
fn add_row_with_spec(
    mod_root: &Path,
    table: &str,
    header: &[String],
    row: &Map<String, Value>,
    spec: &Value,
    id_field: &str,
    dir: &str,
    ext: &str,
    validate: fn(&Value) -> AppResult<()>,
) -> AppResult<()> {
    let csv_target = mod_root.join(
        csv_path_for(table).ok_or_else(|| AppError::message(format!("unknown table: {table}")))?,
    );
    append_csv_row(&csv_target, header, row)?;

    let id = spec
        .get(id_field)
        .and_then(|v| v.as_str())
        .or_else(|| row.get("id").and_then(|v| v.as_str()))
        .ok_or_else(|| AppError::message(format!("missing {id_field}")))?;

    if let Err(error) = validate(spec) {
        delete_csv_id(&csv_target, id)?;
        return Err(error);
    }

    if let Err(error) = save_json_by_id(mod_root, dir, ext, id_field, id, spec) {
        delete_csv_id(&csv_target, id)?;
        return Err(error);
    }

    Ok(())
}

/// Backup CSV, delete CSV row, delete JSON; restore CSV on failure.
fn delete_row_with_spec(
    mod_root: &str,
    table: &str,
    id: &str,
    dir: &str,
    ext: &str,
    id_field: &str,
) -> AppResult<()> {
    let mod_root_path = Path::new(mod_root);
    let csv_target = mod_root_path.join(
        csv_path_for(table).ok_or_else(|| AppError::message(format!("unknown table: {table}")))?,
    );
    let before = read_utf8_no_bom(&csv_target)?;
    delete_csv_id(&csv_target, id)?;

    match delete_json_by_id(mod_root_path, dir, ext, id_field, id) {
        Ok(_) => Ok(()),
        Err(error) => {
            write_utf8_no_bom(&csv_target, &before)?;
            Err(error)
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::{Map, Value};
    use std::{
        fs,
        path::PathBuf,
        time::{SystemTime, UNIX_EPOCH},
    };

    #[test]
    fn add_ship_row_rolls_back_csv_when_ship_spec_is_invalid() {
        let root = temp_dir("add_ship_row_rollback");
        let header = vec!["id".to_string(), "name".to_string()];
        let mut row = Map::new();
        row.insert("id".to_string(), Value::String("bad_ship".to_string()));
        row.insert("name".to_string(), Value::String("Bad Ship".to_string()));
        let payload = AddShipRowPayload {
            mod_root: root.to_string_lossy().to_string(),
            header,
            row,
            ship: serde_json::json!({"hullName": "missing hullId"}),
        };

        let result = add_ship_row(payload);
        let csv = read_utf8_no_bom(&root.join("data/hulls/ship_data.csv")).unwrap();

        let _ = fs::remove_dir_all(root);
        assert!(result.is_err());
        assert!(!csv.contains("bad_ship"));
    }

    #[test]
    fn delete_ship_row_keeps_csv_deleted_when_ship_spec_is_missing() {
        let root = temp_dir("delete_ship_row_missing_spec");
        fs::create_dir_all(root.join("data/hulls")).unwrap();
        write_utf8_no_bom(
            &root.join("data/hulls/ship_data.csv"),
            "id,name\r\nmissing_ship,Missing\r\n",
        )
        .unwrap();

        let result = delete_ship_row(&root.to_string_lossy(), "missing_ship");
        let csv = read_utf8_no_bom(&root.join("data/hulls/ship_data.csv")).unwrap();

        let _ = fs::remove_dir_all(root);
        assert!(result.is_ok());
        assert!(!csv.contains("missing_ship,Missing"));
    }

    #[test]
    fn add_weapon_row_rolls_back_csv_when_weapon_spec_is_invalid() {
        let root = temp_dir("add_weapon_row_rollback");
        let header = vec!["id".to_string(), "name".to_string()];
        let mut row = Map::new();
        row.insert("id".to_string(), Value::String("bad_weapon".to_string()));
        row.insert("name".to_string(), Value::String("Bad Weapon".to_string()));
        let payload = AddWeaponRowPayload {
            mod_root: root.to_string_lossy().to_string(),
            header,
            row,
            weapon: serde_json::json!({"size": "SMALL"}),
        };

        let result = add_weapon_row(payload);
        let csv = read_utf8_no_bom(&root.join("data/weapons/weapon_data.csv")).unwrap();

        let _ = fs::remove_dir_all(root);
        assert!(result.is_err());
        assert!(!csv.contains("bad_weapon"));
    }

    #[test]
    fn delete_weapon_row_keeps_csv_deleted_when_weapon_spec_is_missing() {
        let root = temp_dir("delete_weapon_row_missing_spec");
        fs::create_dir_all(root.join("data/weapons")).unwrap();
        write_utf8_no_bom(
            &root.join("data/weapons/weapon_data.csv"),
            "id,name\r\nmissing_weapon,Missing\r\n",
        )
        .unwrap();

        let result = delete_weapon_row(&root.to_string_lossy(), "missing_weapon");
        let csv = read_utf8_no_bom(&root.join("data/weapons/weapon_data.csv")).unwrap();

        let _ = fs::remove_dir_all(root);
        assert!(result.is_ok());
        assert!(!csv.contains("missing_weapon,Missing"));
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
