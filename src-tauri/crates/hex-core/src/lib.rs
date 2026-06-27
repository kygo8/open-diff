use serde::{Deserialize, Serialize};

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
}
