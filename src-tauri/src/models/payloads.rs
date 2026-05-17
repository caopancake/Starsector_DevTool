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
pub struct AddCsvRowPayload {
    pub mod_root: String,
    pub table: String,
    pub header: Vec<String>,
    pub row: Map<String, Value>,
}

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AddShipRowPayload {
    pub mod_root: String,
    pub header: Vec<String>,
    pub row: Map<String, Value>,
    pub ship: Value,
}

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AddWeaponRowPayload {
    pub mod_root: String,
    pub header: Vec<String>,
    pub row: Map<String, Value>,
    pub weapon: Value,
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

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SaveModInfoPayload {
    pub mod_root: String,
    pub data: Value,
}

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct FactionPayload {
    pub mod_root: String,
    pub id: String,
    pub data: Option<Value>,
    pub delete_file: Option<bool>,
}

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct MissionListCsvPayload {
    pub mod_root: String,
    pub rel_path: String,
    pub header: Option<Vec<String>>,
    pub rows: Option<Vec<Map<String, Value>>>,
}

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct MissionPayload {
    pub mod_root: String,
    pub mission: String,
    pub descriptor: Option<Value>,
    pub text: Option<String>,
}

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct MissionData {
    pub descriptor: Value,
    pub text: String,
    pub icon_path: Option<String>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct EditableFileData {
    pub path: String,
    pub text: String,
}

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SaveEditableFilePayload {
    pub path: String,
    pub text: String,
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

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn save_csv_payload_uses_camel_case_mod_root() {
        let payload: SaveCsvPayload = serde_json::from_value(serde_json::json!({
            "modRoot": "D:/mod",
            "table": "ships",
            "header": ["id"],
            "rows": [{"id": "demo"}]
        }))
        .unwrap();
        assert_eq!(payload.mod_root, "D:/mod");
        assert_eq!(payload.table, "ships");
    }

    #[test]
    fn save_csv_payload_rejects_snake_case_mod_root() {
        let result = serde_json::from_value::<SaveCsvPayload>(serde_json::json!({
            "mod_root": "D:/mod",
            "table": "ships",
            "header": ["id"],
            "rows": []
        }));
        assert!(result.is_err());
    }
}
