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
  }
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
    }),
  )
}
