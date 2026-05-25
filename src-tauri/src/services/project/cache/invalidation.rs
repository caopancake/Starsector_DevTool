use crate::{errors::AppResult, io::load_json_dir_by_id, models::CsvTableKey};
use std::path::Path;

use super::super::{
    factions,
    model::{ProjectSession, MISSION_LIST_REL_PATH, MISSION_LIST_TABLE_KEY},
    root, spec_files,
};

pub(crate) fn invalidate_session_path(
    session: &mut ProjectSession,
    changed_path: &str,
) -> AppResult<()> {
    let target = ChangedProjectPath::classify(changed_path);
    for table_key in target.csv_tables {
        if let Some(table) = session.csv_tables.get_mut(table_key) {
            table.rows = None;
        }
        refresh_table_entity_summary(session, table_key)?;
    }
    if target.invalidate_mission_list {
        if let Some(table) = session.csv_tables.get_mut(MISSION_LIST_TABLE_KEY) {
            table.rows = None;
        }
    }
    let mod_root = Path::new(&session.manifest.mod_root).to_path_buf();
    if target.refresh_mod_info {
        session.manifest.mod_info = root::read_mod_info(&mod_root)?;
    }
    if target.refresh_factions {
        session.faction_files = factions::load_faction_files(&mod_root)?;
        session.tag_map = factions::discover_factions(&mod_root)?.1;
        for table in session.csv_tables.values_mut() {
            table.rows = None;
        }
        session.manifest.entity_summaries.factions = session.faction_files.len();
    }
    if target.refresh_ship_specs {
        session.ship_files = load_json_dir_by_id(&mod_root.join("data/hulls"), "ship", "hullId")?;
        session.manifest.entity_summaries.ships = session.ship_files.len();
        refresh_table_entity_summary(session, CsvTableKey::Ships.as_str())?;
    }
    if target.refresh_weapon_specs {
        session.weapon_specs = load_json_dir_by_id(&mod_root.join("data/weapons"), "wpn", "id")?;
        session.manifest.entity_summaries.weapons = session.weapon_specs.len();
        refresh_table_entity_summary(session, CsvTableKey::Weapons.as_str())?;
    }
    if target.refresh_projectile_specs {
        session.projectile_specs =
            load_json_dir_by_id(&mod_root.join("data/weapons/proj"), "proj", "id")?;
        session.manifest.entity_summaries.projectiles = session.projectile_specs.len();
    }
    if target.refresh_system_specs {
        session.system_files =
            load_json_dir_by_id(&mod_root.join("data/shipsystems"), "system", "id")?;
        session.manifest.entity_summaries.systems = session.system_files.len();
        refresh_table_entity_summary(session, CsvTableKey::ShipSystems.as_str())?;
    }
    if target.refresh_skill_specs {
        session.skill_files =
            load_json_dir_by_id(&mod_root.join("data/characters/skills"), "skill", "id")?;
        session.manifest.entity_summaries.skills = session.skill_files.len();
        refresh_table_entity_summary(session, CsvTableKey::Skills.as_str())?;
    }
    if target.refresh_variants {
        refresh_variant_files(session)?;
    }
    if target.refresh_skins {
        refresh_skin_files(session)?;
    }
    Ok(())
}

#[derive(Default)]
struct ChangedProjectPath {
    csv_tables: Vec<&'static str>,
    invalidate_mission_list: bool,
    refresh_mod_info: bool,
    refresh_factions: bool,
    refresh_ship_specs: bool,
    refresh_weapon_specs: bool,
    refresh_projectile_specs: bool,
    refresh_system_specs: bool,
    refresh_skill_specs: bool,
    refresh_variants: bool,
    refresh_skins: bool,
}

