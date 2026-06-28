use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum TextMergeRole {
    Base,
    Left,
    Right,
    Output,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TextMergeSide {
    pub role: TextMergeRole,
    pub path: Option<String>,
    pub text: String,
    pub lines: Vec<String>,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TextMergeInput {
    pub base: TextMergeSide,
    pub left: TextMergeSide,
    pub right: TextMergeSide,
    pub output_path: Option<String>,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TextMergeDocument {
    pub base: TextMergeSide,
    pub left: TextMergeSide,
    pub right: TextMergeSide,
    pub output: TextMergeSide,
}

impl TextMergeSide {
    pub fn new(path: impl Into<String>, text: impl Into<String>) -> Self {
        let text = text.into();

        Self {
            role: TextMergeRole::Base,
            path: Some(path.into()),
            lines: split_lines(&text),
            text,
        }
    }

    fn with_role(mut self, role: TextMergeRole) -> Self {
        self.role = role;
        self
    }
}

impl TextMergeDocument {
    pub fn from_inputs(input: TextMergeInput) -> Self {
        let base = input.base.with_role(TextMergeRole::Base);
        let output_text = base.text.clone();

        Self {
            left: input.left.with_role(TextMergeRole::Left),
            right: input.right.with_role(TextMergeRole::Right),
            output: TextMergeSide {
                role: TextMergeRole::Output,
                path: input.output_path,
                lines: split_lines(&output_text),
                text: output_text,
            },
            base,
        }
    }
}

fn split_lines(input: &str) -> Vec<String> {
    if input.is_empty() {
        return Vec::new();
    }

    input
        .replace("\r\n", "\n")
        .replace('\r', "\n")
        .trim_end_matches('\n')
        .split('\n')
        .map(ToOwned::to_owned)
        .collect()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn builds_three_way_text_merge_document_with_output() {
        let document = TextMergeDocument::from_inputs(TextMergeInput {
            base: TextMergeSide::new("base.txt", "one\ntwo\n"),
            left: TextMergeSide::new("left.txt", "one\nleft\n"),
            right: TextMergeSide::new("right.txt", "one\nright\n"),
            output_path: Some("merged.txt".to_owned()),
        });

        assert_eq!(document.base.role, TextMergeRole::Base);
        assert_eq!(document.left.role, TextMergeRole::Left);
        assert_eq!(document.right.role, TextMergeRole::Right);
        assert_eq!(document.output.role, TextMergeRole::Output);
        assert_eq!(document.output.path.as_deref(), Some("merged.txt"));
        assert_eq!(document.output.text, "one\ntwo\n");
        assert_eq!(
            document.base.lines,
            vec!["one".to_owned(), "two".to_owned()]
        );
        assert_eq!(
            document.left.lines,
            vec!["one".to_owned(), "left".to_owned()]
        );
        assert_eq!(
            document.right.lines,
            vec!["one".to_owned(), "right".to_owned()]
        );
    }

    #[test]
    fn builds_text_merge_document_without_output_path() {
        let document = TextMergeDocument::from_inputs(TextMergeInput {
            base: TextMergeSide::new("base.txt", "base"),
            left: TextMergeSide::new("left.txt", "left"),
            right: TextMergeSide::new("right.txt", "right"),
            output_path: None,
        });

        assert_eq!(document.output.path, None);
        assert_eq!(document.output.text, "base");
        assert_eq!(document.output.lines, vec!["base".to_owned()]);
    }
}
