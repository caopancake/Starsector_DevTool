use crate::{
    errors::{AppError, AppResult},
    io::paths::validate_walk_entry,
};
use std::{fs, path::Path};

const UTF8_BOM: &[u8] = &[0xef, 0xbb, 0xbf];

pub fn read_utf8_no_bom(path: &Path) -> AppResult<String> {
    let bytes = read_text_bytes_no_bom(path)?;
    match String::from_utf8(bytes) {
        Ok(text) => Ok(text),
        Err(error) => {
            let bytes = normalize_known_cp1252_bytes(error.into_bytes());
            String::from_utf8(bytes).map_err(|error| {
                AppError::message(format!("{} is not valid UTF-8: {error}", path.display()))
            })
        }
    }
}

pub fn read_text_bytes_no_bom(path: &Path) -> AppResult<Vec<u8>> {
    if path.exists() {
        validate_walk_entry(path, "text file")?;
    }
    let bytes = fs::read(path).map_err(|error| {
        AppError::context(
            format!("读取文本文件失败 ({})", path.display()),
            error.into(),
        )
    })?;
    if bytes.starts_with(UTF8_BOM) {
        return Err(AppError::message(format!(
            "{} has UTF-8 BOM",
            path.display()
        )));
    }
    Ok(bytes)
}

pub fn write_utf8_no_bom(path: &Path, text: &str) -> AppResult<()> {
    fs::write(path, text.as_bytes()).map_err(|error| {
        AppError::context(
            format!("写入文本文件失败 ({})", path.display()),
            error.into(),
        )
    })?;
    Ok(())
}

fn normalize_known_cp1252_bytes(mut bytes: Vec<u8>) -> Vec<u8> {
    let mut normalized = Vec::with_capacity(bytes.len());
    for byte in bytes.drain(..) {
        match byte {
            0x91 | 0x92 => normalized.push(b'\''),
            0x93 | 0x94 => normalized.push(b'"'),
            0x96 => normalized.push(b'-'),
            _ => normalized.push(byte),
        }
    }
    normalized
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::{
        path::PathBuf,
        time::{SystemTime, UNIX_EPOCH},
    };

    #[test]
    fn rejects_utf8_bom() {
        let path = temp_path("rejects_utf8_bom.txt");
        fs::write(&path, [UTF8_BOM, "ok".as_bytes()].concat()).unwrap();
        let result = read_utf8_no_bom(&path);
        let _ = fs::remove_file(path);
        assert!(result.is_err());
    }

    #[test]
    fn writes_utf8_without_bom() {
        let path = temp_path("writes_utf8_without_bom.txt");
        write_utf8_no_bom(&path, "舰船").unwrap();
        let bytes = fs::read(&path).unwrap();
        let _ = fs::remove_file(path);
        assert!(!bytes.starts_with(UTF8_BOM));
        assert_eq!(String::from_utf8(bytes).unwrap(), "舰船");
    }

    #[test]
    fn reads_cp1252_smart_single_quotes_as_ascii_apostrophes() {
        let path = temp_path("reads_cp1252_quote.txt");
        fs::write(&path, b"\x91it\x92s\x92").unwrap();

        let text = read_utf8_no_bom(&path).unwrap();

        let _ = fs::remove_file(path);
        assert_eq!(text, "'it's'");
    }

    #[test]
    fn reads_cp1252_smart_double_quotes_as_ascii_quotes() {
        let path = temp_path("reads_cp1252_double_quotes.txt");
        fs::write(&path, b"\x93quoted\x94").unwrap();

        let text = read_utf8_no_bom(&path).unwrap();

        let _ = fs::remove_file(path);
        assert_eq!(text, "\"quoted\"");
    }

    #[test]
    fn reads_cp1252_en_dash_as_ascii_hyphen() {
        let path = temp_path("reads_cp1252_en_dash.txt");
        fs::write(&path, b"left \x96 right").unwrap();

        let text = read_utf8_no_bom(&path).unwrap();

        let _ = fs::remove_file(path);
        assert_eq!(text, "left - right");
    }

    fn temp_path(name: &str) -> PathBuf {
        let stamp = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap()
            .as_nanos();
        std::env::temp_dir().join(format!("{stamp}_{name}"))
    }
}
