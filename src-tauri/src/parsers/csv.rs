use crate::{
    errors::{AppError, AppResult},
    filesystem::read_utf8_no_bom,
    models::CsvTable,
};
use serde_json::{Map, Value};
use std::path::Path;

pub fn read_csv_data(path: &Path) -> AppResult<CsvTable> {
    if !path.exists() {
        return Ok(CsvTable {
            header: vec![],
            rows: vec![],
            path: path.to_string_lossy().to_string(),
        });
    }
    let text = read_utf8_no_bom(path)?;
    let normalized = normalize_visible_empty_rows(&text);
    let mut rdr = csv::ReaderBuilder::new()
        .has_headers(false)
        .from_reader(normalized.as_bytes());
    let records: Vec<csv::StringRecord> =
        rdr.records().collect::<Result<_, _>>().map_err(|error| {
            AppError::context(format!("解析 CSV 失败 ({})", path.display()), error.into())
        })?;
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

pub fn render_csv_text(header: &[String], rows: &[Map<String, Value>]) -> AppResult<String> {
    let mut bytes = Vec::new();
    let mut wtr = csv::Writer::from_writer(&mut bytes);
    wtr.write_record(header)?;
    for row in rows {
        let values: Vec<String> = header
            .iter()
            .map(|h| value_to_cell(row.get(h).unwrap_or(&Value::Null)))
            .collect();
        wtr.write_record(values)?;
    }
    wtr.flush()?;
    drop(wtr);
    String::from_utf8(bytes).map_err(|error| AppError::message(format!("CSV 编码失败: {error}")))
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

fn normalize_visible_empty_rows(text: &str) -> String {
    let lines: Vec<&str> = text.lines().collect();
    let Some((header_index, header)) = lines
        .iter()
        .enumerate()
        .find(|(_, line)| !is_visible_empty_line(line))
    else {
        return text.to_string();
    };
    let header_width = record_width(header).unwrap_or(0);
    if header_width == 0 {
        return text.to_string();
    }
    let empty_record = ",".repeat(header_width.saturating_sub(1));
    let mut normalized = Vec::with_capacity(lines.len());
    for (index, line) in lines.iter().enumerate() {
        if index > header_index && is_visible_empty_line(line) {
            normalized.push(empty_record.clone());
        } else {
            normalized.push((*line).to_string());
        }
    }
    normalized.join("\r\n")
}

fn is_visible_empty_line(line: &str) -> bool {
    let trimmed = line.trim();
    trimmed.is_empty() || trimmed.starts_with('#') || trimmed.chars().all(|ch| ch == ',')
}

fn record_width(line: &str) -> Option<usize> {
    let mut rdr = csv::ReaderBuilder::new()
        .has_headers(false)
        .flexible(true)
        .from_reader(line.as_bytes());
    rdr.records()
        .next()
        .and_then(Result::ok)
        .map(|record| record.len())
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::filesystem::write_utf8_no_bom;
    use std::{
        fs,
        path::PathBuf,
        time::{SystemTime, UNIX_EPOCH},
    };

    #[test]
    fn save_preserves_visible_empty_rows_from_rows() {
        let header = vec!["id".to_string(), "name".to_string()];
        let mut empty = Map::new();
        empty.insert("id".to_string(), Value::String(String::new()));
        empty.insert("name".to_string(), Value::String(String::new()));
        let mut row = Map::new();
        row.insert("id".to_string(), Value::String("b".to_string()));
        row.insert("name".to_string(), Value::String("B".to_string()));
        let out = render_csv_text(&header, &[empty, row]).unwrap();
        assert!(out.lines().any(|line| line == ","));
        assert!(out.contains("b,B"));
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

    #[test]
    fn read_reports_path_for_mismatched_record_width() {
        let path = temp_path("csv_bad_width.csv");
        write_utf8_no_bom(&path, "id,name\r\na,A\r\nbroken\r\n").unwrap();

        let error = read_csv_data(&path).unwrap_err().to_string();

        let _ = fs::remove_file(&path);
        assert!(error.contains("解析 CSV 失败"));
        assert!(error.contains("csv_bad_width.csv"));
        assert!(error.contains("found record with 1 fields"));
    }

    #[test]
    fn read_keeps_visible_empty_rows() {
        let path = temp_path("csv_keeps_visible_empty_rows.csv");
        write_utf8_no_bom(
            &path,
            "id,name,notes\r\na,A,alpha\r\n#section\r\n\r\n,,\r\nb,B,beta\r\n",
        )
        .unwrap();

        let table = read_csv_data(&path).unwrap();

        let _ = fs::remove_file(&path);
        assert_eq!(table.rows.len(), 5);
        assert_eq!(table.rows[0]["id"], "a");
        assert_eq!(table.rows[1]["id"], "");
        assert_eq!(table.rows[2]["id"], "");
        assert_eq!(table.rows[3]["id"], "");
        assert_eq!(table.rows[4]["id"], "b");
    }

    #[test]
    fn render_csv_text_writes_header_and_rows() {
        let header = vec!["id".to_string(), "name".to_string()];
        let mut row = Map::new();
        row.insert("id".to_string(), Value::String("x".to_string()));
        row.insert("name".to_string(), Value::String("X".to_string()));
        let out = render_csv_text(&header, &[row]).unwrap();
        assert!(out.lines().next().is_some_and(|line| line == "id,name"));
        assert!(out.contains("x,X"));
    }

    fn temp_path(name: &str) -> PathBuf {
        let stamp = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap()
            .as_nanos();
        std::env::temp_dir().join(format!("{stamp}_{name}"))
    }
}
