/** Persist Folder Compare “Ignored” marks across sessions, keyed by compare roots. */

export const folderIgnoredPathsStorageKey = 'open-diff-folder-ignored-paths'

export type FolderIgnoredPathsStore = Record<string, string[]>

export function folderCompareIgnoredRootKey(leftRoot: string, rightRoot: string): string {
  return `${leftRoot.trim()}|${rightRoot.trim()}`
}

export function normalizeIgnoredRelativePaths(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return []
  }

  const seen = new Set<string>()
  const next: string[] = []

  for (const item of value) {
    if (typeof item !== 'string') {
      continue
    }

    const trimmed = item.trim()

    if (!trimmed || seen.has(trimmed)) {
      continue
    }

    seen.add(trimmed)
    next.push(trimmed)
  }

  return next
}

export function loadFolderIgnoredPathsStore(
  storage: Pick<Storage, 'getItem'> = localStorage,
): FolderIgnoredPathsStore {
  try {
    const raw = storage.getItem(folderIgnoredPathsStorageKey)

    if (!raw) {
      return {}
    }

    const parsed = JSON.parse(raw) as unknown

    if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
      return {}
    }

    const store: FolderIgnoredPathsStore = {}

    for (const [key, value] of Object.entries(parsed as Record<string, unknown>)) {
      if (!key.trim()) {
        continue
      }

      const paths = normalizeIgnoredRelativePaths(value)

      if (paths.length > 0) {
        store[key] = paths
      }
    }

    return store
  } catch {
    return {}
  }
}

export function saveFolderIgnoredPathsStore(
  store: FolderIgnoredPathsStore,
  storage: Pick<Storage, 'setItem'> = localStorage,
): void {
  const normalized: FolderIgnoredPathsStore = {}

  for (const [key, value] of Object.entries(store)) {
    const paths = normalizeIgnoredRelativePaths(value)

    if (paths.length > 0) {
      normalized[key] = paths
    }
  }

  storage.setItem(folderIgnoredPathsStorageKey, JSON.stringify(normalized))
}

export function loadIgnoredRelativePathsForRoots(
  leftRoot: string,
  rightRoot: string,
  storage: Pick<Storage, 'getItem'> = localStorage,
): Set<string> {
  const key = folderCompareIgnoredRootKey(leftRoot, rightRoot)

  if (!key || key === '|') {
    return new Set()
  }

  const store = loadFolderIgnoredPathsStore(storage)

  return new Set(store[key] ?? [])
}

export function saveIgnoredRelativePathsForRoots(
  leftRoot: string,
  rightRoot: string,
  ignoredPaths: ReadonlySet<string> | readonly string[],
  storage: Pick<Storage, 'getItem' | 'setItem'> = localStorage,
): void {
  const key = folderCompareIgnoredRootKey(leftRoot, rightRoot)

  if (!key || key === '|') {
    return
  }

  const store = loadFolderIgnoredPathsStore(storage)
  const paths = normalizeIgnoredRelativePaths(
    ignoredPaths instanceof Set ? [...ignoredPaths] : [...ignoredPaths],
  )

  const nextStore: FolderIgnoredPathsStore = { ...store }

  if (paths.length === 0) {
    const { [key]: _removed, ...rest } = nextStore

    void _removed
    saveFolderIgnoredPathsStore(rest, storage)

    return
  }

  nextStore[key] = paths
  saveFolderIgnoredPathsStore(nextStore, storage)
}
