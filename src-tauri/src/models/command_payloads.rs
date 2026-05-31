use crate::models::{
    app_config::{AppLogEntry, AppSettings},
    project::{CsvFactionFilter, CsvTableKey, EntityKind, ProjectSessionId, ResourceRef},
    required_nullable, required_nullable_non_empty_string,
    workspace::PersistedWorkspace,
    write::{
        AssociatedFileChange, CsvRowPatch, EditorSpecKind, FileChangeRecord,
        FileChangeReplayDirection, IndexedConfigKind, SpriteSubfolder,
    },
};
use serde::{Deserialize, Serialize};
use serde_json::{Map, Value};

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SaveCsvPatchPayload {
    pub session_id: ProjectSessionId,
    pub table: CsvTableKey,
    pub patches: Vec<CsvRowPatch>,
    pub associated_files: Vec<AssociatedFileChange>,
}

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct OpenProjectSessionPayload {
    pub mod_root: String,
    #[serde(deserialize_with = "required_nullable_non_empty_string")]
    pub starsector_root: Option<String>,
}

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CloseProjectSessionPayload {
    pub session_id: ProjectSessionId,
}

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DetectDirectoryPayload {
    pub path: String,
    #[serde(deserialize_with = "required_nullable_non_empty_string")]
    pub known_starsector_root: Option<String>,
}

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ScanGameOverviewPayload {
    pub starsector_root: String,
}

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AppendAppLogPayload {
    pub entry: AppLogEntry,
}

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SaveAppSettingsPayload {
    pub settings: AppSettings,
}

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SaveWorkspacePayload {
    pub state: PersistedWorkspace,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct CsvTableWindowPayload {
    pub session_id: ProjectSessionId,
    pub table: CsvTableKey,
    pub start: usize,
    pub count: usize,
    #[serde(deserialize_with = "required_nullable")]
    pub search: Option<String>,
    pub faction: CsvFactionFilter,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct CsvSourceOptionsPayload {
    pub session_id: ProjectSessionId,
    pub source: String,
    #[serde(deserialize_with = "required_nullable")]
    pub search: Option<String>,
    #[serde(deserialize_with = "required_nullable")]
    pub limit: Option<usize>,
    pub current_values: Vec<String>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct CsvRowPreviewPayload {
    pub session_id: ProjectSessionId,
    pub table: CsvTableKey,
    pub row_key: String,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct QueryEntityPayload {
    pub session_id: ProjectSessionId,
    pub kind: EntityKind,
    pub id: String,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct QueryEntityListPayload {
    pub session_id: ProjectSessionId,
    pub kind: EntityKind,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct ResourceDataUrlBatchPayload {
    pub session_id: ProjectSessionId,
    pub resources: Vec<ResourceRef>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct CoreScanPayload {
    pub starsector_root: String,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct HullReferencesPayload {
    pub session_id: ProjectSessionId,
    pub reference_ids: Vec<String>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct InvalidateProjectSessionPayload {
    pub session_id: ProjectSessionId,
    pub changed_paths: Vec<String>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct InvalidateCoreCachePayload {
    pub starsector_root: String,
}

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UploadSpritePayload {
    pub session_id: ProjectSessionId,
    pub mod_root: String,
    pub filename: String,
    pub data: String,
    pub overwrite: bool,
    pub subfolder: SpriteSubfolder,
}

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct IndexedConfigEntityPayload {
    pub session_id: ProjectSessionId,
    pub mod_root: String,
    pub kind: IndexedConfigKind,
    #[serde(deserialize_with = "required_nullable")]
    pub previous_id: Option<String>,
    pub next_id: String,
    pub index_row: Map<String, Value>,
    pub entity_data: Value,
    pub delete_previous_target: bool,
}

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DeleteIndexedConfigEntityPayload {
    pub session_id: ProjectSessionId,
    pub mod_root: String,
    pub kind: IndexedConfigKind,
    pub id: String,
    pub delete_target: bool,
}

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ConfigFileEntityPayload {
    pub session_id: ProjectSessionId,
    pub mod_root: String,
    #[serde(deserialize_with = "required_nullable")]
    pub previous_id: Option<String>,
    #[serde(deserialize_with = "required_nullable")]
    pub previous_rel_path: Option<String>,
    pub next_id: String,
    pub data: Value,
}

pub type VariantEntityPayload = ConfigFileEntityPayload;
pub type SkinEntityPayload = ConfigFileEntityPayload;

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DeleteVariantEntityPayload {
    pub session_id: ProjectSessionId,
    pub mod_root: String,
    pub variant_id: String,
    pub rel_path: String,
}

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DeleteSkinEntityPayload {
    pub session_id: ProjectSessionId,
    pub mod_root: String,
    pub skin_hull_id: String,
    pub rel_path: String,
}

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SaveTextFilePayload {
    pub session_id: ProjectSessionId,
    pub mod_root: String,
    pub path: String,
    pub text: String,
}

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct LoadEditableFilePayload {
    pub session_id: ProjectSessionId,
    pub mod_root: String,
    pub path: String,
}

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct LoadImportedEditorSpecPayload {
    pub kind: EditorSpecKind,
    pub path: String,
}

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SaveModFilesPayload {
    pub session_id: ProjectSessionId,
    pub mod_root: String,
    pub files: Vec<AssociatedFileChange>,
}

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SaveEditorSpecPayload {
    pub session_id: ProjectSessionId,
    pub mod_root: String,
    pub kind: EditorSpecKind,
    pub id: String,
    pub data: Value,
}

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ApplyFileChangeSetPayload {
    pub session_id: ProjectSessionId,
    pub mod_root: String,
    pub direction: FileChangeReplayDirection,
    pub changes: Vec<FileChangeRecord>,
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    #[test]
    fn indexed_config_entity_payload_uses_entity_data_wire_field() {
        let payload: IndexedConfigEntityPayload = serde_json::from_value(json!({
            "sessionId": "session-1",
            "modRoot": "D:/mods/demo",
            "kind": "faction",
            "previousId": null,
            "nextId": "demo",
            "indexRow": {"id": "demo"},
            "entityData": {"file": {"id": "demo"}},
            "deletePreviousTarget": false
        }))
        .unwrap();

        assert_eq!(payload.entity_data["file"]["id"], "demo");
    }

    #[test]
    fn open_project_session_payload_requires_explicit_nullable_root() {
        let result = serde_json::from_value::<OpenProjectSessionPayload>(json!({
            "modRoot": "D:/mods/demo"
        }));

        assert!(result.is_err());
    }

    #[test]
    fn open_project_session_payload_treats_blank_root_as_missing() {
        let payload = serde_json::from_value::<OpenProjectSessionPayload>(json!({
            "modRoot": "D:/mods/demo",
            "starsectorRoot": "  "
        }))
        .unwrap();

        assert_eq!(payload.starsector_root, None);
    }

    #[test]
    fn detect_directory_payload_requires_explicit_nullable_known_root() {
        let result = serde_json::from_value::<DetectDirectoryPayload>(json!({
            "path": "D:/mods/demo"
        }));

        assert!(result.is_err());
    }

    #[test]
    fn detect_directory_payload_treats_blank_known_root_as_missing() {
        let payload = serde_json::from_value::<DetectDirectoryPayload>(json!({
            "path": "D:/mods/demo",
            "knownStarsectorRoot": "  "
        }))
        .unwrap();

        assert_eq!(payload.known_starsector_root, None);
    }

    #[test]
    fn csv_table_window_payload_requires_explicit_nullable_filters() {
        let result = serde_json::from_value::<CsvTableWindowPayload>(json!({
            "sessionId": "session-1",
            "table": "ships",
            "start": 0,
            "count": 50,
            "search": null
        }));

        assert!(result.is_err());
    }

    #[test]
    fn csv_table_window_payload_uses_explicit_faction_filter() {
        let payload = serde_json::from_value::<CsvTableWindowPayload>(json!({
            "sessionId": "session-1",
            "table": "ships",
            "start": 0,
            "count": 50,
            "search": null,
            "faction": {"kind": "faction", "factionId": "demo"}
        }))
        .unwrap();

        assert_eq!(
            payload.faction,
            CsvFactionFilter::Faction {
                faction_id: "demo".to_string()
            }
        );
    }

    #[test]
    fn csv_source_options_payload_requires_explicit_nullable_limit() {
        let result = serde_json::from_value::<CsvSourceOptionsPayload>(json!({
            "sessionId": "session-1",
            "source": "hullId",
            "search": null,
            "currentValues": []
        }));

        assert!(result.is_err());
    }

    #[test]
    fn hull_references_payload_uses_reference_ids() {
        let payload = serde_json::from_value::<HullReferencesPayload>(json!({
            "sessionId": "session-1",
            "referenceIds": ["ship_or_skin"]
        }))
        .unwrap();

        assert_eq!(payload.reference_ids, vec!["ship_or_skin".to_string()]);
    }

    #[test]
    fn indexed_config_entity_payload_requires_explicit_delete_flag() {
        let result = serde_json::from_value::<IndexedConfigEntityPayload>(json!({
            "sessionId": "session-1",
            "modRoot": "D:/mods/demo",
            "kind": "faction",
            "previousId": null,
            "nextId": "demo",
            "indexRow": {"id": "demo"},
            "entityData": {"file": {"id": "demo"}}
        }));

        assert!(result.is_err());
    }

    #[test]
    fn config_file_entity_payload_requires_explicit_nullable_previous_path() {
        let result = serde_json::from_value::<ConfigFileEntityPayload>(json!({
            "sessionId": "session-1",
            "modRoot": "D:/mods/demo",
            "previousId": null,
            "nextId": "demo",
            "data": {"id": "demo"}
        }));

        assert!(result.is_err());
    }

    #[test]
    fn delete_indexed_config_entity_payload_requires_explicit_delete_flag() {
        let result = serde_json::from_value::<DeleteIndexedConfigEntityPayload>(json!({
            "sessionId": "session-1",
            "modRoot": "D:/mods/demo",
            "kind": "faction",
            "id": "demo"
        }));

        assert!(result.is_err());
    }

    #[test]
    fn upload_sprite_payload_requires_explicit_subfolder() {
        let result = serde_json::from_value::<UploadSpritePayload>(json!({
            "sessionId": "session-1",
            "modRoot": "D:/mods/demo",
            "filename": "demo.png",
            "data": "AA==",
            "overwrite": false
        }));

        assert!(result.is_err());
    }

    #[test]
    fn upload_sprite_payload_requires_session_id() {
        let result = serde_json::from_value::<UploadSpritePayload>(json!({
            "modRoot": "D:/mods/demo",
            "filename": "demo.png",
            "data": "AA==",
            "subfolder": "ships",
            "overwrite": false
        }));

        assert!(result.is_err());
    }

    #[test]
    fn save_text_file_payload_requires_mod_root() {
        let result = serde_json::from_value::<SaveTextFilePayload>(json!({
            "sessionId": "session-1",
            "path": "D:/mods/demo/mod_info.json",
            "text": "{}"
        }));

        assert!(result.is_err());
    }

    #[test]
    fn save_text_file_payload_requires_session_id() {
        let result = serde_json::from_value::<SaveTextFilePayload>(json!({
            "modRoot": "D:/mods/demo",
            "path": "D:/mods/demo/mod_info.json",
            "text": "{}"
        }));

        assert!(result.is_err());
    }

    #[test]
    fn load_editable_file_payload_requires_mod_root() {
        let result = serde_json::from_value::<LoadEditableFilePayload>(json!({
            "sessionId": "session-1",
            "path": "D:/mods/demo/mod_info.json"
        }));

        assert!(result.is_err());
    }

    #[test]
    fn load_imported_editor_spec_payload_requires_kind() {
        let result = serde_json::from_value::<LoadImportedEditorSpecPayload>(json!({
            "path": "D:/mods/demo/data/weapons/demo.wpn"
        }));

        assert!(result.is_err());
    }

    #[test]
    fn apply_file_change_set_payload_requires_mod_root() {
        let result = serde_json::from_value::<ApplyFileChangeSetPayload>(json!({
            "sessionId": "session-1",
            "direction": "undo",
            "changes": []
        }));

        assert!(result.is_err());
    }

    #[test]
    fn apply_file_change_set_payload_requires_session_id() {
        let result = serde_json::from_value::<ApplyFileChangeSetPayload>(json!({
            "modRoot": "D:/mods/demo",
            "direction": "undo",
            "changes": []
        }));

        assert!(result.is_err());
    }

    #[test]
    fn save_csv_patch_payload_requires_explicit_associated_files() {
        let result = serde_json::from_value::<SaveCsvPatchPayload>(json!({
            "sessionId": "session-1",
            "table": "ships",
            "patches": []
        }));

        assert!(result.is_err());
    }

    #[test]
    fn save_csv_patch_payload_requires_explicit_patch_row() {
        let result = serde_json::from_value::<SaveCsvPatchPayload>(json!({
            "sessionId": "session-1",
            "table": "ships",
            "patches": [{
                "rowKey": "ships:row:0",
                "action": "delete"
            }],
            "associatedFiles": []
        }));

        assert!(result.is_err());
    }
}
