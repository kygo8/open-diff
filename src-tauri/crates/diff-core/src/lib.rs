use regex::Regex;
use shared_types::{
    DiffLine, DiffLineKind, DiffStats, InlineDiffSegment, InlineDiffSegments, TextDiffRequest,
    TextDiffResponse, TextPatchResponse,
};
use std::collections::BTreeMap;

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum TextDiffAlgorithm {
    Myers,
    Patience,
    Histogram,
}

const DEFAULT_LINE_ALIGNMENT_WEIGHT: i32 = 100;
const MIN_LINE_ALIGNMENT_WEIGHT: i32 = 1;

#[derive(Debug, Clone, Copy)]
struct LineAlignmentWeights<'a> {
    left: &'a [i32],
    right: &'a [i32],
}

impl LineAlignmentWeights<'_> {
    fn match_weight(&self, left_index: usize, right_index: usize) -> i32 {
        let left_weight = self
            .left
            .get(left_index)
            .copied()
            .unwrap_or(DEFAULT_LINE_ALIGNMENT_WEIGHT);
        let right_weight = self
            .right
            .get(right_index)
            .copied()
            .unwrap_or(DEFAULT_LINE_ALIGNMENT_WEIGHT);

        left_weight.max(right_weight).max(MIN_LINE_ALIGNMENT_WEIGHT)
    }
}

pub fn diff_text(request: &TextDiffRequest) -> TextDiffResponse {
    diff_text_with_algorithm(
        request,
        algorithm_from_request(request.algorithm.as_deref()),
    )
}

pub fn parse_text_patch(input: &str) -> TextPatchResponse {
    let mut files = Vec::new();
    let mut current_file: Option<shared_types::PatchFile> = None;
    let mut current_hunk: Option<shared_types::PatchHunk> = None;
    let mut old_line_number = 0;
    let mut new_line_number = 0;

    for line in input.lines() {
        if let Some(old_path) = line.strip_prefix("--- ") {
            flush_hunk(&mut current_file, &mut current_hunk);
            flush_file(&mut files, &mut current_file);
            current_file = Some(shared_types::PatchFile {
                old_path: old_path.to_owned(),
                new_path: String::new(),
                hunks: Vec::new(),
            });
            continue;
        }

        if let Some(new_path) = line.strip_prefix("+++ ") {
            if let Some(file) = &mut current_file {
                file.new_path = new_path.to_owned();
            }
            continue;
        }

        if let Some(header) = line.strip_prefix("@@ ") {
            flush_hunk(&mut current_file, &mut current_hunk);
            if let Some(hunk) = parse_hunk_header(header) {
                old_line_number = hunk.old_start;
                new_line_number = hunk.new_start;
                current_hunk = Some(hunk);
            }
            continue;
        }

        if let Some(hunk) = &mut current_hunk {
            if let Some(patch_line) =
                parse_patch_line(line, &mut old_line_number, &mut new_line_number)
            {
                hunk.lines.push(patch_line);
            }
        }
    }

    flush_hunk(&mut current_file, &mut current_hunk);
    flush_file(&mut files, &mut current_file);

    TextPatchResponse { files }
}

fn algorithm_from_request(value: Option<&str>) -> TextDiffAlgorithm {
    match value {
        Some("patience") => TextDiffAlgorithm::Patience,
        Some("histogram") => TextDiffAlgorithm::Histogram,
        _ => TextDiffAlgorithm::Myers,
    }
}

fn flush_file(
    files: &mut Vec<shared_types::PatchFile>,
    current_file: &mut Option<shared_types::PatchFile>,
) {
    if let Some(file) = current_file.take() {
        files.push(file);
    }
}

fn flush_hunk(
    current_file: &mut Option<shared_types::PatchFile>,
    current_hunk: &mut Option<shared_types::PatchHunk>,
) {
    let Some(hunk) = current_hunk.take() else {
        return;
    };

    if let Some(file) = current_file {
        file.hunks.push(hunk);
    }
}

