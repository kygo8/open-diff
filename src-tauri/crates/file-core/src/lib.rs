use encoding_rs::GBK;
use shared_types::{FileStamp, ReadTextFileResponse, SaveTextFileResponse};
use std::fs;
use std::path::Path;
use std::time::UNIX_EPOCH;
use vfs_core::{LocalVfs, VfsPath};

#[derive(Debug, Clone, PartialEq, Eq)]
pub enum FileReadError {
    NotFound(String),
    Io(String),
    UnsupportedEncoding,
}

pub fn read_text_file(path: impl AsRef<Path>) -> Result<ReadTextFileResponse, FileReadError> {
    let path_ref = path.as_ref();
    let bytes = fs::read(path_ref).map_err(file_io_error)?;
    let (text, encoding) = decode_text_bytes(&bytes)?;
    let file_stamp = file_stamp(path_ref)?;

    Ok(ReadTextFileResponse {
        path: path_ref.display().to_string(),
        line_ending: detect_line_ending(&text).to_string(),
        file_stamp,
        text,
        encoding,
    })
}

pub fn check_text_file_changed(
    path: impl AsRef<Path>,
    previous_stamp: &FileStamp,
) -> Result<bool, FileReadError> {
    let current_stamp = file_stamp(path.as_ref())?;

    Ok(&current_stamp != previous_stamp)
}

pub fn save_text_file(
    path: impl AsRef<Path>,
    text: impl AsRef<str>,
) -> Result<SaveTextFileResponse, FileReadError> {
    let path_ref = path.as_ref();
    let path_text = path_ref.display().to_string();
    let bytes = text.as_ref().as_bytes();
    let mut vfs = LocalVfs::new();
    let backup = vfs
        .write_with_backup(&VfsPath::new(path_text.clone()), bytes)
        .map_err(|error| FileReadError::Io(format!("{error:?}")))?;
    let file_stamp = file_stamp(path_ref)?;

    Ok(SaveTextFileResponse {
        path: path_text,
        bytes_written: bytes.len() as u64,
        backup_path: backup.map(|path| path.as_str().to_owned()),
        file_stamp,
    })
}

fn file_stamp(path: &Path) -> Result<FileStamp, FileReadError> {
    let metadata = fs::metadata(path).map_err(file_io_error)?;
    let modified_at_ms = metadata
        .modified()
        .map_err(|error| FileReadError::Io(error.to_string()))?
        .duration_since(UNIX_EPOCH)
        .map_err(|error| FileReadError::Io(error.to_string()))?
        .as_millis();

    Ok(FileStamp {
        size: metadata.len(),
        modified_at_ms,
    })
}

fn file_io_error(error: std::io::Error) -> FileReadError {
    if error.kind() == std::io::ErrorKind::NotFound {
        return FileReadError::NotFound(error.to_string());
    }

    FileReadError::Io(error.to_string())
}

fn detect_line_ending(text: &str) -> &'static str {
    if text.contains("\r\n") {
        return "CRLF";
    }

    if text.contains('\n') {
        return "LF";
    }

    if text.contains('\r') {
        return "CR";
    }

    "None"
}

fn decode_text_bytes(bytes: &[u8]) -> Result<(String, String), FileReadError> {
    if let Some(content) = bytes.strip_prefix(&[0xEF, 0xBB, 0xBF]) {
        return String::from_utf8(content.to_vec())
            .map(|text| (text, "utf-8-bom".to_string()))
            .map_err(|_| FileReadError::UnsupportedEncoding);
    }

    if let Some(content) = bytes.strip_prefix(&[0xFF, 0xFE]) {
        return decode_utf16(content, "utf-16le", u16::from_le_bytes);
    }

    if let Some(content) = bytes.strip_prefix(&[0xFE, 0xFF]) {
        return decode_utf16(content, "utf-16be", u16::from_be_bytes);
    }

    if let Ok(text) = String::from_utf8(bytes.to_vec()) {
        return Ok((text, "utf-8".to_string()));
    }

    let (text, _, had_errors) = GBK.decode(bytes);

    if had_errors {
        return Err(FileReadError::UnsupportedEncoding);
    }

    Ok((text.into_owned(), "gbk".to_string()))
}

