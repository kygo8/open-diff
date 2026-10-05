import { addRecentPath, type RecentPath } from './pathHistory'

export const folderPathMruStorageKey = 'open-diff-folder-path-mru'
export const folderPathMruMaxSize = 12

export function loadFolderPathMru(): string[] {
  if (typeof localStorage === 'undefined') {
    return []
  }

  try {
    const raw = localStorage.getItem(folderPathMruStorageKey)

    if (!raw) {
      return []
    }

    const parsed = JSON.parse(raw) as unknown

    if (!Array.isArray(parsed)) {
      return []
    }

    return parsed
      .filter((item): item is string => typeof item === 'string' && item.trim().length > 0)
      .map((item) => item.trim())
      .slice(0, folderPathMruMaxSize)
  } catch {
    return []
  }
}

export function saveFolderPathMru(paths: string[]): void {
  if (typeof localStorage === 'undefined') {
    return
  }

  localStorage.setItem(
    folderPathMruStorageKey,
    JSON.stringify(paths.slice(0, folderPathMruMaxSize)),
  )
}

export function rememberFolderPath(history: string[], path: string): string[] {
  const trimmed = path.trim()

  if (!trimmed) {
    return history
  }

  const next: RecentPath[] = addRecentPath(
    history.map((item) => ({ path: item, kind: 'folder' as const })),
    { path: trimmed, kind: 'folder' },
    folderPathMruMaxSize,
  )

  return next.map((item) => item.path)
}

export function rememberFolderPathPair(history: string[], left: string, right: string): string[] {
  let next = history

  next = rememberFolderPath(next, left)
  next = rememberFolderPath(next, right)

  return next
}
