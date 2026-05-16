use crate::{filesystem::read_json_file, models::FactionMeta};
use serde_json::Value;
use std::{
    collections::{BTreeMap, HashMap},
    path::Path,
};
use walkdir::WalkDir;

pub(super) fn discover_factions(
    mod_root: &Path,
) -> (BTreeMap<String, FactionMeta>, HashMap<String, String>) {
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
                        if is_faction_blueprint_tag(tag) {
                            tag_map.insert(tag.to_string(), fid.to_string());
                        }
                    }
                }
            }
        }
    }
    (factions, tag_map)
}

pub(super) fn detect_faction(id: &str, tags: &str, tag_map: &HashMap<String, String>) -> String {
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

pub(super) fn load_faction_files(mod_root: &Path) -> BTreeMap<String, Value> {
    let mut defs = BTreeMap::new();
    let dir = mod_root.join("data/world/factions");
    if !dir.exists() {
        return defs;
    }
    for entry in WalkDir::new(dir).max_depth(1).into_iter().flatten() {
        if entry.path().extension().and_then(|s| s.to_str()) != Some("faction") {
            continue;
        }
        if let Ok(value) = read_json_file(entry.path()) {
            if let Some(id) = value.get("id").and_then(Value::as_str) {
                defs.insert(id.to_string(), value);
            }
        }
    }
    defs
}

fn is_faction_blueprint_tag(tag: &str) -> bool {
    tag.contains("_bp")
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

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn detects_faction_from_blueprint_tag() {
        let mut tag_map = HashMap::new();
        tag_map.insert("demo_bp".to_string(), "demo".to_string());

        assert_eq!(detect_faction("ship_id", "rare,demo_bp", &tag_map), "demo");
    }

    #[test]
    fn ignores_generic_blueprint_tag() {
        assert!(!is_faction_blueprint_tag("base_bp"));
        assert!(is_faction_blueprint_tag("custom_bp"));
    }
}
