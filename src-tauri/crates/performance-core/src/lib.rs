const TEXT_LINE_COUNT: usize = 20_000;
const TEXT_MODIFIED_INTERVAL: usize = 137;
const TEXT_ADDED_INTERVAL: usize = 251;
const FOLDER_ENTRY_COUNT: usize = 5_200;
const FOLDER_MODIFIED_INTERVAL: usize = 41;
const FOLDER_LEFT_ONLY_INTERVAL: usize = 83;
const FOLDER_RIGHT_ONLY_INTERVAL: usize = 97;
const BINARY_SIZE_BYTES: usize = 2 * 1024 * 1024;
const BINARY_CHANGE_RANGE_COUNT: usize = 16;
const BINARY_CHANGE_RANGE_LEN: usize = 32;
const BINARY_CHUNK_SIZE: usize = 64 * 1024;

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct PerformanceBenchmarkSuite {
    pub text: TextBenchmarkData,
    pub folder: FolderBenchmarkData,
    pub binary: BinaryBenchmarkData,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct TextBenchmarkData {
    pub left: String,
    pub right: String,
    pub expected_modified_lines: usize,
    pub expected_added_lines: usize,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct FolderBenchmarkData {
    pub left_entries: Vec<FolderBenchmarkEntry>,
    pub right_entries: Vec<FolderBenchmarkEntry>,
    pub expected_modified_files: usize,
    pub expected_left_only_entries: usize,
    pub expected_right_only_entries: usize,
    pub max_depth: usize,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct FolderBenchmarkEntry {
    pub path: String,
    pub size: u64,
    pub modified_at_ms: u64,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct BinaryBenchmarkData {
    pub left: Vec<u8>,
    pub right: Vec<u8>,
    pub changed_ranges: Vec<BinaryChangedRange>,
    pub chunk_size: usize,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct BinaryChangedRange {
    pub offset: usize,
    pub length: usize,
}

pub fn build_performance_benchmark_suite() -> PerformanceBenchmarkSuite {
    PerformanceBenchmarkSuite {
        text: build_text_benchmark_data(),
        folder: build_folder_benchmark_data(),
        binary: build_binary_benchmark_data(),
    }
}

fn build_text_benchmark_data() -> TextBenchmarkData {
    let mut left_lines = Vec::with_capacity(TEXT_LINE_COUNT);
    let mut right_lines = Vec::with_capacity(TEXT_LINE_COUNT + TEXT_ADDED_INTERVAL);
    let mut expected_modified_lines = 0;
    let mut expected_added_lines = 0;

    for index in 0..TEXT_LINE_COUNT {
        let base_line = format!("record-{index:05}|alpha|beta|gamma|checksum-{index:08X}");

        left_lines.push(base_line.clone());

        if index > 0 && index % TEXT_ADDED_INTERVAL == 0 {
            right_lines.push(format!("record-{index:05}|right-only|payload"));
            expected_added_lines += 1;
        }

        if index > 0 && index % TEXT_MODIFIED_INTERVAL == 0 {
            right_lines.push(format!(
                "record-{index:05}|alpha|changed|gamma|checksum-{index:08X}"
            ));
            expected_modified_lines += 1;
        } else {
            right_lines.push(base_line);
        }
    }

    TextBenchmarkData {
        left: left_lines.join("\n"),
        right: right_lines.join("\n"),
        expected_modified_lines,
        expected_added_lines,
    }
}

fn build_folder_benchmark_data() -> FolderBenchmarkData {
    let mut left_entries = Vec::with_capacity(FOLDER_ENTRY_COUNT);
    let mut right_entries = Vec::with_capacity(FOLDER_ENTRY_COUNT);
    let mut expected_modified_files = 0;
    let mut expected_left_only_entries = 0;
    let mut expected_right_only_entries = 0;

    for index in 0..FOLDER_ENTRY_COUNT {
        let path = benchmark_folder_path(index);
        let left_entry = FolderBenchmarkEntry {
            path: path.clone(),
            size: benchmark_file_size(index),
            modified_at_ms: benchmark_modified_at_ms(index),
        };

        if index > 0 && index % FOLDER_LEFT_ONLY_INTERVAL == 0 {
            expected_left_only_entries += 1;
            left_entries.push(left_entry);
            continue;
        }

        let mut right_entry = left_entry.clone();

        if index > 0 && index % FOLDER_MODIFIED_INTERVAL == 0 {
            right_entry.size += 17;
            right_entry.modified_at_ms += 1_000;
            expected_modified_files += 1;
        }

        left_entries.push(left_entry);
        right_entries.push(right_entry);

        if index > 0 && index % FOLDER_RIGHT_ONLY_INTERVAL == 0 {
            right_entries.push(FolderBenchmarkEntry {
                path: format!("right-only/batch-{index:05}/generated.bin"),
                size: 4_096 + index as u64,
                modified_at_ms: 1_750_000_000_000 + index as u64,
            });
            expected_right_only_entries += 1;
        }
    }

    FolderBenchmarkData {
        left_entries,
        right_entries,
        expected_modified_files,
        expected_left_only_entries,
        expected_right_only_entries,
        max_depth: 4,
    }
}

fn benchmark_folder_path(index: usize) -> String {
    format!(
        "project-{}/module-{}/section-{}/asset-{index:05}.dat",
        index % 16,
        index % 64,
        index % 128,
    )
}

fn benchmark_file_size(index: usize) -> u64 {
    1_024 + ((index * 37) % 65_536) as u64
}

fn benchmark_modified_at_ms(index: usize) -> u64 {
    1_700_000_000_000 + (index as u64 * 997)
}

fn build_binary_benchmark_data() -> BinaryBenchmarkData {
    let left = build_binary_payload();
    let mut right = left.clone();
    let mut changed_ranges = Vec::with_capacity(BINARY_CHANGE_RANGE_COUNT);

    for range_index in 0..BINARY_CHANGE_RANGE_COUNT {
        let offset =
            (range_index * 131_071 + 4_096) % (BINARY_SIZE_BYTES - BINARY_CHANGE_RANGE_LEN);

        for byte in right.iter_mut().skip(offset).take(BINARY_CHANGE_RANGE_LEN) {
            *byte = byte.wrapping_add((range_index as u8).wrapping_add(1));
        }

        changed_ranges.push(BinaryChangedRange {
            offset,
            length: BINARY_CHANGE_RANGE_LEN,
        });
    }

    BinaryBenchmarkData {
        left,
        right,
        changed_ranges,
        chunk_size: BINARY_CHUNK_SIZE,
    }
}

fn build_binary_payload() -> Vec<u8> {
    (0..BINARY_SIZE_BYTES)
        .map(|index| {
            let value = index.wrapping_mul(31).wrapping_add(index / 257) % 256;

            value as u8
        })
        .collect()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn benchmark_suite_includes_large_text_folder_and_binary_data() {
        let suite = build_performance_benchmark_suite();

        assert!(suite.text.left.lines().count() >= 20_000);
        assert!(suite.text.right.lines().count() >= 20_000);
        assert!(suite.text.expected_modified_lines >= 100);
        assert!(suite.text.expected_added_lines >= 50);

        assert!(suite.folder.left_entries.len() >= 5_000);
        assert!(suite.folder.right_entries.len() >= 5_000);
        assert!(suite.folder.expected_modified_files >= 100);
        assert!(suite.folder.expected_left_only_entries >= 50);
        assert!(suite.folder.expected_right_only_entries >= 50);
        assert!(suite.folder.max_depth >= 4);

        assert!(suite.binary.left.len() >= 2 * 1024 * 1024);
        assert_eq!(suite.binary.left.len(), suite.binary.right.len());
        assert!(suite.binary.changed_ranges.len() >= 8);
        assert_eq!(suite.binary.chunk_size, 64 * 1024);
    }

    #[test]
    fn benchmark_suite_is_deterministic() {
        let first = build_performance_benchmark_suite();
        let second = build_performance_benchmark_suite();

        assert_eq!(first, second);
    }
}
