use super::model::normalize_rel_path;
use crate::{
    domain::config::{build_skin_file, build_variant_file},
    errors::{AppError, AppResult},
    models::{GameScanWarning, SkinFile, VariantFile},
};
use std::path::Path;

pub(super) fn load_variant_files(
    mod_root: &Path,
) -> AppResult<(Vec<VariantFile>, Vec<GameScanWarning>)> {
    let dir = mod_root.join("data/variants");
    if !dir.exists() {
        return Ok((vec![], vec![]));
    }
    let mut seen = std::collections::HashMap::new();
    let mut files = Vec::new();
    let mut warnings = Vec::new();
    for entry in walkdir::WalkDir::new(&dir).into_iter() {
        let entry = entry.map_err(|error| {
            AppError::context(
                format!("遍历 variant 目录失败 ({})", dir.display()),
                AppError::message(error.to_string()),
            )
        })?;
        crate::io::validate_walk_entry(entry.path(), "variant directory")?;
        if entry.path().extension().and_then(|s| s.to_str()) != Some("variant") {
            continue;
        }
        let path = entry.path();
        let data = crate::io::read_json_file(path)?;
        let rel_path = normalize_rel_path(mod_root, path);
        let file = build_variant_file(mod_root, &rel_path, &data)
            .map_err(|error| AppError::context(path.display().to_string(), error))?;
        if let Some(previous) =
            seen.insert(file.variant_id.clone(), path.to_string_lossy().to_string())
        {
            warnings.push(GameScanWarning {
                path: path.to_string_lossy().to_string(),
                message: format!(
                    "重复 variantId {}，已保留第一个文件并跳过后续文件：{previous}",
                    file.variant_id
                ),
                edit_target: None,
            });
            continue;
        }
        files.push(file);
    }
    files.sort_by(|a, b| {
        a.hull_id
            .cmp(&b.hull_id)
            .then_with(|| a.variant_id.cmp(&b.variant_id))
    });
    Ok((files, warnings))
}

pub(super) fn load_skin_files(mod_root: &Path) -> AppResult<(Vec<SkinFile>, Vec<GameScanWarning>)> {
    let dir = mod_root.join("data/hulls/skins");
    if !dir.exists() {
        return Ok((vec![], vec![]));
    }
    let mut seen = std::collections::HashMap::new();
    let mut files = Vec::new();
    let mut warnings = Vec::new();
    for entry in walkdir::WalkDir::new(&dir).into_iter() {
        let entry = entry.map_err(|error| {
            AppError::context(
                format!("遍历 skin 目录失败 ({})", dir.display()),
                AppError::message(error.to_string()),
            )
        })?;
        crate::io::validate_walk_entry(entry.path(), "skin directory")?;
        if entry.path().extension().and_then(|s| s.to_str()) != Some("skin") {
            continue;
        }
        let path = entry.path();
        let data = crate::io::read_json_file(path)?;
        let rel_path = normalize_rel_path(mod_root, path);
        let file = build_skin_file(mod_root, &rel_path, &data)
            .map_err(|error| AppError::context(path.display().to_string(), error))?;
        if let Some(previous) = seen.insert(
            file.skin_hull_id.clone(),
            path.to_string_lossy().to_string(),
        ) {
            warnings.push(GameScanWarning {
                path: path.to_string_lossy().to_string(),
                message: format!(
                    "重复 skinHullId {}，已保留第一个文件并跳过后续文件：{previous}",
                    file.skin_hull_id
                ),
                edit_target: None,
            });
            continue;
        }
        files.push(file);
    }
    files.sort_by(|a, b| {
        a.base_hull_id
            .cmp(&b.base_hull_id)
            .then_with(|| a.skin_hull_id.cmp(&b.skin_hull_id))
    });
    Ok((files, warnings))
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::io::write_utf8_no_bom;
    use std::time::{SystemTime, UNIX_EPOCH};

    #[test]
    fn duplicate_variant_ids_keep_first_and_warn() {
        let root = temp_dir("core_kite_duplicate");
        let core_root = root.join("starsector-core");
        std::fs::create_dir_all(core_root.join("data/variants/kite")).unwrap();
        write_utf8_no_bom(
            &core_root.join("data/variants/kite/kite_Interceptor.variant"),
            r#"{"variantId":"kite_hegemony_Interceptor","hullId":"kite_hegemony"}"#,
        )
        .unwrap();
        write_utf8_no_bom(
            &core_root.join("data/variants/kite_hegemony_Interceptor.variant"),
            r#"{"variantId":"kite_hegemony_Interceptor","hullId":"kite_hegemony"}"#,
        )
        .unwrap();
        write_utf8_no_bom(
            &core_root.join("data/variants/kite/kite_Stock.variant"),
            r#"{"variantId":"kite_original_Stock","hullId":"kite_original"}"#,
        )
        .unwrap();
        write_utf8_no_bom(
            &core_root.join("data/variants/kite_original_Stock.variant"),
            r#"{"variantId":"kite_original_Stock","hullId":"kite_original"}"#,
        )
        .unwrap();
        write_utf8_no_bom(
            &core_root.join("data/variants/ziggurat_Experimental.variant"),
            r#"{"variantId":"ziggurat_Experimental","hullId":"ziggurat"}"#,
        )
        .unwrap();
        write_utf8_no_bom(
            &core_root.join("data/variants/ziggurat_HF.variant"),
            r#"{"variantId":"ziggurat_Experimental","hullId":"ziggurat"}"#,
        )
        .unwrap();

        let (variants, warnings) = load_variant_files(&core_root).unwrap();

        let _ = std::fs::remove_dir_all(root);
        assert_eq!(variants.len(), 3);
        assert_eq!(warnings.len(), 3);
        assert!(variants
            .iter()
            .any(|variant| variant.variant_id == "kite_hegemony_Interceptor"));
        assert!(variants
            .iter()
            .any(|variant| variant.variant_id == "kite_original_Stock"));
        assert!(variants
            .iter()
            .any(|variant| variant.variant_id == "ziggurat_Experimental"));
        assert!(warnings
            .iter()
            .any(|warning| warning.message.contains("kite_hegemony_Interceptor")));
    }

    #[test]
    fn duplicate_variant_ids_do_not_fail_mod_loading() {
        let root = temp_dir("mod_kite_duplicate");
        std::fs::create_dir_all(root.join("data/variants/kite")).unwrap();
        write_utf8_no_bom(
            &root.join("data/variants/kite/kite_Interceptor.variant"),
            r#"{"variantId":"kite_hegemony_Interceptor","hullId":"kite_hegemony"}"#,
        )
        .unwrap();
        write_utf8_no_bom(
            &root.join("data/variants/kite_hegemony_Interceptor.variant"),
            r#"{"variantId":"kite_hegemony_Interceptor","hullId":"kite_hegemony"}"#,
        )
        .unwrap();

        let (variants, warnings) = load_variant_files(&root).unwrap();

        let _ = std::fs::remove_dir_all(root);
        assert_eq!(variants.len(), 1);
        assert_eq!(warnings.len(), 1);
        assert!(warnings[0]
            .message
            .contains("重复 variantId kite_hegemony_Interceptor"));
    }

    fn temp_dir(name: &str) -> std::path::PathBuf {
        let stamp = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap()
            .as_nanos();
        let path = std::env::temp_dir().join(format!("{stamp}_{name}"));
        std::fs::create_dir_all(&path).unwrap();
        path
    }
}
