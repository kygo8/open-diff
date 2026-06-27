import { addRecentPath, type RecentPath, type RecentPathKind } from './pathHistory'

export interface FilePickerOpenOptions {
  directory: boolean
}

export type FilePickerOpen = (options: FilePickerOpenOptions) => Promise<string | string[] | null>

export interface PickRecentPathOptions {
  kind: RecentPathKind
  history: RecentPath[]
  open: FilePickerOpen
}

export interface PickRecentPathResult {
  selected: RecentPath | null
  history: RecentPath[]
}

export async function pickRecentPath(
  options: PickRecentPathOptions,
): Promise<PickRecentPathResult> {
  const selected = await options.open({ directory: options.kind === 'folder' })

  if (!selected) {
    return {
      selected: null,
      history: options.history,
    }
  }

  const path = Array.isArray(selected) ? selected[0] : selected

  if (!path) {
    return {
      selected: null,
      history: options.history,
    }
  }

  const recentPath = { path, kind: options.kind }

  return {
    selected: recentPath,
    history: addRecentPath(options.history, recentPath),
  }
}
