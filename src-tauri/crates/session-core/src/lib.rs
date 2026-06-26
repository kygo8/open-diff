use serde::{Deserialize, Serialize};
use std::collections::BTreeMap;

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
}
