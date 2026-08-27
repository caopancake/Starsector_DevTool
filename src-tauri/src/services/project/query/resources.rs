use super::super::cache::{session_for, sessions};
use super::super::resources::{resource_cache_key, sprite_resource_bytes_cached};
use crate::{
    errors::{AppError, AppResult},
    models::{ResourceDataUrlBatchEntry, ResourceDataUrlBatchResult, ResourceRef},
};
use std::collections::BTreeMap;

pub fn query_resource_data_urls(
    session_id: &str,
    resources: Vec<ResourceRef>,
) -> AppResult<ResourceDataUrlBatchResult> {
    let guard = sessions()
        .lock()
        .map_err(|_| AppError::message("project session lock poisoned"))?;
    let session = session_for(&guard, session_id)?;
    let mut loaded: BTreeMap<String, Option<String>> = BTreeMap::new();
    let mut entries = Vec::with_capacity(resources.len());
    for resource in resources {
        let cache_key = resource_cache_key(&resource);
        let data_url = if let Some(data_url) = loaded.get(&cache_key) {
            data_url.clone()
        } else {
            let bytes = sprite_resource_bytes_cached(session_id, session, &resource)?;
            loaded.insert(cache_key, bytes.data_url.clone());
            bytes.data_url
        };
        entries.push(ResourceDataUrlBatchEntry {
            key: resource.key,
            source: resource.source,
            rel_path: resource.rel_path,
            owner_kind: resource.owner_kind,
            owner_id: resource.owner_id,
            data_url,
        });
    }
    Ok(ResourceDataUrlBatchResult { entries })
}

#[cfg(test)]
mod tests {
    use super::super::super::session::{close_project_session, open_project_session_traced};
    use super::*;
    use crate::models::{ResourceOwnerKind, ResourceRef, ResourceSource};
    use crate::services::project::resources::cached_sprite_media_contains;
    use std::time::{SystemTime, UNIX_EPOCH};

    fn general_purpose_base64(bytes: &[u8]) -> String {
        use base64::{engine::general_purpose, Engine as _};
        general_purpose::STANDARD.encode(bytes)
    }

    #[test]
    fn batch_resource_query_keeps_order_and_uses_empty_for_missing() {
        let root = temp_dir("batch_resource_query");
        std::fs::create_dir_all(root.join("graphics/ships")).unwrap();
        std::fs::write(root.join("graphics/ships/ship.png"), [137, 80, 78, 71]).unwrap();

        let mut trace =
            crate::services::project::performance::PerformanceTrace::new("project.openSession");
        let manifest = open_project_session_traced(&root, None, &mut trace).unwrap();
        let result = query_resource_data_urls(
            &manifest.session_id,
            vec![
                ResourceRef {
                    source: ResourceSource::Mod,
                    rel_path: "graphics/ships/ship.png".to_string(),
                    owner_kind: ResourceOwnerKind::Ship,
                    owner_id: "ship".to_string(),
                    key: "ship".to_string(),
                },
                ResourceRef {
                    source: ResourceSource::Mod,
                    rel_path: "graphics/ships/missing.png".to_string(),
                    owner_kind: ResourceOwnerKind::Ship,
                    owner_id: "missing".to_string(),
                    key: "missing".to_string(),
                },
            ],
        )
        .unwrap();

        let _ = close_project_session(manifest.session_id);
        let _ = std::fs::remove_dir_all(root);
        assert_eq!(result.entries.len(), 2);
        assert_eq!(result.entries[0].key, "ship");
        assert_eq!(result.entries[0].owner_kind, ResourceOwnerKind::Ship);
        assert_eq!(result.entries[0].owner_id, "ship");
        assert!(result.entries[0].data_url.is_some());
        assert_eq!(result.entries[1].key, "missing");
        assert_eq!(result.entries[1].owner_kind, ResourceOwnerKind::Ship);
        assert_eq!(result.entries[1].owner_id, "missing");
        assert!(result.entries[1].data_url.is_none());
    }

    #[test]
    fn core_resource_requires_starsector_root() {
        let root = temp_dir("core_resource_without_root");

        let mut trace =
            crate::services::project::performance::PerformanceTrace::new("project.openSession");
        let manifest = open_project_session_traced(&root, None, &mut trace).unwrap();
        let error = query_resource_data_urls(
            &manifest.session_id,
            vec![ResourceRef {
                source: ResourceSource::Core,
                rel_path: "graphics/ships/ship.png".to_string(),
                owner_kind: ResourceOwnerKind::Ship,
                owner_id: "ship".to_string(),
                key: "ship".to_string(),
            }],
        )
        .unwrap_err()
        .to_string();

        let _ = close_project_session(manifest.session_id);
        let _ = std::fs::remove_dir_all(root);
        assert!(error.contains("core resource requires starsector root"));
    }