fn parse_hunk_header(header: &str) -> Option<shared_types::PatchHunk> {
    let (ranges, heading) = header.split_once("@@").unwrap_or((header, ""));
    let mut parts = ranges.split_whitespace();
    let old_range = parts.next()?.strip_prefix('-')?;
    let new_range = parts.next()?.strip_prefix('+')?;
    let (old_start, old_count) = parse_patch_range(old_range)?;
    let (new_start, new_count) = parse_patch_range(new_range)?;

    Some(shared_types::PatchHunk {
        old_start,
        old_count,
        new_start,
        new_count,
        heading: heading.trim().to_owned(),
        lines: Vec::new(),
    })
}

fn parse_patch_range(value: &str) -> Option<(usize, usize)> {
    let (start, count) = value.split_once(',').unwrap_or((value, "1"));

    Some((start.parse().ok()?, count.parse().ok()?))
}

fn parse_patch_line(
    line: &str,
    old_line_number: &mut usize,
    new_line_number: &mut usize,
) -> Option<shared_types::PatchLine> {
    if line.starts_with('\\') {
        return None;
    }

    let (kind, text, old_number, new_number) = match line.as_bytes().first().copied()? {
        b' ' => {
            let old_number = *old_line_number;
            let new_number = *new_line_number;
            *old_line_number += 1;
            *new_line_number += 1;
            (
                shared_types::PatchLineKind::Context,
                &line[1..],
                Some(old_number),
                Some(new_number),
            )
        }
        b'-' => {
            let old_number = *old_line_number;
            *old_line_number += 1;
            (
                shared_types::PatchLineKind::Removed,
                &line[1..],
                Some(old_number),
                None,
            )
        }
        b'+' => {
            let new_number = *new_line_number;
            *new_line_number += 1;
            (
                shared_types::PatchLineKind::Added,
                &line[1..],
                None,
                Some(new_number),
            )
        }
        _ => return None,
    };

    Some(shared_types::PatchLine {
        kind,
        old_number,
        new_number,
        text: text.to_owned(),
    })
}

pub fn diff_text_with_algorithm(
    request: &TextDiffRequest,
    algorithm: TextDiffAlgorithm,
) -> TextDiffResponse {
    diff_text_with_algorithm_and_weights(request, algorithm, None)
}

fn diff_text_with_algorithm_and_weights(
    request: &TextDiffRequest,
    algorithm: TextDiffAlgorithm,
    weights: Option<LineAlignmentWeights<'_>>,
) -> TextDiffResponse {
    let left_lines = split_lines(&request.left);
    let right_lines = split_lines(&request.right);
    let ignore_regexes = compiled_ignore_regexes(&request.ignore_regexes);
    let comparable_left_lines = comparable_lines(&left_lines, request, &ignore_regexes);
    let comparable_right_lines = comparable_lines(&right_lines, request, &ignore_regexes);
    let edits = match algorithm {
        TextDiffAlgorithm::Myers => match weights {
            Some(weights) => {
                weighted_diff_lines(&comparable_left_lines, &comparable_right_lines, weights)
            }
            None => diff_lines(&comparable_left_lines, &comparable_right_lines),
        },
        TextDiffAlgorithm::Patience => {
            patience_diff_lines(&comparable_left_lines, &comparable_right_lines, weights)
        }
        TextDiffAlgorithm::Histogram => {
            histogram_diff_lines(&comparable_left_lines, &comparable_right_lines, weights)
        }
    };
    let rows = rows_from_edits(&edits, &left_lines, &right_lines);
    let stats = stats_for(&rows);

    TextDiffResponse { lines: rows, stats }
}

pub fn diff_text_with_grammar(
    request: &TextDiffRequest,
    grammar: &format_core::GrammarDefinition,
) -> TextDiffResponse {
    let left_lines = split_lines(&request.left);
    let right_lines = split_lines(&request.right);
    let left_weights = grammar_line_weights(&left_lines, grammar);
    let right_weights = grammar_line_weights(&right_lines, grammar);
    let weights = LineAlignmentWeights {
        left: &left_weights,
        right: &right_weights,
    };
    let mut response = diff_text_with_algorithm_and_weights(
        request,
        algorithm_from_request(request.algorithm.as_deref()),
        Some(weights),
    );

    for line in &mut response.lines {
        line.important = grammar_diff_is_important(line, grammar);
    }

    response
}

