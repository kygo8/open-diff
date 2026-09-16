/** Helpers for Folder Compare Actions: Contents / Sync / Explorer / Ignored. */

import { parentDirectoryPath } from '@/app/parentDirectoryPath'
import type { SessionLaunchPayload } from '@/types/sessionLaunch'
import type { SessionType } from '@/types/session'

/** Absolute path to select/highlight in the OS file manager (the entry itself). */
export function explorerSelectTargetPath(entryPath: string): string {
  return entryPath.trim()
}

/**
 * Fallback folder to open when OS select/highlight is unavailable.
 * Files open their parent; directories open themselves.
 */
export function explorerRevealPath(
  entryPath: string,
  kind: 'file' | 'directory' | undefined,
): string {
  const trimmed = entryPath.trim()

  if (!trimmed) {
    return ''
  }

  if (kind === 'directory') {
    return trimmed
  }

  return parentDirectoryPath(trimmed) ?? trimmed
}

export function toggleIgnoredRowId(
  ignoredIds: ReadonlySet<string>,
  rowId: string,
): { next: Set<string>; marked: boolean } {
  const next = new Set(ignoredIds)

  if (next.has(rowId)) {
    next.delete(rowId)

    return { next, marked: false }
  }

  next.add(rowId)

  return { next, marked: true }
}

export function createFolderSyncHandoffLaunch(
  leftRoot: string,
  rightRoot: string,
  title: string,
): SessionLaunchPayload | undefined {
  const left = leftRoot.trim()
  const right = rightRoot.trim()

  if (!left || !right) {
    return undefined
  }

  const sessionType: SessionType = 'folder-sync'

  return {
    id: crypto.randomUUID(),
    source: 'command',
    sessionType,
    title,
    route: '/sync/folder',
    autoRun: true,
    locations: {
      left: { uri: left, displayName: baseName(left), kind: 'directory', readOnly: false },
      right: { uri: right, displayName: baseName(right), kind: 'directory', readOnly: false },
    },
  }
}

function baseName(path: string): string {
  const normalized = path.replaceAll('\\', '/').replace(/\/+$/u, '')
  const parts = normalized.split('/').filter(Boolean)

  return parts.at(-1) ?? path
}
