use shared_types::{DiffLine, DiffLineKind, DiffStats, TextDiffRequest, TextDiffResponse};
use std::collections::BTreeMap;

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum TextDiffAlgorithm {
    Myers,
    Patience,
    Histogram,
}

pub fn diff_text(request: &TextDiffRequest) -> TextDiffResponse {
    diff_text_with_algorithm(
        request,
        algorithm_from_request(request.algorithm.as_deref()),
    )
}

fn algorithm_from_request(value: Option<&str>) -> TextDiffAlgorithm {
    match value {
        Some("patience") => TextDiffAlgorithm::Patience,
        Some("histogram") => TextDiffAlgorithm::Histogram,
        _ => TextDiffAlgorithm::Myers,
    }
}

pub fn diff_text_with_algorithm(
    request: &TextDiffRequest,
    algorithm: TextDiffAlgorithm,
) -> TextDiffResponse {
    let left_lines = split_lines(&request.left);
    let right_lines = split_lines(&request.right);
    let edits = match algorithm {
        TextDiffAlgorithm::Myers => diff_lines(&left_lines, &right_lines),
        TextDiffAlgorithm::Patience => patience_diff_lines(&left_lines, &right_lines),
        TextDiffAlgorithm::Histogram => histogram_diff_lines(&left_lines, &right_lines),
    };
    let rows = rows_from_edits(&edits, &left_lines, &right_lines);
    let stats = stats_for(&rows);

    TextDiffResponse { lines: rows, stats }
}

#[derive(Debug, Clone, PartialEq, Eq)]
enum Edit {
    Equal {
        left_index: usize,
        right_index: usize,
    },
    Delete {
        left_index: usize,
    },
    Add {
        right_index: usize,
    },
}

fn diff_lines(left_lines: &[String], right_lines: &[String]) -> Vec<Edit> {
    let table = lcs_table(left_lines, right_lines);
    let mut edits = Vec::new();
    let mut left_index = 0;
    let mut right_index = 0;

    while left_index < left_lines.len() && right_index < right_lines.len() {
        if left_lines[left_index] == right_lines[right_index] {
            edits.push(Edit::Equal {
                left_index,
                right_index,
            });
            left_index += 1;
            right_index += 1;
            continue;
        }

        if table[left_index + 1][right_index] >= table[left_index][right_index + 1] {
            edits.push(Edit::Delete { left_index });
            left_index += 1;
        } else {
            edits.push(Edit::Add { right_index });
            right_index += 1;
        }
    }

    while left_index < left_lines.len() {
        edits.push(Edit::Delete { left_index });
        left_index += 1;
    }

    while right_index < right_lines.len() {
        edits.push(Edit::Add { right_index });
        right_index += 1;
    }

    edits
}

fn patience_diff_lines(left_lines: &[String], right_lines: &[String]) -> Vec<Edit> {
    patience_diff_range(
        left_lines,
        right_lines,
        0,
        left_lines.len(),
        0,
        right_lines.len(),
    )
}

fn histogram_diff_lines(left_lines: &[String], right_lines: &[String]) -> Vec<Edit> {
    histogram_diff_range(
        left_lines,
        right_lines,
        0,
        left_lines.len(),
        0,
        right_lines.len(),
    )
}

fn histogram_diff_range(
    left_lines: &[String],
    right_lines: &[String],
    left_start: usize,
    left_end: usize,
    right_start: usize,
    right_end: usize,
) -> Vec<Edit> {
    let anchors = histogram_anchors(
        &left_lines[left_start..left_end],
        &right_lines[right_start..right_end],
        left_start,
        right_start,
    );

    if anchors.is_empty() {
        return offset_edits(
            diff_lines(
                &left_lines[left_start..left_end],
                &right_lines[right_start..right_end],
            ),
            left_start,
            right_start,
        );
    }

    let mut edits = Vec::new();
    let mut current_left = left_start;
    let mut current_right = right_start;

    for (anchor_left, anchor_right) in anchors {
        edits.extend(histogram_diff_range(
            left_lines,
            right_lines,
            current_left,
            anchor_left,
            current_right,
            anchor_right,
        ));
        edits.push(Edit::Equal {
            left_index: anchor_left,
            right_index: anchor_right,
        });
        current_left = anchor_left + 1;
        current_right = anchor_right + 1;
    }

    edits.extend(histogram_diff_range(
        left_lines,
        right_lines,
        current_left,
        left_end,
        current_right,
        right_end,
    ));

    edits
}

fn histogram_anchors(
    left_lines: &[String],
    right_lines: &[String],
    left_offset: usize,
    right_offset: usize,
) -> Vec<(usize, usize)> {
    let left_positions = line_positions(left_lines);
    let right_positions = line_positions(right_lines);
    let mut candidates = Vec::<(usize, usize, usize)>::new();

    for (line, left_indexes) in left_positions {
        let Some(right_indexes) = right_positions.get(&line) else {
            continue;
        };
        let frequency = left_indexes.len() + right_indexes.len();

        for left_index in left_indexes {
            for right_index in right_indexes {
                candidates.push((
                    frequency,
                    left_index + left_offset,
                    *right_index + right_offset,
                ));
            }
        }
    }

    candidates.sort_by_key(|(frequency, left_index, right_index)| {
        (*frequency, *left_index, *right_index)
    });

    let mut anchors = Vec::<(usize, usize)>::new();
    let mut last_left = None;
    let mut last_right = None;

    for (_, left_index, right_index) in candidates {
        if last_left.is_none_or(|left| left_index > left)
            && last_right.is_none_or(|right| right_index > right)
        {
            last_left = Some(left_index);
            last_right = Some(right_index);
            anchors.push((left_index, right_index));
        }
    }

    anchors
}

