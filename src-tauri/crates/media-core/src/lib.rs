use serde::{Deserialize, Serialize};
use std::collections::BTreeMap;
use std::fmt;

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

#[derive(Debug, Clone, PartialEq, Eq)]
pub enum MediaReadError {
    InvalidMetadata(String),
    UnsupportedContainer(String),
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

    pub fn tag_value(&self, field: &str) -> Option<&str> {
        self.tags
            .iter()
            .find(|tag| tag.field.eq_ignore_ascii_case(field))
            .map(|tag| tag.value.as_str())
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

pub fn read_media_document(name: &str, bytes: &[u8]) -> Result<MediaDocument, MediaReadError> {
    let container = detect_container(name, bytes)
        .ok_or_else(|| MediaReadError::UnsupportedContainer(name.to_owned()))?;
    let tags = match container {
        MediaContainer::Mp3 => read_mp3_tags(bytes)?,
        MediaContainer::Flac => read_flac_tags(bytes)?,
        MediaContainer::Mp4 => read_mp4_tags(bytes)?,
        MediaContainer::Ogg => read_ogg_tags(bytes)?,
        MediaContainer::Unknown => {
            return Err(MediaReadError::UnsupportedContainer(name.to_owned()))
        }
    };
    let codec = match container {
        MediaContainer::Mp3 => AudioCodec::Mp3,
        MediaContainer::Flac => AudioCodec::Flac,
        MediaContainer::Mp4 => AudioCodec::Aac,
        MediaContainer::Ogg => AudioCodec::Vorbis,
        MediaContainer::Unknown => AudioCodec::Unknown("unknown".to_owned()),
    };

    Ok(
        MediaDocument::new(name, container, Duration::from_millis(0))
            .with_stream(MediaStream::audio("Audio", codec, 0, 0, None))
            .with_tags(tags),
    )
}

impl MediaDocument {
    fn with_tags(mut self, tags: Vec<MediaTag>) -> Self {
        self.tags.extend(tags);
        self
    }
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

fn detect_container(name: &str, bytes: &[u8]) -> Option<MediaContainer> {
    let lower_name = name.to_ascii_lowercase();

    if bytes.starts_with(b"ID3") || lower_name.ends_with(".mp3") {
        return Some(MediaContainer::Mp3);
    }

    if bytes.starts_with(b"fLaC") || lower_name.ends_with(".flac") {
        return Some(MediaContainer::Flac);
    }

    if bytes.starts_with(b"OggS") || lower_name.ends_with(".ogg") {
        return Some(MediaContainer::Ogg);
    }

    if bytes.windows(4).any(|window| window == b"ftyp") || lower_name.ends_with(".mp4") {
        return Some(MediaContainer::Mp4);
    }

    None
}

fn read_mp3_tags(bytes: &[u8]) -> Result<Vec<MediaTag>, MediaReadError> {
    if !bytes.starts_with(b"ID3") || bytes.len() < 10 {
        return Ok(Vec::new());
    }

    let tag_size = read_syncsafe(&bytes[6..10]) as usize;
    let end = 10_usize.saturating_add(tag_size).min(bytes.len());
    let mut offset = 10;
    let mut tags = Vec::new();

    while offset + 10 <= end {
        let frame_id = &bytes[offset..offset + 4];

        if frame_id.iter().all(|byte| *byte == 0) {
            break;
        }

        let frame_size = u32::from_be_bytes([
            bytes[offset + 4],
            bytes[offset + 5],
            bytes[offset + 6],
            bytes[offset + 7],
        ]) as usize;
        let payload_start = offset + 10;
        let payload_end = payload_start.saturating_add(frame_size);

        if payload_end > end {
            return Err(MediaReadError::InvalidMetadata(
                "ID3 frame exceeds tag size".to_owned(),
            ));
        }

        if let Some(field) = id3_text_field(frame_id) {
            if let Some(value) = decode_id3_text(&bytes[payload_start..payload_end]) {
                tags.push(MediaTag::new(field, value));
            }
        }

        offset = payload_end;
    }

    Ok(tags)
}

fn read_flac_tags(bytes: &[u8]) -> Result<Vec<MediaTag>, MediaReadError> {
    if !bytes.starts_with(b"fLaC") {
        return Ok(Vec::new());
    }

    let mut offset = 4;

    while offset + 4 <= bytes.len() {
        let header = bytes[offset];
        let block_type = header & 0x7f;
        let block_len = ((bytes[offset + 1] as usize) << 16)
            | ((bytes[offset + 2] as usize) << 8)
            | bytes[offset + 3] as usize;
        let payload_start = offset + 4;
        let payload_end = payload_start.saturating_add(block_len);

        if payload_end > bytes.len() {
            return Err(MediaReadError::InvalidMetadata(
                "FLAC metadata block exceeds file size".to_owned(),
            ));
        }

        if block_type == 4 {
            return read_vorbis_comments(&bytes[payload_start..payload_end]);
        }

        if header & 0x80 != 0 {
            break;
        }

        offset = payload_end;
    }

    Ok(Vec::new())
}

fn read_ogg_tags(bytes: &[u8]) -> Result<Vec<MediaTag>, MediaReadError> {
    if !bytes.starts_with(b"OggS") {
        return Ok(Vec::new());
    }

    let marker = b"\x01vorbis";
    let Some(marker_start) = bytes
        .windows(marker.len())
        .position(|window| window == marker)
    else {
        return Ok(Vec::new());
    };
    let payload_start = marker_start + marker.len();

    read_vorbis_comments(&bytes[payload_start..])
}

fn read_mp4_tags(bytes: &[u8]) -> Result<Vec<MediaTag>, MediaReadError> {
    let mut offset = 0;
    let mut tags = Vec::new();

    while offset + 8 <= bytes.len() {
        let size = u32::from_be_bytes([
            bytes[offset],
            bytes[offset + 1],
            bytes[offset + 2],
            bytes[offset + 3],
        ]) as usize;

        if size < 8 {
            offset += 1;
            continue;
        }

        let atom_end = offset.saturating_add(size);

        if atom_end > bytes.len() {
            return Err(MediaReadError::InvalidMetadata(
                "MP4 atom exceeds file size".to_owned(),
            ));
        }

        if &bytes[offset + 4..offset + 8] == b"free" {
            if let Some(tag) = read_mp4_free_text_atom(&bytes[offset + 8..atom_end]) {
                tags.push(tag);
            }
        }

        offset = atom_end;
    }

    Ok(tags)
}

fn read_mp4_free_text_atom(payload: &[u8]) -> Option<MediaTag> {
    let separator = payload.iter().position(|byte| *byte == b'=')?;
    let field = std::str::from_utf8(&payload[..separator]).ok()?;
    let value = std::str::from_utf8(&payload[separator + 1..]).ok()?;

    Some(MediaTag::new(normalize_tag_field(field), value))
}

fn read_vorbis_comments(bytes: &[u8]) -> Result<Vec<MediaTag>, MediaReadError> {
    let mut offset = 0;
    let vendor_len = read_le_u32(bytes, &mut offset)? as usize;
    offset = offset.saturating_add(vendor_len);

    if offset > bytes.len() {
        return Err(MediaReadError::InvalidMetadata(
            "Vorbis vendor exceeds metadata size".to_owned(),
        ));
    }

    let count = read_le_u32(bytes, &mut offset)?;
    let mut tags = Vec::new();

    for _ in 0..count {
        let comment_len = read_le_u32(bytes, &mut offset)? as usize;
        let end = offset.saturating_add(comment_len);

        if end > bytes.len() {
            return Err(MediaReadError::InvalidMetadata(
                "Vorbis comment exceeds metadata size".to_owned(),
            ));
        }

        let comment = std::str::from_utf8(&bytes[offset..end]).map_err(|error| {
            MediaReadError::InvalidMetadata(format!("invalid Vorbis UTF-8 comment: {error}"))
        })?;

        if let Some((field, value)) = comment.split_once('=') {
            tags.push(MediaTag::new(normalize_tag_field(field), value));
        }

        offset = end;
    }

    Ok(tags)
}

fn read_le_u32(bytes: &[u8], offset: &mut usize) -> Result<u32, MediaReadError> {
    if *offset + 4 > bytes.len() {
        return Err(MediaReadError::InvalidMetadata(
            "unexpected end of metadata".to_owned(),
        ));
    }

    let value = u32::from_le_bytes([
        bytes[*offset],
        bytes[*offset + 1],
        bytes[*offset + 2],
        bytes[*offset + 3],
    ]);
    *offset += 4;

    Ok(value)
}

fn read_syncsafe(bytes: &[u8]) -> u32 {
    ((bytes[0] as u32) << 21)
        | ((bytes[1] as u32) << 14)
        | ((bytes[2] as u32) << 7)
        | bytes[3] as u32
}

fn id3_text_field(frame_id: &[u8]) -> Option<&'static str> {
    match frame_id {
        b"TIT2" => Some("Title"),
        b"TPE1" => Some("Artist"),
        b"TALB" => Some("Album"),
        b"TCON" => Some("Genre"),
        b"COMM" => Some("Comment"),
        _ => None,
    }
}

fn decode_id3_text(payload: &[u8]) -> Option<String> {
    let (&encoding, text) = payload.split_first()?;

    match encoding {
        0 | 3 => Some(
            String::from_utf8_lossy(text)
                .trim_end_matches('\0')
                .to_owned(),
        ),
        _ => None,
    }
}

fn normalize_tag_field(field: &str) -> String {
    let mut chars = field.chars();
    let Some(first) = chars.next() else {
        return String::new();
    };

    first.to_uppercase().collect::<String>() + &chars.as_str().to_ascii_lowercase()
}

impl fmt::Display for MediaReadError {
    fn fmt(&self, formatter: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            Self::InvalidMetadata(message) => write!(formatter, "{message}"),
            Self::UnsupportedContainer(name) => {
                write!(formatter, "unsupported media input: {name}")
            }
        }
    }
}

impl std::error::Error for MediaReadError {}

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

