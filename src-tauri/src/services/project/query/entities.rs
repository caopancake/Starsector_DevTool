use super::super::{
    cache::{
        ensure_registered_session_table_rows, ensure_session_table_rows, loaded_csv_rows,
        loaded_registered_csv_rows, session_for_mut, sessions,
    },
    model::{
        is_comment_row, string_from_row, ProjectSession, SessionCsvRow, MISSION_LIST_TABLE_KEY,
    },
};
use super::resources_shared::{entity_resource_refs, resource_ref};
use crate::{
    errors::{AppError, AppResult},
    io::read_json_file,
    models::{
        CsvTableKey, EntityData, EntityKind, ResourceOwnerKind, ResourceRef, ResourceSource,
        SkinFile, VariantFile,
    },
};
use serde_json::{Map, Value};
use std::{collections::BTreeMap, path::Path};

pub fn query_entity(session_id: &str, kind: EntityKind, id: &str) -> AppResult<Option<EntityData>> {
    let mut guard = sessions()
        .lock()
        .map_err(|_| AppError::message("project session lock poisoned"))?;
    let session = session_for_mut(&mut guard, session_id)?;
    if kind == EntityKind::Mission {
        ensure_session_table_rows(session, MISSION_LIST_TABLE_KEY)?;
    }
    if kind == EntityKind::Weapon {
        ensure_registered_session_table_rows(session, CsvTableKey::Weapons)?;
    }
    let data = match kind {
        EntityKind::Ship => session.ship_files.get(id).cloned(),
        EntityKind::Weapon => build_weapon_entity_data(session, id)?,
        EntityKind::Projectile => session.projectile_specs.get(id).cloned(),
        EntityKind::System => session.system_files.get(id).cloned(),
        EntityKind::Skill => session.skill_files.get(id).cloned(),
        EntityKind::Faction => session.faction_files.get(id).cloned(),
        EntityKind::Mission => build_mission_entity(session, id)?,
        EntityKind::Variant => session
            .variant_files
            .iter()
            .find(|item| item.variant_id == id)
            .map(variant_file_data)
            .transpose()?,
        EntityKind::Skin => session
            .skin_files
            .iter()
            .find(|item| item.skin_hull_id == id)
            .map(skin_file_data)
            .transpose()?,
    };
    let Some(data) = data else {
        return Ok(None);
    };
    let resource_refs = if kind == EntityKind::Weapon {
        data.get("spec")
            .map(|spec| entity_resource_refs(session, kind, id, spec))
            .unwrap_or_default()
    } else {
        entity_resource_refs(session, kind, id, &data)
    };
    Ok(Some(EntityData {
        resource_refs,
        kind,
        id: id.to_string(),
        data,
    }))
}

pub fn query_entity_list(session_id: &str, kind: EntityKind) -> AppResult<Vec<EntityData>> {
    let mut guard = sessions()
        .lock()
        .map_err(|_| AppError::message("project session lock poisoned"))?;
    let session = session_for_mut(&mut guard, session_id)?;
    if kind == EntityKind::Mission {
        ensure_session_table_rows(session, MISSION_LIST_TABLE_KEY)?;
    }
    if kind == EntityKind::Weapon {
        ensure_registered_session_table_rows(session, CsvTableKey::Weapons)?;
    }
    let items = match kind {
        EntityKind::Variant => session
            .variant_files
            .iter()
            .map(|item| build_variant_entity(session, kind, item))
            .collect::<AppResult<Vec<_>>>()?,
        EntityKind::Skin => session
            .skin_files
            .iter()
            .map(|item| build_skin_entity(session, kind, item))
            .collect::<AppResult<Vec<_>>>()?,
        EntityKind::Faction => session
            .faction_files
            .iter()
            .map(|(id, data)| EntityData {
                kind,
                id: id.clone(),
                resource_refs: entity_resource_refs(session, kind, id, data),
                data: data.clone(),
            })
            .collect(),
        EntityKind::Mission => registered_mission_rows(session)?
            .into_iter()
            .map(|entry| build_mission_list_entity(session, kind, &entry.id, entry.row))
            .collect::<AppResult<Vec<_>>>()?,
        EntityKind::Projectile => session
            .projectile_specs
            .iter()
            .map(|(id, data)| EntityData {
                kind,
                id: id.clone(),
                resource_refs: entity_resource_refs(session, kind, id, data),
                data: data.clone(),
            })
            .collect(),
        EntityKind::Weapon => registered_weapon_rows(session)?
            .into_iter()
            .map(|entry| build_weapon_list_entity(session, kind, &entry.id, entry.row))
            .collect::<AppResult<Vec<_>>>()?,
        EntityKind::Ship => session
            .ship_files
            .iter()
            .map(|(id, data)| EntityData {
                kind,
                id: id.clone(),
                resource_refs: entity_resource_refs(session, kind, id, data),
                data: data.clone(),
            })
            .collect(),
        EntityKind::System => session
            .system_files
            .iter()
            .map(|(id, data)| EntityData {
                kind,
                id: id.clone(),
                resource_refs: entity_resource_refs(session, kind, id, data),
                data: data.clone(),
            })
            .collect(),
        EntityKind::Skill => Vec::new(),
    };
    Ok(items)
}

