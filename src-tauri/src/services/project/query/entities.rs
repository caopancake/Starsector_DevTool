use super::super::{
    cache::{session_for_mut, sessions},
    entity_definitions::entity_definition,
};
use crate::{
    errors::{AppError, AppResult},
    models::{EntityData, EntityKind},
};

pub fn query_entity(session_id: &str, kind: EntityKind, id: &str) -> AppResult<Option<EntityData>> {
    let mut guard = sessions()
        .lock()
        .map_err(|_| AppError::message("project session lock poisoned"))?;
    let session = session_for_mut(&mut guard, session_id)?;
    let definition = entity_definition(kind);
    (definition.prepare)(session)?;
    let data = (definition.detail)(session, id)?;
    let Some(data) = data else {
        return Ok(None);
    };
    let resource_refs = (definition.resources)(session, id, &data);
    Ok(Some(EntityData {
        resource_refs,
        kind: definition.kind,
        id: id.to_string(),
        data,
    }))
}

pub fn query_entity_list(session_id: &str, kind: EntityKind) -> AppResult<Vec<EntityData>> {
    let mut guard = sessions()
        .lock()
        .map_err(|_| AppError::message("project session lock poisoned"))?;
    let session = session_for_mut(&mut guard, session_id)?;
    let definition = entity_definition(kind);
    (definition.prepare)(session)?;
    (definition.list)(session)
}

#[cfg(test)]
mod tests {
    use super::super::super::entity_definitions::registered_mission_rows;
    use super::super::super::model::MISSION_LIST_TABLE_KEY;
    use super::super::super::session::{close_project_session, open_project_session_traced};
    use super::*;
    use crate::io::write_utf8_no_bom;
    use serde_json::{Map, Value};
    use std::collections::BTreeMap;
    use std::time::{SystemTime, UNIX_EPOCH};

    #[test]
    fn mission_entity_query_returns_index_descriptor_text_and_icon_ref() {
        let root = temp_dir("mission_entity_query");
        std::fs::create_dir_all(root.join("data/missions/demo")).unwrap();
        write_utf8_no_bom(
            &root.join("data/missions/mission_list.csv"),
            "mission,name\r\ndemo,Demo Mission\r\n",
        )
        .unwrap();
        write_utf8_no_bom(
            &root.join("data/missions/demo/descriptor.json"),
            r#"{"title":"Demo","icon":"icon.png"}"#,
        )
        .unwrap();
        write_utf8_no_bom(
            &root.join("data/missions/demo/mission_text.txt"),
            "mission text",
        )
        .unwrap();

        let mut trace =
            crate::services::project::performance::PerformanceTrace::new("project.openSession");
        let manifest = open_project_session_traced(&root, None, &mut trace).unwrap();
        let list = query_entity_list(&manifest.session_id, EntityKind::Mission).unwrap();
        let entity = query_entity(&manifest.session_id, EntityKind::Mission, "demo")
            .unwrap()
            .unwrap();

        let _ = close_project_session(manifest.session_id);
        let _ = std::fs::remove_dir_all(root);
        assert_eq!(list.len(), 1);
        assert_eq!(list[0].id, "demo");
        assert_eq!(entity.data["list"]["mission"], "demo");
        assert_eq!(entity.data["descriptor"]["title"], "Demo");
        assert_eq!(entity.data["text"], "mission text");
        assert_eq!(
            entity
                .resource_refs
                .get("icon")
                .map(|resource| resource.rel_path.as_str()),
            Some("data/missions/demo/icon.png")
        );
    }

    #[test]
    fn mission_entity_query_returns_none_for_unregistered_mission() {
        let root = temp_dir("mission_entity_missing");
        std::fs::create_dir_all(root.join("data/missions/demo")).unwrap();
        write_utf8_no_bom(
            &root.join("data/missions/mission_list.csv"),
            "mission,name\r\ndemo,Demo Mission\r\n",
        )
        .unwrap();

        let mut trace =
            crate::services::project::performance::PerformanceTrace::new("project.openSession");
        let manifest = open_project_session_traced(&root, None, &mut trace).unwrap();
        let entity = query_entity(&manifest.session_id, EntityKind::Mission, "missing").unwrap();

        let _ = close_project_session(manifest.session_id);
        let _ = std::fs::remove_dir_all(root);
        assert!(entity.is_none());
    }

