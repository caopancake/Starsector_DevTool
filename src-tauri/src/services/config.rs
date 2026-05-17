use crate::{
    errors::{AppError, AppResult},
    filesystem::{read_json_file, read_utf8_no_bom, strip_internal_fields, write_utf8_no_bom},
    models::{CsvTable, MissionData},
    parsers::{read_csv_data, save_csv_file},
};
use base64::{engine::general_purpose, Engine as _};
use serde_json::{json, Map, Value};
use std::{collections::BTreeMap, fs, path::Path};
use walkdir::WalkDir;

type FactionIndexTable = (Vec<String>, Vec<Map<String, Value>>);

pub fn save_mod_info(mod_root: &str, data: &Value) -> AppResult<()> {
    let path = Path::new(mod_root).join("mod_info.json");
    let clean = strip_internal_fields(data);
    let json_string = serde_json::to_string_pretty(&clean)?;
    write_utf8_no_bom(&path, &json_string)?;
    Ok(())
}

pub fn save_faction(mod_root: &str, id: &str, data: &Value) -> AppResult<()> {
    let id = validate_config_id(id, "无效势力 ID")?;
    let dir = Path::new(mod_root).join("data/world/factions");
    fs::create_dir_all(&dir)?;
    let path = dir.join(format!("{id}.faction"));
    let clean = strip_internal_fields(data);
    let json_string = serde_json::to_string_pretty(&clean)?;
    write_utf8_no_bom(&path, &json_string)?;
    upsert_faction_index(mod_root, id)?;
    Ok(())
}

pub fn create_faction(mod_root: &str, id: &str) -> AppResult<Value> {
    let id = validate_config_id(id, "无效势力 ID")?;
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
        "color": [128, 128, 128, 255],
        "baseColor": [128, 128, 128, 255],
        "darkColor": [64, 64, 64, 255],
        "shipNamePrefix": "",
        "knownShips": {"tags": []},
        "knownWeapons": {"tags": []},
        "knownFighters": {"tags": []}
    });
    let json_string = serde_json::to_string_pretty(&default)?;
    write_utf8_no_bom(&path, &json_string)?;
    upsert_faction_index(mod_root, id)?;
    Ok(default)
}

pub fn delete_faction(mod_root: &str, id: &str, delete_file: bool) -> AppResult<()> {
    let id = validate_config_id(id, "无效势力 ID")?;
    if delete_file {
        let path = Path::new(mod_root)
            .join("data/world/factions")
            .join(format!("{id}.faction"));
        if path.exists() {
            fs::remove_file(&path)?;
        }
    }
    remove_faction_index(mod_root, id)?;
    Ok(())
}

fn upsert_faction_index(mod_root: &str, id: &str) -> AppResult<()> {
    let path = faction_index_path(mod_root);
    let (header, mut rows) = read_faction_index_table(&path)?;
    let id_col = faction_id_col(&header);
    let file_col = faction_file_col(&header);
    if rows.iter().any(|row| faction_row_matches(row, &id_col, id)) {
        return save_csv_file(&path, &header, &rows);
    }

    let mut row = Map::new();
    for col in &header {
        row.insert(col.clone(), Value::String(String::new()));
    }
    let rel_path = format!("data/world/factions/{id}.faction");
    if let Some(col) = file_col {
        row.insert(id_col, Value::String(id.to_string()));
        row.insert(col, Value::String(rel_path));
    } else if faction_id_col_is_path(&id_col) {
        row.insert(id_col, Value::String(rel_path));
    } else {
        row.insert(id_col, Value::String(id.to_string()));
    }
    rows.push(row);
    save_csv_file(&path, &header, &rows)
}

fn remove_faction_index(mod_root: &str, id: &str) -> AppResult<()> {
    let path = faction_index_path(mod_root);
    let (header, mut rows) = read_faction_index_table(&path)?;
    let id_col = faction_id_col(&header);
    rows.retain(|row| !faction_row_matches(row, &id_col, id));
    save_csv_file(&path, &header, &rows)
}

fn faction_index_path(mod_root: &str) -> std::path::PathBuf {
    Path::new(mod_root).join("data/world/factions/factions.csv")
}

fn read_faction_index_table(path: &Path) -> AppResult<FactionIndexTable> {
    let table = read_csv_data(path)?;
    if table.header.is_empty() {
        Ok((vec!["id".to_string(), "file".to_string()], table.rows))
    } else {
        Ok((table.header, table.rows))
    }
}

fn faction_id_col(header: &[String]) -> String {
    find_header_col(header, &["id", "faction", "factionId"])
        .unwrap_or_else(|| header.first().cloned().unwrap_or_else(|| "id".to_string()))
}

fn faction_file_col(header: &[String]) -> Option<String> {
    find_header_col(header, &["file", "path", "filename", "factionFile"]).or_else(|| {
        header
            .iter()
            .find(|col| *col != &faction_id_col(header))
            .cloned()
    })
}

