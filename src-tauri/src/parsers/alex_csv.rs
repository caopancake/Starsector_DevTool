use crate::{
    errors::{AppError, AppResult},
    models::CsvTable,
};
use serde_json::{Map, Value};

pub fn parse_csv_bytes(path_label: &str, bytes: &[u8]) -> AppResult<CsvTable> {
    let records = parse_loose_records(path_label, bytes)?;
    if records.is_empty() {
        return Ok(CsvTable {
            header: vec![],
            rows: vec![],
            path: path_label.to_string(),
        });
    }
    let Some(header_index) = records
        .iter()
        .position(|record| !is_blank_visible_empty_record(record))
    else {
        return Ok(CsvTable {
            header: vec![],
            rows: vec![],
            path: path_label.to_string(),
        });
    };
    let header = records[header_index].clone();
    let header_width = header.len();
    let mut normalized_records = Vec::new();
    for (index, record) in records.iter().skip(header_index + 1).enumerate() {
        normalized_records.push(normalize_record_width(
            path_label,
            record,
            header_width,
            index + header_index + 2,
        )?);
    }
    let mut rows = Vec::new();
    for record in normalized_records {
        let mut row = Map::new();
        for (idx, h) in header.iter().enumerate() {
            row.insert(
                h.clone(),
                Value::String(record.get(idx).cloned().unwrap_or_default()),
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
            .collect::<AppResult<Vec<_>>>()?;
        wtr.write_record(values)?;
    }
    wtr.flush()?;
    drop(wtr);
    String::from_utf8(bytes).map_err(|error| AppError::message(format!("CSV 编码失败: {error}")))
}

pub fn value_to_cell(value: &Value) -> AppResult<String> {
    match value {
        Value::Null => Ok(String::new()),
        Value::String(s) => Ok(s.clone()),
        Value::Number(n) => Ok(n.to_string()),
        Value::Bool(b) => Ok(b.to_string()),
        other => serde_json::to_string(other)
            .map_err(|error| AppError::message(format!("CSV 单元格序列化失败: {error}"))),
    }
}

fn normalize_record_width(
    path_label: &str,
    record: &[String],
    header_width: usize,
    line_number: usize,
) -> AppResult<Vec<String>> {
    if is_blank_visible_empty_record(record) {
        return Ok(vec![String::new(); header_width]);
    }
    if record.len() == header_width {
        return Ok(record.to_vec());
    }
    if record.len() < header_width && record.first().is_some_and(|cell| cell.starts_with('#')) {
        let mut padded = record.to_vec();
        padded.resize(header_width, String::new());
        return Ok(padded);
    }
    Err(AppError::context(
        format!("解析 CSV 失败 ({path_label})"),
        AppError::message(format!(
            "record {} has {} fields, but header has {} fields",
            line_number,
            record.len(),
            header_width
        )),
    ))
}

fn parse_loose_records(path_label: &str, bytes: &[u8]) -> AppResult<Vec<Vec<String>>> {
    let mut records = Vec::new();
    let mut record = Vec::new();
    let mut field = String::new();
    let mut index = 0;
    let mut in_quotes = false;
    let mut line_number = 1usize;
    let mut quoted_field_start_line = None;
    let mut at_field_start = true;
    let mut record_has_content = false;
    while index < bytes.len() {
        let byte = bytes[index];
        if in_quotes {
            if byte == b'"' {
                if bytes.get(index + 1) == Some(&b'"') {
                    index += 2;
                    field.push('"');
                    continue;
                } else if quote_closes_field(bytes.get(index + 1).copied()) {
                    index += 1;
                    in_quotes = false;
                    quoted_field_start_line = None;
                    continue;
                } else {
                    field.push('"');
                    index += 1;
                    continue;
                }
            } else if byte == b'\r' {
                if bytes.get(index + 1) == Some(&b'\n') {
                    index += 2;
                    field.push_str("\r\n");
                    line_number += 1;
                } else {
                    index += 1;
                    field.push('\r');
                    line_number += 1;
                }
            } else if byte == b'\n' {
                index += 1;
                field.push('\n');
                line_number += 1;
            } else {
                let ch = read_csv_text_char(path_label, bytes, &mut index)?;
                field.push(ch);
            }
            continue;
        }

        if byte == b'"' && at_field_start {
            index += 1;
            in_quotes = true;
            quoted_field_start_line = Some(line_number);
            at_field_start = false;
            record_has_content = true;
        } else if byte == b',' {
            index += 1;
            record.push(std::mem::take(&mut field));
            at_field_start = true;
            record_has_content = true;
        } else if byte == b'\r' {
            index += 1;
            if bytes.get(index) == Some(&b'\n') {
                index += 1;
            }
            line_number += 1;
            finish_record(
                &mut records,
                &mut record,
                &mut field,
                &mut at_field_start,
                &mut record_has_content,
            );
        } else if byte == b'\n' {
            index += 1;
            line_number += 1;
            finish_record(
                &mut records,
                &mut record,
                &mut field,
                &mut at_field_start,
                &mut record_has_content,
            );
        } else {
            let ch = read_csv_text_char(path_label, bytes, &mut index)?;
            field.push(ch);
            at_field_start = false;
            record_has_content = true;
        }
    }
    if in_quotes {
        return Err(AppError::context(
            format!("解析 CSV 失败 ({path_label})"),
            AppError::message(format!(
                "unterminated quoted field starting at line {}",
                quoted_field_start_line.unwrap_or(line_number)
            )),
        ));
    }
    if record_has_content || !field.is_empty() || !record.is_empty() {
        record.push(field);
        records.push(record);
    }
    Ok(records)
}

fn quote_closes_field(byte: Option<u8>) -> bool {
    matches!(byte, None | Some(b',') | Some(b'\r') | Some(b'\n'))
}

fn read_csv_text_char(path_label: &str, bytes: &[u8], index: &mut usize) -> AppResult<char> {
    let byte = bytes[*index];
    match byte {
        0x91 | 0x92 => {
            *index += 1;
            Ok('\'')
        }
        0x93 | 0x94 => {
            *index += 1;
            Ok('"')
        }
        0x96 => {
            *index += 1;
            Ok('-')
        }
        0x00..=0x7f => {
            *index += 1;
            Ok(byte as char)
        }
        _ => {
            let text = std::str::from_utf8(&bytes[*index..]).map_err(|error| {
                AppError::message(format!("{path_label} is not valid UTF-8: {error}"))
            })?;
            let ch = text.chars().next().ok_or_else(|| {
                AppError::message(format!("{path_label} is not valid UTF-8: empty sequence"))
            })?;
            *index += ch.len_utf8();
            Ok(ch)
        }
    }
}

fn finish_record(
    records: &mut Vec<Vec<String>>,
    record: &mut Vec<String>,
    field: &mut String,
    at_field_start: &mut bool,
    record_has_content: &mut bool,
) {
    record.push(std::mem::take(field));
    records.push(std::mem::take(record));
    *at_field_start = true;
    *record_has_content = false;
}

fn is_blank_visible_empty_record(record: &[String]) -> bool {
    record.iter().all(|field| field.trim().is_empty())
}

#[cfg(test)]
mod tests {
    use super::*;

    fn parse_csv_text(path_label: &str, text: &str) -> AppResult<CsvTable> {
        parse_csv_bytes(path_label, text.as_bytes())
    }

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
        assert!(error.contains("record 3 has 1 fields"));
        assert!(error.contains("header has 2 fields"));
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
    fn read_treats_inner_quotes_in_multiline_fields_as_text() {
        let table = parse_csv_bytes(
            "csv_multiline_inner_quotes.csv",
            b"id,type,text1,text2,text3,text4,text5,notes\r\nmonitor,SHIP,\"An oddity that \x93sometimes\x94 works.\r\n\r\nA unique \x93flux shunt\x94 modification.\",,,,,\r\nheron,SHIP,\"A so-called \x93Cruiser School\x94, the forward-thinking design won.\",,,,,\r\n",
        )
        .unwrap();

        assert_eq!(table.rows.len(), 2);
        assert_eq!(table.rows[0]["id"], "monitor");
        assert_eq!(
            table.rows[0]["text1"],
            "An oddity that \"sometimes\" works.\r\n\r\nA unique \"flux shunt\" modification."
        );
        assert_eq!(
            table.rows[1]["text1"],
            "A so-called \"Cruiser School\", the forward-thinking design won."
        );
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
    fn read_pads_hash_prefixed_short_rows() {
        let table = parse_csv_text(
            "csv_hash_prefixed_short_row.csv",
            "id,text,text2,text3\r\nid1,hi,hello,wow\r\n#id2,\r\n#id3,\"\"\r\nid4,a,b,c\r\n",
        )
        .unwrap();

        assert_eq!(table.rows.len(), 4);
        assert_eq!(table.rows[1]["id"], "#id2");
        assert_eq!(table.rows[1]["text"], "");
        assert_eq!(table.rows[1]["text2"], "");
        assert_eq!(table.rows[1]["text3"], "");
        assert_eq!(table.rows[2]["id"], "#id3");
        assert_eq!(table.rows[2]["text"], "");
        assert_eq!(table.rows[2]["text2"], "");
        assert_eq!(table.rows[2]["text3"], "");
    }

    #[test]
    fn read_still_rejects_short_non_hash_rows() {
        let error = parse_csv_text(
            "csv_short_row.csv",
            "id,text,text2,text3\r\nid1,hi,hello,wow\r\nid2,\r\n",
        )
        .unwrap_err()
        .to_string();

        assert!(error.contains("解析 CSV 失败"));
        assert!(error.contains("csv_short_row.csv"));
    }

    #[test]
    fn read_rejects_unterminated_quoted_field_at_eof() {
        let error = parse_csv_text(
            "csv_unterminated_quote.csv",
            "id,text\r\na,\"unterminated\r\nfield",
        )
        .unwrap_err()
        .to_string();

        assert!(error.contains("解析 CSV 失败"));
        assert!(error.contains("csv_unterminated_quote.csv"));
        assert!(error.contains("unterminated quoted field starting at line 2"));
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