    #[test]
    fn mission_list_icon_descriptor_errors_are_not_hidden() {
        let root = temp_dir("mission_list_icon_descriptor_error");
        std::fs::create_dir_all(root.join("data/missions/demo")).unwrap();
        write_utf8_no_bom(
            &root.join("data/missions/mission_list.csv"),
            "mission,name\r\ndemo,Demo Mission\r\n",
        )
        .unwrap();
        write_utf8_no_bom(&root.join("data/missions/demo/descriptor.json"), "{").unwrap();

        let mut trace =
            crate::services::project::performance::PerformanceTrace::new("project.openSession");
        let manifest = open_project_session_traced(&root, None, &mut trace).unwrap();
        let error = query_entity_list(&manifest.session_id, EntityKind::Mission)
            .unwrap_err()
            .to_string();

        let _ = close_project_session(manifest.session_id);
        let _ = std::fs::remove_dir_all(root);
        assert!(error.contains("descriptor.json"));
    }

    #[test]
    fn registered_mission_rows_requires_loaded_csv_rows() {
        let mut csv_tables = BTreeMap::new();
        csv_tables.insert(
            MISSION_LIST_TABLE_KEY.to_string(),
            super::super::super::model::SessionCsvTable {
                header: vec!["mission".to_string()],
                path: "data/missions/mission_list.csv".to_string(),
                rows: None,
            },
        );
        let session = super::super::super::model::ProjectSession {
            manifest: crate::models::ProjectManifest {
                session_id: "test".to_string(),
                mod_root: "mod".to_string(),
                starsector_root: None,
                core_available: false,
                associated_spec_tables: Vec::new(),
                mod_info: Value::Object(Map::new()),
                table_summaries: BTreeMap::new(),
                table_entity_summaries: BTreeMap::new(),
                entity_summaries: crate::models::EntitySummaries::default(),
                warnings: Vec::new(),
            },
            faction_files: BTreeMap::new(),
            tag_map: std::collections::HashMap::new(),
            csv_tables,
            ship_files: BTreeMap::new(),
            variant_files: Vec::new(),
            skin_files: Vec::new(),
            weapon_specs: BTreeMap::new(),
            projectile_specs: BTreeMap::new(),
            system_files: BTreeMap::new(),
            skill_files: BTreeMap::new(),
        };

        let error = registered_mission_rows(&session).unwrap_err().to_string();

        assert!(error.contains("CSV rows are not loaded: missions"));
    }

    #[test]
    fn mission_entity_list_reports_non_comment_registered_row_without_id() {
        let root = temp_dir("mission_entity_missing_registered_id");
        std::fs::create_dir_all(root.join("data/missions")).unwrap();
        write_utf8_no_bom(
            &root.join("data/missions/mission_list.csv"),
            "mission,name\r\n,Missing ID\r\n#comment,\r\n",
        )
        .unwrap();

        let mut trace =
            crate::services::project::performance::PerformanceTrace::new("project.openSession");
        let manifest = open_project_session_traced(&root, None, &mut trace).unwrap();
        let error = query_entity_list(&manifest.session_id, EntityKind::Mission)
            .unwrap_err()
            .to_string();

        let _ = close_project_session(manifest.session_id);
        let _ = std::fs::remove_dir_all(root);
        assert!(error.contains("missions registered row 2 is missing mission"));
    }

    #[test]
    fn weapon_entity_query_returns_spec_and_csv_row() {
        let root = temp_dir("weapon_entity_query");
        std::fs::create_dir_all(root.join("data/weapons")).unwrap();
        write_utf8_no_bom(
            &root.join("data/weapons/weapon_data.csv"),
            "id,type,range,beam speed\r\ndemo_weapon,ENERGY,700,1200\r\n",
        )
        .unwrap();
        write_utf8_no_bom(
            &root.join("data/weapons/demo_weapon.wpn"),
            r#"{"id":"demo_weapon","specClass":"beam","turretSprite":"graphics/weapons/demo.png"}"#,
        )
        .unwrap();

        let mut trace =
            crate::services::project::performance::PerformanceTrace::new("project.openSession");
        let manifest = open_project_session_traced(&root, None, &mut trace).unwrap();
        let entity = query_entity(&manifest.session_id, EntityKind::Weapon, "demo_weapon")
            .unwrap()
            .unwrap();

        let _ = close_project_session(manifest.session_id);
        let _ = std::fs::remove_dir_all(root);
        assert_eq!(entity.data["spec"]["specClass"], "beam");
        assert_eq!(entity.data["csvRow"]["range"], "700");
        assert_eq!(
            entity
                .resource_refs
                .get("turretSprite")
                .map(|resource| resource.rel_path.as_str()),
            Some("graphics/weapons/demo.png")
        );
    }

