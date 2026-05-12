use crate::{
    errors::AppResult,
    filesystem::{delete_json_by_id, save_json_by_id},
};
use serde_json::Value;
use std::path::Path;

pub fn save_ship(mod_root: &str, id: &str, data: &Value) -> AppResult<String> {
    save_json_by_id(Path::new(mod_root), "data/hulls", "ship", "hullId", id, data)
}

pub fn delete_ship(mod_root: &str, id: &str) -> AppResult<bool> {
    delete_json_by_id(Path::new(mod_root), "data/hulls", "ship", "hullId", id)
}

pub fn save_weapon(mod_root: &str, id: &str, data: &Value) -> AppResult<String> {
    save_json_by_id(Path::new(mod_root), "data/weapons", "wpn", "id", id, data)
}

pub fn save_projectile(mod_root: &str, id: &str, data: &Value) -> AppResult<String> {
    save_json_by_id(Path::new(mod_root), "data/weapons/proj", "proj", "id", id, data)
}
