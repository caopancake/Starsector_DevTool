use crate::{
    errors::{AppError, AppResult},
    filesystem::{delete_json_by_id, read_utf8_no_bom, save_json_by_id, write_utf8_no_bom},
    models::specs::{validate_ship_spec, validate_weapon_spec},
    models::{
        csv_path_for, AddCsvRowPayload, AddShipRowPayload, AddWeaponRowPayload, SaveCsvPayload,
    },
    parsers::{append_csv_row, delete_csv_id, save_csv_file},
};
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
    let mod_root = Path::new(&payload.mod_root);
    let csv_target = mod_root
        .join(csv_path_for("ships").ok_or_else(|| AppError::message("unknown table: ships"))?);
    append_csv_row(&csv_target, &payload.header, &payload.row)?;

    let id = payload
        .ship
        .get("hullId")
        .and_then(|value| value.as_str())
        .or_else(|| payload.row.get("id").and_then(|value| value.as_str()))
        .ok_or_else(|| AppError::message("missing ship id"))?;

    if let Err(error) = validate_ship_spec(&payload.ship) {
        delete_csv_id(&csv_target, id)?;
        return Err(error);
    }

    if let Err(error) = save_json_by_id(mod_root, "data/hulls", "ship", "hullId", id, &payload.ship)
    {
        delete_csv_id(&csv_target, id)?;
        return Err(error);
    }

    Ok(())
}

pub fn delete_ship_row(mod_root: &str, id: &str) -> AppResult<()> {
    let mod_root_path = Path::new(mod_root);
    let csv_target = mod_root_path
        .join(csv_path_for("ships").ok_or_else(|| AppError::message("unknown table: ships"))?);
    let before = read_utf8_no_bom(&csv_target)?;
    delete_csv_id(&csv_target, id)?;

    match delete_json_by_id(mod_root_path, "data/hulls", "ship", "hullId", id) {
        Ok(true) => Ok(()),
        Ok(false) => Ok(()),
        Err(error) => {
            write_utf8_no_bom(&csv_target, &before)?;
            Err(error)
        }
    }
}

pub fn add_weapon_row(payload: AddWeaponRowPayload) -> AppResult<()> {
    let mod_root = Path::new(&payload.mod_root);
    let csv_target = mod_root
        .join(csv_path_for("weapons").ok_or_else(|| AppError::message("unknown table: weapons"))?);
    append_csv_row(&csv_target, &payload.header, &payload.row)?;

    let id = payload
        .weapon
        .get("id")
        .and_then(|value| value.as_str())
        .or_else(|| payload.row.get("id").and_then(|value| value.as_str()))
        .ok_or_else(|| AppError::message("missing weapon id"))?;

    if let Err(error) = validate_weapon_spec(&payload.weapon) {
        delete_csv_id(&csv_target, id)?;
        return Err(error);
    }

    if let Err(error) = save_json_by_id(mod_root, "data/weapons", "wpn", "id", id, &payload.weapon)
    {
        delete_csv_id(&csv_target, id)?;
        return Err(error);
    }

    Ok(())
}

pub fn delete_weapon_row(mod_root: &str, id: &str) -> AppResult<()> {
    let mod_root_path = Path::new(mod_root);
    let csv_target = mod_root_path
        .join(csv_path_for("weapons").ok_or_else(|| AppError::message("unknown table: weapons"))?);
    let before = read_utf8_no_bom(&csv_target)?;
    delete_csv_id(&csv_target, id)?;

    match delete_json_by_id(mod_root_path, "data/weapons", "wpn", "id", id) {
        Ok(true) => Ok(()),
        Ok(false) => Ok(()),
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
