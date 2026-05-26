# WriteResult Audit Report: Invalidated Paths Analysis

**Date:** 2026-05-26
**Issue:** Ensuring all `WriteResult` constructions properly report ALL written file paths in `invalidated_paths`

## Summary

This audit examined all `WriteResult` constructions in the codebase to identify any instances where files are written but not properly included in the `invalidated_paths` array. This is critical because `invalidated_paths` is used to refresh the backend session cache with new/modified spec files.

**Fixed Issue:** The original bug in `save_csv_patch()` has been fixed - it now properly includes associated files (.ship/.wpn files) in `invalidated_paths`.

**Result:** ✅ **NO CRITICAL ISSUES FOUND** - All other WriteResult constructions are properly reporting their written files.

---

## WriteResult Definition

**File:** `src-tauri/src/models/write.rs` (lines 124-130)

The WriteResult struct contains:

- `changes`: Vec<FileChangeRecord> - All file operations
- `invalidated_paths`: Vec<String> - File paths that need cache refresh
- `key_map`: Vec<CsvRowKeyMapping> - Row ID mappings
- `refreshed_entity`: Optional<T> - Updated entity data
- `warnings`: Vec<String> - Operation warnings

---

## All WriteResult Constructions Found

### 1. ✅ write_result() helper - src-tauri/src/services/file_changes.rs:51

Extracts path from each FileChangeRecord. Used by:

- save_text_file() - 1 file
- save_mod_files() - N files via builder
- apply_file_change_set() - N files

**Status:** CORRECT - All paths included

### 2. ✅ save_editor_spec() - src-tauri/src/services/editor_specs.rs:22

Writes 1 spec file (.ship/.wpn/.proj)

- Changes: 1
- Invalidated paths: 1

**Status:** CORRECT

### 3. ✅ save_csv_patch() - src-tauri/src/services/project/write/csv_patch.rs:58

Writes CSV + associated files

- Lines 56-57: Builds invalidated_paths from CSV + associated files
- Extends with associated_rel_paths (line 57)

**Status:** FIXED - Now includes both CSV and associated files

### 4. ✅ save_variant_entity() - src-tauri/src/services/config/variants.rs:44

Extracts paths from all changes:

- Writes 1-2 files depending on rename
- invalidated_paths includes all

**Status:** CORRECT

### 5. ✅ delete_variant_entity() - src-tauri/src/services/config/variants.rs:70

Extracts paths from all changes:

- Writes 1 file (deletion)
- invalidated_paths includes 1 path

**Status:** CORRECT

### 6. ✅ save_skin_entity() - src-tauri/src/services/config/skins.rs:44

Same pattern as variants.rs

- Writes 1-2 files
- All paths included

**Status:** CORRECT

### 7. ✅ delete_skin_entity() - src-tauri/src/services/config/skins.rs:70

Same pattern as delete_variant_entity()

- Writes 1 file
- All paths included

**Status:** CORRECT

### 8. ✅ save_indexed_config_entity() - src-tauri/src/services/config/indexed_entities.rs:80

Complex multi-file operations:

- Updates index CSV
- Saves faction/mission files
- May copy/delete directories
- Lines 81: All changes mapped to invalidated_paths

**Status:** CORRECT - All files tracked

### 9. ✅ delete_indexed_config_entity() - src-tauri/src/services/config/indexed_entities.rs:129

Updates index CSV and optionally deletes target

- Line 130: All changes mapped
- 1-2 changes total

**Status:** CORRECT

### 10. ✅ upload_sprite() - src-tauri/src/services/config/assets.rs:28 & 45

Two cases:

- File exists + no overwrite: Returns empty WriteResult
- Normal: Writes 1 binary file

Lines 28-40: Empty case - CORRECT
Lines 45-46: Normal case - All changes included

**Status:** CORRECT

---

## Pattern Analysis

All production code follows the SAFE PATTERN:

```rust
let changes = builder.apply()?;
Ok(WriteResult {
    invalidated_paths: changes.iter().map(|change| change.path.clone()).collect(),
    changes,
    // ...
})
```

No hardcoded invalidated_paths lists found that could miss files.

---

## FileChangeSetBuilder Guarantee

The builder's apply() method returns ALL FileChangeRecords created, ensuring:

- No files are accidentally written without tracking
- Directory operations (copy_directory, delete_directory) are tracked
- Each FileChangeRecord has a complete path field

---

## Verification Results

| Location            | Files Written | Changes                | Status   |
| ------------------- | ------------- | ---------------------- | -------- |
| file_changes.rs     | Variable      | Extracted from changes | ✅       |
| editor_specs.rs     | 1 spec        | 1                      | ✅       |
| csv_patch.rs        | CSV + assoc   | 1+N                    | ✅ FIXED |
| variants.rs         | 1-2           | 1-2                    | ✅       |
| skins.rs            | 1-2           | 1-2                    | ✅       |
| indexed_entities.rs | 2-5           | 2-5                    | ✅       |
| assets.rs           | 0-1           | 0-1                    | ✅       |

---

## Conclusion

✅ **AUDIT COMPLETE - NO ISSUES FOUND**

All WriteResult constructions properly include ALL written file paths in invalidated_paths. The codebase is safe and the csv_patch fix is comprehensive. No other similar bugs exist.
