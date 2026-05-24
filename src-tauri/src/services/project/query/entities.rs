use super::super::{
    cache::{ensure_session_table_rows, session_for_mut, sessions},
    model::string_from_row,
};
use super::resources_shared::{entity_resource_refs, resource_ref};
use crate::{
    errors::{AppError, AppResult},
    io::read_json_file,
    models::{EntityData, QueryEntityListPayload, QueryEntityPayload, ResourceRef},
};
use serde_json::{Map, Value};
use std::{collections::BTreeMap, path::Path};

pub fn query_entity_for_command(payload: QueryEntityPayload) -> AppResult<Option<EntityData>> {
    let mut guard = sessions()
        .lock()
        .map_err(|_| AppError::message("project session lock poisoned"))?;
    let session = session_for_mut(&mut guard, &payload.session_id)?;
    if payload.kind == "mission" {
        ensure_session_table_rows(session, "missions")?;
    }
    let data = match payload.kind.as_str() {
        "ship" => session.ship_files.get(&payload.id).cloned(),
        "weapon" => session.wpn_files.get(&payload.id).cloned(),
        "projectile" => session.proj_files.get(&payload.id).cloned(),
        "system" => session.system_files.get(&payload.id).cloned(),
        "skill" => session.skill_files.get(&payload.id).cloned(),
        "faction" => session.faction_files.get(&payload.id).cloned(),
        "mission" => build_mission_entity(session, &payload.id)?,
        "variant" => session
            .variant_files
            .iter()
            .find(|item| item.variant_id == payload.id)
            .and_then(|item| serde_json::to_value(item).ok()),
        "skin" => session
            .skin_files
            .iter()
            .find(|item| item.skin_hull_id == payload.id)
            .and_then(|item| serde_json::to_value(item).ok()),
        _ => None,
    };
    Ok(data.map(|data| EntityData {
        resource_refs: entity_resource_refs(session, &payload.kind, &payload.id, &data),
        kind: payload.kind,
        id: payload.id,
        data,
    }))
}

pub fn query_entity_list_for_command(
    payload: QueryEntityListPayload,
) -> AppResult<Vec<EntityData>> {
    let mut guard = sessions()
        .lock()
        .map_err(|_| AppError::message("project session lock poisoned"))?;
    let session = session_for_mut(&mut guard, &payload.session_id)?;
    if payload.kind == "mission" {
        ensure_session_table_rows(session, "missions")?;
    }
    let items = match payload.kind.as_str() {
        "variant" => session
            .variant_files
            .iter()
            .filter_map(|item| {
                serde_json::to_value(item).ok().map(|data| EntityData {
                    kind: payload.kind.clone(),
                    id: item.variant_id.clone(),
                    resource_refs: entity_resource_refs(
                        session,
                        &payload.kind,
                        &item.variant_id,
                        &data,
                    ),
                    data,
                })
            })
            .collect(),
        "skin" => session
            .skin_files
            .iter()
            .filter_map(|item| {
                serde_json::to_value(item).ok().map(|data| EntityData {
                    kind: payload.kind.clone(),
                    id: item.skin_hull_id.clone(),
                    resource_refs: entity_resource_refs(
                        session,
                        &payload.kind,
                        &item.skin_hull_id,
                        &data,
                    ),
                    data,
                })
            })
            .collect(),
        "faction" => session
            .faction_files
            .iter()
            .map(|(id, data)| EntityData {
                kind: payload.kind.clone(),
                id: id.clone(),
                resource_refs: entity_resource_refs(session, &payload.kind, id, data),
                data: data.clone(),
            })
            .collect(),
        "mission" => mission_rows(session)
            .into_iter()
            .filter_map(|row| {
                let id = string_from_row(&row, "mission")?;
                build_mission_list_entity(session, &payload.kind, &id, row)
            })
            .collect(),
        "projectile" => session
            .proj_files
            .iter()
            .map(|(id, data)| EntityData {
                kind: payload.kind.clone(),
                id: id.clone(),
                resource_refs: entity_resource_refs(session, &payload.kind, id, data),
                data: data.clone(),
            })
            .collect(),
        "weapon" => session
            .wpn_files
            .iter()
            .map(|(id, data)| EntityData {
                kind: payload.kind.clone(),
                id: id.clone(),
                resource_refs: entity_resource_refs(session, &payload.kind, id, data),
                data: data.clone(),
            })
            .collect(),
        "ship" => session
            .ship_files
            .iter()
            .map(|(id, data)| EntityData {
                kind: payload.kind.clone(),
                id: id.clone(),
                resource_refs: entity_resource_refs(session, &payload.kind, id, data),
                data: data.clone(),
            })
            .collect(),
        _ => Vec::new(),
    };
    Ok(items)
}

fn mission_rows(session: &super::super::model::ProjectSession) -> Vec<Map<String, Value>> {
    session
        .csv_tables
        .get("missions")
        .and_then(|table| table.rows.as_ref())
        .map(|rows| rows.iter().map(|row| row.row.clone()).collect())
        .unwrap_or_default()
}

fn build_mission_list_entity(
    session: &super::super::model::ProjectSession,
    kind: &str,
    id: &str,
    row: Map<String, Value>,
) -> Option<EntityData> {
    let mut data = Map::new();
    data.insert("list".to_string(), Value::Object(row));
    let resource_refs = mission_icon_resource_ref(session, id)
        .map(|resource| BTreeMap::from([("icon".to_string(), resource)]))
        .unwrap_or_default();
    Some(EntityData {
        kind: kind.to_string(),
        id: id.to_string(),
        resource_refs,
        data: Value::Object(data),
    })
}

fn build_mission_entity(
    session: &super::super::model::ProjectSession,
    id: &str,
) -> AppResult<Option<Value>> {
    let row = mission_rows(session)
        .into_iter()
        .find(|row| string_from_row(row, "mission").as_deref() == Some(id))
        .unwrap_or_else(|| {
            let mut row = Map::new();
            row.insert("mission".to_string(), Value::String(id.to_string()));
            row
        });
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

fn mission_icon_resource_ref(
    session: &super::super::model::ProjectSession,
    id: &str,
) -> Option<ResourceRef> {
    let clean = crate::domain::config::validate_config_id(id, "无效战役 ID").ok()?;
    let descriptor_path = Path::new(&session.manifest.mod_root)
        .join("data/missions")
        .join(clean)
        .join("descriptor.json");
    let descriptor = read_json_file(&descriptor_path).ok()?;
    let icon = descriptor.get("icon").and_then(Value::as_str)?;
    Some(resource_ref(
        "mod",
        &format!("data/missions/{clean}/{icon}"),
        "mission",
        id,
        "icon",
    ))
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::{
        io::write_utf8_no_bom,
        models::{QueryEntityListPayload, QueryEntityPayload},
        services::project::session::{
            close_project_session_for_command, open_project_session_traced,
        },
    };
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
        let list = query_entity_list_for_command(QueryEntityListPayload {
            session_id: manifest.session_id.clone(),
            kind: "mission".to_string(),
        })
        .unwrap();
        let entity = query_entity_for_command(QueryEntityPayload {
            session_id: manifest.session_id.clone(),
            kind: "mission".to_string(),
            id: "demo".to_string(),
        })
        .unwrap()
        .unwrap();

        let _ = close_project_session_for_command(manifest.session_id);
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
