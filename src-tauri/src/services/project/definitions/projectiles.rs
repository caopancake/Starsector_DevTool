use crate::{errors::AppResult, io::load_json_dir, models::ResourceSource};
use serde_json::Value;
use std::{collections::BTreeMap, path::Path};

pub(super) fn load_projectile_specs(
    mod_root: &Path,
    core_projectiles: Option<BTreeMap<String, Value>>,
) -> AppResult<BTreeMap<String, Value>> {
    let mut result = BTreeMap::new();
    insert_projectiles(
        &mut result,
        &mod_root.join("data/weapons/proj"),
        ResourceSource::Mod,
    )?;
    if let Some(core_projectiles) = core_projectiles {
        for (id, value) in core_projectiles {
            result.entry(id).or_insert(value);
        }
    }
    Ok(result)
}

fn insert_projectiles(
    result: &mut BTreeMap<String, Value>,
    dir: &Path,
    source: ResourceSource,
) -> AppResult<()> {
    for mut value in load_json_dir(dir, "proj")? {
        if let Some(id) = value
            .get("id")
            .and_then(Value::as_str)
            .map(ToString::to_string)
        {
            if let Value::Object(obj) = &mut value {
                obj.insert(
                    "_source".to_string(),
                    Value::String(source.as_str().to_string()),
                );
            }
            result.insert(id, value);
        }
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::io::write_utf8_no_bom;
    use crate::testutil::temp_dir;
    use std::fs;

    #[test]
    fn mod_projectile_overrides_core_fallback() {
        let root = temp_dir("projectile_fallback");
        let mod_proj = root.join("mod/data/weapons/proj");
        let core_proj = root.join("core/starsector-core/data/weapons/proj");
        fs::create_dir_all(&mod_proj).unwrap();
        fs::create_dir_all(&core_proj).unwrap();
        write_utf8_no_bom(&mod_proj.join("same.proj"), r#"{"id":"same","damage":2}"#).unwrap();
        write_utf8_no_bom(&core_proj.join("same.proj"), r#"{"id":"same","damage":1}"#).unwrap();
        write_utf8_no_bom(&core_proj.join("core_only.proj"), r#"{"id":"core_only"}"#).unwrap();

        let mut core_projectiles = BTreeMap::new();
        for mut value in load_json_dir(&core_proj, "proj").unwrap() {
            let id = value["id"].as_str().unwrap().to_string();
            value["_source"] = Value::String(ResourceSource::Core.as_str().to_string());
            core_projectiles.insert(id, value);
        }
        let loaded = load_projectile_specs(&root.join("mod"), Some(core_projectiles)).unwrap();

        let _ = fs::remove_dir_all(root);
        assert_eq!(loaded["same"]["damage"], 2);
        assert_eq!(loaded["same"]["_source"], ResourceSource::Mod.as_str());
        assert_eq!(
            loaded["core_only"]["_source"],
            ResourceSource::Core.as_str()
        );
    }
}
