mod factions;
mod projectiles;
mod sprites;
mod tables;

use crate::{
    domain::config::{build_skin_file, build_variant_file},
    errors::AppResult,
    io::{list_sprites, load_json_dir_by_id, read_json_file},
    models::{
        AppData, CoreReferences, FactionMeta, GameModSummary, GameOverviewData, GameScanWarning,
        OpenDirectoryResult, SkinFile, VariantFile,
    },
    parsers::read_csv_data,
};
use serde_json::{Map, Value};
use std::{
    collections::{BTreeMap, HashMap},
    fs,
    path::{Path, PathBuf},
};

struct SpecBundle {
    ship_files: BTreeMap<String, Value>,
    variants: BTreeMap<String, Vec<Value>>,
    variant_files: Vec<VariantFile>,
    skin_files: Vec<SkinFile>,
    wpn_files: BTreeMap<String, Value>,
    proj_files: BTreeMap<String, Value>,
    system_files: BTreeMap<String, Value>,
    skill_files: BTreeMap<String, Value>,
}

struct SpriteBundle {
    ship_sprites: BTreeMap<String, String>,
    available_sprites: Vec<String>,
    weapon_sprites: Vec<String>,
    weapon_sprites_data: BTreeMap<String, BTreeMap<String, String>>,
    hullmod_sprites: BTreeMap<String, String>,
    ship_system_sprites: BTreeMap<String, String>,
    industry_sprites: BTreeMap<String, String>,
    skill_sprites: BTreeMap<String, String>,
    ability_sprites: BTreeMap<String, String>,
    commodity_sprites: BTreeMap<String, String>,
    submarket_sprites: BTreeMap<String, String>,
}

struct SpriteTableRows<'a> {
    hullmods: &'a [Map<String, Value>],
    industries: &'a [Map<String, Value>],
    ship_systems: &'a [Map<String, Value>],
    skills: &'a [Map<String, Value>],
    abilities: &'a [Map<String, Value>],
    commodities: &'a [Map<String, Value>],
    submarkets: &'a [Map<String, Value>],
}

pub fn load_mod_data(mod_root: &Path) -> AppResult<AppData> {
    load_mod_data_with_root(mod_root, None)
}

pub fn load_mod_data_for_command(mod_root: String) -> AppResult<AppData> {
    load_mod_data(Path::new(&mod_root))
}

pub fn load_csv_table(mod_root: &Path, table: &str) -> AppResult<crate::models::CsvTable> {
    tables::load_csv_table(mod_root, table)
}

pub fn load_csv_table_for_command(
    payload: crate::models::LoadCsvTablePayload,
) -> AppResult<crate::models::CsvTable> {
    load_csv_table(Path::new(&payload.mod_root), &payload.table)
}

pub fn load_mod_data_with_root(
    mod_root: &Path,
    starsector_root_override: Option<&Path>,
) -> AppResult<AppData> {
    let starsector_root = starsector_root_override
        .map(Path::to_path_buf)
        .or_else(|| infer_starsector_root(mod_root));
    let core_dir = starsector_root.as_ref().map(|p| p.join("starsector-core"));
    let core_available = core_dir.as_ref().is_some_and(|p| p.exists());
    let mod_info = read_mod_info(mod_root);

    let (mut faction_meta, tag_map) = factions::discover_factions(mod_root)?;
    ensure_other_faction(&mut faction_meta);
    let faction_files = factions::load_faction_files(mod_root)?;
    let mission_count = count_mission_list_entries(mod_root);

    let mut loaded_tables = tables::load_csv_tables(mod_root, &tag_map)?;
    let spec_bundle = load_spec_bundle(mod_root, core_dir.as_deref())?;
    let hullmods = loaded_tables
        .rows
        .get("hullmods")
        .cloned()
        .unwrap_or_default();
    let industries = loaded_tables
        .rows
        .get("industries")
        .cloned()
        .unwrap_or_default();
    let ship_systems = loaded_tables
        .rows
        .get("shipSystems")
        .cloned()
        .unwrap_or_default();
    let skills = loaded_tables
        .rows
        .get("skills")
        .cloned()
        .unwrap_or_default();
    let abilities = loaded_tables
        .rows
        .get("abilities")
        .cloned()
        .unwrap_or_default();
    let commodities = loaded_tables
        .rows
        .get("commodities")
        .cloned()
        .unwrap_or_default();
    let submarkets = loaded_tables
        .rows
        .get("submarkets")
        .cloned()
        .unwrap_or_default();
    let sprite_bundle = load_sprite_bundle(
        mod_root,
        core_dir.as_deref(),
        &spec_bundle.ship_files,
        &spec_bundle.skin_files,
        &spec_bundle.wpn_files,
        SpriteTableRows {
            hullmods: &hullmods,
            industries: &industries,
            ship_systems: &ship_systems,
            skills: &skills,
            abilities: &abilities,
            commodities: &commodities,
            submarkets: &submarkets,
        },
    )?;
    let core_references = load_core_references(core_dir.as_deref())?;

    Ok(AppData {
        mod_root: mod_root.to_string_lossy().to_string(),
        starsector_root: starsector_root.map(|p| p.to_string_lossy().to_string()),
        core_available,
        mod_info,
        faction_meta,
        faction_files,
        mission_count,
        csv_headers: loaded_tables.csv_headers,
        csv_paths: loaded_tables.csv_paths,
        ships: loaded_tables.rows.remove("ships").unwrap_or_default(),
        weapons: loaded_tables.rows.remove("weapons").unwrap_or_default(),
        wings: loaded_tables.rows.remove("wings").unwrap_or_default(),
        hullmods: loaded_tables.rows.remove("hullmods").unwrap_or_default(),
        ship_systems: loaded_tables.rows.remove("shipSystems").unwrap_or_default(),
        industries: loaded_tables.rows.remove("industries").unwrap_or_default(),
        skills: loaded_tables.rows.remove("skills").unwrap_or_default(),
        abilities: loaded_tables.rows.remove("abilities").unwrap_or_default(),
        commodities: loaded_tables.rows.remove("commodities").unwrap_or_default(),
        submarkets: loaded_tables.rows.remove("submarkets").unwrap_or_default(),
        ship_files: spec_bundle.ship_files,
        variants: spec_bundle.variants,
        variant_files: spec_bundle.variant_files,
        skin_files: spec_bundle.skin_files,
        ship_sprites: sprite_bundle.ship_sprites,
        available_sprites: sprite_bundle.available_sprites,
        wpn_files: spec_bundle.wpn_files,
        proj_files: spec_bundle.proj_files,
        system_files: spec_bundle.system_files,
        skill_files: spec_bundle.skill_files,
        weapon_sprites: sprite_bundle.weapon_sprites,
        weapon_sprites_data: sprite_bundle.weapon_sprites_data,
        hullmod_sprites: sprite_bundle.hullmod_sprites,
        ship_system_sprites: sprite_bundle.ship_system_sprites,
        industry_sprites: sprite_bundle.industry_sprites,
        skill_sprites: sprite_bundle.skill_sprites,
        ability_sprites: sprite_bundle.ability_sprites,
        commodity_sprites: sprite_bundle.commodity_sprites,
        submarket_sprites: sprite_bundle.submarket_sprites,
        core_references,
    })
}

