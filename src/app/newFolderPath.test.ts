import { describe, expect, it } from 'vitest'
import { newFolderParentRelativePath, resolveNewFolderPaths } from './newFolderPath'

describe('newFolderPath', () => {
  it('resolves parents for directory and file selections', () => {
    expect(
      newFolderParentRelativePath({
        selectedRelativePath: 'src/app',
        selectedKind: 'directory',
      }),
    ).toBe('src/app')
    expect(
      newFolderParentRelativePath({
        selectedRelativePath: 'src/app/main.ts',
        selectedKind: 'file',
      }),
    ).toBe('src/app')
    expect(newFolderParentRelativePath({})).toBe('')
  })

  it('builds absolute create paths under writable roots', () => {
    expect(
      resolveNewFolderPaths({
        roots: ['D:/left', 'D:/right', ''],
        folderName: 'New Folder',
        parentRelativePath: 'src',
      }),
    ).toEqual(['D:/left/src/New Folder', 'D:/right/src/New Folder'])

    expect(
      resolveNewFolderPaths({
        roots: ['D:/left'],
        folderName: '../evil',
      }),
    ).toEqual([])
  })
})