    #[test]
    fn weapon_entity_query_uses_csv_registration_without_spec() {
        let root = temp_dir("weapon_entity_csv_only");
        std::fs::create_dir_all(root.join("data/weapons")).unwrap();
        write_utf8_no_bom(
            &root.join("data/weapons/weapon_data.csv"),
            "id,type,range,beam speed\r\ndemo_weapon,ENERGY,700,1200\r\n",
        )
        .unwrap();

        let mut trace =
            crate::services::project::performance::PerformanceTrace::new("project.openSession");
        let manifest = open_project_session_traced(&root, None, &mut trace).unwrap();
        let entity = query_entity(&manifest.session_id, EntityKind::Weapon, "demo_weapon")
            .unwrap()
            .unwrap();

        let _ = close_project_session(manifest.session_id);
        let _ = std::fs::remove_dir_all(root);
        assert_eq!(entity.data["spec"], Value::Object(Map::new()));
        assert_eq!(entity.data["csvRow"]["range"], "700");
    }

    #[test]
    fn weapon_entity_list_uses_csv_registration_boundary() {
        let root = temp_dir("weapon_entity_list_csv_boundary");
        std::fs::create_dir_all(root.join("data/weapons")).unwrap();
        write_utf8_no_bom(
            &root.join("data/weapons/weapon_data.csv"),
            "id,type,range\r\ncsv_weapon,ENERGY,700\r\n",
        )
        .unwrap();
        write_utf8_no_bom(
            &root.join("data/weapons/spec_only.wpn"),
            r#"{"id":"spec_only","specClass":"beam"}"#,
        )
        .unwrap();

        let mut trace =
            crate::services::project::performance::PerformanceTrace::new("project.openSession");
        let manifest = open_project_session_traced(&root, None, &mut trace).unwrap();
        let entities = query_entity_list(&manifest.session_id, EntityKind::Weapon).unwrap();

        let _ = close_project_session(manifest.session_id);
        let _ = std::fs::remove_dir_all(root);
        assert_eq!(entities.len(), 1);
        assert_eq!(entities[0].id, "csv_weapon");
        assert_eq!(entities[0].data["csvRow"]["range"], "700");
        assert_eq!(entities[0].data["spec"], Value::Object(Map::new()));
    }

    #[test]
    fn weapon_entity_list_reports_non_comment_registered_row_without_id() {
        let root = temp_dir("weapon_entity_missing_registered_id");
        std::fs::create_dir_all(root.join("data/weapons")).unwrap();
        write_utf8_no_bom(
            &root.join("data/weapons/weapon_data.csv"),
            "id,type,range\r\n,ENERGY,700\r\n#comment,,\r\n",
        )
        .unwrap();

        let mut trace =
            crate::services::project::performance::PerformanceTrace::new("project.openSession");
        let manifest = open_project_session_traced(&root, None, &mut trace).unwrap();
        let error = query_entity_list(&manifest.session_id, EntityKind::Weapon)
            .unwrap_err()
            .to_string();

        let _ = close_project_session(manifest.session_id);
        let _ = std::fs::remove_dir_all(root);
        assert!(error.contains("weapons registered row 2 is missing id"));
    }

    #[test]
    fn weapon_entity_query_returns_none_for_unregistered_spec() {
        let root = temp_dir("weapon_entity_unregistered_spec");
        std::fs::create_dir_all(root.join("data/weapons")).unwrap();
        write_utf8_no_bom(
            &root.join("data/weapons/weapon_data.csv"),
            "id,type,range,beam speed\r\n",
        )
        .unwrap();
        write_utf8_no_bom(
            &root.join("data/weapons/demo_weapon.wpn"),
            r#"{"id":"demo_weapon","specClass":"beam"}"#,
        )
        .unwrap();

        let mut trace =
            crate::services::project::performance::PerformanceTrace::new("project.openSession");
        let manifest = open_project_session_traced(&root, None, &mut trace).unwrap();
        let entity = query_entity(&manifest.session_id, EntityKind::Weapon, "demo_weapon").unwrap();

        let _ = close_project_session(manifest.session_id);
        let _ = std::fs::remove_dir_all(root);
        assert!(entity.is_none());
    }

