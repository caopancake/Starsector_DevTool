use crate::{
    errors::{AppError, AppResult},
    io::{read_text_bytes_no_bom, read_utf8_no_bom, validate_walk_entry, write_utf8_no_bom},
    models::CsvTableKey,
    parsers::parse_persisted_json,
};
use serde::{Deserialize, Serialize};
use serde_json::Value;
use std::{
    collections::{BTreeMap, HashMap},
    fs,
    path::{Path, PathBuf},
    sync::{Mutex, OnceLock},
};
use walkdir::WalkDir;

use super::super::{
    model::{CoreCache, SpecBundle},
    table_definitions,
};

const CACHE_FORMAT_VERSION: u32 = 1;
const CACHE_DIRECTORY: &str = "project-index-cache";
const MOD_INDEX_DIRECTORY: &str = "mods";
const CORE_INDEX_DIRECTORY: &str = "core";

static CACHE_ROOT: OnceLock<Mutex<Option<PathBuf>>> = OnceLock::new();

#[derive(Clone, Serialize, Deserialize)]
pub(crate) struct ProjectIndex {
    pub mod_info: Value,
    pub faction_files: BTreeMap<String, Value>,
    pub tag_map: HashMap<String, String>,
    pub mission_count: usize,
    pub spec_bundle: SpecBundle,
    pub table_entity_summaries: BTreeMap<CsvTableKey, usize>,
}

#[derive(Serialize, Deserialize)]
struct CachedProjectIndex {
    version: u32,
    root: String,
    fingerprint: SourceFingerprint,
    index: ProjectIndex,
}

#[derive(Serialize, Deserialize)]
struct CachedCoreIndex {
    version: u32,
    root: String,
    fingerprint: SourceFingerprint,
    cache: CoreCache,
}

#[derive(Debug, Serialize, Deserialize, PartialEq, Eq)]
struct SourceFingerprint {
    files: Vec<SourceFileFingerprint>,
}

#[derive(Debug, Serialize, Deserialize, PartialEq, Eq)]
struct SourceFileFingerprint {
    path: String,
    hash: String,
}

pub(crate) fn configure_persistent_index_cache(app_data_dir: &Path) -> AppResult<()> {
    let cache_root = app_data_dir.join(CACHE_DIRECTORY);
    let mut guard = CACHE_ROOT
        .get_or_init(|| Mutex::new(None))
        .lock()
        .map_err(|_| AppError::message("persistent project cache lock poisoned"))?;
    *guard = Some(cache_root);
    Ok(())
}

pub(crate) fn load_project_index(
    mod_root: &Path,
    starsector_root: Option<&Path>,
) -> AppResult<Option<ProjectIndex>> {
    let Some(cache_root) = configured_cache_root()? else {
        return Ok(None);
    };
    let root = normalized_root(mod_root)?;
    let fingerprint = project_fingerprint(mod_root, starsector_root)?;
    let path = cache_path(&cache_root, MOD_INDEX_DIRECTORY, &root);
    let Some(cached) = read_cache::<CachedProjectIndex>(&path) else {
        return Ok(None);
    };
    Ok((cached.version == CACHE_FORMAT_VERSION
        && cached.root == root
        && cached.fingerprint == fingerprint)
        .then_some(cached.index))
}

pub(crate) fn save_project_index(
    mod_root: &Path,
    starsector_root: Option<&Path>,
    index: ProjectIndex,
) -> AppResult<()> {
    let Some(cache_root) = configured_cache_root()? else {
        return Ok(());
    };
    let root = normalized_root(mod_root)?;
    let cached = CachedProjectIndex {
        version: CACHE_FORMAT_VERSION,
        root: root.clone(),
        fingerprint: project_fingerprint(mod_root, starsector_root)?,
        index,
    };
    write_cache(
        &cache_path(&cache_root, MOD_INDEX_DIRECTORY, &root),
        &cached,
    )
}

pub(super) fn load_core_cache(starsector_root: &str) -> AppResult<Option<CoreCache>> {
    let Some(cache_root) = configured_cache_root()? else {
        return Ok(None);
    };
    let root = normalized_root(Path::new(starsector_root))?;
    let core_dir = Path::new(starsector_root).join("starsector-core");
    let fingerprint = core_fingerprint(&core_dir)?;
    let path = cache_path(&cache_root, CORE_INDEX_DIRECTORY, &root);
    let Some(cached) = read_cache::<CachedCoreIndex>(&path) else {
        return Ok(None);
    };
    Ok((cached.version == CACHE_FORMAT_VERSION
        && cached.root == root
        && cached.fingerprint == fingerprint)
        .then_some(cached.cache))
}

pub(super) fn save_core_cache(starsector_root: &str, cache: &CoreCache) -> AppResult<()> {
    let Some(cache_root) = configured_cache_root()? else {
        return Ok(());
    };
    let root = normalized_root(Path::new(starsector_root))?;
    let core_dir = Path::new(starsector_root).join("starsector-core");
    let cached = CachedCoreIndex {
        version: CACHE_FORMAT_VERSION,
        root: root.clone(),
        fingerprint: core_fingerprint(&core_dir)?,
        cache: cache.clone(),
    };
    write_cache(
        &cache_path(&cache_root, CORE_INDEX_DIRECTORY, &root),
        &cached,
    )
}

fn configured_cache_root() -> AppResult<Option<PathBuf>> {
    CACHE_ROOT
        .get_or_init(|| Mutex::new(None))
        .lock()
        .map(|root| root.clone())
        .map_err(|_| AppError::message("persistent project cache lock poisoned"))
}

