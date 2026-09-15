/** Capture-aligned status bar phrase helpers (English defaults for the store). */

const TEXT_SESSION_SOURCES = new Set(['text-compare', 'text-merge', 'text-patch'])

export function isTextSessionStatusSource(source: string): boolean {
  return TEXT_SESSION_SOURCES.has(source)
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

export function elapsedSecondsSince(startedAtMs: number, endedAtMs = performance.now()): number {
  return Math.max(0, (endedAtMs - startedAtMs) / 1000)
}
