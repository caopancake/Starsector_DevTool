use super::super::cache::{session_for, sessions};
use super::super::{
    cache::{load_core_ship_files, load_core_skin_files},
    model::{string_field, ProjectSession},
};
use super::resources_shared::{resource_ref, skin_resource_ref};
use crate::{
    errors::{AppError, AppResult},
    models::{
        HullReferenceGroup, HullReferenceOption, HullReferencesPayload, HullReferencesResult,
    },
};
use std::collections::{BTreeMap, BTreeSet};

pub fn query_hull_references_for_command(
    payload: HullReferencesPayload,
) -> AppResult<HullReferencesResult> {
    let guard = sessions()
        .lock()
        .map_err(|_| AppError::message("project session lock poisoned"))?;
    let session = session_for(&guard, &payload.session_id)?;
    build_hull_references(session, &payload.hull_ids)
}

fn build_hull_references(
    session: &ProjectSession,
    requested_hull_ids: &[String],
) -> AppResult<HullReferencesResult> {
    let mut groups = Vec::new();
    let mut sprites = BTreeMap::new();
    let mut seen = BTreeSet::new();
    let ship_options: Vec<HullReferenceOption> = session
        .ship_files
        .iter()
        .map(|(hull_id, ship)| {
            seen.insert(hull_id.clone());
            let label = hull_reference_label(hull_id, ship);
            let resource_ref = string_field(ship, "spriteName")
                .map(|sprite| resource_ref("mod", &sprite, "ship", hull_id, "thumbnail"));
            if let Some(resource_ref) = resource_ref.clone() {
                sprites.insert(hull_id.clone(), resource_ref);
            }
            HullReferenceOption {
                label,
                value: hull_id.clone(),
                origin: "mod".to_string(),
                kind: "ship".to_string(),
                resource_ref,
            }
        })
        .collect();
    if !ship_options.is_empty() {
        groups.push(HullReferenceGroup {
            label: "当前 Mod".to_string(),
            options: ship_options,
        });
    }

    let skin_options: Vec<HullReferenceOption> = session
        .skin_files
        .iter()
        .map(|skin| {
            seen.insert(skin.skin_hull_id.clone());
            let resource_ref = skin_resource_ref("mod", &session.ship_files, skin);
            if let Some(resource_ref) = resource_ref.clone() {
                sprites.insert(skin.skin_hull_id.clone(), resource_ref);
            }
            HullReferenceOption {
                label: if skin.skin_hull_id == skin.base_hull_id {
                    skin.skin_hull_id.clone()
                } else {
                    format!("{} ({})", skin.skin_hull_id, skin.base_hull_id)
                },
                value: skin.skin_hull_id.clone(),
                origin: "mod".to_string(),
                kind: "skin".to_string(),
                resource_ref,
            }
        })
        .collect();
    if !skin_options.is_empty() {
        groups.push(HullReferenceGroup {
            label: "舰船皮肤".to_string(),
            options: skin_options,
        });
    }

    let mut core_ship_files = BTreeMap::new();
    let mut core_skin_files = Vec::new();
    if let Some(root) = session.manifest.starsector_root.as_ref() {
        core_ship_files = load_core_ship_files(root)?;
        core_skin_files = load_core_skin_files(root)?;

        let mut core_ship_options = Vec::new();
        for (hull_id, ship) in &core_ship_files {
            if seen.contains(hull_id) {
                continue;
            }
            seen.insert(hull_id.clone());
            let label = hull_reference_label(hull_id, ship);
            let resource_ref = string_field(ship, "spriteName")
                .map(|sprite| resource_ref("core", &sprite, "ship", hull_id, "thumbnail"));
            core_ship_options.push(HullReferenceOption {
                label,
                value: hull_id.clone(),
                origin: "core".to_string(),
                kind: "ship".to_string(),
                resource_ref,
            });
        }
        if !core_ship_options.is_empty() {
            groups.push(HullReferenceGroup {
                label: "原版".to_string(),
                options: core_ship_options,
            });
        }

        let mut core_skin_options = Vec::new();
        for skin in &core_skin_files {
            if seen.contains(&skin.skin_hull_id) {
                continue;
            }
            seen.insert(skin.skin_hull_id.clone());
            let resource_ref = skin_resource_ref("core", &core_ship_files, skin);
            core_skin_options.push(HullReferenceOption {
                label: if skin.skin_hull_id == skin.base_hull_id {
                    skin.skin_hull_id.clone()
                } else {
                    format!("{} ({})", skin.skin_hull_id, skin.base_hull_id)
                },
                value: skin.skin_hull_id.clone(),
                origin: "core".to_string(),
                kind: "skin".to_string(),
                resource_ref,
            });
        }
        if !core_skin_options.is_empty() {
            groups.push(HullReferenceGroup {
                label: "原版皮肤".to_string(),
                options: core_skin_options,
            });
        }
    }

    for hull_id in requested_hull_ids {
        if sprites.contains_key(hull_id) {
            continue;
        }
        let resource_ref = session
            .skin_files
            .iter()
            .find(|skin| skin.skin_hull_id == *hull_id)
            .and_then(|skin| skin_resource_ref("mod", &session.ship_files, skin))
            .or_else(|| {
                session
                    .ship_files
                    .get(hull_id)
                    .and_then(|ship| string_field(ship, "spriteName"))
                    .map(|sprite| resource_ref("mod", &sprite, "ship", hull_id, "thumbnail"))
            })
            .or_else(|| {
                core_skin_files
                    .iter()
                    .find(|skin| skin.skin_hull_id == *hull_id)
                    .and_then(|skin| skin_resource_ref("core", &core_ship_files, skin))
            })
            .or_else(|| {
                core_ship_files
                    .get(hull_id)
                    .and_then(|ship| string_field(ship, "spriteName"))
                    .map(|sprite| resource_ref("core", &sprite, "ship", hull_id, "thumbnail"))
            });
        if let Some(resource_ref) = resource_ref {
            sprites.insert(hull_id.clone(), resource_ref);
        }
    }

    Ok(HullReferencesResult { groups, sprites })
}

