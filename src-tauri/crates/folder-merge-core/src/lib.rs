use serde::{Deserialize, Serialize};
use std::collections::BTreeMap;

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum FolderMergeRole {
    Base,
    Left,
    Right,
    Output,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum FolderMergeEntryKind {
    File,
    Directory,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct FolderMergeEntry {
    pub relative_path: String,
    pub kind: FolderMergeEntryKind,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct FolderMergeSide {
    pub role: FolderMergeRole,
    pub root_path: String,
    pub entries: Vec<FolderMergeEntry>,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct FolderMergeInput {
    pub base: FolderMergeSide,
    pub left: FolderMergeSide,
    pub right: FolderMergeSide,
    pub output_root: String,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct FolderMergeDocument {
    pub base: FolderMergeSide,
    pub left: FolderMergeSide,
    pub right: FolderMergeSide,
    pub output: FolderMergeSide,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct FolderMergeAlignmentRow {
    pub relative_path: String,
    pub base: Option<FolderMergeEntry>,
    pub left: Option<FolderMergeEntry>,
    pub right: Option<FolderMergeEntry>,
}

impl FolderMergeSide {
    pub fn new(role: FolderMergeRole, root_path: impl Into<String>) -> Self {
        Self {
            role,
            root_path: root_path.into(),
            entries: Vec::new(),
        }
    }

    fn with_role(mut self, role: FolderMergeRole) -> Self {
        self.role = role;
        self
    }
}

impl FolderMergeDocument {
    pub fn from_inputs(input: FolderMergeInput) -> Self {
        Self {
            base: input.base.with_role(FolderMergeRole::Base),
            left: input.left.with_role(FolderMergeRole::Left),
            right: input.right.with_role(FolderMergeRole::Right),
            output: FolderMergeSide::new(FolderMergeRole::Output, input.output_root),
        }
    }
}

pub fn align_folder_merge_entries(document: &FolderMergeDocument) -> Vec<FolderMergeAlignmentRow> {
    let mut rows = BTreeMap::<String, FolderMergeAlignmentRow>::new();

    collect_side_entries(
        &document.base,
        |row, entry| row.base = Some(entry),
        &mut rows,
    );
    collect_side_entries(
        &document.left,
        |row, entry| row.left = Some(entry),
        &mut rows,
    );
    collect_side_entries(
        &document.right,
        |row, entry| row.right = Some(entry),
        &mut rows,
    );

    rows.into_values().collect()
}

fn collect_side_entries(
    side: &FolderMergeSide,
    apply: impl Fn(&mut FolderMergeAlignmentRow, FolderMergeEntry),
    rows: &mut BTreeMap<String, FolderMergeAlignmentRow>,
) {
    for entry in &side.entries {
        let relative_path = entry.relative_path.clone();
        let row = rows
            .entry(relative_path.clone())
            .or_insert_with(|| FolderMergeAlignmentRow {
                relative_path,
                base: None,
                left: None,
                right: None,
            });

        apply(row, entry.clone());
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn builds_three_way_folder_merge_document_with_output_root() {
        let document = FolderMergeDocument::from_inputs(FolderMergeInput {
            base: FolderMergeSide::new(FolderMergeRole::Base, "D:/repo/base"),
            left: FolderMergeSide::new(FolderMergeRole::Left, "D:/repo/left"),
            right: FolderMergeSide::new(FolderMergeRole::Right, "D:/repo/right"),
            output_root: "D:/repo/output".to_owned(),
        });

        assert_eq!(document.base.role, FolderMergeRole::Base);
        assert_eq!(document.left.role, FolderMergeRole::Left);
        assert_eq!(document.right.role, FolderMergeRole::Right);
        assert_eq!(document.output.role, FolderMergeRole::Output);
        assert_eq!(document.output.root_path, "D:/repo/output");
    }

    #[test]
    fn aligns_base_left_and_right_entries_by_relative_path() {
        let document = FolderMergeDocument {
            base: side(
                FolderMergeRole::Base,
                "D:/base",
                vec![
                    entry("same.txt", FolderMergeEntryKind::File),
                    entry("left-change.txt", FolderMergeEntryKind::File),
                    entry("right-delete.txt", FolderMergeEntryKind::File),
                ],
            ),
            left: side(
                FolderMergeRole::Left,
                "D:/left",
                vec![
                    entry("same.txt", FolderMergeEntryKind::File),
                    entry("left-change.txt", FolderMergeEntryKind::File),
                    entry("left-add.txt", FolderMergeEntryKind::File),
                ],
            ),
            right: side(
                FolderMergeRole::Right,
                "D:/right",
                vec![
                    entry("same.txt", FolderMergeEntryKind::File),
                    entry("right-add.txt", FolderMergeEntryKind::File),
                ],
            ),
            output: FolderMergeSide::new(FolderMergeRole::Output, "D:/out"),
        };

        let rows = align_folder_merge_entries(&document);

        assert_eq!(rows.len(), 5);
        assert_eq!(rows[0].relative_path, "left-add.txt");
        assert!(rows[0].base.is_none());
        assert!(rows[0].left.is_some());
        assert!(rows[0].right.is_none());
        assert_eq!(rows[1].relative_path, "left-change.txt");
        assert!(rows[1].base.is_some());
        assert!(rows[1].left.is_some());
        assert!(rows[1].right.is_none());
        assert_eq!(rows[4].relative_path, "same.txt");
        assert!(rows[4].base.is_some());
        assert!(rows[4].left.is_some());
        assert!(rows[4].right.is_some());
    }

    fn side(
        role: FolderMergeRole,
        root_path: &str,
        entries: Vec<FolderMergeEntry>,
    ) -> FolderMergeSide {
        FolderMergeSide {
            role,
            root_path: root_path.to_owned(),
            entries,
        }
    }

    fn entry(relative_path: &str, kind: FolderMergeEntryKind) -> FolderMergeEntry {
        FolderMergeEntry {
            relative_path: relative_path.to_owned(),
            kind,
        }
    }
}