    #[test]
    fn skill_entity_list_uses_csv_registration_boundary() {
        let root = temp_dir("skill_entity_list_csv_boundary");
        std::fs::create_dir_all(root.join("data/characters/skills")).unwrap();
        write_utf8_no_bom(
            &root.join("data/characters/skills/skill_data.csv"),
            "id,name,icon\r\nskill_one,Skill One,graphics/icons/skill_one.png\r\n#comment,,\r\n,,\r\n",
        )
        .unwrap();
        write_utf8_no_bom(
            &root.join("data/characters/skills/skill_one.skill"),
            r#"{"id":"skill_one","effect":"demo"}"#,
        )
        .unwrap();
        write_utf8_no_bom(
            &root.join("data/characters/skills/spec_only.skill"),
            r#"{"id":"spec_only"}"#,
        )
        .unwrap();

        let mut trace =
            crate::services::project::performance::PerformanceTrace::new("project.openSession");
        let manifest = open_project_session_traced(&root, None, &mut trace).unwrap();
        let entities = query_entity_list(&manifest.session_id, EntityKind::Skill).unwrap();

        let _ = close_project_session(manifest.session_id);
        let _ = std::fs::remove_dir_all(root);
        assert_eq!(entities.len(), 1);
        assert_eq!(entities[0].id, "skill_one");
        assert_eq!(entities[0].data["spec"]["effect"], "demo");
        assert_eq!(entities[0].data["csvRow"]["name"], "Skill One");
        assert_eq!(
            entities[0]
                .resource_refs
                .get("icon")
                .map(|resource| resource.rel_path.as_str()),
            Some("graphics/icons/skill_one.png")
        );
    }

    #[test]
    fn skill_entity_query_uses_empty_spec_for_registered_skill_without_file() {
        let root = temp_dir("skill_entity_csv_only");
        std::fs::create_dir_all(root.join("data/characters/skills")).unwrap();
        write_utf8_no_bom(
            &root.join("data/characters/skills/skill_data.csv"),
            "id,name\r\nskill_one,Skill One\r\n",
        )
        .unwrap();

        let mut trace =
            crate::services::project::performance::PerformanceTrace::new("project.openSession");
        let manifest = open_project_session_traced(&root, None, &mut trace).unwrap();
        let entity = query_entity(&manifest.session_id, EntityKind::Skill, "skill_one")
            .unwrap()
            .unwrap();

        let _ = close_project_session(manifest.session_id);
        let _ = std::fs::remove_dir_all(root);
        assert_eq!(entity.data["spec"], Value::Object(Map::new()));
        assert_eq!(entity.data["csvRow"]["name"], "Skill One");
        assert!(!entity.resource_refs.contains_key("icon"));
    }

    #[test]
    fn skill_entity_query_returns_none_for_unregistered_skill() {
        let root = temp_dir("skill_entity_unregistered");
        std::fs::create_dir_all(root.join("data/characters/skills")).unwrap();
        write_utf8_no_bom(
            &root.join("data/characters/skills/skill_data.csv"),
            "id,name\r\nskill_one,Skill One\r\n",
        )
        .unwrap();
        write_utf8_no_bom(
            &root.join("data/characters/skills/missing.skill"),
            r#"{"id":"missing"}"#,
        )
        .unwrap();

        let mut trace =
            crate::services::project::performance::PerformanceTrace::new("project.openSession");
        let manifest = open_project_session_traced(&root, None, &mut trace).unwrap();
        let entity = query_entity(&manifest.session_id, EntityKind::Skill, "missing").unwrap();

        let _ = close_project_session(manifest.session_id);
        let _ = std::fs::remove_dir_all(root);
        assert!(entity.is_none());
    }

    #[test]
    fn skill_entity_list_reports_non_comment_registered_row_without_id() {
        let root = temp_dir("skill_entity_missing_registered_id");
        std::fs::create_dir_all(root.join("data/characters/skills")).unwrap();
        write_utf8_no_bom(
            &root.join("data/characters/skills/skill_data.csv"),
            "id,name\r\n,Missing ID\r\n#comment,\r\n",
        )
        .unwrap();

        let mut trace =
            crate::services::project::performance::PerformanceTrace::new("project.openSession");
        let manifest = open_project_session_traced(&root, None, &mut trace).unwrap();
        let error = query_entity_list(&manifest.session_id, EntityKind::Skill)
            .unwrap_err()
            .to_string();

        let _ = close_project_session(manifest.session_id);
        let _ = std::fs::remove_dir_all(root);
        assert!(error.contains("skills registered row 2 is missing id"));
    }

    fn temp_dir(name: &str) -> std::path::PathBuf {
        let stamp = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap()
            .as_nanos();
        let path = std::env::temp_dir().join(format!("{stamp}_{name}"));
        std::fs::create_dir_all(&path).unwrap();
        path
    }
}