pub fn diff_text_with_replacement_rules(
    request: &TextDiffRequest,
    rules: &[format_core::TextReplacementIgnoreRule],
) -> TextDiffResponse {
    let mut response = diff_text(request);

    for line in &mut response.lines {
        if replacement_diff_is_ignored(line, rules) {
            line.important = false;
        }
    }

    response
}

fn compiled_ignore_regexes(patterns: &[String]) -> Vec<Regex> {
    patterns
        .iter()
        .filter_map(|pattern| Regex::new(pattern).ok())
        .collect()
}

fn comparable_lines(
    lines: &[String],
    request: &TextDiffRequest,
    ignore_regexes: &[Regex],
) -> Vec<String> {
    lines
        .iter()
        .map(|line| comparable_line(line, request, ignore_regexes))
        .collect()
}

fn comparable_line(line: &str, request: &TextDiffRequest, ignore_regexes: &[Regex]) -> String {
    let mut value = if request.ignore_whitespace {
        line.split_whitespace().collect::<String>()
    } else {
        line.to_owned()
    };

    for expression in ignore_regexes {
        value = expression.replace_all(&value, "").into_owned();
    }

    if request.ignore_case {
        value = value.to_lowercase();
    }

    if request.ignore_line_endings {
        value = value.trim_end_matches(['\r', '\n']).to_owned();
    }

    value
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

fn weighted_diff_lines(
    left_lines: &[String],
    right_lines: &[String],
    weights: LineAlignmentWeights<'_>,
) -> Vec<Edit> {
    weighted_diff_lines_range(
        left_lines,
        right_lines,
        0,
        left_lines.len(),
        0,
        right_lines.len(),
        weights,
    )
}

fn weighted_diff_lines_range(
    left_lines: &[String],
    right_lines: &[String],
    left_start: usize,
    left_end: usize,
    right_start: usize,
    right_end: usize,
    weights: LineAlignmentWeights<'_>,
) -> Vec<Edit> {
    let table = weighted_lcs_table(
        left_lines,
        right_lines,
        left_start,
        left_end,
        right_start,
        right_end,
        weights,
    );
    let mut edits = Vec::new();
    let mut left_index = left_start;
    let mut right_index = right_start;

    while left_index < left_end && right_index < right_end {
        if left_lines[left_index] == right_lines[right_index] {
            edits.push(Edit::Equal {
                left_index,
                right_index,
            });
            left_index += 1;
            right_index += 1;
            continue;
        }

        let relative_left = left_index - left_start;
        let relative_right = right_index - right_start;

        if table[relative_left + 1][relative_right] >= table[relative_left][relative_right + 1] {
            edits.push(Edit::Delete { left_index });
            left_index += 1;
        } else {
            edits.push(Edit::Add { right_index });
            right_index += 1;
        }
    }

    while left_index < left_end {
        edits.push(Edit::Delete { left_index });
        left_index += 1;
    }

    while right_index < right_end {
        edits.push(Edit::Add { right_index });
        right_index += 1;
    }

    edits
}

fn patience_diff_lines(
    left_lines: &[String],
    right_lines: &[String],
    weights: Option<LineAlignmentWeights<'_>>,
) -> Vec<Edit> {
    patience_diff_range(
        left_lines,
        right_lines,
        0,
        left_lines.len(),
        0,
        right_lines.len(),
        weights,
    )
}

fn histogram_diff_lines(
    left_lines: &[String],
    right_lines: &[String],
    weights: Option<LineAlignmentWeights<'_>>,
) -> Vec<Edit> {
    histogram_diff_range(
        left_lines,
        right_lines,
        0,
        left_lines.len(),
        0,
        right_lines.len(),
        weights,
    )
}

fn histogram_diff_range(
    left_lines: &[String],
    right_lines: &[String],
    left_start: usize,
    left_end: usize,
    right_start: usize,
    right_end: usize,
    weights: Option<LineAlignmentWeights<'_>>,
) -> Vec<Edit> {
    let anchors = histogram_anchors(
        &left_lines[left_start..left_end],
        &right_lines[right_start..right_end],
        left_start,
        right_start,
        weights,
    );

    if anchors.is_empty() {
        return match weights {
            Some(weights) => weighted_diff_lines_range(
                left_lines,
                right_lines,
                left_start,
                left_end,
                right_start,
                right_end,
                weights,
            ),
            None => offset_edits(
                diff_lines(
                    &left_lines[left_start..left_end],
                    &right_lines[right_start..right_end],
                ),
                left_start,
                right_start,
            ),
        };
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
            weights,
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
        weights,
    ));

    edits
}

