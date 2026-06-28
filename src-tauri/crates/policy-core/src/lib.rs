use serde::{Deserialize, Serialize};
use std::collections::BTreeMap;
use std::fmt::{Display, Formatter};

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

pub trait WindowsRegistryPolicyReader {
    fn read_dword(&self, value_name: &str) -> PolicyResult<Option<u32>>;
}

pub struct WindowsRegistryPolicyLoader;

impl WindowsRegistryPolicyLoader {
    pub fn load(reader: &impl WindowsRegistryPolicyReader) -> PolicyResult<AdminPolicy> {
        let mut policy = AdminPolicy::default();

        for (value_name, capability) in [
            ("DisableSavePasswords", PolicyCapability::SavePasswords),
            ("DisableRemoteProfiles", PolicyCapability::RemoteProfiles),
            ("DisableUpdateChecks", PolicyCapability::UpdateChecks),
        ] {
            if reader.read_dword(value_name)?.unwrap_or_default() != 0 {
                policy = policy.with_capability(capability, PolicyDecision::Deny);
            }
        }

        Ok(policy)
    }
}

#[derive(Debug, Clone, Default)]
pub struct MemoryWindowsRegistryPolicyReader {
    values: BTreeMap<String, u32>,
}

impl MemoryWindowsRegistryPolicyReader {
    pub fn new() -> Self {
        Self::default()
    }

    pub fn with_value(mut self, value_name: impl Into<String>, value: u32) -> Self {
        self.values.insert(value_name.into(), value);

        self
    }
}

impl WindowsRegistryPolicyReader for MemoryWindowsRegistryPolicyReader {
    fn read_dword(&self, value_name: &str) -> PolicyResult<Option<u32>> {
        Ok(self.values.get(value_name).copied())
    }
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub enum PolicyError {
    Backend(String),
    InvalidRegistryValue(String),
}

impl Display for PolicyError {
    fn fmt(&self, formatter: &mut Formatter<'_>) -> std::fmt::Result {
        match self {
            Self::Backend(message) => write!(formatter, "{message}"),
            Self::InvalidRegistryValue(value) => {
                write!(formatter, "invalid registry value: {value}")
            }
        }
    }
}

impl std::error::Error for PolicyError {}

pub type PolicyResult<T> = Result<T, PolicyError>;

#[cfg(windows)]
pub struct HklmWindowsRegistryPolicyReader {
    key_path: String,
}

#[cfg(windows)]
impl HklmWindowsRegistryPolicyReader {
    pub fn new() -> Self {
        Self {
            key_path: "HKLM\\Software\\Policies\\OpenDiff".to_owned(),
        }
    }

    pub fn with_key_path(mut self, key_path: impl Into<String>) -> Self {
        self.key_path = key_path.into();

        self
    }
}

#[cfg(windows)]
impl Default for HklmWindowsRegistryPolicyReader {
    fn default() -> Self {
        Self::new()
    }
}

#[cfg(windows)]
impl WindowsRegistryPolicyReader for HklmWindowsRegistryPolicyReader {
    fn read_dword(&self, value_name: &str) -> PolicyResult<Option<u32>> {
        let output = std::process::Command::new("reg")
            .args(["query", &self.key_path, "/v", value_name])
            .output()
            .map_err(|error| PolicyError::Backend(error.to_string()))?;

        if !output.status.success() {
            return Ok(None);
        }

        let stdout = String::from_utf8_lossy(&output.stdout);
        parse_reg_query_dword(&stdout)
    }
}

#[cfg(windows)]
fn parse_reg_query_dword(output: &str) -> PolicyResult<Option<u32>> {
    let Some(value) = output.split_whitespace().find(|part| {
        part.starts_with("0x") || part.chars().all(|character| character.is_ascii_digit())
    }) else {
        return Ok(None);
    };

    if let Some(hex) = value.strip_prefix("0x") {
        return u32::from_str_radix(hex, 16)
            .map(Some)
            .map_err(|_| PolicyError::InvalidRegistryValue(value.to_owned()));
    }

    value
        .parse::<u32>()
        .map(Some)
        .map_err(|_| PolicyError::InvalidRegistryValue(value.to_owned()))
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

    #[test]
    fn windows_policy_reader_maps_registry_values_to_admin_policy() {
        let reader = MemoryWindowsRegistryPolicyReader::new()
            .with_value("DisableSavePasswords", 1)
            .with_value("DisableRemoteProfiles", 1)
            .with_value("DisableUpdateChecks", 0);

        let policy = WindowsRegistryPolicyLoader::load(&reader).unwrap();

        assert!(!policy.allows(PolicyCapability::SavePasswords));
        assert!(!policy.allows(PolicyCapability::RemoteProfiles));
        assert!(policy.allows(PolicyCapability::UpdateChecks));
    }

    #[test]
    fn windows_policy_reader_defaults_missing_values_to_allow() {
        let reader = MemoryWindowsRegistryPolicyReader::new();

        let policy = WindowsRegistryPolicyLoader::load(&reader).unwrap();

        assert!(policy.allows(PolicyCapability::SavePasswords));
        assert!(policy.allows(PolicyCapability::RemoteProfiles));
        assert!(policy.allows(PolicyCapability::UpdateChecks));
    }
}
