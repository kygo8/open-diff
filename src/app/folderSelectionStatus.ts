/** Aggregate folder-row selection for path/status footers. */

export interface FolderSelectionRowLike {
  id: string
  kind: 'file' | 'directory'
  leftByteSize?: number
  rightByteSize?: number
  leftModified?: string
  rightModified?: string
}

export interface FolderSelectionAggregate {
  fileCount: number
  folderCount: number
  /** Total selected rows (files + folders). */
  count: number
  leftBytes: number
  rightBytes: number
  leftModified: string
  rightModified: string
}

function cleanModified(value: string | undefined): string {
  if (!value || value === '--') {
    return ''
  }

  return value
}

/**
 * Prefer checked rows; when none are checked, fall back to the focused row
 * so the footer still mirrors a single highlight selection.
 */
export function aggregateFolderSelection(
  rows: FolderSelectionRowLike[],
  checkedIds: Iterable<string>,
  focusedId?: string,
): FolderSelectionAggregate {
  const checked = new Set(checkedIds)
  let selected = rows.filter((row) => checked.has(row.id))

  if (selected.length === 0 && focusedId) {
    const focused = rows.find((row) => row.id === focusedId)

    if (focused) {
      selected = [focused]
    }
  }

  const files = selected.filter((row) => row.kind === 'file')
  const folders = selected.filter((row) => row.kind === 'directory')
  const single = selected.length === 1 ? selected[0] : undefined

  return {
    fileCount: files.length,
    folderCount: folders.length,
    count: selected.length,
    leftBytes: files.reduce((total, row) => total + (row.leftByteSize ?? 0), 0),
    rightBytes: files.reduce((total, row) => total + (row.rightByteSize ?? 0), 0),
    leftModified: cleanModified(single?.leftModified),
    rightModified: cleanModified(single?.rightModified),
  }
}

export function joinStatusFooterParts(...parts: (string | null | undefined)[]): string {
  return parts
    .map((part) => part?.trim())
    .filter((part): part is string => Boolean(part))
    .join(' · ')
}

export interface SelectionFooterLabels {
  filesSelectedBytes: (count: number, bytes: number) => string
  filesSelectedBytesWithDate: (count: number, bytes: number, modified: string) => string
  filesAndFoldersSelectedBytes: (files: number, folders: number, bytes: number) => string
  foldersSelected: (count: number) => string
  itemsSelected: (count: number) => string
}

export function formatFolderSelectionLabel(
  aggregate: Pick<
    FolderSelectionAggregate,
    'fileCount' | 'folderCount' | 'count' | 'leftBytes' | 'rightBytes'
  > & {
    bytes: number
    modified?: string
  },
  labels: SelectionFooterLabels,
): string {
  const { fileCount, folderCount, count, bytes, modified = '' } = aggregate

  if (count <= 0) {
    return ''
  }

  if (folderCount > 0 && fileCount > 0) {
    return labels.filesAndFoldersSelectedBytes(fileCount, folderCount, bytes)
  }

  if (folderCount > 0 && fileCount === 0) {
    return labels.foldersSelected(folderCount)
  }

  if (count === 1 && modified) {
    return labels.filesSelectedBytesWithDate(fileCount || count, bytes, modified)
  }

  return labels.filesSelectedBytes(fileCount || count, bytes)
}
