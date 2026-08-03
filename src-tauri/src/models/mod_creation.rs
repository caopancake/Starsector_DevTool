use serde::{Deserialize, Serialize};

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CreateModPayload {
    pub destination: NewModDestination,
    pub template: NewModTemplate,
}

#[derive(Debug, Serialize, Deserialize)]
#[serde(tag = "kind", rename_all = "kebab-case")]
pub enum NewModDestination {
    GameMods {
        #[serde(rename = "starsectorRoot")]
        starsector_root: String,
    },
    Directory {
        #[serde(rename = "parentDirectory")]
        parent_directory: String,
    },
}

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct NewModTemplate {
    pub id: String,
    pub name: String,
    pub version: String,
    pub game_version: String,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CreatedMod {
    pub mod_root: String,
    pub starsector_root: Option<String>,
}
