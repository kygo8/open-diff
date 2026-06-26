use serde::{Deserialize, Serialize};
use std::collections::BTreeMap;
use std::fmt::{Display, Formatter};
use std::path::{Path, PathBuf};

#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq, PartialOrd, Ord)]
#[serde(rename_all = "kebab-case")]
pub enum SessionType {
    FolderCompare,
    FolderMerge,
    FolderSync,
    TextCompare,
    TextMerge,
    TableCompare,
    HexCompare,
    PictureCompare,
    RegistryCompare,
    TextEdit,
    TextPatch,
    MediaCompare,
    VersionCompare,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct SessionDocument {
    pub id: String,
    pub name: String,
    pub session_type: SessionType,
    pub locations: SessionLocations,
    pub view: SessionViewState,
    pub rules: SessionRules,
    pub metadata: SessionMetadata,
}

impl SessionDocument {
    pub fn new(
        id: impl Into<String>,
        name: impl Into<String>,
        session_type: SessionType,
        locations: SessionLocations,
    ) -> Self {
        Self {
            id: id.into(),
            name: name.into(),
            session_type,
            locations,
            view: SessionViewState::default(),
            rules: SessionRules::default(),
            metadata: SessionMetadata::default(),
        }
    }

    pub fn mark_dirty(&mut self) {
        if !self.metadata.locked {
            self.metadata.dirty = true;
        }
    }

    pub fn apply_shared_read_only(&mut self) {
        self.metadata.shared = true;
        self.metadata.locked = true;
        self.metadata.dirty = false;
        self.locations.mark_all_read_only();
    }
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq, Default)]
#[serde(rename_all = "camelCase")]
pub struct SessionLocations {
    pub left: Option<SessionLocation>,
    pub right: Option<SessionLocation>,
    pub center: Option<SessionLocation>,
    pub output: Option<SessionLocation>,
}

impl SessionLocations {
    pub fn two_way(left: SessionLocation, right: SessionLocation) -> Self {
        Self {
            left: Some(left),
            right: Some(right),
            center: None,
            output: None,
        }
    }

