use crate::{errors::AppResult, io::read_json_file, models::FactionMeta, parsers::read_csv_data};
use serde_json::{Map, Value};
use std::{
    collections::{BTreeMap, HashMap},
    path::{Path, PathBuf},
};

struct FactionIndexEntry {
    id: String,
    path: PathBuf,
}

pub(super) fn discover_factions(
    mod_root: &Path,
) -> AppResult<(BTreeMap<String, FactionMeta>, HashMap<String, String>)> {
    let mut factions = BTreeMap::new();
    let mut tag_map = HashMap::new();
    for entry in read_faction_index(mod_root)? {
        if let Ok(Value::Object(obj)) = read_json_file(&entry.path) {
            let fid = obj
                .get("id")
                .and_then(Value::as_str)
                .unwrap_or(&entry.id)
                .to_string();
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
    Ok((factions, tag_map))
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

pub(super) fn load_faction_files(mod_root: &Path) -> AppResult<BTreeMap<String, Value>> {
    let mut defs = BTreeMap::new();
    for entry in read_faction_index(mod_root)? {
        if let Ok(value) = read_json_file(&entry.path) {
            if let Some(id) = value
                .get("id")
                .and_then(Value::as_str)
                .map(str::to_string)
                .or(Some(entry.id))
            {
                defs.insert(id, value);
            }
        }
    }
    Ok(defs)
}

fn read_faction_index(mod_root: &Path) -> AppResult<Vec<FactionIndexEntry>> {
    let dir = mod_root.join("data/world/factions");
    let table = read_csv_data(&dir.join("factions.csv"))?;
    if table.header.is_empty() {
        return Ok(vec![]);
    }
    let id_col = pick_col(&table.header, &["id", "faction", "factionId"])
        .or_else(|| table.header.first().cloned());
    let Some(id_col) = id_col else {
        return Ok(vec![]);
    };
    let file_col = pick_col(&table.header, &["file", "path", "filename", "factionFile"])
        .or_else(|| table.header.iter().find(|col| *col != &id_col).cloned());

    Ok(table
        .rows
        .iter()
        .filter_map(|row| faction_index_entry(mod_root, &dir, row, &id_col, file_col.as_deref()))
        .collect())
}

fn pick_col(header: &[String], candidates: &[&str]) -> Option<String> {
    candidates.iter().find_map(|candidate| {
        header
            .iter()
            .find(|col| col.eq_ignore_ascii_case(candidate))
            .cloned()
    })
}

fn faction_index_entry(
    mod_root: &Path,
    dir: &Path,
    row: &Map<String, Value>,
    id_col: &str,
    file_col: Option<&str>,
) -> Option<FactionIndexEntry> {
    let raw_id = row.get(id_col).and_then(Value::as_str)?.trim();
    let raw_file = file_col
        .and_then(|col| row.get(col))
        .and_then(Value::as_str)
        .map(str::trim)
        .filter(|value| !value.is_empty());
    let file_value = raw_file.or_else(|| looks_like_faction_file(raw_id).then_some(raw_id));
    let id = if let Some(file) = file_value {
        faction_id_from_file(file)
    } else {
        raw_id.to_string()
    };
    if id.is_empty() {
        return None;
    }
    let file = file_value
        .map(ToString::to_string)
        .unwrap_or_else(|| format!("{id}.faction"));
    Some(FactionIndexEntry {
        id,
        path: faction_file_path(mod_root, dir, &file),
    })
}

fn looks_like_faction_file(value: &str) -> bool {
    value.ends_with(".faction") || value.contains('/') || value.contains('\\')
}

fn faction_id_from_file(value: &str) -> String {
    Path::new(value)
        .file_stem()
        .and_then(|stem| stem.to_str())
        .unwrap_or(value)
        .to_string()
}

fn faction_file_path(mod_root: &Path, dir: &Path, value: &str) -> PathBuf {
    let normalized = value.replace('\\', "/");
    let file = if normalized.ends_with(".faction") {
        normalized
    } else {
        format!("{normalized}.faction")
    };
    if file.contains('/') {
        mod_root.join(file)
    } else {
        dir.join(file)
    }
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
    use crate::io::write_utf8_no_bom;
    use serde_json::json;
    use std::{
        fs,
        path::PathBuf,
        time::{SystemTime, UNIX_EPOCH},
    };

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

    #[test]
    fn loads_factions_from_faction_path_csv() {
        let root = temp_dir("faction_path_csv");
        let dir = root.join("data/world/factions");
        fs::create_dir_all(&dir).unwrap();
        write_utf8_no_bom(
            &dir.join("factions.csv"),
            "faction\r\ndata/world/factions/plsp.faction\r\ndata/world/factions/celestite.faction\r\n",
        )
        .unwrap();
        write_utf8_no_bom(
            &dir.join("plsp.faction"),
            &json!({"id":"plsp","displayName":"Polaris","color":[1,2,3,255]}).to_string(),
        )
        .unwrap();
        write_utf8_no_bom(
            &dir.join("celestite.faction"),
            &json!({"id":"celestite","displayName":"Celestite","color":[4,5,6,255]}).to_string(),
        )
        .unwrap();
        write_utf8_no_bom(
            &dir.join("mercenary.faction"),
            &json!({"id":"mercenary","displayName":"Mercenary"}).to_string(),
        )
        .unwrap();

        let files = load_faction_files(&root).unwrap();
        let (meta, _) = discover_factions(&root).unwrap();

        let _ = fs::remove_dir_all(root);
        assert!(files.contains_key("plsp"));
        assert!(files.contains_key("celestite"));
        assert!(!files.contains_key("mercenary"));
        assert_eq!(meta["plsp"].name, "Polaris");
    }

    #[test]
    fn reports_faction_index_csv_path() {
        let root = temp_dir("faction_bad_csv");
        let dir = root.join("data/world/factions");
        fs::create_dir_all(&dir).unwrap();
        write_utf8_no_bom(&dir.join("factions.csv"), "id,file\r\nbad\r\n").unwrap();

        let error = load_faction_files(&root).unwrap_err().to_string();

        let _ = fs::remove_dir_all(root);
        assert!(error.contains("解析 CSV 失败"));
        assert!(error.contains("factions.csv"));
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