fn histogram_anchors(
    left_lines: &[String],
    right_lines: &[String],
    left_offset: usize,
    right_offset: usize,
    weights: Option<LineAlignmentWeights<'_>>,
) -> Vec<(usize, usize)> {
    let left_positions = line_positions(left_lines);
    let right_positions = line_positions(right_lines);
    let mut candidates = Vec::<(usize, i32, usize, usize)>::new();

    for (line, left_indexes) in left_positions {
        let Some(right_indexes) = right_positions.get(&line) else {
            continue;
        };
        let frequency = left_indexes.len() + right_indexes.len();

        for left_index in left_indexes {
            for right_index in right_indexes {
                let absolute_left = left_index + left_offset;
                let absolute_right = *right_index + right_offset;
                let alignment_weight = weights
                    .map(|weights| weights.match_weight(absolute_left, absolute_right))
                    .unwrap_or(DEFAULT_LINE_ALIGNMENT_WEIGHT);
                candidates.push((frequency, alignment_weight, absolute_left, absolute_right));
            }
        }
    }

    candidates.sort_by_key(|(frequency, alignment_weight, left_index, right_index)| {
        (*frequency, -*alignment_weight, *left_index, *right_index)
    });

    let mut anchors = Vec::<(usize, usize)>::new();
    let mut last_left = None;
    let mut last_right = None;

    for (_, _, left_index, right_index) in candidates {
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
    weights: Option<LineAlignmentWeights<'_>>,
) -> Vec<Edit> {
    let anchors = patience_anchors(
        &left_lines[left_start..left_end],
        &right_lines[right_start..right_end],
        left_start,
        right_start,
        weights,
    );

    if anchors.is_empty() {
        return match weights {
            Some(weights) => weighted_diff_lines_range(
                left_lines,
                right_lines,
                left_start,
                left_end,
                right_start,
                right_end,
                weights,
            ),
            None => offset_edits(
                diff_lines(
                    &left_lines[left_start..left_end],
                    &right_lines[right_start..right_end],
                ),
                left_start,
                right_start,
            ),
        };
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
            weights,
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
        weights,
    ));

    edits
}

