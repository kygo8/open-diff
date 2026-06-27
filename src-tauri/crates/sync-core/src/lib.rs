use serde::{Deserialize, Serialize};

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

#[cfg(test)]
mod tests {
    use super::*;

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
}
