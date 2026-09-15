use encoding_rs::GBK;
use shared_types::{FileStamp, PathVolumeInfo, ReadTextFileResponse, SaveTextFileResponse};
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
    read_text_from_bytes(
        path_ref.display().to_string(),
        &bytes,
        file_stamp(path_ref)?,
    )
}

pub fn read_text_from_bytes(
    path: impl Into<String>,
    bytes: &[u8],
    file_stamp: FileStamp,
) -> Result<ReadTextFileResponse, FileReadError> {
    let (text, encoding) = decode_text_bytes(bytes)?;

    Ok(ReadTextFileResponse {
        path: path.into(),
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
    save_text_file_with_backup(path, text, true)
}

pub fn save_text_file_with_backup(
    path: impl AsRef<Path>,
    text: impl AsRef<str>,
    create_backup: bool,
) -> Result<SaveTextFileResponse, FileReadError> {
    let path_ref = path.as_ref();
    let path_text = path_ref.display().to_string();
    let bytes = text.as_ref().as_bytes();
    let mut vfs = LocalVfs::new();
    let backup = vfs
        .write_with_backup_option(&VfsPath::new(path_text.clone()), bytes, create_backup)
        .map_err(|error| FileReadError::Io(format!("{error:?}")))?;
    let file_stamp = file_stamp(path_ref)?;

    Ok(SaveTextFileResponse {
        path: path_text,
        bytes_written: bytes.len() as u64,
        backup_path: backup.map(|path| path.as_str().to_owned()),
        file_stamp,
    })
}

pub fn path_file_stamp(path: impl AsRef<Path>) -> Result<FileStamp, FileReadError> {
    file_stamp(path.as_ref())
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
    let (chunks, remainder) = bytes.as_chunks::<2>();

    if !remainder.is_empty() {
        return Err(FileReadError::UnsupportedEncoding);
    }

    let units = chunks
        .iter()
        .map(|chunk| convert(*chunk))
        .collect::<Vec<_>>();

    String::from_utf16(&units)
        .map(|text| (text, encoding.to_string()))
        .map_err(|_| FileReadError::UnsupportedEncoding)
}

pub fn path_volume_info(path: impl AsRef<Path>) -> Result<PathVolumeInfo, FileReadError> {
    let requested = path.as_ref();
    let probe = existing_ancestor(requested)?;
    let free_bytes = available_bytes(&probe)?;
    let display_root = volume_display_root(&probe);

    Ok(PathVolumeInfo {
        path: requested.display().to_string(),
        free_bytes,
        display_root,
    })
}

fn existing_ancestor(path: &Path) -> Result<std::path::PathBuf, FileReadError> {
    if path.as_os_str().is_empty() {
        return Err(FileReadError::NotFound("path is empty".to_owned()));
    }

    let mut current = path.to_path_buf();
    loop {
        if current.exists() {
            return Ok(current);
        }

        match current.parent() {
            Some(parent) if parent != current.as_path() => current = parent.to_path_buf(),
            _ => {
                return Err(FileReadError::NotFound(format!(
                    "no existing ancestor for {}",
                    path.display()
                )))
            }
        }
    }
}

fn volume_display_root(path: &Path) -> String {
    #[cfg(windows)]
    {
        use std::path::{Component, Prefix};
        if let Some(Component::Prefix(prefix)) = path.components().next() {
            match prefix.kind() {
                Prefix::Disk(letter) | Prefix::VerbatimDisk(letter) => {
                    return format!("{}:\\", letter as char);
                }
                Prefix::UNC(server, share) | Prefix::VerbatimUNC(server, share) => {
                    return format!(
                        "\\\\{}\\{}",
                        server.to_string_lossy(),
                        share.to_string_lossy()
                    );
                }
                _ => {}
            }
        }
    }

    #[cfg(unix)]
    {
        use std::os::unix::fs::MetadataExt;
        if let Ok(start_meta) = fs::metadata(path) {
            let start_dev = start_meta.dev();
            let mut root = path.to_path_buf();
            for ancestor in path.ancestors().skip(1) {
                match fs::metadata(ancestor) {
                    Ok(meta) if meta.dev() == start_dev => root = ancestor.to_path_buf(),
                    _ => break,
                }
            }
            return root.display().to_string();
        }
    }

    path.display().to_string()
}

#[cfg(unix)]
fn available_bytes(path: &Path) -> Result<u64, FileReadError> {
    use std::ffi::CString;

    let c_path = CString::new(path.as_os_str().as_encoded_bytes()).map_err(|_| {
        FileReadError::Io(format!("path contains interior nul: {}", path.display()))
    })?;

    unsafe {
        let mut stat = std::mem::MaybeUninit::<libc::statvfs>::zeroed();
        if libc::statvfs(c_path.as_ptr(), stat.as_mut_ptr()) != 0 {
            return Err(FileReadError::Io(format!(
                "statvfs failed for {}: {}",
                path.display(),
                std::io::Error::last_os_error()
            )));
        }
        let stat = stat.assume_init();
        #[allow(clippy::unnecessary_cast)]
        let free_bytes = (stat.f_bavail as u64).saturating_mul(stat.f_frsize as u64);
        Ok(free_bytes)
    }
}

#[cfg(windows)]
fn available_bytes(path: &Path) -> Result<u64, FileReadError> {
    use std::os::windows::ffi::OsStrExt;

    #[link(name = "kernel32")]
    extern "system" {
        fn GetDiskFreeSpaceExW(
            directory_name: *const u16,
            free_bytes_available: *mut u64,
            total_number_of_bytes: *mut u64,
            total_number_of_free_bytes: *mut u64,
        ) -> i32;
    }

    let wide: Vec<u16> = path
        .as_os_str()
        .encode_wide()
        .chain(std::iter::once(0))
        .collect();
    let mut free_available = 0u64;
    let mut total = 0u64;
    let mut total_free = 0u64;
    let ok = unsafe {
        GetDiskFreeSpaceExW(
            wide.as_ptr(),
            &mut free_available,
            &mut total,
            &mut total_free,
        )
    };
    if ok == 0 {
        return Err(FileReadError::Io(format!(
            "GetDiskFreeSpaceExW failed for {}: {}",
            path.display(),
            std::io::Error::last_os_error()
        )));
    }
    Ok(free_available)
}

#[cfg(not(any(unix, windows)))]
fn available_bytes(path: &Path) -> Result<u64, FileReadError> {
    Err(FileReadError::Io(format!(
        "disk free space is unavailable on this platform for {}",
        path.display()
    )))
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
    fn path_file_stamp_reads_size_and_mtime() {
        let path = temp_file_path("stamp-bin");
        fs::write(&path, b"abcdef").expect("fixture should be writable");
        let stamp = path_file_stamp(&path).expect("stamp");
        assert_eq!(stamp.size, 6);
        assert!(stamp.modified_at_ms > 0);
        fs::remove_file(path).expect("fixture should be removable");
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

    #[test]
    fn saves_text_file_without_backup_when_disabled() {
        let path = temp_file_path("save-output-no-bak");

        fs::write(&path, "before").expect("fixture should be writable");

        let result =
            save_text_file_with_backup(&path, "after", false).expect("text file should save");

        assert_eq!(
            fs::read_to_string(&path).expect("saved text should be readable"),
            "after"
        );
        assert!(result.backup_path.is_none());
        assert!(!Path::new(&format!("{}.bak", path.display())).exists());

        fs::remove_file(path).expect("fixture should be removable");
    }
    #[test]
    fn path_volume_info_reports_free_bytes_for_temp_dir() {
        let root = std::env::temp_dir();
        let info = path_volume_info(&root).expect("temp dir volume should be readable");
        assert!(info.free_bytes > 0, "expected positive free bytes");
        assert!(!info.display_root.is_empty());
        assert_eq!(info.path, root.display().to_string());
    }
}
