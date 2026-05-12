use crate::{errors::AppResult, parsers::parse_starsector_json};
use serde_json::{Map, Value};
use std::{collections::BTreeMap, fs, path::Path};
use walkdir::WalkDir;

pub fn read_json_file(path: &Path) -> AppResult<Value> {
    let text = fs::read_to_string(path)?;
    parse_starsector_json(&text)
}

pub fn load_json_dir_by_id(dir: &Path, ext: &str, id_key: &str) -> BTreeMap<String, Value> {
    let mut result = BTreeMap::new();
    for value in load_json_dir(dir, ext) {
        if let Some(id) = value.get(id_key).and_then(Value::as_str) {
            result.insert(id.to_string(), value);
        }
    }
    result
}

pub fn load_json_dir(dir: &Path, ext: &str) -> Vec<Value> {
    if !dir.exists() {
        return vec![];
    }
    WalkDir::new(dir)
        .max_depth(1)
        .into_iter()
        .flatten()
        .filter(|entry| entry.path().extension().and_then(|s| s.to_str()) == Some(ext))
        .filter_map(|entry| read_json_file(entry.path()).ok())
        .collect()
}

pub fn save_json_by_id(
    mod_root: &Path,
    rel_dir: &str,
    ext: &str,
    id_key: &str,
    id: &str,
    data: &Value,
) -> AppResult<String> {
    let dir = mod_root.join(rel_dir);
    fs::create_dir_all(&dir)?;
    let mut target = None;
    if dir.exists() {
        for entry in WalkDir::new(&dir).max_depth(1).into_iter().flatten() {
            if entry.path().extension().and_then(|s| s.to_str()) != Some(ext) {
                continue;
            }
            if let Ok(value) = read_json_file(entry.path()) {
                if value.get(id_key).and_then(Value::as_str) == Some(id) {
                    target = Some(entry.path().to_path_buf());
                    break;
                }
            }
        }
    }
    let target = target.unwrap_or_else(|| dir.join(format!("{id}.{ext}")));
    let clean = strip_internal_fields(data);
    fs::write(&target, serde_json::to_string_pretty(&clean)?)?;
    Ok(relative_path(mod_root, &target))
}

pub fn delete_json_by_id(mod_root: &Path, rel_dir: &str, ext: &str, id_key: &str, id: &str) -> AppResult<bool> {
    let dir = mod_root.join(rel_dir);
    if !dir.exists() {
        return Ok(false);
    }
    for entry in WalkDir::new(dir).max_depth(1).into_iter().flatten() {
        if entry.path().extension().and_then(|s| s.to_str()) != Some(ext) {
            continue;
        }
        if let Ok(value) = read_json_file(entry.path()) {
            if value.get(id_key).and_then(Value::as_str) == Some(id) {
                fs::remove_file(entry.path())?;
                return Ok(true);
            }
        }
    }
    Ok(false)
}

pub fn strip_internal_fields(value: &Value) -> Value {
    match value {
        Value::Object(obj) => {
            let mut clean = Map::new();
            for (key, val) in obj {
                if !key.starts_with('_') {
                    clean.insert(key.clone(), strip_internal_fields(val));
                }
            }
            Value::Object(clean)
        }
        Value::Array(items) => Value::Array(items.iter().map(strip_internal_fields).collect()),
        other => other.clone(),
    }
}

fn relative_path(root: &Path, path: &Path) -> String {
    path.strip_prefix(root).unwrap_or(path).to_string_lossy().replace('\\', "/")
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn strips_internal_fields_recursively() {
        let value = serde_json::json!({"id":"x","_source":"mod","nested":{"_temp":1,"ok":2}});
        let clean = strip_internal_fields(&value);
        assert!(clean.get("_source").is_none());
        assert_eq!(clean["nested"]["ok"], 2);
        assert!(clean["nested"].get("_temp").is_none());
    }
}
