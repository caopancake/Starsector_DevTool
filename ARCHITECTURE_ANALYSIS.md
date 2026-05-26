# Starsector DevTool - Complete Architecture Analysis

## Executive Summary

The Starsector DevTool is a Vue 3 + Tauri application for editing Starsector mod files. Key finding: **starsector-core is NOT a mod** - it's a special-cased fallback resource provider that cannot be opened as a ProjectSession.

---

## 1. How starsectorRoot is Configured in Settings

### Storage Location
- **TypeScript Store**: `src/stores/settings.store.ts` line 93
- **Type**: `AppSettings.starsectorRoot` (string | null)
- **Backend**: Persisted via Tauri's app config system

### Lifecycle
1. **App Startup**: Load `app_settings.json` → init Pinia store
2. **User Action**: `setStarsectorRoot(path)` updates ref
3. **App Shutdown**: Settings persisted to disk
4. **App Restart**: Previous value restored

---

## 2. What Happens When Game Directory is Scanned

**Function**: `src-tauri/src/services/project/root.rs:scan_game_overview()`

### Process Flow
1. Opens `{root}/mods/` directory
2. For each entry:
   - Skip if not a directory
   - Check for `mod_info.json`
   - Parse and create `GameModSummary`
3. Check if `starsector-core` exists
4. Sort mods by name, check for duplicates
5. Return `GameOverviewData` with all mods and warnings

### What's Included
- All directories with valid `mod_info.json`
- Flag: `core_available` (boolean)
- Warnings about missing core and invalid mods

### What's NOT Included
- `starsector-core` itself (not in the mod list)
- Directories without `mod_info.json`

---

## 3. How starsector-core is Treated

### Core is NOT a Mod

**Answer: NO - cannot be opened as ProjectSession**

### Why
1. Missing `mod_info.json` → `is_mod_root()` returns false
2. Role: Fallback resource provider (internal use only)
3. Game overview explicitly doesn't include it
4. Special core cache system handles access

### How Core Resources Are Accessed
- Backend has `load_core_*` functions in `cache/core.rs`
- Used when editing mod and resource not found
- Uses `starsector_root` from ProjectManifest to locate core
- Returns empty if core doesn't exist

### Core Availability
- `ProjectManifest.core_available` (boolean)
- `GameOverviewData.core_available` (boolean)
- Both indicate if `starsector-core/` exists

---

## 4. Complete Mod Loading Pipeline

### Phase 1: User Selects Game Directory
```
detect_directory(path)
  → is_game_root? → YES (has starsector-core/ and mods/)
  → scan_game_overview(path)
  → Returns OpenDirectoryResult with overview
  → Frontend: workspace.setGameOverview(overview)
  → Frontend: settings.setStarsectorRoot(path)
  → UI shows available mods
```

### Phase 2: User Loads a Mod
```
loadWorkspaceMod(modRoot, starsectorRoot)
  1. Create loading entry
  2. Call openProjectSession(modRoot, starsectorRoot)
     → Backend: build_project_session()
     → Returns ProjectManifest with session_id
  3. Update entry with real name/version
  4. Hydrate frontend stores (tables, editors)
  5. Mod now in workspace.loadedModList
```

### Phase 3: Backend ProjectSession Build
```
build_project_session(modRoot, starsectorRoot_override)
  1. session_id = new timestamp-based ID
  2. Read mod_info.json (synthetic if missing)
  3. Discover factions, missions
  4. Load CSV table metadata
  5. Load spec files (ships, weapons, variants, skins)
  6. Build entity_summaries (counts)
  7. Create ProjectManifest
  8. Store ProjectSession in backend cache
  9. Return ProjectManifest to frontend
```

### Requirements for ProjectSession
- Path must be readable
- `mod_info.json` optional (synthetic created if missing)
- All data files optional (can be empty)

---

## 5. Settings Flow Diagram

```
┌─────────────────────────────────────────────────────────┐
│                    APP STARTUP                          │
└─────────────────┬───────────────────────────────────────┘
                  │
                  ↓
          Load AppSettings
          (app_settings.json)
                  │
                  ↓
         Initialize Pinia Store
     settings.starsectorRoot = "C:/Games/Starsector"
                  │
                  ↓
    Load PersistedWorkspace
                  │
                  ↓
    Restore mods from previous session
                  │
                  ├─ IF starsectorRoot set:
                  │   └─ restore gameOverview?
                  └─ Restore loaded mods
                  │
                  ↓
         Show workspace UI
                  │
                  ├─ If gameOverview: show mod list
                  └─ If loaded mods: show editors
```

