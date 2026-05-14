use crate::errors::AppResult;
use base64::{engine::general_purpose, Engine as _};
use serde_json::{Map, Value};
use std::{collections::BTreeMap, fs, path::Path};

pub(super) fn load_ship_sprite_data(
    mod_root: &Path,
    ship_files: &BTreeMap<String, Value>,
) -> AppResult<BTreeMap<String, String>> {
    let mut sprites = BTreeMap::new();
    for (id, value) in ship_files {
        if let Some(sprite) = value.get("spriteName").and_then(Value::as_str) {
            if let Some(data_url) = load_sprite_data_url(mod_root, sprite)? {
                sprites.insert(id.clone(), data_url);
            }
        }
    }
    Ok(sprites)
}

pub(super) fn load_weapon_sprite_data(
    mod_root: &Path,
    wpn_files: &BTreeMap<String, Value>,
) -> BTreeMap<String, String> {
    let mut sprites = BTreeMap::new();
    for (id, value) in wpn_files {
        let sprite_path = value
            .get("turretSprite")
            .or_else(|| value.get("hardpointSprite"))
            .or_else(|| value.get("turretGunSprite"))
            .or_else(|| value.get("hardpointGunSprite"))
            .and_then(Value::as_str);
        if let Some(sprite) = sprite_path {
            if let Ok(Some(data_url)) = load_sprite_data_url(mod_root, sprite) {
                sprites.insert(id.clone(), data_url);
            }
        }
    }
    sprites
}

pub(super) fn load_hullmod_sprite_data(
    mod_root: &Path,
    hullmods: &[Map<String, Value>],
) -> BTreeMap<String, String> {
    load_table_sprite_data(mod_root, hullmods, "sprite")
}

pub(super) fn load_industry_sprite_data(
    mod_root: &Path,
    industries: &[Map<String, Value>],
) -> BTreeMap<String, String> {
    load_table_sprite_data(mod_root, industries, "image")
}

fn load_table_sprite_data(
    mod_root: &Path,
    rows: &[Map<String, Value>],
    sprite_field: &str,
) -> BTreeMap<String, String> {
    let mut sprites = BTreeMap::new();
    for row in rows {
        let id = str_field(row, "id");
        let sprite = str_field(row, sprite_field);
        if !id.is_empty() && !sprite.is_empty() {
            if let Ok(Some(data_url)) = load_sprite_data_url(mod_root, &sprite) {
                sprites.insert(id, data_url);
            }
        }
    }
    sprites
}

fn load_sprite_data_url(mod_root: &Path, sprite: &str) -> AppResult<Option<String>> {
    let path = mod_root.join(sprite.replace('\\', "/"));
    if !path.exists() {
        return Ok(None);
    }
    let bytes = fs::read(path)?;
    Ok(Some(format!(
        "data:image/png;base64,{}",
        general_purpose::STANDARD.encode(bytes)
    )))
}

fn str_field(row: &Map<String, Value>, key: &str) -> String {
    row.get(key)
        .and_then(Value::as_str)
        .unwrap_or_default()
        .to_string()
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::{
        fs,
        path::PathBuf,
        time::{SystemTime, UNIX_EPOCH},
    };

    #[test]
    fn missing_sprite_does_not_create_entry() {
        let root = temp_dir("missing_sprite");
        let mut ships = BTreeMap::new();
        ships.insert(
            "demo".to_string(),
            serde_json::json!({"hullId":"demo","spriteName":"graphics/ships/missing.png"}),
        );

        let loaded = load_ship_sprite_data(&root, &ships).unwrap();

        let _ = fs::remove_dir_all(root);
        assert!(loaded.is_empty());
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
