import { describe, expect, it } from 'vitest'
import {
  aggregateFolderSelection,
  formatFolderSelectionLabel,
  joinStatusFooterParts,
} from './folderSelectionStatus'

const rows = [
  {
    id: 'a',
    kind: 'file' as const,
    leftByteSize: 10,
    rightByteSize: 12,
    leftModified: '2026-01-01',
    rightModified: '2026-01-02',
  },
  {
    id: 'b',
    kind: 'file' as const,
    leftByteSize: 5,
    rightByteSize: 5,
  },
  {
    id: 'c',
    kind: 'directory' as const,
    leftModified: '--',
  },
]

const labels = {
  filesSelectedBytes: (count: number, bytes: number) => `${String(count)}f/${String(bytes)}b`,
  filesSelectedBytesWithDate: (count: number, bytes: number, modified: string) =>
    `${String(count)}f/${String(bytes)}b/${modified}`,
  filesAndFoldersSelectedBytes: (files: number, folders: number, bytes: number) =>
    `${String(files)}f+${String(folders)}d/${String(bytes)}b`,
  foldersSelected: (count: number) => `${String(count)}d`,
  itemsSelected: (count: number) => `${String(count)}i`,
}

describe('folderSelectionStatus', () => {
  it('aggregates checked files and folders, including multi-select bytes', () => {
    expect(aggregateFolderSelection(rows, ['a', 'b', 'c'])).toEqual({
      fileCount: 2,
      folderCount: 1,
      count: 3,
      leftBytes: 15,
      rightBytes: 17,
      leftModified: '',
      rightModified: '',
    })
  })

  it('falls back to the focused row when nothing is checked', () => {
    expect(aggregateFolderSelection(rows, [], 'a')).toMatchObject({
      fileCount: 1,
      folderCount: 0,
      count: 1,
      leftBytes: 10,
      rightBytes: 12,
      leftModified: '2026-01-01',
      rightModified: '2026-01-02',
    })
  })

  it('formats richer multi-select and single-file labels', () => {
    expect(
      formatFolderSelectionLabel(
        { fileCount: 2, folderCount: 1, count: 3, leftBytes: 15, rightBytes: 17, bytes: 15 },
        labels,
      ),
    ).toBe('2f+1d/15b')
    expect(
      formatFolderSelectionLabel(
        {
          fileCount: 1,
          folderCount: 0,
          count: 1,
          leftBytes: 10,
          rightBytes: 12,
          bytes: 10,
          modified: '2026-01-01',
        },
        labels,
      ),
    ).toBe('1f/10b/2026-01-01')
    expect(
      formatFolderSelectionLabel(
        { fileCount: 0, folderCount: 2, count: 2, leftBytes: 0, rightBytes: 0, bytes: 0 },
        labels,
      ),
    ).toBe('2d')
    expect(
      formatFolderSelectionLabel(
        { fileCount: 0, folderCount: 0, count: 0, leftBytes: 0, rightBytes: 0, bytes: 0 },
        labels,
      ),
    ).toBe('')
  })

  it('joins footer parts with a middle dot', () => {
    expect(joinStatusFooterParts('1 file(s) selected, 10 bytes', '1 GB free on /')).toBe(
      '1 file(s) selected, 10 bytes · 1 GB free on /',
    )
    expect(joinStatusFooterParts('', '1 GB free on /', null)).toBe('1 GB free on /')
  })
})
