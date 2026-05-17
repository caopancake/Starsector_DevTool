mod factions;
mod projectiles;
mod sprites;
mod tables;

use crate::{
    errors::AppResult,
    filesystem::{list_sprites, load_json_dir, load_json_dir_by_id, read_json_file},
    models::{AppData, FactionMeta},
    parsers::read_csv_data,
};
use serde_json::{Map, Value};
use std::{collections::BTreeMap, path::Path};

pub fn load_all_data(mod_root: &Path) -> AppResult<AppData> {
    let starsector_root = mod_root
        .parent()
        .and_then(|p| p.parent())
        .map(Path::to_path_buf);
    let core_dir = starsector_root.as_ref().map(|p| p.join("starsector-core"));
    let core_available = core_dir.as_ref().is_some_and(|p| p.exists());
    let mod_info = read_mod_info(mod_root);

    let (mut faction_meta, tag_map) = factions::discover_factions(mod_root);
    ensure_other_faction(&mut faction_meta);
    let faction_files = factions::load_faction_files(mod_root);
    let mission_count = count_mission_list_entries(mod_root);

    let mut loaded_tables = tables::load_csv_tables(mod_root, &tag_map)?;
    let ship_files = load_json_dir_by_id(&mod_root.join("data/hulls"), "ship", "hullId");
    let variants = load_variants_by_hull(mod_root);
    let ship_sprites = sprites::load_ship_sprite_data(mod_root, core_dir.as_deref(), &ship_files)?;
    let wpn_files = load_json_dir_by_id(&mod_root.join("data/weapons"), "wpn", "id");
    let weapon_sprites_data =
        sprites::load_weapon_sprite_data(mod_root, core_dir.as_deref(), &wpn_files);
    let hullmods = loaded_tables
        .rows
        .get("hullmods")
        .cloned()
        .unwrap_or_default();
    let hullmod_sprites =
        sprites::load_hullmod_sprite_data(mod_root, core_dir.as_deref(), &hullmods);
    let industries = loaded_tables
        .rows
        .get("industries")
        .cloned()
        .unwrap_or_default();
    let industry_sprites =
        sprites::load_industry_sprite_data(mod_root, core_dir.as_deref(), &industries);

    Ok(AppData {
        mod_root: mod_root.to_string_lossy().to_string(),
        starsector_root: starsector_root.map(|p| p.to_string_lossy().to_string()),
        core_available,
        mod_info,
        faction_meta,
        faction_files,
        mission_count,
        csv_headers: loaded_tables.csv_headers,
        csv_paths: loaded_tables.csv_paths,
        ships: loaded_tables.rows.remove("ships").unwrap_or_default(),
        weapons: loaded_tables.rows.remove("weapons").unwrap_or_default(),
        wings: loaded_tables.rows.remove("wings").unwrap_or_default(),
        hullmods: loaded_tables.rows.remove("hullmods").unwrap_or_default(),
        industries: loaded_tables.rows.remove("industries").unwrap_or_default(),
        ship_files,
        variants,
        ship_sprites,
        available_sprites: list_sprites(mod_root, &["graphics/ships"]),
        wpn_files,
        proj_files: projectiles::load_projectile_files(mod_root, core_dir.as_deref()),
        weapon_sprites: list_sprites(
            mod_root,
            &["graphics/weapons", "graphics/missiles", "graphics/fx"],
        ),
        weapon_sprites_data,
        hullmod_sprites,
        industry_sprites,
    })
}

fn read_mod_info(mod_root: &Path) -> Value {
    read_json_file(&mod_root.join("mod_info.json")).unwrap_or_else(|_| {
        let mut obj = Map::new();
        let name = mod_root
            .file_name()
            .and_then(|s| s.to_str())
            .unwrap_or("Mod");
        obj.insert("id".to_string(), Value::String(name.to_string()));
        obj.insert("name".to_string(), Value::String(name.to_string()));
        Value::Object(obj)
    })
}

fn ensure_other_faction(faction_meta: &mut BTreeMap<String, FactionMeta>) {
    faction_meta
        .entry("other".to_string())
        .or_insert(FactionMeta {
            name: "其他".to_string(),
            color: "#6b7280".to_string(),
        });
}

fn count_mission_list_entries(mod_root: &Path) -> usize {
    let path = mod_root.join("data/missions/mission_list.csv");
    read_csv_data(&path)
        .map(|table| {
            table
                .rows
                .iter()
                .filter(|row| {
                    row.get("mission")
                        .and_then(Value::as_str)
                        .is_some_and(|mission| !mission.trim().is_empty())
                })
                .count()
        })
        .unwrap_or(0)
}

fn load_variants_by_hull(mod_root: &Path) -> BTreeMap<String, Vec<Value>> {
    let mut variants: BTreeMap<String, Vec<Value>> = BTreeMap::new();
    for value in load_json_dir(&mod_root.join("data/variants"), "variant") {
        if let Some(hull_id) = value.get("hullId").and_then(Value::as_str) {
            variants.entry(hull_id.to_string()).or_default().push(value);
        }
    }
    variants
}
