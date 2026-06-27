use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct HexBlock {
    pub offset: u64,
    pub bytes: Vec<u8>,
    pub total_len: u64,
    pub end_of_file: bool,
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
}
