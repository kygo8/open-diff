import { beforeEach, describe, expect, it } from 'vitest'
import {
  defaultFolderMergeDisplay,
  folderMergeDisplayStorageKey,
  loadFolderMergeDisplay,
  mergeRowMatchesViewPreset,
  saveFolderMergeDisplay,
} from './folderMergeDisplay'

const fileSides = {
  left: { kind: 'File' },
  base: { kind: 'File' },
  right: { kind: 'File' },
}

describe('folderMergeDisplay', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('defaults to showing all rows with the center pane visible', () => {
    expect(loadFolderMergeDisplay()).toEqual(defaultFolderMergeDisplay())
  })

  it('persists View presets, Always Show Folders, Center Pane, and Compare to Output', () => {
    saveFolderMergeDisplay({
      viewPreset: 'conflicts',
      alwaysShowFolders: false,
      showCenterPane: false,
      compareToOutput: true,
    })

    expect(localStorage.getItem(folderMergeDisplayStorageKey)).toContain('conflicts')
    expect(loadFolderMergeDisplay()).toEqual({
      viewPreset: 'conflicts',
      alwaysShowFolders: false,
      showCenterPane: false,
      compareToOutput: true,
    })
  })

  it('restores capture-friendly defaults for older payloads', () => {
    localStorage.setItem(folderMergeDisplayStorageKey, JSON.stringify({ viewPreset: 'changes' }))

    expect(loadFolderMergeDisplay()).toEqual({
      viewPreset: 'changes',
      alwaysShowFolders: true,
      showCenterPane: true,
      compareToOutput: false,
    })
  })

  it('filters Show Changes and Show Conflicts without hiding folders when asked', () => {
    const keep = { ...fileSides, action: 'Keep output' }
    const copy = { ...fileSides, action: 'Copy left to output' }
    const conflict = { ...fileSides, action: 'Mark conflict', conflict: { path: 'notes.txt' } }
    const folder = {
      left: { kind: 'Directory' },
      base: { kind: 'Directory' },
      right: { kind: 'Directory' },
      action: 'Keep output',
    }

    expect(mergeRowMatchesViewPreset(keep, { viewPreset: 'all', alwaysShowFolders: true })).toBe(
      true,
    )
    expect(
      mergeRowMatchesViewPreset(keep, { viewPreset: 'changes', alwaysShowFolders: false }),
    ).toBe(false)
    expect(
      mergeRowMatchesViewPreset(copy, { viewPreset: 'changes', alwaysShowFolders: false }),
    ).toBe(true)
    expect(
      mergeRowMatchesViewPreset(conflict, { viewPreset: 'conflicts', alwaysShowFolders: false }),
    ).toBe(true)
    expect(
      mergeRowMatchesViewPreset(copy, { viewPreset: 'conflicts', alwaysShowFolders: false }),
    ).toBe(false)
    expect(
      mergeRowMatchesViewPreset(folder, { viewPreset: 'changes', alwaysShowFolders: true }),
    ).toBe(true)
    expect(
      mergeRowMatchesViewPreset(folder, { viewPreset: 'changes', alwaysShowFolders: false }),
    ).toBe(false)
  })
})
