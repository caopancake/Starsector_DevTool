# Critical Fixes Implementation Report

**Date**: May 16, 2026  
**Status**: Phase 1 - CRITICAL FIXES COMPLETED

## Summary

Implemented fixes for 5 CRITICAL data corruption issues that had the potential to cause data loss in multi-mod scenarios. All critical bugs have been addressed and committed.

---

## Fixed Issues

### 1. ✅ Issue 1.2 CRITICAL: Editors Load From Wrong Mod
**Status**: FIXED in Commit `7dd95dd`

**Problem**: EditorsHost.vue used `project.data.modRoot` for all open editors. When user switched mods while editor was open, the editor would load data from the new active mod instead of the original mod where editing started.

**Solution**:
- Created `EditorRef` interface to track `{ modRoot: string; id: string }`
- Updated `ModEditorState` to store `shipEditorId: EditorRef | null` instead of `string`
- Updated `editors.store.ts` to capture `modRoot` in `openShip/openWeapon/openProjectile`
- Modified `EditorsHost.vue` to get data from editor's tracked modRoot, not active mod
- Updated `project.store.ts` update methods to accept optional modRoot parameter
- Added safety check in `weaponForEditor()` to verify mod match

**Files Changed**:
- `src/shared/types/workspace.ts`
- `src/features/editors/editors.store.ts`
- `src/app/EditorsHost.vue`
- `src/features/project/project.store.ts`

---

### 2. ✅ Issue 4.1 CRITICAL: CSV Save Goes To Wrong Mod If Switched During Async
**Status**: FIXED in Commit `ae2ca43`

**Problem**: `saveChanges()` in tables.store.ts read `activeRoot.value` throughout the function. If user switched mods while `saveTableRows()` was in flight, the Tauri callback would save the new mod's data to the original mod's CSV files.

**Scenario**:
1. User editing Mod A, clicks save
2. `saveTableRows` for ships table initiates async call
3. User clicks Mod B sidebar while Tauri call in-flight
4. `activeRoot` changes to Mod B
5. Tauri call for weapons table uses NEW state (Mod B)
6. Result: Mod B's weapons saved to Mod A's file!

**Solution**:
- Capture `modRoot` at function start: `const capturedModRoot = activeRoot.value`
- Use captured `modRoot` for all Tauri calls, not `activeRoot.value`
- Add safety check: `if (appData.modRoot !== capturedModRoot) return 'noop'`
- Prevents wrong data being saved even if activeRoot changes mid-save

**Files Changed**:
- `src/features/tables/tables.store.ts` (saveChanges function)

---

### 3. ✅ Issue 4.4 HIGH: Selected Row Invalid When Mod Switched
**Status**: FIXED in Commit `ae2ca43`

**Problem**: When switching mods, the previous mod's table selection persisted (`selectedRowKey`). If user selected a ship, switched to weapons tab, then clicked delete, the code would try to delete a weapon with the ship's ID.

**Solution**:
- Clear `selectedRowKey` and `searchText` in `activateFor()` when switching mods
- These fields are now reset whenever a new mod becomes active
- Prevents cross-mod operations using stale selection state

**Files Changed**:
- `src/features/tables/tables.store.ts` (activateFor function)

---

### 4. ✅ Issue 5.1 CRITICAL: addNewRow Fails Silently
**Status**: FIXED in Commit `ae2ca43`

**Problem**: If `getActiveState()` returned undefined (state not hydrated yet), `addNewRow()` would return silently with no error message. User clicks "add row" button and nothing happens.

**Solution**:
- Add explicit validation: `if (!state) { console.error(...); return; }`
- Provides clear error message if state not ready
- Prevents silent failures

**Files Changed**:
- `src/features/tables/tables.store.ts` (addNewRow function)

---

### 5. ✅ Issue 5.2 CRITICAL: deleteSelected Uses Wrong Tab
**Status**: FIXED in Commit `ae2ca43`

**Problem**: `deleteSelected()` used `selectedRowId` directly without verifying the row exists in the current table. Combined with Issue 4.4, this could delete wrong records.

