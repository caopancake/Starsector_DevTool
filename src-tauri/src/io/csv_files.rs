use crate::{errors::AppResult, models::CsvTable, parsers::parse_csv_text};
use std::path::Path;

use super::read_utf8_no_bom;

pub fn read_csv_data(path: &Path) -> AppResult<CsvTable> {
    if !path.exists() {
        return Ok(CsvTable {
            header: vec![],
            rows: vec![],
            path: path.to_string_lossy().to_string(),
        });
    }
    let text = read_utf8_no_bom(path)?;
    parse_csv_text(&path.to_string_lossy(), &text)
}
