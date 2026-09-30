/** Persist Folder Compare Align With pairs across rescans. */

export type AlignableFolderStatus = 'Same' | 'Different' | 'Left only' | 'Right only'

export interface AlignableFolderRow {
  id: string
  relativePath: string
  parentId?: string
  depth: number
  leftName?: string
  rightName?: string
  leftSize?: string
  rightSize?: string
  leftModified?: string
  rightModified?: string
  leftPath?: string
  rightPath?: string
  status: AlignableFolderStatus
  kind: 'file' | 'directory'
  manualAlignment?: boolean
  alignedLeftRelativePath?: string
  alignedRightRelativePath?: string
}

export interface ManualAlignmentPair {
  leftRelativePath: string
  rightRelativePath: string
}

export function upsertManualAlignment(
  pairs: ManualAlignmentPair[],
  leftRelativePath: string,
  rightRelativePath: string,
): ManualAlignmentPair[] {
  const left = leftRelativePath.trim()
  const right = rightRelativePath.trim()

  if (!left || !right) {
    return pairs.slice()
  }

  const next = pairs.filter(
    (pair) => pair.leftRelativePath !== left && pair.rightRelativePath !== right,
  )

  next.push({ leftRelativePath: left, rightRelativePath: right })

  return next
}

export function removeManualAlignment(
  pairs: ManualAlignmentPair[],
  leftRelativePath: string,
  rightRelativePath: string,
): ManualAlignmentPair[] {
  const left = leftRelativePath.trim()
  const right = rightRelativePath.trim()

  return pairs.filter((pair) => pair.leftRelativePath !== left || pair.rightRelativePath !== right)
}

export function mergeAlignedOrphans(
  leftSide: AlignableFolderRow,
  rightSide: AlignableFolderRow,
): AlignableFolderRow {
  return {
    id: `align-${leftSide.id}-with-${rightSide.id}`,
    relativePath: `${leftSide.relativePath} <--> ${rightSide.relativePath}`,
    parentId: leftSide.parentId ?? rightSide.parentId,
    depth: Math.min(leftSide.depth, rightSide.depth),
    leftName: leftSide.leftName,
    rightName: rightSide.rightName,
    leftSize: leftSide.leftSize,
    rightSize: rightSide.rightSize,
    leftModified: leftSide.leftModified,
    rightModified: rightSide.rightModified,
    leftPath: leftSide.leftPath,
    rightPath: rightSide.rightPath,
    status: 'Different',
    kind: leftSide.kind === 'directory' || rightSide.kind === 'directory' ? 'directory' : 'file',
    manualAlignment: true,
    alignedLeftRelativePath: leftSide.relativePath,
    alignedRightRelativePath: rightSide.relativePath,
  }
}

export function applyManualAlignments(
  rows: AlignableFolderRow[],
  pairs: ManualAlignmentPair[],
): AlignableFolderRow[] {
  let next = rows.slice()

  for (const pair of pairs) {
    const leftSide = next.find(
      (row) => row.status === 'Left only' && row.relativePath === pair.leftRelativePath,
    )
    const rightSide = next.find(
      (row) => row.status === 'Right only' && row.relativePath === pair.rightRelativePath,
    )

    if (!leftSide || !rightSide) {
      continue
    }

    const merged = mergeAlignedOrphans(leftSide, rightSide)

    next = next.filter((row) => row.id !== leftSide.id && row.id !== rightSide.id).concat(merged)
  }

  return next
}

export const folderManualAlignmentsStorageKey = 'open-diff-folder-manual-alignments'

export type FolderManualAlignmentsStore = Record<string, ManualAlignmentPair[]>

export function folderCompareAlignmentRootKey(leftRoot: string, rightRoot: string): string {
  return `${leftRoot.trim()}|${rightRoot.trim()}`
}

function normalizeManualAlignmentPairs(value: unknown): ManualAlignmentPair[] {
  if (!Array.isArray(value)) {
    return []
  }

  const seen = new Set<string>()
  const next: ManualAlignmentPair[] = []

  for (const item of value) {
    if (typeof item !== 'object' || item === null) {
      continue
    }

    const record = item as Partial<ManualAlignmentPair>
    const leftRelativePath =
      typeof record.leftRelativePath === 'string' ? record.leftRelativePath.trim() : ''
    const rightRelativePath =
      typeof record.rightRelativePath === 'string' ? record.rightRelativePath.trim() : ''

    if (!leftRelativePath || !rightRelativePath) {
      continue
    }

    const key = `${leftRelativePath}<=>${rightRelativePath}`

    if (seen.has(key)) {
      continue
    }

    seen.add(key)
    next.push({ leftRelativePath, rightRelativePath })
  }

  return next
}

export function loadFolderManualAlignmentsStore(
  storage: Pick<Storage, 'getItem'> = localStorage,
): FolderManualAlignmentsStore {
  try {
    const raw = storage.getItem(folderManualAlignmentsStorageKey)

    if (!raw) {
      return {}
    }

    const parsed = JSON.parse(raw) as unknown

    if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
      return {}
    }

    const store: FolderManualAlignmentsStore = {}

    for (const [key, value] of Object.entries(parsed as Record<string, unknown>)) {
      if (!key.trim()) {
        continue
      }

      const pairs = normalizeManualAlignmentPairs(value)

      if (pairs.length > 0) {
        store[key] = pairs
      }
    }

    return store
  } catch {
    return {}
  }
}

export function saveFolderManualAlignmentsStore(
  store: FolderManualAlignmentsStore,
  storage: Pick<Storage, 'setItem'> = localStorage,
): void {
  const normalized: FolderManualAlignmentsStore = {}

  for (const [key, value] of Object.entries(store)) {
    const pairs = normalizeManualAlignmentPairs(value)

    if (pairs.length > 0) {
      normalized[key] = pairs
    }
  }

  storage.setItem(folderManualAlignmentsStorageKey, JSON.stringify(normalized))
}

export function loadManualAlignmentsForRoots(
  leftRoot: string,
  rightRoot: string,
  storage: Pick<Storage, 'getItem'> = localStorage,
): ManualAlignmentPair[] {
  const key = folderCompareAlignmentRootKey(leftRoot, rightRoot)

  if (!key || key === '|') {
    return []
  }

  const store = loadFolderManualAlignmentsStore(storage)

  return store[key] ?? []
}

export function saveManualAlignmentsForRoots(
  leftRoot: string,
  rightRoot: string,
  pairs: readonly ManualAlignmentPair[],
  storage: Pick<Storage, 'getItem' | 'setItem'> = localStorage,
): void {
  const key = folderCompareAlignmentRootKey(leftRoot, rightRoot)

  if (!key || key === '|') {
    return
  }

  const store = loadFolderManualAlignmentsStore(storage)
  const nextStore: FolderManualAlignmentsStore = { ...store }
  const normalized = normalizeManualAlignmentPairs(pairs)

  if (normalized.length === 0) {
    const { [key]: _removed, ...rest } = nextStore

    void _removed
    saveFolderManualAlignmentsStore(rest, storage)

    return
  }

  nextStore[key] = normalized
  saveFolderManualAlignmentsStore(nextStore, storage)
}
