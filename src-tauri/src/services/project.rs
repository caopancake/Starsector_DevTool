use crate::{
    errors::AppResult,
    filesystem::{list_sprites, load_json_dir, load_json_dir_by_id, read_json_file},
    models::{AppData, FactionMeta, CSV_TABLES},
    parsers::read_csv_data,
};
use base64::{engine::general_purpose, Engine as _};
use serde_json::{Map, Value};
use std::{
    collections::{BTreeMap, HashMap},
    fs,
    path::Path,
};
use walkdir::WalkDir;

pub fn load_all_data(mod_root: &Path) -> AppResult<AppData> {
    let starsector_root = mod_root
        .parent()
        .and_then(|p| p.parent())
        .map(Path::to_path_buf);
    let core_dir = starsector_root.as_ref().map(|p| p.join("starsector-core"));
    let core_available = core_dir.as_ref().is_some_and(|p| p.exists());
    let mod_info = read_json_file(&mod_root.join("mod_info.json")).unwrap_or_else(|_| {
        let mut obj = Map::new();
        let name = mod_root
            .file_name()
            .and_then(|s| s.to_str())
            .unwrap_or("Mod");
        obj.insert("id".to_string(), Value::String(name.to_string()));
        obj.insert("name".to_string(), Value::String(name.to_string()));
        Value::Object(obj)
    });

    let (mut faction_meta, tag_map) = discover_factions(mod_root);
    faction_meta
        .entry("other".to_string())
        .or_insert(FactionMeta {
            name: "其他".to_string(),
            color: "#6b7280".to_string(),
        });

    let mut csv_headers = BTreeMap::new();
    let mut csv_paths = BTreeMap::new();
    let mut tables: HashMap<String, Vec<Map<String, Value>>> = HashMap::new();
    for (key, rel) in CSV_TABLES {
        let table = read_csv_data(&mod_root.join(rel))?;
        let mut rows = table.rows;
        for row in &mut rows {
            let id = str_field(row, "id");
            let tags = str_field(row, "tags");
            row.insert(
                "_faction".to_string(),
                Value::String(detect_faction(&id, &tags, &tag_map)),
            );
        }
        csv_headers.insert(key.to_string(), table.header);
        csv_paths.insert(key.to_string(), rel.to_string());
        tables.insert(key.to_string(), rows);
    }

    let ship_files = load_json_dir_by_id(&mod_root.join("data/hulls"), "ship", "hullId");
    let mut variants: BTreeMap<String, Vec<Value>> = BTreeMap::new();
    for value in load_json_dir(&mod_root.join("data/variants"), "variant") {
        if let Some(hull_id) = value.get("hullId").and_then(Value::as_str) {
            variants.entry(hull_id.to_string()).or_default().push(value);
        }
    }
    let mut ship_sprites = BTreeMap::new();
    for (id, value) in &ship_files {
        if let Some(sprite) = value.get("spriteName").and_then(Value::as_str) {
            let path = mod_root.join(sprite.replace('\\', "/"));
            if path.exists() {
                let bytes = fs::read(path)?;
                ship_sprites.insert(
                    id.clone(),
                    format!(
                        "data:image/png;base64,{}",
                        general_purpose::STANDARD.encode(bytes)
                    ),
                );
            }
        }
    }

    Ok(AppData {
        mod_root: mod_root.to_string_lossy().to_string(),
        starsector_root: starsector_root.map(|p| p.to_string_lossy().to_string()),
        core_available,
        mod_info,
        faction_meta,
        csv_headers,
        csv_paths,
        ships: tables.remove("ships").unwrap_or_default(),
        weapons: tables.remove("weapons").unwrap_or_default(),
        wings: tables.remove("wings").unwrap_or_default(),
        hullmods: tables.remove("hullmods").unwrap_or_default(),
        industries: tables.remove("industries").unwrap_or_default(),
        ship_files,
        variants,
        ship_sprites,
        available_sprites: list_sprites(mod_root, &["graphics/ships"]),
        wpn_files: load_json_dir_by_id(&mod_root.join("data/weapons"), "wpn", "id"),
        proj_files: load_proj_files(mod_root, core_dir.as_deref()),
        weapon_sprites: list_sprites(
            mod_root,
            &["graphics/weapons", "graphics/missiles", "graphics/fx"],
        ),
    })
}