pub fn load_mod_data_with_root_for_command(
    mod_root: String,
    starsector_root: Option<String>,
) -> AppResult<AppData> {
    load_mod_data_with_root(
        Path::new(&mod_root),
        starsector_root.as_deref().map(Path::new),
    )
}

fn load_spec_bundle(mod_root: &Path, core_dir: Option<&Path>) -> AppResult<SpecBundle> {
    let ship_files = load_json_dir_by_id(&mod_root.join("data/hulls"), "ship", "hullId")?;
    let wpn_files = load_json_dir_by_id(&mod_root.join("data/weapons"), "wpn", "id")?;
    let variant_files = load_variant_files(mod_root)?;
    let variants = group_variants_by_hull(&variant_files);
    let skin_files = load_skin_files(mod_root)?;
    Ok(SpecBundle {
        ship_files,
        variants,
        variant_files,
        skin_files,
        wpn_files,
        proj_files: projectiles::load_projectile_files(mod_root, core_dir)?,
        system_files: load_json_dir_by_id(&mod_root.join("data/shipsystems"), "system", "id")?,
        skill_files: load_json_dir_by_id(&mod_root.join("data/characters/skills"), "skill", "id")?,
    })
}

fn load_sprite_bundle(
    mod_root: &Path,
    core_dir: Option<&Path>,
    ship_files: &BTreeMap<String, Value>,
    skin_files: &[SkinFile],
    wpn_files: &BTreeMap<String, Value>,
    table_rows: SpriteTableRows<'_>,
) -> AppResult<SpriteBundle> {
    let mut ship_sprites = sprites::load_ship_sprite_data(mod_root, core_dir, ship_files)?;
    sprites::merge_skin_sprite_data(&mut ship_sprites, mod_root, core_dir, skin_files)?;
    Ok(SpriteBundle {
        ship_sprites,
        available_sprites: list_sprites(mod_root, &["graphics/ships"]),
        weapon_sprites: list_sprites(
            mod_root,
            &["graphics/weapons", "graphics/missiles", "graphics/fx"],
        ),
        weapon_sprites_data: sprites::load_weapon_sprite_data(mod_root, core_dir, wpn_files),
        hullmod_sprites: sprites::load_hullmod_sprite_data(mod_root, core_dir, table_rows.hullmods),
        ship_system_sprites: sprites::load_ship_system_sprite_data(
            mod_root,
            core_dir,
            table_rows.ship_systems,
        ),
        industry_sprites: sprites::load_industry_sprite_data(
            mod_root,
            core_dir,
            table_rows.industries,
        ),
        skill_sprites: sprites::load_skill_sprite_data(mod_root, core_dir, table_rows.skills),
        ability_sprites: sprites::load_ability_sprite_data(
            mod_root,
            core_dir,
            table_rows.abilities,
        ),
        commodity_sprites: sprites::load_commodity_sprite_data(
            mod_root,
            core_dir,
            table_rows.commodities,
        ),
        submarket_sprites: sprites::load_submarket_sprite_data(
            mod_root,
            core_dir,
            table_rows.submarkets,
        ),
    })
}

fn load_core_references(core_dir: Option<&Path>) -> AppResult<CoreReferences> {
    let Some(core_dir) = core_dir.filter(|path| path.exists()) else {
        return Ok(CoreReferences::default());
    };

    let tables = load_core_reference_tables(core_dir)?;
    let ship_files = load_json_dir_by_id(&core_dir.join("data/hulls"), "ship", "hullId")?;
    let wpn_files = load_json_dir_by_id(&core_dir.join("data/weapons"), "wpn", "id")?;
    let variant_files = load_variant_files(core_dir)?;
    let skin_files = load_skin_files(core_dir)?;
    let empty: &[Map<String, Value>] = &[];
    let hullmods = tables.get("hullmods").map(Vec::as_slice).unwrap_or(empty);
    let industries = tables.get("industries").map(Vec::as_slice).unwrap_or(empty);
    let ship_systems = tables
        .get("shipSystems")
        .map(Vec::as_slice)
        .unwrap_or(empty);
    let skills = tables.get("skills").map(Vec::as_slice).unwrap_or(empty);
    let abilities = tables.get("abilities").map(Vec::as_slice).unwrap_or(empty);
    let commodities = tables
        .get("commodities")
        .map(Vec::as_slice)
        .unwrap_or(empty);
    let submarkets = tables.get("submarkets").map(Vec::as_slice).unwrap_or(empty);
    let wings = tables.get("wings").map(Vec::as_slice).unwrap_or(empty);
    let mut ship_sprites = sprites::load_ship_sprite_data(core_dir, None, &ship_files)?;
    sprites::merge_skin_sprite_data(&mut ship_sprites, core_dir, None, &skin_files)?;
    let wing_sprites = sprites::load_wing_sprite_data(&ship_sprites, &variant_files, wings);
    let weapon_sprites_data = sprites::load_weapon_sprite_data(core_dir, None, &wpn_files);
    let hullmod_sprites = sprites::load_hullmod_sprite_data(core_dir, None, hullmods);
    let ship_system_sprites = sprites::load_ship_system_sprite_data(core_dir, None, ship_systems);
    let industry_sprites = sprites::load_industry_sprite_data(core_dir, None, industries);
    let skill_sprites = sprites::load_skill_sprite_data(core_dir, None, skills);
    let ability_sprites = sprites::load_ability_sprite_data(core_dir, None, abilities);
    let commodity_sprites = sprites::load_commodity_sprite_data(core_dir, None, commodities);
    let submarket_sprites = sprites::load_submarket_sprite_data(core_dir, None, submarkets);

    Ok(CoreReferences {
        tables,
        ship_files,
        wpn_files: wpn_files.clone(),
        variant_files,
        skin_files,
        ship_sprites,
        weapon_sprites_data,
        wing_sprites,
        hullmod_sprites,
        ship_system_sprites,
        industry_sprites,
        skill_sprites,
        ability_sprites,
        commodity_sprites,
        submarket_sprites,
    })
}