fn line_positions(lines: &[String]) -> BTreeMap<String, Vec<usize>> {
    let mut positions = BTreeMap::<String, Vec<usize>>::new();

    for (index, line) in lines.iter().enumerate() {
        positions.entry(line.clone()).or_default().push(index);
    }

    positions
}

fn patience_diff_range(
    left_lines: &[String],
    right_lines: &[String],
    left_start: usize,
    left_end: usize,
    right_start: usize,
    right_end: usize,
) -> Vec<Edit> {
    let anchors = patience_anchors(
        &left_lines[left_start..left_end],
        &right_lines[right_start..right_end],
        left_start,
        right_start,
    );

    if anchors.is_empty() {
        return offset_edits(
            diff_lines(
                &left_lines[left_start..left_end],
                &right_lines[right_start..right_end],
            ),
            left_start,
            right_start,
        );
    }

    let mut edits = Vec::new();
    let mut current_left = left_start;
    let mut current_right = right_start;

    for (anchor_left, anchor_right) in anchors {
        edits.extend(patience_diff_range(
            left_lines,
            right_lines,
            current_left,
            anchor_left,
            current_right,
            anchor_right,
        ));
        edits.push(Edit::Equal {
            left_index: anchor_left,
            right_index: anchor_right,
        });
        current_left = anchor_left + 1;
        current_right = anchor_right + 1;
    }

    edits.extend(patience_diff_range(
        left_lines,
        right_lines,
        current_left,
        left_end,
        current_right,
        right_end,
    ));

    edits
}

fn patience_anchors(
    left_lines: &[String],
    right_lines: &[String],
    left_offset: usize,
    right_offset: usize,
) -> Vec<(usize, usize)> {
    let left_unique = unique_line_positions(left_lines);
    let right_unique = unique_line_positions(right_lines);
    let mut pairs: Vec<(usize, usize)> = left_unique
        .into_iter()
        .filter_map(|(line, left_index)| {
            right_unique
                .get(&line)
                .map(|right_index| (left_index + left_offset, *right_index + right_offset))
        })
        .collect();

    pairs.sort_by_key(|(left_index, right_index)| (*left_index, *right_index));
    longest_increasing_pairs(pairs)
}

fn unique_line_positions(lines: &[String]) -> BTreeMap<String, usize> {
    let mut counts = BTreeMap::<String, (usize, usize)>::new();

    for (index, line) in lines.iter().enumerate() {
        counts
            .entry(line.clone())
            .and_modify(|entry| entry.0 += 1)
            .or_insert((1, index));
    }

    counts
        .into_iter()
        .filter_map(|(line, (count, index))| (count == 1).then_some((line, index)))
        .collect()
}

fn longest_increasing_pairs(pairs: Vec<(usize, usize)>) -> Vec<(usize, usize)> {
    let mut sequence = Vec::<(usize, usize)>::new();
    let mut last_right = None;

    for pair in pairs {
        if last_right.is_none_or(|right| pair.1 > right) {
            last_right = Some(pair.1);
            sequence.push(pair);
        }
    }

    sequence
}

fn offset_edits(edits: Vec<Edit>, left_offset: usize, right_offset: usize) -> Vec<Edit> {
    edits
        .into_iter()
        .map(|edit| match edit {
            Edit::Equal {
                left_index,
                right_index,
            } => Edit::Equal {
                left_index: left_index + left_offset,
                right_index: right_index + right_offset,
            },
            Edit::Delete { left_index } => Edit::Delete {
                left_index: left_index + left_offset,
            },
            Edit::Add { right_index } => Edit::Add {
                right_index: right_index + right_offset,
            },
        })
        .collect()
}

fn lcs_table(left_lines: &[String], right_lines: &[String]) -> Vec<Vec<usize>> {
    let mut table = vec![vec![0; right_lines.len() + 1]; left_lines.len() + 1];

    for left_index in (0..left_lines.len()).rev() {
        for right_index in (0..right_lines.len()).rev() {
            table[left_index][right_index] = if left_lines[left_index] == right_lines[right_index] {
                table[left_index + 1][right_index + 1] + 1
            } else {
                table[left_index + 1][right_index].max(table[left_index][right_index + 1])
            };
        }
    }

    table
}

