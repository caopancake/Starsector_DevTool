use crate::{
    errors::{AppError, AppResult},
    io::{read_csv_data, read_json_file},
    models::{FactionMeta, CSV_DEFAULT_FACTION_ID},
};
use serde_json::{Map, Value};
use std::{
    collections::{BTreeMap, HashMap},
    path::{Path, PathBuf},
};

use super::model::is_comment_row;

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
        let obj = read_faction_object(&entry)?;
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
                    if is_owned_faction_blueprint_tag(tag, &fid) {
                        tag_map.insert(tag.to_string(), fid.to_string());
                    }
                }
            }
        }
    }
    Ok((factions, tag_map))
}

pub(super) fn detect_faction(_id: &str, tags: &str, tag_map: &HashMap<String, String>) -> String {
    for tag in faction_blueprint_tags(tags) {
        if let Some(faction) = tag_map.get(tag) {
            return faction.clone();
        }
    }
    CSV_DEFAULT_FACTION_ID.to_string()
}

pub(super) fn load_faction_files(mod_root: &Path) -> AppResult<BTreeMap<String, Value>> {
    let mut defs = BTreeMap::new();
    for entry in read_faction_index(mod_root)? {
        let obj = read_faction_object(&entry)?;
        let id = obj
            .get("id")
            .and_then(Value::as_str)
            .map(str::to_string)
            .unwrap_or(entry.id);
        defs.insert(id, Value::Object(obj));
    }
    Ok(defs)
}

fn read_faction_object(entry: &FactionIndexEntry) -> AppResult<Map<String, Value>> {
    match read_json_file(&entry.path)? {
        Value::Object(obj) => Ok(obj),
        _ => Err(AppError::message(format!(
            "faction file must be a JSON object: {}",
            entry.path.display()
        ))),
    }
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

    let mut entries = Vec::new();
    for (index, row) in table.rows.iter().enumerate() {
        if is_faction_index_padding_row(row) {
            continue;
        }
        entries.push(
            faction_index_entry(mod_root, &dir, row, &id_col, file_col.as_deref()).map_err(
                |error| {
                    AppError::context(format!("解析 factions.csv 失败: row {}", index + 2), error)
                },
            )?,
        );
    }
    Ok(entries)
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
) -> AppResult<FactionIndexEntry> {
    let raw_id = row
        .get(id_col)
        .and_then(Value::as_str)
        .map(str::trim)
        .ok_or_else(|| AppError::message(format!("missing faction id column: {id_col}")))?;
    if raw_id.is_empty() {
        return Err(AppError::message("missing faction id"));
    }
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
        return Err(AppError::message("missing faction id"));
    }
    let file = file_value
        .map(ToString::to_string)
        .unwrap_or_else(|| format!("{id}.faction"));
    Ok(FactionIndexEntry {
        id,
        path: faction_file_path(mod_root, dir, &file),
    })
}

