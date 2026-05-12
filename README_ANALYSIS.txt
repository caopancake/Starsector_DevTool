CSV PARSING ANALYSIS - COMPLETE DOCUMENTATION
====================================================

START HERE: Read this file first

PROJECT: Tauri 2 + Vue 3 + Rust at J:\Starsector\Tool
DATE: 2026-05-12
ANALYSIS: Complete line-by-line code review

DOCUMENTS SUMMARY
=================

1. FINAL_SUMMARY.txt (183 lines) - RECOMMENDED START
   Concise overview of all findings (5 min read)
   
2. ANALYSIS_EXECUTIVE_SUMMARY.txt (164 lines)
   For decision makers and quick reference (5 min read)
   
3. CSV_ANALYSIS_REPORT.md (208 lines)
   Complete technical analysis (20 min read)
   
4. SUPPLEMENTARY_ANALYSIS.txt (188 lines)
   Deep technical dives (15 min read)
   
5. ANALYSIS_INDEX.md
   Navigation guide and cross-references

CRITICAL FINDINGS
=================

FINDING 1: INCONSISTENT COMMENT PRESERVATION [HIGH]
- Save: Explicit extraction + preservation (Lines 52-68)
- Delete: Implicit preservation, no special handling (Line 121)
- TEST GAP: No test for delete with comments
- Risk: Comments may be repositioned

FINDING 2: COMMENTS NOT EXPOSED TO FRONTEND [HIGH]
- CsvTable: NO comments field
- SaveCsvPayload: NO comments field
- read_csv_data: Comments SKIPPED
- Risk: Frontend cannot see comments

FINDING 3: ROW ID VALIDATION MISSING [MEDIUM]
- delete_csv_id REQUIRES id column or fails
- read_csv_data does NOT validate
- Risk: No early warning

FINDING 4: NO UNIFIED ROW ID MODEL [MEDIUM]
- No row_id tracking
- No validation or unique constraint
- Risk: ID collisions possible

FINDINGS 5-6: PASS
- Empty fields: CONSISTENT
- Headers: CONSISTENT

QUICK ANSWERS
=============

Q: Unified CSV round-trip model?
A: NO. Inconsistent comment handling, not exposed to frontend.

Q: Inconsistencies between save and delete?
A: YES. Critical inconsistencies in comment preservation.

Q: Row ID tracking?
A: NO UNIFIED SYSTEM. Assumed in id column.

RECOMMENDATIONS (PRIORITY)
==========================

P0 - CRITICAL:
1. Add test_delete_preserves_comments()
2. Unify comment handling in both functions
3. Use shared preservation function

P1 - HIGH:
4. Add comments field to models
5. Add id column validation

P2 - MEDIUM:
6. Add row_id tracking
7. Expand test coverage

KEY CODE LOCATIONS
==================

parsers/csv.rs:
- read_csv_data: Line 5
- save_csv_file: Line 47 (comments: 52-68)
- delete_csv_id: Line 102 (implicit: 121)

models/:
- CsvTable: Lines 14-18
- SaveCsvPayload: Lines 6-11

NEXT STEPS
==========

1. Read FINAL_SUMMARY.txt (5 min overview)
2. Read CSV_ANALYSIS_REPORT.md if needs detail (20 min)
3. Implement P0 recommendations first
4. Test and verify using exact line numbers

All findings backed by exact code references.