fn load_core_reference_tables(
    core_dir: &Path,
) -> AppResult<BTreeMap<String, Vec<Map<String, Value>>>> {
    let mut tables = BTreeMap::new();
    for (key, rel) in crate::models::CSV_TABLES {
        tables.insert(key.to_string(), read_csv_data(&core_dir.join(rel))?.rows);
    }
    Ok(tables)
}

pub fn detect_directory(
    path: &Path,
    fallback_starsector_root: Option<&str>,
) -> OpenDirectoryResult {
    let selected = path.to_string_lossy().to_string();
    if is_game_root(path) {
        let overview = scan_game_overview(path);
        return OpenDirectoryResult {
            kind: "game-root".to_string(),
            selected_path: selected,
            starsector_root: Some(path.to_string_lossy().to_string()),
            mod_root: None,
            warnings: overview.warnings.clone(),
            overview: Some(overview),
        };
    }

    if is_mod_root(path) {
        let inferred = infer_starsector_root(path);
        let overview = inferred.as_deref().map(scan_game_overview);
        let fallback = fallback_starsector_root
            .filter(|root| !root.trim().is_empty())
            .map(PathBuf::from);
        let starsector_root = inferred.or(fallback);
        return OpenDirectoryResult {
            kind: if overview.is_some() {
                "mod-in-game".to_string()
            } else {
                "external-mod".to_string()
            },
            selected_path: selected,
            starsector_root: starsector_root.map(|p| p.to_string_lossy().to_string()),
            mod_root: Some(path.to_string_lossy().to_string()),
            overview,
            warnings: vec![],
        };
    }

    OpenDirectoryResult {
        kind: "unknown".to_string(),
        selected_path: selected.clone(),
        starsector_root: None,
        mod_root: None,
        overview: None,
        warnings: vec![GameScanWarning {
            path: selected,
            message: "未识别为 Starsector 游戏目录或 Mod 目录".to_string(),
        }],
    }
}

pub fn detect_directory_for_command(
    path: String,
    fallback_starsector_root: Option<String>,
) -> OpenDirectoryResult {
    detect_directory(Path::new(&path), fallback_starsector_root.as_deref())
}

pub fn scan_game_overview(starsector_root: &Path) -> GameOverviewData {
    let mods_dir = starsector_root.join("mods");
    let mut warnings = Vec::new();
    let mut mods = Vec::new();

    if !starsector_root.join("starsector-core").exists() {
        warnings.push(GameScanWarning {
            path: starsector_root
                .join("starsector-core")
                .to_string_lossy()
                .to_string(),
            message: "缺少 starsector-core，原版资源回退不可用".to_string(),
        });
    }

    if !mods_dir.exists() {
        warnings.push(GameScanWarning {
            path: mods_dir.to_string_lossy().to_string(),
            message: "缺少 mods 目录".to_string(),
        });
    } else if let Ok(entries) = fs::read_dir(&mods_dir) {
        for entry in entries.flatten() {
            let mod_root = entry.path();
            if !mod_root.is_dir() {
                continue;
            }
            let mod_info_path = mod_root.join("mod_info.json");
            if !mod_info_path.exists() {
                warnings.push(GameScanWarning {
                    path: mod_root.to_string_lossy().to_string(),
                    message: "缺少 mod_info.json，已跳过".to_string(),
                });
                continue;
            }
            match read_json_file(&mod_info_path) {
                Ok(info) => mods.push(summary_from_mod_info(&mod_root, &info)),
                Err(error) => warnings.push(GameScanWarning {
                    path: mod_info_path.to_string_lossy().to_string(),
                    message: format!("读取 mod_info.json 失败: {error}"),
                }),
            }
        }
    } else {
        warnings.push(GameScanWarning {
            path: mods_dir.to_string_lossy().to_string(),
            message: "无法读取 mods 目录".to_string(),
        });
    }

    mods.sort_by_key(|summary| summary.name.to_lowercase());
    append_duplicate_id_warnings(&mods, &mut warnings);

    GameOverviewData {
        starsector_root: starsector_root.to_string_lossy().to_string(),
        core_available: starsector_root.join("starsector-core").exists(),
        mods_dir: mods_dir.to_string_lossy().to_string(),
        mods,
        warnings,
    }
}

pub fn scan_game_overview_for_command(starsector_root: String) -> GameOverviewData {
    scan_game_overview(Path::new(&starsector_root))
}

fn is_game_root(path: &Path) -> bool {
    path.join("starsector-core").is_dir() && path.join("mods").is_dir()
}

fn is_mod_root(path: &Path) -> bool {
    path.join("mod_info.json").is_file()
}

fn infer_starsector_root(mod_root: &Path) -> Option<PathBuf> {
    let candidate = mod_root.parent()?.parent()?;
    is_game_root(candidate).then(|| candidate.to_path_buf())
}

