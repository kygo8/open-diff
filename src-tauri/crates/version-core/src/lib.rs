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

fn increment_statistics(statistics: &mut VersionDiffStatistics, status: VersionFieldStatus) {
    match status {
        VersionFieldStatus::Added => statistics.added += 1,
        VersionFieldStatus::Removed => statistics.removed += 1,
        VersionFieldStatus::Modified => statistics.modified += 1,
        VersionFieldStatus::Unchanged => statistics.unchanged += 1,
    }
}

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
}
