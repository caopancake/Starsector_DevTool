use crate::{
    errors::{AppError, AppResult},
    models::CsvTable,
};
use serde_json::{Map, Value};

pub fn parse_csv_text(path_label: &str, text: &str) -> AppResult<CsvTable> {
    let normalized = normalize_visible_empty_rows(text);
    let mut rdr = csv::ReaderBuilder::new()
        .has_headers(false)
        .from_reader(normalized.as_bytes());
    let records: Vec<csv::StringRecord> =
        rdr.records().collect::<Result<_, _>>().map_err(|error| {
            AppError::context(format!("解析 CSV 失败 ({path_label})"), error.into())
        })?;
    if records.is_empty() {
        return Ok(CsvTable {
            header: vec![],
            rows: vec![],
            path: path_label.to_string(),
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
        path: path_label.to_string(),
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
        .find(|(_, line)| !is_blank_visible_empty_line(line))
    else {
        return text.to_string();
    };
    let header_width = record_width(header).unwrap_or(0);
    if header_width == 0 {
        return text.to_string();
    }
    let empty_record = ",".repeat(header_width.saturating_sub(1));
    let mut normalized = Vec::with_capacity(lines.len());
    let mut in_quoted_record = false;
    for (index, line) in lines.iter().enumerate() {
        if index > header_index && !in_quoted_record && is_blank_visible_empty_line(line) {
            normalized.push(empty_record.clone());
        } else if index > header_index && !in_quoted_record && is_hash_single_cell_row(line) {
            normalized.push(render_single_cell_row(line.trim(), header_width));
        } else {
            normalized.push((*line).to_string());
        }
        in_quoted_record = update_csv_quote_state(line, in_quoted_record);
    }
    normalized.join("\r\n")
}

fn is_blank_visible_empty_line(line: &str) -> bool {
    let trimmed = line.trim();
    trimmed.is_empty() || trimmed.chars().all(|ch| ch == ',')
}

fn is_hash_single_cell_row(line: &str) -> bool {
    let trimmed = line.trim();
    trimmed.starts_with('#') && !trimmed.contains(',')
}

fn render_single_cell_row(first_cell: &str, header_width: usize) -> String {
    let mut row = Vec::with_capacity(header_width);
    row.push(first_cell.to_string());
    row.resize(header_width, String::new());
    row.join(",")
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

fn update_csv_quote_state(line: &str, mut in_quotes: bool) -> bool {
    let mut chars = line.chars().peekable();
    while let Some(ch) = chars.next() {
        if ch != '"' {
            continue;
        }
        if in_quotes && chars.peek() == Some(&'"') {
            chars.next();
            continue;
        }
        in_quotes = !in_quotes;
    }
    in_quotes
}

#[cfg(test)]
mod tests {
    use super::*;

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
    fn read_reports_path_for_mismatched_record_width() {
        let error = parse_csv_text("csv_bad_width.csv", "id,name\r\na,A\r\nbroken\r\n")
            .unwrap_err()
            .to_string();

        assert!(error.contains("解析 CSV 失败"));
        assert!(error.contains("csv_bad_width.csv"));
        assert!(error.contains("found record with 1 fields"));
    }

    #[test]
    fn read_keeps_visible_empty_rows() {
        let table = parse_csv_text(
            "csv_keeps_visible_empty_rows.csv",
            "id,name,notes\r\na,A,alpha\r\n#section\r\n\r\n,,\r\nb,B,beta\r\n",
        )
        .unwrap();

        assert_eq!(table.rows.len(), 5);
        assert_eq!(table.rows[0]["id"], "a");
        assert_eq!(table.rows[1]["id"], "#section");
        assert_eq!(table.rows[2]["id"], "");
        assert_eq!(table.rows[3]["id"], "");
        assert_eq!(table.rows[4]["id"], "b");
    }

    #[test]
    fn read_preserves_blank_lines_inside_quoted_multiline_fields() {
        let table = parse_csv_text(
            "csv_multiline_blank_field.csv",
            "id,name,desc\r\na,A,\"first line\r\n\r\nthird line\"\r\n#section\r\nb,B,plain\r\n",
        )
        .unwrap();

        assert_eq!(table.rows.len(), 3);
        assert_eq!(table.rows[0]["id"], "a");
        assert_eq!(table.rows[0]["desc"], "first line\r\n\r\nthird line");
        assert_eq!(table.rows[1]["id"], "#section");
        assert_eq!(table.rows[2]["id"], "b");
    }

    #[test]
    fn read_keeps_hash_prefixed_data_rows_with_full_width() {
        let table = parse_csv_text(
            "csv_hash_prefixed_data_row.csv",
            "name,id,desc\r\nA,a,alpha\r\n#Disabled Name,disabled,\"first line\r\n\r\nthird line\"\r\n#section\r\nB,b,beta\r\n",
        )
        .unwrap();

        assert_eq!(table.rows.len(), 4);
        assert_eq!(table.rows[1]["name"], "#Disabled Name");
        assert_eq!(table.rows[1]["id"], "disabled");
        assert_eq!(table.rows[1]["desc"], "first line\r\n\r\nthird line");
        assert_eq!(table.rows[2]["name"], "#section");
        assert_eq!(table.rows[2]["id"], "");
        assert_eq!(table.rows[3]["id"], "b");
    }

    #[test]
    fn read_keeps_hash_prefixed_multiline_data_rows() {
        let table = parse_csv_text(
            "csv_hash_prefixed_multiline_data_row.csv",
            "name,id,desc,short,sprite\r\nA,a,alpha,A,graphics/a.png\r\n#Disabled Name,disabled,\"first line\r\n\r\nthird line\",Disabled,graphics/disabled.png\r\nB,b,beta,B,graphics/b.png\r\n",
        )
        .unwrap();

        assert_eq!(table.rows.len(), 3);
        assert_eq!(table.rows[1]["name"], "#Disabled Name");
        assert_eq!(table.rows[1]["id"], "disabled");
        assert_eq!(table.rows[1]["desc"], "first line\r\n\r\nthird line");
        assert_eq!(table.rows[1]["short"], "Disabled");
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
}
