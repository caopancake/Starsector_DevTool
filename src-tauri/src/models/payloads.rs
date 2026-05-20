use serde::{Deserialize, Serialize};
use serde_json::{Map, Value};

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SaveCsvWithHistoryPayload {
    pub mod_root: String,
    pub table: String,
    pub header: Vec<String>,
    pub rows: Vec<Map<String, Value>>,
    #[serde(default)]
    pub associated_files: Vec<AssociatedFileChangePayload>,
}

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AssociatedFileChangePayload {
    pub rel_path: String,
    #[serde(default)]
    pub after_text: Option<String>,
    #[serde(default)]
    pub after_data_base64: Option<String>,
}

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UploadSpritePayload {
    pub mod_root: String,
    pub filename: String,
    pub data: String,
    pub overwrite: bool,
    pub subfolder: Option<String>,
}

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct MissionListCsvPayload {
    pub mod_root: String,
    pub rel_path: String,
}

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct LoadCsvTablePayload {
    pub mod_root: String,
    pub table: String,
}

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct MissionPayload {
    pub mod_root: String,
    pub mission: String,
    pub previous_mission_id: Option<String>,
    pub descriptor: Option<Value>,
    pub text: Option<String>,
    pub mission_list_rel_path: Option<String>,
    pub header: Option<Vec<String>>,
    pub rows: Option<Vec<Map<String, Value>>>,
    pub delete_previous_directory: Option<bool>,
    pub delete_mission_directory: Option<bool>,
}

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct MissionData {
    pub descriptor: Value,
    pub text: String,
    pub icon_path: Option<String>,
}

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct IndexedConfigEntityPayload {
    pub mod_root: String,
    pub kind: String,
    pub previous_id: Option<String>,
    pub next_id: String,
    pub index_row: Map<String, Value>,
    pub payload: Value,
    #[serde(default)]
    pub delete_previous_target: bool,
}

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DeleteIndexedConfigEntityPayload {
    pub mod_root: String,
    pub kind: String,
    pub id: String,
    #[serde(default)]
    pub delete_target: bool,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct IndexedConfigEntityResult {
    pub changes: Vec<FileChangeRecord>,
    pub entity_id: String,
    pub index_path: String,
    pub index_header: Vec<String>,
    pub index_rows: Vec<Map<String, Value>>,
    pub entity_payload: Value,
}

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ConfigFileEntityPayload {
    pub mod_root: String,
    pub previous_id: Option<String>,
    pub previous_rel_path: Option<String>,
    pub next_id: String,
    pub data: Value,
}

pub type VariantEntityPayload = ConfigFileEntityPayload;
pub type SkinEntityPayload = ConfigFileEntityPayload;

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DeleteVariantEntityPayload {
    pub mod_root: String,
    pub variant_id: String,
    pub rel_path: String,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct VariantEntityResult {
    pub changes: Vec<FileChangeRecord>,
    pub variant_file: crate::models::VariantFile,
}

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DeleteSkinEntityPayload {
    pub mod_root: String,
    pub skin_hull_id: String,
    pub rel_path: String,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SkinEntityResult {
    pub changes: Vec<FileChangeRecord>,
    pub skin_file: crate::models::SkinFile,
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
    pub before_text: Option<String>,
    #[serde(default)]
    pub before_data_base64: Option<String>,
    #[serde(default)]
    pub before_files: Vec<FileSnapshot>,
    pub after_exists: bool,
    pub after_text: Option<String>,
    #[serde(default)]
    pub after_data_base64: Option<String>,
    #[serde(default)]
    pub after_files: Vec<FileSnapshot>,
}

#[derive(Debug, Clone, Copy, Serialize, Deserialize)]
#[serde(rename_all = "kebab-case")]
pub enum FileChangeKind {
    File,
    Directory,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct FileSnapshot {
    pub rel_path: String,
    pub text: Option<String>,
    pub data_base64: Option<String>,
}

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SaveTextFileWithHistoryPayload {
    pub path: String,
    pub text: String,
}

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SaveModFilesWithHistoryPayload {
    pub mod_root: String,
    pub files: Vec<AssociatedFileChangePayload>,
}

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SaveJsonWithHistoryPayload {
    pub mod_root: String,
    pub rel_dir: String,
    pub ext: String,
    pub id_key: String,
    pub id: String,
    pub data: Value,
}

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ApplyFileChangeSetPayload {
    pub direction: String,
    pub changes: Vec<FileChangeRecord>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct UploadSpriteResult {
    pub ok: bool,
    pub exists: bool,
    pub path: String,
    pub overwritten: bool,
    pub message: Option<String>,
    pub changes: Vec<FileChangeRecord>,
}
