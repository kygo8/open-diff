use serde::{Deserialize, Serialize};
use std::collections::BTreeMap;
use std::fs::File;
use std::io::{Cursor, Read, Write};
use std::path::Path;

#[derive(Debug, Clone, Default, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ArchiveDocument {
    pub name: String,
    files: BTreeMap<String, Vec<u8>>,
}

impl ArchiveDocument {
    pub fn new(name: impl Into<String>) -> Self {
        Self {
            name: name.into(),
            files: BTreeMap::new(),
        }
    }

    pub fn with_file(mut self, path: impl AsRef<str>, bytes: Vec<u8>) -> Self {
        self.files
            .insert(normalize_archive_path(path.as_ref()), bytes);

        self
    }

    pub fn file_count(&self) -> usize {
        self.files.len()
    }

    pub fn files(&self) -> impl Iterator<Item = (&String, &Vec<u8>)> {
        self.files.iter()
    }
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ArchiveEntry {
    pub path: String,
    pub kind: ArchiveEntryKind,
    pub size: u64,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "kebab-case")]
pub enum ArchiveEntryKind {
    File,
    Directory,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub enum ArchiveError {
    NotFound(String),
    NotDirectory(String),
    InvalidArchive(String),
    UnsupportedFormat(String),
    Io(String),
}

impl std::fmt::Display for ArchiveError {
    fn fmt(&self, formatter: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            Self::NotFound(path) => write!(formatter, "archive path not found: {path}"),
            Self::NotDirectory(path) => {
                write!(formatter, "archive path is not a directory: {path}")
            }
            Self::InvalidArchive(message) => write!(formatter, "invalid archive: {message}"),
            Self::UnsupportedFormat(format) => {
                write!(formatter, "unsupported archive format: {format}")
            }
            Self::Io(message) => write!(formatter, "archive io error: {message}"),
        }
    }
}

impl std::error::Error for ArchiveError {}

pub type ArchiveResult<T> = Result<T, ArchiveError>;

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "kebab-case")]
pub enum ArchiveFormat {
    Zip,
    Tar,
    TarGz,
    Gz,
    SevenZip,
}

impl ArchiveFormat {
    pub fn detect(name: impl AsRef<str>) -> ArchiveResult<Self> {
        let name = name.as_ref();
        let lower_name = name.to_ascii_lowercase();

        if lower_name.ends_with(".tar.gz") || lower_name.ends_with(".tgz") {
            return Ok(Self::TarGz);
        }

        if lower_name.ends_with(".zip") {
            return Ok(Self::Zip);
        }

        if lower_name.ends_with(".tar") {
            return Ok(Self::Tar);
        }

        if lower_name.ends_with(".gz") {
            return Ok(Self::Gz);
        }

        if lower_name.ends_with(".7z") {
            return Ok(Self::SevenZip);
        }

        Err(ArchiveError::UnsupportedFormat(name.to_owned()))
    }

    pub fn is_implemented(self) -> bool {
        matches!(
            self,
            Self::Zip | Self::Tar | Self::TarGz | Self::Gz | Self::SevenZip
        )
    }
}

