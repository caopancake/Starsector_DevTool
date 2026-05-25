use crate::{errors::AppResult, io::load_json_dir, models::ResourceSource};
use serde_json::Value;
use std::{collections::BTreeMap, path::Path};

pub(super) fn load_projectile_specs(
    mod_root: &Path,
    core_dir: Option<&Path>,
) -> AppResult<BTreeMap<String, Value>> {
    let mut result = BTreeMap::new();
    insert_projectiles(
        &mut result,
        &mod_root.join("data/weapons/proj"),
        ResourceSource::Mod,
        true,
    )?;
    if let Some(core) = core_dir {
        insert_projectiles(
            &mut result,
            &core.join("data/weapons/proj"),
            ResourceSource::Core,
            false,
        )?;
    }
    Ok(result)
}

fn insert_projectiles(
    result: &mut BTreeMap<String, Value>,
    dir: &Path,
    source: ResourceSource,
    overwrite: bool,
) -> AppResult<()> {
    for mut value in load_json_dir(dir, "proj")? {
        if let Some(id) = value
            .get("id")
            .and_then(Value::as_str)
            .map(ToString::to_string)
        {
            if !overwrite && result.contains_key(&id) {
                continue;
            }
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
    use std::{
        fs,
        path::PathBuf,
        time::{SystemTime, UNIX_EPOCH},
    };

    #[test]
    fn mod_projectile_overrides_core_fallback() {
        let root = temp_dir("projectile_fallback");
        let mod_proj = root.join("mod/data/weapons/proj");
        let core_proj = root.join("core/data/weapons/proj");
        fs::create_dir_all(&mod_proj).unwrap();
        fs::create_dir_all(&core_proj).unwrap();
        write_utf8_no_bom(&mod_proj.join("same.proj"), r#"{"id":"same","damage":2}"#).unwrap();
        write_utf8_no_bom(&core_proj.join("same.proj"), r#"{"id":"same","damage":1}"#).unwrap();
        write_utf8_no_bom(&core_proj.join("core_only.proj"), r#"{"id":"core_only"}"#).unwrap();

        let loaded = load_projectile_specs(&root.join("mod"), Some(&root.join("core"))).unwrap();

        let _ = fs::remove_dir_all(root);
        assert_eq!(loaded["same"]["damage"], 2);
        assert_eq!(loaded["same"]["_source"], ResourceSource::Mod.as_str());
        assert_eq!(
            loaded["core_only"]["_source"],
            ResourceSource::Core.as_str()
        );
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
