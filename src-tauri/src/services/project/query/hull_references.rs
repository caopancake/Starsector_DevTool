use super::super::cache::{
    ensure_registered_table_rows, load_core_csv_table, loaded_csv_rows, loaded_registered_csv_rows,
    session_for_mut, sessions,
};
use super::super::resources::{resource_ref, skin_resource_ref};
use super::super::{
    cache::{load_core_ship_files, load_core_skin_files},
    model::{is_comment_row, string_field, string_from_row, ProjectSession, SessionCsvRow},
};
use crate::{
    errors::{AppError, AppResult},
    models::{
        CsvTableKey, HullReferenceGroup, HullReferenceKind, HullReferenceOption,
        HullReferencesResult, ResourceOwnerKind, ResourceSource,
    },
};
use std::collections::{BTreeMap, BTreeSet};

pub fn query_hull_references(
    session_id: &str,
    reference_ids: &[String],
) -> AppResult<HullReferencesResult> {
    let mut guard = sessions()
        .lock()
        .map_err(|_| AppError::message("project session lock poisoned"))?;
    let session = session_for_mut(&mut guard, session_id)?;
    build_hull_references(session, reference_ids)
}

fn build_hull_references(
    session: &mut ProjectSession,
    requested_reference_ids: &[String],
) -> AppResult<HullReferencesResult> {
    if !requested_reference_ids.is_empty() {
        return Ok(HullReferencesResult {
            groups: Vec::new(),
            hull_names: resolve_requested_hull_names(session, requested_reference_ids)?,
            sprites: resolve_requested_hull_sprites(session, requested_reference_ids)?,
        });
    }

    let mut groups = Vec::new();
    let mut seen = BTreeSet::new();
    let ship_options: Vec<HullReferenceOption> = session
        .ship_files
        .iter()
        .map(|(hull_id, ship)| {
            seen.insert(hull_id.clone());
            let label = hull_reference_label(hull_id, ship);
            let resource_ref = string_field(ship, "spriteName").map(|sprite| {
                resource_ref(
                    ResourceSource::Mod,
                    &sprite,
                    ResourceOwnerKind::Ship,
                    hull_id,
                    "thumbnail",
                )
            });
            HullReferenceOption {
                label,
                value: hull_id.clone(),
                origin: ResourceSource::Mod,
                kind: HullReferenceKind::Ship,
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
            let resource_ref = skin_resource_ref(ResourceSource::Mod, &session.ship_files, skin);
            HullReferenceOption {
                label: if skin.skin_hull_id == skin.base_hull_id {
                    skin.skin_hull_id.clone()
                } else {
                    format!("{} ({})", skin.skin_hull_id, skin.base_hull_id)
                },
                value: skin.skin_hull_id.clone(),
                origin: ResourceSource::Mod,
                kind: HullReferenceKind::Skin,
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

    if let Some(root) = session.manifest.starsector_root.as_ref() {
        let core_ship_files = load_core_ship_files(root)?;
        let core_skin_files = load_core_skin_files(root)?;

        let mut core_ship_options = Vec::new();
        for (hull_id, ship) in &core_ship_files {
            if seen.contains(hull_id) {
                continue;
            }
            seen.insert(hull_id.clone());
            let label = hull_reference_label(hull_id, ship);
            let resource_ref = string_field(ship, "spriteName").map(|sprite| {
                resource_ref(
                    ResourceSource::Core,
                    &sprite,
                    ResourceOwnerKind::Ship,
                    hull_id,
                    "thumbnail",
                )
            });
            core_ship_options.push(HullReferenceOption {
                label,
                value: hull_id.clone(),
                origin: ResourceSource::Core,
                kind: HullReferenceKind::Ship,
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
            let resource_ref = skin_resource_ref(ResourceSource::Core, &core_ship_files, skin);
            core_skin_options.push(HullReferenceOption {
                label: if skin.skin_hull_id == skin.base_hull_id {
                    skin.skin_hull_id.clone()
                } else {
                    format!("{} ({})", skin.skin_hull_id, skin.base_hull_id)
                },
                value: skin.skin_hull_id.clone(),
                origin: ResourceSource::Core,
                kind: HullReferenceKind::Skin,
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

    Ok(HullReferencesResult {
        groups,
        hull_names: BTreeMap::new(),
        sprites: BTreeMap::new(),
    })
}

fn resolve_requested_hull_names(
    session: &mut ProjectSession,
    requested_reference_ids: &[String],
) -> AppResult<BTreeMap<String, String>> {
    let requested_ids = requested_reference_ids
        .iter()
        .filter(|id| !id.trim().is_empty())
        .cloned()
        .collect::<BTreeSet<_>>();
    if requested_ids.is_empty() {
        return Ok(BTreeMap::new());
    }

    ensure_registered_table_rows(session, CsvTableKey::Ships)?;
    let mut hull_names = {
        let rows = loaded_registered_csv_rows(session, CsvTableKey::Ships)?;
        ship_names_from_rows(rows, &requested_ids)
    };
    let unresolved_ids = requested_ids
        .iter()
        .filter(|id| !hull_names.contains_key(id.as_str()))
        .cloned()
        .collect::<BTreeSet<_>>();
    let Some(starsector_root) = session.manifest.starsector_root.as_ref() else {
        return Ok(hull_names);
    };
    if unresolved_ids.is_empty() {
        return Ok(hull_names);
    }
    let Some(core_table) = load_core_csv_table(starsector_root, CsvTableKey::Ships)? else {
        return Ok(hull_names);
    };
    let core_rows = loaded_csv_rows(&core_table, CsvTableKey::Ships.as_str())?;
    hull_names.extend(ship_names_from_rows(core_rows, &unresolved_ids));
    Ok(hull_names)
}

fn ship_names_from_rows(
    rows: &[SessionCsvRow],
    requested_ids: &BTreeSet<String>,
) -> BTreeMap<String, String> {
    rows.iter()
        .filter(|row| !is_comment_row(&row.row))
        .filter_map(|row| {
            let id = string_from_row(&row.row, "id")?;
            let name = string_from_row(&row.row, "name")?;
            requested_ids.contains(&id).then_some((id, name))
        })
        .collect()
}

fn resolve_requested_hull_sprites(
    session: &ProjectSession,
    requested_reference_ids: &[String],
) -> AppResult<BTreeMap<String, crate::models::ResourceRef>> {
    let mut sprites = BTreeMap::new();
    for reference_id in requested_reference_ids {
        if let Some(resource) = resolve_mod_hull_sprite(session, reference_id) {
            sprites.insert(reference_id.clone(), resource);
        }
    }
    let unresolved: BTreeSet<String> = requested_reference_ids
        .iter()
        .filter(|reference_id| !sprites.contains_key(reference_id.as_str()))
        .cloned()
        .collect::<BTreeSet<_>>();
    if unresolved.is_empty() {
        return Ok(sprites);
    }
    let Some(root) = session.manifest.starsector_root.as_ref() else {
        return Ok(sprites);
    };
    let core_ship_files = load_core_ship_files(root)?;
    let core_skin_files = load_core_skin_files(root)?;
    for reference_id in unresolved {
        if let Some(resource) =
            resolve_core_hull_sprite(&core_ship_files, &core_skin_files, &reference_id)
        {
            sprites.insert(reference_id, resource);
        }
    }
    Ok(sprites)
}

fn resolve_mod_hull_sprite(
    session: &ProjectSession,
    reference_id: &str,
) -> Option<crate::models::ResourceRef> {
    session
        .skin_files
        .iter()
        .find(|skin| skin.skin_hull_id == reference_id)
        .and_then(|skin| skin_resource_ref(ResourceSource::Mod, &session.ship_files, skin))
        .or_else(|| {
            session
                .ship_files
                .get(reference_id)
                .and_then(|ship| string_field(ship, "spriteName"))
                .map(|sprite| {
                    resource_ref(
                        ResourceSource::Mod,
                        &sprite,
                        ResourceOwnerKind::Ship,
                        reference_id,
                        "thumbnail",
                    )
                })
        })
}

fn resolve_core_hull_sprite(
    core_ship_files: &BTreeMap<String, serde_json::Value>,
    core_skin_files: &[crate::models::SkinFile],
    reference_id: &str,
) -> Option<crate::models::ResourceRef> {
    core_skin_files
        .iter()
        .find(|skin| skin.skin_hull_id == reference_id)
        .and_then(|skin| skin_resource_ref(ResourceSource::Core, core_ship_files, skin))
        .or_else(|| {
            core_ship_files
                .get(reference_id)
                .and_then(|ship| string_field(ship, "spriteName"))
                .map(|sprite| {
                    resource_ref(
                        ResourceSource::Core,
                        &sprite,
                        ResourceOwnerKind::Ship,
                        reference_id,
                        "thumbnail",
                    )
                })
        })
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
    use super::super::super::session::{close_project_session, open_project_session_traced};
    use super::*;
    use crate::io::write_utf8_no_bom;
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
            &mod_root.join("data/hulls/ship_data.csv"),
            "id,name\r\nmod_ship,Mod CSV Ship\r\n",
        )
        .unwrap();
        write_utf8_no_bom(
            &root.join("starsector-core/data/hulls/ship_data.csv"),
            "id,name\r\ncore_ship,Core CSV Ship\r\n",
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
        let catalog = query_hull_references(&manifest.session_id, &[]).unwrap();
        let previews = query_hull_references(
            &manifest.session_id,
            &[
                "mod_ship".to_string(),
                "mod_skin".to_string(),
                "core_ship".to_string(),
                "core_skin".to_string(),
            ],
        )
        .unwrap();

        let values: Vec<String> = catalog
            .groups
            .iter()
            .flat_map(|group| group.options.iter().map(|option| option.value.clone()))
            .collect();
        assert!(values.contains(&"mod_ship".to_string()));
        assert!(values.contains(&"mod_skin".to_string()));
        assert!(values.contains(&"core_ship".to_string()));
        assert!(values.contains(&"core_skin".to_string()));
        assert!(catalog.sprites.is_empty());
        assert!(catalog.hull_names.is_empty());
        assert!(previews.groups.is_empty());
        assert_eq!(previews.sprites.len(), 4);
        assert_eq!(
            previews.hull_names.get("mod_ship"),
            Some(&"Mod CSV Ship".to_string())
        );
        assert_eq!(
            previews.hull_names.get("core_ship"),
            Some(&"Core CSV Ship".to_string())
        );
        assert_eq!(
            previews
                .sprites
                .get("core_skin")
                .map(|resource| resource.source.as_str()),
            Some("core")
        );
        assert_eq!(
            previews
                .sprites
                .get("mod_skin")
                .map(|resource| resource.rel_path.as_str()),
            Some("graphics/ships/mod_ship.png")
        );
        let _ = close_project_session(manifest.session_id);
        let _ = std::fs::remove_dir_all(root);
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
