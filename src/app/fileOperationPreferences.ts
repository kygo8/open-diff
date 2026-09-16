export const fileOperationPreferencesStorageKey = 'open-diff-file-operation-preferences'

export interface FileOperationPreferences {
  copyEmptyFolders: boolean
  keepFolderExpansionOnReload: boolean
}

export function defaultFileOperationPreferences(): FileOperationPreferences {
  return {
    copyEmptyFolders: true,
    keepFolderExpansionOnReload: false,
  }
}

export function loadFileOperationPreferences(
  storage: Pick<Storage, 'getItem'> = localStorage,
): FileOperationPreferences {
  try {
    const raw = storage.getItem(fileOperationPreferencesStorageKey)

    if (!raw) {
      return defaultFileOperationPreferences()
    }

    const parsed = JSON.parse(raw) as Partial<FileOperationPreferences>

    return {
      copyEmptyFolders: parsed.copyEmptyFolders !== false,
      keepFolderExpansionOnReload: Boolean(parsed.keepFolderExpansionOnReload),
    }
  } catch {
    return defaultFileOperationPreferences()
  }
}

export function saveFileOperationPreferences(
  prefs: FileOperationPreferences,
  storage: Pick<Storage, 'setItem'> = localStorage,
): void {
  storage.setItem(
    fileOperationPreferencesStorageKey,
    JSON.stringify({
      copyEmptyFolders: prefs.copyEmptyFolders,
      keepFolderExpansionOnReload: prefs.keepFolderExpansionOnReload,
    }),
  )
}
