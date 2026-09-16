export type FolderMergeViewPreset = 'all' | 'changes' | 'conflicts'

export const folderMergeDisplayStorageKey = 'open-diff-folder-merge-display'

export interface FolderMergeDisplayState {
  viewPreset: FolderMergeViewPreset
  alwaysShowFolders: boolean
  showCenterPane: boolean
  compareToOutput: boolean
}

const viewPresets: readonly FolderMergeViewPreset[] = ['all', 'changes', 'conflicts']

export function defaultFolderMergeDisplay(): FolderMergeDisplayState {
  return {
    viewPreset: 'all',
    alwaysShowFolders: true,
    showCenterPane: true,
    compareToOutput: false,
  }
}

export function normalizeFolderMergeViewPreset(value: unknown): FolderMergeViewPreset {
  if (typeof value === 'string' && (viewPresets as readonly string[]).includes(value)) {
    return value as FolderMergeViewPreset
  }

  return 'all'
}

export function loadFolderMergeDisplay(
  storage: Pick<Storage, 'getItem'> = localStorage,
): FolderMergeDisplayState {
  try {
    const raw = storage.getItem(folderMergeDisplayStorageKey)

    if (!raw) {
      return defaultFolderMergeDisplay()
    }

    const parsed = JSON.parse(raw) as Partial<FolderMergeDisplayState>

    return {
      viewPreset: normalizeFolderMergeViewPreset(parsed.viewPreset),
      alwaysShowFolders: parsed.alwaysShowFolders !== false,
      showCenterPane: parsed.showCenterPane !== false,
      compareToOutput: Boolean(parsed.compareToOutput),
    }
  } catch {
    return defaultFolderMergeDisplay()
  }
}

export function saveFolderMergeDisplay(
  state: FolderMergeDisplayState,
  storage: Pick<Storage, 'setItem'> = localStorage,
): void {
  storage.setItem(
    folderMergeDisplayStorageKey,
    JSON.stringify({
      viewPreset: normalizeFolderMergeViewPreset(state.viewPreset),
      alwaysShowFolders: state.alwaysShowFolders,
      showCenterPane: state.showCenterPane,
      compareToOutput: state.compareToOutput,
    }),
  )
}

export function mergeRowIsFolder(row: {
  left: { kind: string }
  base: { kind: string }
  right: { kind: string }
}): boolean {
  return (
    row.left.kind === 'Directory' || row.base.kind === 'Directory' || row.right.kind === 'Directory'
  )
}

export function mergeRowIsConflict(row: { action: string; conflict?: unknown }): boolean {
  return Boolean(row.conflict) || row.action === 'Mark conflict'
}

export function mergeRowIsChange(row: { action: string }): boolean {
  return row.action !== 'Keep output'
}

export function mergeRowMatchesViewPreset(
  row: {
    action: string
    conflict?: unknown
    left: { kind: string }
    base: { kind: string }
    right: { kind: string }
  },
  state: Pick<FolderMergeDisplayState, 'viewPreset' | 'alwaysShowFolders'>,
): boolean {
  if (state.viewPreset === 'all') {
    return true
  }

  const matches = state.viewPreset === 'conflicts' ? mergeRowIsConflict(row) : mergeRowIsChange(row)

  return matches || (state.alwaysShowFolders && mergeRowIsFolder(row))
}