impl ChangedProjectPath {
    fn classify(changed_path: &str) -> Self {
        let normalized = changed_path.replace('\\', "/");
        Self {
            csv_tables: affected_csv_tables(&normalized),
            invalidate_mission_list: is_mission_path(&normalized),
            refresh_mod_info: path_has_suffix(&normalized, "mod_info.json"),
            refresh_factions: path_in_dir(&normalized, "data/world/factions/"),
            refresh_ship_specs: path_in_dir(&normalized, "data/hulls/")
                && path_ends_with_extension(&normalized, ".ship"),
            refresh_weapon_specs: path_in_dir(&normalized, "data/weapons/")
                && path_ends_with_extension(&normalized, ".wpn"),
            refresh_projectile_specs: path_in_dir(&normalized, "data/weapons/proj/")
                && path_ends_with_extension(&normalized, ".proj"),
            refresh_system_specs: path_in_dir(&normalized, "data/shipsystems/")
                && path_ends_with_extension(&normalized, ".system"),
            refresh_skill_specs: path_in_dir(&normalized, "data/characters/skills/")
                && path_ends_with_extension(&normalized, ".skill"),
            refresh_variants: path_in_dir(&normalized, "data/variants/")
                && path_ends_with_extension(&normalized, ".variant"),
            refresh_skins: path_in_dir(&normalized, "data/hulls/skins/")
                && path_ends_with_extension(&normalized, ".skin"),
        }
    }
}

fn affected_csv_tables(path: &str) -> Vec<&'static str> {
    crate::models::CSV_TABLES
        .iter()
        .filter_map(|(key, rel)| path_has_suffix(path, rel).then_some(key.as_str()))
        .collect()
}

fn is_mission_path(path: &str) -> bool {
    path_in_dir(path, "data/missions/") || path_has_suffix(path, MISSION_LIST_REL_PATH)
}

fn path_in_dir(path: &str, dir: &str) -> bool {
    let path_parts = path_segments(path);
    let dir_parts = path_segments(dir);
    !dir_parts.is_empty()
        && path_parts
            .windows(dir_parts.len())
            .any(|window| window == dir_parts.as_slice())
}

fn path_has_suffix(path: &str, suffix: &str) -> bool {
    let path_parts = path_segments(path);
    let suffix_parts = path_segments(suffix);
    if suffix_parts.is_empty() || suffix_parts.len() > path_parts.len() {
        return false;
    }
    &path_parts[path_parts.len() - suffix_parts.len()..] == suffix_parts.as_slice()
}

fn path_ends_with_extension(path: &str, suffix: &str) -> bool {
    path.ends_with(suffix)
}

fn path_segments(path: &str) -> Vec<&str> {
    path.split('/')
        .filter(|segment| !segment.is_empty())
        .collect()
}

fn refresh_variant_files(session: &mut ProjectSession) -> AppResult<()> {
    let mod_root = Path::new(&session.manifest.mod_root);
    let (files, warnings) = spec_files::load_variant_files(mod_root)?;
    session.variant_files = files;
    session.manifest.entity_summaries.variants = session.variant_files.len();
    let (_, skin_warnings) = spec_files::load_skin_files(mod_root)?;
    session.manifest.warnings = warnings.into_iter().chain(skin_warnings).collect();
    Ok(())
}

fn refresh_skin_files(session: &mut ProjectSession) -> AppResult<()> {
    let mod_root = Path::new(&session.manifest.mod_root);
    let (files, warnings) = spec_files::load_skin_files(mod_root)?;
    session.skin_files = files;
    session.manifest.entity_summaries.skins = session.skin_files.len();
    let (_, variant_warnings) = spec_files::load_variant_files(mod_root)?;
    session.manifest.warnings = variant_warnings.into_iter().chain(warnings).collect();
    Ok(())
}

