import type { FolderSyncStrategy } from '@/types/sync'

export const folderSyncSessionOptionsStorageKey = 'open-diff-folder-sync-session-options'

export interface FolderSyncSessionOptions {
  strategy: FolderSyncStrategy
}

const strategies: readonly FolderSyncStrategy[] = [
  'updateRight',
  'updateLeft',
  'updateBoth',
  'mirrorRight',
  'mirrorLeft',
]

export function defaultFolderSyncSessionOptions(): FolderSyncSessionOptions {
  return {
    strategy: 'updateBoth',
  }
}

export function normalizeFolderSyncStrategy(value: unknown): FolderSyncStrategy {
  if (typeof value === 'string' && (strategies as readonly string[]).includes(value)) {
    return value as FolderSyncStrategy
  }

  return 'updateBoth'
}

export function loadFolderSyncSessionOptions(
  storage: Pick<Storage, 'getItem'> = localStorage,
): FolderSyncSessionOptions {
  try {
    const raw = storage.getItem(folderSyncSessionOptionsStorageKey)

    if (!raw) {
      return defaultFolderSyncSessionOptions()
    }

    const parsed = JSON.parse(raw) as Partial<FolderSyncSessionOptions>

    return {
      strategy: normalizeFolderSyncStrategy(parsed.strategy),
    }
  } catch {
    return defaultFolderSyncSessionOptions()
  }
}

export function saveFolderSyncSessionOptions(
  state: FolderSyncSessionOptions,
  storage: Pick<Storage, 'setItem'> = localStorage,
): void {
  storage.setItem(
    folderSyncSessionOptionsStorageKey,
    JSON.stringify({
      strategy: normalizeFolderSyncStrategy(state.strategy),
    }),
  )
}