fn normalized_root(root: &Path) -> AppResult<String> {
    let root = root.canonicalize().map_err(|error| {
        AppError::context(
            format!("canonicalize cache root failed ({})", root.display()),
            error.into(),
        )
    })?;
    Ok(root
        .to_string_lossy()
        .replace('\\', "/")
        .to_ascii_lowercase())
}

fn project_fingerprint(
    mod_root: &Path,
    starsector_root: Option<&Path>,
) -> AppResult<SourceFingerprint> {
    let mut files = session_source_files(mod_root)?;
    if let Some(root) = starsector_root {
        files.extend(projectile_source_files(&root.join("starsector-core"))?);
    }
    fingerprint_files(files)
}

fn core_fingerprint(core_dir: &Path) -> AppResult<SourceFingerprint> {
    let mut files = session_source_files(core_dir)?;
    files.extend(projectile_source_files(core_dir)?);
    fingerprint_files(files)
}

fn session_source_files(root: &Path) -> AppResult<Vec<(String, PathBuf)>> {
    let mut files = Vec::new();
    collect_exact_file(root, "mod_info.json", &mut files);
    collect_exact_file(root, "data/world/factions/factions.csv", &mut files);
    collect_exact_file(root, "data/missions/mission_list.csv", &mut files);
    for definition in table_definitions::csv_table_definitions() {
        collect_exact_file(root, definition.rel_path, &mut files);
    }
    collect_extension_files(root, "data/world", &["faction"], &mut files)?;
    collect_extension_files(root, "data/hulls", &["ship", "skin"], &mut files)?;
    collect_extension_files(root, "data/weapons", &["wpn"], &mut files)?;
    collect_extension_files(root, "data/variants", &["variant"], &mut files)?;
    collect_extension_files(root, "data/shipsystems", &["system"], &mut files)?;
    collect_extension_files(root, "data/characters/skills", &["skill"], &mut files)?;
    Ok(files)
}

fn projectile_source_files(root: &Path) -> AppResult<Vec<(String, PathBuf)>> {
    let mut files = Vec::new();
    collect_extension_files(root, "data/weapons/proj", &["proj"], &mut files)?;
    Ok(files)
}

fn collect_exact_file(root: &Path, rel_path: &str, files: &mut Vec<(String, PathBuf)>) {
    let path = root.join(rel_path);
    if path.exists() {
        files.push((rel_path.to_string(), path));
    } else {
        files.push((format!("{rel_path}:missing"), path));
    }
}

fn collect_extension_files(
    root: &Path,
    rel_dir: &str,
    extensions: &[&str],
    files: &mut Vec<(String, PathBuf)>,
) -> AppResult<()> {
    let dir = root.join(rel_dir);
    if !dir.exists() {
        return Ok(());
    }
    validate_walk_entry(&dir, "project source directory")?;
    for entry in WalkDir::new(&dir) {
        let entry = entry.map_err(|error| {
            AppError::message(format!(
                "walk project source directory failed ({}): {error}",
                dir.display()
            ))
        })?;
        let path = entry.path();
        validate_walk_entry(path, "project source file")?;
        if !entry.file_type().is_file()
            || !path
                .extension()
                .and_then(|extension| extension.to_str())
                .is_some_and(|extension| {
                    extensions
                        .iter()
                        .any(|value| extension.eq_ignore_ascii_case(value))
                })
        {
            continue;
        }
        let rel_path = path.strip_prefix(root).map_err(|error| {
            AppError::message(format!(
                "project source path escapes root ({}): {error}",
                path.display()
            ))
        })?;
        files.push((normalize_rel_path(rel_path), path.to_path_buf()));
    }
    Ok(())
}

fn fingerprint_files(mut files: Vec<(String, PathBuf)>) -> AppResult<SourceFingerprint> {
    files.sort_by(|left, right| left.0.cmp(&right.0));
    let files = files
        .into_iter()
        .map(|(path, source)| {
            let hash = if source.exists() {
                hash_bytes(&read_text_bytes_no_bom(&source)?)
            } else {
                "missing".to_string()
            };
            Ok(SourceFileFingerprint { path, hash })
        })
        .collect::<AppResult<Vec<_>>>()?;
    Ok(SourceFingerprint { files })
}

fn read_cache<T: for<'de> Deserialize<'de>>(path: &Path) -> Option<T> {
    parse_persisted_json(&read_utf8_no_bom(path).ok()?).ok()
}

fn write_cache<T: Serialize>(path: &Path, value: &T) -> AppResult<()> {
    let parent = path
        .parent()
        .ok_or_else(|| AppError::message("cache file has no parent"))?;
    fs::create_dir_all(parent).map_err(|error| {
        AppError::context(
            format!(
                "create project cache directory failed ({})",
                parent.display()
            ),
            error.into(),
        )
    })?;
    let json = serde_json::to_string(value)?;
    write_utf8_no_bom(path, &json)
}

fn cache_path(cache_root: &Path, category: &str, root: &str) -> PathBuf {
    cache_root
        .join(category)
        .join(format!("{:016x}.json", stable_hash(root.as_bytes())))
}

fn hash_bytes(bytes: &[u8]) -> String {
    format!("{:016x}", stable_hash(bytes))
}

fn stable_hash(bytes: &[u8]) -> u64 {
    bytes.iter().fold(0xcbf2_9ce4_8422_2325_u64, |hash, byte| {
        (hash ^ u64::from(*byte)).wrapping_mul(0x0000_0100_0000_01b3)
    })
}

fn normalize_rel_path(path: &Path) -> String {
    path.to_string_lossy().replace('\\', "/")
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn stable_hash_is_content_sensitive_and_repeatable() {
        assert_eq!(stable_hash(b"same"), stable_hash(b"same"));
        assert_ne!(stable_hash(b"same"), stable_hash(b"changed"));
    }
}
