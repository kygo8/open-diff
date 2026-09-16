/** Selection-scoped Folder / File Compare report text (no dialog). */

export interface FolderCompareSelectionReportRow {
  relativePath: string
  status: string
  kind: 'file' | 'directory'
  leftPath?: string
  rightPath?: string
  ignored?: boolean
}

export interface BuildFolderCompareSelectionReportTextInput {
  leftRoot: string
  rightRoot: string
  rows: FolderCompareSelectionReportRow[]
  scopeLabel?: string
}

export function defaultFolderCompareSelectionReportOutputPath(leftRoot: string): string {
  const trimmed = leftRoot.trim().replace(/[/\\]+$/u, '')

  if (!trimmed) {
    return 'folder-compare-selection.txt'
  }

  const slash = Math.max(trimmed.lastIndexOf('/'), trimmed.lastIndexOf('\\'))

  if (slash < 0) {
    return 'folder-compare-selection.txt'
  }

  return `${trimmed.slice(0, slash + 1)}folder-compare-selection.txt`
}

function displayOrDash(value: string | undefined): string {
  const trimmed = value?.trim() ?? ''

  return trimmed.length > 0 ? trimmed : '--'
}

export function buildFolderCompareSelectionReportText(
  input: BuildFolderCompareSelectionReportTextInput,
): string {
  const rows = input.rows
  const files = rows.filter((row) => row.kind === 'file').length
  const directories = rows.filter((row) => row.kind === 'directory').length
  const ignored = rows.filter((row) => row.ignored === true).length
  const scopeLabel = input.scopeLabel?.trim() ?? ''
  const scope = scopeLabel.length > 0 ? scopeLabel : 'selection'
  const lines = [
    'FOLDER-COMPARE-SELECTION-REPORT',
    `scope: ${scope}`,
    `left: ${displayOrDash(input.leftRoot)}`,
    `right: ${displayOrDash(input.rightRoot)}`,
    `selected: ${String(rows.length)}`,
    `files: ${String(files)}`,
    `directories: ${String(directories)}`,
    `ignored: ${String(ignored)}`,
    '',
    'rows:',
    ...rows.map((row) => {
      const ignoredMark = row.ignored === true ? 'ignored' : '-'
      const left = displayOrDash(row.leftPath)
      const right = displayOrDash(row.rightPath)

      return [row.relativePath, row.status, row.kind, ignoredMark, left, right].join('\t')
    }),
  ]

  return lines.join('\n')
}