fn summary_from_mod_info(mod_root: &Path, info: &Value) -> GameModSummary {
    let fallback_name = mod_root
        .file_name()
        .and_then(|s| s.to_str())
        .unwrap_or("Mod")
        .to_string();
    GameModSummary {
        mod_root: mod_root.to_string_lossy().to_string(),
        id: value_string(info.get("id")).unwrap_or_else(|| fallback_name.clone()),
        name: value_string(info.get("name")).unwrap_or(fallback_name),
        version: version_string(info.get("version")).unwrap_or_default(),
        description: value_string(info.get("description")).unwrap_or_default(),
        has_mod_info: true,
    }
}

fn version_string(value: Option<&Value>) -> Option<String> {
    let Some(Value::Object(obj)) = value else {
        return value_string(value);
    };
    let major = version_part(obj.get("major"))?;
    let minor = version_part(obj.get("minor"))?;
    let patch = version_part(obj.get("patch"))?;
    Some(format!("{major}.{minor}.{patch}"))
}

fn version_part(value: Option<&Value>) -> Option<String> {
    match value {
        Some(Value::Number(number)) => Some(number.to_string()),
        Some(Value::String(text)) if !text.trim().is_empty() => Some(text.trim().to_string()),
        _ => None,
    }
}

fn value_string(value: Option<&Value>) -> Option<String> {
    match value {
        Some(Value::String(text)) => Some(text.clone()),
        Some(Value::Number(number)) => Some(number.to_string()),
        Some(Value::Bool(flag)) => Some(flag.to_string()),
        Some(other) => serde_json::to_string(other).ok(),
        None => None,
    }
}

fn append_duplicate_id_warnings(mods: &[GameModSummary], warnings: &mut Vec<GameScanWarning>) {
    let mut counts: HashMap<&str, usize> = HashMap::new();
    for summary in mods {
        *counts.entry(summary.id.as_str()).or_default() += 1;
    }
    for summary in mods {
        if counts.get(summary.id.as_str()).copied().unwrap_or_default() > 1 {
            warnings.push(GameScanWarning {
                path: summary.mod_root.clone(),
                message: format!("重复 Mod id: {}", summary.id),
            });
        }
    }
}

fn read_mod_info(mod_root: &Path) -> Value {
    read_json_file(&mod_root.join("mod_info.json")).unwrap_or_else(|_| {
        let mut obj = Map::new();
        let name = mod_root
            .file_name()
            .and_then(|s| s.to_str())
            .unwrap_or("Mod");
        obj.insert("id".to_string(), Value::String(name.to_string()));
        obj.insert("name".to_string(), Value::String(name.to_string()));
        Value::Object(obj)
    })
}

fn ensure_other_faction(faction_meta: &mut BTreeMap<String, FactionMeta>) {
    faction_meta
        .entry("other".to_string())
        .or_insert(FactionMeta {
            name: "其他".to_string(),
            color: "#6b7280".to_string(),
        });
}

fn count_mission_list_entries(mod_root: &Path) -> usize {
    let path = mod_root.join("data/missions/mission_list.csv");
    read_csv_data(&path)
        .map(|table| {
            table
                .rows
                .iter()
                .filter(|row| {
                    row.get("mission")
                        .and_then(Value::as_str)
                        .is_some_and(|mission| !mission.trim().is_empty())
                })
                .count()
        })
        .unwrap_or(0)
}

fn load_variant_files(mod_root: &Path) -> AppResult<Vec<VariantFile>> {
    let dir = mod_root.join("data/variants");
    if !dir.exists() {
        return Ok(vec![]);
    }
    let mut seen = HashMap::new();
    let mut files = Vec::new();
    for entry in walkdir::WalkDir::new(&dir).into_iter() {
        let entry = entry.map_err(|error| {
            crate::errors::AppError::context(
                format!("遍历 variant 目录失败 ({})", dir.display()),
                crate::errors::AppError::message(error.to_string()),
            )
        })?;
        if entry.path().extension().and_then(|s| s.to_str()) != Some("variant") {
            continue;
        }
        let path = entry.path();
        let data = read_json_file(path)?;
        let rel_path = normalize_rel_path(mod_root, path);
        let file = build_variant_file(mod_root, &rel_path, &data)
            .map_err(|error| crate::errors::AppError::context(path.display().to_string(), error))?;
        if let Some(previous) =
            seen.insert(file.variant_id.clone(), path.to_string_lossy().to_string())
        {
            if is_temporary_core_kite_interceptor_duplicate(
                mod_root,
                path,
                &previous,
                &file.variant_id,
            ) {
                continue;
            }
            return Err(crate::errors::AppError::message(format!(
                "重复 variantId {}: {previous} 和 {}",
                file.variant_id,
                path.display()
            )));
        }
        files.push(file);
    }
    files.sort_by(|a, b| {
        a.hull_id
            .cmp(&b.hull_id)
            .then_with(|| a.variant_id.cmp(&b.variant_id))
    });
    Ok(files)
}

fn load_skin_files(mod_root: &Path) -> AppResult<Vec<SkinFile>> {
    let dir = mod_root.join("data/hulls/skins");
    if !dir.exists() {
        return Ok(vec![]);
    }
    let mut seen = HashMap::new();
    let mut files = Vec::new();
    for entry in walkdir::WalkDir::new(&dir).into_iter() {
        let entry = entry.map_err(|error| {
            crate::errors::AppError::context(
                format!("遍历 skin 目录失败 ({})", dir.display()),
                crate::errors::AppError::message(error.to_string()),
            )
        })?;
        if entry.path().extension().and_then(|s| s.to_str()) != Some("skin") {
            continue;
        }
        let path = entry.path();
        let data = read_json_file(path)?;
        let rel_path = normalize_rel_path(mod_root, path);
        let file = build_skin_file(mod_root, &rel_path, &data)
            .map_err(|error| crate::errors::AppError::context(path.display().to_string(), error))?;
        if let Some(previous) = seen.insert(
            file.skin_hull_id.clone(),
            path.to_string_lossy().to_string(),
        ) {
            return Err(crate::errors::AppError::message(format!(
                "重复 skinHullId {}: {previous} 和 {}",
                file.skin_hull_id,
                path.display()
            )));
        }
        files.push(file);
    }
    files.sort_by(|a, b| {
        a.base_hull_id
            .cmp(&b.base_hull_id)
            .then_with(|| a.skin_hull_id.cmp(&b.skin_hull_id))
    });
    Ok(files)
}

