import { describe, expect, it } from 'vitest'
import {
  entryBaseName,
  folderExternalTransferPlans,
  folderSideTransferPlans,
  inferCopyToSideDirection,
  inferCopyToSideDirectionForRows,
  joinTransferPath,
  resolveNewFolderRoots,
} from './folderSideTransfer'

describe('folderSideTransfer', () => {
  it('infers copy-to-side direction from which side has the entry', () => {
    expect(inferCopyToSideDirection({ leftPath: 'L/a.txt' })).toBe('Right')
    expect(inferCopyToSideDirection({ rightPath: 'R/a.txt' })).toBe('Left')
    expect(inferCopyToSideDirection({ leftPath: 'L/a.txt', rightPath: 'R/a.txt' })).toBe(
      'ambiguous',
    )
    expect(inferCopyToSideDirection({})).toBeNull()
    expect(
      inferCopyToSideDirectionForRows([
        { leftPath: 'L/a.txt', relativePath: 'a.txt' },
        { leftPath: 'L/b.txt', relativePath: 'b.txt' },
      ]),
    ).toBe('Right')
    expect(
      inferCopyToSideDirectionForRows([
        { leftPath: 'L/a.txt', relativePath: 'a.txt' },
        { rightPath: 'R/b.txt', relativePath: 'b.txt' },
      ]),
    ).toBe('ambiguous')
  })

  it('builds side and external transfer plans', () => {
    expect(joinTransferPath('D:/left', 'src/main.ts')).toBe('D:/left/src/main.ts')
    expect(entryBaseName('D:/left/src/main.ts')).toBe('main.ts')

    expect(
      folderSideTransferPlans(
        [{ relativePath: 'notes.md', leftPath: 'D:/left/notes.md' }],
        'Right',
        'D:/left',
        'D:/right',
      ),
    ).toEqual([
      {
        sourcePath: 'D:/left/notes.md',
        targetPath: 'D:/right/notes.md',
        relativePath: 'notes.md',
      },
    ])

    expect(
      folderExternalTransferPlans(
        [{ relativePath: 'notes.md', leftPath: 'D:/left/notes.md' }],
        'D:/backup',
      ),
    ).toEqual([
      {
        sourcePath: 'D:/left/notes.md',
        targetPath: 'D:/backup/notes.md',
        relativePath: 'notes.md',
      },
    ])
  })

  it('resolves New Folder roots with side focus', () => {
    expect(
      resolveNewFolderRoots({
        leftRoot: 'D:/left',
        rightRoot: 'D:/right',
        leftWritable: true,
        rightWritable: true,
        focusedSide: 'right',
      }),
    ).toEqual(['D:/right'])

    expect(
      resolveNewFolderRoots({
        leftRoot: 'D:/left',
        rightRoot: 'D:/right',
        leftWritable: true,
        rightWritable: false,
        focusedSide: 'right',
      }),
    ).toEqual(['D:/left'])
  })
})
