import { beforeEach, describe, expect, it } from 'vitest'
import {
  defaultFileOperationPreferences,
  fileOperationPreferencesStorageKey,
  loadFileOperationPreferences,
  saveFileOperationPreferences,
} from './fileOperationPreferences'

describe('fileOperationPreferences', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('defaults to copying empty folders and rebuilding expansion', () => {
    expect(loadFileOperationPreferences()).toEqual(defaultFileOperationPreferences())
  })

  it('persists File Ops leftovers', () => {
    saveFileOperationPreferences({
      copyEmptyFolders: false,
      keepFolderExpansionOnReload: true,
      skipNewerTargetsOnCopy: true,
    })

    expect(localStorage.getItem(fileOperationPreferencesStorageKey)).toContain('copyEmptyFolders')
    expect(loadFileOperationPreferences()).toEqual({
      copyEmptyFolders: false,
      keepFolderExpansionOnReload: true,
      skipNewerTargetsOnCopy: true,
    })
  })
})
