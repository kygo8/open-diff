use format_core::FileFormatDefinition;
use remote_core::RemoteProfile;
use serde::{Deserialize, Serialize};
use session_core::SessionDocument;

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SettingsPackageManifest {
    pub schema_version: u16,
    pub name: String,
}

impl SettingsPackageManifest {
    pub fn new(name: impl Into<String>) -> Self {
        Self {
            schema_version: 1,
            name: name.into(),
        }
    }
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SettingsColor {
    pub token: String,
    pub value: String,
}

impl SettingsColor {
    pub fn new(token: impl Into<String>, value: impl Into<String>) -> Self {
        Self {
            token: token.into(),
            value: value.into(),
        }
    }
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SettingsShortcut {
    pub command_id: String,
    pub accelerator: String,
}

impl SettingsShortcut {
    pub fn new(command_id: impl Into<String>, accelerator: impl Into<String>) -> Self {
        Self {
            command_id: command_id.into(),
            accelerator: accelerator.into(),
        }
    }
}

#[derive(Debug, Clone, Default, PartialEq, Eq)]
pub struct SettingsExportInput {
    pub sessions: Vec<SessionDocument>,
    pub file_formats: Vec<FileFormatDefinition>,
    pub remote_profiles: Vec<RemoteProfile>,
    pub colors: Vec<SettingsColor>,
    pub shortcuts: Vec<SettingsShortcut>,
}

impl SettingsExportInput {
    pub fn new() -> Self {
        Self::default()
    }

    pub fn with_sessions(mut self, sessions: Vec<SessionDocument>) -> Self {
        self.sessions = sessions;

        self
    }

    pub fn with_file_formats(mut self, file_formats: Vec<FileFormatDefinition>) -> Self {
        self.file_formats = file_formats;

        self
    }

    pub fn with_remote_profiles(mut self, remote_profiles: Vec<RemoteProfile>) -> Self {
        self.remote_profiles = remote_profiles;

        self
    }

    pub fn with_colors(mut self, colors: Vec<SettingsColor>) -> Self {
        self.colors = colors;

        self
    }

    pub fn with_shortcuts(mut self, shortcuts: Vec<SettingsShortcut>) -> Self {
        self.shortcuts = shortcuts;

        self
    }
}

#[derive(Debug, Clone, Copy, Default, PartialEq, Eq)]
pub struct SettingsExportSelection {
    pub sessions: bool,
    pub file_formats: bool,
    pub remote_profiles: bool,
    pub colors: bool,
    pub shortcuts: bool,
}

impl SettingsExportSelection {
    pub fn new() -> Self {
        Self::default()
    }

    pub fn all() -> Self {
        Self {
            sessions: true,
            file_formats: true,
            remote_profiles: true,
            colors: true,
            shortcuts: true,
        }
    }

    pub fn include_sessions(mut self, enabled: bool) -> Self {
        self.sessions = enabled;

        self
    }

    pub fn include_file_formats(mut self, enabled: bool) -> Self {
        self.file_formats = enabled;

        self
    }

    pub fn include_remote_profiles(mut self, enabled: bool) -> Self {
        self.remote_profiles = enabled;

        self
    }

    pub fn include_colors(mut self, enabled: bool) -> Self {
        self.colors = enabled;

        self
    }

    pub fn include_shortcuts(mut self, enabled: bool) -> Self {
        self.shortcuts = enabled;

        self
    }
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SettingsPackage {
    pub manifest: SettingsPackageManifest,
    pub sessions: Vec<SessionDocument>,
    pub file_formats: Vec<FileFormatDefinition>,
    pub remote_profiles: Vec<RemoteProfile>,
    pub colors: Vec<SettingsColor>,
    pub shortcuts: Vec<SettingsShortcut>,
}

impl SettingsPackage {
    pub fn new(name: impl Into<String>) -> Self {
        Self {
            manifest: SettingsPackageManifest::new(name),
            sessions: Vec::new(),
            file_formats: Vec::new(),
            remote_profiles: Vec::new(),
            colors: Vec::new(),
            shortcuts: Vec::new(),
        }
    }

