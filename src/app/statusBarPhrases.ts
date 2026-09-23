/** Capture-aligned status bar phrase helpers (English defaults for the store). */

const TEXT_SESSION_SOURCES = new Set(['text-compare', 'text-merge', 'text-patch'])
const HEX_SESSION_SOURCES = new Set(['hex-compare'])
const PICTURE_SESSION_SOURCES = new Set(['picture-compare'])
const MEDIA_SESSION_SOURCES = new Set(['media-compare'])
const VERSION_SESSION_SOURCES = new Set(['version-compare'])
const TABLE_SESSION_SOURCES = new Set(['table-compare'])
const REGISTRY_SESSION_SOURCES = new Set(['registry-compare'])
const CLIPBOARD_SESSION_SOURCES = new Set(['clipboard-compare'])
const EDIT_MODE_SOURCES = new Set(['text-compare', 'text-merge', 'text-edit'])
const FOLDER_PAIR_SOURCES = new Set(['folder-compare', 'folder-sync'])
const FOLDER_MERGE_SOURCES = new Set(['folder-merge'])

export type StatusEditMode = 'insert' | 'overwrite'
export type StatusChromeKind =
  | 'standard'
  | 'text-session'
  | 'folder-pair'
  | 'folder-merge'
  | 'hex-session'
  | 'picture-session'
  | 'media-session'
  | 'version-session'
  | 'table-session'
  | 'registry-session'
  | 'clipboard-session'

export function isTextSessionStatusSource(source: string): boolean {
  return TEXT_SESSION_SOURCES.has(source)
}

export function isEditModeStatusSource(source: string): boolean {
  return EDIT_MODE_SOURCES.has(source)
}

export function isFolderPairStatusSource(source: string): boolean {
  return FOLDER_PAIR_SOURCES.has(source)
}

export function isFolderMergeStatusSource(source: string): boolean {
  return FOLDER_MERGE_SOURCES.has(source)
}

export function isHexSessionStatusSource(source: string): boolean {
  return HEX_SESSION_SOURCES.has(source)
}

export function isPictureSessionStatusSource(source: string): boolean {
  return PICTURE_SESSION_SOURCES.has(source)
}

export function isMediaSessionStatusSource(source: string): boolean {
  return MEDIA_SESSION_SOURCES.has(source)
}

export function isVersionSessionStatusSource(source: string): boolean {
  return VERSION_SESSION_SOURCES.has(source)
}

export function isTableSessionStatusSource(source: string): boolean {
  return TABLE_SESSION_SOURCES.has(source)
}

export function isRegistrySessionStatusSource(source: string): boolean {
  return REGISTRY_SESSION_SOURCES.has(source)
}

export function isClipboardSessionStatusSource(source: string): boolean {
  return CLIPBOARD_SESSION_SOURCES.has(source)
}

export function formatDifferenceCountPhrase(
  differenceCount: number | null,
  source: string,
): string {
  if (isHexSessionStatusSource(source)) {
    if (differenceCount === null || differenceCount === 0) {
      return '≠ Same'
    }

    return '≠ Binary differences'
  }

  if (isPictureSessionStatusSource(source)) {
    if (differenceCount === null) {
      return '≠ -'
    }

    if (differenceCount === 0) {
      return '≠ Same'
    }

    if (differenceCount === 1) {
      return '≠ 1 pixel'
    }

    return `≠ ${String(differenceCount)} pixels`
  }

  if (!isTextSessionStatusSource(source)) {
    return `Differences: ${differenceCount === null ? '-' : String(differenceCount)}`
  }

  if (differenceCount === null) {
    return '≠ -'
  }

  if (differenceCount === 1) {
    return `≠ 1 difference section`
  }

  return `≠ ${String(differenceCount)} difference sections`
}

export function formatImportancePhrase(
  importantCount: number | null | undefined,
  unimportantCount: number | null | undefined,
): string | null {
  if (
    importantCount === null ||
    importantCount === undefined ||
    unimportantCount === null ||
    unimportantCount === undefined
  ) {
    return null
  }

  if (importantCount === 0 && unimportantCount === 0) {
    return 'Same'
  }

  if (importantCount > 0 && unimportantCount === 0) {
    return 'Important Difference'
  }

  if (importantCount === 0 && unimportantCount > 0) {
    return 'Unimportant Difference'
  }

  return `${String(importantCount)} important, ${String(unimportantCount)} unimportant`
}

