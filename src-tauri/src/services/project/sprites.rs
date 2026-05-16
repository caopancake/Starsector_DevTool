use crate::errors::AppResult;
use base64::{engine::general_purpose, Engine as _};
use serde_json::{Map, Value};
use std::{collections::BTreeMap, fs, path::Path};

pub(super) fn load_ship_sprite_data(
    mod_root: &Path,
    core_dir: Option<&Path>,
    ship_files: &BTreeMap<String, Value>,
) -> AppResult<BTreeMap<String, String>> {
    let mut sprites = BTreeMap::new();
    for (id, value) in ship_files {
        if let Some(sprite) = value.get("spriteName").and_then(Value::as_str) {
            if let Some(data_url) = load_sprite_data_url(mod_root, core_dir, sprite)? {
                sprites.insert(id.clone(), data_url);
            }
        }
    }
    Ok(sprites)
}

pub(super) fn load_weapon_sprite_data(
    mod_root: &Path,
    core_dir: Option<&Path>,
    wpn_files: &BTreeMap<String, Value>,
) -> BTreeMap<String, BTreeMap<String, String>> {
    let mut sprites = BTreeMap::new();
    for (id, value) in wpn_files {
        let mut weapon_sprites = BTreeMap::new();
        for field in [
            "turretUnderSprite",
            "turretSprite",
            "turretGunSprite",
            "turretGlowSprite",
            "hardpointUnderSprite",
            "hardpointSprite",
            "hardpointGunSprite",
            "hardpointGlowSprite",
        ] {
            if let Some(sprite) = value.get(field).and_then(Value::as_str) {
                if let Ok(Some(data_url)) = load_sprite_data_url(mod_root, core_dir, sprite) {
                    weapon_sprites.insert(field.to_string(), data_url);
                }
            }
        }
        if !weapon_sprites.is_empty() {
            sprites.insert(id.clone(), weapon_sprites);
        }
    }
    sprites
}

pub(super) fn load_hullmod_sprite_data(
    mod_root: &Path,
    core_dir: Option<&Path>,
    hullmods: &[Map<String, Value>],
) -> BTreeMap<String, String> {
    load_table_sprite_data(mod_root, core_dir, hullmods, "sprite")
}

pub(super) fn load_industry_sprite_data(
    mod_root: &Path,
    core_dir: Option<&Path>,
    industries: &[Map<String, Value>],
) -> BTreeMap<String, String> {
    load_table_sprite_data(mod_root, core_dir, industries, "image")
}

fn load_table_sprite_data(
    mod_root: &Path,
    core_dir: Option<&Path>,
    rows: &[Map<String, Value>],
    sprite_field: &str,
) -> BTreeMap<String, String> {
    let mut sprites = BTreeMap::new();
    for row in rows {
        let id = str_field(row, "id");
        let sprite = str_field(row, sprite_field);
        if !id.is_empty() && !sprite.is_empty() {
            if let Ok(Some(data_url)) = load_sprite_data_url(mod_root, core_dir, &sprite) {
                sprites.insert(id, data_url);
            }
        }
    }
    sprites
}

fn load_sprite_data_url(
    mod_root: &Path,
    core_dir: Option<&Path>,
    sprite: &str,
) -> AppResult<Option<String>> {
    let rel = sprite.replace('\\', "/");
    // Try mod directory first
    let mod_path = mod_root.join(&rel);
    if mod_path.exists() {
        let bytes = fs::read(mod_path)?;
        return Ok(Some(format!(
            "data:image/png;base64,{}",
            general_purpose::STANDARD.encode(bytes)
        )));
    }
    // Fallback: try starsector-core directory
    if let Some(core) = core_dir {
        let core_path = core.join(&rel);
        if core_path.exists() {
            let bytes = fs::read(core_path)?;
            return Ok(Some(format!(
                "data:image/png;base64,{}",
                general_purpose::STANDARD.encode(bytes)
            )));
        }
    }
    Ok(None)
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

        let loaded = load_ship_sprite_data(&root, None, &ships).unwrap();

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
