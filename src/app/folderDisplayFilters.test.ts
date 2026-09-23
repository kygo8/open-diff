import { beforeEach, describe, expect, it } from 'vitest'
import {
  defaultFolderDisplayFilters,
  folderDisplayFiltersStorageKey,
  folderRowMatchesStatusFilter,
  loadFolderDisplayFilters,
  saveFolderDisplayFilters,
} from './folderDisplayFilters'

describe('folderDisplayFilters', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('defaults to all statuses visible', () => {
    expect(loadFolderDisplayFilters()).toEqual(defaultFolderDisplayFilters())
  })

  it('persists and reloads Diffs/Same/Orphans filters', () => {
    saveFolderDisplayFilters({
      statuses: ['Different', 'Left only', 'Right only'],
      showSuppressed: true,
      filesOnly: true,
      alwaysShowFolders: false,
      showFiltersPanel: false,
      showPeekPanel: true,
    })

    expect(localStorage.getItem(folderDisplayFiltersStorageKey)).toContain('Different')
    expect(loadFolderDisplayFilters()).toEqual({
      statuses: ['Different', 'Left only', 'Right only'],
      showSuppressed: true,
      filesOnly: true,
      alwaysShowFolders: false,
      showFiltersPanel: false,
      showPeekPanel: true,
    })
  })

  it('defaults filesOnly to false and alwaysShowFolders to true for older payloads', () => {
    localStorage.setItem(
      folderDisplayFiltersStorageKey,
      JSON.stringify({
        statuses: ['Same'],
        showSuppressed: false,
      }),
    )

    expect(loadFolderDisplayFilters()).toEqual({
      statuses: ['Same'],
      showSuppressed: false,
      filesOnly: false,
      alwaysShowFolders: true,
      showFiltersPanel: true,
      showPeekPanel: false,
    })
  })

  it('keeps Same folders when Always Show Folders is on', () => {
    expect(
      folderRowMatchesStatusFilter({
        kind: 'directory',
        status: 'Same',
        statuses: ['Different', 'Left only', 'Right only'],
        showSuppressed: false,
        alwaysShowFolders: true,
      }),
    ).toBe(true)
    expect(
      folderRowMatchesStatusFilter({
        kind: 'directory',
        status: 'Same',
        statuses: ['Different', 'Left only', 'Right only'],
        showSuppressed: false,
        alwaysShowFolders: false,
      }),
    ).toBe(false)
    expect(
      folderRowMatchesStatusFilter({
        kind: 'file',
        status: 'Same',
        statuses: ['Different'],
        showSuppressed: false,
        alwaysShowFolders: true,
      }),
    ).toBe(false)
  })
})

it('persists Filters/Peek strip chrome toggles', () => {
  saveFolderDisplayFilters({
    ...defaultFolderDisplayFilters(),
    showFiltersPanel: false,
    showPeekPanel: true,
  })

  expect(loadFolderDisplayFilters().showFiltersPanel).toBe(false)
  expect(loadFolderDisplayFilters().showPeekPanel).toBe(true)
})
