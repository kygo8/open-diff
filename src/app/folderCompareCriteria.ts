import type { FolderCompareCriteria } from '@/types/diff'

export const folderCompareCriteriaStorageKey = 'open-diff-folder-compare-criteria'

function clampNonNegativeInt(value: unknown, fallback = 0): number {
  const numeric = typeof value === 'number' ? value : Number(value)

  if (!Number.isFinite(numeric)) {
    return fallback
  }

  return Math.max(0, Math.round(numeric))
}

export function defaultFolderCompareCriteria(): FolderCompareCriteria {
  return {
    compareSize: true,
    compareModifiedTime: false,
    compareContents: true,
    compareCrc: false,
    compareAttributes: false,
    sizeOnlyUnimportant: false,
    followSymlinks: false,
    timestampToleranceMs: 0,
    ignoreDaylightSavingHourOffset: false,
    caseSensitiveNames: true,
    ignoredTimezoneHourOffsets: [],
  }
}

export function normalizeIgnoredTimezoneHourOffsets(value: unknown): number[] {
  if (!Array.isArray(value)) {
    return []
  }

  const hours = value
    .map((item) => (typeof item === 'number' ? item : Number(item)))
    .filter((item) => Number.isFinite(item) && item !== 0)
    .map((item) => Math.trunc(item))

  return [...new Set(hours)]
}

export function parseIgnoredTimezoneHourOffsetsInput(value: string): number[] {
  return normalizeIgnoredTimezoneHourOffsets(
    value
      .split(/[,\s]+/u)
      .map((part) => part.trim())
      .filter((part) => part.length > 0),
  )
}

export function formatIgnoredTimezoneHourOffsetsInput(hours: readonly number[]): string {
  return normalizeIgnoredTimezoneHourOffsets(hours).join(', ')
}

export function loadFolderCompareCriteria(
  storage: Pick<Storage, 'getItem'> = localStorage,
): FolderCompareCriteria {
  try {
    const raw = storage.getItem(folderCompareCriteriaStorageKey)

    if (!raw) {
      return defaultFolderCompareCriteria()
    }

    const parsed = JSON.parse(raw) as Partial<FolderCompareCriteria>

    return {
      compareSize: parsed.compareSize !== false,
      compareModifiedTime: Boolean(parsed.compareModifiedTime),
      compareContents: parsed.compareContents !== false,
      compareCrc: Boolean(parsed.compareCrc),
      compareAttributes: Boolean(parsed.compareAttributes),
      sizeOnlyUnimportant: Boolean(parsed.sizeOnlyUnimportant),
      followSymlinks: Boolean(parsed.followSymlinks),
      timestampToleranceMs: clampNonNegativeInt(parsed.timestampToleranceMs, 0),
      ignoreDaylightSavingHourOffset: Boolean(parsed.ignoreDaylightSavingHourOffset),
      caseSensitiveNames: parsed.caseSensitiveNames !== false,
      ignoredTimezoneHourOffsets: normalizeIgnoredTimezoneHourOffsets(
        parsed.ignoredTimezoneHourOffsets,
      ),
    }
  } catch {
    return defaultFolderCompareCriteria()
  }
}

export function saveFolderCompareCriteria(
  state: FolderCompareCriteria,
  storage: Pick<Storage, 'setItem'> = localStorage,
): void {
  storage.setItem(
    folderCompareCriteriaStorageKey,
    JSON.stringify({
      compareSize: state.compareSize,
      compareModifiedTime: state.compareModifiedTime,
      compareContents: state.compareContents,
      compareCrc: state.compareCrc,
      compareAttributes: Boolean(state.compareAttributes),
      sizeOnlyUnimportant: Boolean(state.sizeOnlyUnimportant),
      followSymlinks: Boolean(state.followSymlinks),
      timestampToleranceMs: clampNonNegativeInt(state.timestampToleranceMs, 0),
      ignoreDaylightSavingHourOffset: Boolean(state.ignoreDaylightSavingHourOffset),
      caseSensitiveNames: state.caseSensitiveNames !== false,
      ignoredTimezoneHourOffsets: normalizeIgnoredTimezoneHourOffsets(
        state.ignoredTimezoneHourOffsets,
      ),
    }),
  )
}
