use std::path::Path;
use walkdir::WalkDir;

pub fn list_sprites(mod_root: &Path, dirs: &[&str]) -> Vec<String> {
    let mut sprites = Vec::new();
    for dir in dirs {
        let base = mod_root.join(dir);
        if !base.exists() {
            continue;
        }
        for entry in WalkDir::new(base).into_iter().flatten() {
            if entry
                .path()
                .extension()
                .and_then(|s| s.to_str())
                .is_some_and(|s| s.eq_ignore_ascii_case("png"))
            {
                if let Ok(rel) = entry.path().strip_prefix(mod_root) {
                    sprites.push(rel.to_string_lossy().replace('\\', "/"));
                }
            }
        }
    }
    sprites.sort();
    sprites
}
