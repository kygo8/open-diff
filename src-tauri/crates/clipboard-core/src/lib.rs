use serde::{Deserialize, Serialize};
use shared_types::TextDiffRequest;
use std::collections::VecDeque;
use std::fmt;

#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq, PartialOrd, Ord, Hash)]
#[serde(transparent)]
pub struct ClipboardEntryId(pub u64);

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct ClipboardHistoryEntry {
    pub id: ClipboardEntryId,
    pub sequence: u64,
    pub title: String,
    pub text: String,
    pub character_count: usize,
    pub line_count: usize,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub enum ClipboardReadError {
    Unavailable(String),
    Failed(String),
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub enum ClipboardCompareError {
    EntryNotFound(ClipboardEntryId),
}

pub trait ClipboardTextReader {
    fn read_text(&mut self) -> Result<Option<String>, ClipboardReadError>;
}

#[derive(Debug, Clone)]
pub struct ClipboardHistory {
    entries: VecDeque<ClipboardHistoryEntry>,
    capacity: usize,
    next_id: u64,
    next_sequence: u64,
}

impl ClipboardHistory {
    pub fn new(capacity: usize) -> Self {
        Self {
            entries: VecDeque::new(),
            capacity: capacity.max(1),
            next_id: 1,
            next_sequence: 1,
        }
    }

    pub fn push_text(
        &mut self,
        text: impl Into<String>,
    ) -> Result<Option<ClipboardHistoryEntry>, ClipboardReadError> {
        let text = text.into();

        if text.trim().is_empty() {
            return Ok(None);
        }

        if self.entries.front().is_some_and(|entry| entry.text == text) {
            return Ok(None);
        }

        let entry = ClipboardHistoryEntry {
            id: ClipboardEntryId(self.next_id),
            sequence: self.next_sequence,
            title: format!("Clipboard {}", self.next_sequence),
            character_count: text.chars().count(),
            line_count: count_lines(&text),
            text,
        };

        self.next_id += 1;
        self.next_sequence += 1;
        self.entries.push_front(entry.clone());

        while self.entries.len() > self.capacity {
            self.entries.pop_back();
        }

        Ok(Some(entry))
    }

    pub fn entries(&self) -> &[ClipboardHistoryEntry] {
        self.entries.as_slices().0
    }

    pub fn build_text_diff_request(
        &self,
        left_id: ClipboardEntryId,
        right_id: ClipboardEntryId,
    ) -> Result<TextDiffRequest, ClipboardCompareError> {
        let left = self
            .entry(left_id)
            .ok_or(ClipboardCompareError::EntryNotFound(left_id))?;
        let right = self
            .entry(right_id)
            .ok_or(ClipboardCompareError::EntryNotFound(right_id))?;

        Ok(TextDiffRequest {
            left: left.text.clone(),
            right: right.text.clone(),
            algorithm: Some("myers".to_owned()),
            ignore_whitespace: false,
            ignore_case: false,
            ignore_line_endings: false,
            ignore_regexes: Vec::new(),
        })
    }

    fn entry(&self, id: ClipboardEntryId) -> Option<&ClipboardHistoryEntry> {
        self.entries.iter().find(|entry| entry.id == id)
    }
}

pub struct ClipboardHistoryMonitor<R> {
    reader: R,
    history: ClipboardHistory,
}

impl<R> ClipboardHistoryMonitor<R>
where
    R: ClipboardTextReader,
{
    pub fn new(reader: R, capacity: usize) -> Self {
        Self {
            reader,
            history: ClipboardHistory::new(capacity),
        }
    }

    pub fn poll_once(&mut self) -> Result<Option<ClipboardHistoryEntry>, ClipboardReadError> {
        match self.reader.read_text()? {
            Some(text) => self.history.push_text(text),
            None => Ok(None),
        }
    }

    pub fn history(&self) -> &[ClipboardHistoryEntry] {
        self.history.entries()
    }
}

#[derive(Debug, Clone)]
pub struct MemoryClipboardReader {
    values: VecDeque<String>,
}

impl MemoryClipboardReader {
    pub fn new(values: impl IntoIterator<Item = impl Into<String>>) -> Self {
        Self {
            values: values.into_iter().map(Into::into).collect(),
        }
    }
}

impl ClipboardTextReader for MemoryClipboardReader {
    fn read_text(&mut self) -> Result<Option<String>, ClipboardReadError> {
        Ok(self.values.pop_front())
    }
}

#[cfg(windows)]
#[derive(Debug, Clone, Default)]
pub struct WindowsClipboardReader;

#[cfg(windows)]
impl ClipboardTextReader for WindowsClipboardReader {
    fn read_text(&mut self) -> Result<Option<String>, ClipboardReadError> {
        let output = std::process::Command::new("pwsh")
            .args(["-NoLogo", "-NoProfile", "-Command", "Get-Clipboard -Raw"])
            .output()
            .map_err(|error| ClipboardReadError::Unavailable(error.to_string()))?;

        if !output.status.success() {
            return Err(ClipboardReadError::Failed(
                String::from_utf8_lossy(&output.stderr).to_string(),
            ));
        }

        let text = String::from_utf8_lossy(&output.stdout).to_string();

        Ok((!text.is_empty()).then_some(text))
    }
}

impl fmt::Display for ClipboardReadError {
    fn fmt(&self, formatter: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            Self::Unavailable(message) | Self::Failed(message) => write!(formatter, "{message}"),
        }
    }
}

impl std::error::Error for ClipboardReadError {}

impl fmt::Display for ClipboardCompareError {
    fn fmt(&self, formatter: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            Self::EntryNotFound(id) => write!(formatter, "clipboard entry not found: {}", id.0),
        }
    }
}