export function formatLoadTimePhrase(seconds: number): string {
  return `Load time: ${seconds.toFixed(2)} seconds`
}

export function formatEditModePhrase(mode: StatusEditMode | null | undefined): string | null {
  if (mode === 'insert') {
    return 'Insert'
  }

  if (mode === 'overwrite') {
    return 'Overwrite'
  }

  return null
}

export function elapsedSecondsSince(startedAtMs: number, endedAtMs = performance.now()): number {
  return Math.max(0, (endedAtMs - startedAtMs) / 1000)
}

/** Pad status chrome to a fixed pane count so empty sessions keep structure. */
export function padStatusChromePanes(
  panes: { text: string; muted?: boolean; testId?: string }[],
  count: number,
  emptyPane: () => { text: string; muted?: boolean; testId?: string },
): { text: string; muted?: boolean; testId?: string }[] {
  const next = panes.slice(0, count)

  while (next.length < count) {
    next.push(emptyPane())
  }

  return next
}

/** Capture folder-pair status strip always uses four panes. */
export const FOLDER_PAIR_STATUS_PANE_COUNT = 4

export interface FolderPairStatusPaneDraft {
  text: string
  muted: boolean
  testId: string
}

/**
 * Build the capture-aligned folder-pair status panes (left select/free, right select/free).
 * Importance is intentionally omitted here: a 5th pane would break the 4-pane strip, so
 * callers should hide Importance until Peek (or another toggle) surfaces it.
 */
export function buildFolderPairStatusPanes(input: {
  leftSelection: string | null | undefined
  leftFreeSpace: string | null | undefined
  rightSelection: string | null | undefined
  rightFreeSpace: string | null | undefined
  placeholder?: string
}): FolderPairStatusPaneDraft[] {
  const placeholder = input.placeholder ?? '—'
  const asPane = (value: string | null | undefined, testId: string): FolderPairStatusPaneDraft => {
    const text = value?.trim() ?? ''

    return {
      text: text || placeholder,
      muted: !text,
      testId,
    }
  }

  return [
    asPane(input.leftSelection, 'status-pane-left-selection'),
    asPane(input.leftFreeSpace, 'status-pane-left-free'),
    asPane(input.rightSelection, 'status-pane-right-selection'),
    asPane(input.rightFreeSpace, 'status-pane-right-free'),
  ].slice(0, FOLDER_PAIR_STATUS_PANE_COUNT)
}

/** Capture folder-merge status strip: editing/free for left, center, and right. */
export const FOLDER_MERGE_STATUS_PANE_COUNT = 6

/**
 * Build the capture-aligned folder-merge status panes
 * (left edit/free, center edit/free, right edit/free).
 */
export function buildFolderMergeStatusPanes(input: {
  leftSelection: string | null | undefined
  leftFreeSpace: string | null | undefined
  centerSelection: string | null | undefined
  centerFreeSpace: string | null | undefined
  rightSelection: string | null | undefined
  rightFreeSpace: string | null | undefined
  placeholder?: string
}): FolderPairStatusPaneDraft[] {
  const placeholder = input.placeholder ?? '—'
  const asPane = (value: string | null | undefined, testId: string): FolderPairStatusPaneDraft => {
    const text = value?.trim() ?? ''

    return {
      text: text || placeholder,
      muted: !text,
      testId,
    }
  }

  return [
    asPane(input.leftSelection, 'status-pane-left-selection'),
    asPane(input.leftFreeSpace, 'status-pane-left-free'),
    asPane(input.centerSelection, 'status-pane-center-selection'),
    asPane(input.centerFreeSpace, 'status-pane-center-free'),
    asPane(input.rightSelection, 'status-pane-right-selection'),
    asPane(input.rightFreeSpace, 'status-pane-right-free'),
  ].slice(0, FOLDER_MERGE_STATUS_PANE_COUNT)
}
