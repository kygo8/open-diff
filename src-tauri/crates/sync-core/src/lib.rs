use folder_core::FolderAlignmentRow;
use serde::{Deserialize, Serialize};
use vfs_core::{VfsPath, VfsProvider};

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SyncPlan {
    pub name: String,
    pub items: Vec<SyncPlanItem>,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SyncPlanItem {
    pub relative_path: String,
    pub action: SyncAction,
    pub reason: String,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum SyncAction {
    Copy {
        direction: SyncDirection,
        source_path: String,
        target_path: String,
    },
    Delete {
        target_path: String,
    },
    Leave,
    Conflict {
        left_path: String,
        right_path: String,
        message: String,
    },
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum SyncDirection {
    LeftToRight,
    RightToLeft,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SyncExecutionResult {
    pub total: usize,
    pub succeeded: usize,
    pub failed: usize,
    pub cancelled: usize,
    pub items: Vec<SyncExecutionItemResult>,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SyncExecutionItemResult {
    pub relative_path: String,
    pub action: SyncAction,
    pub status: SyncExecutionStatus,
    pub error: Option<String>,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum SyncExecutionStatus {
    Succeeded,
    Failed,
    Cancelled,
}

impl SyncPlan {
    pub fn new(name: impl Into<String>) -> Self {
        Self {
            name: name.into(),
            items: Vec::new(),
        }
    }

    pub fn add_item(&mut self, item: SyncPlanItem) {
        self.items.push(item);
    }
}

pub fn execute_sync_plan(vfs: &mut impl VfsProvider, plan: &SyncPlan) -> SyncExecutionResult {
    execute_sync_plan_with_control(vfs, plan, |_, _| {}, || false)
}

pub fn execute_sync_plan_with_control(
    vfs: &mut impl VfsProvider,
    plan: &SyncPlan,
    mut on_progress: impl FnMut(usize, usize),
    mut is_cancelled: impl FnMut() -> bool,
) -> SyncExecutionResult {
    let mut items = Vec::with_capacity(plan.items.len());
    let total = plan.items.len();

    for (index, item) in plan.items.iter().enumerate() {
        if is_cancelled() {
            items.extend(plan.items[index..].iter().map(cancelled_sync_plan_item));
            break;
        }

        items.push(execute_sync_plan_item(vfs, item));
        on_progress(items.len(), total);
    }

    summarize_sync_execution(items)
}

fn summarize_sync_execution(items: Vec<SyncExecutionItemResult>) -> SyncExecutionResult {
    let succeeded = items
        .iter()
        .filter(|item| item.status == SyncExecutionStatus::Succeeded)
        .count();
    let failed = items
        .iter()
        .filter(|item| item.status == SyncExecutionStatus::Failed)
        .count();
    let cancelled = items
        .iter()
        .filter(|item| item.status == SyncExecutionStatus::Cancelled)
        .count();

    SyncExecutionResult {
        total: items.len(),
        succeeded,
        failed,
        cancelled,
        items,
    }
}

fn execute_sync_plan_item(
    vfs: &mut impl VfsProvider,
    item: &SyncPlanItem,
) -> SyncExecutionItemResult {
    let execution = match &item.action {
        SyncAction::Copy {
            source_path,
            target_path,
            ..
        } => vfs
            .read(&VfsPath::new(source_path.clone()))
            .and_then(|bytes| vfs.write(&VfsPath::new(target_path.clone()), &bytes)),
        SyncAction::Delete { target_path } => vfs.delete(&VfsPath::new(target_path.clone())),
        SyncAction::Leave => Ok(()),
        SyncAction::Conflict { message, .. } => Err(vfs_core::VfsError::Io(message.clone())),
    };

    match execution {
        Ok(()) => SyncExecutionItemResult {
            relative_path: item.relative_path.clone(),
            action: item.action.clone(),
            status: SyncExecutionStatus::Succeeded,
            error: None,
        },
        Err(error) => SyncExecutionItemResult {
            relative_path: item.relative_path.clone(),
            action: item.action.clone(),
            status: SyncExecutionStatus::Failed,
            error: Some(format!("{error:?}")),
        },
    }
}

fn cancelled_sync_plan_item(item: &SyncPlanItem) -> SyncExecutionItemResult {
    SyncExecutionItemResult {
        relative_path: item.relative_path.clone(),
        action: item.action.clone(),
        status: SyncExecutionStatus::Cancelled,
        error: None,
    }
}

pub fn build_update_right_plan(
    left_root: impl AsRef<str>,
    right_root: impl AsRef<str>,
    rows: &[FolderAlignmentRow],
) -> SyncPlan {
    let mut plan = SyncPlan::new("Update Right");

    for row in rows {
        let action = if should_copy_left_to_right(row) {
            copy_left_to_right_action(left_root.as_ref(), right_root.as_ref(), &row.relative_path)
        } else {
            SyncAction::Leave
        };

        plan.add_item(SyncPlanItem {
            relative_path: row.relative_path.clone(),
            reason: update_right_reason(row, &action),
            action,
        });
    }

    plan
}

pub fn build_update_left_plan(
    left_root: impl AsRef<str>,
    right_root: impl AsRef<str>,
    rows: &[FolderAlignmentRow],
) -> SyncPlan {
    let mut plan = SyncPlan::new("Update Left");

    for row in rows {
        let action = if should_copy_right_to_left(row) {
            copy_right_to_left_action(left_root.as_ref(), right_root.as_ref(), &row.relative_path)
        } else {
            SyncAction::Leave
        };

        plan.add_item(SyncPlanItem {
            relative_path: row.relative_path.clone(),
            reason: update_left_reason(row, &action),
            action,
        });
    }

    plan
}

pub fn build_update_both_plan(
    left_root: impl AsRef<str>,
    right_root: impl AsRef<str>,
    rows: &[FolderAlignmentRow],
) -> SyncPlan {
    let mut plan = SyncPlan::new("Update Both");

    for row in rows {
        let action = if should_copy_left_to_right(row) {
            copy_left_to_right_action(left_root.as_ref(), right_root.as_ref(), &row.relative_path)
        } else if should_copy_right_to_left(row) {
            copy_right_to_left_action(left_root.as_ref(), right_root.as_ref(), &row.relative_path)
        } else {
            SyncAction::Leave
        };

        plan.add_item(SyncPlanItem {
            relative_path: row.relative_path.clone(),
            reason: update_both_reason(row, &action),
            action,
        });
    }

    plan
}

pub fn build_mirror_to_right_plan(
    left_root: impl AsRef<str>,
    right_root: impl AsRef<str>,
    rows: &[FolderAlignmentRow],
) -> SyncPlan {
    let mut plan = SyncPlan::new("Mirror to Right");

    for row in rows {
        let action = if should_mirror_left_to_right(row) {
            copy_left_to_right_action(left_root.as_ref(), right_root.as_ref(), &row.relative_path)
        } else if row.left.is_none() && row.right.is_some() {
            delete_right_action(right_root.as_ref(), &row.relative_path)
        } else {
            SyncAction::Leave
        };

        plan.add_item(SyncPlanItem {
            relative_path: row.relative_path.clone(),
            reason: mirror_to_right_reason(row, &action),
            action,
        });
    }

    plan
}

pub fn build_mirror_to_left_plan(
    left_root: impl AsRef<str>,
    right_root: impl AsRef<str>,
    rows: &[FolderAlignmentRow],
) -> SyncPlan {
    let mut plan = SyncPlan::new("Mirror to Left");

    for row in rows {
        let action = if should_mirror_right_to_left(row) {
            copy_right_to_left_action(left_root.as_ref(), right_root.as_ref(), &row.relative_path)
        } else if row.left.is_some() && row.right.is_none() {
            delete_left_action(left_root.as_ref(), &row.relative_path)
        } else {
            SyncAction::Leave
        };

        plan.add_item(SyncPlanItem {
            relative_path: row.relative_path.clone(),
            reason: mirror_to_left_reason(row, &action),
            action,
        });
    }

    plan
}

fn should_copy_left_to_right(row: &FolderAlignmentRow) -> bool {
    row.left.is_some() && row.right.is_none() || left_is_newer(row)
}

fn should_copy_right_to_left(row: &FolderAlignmentRow) -> bool {
    row.left.is_none() && row.right.is_some() || right_is_newer(row)
}

fn should_mirror_left_to_right(row: &FolderAlignmentRow) -> bool {
    row.left.is_some() && !row_is_same(row)
}

fn should_mirror_right_to_left(row: &FolderAlignmentRow) -> bool {
    row.right.is_some() && !row_is_same(row)
}

fn copy_left_to_right_action(left_root: &str, right_root: &str, relative_path: &str) -> SyncAction {
    SyncAction::Copy {
        direction: SyncDirection::LeftToRight,
        source_path: joined_path(left_root, relative_path),
        target_path: joined_path(right_root, relative_path),
    }
}

fn copy_right_to_left_action(left_root: &str, right_root: &str, relative_path: &str) -> SyncAction {
    SyncAction::Copy {
        direction: SyncDirection::RightToLeft,
        source_path: joined_path(right_root, relative_path),
        target_path: joined_path(left_root, relative_path),
    }
}

fn delete_left_action(left_root: &str, relative_path: &str) -> SyncAction {
    SyncAction::Delete {
        target_path: joined_path(left_root, relative_path),
    }
}

fn delete_right_action(right_root: &str, relative_path: &str) -> SyncAction {
    SyncAction::Delete {
        target_path: joined_path(right_root, relative_path),
    }
}

fn left_is_newer(row: &FolderAlignmentRow) -> bool {
    let Some(left) = row.left.as_ref() else {
        return false;
    };
    let Some(right) = row.right.as_ref() else {
        return false;
    };

    left.metadata.modified_at_ms > right.metadata.modified_at_ms
}

fn right_is_newer(row: &FolderAlignmentRow) -> bool {
    let Some(left) = row.left.as_ref() else {
        return false;
    };
    let Some(right) = row.right.as_ref() else {
        return false;
    };

    right.metadata.modified_at_ms > left.metadata.modified_at_ms
}

fn row_is_same(row: &FolderAlignmentRow) -> bool {
    let Some(left) = row.left.as_ref() else {
        return false;
    };
    let Some(right) = row.right.as_ref() else {
        return false;
    };

    left.metadata.modified_at_ms == right.metadata.modified_at_ms
}

fn update_right_reason(row: &FolderAlignmentRow, action: &SyncAction) -> String {
    match action {
        SyncAction::Copy { .. } if row.right.is_none() => "Left item only exists".to_owned(),
        SyncAction::Copy { .. } => "Left item is newer".to_owned(),
        SyncAction::Leave => "No update needed".to_owned(),
        SyncAction::Delete { .. } | SyncAction::Conflict { .. } => {
            "Not used by Update Right".to_owned()
        }
    }
}

fn update_left_reason(row: &FolderAlignmentRow, action: &SyncAction) -> String {
    match action {
        SyncAction::Copy { .. } if row.left.is_none() => "Right item only exists".to_owned(),
        SyncAction::Copy { .. } => "Right item is newer".to_owned(),
        SyncAction::Leave => "No update needed".to_owned(),
        SyncAction::Delete { .. } | SyncAction::Conflict { .. } => {
            "Not used by Update Left".to_owned()
        }
    }
}

fn update_both_reason(row: &FolderAlignmentRow, action: &SyncAction) -> String {
    match action {
        SyncAction::Copy {
            direction: SyncDirection::LeftToRight,
            ..
        } if row.right.is_none() => "Left item only exists".to_owned(),
        SyncAction::Copy {
            direction: SyncDirection::RightToLeft,
            ..
        } if row.left.is_none() => "Right item only exists".to_owned(),
        SyncAction::Copy {
            direction: SyncDirection::LeftToRight,
            ..
        } => "Left item is newer".to_owned(),
        SyncAction::Copy {
            direction: SyncDirection::RightToLeft,
            ..
        } => "Right item is newer".to_owned(),
        SyncAction::Leave => "No update needed".to_owned(),
        SyncAction::Delete { .. } | SyncAction::Conflict { .. } => {
            "Not used by Update Both".to_owned()
        }
    }
}

fn mirror_to_right_reason(row: &FolderAlignmentRow, action: &SyncAction) -> String {
    match action {
        SyncAction::Copy { .. } if row.right.is_none() => "Left item only exists".to_owned(),
        SyncAction::Copy { .. } => "Left item replaces right item".to_owned(),
        SyncAction::Delete { .. } => "Right item does not exist on left".to_owned(),
        SyncAction::Leave => "Already mirrored".to_owned(),
        SyncAction::Conflict { .. } => "Not used by Mirror to Right".to_owned(),
    }
}

fn mirror_to_left_reason(row: &FolderAlignmentRow, action: &SyncAction) -> String {
    match action {
        SyncAction::Copy { .. } if row.left.is_none() => "Right item only exists".to_owned(),
        SyncAction::Copy { .. } => "Right item replaces left item".to_owned(),
        SyncAction::Delete { .. } => "Left item does not exist on right".to_owned(),
        SyncAction::Leave => "Already mirrored".to_owned(),
        SyncAction::Conflict { .. } => "Not used by Mirror to Left".to_owned(),
    }
}

fn joined_path(root: &str, relative_path: &str) -> String {
    VfsPath::new(root).join(relative_path).as_str().to_owned()
}

#[cfg(test)]
mod tests {
    use super::*;
    use folder_core::{FolderAlignmentRow, FolderCompareStatus, FolderScanNode};
    use std::cell::Cell;
    use std::collections::BTreeMap;
    use vfs_core::{VfsEntry, VfsEntryKind, VfsError, VfsMetadata, VfsProvider};

    #[test]
    fn sync_plan_supports_copy_delete_leave_and_conflict_actions() {
        let mut plan = SyncPlan::new("Update right");

        plan.add_item(SyncPlanItem {
            relative_path: "changed.txt".to_owned(),
            action: SyncAction::Copy {
                direction: SyncDirection::LeftToRight,
                source_path: "left/changed.txt".to_owned(),
                target_path: "right/changed.txt".to_owned(),
            },
            reason: "Left file is newer".to_owned(),
        });
        plan.add_item(SyncPlanItem {
            relative_path: "removed.txt".to_owned(),
            action: SyncAction::Delete {
                target_path: "right/removed.txt".to_owned(),
            },
            reason: "Mirror target should remove orphan".to_owned(),
        });
        plan.add_item(SyncPlanItem {
            relative_path: "same.txt".to_owned(),
            action: SyncAction::Leave,
            reason: "Already synchronized".to_owned(),
        });
        plan.add_item(SyncPlanItem {
            relative_path: "conflict.txt".to_owned(),
            action: SyncAction::Conflict {
                left_path: "left/conflict.txt".to_owned(),
                right_path: "right/conflict.txt".to_owned(),
                message: "Both sides changed".to_owned(),
            },
            reason: "Manual resolution required".to_owned(),
        });

        assert_eq!(plan.items.len(), 4);
        assert!(matches!(
            plan.items[0].action,
            SyncAction::Copy {
                direction: SyncDirection::LeftToRight,
                ..
            }
        ));
        assert!(matches!(plan.items[1].action, SyncAction::Delete { .. }));
        assert_eq!(plan.items[2].action, SyncAction::Leave);
        assert!(matches!(plan.items[3].action, SyncAction::Conflict { .. }));
    }

    #[test]
    fn update_right_copies_left_newer_and_left_orphans_to_right() {
        let rows = vec![
            file_row("left-newer.txt", Some(2_000), Some(1_000)),
            left_only_file_row("left-only.txt", 1_500),
            file_row("right-newer.txt", Some(1_000), Some(2_000)),
            file_row("same.txt", Some(1_000), Some(1_000)),
        ];

        let plan = build_update_right_plan("D:/left", "D:/right", &rows);

        assert_eq!(plan.name, "Update Right");
        assert_eq!(plan.items.len(), 4);
        assert_eq!(plan.items[0].relative_path, "left-newer.txt");
        assert_eq!(
            plan.items[0].action,
            SyncAction::Copy {
                direction: SyncDirection::LeftToRight,
                source_path: "D:/left/left-newer.txt".to_owned(),
                target_path: "D:/right/left-newer.txt".to_owned(),
            }
        );
        assert_eq!(plan.items[1].relative_path, "left-only.txt");
        assert_eq!(
            plan.items[1].action,
            SyncAction::Copy {
                direction: SyncDirection::LeftToRight,
                source_path: "D:/left/left-only.txt".to_owned(),
                target_path: "D:/right/left-only.txt".to_owned(),
            }
        );
        assert_eq!(plan.items[2].action, SyncAction::Leave);
        assert_eq!(plan.items[3].action, SyncAction::Leave);
    }

    #[test]
    fn update_left_copies_right_newer_and_right_orphans_to_left() {
        let rows = vec![
            file_row("right-newer.txt", Some(1_000), Some(2_000)),
            right_only_file_row("right-only.txt", 1_500),
            file_row("left-newer.txt", Some(2_000), Some(1_000)),
            file_row("same.txt", Some(1_000), Some(1_000)),
        ];

        let plan = build_update_left_plan("D:/left", "D:/right", &rows);

        assert_eq!(plan.name, "Update Left");
        assert_eq!(plan.items.len(), 4);
        assert_eq!(plan.items[0].relative_path, "right-newer.txt");
        assert_eq!(
            plan.items[0].action,
            SyncAction::Copy {
                direction: SyncDirection::RightToLeft,
                source_path: "D:/right/right-newer.txt".to_owned(),
                target_path: "D:/left/right-newer.txt".to_owned(),
            }
        );
        assert_eq!(plan.items[1].relative_path, "right-only.txt");
        assert_eq!(
            plan.items[1].action,
            SyncAction::Copy {
                direction: SyncDirection::RightToLeft,
                source_path: "D:/right/right-only.txt".to_owned(),
                target_path: "D:/left/right-only.txt".to_owned(),
            }
        );
        assert_eq!(plan.items[2].action, SyncAction::Leave);
        assert_eq!(plan.items[3].action, SyncAction::Leave);
    }

    #[test]
    fn update_both_copies_newer_items_and_orphans_in_both_directions() {
        let rows = vec![
            file_row("left-newer.txt", Some(2_000), Some(1_000)),
            file_row("right-newer.txt", Some(1_000), Some(2_000)),
            left_only_file_row("left-only.txt", 1_500),
            right_only_file_row("right-only.txt", 1_500),
            file_row("same.txt", Some(1_000), Some(1_000)),
        ];

        let plan = build_update_both_plan("D:/left", "D:/right", &rows);

        assert_eq!(plan.name, "Update Both");
        assert_eq!(plan.items.len(), 5);
        assert_eq!(
            plan.items[0].action,
            SyncAction::Copy {
                direction: SyncDirection::LeftToRight,
                source_path: "D:/left/left-newer.txt".to_owned(),
                target_path: "D:/right/left-newer.txt".to_owned(),
            }
        );
        assert_eq!(
            plan.items[1].action,
            SyncAction::Copy {
                direction: SyncDirection::RightToLeft,
                source_path: "D:/right/right-newer.txt".to_owned(),
                target_path: "D:/left/right-newer.txt".to_owned(),
            }
        );
        assert_eq!(
            plan.items[2].action,
            SyncAction::Copy {
                direction: SyncDirection::LeftToRight,
                source_path: "D:/left/left-only.txt".to_owned(),
                target_path: "D:/right/left-only.txt".to_owned(),
            }
        );
        assert_eq!(
            plan.items[3].action,
            SyncAction::Copy {
                direction: SyncDirection::RightToLeft,
                source_path: "D:/right/right-only.txt".to_owned(),
                target_path: "D:/left/right-only.txt".to_owned(),
            }
        );
        assert_eq!(plan.items[4].action, SyncAction::Leave);
    }

    #[test]
    fn mirror_to_right_copies_left_items_and_deletes_right_orphans() {
        let rows = vec![
            file_row("left-newer.txt", Some(2_000), Some(1_000)),
            file_row("right-newer.txt", Some(1_000), Some(2_000)),
            left_only_file_row("left-only.txt", 1_500),
            right_only_file_row("right-only.txt", 1_500),
            file_row("same.txt", Some(1_000), Some(1_000)),
        ];

        let plan = build_mirror_to_right_plan("D:/left", "D:/right", &rows);

        assert_eq!(plan.name, "Mirror to Right");
        assert_eq!(plan.items.len(), 5);
        assert_eq!(
            plan.items[0].action,
            SyncAction::Copy {
                direction: SyncDirection::LeftToRight,
                source_path: "D:/left/left-newer.txt".to_owned(),
                target_path: "D:/right/left-newer.txt".to_owned(),
            }
        );
        assert_eq!(
            plan.items[1].action,
            SyncAction::Copy {
                direction: SyncDirection::LeftToRight,
                source_path: "D:/left/right-newer.txt".to_owned(),
                target_path: "D:/right/right-newer.txt".to_owned(),
            }
        );
        assert_eq!(
            plan.items[2].action,
            SyncAction::Copy {
                direction: SyncDirection::LeftToRight,
                source_path: "D:/left/left-only.txt".to_owned(),
                target_path: "D:/right/left-only.txt".to_owned(),
            }
        );
        assert_eq!(
            plan.items[3].action,
            SyncAction::Delete {
                target_path: "D:/right/right-only.txt".to_owned(),
            }
        );
        assert_eq!(plan.items[4].action, SyncAction::Leave);
    }

    #[test]
    fn mirror_to_left_copies_right_items_and_deletes_left_orphans() {
        let rows = vec![
            file_row("left-newer.txt", Some(2_000), Some(1_000)),
            file_row("right-newer.txt", Some(1_000), Some(2_000)),
            left_only_file_row("left-only.txt", 1_500),
            right_only_file_row("right-only.txt", 1_500),
            file_row("same.txt", Some(1_000), Some(1_000)),
        ];

        let plan = build_mirror_to_left_plan("D:/left", "D:/right", &rows);

        assert_eq!(plan.name, "Mirror to Left");
        assert_eq!(plan.items.len(), 5);
        assert_eq!(
            plan.items[0].action,
            SyncAction::Copy {
                direction: SyncDirection::RightToLeft,
                source_path: "D:/right/left-newer.txt".to_owned(),
                target_path: "D:/left/left-newer.txt".to_owned(),
            }
        );
        assert_eq!(
            plan.items[1].action,
            SyncAction::Copy {
                direction: SyncDirection::RightToLeft,
                source_path: "D:/right/right-newer.txt".to_owned(),
                target_path: "D:/left/right-newer.txt".to_owned(),
            }
        );
        assert_eq!(
            plan.items[2].action,
            SyncAction::Delete {
                target_path: "D:/left/left-only.txt".to_owned(),
            }
        );
        assert_eq!(
            plan.items[3].action,
            SyncAction::Copy {
                direction: SyncDirection::RightToLeft,
                source_path: "D:/right/right-only.txt".to_owned(),
                target_path: "D:/left/right-only.txt".to_owned(),
            }
        );
        assert_eq!(plan.items[4].action, SyncAction::Leave);
    }

    #[test]
    fn executes_sync_plan_copy_overwrite_delete_and_leave_actions() {
        let mut vfs = MemoryVfs::default()
            .with_file("/left/new.txt", b"new")
            .with_file("/left/overwrite.txt", b"left version")
            .with_file("/right/overwrite.txt", b"right version")
            .with_file("/right/delete.txt", b"delete me")
            .with_file("/right/keep.txt", b"keep me");
        let mut plan = SyncPlan::new("Execute plan");

        plan.add_item(SyncPlanItem {
            relative_path: "new.txt".to_owned(),
            action: SyncAction::Copy {
                direction: SyncDirection::LeftToRight,
                source_path: "/left/new.txt".to_owned(),
                target_path: "/right/new.txt".to_owned(),
            },
            reason: "copy".to_owned(),
        });
        plan.add_item(SyncPlanItem {
            relative_path: "overwrite.txt".to_owned(),
            action: SyncAction::Copy {
                direction: SyncDirection::LeftToRight,
                source_path: "/left/overwrite.txt".to_owned(),
                target_path: "/right/overwrite.txt".to_owned(),
            },
            reason: "overwrite".to_owned(),
        });
        plan.add_item(SyncPlanItem {
            relative_path: "delete.txt".to_owned(),
            action: SyncAction::Delete {
                target_path: "/right/delete.txt".to_owned(),
            },
            reason: "delete".to_owned(),
        });
        plan.add_item(SyncPlanItem {
            relative_path: "keep.txt".to_owned(),
            action: SyncAction::Leave,
            reason: "leave".to_owned(),
        });

        let result = execute_sync_plan(&mut vfs, &plan);

        assert_eq!(result.total, 4);
        assert_eq!(result.succeeded, 4);
        assert_eq!(result.failed, 0);
        assert_eq!(vfs.read_bytes("/right/new.txt"), Some(b"new".to_vec()));
        assert_eq!(
            vfs.read_bytes("/right/overwrite.txt"),
            Some(b"left version".to_vec())
        );
        assert_eq!(vfs.read_bytes("/right/delete.txt"), None);
        assert_eq!(vfs.read_bytes("/right/keep.txt"), Some(b"keep me".to_vec()));
        assert!(result.items.iter().all(|item| item.error.is_none()));
    }

    #[test]
    fn sync_execution_reports_progress_and_stops_when_cancelled() {
        let mut vfs = MemoryVfs::default()
            .with_file("/left/one.txt", b"one")
            .with_file("/left/two.txt", b"two")
            .with_file("/left/three.txt", b"three");
        let mut plan = SyncPlan::new("Cancellable plan");

        for name in ["one.txt", "two.txt", "three.txt"] {
            plan.add_item(SyncPlanItem {
                relative_path: name.to_owned(),
                action: SyncAction::Copy {
                    direction: SyncDirection::LeftToRight,
                    source_path: format!("/left/{name}"),
                    target_path: format!("/right/{name}"),
                },
                reason: "copy".to_owned(),
            });
        }

        let mut progress = Vec::new();
        let should_cancel = Cell::new(false);
        let result = execute_sync_plan_with_control(
            &mut vfs,
            &plan,
            |completed, total| {
                progress.push((completed, total));
                should_cancel.set(true);
            },
            || should_cancel.get(),
        );

        assert_eq!(result.total, 3);
        assert_eq!(result.succeeded, 1);
        assert_eq!(result.cancelled, 2);
        assert_eq!(result.failed, 0);
        assert_eq!(progress, vec![(1, 3)]);
        assert_eq!(vfs.read_bytes("/right/one.txt"), Some(b"one".to_vec()));
        assert_eq!(vfs.read_bytes("/right/two.txt"), None);
        assert_eq!(vfs.read_bytes("/right/three.txt"), None);
        assert_eq!(result.items[1].status, SyncExecutionStatus::Cancelled);
    }

    fn file_row(
        relative_path: &str,
        left_modified_at_ms: Option<u128>,
        right_modified_at_ms: Option<u128>,
    ) -> FolderAlignmentRow {
        FolderAlignmentRow {
            relative_path: relative_path.to_owned(),
            depth: 0,
            left: Some(file_node(
                relative_path,
                left_modified_at_ms,
                FolderCompareStatus::Different,
            )),
            right: Some(file_node(
                relative_path,
                right_modified_at_ms,
                FolderCompareStatus::Different,
            )),
        }
    }

    fn left_only_file_row(relative_path: &str, modified_at_ms: u128) -> FolderAlignmentRow {
        FolderAlignmentRow {
            relative_path: relative_path.to_owned(),
            depth: 0,
            left: Some(file_node(
                relative_path,
                Some(modified_at_ms),
                FolderCompareStatus::LeftOnly,
            )),
            right: None,
        }
    }

    fn right_only_file_row(relative_path: &str, modified_at_ms: u128) -> FolderAlignmentRow {
        FolderAlignmentRow {
            relative_path: relative_path.to_owned(),
            depth: 0,
            left: None,
            right: Some(file_node(
                relative_path,
                Some(modified_at_ms),
                FolderCompareStatus::RightOnly,
            )),
        }
    }

    fn file_node(
        relative_path: &str,
        modified_at_ms: Option<u128>,
        status: FolderCompareStatus,
    ) -> FolderScanNode {
        let mut node = FolderScanNode::new_file(
            relative_path,
            relative_path,
            VfsMetadata {
                kind: VfsEntryKind::File,
                name: relative_path.to_owned(),
                extension: relative_path
                    .rsplit_once('.')
                    .map(|(_, extension)| extension.to_owned()),
                size: 1,
                readonly: false,
                created_at_ms: None,
                modified_at_ms,
                accessed_at_ms: None,
            },
        );
        node.status = status;
        node
    }

    #[derive(Default)]
    struct MemoryVfs {
        files: BTreeMap<String, Vec<u8>>,
    }

    impl MemoryVfs {
        fn with_file(mut self, path: &str, bytes: &[u8]) -> Self {
            self.files.insert(path.to_owned(), bytes.to_vec());
            self
        }

        fn read_bytes(&self, path: &str) -> Option<Vec<u8>> {
            self.files.get(path).cloned()
        }
    }

    impl VfsProvider for MemoryVfs {
        fn list(&self, _path: &vfs_core::VfsPath) -> vfs_core::VfsResult<Vec<VfsEntry>> {
            Ok(Vec::new())
        }

        fn read(&self, path: &vfs_core::VfsPath) -> vfs_core::VfsResult<Vec<u8>> {
            self.files
                .get(path.as_str())
                .cloned()
                .ok_or_else(|| VfsError::NotFound(path.clone()))
        }

        fn write(&mut self, path: &vfs_core::VfsPath, bytes: &[u8]) -> vfs_core::VfsResult<()> {
            self.files.insert(path.as_str().to_owned(), bytes.to_vec());

            Ok(())
        }

        fn metadata(&self, path: &vfs_core::VfsPath) -> vfs_core::VfsResult<VfsMetadata> {
            let bytes = self
                .files
                .get(path.as_str())
                .ok_or_else(|| VfsError::NotFound(path.clone()))?;

            Ok(VfsMetadata {
                kind: VfsEntryKind::File,
                name: path
                    .as_str()
                    .rsplit('/')
                    .next()
                    .unwrap_or(path.as_str())
                    .to_owned(),
                extension: None,
                size: bytes.len() as u64,
                readonly: false,
                created_at_ms: None,
                modified_at_ms: None,
                accessed_at_ms: None,
            })
        }

        fn delete(&mut self, path: &vfs_core::VfsPath) -> vfs_core::VfsResult<()> {
            self.files
                .remove(path.as_str())
                .map(|_| ())
                .ok_or_else(|| VfsError::NotFound(path.clone()))
        }
    }
}