    #[test]
    fn mod_resource_uses_core_fallback_from_session_root() {
        let root = temp_dir("mod_resource_core_fallback");
        let mod_root = root.join("mods/demo");
        std::fs::create_dir_all(&mod_root).unwrap();
        std::fs::create_dir_all(root.join("starsector-core/graphics/ships")).unwrap();
        std::fs::write(
            root.join("starsector-core/graphics/ships/core_ship.png"),
            [137, 80, 78, 71],
        )
        .unwrap();

        let mut trace =
            crate::services::project::performance::PerformanceTrace::new("project.openSession");
        let manifest = open_project_session_traced(&mod_root, Some(&root), &mut trace).unwrap();
        let result = query_resource_data_urls(
            &manifest.session_id,
            vec![ResourceRef {
                source: ResourceSource::Mod,
                rel_path: "graphics/ships/core_ship.png".to_string(),
                owner_kind: ResourceOwnerKind::Ship,
                owner_id: "ship".to_string(),
                key: "sprite".to_string(),
            }],
        )
        .unwrap();

        let _ = close_project_session(manifest.session_id);
        let _ = std::fs::remove_dir_all(root);
        assert!(result.entries[0].data_url.is_some());
    }

    #[test]
    fn resource_query_rejects_parent_dir_escape() {
        let root = temp_dir("resource_query_parent_escape");

        let mut trace =
            crate::services::project::performance::PerformanceTrace::new("project.openSession");
        let manifest = open_project_session_traced(&root, None, &mut trace).unwrap();
        let error = query_resource_data_urls(
            &manifest.session_id,
            vec![ResourceRef {
                source: ResourceSource::Mod,
                rel_path: "../outside.png".to_string(),
                owner_kind: ResourceOwnerKind::Ship,
                owner_id: "ship".to_string(),
                key: "sprite".to_string(),
            }],
        )
        .unwrap_err()
        .to_string();

        let _ = close_project_session(manifest.session_id);
        let _ = std::fs::remove_dir_all(root);
        assert!(error.contains("sprite path is outside resource root"));
    }

    #[test]
    fn resource_query_rejects_mod_link_parent_escape() {
        let Some((root, outside, _linked)) = temp_linked_dir("resource_query_link_escape") else {
            return;
        };
        std::fs::write(outside.join("outside.png"), [137, 80, 78, 71]).unwrap();

        let mut trace =
            crate::services::project::performance::PerformanceTrace::new("project.openSession");
        let manifest = open_project_session_traced(&root, None, &mut trace).unwrap();
        let result = query_resource_data_urls(
            &manifest.session_id,
            vec![ResourceRef {
                source: ResourceSource::Mod,
                rel_path: "linked/outside.png".to_string(),
                owner_kind: ResourceOwnerKind::Ship,
                owner_id: "ship".to_string(),
                key: "sprite".to_string(),
            }],
        );

        let _ = close_project_session(manifest.session_id);
        let _ = std::fs::remove_dir_all(root);
        let _ = std::fs::remove_dir_all(outside);
        assert!(result.is_err());
    }

    #[test]
    fn media_cache_refreshes_entry_when_file_content_changes() {
        let root = temp_dir("media_cache_refresh");
        let sprite_dir = root.join("graphics/ships");
        std::fs::create_dir_all(&sprite_dir).unwrap();
        let sprite = sprite_dir.join("demo.png");
        std::fs::write(&sprite, [1u8]).unwrap();

        let mut trace =
            crate::services::project::performance::PerformanceTrace::new("project.openSession");
        let manifest = open_project_session_traced(&root, None, &mut trace).unwrap();
        let resource = ResourceRef {
            source: ResourceSource::Mod,
            rel_path: "graphics/ships/demo.png".to_string(),
            owner_kind: ResourceOwnerKind::Ship,
            owner_id: "ship".to_string(),
            key: "ship".to_string(),
        };

        let session_id = manifest.session_id.clone();
        let first = query_resource_data_urls(&session_id, vec![resource.clone()])
            .unwrap()
            .entries[0]
            .data_url
            .clone()
            .unwrap();

        std::fs::write(&sprite, [7u8, 7, 7]).unwrap();
        let second = query_resource_data_urls(&session_id, vec![resource])
            .unwrap()
            .entries[0]
            .data_url
            .clone()
            .unwrap();

        close_project_session(session_id).unwrap();
        let _ = std::fs::remove_dir_all(root);
        assert_ne!(first, second);
        assert!(first.ends_with(&general_purpose_base64(&[1u8])));
        assert!(second.ends_with(&general_purpose_base64(&[7u8, 7, 7])));
    }

