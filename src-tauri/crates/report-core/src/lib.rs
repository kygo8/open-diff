use logging_core::{LogDomain, LogStatus, StructuredLogEvent};
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

/// Two-pane HTML report with left/right columns instead of a dense table.
pub fn render_side_by_side_html_report(report: &UnifiedReport) -> String {
    let title = escape_html(&report.title);
    let mut html = String::new();
    html.push_str("<!doctype html><html lang=\"en\"><head><meta charset=\"utf-8\">");
    html.push_str("<title>");
    html.push_str(&title);
    html.push_str("</title>");
    html.push_str("<style>");
    html.push_str(
        "body{font-family:system-ui,sans-serif;margin:24px;color:#111827}\
         .meta{margin:0 0 16px;color:#4b5563}\
         .panes{display:grid;grid-template-columns:1fr 1fr;gap:12px}\
         .pane{border:1px solid #d1d5db;border-radius:8px;overflow:hidden;background:#fff}\
         .pane h2{margin:0;padding:8px 12px;background:#f3f4f6;font-size:14px}\
         .row{display:grid;grid-template-columns:88px 1fr;gap:8px;padding:6px 10px;border-top:1px solid #e5e7eb;font-family:ui-monospace,monospace;font-size:12px;white-space:pre-wrap}\
         .status-added{background:#ecfdf5}.status-removed{background:#fef2f2}.status-different{background:#fff7ed}\
         .status{color:#6b7280;font-weight:700}",
    );
    html.push_str("</style></head><body>");
    html.push_str("<h1>");
    html.push_str(&title);
    html.push_str("</h1><p class=\"meta\">");
    html.push_str(&escape_html(&report.metadata.generated_at));
    if let Some(left) = report.metadata.left_source.as_deref() {
        html.push_str(" · left: ");
        html.push_str(&escape_html(left));
    }
    if let Some(right) = report.metadata.right_source.as_deref() {
        html.push_str(" · right: ");
        html.push_str(&escape_html(right));
    }
    html.push_str("</p>");

    for section in &report.sections {
        html.push_str("<section><h2>");
        html.push_str(&escape_html(&section.title));
        html.push_str("</h2><div class=\"panes\"><div class=\"pane\"><h2>Left</h2>");
        for row in &section.rows {
            html.push_str("<div class=\"row ");
            html.push_str(row_status_class(&row.status));
            html.push_str("\"><span class=\"status\">");
            html.push_str(&escape_html(&row.label));
            html.push_str("</span><span>");
            html.push_str(&escape_html(row.left.as_deref().unwrap_or("")));
            html.push_str("</span></div>");
        }
        html.push_str("</div><div class=\"pane\"><h2>Right</h2>");
        for row in &section.rows {
            html.push_str("<div class=\"row ");
            html.push_str(row_status_class(&row.status));
            html.push_str("\"><span class=\"status\">");
            html.push_str(&escape_html(&row.label));
            html.push_str("</span><span>");
            html.push_str(&escape_html(row.right.as_deref().unwrap_or("")));
            html.push_str("</span></div>");
        }
        html.push_str("</div></div></section>");
    }

    html.push_str("</body></html>");
    html
}

