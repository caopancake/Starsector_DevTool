use crate::models::required_nullable;
use serde::{Deserialize, Serialize};
use serde_json::{Map, Value};

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CsvRowPatch {
    pub row_key: String,
    pub action: CsvRowPatchAction,
    pub row: Map<String, Value>,
}

#[derive(Debug, Clone, Copy, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum CsvRowPatchAction {
    Upsert,
    Delete,
}

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CsvRowKeyMapping {
    pub previous_key: String,
    pub next_key: String,
}

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AssociatedFileChange {
    pub rel_path: String,
    #[serde(deserialize_with = "required_nullable")]
    pub after_text: Option<String>,
    #[serde(deserialize_with = "required_nullable")]
    pub after_data_base64: Option<String>,
    #[serde(default, deserialize_with = "required_nullable")]
    pub previous_rel_path: Option<String>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct EditableFileData {
    pub path: String,
    pub text: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct FileChangeRecord {
    pub kind: FileChangeKind,
    pub path: String,
    pub before_exists: bool,
    #[serde(deserialize_with = "required_nullable")]
    pub before_text: Option<String>,
    #[serde(deserialize_with = "required_nullable")]
    pub before_data_base64: Option<String>,
    pub before_files: Vec<FileSnapshot>,
    pub after_exists: bool,
    #[serde(deserialize_with = "required_nullable")]
    pub after_text: Option<String>,
    #[serde(deserialize_with = "required_nullable")]
    pub after_data_base64: Option<String>,
    pub after_files: Vec<FileSnapshot>,
}

#[derive(Debug, Clone, Copy, Serialize, Deserialize)]
#[serde(rename_all = "kebab-case")]
pub enum FileChangeKind {
    File,
    Directory,
}

#[derive(Debug, Clone, Copy, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum FileChangeReplayDirection {
    Undo,
    Redo,
}

#[derive(Debug, Clone, Copy, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum EditorSpecKind {
    Ship,
    Weapon,
    Projectile,
}

#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub enum IndexedConfigKind {
    Faction,
    Mission,
}

#[derive(Debug, Clone, Copy, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum SpriteSubfolder {
    Ships,
    Weapons,
    Missiles,
    Fx,
}

impl SpriteSubfolder {
    pub fn graphics_rel_dir(self) -> &'static str {
        match self {
            Self::Ships => "graphics/ships",
            Self::Weapons => "graphics/weapons",
            Self::Missiles => "graphics/missiles",
            Self::Fx => "graphics/fx",
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct FileSnapshot {
    pub rel_path: String,
    #[serde(deserialize_with = "required_nullable")]
    pub text: Option<String>,
    #[serde(deserialize_with = "required_nullable")]
    pub data_base64: Option<String>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct WriteResult<T = ()> {
    pub changes: Vec<FileChangeRecord>,
    pub invalidated_paths: Vec<String>,
    pub key_map: Vec<CsvRowKeyMapping>,
    pub refreshed_entity: Option<T>,
    pub warnings: Vec<String>,
}

impl<T> WriteResult<T> {
    pub fn invalidated_paths(&self) -> &[String] {
        &self.invalidated_paths
    }

    pub fn refreshed_entity(&self) -> Option<&T> {
        self.refreshed_entity.as_ref()
    }

    pub fn warnings(&self) -> &[String] {
        &self.warnings
    }
}

#[cfg(test)]
mod tests {
    use super::{AssociatedFileChange, FileChangeRecord, FileSnapshot, WriteResult};
    use serde_json::json;

    #[test]
    fn associated_file_change_requires_explicit_nullable_content_fields() {
        let result = serde_json::from_value::<AssociatedFileChange>(json!({
            "relPath": "data/config/demo.json",
            "afterText": "{}"
        }));

        assert!(result.is_err());
    }

    #[test]
    fn file_change_record_requires_explicit_nullable_and_collection_fields() {
        let result = serde_json::from_value::<FileChangeRecord>(json!({
            "kind": "file",
            "path": "D:/mods/demo/data/config/demo.json",
            "beforeExists": false,
            "beforeText": null,
            "afterExists": true,
            "afterText": "{}",
            "afterDataBase64": null,
            "afterFiles": []
        }));

        assert!(result.is_err());
    }

    #[test]
    fn file_snapshot_requires_explicit_nullable_content_fields() {
        let result = serde_json::from_value::<FileSnapshot>(json!({
            "relPath": "data/config/demo.json",
            "text": "{}"
        }));

        assert!(result.is_err());
    }

    #[test]
    fn write_result_model_stays_explicit() {
        let result: WriteResult<()> = WriteResult {
            changes: Vec::new(),
            invalidated_paths: vec!["data/test.csv".to_string()],
            key_map: Vec::new(),
            refreshed_entity: None,
            warnings: vec!["warn".to_string()],
        };
        assert_eq!(result.invalidated_paths(), ["data/test.csv"]);
        assert!(result.refreshed_entity().is_none());
        assert_eq!(result.warnings(), ["warn"]);
    }
}
