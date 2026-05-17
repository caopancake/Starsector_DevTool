use crate::{
    errors::AppResult,
    filesystem::{read_json_file, strip_internal_fields},
    models::{FileChangeRecord, SaveJsonWithHistoryPayload},
    services::file_changes::{apply_file_change_set, build_text_change},
};
use serde_json::Value;
use std::path::{Path, PathBuf};
use walkdir::WalkDir;

pub fn save_json_with_history(
    payload: SaveJsonWithHistoryPayload,
) -> AppResult<Vec<FileChangeRecord>> {
    let target = find_json_target(
        Path::new(&payload.mod_root),
        &payload.rel_dir,
        &payload.ext,
        &payload.id_key,
        &payload.id,
    );
    let clean = strip_internal_fields(&payload.data);
    let text = serde_json::to_string_pretty(&clean)?;
    let change = build_text_change(&target, Some(text))?;
    apply_file_change_set(crate::models::ApplyFileChangeSetPayload {
        direction: "redo".to_string(),
        changes: vec![change.clone()],
    })?;
    Ok(vec![change])
}

fn find_json_target(mod_root: &Path, rel_dir: &str, ext: &str, id_key: &str, id: &str) -> PathBuf {
    let dir = mod_root.join(rel_dir);
    if dir.exists() {
        for entry in WalkDir::new(&dir).into_iter().flatten() {
            if entry.path().extension().and_then(|s| s.to_str()) != Some(ext) {
                continue;
            }
            if let Ok(value) = read_json_file(entry.path()) {
                if value.get(id_key).and_then(Value::as_str) == Some(id) {
                    return entry.path().to_path_buf();
                }
            }
        }
    }
    dir.join(format!("{id}.{ext}"))
}
