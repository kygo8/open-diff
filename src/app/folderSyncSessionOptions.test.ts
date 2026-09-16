import { beforeEach, describe, expect, it } from 'vitest'
import {
  defaultFolderSyncSessionOptions,
  folderSyncSessionOptionsStorageKey,
  loadFolderSyncSessionOptions,
  normalizeFolderSyncStrategy,
  saveFolderSyncSessionOptions,
} from './folderSyncSessionOptions'

describe('folderSyncSessionOptions', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('defaults to update-both', () => {
    expect(loadFolderSyncSessionOptions()).toEqual(defaultFolderSyncSessionOptions())
    expect(normalizeFolderSyncStrategy('mirrorLeft')).toBe('mirrorLeft')
    expect(normalizeFolderSyncStrategy('nope')).toBe('updateBoth')
  })

  it('persists a Folder Sync strategy default', () => {
    saveFolderSyncSessionOptions({ strategy: 'mirrorRight' })

    expect(localStorage.getItem(folderSyncSessionOptionsStorageKey)).toContain('mirrorRight')
    expect(loadFolderSyncSessionOptions()).toEqual({ strategy: 'mirrorRight' })
  })

  it('restores the default for older or invalid payloads', () => {
    localStorage.setItem(folderSyncSessionOptionsStorageKey, '{')
    expect(loadFolderSyncSessionOptions()).toEqual({ strategy: 'updateBoth' })

    localStorage.setItem(folderSyncSessionOptionsStorageKey, JSON.stringify({ strategy: 'other' }))
    expect(loadFolderSyncSessionOptions()).toEqual({ strategy: 'updateBoth' })
  })
})
