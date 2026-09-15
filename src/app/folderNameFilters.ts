export const folderNameFiltersStorageKey = 'open-diff-folder-name-filters'

export interface FolderNameFilters {
  include: string[]
  exclude: string[]
  caseSensitive: boolean
}

export function defaultFolderNameFilters(): FolderNameFilters {
  return {
    include: [],
    exclude: [],
    caseSensitive: false,
  }
}

function parsePatternList(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return []
  }

  return value
    .filter((item): item is string => typeof item === 'string')
    .map((item) => item.trim())
    .filter(Boolean)
}

export function normalizeFolderNameFilters(
  value: Partial<FolderNameFilters> | null | undefined,
): FolderNameFilters {
  return {
    include: parsePatternList(value?.include),
    exclude: parsePatternList(value?.exclude),
    caseSensitive: Boolean(value?.caseSensitive),
  }
}

export function parseFolderNameFilterDraft(raw: string): string[] {
  return raw
    .split(/[\n,;]/u)
    .map((item) => item.trim())
    .filter(Boolean)
}

export function formatFolderNameFilterDraft(patterns: string[]): string {
  return patterns.join('\n')
}

export function loadFolderNameFilters(
  storage: Pick<Storage, 'getItem'> = localStorage,
): FolderNameFilters {
  try {
    const raw = storage.getItem(folderNameFiltersStorageKey)

    if (!raw) {
      return defaultFolderNameFilters()
    }

    return normalizeFolderNameFilters(JSON.parse(raw) as Partial<FolderNameFilters>)
  } catch {
    return defaultFolderNameFilters()
  }
}

export function saveFolderNameFilters(
  state: FolderNameFilters,
  storage: Pick<Storage, 'setItem'> = localStorage,
): void {
  const normalized = normalizeFolderNameFilters(state)

  storage.setItem(
    folderNameFiltersStorageKey,
    JSON.stringify({
      include: normalized.include,
      exclude: normalized.exclude,
      caseSensitive: normalized.caseSensitive,
    }),
  )
}

export function folderNameFiltersAreActive(filters: FolderNameFilters): boolean {
  return filters.include.length > 0 || filters.exclude.length > 0
}

export const folderNameFilterAllPattern = '*.*'

/** Compact capture-like include mask for the Filters strip (`*.*` when unrestricted). */
export function formatFolderNameFilterStripPattern(filters: FolderNameFilters): string {
  const include = normalizeFolderNameFilters(filters).include

  if (include.length === 0) {
    return folderNameFilterAllPattern
  }

  return include.join(';')
}

/** Parse strip input into include patterns; empty / `*.*` means all names. */
export function parseFolderNameFilterStripPattern(raw: string): string[] {
  const trimmed = raw.trim()

  if (!trimmed || trimmed === folderNameFilterAllPattern) {
    return []
  }

  return parseFolderNameFilterDraft(trimmed)
}