**Scenario**:
1. Select ship in ships table
2. Click weapons tab (selection not cleared)
3. Click delete
4. Searches weapons table for ship's ID → finds nothing or wrong record → deletes wrong thing

**Solution**:
- Before deleting, verify: `const row = state.tables[tab].find(r => rowId(r) === id)`
- If row not found, clear selection and return with warning
- Ensures only records in current table can be deleted

**Files Changed**:
- `src/features/tables/tables.store.ts` (deleteSelected function)

---

### 6. ✅ Issue 2.1 CRITICAL: Global nextRowKey With Per-Mod Hydration
**Status**: FIXED in Commit `cab47ad`

**Problem**: Module-level `let nextRowKey = 0` was global and incremented across all mods. Loading Mod A (100 ships) then Mod B (50 ships) would result in Mod B's row keys starting at 150+, causing potential collisions on reload.

**Scenario**:
- Load Mod A (100 ships): nextRowKey = 100
- Load Mod B (50 ships): nextRowKey = 150
- Add new ship to Mod A: nextRowKey = 151
- Reload app: Row keys from different sessions could collide

**Solution**:
- Add `nextRowKey: number` to `ModTableState` interface
- Initialize to 0 in `createModTableState()`
- Update `assignRowKey()` to use `state.nextRowKey++` instead of global
- Each mod now has independent counter

**Files Changed**:
- `src/shared/types/workspace.ts`
- `src/features/tables/tables.store.ts`

---

## Data Corruption Scenarios Now Prevented

### Before Fixes
1. **Editor Switch Corruption**: Open editor in Mod A, switch to Mod B → editor loads/saves Mod B data ❌
2. **Save Race Corruption**: Save Mod A while switching to Mod B → Mod B data overwrites Mod A files ❌
3. **Delete Wrong Record**: Select ship, switch tab, delete → deletes wrong weapon ❌
4. **Silent Add Failures**: Add row button does nothing, user doesn't know ❌
5. **Row Key Collisions**: Reload app with multiple mods → row keys collide ❌

### After Fixes
1. **Editor Switch**: Editor remembers which mod it belongs to, always loads/saves correct mod ✅
2. **Save Race**: ModRoot captured at start, save always uses correct mod ✅
3. **Delete Safety**: Row existence verified before deletion ✅
4. **Add Validation**: Clear error if state not ready ✅
5. **Row Key Isolation**: Each mod has independent counter ✅

---

## Testing Checklist

- [ ] Open Mod A, open ship editor, switch to Mod B, verify ship data is from Mod A
- [ ] Open Mod A, save changes, quickly switch to Mod B, verify Mod A files received correct data
- [ ] Select row in ships table, switch to weapons tab, verify selection cleared
- [ ] Click "add row" button when table not ready, verify error message appears
- [ ] Select row in ships table, switch to weapons tab, click delete, verify nothing happens and warning appears
- [ ] Load multiple mods, add new rows to each, verify no row ID collisions
- [ ] Reload app after multi-mod editing, verify row keys remain consistent

---

## Commits Made

1. `7dd95dd` - Step 1: Fix editor state tracking to track modRoot in editor IDs
2. `ae2ca43` - Step 2: Fix critical CSV save and row operation race conditions  
3. `cab47ad` - Step 3: Fix nextRowKey global state - move to per-mod tracking

---

## Remaining High-Priority Issues (Phase 2)

- [ ] Issue 1.1: Removal Sync Not Bidirectional
- [ ] Issue 1.3: Table Store State Validation Gaps
- [ ] Issue 2.2: activeRoot Uses Empty String Instead of null (consistency)
- [ ] Issue 2.3: project.data Name Is Deceptive
- [ ] Issue 3.1-3.3: Tech Debt (duplication and coupling)
- [ ] Issue 4.3: Cell Edit Fails Silently If Row Deleted
- [ ] Issue 5.3: Startup Restoration Depends On Exact Load Order

See `COMPATIBILITY_AUDIT.md` for full analysis of all issues.
