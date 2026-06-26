use shared_types::{DiffLine, DiffLineKind, DiffStats, TextDiffRequest, TextDiffResponse};

pub fn diff_text(request: &TextDiffRequest) -> TextDiffResponse {
    let left_lines = split_lines(&request.left);
    let right_lines = split_lines(&request.right);
    let mut rows = Vec::new();
    let mut stats = DiffStats {
        added: 0,
        deleted: 0,
        modified: 0,
        equal: 0,
    };

    let max_len = left_lines.len().max(right_lines.len());
    for index in 0..max_len {
        let left = left_lines.get(index);
        let right = right_lines.get(index);
        match (left, right) {
            (Some(left_text), Some(right_text)) if left_text == right_text => {
                stats.equal += 1;
                rows.push(line(
                    Some(index + 1),
                    Some(index + 1),
                    left_text,
                    right_text,
                    DiffLineKind::Equal,
                ));
            }
            (Some(left_text), Some(right_text)) => {
                stats.modified += 1;
                rows.push(line(
                    Some(index + 1),
                    Some(index + 1),
                    left_text,
                    right_text,
                    DiffLineKind::Modified,
                ));
            }
            (Some(left_text), None) => {
                stats.deleted += 1;
                rows.push(line(
                    Some(index + 1),
                    None,
                    left_text,
                    "",
                    DiffLineKind::Deleted,
                ));
            }
            (None, Some(right_text)) => {
                stats.added += 1;
                rows.push(line(
                    None,
                    Some(index + 1),
                    "",
                    right_text,
                    DiffLineKind::Added,
                ));
            }
            (None, None) => {}
        }
    }

    TextDiffResponse { lines: rows, stats }
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
}
