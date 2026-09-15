/** Capture-aligned status bar phrase helpers (English defaults for the store). */

const TEXT_SESSION_SOURCES = new Set(['text-compare', 'text-merge', 'text-patch'])
const EDIT_MODE_SOURCES = new Set(['text-compare', 'text-merge', 'text-edit'])
const FOLDER_PAIR_SOURCES = new Set(['folder-compare', 'folder-sync', 'folder-merge'])

export type StatusEditMode = 'insert' | 'overwrite'
export type StatusChromeKind = 'standard' | 'text-session' | 'folder-pair'

export function isTextSessionStatusSource(source: string): boolean {
  return TEXT_SESSION_SOURCES.has(source)
}

export function isEditModeStatusSource(source: string): boolean {
  return EDIT_MODE_SOURCES.has(source)
}

export function isFolderPairStatusSource(source: string): boolean {
  return FOLDER_PAIR_SOURCES.has(source)
}

export function formatDifferenceCountPhrase(
  differenceCount: number | null,
  source: string,
): string {
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
