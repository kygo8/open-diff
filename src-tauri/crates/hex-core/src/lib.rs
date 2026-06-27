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
