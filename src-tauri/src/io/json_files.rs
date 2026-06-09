use crate::{
    errors::{AppError, AppResult},
    io::{read_utf8_no_bom, validate_walk_entry},
    parsers::parse_starsector_json,
};
use serde_json::{Map, Value};
use std::{collections::BTreeMap, path::Path};
use walkdir::WalkDir;

pub fn read_json_file(path: &Path) -> AppResult<Value> {
    let text = read_utf8_no_bom(path)?;
    parse_starsector_json(&text).map_err(|error| {
        AppError::context(format!("解析 JSON 文件失败 ({})", path.display()), error)
    })
}

pub fn load_json_dir_by_id(
    dir: &Path,
    ext: &str,
    id_key: &str,
) -> AppResult<BTreeMap<String, Value>> {
    let mut result = BTreeMap::new();
    for value in load_json_dir(dir, ext)? {
        if let Some(id) = value.get(id_key).and_then(Value::as_str) {
            result.insert(id.to_string(), value);
        }
    }
    Ok(result)
}

pub fn load_json_dir(dir: &Path, ext: &str) -> AppResult<Vec<Value>> {
    if !dir.exists() {
        return Ok(vec![]);
    }
    let mut values = Vec::new();
    for entry in WalkDir::new(dir).into_iter() {
        let entry = entry.map_err(|error| {
            AppError::context(
                format!("遍历 JSON 目录失败 ({})", dir.display()),
                AppError::message(error.to_string()),
            )
        })?;
        validate_walk_entry(entry.path(), "JSON directory")?;
        if entry.path().extension().and_then(|s| s.to_str()) == Some(ext) {
            values.push(read_json_file(entry.path())?);
        }
    }
    Ok(values)
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
