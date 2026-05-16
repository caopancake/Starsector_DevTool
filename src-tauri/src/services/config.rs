use crate::{
    errors::{AppError, AppResult},
    filesystem::{read_json_file, strip_internal_fields, write_utf8_no_bom},
    models::{CsvTable, CSV_TABLES},
    parsers::{read_csv_data, save_csv_file},
};
use base64::{engine::general_purpose, Engine as _};
use serde_json::{json, Map, Value};
use std::{collections::BTreeMap, fs, path::Path};
use walkdir::WalkDir;

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

pub fn scan_campaign_files(mod_root: &str) -> Vec<String> {
    let dir = Path::new(mod_root).join("data/campaign");
    if !dir.exists() {
        return vec![];
    }
    let mod_root_path = Path::new(mod_root);
    let known_paths: Vec<&str> = CSV_TABLES.iter().map(|(_, path)| *path).collect();
    WalkDir::new(&dir)
        .max_depth(2)
        .into_iter()
        .flatten()
        .filter(|e| e.path().extension().and_then(|s| s.to_str()) == Some("csv"))
        .filter_map(|e| {
            e.path()
                .strip_prefix(mod_root_path)
                .ok()
                .map(|p| p.to_string_lossy().replace('\\', "/"))
        })
        .filter(|p| !known_paths.contains(&p.as_str()))
        .collect()
}

pub fn load_campaign_csv(mod_root: &str, rel_path: &str) -> AppResult<CsvTable> {
    let path = Path::new(mod_root).join(rel_path);
    read_csv_data(&path)
}

pub fn save_campaign_csv(
    mod_root: &str,
    rel_path: &str,
    header: &[String],
    rows: &[Map<String, Value>],
) -> AppResult<()> {
    let path = Path::new(mod_root).join(rel_path);
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent)?;
    }
    save_csv_file(&path, header, rows)
}

pub fn scan_world_files(mod_root: &str) -> Vec<String> {
    let dir = Path::new(mod_root).join("data/world");
    if !dir.exists() {
        return vec![];
    }
    let factions_dir = dir.join("factions");
    let mod_root_path = Path::new(mod_root);
    WalkDir::new(&dir)
        .into_iter()
        .flatten()
        .filter(|e| e.file_type().is_file())
        .filter(|e| !e.path().starts_with(&factions_dir))
        .filter(|e| {
            let ext = e.path().extension().and_then(|s| s.to_str()).unwrap_or("");
            ext == "json" || ext == "csv"
        })
        .filter_map(|e| {
            e.path()
                .strip_prefix(mod_root_path)
                .ok()
                .map(|p| p.to_string_lossy().replace('\\', "/"))
        })
        .collect()
}

pub fn load_world_file(mod_root: &str, rel_path: &str) -> AppResult<Value> {
    let path = Path::new(mod_root).join(rel_path);
    read_json_file(&path)
}

pub fn save_world_file(mod_root: &str, rel_path: &str, data: &Value) -> AppResult<()> {
    let path = Path::new(mod_root).join(rel_path);
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent)?;
    }
    let clean = strip_internal_fields(data);
    let json_string = serde_json::to_string_pretty(&clean)?;
    write_utf8_no_bom(&path, &json_string)?;
    Ok(())
}

pub fn load_image_as_data_url(mod_root: &str, rel_path: &str) -> AppResult<Option<String>> {
    let path = Path::new(mod_root).join(rel_path.replace('\\', "/"));
    if !path.exists() {
        return Ok(None);
    }
    let bytes = fs::read(&path)?;
    let ext = path.extension().and_then(|s| s.to_str()).unwrap_or("png");
    let mime = match ext {
        "jpg" | "jpeg" => "image/jpeg",
        "gif" => "image/gif",
        "webp" => "image/webp",
        _ => "image/png",
    };
    Ok(Some(format!(
        "data:{};base64,{}",
        mime,
        general_purpose::STANDARD.encode(bytes)
    )))
}

/// Scan starsector-core files and discover field names + inferred types.
/// Returns a map: fileType → Vec<DiscoveredField>
pub fn scan_core_fields(starsector_root: &str) -> BTreeMap<String, Vec<Value>> {
    let mut result = BTreeMap::new();
    let core_dir = Path::new(starsector_root).join("starsector-core");
    if !core_dir.exists() {
        return result;
    }

    // Scan faction files
    let faction_fields = scan_json_fields(&core_dir.join("data/world/factions"), "faction");
    if !faction_fields.is_empty() {
        result.insert("faction".to_string(), faction_fields);
    }

    // Scan ship files
    let ship_fields = scan_json_fields(&core_dir.join("data/hulls"), "ship");
    if !ship_fields.is_empty() {
        result.insert("ship".to_string(), ship_fields);
    }

    // Scan weapon files
    let wpn_fields = scan_json_fields(&core_dir.join("data/weapons"), "wpn");
    if !wpn_fields.is_empty() {
        result.insert("weapon".to_string(), wpn_fields);
    }

    result
}

/// Scan all JSON files in a directory with given extension,
/// collect all unique top-level field names and infer types from values.
fn scan_json_fields(dir: &Path, ext: &str) -> Vec<Value> {
    if !dir.exists() {
        return vec![];
    }

    let mut field_map: BTreeMap<String, String> = BTreeMap::new();

    for entry in WalkDir::new(dir).max_depth(2).into_iter().flatten() {
        if entry.path().extension().and_then(|s| s.to_str()) != Some(ext) {
            continue;
        }
        if let Ok(Value::Object(obj)) = read_json_file(entry.path()) {
            for (key, value) in &obj {
                if key.starts_with('_') {
                    continue;
                }
                // Only set type if not already discovered (first occurrence wins)
                field_map
                    .entry(key.clone())
                    .or_insert_with(|| infer_type(value));
            }
        }
    }

    field_map
        .into_iter()
        .map(|(key, field_type)| {
            json!({
                "key": key,
                "type": field_type,
                "origin": "core"
            })
        })
        .collect()
}

/// Infer a schema field type from a JSON value
fn infer_type(value: &Value) -> String {
    match value {
        Value::Bool(_) => "boolean".to_string(),
        Value::Number(n) => {
            if n.is_i64() || n.is_u64() {
                "integer".to_string()
            } else {
                "float".to_string()
            }
        }
        Value::String(s) => {
            if s.starts_with("graphics/") {
                "path-image".to_string()
            } else {
                "string".to_string()
            }
        }
        Value::Array(arr) => {
            if arr.is_empty() {
                return "string-array".to_string();
            }
            // Check if it looks like a color [R, G, B]
            if arr.len() == 3 && arr.iter().all(|v| v.is_i64() || v.is_u64()) {
                let all_in_range = arr
                    .iter()
                    .all(|v| v.as_i64().map(|n| (0..=255).contains(&n)).unwrap_or(false));
                if all_in_range {
                    return "color-rgb".to_string();
                }
            }
            if arr.iter().all(Value::is_string) {
                "string-array".to_string()
            } else if arr.iter().all(Value::is_object) {
                "array-of-object".to_string()
            } else {
                "string-array".to_string()
            }
        }
        Value::Object(obj) => {
            // If it has a "tags" field that's an array, it's a tag-select
            if let Some(Value::Array(_)) = obj.get("tags") {
                "tag-select".to_string()
            } else {
                "object".to_string()
            }
        }
        Value::Null => "string".to_string(),
    }
}