fn hull_reference_label(hull_id: &str, ship: &serde_json::Value) -> String {
    let name = string_field(ship, "hullName")
        .or_else(|| string_field(ship, "name"))
        .unwrap_or_default();
    if name.trim().is_empty() || name == hull_id {
        hull_id.to_string()
    } else {
        format!("{name} ({hull_id})")
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::{
        io::write_utf8_no_bom,
        models::HullReferencesPayload,
        services::project::session::{
            close_project_session_for_command, open_project_session_traced,
        },
    };
    use std::time::{SystemTime, UNIX_EPOCH};

    #[test]
    fn hull_reference_query_returns_mod_and_core_ship_and_skin_refs() {
        let root = temp_dir("hull_reference_query");
        let mod_root = root.join("mods/demo");
        std::fs::create_dir_all(mod_root.join("data/hulls/skins")).unwrap();
        std::fs::create_dir_all(root.join("starsector-core/data/hulls/skins")).unwrap();
        write_utf8_no_bom(
            &mod_root.join("data/hulls/mod_ship.ship"),
            r#"{"hullId":"mod_ship","hullName":"Mod Ship","spriteName":"graphics/ships/mod_ship.png"}"#,
        )
        .unwrap();
        write_utf8_no_bom(
            &mod_root.join("data/hulls/skins/mod_skin.skin"),
            r#"{"skinHullId":"mod_skin","baseHullId":"mod_ship"}"#,
        )
        .unwrap();
        write_utf8_no_bom(
            &root.join("starsector-core/data/hulls/core_ship.ship"),
            r#"{"hullId":"core_ship","hullName":"Core Ship","spriteName":"graphics/ships/core_ship.png"}"#,
        )
        .unwrap();
        write_utf8_no_bom(
            &root.join("starsector-core/data/hulls/skins/core_skin.skin"),
            r#"{"skinHullId":"core_skin","baseHullId":"core_ship"}"#,
        )
        .unwrap();

        let mut trace =
            crate::services::project::performance::PerformanceTrace::new("project.openSession");
        let manifest = open_project_session_traced(&mod_root, Some(&root), &mut trace).unwrap();
        let result = query_hull_references_for_command(HullReferencesPayload {
            session_id: manifest.session_id.clone(),
            hull_ids: vec![
                "mod_ship".to_string(),
                "mod_skin".to_string(),
                "core_ship".to_string(),
                "core_skin".to_string(),
            ],
        })
        .unwrap();

        let _ = close_project_session_for_command(manifest.session_id);
        let _ = std::fs::remove_dir_all(root);
        let values: Vec<String> = result
            .groups
            .iter()
            .flat_map(|group| group.options.iter().map(|option| option.value.clone()))
            .collect();
        assert!(values.contains(&"mod_ship".to_string()));
        assert!(values.contains(&"mod_skin".to_string()));
        assert!(values.contains(&"core_ship".to_string()));
        assert!(values.contains(&"core_skin".to_string()));
        assert_eq!(
            result
                .sprites
                .get("core_skin")
                .map(|resource| resource.source.as_str()),
            Some("core")
        );
        assert_eq!(
            result
                .sprites
                .get("mod_skin")
                .map(|resource| resource.rel_path.as_str()),
            Some("graphics/ships/mod_ship.png")
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
