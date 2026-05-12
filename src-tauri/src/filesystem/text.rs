use crate::errors::{AppError, AppResult};
use std::{fs, path::Path};

const UTF8_BOM: &[u8] = &[0xef, 0xbb, 0xbf];

pub fn read_utf8_no_bom(path: &Path) -> AppResult<String> {
    let bytes = fs::read(path)?;
    if bytes.starts_with(UTF8_BOM) {
        return Err(AppError::message(format!(
            "{} has UTF-8 BOM",
            path.display()
        )));
    }
    String::from_utf8(bytes).map_err(|error| {
        AppError::message(format!("{} is not valid UTF-8: {error}", path.display()))
    })
}

pub fn write_utf8_no_bom(path: &Path, text: &str) -> AppResult<()> {
    fs::write(path, text.as_bytes())?;
    Ok(())
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

    fn temp_path(name: &str) -> PathBuf {
        let stamp = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap()
            .as_nanos();
        std::env::temp_dir().join(format!("{stamp}_{name}"))
    }
}
