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

pub fn render_html_report(report: &UnifiedReport) -> String {
    let title = escape_html(&report.title);
    let mut html = String::new();

    html.push_str("<!doctype html><html lang=\"en\"><head><meta charset=\"utf-8\">");
    html.push_str("<title>");
    html.push_str(&title);
    html.push_str("</title>");
    html.push_str("<style>");
    html.push_str(
        "body{font-family:system-ui,sans-serif;margin:24px;color:#111827}\
         table{width:100%;border-collapse:collapse;margin-top:8px}\
         th,td{border:1px solid #d1d5db;padding:6px 8px;text-align:left}\
         th{background:#f3f4f6}.status-different{color:#b91c1c;font-weight:700}\
         .status-equal,.status-unchanged{color:#047857;font-weight:700}",
    );
    html.push_str("</style></head><body>");
    html.push_str("<h1>");
    html.push_str(&title);
    html.push_str("</h1>");
    html.push_str("<dl><dt>Generated At</dt><dd>");
    html.push_str(&escape_html(&report.metadata.generated_at));
    html.push_str("</dd>");
    push_optional_metadata(
        &mut html,
        "Left Source",
        report.metadata.left_source.as_deref(),
    );
    push_optional_metadata(
        &mut html,
        "Right Source",
        report.metadata.right_source.as_deref(),
    );
    html.push_str("</dl>");

    for section in &report.sections {
        html.push_str("<section><h2>");
        html.push_str(&escape_html(&section.title));
        html.push_str("</h2><table><thead><tr><th>Label</th><th>Left</th><th>Right</th><th>Status</th></tr></thead><tbody>");

        for row in &section.rows {
            html.push_str("<tr><td>");
            html.push_str(&escape_html(&row.label));
            html.push_str("</td><td>");
            html.push_str(&escape_html(row.left.as_deref().unwrap_or("")));
            html.push_str("</td><td>");
            html.push_str(&escape_html(row.right.as_deref().unwrap_or("")));
            html.push_str("</td><td class=\"");
            html.push_str(row_status_class(&row.status));
            html.push_str("\">");
            html.push_str(row_status_label(&row.status));
            html.push_str("</td></tr>");
        }

        html.push_str("</tbody></table></section>");
    }

    html.push_str("</body></html>");
    html
}

pub fn render_text_report(report: &UnifiedReport) -> String {
    let mut output = String::new();

    output.push_str(&report.title);
    output.push('\n');
    output.push_str(&"=".repeat(report.title.chars().count()));
    output.push('\n');
    output.push_str("Generated At: ");
    output.push_str(&report.metadata.generated_at);
    output.push('\n');
    push_optional_text_metadata(
        &mut output,
        "Left Source",
        report.metadata.left_source.as_deref(),
    );
    push_optional_text_metadata(
        &mut output,
        "Right Source",
        report.metadata.right_source.as_deref(),
    );

    for section in &report.sections {
        output.push('\n');
        output.push_str("== ");
        output.push_str(&section.title);
        output.push_str(" ==\n");

        for row in &section.rows {
            output.push('[');
            output.push_str(row_status_label(&row.status));
            output.push_str("] ");
            output.push_str(&row.label);
            push_optional_text_value(&mut output, "left", row.left.as_deref());
            push_optional_text_value(&mut output, "right", row.right.as_deref());
            output.push('\n');
        }
    }

    output
}

fn push_optional_metadata(html: &mut String, label: &str, value: Option<&str>) {
    if let Some(value) = value {
        html.push_str("<dt>");
        html.push_str(label);
        html.push_str("</dt><dd>");
        html.push_str(&escape_html(value));
        html.push_str("</dd>");
    }
}

fn push_optional_text_metadata(output: &mut String, label: &str, value: Option<&str>) {
    if let Some(value) = value {
        output.push_str(label);
        output.push_str(": ");
        output.push_str(value);
        output.push('\n');
    }
}

fn push_optional_text_value(output: &mut String, label: &str, value: Option<&str>) {
    if let Some(value) = value {
        output.push_str(" | ");
        output.push_str(label);
        output.push_str(": ");
        output.push_str(value);
    }
}

fn row_status_class(status: &ReportRowStatus) -> &'static str {
    match status {
        ReportRowStatus::Equal => "status-equal",
        ReportRowStatus::Different => "status-different",
        ReportRowStatus::Added => "status-added",
        ReportRowStatus::Removed => "status-removed",
        ReportRowStatus::Unchanged => "status-unchanged",
    }
}

fn row_status_label(status: &ReportRowStatus) -> &'static str {
    match status {
        ReportRowStatus::Equal => "equal",
        ReportRowStatus::Different => "different",
        ReportRowStatus::Added => "added",
        ReportRowStatus::Removed => "removed",
        ReportRowStatus::Unchanged => "unchanged",
    }
}

fn escape_html(value: &str) -> String {
    value
        .replace('&', "&amp;")
        .replace('<', "&lt;")
        .replace('>', "&gt;")
        .replace('"', "&quot;")
        .replace('\'', "&#39;")
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

    #[test]
    fn renders_html_report_with_metadata_differences_context_and_escaping() {
        let report = UnifiedReport::new(
            ReportKind::Text,
            "Left <Right>",
            ReportMetadata {
                generated_at: "2026-06-27T03:00:00Z".to_owned(),
                left_source: Some("left.txt".to_owned()),
                right_source: Some("right.txt".to_owned()),
            },
        )
        .with_section(ReportSection {
            kind: ReportSectionKind::Differences,
            title: "Differences".to_owned(),
            rows: vec![ReportRow {
                label: "Line 12".to_owned(),
                left: Some("<old>".to_owned()),
                right: Some("new".to_owned()),
                status: ReportRowStatus::Different,
            }],
        })
        .with_section(ReportSection {
            kind: ReportSectionKind::Context,
            title: "Context".to_owned(),
            rows: vec![ReportRow {
                label: "Around line 12".to_owned(),
                left: Some("before".to_owned()),
                right: Some("after".to_owned()),
                status: ReportRowStatus::Unchanged,
            }],
        });

        let html = render_html_report(&report);

        assert!(html.contains("<title>Left &lt;Right&gt;</title>"));
        assert!(html.contains("2026-06-27T03:00:00Z"));
        assert!(html.contains("Differences"));
        assert!(html.contains("Context"));
        assert!(html.contains("&lt;old&gt;"));
        assert!(!html.contains("<old>"));
    }

    #[test]
    fn renders_plain_text_report_for_terminal_and_logs() {
        let report = UnifiedReport::new(
            ReportKind::Folder,
            "Folder Report",
            ReportMetadata {
                generated_at: "2026-06-27T03:10:00Z".to_owned(),
                left_source: Some("left/".to_owned()),
                right_source: Some("right/".to_owned()),
            },
        )
        .with_section(ReportSection {
            kind: ReportSectionKind::Summary,
            title: "Summary".to_owned(),
            rows: vec![ReportRow {
                label: "Changed files".to_owned(),
                left: Some("2".to_owned()),
                right: Some("3".to_owned()),
                status: ReportRowStatus::Different,
            }],
        });

        let text = render_text_report(&report);

        assert!(text.contains("Folder Report"));
        assert!(text.contains("Generated At: 2026-06-27T03:10:00Z"));
        assert!(text.contains("Left Source: left/"));
        assert!(text.contains("== Summary =="));
        assert!(text.contains("[different] Changed files | left: 2 | right: 3"));
        assert!(!text.contains("<table"));
    }
}
