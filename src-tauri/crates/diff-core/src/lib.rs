use shared_types::{DiffLine, DiffLineKind, DiffStats, TextDiffRequest, TextDiffResponse};

pub fn diff_text(request: &TextDiffRequest) -> TextDiffResponse {
    let left_lines = split_lines(&request.left);
    let right_lines = split_lines(&request.right);
    let edits = diff_lines(&left_lines, &right_lines);
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
}