    #[test]
    fn reads_mp3_id3v2_text_tags() {
        let document =
            read_media_document("sample.mp3", &fixture_mp3_with_id3v2()).expect("mp3 should read");

        assert_eq!(document.container, MediaContainer::Mp3);
        assert_eq!(
            document.streams[0].codec,
            MediaCodec::Audio(AudioCodec::Mp3)
        );
        assert_eq!(document.tag_value("Title"), Some("Northern Lights"));
        assert_eq!(document.tag_value("Artist"), Some("Aster"));
    }

    #[test]
    fn reads_flac_vorbis_comment_tags() {
        let document = read_media_document("sample.flac", &fixture_flac_with_vorbis_comments())
            .expect("flac should read");

        assert_eq!(document.container, MediaContainer::Flac);
        assert_eq!(
            document.streams[0].codec,
            MediaCodec::Audio(AudioCodec::Flac)
        );
        assert_eq!(document.tag_value("Title"), Some("FLAC Song"));
        assert_eq!(document.tag_value("Album"), Some("Lossless"));
    }

    #[test]
    fn reads_ogg_vorbis_comment_tags() {
        let document = read_media_document("sample.ogg", &fixture_ogg_with_vorbis_comments())
            .expect("ogg should read");

        assert_eq!(document.container, MediaContainer::Ogg);
        assert_eq!(
            document.streams[0].codec,
            MediaCodec::Audio(AudioCodec::Vorbis)
        );
        assert_eq!(document.tag_value("Title"), Some("Ogg Song"));
        assert_eq!(document.tag_value("Genre"), Some("Ambient"));
    }