    pub fn mark_all_read_only(&mut self) {
        if let Some(location) = &mut self.left {
            location.read_only = true;
        }

        if let Some(location) = &mut self.right {
            location.read_only = true;
        }

        if let Some(location) = &mut self.center {
            location.read_only = true;
        }

        if let Some(location) = &mut self.output {
            location.read_only = true;
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct SessionLocation {
    pub uri: String,
    pub display_name: Option<String>,
    pub read_only: bool,
}

impl SessionLocation {
    pub fn local_path(path: impl Into<String>) -> Self {
        Self {
            uri: path.into(),
            display_name: None,
            read_only: false,
        }
    }
}

#[derive(Debug, Clone)]
pub struct SessionStore {
    root: PathBuf,
}

impl SessionStore {
    pub fn new(root: impl AsRef<Path>) -> Self {
        Self {
            root: root.as_ref().to_path_buf(),
        }
    }

    pub fn save_named(
        &self,
        name: impl AsRef<str>,
        session: &SessionDocument,
    ) -> Result<PathBuf, SessionStoreError> {
        let path = self.named_session_path(name.as_ref())?;

        if let Some(parent) = path.parent() {
            std::fs::create_dir_all(parent)?;
        }

        let json = serde_json::to_string_pretty(session)?;
        std::fs::write(&path, json)?;

        Ok(path)
    }

    pub fn load_named(&self, name: impl AsRef<str>) -> Result<SessionDocument, SessionStoreError> {
        let path = self.named_session_path(name.as_ref())?;
        let json = std::fs::read_to_string(path)?;

        Ok(serde_json::from_str(&json)?)
    }

    pub fn save_auto_saved_sessions(
        &self,
        sessions: &[SessionDocument],
    ) -> Result<PathBuf, SessionStoreError> {
        let path = self.auto_save_path();

        if let Some(parent) = path.parent() {
            std::fs::create_dir_all(parent)?;
        }

        let auto_saved: Vec<SessionDocument> = sessions
            .iter()
            .cloned()
            .map(|mut session| {
                session.metadata.auto_saved = true;
                session
            })
            .collect();
        let json = serde_json::to_string_pretty(&auto_saved)?;
        std::fs::write(&path, json)?;

        Ok(path)
    }

    pub fn load_auto_saved_sessions(&self) -> Result<Vec<SessionDocument>, SessionStoreError> {
        let path = self.auto_save_path();

        if !path.exists() {
            return Ok(Vec::new());
        }

        let json = std::fs::read_to_string(path)?;

        Ok(serde_json::from_str(&json)?)
    }

    pub fn load_shared_file(path: impl AsRef<Path>) -> Result<SessionDocument, SessionStoreError> {
        let json = std::fs::read_to_string(path)?;
        let mut session: SessionDocument = serde_json::from_str(&json)?;

        session.apply_shared_read_only();

        Ok(session)
    }

    pub fn save_workspace(
        &self,
        workspace: &WorkspaceDocument,
    ) -> Result<PathBuf, SessionStoreError> {
        let path = self.workspace_path();

        if let Some(parent) = path.parent() {
            std::fs::create_dir_all(parent)?;
        }

        let json = serde_json::to_string_pretty(workspace)?;
        std::fs::write(&path, json)?;

        Ok(path)
    }

    pub fn load_workspace(&self) -> Result<Option<WorkspaceDocument>, SessionStoreError> {
        let path = self.workspace_path();

        if !path.exists() {
            return Ok(None);
        }

        let json = std::fs::read_to_string(path)?;

        Ok(Some(serde_json::from_str(&json)?))
    }

    pub fn named_session_path(&self, name: &str) -> Result<PathBuf, SessionStoreError> {
        let mut path = self.root.join("sessions");
        let segments = sanitized_name_segments(name)?;

        for segment in segments {
            path.push(segment);
        }

        path.set_extension("open-diff-session.json");

        Ok(path)
    }

    pub fn auto_save_path(&self) -> PathBuf {
        self.root.join("autosave").join("recent-sessions.json")
    }

    pub fn workspace_path(&self) -> PathBuf {
        self.root.join("workspace").join("current-workspace.json")
    }
}

#[derive(Debug)]
pub enum SessionStoreError {
    EmptyName,
    InvalidName(String),
    Io(std::io::Error),
    Json(serde_json::Error),
}

impl Display for SessionStoreError {
    fn fmt(&self, formatter: &mut Formatter<'_>) -> std::fmt::Result {
        match self {
            Self::EmptyName => write!(formatter, "session name cannot be empty"),
            Self::InvalidName(name) => {
                write!(formatter, "session name contains invalid segment: {name}")
            }
            Self::Io(error) => write!(formatter, "{error}"),
            Self::Json(error) => write!(formatter, "{error}"),
        }
    }
}

impl std::error::Error for SessionStoreError {}

impl From<std::io::Error> for SessionStoreError {
    fn from(error: std::io::Error) -> Self {
        Self::Io(error)
    }
}

impl From<serde_json::Error> for SessionStoreError {
    fn from(error: serde_json::Error) -> Self {
        Self::Json(error)
    }
}

fn sanitized_name_segments(name: &str) -> Result<Vec<String>, SessionStoreError> {
    let mut segments = Vec::new();

    for raw_segment in name.split(['/', '\\']) {
        let segment = raw_segment.trim();

        if segment.is_empty() {
            continue;
        }

        if segment == "." || segment == ".." {
            return Err(SessionStoreError::InvalidName(segment.to_string()));
        }

        let sanitized: String = segment
            .chars()
            .map(|character| match character {
                '<' | '>' | ':' | '"' | '|' | '?' | '*' => '_',
                _ => character,
            })
            .collect();

        segments.push(sanitized);
    }

    if segments.is_empty() {
        return Err(SessionStoreError::EmptyName);
    }

    Ok(segments)
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "kebab-case")]
pub enum SessionLayout {
    SideBySide,
    Stacked,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct SessionViewState {
    pub layout: SessionLayout,
    pub show_equal: bool,
    pub show_different: bool,
    pub show_unimportant: bool,
    pub context_lines: u16,
    pub selected_path: Option<String>,
    pub scroll_anchor: Option<String>,
}

impl Default for SessionViewState {
    fn default() -> Self {
        Self {
            layout: SessionLayout::SideBySide,
            show_equal: true,
            show_different: true,
            show_unimportant: true,
            context_lines: 3,
            selected_path: None,
            scroll_anchor: None,
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq, Default)]
#[serde(rename_all = "camelCase")]
pub struct SessionRules {
    pub file_format_id: Option<String>,
    pub profile_id: Option<String>,
    pub filters: Vec<String>,
    pub comparison: BTreeMap<String, String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq, Default)]
#[serde(rename_all = "camelCase")]
pub struct SessionMetadata {
    pub description: Option<String>,
    pub folder: Option<String>,
    pub locked: bool,
    pub dirty: bool,
    pub auto_saved: bool,
    pub shared: bool,
    pub created_at: Option<String>,
    pub updated_at: Option<String>,
    pub last_opened_at: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct WorkspaceDocument {
    pub id: String,
    pub tabs: Vec<WorkspaceTab>,
    pub active_tab_id: String,
    pub sessions: Vec<SessionDocument>,
    pub window: WorkspaceWindow,
}

impl WorkspaceDocument {
    pub fn new(
        id: impl Into<String>,
        tabs: Vec<WorkspaceTab>,
        active_tab_id: impl Into<String>,
        sessions: Vec<SessionDocument>,
    ) -> Self {
        Self {
            id: id.into(),
            tabs,
            active_tab_id: active_tab_id.into(),
            sessions,
            window: WorkspaceWindow::default(),
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct WorkspaceTab {
    pub id: String,
    pub route: String,
    pub session_id: Option<String>,
}

impl WorkspaceTab {
    pub fn new(
        id: impl Into<String>,
        route: impl Into<String>,
        session_id: Option<String>,
    ) -> Self {
        Self {
            id: id.into(),
            route: route.into(),
            session_id,
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct WorkspaceWindow {
    pub width: u32,
    pub height: u32,
    pub maximized: bool,
}

impl Default for WorkspaceWindow {
    fn default() -> Self {
        Self {
            width: 1280,
            height: 820,
            maximized: false,
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn creates_two_way_text_session_with_default_view_state() {
        let session = SessionDocument::new(
            "session-1",
            "Compare files",
            SessionType::TextCompare,
            SessionLocations::two_way(
                SessionLocation::local_path("left.txt"),
                SessionLocation::local_path("right.txt"),
            ),
        );

        assert_eq!(session.session_type, SessionType::TextCompare);
        assert_eq!(session.view.layout, SessionLayout::SideBySide);
        assert_eq!(session.view.context_lines, 3);
        assert!(!session.metadata.dirty);
        assert_eq!(
            session
                .locations
                .left
                .as_ref()
                .map(|location| location.uri.as_str()),
            Some("left.txt")
        );
    }

    #[test]
    fn marks_unlocked_session_dirty() {
        let mut session = SessionDocument::new(
            "session-1",
            "Compare files",
            SessionType::TextCompare,
            SessionLocations::default(),
        );

        session.mark_dirty();

        assert!(session.metadata.dirty);
    }

    #[test]
    fn does_not_mark_locked_session_dirty() {
        let mut session = SessionDocument::new(
            "session-1",
            "Compare files",
            SessionType::TextCompare,
            SessionLocations::default(),
        );
        session.metadata.locked = true;

        session.mark_dirty();

        assert!(!session.metadata.dirty);
    }

    #[test]
    fn saves_reads_and_overwrites_named_session_file() {
        let root = unique_temp_dir("named-session");
        let store = SessionStore::new(&root);
        let mut session = SessionDocument::new(
            "session-1",
            "Compare files",
            SessionType::TextCompare,
            SessionLocations::two_way(
                SessionLocation::local_path("left.txt"),
                SessionLocation::local_path("right.txt"),
            ),
        );

        store.save_named("folder/compare-files", &session).unwrap();
        let saved = store.load_named("folder/compare-files").unwrap();
        assert_eq!(saved, session);

        session.name = "Updated compare".to_string();
        store.save_named("folder/compare-files", &session).unwrap();

        assert_eq!(
            store.load_named("folder/compare-files").unwrap().name,
            "Updated compare"
        );

        std::fs::remove_dir_all(root).unwrap();
    }

    #[test]
    fn saves_and_reads_auto_saved_session_list() {
        let root = unique_temp_dir("auto-save");
        let store = SessionStore::new(&root);
        let mut first = SessionDocument::new(
            "session-1",
            "First",
            SessionType::TextCompare,
            SessionLocations::default(),
        );
        let second = SessionDocument::new(
            "session-2",
            "Second",
            SessionType::FolderCompare,
            SessionLocations::default(),
        );

        first.metadata.dirty = true;
        store
            .save_auto_saved_sessions(&[first.clone(), second.clone()])
            .unwrap();

        let restored = store.load_auto_saved_sessions().unwrap();

        assert_eq!(restored.len(), 2);
        assert_eq!(restored[0].id, "session-1");
        assert!(restored[0].metadata.auto_saved);
        assert!(restored[1].metadata.auto_saved);

        std::fs::remove_dir_all(root).unwrap();
    }

    #[test]
    fn loads_shared_session_as_read_only_model() {
        let root = unique_temp_dir("shared-session");
        let store = SessionStore::new(&root);
        let session = SessionDocument::new(
            "shared-1",
            "Shared review",
            SessionType::FolderCompare,
            SessionLocations::two_way(
                SessionLocation::local_path("left"),
                SessionLocation::local_path("right"),
            ),
        );
        let path = store.save_named("team/shared-review", &session).unwrap();

        let shared = SessionStore::load_shared_file(&path).unwrap();

        assert!(shared.metadata.shared);
        assert!(shared.metadata.locked);
        assert!(shared
            .locations
            .left
            .as_ref()
            .is_some_and(|location| location.read_only));
        assert!(shared
            .locations
            .right
            .as_ref()
            .is_some_and(|location| location.read_only));

        std::fs::remove_dir_all(root).unwrap();
    }

    #[test]
    fn saves_and_reads_workspace_with_tabs_and_sessions() {
        let root = unique_temp_dir("workspace");
        let store = SessionStore::new(&root);
        let session = SessionDocument::new(
            "session-1",
            "Compare files",
            SessionType::TextCompare,
            SessionLocations::default(),
        );
        let workspace = WorkspaceDocument::new(
            "workspace-1",
            vec![
                WorkspaceTab::new("home", "/", None),
                WorkspaceTab::new("tab-1", "/compare/text", Some("session-1".to_string())),
            ],
            "tab-1",
            vec![session],
        );

        store.save_workspace(&workspace).unwrap();

        let restored = store.load_workspace().unwrap().unwrap();

        assert_eq!(restored.id, "workspace-1");
        assert_eq!(restored.active_tab_id, "tab-1");
        assert_eq!(restored.tabs.len(), 2);
        assert_eq!(restored.sessions[0].id, "session-1");

        std::fs::remove_dir_all(root).unwrap();
    }

    fn unique_temp_dir(label: &str) -> std::path::PathBuf {
        let mut path = std::env::temp_dir();
        path.push(format!(
            "open-diff-{label}-{}",
            std::time::SystemTime::now()
                .duration_since(std::time::UNIX_EPOCH)
                .unwrap()
                .as_nanos()
        ));

        path
    }
}