fn build_variant_entity(
    session: &ProjectSession,
    kind: EntityKind,
    item: &VariantFile,
) -> AppResult<EntityData> {
    let data = variant_file_data(item)?;
    Ok(EntityData {
        kind,
        id: item.variant_id.clone(),
        resource_refs: entity_resource_refs(session, kind, &item.variant_id, &data),
        data,
    })
}

fn build_skin_entity(
    session: &ProjectSession,
    kind: EntityKind,
    item: &SkinFile,
) -> AppResult<EntityData> {
    let data = skin_file_data(item)?;
    Ok(EntityData {
        kind,
        id: item.skin_hull_id.clone(),
        resource_refs: entity_resource_refs(session, kind, &item.skin_hull_id, &data),
        data,
    })
}

fn variant_file_data(item: &VariantFile) -> AppResult<Value> {
    serde_json::to_value(item).map_err(|error| {
        AppError::context(
            format!("serialize variant entity: {}", item.variant_id),
            AppError::from(error),
        )
    })
}

fn skin_file_data(item: &SkinFile) -> AppResult<Value> {
    serde_json::to_value(item).map_err(|error| {
        AppError::context(
            format!("serialize skin entity: {}", item.skin_hull_id),
            AppError::from(error),
        )
    })
}

#[derive(Debug)]
struct RegisteredCsvEntityRow {
    id: String,
    row: Map<String, Value>,
}

fn registered_mission_rows(session: &ProjectSession) -> AppResult<Vec<RegisteredCsvEntityRow>> {
    let table = session
        .csv_tables
        .get(MISSION_LIST_TABLE_KEY)
        .ok_or_else(|| AppError::message(format!("unknown table: {MISSION_LIST_TABLE_KEY}")))?;
    registered_entity_rows(
        loaded_csv_rows(table, MISSION_LIST_TABLE_KEY)?,
        "missions",
        "mission",
    )
}

fn registered_weapon_rows(session: &ProjectSession) -> AppResult<Vec<RegisteredCsvEntityRow>> {
    registered_entity_rows(
        loaded_registered_csv_rows(session, CsvTableKey::Weapons)?,
        CsvTableKey::Weapons.as_str(),
        "id",
    )
}

fn registered_entity_rows(
    rows: &[SessionCsvRow],
    table_label: &str,
    id_column: &str,
) -> AppResult<Vec<RegisteredCsvEntityRow>> {
    let mut registered = Vec::new();
    for (index, row) in rows.iter().enumerate() {
        if is_csv_entity_padding_row(&row.row) {
            continue;
        }
        let id = string_from_row(&row.row, id_column).ok_or_else(|| {
            AppError::message(format!(
                "{table_label} registered row {} is missing {id_column}",
                index + 2
            ))
        })?;
        registered.push(RegisteredCsvEntityRow {
            id,
            row: row.row.clone(),
        });
    }
    Ok(registered)
}

fn is_csv_entity_padding_row(row: &Map<String, Value>) -> bool {
    is_comment_row(row)
        || row
            .values()
            .all(|value| value.as_str().is_none_or(|text| text.trim().is_empty()))
}