fn decode_utf16(
    bytes: &[u8],
    encoding: &str,
    convert: fn([u8; 2]) -> u16,
) -> Result<(String, String), FileReadError> {
    let chunks = bytes.chunks_exact(2);

    if !chunks.remainder().is_empty() {
        return Err(FileReadError::UnsupportedEncoding);
    }

    let units = chunks
        .map(|chunk| convert([chunk[0], chunk[1]]))
        .collect::<Vec<_>>();

    String::from_utf16(&units)
        .map(|text| (text, encoding.to_string()))
        .map_err(|_| FileReadError::UnsupportedEncoding)
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::fs;
    use std::time::{SystemTime, UNIX_EPOCH};

    fn temp_file_path(name: &str) -> std::path::PathBuf {
        let stamp = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .expect("system time should be after epoch")
            .as_nanos();

        std::env::temp_dir().join(format!("open-diff-{name}-{stamp}.txt"))
    }

    #[test]
    fn reads_utf8_text_file() {
        let path = temp_file_path("utf8");

        fs::write(&path, "hello\n世界").expect("fixture should be writable");

        let result = read_text_file(&path).expect("utf-8 file should be readable");

        assert_eq!(result.text, "hello\n世界");
        assert_eq!(result.encoding, "utf-8");

        fs::remove_file(path).expect("fixture should be removable");
    }

    #[test]
    fn reads_utf16_le_text_file_with_bom() {
        let path = temp_file_path("utf16le");
        let mut bytes = vec![0xFF, 0xFE];

        for unit in "hello\n世界".encode_utf16() {
            bytes.extend_from_slice(&unit.to_le_bytes());
        }

        fs::write(&path, bytes).expect("fixture should be writable");

        let result = read_text_file(&path).expect("utf-16le file should be readable");

        assert_eq!(result.text, "hello\n世界");
        assert_eq!(result.encoding, "utf-16le");

        fs::remove_file(path).expect("fixture should be removable");
    }

    #[test]
    fn reads_gbk_text_file() {
        let path = temp_file_path("gbk");

        fs::write(&path, [0xC4, 0xE3, 0xBA, 0xC3]).expect("fixture should be writable");

        let result = read_text_file(&path).expect("gbk file should be readable");

        assert_eq!(result.text, "你好");
        assert_eq!(result.encoding, "gbk");

        fs::remove_file(path).expect("fixture should be removable");
    }

    #[test]
    fn detects_line_endings() {
        let cases = [
            ("lf", "one\ntwo", "LF"),
            ("crlf", "one\r\ntwo", "CRLF"),
            ("cr", "one\rtwo", "CR"),
        ];

        for (name, content, expected) in cases {
            let path = temp_file_path(name);

            fs::write(&path, content).expect("fixture should be writable");

            let result = read_text_file(&path).expect("text file should be readable");

            assert_eq!(result.line_ending, expected);

            fs::remove_file(path).expect("fixture should be removable");
        }
    }

    #[test]
    fn detects_external_file_changes_from_stamp() {
        let path = temp_file_path("external-change");

        fs::write(&path, "before").expect("fixture should be writable");
        let initial = read_text_file(&path).expect("text file should be readable");

        fs::write(&path, "after with more bytes").expect("fixture should be writable");
        let changed =
            check_text_file_changed(&path, &initial.file_stamp).expect("file should be statable");

        assert!(changed);

        let latest = read_text_file(&path).expect("text file should be readable");
        let unchanged =
            check_text_file_changed(&path, &latest.file_stamp).expect("file should be statable");

        assert!(!unchanged);

        fs::remove_file(path).expect("fixture should be removable");
    }

    #[test]
    fn saves_text_file_with_backup_and_stamp() {
        let path = temp_file_path("save-output");

        fs::write(&path, "before").expect("fixture should be writable");

        let result = save_text_file(&path, "after\nmerged").expect("text file should save");

        assert_eq!(
            fs::read_to_string(&path).expect("saved text should be readable"),
            "after\nmerged"
        );
        assert_eq!(result.path, path.display().to_string());
        assert_eq!(result.bytes_written, 12);
        assert!(result.file_stamp.size > 0);
        let backup_path = result
            .backup_path
            .expect("existing file should be backed up");
        assert_eq!(
            fs::read_to_string(&backup_path).expect("backup should be readable"),
            "before"
        );

        fs::remove_file(path).expect("fixture should be removable");
        fs::remove_file(backup_path).expect("backup should be removable");
    }
}
