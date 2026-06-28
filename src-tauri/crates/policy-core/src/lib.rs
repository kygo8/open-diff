use serde::{Deserialize, Serialize};
use std::collections::BTreeMap;

#[derive(Debug, Clone, Copy, PartialEq, Eq, PartialOrd, Ord, Serialize, Deserialize)]
#[serde(rename_all = "kebab-case")]
pub enum PolicyCapability {
    SavePasswords,
    RemoteProfiles,
    UpdateChecks,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "kebab-case")]
pub enum PolicyDecision {
    Allow,
    Deny,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AdminPolicy {
    capabilities: BTreeMap<PolicyCapability, PolicyDecision>,
}

impl Default for AdminPolicy {
    fn default() -> Self {
        Self {
            capabilities: PolicyCapability::all()
                .into_iter()
                .map(|capability| (capability, PolicyDecision::Allow))
                .collect(),
        }
    }
}

impl AdminPolicy {
    pub fn with_capability(
        mut self,
        capability: PolicyCapability,
        decision: PolicyDecision,
    ) -> Self {
        self.capabilities.insert(capability, decision);

        self
    }

    pub fn decision_for(&self, capability: PolicyCapability) -> PolicyDecision {
        self.capabilities
            .get(&capability)
            .copied()
            .unwrap_or(PolicyDecision::Allow)
    }

    pub fn allows(&self, capability: PolicyCapability) -> bool {
        self.decision_for(capability) == PolicyDecision::Allow
    }

    pub fn merge(policies: impl IntoIterator<Item = AdminPolicy>) -> Self {
        let mut merged = Self::default();

        for policy in policies {
            for capability in PolicyCapability::all() {
                if policy.decision_for(capability) == PolicyDecision::Deny {
                    merged = merged.with_capability(capability, PolicyDecision::Deny);
                }
            }
        }

        merged
    }
}

impl PolicyCapability {
    pub fn all() -> [Self; 3] {
        [
            Self::SavePasswords,
            Self::RemoteProfiles,
            Self::UpdateChecks,
        ]
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn default_admin_policy_allows_user_managed_features() {
        let policy = AdminPolicy::default();

        assert!(policy.allows(PolicyCapability::SavePasswords));
        assert!(policy.allows(PolicyCapability::RemoteProfiles));
        assert!(policy.allows(PolicyCapability::UpdateChecks));
    }

    #[test]
    fn admin_policy_can_disable_enterprise_sensitive_features() {
        let policy = AdminPolicy::default()
            .with_capability(PolicyCapability::SavePasswords, PolicyDecision::Deny)
            .with_capability(PolicyCapability::RemoteProfiles, PolicyDecision::Deny)
            .with_capability(PolicyCapability::UpdateChecks, PolicyDecision::Deny);

        assert!(!policy.allows(PolicyCapability::SavePasswords));
        assert!(!policy.allows(PolicyCapability::RemoteProfiles));
        assert!(!policy.allows(PolicyCapability::UpdateChecks));
        assert_eq!(
            policy.decision_for(PolicyCapability::RemoteProfiles),
            PolicyDecision::Deny
        );
    }

    #[test]
    fn admin_policy_merge_keeps_most_restrictive_decision() {
        let local = AdminPolicy::default()
            .with_capability(PolicyCapability::RemoteProfiles, PolicyDecision::Allow);
        let managed = AdminPolicy::default()
            .with_capability(PolicyCapability::RemoteProfiles, PolicyDecision::Deny);

        let merged = AdminPolicy::merge([local, managed]);

        assert!(!merged.allows(PolicyCapability::RemoteProfiles));
    }
}
