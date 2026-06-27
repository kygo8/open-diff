use serde::{Deserialize, Serialize};
use std::collections::BTreeMap;
use std::path::Path;

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TableWorkbook {
    pub sheets: Vec<TableSheet>,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TableSheet {
    pub name: String,
    pub index: usize,
    pub columns: Vec<TableColumn>,
    pub rows: Vec<TableRow>,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TableColumn {
    pub index: usize,
    pub name: String,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TableRow {
    pub index: usize,
    pub cells: Vec<TableCell>,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TableCell {
    pub row_index: usize,
    pub column_index: usize,
    pub value: TableCellValue,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum TableCellValue {
    Empty,
    Text(String),
    Number(f64),
    Boolean(bool),
    DateTime(String),
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TableDiff {
    pub sheets: Vec<TableSheetDiff>,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum TableDiffStatus {
    Same,
    Added,
    Removed,
    Modified,
    Conflict,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TableSheetDiff {
    pub sheet_name: String,
    pub status: TableDiffStatus,
    pub rows: Vec<TableRowDiff>,
    pub columns: Vec<TableColumnDiff>,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TableRowDiff {
    pub row_index: usize,
    pub status: TableDiffStatus,
    pub cells: Vec<TableCellDiff>,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TableColumnDiff {
    pub column_index: usize,
    pub name: String,
    pub status: TableDiffStatus,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TableCellDiff {
    pub row_index: usize,
    pub column_index: usize,
    pub status: TableDiffStatus,
    pub left: Option<TableCellValue>,
    pub right: Option<TableCellValue>,
    pub important: bool,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SheetMappingOptions {
    pub case_sensitive: bool,
    pub manual_mappings: Vec<ManualSheetMapping>,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ManualSheetMapping {
    pub left_sheet: String,
    pub right_sheet: String,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SheetMapping {
    pub left_sheet: Option<String>,
    pub right_sheet: Option<String>,
    pub source: SheetMappingSource,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum SheetMappingSource {
    Automatic,
    Manual,
    LeftOnly,
    RightOnly,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ColumnMappingOptions {
    pub case_sensitive: bool,
    pub ignore_whitespace: bool,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ColumnMapping {
    pub left_column_index: Option<usize>,
    pub right_column_index: Option<usize>,
    pub left_column: Option<String>,
    pub right_column: Option<String>,
    pub source: ColumnMappingSource,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum ColumnMappingSource {
    Automatic,
    LeftOnly,
    RightOnly,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RowAlignmentOptions {
    pub key_column_indices: Vec<usize>,
    pub case_sensitive: bool,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RowAlignment {
    pub key: Vec<String>,
    pub left_row_index: Option<usize>,
    pub right_row_index: Option<usize>,
    pub status: RowAlignmentStatus,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum RowAlignmentStatus {
    Matched,
    LeftOnly,
    RightOnly,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum TableParseError {
    UnclosedQuote,
    Excel(String),
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DelimitedTableOptions {
    pub delimiter: char,
    pub sheet_name: String,
}

impl DelimitedTableOptions {
    pub fn csv() -> Self {
        Self {
            delimiter: ',',
            sheet_name: "Sheet1".to_owned(),
        }
    }

    pub fn tsv() -> Self {
        Self {
            delimiter: '\t',
            sheet_name: "Sheet1".to_owned(),
        }
    }
}

pub fn parse_csv(input: &str) -> Result<TableWorkbook, TableParseError> {
    parse_delimited_table_with_options(input, &DelimitedTableOptions::csv())
}

pub fn parse_tsv(input: &str) -> Result<TableWorkbook, TableParseError> {
    parse_delimited_table_with_options(input, &DelimitedTableOptions::tsv())
}

pub fn parse_delimited_table(
    input: &str,
    delimiter: char,
) -> Result<TableWorkbook, TableParseError> {
    parse_delimited_table_with_options(
        input,
        &DelimitedTableOptions {
            delimiter,
            sheet_name: "Sheet1".to_owned(),
        },
    )
}

pub fn parse_delimited_table_with_options(
    input: &str,
    options: &DelimitedTableOptions,
) -> Result<TableWorkbook, TableParseError> {
    let raw_rows = parse_delimited_rows(input, options.delimiter)?;
    let columns = raw_rows
        .first()
        .map(|headers| {
            headers
                .iter()
                .enumerate()
                .map(|(index, name)| TableColumn {
                    index,
                    name: name.clone(),
                })
                .collect::<Vec<_>>()
        })
        .unwrap_or_default();
    let rows = raw_rows
        .into_iter()
        .skip(1)
        .enumerate()
        .map(|(row_index, values)| TableRow {
            index: row_index,
            cells: values
                .into_iter()
                .enumerate()
                .map(|(column_index, value)| TableCell {
                    row_index,
                    column_index,
                    value: parse_cell_value(value),
                })
                .collect(),
        })
        .collect::<Vec<_>>();

    Ok(TableWorkbook {
        sheets: vec![TableSheet {
            name: options.sheet_name.clone(),
            index: 0,
            columns,
            rows,
        }],
    })
}

pub fn parse_html_tables(input: &str) -> Result<TableWorkbook, TableParseError> {
    let sheets = extract_tag_blocks(input, "table")
        .into_iter()
        .enumerate()
        .map(|(index, table_html)| html_table_to_sheet(&table_html, index))
        .collect::<Vec<_>>();

    Ok(TableWorkbook { sheets })
}

pub fn read_excel_workbook(path: impl AsRef<Path>) -> Result<TableWorkbook, TableParseError> {
    let mut workbook = calamine::open_workbook_auto(path.as_ref())
        .map_err(|error| TableParseError::Excel(format!("{error:?}")))?;
    let sheet_names = calamine::Reader::sheet_names(&workbook);
    let sheets = sheet_names
        .iter()
        .enumerate()
        .map(|(index, sheet_name)| {
            let range = calamine::Reader::worksheet_range(&mut workbook, sheet_name)
                .map_err(|error| TableParseError::Excel(format!("{error:?}")))?;

            Ok(excel_range_to_sheet(sheet_name, index, &range))
        })
        .collect::<Result<Vec<_>, TableParseError>>()?;

    Ok(TableWorkbook { sheets })
}

pub fn map_sheets(
    left: &TableWorkbook,
    right: &TableWorkbook,
    options: &SheetMappingOptions,
) -> Vec<SheetMapping> {
    let mut mappings = Vec::new();
    let mut used_left = Vec::<usize>::new();
    let mut used_right = Vec::<usize>::new();
    let manual_pairs = options
        .manual_mappings
        .iter()
        .filter_map(|manual| {
            let left_index = find_sheet_index(&left.sheets, &manual.left_sheet, true)?;
            let right_index = find_sheet_index(&right.sheets, &manual.right_sheet, true)?;

            Some((left_index, right_index))
        })
        .collect::<Vec<_>>();

    for (left_index, left_sheet) in left.sheets.iter().enumerate() {
        if used_left.contains(&left_index) {
            continue;
        }

        if let Some((_, right_index)) = manual_pairs
            .iter()
            .find(|(manual_left_index, _)| *manual_left_index == left_index)
        {
            if used_right.contains(right_index) {
                continue;
            }

            used_left.push(left_index);
            used_right.push(*right_index);
            mappings.push(SheetMapping {
                left_sheet: Some(left_sheet.name.clone()),
                right_sheet: Some(right.sheets[*right_index].name.clone()),
                source: SheetMappingSource::Manual,
            });
        } else if let Some((right_index, right_sheet)) =
            right
                .sheets
                .iter()
                .enumerate()
                .find(|(right_index, right_sheet)| {
                    !used_right.contains(right_index)
                        && sheet_names_match(
                            &left_sheet.name,
                            &right_sheet.name,
                            options.case_sensitive,
                        )
                })
        {
            used_left.push(left_index);
            used_right.push(right_index);
            mappings.push(SheetMapping {
                left_sheet: Some(left_sheet.name.clone()),
                right_sheet: Some(right_sheet.name.clone()),
                source: SheetMappingSource::Automatic,
            });
        }
    }

    for (left_index, left_sheet) in left.sheets.iter().enumerate() {
        if !used_left.contains(&left_index) {
            mappings.push(SheetMapping {
                left_sheet: Some(left_sheet.name.clone()),
                right_sheet: None,
                source: SheetMappingSource::LeftOnly,
            });
        }
    }

    for (right_index, right_sheet) in right.sheets.iter().enumerate() {
        if !used_right.contains(&right_index) {
            mappings.push(SheetMapping {
                left_sheet: None,
                right_sheet: Some(right_sheet.name.clone()),
                source: SheetMappingSource::RightOnly,
            });
        }
    }

    mappings
}

fn find_sheet_index(sheets: &[TableSheet], name: &str, case_sensitive: bool) -> Option<usize> {
    sheets
        .iter()
        .position(|sheet| sheet_names_match(&sheet.name, name, case_sensitive))
}

fn sheet_names_match(left: &str, right: &str, case_sensitive: bool) -> bool {
    if case_sensitive {
        left == right
    } else {
        left.eq_ignore_ascii_case(right)
    }
}

pub fn map_columns(
    left: &TableSheet,
    right: &TableSheet,
    options: &ColumnMappingOptions,
) -> Vec<ColumnMapping> {
    let mut mappings = Vec::new();
    let mut used_right = Vec::<usize>::new();

    for left_column in &left.columns {
        if let Some(right_column) = right.columns.iter().find(|right_column| {
            !used_right.contains(&right_column.index)
                && column_names_match(&left_column.name, &right_column.name, options)
        }) {
            used_right.push(right_column.index);
            mappings.push(ColumnMapping {
                left_column_index: Some(left_column.index),
                right_column_index: Some(right_column.index),
                left_column: Some(left_column.name.clone()),
                right_column: Some(right_column.name.clone()),
                source: ColumnMappingSource::Automatic,
            });
        } else {
            mappings.push(ColumnMapping {
                left_column_index: Some(left_column.index),
                right_column_index: None,
                left_column: Some(left_column.name.clone()),
                right_column: None,
                source: ColumnMappingSource::LeftOnly,
            });
        }
    }

    for right_column in &right.columns {
        if !used_right.contains(&right_column.index) {
            mappings.push(ColumnMapping {
                left_column_index: None,
                right_column_index: Some(right_column.index),
                left_column: None,
                right_column: Some(right_column.name.clone()),
                source: ColumnMappingSource::RightOnly,
            });
        }
    }

    mappings
}

fn column_names_match(left: &str, right: &str, options: &ColumnMappingOptions) -> bool {
    let left = normalize_column_name(left, options);
    let right = normalize_column_name(right, options);

    if options.case_sensitive {
        left == right
    } else {
        left.eq_ignore_ascii_case(&right)
    }
}

fn normalize_column_name(name: &str, options: &ColumnMappingOptions) -> String {
    if options.ignore_whitespace {
        name.chars()
            .filter(|character| !character.is_whitespace())
            .collect()
    } else {
        name.to_owned()
    }
}

pub fn align_rows_by_key_columns(
    left: &TableSheet,
    right: &TableSheet,
    options: &RowAlignmentOptions,
) -> Vec<RowAlignment> {
    let mut rows = BTreeMap::<Vec<String>, (Option<usize>, Option<usize>)>::new();

    for row in &left.rows {
        rows.entry(row_key(row, options)).or_default().0 = Some(row.index);
    }

    for row in &right.rows {
        rows.entry(row_key(row, options)).or_default().1 = Some(row.index);
    }

    rows.into_iter()
        .map(|(key, (left_row_index, right_row_index))| RowAlignment {
            key,
            left_row_index,
            right_row_index,
            status: match (left_row_index, right_row_index) {
                (Some(_), Some(_)) => RowAlignmentStatus::Matched,
                (Some(_), None) => RowAlignmentStatus::LeftOnly,
                (None, Some(_)) => RowAlignmentStatus::RightOnly,
                (None, None) => RowAlignmentStatus::LeftOnly,
            },
        })
        .collect()
}

fn row_key(row: &TableRow, options: &RowAlignmentOptions) -> Vec<String> {
    options
        .key_column_indices
        .iter()
        .map(|column_index| {
            let key = row
                .cells
                .iter()
                .find(|cell| cell.column_index == *column_index)
                .map(|cell| table_cell_value_to_key(&cell.value))
                .unwrap_or_default();

            if options.case_sensitive {
                key
            } else {
                key.to_lowercase()
            }
        })
        .collect()
}

fn table_cell_value_to_key(value: &TableCellValue) -> String {
    match value {
        TableCellValue::Empty => String::new(),
        TableCellValue::Text(value) | TableCellValue::DateTime(value) => value.clone(),
        TableCellValue::Number(value) => value.to_string(),
        TableCellValue::Boolean(value) => value.to_string(),
    }
}

fn excel_range_to_sheet(
    sheet_name: &str,
    sheet_index: usize,
    range: &calamine::Range<calamine::Data>,
) -> TableSheet {
    let rows = range.rows().collect::<Vec<_>>();
    let columns = rows
        .first()
        .map(|headers| {
            headers
                .iter()
                .enumerate()
                .map(|(index, value)| TableColumn {
                    index,
                    name: excel_cell_to_string(value),
                })
                .collect::<Vec<_>>()
        })
        .unwrap_or_default();
    let rows = rows
        .into_iter()
        .skip(1)
        .enumerate()
        .map(|(row_index, values)| TableRow {
            index: row_index,
            cells: values
                .iter()
                .enumerate()
                .map(|(column_index, value)| TableCell {
                    row_index,
                    column_index,
                    value: excel_cell_to_value(value),
                })
                .collect(),
        })
        .collect();

    TableSheet {
        name: sheet_name.to_owned(),
        index: sheet_index,
        columns,
        rows,
    }
}

fn excel_cell_to_value(value: &calamine::Data) -> TableCellValue {
    match value {
        calamine::Data::Empty => TableCellValue::Empty,
        calamine::Data::String(value) => parse_cell_value(value.clone()),
        calamine::Data::Float(value) => TableCellValue::Number(*value),
        calamine::Data::Int(value) => TableCellValue::Number(*value as f64),
        calamine::Data::Bool(value) => TableCellValue::Boolean(*value),
        calamine::Data::DateTime(value) => TableCellValue::DateTime(value.to_string()),
        calamine::Data::DateTimeIso(value) | calamine::Data::DurationIso(value) => {
            TableCellValue::DateTime(value.clone())
        }
        calamine::Data::Error(value) => TableCellValue::Text(format!("{value:?}")),
    }
}

fn excel_cell_to_string(value: &calamine::Data) -> String {
    match excel_cell_to_value(value) {
        TableCellValue::Empty => String::new(),
        TableCellValue::Text(value) | TableCellValue::DateTime(value) => value,
        TableCellValue::Number(value) => value.to_string(),
        TableCellValue::Boolean(value) => value.to_string(),
    }
}

fn html_table_to_sheet(table_html: &str, table_index: usize) -> TableSheet {
    let caption = extract_tag_blocks(table_html, "caption")
        .first()
        .map(|caption| normalize_html_text(caption))
        .filter(|caption| !caption.is_empty())
        .unwrap_or_else(|| format!("Table {}", table_index + 1));
    let raw_rows = extract_tag_blocks(table_html, "tr")
        .into_iter()
        .map(|row_html| html_row_cells(&row_html))
        .filter(|cells| !cells.is_empty())
        .collect::<Vec<_>>();
    let columns = raw_rows
        .first()
        .map(|headers| {
            headers
                .iter()
                .enumerate()
                .map(|(index, name)| TableColumn {
                    index,
                    name: name.clone(),
                })
                .collect::<Vec<_>>()
        })
        .unwrap_or_default();
    let rows = raw_rows
        .into_iter()
        .skip(1)
        .enumerate()
        .map(|(row_index, values)| TableRow {
            index: row_index,
            cells: values
                .into_iter()
                .enumerate()
                .map(|(column_index, value)| TableCell {
                    row_index,
                    column_index,
                    value: parse_cell_value(value),
                })
                .collect(),
        })
        .collect();

    TableSheet {
        name: caption,
        index: table_index,
        columns,
        rows,
    }
}

fn html_row_cells(row_html: &str) -> Vec<String> {
    let headers = extract_tag_blocks(row_html, "th");

    if !headers.is_empty() {
        return headers
            .into_iter()
            .map(|cell| normalize_html_text(&cell))
            .collect();
    }

    extract_tag_blocks(row_html, "td")
        .into_iter()
        .map(|cell| normalize_html_text(&cell))
        .collect()
}

fn extract_tag_blocks(input: &str, tag: &str) -> Vec<String> {
    let mut blocks = Vec::new();
    let mut cursor = 0;
    let lower = input.to_ascii_lowercase();
    let open_pattern = format!("<{tag}");
    let close_pattern = format!("</{tag}>");

    while let Some(open_offset) = lower[cursor..].find(&open_pattern) {
        let open_start = cursor + open_offset;
        let Some(open_end_offset) = lower[open_start..].find('>') else {
            break;
        };
        let content_start = open_start + open_end_offset + 1;
        let Some(close_offset) = lower[content_start..].find(&close_pattern) else {
            break;
        };
        let close_start = content_start + close_offset;

        blocks.push(input[content_start..close_start].to_owned());
        cursor = close_start + close_pattern.len();
    }

    blocks
}

fn normalize_html_text(input: &str) -> String {
    let mut text = String::new();
    let mut in_tag = false;

    for character in input.chars() {
        match character {
            '<' => in_tag = true,
            '>' => in_tag = false,
            _ if !in_tag => text.push(character),
            _ => {}
        }
    }

    decode_html_entities(&text)
        .split_whitespace()
        .collect::<Vec<_>>()
        .join(" ")
}

fn decode_html_entities(input: &str) -> String {
    input
        .replace("&amp;", "&")
        .replace("&lt;", "<")
        .replace("&gt;", ">")
        .replace("&quot;", "\"")
        .replace("&#39;", "'")
}

fn parse_delimited_rows(input: &str, delimiter: char) -> Result<Vec<Vec<String>>, TableParseError> {
    let mut rows = Vec::new();
    let mut row = Vec::new();
    let mut cell = String::new();
    let mut chars = input.chars().peekable();
    let mut in_quotes = false;

    while let Some(character) = chars.next() {
        if in_quotes {
            match character {
                '"' if chars.peek() == Some(&'"') => {
                    cell.push('"');
                    chars.next();
                }
                '"' => in_quotes = false,
                _ => cell.push(character),
            }
            continue;
        }

        match character {
            '"' if cell.is_empty() => in_quotes = true,
            character if character == delimiter => finish_cell(&mut row, &mut cell),
            '\n' => finish_row(&mut rows, &mut row, &mut cell),
            '\r' => {
                if chars.peek() == Some(&'\n') {
                    chars.next();
                }
                finish_row(&mut rows, &mut row, &mut cell);
            }
            _ => cell.push(character),
        }
    }

    if in_quotes {
        return Err(TableParseError::UnclosedQuote);
    }

    finish_row(&mut rows, &mut row, &mut cell);

    Ok(rows)
}

fn finish_cell(row: &mut Vec<String>, cell: &mut String) {
    row.push(std::mem::take(cell));
}

fn finish_row(rows: &mut Vec<Vec<String>>, row: &mut Vec<String>, cell: &mut String) {
    finish_cell(row, cell);

    if row.len() > 1 || row.first().is_some_and(|value| !value.is_empty()) {
        rows.push(std::mem::take(row));
    } else {
        row.clear();
    }
}

fn parse_cell_value(value: String) -> TableCellValue {
    let trimmed = value.trim();

    if trimmed.is_empty() {
        TableCellValue::Empty
    } else if let Ok(number) = trimmed.parse::<f64>() {
        TableCellValue::Number(number)
    } else if trimmed.eq_ignore_ascii_case("true") {
        TableCellValue::Boolean(true)
    } else if trimmed.eq_ignore_ascii_case("false") {
        TableCellValue::Boolean(false)
    } else {
        TableCellValue::Text(value)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn table_workbook_represents_sheets_rows_columns_and_cells() {
        let workbook = TableWorkbook {
            sheets: vec![TableSheet {
                name: "Inventory".to_owned(),
                index: 0,
                columns: vec![
                    TableColumn {
                        index: 0,
                        name: "SKU".to_owned(),
                    },
                    TableColumn {
                        index: 1,
                        name: "Quantity".to_owned(),
                    },
                ],
                rows: vec![TableRow {
                    index: 0,
                    cells: vec![
                        TableCell {
                            row_index: 0,
                            column_index: 0,
                            value: TableCellValue::Text("A-001".to_owned()),
                        },
                        TableCell {
                            row_index: 0,
                            column_index: 1,
                            value: TableCellValue::Number(12.5),
                        },
                    ],
                }],
            }],
        };

        assert_eq!(workbook.sheets[0].name, "Inventory");
        assert_eq!(workbook.sheets[0].columns[1].name, "Quantity");
        assert_eq!(
            workbook.sheets[0].rows[0].cells[0].value,
            TableCellValue::Text("A-001".to_owned())
        );
    }

    #[test]
    fn table_diff_model_marks_sheet_row_column_and_cell_changes() {
        let diff = TableDiff {
            sheets: vec![TableSheetDiff {
                sheet_name: "Inventory".to_owned(),
                status: TableDiffStatus::Modified,
                rows: vec![TableRowDiff {
                    row_index: 4,
                    status: TableDiffStatus::Added,
                    cells: vec![TableCellDiff {
                        row_index: 4,
                        column_index: 1,
                        status: TableDiffStatus::Modified,
                        left: Some(TableCellValue::Number(12.0)),
                        right: Some(TableCellValue::Number(14.0)),
                        important: true,
                    }],
                }],
                columns: vec![TableColumnDiff {
                    column_index: 2,
                    name: "Price".to_owned(),
                    status: TableDiffStatus::Removed,
                }],
            }],
        };

        assert_eq!(diff.sheets[0].status, TableDiffStatus::Modified);
        assert_eq!(diff.sheets[0].rows[0].status, TableDiffStatus::Added);
        assert_eq!(diff.sheets[0].columns[0].status, TableDiffStatus::Removed);
        assert!(diff.sheets[0].rows[0].cells[0].important);
    }

    #[test]
    fn parses_csv_with_delimiters_quotes_and_multiline_cells() {
        let workbook = parse_csv(
            "Name,Note,Quantity\n\
             \"Widget, Large\",\"Line one\nLine two\",12\n\
             \"Quoted \"\"value\"\"\",Plain,3",
        )
        .expect("csv should parse");

        let sheet = &workbook.sheets[0];

        assert_eq!(sheet.name, "Sheet1");
        assert_eq!(sheet.columns.len(), 3);
        assert_eq!(sheet.columns[0].name, "Name");
        assert_eq!(sheet.rows.len(), 2);
        assert_eq!(
            sheet.rows[0].cells[0].value,
            TableCellValue::Text("Widget, Large".to_owned())
        );
        assert_eq!(
            sheet.rows[0].cells[1].value,
            TableCellValue::Text("Line one\nLine two".to_owned())
        );
        assert_eq!(sheet.rows[0].cells[2].value, TableCellValue::Number(12.0));
        assert_eq!(
            sheet.rows[1].cells[0].value,
            TableCellValue::Text("Quoted \"value\"".to_owned())
        );
    }

    #[test]
    fn rejects_unclosed_csv_quotes() {
        let error = parse_csv("Name,Note\nWidget,\"Unclosed").expect_err("csv should fail");

        assert_eq!(error, TableParseError::UnclosedQuote);
    }

    #[test]
    fn parses_tsv_and_custom_delimiters() {
        let tsv = parse_tsv("Name\tQuantity\nWidget\t12").expect("tsv should parse");
        let custom = parse_delimited_table_with_options(
            "Name|Note|Quantity\nWidget|Pipe separated|7",
            &DelimitedTableOptions {
                delimiter: '|',
                sheet_name: "Pipes".to_owned(),
            },
        )
        .expect("custom delimiter should parse");

        assert_eq!(tsv.sheets[0].columns[1].name, "Quantity");
        assert_eq!(
            tsv.sheets[0].rows[0].cells[0].value,
            TableCellValue::Text("Widget".to_owned())
        );
        assert_eq!(
            tsv.sheets[0].rows[0].cells[1].value,
            TableCellValue::Number(12.0)
        );
        assert_eq!(custom.sheets[0].name, "Pipes");
        assert_eq!(
            custom.sheets[0].rows[0].cells[1].value,
            TableCellValue::Text("Pipe separated".to_owned())
        );
    }

    #[test]
    fn parses_multiple_html_tables() {
        let workbook = parse_html_tables(
            r#"
            <section>
              <table>
                <caption>Inventory</caption>
                <tr><th>SKU</th><th>Quantity</th></tr>
                <tr><td>A-001</td><td>12</td></tr>
              </table>
              <table>
                <tr><th>Name</th><th>Note</th></tr>
                <tr><td>Widget &amp; Gear</td><td><strong>Ready</strong></td></tr>
              </table>
            </section>
            "#,
        )
        .expect("html tables should parse");

        assert_eq!(workbook.sheets.len(), 2);
        assert_eq!(workbook.sheets[0].name, "Inventory");
        assert_eq!(workbook.sheets[0].columns[0].name, "SKU");
        assert_eq!(
            workbook.sheets[0].rows[0].cells[1].value,
            TableCellValue::Number(12.0)
        );
        assert_eq!(workbook.sheets[1].name, "Table 2");
        assert_eq!(
            workbook.sheets[1].rows[0].cells[0].value,
            TableCellValue::Text("Widget & Gear".to_owned())
        );
        assert_eq!(
            workbook.sheets[1].rows[0].cells[1].value,
            TableCellValue::Text("Ready".to_owned())
        );
    }

    #[test]
    fn reads_excel_workbook_sheets_and_cells() {
        let path = unique_temp_file("excel-read", "xlsx");
        let mut workbook = rust_xlsxwriter::Workbook::new();
        let first = workbook.add_worksheet();
        first.set_name("Inventory").expect("sheet name");
        first.write_string(0, 0, "SKU").expect("header");
        first.write_string(0, 1, "Quantity").expect("header");
        first.write_string(1, 0, "A-001").expect("sku");
        first.write_number(1, 1, 12.0).expect("quantity");
        let second = workbook.add_worksheet();
        second.set_name("Flags").expect("sheet name");
        second.write_string(0, 0, "Enabled").expect("header");
        second.write_boolean(1, 0, true).expect("flag");
        workbook.save(&path).expect("xlsx should write");

        let parsed = read_excel_workbook(&path).expect("xlsx should read");

        assert_eq!(parsed.sheets.len(), 2);
        assert_eq!(parsed.sheets[0].name, "Inventory");
        assert_eq!(parsed.sheets[0].columns[0].name, "SKU");
        assert_eq!(
            parsed.sheets[0].rows[0].cells[0].value,
            TableCellValue::Text("A-001".to_owned())
        );
        assert_eq!(
            parsed.sheets[0].rows[0].cells[1].value,
            TableCellValue::Number(12.0)
        );
        assert_eq!(parsed.sheets[1].name, "Flags");
        assert_eq!(
            parsed.sheets[1].rows[0].cells[0].value,
            TableCellValue::Boolean(true)
        );

        let _ = std::fs::remove_file(path);
    }

    #[test]
    fn maps_sheets_automatically_and_with_manual_overrides() {
        let left = TableWorkbook {
            sheets: vec![
                empty_sheet("Inventory", 0),
                empty_sheet("Archive 2026", 1),
                empty_sheet("Left Only", 2),
            ],
        };
        let right = TableWorkbook {
            sheets: vec![
                empty_sheet("inventory", 0),
                empty_sheet("Archive", 1),
                empty_sheet("Right Only", 2),
            ],
        };

        let mappings = map_sheets(
            &left,
            &right,
            &SheetMappingOptions {
                case_sensitive: false,
                manual_mappings: vec![ManualSheetMapping {
                    left_sheet: "Archive 2026".to_owned(),
                    right_sheet: "Archive".to_owned(),
                }],
            },
        );

        assert_eq!(mappings.len(), 4);
        assert_eq!(mappings[0].left_sheet.as_deref(), Some("Inventory"));
        assert_eq!(mappings[0].right_sheet.as_deref(), Some("inventory"));
        assert_eq!(mappings[0].source, SheetMappingSource::Automatic);
        assert_eq!(mappings[1].left_sheet.as_deref(), Some("Archive 2026"));
        assert_eq!(mappings[1].right_sheet.as_deref(), Some("Archive"));
        assert_eq!(mappings[1].source, SheetMappingSource::Manual);
        assert_eq!(mappings[2].left_sheet.as_deref(), Some("Left Only"));
        assert_eq!(mappings[2].right_sheet, None);
        assert_eq!(mappings[3].left_sheet, None);
        assert_eq!(mappings[3].right_sheet.as_deref(), Some("Right Only"));
    }

    #[test]
    fn maps_columns_by_name_with_case_and_whitespace_options() {
        let left = TableSheet {
            name: "Inventory".to_owned(),
            index: 0,
            columns: vec![
                TableColumn {
                    index: 0,
                    name: "SKU".to_owned(),
                },
                TableColumn {
                    index: 1,
                    name: "Unit Price".to_owned(),
                },
                TableColumn {
                    index: 2,
                    name: "Left Only".to_owned(),
                },
            ],
            rows: Vec::new(),
        };
        let right = TableSheet {
            name: "Inventory".to_owned(),
            index: 0,
            columns: vec![
                TableColumn {
                    index: 0,
                    name: "sku".to_owned(),
                },
                TableColumn {
                    index: 1,
                    name: "unitprice".to_owned(),
                },
                TableColumn {
                    index: 2,
                    name: "Right Only".to_owned(),
                },
            ],
            rows: Vec::new(),
        };

        let mappings = map_columns(
            &left,
            &right,
            &ColumnMappingOptions {
                case_sensitive: false,
                ignore_whitespace: true,
            },
        );

        assert_eq!(mappings.len(), 4);
        assert_eq!(mappings[0].left_column.as_deref(), Some("SKU"));
        assert_eq!(mappings[0].right_column.as_deref(), Some("sku"));
        assert_eq!(mappings[0].source, ColumnMappingSource::Automatic);
        assert_eq!(mappings[1].left_column.as_deref(), Some("Unit Price"));
        assert_eq!(mappings[1].right_column.as_deref(), Some("unitprice"));
        assert_eq!(mappings[2].left_column.as_deref(), Some("Left Only"));
        assert_eq!(mappings[2].right_column, None);
        assert_eq!(mappings[3].left_column, None);
        assert_eq!(mappings[3].right_column.as_deref(), Some("Right Only"));
    }

    #[test]
    fn aligns_rows_by_multiple_key_columns() {
        let left = keyed_sheet(vec![
            ("A-001", "US", "12"),
            ("A-002", "EU", "20"),
            ("A-003", "US", "30"),
        ]);
        let right = keyed_sheet(vec![
            ("A-002", "EU", "21"),
            ("A-004", "US", "7"),
            ("A-001", "US", "12"),
        ]);

        let rows = align_rows_by_key_columns(
            &left,
            &right,
            &RowAlignmentOptions {
                key_column_indices: vec![0, 1],
                case_sensitive: false,
            },
        );

        assert_eq!(rows.len(), 4);
        assert_eq!(rows[0].key, vec!["a-001".to_owned(), "us".to_owned()]);
        assert_eq!(rows[0].left_row_index, Some(0));
        assert_eq!(rows[0].right_row_index, Some(2));
        assert_eq!(rows[0].status, RowAlignmentStatus::Matched);
        assert_eq!(rows[1].left_row_index, Some(1));
        assert_eq!(rows[1].right_row_index, Some(0));
        assert_eq!(rows[2].status, RowAlignmentStatus::LeftOnly);
        assert_eq!(rows[3].status, RowAlignmentStatus::RightOnly);
    }

    fn keyed_sheet(rows: Vec<(&str, &str, &str)>) -> TableSheet {
        TableSheet {
            name: "Inventory".to_owned(),
            index: 0,
            columns: vec![
                TableColumn {
                    index: 0,
                    name: "SKU".to_owned(),
                },
                TableColumn {
                    index: 1,
                    name: "Region".to_owned(),
                },
                TableColumn {
                    index: 2,
                    name: "Quantity".to_owned(),
                },
            ],
            rows: rows
                .into_iter()
                .enumerate()
                .map(|(index, (sku, region, quantity))| TableRow {
                    index,
                    cells: vec![
                        TableCell {
                            row_index: index,
                            column_index: 0,
                            value: TableCellValue::Text(sku.to_owned()),
                        },
                        TableCell {
                            row_index: index,
                            column_index: 1,
                            value: TableCellValue::Text(region.to_owned()),
                        },
                        TableCell {
                            row_index: index,
                            column_index: 2,
                            value: TableCellValue::Text(quantity.to_owned()),
                        },
                    ],
                })
                .collect(),
        }
    }

    fn empty_sheet(name: &str, index: usize) -> TableSheet {
        TableSheet {
            name: name.to_owned(),
            index,
            columns: Vec::new(),
            rows: Vec::new(),
        }
    }

    fn unique_temp_file(label: &str, extension: &str) -> std::path::PathBuf {
        let stamp = std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .expect("system clock should be after epoch")
            .as_nanos();

        std::env::temp_dir().join(format!("open-diff-{label}-{stamp}.{extension}"))
    }
}