    #[test]
    fn reads_mp4_metadata_atoms() {
        let document = read_media_document("sample.mp4", &fixture_mp4_with_metadata())
            .expect("mp4 should read");

        assert_eq!(document.container, MediaContainer::Mp4);
        assert_eq!(
            document.streams[0].codec,
            MediaCodec::Audio(AudioCodec::Aac)
        );
        assert_eq!(document.tag_value("Title"), Some("MP4 Song"));
        assert_eq!(document.tag_value("Artist"), Some("Aster"));
    }

    #[test]
    fn rejects_unknown_media_inputs() {
        let error = read_media_document("sample.bin", b"not media")
            .expect_err("unknown bytes should be rejected");

        assert_eq!(
            error,
            MediaReadError::UnsupportedContainer("sample.bin".to_owned())
        );
    }

    fn fixture_mp3_with_id3v2() -> Vec<u8> {
        let frames = [
            id3_text_frame("TIT2", "Northern Lights"),
            id3_text_frame("TPE1", "Aster"),
        ]
        .concat();
        let mut bytes = b"ID3\x03\x00\x00".to_vec();
        bytes.extend(syncsafe(frames.len() as u32));
        bytes.extend(frames);
        bytes.extend(b"MPEG");
        bytes
    }

    fn id3_text_frame(id: &str, value: &str) -> Vec<u8> {
        let mut payload = vec![0];
        payload.extend(value.as_bytes());
        let mut frame = id.as_bytes().to_vec();
        frame.extend((payload.len() as u32).to_be_bytes());
        frame.extend([0, 0]);
        frame.extend(payload);
        frame
    }

