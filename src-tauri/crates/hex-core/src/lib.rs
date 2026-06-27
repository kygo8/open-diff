use serde::{Deserialize, Serialize};
use std::fmt;
use vfs_core::{LocalVfs, VfsPath, VfsProvider};

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct HexBlock {
    pub offset: u64,
    pub bytes: Vec<u8>,
    pub total_len: u64,
    pub end_of_file: bool,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct BinaryDiff {
    pub left_len: u64,
    pub right_len: u64,
    pub ranges: Vec<BinaryDiffRange>,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct BinaryDiffRange {
    pub offset: u64,
    pub left_bytes: Vec<u8>,
    pub right_bytes: Vec<u8>,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct HexViewWindow {
    pub offset: u64,
    pub total_len: u64,
    pub cells: Vec<HexViewCell>,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct HexViewCell {
    pub offset: u64,
    pub byte: u8,
    pub hex: String,
    pub ascii: String,
    pub different: bool,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct HexByteEdit {
    pub offset: u64,
    pub value: u8,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct HexSaveResult {
    pub bytes_written: u64,
    pub backup_path: Option<String>,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub enum HexEditError {
    OffsetOutOfRange { offset: u64, len: u64 },
    Storage(String),
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum HexFindQuery {
    Text(String),
    Hex(String),
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct HexFindMatch {
    pub offset: u64,
    pub length: u64,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub enum HexFindError {
    EmptyQuery,
    InvalidHexQuery(String),
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum HexReplaceValue {
    Text(String),
    Hex(String),
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct HexReplaceResult {
    pub bytes: Vec<u8>,
    pub matches: Vec<HexFindMatch>,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub enum HexReplaceError {
    Find(HexFindError),
    LengthMismatch { find_len: u64, replace_len: u64 },
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct HexReport {
    pub summary: HexReportSummary,
    pub rows: Vec<HexReportRow>,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct HexReportSummary {
    pub original_len: u64,
    pub modified_len: u64,
    pub changed_rows: u64,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct HexReportRow {
    pub offset: u64,
    pub original_byte: Option<u8>,
    pub modified_byte: Option<u8>,
    pub original_hex: Option<String>,
    pub modified_hex: Option<String>,
}

pub fn read_hex_block(source: &[u8], offset: u64, length: usize) -> HexBlock {
    let total_len = source.len() as u64;
    let start = usize::try_from(offset)
        .unwrap_or(usize::MAX)
        .min(source.len());
    let end = start.saturating_add(length).min(source.len());

    HexBlock {
        offset: start as u64,
        bytes: source[start..end].to_vec(),
        total_len,
        end_of_file: end >= source.len(),
    }
}

pub fn build_hex_view_window(
    source: &[u8],
    offset: u64,
    length: usize,
    diff: Option<&BinaryDiff>,
) -> HexViewWindow {
    let block = read_hex_block(source, offset, length);
    let cells = block
        .bytes
        .iter()
        .enumerate()
        .map(|(index, byte)| {
            let cell_offset = block.offset + index as u64;

            HexViewCell {
                offset: cell_offset,
                byte: *byte,
                hex: format!("{byte:02X}"),
                ascii: ascii_byte_text(*byte),
                different: diff.is_some_and(|diff| diff_contains_offset(diff, cell_offset)),
            }
        })
        .collect();

    HexViewWindow {
        offset: block.offset,
        total_len: block.total_len,
        cells,
    }
}

pub fn scan_binary_differences(left: &[u8], right: &[u8]) -> BinaryDiff {
    let max_len = left.len().max(right.len());
    let mut ranges = Vec::new();
    let mut current: Option<BinaryDiffRange> = None;

    for index in 0..max_len {
        let left_byte = left.get(index).copied();
        let right_byte = right.get(index).copied();

        if left_byte == right_byte {
            if let Some(range) = current.take() {
                ranges.push(range);
            }
            continue;
        }

        let range = current.get_or_insert_with(|| BinaryDiffRange {
            offset: index as u64,
            left_bytes: Vec::new(),
            right_bytes: Vec::new(),
        });

        if let Some(byte) = left_byte {
            range.left_bytes.push(byte);
        }
        if let Some(byte) = right_byte {
            range.right_bytes.push(byte);
        }
    }

    if let Some(range) = current {
        ranges.push(range);
    }

    BinaryDiff {
        left_len: left.len() as u64,
        right_len: right.len() as u64,
        ranges,
    }
}

pub fn apply_hex_byte_edits(source: &[u8], edits: &[HexByteEdit]) -> Result<Vec<u8>, HexEditError> {
    let mut edited = source.to_vec();
    let len = edited.len() as u64;

    for edit in edits {
        let index = usize::try_from(edit.offset)
            .ok()
            .filter(|index| *index < edited.len())
            .ok_or(HexEditError::OffsetOutOfRange {
                offset: edit.offset,
                len,
            })?;

        edited[index] = edit.value;
    }

    Ok(edited)
}

pub fn save_hex_byte_edits(
    path: impl AsRef<str>,
    edits: &[HexByteEdit],
) -> Result<HexSaveResult, HexEditError> {
    let path = VfsPath::new(path.as_ref().to_owned());
    let mut vfs = LocalVfs::new();
    let original = vfs.read(&path).map_err(storage_error)?;
    let edited = apply_hex_byte_edits(&original, edits)?;
    let backup = vfs
        .write_with_backup(&path, &edited)
        .map_err(storage_error)?;

    Ok(HexSaveResult {
        bytes_written: edited.len() as u64,
        backup_path: backup.map(|path| path.as_str().to_owned()),
    })
}

fn ascii_byte_text(byte: u8) -> String {
    if byte.is_ascii_graphic() || byte == b' ' {
        char::from(byte).to_string()
    } else {
        ".".to_owned()
    }
}

fn diff_contains_offset(diff: &BinaryDiff, offset: u64) -> bool {
    diff.ranges.iter().any(|range| {
        let range_len = range.left_bytes.len().max(range.right_bytes.len()) as u64;

        offset >= range.offset && offset < range.offset + range_len
    })
}

pub fn find_hex_matches(
    source: &[u8],
    query: HexFindQuery,
) -> Result<Vec<HexFindMatch>, HexFindError> {
    let pattern = find_query_bytes(query)?;

    Ok(find_byte_pattern(source, &pattern))
}

pub fn replace_hex_matches(
    source: &[u8],
    find: HexFindQuery,
    replace: HexReplaceValue,
) -> Result<HexReplaceResult, HexReplaceError> {
    let find_pattern = find_query_bytes(find).map_err(HexReplaceError::Find)?;
    let replace_pattern = replace_value_bytes(replace).map_err(HexReplaceError::Find)?;

    if find_pattern.len() != replace_pattern.len() {
        return Err(HexReplaceError::LengthMismatch {
            find_len: find_pattern.len() as u64,
            replace_len: replace_pattern.len() as u64,
        });
    }

    let matches = find_byte_pattern(source, &find_pattern);
    let mut bytes = source.to_vec();

    for matched in &matches {
        let start = matched.offset as usize;
        let end = start + replace_pattern.len();

        bytes[start..end].copy_from_slice(&replace_pattern);
    }

    Ok(HexReplaceResult { bytes, matches })
}

pub fn build_hex_report(original: &[u8], modified: &[u8]) -> HexReport {
    let max_len = original.len().max(modified.len());
    let rows = (0..max_len)
        .filter_map(|index| {
            let original_byte = original.get(index).copied();
            let modified_byte = modified.get(index).copied();

            (original_byte != modified_byte).then_some(HexReportRow {
                offset: index as u64,
                original_byte,
                modified_byte,
                original_hex: original_byte.map(format_hex_byte),
                modified_hex: modified_byte.map(format_hex_byte),
            })
        })
        .collect::<Vec<_>>();

    HexReport {
        summary: HexReportSummary {
            original_len: original.len() as u64,
            modified_len: modified.len() as u64,
            changed_rows: rows.len() as u64,
        },
        rows,
    }
}

fn find_query_bytes(query: HexFindQuery) -> Result<Vec<u8>, HexFindError> {
    match query {
        HexFindQuery::Text(value) => non_empty_bytes(value),
        HexFindQuery::Hex(value) => parse_hex_query(&value),
    }
}

fn replace_value_bytes(value: HexReplaceValue) -> Result<Vec<u8>, HexFindError> {
    match value {
        HexReplaceValue::Text(value) => non_empty_bytes(value),
        HexReplaceValue::Hex(value) => parse_hex_query(&value),
    }
}

fn non_empty_bytes(value: String) -> Result<Vec<u8>, HexFindError> {
    if value.is_empty() {
        return Err(HexFindError::EmptyQuery);
    }

    Ok(value.into_bytes())
}

fn find_byte_pattern(source: &[u8], pattern: &[u8]) -> Vec<HexFindMatch> {
    if pattern.is_empty() || pattern.len() > source.len() {
        return Vec::new();
    }

    source
        .windows(pattern.len())
        .enumerate()
        .filter_map(|(offset, window)| {
            (window == pattern).then_some(HexFindMatch {
                offset: offset as u64,
                length: pattern.len() as u64,
            })
        })
        .collect()
}

fn format_hex_byte(byte: u8) -> String {
    format!("{byte:02X}")
}

fn parse_hex_query(value: &str) -> Result<Vec<u8>, HexFindError> {
    let compact = value
        .chars()
        .filter(|character| !character.is_whitespace())
        .collect::<String>();

    if compact.is_empty() {
        return Err(HexFindError::EmptyQuery);
    }

    if compact.len() % 2 != 0
        || !compact
            .chars()
            .all(|character| character.is_ascii_hexdigit())
    {
        return Err(HexFindError::InvalidHexQuery(value.to_owned()));
    }

    (0..compact.len())
        .step_by(2)
        .map(|index| {
            u8::from_str_radix(&compact[index..index + 2], 16)
                .map_err(|_| HexFindError::InvalidHexQuery(value.to_owned()))
        })
        .collect()
}

fn storage_error(error: impl fmt::Debug) -> HexEditError {
    HexEditError::Storage(format!("{error:?}"))
}

impl fmt::Display for HexEditError {
    fn fmt(&self, formatter: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            Self::OffsetOutOfRange { offset, len } => {
                write!(
                    formatter,
                    "hex edit offset {offset} is outside file length {len}"
                )
            }
            Self::Storage(error) => write!(formatter, "{error}"),
        }
    }
}

impl std::error::Error for HexEditError {}

impl fmt::Display for HexFindError {
    fn fmt(&self, formatter: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            Self::EmptyQuery => write!(formatter, "hex find query cannot be empty"),
            Self::InvalidHexQuery(query) => write!(formatter, "invalid hex query: {query}"),
        }
    }
}

impl std::error::Error for HexFindError {}

impl fmt::Display for HexReplaceError {
    fn fmt(&self, formatter: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            Self::Find(error) => write!(formatter, "{error}"),
            Self::LengthMismatch {
                find_len,
                replace_len,
            } => write!(
                formatter,
                "hex replacement length {replace_len} does not match find length {find_len}"
            ),
        }
    }
}

impl std::error::Error for HexReplaceError {}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn reads_binary_data_in_requested_blocks() {
        let source = (0_u8..=31).collect::<Vec<_>>();

        let block = read_hex_block(&source, 8, 10);

        assert_eq!(block.offset, 8);
        assert_eq!(block.bytes, vec![8, 9, 10, 11, 12, 13, 14, 15, 16, 17]);
        assert_eq!(block.total_len, 32);
        assert!(!block.end_of_file);
    }

    #[test]
    fn clamps_blocks_at_end_of_input() {
        let source = (0_u8..=15).collect::<Vec<_>>();

        let block = read_hex_block(&source, 12, 16);

        assert_eq!(block.offset, 12);
        assert_eq!(block.bytes, vec![12, 13, 14, 15]);
        assert_eq!(block.total_len, 16);
        assert!(block.end_of_file);
    }

    #[test]
    fn scans_binary_differences_as_contiguous_ranges() {
        let left = [0x00, 0x01, 0x02, 0x03, 0x04, 0x05, 0x06];
        let right = [0x00, 0xFF, 0xFE, 0x03, 0x04, 0xAA, 0x06, 0x07];

        let diff = scan_binary_differences(&left, &right);

        assert_eq!(diff.ranges.len(), 3);
        assert_eq!(diff.ranges[0].offset, 1);
        assert_eq!(diff.ranges[0].left_bytes, vec![0x01, 0x02]);
        assert_eq!(diff.ranges[0].right_bytes, vec![0xFF, 0xFE]);
        assert_eq!(diff.ranges[1].offset, 5);
        assert_eq!(diff.ranges[1].left_bytes, vec![0x05]);
        assert_eq!(diff.ranges[1].right_bytes, vec![0xAA]);
        assert_eq!(diff.ranges[2].offset, 7);
        assert_eq!(diff.ranges[2].left_bytes, Vec::<u8>::new());
        assert_eq!(diff.ranges[2].right_bytes, vec![0x07]);
        assert_eq!(diff.left_len, 7);
        assert_eq!(diff.right_len, 8);
    }

    #[test]
    fn builds_hex_view_window_with_ascii_and_diff_markers() {
        let source = b"AB\x00Z";
        let diff = BinaryDiff {
            left_len: 4,
            right_len: 4,
            ranges: vec![BinaryDiffRange {
                offset: 1,
                left_bytes: vec![b'B'],
                right_bytes: vec![b'C'],
            }],
        };

        let window = build_hex_view_window(source, 0, 4, Some(&diff));

        assert_eq!(window.offset, 0);
        assert_eq!(window.total_len, 4);
        assert_eq!(window.cells.len(), 4);
        assert_eq!(window.cells[0].hex, "41");
        assert_eq!(window.cells[0].ascii, "A");
        assert!(!window.cells[0].different);
        assert_eq!(window.cells[1].offset, 1);
        assert_eq!(window.cells[1].hex, "42");
        assert!(window.cells[1].different);
        assert_eq!(window.cells[2].ascii, ".");
    }

    #[test]
    fn applies_byte_edits_at_requested_offsets() {
        let source = b"ABCDEF";
        let edits = vec![
            HexByteEdit {
                offset: 1,
                value: 0x78,
            },
            HexByteEdit {
                offset: 4,
                value: 0x79,
            },
        ];

        let edited = apply_hex_byte_edits(source, &edits).expect("edits should apply");

        assert_eq!(edited, b"AxCDyF");
    }

    #[test]
    fn rejects_byte_edits_outside_source_length() {
        let error = apply_hex_byte_edits(
            b"ABC",
            &[HexByteEdit {
                offset: 3,
                value: 0x78,
            }],
        )
        .expect_err("offset at len should be rejected");

        assert_eq!(error, HexEditError::OffsetOutOfRange { offset: 3, len: 3 });
    }

    #[test]
    fn saves_byte_edits_with_backup() {
        let root = unique_temp_dir("hex-save");
        let path = root.join("sample.bin");
        std::fs::write(&path, b"ABCDEF").expect("fixture should be writable");
        let edits = vec![HexByteEdit {
            offset: 2,
            value: 0x78,
        }];

        let result =
            save_hex_byte_edits(path.to_string_lossy().as_ref(), &edits).expect("save should work");

        assert_eq!(
            std::fs::read(&path).expect("edited file should be readable"),
            b"ABxDEF"
        );
        assert_eq!(result.bytes_written, 6);
        let backup_path = result
            .backup_path
            .expect("existing file should have backup");
        assert_eq!(
            std::fs::read(backup_path).expect("backup should be readable"),
            b"ABCDEF"
        );

        std::fs::remove_dir_all(root).expect("temp directory should be removable");
    }

    #[test]
    fn finds_text_queries_as_utf8_bytes() {
        let result = find_hex_matches(b"alpha beta alpha", HexFindQuery::Text("alpha".to_owned()))
            .expect("text query should be valid");

        assert_eq!(
            result,
            vec![
                HexFindMatch {
                    offset: 0,
                    length: 5,
                },
                HexFindMatch {
                    offset: 11,
                    length: 5,
                },
            ]
        );
    }

    #[test]
    fn finds_hex_sequence_queries_with_spacing() {
        let source = [0x10, 0xAB, 0xCD, 0x20, 0xAB, 0xCD, 0x30];
        let result = find_hex_matches(&source, HexFindQuery::Hex("AB CD".to_owned()))
            .expect("hex query should be valid");

        assert_eq!(
            result,
            vec![
                HexFindMatch {
                    offset: 1,
                    length: 2,
                },
                HexFindMatch {
                    offset: 4,
                    length: 2,
                },
            ]
        );
    }

    #[test]
    fn finds_compact_case_insensitive_hex_queries() {
        let source = [0xAA, 0xBB, 0xCC, 0xAA, 0xBB];
        let result = find_hex_matches(&source, HexFindQuery::Hex("aAbb".to_owned()))
            .expect("compact hex query should be valid");

        assert_eq!(
            result,
            vec![
                HexFindMatch {
                    offset: 0,
                    length: 2,
                },
                HexFindMatch {
                    offset: 3,
                    length: 2,
                },
            ]
        );
    }

    #[test]
    fn rejects_empty_find_queries() {
        let text_error = find_hex_matches(b"ABC", HexFindQuery::Text(String::new()))
            .expect_err("empty text query should be rejected");
        let hex_error = find_hex_matches(b"ABC", HexFindQuery::Hex("   ".to_owned()))
            .expect_err("empty hex query should be rejected");

        assert_eq!(text_error, HexFindError::EmptyQuery);
        assert_eq!(hex_error, HexFindError::EmptyQuery);
    }

    #[test]
    fn replaces_all_equal_length_hex_matches() {
        let source = [0x10, 0xAB, 0xCD, 0x20, 0xAB, 0xCD, 0x30];
        let result = replace_hex_matches(
            &source,
            HexFindQuery::Hex("AB CD".to_owned()),
            HexReplaceValue::Hex("FE DC".to_owned()),
        )
        .expect("equal length replacement should work");

        assert_eq!(result.bytes, vec![0x10, 0xFE, 0xDC, 0x20, 0xFE, 0xDC, 0x30]);
        assert_eq!(
            result.matches,
            vec![
                HexFindMatch {
                    offset: 1,
                    length: 2,
                },
                HexFindMatch {
                    offset: 4,
                    length: 2,
                },
            ]
        );
    }

    #[test]
    fn replaces_equal_length_text_matches() {
        let result = replace_hex_matches(
            b"cat dog cat",
            HexFindQuery::Text("cat".to_owned()),
            HexReplaceValue::Text("hen".to_owned()),
        )
        .expect("equal length text replacement should work");

        assert_eq!(result.bytes, b"hen dog hen");
        assert_eq!(
            result.matches,
            vec![
                HexFindMatch {
                    offset: 0,
                    length: 3,
                },
                HexFindMatch {
                    offset: 8,
                    length: 3,
                },
            ]
        );
    }

    #[test]
    fn rejects_replacements_that_change_byte_length() {
        let error = replace_hex_matches(
            b"ABAB",
            HexFindQuery::Text("AB".to_owned()),
            HexReplaceValue::Text("XYZ".to_owned()),
        )
        .expect_err("length changing replacement should be rejected");

        assert_eq!(
            error,
            HexReplaceError::LengthMismatch {
                find_len: 2,
                replace_len: 3,
            }
        );
    }

    #[test]
    fn builds_hex_report_rows_with_offsets_original_and_modified_bytes() {
        let report = build_hex_report(b"ABC", b"AxCD");

        assert_eq!(report.summary.original_len, 3);
        assert_eq!(report.summary.modified_len, 4);
        assert_eq!(report.summary.changed_rows, 2);
        assert_eq!(
            report.rows,
            vec![
                HexReportRow {
                    offset: 1,
                    original_byte: Some(0x42),
                    modified_byte: Some(0x78),
                    original_hex: Some("42".to_owned()),
                    modified_hex: Some("78".to_owned()),
                },
                HexReportRow {
                    offset: 3,
                    original_byte: None,
                    modified_byte: Some(0x44),
                    original_hex: None,
                    modified_hex: Some("44".to_owned()),
                },
            ]
        );
    }

    #[test]
    fn builds_hex_report_rows_for_removed_bytes() {
        let report = build_hex_report(b"ABCD", b"ABC");

        assert_eq!(
            report.rows,
            vec![HexReportRow {
                offset: 3,
                original_byte: Some(0x44),
                modified_byte: None,
                original_hex: Some("44".to_owned()),
                modified_hex: None,
            }]
        );
    }

    fn unique_temp_dir(prefix: &str) -> std::path::PathBuf {
        let mut dir = std::env::temp_dir();
        dir.push(format!(
            "open-diff-{prefix}-{}-{}",
            std::process::id(),
            std::time::SystemTime::now()
                .duration_since(std::time::UNIX_EPOCH)
                .expect("system time should be after unix epoch")
                .as_nanos()
        ));
        std::fs::create_dir_all(&dir).expect("temp directory should be created");
        dir
    }
}
