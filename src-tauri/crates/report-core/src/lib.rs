use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UnifiedReport {
    pub kind: ReportKind,
    pub title: String,
    pub metadata: ReportMetadata,
    pub sections: Vec<ReportSection>,
    pub artifacts: Vec<ReportArtifact>,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum ReportKind {
    Text,
    Folder,
    Table,
    Image,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ReportMetadata {
    pub generated_at: String,
    pub left_source: Option<String>,
    pub right_source: Option<String>,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ReportSection {
    pub kind: ReportSectionKind,
    pub title: String,
    pub rows: Vec<ReportRow>,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum ReportSectionKind {
    Summary,
    Differences,
    Metadata,
    Context,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ReportRow {
    pub label: String,
    pub left: Option<String>,
    pub right: Option<String>,
    pub status: ReportRowStatus,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum ReportRowStatus {
    Equal,
    Different,
    Added,
    Removed,
    Unchanged,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ReportArtifact {
    pub kind: ReportArtifactKind,
    pub path: String,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum ReportArtifactKind {
    Preview,
    Attachment,
}

impl UnifiedReport {
    pub fn new(kind: ReportKind, title: impl Into<String>, metadata: ReportMetadata) -> Self {
        Self {
            kind,
            title: title.into(),
            metadata,
            sections: Vec::new(),
            artifacts: Vec::new(),
        }
    }

    pub fn with_section(mut self, section: ReportSection) -> Self {
        self.sections.push(section);
        self
    }

    pub fn with_artifact(mut self, artifact: ReportArtifact) -> Self {
        self.artifacts.push(artifact);
        self
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn builds_unified_report_with_sections_and_artifacts() {
        let report = UnifiedReport::new(
            ReportKind::Text,
            "Left vs Right",
            ReportMetadata {
                generated_at: "2026-06-27T03:00:00Z".to_owned(),
                left_source: Some("left.txt".to_owned()),
                right_source: Some("right.txt".to_owned()),
            },
        )
        .with_section(ReportSection {
            kind: ReportSectionKind::Summary,
            title: "Summary".to_owned(),
            rows: vec![ReportRow {
                label: "Modified".to_owned(),
                left: Some("1".to_owned()),
                right: Some("1".to_owned()),
                status: ReportRowStatus::Different,
            }],
        })
        .with_artifact(ReportArtifact {
            kind: ReportArtifactKind::Preview,
            path: "reports/preview.png".to_owned(),
        });

        assert_eq!(report.kind, ReportKind::Text);
        assert_eq!(report.sections[0].kind, ReportSectionKind::Summary);
        assert_eq!(
            report.sections[0].rows[0].status,
            ReportRowStatus::Different
        );
        assert_eq!(report.artifacts[0].kind, ReportArtifactKind::Preview);
    }
}
