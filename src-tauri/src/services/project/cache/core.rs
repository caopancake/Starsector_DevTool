use crate::{
    errors::{AppError, AppResult},
    io::{load_json_dir_by_id, read_csv_data, FsRootBoundary},
    models::{CsvTableKey, SkinFile, VariantFile},
};
use serde_json::Value;
use std::{
    collections::BTreeMap,
    path::{Path, PathBuf},
};

use super::super::{
    model::{CoreCache, CoreSourceData, SessionCsvRow, SessionCsvTable},
    spec_files::{load_skin_files, load_variant_files},
    table_definitions::csv_table_definition,
};
use super::{core_caches, persistent};

pub(crate) fn core_cache_snapshot(starsector_root: &str) -> AppResult<CoreCache> {
    let cache_key = core_cache_key(starsector_root)?;
    if let Some(cache) = core_caches()
        .lock()
        .map_err(|_| AppError::message("core cache lock poisoned"))?
        .get(&cache_key)
        .cloned()
    {
        return Ok(cache);
    }
    let cache = persistent::load_core_cache(starsector_root)?.unwrap_or_else(|| CoreCache {
        csv_tables: BTreeMap::new(),
        ship_files: None,
        variant_files: None,
        skin_files: None,
        weapon_specs: None,
        projectile_specs: None,
    });
    let mut guard = core_caches()
        .lock()
        .map_err(|_| AppError::message("core cache lock poisoned"))?;
    Ok(guard
        .entry(cache_key)
        .or_insert_with(|| cache.clone())
        .clone())
}

pub(crate) fn replace_core_cache(starsector_root: &str, cache: CoreCache) -> AppResult<()> {
    let cache_key = core_cache_key(starsector_root)?;
    core_caches()
        .lock()
        .map_err(|_| AppError::message("core cache lock poisoned"))?
        .insert(cache_key, cache);
    let snapshot = core_cache_snapshot(starsector_root)?;
    let _ = persistent::save_core_cache(starsector_root, &snapshot);
    Ok(())
}

pub(super) fn core_cache_key(starsector_root: &str) -> AppResult<String> {
    let root = FsRootBoundary::new(Path::new(starsector_root), "starsector root")?;
    Ok(root
        .root()
        .to_string_lossy()
        .replace('\\', "/")
        .to_ascii_lowercase())
}

pub(crate) fn core_dir(starsector_root: &str) -> AppResult<PathBuf> {
    let root = FsRootBoundary::new(Path::new(starsector_root), "starsector root")?;
    Ok(root.root().join("starsector-core"))
}

pub(crate) fn load_core_csv_table(
    starsector_root: &str,
    table: CsvTableKey,
) -> AppResult<Option<SessionCsvTable>> {
    let table_key = table.as_str();
    let mut cache = core_cache_snapshot(starsector_root)?;
    if let Some(csv) = cache.csv_tables.get(table_key) {
        return Ok(Some(csv.clone()));
    }
    let rel = csv_table_definition(table).rel_path;
    let core_dir = core_dir(starsector_root)?;
    if !core_dir.exists() {
        replace_core_cache(starsector_root, cache)?;
        return Ok(None);
    }
    let csv = read_csv_data(&core_dir.join(rel))?;
    let table_state = SessionCsvTable {
        header: csv.header,
        path: rel.to_string(),
        rows: Some(
            csv.rows
                .into_iter()
                .enumerate()
                .map(|(index, row)| SessionCsvRow {
                    row_key: format!("core:{table_key}:row:{index}"),
                    row,
                })
                .collect(),
        ),
    };
    cache
        .csv_tables
        .insert(table_key.to_string(), table_state.clone());
    replace_core_cache(starsector_root, cache)?;
    Ok(Some(table_state))
}

pub(crate) fn load_core_ship_files(starsector_root: &str) -> AppResult<BTreeMap<String, Value>> {
    let mut cache = core_cache_snapshot(starsector_root)?;
    if let Some(files) = cache.ship_files.clone() {
        return Ok(files);
    }
    let core_dir = core_dir(starsector_root)?;
    let files = if core_dir.exists() {
        load_json_dir_by_id(&core_dir.join("data/hulls"), "ship", "hullId")?
    } else {
        BTreeMap::new()
    };
    cache.ship_files = Some(files.clone());
    replace_core_cache(starsector_root, cache)?;
    Ok(files)
}

pub(crate) fn load_core_weapon_specs(starsector_root: &str) -> AppResult<BTreeMap<String, Value>> {
    let mut cache = core_cache_snapshot(starsector_root)?;
    if let Some(files) = cache.weapon_specs.clone() {
        return Ok(files);
    }
    let core_dir = core_dir(starsector_root)?;
    let files = if core_dir.exists() {
        load_json_dir_by_id(&core_dir.join("data/weapons"), "wpn", "id")?
    } else {
        BTreeMap::new()
    };
    cache.weapon_specs = Some(files.clone());
    replace_core_cache(starsector_root, cache)?;
    Ok(files)
}

