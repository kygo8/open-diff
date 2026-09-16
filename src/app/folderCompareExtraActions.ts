/** Helpers for Folder Compare Actions: Contents / Sync / Explorer / Ignored. */

import { parentDirectoryPath } from '@/app/parentDirectoryPath'
import type { SessionLaunchPayload } from '@/types/sessionLaunch'

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

const FOLDER_SESSION_HANDOFF_ROUTES = {
  'folder-compare': '/compare/folder',
  'folder-sync': '/sync/folder',
  'folder-merge': '/merge/folder',
} as const

export type FolderSessionHandoffType = keyof typeof FOLDER_SESSION_HANDOFF_ROUTES

export function createFolderSessionHandoffLaunch(
  sessionType: FolderSessionHandoffType,
  leftRoot: string,
  rightRoot: string,
  title: string,
): SessionLaunchPayload | undefined {
  const left = leftRoot.trim()
  const right = rightRoot.trim()

  if (!left || !right) {
    return undefined
  }

  return {
    id: crypto.randomUUID(),
    source: 'command',
    sessionType,
    title,
    route: FOLDER_SESSION_HANDOFF_ROUTES[sessionType],
    autoRun: sessionType !== 'folder-merge',
    locations: {
      left: { uri: left, displayName: baseName(left), kind: 'directory', readOnly: false },
      right: { uri: right, displayName: baseName(right), kind: 'directory', readOnly: false },
    },
  }
}

export function createFolderSyncHandoffLaunch(
  leftRoot: string,
  rightRoot: string,
  title: string,
): SessionLaunchPayload | undefined {
  return createFolderSessionHandoffLaunch('folder-sync', leftRoot, rightRoot, title)
}

function baseName(path: string): string {
  const normalized = path.replaceAll('\\', '/').replace(/\/+$/u, '')
  const parts = normalized.split('/').filter(Boolean)

  return parts.at(-1) ?? path
}