    #[test]
    fn media_cache_evicts_oldest_beyond_capacity() {
        let root = temp_dir("media_cache_eviction");
        let count = super::super::super::resources::SPRITE_MEDIA_CACHE_CAPACITY_FOR_TEST + 3;
        let sprite_dir = root.join("graphics/ships");
        std::fs::create_dir_all(&sprite_dir).unwrap();
        let mut resources = Vec::new();
        for index in 0..count {
            let name = format!("p{index:04}.png");
            std::fs::write(sprite_dir.join(&name), [index as u8]).unwrap();
            resources.push(ResourceRef {
                source: ResourceSource::Mod,
                rel_path: format!("graphics/ships/{name}"),
                owner_kind: ResourceOwnerKind::Ship,
                owner_id: "ship".to_string(),
                key: name.clone(),
            });
        }

        let mut trace =
            crate::services::project::performance::PerformanceTrace::new("project.openSession");
        let manifest = open_project_session_traced(&root, None, &mut trace).unwrap();
        let result = query_resource_data_urls(&manifest.session_id.clone(), resources).unwrap();

        let oldest_still_cached = cached_sprite_media_contains(
            &manifest.session_id,
            &ResourceRef {
                source: ResourceSource::Mod,
                rel_path: "graphics/ships/p0000.png".to_string(),
                owner_kind: ResourceOwnerKind::Ship,
                owner_id: "ship".to_string(),
                key: "p0000.png".to_string(),
            },
        );
        let newest_still_cached = cached_sprite_media_contains(
            &manifest.session_id,
            &ResourceRef {
                source: ResourceSource::Mod,
                rel_path: format!("graphics/ships/p{:04}.png", count - 1),
                owner_kind: ResourceOwnerKind::Ship,
                owner_id: "ship".to_string(),
                key: format!("p{:04}.png", count - 1),
            },
        );

        let _ = close_project_session(manifest.session_id);
        let _ = std::fs::remove_dir_all(root);
        assert_eq!(result.entries.len(), count);
        assert!(!oldest_still_cached);
        assert!(newest_still_cached);
    }

    #[test]
    fn closing_session_clears_media_cache() {
        let root = temp_dir("media_cache_close_clears");
        let sprite_dir = root.join("graphics/ships");
        std::fs::create_dir_all(&sprite_dir).unwrap();
        std::fs::write(sprite_dir.join("demo.png"), [137, 80, 78, 71]).unwrap();
        let resource = ResourceRef {
            source: ResourceSource::Mod,
            rel_path: "graphics/ships/demo.png".to_string(),
            owner_kind: ResourceOwnerKind::Ship,
            owner_id: "ship".to_string(),
            key: "ship".to_string(),
        };

        let mut trace =
            crate::services::project::performance::PerformanceTrace::new("project.openSession");
        let manifest = open_project_session_traced(&root, None, &mut trace).unwrap();
        let session_id = manifest.session_id.clone();
        query_resource_data_urls(&session_id, vec![resource.clone()]).unwrap();
        assert!(cached_sprite_media_contains(&session_id, &resource));

        close_project_session(session_id.clone()).unwrap();

        assert!(!cached_sprite_media_contains(&session_id, &resource));
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

    fn temp_linked_dir(
        name: &str,
    ) -> Option<(std::path::PathBuf, std::path::PathBuf, std::path::PathBuf)> {
        let root = temp_dir(&format!("{name}_root"));
        let outside = temp_dir(&format!("{name}_outside"));
        let link = root.join("linked");
        if create_dir_link(&outside, &link).is_err() {
            let _ = std::fs::remove_dir_all(root);
            let _ = std::fs::remove_dir_all(outside);
            return None;
        }
        Some((root, outside, link))
    }

    #[cfg(windows)]
    fn create_dir_link(target: &std::path::Path, link: &std::path::Path) -> std::io::Result<()> {
        std::os::windows::fs::symlink_dir(target, link)
    }

    #[cfg(unix)]
    fn create_dir_link(target: &std::path::Path, link: &std::path::Path) -> std::io::Result<()> {
        std::os::unix::fs::symlink(target, link)
    }

    #[cfg(not(any(windows, unix)))]
    fn create_dir_link(_target: &std::path::Path, _link: &std::path::Path) -> std::io::Result<()> {
        Err(std::io::Error::new(
            std::io::ErrorKind::Unsupported,
            "directory links are unsupported on this platform",
        ))
    }
}