fn is_temporary_core_kite_interceptor_duplicate(
    root: &Path,
    current: &Path,
    previous: &str,
    variant_id: &str,
) -> bool {
    // Temporary vanilla-core compatibility exception.
    //
    if root.file_name().and_then(|name| name.to_str()) != Some("starsector-core") {
        return false;
    }
    let previous_rel = normalize_rel_path(root, Path::new(previous));
    let current_rel = normalize_rel_path(root, current);
    temporary_core_duplicate_variant_pairs()
        .iter()
        .any(|(known_id, known_paths)| {
            variant_id == *known_id
                && known_paths.contains(&previous_rel.as_str())
                && known_paths.contains(&current_rel.as_str())
        })
}

fn temporary_core_duplicate_variant_pairs() -> [(&'static str, [&'static str; 2]); 3] {
    // Temporary vanilla-core compatibility exceptions.
    //
    // Starsector currently ships these known duplicate variantIds in
    // starsector-core:
    // - kite_hegemony_Interceptor:
    //   - data/variants/kite/kite_Interceptor.variant
    //   - data/variants/kite_hegemony_Interceptor.variant
    // - kite_original_Stock:
    //   - data/variants/kite/kite_Stock.variant
    //   - data/variants/kite_original_Stock.variant
    // - ziggurat_Experimental:
    //   - data/variants/ziggurat_Experimental.variant
    //   - data/variants/ziggurat_HF.variant
    //
    // Core references are read-only vanilla data, so these duplicates must not
    // make Mod loading fail. Editable Mod variant loading remains strict; these
    // exceptions are intentionally path- and id-exact so they can be removed when
    // the upstream vanilla data is fixed.
    [
        (
            "kite_hegemony_Interceptor",
            [
                "data/variants/kite/kite_Interceptor.variant",
                "data/variants/kite_hegemony_Interceptor.variant",
            ],
        ),
        (
            "kite_original_Stock",
            [
                "data/variants/kite/kite_Stock.variant",
                "data/variants/kite_original_Stock.variant",
            ],
        ),
        (
            "ziggurat_Experimental",
            [
                "data/variants/ziggurat_Experimental.variant",
                "data/variants/ziggurat_HF.variant",
            ],
        ),
    ]
}

fn normalize_rel_path(root: &Path, path: &Path) -> String {
    path.strip_prefix(root)
        .unwrap_or(path)
        .to_string_lossy()
        .replace('\\', "/")
}