fn find_header_col(header: &[String], candidates: &[&str]) -> Option<String> {
    candidates.iter().find_map(|candidate| {
        header
            .iter()
            .find(|col| col.eq_ignore_ascii_case(candidate))
            .cloned()
    })
}

fn faction_row_matches(row: &Map<String, Value>, id_col: &str, id: &str) -> bool {
    let Some(value) = row.get(id_col).and_then(Value::as_str).map(str::trim) else {
        return false;
    };
    value == id || faction_id_from_index_value(value) == id
}

fn faction_id_col_is_path(id_col: &str) -> bool {
    id_col.eq_ignore_ascii_case("faction")
}

fn faction_id_from_index_value(value: &str) -> String {
    Path::new(value)
        .file_stem()
        .and_then(|stem| stem.to_str())
        .unwrap_or(value)
        .to_string()
}

pub fn scan_mission_list_files(mod_root: &str) -> Vec<String> {
    let rel_path = "data/missions/mission_list.csv";
    if Path::new(mod_root).join(rel_path).exists() {
        vec![rel_path.to_string()]
    } else {
        vec![]
    }
}

pub fn load_mission_list_csv(mod_root: &str, rel_path: &str) -> AppResult<CsvTable> {
    let path = mission_list_path(mod_root, rel_path)?;
    read_csv_data(&path)
}

pub fn save_mission_list_csv(
    mod_root: &str,
    rel_path: &str,
    header: &[String],
    rows: &[Map<String, Value>],
) -> AppResult<()> {
    let path = mission_list_path(mod_root, rel_path)?;
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent)?;
    }
    save_csv_file(&path, header, rows)
}

pub fn load_mission(mod_root: &str, mission: &str) -> AppResult<MissionData> {
    let dir = mission_dir(mod_root, mission)?;
    let descriptor_path = dir.join("descriptor.json");
    let descriptor = if descriptor_path.exists() {
        read_json_file(&descriptor_path)?
    } else {
        Value::Object(Map::new())
    };
    let text_path = dir.join("mission_text.txt");
    let text = if text_path.exists() {
        read_utf8_no_bom(&text_path)?
    } else {
        String::new()
    };
    let icon_path = descriptor
        .get("icon")
        .and_then(Value::as_str)
        .map(|icon| format!("data/missions/{mission}/{icon}"));
    Ok(MissionData {
        descriptor,
        text,
        icon_path,
    })
}

pub fn save_mission(
    mod_root: &str,
    mission: &str,
    descriptor: &Value,
    text: &str,
) -> AppResult<()> {
    let dir = mission_dir(mod_root, mission)?;
    fs::create_dir_all(&dir)?;
    let clean = strip_internal_fields(descriptor);
    let json_string = serde_json::to_string_pretty(&clean)?;
    write_utf8_no_bom(&dir.join("descriptor.json"), &json_string)?;
    write_utf8_no_bom(&dir.join("mission_text.txt"), text)?;
    Ok(())
}

pub fn delete_mission_dir(mod_root: &str, mission: &str) -> AppResult<()> {
    let dir = mission_dir(mod_root, mission)?;
    if dir.exists() {
        fs::remove_dir_all(dir)?;
    }
    Ok(())
}

fn mission_dir(mod_root: &str, mission: &str) -> AppResult<std::path::PathBuf> {
    let clean = validate_config_id(mission, "无效战役 ID")?;
    Ok(Path::new(mod_root).join("data/missions").join(clean))
}

fn validate_config_id<'a>(id: &'a str, message: &str) -> AppResult<&'a str> {
    let clean = id.trim();
    if clean.is_empty()
        || clean.contains('/')
        || clean.contains('\\')
        || clean == "."
        || clean == ".."
        || clean.contains("..")
    {
        return Err(AppError::message(message));
    }
    Ok(clean)
}

fn mission_list_path(mod_root: &str, rel_path: &str) -> AppResult<std::path::PathBuf> {
    let clean = rel_path.replace('\\', "/");
    if clean != "data/missions/mission_list.csv" {
        return Err(AppError::message("无效战役列表路径"));
    }
    Ok(Path::new(mod_root).join(clean))
}

pub fn load_image_as_data_url(
    mod_root: &str,
    rel_path: &str,
    starsector_root: Option<&str>,
) -> AppResult<Option<String>> {
    let clean_path = rel_path.replace('\\', "/");

    // Try mod directory first
    let mod_path = Path::new(mod_root).join(&clean_path);
    if mod_path.exists() {
        return read_image_to_data_url(&mod_path);
    }

    // Fallback: try starsector-core directory
    if let Some(root) = starsector_root {
        let core_path = Path::new(root).join("starsector-core").join(&clean_path);
        if core_path.exists() {
            return read_image_to_data_url(&core_path);
        }
    }

    // Also try inferring starsector root from mod_root (parent of parent)
    if let Some(inferred_root) = Path::new(mod_root).parent().and_then(|p| p.parent()) {
        let core_path = inferred_root.join("starsector-core").join(&clean_path);
        if core_path.exists() {
            return read_image_to_data_url(&core_path);
        }
    }

    Ok(None)
}

