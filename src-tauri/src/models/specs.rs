use serde::{Deserialize, Serialize};
use serde_json::{Map, Value};

use crate::{errors::AppResult, filesystem::strip_internal_fields};

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ShipSpecCore {
    pub hull_id: String,
    #[serde(default)]
    pub hull_name: Option<String>,
    #[serde(default)]
    pub hull_size: Option<String>,
    #[serde(default)]
    pub sprite_name: Option<String>,
    #[serde(default)]
    pub center: Option<Vec<f64>>,
    #[serde(default)]
    pub weapon_slots: Vec<Value>,
    #[serde(flatten)]
    pub extra: Map<String, Value>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct WeaponSpecCore {
    pub id: String,
    #[serde(default)]
    pub spec_class: Option<String>,
    #[serde(default)]
    pub weapon_type: Option<String>,
    #[serde(default)]
    pub size: Option<String>,
    #[serde(default)]
    pub projectile_spec_id: Option<String>,
    #[serde(flatten)]
    pub extra: Map<String, Value>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ProjectileSpecCore {
    pub id: String,
    #[serde(default)]
    pub spec_class: Option<String>,
    #[serde(default)]
    pub sprite: Option<String>,
    #[serde(default)]
    pub bullet_sprite: Option<String>,
    #[serde(default)]
    pub engine_spec: Option<Value>,
    #[serde(flatten)]
    pub extra: Map<String, Value>,
}

pub fn validate_ship_spec(value: &Value) -> AppResult<ShipSpecCore> {
    Ok(serde_json::from_value(strip_internal_fields(value))?)
}

pub fn validate_weapon_spec(value: &Value) -> AppResult<WeaponSpecCore> {
    Ok(serde_json::from_value(strip_internal_fields(value))?)
}

pub fn validate_projectile_spec(value: &Value) -> AppResult<ProjectileSpecCore> {
    Ok(serde_json::from_value(strip_internal_fields(value))?)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn ship_core_preserves_unknown_fields() {
        let spec: ShipSpecCore = serde_json::from_value(serde_json::json!({
            "hullId": "demo_ship",
            "hullName": "Demo",
            "customField": 7
        }))
        .unwrap();
        assert_eq!(spec.hull_id, "demo_ship");
        assert_eq!(spec.extra["customField"], 7);
    }

    #[test]
    fn weapon_core_keeps_projectile_link() {
        let spec: WeaponSpecCore = serde_json::from_value(serde_json::json!({
            "id": "demo_weapon",
            "projectileSpecId": "demo_proj",
            "barrelMode": "LINKED"
        }))
        .unwrap();
        assert_eq!(spec.projectile_spec_id.as_deref(), Some("demo_proj"));
        assert_eq!(spec.extra["barrelMode"], "LINKED");
    }

    #[test]
    fn projectile_core_accepts_missile_fields() {
        let spec: ProjectileSpecCore = serde_json::from_value(serde_json::json!({
            "id": "demo_proj",
            "specClass": "missile",
            "engineSpec": {"maxSpeed": 400},
            "engineSlots": []
        }))
        .unwrap();
        assert_eq!(spec.spec_class.as_deref(), Some("missile"));
        assert!(spec.engine_spec.is_some());
        assert!(spec.extra.contains_key("engineSlots"));
    }

    #[test]
    fn validation_ignores_internal_fields() {
        let spec = validate_ship_spec(&serde_json::json!({
            "hullId": "demo_ship",
            "_source": "mod"
        }))
        .unwrap();
        assert_eq!(spec.hull_id, "demo_ship");
        assert!(!spec.extra.contains_key("_source"));
    }
}
