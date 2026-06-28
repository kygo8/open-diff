use serde::{Deserialize, Serialize};
use std::collections::BTreeMap;

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Duration {
    pub millis: u64,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum MediaContainer {
    Mp3,
    Flac,
    Mp4,
    Ogg,
    Unknown,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct MediaDocument {
    pub name: String,
    pub container: MediaContainer,
    pub duration: Duration,
    pub streams: Vec<MediaStream>,
    pub tags: Vec<MediaTag>,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct MediaStream {
    pub name: String,
    pub kind: MediaStreamKind,
    pub codec: MediaCodec,
    pub sample_rate_hz: Option<u32>,
    pub channels: Option<u8>,
    pub bitrate_bps: Option<u32>,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum MediaStreamKind {
    Audio,
    Video,
    Subtitle,
    Data,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum MediaCodec {
    Audio(AudioCodec),
    Video(VideoCodec),
    Unknown(String),
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum AudioCodec {
    Mp3,
    Flac,
    Aac,
    Vorbis,
    Opus,
    Pcm,
    Unknown(String),
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum VideoCodec {
    H264,
    H265,
    Av1,
    Vp9,
    Unknown(String),
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct MediaTag {
    pub field: String,
    pub value: String,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct MediaDiff {
    pub fields: Vec<MediaFieldDiff>,
    pub statistics: MediaDiffStatistics,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct MediaFieldDiff {
    pub field: String,
    pub left: Option<String>,
    pub right: Option<String>,
    pub status: MediaFieldStatus,
}

#[derive(Debug, Clone, Default, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct MediaDiffStatistics {
    pub added: u32,
    pub removed: u32,
    pub modified: u32,
    pub unchanged: u32,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum MediaFieldStatus {
    Added,
    Removed,
    Modified,
    Unchanged,
}

impl Duration {
    pub fn from_millis(millis: u64) -> Self {
        Self { millis }
    }
}

impl MediaDocument {
    pub fn new(name: impl Into<String>, container: MediaContainer, duration: Duration) -> Self {
        Self {
            name: name.into(),
            container,
            duration,
            streams: Vec::new(),
            tags: Vec::new(),
        }
    }

    pub fn with_stream(mut self, stream: MediaStream) -> Self {
        self.streams.push(stream);
        self
    }

    pub fn with_tag(mut self, tag: MediaTag) -> Self {
        self.tags.push(tag);
        self
    }
}

impl MediaStream {
    pub fn audio(
        name: impl Into<String>,
        codec: AudioCodec,
        sample_rate_hz: u32,
        channels: u8,
        bitrate_bps: Option<u32>,
    ) -> Self {
        Self {
            name: name.into(),
            kind: MediaStreamKind::Audio,
            codec: MediaCodec::Audio(codec),
            sample_rate_hz: Some(sample_rate_hz),
            channels: Some(channels),
            bitrate_bps,
        }
    }
}

impl MediaTag {
    pub fn new(field: impl Into<String>, value: impl Into<String>) -> Self {
        Self {
            field: field.into(),
            value: value.into(),
        }
    }
}

impl MediaDiff {
    pub fn field(&self, field: &str) -> Option<&MediaFieldDiff> {
        self.fields
            .iter()
            .find(|candidate| candidate.field.eq_ignore_ascii_case(field))
    }
}

pub fn compare_media_documents(left: &MediaDocument, right: &MediaDocument) -> MediaDiff {
    let left_tags = tags_by_field(&left.tags);
    let right_tags = tags_by_field(&right.tags);
    let mut field_names = left_tags
        .keys()
        .chain(right_tags.keys())
        .collect::<Vec<_>>();

    field_names.sort();
    field_names.dedup();

    let mut statistics = MediaDiffStatistics::default();
    let fields = field_names
        .into_iter()
        .map(|field| {
            let left = left_tags.get(field).cloned();
            let right = right_tags.get(field).cloned();
            let status = match (&left, &right) {
                (None, Some(_)) => MediaFieldStatus::Added,
                (Some(_), None) => MediaFieldStatus::Removed,
                (Some(left), Some(right)) if left == right => MediaFieldStatus::Unchanged,
                (Some(_), Some(_)) => MediaFieldStatus::Modified,
                (None, None) => MediaFieldStatus::Unchanged,
            };

            increment_statistics(&mut statistics, status);

            MediaFieldDiff {
                field: field.clone(),
                left,
                right,
                status,
            }
        })
        .collect();

    MediaDiff { fields, statistics }
}

fn tags_by_field(tags: &[MediaTag]) -> BTreeMap<String, String> {
    tags.iter()
        .map(|tag| (tag.field.clone(), tag.value.clone()))
        .collect()
}

fn increment_statistics(statistics: &mut MediaDiffStatistics, status: MediaFieldStatus) {
    match status {
        MediaFieldStatus::Added => statistics.added += 1,
        MediaFieldStatus::Removed => statistics.removed += 1,
        MediaFieldStatus::Modified => statistics.modified += 1,
        MediaFieldStatus::Unchanged => statistics.unchanged += 1,
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn media_document_stores_common_identity_duration_and_tags() {
        let document = MediaDocument::new(
            "left-track.mp3",
            MediaContainer::Mp3,
            Duration::from_millis(181_250),
        )
        .with_stream(MediaStream::audio(
            "Audio",
            AudioCodec::Mp3,
            44_100,
            2,
            Some(320_000),
        ))
        .with_tag(MediaTag::new("Title", "Northern Lights"))
        .with_tag(MediaTag::new("Artist", "Aster"));

        assert_eq!(document.name, "left-track.mp3");
        assert_eq!(document.container, MediaContainer::Mp3);
        assert_eq!(document.duration.millis, 181_250);
        assert_eq!(document.streams[0].kind, MediaStreamKind::Audio);
        assert_eq!(document.tags[0].field, "Title");
        assert_eq!(document.tags[0].value, "Northern Lights");
    }

    #[test]
    fn media_comparer_aligns_tags_and_reports_field_statuses() {
        let left = MediaDocument::new(
            "left.flac",
            MediaContainer::Flac,
            Duration::from_millis(240_000),
        )
        .with_tag(MediaTag::new("Title", "Northern Lights"))
        .with_tag(MediaTag::new("Album", "Winter"))
        .with_tag(MediaTag::new("Comment", "Draft"));
        let right = MediaDocument::new(
            "right.flac",
            MediaContainer::Flac,
            Duration::from_millis(240_000),
        )
        .with_tag(MediaTag::new("Title", "Northern Lights (Remaster)"))
        .with_tag(MediaTag::new("Album", "Winter"))
        .with_tag(MediaTag::new("Genre", "Ambient"));

        let diff = compare_media_documents(&left, &right);

        assert_eq!(diff.statistics.added, 1);
        assert_eq!(diff.statistics.removed, 1);
        assert_eq!(diff.statistics.modified, 1);
        assert_eq!(diff.statistics.unchanged, 1);
        assert_eq!(
            diff.field("Title").expect("title row exists").status,
            MediaFieldStatus::Modified
        );
        assert_eq!(
            diff.field("Album").expect("album row exists").status,
            MediaFieldStatus::Unchanged
        );
        assert_eq!(
            diff.field("Comment").expect("comment row exists").status,
            MediaFieldStatus::Removed
        );
        assert_eq!(
            diff.field("Genre").expect("genre row exists").status,
            MediaFieldStatus::Added
        );
    }
}