fn refresh_table_entity_summary(session: &mut ProjectSession, table_key: &str) -> AppResult<()> {
    let Some(table) = CsvTableKey::from_key(table_key) else {
        return Ok(());
    };
    let count = match table {
        CsvTableKey::Ships => session.manifest.entity_summaries.ships,
        CsvTableKey::Weapons => session.manifest.entity_summaries.weapons,
        CsvTableKey::ShipSystems => session.manifest.entity_summaries.systems,
        CsvTableKey::Skills => session.manifest.entity_summaries.skills,
        _ => {
            let mod_root = Path::new(&session.manifest.mod_root);
            let rel_path = session
                .csv_tables
                .get(table_key)
                .map(|table| table.path.as_str());
            if let Some(rel_path) = rel_path {
                super::super::session::count_valid_csv_entities(mod_root, table, rel_path)?
            } else {
                0
            }
        }
    };
    session.manifest.table_entity_summaries.insert(table, count);
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::{
        io::write_utf8_no_bom, models::CsvTableKey,
        services::project::performance::PerformanceTrace,
    };
    use std::{
        fs,
        path::PathBuf,
        time::{SystemTime, UNIX_EPOCH},
    };

    #[test]
    fn invalidating_variant_path_refreshes_session_variant_index() {
        let root = temp_dir("invalidate_variant_index");
        fs::create_dir_all(root.join("data/variants")).unwrap();
        write_utf8_no_bom(
            &root.join("data/variants/demo.variant"),
            r#"{"variantId":"old","hullId":"hull"}"#,
        )
        .unwrap();
        let mut trace = PerformanceTrace::new("project.openSession");
        let mut session =
            super::super::super::session::build_project_session(&root, None, &mut trace).unwrap();
        write_utf8_no_bom(
            &root.join("data/variants/demo.variant"),
            r#"{"variantId":"new","hullId":"hull"}"#,
        )
        .unwrap();

        invalidate_session_path(&mut session, "data/variants/demo.variant").unwrap();

        let _ = fs::remove_dir_all(root);
        assert!(session
            .variant_files
            .iter()
            .any(|variant| variant.variant_id == "new"));
        assert!(!session
            .variant_files
            .iter()
            .any(|variant| variant.variant_id == "old"));
        assert_eq!(session.manifest.entity_summaries.variants, 1);
    }

    #[test]
    fn invalidating_faction_path_refreshes_tags_and_loaded_csv_rows() {
        let root = temp_dir("invalidate_faction_tags");
        fs::create_dir_all(root.join("data/world/factions")).unwrap();
        fs::create_dir_all(root.join("data/hulls")).unwrap();
        write_utf8_no_bom(
            &root.join("data/world/factions/factions.csv"),
            "id,file\r\ndemo,data/world/factions/demo.faction\r\n",
        )
        .unwrap();
        write_utf8_no_bom(
            &root.join("data/world/factions/demo.faction"),
            r#"{"id":"demo","displayName":"Demo","knownShips":{"tags":["demo_old_bp"]}}"#,
        )
        .unwrap();
        write_utf8_no_bom(
            &root.join("data/hulls/ship_data.csv"),
            "id,tags\r\nship,demo_old_bp\r\n",
        )
        .unwrap();
        let mut trace = PerformanceTrace::new("project.openSession");
        let mut session =
            super::super::super::session::build_project_session(&root, None, &mut trace).unwrap();
        super::super::ensure_registered_session_table_rows(&mut session, CsvTableKey::Ships)
            .unwrap();
        write_utf8_no_bom(
            &root.join("data/world/factions/demo.faction"),
            r#"{"id":"demo","displayName":"Demo","knownShips":{"tags":["demo_new_bp"]}}"#,
        )
        .unwrap();

        invalidate_session_path(&mut session, "data/world/factions/demo.faction").unwrap();

        let _ = fs::remove_dir_all(root);
        assert!(session.tag_map.contains_key("demo_new_bp"));
        assert!(!session.tag_map.contains_key("demo_old_bp"));
        assert!(session
            .csv_tables
            .get(CsvTableKey::Ships.as_str())
            .and_then(|table| table.rows.as_ref())
            .is_none());
    }

    #[test]
    fn changed_path_classification_uses_path_segments() {
        assert!(affected_csv_tables("D:/mods/demo/data/hulls/ship_data.csv")
            .contains(&CsvTableKey::Ships.as_str()));
        assert!(
            !affected_csv_tables("D:/mods/demo/xdata/hulls/ship_data.csv")
                .contains(&CsvTableKey::Ships.as_str())
        );
        assert!(path_in_dir(
            "D:/mods/demo/data/world/factions/demo.faction",
            "data/world/factions/"
        ));
        assert!(!path_in_dir(
            "D:/mods/demo/xdata/world/factions/demo.faction",
            "data/world/factions/"
        ));
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