impl std::error::Error for ClipboardCompareError {}

fn count_lines(text: &str) -> usize {
    text.lines().count().max(1)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn clipboard_monitor_captures_unique_text_history_with_capacity() {
        let reader = MemoryClipboardReader::new(["alpha", "alpha", "beta", "gamma"]);
        let mut monitor = ClipboardHistoryMonitor::new(reader, 2);

        assert_eq!(
            monitor.poll_once().unwrap().map(|entry| entry.text),
            Some("alpha".to_owned())
        );
        assert_eq!(monitor.poll_once().unwrap(), None);
        assert_eq!(
            monitor.poll_once().unwrap().map(|entry| entry.text),
            Some("beta".to_owned())
        );
        assert_eq!(
            monitor.poll_once().unwrap().map(|entry| entry.text),
            Some("gamma".to_owned())
        );

        let history = monitor.history();

        assert_eq!(history.len(), 2);
        assert_eq!(history[0].text, "gamma");
        assert_eq!(history[1].text, "beta");
    }

    #[test]
    fn clipboard_history_builds_text_diff_requests_for_selected_entries() {
        let mut history = ClipboardHistory::new(10);

        let left = history
            .push_text("first copy")
            .expect("entry should be stored")
            .expect("non-empty clipboard text should create an entry");
        let right = history
            .push_text("second copy")
            .expect("entry should be stored")
            .expect("non-empty clipboard text should create an entry");

        let request = history
            .build_text_diff_request(left.id, right.id)
            .expect("history entries should build a text diff request");

        assert_eq!(request.left, "first copy");
        assert_eq!(request.right, "second copy");
        assert_eq!(request.algorithm.as_deref(), Some("myers"));
    }

    #[test]
    fn clipboard_history_ignores_blank_text_and_reports_missing_selection() {
        let mut history = ClipboardHistory::new(10);

        assert_eq!(history.push_text("   \n\t").unwrap(), None);

        let entry = history
            .push_text("visible")
            .unwrap()
            .expect("entry should exist");
        let error = history
            .build_text_diff_request(entry.id, ClipboardEntryId(999))
            .expect_err("missing right entry should be reported");

        assert_eq!(
            error,
            ClipboardCompareError::EntryNotFound(ClipboardEntryId(999))
        );
    }
}