fn read_image_to_data_url(path: &Path) -> AppResult<Option<String>> {
    let bytes = fs::read(path)?;
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

/// Scan starsector-core/graphics/ and return all image file paths (relative to starsector-core).
pub fn scan_core_graphics(starsector_root: &str) -> Vec<String> {
    let dir = Path::new(starsector_root)
        .join("starsector-core")
        .join("graphics");
    if !dir.exists() {
        return vec![];
    }
    let core_dir = Path::new(starsector_root).join("starsector-core");
    WalkDir::new(&dir)
        .into_iter()
        .flatten()
        .filter(|e| e.file_type().is_file())
        .filter(|e| {
            let ext = e.path().extension().and_then(|s| s.to_str()).unwrap_or("");
            matches!(ext, "png" | "jpg" | "jpeg" | "gif")
        })
        .filter_map(|e| {
            e.path()
                .strip_prefix(&core_dir)
                .ok()
                .map(|p| p.to_string_lossy().replace('\\', "/"))
        })
        .collect()
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
            // Check if it looks like a color [R, G, B] or [R, G, B, A]
            if (arr.len() == 3 || arr.len() == 4) && arr.iter().all(|v| v.is_i64() || v.is_u64()) {
                let all_in_range = arr
                    .iter()
                    .all(|v| v.as_i64().map(|n| (0..=255).contains(&n)).unwrap_or(false));
                if all_in_range {
                    return "color-rgba".to_string();
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

#[cfg(test)]
mod tests {
    use super::*;
    use crate::filesystem::write_utf8_no_bom;
    use std::{
        fs,
        path::PathBuf,
        time::{SystemTime, UNIX_EPOCH},
    };

    #[test]
    fn delete_mission_dir_removes_only_valid_mission_directory() {
        let root = temp_dir("delete_mission_dir");
        let mission = root.join("data/missions/demo");
        fs::create_dir_all(&mission).unwrap();
        write_utf8_no_bom(&mission.join("descriptor.json"), "{}").unwrap();

        delete_mission_dir(&root.to_string_lossy(), "demo").unwrap();

        assert!(!mission.exists());
        assert!(root.join("data/missions").exists());
        let _ = fs::remove_dir_all(root);
    }

    #[test]
    fn delete_mission_dir_rejects_path_traversal() {
        let root = temp_dir("delete_mission_dir_rejects");
        fs::create_dir_all(root.join("data/missions/demo")).unwrap();

        let result = delete_mission_dir(&root.to_string_lossy(), "../demo");

        assert!(result.is_err());
        assert!(root.join("data/missions/demo").exists());
        let _ = fs::remove_dir_all(root);
    }

    #[test]
    fn faction_id_rejects_path_traversal() {
        let root = temp_dir("faction_id_rejects");
        fs::create_dir_all(root.join("data/world/factions")).unwrap();

        let result = create_faction(&root.to_string_lossy(), "../demo");

        assert!(result.is_err());
        let _ = fs::remove_dir_all(root);
    }

    #[test]
    fn mission_list_path_rejects_non_list_path() {
        let root = temp_dir("mission_list_path_rejects");

        let result = load_mission_list_csv(&root.to_string_lossy(), "../mission_list.csv");

        assert!(result.is_err());
        let _ = fs::remove_dir_all(root);
    }

    #[test]
    fn delete_faction_can_remove_index_without_deleting_file() {
        let root = temp_dir("delete_faction_index_only");
        let dir = root.join("data/world/factions");
        fs::create_dir_all(&dir).unwrap();
        write_utf8_no_bom(
            &dir.join("factions.csv"),
            "id,file\r\ndemo,data/world/factions/demo.faction\r\n",
        )
        .unwrap();
        write_utf8_no_bom(&dir.join("demo.faction"), "{}").unwrap();

        delete_faction(&root.to_string_lossy(), "demo", false).unwrap();

        assert!(dir.join("demo.faction").exists());
        let table = read_csv_data(&dir.join("factions.csv")).unwrap();
        assert!(table.rows.is_empty());
        let _ = fs::remove_dir_all(root);
    }

    #[test]
    fn delete_faction_can_remove_index_and_file() {
        let root = temp_dir("delete_faction_with_file");
        let dir = root.join("data/world/factions");
        fs::create_dir_all(&dir).unwrap();
        write_utf8_no_bom(
            &dir.join("factions.csv"),
            "id,file\r\ndemo,data/world/factions/demo.faction\r\n",
        )
        .unwrap();
        write_utf8_no_bom(&dir.join("demo.faction"), "{}").unwrap();

        delete_faction(&root.to_string_lossy(), "demo", true).unwrap();

        assert!(!dir.join("demo.faction").exists());
        let table = read_csv_data(&dir.join("factions.csv")).unwrap();
        assert!(table.rows.is_empty());
        let _ = fs::remove_dir_all(root);
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
