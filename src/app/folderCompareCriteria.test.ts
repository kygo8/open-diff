import { beforeEach, describe, expect, it } from 'vitest'
import {
  defaultFolderCompareCriteria,
  folderCompareCriteriaStorageKey,
  loadFolderCompareCriteria,
  saveFolderCompareCriteria,
} from './folderCompareCriteria'

describe('folderCompareCriteria', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('defaults when storage is empty', () => {
    expect(loadFolderCompareCriteria()).toEqual(defaultFolderCompareCriteria())
  })

  it('persists and reloads comparison criteria', () => {
    saveFolderCompareCriteria({
      compareSize: false,
      compareModifiedTime: true,
      compareContents: false,
      compareCrc: true,
      compareAttributes: true,
      sizeOnlyUnimportant: true,
      followSymlinks: true,
      timestampToleranceMs: 2000,
      ignoreDaylightSavingHourOffset: true,
      caseSensitiveNames: false,
    })

    expect(localStorage.getItem(folderCompareCriteriaStorageKey)).toContain('followSymlinks')
    expect(loadFolderCompareCriteria()).toEqual({
      compareSize: false,
      compareModifiedTime: true,
      compareContents: false,
      compareCrc: true,
      compareAttributes: true,
      sizeOnlyUnimportant: true,
      followSymlinks: true,
      timestampToleranceMs: 2000,
      ignoreDaylightSavingHourOffset: true,
      caseSensitiveNames: false,
    })
  })

  it('defaults missing timestamp tolerance fields from older packages', () => {
    localStorage.setItem(
      folderCompareCriteriaStorageKey,
      JSON.stringify({
        compareSize: true,
        compareModifiedTime: true,
        compareContents: true,
        compareCrc: false,
        followSymlinks: false,
      }),
    )

    expect(loadFolderCompareCriteria()).toEqual({
      compareSize: true,
      compareModifiedTime: true,
      compareContents: true,
      compareCrc: false,
      compareAttributes: false,
      sizeOnlyUnimportant: false,
      followSymlinks: false,
      timestampToleranceMs: 0,
      ignoreDaylightSavingHourOffset: false,
      caseSensitiveNames: true,
    })
  })
})