fn group_variants_by_hull(variant_files: &[VariantFile]) -> BTreeMap<String, Vec<Value>> {
    let mut variants: BTreeMap<String, Vec<Value>> = BTreeMap::new();
    for file in variant_files {
        variants
            .entry(file.hull_id.clone())
            .or_default()
            .push(file.data.clone());
    }
    variants
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::io::write_utf8_no_bom;
    use std::time::{SystemTime, UNIX_EPOCH};

    #[test]
    fn scan_game_overview_reads_mod_summaries_only() {
        let root = temp_dir("game_overview");
        fs::create_dir_all(root.join("starsector-core")).unwrap();
        fs::create_dir_all(root.join("mods/demo")).unwrap();
        fs::create_dir_all(root.join("mods/demo/data/hulls")).unwrap();
        write_utf8_no_bom(
            &root.join("mods/demo/mod_info.json"),
            r#"{"id":"demo","name":"Demo Mod","version":{"major":1,"minor":2,"patch":3}}"#,
        )
        .unwrap();
        write_utf8_no_bom(
            &root.join("mods/demo/data/hulls/ship_data.csv"),
            "id,name\r\nship,Ship\r\n",
        )
        .unwrap();

        let overview = scan_game_overview(&root);

        let _ = fs::remove_dir_all(&root);
        assert!(overview.core_available);
        assert_eq!(overview.mods.len(), 1);
        assert_eq!(overview.mods[0].id, "demo");
        assert_eq!(overview.mods[0].version, "1.2.3");
        assert!(overview.warnings.is_empty());
    }

    #[test]
    fn detect_game_root_returns_overview() {
        let root = temp_dir("detect_game");
        fs::create_dir_all(root.join("starsector-core")).unwrap();
        fs::create_dir_all(root.join("mods")).unwrap();

        let detected = detect_directory(&root, None);

        let _ = fs::remove_dir_all(&root);
        assert_eq!(detected.kind, "game-root");
        assert!(detected.overview.is_some());
    }

    #[test]
    fn load_mod_data_reads_skill_csv_and_specs() {
        let root = temp_dir("load_skills");
        fs::create_dir_all(root.join("data/characters/skills")).unwrap();
        fs::create_dir_all(root.join("graphics/icons/skills")).unwrap();
        let png_bytes: [u8; 69] = [
            0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A, 0x00, 0x00, 0x00, 0x0D, 0x49, 0x48,
            0x44, 0x52, 0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01, 0x08, 0x02, 0x00, 0x00,
            0x00, 0x90, 0x77, 0x53, 0xDE, 0x00, 0x00, 0x00, 0x0C, 0x49, 0x44, 0x41, 0x54, 0x08,
            0xD7, 0x63, 0xF8, 0xCF, 0xC0, 0x00, 0x00, 0x00, 0x02, 0x00, 0x01, 0xE2, 0x21, 0xBC,
            0x33, 0x00, 0x00, 0x00, 0x00, 0x49, 0x45, 0x4E, 0x44, 0xAE, 0x42, 0x60, 0x82,
        ];
        fs::write(root.join("graphics/icons/skills/demo.png"), png_bytes).unwrap();
        write_utf8_no_bom(
            &root.join("data/characters/skills/skill_data.csv"),
            "id,name,icon,tags\r\ndemo_skill,Demo Skill,graphics/icons/skills/demo.png,aptitude_combat\r\n",
        )
        .unwrap();
        write_utf8_no_bom(
            &root.join("data/characters/skills/demo_skill.skill"),
            r#"{"id":"demo_skill","name":"Demo Skill"}"#,
        )
        .unwrap();

        let data = load_mod_data(&root).unwrap();

        let _ = fs::remove_dir_all(root);
        assert_eq!(data.skills.len(), 1);
        assert_eq!(data.skills[0]["id"], "demo_skill");
        assert_eq!(data.skill_files["demo_skill"]["name"], "Demo Skill");
        assert!(data.skill_sprites["demo_skill"].starts_with("data:image/png;base64,"));
    }

    #[test]
    fn load_mod_data_allows_missing_skill_sources() {
        let root = temp_dir("missing_skills");

        let data = load_mod_data(&root).unwrap();

        let _ = fs::remove_dir_all(root);
        assert!(data.skills.is_empty());
        assert!(data.skill_files.is_empty());
    }

    #[test]
    fn load_mod_data_reads_variant_files_with_paths_and_stats() {
        let root = temp_dir("load_variants");
        fs::create_dir_all(root.join("data/variants/sub")).unwrap();
        write_utf8_no_bom(
            &root.join("data/variants/sub/demo.variant"),
            r#"{
  "variantId": "demo_variant",
  "hullId": "demo_hull",
  "hullMods": ["heavyarmor"],
  "permaMods": ["built_in"],
  "wings": ["demo_wing"],
  "weaponGroups": [{"mode":"LINKED","weapons":{"WS 001":"demo_weapon"}}]
}"#,
        )
        .unwrap();

        let data = load_mod_data(&root).unwrap();

        let _ = fs::remove_dir_all(root);
        assert_eq!(data.variant_files.len(), 1);
        let variant = &data.variant_files[0];
        assert_eq!(variant.variant_id, "demo_variant");
        assert_eq!(variant.hull_id, "demo_hull");
        assert_eq!(variant.rel_path, "data/variants/sub/demo.variant");
        assert_eq!(variant.weapon_group_count, 1);
        assert_eq!(variant.hull_mod_count, 1);
        assert_eq!(variant.perma_mod_count, 1);
        assert_eq!(variant.wing_count, 1);
        assert_eq!(data.variants["demo_hull"][0]["variantId"], "demo_variant");
    }

    #[test]
    fn load_mod_data_reads_skin_files_with_paths_and_stats() {
        let root = temp_dir("load_skins");
        fs::create_dir_all(root.join("data/hulls/skins")).unwrap();
        write_utf8_no_bom(
            &root.join("data/hulls/skins/demo.skin"),
            r#"{
  "skinHullId": "demo_skin",
  "baseHullId": "demo_hull",
  "builtInMods": ["heavyarmor"],
  "builtInWeapons": {"WS 001":"demo_weapon"},
  "builtInWings": ["demo_wing"],
  "weaponSlotChanges": {"WS 001": {"size": "SMALL"}},
  "engineSlotChanges": {"0": {"style": "LOW_TECH"}}
}"#,
        )
        .unwrap();

        let data = load_mod_data(&root).unwrap();

        let _ = fs::remove_dir_all(root);
        assert_eq!(data.skin_files.len(), 1);
        let skin = &data.skin_files[0];
        assert_eq!(skin.skin_hull_id, "demo_skin");
        assert_eq!(skin.base_hull_id, "demo_hull");
        assert_eq!(skin.rel_path, "data/hulls/skins/demo.skin");
        assert_eq!(skin.built_in_mod_count, 1);
        assert_eq!(skin.built_in_weapon_count, 1);
        assert_eq!(skin.built_in_wing_count, 1);
        assert_eq!(skin.weapon_slot_change_count, 1);
        assert_eq!(skin.engine_slot_change_count, 1);
    }

    #[test]
    fn load_mod_data_reads_core_reference_tables_and_sprites() {
        let root = temp_dir("core_references");
        let mod_root = root.join("mods/demo");
        let core_root = root.join("starsector-core");
        fs::create_dir_all(mod_root.join("data/weapons")).unwrap();
        fs::create_dir_all(core_root.join("data/weapons")).unwrap();
        fs::create_dir_all(core_root.join("data/hulls")).unwrap();
        fs::create_dir_all(core_root.join("data/hullmods")).unwrap();
        fs::create_dir_all(core_root.join("data/variants")).unwrap();
        fs::create_dir_all(core_root.join("graphics/ships")).unwrap();
        fs::create_dir_all(core_root.join("graphics/weapons")).unwrap();
        fs::create_dir_all(core_root.join("graphics/icons/hullmods")).unwrap();
        let png_bytes: [u8; 69] = [
            0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A, 0x00, 0x00, 0x00, 0x0D, 0x49, 0x48,
            0x44, 0x52, 0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01, 0x08, 0x02, 0x00, 0x00,
            0x00, 0x90, 0x77, 0x53, 0xDE, 0x00, 0x00, 0x00, 0x0C, 0x49, 0x44, 0x41, 0x54, 0x08,
            0xD7, 0x63, 0xF8, 0xCF, 0xC0, 0x00, 0x00, 0x00, 0x02, 0x00, 0x01, 0xE2, 0x21, 0xBC,
            0x33, 0x00, 0x00, 0x00, 0x00, 0x49, 0x45, 0x4E, 0x44, 0xAE, 0x42, 0x60, 0x82,
        ];
        fs::write(core_root.join("graphics/ships/core_ship.png"), png_bytes).unwrap();
        fs::write(
            core_root.join("graphics/weapons/core_weapon.png"),
            png_bytes,
        )
        .unwrap();
        fs::write(
            core_root.join("graphics/icons/hullmods/core_mod.png"),
            png_bytes,
        )
        .unwrap();
        write_utf8_no_bom(&mod_root.join("mod_info.json"), r#"{"id":"demo"}"#).unwrap();
        write_utf8_no_bom(
            &mod_root.join("data/weapons/weapon_data.csv"),
            "id,name\r\nmod_weapon,Mod Weapon\r\n",
        )
        .unwrap();
        write_utf8_no_bom(
            &core_root.join("data/weapons/weapon_data.csv"),
            "id,name\r\ncore_weapon,Core Weapon\r\n",
        )
        .unwrap();
        write_utf8_no_bom(
            &core_root.join("data/hulls/ship_data.csv"),
            "id,name\r\ncore_ship,Core Ship\r\n",
        )
        .unwrap();
        write_utf8_no_bom(
            &core_root.join("data/hulls/wing_data.csv"),
            "id,variant\r\ncore_wing,core_variant\r\n",
        )
        .unwrap();
        write_utf8_no_bom(
            &core_root.join("data/hullmods/hull_mods.csv"),
            "id,name,sprite\r\ncore_mod,Core Mod,graphics/icons/hullmods/core_mod.png\r\n",
        )
        .unwrap();
        write_utf8_no_bom(
            &core_root.join("data/hulls/core_ship.ship"),
            r#"{"hullId":"core_ship","spriteName":"graphics/ships/core_ship.png"}"#,
        )
        .unwrap();
        fs::create_dir_all(core_root.join("data/hulls/skins")).unwrap();
        write_utf8_no_bom(
            &core_root.join("data/hulls/skins/core_skin.skin"),
            r#"{"skinHullId":"core_skin","baseHullId":"core_ship","spriteName":"graphics/ships/core_ship.png"}"#,
        )
        .unwrap();
        write_utf8_no_bom(
            &core_root.join("data/weapons/core_weapon.wpn"),
            r#"{"id":"core_weapon","turretSprite":"graphics/weapons/core_weapon.png"}"#,
        )
        .unwrap();
        write_utf8_no_bom(
            &core_root.join("data/variants/core_variant.variant"),
            r#"{"variantId":"core_variant","hullId":"core_ship"}"#,
        )
        .unwrap();

        let data = load_mod_data_with_root(&mod_root, Some(&root)).unwrap();

        let _ = fs::remove_dir_all(root);
        assert_eq!(data.weapons.len(), 1);
        assert_eq!(data.weapons[0]["id"], "mod_weapon");
        assert_eq!(
            data.core_references.tables["weapons"][0]["id"],
            "core_weapon"
        );
        assert_eq!(data.core_references.tables["hullmods"][0]["id"], "core_mod");
        assert!(
            data.core_references.ship_sprites["core_ship"].starts_with("data:image/png;base64,")
        );
        assert_eq!(data.core_references.skin_files[0].skin_hull_id, "core_skin");
        assert!(
            data.core_references.ship_sprites["core_skin"].starts_with("data:image/png;base64,")
        );
        assert!(
            data.core_references.weapon_sprites_data["core_weapon"]["turretSprite"]
                .starts_with("data:image/png;base64,")
        );
        assert!(
            data.core_references.wing_sprites["core_wing"].starts_with("data:image/png;base64,")
        );
        assert!(
            data.core_references.hullmod_sprites["core_mod"].starts_with("data:image/png;base64,")
        );
    }

    #[test]
    fn load_mod_data_without_core_has_empty_core_references() {
        let root = temp_dir("no_core_references");

        let data = load_mod_data(&root).unwrap();

        let _ = fs::remove_dir_all(root);
        assert!(data.core_references.tables.is_empty());
        assert!(data.core_references.ship_sprites.is_empty());
    }

    #[test]
    fn load_mod_data_rejects_variant_missing_required_ids() {
        let root = temp_dir("variant_missing_ids");
        fs::create_dir_all(root.join("data/variants")).unwrap();
        write_utf8_no_bom(
            &root.join("data/variants/bad.variant"),
            r#"{"variantId":"bad"}"#,
        )
        .unwrap();

        let error = load_mod_data(&root).unwrap_err().to_string();

        let _ = fs::remove_dir_all(root);
        assert!(error.contains("bad.variant"));
        assert!(error.contains("hullId"));
    }

    #[test]
    fn load_mod_data_rejects_duplicate_variant_id() {
        let root = temp_dir("variant_duplicate_id");
        fs::create_dir_all(root.join("data/variants/a")).unwrap();
        fs::create_dir_all(root.join("data/variants/b")).unwrap();
        write_utf8_no_bom(
            &root.join("data/variants/a/one.variant"),
            r#"{"variantId":"dup","hullId":"hull_a"}"#,
        )
        .unwrap();
        write_utf8_no_bom(
            &root.join("data/variants/b/two.variant"),
            r#"{"variantId":"dup","hullId":"hull_b"}"#,
        )
        .unwrap();

        let error = load_mod_data(&root).unwrap_err().to_string();

        let _ = fs::remove_dir_all(root);
        assert!(error.contains("重复 variantId dup"));
        assert!(error.contains("one.variant"));
        assert!(error.contains("two.variant"));
    }

    #[test]
    fn load_mod_data_rejects_skin_missing_required_ids() {
        let root = temp_dir("skin_missing_ids");
        fs::create_dir_all(root.join("data/hulls/skins")).unwrap();
        write_utf8_no_bom(
            &root.join("data/hulls/skins/bad.skin"),
            r#"{"skinHullId":"bad"}"#,
        )
        .unwrap();

        let error = load_mod_data(&root).unwrap_err().to_string();

        let _ = fs::remove_dir_all(root);
        assert!(error.contains("bad.skin"));
        assert!(error.contains("baseHullId"));
    }

    #[test]
    fn load_mod_data_rejects_duplicate_skin_hull_id() {
        let root = temp_dir("skin_duplicate_id");
        fs::create_dir_all(root.join("data/hulls/skins/a")).unwrap();
        fs::create_dir_all(root.join("data/hulls/skins/b")).unwrap();
        write_utf8_no_bom(
            &root.join("data/hulls/skins/a/one.skin"),
            r#"{"skinHullId":"dup","baseHullId":"hull_a"}"#,
        )
        .unwrap();
        write_utf8_no_bom(
            &root.join("data/hulls/skins/b/two.skin"),
            r#"{"skinHullId":"dup","baseHullId":"hull_b"}"#,
        )
        .unwrap();

        let error = load_mod_data(&root).unwrap_err().to_string();

        let _ = fs::remove_dir_all(root);
        assert!(error.contains("重复 skinHullId dup"));
        assert!(error.contains("one.skin"));
        assert!(error.contains("two.skin"));
    }

    #[test]
    fn core_known_duplicate_variant_ids_are_temporary_exceptions() {
        let root = temp_dir("core_kite_duplicate");
        let core_root = root.join("starsector-core");
        fs::create_dir_all(core_root.join("data/variants/kite")).unwrap();
        write_utf8_no_bom(
            &core_root.join("data/variants/kite/kite_Interceptor.variant"),
            r#"{"variantId":"kite_hegemony_Interceptor","hullId":"kite_hegemony"}"#,
        )
        .unwrap();
        write_utf8_no_bom(
            &core_root.join("data/variants/kite_hegemony_Interceptor.variant"),
            r#"{"variantId":"kite_hegemony_Interceptor","hullId":"kite_hegemony"}"#,
        )
        .unwrap();
        write_utf8_no_bom(
            &core_root.join("data/variants/kite/kite_Stock.variant"),
            r#"{"variantId":"kite_original_Stock","hullId":"kite_original"}"#,
        )
        .unwrap();
        write_utf8_no_bom(
            &core_root.join("data/variants/kite_original_Stock.variant"),
            r#"{"variantId":"kite_original_Stock","hullId":"kite_original"}"#,
        )
        .unwrap();
        write_utf8_no_bom(
            &core_root.join("data/variants/ziggurat_Experimental.variant"),
            r#"{"variantId":"ziggurat_Experimental","hullId":"ziggurat"}"#,
        )
        .unwrap();
        write_utf8_no_bom(
            &core_root.join("data/variants/ziggurat_HF.variant"),
            r#"{"variantId":"ziggurat_Experimental","hullId":"ziggurat"}"#,
        )
        .unwrap();

        let variants = load_variant_files(&core_root).unwrap();

        let _ = fs::remove_dir_all(root);
        assert_eq!(variants.len(), 3);
        assert!(variants
            .iter()
            .any(|variant| variant.variant_id == "kite_hegemony_Interceptor"));
        assert!(variants
            .iter()
            .any(|variant| variant.variant_id == "kite_original_Stock"));
        assert!(variants
            .iter()
            .any(|variant| variant.variant_id == "ziggurat_Experimental"));
    }

    #[test]
    fn mod_kite_interceptor_duplicate_variant_id_still_fails() {
        let root = temp_dir("mod_kite_duplicate");
        fs::create_dir_all(root.join("data/variants/kite")).unwrap();
        write_utf8_no_bom(
            &root.join("data/variants/kite/kite_Interceptor.variant"),
            r#"{"variantId":"kite_hegemony_Interceptor","hullId":"kite_hegemony"}"#,
        )
        .unwrap();
        write_utf8_no_bom(
            &root.join("data/variants/kite_hegemony_Interceptor.variant"),
            r#"{"variantId":"kite_hegemony_Interceptor","hullId":"kite_hegemony"}"#,
        )
        .unwrap();

        let error = load_variant_files(&root).unwrap_err().to_string();

        let _ = fs::remove_dir_all(root);
        assert!(error.contains("重复 variantId kite_hegemony_Interceptor"));
    }

    #[test]
    fn detect_mod_root_infers_game_root() {
        let root = temp_dir("detect_game_mod");
        let mod_root = root.join("mods/demo");
        fs::create_dir_all(root.join("starsector-core")).unwrap();
        fs::create_dir_all(root.join("mods/other")).unwrap();
        fs::create_dir_all(&mod_root).unwrap();
        write_utf8_no_bom(&mod_root.join("mod_info.json"), r#"{"id":"demo"}"#).unwrap();
        write_utf8_no_bom(&root.join("mods/other/mod_info.json"), r#"{"id":"other"}"#).unwrap();

        let detected = detect_directory(&mod_root, Some("D:/fallback"));

        let _ = fs::remove_dir_all(&root);
        assert_eq!(detected.kind, "mod-in-game");
        assert_eq!(
            detected.mod_root,
            Some(mod_root.to_string_lossy().to_string())
        );
        assert_eq!(
            detected.starsector_root,
            Some(root.to_string_lossy().to_string())
        );
        assert_eq!(
            detected
                .overview
                .as_ref()
                .map(|overview| overview.mods.len()),
            Some(2)
        );
    }

    #[test]
    fn detect_external_mod_uses_fallback_root() {
        let mod_root = temp_dir("detect_external_mod");
        write_utf8_no_bom(&mod_root.join("mod_info.json"), r#"{"id":"external"}"#).unwrap();

        let detected = detect_directory(&mod_root, Some("D:/fallback"));

        let _ = fs::remove_dir_all(mod_root);
        assert_eq!(detected.kind, "external-mod");
        assert_eq!(detected.starsector_root, Some("D:/fallback".to_string()));
        assert!(detected.overview.is_none());
    }

    #[test]
    fn scan_game_overview_warns_duplicate_ids_and_missing_core() {
        let root = temp_dir("game_warnings");
        fs::create_dir_all(root.join("mods/a")).unwrap();
        fs::create_dir_all(root.join("mods/b")).unwrap();
        fs::create_dir_all(root.join("mods/no_info")).unwrap();
        write_utf8_no_bom(&root.join("mods/a/mod_info.json"), r#"{"id":"dup"}"#).unwrap();
        write_utf8_no_bom(&root.join("mods/b/mod_info.json"), r#"{"id":"dup"}"#).unwrap();

        let overview = scan_game_overview(&root);

        let _ = fs::remove_dir_all(root);
        assert!(!overview.core_available);
        assert!(overview
            .warnings
            .iter()
            .any(|w| w.message.contains("starsector-core")));
        assert!(overview
            .warnings
            .iter()
            .any(|w| w.message.contains("缺少 mod_info.json")));
        assert!(overview
            .warnings
            .iter()
            .any(|w| w.message.contains("重复 Mod id")));
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