fn is_faction_index_padding_row(row: &Map<String, Value>) -> bool {
    is_comment_row(row)
        || row
            .values()
            .all(|value| value.as_str().is_none_or(|text| text.trim().is_empty()))
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

fn is_owned_faction_blueprint_tag(tag: &str, faction_id: &str) -> bool {
    let faction_id = faction_id.trim().to_ascii_lowercase();
    if faction_id.is_empty() {
        return false;
    }
    let tag = tag.trim().to_ascii_lowercase();
    tag == format!("{faction_id}_bp")
        || (tag.starts_with(&format!("{faction_id}_")) && tag.ends_with("_bp"))
}

fn faction_blueprint_tags(tags: &str) -> impl Iterator<Item = &str> {
    tags.split(|ch: char| ch == ',' || ch == ';' || ch == '|' || ch.is_whitespace())
        .map(str::trim)
        .filter(|tag| !tag.is_empty())
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
    fn detects_faction_from_exact_blueprint_tag_tokens_only() {
        let mut tag_map = HashMap::new();
        tag_map.insert("demo_bp".to_string(), "demo".to_string());

        assert_eq!(
            detect_faction("ship_id", "rare,not_demo_bp_extra", &tag_map),
            CSV_DEFAULT_FACTION_ID
        );
        assert_eq!(
            detect_faction("ship_id", "rare; demo_bp | other", &tag_map),
            "demo"
        );
    }

    #[test]
    fn accepts_only_blueprint_tags_derived_from_current_faction_id() {
        assert!(is_owned_faction_blueprint_tag("demo_bp", "demo"));
        assert!(is_owned_faction_blueprint_tag("demo_aux_bp", "demo"));
        assert!(!is_owned_faction_blueprint_tag("base_bp", "demo"));
        assert!(!is_owned_faction_blueprint_tag("custom_bp", "demo"));
        assert!(!is_owned_faction_blueprint_tag("demo_bp_extra", "demo"));
    }

    #[test]
    fn discover_factions_does_not_assign_foreign_blueprint_tags() {
        let root = temp_dir("faction_foreign_blueprint_tags");
        let dir = root.join("data/world/factions");
        fs::create_dir_all(&dir).unwrap();
        write_utf8_no_bom(
            &dir.join("factions.csv"),
            "id,file\r\ndemo,demo.faction\r\n",
        )
        .unwrap();
        write_utf8_no_bom(
            &dir.join("demo.faction"),
            r#"{"id":"demo","displayName":"Demo","knownShips":{"tags":["demo_bp","custom_bp","base_bp"]}}"#,
        )
        .unwrap();

        let (_, tag_map) = discover_factions(&root).unwrap();

        let _ = fs::remove_dir_all(root);
        assert_eq!(tag_map.get("demo_bp"), Some(&"demo".to_string()));
        assert!(!tag_map.contains_key("custom_bp"));
        assert!(!tag_map.contains_key("base_bp"));
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

    #[test]
    fn faction_index_reports_non_comment_row_without_id() {
        let root = temp_dir("faction_missing_id");
        let dir = root.join("data/world/factions");
        fs::create_dir_all(&dir).unwrap();
        write_utf8_no_bom(
            &dir.join("factions.csv"),
            "id,file\r\n,demo.faction\r\n#comment,\r\n",
        )
        .unwrap();
        write_utf8_no_bom(
            &dir.join("demo.faction"),
            &json!({"id":"demo","displayName":"Demo"}).to_string(),
        )
        .unwrap();

        let error = load_faction_files(&root).unwrap_err().to_string();

        let _ = fs::remove_dir_all(root);
        assert!(error.contains("factions.csv"));
        assert!(error.contains("row 2"));
        assert!(error.contains("missing faction id"));
    }

    #[test]
    fn indexed_faction_file_parse_errors_are_not_hidden() {
        let root = temp_dir("faction_bad_file");
        let dir = root.join("data/world/factions");
        fs::create_dir_all(&dir).unwrap();
        write_utf8_no_bom(
            &dir.join("factions.csv"),
            "id,file\r\ndemo,demo.faction\r\n",
        )
        .unwrap();
        write_utf8_no_bom(&dir.join("demo.faction"), "{").unwrap();

        let load_error = load_faction_files(&root).unwrap_err().to_string();
        let discover_error = discover_factions(&root).unwrap_err().to_string();

        let _ = fs::remove_dir_all(root);
        assert!(load_error.contains("demo.faction"));
        assert!(discover_error.contains("demo.faction"));
    }

    #[test]
    fn indexed_faction_file_must_be_object() {
        let root = temp_dir("faction_non_object_file");
        let dir = root.join("data/world/factions");
        fs::create_dir_all(&dir).unwrap();
        write_utf8_no_bom(
            &dir.join("factions.csv"),
            "id,file\r\ndemo,demo.faction\r\n",
        )
        .unwrap();
        write_utf8_no_bom(&dir.join("demo.faction"), "[]").unwrap();

        let load_error = load_faction_files(&root).unwrap_err().to_string();
        let discover_error = discover_factions(&root).unwrap_err().to_string();

        let _ = fs::remove_dir_all(root);
        assert!(load_error.contains("faction file must be a JSON object"));
        assert!(discover_error.contains("faction file must be a JSON object"));
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
