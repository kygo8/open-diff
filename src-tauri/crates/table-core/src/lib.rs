use serde::{Deserialize, Serialize};

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
pub enum TableParseError {
    UnclosedQuote,
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
}