pub fn is_archive_path(path: impl AsRef<str>) -> bool {
    matches!(
        ArchiveFormat::detect(path.as_ref()),
        Ok(format) if format.is_implemented()
    )
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct ArchiveSourceEntry {
    path: String,
    bytes: Vec<u8>,
}

impl ArchiveSourceEntry {
    pub fn file(path: impl AsRef<str>, bytes: impl AsRef<[u8]>) -> Self {
        Self {
            path: normalize_archive_path(path.as_ref()),
            bytes: bytes.as_ref().to_vec(),
        }
    }
}

pub struct ArchiveReader;

impl ArchiveReader {
    pub fn open_path(path: impl AsRef<Path>) -> ArchiveResult<ArchiveDocument> {
        let path = path.as_ref();
        let name = path
            .file_name()
            .map(|name| name.to_string_lossy().into_owned())
            .unwrap_or_else(|| path.display().to_string());
        let bytes = std::fs::read(path).map_err(|error| ArchiveError::Io(error.to_string()))?;

        Self::open_bytes(name, &bytes)
    }

    pub fn open_bytes(name: impl Into<String>, bytes: &[u8]) -> ArchiveResult<ArchiveDocument> {
        let name = name.into();
        let format = ArchiveFormat::detect(&name)?;

        match format {
            ArchiveFormat::Zip => {
                ZipArchiveDocument::from_bytes(name, bytes).map(|archive| archive.document)
            }
            ArchiveFormat::Tar => read_tar_document(name, bytes, false),
            ArchiveFormat::TarGz => read_tar_document(name, bytes, true),
            ArchiveFormat::Gz => read_gzip_document(name, bytes),
            ArchiveFormat::SevenZip => read_seven_zip_document(name, bytes),
        }
    }

    pub fn open(
        name: impl Into<String>,
        _format: ArchiveFormat,
        entries: Vec<ArchiveSourceEntry>,
    ) -> ArchiveResult<ArchiveDocument> {
        let mut document = ArchiveDocument::new(name);

        for entry in entries {
            document = document.with_file(entry.path, entry.bytes);
        }

        Ok(document)
    }
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct ArchiveVfs {
    document: ArchiveDocument,
}

impl ArchiveVfs {
    pub fn from_document(document: ArchiveDocument) -> Self {
        Self { document }
    }

    pub fn document(&self) -> &ArchiveDocument {
        &self.document
    }

    pub fn list(&self, path: impl AsRef<str>) -> ArchiveResult<Vec<ArchiveEntry>> {
        let directory = normalize_archive_path(path.as_ref());
        let prefix = if directory == "/" {
            "/".to_owned()
        } else {
            format!("{}/", directory.trim_end_matches('/'))
        };
        let mut entries = BTreeMap::<String, ArchiveEntry>::new();

        for (file_path, bytes) in &self.document.files {
            let Some(relative) = file_path.strip_prefix(&prefix) else {
                continue;
            };

            if relative.is_empty() {
                continue;
            }

            let entry_path = if let Some((directory_name, _)) = relative.split_once('/') {
                format!("{prefix}{directory_name}")
            } else {
                file_path.clone()
            };
            let kind = if entry_path == *file_path {
                ArchiveEntryKind::File
            } else {
                ArchiveEntryKind::Directory
            };
            let size = if kind == ArchiveEntryKind::File {
                bytes.len() as u64
            } else {
                0
            };

            entries.entry(entry_path.clone()).or_insert(ArchiveEntry {
                path: entry_path,
                kind,
                size,
            });
        }

        if entries.is_empty() && !self.is_directory(&directory) {
            return Err(ArchiveError::NotFound(directory));
        }

        Ok(entries.into_values().collect())
    }

    pub fn list_recursive(&self) -> Vec<ArchiveEntry> {
        let mut entries = BTreeMap::<String, ArchiveEntry>::new();

        for (file_path, bytes) in &self.document.files {
            insert_ancestor_directories(&mut entries, file_path);
            entries.insert(
                file_path.clone(),
                ArchiveEntry {
                    path: file_path.clone(),
                    kind: ArchiveEntryKind::File,
                    size: bytes.len() as u64,
                },
            );
        }

        entries.into_values().collect()
    }

    pub fn read(&self, path: impl AsRef<str>) -> ArchiveResult<Vec<u8>> {
        let path = normalize_archive_path(path.as_ref());

        self.document
            .files
            .get(&path)
            .cloned()
            .ok_or(ArchiveError::NotFound(path))
    }

    pub fn metadata(&self, path: impl AsRef<str>) -> ArchiveResult<ArchiveEntry> {
        let path = normalize_archive_path(path.as_ref());

        if let Some(bytes) = self.document.files.get(&path) {
            return Ok(ArchiveEntry {
                path,
                kind: ArchiveEntryKind::File,
                size: bytes.len() as u64,
            });
        }

        if self.is_directory(&path) {
            return Ok(ArchiveEntry {
                path,
                kind: ArchiveEntryKind::Directory,
                size: 0,
            });
        }

        Err(ArchiveError::NotFound(path))
    }

    fn is_directory(&self, path: &str) -> bool {
        if path == "/" {
            return true;
        }

        let prefix = format!("{}/", path.trim_end_matches('/'));

        self.document
            .files
            .keys()
            .any(|file_path| file_path.starts_with(&prefix))
    }
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ArchiveCompareRow {
    pub path: String,
    pub status: ArchiveCompareStatus,
    pub left_size: Option<u64>,
    pub right_size: Option<u64>,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "kebab-case")]
pub enum ArchiveCompareStatus {
    Same,
    Different,
    LeftOnly,
    RightOnly,
}

pub fn compare_archives(left: &ArchiveDocument, right: &ArchiveDocument) -> Vec<ArchiveCompareRow> {
    let mut paths = left.files.keys().cloned().collect::<Vec<_>>();

    for path in right.files.keys() {
        if !left.files.contains_key(path) {
            paths.push(path.clone());
        }
    }

    paths.sort();

    paths
        .into_iter()
        .map(|path| {
            let left_bytes = left.files.get(&path);
            let right_bytes = right.files.get(&path);
            let status = match (left_bytes, right_bytes) {
                (Some(left_bytes), Some(right_bytes)) if left_bytes == right_bytes => {
                    ArchiveCompareStatus::Same
                }
                (Some(_), Some(_)) => ArchiveCompareStatus::Different,
                (Some(_), None) => ArchiveCompareStatus::LeftOnly,
                (None, Some(_)) => ArchiveCompareStatus::RightOnly,
                (None, None) => ArchiveCompareStatus::Same,
            };

            ArchiveCompareRow {
                left_size: left_bytes.map(|bytes| bytes.len() as u64),
                right_size: right_bytes.map(|bytes| bytes.len() as u64),
                path,
                status,
            }
        })
        .collect()
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct ZipArchiveDocument {
    document: ArchiveDocument,
}

impl ZipArchiveDocument {
    pub fn open(document: ArchiveDocument) -> ArchiveResult<Self> {
        Ok(Self { document })
    }

    pub fn from_bytes(name: impl Into<String>, bytes: &[u8]) -> ArchiveResult<Self> {
        if bytes.is_empty() {
            return Err(ArchiveError::InvalidArchive(
                "ZIP payload is empty".to_owned(),
            ));
        }

        if !bytes.starts_with(b"PK") {
            return Err(ArchiveError::InvalidArchive(
                "ZIP payload is not a PK zip archive".to_owned(),
            ));
        }

        let reader = Cursor::new(bytes);
        let mut archive = zip::ZipArchive::new(reader)
            .map_err(|error| ArchiveError::InvalidArchive(error.to_string()))?;
        let mut document = ArchiveDocument::new(name);

        for index in 0..archive.len() {
            let mut file = archive
                .by_index(index)
                .map_err(|error| ArchiveError::InvalidArchive(error.to_string()))?;

            if file.is_dir() {
                continue;
            }

            let path = file
                .enclosed_name()
                .map(|path| path.to_string_lossy().into_owned())
                .unwrap_or_else(|| file.name().to_owned());
            let mut contents = Vec::new();
            file.read_to_end(&mut contents)
                .map_err(|error| ArchiveError::Io(error.to_string()))?;
            document = document.with_file(path, contents);
        }

        Ok(Self { document })
    }

    pub fn from_path(path: impl AsRef<Path>) -> ArchiveResult<Self> {
        let path = path.as_ref();
        let name = path
            .file_name()
            .map(|name| name.to_string_lossy().into_owned())
            .unwrap_or_else(|| path.display().to_string());
        let bytes = std::fs::read(path).map_err(|error| ArchiveError::Io(error.to_string()))?;

        Self::from_bytes(name, &bytes)
    }

    pub fn into_document(self) -> ArchiveDocument {
        self.document
    }

    pub fn into_editor(self) -> ZipArchiveEditor {
        ZipArchiveEditor {
            document: self.document,
        }
    }
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct ZipArchiveEditor {
    document: ArchiveDocument,
}

impl ZipArchiveEditor {
    pub fn replace_file(&mut self, path: impl AsRef<str>, bytes: Vec<u8>) -> ArchiveResult<()> {
        self.document
            .files
            .insert(normalize_archive_path(path.as_ref()), bytes);

        Ok(())
    }

    pub fn write_back(self) -> ArchiveResult<Vec<u8>> {
        write_zip_bytes(&self.document)
    }

    pub fn write_to_path(self, path: impl AsRef<Path>) -> ArchiveResult<()> {
        let bytes = self.write_back()?;
        let mut file =
            File::create(path.as_ref()).map_err(|error| ArchiveError::Io(error.to_string()))?;
        file.write_all(&bytes)
            .map_err(|error| ArchiveError::Io(error.to_string()))
    }
}

pub fn write_zip_bytes(document: &ArchiveDocument) -> ArchiveResult<Vec<u8>> {
    let cursor = Cursor::new(Vec::new());
    let mut writer = zip::ZipWriter::new(cursor);
    let options = zip::write::SimpleFileOptions::default()
        .compression_method(zip::CompressionMethod::Deflated);

    for (path, bytes) in &document.files {
        let zip_path = path.trim_start_matches('/');
        writer
            .start_file(zip_path, options)
            .map_err(|error| ArchiveError::Io(error.to_string()))?;
        writer
            .write_all(bytes)
            .map_err(|error| ArchiveError::Io(error.to_string()))?;
    }

    let cursor = writer
        .finish()
        .map_err(|error| ArchiveError::Io(error.to_string()))?;

    Ok(cursor.into_inner())
}

fn read_tar_document(
    name: impl Into<String>,
    bytes: &[u8],
    gzip: bool,
) -> ArchiveResult<ArchiveDocument> {
    if bytes.is_empty() {
        return Err(ArchiveError::InvalidArchive(
            "TAR payload is empty".to_owned(),
        ));
    }

    let mut document = ArchiveDocument::new(name);

    if gzip {
        let decoder = flate2::read::GzDecoder::new(Cursor::new(bytes));
        read_tar_entries(&mut document, decoder)?;
    } else {
        read_tar_entries(&mut document, Cursor::new(bytes))?;
    }

    Ok(document)
}

fn read_tar_entries<R: Read>(document: &mut ArchiveDocument, reader: R) -> ArchiveResult<()> {
    let mut archive = tar::Archive::new(reader);
    let entries = archive
        .entries()
        .map_err(|error| ArchiveError::InvalidArchive(error.to_string()))?;

    for entry in entries {
        let mut entry = entry.map_err(|error| ArchiveError::InvalidArchive(error.to_string()))?;
        let path = entry
            .path()
            .map_err(|error| ArchiveError::InvalidArchive(error.to_string()))?
            .to_string_lossy()
            .into_owned();

        if !entry.header().entry_type().is_file() {
            continue;
        }

        let mut contents = Vec::new();
        entry
            .read_to_end(&mut contents)
            .map_err(|error| ArchiveError::Io(error.to_string()))?;
        *document = std::mem::take(document).with_file(path, contents);
    }

    Ok(())
}

fn read_gzip_document(name: impl Into<String>, bytes: &[u8]) -> ArchiveResult<ArchiveDocument> {
    if bytes.is_empty() {
        return Err(ArchiveError::InvalidArchive(
            "GZIP payload is empty".to_owned(),
        ));
    }

    let mut decoder = flate2::read::GzDecoder::new(Cursor::new(bytes));
    let mut contents = Vec::new();
    decoder
        .read_to_end(&mut contents)
        .map_err(|error| ArchiveError::InvalidArchive(error.to_string()))?;
    let file_name = Path::new(&name.into())
        .file_stem()
        .map(|stem| stem.to_string_lossy().into_owned())
        .unwrap_or_else(|| "payload".to_owned());

    Ok(ArchiveDocument::new(file_name.clone()).with_file(file_name, contents))
}

fn read_seven_zip_document(
    name: impl Into<String>,
    bytes: &[u8],
) -> ArchiveResult<ArchiveDocument> {
    if bytes.is_empty() {
        return Err(ArchiveError::InvalidArchive(
            "7z payload is empty".to_owned(),
        ));
    }

    if !bytes.starts_with(&[b'7', b'z', 0xBC, 0xAF, 0x27, 0x1C]) {
        return Err(ArchiveError::InvalidArchive(
            "7z payload is missing the 7z signature".to_owned(),
        ));
    }

    let mut reader = sevenz_rust2::ArchiveReader::new(
        Cursor::new(bytes.to_vec()),
        sevenz_rust2::Password::empty(),
    )
    .map_err(|error| ArchiveError::InvalidArchive(error.to_string()))?;

    let mut document = ArchiveDocument::new(name);
    reader
        .for_each_entries(|entry, reader| {
            if entry.is_directory() {
                return Ok(true);
            }

            let mut contents = Vec::new();
            reader.read_to_end(&mut contents)?;
            document = std::mem::take(&mut document).with_file(entry.name(), contents);
            Ok(true)
        })
        .map_err(|error| ArchiveError::InvalidArchive(error.to_string()))?;

    Ok(document)
}

pub fn write_seven_zip_bytes(document: &ArchiveDocument) -> ArchiveResult<Vec<u8>> {
    let cursor = Cursor::new(Vec::new());
    let mut writer = sevenz_rust2::ArchiveWriter::new(cursor)
        .map_err(|error| ArchiveError::Io(error.to_string()))?;
    writer.set_encrypt_header(false);

    for (path, bytes) in &document.files {
        let entry_name = path.trim_start_matches('/');
        writer
            .push_archive_entry(
                sevenz_rust2::ArchiveEntry::new_file(entry_name),
                Some(Cursor::new(bytes.clone())),
            )
            .map_err(|error| ArchiveError::Io(error.to_string()))?;
    }

    let finished = writer
        .finish()
        .map_err(|error| ArchiveError::Io(error.to_string()))?;

    Ok(finished.into_inner())
}

fn insert_ancestor_directories(entries: &mut BTreeMap<String, ArchiveEntry>, file_path: &str) {
    let segments = file_path
        .trim_start_matches('/')
        .split('/')
        .filter(|segment| !segment.is_empty())
        .collect::<Vec<_>>();

    for index in 1..segments.len() {
        let directory = format!("/{}", segments[..index].join("/"));
        entries.entry(directory.clone()).or_insert(ArchiveEntry {
            path: directory,
            kind: ArchiveEntryKind::Directory,
            size: 0,
        });
    }
}

fn normalize_archive_path(path: &str) -> String {
    let normalized = path.replace('\\', "/");
    let mut segments = Vec::<&str>::new();

    for segment in normalized.split('/') {
        match segment {
            "" | "." => {}
            ".." => {
                segments.pop();
            }
            _ => segments.push(segment),
        }
    }

    if segments.is_empty() {
        return "/".to_owned();
    }

    format!("/{}", segments.join("/"))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn archive_vfs_lists_archive_entries_as_directory_tree() {
        let archive = ArchiveDocument::new("release.zip")
            .with_file("bin/app.exe", b"binary".to_vec())
            .with_file("docs/readme.md", b"# Readme".to_vec());
        let vfs = ArchiveVfs::from_document(archive);

        let root_entries = vfs.list("/").unwrap();
        let docs_entries = vfs.list("/docs").unwrap();

        assert_eq!(root_entries.len(), 2);
        assert_eq!(root_entries[0].path, "/bin");
        assert_eq!(root_entries[0].kind, ArchiveEntryKind::Directory);
        assert_eq!(docs_entries[0].path, "/docs/readme.md");
        assert_eq!(docs_entries[0].kind, ArchiveEntryKind::File);
        assert_eq!(docs_entries[0].size, 8);
    }

    #[test]
    fn archive_vfs_reads_file_content_and_metadata() {
        let archive =
            ArchiveDocument::new("release.zip").with_file("/docs/readme.md", b"# Readme".to_vec());
        let vfs = ArchiveVfs::from_document(archive);

        assert_eq!(vfs.read("/docs/readme.md").unwrap(), b"# Readme");
        assert_eq!(
            vfs.metadata("/docs").unwrap().kind,
            ArchiveEntryKind::Directory
        );
        assert_eq!(vfs.metadata("/docs/readme.md").unwrap().size, 8);
    }

    #[test]
    fn archive_vfs_reports_missing_paths() {
        let archive = ArchiveDocument::new("release.zip");
        let vfs = ArchiveVfs::from_document(archive);

        let error = vfs.read("/missing.txt").unwrap_err();

        assert!(matches!(
            error,
            ArchiveError::NotFound(path) if path == "/missing.txt"
        ));
    }

    #[test]
    fn zip_archive_round_trips_real_pk_bytes() {
        let original = ArchiveDocument::new("release.zip")
            .with_file("/docs/readme.md", b"old".to_vec())
            .with_file("/docs/changelog.md", b"changes".to_vec());
        let bytes = write_zip_bytes(&original).unwrap();

        assert!(bytes.starts_with(b"PK"));

        let mut editor = ZipArchiveDocument::from_bytes("release.zip", &bytes)
            .unwrap()
            .into_editor();
        editor
            .replace_file("/docs/readme.md", b"new".to_vec())
            .unwrap();

        let rewritten = editor.write_back().unwrap();
        let reopened = ZipArchiveDocument::from_bytes("release.zip", &rewritten).unwrap();
        let vfs = ArchiveVfs::from_document(reopened.into_document());

        assert_eq!(vfs.read("/docs/readme.md").unwrap(), b"new");
        assert_eq!(vfs.read("/docs/changelog.md").unwrap(), b"changes");
        assert_eq!(vfs.list("/docs").unwrap().len(), 2);
    }

    #[test]
    fn zip_archive_rejects_empty_and_hex_payloads() {
        let empty = ZipArchiveDocument::from_bytes("release.zip", b"").unwrap_err();
        let hex_tab_payload = b"/docs/readme.md\t6e6577\n";
        let hex = ZipArchiveDocument::from_bytes("release.zip", hex_tab_payload).unwrap_err();

        assert!(matches!(
            empty,
            ArchiveError::InvalidArchive(message) if message == "ZIP payload is empty"
        ));
        assert!(matches!(
            hex,
            ArchiveError::InvalidArchive(message) if message.contains("PK zip")
        ));
    }

    #[test]
    fn archive_reader_detects_common_archive_formats_from_name() {
        assert_eq!(
            ArchiveFormat::detect("release.zip").unwrap(),
            ArchiveFormat::Zip
        );
        assert_eq!(
            ArchiveFormat::detect("release.tar").unwrap(),
            ArchiveFormat::Tar
        );
        assert_eq!(
            ArchiveFormat::detect("release.tar.gz").unwrap(),
            ArchiveFormat::TarGz
        );
        assert_eq!(
            ArchiveFormat::detect("release.gz").unwrap(),
            ArchiveFormat::Gz
        );
        assert_eq!(
            ArchiveFormat::detect("release.7z").unwrap(),
            ArchiveFormat::SevenZip
        );
        assert!(ArchiveFormat::SevenZip.is_implemented());
        assert!(is_archive_path("pkg.zip"));
        assert!(is_archive_path("pkg.7z"));
    }

    #[test]
    fn archive_reader_opens_real_tar_and_seven_zip() {
        let document =
            ArchiveDocument::new("release.tar").with_file("/docs/readme.md", b"readme".to_vec());
        let tar_bytes = write_tar_fixture(&document);
        let opened = ArchiveReader::open_bytes("release.tar", &tar_bytes).unwrap();
        let vfs = ArchiveVfs::from_document(opened);

        assert_eq!(vfs.read("/docs/readme.md").unwrap(), b"readme");

        let seven_doc = ArchiveDocument::new("release.7z")
            .with_file("/docs/readme.md", b"hello 7z".to_vec())
            .with_file("/bin/app.exe", b"binary".to_vec());
        let seven_bytes = write_seven_zip_bytes(&seven_doc).unwrap();
        assert!(seven_bytes.starts_with(&[b'7', b'z', 0xBC, 0xAF, 0x27, 0x1C]));

        let opened_seven = ArchiveReader::open_bytes("release.7z", &seven_bytes).unwrap();
        let seven_vfs = ArchiveVfs::from_document(opened_seven);
        assert_eq!(seven_vfs.read("/docs/readme.md").unwrap(), b"hello 7z");
        assert_eq!(seven_vfs.list("/").unwrap().len(), 2);

        let invalid = ArchiveReader::open_bytes("release.7z", b"7z payload").unwrap_err();
        assert!(matches!(invalid, ArchiveError::InvalidArchive(_)));
    }

    #[test]
    fn compare_archives_classifies_same_different_and_orphans() {
        let left = ArchiveDocument::new("left.zip")
            .with_file("/same.txt", b"same".to_vec())
            .with_file("/changed.txt", b"old".to_vec())
            .with_file("/only-left.txt", b"left".to_vec());
        let right = ArchiveDocument::new("right.zip")
            .with_file("/same.txt", b"same".to_vec())
            .with_file("/changed.txt", b"new".to_vec())
            .with_file("/only-right.txt", b"right".to_vec());

        let rows = compare_archives(&left, &right);

        assert_eq!(
            rows.iter()
                .find(|row| row.path == "/changed.txt")
                .unwrap()
                .status,
            ArchiveCompareStatus::Different
        );
        assert_eq!(
            rows.iter()
                .find(|row| row.path == "/same.txt")
                .unwrap()
                .status,
            ArchiveCompareStatus::Same
        );
        assert_eq!(
            rows.iter()
                .find(|row| row.path == "/only-left.txt")
                .unwrap()
                .status,
            ArchiveCompareStatus::LeftOnly
        );
        assert_eq!(
            rows.iter()
                .find(|row| row.path == "/only-right.txt")
                .unwrap()
                .status,
            ArchiveCompareStatus::RightOnly
        );
    }

    #[test]
    fn archive_reader_rejects_unknown_extensions() {
        let error = ArchiveFormat::detect("release.rar").unwrap_err();

        assert!(matches!(
            error,
            ArchiveError::UnsupportedFormat(format) if format == "release.rar"
        ));
    }

    fn write_tar_fixture(document: &ArchiveDocument) -> Vec<u8> {
        let mut builder = tar::Builder::new(Cursor::new(Vec::new()));

        for (path, bytes) in &document.files {
            let mut header = tar::Header::new_gnu();
            header.set_size(bytes.len() as u64);
            header.set_cksum();
            builder
                .append_data(&mut header, path.trim_start_matches('/'), bytes.as_slice())
                .expect("tar entry should append");
        }

        builder
            .into_inner()
            .expect("tar should finish")
            .into_inner()
    }
}
