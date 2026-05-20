use crate::{errors::AppResult, models::CsvTable};
use std::path::Path;

use super::read_text_bytes_no_bom;

pub fn read_csv_data(path: &Path) -> AppResult<CsvTable> {
    if !path.exists() {
        return Ok(CsvTable {
            header: vec![],
            rows: vec![],
            path: path.to_string_lossy().to_string(),
        });
    }
    let bytes = read_text_bytes_no_bom(path)?;
    crate::parsers::parse_csv_bytes(&path.to_string_lossy(), &bytes)
}