pub(crate) fn load_core_projectile_specs(
    starsector_root: &str,
) -> AppResult<BTreeMap<String, Value>> {
    let mut cache = core_cache_snapshot(starsector_root)?;
    if let Some(files) = cache.projectile_specs.clone() {
        return Ok(files);
    }
    let core_dir = core_dir(starsector_root)?;
    let files = if core_dir.exists() {
        let mut files = load_json_dir_by_id(&core_dir.join("data/weapons/proj"), "proj", "id")?;
        for value in files.values_mut() {
            if let Value::Object(object) = value {
                object.insert(
                    "_source".to_string(),
                    Value::String(crate::models::ResourceSource::Core.as_str().to_string()),
                );
            }
        }
        files
    } else {
        BTreeMap::new()
    };
    cache.projectile_specs = Some(files.clone());
    replace_core_cache(starsector_root, cache)?;
    Ok(files)
}

pub(crate) fn load_core_variant_files(starsector_root: &str) -> AppResult<Vec<VariantFile>> {
    let mut cache = core_cache_snapshot(starsector_root)?;
    if let Some(files) = cache.variant_files.clone() {
        return Ok(files);
    }
    let core_dir = core_dir(starsector_root)?;
    let files = if core_dir.exists() {
        load_variant_files(&core_dir)?.0
    } else {
        Vec::new()
    };
    cache.variant_files = Some(files.clone());
    replace_core_cache(starsector_root, cache)?;
    Ok(files)
}

pub(crate) fn load_core_skin_files(starsector_root: &str) -> AppResult<Vec<SkinFile>> {
    let mut cache = core_cache_snapshot(starsector_root)?;
    if let Some(files) = cache.skin_files.clone() {
        return Ok(files);
    }
    let core_dir = core_dir(starsector_root)?;
    let files = if core_dir.exists() {
        load_skin_files(&core_dir)?.0
    } else {
        Vec::new()
    };
    cache.skin_files = Some(files.clone());
    replace_core_cache(starsector_root, cache)?;
    Ok(files)
}

pub(crate) fn load_core_source_data(
    starsector_root: &str,
    table: CsvTableKey,
) -> AppResult<CoreSourceData> {
    let mut data = CoreSourceData::default();
    let requirements = csv_table_definition(table).core_source_requirements;
    if requirements.ships {
        data.ship_files = load_core_ship_files(starsector_root)?;
    }
    if requirements.weapons {
        data.weapon_specs = load_core_weapon_specs(starsector_root)?;
    }
    if requirements.variants {
        data.variant_files = load_core_variant_files(starsector_root)?;
    }
    Ok(data)
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::{
        fs,
        time::{SystemTime, UNIX_EPOCH},
    };

    #[test]
    fn core_cache_rejects_parent_dir_root() {
        let root = temp_dir("core_cache_parent_dir_root");
        let escaped = root.join("..");

        let error = load_core_ship_files(&escaped.to_string_lossy())
            .unwrap_err()
            .to_string();

        let _ = fs::remove_dir_all(root);
        assert!(error.contains("invalid starsector root path"));
    }

    #[test]
    fn core_cache_key_normalizes_root_identity() {
        let root = temp_dir("core_cache_key");
        let left = core_cache_key(&root.to_string_lossy()).unwrap();
        let right = core_cache_key(&root.join(".").to_string_lossy()).unwrap();

        let _ = fs::remove_dir_all(root);
        assert_eq!(left, right);
    }

    #[test]
    fn persistent_core_cache_rejects_changed_source_content() {
        let root = temp_dir("persistent_core_cache");
        let cache_root = temp_dir("persistent_core_cache_root");
        let hull_dir = root.join("starsector-core/data/hulls");
        fs::create_dir_all(&hull_dir).unwrap();
        crate::io::write_utf8_no_bom(
            &hull_dir.join("demo.ship"),
            r#"{"hullId":"demo","spriteName":"before"}"#,
        )
        .unwrap();
        persistent::configure_persistent_index_cache(&cache_root).unwrap();

        let loaded = load_core_ship_files(&root.to_string_lossy()).unwrap();
        let persisted = persistent::load_core_cache(&root.to_string_lossy()).unwrap();
        crate::io::write_utf8_no_bom(
            &hull_dir.join("demo.ship"),
            r#"{"hullId":"demo","spriteName":"after"}"#,
        )
        .unwrap();
        super::super::invalidate_core_cache(&root.to_string_lossy()).unwrap();
        let changed = load_core_ship_files(&root.to_string_lossy()).unwrap();

        let _ = fs::remove_dir_all(root);
        let _ = fs::remove_dir_all(cache_root);
        assert_eq!(loaded["demo"]["spriteName"], "before");
        assert!(persisted.and_then(|cache| cache.ship_files).is_some());
        assert_eq!(changed["demo"]["spriteName"], "after");
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
