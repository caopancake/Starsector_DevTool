use serde::{Deserialize, Serialize};
use serde_json::{Map, Value};

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SaveCsvPayload {
    pub mod_root: String,
    pub table: String,
    pub header: Vec<String>,
    pub rows: Vec<Map<String, Value>>,
}

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SaveJsonPayload {
    pub mod_root: String,
    pub id: String,
    pub data: Value,
}

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DeletePayload {
    pub mod_root: String,
    pub table: Option<String>,
    pub id: String,
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

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct UploadSpriteResult {
    pub ok: bool,
    pub exists: bool,
    pub path: String,
    pub overwritten: bool,
    pub message: Option<String>,
}
