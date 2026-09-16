export type FolderDisplayStatus = 'Same' | 'Different' | 'Left only' | 'Right only'

export const folderDisplayFiltersStorageKey = 'open-diff-folder-display-filters'

export interface FolderDisplayFiltersState {
  statuses: FolderDisplayStatus[]
  showSuppressed: boolean
  filesOnly: boolean
  /** Keep folder rows visible even when their own status is filtered out. */
  alwaysShowFolders: boolean
}

const allStatuses: FolderDisplayStatus[] = ['Same', 'Different', 'Left only', 'Right only']

export function defaultFolderDisplayFilters(): FolderDisplayFiltersState {
  return {
    statuses: [...allStatuses],
    showSuppressed: false,
    filesOnly: false,
    alwaysShowFolders: true,
  }
}

export function folderRowMatchesStatusFilter(input: {
  kind: 'file' | 'directory'
  status: FolderDisplayStatus
  statuses: readonly FolderDisplayStatus[]
  showSuppressed: boolean
  alwaysShowFolders: boolean
}): boolean {
  if (input.showSuppressed || input.statuses.includes(input.status)) {
    return true
  }

  return input.alwaysShowFolders && input.kind === 'directory'
}

export function loadFolderDisplayFilters(
  storage: Pick<Storage, 'getItem'> = localStorage,
): FolderDisplayFiltersState {
  try {
    const raw = storage.getItem(folderDisplayFiltersStorageKey)

    if (!raw) {
      return defaultFolderDisplayFilters()
    }

    const parsed = JSON.parse(raw) as Partial<FolderDisplayFiltersState>
    const statuses = Array.isArray(parsed.statuses)
      ? parsed.statuses.filter((status): status is FolderDisplayStatus =>
          allStatuses.includes(status),
        )
      : allStatuses

    return {
      statuses: statuses.length > 0 ? statuses : [...allStatuses],
      showSuppressed: Boolean(parsed.showSuppressed),
      filesOnly: Boolean(parsed.filesOnly),
      alwaysShowFolders: parsed.alwaysShowFolders !== false,
    }
  } catch {
    return defaultFolderDisplayFilters()
  }
}

export function saveFolderDisplayFilters(
  state: FolderDisplayFiltersState,
  storage: Pick<Storage, 'setItem'> = localStorage,
): void {
  storage.setItem(
    folderDisplayFiltersStorageKey,
    JSON.stringify({
      statuses: state.statuses,
      showSuppressed: state.showSuppressed,
      filesOnly: state.filesOnly,
      alwaysShowFolders: state.alwaysShowFolders,
    }),
  )
}
