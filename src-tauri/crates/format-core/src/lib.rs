use serde::{Deserialize, Serialize};

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
}