fn discover_factions(mod_root: &Path) -> (BTreeMap<String, FactionMeta>, HashMap<String, String>) {
    let mut factions = BTreeMap::new();
    let mut tag_map = HashMap::new();
    let dir = mod_root.join("data/world/factions");
    if !dir.exists() {
        return (factions, tag_map);
    }
    for entry in WalkDir::new(dir).max_depth(1).into_iter().flatten() {
        if entry.path().extension().and_then(|s| s.to_str()) != Some("faction") {
            continue;
        }
        if let Ok(Value::Object(obj)) = read_json_file(entry.path()) {
            let Some(fid) = obj.get("id").and_then(Value::as_str) else {
                continue;
            };
            let Some(name) = obj
                .get("displayName")
                .or_else(|| obj.get("displayNameLong"))
                .and_then(Value::as_str)
            else {
                continue;
            };
            let color = obj
                .get("color")
                .and_then(Value::as_array)
                .map(|v| rgb_to_hex(v))
                .unwrap_or_else(|| "#808080".to_string());
            factions.insert(
                fid.to_string(),
                FactionMeta {
                    name: name.to_string(),
                    color,
                },
            );
            for section in ["knownShips", "knownWeapons", "knownFighters"] {
                if let Some(tags) = obj
                    .get(section)
                    .and_then(|v| v.get("tags"))
                    .and_then(Value::as_array)
                {
                    for tag in tags.iter().filter_map(Value::as_str) {
                        if tag.contains("_bp")
                            && !matches!(
                                tag,
                                "base_bp"
                                    | "lowtech_bp"
                                    | "midline_bp"
                                    | "hightech_bp"
                                    | "missile_bp"
                                    | "pirate_bp"
                                    | "pirates"
                            )
                        {
                            tag_map.insert(tag.to_string(), fid.to_string());
                        }
                    }
                }
            }
        }
    }
    (factions, tag_map)
}

fn load_proj_files(mod_root: &Path, core_dir: Option<&Path>) -> BTreeMap<String, Value> {
    let mut result = BTreeMap::new();
    for mut value in load_json_dir(&mod_root.join("data/weapons/proj"), "proj") {
        if let Some(id) = value
            .get("id")
            .and_then(Value::as_str)
            .map(ToString::to_string)
        {
            if let Value::Object(obj) = &mut value {
                obj.insert("_source".to_string(), Value::String("mod".to_string()));
            }
            result.insert(id, value);
        }
    }
    if let Some(core) = core_dir {
        for mut value in load_json_dir(&core.join("data/weapons/proj"), "proj") {
            if let Some(id) = value
                .get("id")
                .and_then(Value::as_str)
                .map(ToString::to_string)
            {
                if result.contains_key(&id) {
                    continue;
                }
                if let Value::Object(obj) = &mut value {
                    obj.insert("_source".to_string(), Value::String("core".to_string()));
                }
                result.insert(id, value);
            }
        }
    }
    result
}

fn rgb_to_hex(values: &[Value]) -> String {
    let r = values
        .first()
        .and_then(Value::as_i64)
        .unwrap_or(128)
        .clamp(0, 255);
    let g = values
        .get(1)
        .and_then(Value::as_i64)
        .unwrap_or(128)
        .clamp(0, 255);
    let b = values
        .get(2)
        .and_then(Value::as_i64)
        .unwrap_or(128)
        .clamp(0, 255);
    format!("#{r:02x}{g:02x}{b:02x}")
}

fn detect_faction(id: &str, tags: &str, tag_map: &HashMap<String, String>) -> String {
    for (tag, faction) in tag_map {
        if tags.contains(tag) {
            return faction.clone();
        }
    }
    if id.contains('_') {
        let prefix = id
            .split('_')
            .next()
            .unwrap_or_default()
            .to_ascii_lowercase();
        if !prefix.is_empty() {
            return "other".to_string();
        }
    }
    "other".to_string()
}

fn str_field(row: &Map<String, Value>, key: &str) -> String {
    row.get(key)
        .and_then(Value::as_str)
        .unwrap_or_default()
        .to_string()
}
