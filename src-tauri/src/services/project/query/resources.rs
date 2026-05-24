use super::super::cache::{session_for, sessions};
use super::resources_shared::{resource_cache_key, resource_data_url};
use crate::{
    errors::{AppError, AppResult},
    models::{ResourceDataUrlBatchEntry, ResourceDataUrlBatchPayload, ResourceDataUrlBatchResult},
};
use std::collections::BTreeMap;

pub fn query_resource_data_urls_for_command(
    payload: ResourceDataUrlBatchPayload,
) -> AppResult<ResourceDataUrlBatchResult> {
    let guard = sessions()
        .lock()
        .map_err(|_| AppError::message("project session lock poisoned"))?;
    let session = session_for(&guard, &payload.session_id)?;
    let mut loaded: BTreeMap<String, Option<String>> = BTreeMap::new();
    let mut entries = Vec::with_capacity(payload.resources.len());
    for resource in payload.resources {
        let cache_key = resource_cache_key(&resource);
        let data_url = if let Some(data_url) = loaded.get(&cache_key) {
            data_url.clone()
        } else {
            let data_url = resource_data_url(session, &resource);
            loaded.insert(cache_key, data_url.clone());
            data_url
        };
        entries.push(ResourceDataUrlBatchEntry {
            key: resource.key,
            source: resource.source,
            rel_path: resource.rel_path,
            data_url,
        });
    }
    Ok(ResourceDataUrlBatchResult { entries })
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::{
        models::{ResourceDataUrlBatchPayload, ResourceRef},
        services::project::session::{
            close_project_session_for_command, open_project_session_traced,
        },
    };
    use std::time::{SystemTime, UNIX_EPOCH};

    #[test]
    fn batch_resource_query_keeps_order_and_uses_empty_for_missing() {
        let root = temp_dir("batch_resource_query");
        std::fs::create_dir_all(root.join("graphics/ships")).unwrap();
        std::fs::write(root.join("graphics/ships/ship.png"), [137, 80, 78, 71]).unwrap();

        let mut trace =
            crate::services::project::performance::PerformanceTrace::new("project.openSession");
        let manifest = open_project_session_traced(&root, None, &mut trace).unwrap();
        let result = query_resource_data_urls_for_command(ResourceDataUrlBatchPayload {
            session_id: manifest.session_id.clone(),
            resources: vec![
                ResourceRef {
                    source: "mod".to_string(),
                    rel_path: "graphics/ships/ship.png".to_string(),
                    owner_kind: "ship".to_string(),
                    owner_id: "ship".to_string(),
                    key: "ship".to_string(),
                },
                ResourceRef {
                    source: "mod".to_string(),
                    rel_path: "graphics/ships/missing.png".to_string(),
                    owner_kind: "ship".to_string(),
                    owner_id: "missing".to_string(),
                    key: "missing".to_string(),
                },
            ],
        })
        .unwrap();

        let _ = close_project_session_for_command(manifest.session_id);
        let _ = std::fs::remove_dir_all(root);
        assert_eq!(result.entries.len(), 2);
        assert_eq!(result.entries[0].key, "ship");
        assert!(result.entries[0].data_url.is_some());
        assert_eq!(result.entries[1].key, "missing");
        assert!(result.entries[1].data_url.is_none());
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
