use serde::{Deserialize, Serialize};
use std::collections::BTreeMap;
use std::fmt;

#[derive(Debug, Clone, PartialEq, Eq, PartialOrd, Ord, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct VersionNumber {
    pub major: u16,
    pub minor: u16,
    pub patch: u16,
    pub build: u16,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct VersionDocument {
    pub name: String,
    pub fixed_info: Option<VersionFixedInfo>,
    pub strings: Vec<VersionString>,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct VersionFixedInfo {
    pub file_version: VersionNumber,
    pub product_version: VersionNumber,
    pub file_flags: Vec<VersionFileFlag>,
    pub file_type: VersionFileType,
    pub os: VersionTargetOs,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum VersionFileFlag {
    Debug,
    Patched,
    Prerelease,
    PrivateBuild,
    SpecialBuild,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum VersionFileType {
    Application,
    DynamicLibrary,
    Driver,
    Font,
    Unknown,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum VersionTargetOs {
    Windows16,
    Windows32,
    Dos,
    Os2,
    Unknown,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct VersionString {
    pub field: String,
    pub value: String,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct VersionDiff {
    pub fields: Vec<VersionFieldDiff>,
    pub statistics: VersionDiffStatistics,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct VersionFieldDiff {
    pub field: String,
    pub left: Option<String>,
    pub right: Option<String>,
    pub status: VersionFieldStatus,
}

#[derive(Debug, Clone, Default, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct VersionDiffStatistics {
    pub added: u32,
    pub removed: u32,
    pub modified: u32,
    pub unchanged: u32,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum VersionFieldStatus {
    Added,
    Removed,
    Modified,
    Unchanged,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub enum VersionReadError {
    Backend(String),
    InvalidOutput(String),
    VersionInfoNotFound(String),
}

impl VersionNumber {
    pub fn new(major: u16, minor: u16, patch: u16, build: u16) -> Self {
        Self {
            major,
            minor,
            patch,
            build,
        }
    }
}

impl fmt::Display for VersionNumber {
    fn fmt(&self, formatter: &mut fmt::Formatter<'_>) -> fmt::Result {
        write!(
            formatter,
            "{}.{}.{}.{}",
            self.major, self.minor, self.patch, self.build
        )
    }
}

impl VersionDocument {
    pub fn new(name: impl Into<String>) -> Self {
        Self {
            name: name.into(),
            fixed_info: None,
            strings: Vec::new(),
        }
    }

    pub fn with_fixed_info(mut self, fixed_info: VersionFixedInfo) -> Self {
        self.fixed_info = Some(fixed_info);
        self
    }

    pub fn with_string(mut self, field: impl Into<String>, value: impl Into<String>) -> Self {
        self.strings.push(VersionString {
            field: field.into(),
            value: value.into(),
        });
        self
    }

    pub fn string_value(&self, field: &str) -> Option<&str> {
        self.strings
            .iter()
            .find(|item| item.field.eq_ignore_ascii_case(field))
            .map(|item| item.value.as_str())
    }
}

impl VersionDiff {
    pub fn field(&self, field: &str) -> Option<&VersionFieldDiff> {
        self.fields
            .iter()
            .find(|candidate| candidate.field.eq_ignore_ascii_case(field))
    }
}

pub fn compare_version_documents(left: &VersionDocument, right: &VersionDocument) -> VersionDiff {
    let left_fields = version_fields(left);
    let right_fields = version_fields(right);
    let mut names = left_fields
        .keys()
        .chain(right_fields.keys())
        .collect::<Vec<_>>();

    names.sort();
    names.dedup();

    let mut statistics = VersionDiffStatistics::default();
    let fields = names
        .into_iter()
        .map(|field| {
            let left = left_fields.get(field).cloned();
            let right = right_fields.get(field).cloned();
            let status = match (&left, &right) {
                (None, Some(_)) => VersionFieldStatus::Added,
                (Some(_), None) => VersionFieldStatus::Removed,
                (Some(left), Some(right)) if left == right => VersionFieldStatus::Unchanged,
                (Some(_), Some(_)) => VersionFieldStatus::Modified,
                (None, None) => VersionFieldStatus::Unchanged,
            };

            increment_statistics(&mut statistics, status);

            VersionFieldDiff {
                field: field.clone(),
                left,
                right,
                status,
            }
        })
        .collect();

    VersionDiff { fields, statistics }
}

pub trait NativeVersionInfoReader {
    fn read_version_info(&self, path: &str) -> Result<Option<VersionDocument>, VersionReadError>;
}

pub struct NativeVersionLoader;

impl NativeVersionLoader {
    pub fn load_file(
        reader: &impl NativeVersionInfoReader,
        path: impl AsRef<str>,
    ) -> Result<VersionDocument, VersionReadError> {
        let path = normalize_path(path.as_ref());

        reader
            .read_version_info(&path)?
            .ok_or(VersionReadError::VersionInfoNotFound(path))
    }
}

#[derive(Debug, Clone, Default)]
pub struct MemoryVersionInfoReader {
    documents: BTreeMap<String, VersionDocument>,
}

impl MemoryVersionInfoReader {
    pub fn new() -> Self {
        Self::default()
    }

    pub fn with_document(mut self, path: impl AsRef<str>, document: VersionDocument) -> Self {
        self.documents
            .insert(normalize_path(path.as_ref()), document);
        self
    }
}

impl NativeVersionInfoReader for MemoryVersionInfoReader {
    fn read_version_info(&self, path: &str) -> Result<Option<VersionDocument>, VersionReadError> {
        Ok(self.documents.get(&normalize_path(path)).cloned())
    }
}

#[cfg(windows)]
#[derive(Debug, Clone, Default)]
pub struct WindowsVersionInfoReader;

#[cfg(windows)]
impl NativeVersionInfoReader for WindowsVersionInfoReader {
    fn read_version_info(&self, path: &str) -> Result<Option<VersionDocument>, VersionReadError> {
        let output = std::process::Command::new("pwsh")
            .args([
                "-NoLogo",
                "-NoProfile",
                "-Command",
                &format!(
                    "$v=(Get-Item -LiteralPath {}).VersionInfo; if ($null -eq $v) {{ exit 2 }}; [Console]::OutputEncoding=[Text.Encoding]::UTF8; @($v.FileVersion,$v.ProductVersion,$v.CompanyName,$v.FileDescription,$v.ProductName) -join \"`n\"",
                    powershell_quote(path)
                ),
            ])
            .output()
            .map_err(|error| VersionReadError::Backend(error.to_string()))?;

        if output.status.code() == Some(2) {
            return Ok(None);
        }

        if !output.status.success() {
            return Err(VersionReadError::Backend(
                String::from_utf8_lossy(&output.stderr).to_string(),
            ));
        }

        parse_powershell_version_info(path, &String::from_utf8_lossy(&output.stdout)).map(Some)
    }
}

fn version_fields(document: &VersionDocument) -> BTreeMap<String, String> {
    let mut fields = BTreeMap::new();

    if let Some(fixed_info) = &document.fixed_info {
        fields.insert(
            "FileVersion".to_owned(),
            fixed_info.file_version.to_string(),
        );
        fields.insert(
            "ProductVersion".to_owned(),
            fixed_info.product_version.to_string(),
        );
    }

    for item in &document.strings {
        fields.insert(item.field.clone(), item.value.clone());
    }

    fields
}

fn normalize_path(path: &str) -> String {
    path.replace('\\', "/")
}

#[cfg(windows)]
fn powershell_quote(value: &str) -> String {
    format!("'{}'", value.replace('\'', "''"))
}

#[cfg(windows)]
fn parse_powershell_version_info(
    path: &str,
    output: &str,
) -> Result<VersionDocument, VersionReadError> {
    let lines = output.lines().collect::<Vec<_>>();

    if lines.len() < 5 {
        return Err(VersionReadError::InvalidOutput(
            "PowerShell VersionInfo output is incomplete".to_owned(),
        ));
    }

    let name = normalize_path(path)
        .rsplit('/')
        .next()
        .filter(|item| !item.is_empty())
        .unwrap_or(path)
        .to_owned();
    let mut document = VersionDocument::new(name);
    let file_version =
        parse_version_number(lines[0]).unwrap_or_else(|| VersionNumber::new(0, 0, 0, 0));
    let product_version =
        parse_version_number(lines[1]).unwrap_or_else(|| VersionNumber::new(0, 0, 0, 0));

    document = document.with_fixed_info(VersionFixedInfo {
        file_version,
        product_version,
        file_flags: Vec::new(),
        file_type: if path.to_ascii_lowercase().ends_with(".dll") {
            VersionFileType::DynamicLibrary
        } else {
            VersionFileType::Application
        },
        os: VersionTargetOs::Windows32,
    });

    for (field, value) in [
        ("CompanyName", lines[2]),
        ("FileDescription", lines[3]),
        ("ProductName", lines[4]),
    ] {
        if !value.trim().is_empty() {
            document = document.with_string(field, value.trim());
        }
    }

    Ok(document)
}

#[cfg(windows)]
fn parse_version_number(value: &str) -> Option<VersionNumber> {
    let mut parts = value
        .split(|character: char| !character.is_ascii_digit())
        .filter(|part| !part.is_empty())
        .filter_map(|part| part.parse::<u16>().ok());

    Some(VersionNumber::new(
        parts.next()?,
        parts.next().unwrap_or(0),
        parts.next().unwrap_or(0),
        parts.next().unwrap_or(0),
    ))
}

fn increment_statistics(statistics: &mut VersionDiffStatistics, status: VersionFieldStatus) {
    match status {
        VersionFieldStatus::Added => statistics.added += 1,
        VersionFieldStatus::Removed => statistics.removed += 1,
        VersionFieldStatus::Modified => statistics.modified += 1,
        VersionFieldStatus::Unchanged => statistics.unchanged += 1,
    }
}

impl fmt::Display for VersionReadError {
    fn fmt(&self, formatter: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            Self::Backend(message) => write!(formatter, "{message}"),
            Self::InvalidOutput(message) => write!(formatter, "{message}"),
            Self::VersionInfoNotFound(path) => write!(formatter, "version info not found: {path}"),
        }
    }
}

impl std::error::Error for VersionReadError {}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn version_document_stores_fixed_file_info_and_string_fields() {
        let document = VersionDocument::new("app.exe")
            .with_fixed_info(VersionFixedInfo {
                file_version: VersionNumber::new(1, 2, 3, 4),
                product_version: VersionNumber::new(1, 2, 0, 0),
                file_flags: vec![VersionFileFlag::Debug],
                file_type: VersionFileType::Application,
                os: VersionTargetOs::Windows32,
            })
            .with_string("CompanyName", "Open Diff")
            .with_string("FileDescription", "Desktop comparison app");

        assert_eq!(document.name, "app.exe");
        assert_eq!(
            document
                .fixed_info
                .as_ref()
                .expect("fixed info exists")
                .file_version,
            VersionNumber::new(1, 2, 3, 4)
        );
        assert_eq!(document.string_value("CompanyName"), Some("Open Diff"));
    }

    #[test]
    fn version_comparer_aligns_fields_and_reports_statuses() {
        let left = VersionDocument::new("left.dll")
            .with_fixed_info(VersionFixedInfo {
                file_version: VersionNumber::new(1, 0, 0, 0),
                product_version: VersionNumber::new(1, 0, 0, 0),
                file_flags: Vec::new(),
                file_type: VersionFileType::DynamicLibrary,
                os: VersionTargetOs::Windows32,
            })
            .with_string("CompanyName", "Open Diff")
            .with_string("FileDescription", "Plugin")
            .with_string("PrivateBuild", "local");
        let right = VersionDocument::new("right.dll")
            .with_fixed_info(VersionFixedInfo {
                file_version: VersionNumber::new(1, 1, 0, 0),
                product_version: VersionNumber::new(1, 0, 0, 0),
                file_flags: Vec::new(),
                file_type: VersionFileType::DynamicLibrary,
                os: VersionTargetOs::Windows32,
            })
            .with_string("CompanyName", "Open Diff")
            .with_string("FileDescription", "Plugin")
            .with_string("ProductName", "Open Diff Extensions");

        let diff = compare_version_documents(&left, &right);

        assert_eq!(diff.statistics.added, 1);
        assert_eq!(diff.statistics.removed, 1);
        assert_eq!(diff.statistics.modified, 1);
        assert_eq!(diff.statistics.unchanged, 3);
        assert_eq!(
            diff.field("FileVersion")
                .expect("file version exists")
                .status,
            VersionFieldStatus::Modified
        );
        assert_eq!(
            diff.field("CompanyName").expect("company exists").status,
            VersionFieldStatus::Unchanged
        );
        assert_eq!(
            diff.field("PrivateBuild")
                .expect("private build exists")
                .status,
            VersionFieldStatus::Removed
        );
        assert_eq!(
            diff.field("ProductName")
                .expect("product name exists")
                .status,
            VersionFieldStatus::Added
        );
    }

    #[test]
    fn native_version_loader_builds_document_from_reader() {
        let reader = MemoryVersionInfoReader::new().with_document(
            "C:/Apps/OpenDiff/app.exe",
            VersionDocument::new("app.exe")
                .with_fixed_info(VersionFixedInfo {
                    file_version: VersionNumber::new(2, 4, 0, 9),
                    product_version: VersionNumber::new(2, 4, 0, 0),
                    file_flags: Vec::new(),
                    file_type: VersionFileType::Application,
                    os: VersionTargetOs::Windows32,
                })
                .with_string("CompanyName", "Open Diff")
                .with_string("ProductName", "Open Diff"),
        );

        let document = NativeVersionLoader::load_file(&reader, "C:/Apps/OpenDiff/app.exe")
            .expect("version info should load");

        assert_eq!(document.name, "app.exe");
        assert_eq!(
            document
                .fixed_info
                .as_ref()
                .expect("fixed info exists")
                .file_version,
            VersionNumber::new(2, 4, 0, 9)
        );
        assert_eq!(document.string_value("ProductName"), Some("Open Diff"));
    }

    #[test]
    fn native_version_loader_reports_missing_version_resources() {
        let reader = MemoryVersionInfoReader::new();

        let error = NativeVersionLoader::load_file(&reader, "C:/Apps/OpenDiff/plain.bin")
            .expect_err("missing resource should be reported");

        assert_eq!(
            error,
            VersionReadError::VersionInfoNotFound("C:/Apps/OpenDiff/plain.bin".to_owned())
        );
    }
}
