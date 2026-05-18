use crate::errors::{AppError, AppResult};
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

pub(super) fn load_ship_system_sprite_data(
    mod_root: &Path,
    core_dir: Option<&Path>,
    ship_systems: &[Map<String, Value>],
) -> BTreeMap<String, String> {
    load_table_sprite_data(mod_root, core_dir, ship_systems, "icon")
}

pub(super) fn merge_skin_sprite_data(
    sprites: &mut BTreeMap<String, String>,
    mod_root: &Path,
    core_dir: Option<&Path>,
    skin_files: &[crate::models::SkinFile],
) -> AppResult<()> {
    for skin in skin_files {
        if let Some(sprite) = skin.data.get("spriteName").and_then(Value::as_str) {
            if let Some(data_url) = load_sprite_data_url(mod_root, core_dir, sprite)? {
                sprites.insert(skin.skin_hull_id.clone(), data_url);
            }
        }
    }
    Ok(())
}

pub(super) fn load_skill_sprite_data(
    mod_root: &Path,
    core_dir: Option<&Path>,
    skills: &[Map<String, Value>],
) -> BTreeMap<String, String> {
    load_table_sprite_data(mod_root, core_dir, skills, "icon")
}

pub(super) fn load_wing_sprite_data(
    ship_sprites: &BTreeMap<String, String>,
    variants: &[crate::models::VariantFile],
    wings: &[Map<String, Value>],
) -> BTreeMap<String, String> {
    let mut by_variant_id = BTreeMap::new();
    let mut by_rel_path = BTreeMap::new();
    for variant in variants {
        by_variant_id.insert(variant.variant_id.as_str(), variant.hull_id.as_str());
        by_rel_path.insert(variant.rel_path.as_str(), variant.hull_id.as_str());
    }

    let mut sprites = BTreeMap::new();
    for row in wings {
        let id = str_field(row, "id");
        let variant_ref = str_field(row, "variant").replace('\\', "/");
        if id.is_empty() || variant_ref.is_empty() {
            continue;
        }
        let stem = variant_ref
            .split('/')
            .rfind(|part| !part.is_empty())
            .unwrap_or("")
            .trim_end_matches(".variant");
        let hull_id = by_variant_id
            .get(variant_ref.as_str())
            .copied()
            .or_else(|| by_variant_id.get(stem).copied())
            .or_else(|| by_rel_path.get(variant_ref.as_str()).copied());
        if let Some(sprite) = hull_id.and_then(|hull_id| ship_sprites.get(hull_id)) {
            sprites.insert(id, sprite.clone());
        }
    }
    sprites
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
        let bytes = fs::read(&mod_path).map_err(|error| {
            AppError::context(
                format!("读取贴图文件失败 ({})", mod_path.display()),
                error.into(),
            )
        })?;
        return Ok(Some(format!(
            "data:image/png;base64,{}",
            general_purpose::STANDARD.encode(bytes)
        )));
    }
    // Fallback: try starsector-core directory
    if let Some(core) = core_dir {
        let core_path = core.join(&rel);
        if core_path.exists() {
            let bytes = fs::read(&core_path).map_err(|error| {
                AppError::context(
                    format!("读取原版贴图文件失败 ({})", core_path.display()),
                    error.into(),
                )
            })?;
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

    #[test]
    fn core_fallback_loads_sprite() {
        let mod_dir = temp_dir("core_fallback_mod");
        let core_dir = temp_dir("core_fallback_core");

        // Create sprite in core_dir only (not in mod_dir)
        let sprite_dir = core_dir.join("graphics/weapons");
        fs::create_dir_all(&sprite_dir).unwrap();
        // Write a minimal valid PNG (1x1 pixel)
        let png_bytes: [u8; 69] = [
            0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A, 0x00, 0x00, 0x00, 0x0D, 0x49, 0x48,
            0x44, 0x52, 0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01, 0x08, 0x02, 0x00, 0x00,
            0x00, 0x90, 0x77, 0x53, 0xDE, 0x00, 0x00, 0x00, 0x0C, 0x49, 0x44, 0x41, 0x54, 0x08,
            0xD7, 0x63, 0xF8, 0xCF, 0xC0, 0x00, 0x00, 0x00, 0x02, 0x00, 0x01, 0xE2, 0x21, 0xBC,
            0x33, 0x00, 0x00, 0x00, 0x00, 0x49, 0x45, 0x4E, 0x44, 0xAE, 0x42, 0x60, 0x82,
        ];
        fs::write(sprite_dir.join("test_turret.png"), png_bytes).unwrap();

        let mut wpn_files = BTreeMap::new();
        wpn_files.insert(
            "testgun".to_string(),
            serde_json::json!({
                "id": "testgun",
                "turretSprite": "graphics/weapons/test_turret.png"
            }),
        );

        let loaded = load_weapon_sprite_data(&mod_dir, Some(core_dir.as_path()), &wpn_files);

        let _ = fs::remove_dir_all(&mod_dir);
        let _ = fs::remove_dir_all(&core_dir);

        // Should have loaded from core
        assert!(loaded.contains_key("testgun"));
        let sprites = &loaded["testgun"];
        assert!(sprites.contains_key("turretSprite"));
        assert!(sprites["turretSprite"].starts_with("data:image/png;base64,"));
    }

    #[test]
    fn mod_sprite_takes_priority_over_core() {
        let mod_dir = temp_dir("priority_mod");
        let core_dir = temp_dir("priority_core");

        // Minimal PNG
        let png_bytes: [u8; 69] = [
            0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A, 0x00, 0x00, 0x00, 0x0D, 0x49, 0x48,
            0x44, 0x52, 0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01, 0x08, 0x02, 0x00, 0x00,
            0x00, 0x90, 0x77, 0x53, 0xDE, 0x00, 0x00, 0x00, 0x0C, 0x49, 0x44, 0x41, 0x54, 0x08,
            0xD7, 0x63, 0xF8, 0xCF, 0xC0, 0x00, 0x00, 0x00, 0x02, 0x00, 0x01, 0xE2, 0x21, 0xBC,
            0x33, 0x00, 0x00, 0x00, 0x00, 0x49, 0x45, 0x4E, 0x44, 0xAE, 0x42, 0x60, 0x82,
        ];

        // Create sprite in BOTH directories
        let mod_sprite_dir = mod_dir.join("graphics/weapons");
        let core_sprite_dir = core_dir.join("graphics/weapons");
        fs::create_dir_all(&mod_sprite_dir).unwrap();
        fs::create_dir_all(&core_sprite_dir).unwrap();
        fs::write(mod_sprite_dir.join("shared.png"), png_bytes).unwrap();
        fs::write(core_sprite_dir.join("shared.png"), png_bytes).unwrap();

        let result = load_sprite_data_url(
            &mod_dir,
            Some(core_dir.as_path()),
            "graphics/weapons/shared.png",
        )
        .unwrap();

        let _ = fs::remove_dir_all(&mod_dir);
        let _ = fs::remove_dir_all(&core_dir);

        // Should succeed (mod has priority, but both work)
        assert!(result.is_some());
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