fn rows_from_edits(edits: &[Edit], left_lines: &[String], right_lines: &[String]) -> Vec<DiffLine> {
    let mut rows = Vec::new();
    let mut index = 0;

    while index < edits.len() {
        match (&edits[index], edits.get(index + 1)) {
            (
                Edit::Delete { left_index },
                Some(Edit::Add {
                    right_index: next_right_index,
                }),
            ) => {
                rows.push(line(
                    Some(left_index + 1),
                    Some(next_right_index + 1),
                    &left_lines[*left_index],
                    &right_lines[*next_right_index],
                    DiffLineKind::Modified,
                ));
                index += 2;
            }
            (
                Edit::Equal {
                    left_index,
                    right_index,
                },
                _,
            ) => {
                rows.push(line(
                    Some(left_index + 1),
                    Some(right_index + 1),
                    &left_lines[*left_index],
                    &right_lines[*right_index],
                    DiffLineKind::Equal,
                ));
                index += 1;
            }
            (Edit::Delete { left_index }, _) => {
                rows.push(line(
                    Some(left_index + 1),
                    None,
                    &left_lines[*left_index],
                    "",
                    DiffLineKind::Deleted,
                ));
                index += 1;
            }
            (Edit::Add { right_index }, _) => {
                rows.push(line(
                    None,
                    Some(right_index + 1),
                    "",
                    &right_lines[*right_index],
                    DiffLineKind::Added,
                ));
                index += 1;
            }
        }
    }

    rows
}

fn stats_for(rows: &[DiffLine]) -> DiffStats {
    let mut stats = DiffStats {
        added: 0,
        deleted: 0,
        modified: 0,
        equal: 0,
    };

    for row in rows {
        match &row.kind {
            DiffLineKind::Equal => stats.equal += 1,
            DiffLineKind::Added => stats.added += 1,
            DiffLineKind::Deleted => stats.deleted += 1,
            DiffLineKind::Modified => stats.modified += 1,
        }
    }

    stats
}

fn split_lines(input: &str) -> Vec<String> {
    if input.is_empty() {
        return Vec::new();
    }

    input
        .replace("\r\n", "\n")
        .replace('\r', "\n")
        .split('\n')
        .map(ToOwned::to_owned)
        .collect()
}

fn line(
    left_number: Option<usize>,
    right_number: Option<usize>,
    left_text: &str,
    right_text: &str,
    kind: DiffLineKind,
) -> DiffLine {
    DiffLine {
        left_number,
        right_number,
        left_text: left_text.to_owned(),
        right_text: right_text.to_owned(),
        kind,
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn reports_equal_and_modified_lines() {
        let request = TextDiffRequest {
            left: "one\ntwo".to_owned(),
            right: "one\n2".to_owned(),
            algorithm: None,
        };

        let result = diff_text(&request);

        assert_eq!(result.stats.equal, 1);
        assert_eq!(result.stats.modified, 1);
        assert_eq!(result.lines[1].kind, DiffLineKind::Modified);
    }

    #[test]
    fn reports_added_lines() {
        let request = TextDiffRequest {
            left: "one".to_owned(),
            right: "one\ntwo".to_owned(),
            algorithm: None,
        };

        let result = diff_text(&request);

        assert_eq!(result.stats.added, 1);
        assert_eq!(result.lines[1].right_text, "two");
    }

    #[test]
    fn realigns_after_inserted_line() {
        let request = TextDiffRequest {
            left: "a\nb\nc".to_owned(),
            right: "a\nx\nb\nc".to_owned(),
            algorithm: None,
        };

        let result = diff_text(&request);
        let kinds: Vec<DiffLineKind> = result.lines.iter().map(|line| line.kind.clone()).collect();

        assert_eq!(
            kinds,
            vec![
                DiffLineKind::Equal,
                DiffLineKind::Added,
                DiffLineKind::Equal,
                DiffLineKind::Equal,
            ]
        );
        assert_eq!(result.stats.modified, 0);
        assert_eq!(result.stats.added, 1);
    }

    #[test]
    fn patience_uses_unique_lines_as_readable_anchors() {
        let request = TextDiffRequest {
            left: "repeat\nalpha\nalpha\nshared-anchor\nbeta\nbeta\nrepeat".to_owned(),
            right: "repeat\nbeta\nbeta\nshared-anchor\nalpha\nalpha\nrepeat".to_owned(),
            algorithm: None,
        };

        let result = diff_text_with_algorithm(&request, TextDiffAlgorithm::Patience);
        let anchor = result
            .lines
            .iter()
            .find(|line| line.left_text == "shared-anchor" && line.right_text == "shared-anchor");

        assert!(anchor.is_some_and(|line| line.kind == DiffLineKind::Equal));
    }

    #[test]
    fn histogram_uses_low_frequency_lines_as_anchors() {
        let request = TextDiffRequest {
            left: "noise\nnoise\nleft-only\nrare-anchor\nnoise\ncommon\nnoise".to_owned(),
            right: "noise\nnoise\nright-only\nrare-anchor\nnoise\ncommon\nnoise".to_owned(),
            algorithm: None,
        };

        let result = diff_text_with_algorithm(&request, TextDiffAlgorithm::Histogram);
        let anchor = result
            .lines
            .iter()
            .find(|line| line.left_text == "rare-anchor" && line.right_text == "rare-anchor");

        assert!(anchor.is_some_and(|line| line.kind == DiffLineKind::Equal));
    }
}
