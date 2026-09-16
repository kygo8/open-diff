export type FolderSelectableStatus = 'Same' | 'Different' | 'Left only' | 'Right only'
export type FolderSelectableKind = 'file' | 'directory'

export interface FolderSelectableRow {
  id: string
  kind: FolderSelectableKind
  status: FolderSelectableStatus
  relativePath: string
  leftName?: string
  rightName?: string
}

export function rowDisplayName(row: FolderSelectableRow): string {
  return row.leftName ?? row.rightName ?? row.relativePath
}

export function selectAllRowIds(rows: FolderSelectableRow[]): string[] {
  return rows.map((row) => row.id)
}

export function selectFileRowIds(rows: FolderSelectableRow[]): string[] {
  return rows.filter((row) => row.kind === 'file').map((row) => row.id)
}

export function selectRowIdsByStatuses(
  rows: FolderSelectableRow[],
  statuses: FolderSelectableStatus[],
): string[] {
  const wanted = new Set(statuses)

  return rows.filter((row) => wanted.has(row.status)).map((row) => row.id)
}

export function selectRowIdsByNameFilter(rows: FolderSelectableRow[], query: string): string[] {
  const normalized = query.trim().toLowerCase()

  if (!normalized) {
    return []
  }

  return rows
    .filter((row) => rowDisplayName(row).toLowerCase().includes(normalized))
    .map((row) => row.id)
}

export function invertRowIds(rows: FolderSelectableRow[], selectedIds: Iterable<string>): string[] {
  const selected = new Set(selectedIds)

  return rows.filter((row) => !selected.has(row.id)).map((row) => row.id)
}

export function resolveOperationRows<T extends { id: string }>(
  rows: T[],
  checkedIds: Iterable<string>,
  selectedId: string | undefined,
): T[] {
  const checked = new Set(checkedIds)

  if (checked.size > 0) {
    return rows.filter((row) => checked.has(row.id))
  }

  if (!selectedId) {
    return []
  }

  const selected = rows.find((row) => row.id === selectedId)

  return selected ? [selected] : []
}

export interface FolderCopySidePaths {
  relativePath: string
  sourcePath: string
  targetPath: string
}

export interface FolderPathRow {
  kind?: FolderSelectableKind
  relativePath?: string
  leftPath?: string
  rightPath?: string
}

export function folderCopyTargetsForDirection(
  rows: FolderPathRow[],
  direction: 'Left' | 'Right',
  resolveMissingTarget: (relativePath: string) => string,
): FolderCopySidePaths[] {
  const targets: FolderCopySidePaths[] = []

  for (const row of rows) {
    if (row.kind !== 'file' || !row.relativePath) {
      continue
    }

    const sourcePath = direction === 'Left' ? row.rightPath : row.leftPath
    const existingTarget = direction === 'Left' ? row.leftPath : row.rightPath

    if (!sourcePath) {
      continue
    }

    targets.push({
      relativePath: row.relativePath,
      sourcePath,
      targetPath: existingTarget ?? resolveMissingTarget(row.relativePath),
    })
  }

  return targets
}

export function folderEntryPaths(rows: FolderPathRow[]): string[] {
  const paths: string[] = []

  for (const row of rows) {
    const path = row.leftPath ?? row.rightPath

    if (path) {
      paths.push(path)
    }
  }

  return paths
}

/** Expand selected directories to descendant rows (including filter-hidden) for file actions. */
export function expandHiddenDescendantsForFileActions<
  T extends { id: string; kind?: string; relativePath?: string },
>(allRows: T[], operationRows: T[]): T[] {
  const selected = new Map(operationRows.map((row) => [row.id, row]))
  const prefixes = operationRows
    .filter((row) => row.kind === 'directory' && row.relativePath)
    .map((row) => `${String(row.relativePath).replaceAll('\\', '/').replace(/\/$/u, '')}/`)

  if (prefixes.length === 0) {
    return operationRows
  }

  for (const row of allRows) {
    if (selected.has(row.id) || !row.relativePath) {
      continue
    }

    const relativePath = row.relativePath.replaceAll('\\', '/')

    if (prefixes.some((prefix) => relativePath.startsWith(prefix))) {
      selected.set(row.id, row)
    }
  }

  return [...selected.values()]
}
