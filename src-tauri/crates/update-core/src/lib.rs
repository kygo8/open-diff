use policy_core::{AdminPolicy, PolicyCapability};
use serde::{Deserialize, Serialize};
use std::fmt::{Display, Formatter};

#[derive(Debug, Clone, Copy, PartialEq, Eq, PartialOrd, Ord, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UpdateVersion {
    pub major: u16,
    pub minor: u16,
    pub patch: u16,
}

impl UpdateVersion {
    pub fn parse(value: &str) -> Result<Self, UpdateVersionParseError> {
        let parts: Vec<&str> = value.split('.').collect();

        if parts.len() != 3 {
            return Err(UpdateVersionParseError::InvalidFormat(value.to_owned()));
        }

        Ok(Self {
            major: parse_version_part(parts[0], value)?,
            minor: parse_version_part(parts[1], value)?,
            patch: parse_version_part(parts[2], value)?,
        })
    }
}

impl Display for UpdateVersion {
    fn fmt(&self, formatter: &mut Formatter<'_>) -> std::fmt::Result {
        write!(formatter, "{}.{}.{}", self.major, self.minor, self.patch)
    }
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub enum UpdateVersionParseError {
    InvalidFormat(String),
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum UpdatePlatform {
    Windows,
    Macos,
    Linux,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum UpdateChannel {
    Stable,
    Beta,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UpdateCheckRequest {
    pub current_version: UpdateVersion,
    pub platform: UpdatePlatform,
    pub channel: UpdateChannel,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UpdateRelease {
    pub version: UpdateVersion,
    pub download_url: String,
    pub notes: String,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum UpdateCheckStatus {
    UpdateAvailable,
    UpToDate,
    NoReleaseInfo,
    BlockedByPolicy,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UpdateCheckResult {
    pub status: UpdateCheckStatus,
    pub current_version: UpdateVersion,
    pub latest_version: Option<UpdateVersion>,
    pub download_url: Option<String>,
    pub notes: Option<String>,
}

pub fn evaluate_update_check(
    request: UpdateCheckRequest,
    release: Option<UpdateRelease>,
    policy: &AdminPolicy,
) -> UpdateCheckResult {
    if !policy.allows(PolicyCapability::UpdateChecks) {
        return UpdateCheckResult {
            status: UpdateCheckStatus::BlockedByPolicy,
            current_version: request.current_version,
            latest_version: None,
            download_url: None,
            notes: None,
        };
    }

    let Some(release) = release else {
        return UpdateCheckResult {
            status: UpdateCheckStatus::NoReleaseInfo,
            current_version: request.current_version,
            latest_version: None,
            download_url: None,
            notes: None,
        };
    };

    if release.version > request.current_version {
        return UpdateCheckResult {
            status: UpdateCheckStatus::UpdateAvailable,
            current_version: request.current_version,
            latest_version: Some(release.version),
            download_url: Some(release.download_url),
            notes: Some(release.notes),
        };
    }

    UpdateCheckResult {
        status: UpdateCheckStatus::UpToDate,
        current_version: request.current_version,
        latest_version: Some(release.version),
        download_url: None,
        notes: Some(release.notes),
    }
}

fn parse_version_part(part: &str, original: &str) -> Result<u16, UpdateVersionParseError> {
    part.parse::<u16>()
        .map_err(|_| UpdateVersionParseError::InvalidFormat(original.to_owned()))
}

#[cfg(test)]
mod tests {
    use super::*;
    use policy_core::{AdminPolicy, PolicyCapability, PolicyDecision};

    #[test]
    fn update_check_reports_available_release_when_policy_allows() {
        let result = evaluate_update_check(
            UpdateCheckRequest {
                current_version: UpdateVersion::parse("1.0.0").unwrap(),
                platform: UpdatePlatform::Windows,
                channel: UpdateChannel::Stable,
            },
            Some(UpdateRelease {
                version: UpdateVersion::parse("1.1.0").unwrap(),
                download_url: "https://example.com/open-diff-1.1.0.msi".to_owned(),
                notes: "Bug fixes".to_owned(),
            }),
            &AdminPolicy::default(),
        );

        assert_eq!(result.status, UpdateCheckStatus::UpdateAvailable);
        assert_eq!(result.latest_version.unwrap().to_string(), "1.1.0");
        assert_eq!(
            result.download_url.as_deref(),
            Some("https://example.com/open-diff-1.1.0.msi")
        );
    }

    #[test]
    fn update_check_can_be_disabled_by_admin_policy() {
        let policy = AdminPolicy::default()
            .with_capability(PolicyCapability::UpdateChecks, PolicyDecision::Deny);
        let result = evaluate_update_check(
            UpdateCheckRequest {
                current_version: UpdateVersion::parse("1.0.0").unwrap(),
                platform: UpdatePlatform::Windows,
                channel: UpdateChannel::Stable,
            },
            Some(UpdateRelease {
                version: UpdateVersion::parse("1.1.0").unwrap(),
                download_url: "https://example.com/open-diff-1.1.0.msi".to_owned(),
                notes: "Bug fixes".to_owned(),
            }),
            &policy,
        );

        assert_eq!(result.status, UpdateCheckStatus::BlockedByPolicy);
        assert!(result.download_url.is_none());
    }
}
