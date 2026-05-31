use crate::{
    errors::AppResult,
    io::{load_json_dir_by_id, normalized_path_key, path_uses_parent_dir},
    models::CsvTableKey,
};
use std::path::{Component, Path};

use super::super::{
    factions,
    model::{ProjectSession, MISSION_LIST_REL_PATH, MISSION_LIST_TABLE_KEY},
    root, spec_files,
};

pub(crate) fn invalidate_session_path(
    session: &mut ProjectSession,
    changed_path: &str,
) -> AppResult<()> {
    let Some(project_path) = project_scoped_changed_path(&session.manifest.mod_root, changed_path)
    else {
        return Ok(());
    };
    let target = ChangedProjectPath::classify(&project_path);
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

fn project_scoped_changed_path(mod_root: &str, changed_path: &str) -> Option<String> {
    let path = Path::new(changed_path);
    if path_uses_parent_dir(path) {
        return None;
    }
    let normalized_path = normalized_path_key(path);
    if !path.is_absolute() {
        if path
            .components()
            .any(|part| matches!(part, Component::Prefix(_)))
        {
            return None;
        }
        return Some(normalized_path);
    }
    let normalized_root = normalized_path_key(Path::new(mod_root));
    if normalized_path == normalized_root {
        return Some(String::new());
    }
    normalized_path
        .strip_prefix(&format!("{normalized_root}/"))
        .map(ToOwned::to_owned)
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
        Self {
            csv_tables: affected_csv_tables(changed_path),
            invalidate_mission_list: is_mission_path(changed_path),
            refresh_mod_info: path_affects_target(changed_path, "mod_info.json"),
            refresh_factions: path_is_or_in_dir(changed_path, "data/world/factions"),
            refresh_ship_specs: path_is_spec_file_or_dir(changed_path, "data/hulls", ".ship"),
            refresh_weapon_specs: path_is_spec_file_or_dir(changed_path, "data/weapons", ".wpn"),
            refresh_projectile_specs: path_is_spec_file_or_dir(
                changed_path,
                "data/weapons/proj",
                ".proj",
            ),
            refresh_system_specs: path_is_spec_file_or_dir(
                changed_path,
                "data/shipsystems",
                ".system",
            ),
            refresh_skill_specs: path_is_spec_file_or_dir(
                changed_path,
                "data/characters/skills",
                ".skill",
            ),
            refresh_variants: path_is_spec_file_or_dir(changed_path, "data/variants", ".variant"),
            refresh_skins: path_is_spec_file_or_dir(changed_path, "data/hulls/skins", ".skin"),
        }
    }
}

fn affected_csv_tables(path: &str) -> Vec<&'static str> {
    crate::models::CSV_TABLES
        .iter()
        .filter_map(|(key, rel)| path_affects_target(path, rel).then_some(key.as_str()))
        .collect()
}

fn is_mission_path(path: &str) -> bool {
    path_is_or_in_dir(path, "data/missions") || path_affects_target(path, MISSION_LIST_REL_PATH)
}

fn path_is_or_in_dir(path: &str, dir: &str) -> bool {
    path == dir || path.starts_with(&format!("{dir}/"))
}

fn path_affects_target(path: &str, target: &str) -> bool {
    path.is_empty() || path == target || target.starts_with(&format!("{path}/"))
}

fn path_ends_with_extension(path: &str, suffix: &str) -> bool {
    path.ends_with(suffix)
}

fn path_is_spec_file_or_dir(path: &str, dir: &str, extension: &str) -> bool {
    path_affects_target(path, dir)
        || (path_is_or_in_dir(path, dir) && path_ends_with_extension(path, extension))
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
    fn changed_path_classification_uses_project_relative_targets() {
        assert!(
            affected_csv_tables("data/hulls/ship_data.csv").contains(&CsvTableKey::Ships.as_str())
        );
        assert!(affected_csv_tables("data/hulls").contains(&CsvTableKey::Ships.as_str()));
        assert!(!affected_csv_tables("backup/data/hulls/ship_data.csv")
            .contains(&CsvTableKey::Ships.as_str()));
        assert!(path_is_or_in_dir(
            "data/world/factions/demo.faction",
            "data/world/factions"
        ));
        assert!(!path_is_or_in_dir(
            "backup/data/world/factions/demo.faction",
            "data/world/factions"
        ));
        assert!(path_is_spec_file_or_dir(
            "data/hulls",
            "data/hulls",
            ".ship"
        ));
        assert!(path_is_spec_file_or_dir(
            "data/hulls",
            "data/hulls/skins",
            ".skin"
        ));
        assert!(path_is_spec_file_or_dir(
            "data/hulls/demo.ship",
            "data/hulls",
            ".ship"
        ));
        assert!(!path_is_spec_file_or_dir(
            "data/hulls/demo.txt",
            "data/hulls",
            ".ship"
        ));
        assert!(!path_is_spec_file_or_dir(
            "backup/data/hulls/demo.ship",
            "data/hulls",
            ".ship"
        ));
    }

    #[test]
    fn project_scoped_changed_path_rejects_external_absolute_paths() {
        assert_eq!(
            project_scoped_changed_path("D:/mods/current", "D:/mods/current/data/hulls/demo.ship"),
            Some("data/hulls/demo.ship".to_string())
        );
        assert_eq!(
            project_scoped_changed_path("D:/mods/current", "data/hulls/demo.ship"),
            Some("data/hulls/demo.ship".to_string())
        );
        assert_eq!(
            project_scoped_changed_path("D:/mods/current", "D:/mods/other/data/hulls/demo.ship"),
            None
        );
        assert_eq!(
            project_scoped_changed_path("D:/mods/current", "data/hulls/../weapons/demo.wpn"),
            None
        );
        assert_eq!(
            project_scoped_changed_path(
                "D:/mods/current",
                "D:/mods/current/data/hulls/../weapons/demo.wpn"
            ),
            None
        );
    }

    #[test]
    fn invalidating_external_absolute_path_does_not_refresh_session_indexes() {
        let root = temp_dir("invalidate_external_current");
        let external = temp_dir("invalidate_external_other");
        fs::create_dir_all(root.join("data/hulls")).unwrap();
        fs::create_dir_all(external.join("data/hulls")).unwrap();
        write_utf8_no_bom(
            &root.join("data/hulls/current.ship"),
            r#"{"hullId":"current"}"#,
        )
        .unwrap();
        write_utf8_no_bom(
            &external.join("data/hulls/external.ship"),
            r#"{"hullId":"external"}"#,
        )
        .unwrap();
        let mut trace = PerformanceTrace::new("project.openSession");
        let mut session =
            super::super::super::session::build_project_session(&root, None, &mut trace).unwrap();

        invalidate_session_path(
            &mut session,
            &external.join("data/hulls/external.ship").to_string_lossy(),
        )
        .unwrap();

        let _ = fs::remove_dir_all(root);
        let _ = fs::remove_dir_all(external);
        assert_eq!(session.manifest.entity_summaries.ships, 1);
        assert!(session.ship_files.contains_key("current"));
        assert!(!session.ship_files.contains_key("external"));
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
