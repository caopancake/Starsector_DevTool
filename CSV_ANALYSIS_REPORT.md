
TAURI 2 + VUE 3 + RUST PROJECT: CSV PARSING ANALYSIS
=====================================================

EXECUTIVE SUMMARY
=================
Critical inconsistency found: Comments are EXPLICITLY preserved in SAVE operations 
but IMPLICITLY handled in DELETE operations, and comments are NEVER exposed to the 
frontend data model.

FILE 1: src-tauri/src/parsers/csv.rs (182 lines)
================================================

Function: read_csv_data (Lines 5-45)
- Line 25: First record becomes header
- Line 28: SKIP COMMENTS - if record[0].starts_with('#') { continue; }
- Result: Comments DISCARDED, never returned to frontend

Function: save_csv_file (Lines 47-78)
- Line 52-62: COMMENT PRESERVATION
  * Reads existing file
  * Extracts lines starting with '#'
  * Stores in Vec<StringRecord>
- Line 66-68: Writes comments back to file
- Result: Comments EXPLICITLY preserved

Function: delete_csv_id (Lines 102-125)
- Line 112-114: Find id column (FAILS if not found with error "no id column")
- Line 117-122: Write all non-matching rows
  * Comments written back implicitly
  * No special handling
  * Position NOT guaranteed
- Result: Comments written back implicitly, NO test coverage

ISSUE SUMMARY FOR FILE 1:
- Comments explicitly preserved in save
- Comments implicitly preserved in delete
- No explicit handling in delete
- Test coverage: YES for save, NO for delete

FILE 2: src-tauri/src/services/tables.rs (30 lines)
================================================

save_csv (Line 8): Calls save_csv_file (preserves comments)
delete_csv_row (Line 24): Calls delete_csv_id (implicitly handles comments)

FILE 3: src-tauri/src/models/project.rs (55 lines)
=================================================

CsvTable struct (Line 14-18):
  pub header: Vec<String>,
  pub rows: Vec<Map<String, Value>>,
  pub path: String,
  // NO comments field - comments not in model!

FILE 4: src-tauri/src/models/payloads.rs (77 lines)
=================================================

SaveCsvPayload (Line 6-11):
  pub header: Vec<String>,
  pub rows: Vec<Map<String, Value>>,
  // NO comments field - not passed to backend!

FILE 5: src-tauri/src/filesystem/text.rs (59 lines)
=================================================

read_utf8_no_bom: Validates no UTF-8 BOM
write_utf8_no_bom: Writes clean UTF-8

FILE 6: src-tauri/src/commands/mod.rs (57 lines)
================================================

Tauri commands:
- Line 17: save_csv(payload)
- Line 22: add_csv_row(payload)
- Line 27: delete_csv_row(payload)

CRITICAL FINDINGS
=================

FINDING 1: INCONSISTENT COMMENT HANDLING
=========================================

SAVE PATH (parsers/csv.rs Lines 47-78):
  for record in rdr.records().skip(1) {
    if record.get(0).is_some_and(|v| v.starts_with('#')) {
      comments.push(record);  <-- EXTRACTED
    }
  }
  for comment in comments {
    wtr.write_record(&comment)?;  <-- WRITTEN BACK
  }

DELETE PATH (parsers/csv.rs Lines 102-125):
  for record in records.iter().skip(1) {
    if record.get(id_idx) == Some(id) {
      continue;  <-- SKIP DELETED ROW
    }
    wtr.write_record(record)?;  <-- WRITE ALL OTHERS (including comments)
  }

INCONSISTENCY: Save explicitly preserves comments, delete implicitly does.
RISK: Comment position and structure not guaranteed in delete.
TEST COVERAGE: YES for save (line 146), NO for delete.

FINDING 2: COMMENTS NOT EXPOSED TO FRONTEND
============================================

CsvTable (Line 14): NO comments field
SaveCsvPayload (Line 6): NO comments field

Result:
- Frontend cannot see comments
- Frontend cannot edit comments
- Comments loaded during save but not returned to frontend
- Comments are second-class data

FINDING 3: ROW ID VALIDATION GAP
================================

delete_csv_id (Line 112-114):
  let Some(id_idx) = header.iter().position(|h| h == "id") else {
    return Err(...);
  };

RISK: Requires "id" column, no fallback, no validation on load

FINDING 4: EMPTY FIELDS - CONSISTENT
====================================

Read: record.get(idx).unwrap_or("") -> empty string
Write: Value::Null -> String::new() -> empty string
NO inconsistency

FINDING 5: HEADERS - CONSISTENT
===============================

Read: First record (Line 25)
Save: Written first (Line 65)
Delete: Written first (Line 116)
NO inconsistency

Q1: Is there a unified CSV round-trip model?
=============================================

NO. There is NOT a unified model.

Evidence:
- Comments handled separately in save vs delete
- Comments not included in CsvTable model
- Comments not exposed to frontend
- No common data structure for headers + comments + rows

Q2: Are there inconsistencies between save and delete?
======================================================

YES. CRITICAL INCONSISTENCIES:

| Aspect           | Save                | | Delete              |
| Comments         | Explicit (Line 59)  | | Implicit (Line 121) |
| Position         | Guaranteed          | | Not guaranteed      |
| Header           | Line 65 (OK)        | | Line 116 (OK)       |
| Empty Fields     | Consistent (OK)     | | Consistent (OK)     |
| Test Coverage    | YES (Line 146)      | | NO (gap)            |

Q3: How are row IDs tracked?
============================

NO UNIFIED ID MODEL:
- IDs assumed in "id" column
- No auto-generation
- No validation
- No unique constraint
- Frontend manages IDs externally

EXACT FUNCTION SIGNATURES
=========================

parsers/csv.rs
- Line 5: pub fn read_csv_data(path: &Path) -> AppResult<CsvTable>
- Line 47: pub fn save_csv_file(path: &Path, header: &[String], rows: &[Map<String, Value>]) -> AppResult<()>
- Line 80: pub fn append_csv_row(path: &Path, row: &Map<String, Value>) -> AppResult<()>
- Line 102: pub fn delete_csv_id(path: &Path, id: &str) -> AppResult<()>
- Line 127: pub fn value_to_cell(value: &Value) -> String

services/tables.rs
- Line 8: pub fn save_csv(payload: SaveCsvPayload) -> AppResult<String>
- Line 16: pub fn add_csv_row(payload: SaveCsvPayload) -> AppResult<()>
- Line 24: pub fn delete_csv_row(mod_root: &str, table: &str, id: &str) -> AppResult<()>

models/project.rs
- Line 14: pub struct CsvTable { header, rows, path }
- Line 50: pub fn csv_path_for(table: &str) -> Option<&'static str>

models/payloads.rs
- Line 6: pub struct SaveCsvPayload { mod_root, table, header, rows }
- Line 23: pub struct DeletePayload { mod_root, table, id }

RECOMMENDATIONS
===============

1. Unify comment handling with shared function
2. Add comments field to CsvTable and SaveCsvPayload
3. Expose comments to frontend
4. Add test_delete_preserves_comments()
5. Add ID column validation on load