    pub fn is_empty(&self) -> bool {
        self.sessions.is_empty()
            && self.file_formats.is_empty()
            && self.remote_profiles.is_empty()
            && self.colors.is_empty()
            && self.shortcuts.is_empty()
    }
}

pub struct SettingsPackageExporter;

impl SettingsPackageExporter {
    pub fn export(
        input: SettingsExportInput,
        selection: SettingsExportSelection,
    ) -> SettingsPackage {
        let mut package = SettingsPackage::new("open-diff-settings");

        if selection.sessions {
            package.sessions = input.sessions;
        }

        if selection.file_formats {
            package.file_formats = input.file_formats;
        }

        if selection.remote_profiles {
            package.remote_profiles = input.remote_profiles;
        }

        if selection.colors {
            package.colors = input.colors;
        }

        if selection.shortcuts {
            package.shortcuts = input.shortcuts;
        }

        package
    }
}

pub struct SettingsPackageImporter;

impl SettingsPackageImporter {
    pub fn validate(package: &SettingsPackage) -> SettingsPackageResult<()> {
        if package.manifest.schema_version != 1 {
            return Err(SettingsPackageError::UnsupportedSchemaVersion(
                package.manifest.schema_version,
            ));
        }

        if package.is_empty() {
            return Err(SettingsPackageError::EmptyPackage);
        }

        Ok(())
    }
}

pub struct SettingsPackageStore;

impl SettingsPackageStore {
    pub fn save_to_bytes(package: &SettingsPackage) -> SettingsPackageResult<Vec<u8>> {
        SettingsPackageImporter::validate(package)?;

        serde_json::to_vec_pretty(package)
            .map_err(|error| SettingsPackageError::Serialization(error.to_string()))
    }

    pub fn load_from_bytes(bytes: &[u8]) -> SettingsPackageResult<SettingsPackage> {
        let package = serde_json::from_slice(bytes)
            .map_err(|error| SettingsPackageError::Serialization(error.to_string()))?;

        SettingsPackageImporter::validate(&package)?;

        Ok(package)
    }
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub enum SettingsPackageError {
    EmptyPackage,
    UnsupportedSchemaVersion(u16),
    Serialization(String),
}

pub type SettingsPackageResult<T> = Result<T, SettingsPackageError>;

#[cfg(test)]
mod tests {
    use super::*;
    use format_core::{
        FileFormatDefinition, FileFormatMatcher, FileFormatRuleRefs, FileFormatView,
    };
    use remote_core::{CredentialReference, RemoteEndpoint, RemoteProfile, RemoteProtocol};
    use session_core::{SessionDocument, SessionLocation, SessionLocations, SessionType};

    #[test]
    fn settings_exporter_includes_only_selected_categories() {
        let input = SettingsExportInput::new()
            .with_sessions(vec![sample_session()])
            .with_file_formats(vec![sample_file_format()])
            .with_remote_profiles(vec![sample_remote_profile()])
            .with_colors(vec![SettingsColor::new("diff.added", "#d1fae5")])
            .with_shortcuts(vec![SettingsShortcut::new("diff.next", "F7")]);
        let selection = SettingsExportSelection::new()
            .include_sessions(true)
            .include_file_formats(true)
            .include_remote_profiles(false)
            .include_colors(true)
            .include_shortcuts(false);

        let package = SettingsPackageExporter::export(input, selection);

        assert_eq!(package.sessions.len(), 1);
        assert_eq!(package.file_formats.len(), 1);
        assert!(package.remote_profiles.is_empty());
        assert_eq!(package.colors[0].token, "diff.added");
        assert!(package.shortcuts.is_empty());
        assert_eq!(package.manifest.schema_version, 1);
    }

    #[test]
    fn settings_package_round_trips_as_stable_json() {
        let package = SettingsPackageExporter::export(
            SettingsExportInput::new()
                .with_sessions(vec![sample_session()])
                .with_remote_profiles(vec![sample_remote_profile()])
                .with_shortcuts(vec![SettingsShortcut::new("open.settings", "Ctrl+,")]),
            SettingsExportSelection::all(),
        );

        let bytes = SettingsPackageStore::save_to_bytes(&package).unwrap();
        let restored = SettingsPackageStore::load_from_bytes(&bytes).unwrap();

        assert_eq!(restored.sessions[0].id, "session-1");
        assert_eq!(restored.remote_profiles[0].id, "release-sftp");
        assert_eq!(restored.shortcuts[0].command_id, "open.settings");
    }

    #[test]
    fn settings_importer_rejects_empty_packages() {
        let package = SettingsPackage::new("empty");

        let error = SettingsPackageImporter::validate(&package).unwrap_err();

        assert!(matches!(error, SettingsPackageError::EmptyPackage));
    }

    fn sample_session() -> SessionDocument {
        SessionDocument::new(
            "session-1",
            "Compare release notes",
            SessionType::TextCompare,
            SessionLocations::two_way(
                SessionLocation::local_path("left.md"),
                SessionLocation::local_path("right.md"),
            ),
        )
    }

    fn sample_file_format() -> FileFormatDefinition {
        FileFormatDefinition {
            id: "markdown".to_owned(),
            name: "Markdown".to_owned(),
            priority: 80,
            default_view: FileFormatView::TextCompare,
            matchers: vec![FileFormatMatcher::Extension("md".to_owned())],
            rule_refs: FileFormatRuleRefs::default(),
            built_in: false,
        }
    }

    fn sample_remote_profile() -> RemoteProfile {
        RemoteProfile::new(
            "release-sftp",
            "Release SFTP",
            RemoteProtocol::Sftp,
            RemoteEndpoint::new("sftp.example.com").with_port(22),
            CredentialReference::profile_store("release-sftp"),
        )
    }
}