pub fn build_report_render_log_event(report: &UnifiedReport, format: &str) -> StructuredLogEvent {
    StructuredLogEvent::new(
        LogDomain::Report,
        format!("render{}", title_case_ascii(format)),
        LogStatus::Succeeded,
        format!("Rendered {format} report {}", report.title),
    )
    .with_detail("title", &report.title)
    .with_detail("kind", report_kind_label(&report.kind))
    .with_detail("format", format)
    .with_detail("sectionCount", report.sections.len())
    .with_detail("artifactCount", report.artifacts.len())
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

pub fn render_csv_report(report: &UnifiedReport) -> String {
    let mut output = String::from("section,label,left,right,status\n");

    output.push_str(&csv_row(
        "metadata",
        "title",
        Some(&report.title),
        None,
        "unchanged",
    ));
    output.push_str(&csv_row(
        "metadata",
        "generatedAt",
        Some(&report.metadata.generated_at),
        None,
        "unchanged",
    ));
    if let Some(left) = report.metadata.left_source.as_deref() {
        output.push_str(&csv_row(
            "metadata",
            "leftSource",
            Some(left),
            None,
            "unchanged",
        ));
    }
    if let Some(right) = report.metadata.right_source.as_deref() {
        output.push_str(&csv_row(
            "metadata",
            "rightSource",
            Some(right),
            None,
            "unchanged",
        ));
    }

    for section in &report.sections {
        let section_name = report_section_kind_label(&section.kind);
        for row in &section.rows {
            output.push_str(&csv_row(
                section_name,
                &row.label,
                row.left.as_deref(),
                row.right.as_deref(),
                row_status_label(&row.status),
            ));
        }
    }

    output
}

fn csv_row(
    section: &str,
    label: &str,
    left: Option<&str>,
    right: Option<&str>,
    status: &str,
) -> String {
    format!(
        "{},{},{},{},{}\n",
        escape_csv(section),
        escape_csv(label),
        escape_csv(left.unwrap_or("")),
        escape_csv(right.unwrap_or("")),
        escape_csv(status),
    )
}

fn escape_csv(value: &str) -> String {
    if value.contains(',') || value.contains('"') || value.contains('\n') || value.contains('\r') {
        format!("\"{}\"", value.replace('"', "\"\""))
    } else {
        value.to_owned()
    }
}

pub fn render_markdown_report(report: &UnifiedReport) -> String {
    let mut output = String::new();
    output.push_str("# ");
    output.push_str(&report.title);
    output.push_str("\n\n");
    output.push_str("- Generated At: ");
    output.push_str(&report.metadata.generated_at);
    output.push('\n');
    if let Some(left) = report.metadata.left_source.as_deref() {
        output.push_str("- Left Source: ");
        output.push_str(left);
        output.push('\n');
    }
    if let Some(right) = report.metadata.right_source.as_deref() {
        output.push_str("- Right Source: ");
        output.push_str(right);
        output.push('\n');
    }
    output.push('\n');

    for section in &report.sections {
        output.push_str("## ");
        output.push_str(&section.title);
        output.push_str("\n\n");
        output.push_str("| Label | Left | Right | Status |\n");
        output.push_str("| --- | --- | --- | --- |\n");
        for row in &section.rows {
            output.push_str("| ");
            output.push_str(&escape_markdown_cell(&row.label));
            output.push_str(" | ");
            output.push_str(&escape_markdown_cell(row.left.as_deref().unwrap_or("")));
            output.push_str(" | ");
            output.push_str(&escape_markdown_cell(row.right.as_deref().unwrap_or("")));
            output.push_str(" | ");
            output.push_str(row_status_label(&row.status));
            output.push_str(" |\n");
        }
        output.push('\n');
    }

    output
}

fn escape_markdown_cell(value: &str) -> String {
    value
        .replace('|', "\\|")
        .replace('\n', "<br>")
        .replace('\r', "")
}

pub fn render_tsv_report(report: &UnifiedReport) -> String {
    let mut output = String::from("section\tlabel\tleft\tright\tstatus\n");

    output.push_str(&tsv_row(
        "metadata",
        "title",
        Some(&report.title),
        None,
        "unchanged",
    ));
    output.push_str(&tsv_row(
        "metadata",
        "generatedAt",
        Some(&report.metadata.generated_at),
        None,
        "unchanged",
    ));
    if let Some(left) = report.metadata.left_source.as_deref() {
        output.push_str(&tsv_row(
            "metadata",
            "leftSource",
            Some(left),
            None,
            "unchanged",
        ));
    }
    if let Some(right) = report.metadata.right_source.as_deref() {
        output.push_str(&tsv_row(
            "metadata",
            "rightSource",
            Some(right),
            None,
            "unchanged",
        ));
    }

    for section in &report.sections {
        let section_name = report_section_kind_label(&section.kind);
        for row in &section.rows {
            output.push_str(&tsv_row(
                section_name,
                &row.label,
                row.left.as_deref(),
                row.right.as_deref(),
                row_status_label(&row.status),
            ));
        }
    }

    output
}

fn tsv_row(
    section: &str,
    label: &str,
    left: Option<&str>,
    right: Option<&str>,
    status: &str,
) -> String {
    format!(
        "{}\t{}\t{}\t{}\t{}\n",
        escape_tsv(section),
        escape_tsv(label),
        escape_tsv(left.unwrap_or("")),
        escape_tsv(right.unwrap_or("")),
        escape_tsv(status),
    )
}

fn escape_tsv(value: &str) -> String {
    value.replace(['\t', '\n'], " ").replace('\r', "")
}

pub fn render_yaml_report(report: &UnifiedReport) -> String {
    let mut output = String::new();
    output.push_str("title: ");
    output.push_str(&yaml_scalar(&report.title));
    output.push('\n');
    output.push_str("kind: ");
    output.push_str(&yaml_scalar(report_kind_label(&report.kind)));
    output.push('\n');
    output.push_str("metadata:\n");
    output.push_str("  generatedAt: ");
    output.push_str(&yaml_scalar(&report.metadata.generated_at));
    output.push('\n');
    if let Some(left) = report.metadata.left_source.as_deref() {
        output.push_str("  leftSource: ");
        output.push_str(&yaml_scalar(left));
        output.push('\n');
    }
    if let Some(right) = report.metadata.right_source.as_deref() {
        output.push_str("  rightSource: ");
        output.push_str(&yaml_scalar(right));
        output.push('\n');
    }
    output.push_str("sections:\n");
    for section in &report.sections {
        output.push_str("- title: ");
        output.push_str(&yaml_scalar(&section.title));
        output.push('\n');
        output.push_str("  kind: ");
        output.push_str(&yaml_scalar(report_section_kind_label(&section.kind)));
        output.push('\n');
        output.push_str("  rows:\n");
        for row in &section.rows {
            output.push_str("  - label: ");
            output.push_str(&yaml_scalar(&row.label));
            output.push('\n');
            output.push_str("    left: ");
            output.push_str(&yaml_scalar(row.left.as_deref().unwrap_or("")));
            output.push('\n');
            output.push_str("    right: ");
            output.push_str(&yaml_scalar(row.right.as_deref().unwrap_or("")));
            output.push('\n');
            output.push_str("    status: ");
            output.push_str(&yaml_scalar(row_status_label(&row.status)));
            output.push('\n');
        }
    }
    output
}

fn yaml_scalar(value: &str) -> String {
    if value.is_empty() {
        return "\"\"".to_owned();
    }
    let needs_quotes = value.chars().any(|ch| {
        ch.is_whitespace()
            || matches!(
                ch,
                ':' | '#'
                    | '{'
                    | '}'
                    | '['
                    | ']'
                    | ','
                    | '&'
                    | '*'
                    | '!'
                    | '|'
                    | '>'
                    | '\''
                    | '"'
                    | '%'
            )
    });
    if needs_quotes {
        format!("\"{}\"", value.replace('\\', "\\\\").replace('"', "\\\""))
    } else {
        value.to_owned()
    }
}

pub fn render_json_report(report: &UnifiedReport) -> Result<String, serde_json::Error> {
    serde_json::to_string_pretty(report)
}

pub fn render_xml_report(report: &UnifiedReport) -> String {
    let mut xml = String::new();

    xml.push_str("<?xml version=\"1.0\" encoding=\"UTF-8\"?>");
    xml.push_str("<report kind=\"");
    xml.push_str(report_kind_label(&report.kind));
    xml.push_str("\" title=\"");
    xml.push_str(&escape_xml(&report.title));
    xml.push_str("\">");
    xml.push_str("<metadata><generatedAt>");
    xml.push_str(&escape_xml(&report.metadata.generated_at));
    xml.push_str("</generatedAt>");
    push_optional_xml_value(
        &mut xml,
        "leftSource",
        report.metadata.left_source.as_deref(),
    );
    push_optional_xml_value(
        &mut xml,
        "rightSource",
        report.metadata.right_source.as_deref(),
    );
    xml.push_str("</metadata><sections>");

    for section in &report.sections {
        xml.push_str("<section kind=\"");
        xml.push_str(report_section_kind_label(&section.kind));
        xml.push_str("\" title=\"");
        xml.push_str(&escape_xml(&section.title));
        xml.push_str("\">");

        for row in &section.rows {
            xml.push_str("<row status=\"");
            xml.push_str(row_status_label(&row.status));
            xml.push_str("\"><label>");
            xml.push_str(&escape_xml(&row.label));
            xml.push_str("</label>");
            push_optional_xml_value(&mut xml, "left", row.left.as_deref());
            push_optional_xml_value(&mut xml, "right", row.right.as_deref());
            xml.push_str("</row>");
        }

        xml.push_str("</section>");
    }

    xml.push_str("</sections></report>");
    xml
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

fn push_optional_xml_value(xml: &mut String, element: &str, value: Option<&str>) {
    if let Some(value) = value {
        xml.push('<');
        xml.push_str(element);
        xml.push('>');
        xml.push_str(&escape_xml(value));
        xml.push_str("</");
        xml.push_str(element);
        xml.push('>');
    }
}

fn report_kind_label(kind: &ReportKind) -> &'static str {
    match kind {
        ReportKind::Text => "text",
        ReportKind::Folder => "folder",
        ReportKind::Table => "table",
        ReportKind::Image => "image",
    }
}

fn title_case_ascii(value: &str) -> String {
    let mut characters = value.chars();
    let Some(first) = characters.next() else {
        return String::new();
    };

    format!("{}{}", first.to_ascii_uppercase(), characters.as_str())
}

fn report_section_kind_label(kind: &ReportSectionKind) -> &'static str {
    match kind {
        ReportSectionKind::Summary => "summary",
        ReportSectionKind::Differences => "differences",
        ReportSectionKind::Metadata => "metadata",
        ReportSectionKind::Context => "context",
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

fn escape_xml(value: &str) -> String {
    value
        .replace('&', "&amp;")
        .replace('<', "&lt;")
        .replace('>', "&gt;")
        .replace('"', "&quot;")
        .replace('\'', "&apos;")
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
    fn renders_side_by_side_html_report_with_two_panes() {
        let report = UnifiedReport::new(
            ReportKind::Text,
            "Left vs Right",
            ReportMetadata {
                generated_at: "2026-09-14T12:00:00Z".to_owned(),
                left_source: Some("left.txt".to_owned()),
                right_source: Some("right.txt".to_owned()),
            },
        )
        .with_section(ReportSection {
            kind: ReportSectionKind::Differences,
            title: "Differences".to_owned(),
            rows: vec![ReportRow {
                label: "L1 / R1".to_owned(),
                left: Some("alpha".to_owned()),
                right: Some("beta".to_owned()),
                status: ReportRowStatus::Different,
            }],
        });

        let html = render_side_by_side_html_report(&report);
        assert!(html.contains("class=\"panes\""));
        assert!(html.contains("alpha"));
        assert!(html.contains("beta"));
        assert!(html.contains("left.txt"));
        assert!(html.contains("right.txt"));
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

    #[test]
    fn renders_json_and_xml_structured_reports() {
        let report = UnifiedReport::new(
            ReportKind::Table,
            "Table & Data",
            ReportMetadata {
                generated_at: "2026-06-27T03:20:00Z".to_owned(),
                left_source: Some("left.csv".to_owned()),
                right_source: Some("right.csv".to_owned()),
            },
        )
        .with_section(ReportSection {
            kind: ReportSectionKind::Differences,
            title: "Rows".to_owned(),
            rows: vec![ReportRow {
                label: "id=1".to_owned(),
                left: Some("A&B".to_owned()),
                right: Some("A<C".to_owned()),
                status: ReportRowStatus::Different,
            }],
        });

        let json = render_json_report(&report).expect("json should render");
        let parsed: serde_json::Value = serde_json::from_str(&json).expect("json should parse");
        assert_eq!(parsed["kind"], "table");
        assert_eq!(parsed["metadata"]["leftSource"], "left.csv");
        assert_eq!(parsed["sections"][0]["rows"][0]["status"], "different");

        let xml = render_xml_report(&report);
        assert!(xml.starts_with("<?xml version=\"1.0\" encoding=\"UTF-8\"?>"));
        assert!(xml.contains("<report kind=\"table\" title=\"Table &amp; Data\">"));
        assert!(xml.contains("<section kind=\"differences\" title=\"Rows\">"));
        assert!(xml.contains("<left>A&amp;B</left>"));
        assert!(xml.contains("<right>A&lt;C</right>"));
    }

    #[test]
    fn renders_csv_report_with_section_rows_and_escaping() {
        let report = UnifiedReport::new(
            ReportKind::Folder,
            "Folder, Report",
            ReportMetadata {
                generated_at: "2026-06-27T03:30:00Z".to_owned(),
                left_source: Some("left/".to_owned()),
                right_source: Some("right/".to_owned()),
            },
        )
        .with_section(ReportSection {
            kind: ReportSectionKind::Differences,
            title: "Paths".to_owned(),
            rows: vec![ReportRow {
                label: "notes,md".to_owned(),
                left: Some("old \"quote\"".to_owned()),
                right: Some("new".to_owned()),
                status: ReportRowStatus::Different,
            }],
        });

        let csv = render_csv_report(&report);

        assert!(csv.starts_with("section,label,left,right,status\n"));
        assert!(csv.contains("metadata,title,\"Folder, Report\",,unchanged"));
        assert!(csv.contains("metadata,leftSource,left/,,unchanged"));
        assert!(csv.contains("differences,\"notes,md\",\"old \"\"quote\"\"\",new,different"));
    }

    #[test]
    fn renders_markdown_report_with_section_tables() {
        let report = UnifiedReport::new(
            ReportKind::Folder,
            "Folder Report",
            ReportMetadata {
                generated_at: "2026-06-27T03:40:00Z".to_owned(),
                left_source: Some("left/".to_owned()),
                right_source: Some("right/".to_owned()),
            },
        )
        .with_section(ReportSection {
            kind: ReportSectionKind::Differences,
            title: "Paths".to_owned(),
            rows: vec![ReportRow {
                label: "a|b".to_owned(),
                left: Some("one".to_owned()),
                right: Some("two".to_owned()),
                status: ReportRowStatus::Different,
            }],
        });

        let markdown = render_markdown_report(&report);

        assert!(markdown.starts_with("# Folder Report\n"));
        assert!(markdown.contains("- Left Source: left/"));
        assert!(markdown.contains("## Paths"));
        assert!(markdown.contains("| a\\|b | one | two | different |"));
    }

    #[test]
    fn renders_tsv_report_with_tab_separated_rows() {
        let report = UnifiedReport::new(
            ReportKind::Folder,
            "Folder Report",
            ReportMetadata {
                generated_at: "now".to_owned(),
                left_source: Some("left/".to_owned()),
                right_source: Some("right/".to_owned()),
            },
        )
        .with_section(ReportSection {
            kind: ReportSectionKind::Differences,
            title: "Differences".to_owned(),
            rows: vec![ReportRow {
                label: "a\tb".to_owned(),
                left: Some("one".to_owned()),
                right: Some("two".to_owned()),
                status: ReportRowStatus::Different,
            }],
        });

        let tsv = render_tsv_report(&report);
        assert!(tsv.starts_with("section\tlabel\tleft\tright\tstatus\n"));
        assert!(tsv.contains("differences\ta b\tone\ttwo\tdifferent"));
    }

    #[test]
    fn renders_yaml_report_with_sections() {
        let report = UnifiedReport::new(
            ReportKind::Folder,
            "Folder Report",
            ReportMetadata {
                generated_at: "now".to_owned(),
                left_source: Some("left/".to_owned()),
                right_source: Some("right/".to_owned()),
            },
        )
        .with_section(ReportSection {
            kind: ReportSectionKind::Differences,
            title: "Differences".to_owned(),
            rows: vec![ReportRow {
                label: "notes:md".to_owned(),
                left: Some("old".to_owned()),
                right: Some("new".to_owned()),
                status: ReportRowStatus::Different,
            }],
        });

        let yaml = render_yaml_report(&report);
        assert!(yaml.contains("title: \"Folder Report\""));
        assert!(yaml.contains("sections:"));
        assert!(yaml.contains("status: different"));
        assert!(yaml.contains("\"notes:md\""));
    }

    #[test]
    fn report_rendering_emits_structured_log_event() {
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
            rows: Vec::new(),
        });

        let event = build_report_render_log_event(&report, "html");

        assert_eq!(event.domain, logging_core::LogDomain::Report);
        assert_eq!(event.action, "renderHtml");
        assert_eq!(event.status, logging_core::LogStatus::Succeeded);
        assert_eq!(event.details["title"], "Folder Report");
        assert_eq!(event.details["kind"], "folder");
        assert_eq!(event.details["sectionCount"], 1);
    }
}
