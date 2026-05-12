use crate::{errors::AppResult, filesystem::read_utf8_no_bom, models::CsvTable};
use serde_json::{Map, Value};
use std::{fs, io::Write, path::Path};

pub fn read_csv_data(path: &Path) -> AppResult<CsvTable> {
    if !path.exists() {
        return Ok(CsvTable {
            header: vec![],
            rows: vec![],
            path: path.to_string_lossy().to_string(),
        });
    }
    let text = read_utf8_no_bom(path)?;
    let mut rdr = csv::ReaderBuilder::new()
        .has_headers(false)
        .from_reader(text.as_bytes());
    let records: Vec<csv::StringRecord> = rdr.records().collect::<Result<_, _>>()?;
    if records.is_empty() {
        return Ok(CsvTable {
            header: vec![],
            rows: vec![],
            path: path.to_string_lossy().to_string(),
        });
    }
    let header: Vec<String> = records[0].iter().map(ToString::to_string).collect();
    let mut rows = Vec::new();
    for record in records.iter().skip(1) {
        if record.get(0).is_some_and(|v| v.starts_with('#')) {
            continue;
        }
        let mut row = Map::new();
        for (idx, h) in header.iter().enumerate() {
            row.insert(
                h.clone(),
                Value::String(record.get(idx).unwrap_or("").to_string()),
            );
        }
        rows.push(row);
    }
    Ok(CsvTable {
        header,
        rows,
        path: path.to_string_lossy().to_string(),
    })
}

pub fn save_csv_file(path: &Path, header: &[String], rows: &[Map<String, Value>]) -> AppResult<()> {
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent)?;
    }
    let mut comments = Vec::new();
    if path.exists() {
        let text = read_utf8_no_bom(path)?;
        let mut rdr = csv::ReaderBuilder::new()
            .has_headers(false)
            .from_reader(text.as_bytes());
        for record in rdr.records().skip(1) {
            let record = record?;
            if record.get(0).is_some_and(|v| v.starts_with('#')) {
                comments.push(record);
            }
        }
    }
    let mut wtr = csv::Writer::from_path(path)?;
    wtr.write_record(header)?;
    for comment in comments {
        wtr.write_record(&comment)?;
    }
    for row in rows {
        let values: Vec<String> = header
            .iter()
            .map(|h| value_to_cell(row.get(h).unwrap_or(&Value::Null)))
            .collect();
        wtr.write_record(values)?;
    }
    wtr.flush()?;
    Ok(())
}

pub fn append_csv_row(path: &Path, row: &Map<String, Value>) -> AppResult<()> {
    let table = read_csv_data(path)?;
    let mut file = fs::OpenOptions::new()
        .append(true)
        .create(true)
        .open(path)?;
    let mut wtr = csv::WriterBuilder::new()
        .has_headers(false)
        .from_writer(vec![]);
    let values: Vec<String> = table
        .header
        .iter()
        .map(|h| value_to_cell(row.get(h).unwrap_or(&Value::Null)))
        .collect();
    wtr.write_record(values)?;
    let bytes = wtr
        .into_inner()
        .map_err(|e| crate::errors::AppError::message(e.to_string()))?;
    file.write_all(&bytes)?;
    Ok(())
}

pub fn delete_csv_id(path: &Path, id: &str) -> AppResult<()> {
    let text = read_utf8_no_bom(path)?;
    let mut rdr = csv::ReaderBuilder::new()
        .has_headers(false)
        .from_reader(text.as_bytes());
    let records: Vec<csv::StringRecord> = rdr.records().collect::<Result<_, _>>()?;
    if records.is_empty() {
        return Ok(());
    }
    let header = records[0].clone();
    let Some(id_idx) = header.iter().position(|h| h == "id") else {
        return Err(crate::errors::AppError::message("no id column"));
    };
    let mut wtr = csv::Writer::from_path(path)?;
    wtr.write_record(&header)?;
    for record in records.iter().skip(1) {
        if record.get(id_idx) == Some(id) {
            continue;
        }
        wtr.write_record(record)?;
    }
    wtr.flush()?;
    Ok(())
}

pub fn value_to_cell(value: &Value) -> String {
    match value {
        Value::Null => String::new(),
        Value::String(s) => s.clone(),
        Value::Number(n) => n.to_string(),
        Value::Bool(b) => b.to_string(),
        other => serde_json::to_string(other).unwrap_or_default(),
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::filesystem::write_utf8_no_bom;
    use std::{
        path::PathBuf,
        time::{SystemTime, UNIX_EPOCH},
    };

    #[test]
    fn save_preserves_comments() {
        let path = temp_path("csv_save_preserves_comments.csv");
        write_utf8_no_bom(&path, "id,name\r\n#note,keep\r\na,A\r\n").unwrap();
        let header = vec!["id".to_string(), "name".to_string()];
        let mut row = Map::new();
        row.insert("id".to_string(), Value::String("b".to_string()));
        row.insert("name".to_string(), Value::String("B".to_string()));
        save_csv_file(&path, &header, &[row]).unwrap();
        let out = read_utf8_no_bom(&path).unwrap();
        assert!(out.contains("#note,keep"));
        assert!(out.contains("b,B"));
        let _ = fs::remove_file(path);
    }

    #[test]
    fn read_rejects_utf8_bom() {
        let path = temp_path("csv_rejects_utf8_bom.csv");
        fs::write(
            &path,
            [b"\xef\xbb\xbf".as_slice(), b"id,name\r\na,A\r\n".as_slice()].concat(),
        )
        .unwrap();
        let result = read_csv_data(&path);
        let _ = fs::remove_file(path);
        assert!(result.is_err());
    }

    fn temp_path(name: &str) -> PathBuf {
        let stamp = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap()
            .as_nanos();
        std::env::temp_dir().join(format!("{stamp}_{name}"))
    }
}
