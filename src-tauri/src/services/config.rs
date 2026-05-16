use crate::{
    errors::{AppError, AppResult},
    filesystem::{strip_internal_fields, write_utf8_no_bom},
};
use serde_json::Value;
use std::{fs, path::Path};

pub fn save_mod_info(mod_root: &str, data: &Value) -> AppResult<()> {
    let path = Path::new(mod_root).join("mod_info.json");
    let clean = strip_internal_fields(data);
    let json_string = serde_json::to_string_pretty(&clean)?;
    write_utf8_no_bom(&path, &json_string)?;
    Ok(())
}

pub fn save_faction(mod_root: &str, id: &str, data: &Value) -> AppResult<()> {
    let dir = Path::new(mod_root).join("data/world/factions");
    fs::create_dir_all(&dir)?;
    let path = dir.join(format!("{id}.faction"));
    let clean = strip_internal_fields(data);
    let json_string = serde_json::to_string_pretty(&clean)?;
    write_utf8_no_bom(&path, &json_string)?;
    Ok(())
}

pub fn create_faction(mod_root: &str, id: &str) -> AppResult<Value> {
    let dir = Path::new(mod_root).join("data/world/factions");
    fs::create_dir_all(&dir)?;
    let path = dir.join(format!("{id}.faction"));
    if path.exists() {
        return Err(AppError::message(format!("势力文件已存在: {id}.faction")));
    }
    let default = serde_json::json!({
        "id": id,
        "displayName": id,
        "displayNameLong": id,
        "color": [128, 128, 128],
        "baseColor": [128, 128, 128],
        "darkColor": [64, 64, 64],
        "shipNamePrefix": "",
        "knownShips": {"tags": []},
        "knownWeapons": {"tags": []},
        "knownFighters": {"tags": []}
    });
    let json_string = serde_json::to_string_pretty(&default)?;
    write_utf8_no_bom(&path, &json_string)?;
    Ok(default)
}

pub fn delete_faction(mod_root: &str, id: &str) -> AppResult<()> {
    let path = Path::new(mod_root)
        .join("data/world/factions")
        .join(format!("{id}.faction"));
    if path.exists() {
        fs::remove_file(&path)?;
    }
    Ok(())
}
