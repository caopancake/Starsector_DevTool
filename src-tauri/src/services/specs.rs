use crate::{
    errors::AppResult,
    filesystem::{delete_json_by_id, save_json_by_id},
    models::specs::{validate_projectile_spec, validate_ship_spec, validate_weapon_spec},
};
use serde_json::Value;
use std::path::Path;

pub fn save_ship(mod_root: &str, id: &str, data: &Value) -> AppResult<String> {
    validate_ship_spec(data)?;
    save_json_by_id(
        Path::new(mod_root),
        "data/hulls",
        "ship",
        "hullId",
        id,
        data,
    )
}

pub fn delete_ship(mod_root: &str, id: &str) -> AppResult<bool> {
    delete_json_by_id(Path::new(mod_root), "data/hulls", "ship", "hullId", id)
}

pub fn save_weapon(mod_root: &str, id: &str, data: &Value) -> AppResult<String> {
    validate_weapon_spec(data)?;
    save_json_by_id(Path::new(mod_root), "data/weapons", "wpn", "id", id, data)
}

pub fn save_projectile(mod_root: &str, id: &str, data: &Value) -> AppResult<String> {
    validate_projectile_spec(data)?;
    save_json_by_id(
        Path::new(mod_root),
        "data/weapons/proj",
        "proj",
        "id",
        id,
        data,
    )
}