fn build_weapon_list_entity(
    session: &ProjectSession,
    kind: EntityKind,
    id: &str,
    row: Map<String, Value>,
) -> AppResult<EntityData> {
    let spec = session
        .weapon_specs
        .get(id)
        .cloned()
        .unwrap_or_else(|| Value::Object(Map::new()));
    let mut data = Map::new();
    data.insert("spec".to_string(), spec.clone());
    data.insert("csvRow".to_string(), Value::Object(row));
    Ok(EntityData {
        kind,
        id: id.to_string(),
        resource_refs: entity_resource_refs(session, kind, id, &spec),
        data: Value::Object(data),
    })
}

fn build_weapon_entity_data(session: &mut ProjectSession, id: &str) -> AppResult<Option<Value>> {
    ensure_registered_session_table_rows(session, CsvTableKey::Weapons)?;
    let Some(csv_row) = registered_weapon_rows(session)?
        .into_iter()
        .find(|row| row.id == id)
        .map(|row| Value::Object(row.row))
    else {
        return Ok(None);
    };
    let spec = session
        .weapon_specs
        .get(id)
        .cloned()
        .unwrap_or_else(|| Value::Object(Map::new()));
    let mut data = Map::new();
    data.insert("spec".to_string(), spec);
    data.insert("csvRow".to_string(), csv_row);
    Ok(Some(Value::Object(data)))
}

fn build_mission_list_entity(
    session: &ProjectSession,
    kind: EntityKind,
    id: &str,
    row: Map<String, Value>,
) -> AppResult<EntityData> {
    let mut data = Map::new();
    data.insert("list".to_string(), Value::Object(row));
    let resource_refs = mission_icon_resource_ref(session, id)?
        .map(|resource| BTreeMap::from([("icon".to_string(), resource)]))
        .unwrap_or_default();
    Ok(EntityData {
        kind,
        id: id.to_string(),
        resource_refs,
        data: Value::Object(data),
    })
}

fn build_mission_entity(session: &ProjectSession, id: &str) -> AppResult<Option<Value>> {
    let Some(row) = registered_mission_rows(session)?
        .into_iter()
        .find(|row| row.id == id)
        .map(|row| row.row)
    else {
        return Ok(None);
    };
    let clean = crate::domain::config::validate_config_id(id, "无效战役 ID")?;
    let dir = Path::new(&session.manifest.mod_root)
        .join("data/missions")
        .join(clean);
    let descriptor_path = dir.join("descriptor.json");
    let descriptor = if descriptor_path.exists() {
        read_json_file(&descriptor_path)?
    } else {
        Value::Object(Map::new())
    };
    let text_path = dir.join("mission_text.txt");
    let text = if text_path.exists() {
        crate::io::read_utf8_no_bom(&text_path)?
    } else {
        String::new()
    };
    let mut data = Map::new();
    data.insert("list".to_string(), Value::Object(row));
    data.insert("descriptor".to_string(), descriptor);
    data.insert("text".to_string(), Value::String(text));
    data.insert(
        "relPath".to_string(),
        Value::String(format!("data/missions/{clean}")),
    );
    Ok(Some(Value::Object(data)))
}

fn mission_icon_resource_ref(session: &ProjectSession, id: &str) -> AppResult<Option<ResourceRef>> {
    let clean = crate::domain::config::validate_config_id(id, "无效战役 ID")?;
    let descriptor_path = Path::new(&session.manifest.mod_root)
        .join("data/missions")
        .join(clean)
        .join("descriptor.json");
    if !descriptor_path.exists() {
        return Ok(None);
    }
    let descriptor = read_json_file(&descriptor_path)?;
    let Some(icon) = descriptor.get("icon").and_then(Value::as_str) else {
        return Ok(None);
    };
    Ok(Some(resource_ref(
        ResourceSource::Mod,
        &format!("data/missions/{clean}/{icon}"),
        ResourceOwnerKind::Mission,
        id,
        "icon",
    )))
}

#[cfg(test)]
mod tests {
    use super::super::super::session::{close_project_session, open_project_session_traced};
    use super::*;
    use crate::io::write_utf8_no_bom;
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
