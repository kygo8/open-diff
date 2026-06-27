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
}