---

## 6. Directory Detection Types

### GameRoot
- Must have: `starsector-core/` AND `mods/`
- Example: `C:/Games/Starsector`
- Result: Full overview with all mods

### ModInGame
- Must have: `mod_info.json`
- AND: Game root found via `parent/parent` check
- Example: `C:/Games/Starsector/mods/mymod`
- Result: Single mod + game overview

### ExternalMod
- Must have: `mod_info.json`
- NO: Game root inferred
- Example: `D:/MyMods/mymods`
- Result: Single mod, no overview

### Unknown
- Doesn't match any above
- Result: Error message

---

## 7. Core Fallback During Editing

### When Querying Entity
```
Query: "Get ship hull 'hull_id'"
  1. Look in ProjectSession (mod's data)
  2. If found: return
  3. If not found AND core_available:
     a. Load core ship files
     b. Look in core
     c. If found: return
     d. If not found: error
  4. Merge results (mod overrides core)
```

### Functions Used
- `load_core_csv_table()`
- `load_core_ship_files()`
- `load_core_weapon_specs()`
- `load_core_variant_files()`
- `load_core_skin_files()`

---

## 8. State Persistence

### What's Saved (PersistedWorkspace)
- Loaded mod list (modRoot, displayName, version)
- Active mod
- Current view/config view
- Expanded mods
- starsectorRoot
- Game overview mods and warnings

### When Saved
- App shutdown
- On demand (workspace save)

### When Restored
- App startup
- Each mod's ProjectSession reopened
- UI state restored

---

## 9. Key File Locations

### Frontend
- Settings Store: `src/stores/settings.store.ts`
- Workspace Store: `src/stores/workspace.store.ts`
- Open Directory: `src/orchestrators/open-directory.orchestrator.ts`
- Shell Actions: `src/app/composables/use-workspace-shell-actions.ts`

### Backend
- Root Detection: `src-tauri/src/services/project/root.rs`
- Session Building: `src-tauri/src/services/project/session.rs`
- Core Cache: `src-tauri/src/services/project/cache/core.rs`
- Commands: `src-tauri/src/commands/project.rs`

### Types
- Query Types: `src/shared/types/query.types.ts`
- Settings Types: `src/shared/types/settings.types.ts`
- Workspace Types: `src/shared/types/workspace.types.ts`


---

## DIRECT ANSWERS TO YOUR QUESTIONS

**Q1: How is starsectorRoot configured in settings?**
Settings stored in Pinia store, line 93 of settings.store.ts. Can be null or string path. Persisted via Tauri's app config system on shutdown, restored on startup.

**Q2: What happens when game directory scanned?**
Scans mods/ subdirectory, reads mod_info.json from each, builds GameOverviewData with list of valid mods and warnings. Does NOT include starsector-core in mod list.

**Q3: Does starsector-core have mod_info.json? Can it be ProjectSession?**
NO on both. Has no mod_info.json, so is_mod_root() returns false. Role is internal fallback provider, not an editable mod.

**Q4: How are Mods loaded into workspace?**
User selects game root → scan_game_overview detects → shows mod list → user clicks mod → openProjectSession creates backend session → frontend hydrates stores → mod appears in workspace.

**Q5: Flow from configured directory to mod in workspace?**
See complete flow diagram below.

---

## COMPLETE FLOW DIAGRAM

User selects C:\Games\Starsector
  → Backend: detect_directory() → is_game_root? YES
  → Backend: scan_game_overview() → finds .../mods/mod1, mods/mod2
  → Returns GameOverviewData with mod list
  → Frontend: workspace.setGameOverview(overview)
  → Frontend: settings.setStarsectorRoot(path)
  → UI shows game overview with mod list

User clicks "Import" on mod1
  → Frontend: loadWorkspaceMod(.../mods/mod1, starsectorRoot)
  → Backend: build_project_session(.../mods/mod1, starsectorRoot)
  → Returns ProjectManifest with session_id
  → Frontend: tables.hydrate(), editors.activateFor()
  → Mod1 now in workspace.loadedModList
  → UI shows mod editors

