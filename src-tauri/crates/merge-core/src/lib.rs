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

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TextMergeResult {
    pub output_text: String,
    pub conflicts: usize,
    pub sections: Vec<TextMergeSection>,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TextMergeSection {
    pub line_index: usize,
    pub kind: TextMergeSectionKind,
    pub output: Vec<String>,
    pub conflict: Option<TextMergeConflict>,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TextMergeConflict {
    pub base: Vec<String>,
    pub left: Vec<String>,
    pub right: Vec<String>,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum TextMergeSectionKind {
    Unchanged,
    AcceptedLeft,
    AcceptedRight,
    Conflict,
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

pub fn auto_merge_text(document: &TextMergeDocument) -> TextMergeResult {
    let max_len = document
        .base
        .lines
        .len()
        .max(document.left.lines.len())
        .max(document.right.lines.len());
    let mut sections = Vec::new();
    let mut output_lines = Vec::new();
    let mut conflicts = 0;

    for index in 0..max_len {
        let base = document.base.lines.get(index);
        let left = document.left.lines.get(index);
        let right = document.right.lines.get(index);
        let left_changed = left != base;
        let right_changed = right != base;
        let mut conflict = None;
        let (kind, selected) = match (left_changed, right_changed) {
            (false, false) => (TextMergeSectionKind::Unchanged, base),
            (true, false) => (TextMergeSectionKind::AcceptedLeft, left),
            (false, true) => (TextMergeSectionKind::AcceptedRight, right),
            (true, true) if left == right => (TextMergeSectionKind::AcceptedLeft, left),
            (true, true) => {
                conflicts += 1;
                conflict = Some(TextMergeConflict {
                    base: optional_line(base),
                    left: optional_line(left),
                    right: optional_line(right),
                });
                (TextMergeSectionKind::Conflict, base)
            }
        };
        let output = selected.cloned().into_iter().collect::<Vec<_>>();

        output_lines.extend(output.clone());
        sections.push(TextMergeSection {
            line_index: index,
            kind,
            output,
            conflict,
        });
    }

    TextMergeResult {
        output_text: output_lines.join("\n"),
        conflicts,
        sections,
    }
}

fn optional_line(line: Option<&String>) -> Vec<String> {
    line.cloned().into_iter().collect()
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

    #[test]
    fn automatically_merges_non_overlapping_left_and_right_changes() {
        let document = TextMergeDocument::from_inputs(TextMergeInput {
            base: TextMergeSide::new("base.txt", "one\ntwo\nthree"),
            left: TextMergeSide::new("left.txt", "ONE\ntwo\nthree"),
            right: TextMergeSide::new("right.txt", "one\ntwo\nTHREE"),
            output_path: Some("merged.txt".to_owned()),
        });

        let result = auto_merge_text(&document);

        assert_eq!(result.conflicts, 0);
        assert_eq!(result.output_text, "ONE\ntwo\nTHREE");
        assert_eq!(
            result.sections,
            vec![
                TextMergeSection {
                    line_index: 0,
                    kind: TextMergeSectionKind::AcceptedLeft,
                    output: vec!["ONE".to_owned()],
                    conflict: None,
                },
                TextMergeSection {
                    line_index: 1,
                    kind: TextMergeSectionKind::Unchanged,
                    output: vec!["two".to_owned()],
                    conflict: None,
                },
                TextMergeSection {
                    line_index: 2,
                    kind: TextMergeSectionKind::AcceptedRight,
                    output: vec!["THREE".to_owned()],
                    conflict: None,
                },
            ]
        );
    }

    #[test]
    fn detects_conflict_sections_with_all_three_versions() {
        let document = TextMergeDocument::from_inputs(TextMergeInput {
            base: TextMergeSide::new("base.txt", "one\ntwo\nthree"),
            left: TextMergeSide::new("left.txt", "one\nleft change\nthree"),
            right: TextMergeSide::new("right.txt", "one\nright change\nthree"),
            output_path: None,
        });

        let result = auto_merge_text(&document);

        assert_eq!(result.conflicts, 1);
        assert_eq!(result.output_text, "one\ntwo\nthree");
        assert_eq!(
            result.sections[1],
            TextMergeSection {
                line_index: 1,
                kind: TextMergeSectionKind::Conflict,
                output: vec!["two".to_owned()],
                conflict: Some(TextMergeConflict {
                    base: vec!["two".to_owned()],
                    left: vec!["left change".to_owned()],
                    right: vec!["right change".to_owned()],
                }),
            }
        );
    }
}
