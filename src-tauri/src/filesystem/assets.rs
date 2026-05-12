use crate::{
    errors::AppResult,
    models::{UploadSpritePayload, UploadSpriteResult},
};
use base64::{engine::general_purpose, Engine as _};
use regex::Regex;
use std::{fs, path::Path};
use walkdir::WalkDir;

pub fn list_sprites(mod_root: &Path, dirs: &[&str]) -> Vec<String> {
    let mut sprites = Vec::new();
    for dir in dirs {
        let base = mod_root.join(dir);
        if !base.exists() {
            continue;
        }
        for entry in WalkDir::new(base).into_iter().flatten() {
            if entry.path().extension().and_then(|s| s.to_str()).is_some_and(|s| s.eq_ignore_ascii_case("png")) {
                if let Ok(rel) = entry.path().strip_prefix(mod_root) {
                    sprites.push(rel.to_string_lossy().replace('\\', "/"));
                }
            }
        }
    }
    sprites.sort();
    sprites
}

pub fn upload_sprite(payload: UploadSpritePayload) -> AppResult<UploadSpriteResult> {
    let sub = match payload.subfolder.as_deref() {
        Some("weapons") => "graphics/weapons",
        Some("missiles") | Some("proj") => "graphics/missiles",
        Some("fx") => "graphics/fx",
        _ => "graphics/ships",
    };
    let safe_re = Regex::new(r"[^\w\-.]").expect("valid safe filename regex");
    let mut safe_name = safe_re.replace_all(&payload.filename, "_").to_string();
    if !safe_name.to_ascii_lowercase().ends_with(".png") {
        safe_name.push_str(".png");
    }
    let mod_root = Path::new(&payload.mod_root);
    let target_dir = mod_root.join(sub);
    fs::create_dir_all(&target_dir)?;
    let target = target_dir.join(&safe_name);
    let rel = format!("{}/{}", sub, safe_name).replace('\\', "/");
    let exists = target.exists();
    if exists && !payload.overwrite {
        return Ok(UploadSpriteResult {
            ok: false,
            exists: true,
            path: rel,
            overwritten: false,
            message: Some(format!("{safe_name} already exists. Overwrite?")),
        });
    }
    let bytes = general_purpose::STANDARD.decode(payload.data)?;
    fs::write(target, bytes)?;
    Ok(UploadSpriteResult {
        ok: true,
        exists,
        path: rel,
        overwritten: exists,
        message: None,
    })
}
