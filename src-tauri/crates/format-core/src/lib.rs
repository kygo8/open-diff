use serde::{Deserialize, Serialize};
use std::ops::Range;

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct FileFormatDefinition {
    pub id: String,
    pub name: String,
    pub priority: i32,
    pub default_view: FileFormatView,
    pub matchers: Vec<FileFormatMatcher>,
    pub rule_refs: FileFormatRuleRefs,
    pub built_in: bool,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum FileFormatView {
    TextCompare,
    TableCompare,
    HexCompare,
    PictureCompare,
    TextMerge,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum FileFormatMatcher {
    Extension(String),
    FileName(String),
    Glob(String),
}

#[derive(Debug, Clone, Default, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct FileFormatRuleRefs {
    pub text_format_id: Option<String>,
    pub grammar_id: Option<String>,
    pub importance_rule_ids: Vec<String>,
    pub converter_id: Option<String>,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TextFormatDefinition {
    pub id: String,
    pub name: String,
    pub general: TextFormatGeneralSettings,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TextFormatGeneralSettings {
    pub preferred_encoding: TextEncodingRule,
    pub line_ending: LineEndingRule,
    pub case_sensitivity: CaseSensitivityRule,
    pub tab: TabRule,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum TextEncodingRule {
    AutoDetect,
    Utf8,
    Utf16Le,
    Gbk,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum LineEndingRule {
    Preserve,
    NormalizeLf,
    NormalizeCrlf,
    NormalizeCr,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum CaseSensitivityRule {
    Sensitive,
    Insensitive,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TabRule {
    pub width: u8,
    pub treatment: TabTreatment,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum TabTreatment {
    Preserve,
    ExpandToSpaces,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct NormalizedText {
    pub text: String,
    pub encoding: TextEncodingRule,
    pub line_ending: LineEndingRule,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct GrammarDefinition {
    pub id: String,
    pub name: String,
    pub items: Vec<GrammarItem>,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct GrammarItem {
    pub id: String,
    pub name: String,
    pub kind: GrammarItemKind,
    pub matcher: GrammarMatcher,
    pub style_scope: String,
    pub importance: GrammarImportance,
    pub line_weight: i32,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum GrammarItemKind {
    Comment,
    String,
    Keyword,
    Number,
    Operator,
    Custom,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum GrammarMatcher {
    LinePrefix(String),
    Keywords(Vec<String>),
    Delimited {
        start: String,
        end: String,
        escape: Option<String>,
    },
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum GrammarImportance {
    Important,
    Unimportant,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct GrammarItemMatch {
    pub item_id: String,
    pub kind: GrammarItemKind,
    pub range: Range<usize>,
    pub style_scope: String,
    pub importance: GrammarImportance,
    pub line_weight: i32,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TextReplacementIgnoreRule {
    pub id: String,
    pub name: String,
    pub left_pattern: String,
    pub right_replacement: String,
    pub match_case: bool,
    pub whole_word: bool,
}

impl FileFormatDefinition {
    pub fn matches_path(&self, path: impl AsRef<str>) -> bool {
        let path = path.as_ref();

        self.matchers
            .iter()
            .any(|matcher| matcher.matches_path(path))
    }
}

impl FileFormatMatcher {
    pub fn matches_path(&self, path: &str) -> bool {
        let file_name = file_name(path);

        match self {
            Self::Extension(extension) => file_extension(file_name)
                .is_some_and(|value| value.eq_ignore_ascii_case(extension.trim_start_matches('.'))),
            Self::FileName(expected) => file_name.eq_ignore_ascii_case(expected),
            Self::Glob(pattern) => glob_matches(pattern, path),
        }
    }
}

pub fn select_file_format(
    path: impl AsRef<str>,
    formats: &[FileFormatDefinition],
) -> Option<&FileFormatDefinition> {
    formats
        .iter()
        .filter(|format| format.matches_path(path.as_ref()))
        .max_by_key(|format| format.priority)
}

pub fn normalize_text_with_format(
    input: impl AsRef<str>,
    settings: &TextFormatGeneralSettings,
) -> NormalizedText {
    let mut text = input.as_ref().to_owned();

    text = match settings.line_ending {
        LineEndingRule::Preserve => text,
        LineEndingRule::NormalizeLf => normalize_line_endings(&text, "\n"),
        LineEndingRule::NormalizeCrlf => normalize_line_endings(&text, "\r\n"),
        LineEndingRule::NormalizeCr => normalize_line_endings(&text, "\r"),
    };

    if settings.tab.treatment == TabTreatment::ExpandToSpaces {
        text = text.replace('\t', &" ".repeat(usize::from(settings.tab.width.max(1))));
    }

    if settings.case_sensitivity == CaseSensitivityRule::Insensitive {
        text = text.to_lowercase();
    }

    NormalizedText {
        text,
        encoding: settings.preferred_encoding,
        line_ending: settings.line_ending,
    }
}

pub fn find_grammar_item(
    line: impl AsRef<str>,
    grammar: &GrammarDefinition,
) -> Option<GrammarItemMatch> {
    let line = line.as_ref();

    grammar.items.iter().find_map(|item| {
        grammar_item_range(line, &item.matcher).map(|range| match_from_item(item, range))
    })
}

pub fn text_replacement_is_ignored(
    left: impl AsRef<str>,
    right: impl AsRef<str>,
    rule: &TextReplacementIgnoreRule,
) -> bool {
    let left = left.as_ref();
    let right = right.as_ref();
    let normalized_left = if rule.match_case {
        replace_text_pattern(
            left,
            &rule.left_pattern,
            &rule.right_replacement,
            rule.whole_word,
        )
    } else {
        replace_text_pattern(
            &left.to_lowercase(),
            &rule.left_pattern.to_lowercase(),
            &rule.right_replacement.to_lowercase(),
            rule.whole_word,
        )
    };
    let normalized_right = if rule.match_case {
        right.to_owned()
    } else {
        right.to_lowercase()
    };

    normalized_left == normalized_right
}

fn file_name(path: &str) -> &str {
    path.rsplit(['/', '\\']).next().unwrap_or(path)
}

fn file_extension(file_name: &str) -> Option<&str> {
    file_name.rsplit_once('.').map(|(_, extension)| extension)
}

fn glob_matches(pattern: &str, path: &str) -> bool {
    if pattern == "*" {
        return true;
    }

    if let Some(extension) = pattern.strip_prefix("*.") {
        return file_extension(file_name(path))
            .is_some_and(|value| value.eq_ignore_ascii_case(extension));
    }

    file_name(path).eq_ignore_ascii_case(pattern)
}

fn normalize_line_endings(input: &str, replacement: &str) -> String {
    input
        .replace("\r\n", "\n")
        .replace('\r', "\n")
        .replace('\n', replacement)
}

fn grammar_item_range(line: &str, matcher: &GrammarMatcher) -> Option<Range<usize>> {
    match matcher {
        GrammarMatcher::LinePrefix(prefix) => {
            let start = line.find(prefix)?;

            Some(start..line.len())
        }
        GrammarMatcher::Keywords(keywords) => keywords
            .iter()
            .find_map(|keyword| keyword_range(line, keyword)),
        GrammarMatcher::Delimited { start, end, escape } => {
            delimited_range(line, start, end, escape.as_deref())
        }
    }
}

fn match_from_item(item: &GrammarItem, range: Range<usize>) -> GrammarItemMatch {
    GrammarItemMatch {
        item_id: item.id.clone(),
        kind: item.kind,
        range,
        style_scope: item.style_scope.clone(),
        importance: item.importance,
        line_weight: item.line_weight,
    }
}

fn keyword_range(line: &str, keyword: &str) -> Option<Range<usize>> {
    let mut offset = 0;

    while let Some(index) = line[offset..].find(keyword) {
        let start = offset + index;
        let end = start + keyword.len();

        if is_keyword_boundary(line, start, end) {
            return Some(start..end);
        }

        offset = end;
    }

    None
}

fn is_keyword_boundary(line: &str, start: usize, end: usize) -> bool {
    let before = line[..start].chars().next_back();
    let after = line[end..].chars().next();

    before.is_none_or(|character| !is_identifier_character(character))
        && after.is_none_or(|character| !is_identifier_character(character))
}

fn is_identifier_character(character: char) -> bool {
    character == '_' || character.is_ascii_alphanumeric()
}

fn delimited_range(
    line: &str,
    start_marker: &str,
    end_marker: &str,
    escape: Option<&str>,
) -> Option<Range<usize>> {
    let start = line.find(start_marker)?;
    let content_start = start + start_marker.len();
    let mut search_offset = content_start;

    while let Some(relative_end) = line[search_offset..].find(end_marker) {
        let end = search_offset + relative_end;

        if !is_escaped(line, end, escape) {
            return Some(start..end + end_marker.len());
        }

        search_offset = end + end_marker.len();
    }

    Some(start..line.len())
}

fn is_escaped(line: &str, marker_start: usize, escape: Option<&str>) -> bool {
    let Some(escape) = escape else {
        return false;
    };

    if escape.is_empty() || marker_start < escape.len() {
        return false;
    }

    line[..marker_start].ends_with(escape)
}

fn replace_text_pattern(input: &str, pattern: &str, replacement: &str, whole_word: bool) -> String {
    if pattern.is_empty() {
        return input.to_owned();
    }

    let mut output = String::new();
    let mut offset = 0;

    while let Some(relative_index) = input[offset..].find(pattern) {
        let start = offset + relative_index;
        let end = start + pattern.len();

        if !whole_word || is_keyword_boundary(input, start, end) {
            output.push_str(&input[offset..start]);
            output.push_str(replacement);
        } else {
            output.push_str(&input[offset..end]);
        }

        offset = end;
    }

    output.push_str(&input[offset..]);
    output
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn file_format_definition_carries_matching_view_priority_and_rules() {
        let format = FileFormatDefinition {
            id: "rust-source".to_owned(),
            name: "Rust Source".to_owned(),
            priority: 100,
            default_view: FileFormatView::TextCompare,
            matchers: vec![
                FileFormatMatcher::Extension("rs".to_owned()),
                FileFormatMatcher::FileName("Cargo.toml".to_owned()),
            ],
            rule_refs: FileFormatRuleRefs {
                text_format_id: Some("rust-text".to_owned()),
                grammar_id: Some("rust-grammar".to_owned()),
                importance_rule_ids: vec!["ignore-comments".to_owned()],
                converter_id: None,
            },
            built_in: true,
        };

        assert!(format.matches_path("src/main.rs"));
        assert!(format.matches_path("Cargo.toml"));
        assert!(!format.matches_path("README.md"));
        assert_eq!(format.default_view, FileFormatView::TextCompare);
        assert_eq!(format.rule_refs.grammar_id.as_deref(), Some("rust-grammar"));
    }

    #[test]
    fn selects_highest_priority_matching_format() {
        let generic_text = FileFormatDefinition {
            id: "text".to_owned(),
            name: "Text".to_owned(),
            priority: 10,
            default_view: FileFormatView::TextCompare,
            matchers: vec![FileFormatMatcher::Extension("txt".to_owned())],
            rule_refs: FileFormatRuleRefs::default(),
            built_in: true,
        };
        let readme = FileFormatDefinition {
            id: "readme".to_owned(),
            name: "README".to_owned(),
            priority: 50,
            default_view: FileFormatView::TextCompare,
            matchers: vec![FileFormatMatcher::FileName("README.txt".to_owned())],
            rule_refs: FileFormatRuleRefs {
                text_format_id: Some("readme-text".to_owned()),
                ..FileFormatRuleRefs::default()
            },
            built_in: false,
        };

        let formats = [generic_text, readme];
        let selected = select_file_format("docs/README.txt", &formats)
            .expect("a matching format should be selected");

        assert_eq!(selected.id, "readme");
        assert_eq!(
            selected.rule_refs.text_format_id.as_deref(),
            Some("readme-text")
        );
    }

    #[test]
    fn text_format_general_settings_capture_encoding_line_case_and_tabs() {
        let format = TextFormatDefinition {
            id: "rust-text".to_owned(),
            name: "Rust Text".to_owned(),
            general: TextFormatGeneralSettings {
                preferred_encoding: TextEncodingRule::Utf8,
                line_ending: LineEndingRule::NormalizeLf,
                case_sensitivity: CaseSensitivityRule::Insensitive,
                tab: TabRule {
                    width: 4,
                    treatment: TabTreatment::ExpandToSpaces,
                },
            },
        };

        assert_eq!(format.general.preferred_encoding, TextEncodingRule::Utf8);
        assert_eq!(format.general.line_ending, LineEndingRule::NormalizeLf);
        assert_eq!(
            format.general.case_sensitivity,
            CaseSensitivityRule::Insensitive
        );
        assert_eq!(format.general.tab.width, 4);
        assert_eq!(format.general.tab.treatment, TabTreatment::ExpandToSpaces);
    }

    #[test]
    fn normalizes_text_with_text_format_general_settings() {
        let settings = TextFormatGeneralSettings {
            preferred_encoding: TextEncodingRule::Utf8,
            line_ending: LineEndingRule::NormalizeLf,
            case_sensitivity: CaseSensitivityRule::Insensitive,
            tab: TabRule {
                width: 2,
                treatment: TabTreatment::ExpandToSpaces,
            },
        };

        let normalized = normalize_text_with_format("A\tB\r\nC", &settings);

        assert_eq!(normalized.text, "a  b\nc");
        assert_eq!(normalized.encoding, TextEncodingRule::Utf8);
        assert_eq!(normalized.line_ending, LineEndingRule::NormalizeLf);
    }

    #[test]
    fn grammar_definition_carries_ordered_items_for_comments_strings_and_keywords() {
        let grammar = GrammarDefinition {
            id: "rust-grammar".to_owned(),
            name: "Rust Grammar".to_owned(),
            items: vec![
                GrammarItem {
                    id: "line-comment".to_owned(),
                    name: "Line Comment".to_owned(),
                    kind: GrammarItemKind::Comment,
                    matcher: GrammarMatcher::LinePrefix("//".to_owned()),
                    style_scope: "comment.line".to_owned(),
                    importance: GrammarImportance::Unimportant,
                    line_weight: -20,
                },
                GrammarItem {
                    id: "string".to_owned(),
                    name: "String".to_owned(),
                    kind: GrammarItemKind::String,
                    matcher: GrammarMatcher::Delimited {
                        start: "\"".to_owned(),
                        end: "\"".to_owned(),
                        escape: Some("\\".to_owned()),
                    },
                    style_scope: "string.quoted".to_owned(),
                    importance: GrammarImportance::Important,
                    line_weight: 0,
                },
                GrammarItem {
                    id: "keyword".to_owned(),
                    name: "Keyword".to_owned(),
                    kind: GrammarItemKind::Keyword,
                    matcher: GrammarMatcher::Keywords(vec!["fn".to_owned(), "let".to_owned()]),
                    style_scope: "keyword.control".to_owned(),
                    importance: GrammarImportance::Important,
                    line_weight: 30,
                },
            ],
        };

        assert_eq!(grammar.items[0].kind, GrammarItemKind::Comment);
        assert_eq!(grammar.items[1].kind, GrammarItemKind::String);
        assert_eq!(grammar.items[2].kind, GrammarItemKind::Keyword);
        assert_eq!(grammar.items[0].line_weight, -20);
    }

    #[test]
    fn finds_first_matching_grammar_item_by_priority_order() {
        let grammar = GrammarDefinition {
            id: "rust-grammar".to_owned(),
            name: "Rust Grammar".to_owned(),
            items: vec![
                GrammarItem {
                    id: "line-comment".to_owned(),
                    name: "Line Comment".to_owned(),
                    kind: GrammarItemKind::Comment,
                    matcher: GrammarMatcher::LinePrefix("//".to_owned()),
                    style_scope: "comment.line".to_owned(),
                    importance: GrammarImportance::Unimportant,
                    line_weight: -20,
                },
                GrammarItem {
                    id: "keyword".to_owned(),
                    name: "Keyword".to_owned(),
                    kind: GrammarItemKind::Keyword,
                    matcher: GrammarMatcher::Keywords(vec!["fn".to_owned(), "let".to_owned()]),
                    style_scope: "keyword.control".to_owned(),
                    importance: GrammarImportance::Important,
                    line_weight: 30,
                },
            ],
        };

        let comment_match = find_grammar_item("// fn is ignored", &grammar)
            .expect("line comment should match before keyword");
        let keyword_match =
            find_grammar_item("pub fn main()", &grammar).expect("keyword should match");

        assert_eq!(comment_match.item_id, "line-comment");
        assert_eq!(comment_match.kind, GrammarItemKind::Comment);
        assert_eq!(keyword_match.item_id, "keyword");
        assert_eq!(keyword_match.range, 4..6);
    }

    #[test]
    fn text_replacement_ignore_rule_marks_identifier_renames() {
        let rule = TextReplacementIgnoreRule {
            id: "rename-config".to_owned(),
            name: "config rename".to_owned(),
            left_pattern: "oldConfig".to_owned(),
            right_replacement: "newConfig".to_owned(),
            match_case: true,
            whole_word: true,
        };

        assert!(text_replacement_is_ignored(
            "let oldConfig = 1;",
            "let newConfig = 1;",
            &rule
        ));
        assert!(!text_replacement_is_ignored(
            "let oldConfiguration = 1;",
            "let newConfig = 1;",
            &rule
        ));
    }
}
