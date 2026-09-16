import { beforeEach, describe, expect, it } from 'vitest'
import {
  folderCompareIgnoredRootKey,
  folderIgnoredPathsStorageKey,
  loadFolderIgnoredPathsStore,
  loadIgnoredRelativePathsForRoots,
  normalizeIgnoredRelativePaths,
  saveFolderIgnoredPathsStore,
  saveIgnoredRelativePathsForRoots,
} from './folderIgnoredPaths'

describe('folderIgnoredPaths', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('builds a stable root key and normalizes path lists', () => {
    expect(folderCompareIgnoredRootKey(' /left ', ' /right ')).toBe('/left|/right')
    expect(normalizeIgnoredRelativePaths([' a ', '', 'a', 'b', 1, null])).toEqual(['a', 'b'])
  })

  it('round-trips ignored paths for a compare pair', () => {
    saveIgnoredRelativePathsForRoots('/left', '/right', new Set(['src/a.ts', 'notes.md']))

    expect(localStorage.getItem(folderIgnoredPathsStorageKey)).toContain('src/a.ts')
    expect([...loadIgnoredRelativePathsForRoots('/left', '/right')].sort()).toEqual([
      'notes.md',
      'src/a.ts',
    ])
    expect([...loadIgnoredRelativePathsForRoots('/other', '/right')]).toEqual([])
  })

  it('clears a pair when the ignored set becomes empty and ignores corrupt storage', () => {
    saveIgnoredRelativePathsForRoots('/left', '/right', ['keep.ts'])
    saveIgnoredRelativePathsForRoots('/left', '/right', new Set())

    expect(loadFolderIgnoredPathsStore()).toEqual({})

    localStorage.setItem(folderIgnoredPathsStorageKey, '{')
    expect(loadFolderIgnoredPathsStore()).toEqual({})
    expect([...loadIgnoredRelativePathsForRoots('/left', '/right')]).toEqual([])
  })

  it('persists multiple pairs through the store helpers', () => {
    saveFolderIgnoredPathsStore({
      '/a|/b': ['one'],
      '/c|/d': ['two', ''],
    })

    expect(loadFolderIgnoredPathsStore()).toEqual({
      '/a|/b': ['one'],
      '/c|/d': ['two'],
    })
  })
})
