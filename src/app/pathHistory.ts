export type RecentPathKind = 'file' | 'folder'

export interface RecentPath {
  path: string
  kind: RecentPathKind
}

export function addRecentPath(
  history: RecentPath[],
  nextPath: RecentPath,
  maxSize = 10,
): RecentPath[] {
  return [
    nextPath,
    ...history.filter((item) => item.path !== nextPath.path || item.kind !== nextPath.kind),
  ].slice(0, maxSize)
}

export function clearRecentPaths(): RecentPath[] {
  return []
}