    fn syncsafe(value: u32) -> [u8; 4] {
        [
            ((value >> 21) & 0x7f) as u8,
            ((value >> 14) & 0x7f) as u8,
            ((value >> 7) & 0x7f) as u8,
            (value & 0x7f) as u8,
        ]
    }

    fn fixture_flac_with_vorbis_comments() -> Vec<u8> {
        let comments = vorbis_comment_block(&[("TITLE", "FLAC Song"), ("ALBUM", "Lossless")]);
        let mut bytes = b"fLaC".to_vec();
        bytes.push(0x84);
        bytes.extend([
            (comments.len() >> 16) as u8,
            (comments.len() >> 8) as u8,
            comments.len() as u8,
        ]);
        bytes.extend(comments);
        bytes
    }

    fn fixture_ogg_with_vorbis_comments() -> Vec<u8> {
        let comments = vorbis_comment_block(&[("TITLE", "Ogg Song"), ("GENRE", "Ambient")]);
        let mut bytes = b"OggS".to_vec();
        bytes.extend(b"\x01vorbis");
        bytes.extend(comments);
        bytes
    }

    fn vorbis_comment_block(fields: &[(&str, &str)]) -> Vec<u8> {
        let vendor = b"OpenDiff";
        let mut bytes = Vec::new();
        bytes.extend((vendor.len() as u32).to_le_bytes());
        bytes.extend(vendor);
        bytes.extend((fields.len() as u32).to_le_bytes());

        for (field, value) in fields {
            let comment = format!("{field}={value}");
            bytes.extend((comment.len() as u32).to_le_bytes());
            bytes.extend(comment.as_bytes());
        }

        bytes
    }

    fn fixture_mp4_with_metadata() -> Vec<u8> {
        let title = mp4_text_atom("title", "MP4 Song");
        let artist = mp4_text_atom("artist", "Aster");
        let mut bytes = Vec::new();
        bytes.extend(12_u32.to_be_bytes());
        bytes.extend(b"ftyp");
        bytes.extend(b"isom");
        bytes.extend(title);
        bytes.extend(artist);
        bytes
    }

    fn mp4_text_atom(name: &str, value: &str) -> Vec<u8> {
        let mut atom = Vec::new();
        let size = 8 + name.len() + 1 + value.len();
        atom.extend((size as u32).to_be_bytes());
        atom.extend(b"free");
        atom.extend(name.as_bytes());
        atom.push(b'=');
        atom.extend(value.as_bytes());
        atom
    }
}