fn patience_anchors(
    left_lines: &[String],
    right_lines: &[String],
    left_offset: usize,
    right_offset: usize,
    _weights: Option<LineAlignmentWeights<'_>>,
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

fn weighted_lcs_table(
    left_lines: &[String],
    right_lines: &[String],
    left_start: usize,
    left_end: usize,
    right_start: usize,
    right_end: usize,
    weights: LineAlignmentWeights<'_>,
) -> Vec<Vec<i32>> {
    let left_len = left_end - left_start;
    let right_len = right_end - right_start;
    let mut table = vec![vec![0; right_len + 1]; left_len + 1];

    for relative_left in (0..left_len).rev() {
        for relative_right in (0..right_len).rev() {
            let left_index = left_start + relative_left;
            let right_index = right_start + relative_right;
            table[relative_left][relative_right] =
                if left_lines[left_index] == right_lines[right_index] {
                    table[relative_left + 1][relative_right + 1]
                        + weights.match_weight(left_index, right_index)
                } else {
                    table[relative_left + 1][relative_right]
                        .max(table[relative_left][relative_right + 1])
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
    let inline_segments = inline_segments_for(left_text, right_text, &kind);
    let important = diff_line_is_important(&kind);

    DiffLine {
        left_number,
        right_number,
        left_text: left_text.to_owned(),
        right_text: right_text.to_owned(),
        kind,
        inline_segments,
        important,
    }
}

fn diff_line_is_important(kind: &DiffLineKind) -> bool {
    *kind != DiffLineKind::Equal
}

fn grammar_line_weights(lines: &[String], grammar: &format_core::GrammarDefinition) -> Vec<i32> {
    lines
        .iter()
        .map(|line| {
            format_core::find_grammar_item(line, grammar)
                .map(|item_match| {
                    (DEFAULT_LINE_ALIGNMENT_WEIGHT + item_match.line_weight)
                        .max(MIN_LINE_ALIGNMENT_WEIGHT)
                })
                .unwrap_or(DEFAULT_LINE_ALIGNMENT_WEIGHT)
        })
        .collect()
}

fn grammar_diff_is_important(line: &DiffLine, grammar: &format_core::GrammarDefinition) -> bool {
    if line.kind == DiffLineKind::Equal {
        return false;
    }

    let left_match = format_core::find_grammar_item(&line.left_text, grammar);
    let right_match = format_core::find_grammar_item(&line.right_text, grammar);

    !matches!(
        (left_match, right_match),
        (Some(left), Some(right))
            if left.importance == format_core::GrammarImportance::Unimportant
                && right.importance == format_core::GrammarImportance::Unimportant
                && left.item_id == right.item_id
    )
}

fn replacement_diff_is_ignored(
    line: &DiffLine,
    rules: &[format_core::TextReplacementIgnoreRule],
) -> bool {
    if line.kind == DiffLineKind::Equal {
        return false;
    }

    rules.iter().any(|rule| {
        format_core::text_replacement_is_ignored(&line.left_text, &line.right_text, rule)
    })
}

fn inline_segments_for(
    left_text: &str,
    right_text: &str,
    kind: &DiffLineKind,
) -> InlineDiffSegments {
    if *kind != DiffLineKind::Modified {
        return InlineDiffSegments::default();
    }

    let left_chars: Vec<char> = left_text.chars().collect();
    let right_chars: Vec<char> = right_text.chars().collect();
    let mut prefix_len = 0;

    while prefix_len < left_chars.len()
        && prefix_len < right_chars.len()
        && left_chars[prefix_len] == right_chars[prefix_len]
    {
        prefix_len += 1;
    }

    let mut suffix_len = 0;

    while suffix_len + prefix_len < left_chars.len()
        && suffix_len + prefix_len < right_chars.len()
        && left_chars[left_chars.len() - suffix_len - 1]
            == right_chars[right_chars.len() - suffix_len - 1]
    {
        suffix_len += 1;
    }

    InlineDiffSegments {
        left: build_inline_segments(&left_chars, prefix_len, suffix_len),
        right: build_inline_segments(&right_chars, prefix_len, suffix_len),
    }
}

fn build_inline_segments(
    chars: &[char],
    prefix_len: usize,
    suffix_len: usize,
) -> Vec<InlineDiffSegment> {
    let mut segments = Vec::new();

    if prefix_len > 0 {
        segments.push(InlineDiffSegment {
            text: chars[..prefix_len].iter().collect(),
            changed: false,
        });
    }

    let changed_end = chars.len().saturating_sub(suffix_len);

    if changed_end > prefix_len {
        segments.push(InlineDiffSegment {
            text: chars[prefix_len..changed_end].iter().collect(),
            changed: true,
        });
    }

    if suffix_len > 0 {
        segments.push(InlineDiffSegment {
            text: chars[changed_end..].iter().collect(),
            changed: false,
        });
    }

    segments
}

#[cfg(test)]
mod tests {
    use super::*;

    fn request(left: &str, right: &str) -> TextDiffRequest {
        TextDiffRequest {
            left: left.to_owned(),
            right: right.to_owned(),
            algorithm: None,
            ignore_whitespace: false,
            ignore_case: false,
            ignore_line_endings: false,
            ignore_regexes: Vec::new(),
        }
    }

    #[test]
    fn reports_equal_and_modified_lines() {
        let request = request("one\ntwo", "one\n2");

        let result = diff_text(&request);

        assert_eq!(result.stats.equal, 1);
        assert_eq!(result.stats.modified, 1);
        assert_eq!(result.lines[1].kind, DiffLineKind::Modified);
    }

    #[test]
    fn reports_added_lines() {
        let request = request("one", "one\ntwo");

        let result = diff_text(&request);

        assert_eq!(result.stats.added, 1);
        assert_eq!(result.lines[1].right_text, "two");
    }

    #[test]
    fn realigns_after_inserted_line() {
        let request = request("a\nb\nc", "a\nx\nb\nc");

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
        let request = request(
            "repeat\nalpha\nalpha\nshared-anchor\nbeta\nbeta\nrepeat",
            "repeat\nbeta\nbeta\nshared-anchor\nalpha\nalpha\nrepeat",
        );

        let result = diff_text_with_algorithm(&request, TextDiffAlgorithm::Patience);
        let anchor = result
            .lines
            .iter()
            .find(|line| line.left_text == "shared-anchor" && line.right_text == "shared-anchor");

        assert!(anchor.is_some_and(|line| line.kind == DiffLineKind::Equal));
    }

    #[test]
    fn histogram_uses_low_frequency_lines_as_anchors() {
        let request = request(
            "noise\nnoise\nleft-only\nrare-anchor\nnoise\ncommon\nnoise",
            "noise\nnoise\nright-only\nrare-anchor\nnoise\ncommon\nnoise",
        );

        let result = diff_text_with_algorithm(&request, TextDiffAlgorithm::Histogram);
        let anchor = result
            .lines
            .iter()
            .find(|line| line.left_text == "rare-anchor" && line.right_text == "rare-anchor");

        assert!(anchor.is_some_and(|line| line.kind == DiffLineKind::Equal));
    }

    #[test]
    fn modified_lines_include_inline_character_segments() {
        let request = request("line two", "line too");

        let result = diff_text(&request);
        let modified = &result.lines[0];

        assert_eq!(modified.kind, DiffLineKind::Modified);
        assert!(modified
            .inline_segments
            .left
            .iter()
            .any(|segment| segment.changed));
        assert!(modified
            .inline_segments
            .right
            .iter()
            .any(|segment| segment.changed));
    }

    #[test]
    fn ignores_whitespace_and_case_when_requested() {
        let request = TextDiffRequest {
            left: "Line   One".to_owned(),
            right: "line one".to_owned(),
            algorithm: None,
            ignore_whitespace: true,
            ignore_case: true,
            ignore_line_endings: false,
            ignore_regexes: Vec::new(),
        };

        let result = diff_text(&request);

        assert_eq!(result.stats.equal, 1);
        assert_eq!(result.stats.modified, 0);
        assert_eq!(result.lines[0].left_text, "Line   One");
        assert_eq!(result.lines[0].right_text, "line one");
    }

    #[test]
    fn ignores_regex_fragments_when_requested() {
        let mut request = request("status=ok timestamp=123", "status=ok timestamp=456");
        request.ignore_regexes = vec!["timestamp=\\d+".to_owned()];

        let result = diff_text(&request);

        assert_eq!(result.stats.equal, 1);
        assert_eq!(result.stats.modified, 0);
    }

    #[test]
    fn marks_comment_differences_as_unimportant_with_grammar_rules() {
        let grammar = format_core::GrammarDefinition {
            id: "rust-grammar".to_owned(),
            name: "Rust Grammar".to_owned(),
            items: vec![format_core::GrammarItem {
                id: "line-comment".to_owned(),
                name: "Line Comment".to_owned(),
                kind: format_core::GrammarItemKind::Comment,
                matcher: format_core::GrammarMatcher::LinePrefix("//".to_owned()),
                style_scope: "comment.line".to_owned(),
                importance: format_core::GrammarImportance::Unimportant,
                line_weight: -20,
            }],
        };
        let request = request("// old comment", "// new comment");

        let result = diff_text_with_grammar(&request, &grammar);

        assert_eq!(result.stats.modified, 1);
        assert_eq!(result.lines[0].kind, DiffLineKind::Modified);
        assert!(!result.lines[0].important);
    }

    #[test]
    fn keeps_keyword_differences_important_with_grammar_rules() {
        let grammar = format_core::GrammarDefinition {
            id: "rust-grammar".to_owned(),
            name: "Rust Grammar".to_owned(),
            items: vec![format_core::GrammarItem {
                id: "keyword".to_owned(),
                name: "Keyword".to_owned(),
                kind: format_core::GrammarItemKind::Keyword,
                matcher: format_core::GrammarMatcher::Keywords(vec!["fn".to_owned()]),
                style_scope: "keyword.control".to_owned(),
                importance: format_core::GrammarImportance::Important,
                line_weight: 30,
            }],
        };
        let request = request("fn main()", "function main()");

        let result = diff_text_with_grammar(&request, &grammar);

        assert_eq!(result.stats.modified, 1);
        assert!(result.lines[0].important);
    }

    #[test]
    fn grammar_line_weight_prefers_structural_alignment_over_low_value_lines() {
        let grammar = format_core::GrammarDefinition {
            id: "rust-grammar".to_owned(),
            name: "Rust Grammar".to_owned(),
            items: vec![
                format_core::GrammarItem {
                    id: "line-comment".to_owned(),
                    name: "Line Comment".to_owned(),
                    kind: format_core::GrammarItemKind::Comment,
                    matcher: format_core::GrammarMatcher::LinePrefix("//".to_owned()),
                    style_scope: "comment.line".to_owned(),
                    importance: format_core::GrammarImportance::Unimportant,
                    line_weight: -20,
                },
                format_core::GrammarItem {
                    id: "keyword".to_owned(),
                    name: "Keyword".to_owned(),
                    kind: format_core::GrammarItemKind::Keyword,
                    matcher: format_core::GrammarMatcher::Keywords(vec!["fn".to_owned()]),
                    style_scope: "keyword.control".to_owned(),
                    importance: format_core::GrammarImportance::Important,
                    line_weight: 30,
                },
            ],
        };
        let request = request(
            "// shared\nfn important()\n// shared",
            "// shared\n// shared\nfn important()",
        );

        let result = diff_text_with_grammar(&request, &grammar);

        assert!(result.lines.iter().any(|line| {
            line.kind == DiffLineKind::Equal
                && line.left_number == Some(2)
                && line.right_number == Some(3)
                && line.left_text == "fn important()"
        }));
    }

    #[test]
    fn marks_identifier_replacements_as_unimportant_with_ignore_rules() {
        let rules = vec![format_core::TextReplacementIgnoreRule {
            id: "rename-config".to_owned(),
            name: "config rename".to_owned(),
            left_pattern: "oldConfig".to_owned(),
            right_replacement: "newConfig".to_owned(),
            match_case: true,
            whole_word: true,
        }];
        let request = request("let oldConfig = load();", "let newConfig = load();");

        let result = diff_text_with_replacement_rules(&request, &rules);

        assert_eq!(result.stats.modified, 1);
        assert!(!result.lines[0].important);
    }

    #[test]
    fn parses_unified_text_patch_files_and_hunks() {
        let patch = "\
diff --git a/src/main.rs b/src/main.rs
--- a/src/main.rs
+++ b/src/main.rs
@@ -1,3 +1,3 @@
 fn main() {
-    println!(\"old\");
+    println!(\"new\");
 }
";

        let result = parse_text_patch(patch);

        assert_eq!(result.files.len(), 1);
        assert_eq!(result.files[0].old_path, "a/src/main.rs");
        assert_eq!(result.files[0].new_path, "b/src/main.rs");
        assert_eq!(result.files[0].hunks.len(), 1);
        assert_eq!(result.files[0].hunks[0].old_start, 1);
        assert_eq!(result.files[0].hunks[0].new_start, 1);
        assert_eq!(result.files[0].hunks[0].lines.len(), 4);
        assert_eq!(
            result.files[0].hunks[0].lines[1].kind,
            shared_types::PatchLineKind::Removed
        );
        assert_eq!(
            result.files[0].hunks[0].lines[2].kind,
            shared_types::PatchLineKind::Added
        );
    }
}
