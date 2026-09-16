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
    /// Stable fingerprint of file bytes when available. Directories leave this unset.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub content_fingerprint: Option<String>,
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

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct FolderMergePlan {
    pub actions: Vec<FolderMergeAction>,
    pub conflicts: usize,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct FolderMergeAction {
    pub relative_path: String,
    pub kind: FolderMergeActionKind,
    pub conflict: bool,
    pub conflict_detail: Option<FolderMergeConflict>,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum FolderMergeActionKind {
    KeepOutput,
    CopyLeftToOutput,
    CopyRightToOutput,
    DeleteOutput,
    MarkConflict,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct FolderMergeConflict {
    pub reason: FolderMergeConflictReason,
    pub base: Option<FolderMergeEntry>,
    pub left: Option<FolderMergeEntry>,
    pub right: Option<FolderMergeEntry>,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum FolderMergeConflictReason {
    BothSidesChanged,
    IncompatibleEntryKind,
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

pub fn build_folder_merge_plan(document: &FolderMergeDocument) -> FolderMergePlan {
    let actions = align_folder_merge_entries(document)
        .into_iter()
        .map(action_for_row)
        .collect::<Vec<_>>();
    let conflicts = actions.iter().filter(|action| action.conflict).count();

    FolderMergePlan { actions, conflicts }
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct FolderMergeActionOverride {
    pub relative_path: String,
    pub kind: FolderMergeActionKind,
}

pub fn apply_folder_merge_overrides(
    mut plan: FolderMergePlan,
    overrides: &[FolderMergeActionOverride],
) -> FolderMergePlan {
    for override_item in overrides {
        if let Some(action) = plan
            .actions
            .iter_mut()
            .find(|action| action.relative_path == override_item.relative_path)
        {
            action.kind = override_item.kind.clone();
            action.conflict = matches!(override_item.kind, FolderMergeActionKind::MarkConflict);
            if !action.conflict {
                action.conflict_detail = None;
            }
        }
    }

    plan.conflicts = plan.actions.iter().filter(|action| action.conflict).count();
    plan
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

fn action_for_row(row: FolderMergeAlignmentRow) -> FolderMergeAction {
    let kind = match (&row.base, &row.left, &row.right) {
        (None, Some(_), None) => FolderMergeActionKind::CopyLeftToOutput,
        (None, None, Some(_)) => FolderMergeActionKind::CopyRightToOutput,
        (None, Some(left), Some(right)) => both_added_action(left, right),
        (Some(_), None, Some(_)) => FolderMergeActionKind::DeleteOutput,
        (Some(_), Some(_), None) => FolderMergeActionKind::DeleteOutput,
        (Some(base), Some(left), Some(right)) => three_way_present_action(base, left, right),
        _ => FolderMergeActionKind::MarkConflict,
    };
    let conflict = kind == FolderMergeActionKind::MarkConflict;
    let conflict_detail = conflict.then(|| FolderMergeConflict {
        reason: conflict_reason_for_row(&row),
        base: row.base.clone(),
        left: row.left.clone(),
        right: row.right.clone(),
    });

    FolderMergeAction {
        relative_path: row.relative_path,
        kind,
        conflict,
        conflict_detail,
    }
}

fn both_added_action(left: &FolderMergeEntry, right: &FolderMergeEntry) -> FolderMergeActionKind {
    if left.kind != right.kind {
        return FolderMergeActionKind::MarkConflict;
    }

    if left.kind == FolderMergeEntryKind::Directory || fingerprints_match(left, right) {
        FolderMergeActionKind::CopyLeftToOutput
    } else {
        FolderMergeActionKind::MarkConflict
    }
}

fn three_way_present_action(
    base: &FolderMergeEntry,
    left: &FolderMergeEntry,
    right: &FolderMergeEntry,
) -> FolderMergeActionKind {
    if base.kind != left.kind || base.kind != right.kind {
        return FolderMergeActionKind::MarkConflict;
    }

    if base.kind == FolderMergeEntryKind::Directory {
        return FolderMergeActionKind::KeepOutput;
    }

    let left_changed = !fingerprints_match(base, left);
    let right_changed = !fingerprints_match(base, right);

    match (left_changed, right_changed) {
        (false, false) => FolderMergeActionKind::KeepOutput,
        (true, false) => FolderMergeActionKind::CopyLeftToOutput,
        (false, true) => FolderMergeActionKind::CopyRightToOutput,
        (true, true) if fingerprints_match(left, right) => FolderMergeActionKind::CopyLeftToOutput,
        (true, true) => FolderMergeActionKind::MarkConflict,
    }
}

fn fingerprints_match(left: &FolderMergeEntry, right: &FolderMergeEntry) -> bool {
    match (&left.content_fingerprint, &right.content_fingerprint) {
        (None, None) => true,
        (Some(left_fp), Some(right_fp)) => left_fp == right_fp,
        _ => false,
    }
}

fn conflict_reason_for_row(row: &FolderMergeAlignmentRow) -> FolderMergeConflictReason {
    match (&row.base, &row.left, &row.right) {
        (Some(base), Some(left), Some(right))
            if base.kind == left.kind
                && base.kind == right.kind
                && base.kind == FolderMergeEntryKind::File
                && !fingerprints_match(left, right) =>
        {
            FolderMergeConflictReason::BothSidesChanged
        }
        (None, Some(left), Some(right))
            if left.kind == right.kind
                && left.kind == FolderMergeEntryKind::File
                && !fingerprints_match(left, right) =>
        {
            FolderMergeConflictReason::BothSidesChanged
        }
        (Some(base), Some(left), Some(right))
            if base.kind != left.kind || base.kind != right.kind =>
        {
            FolderMergeConflictReason::BothSidesChanged
        }
        _ => FolderMergeConflictReason::IncompatibleEntryKind,
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

    #[test]
    fn plans_non_conflicting_folder_structure_changes() {
        let document = FolderMergeDocument {
            base: side(
                FolderMergeRole::Base,
                "D:/base",
                vec![
                    entry("same.txt", FolderMergeEntryKind::File),
                    entry("right-delete.txt", FolderMergeEntryKind::File),
                ],
            ),
            left: side(
                FolderMergeRole::Left,
                "D:/left",
                vec![
                    entry("same.txt", FolderMergeEntryKind::File),
                    entry("left-add.txt", FolderMergeEntryKind::File),
                    entry("right-delete.txt", FolderMergeEntryKind::File),
                ],
            ),
            right: side(
                FolderMergeRole::Right,
                "D:/right",
                vec![entry("same.txt", FolderMergeEntryKind::File)],
            ),
            output: FolderMergeSide::new(FolderMergeRole::Output, "D:/out"),
        };

        let plan = build_folder_merge_plan(&document);

        assert_eq!(plan.conflicts, 0);
        assert_eq!(
            plan.actions,
            vec![
                FolderMergeAction {
                    relative_path: "left-add.txt".to_owned(),
                    kind: FolderMergeActionKind::CopyLeftToOutput,
                    conflict: false,
                    conflict_detail: None,
                },
                FolderMergeAction {
                    relative_path: "right-delete.txt".to_owned(),
                    kind: FolderMergeActionKind::DeleteOutput,
                    conflict: false,
                    conflict_detail: None,
                },
                FolderMergeAction {
                    relative_path: "same.txt".to_owned(),
                    kind: FolderMergeActionKind::KeepOutput,
                    conflict: false,
                    conflict_detail: None,
                },
            ]
        );
    }

    #[test]
    fn marks_conflicting_same_path_folder_changes_with_context() {
        let document = FolderMergeDocument {
            base: side(
                FolderMergeRole::Base,
                "D:/base",
                vec![entry("config", FolderMergeEntryKind::File)],
            ),
            left: side(
                FolderMergeRole::Left,
                "D:/left",
                vec![entry("config", FolderMergeEntryKind::Directory)],
            ),
            right: side(
                FolderMergeRole::Right,
                "D:/right",
                vec![entry("config", FolderMergeEntryKind::File)],
            ),
            output: FolderMergeSide::new(FolderMergeRole::Output, "D:/out"),
        };

        let plan = build_folder_merge_plan(&document);

        assert_eq!(plan.conflicts, 1);
        assert_eq!(plan.actions[0].kind, FolderMergeActionKind::MarkConflict);
        assert_eq!(
            plan.actions[0].conflict_detail,
            Some(FolderMergeConflict {
                reason: FolderMergeConflictReason::BothSidesChanged,
                base: Some(entry("config", FolderMergeEntryKind::File)),
                left: Some(entry("config", FolderMergeEntryKind::Directory)),
                right: Some(entry("config", FolderMergeEntryKind::File)),
            })
        );
    }

    #[test]
    fn marks_file_content_conflicts_when_both_sides_change() {
        let document = FolderMergeDocument {
            base: side(
                FolderMergeRole::Base,
                "D:/base",
                vec![fingerprinted("notes.txt", "base")],
            ),
            left: side(
                FolderMergeRole::Left,
                "D:/left",
                vec![fingerprinted("notes.txt", "left")],
            ),
            right: side(
                FolderMergeRole::Right,
                "D:/right",
                vec![fingerprinted("notes.txt", "right")],
            ),
            output: FolderMergeSide::new(FolderMergeRole::Output, "D:/out"),
        };

        let plan = build_folder_merge_plan(&document);

        assert_eq!(plan.conflicts, 1);
        assert_eq!(plan.actions[0].kind, FolderMergeActionKind::MarkConflict);
        assert_eq!(
            plan.actions[0]
                .conflict_detail
                .as_ref()
                .map(|conflict| conflict.reason),
            Some(FolderMergeConflictReason::BothSidesChanged)
        );
    }

    #[test]
    fn apply_folder_merge_overrides_forces_copy_to_output() {
        let document = FolderMergeDocument {
            base: side(
                FolderMergeRole::Base,
                "D:/base",
                vec![fingerprinted("notes.txt", "base")],
            ),
            left: side(
                FolderMergeRole::Left,
                "D:/left",
                vec![fingerprinted("notes.txt", "left")],
            ),
            right: side(
                FolderMergeRole::Right,
                "D:/right",
                vec![fingerprinted("notes.txt", "right")],
            ),
            output: FolderMergeSide::new(FolderMergeRole::Output, "D:/out"),
        };

        let plan = build_folder_merge_plan(&document);
        assert_eq!(plan.actions[0].kind, FolderMergeActionKind::MarkConflict);

        let plan = apply_folder_merge_overrides(
            plan,
            &[FolderMergeActionOverride {
                relative_path: "notes.txt".to_owned(),
                kind: FolderMergeActionKind::CopyLeftToOutput,
            }],
        );

        assert_eq!(plan.conflicts, 0);
        assert_eq!(
            plan.actions[0].kind,
            FolderMergeActionKind::CopyLeftToOutput
        );
        assert!(plan.actions[0].conflict_detail.is_none());
    }

    #[test]
    fn copies_single_side_file_content_change_to_output() {
        let document = FolderMergeDocument {
            base: side(
                FolderMergeRole::Base,
                "D:/base",
                vec![fingerprinted("notes.txt", "base")],
            ),
            left: side(
                FolderMergeRole::Left,
                "D:/left",
                vec![fingerprinted("notes.txt", "left")],
            ),
            right: side(
                FolderMergeRole::Right,
                "D:/right",
                vec![fingerprinted("notes.txt", "base")],
            ),
            output: FolderMergeSide::new(FolderMergeRole::Output, "D:/out"),
        };

        let plan = build_folder_merge_plan(&document);

        assert_eq!(plan.conflicts, 0);
        assert_eq!(
            plan.actions[0].kind,
            FolderMergeActionKind::CopyLeftToOutput
        );
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
            content_fingerprint: None,
        }
    }

    fn fingerprinted(relative_path: &str, fingerprint: &str) -> FolderMergeEntry {
        FolderMergeEntry {
            relative_path: relative_path.to_owned(),
            kind: FolderMergeEntryKind::File,
            content_fingerprint: Some(fingerprint.to_owned()),
        }
    }
}
