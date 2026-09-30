import { describe, expect, it } from 'vitest'
import {
  applyManualAlignments,
  folderManualAlignmentsStorageKey,
  loadManualAlignmentsForRoots,
  mergeAlignedOrphans,
  removeManualAlignment,
  saveManualAlignmentsForRoots,
  upsertManualAlignment,
  type AlignableFolderRow,
} from './folderManualAlignments'

function orphan(side: 'left' | 'right', relativePath: string, path: string): AlignableFolderRow {
  if (side === 'left') {
    return {
      id: relativePath.replaceAll(/[^a-z0-9]+/giu, '-').toLowerCase(),
      relativePath,
      depth: 0,
      leftName: relativePath.split('/').at(-1),
      leftPath: path,
      status: 'Left only',
      kind: 'file',
    }
  }

  return {
    id: relativePath.replaceAll(/[^a-z0-9]+/giu, '-').toLowerCase(),
    relativePath,
    depth: 0,
    rightName: relativePath.split('/').at(-1),
    rightPath: path,
    status: 'Right only',
    kind: 'file',
  }
}

describe('folderManualAlignments', () => {
  it('records and clears Align With pairs', () => {
    const pairs = upsertManualAlignment([], 'notes.md', 'extra-right.md')

    expect(pairs).toEqual([{ leftRelativePath: 'notes.md', rightRelativePath: 'extra-right.md' }])
    expect(removeManualAlignment(pairs, 'notes.md', 'extra-right.md')).toEqual([])
  })

  it('replaces pairs that reuse either relative path', () => {
    const pairs = upsertManualAlignment(
      [{ leftRelativePath: 'a.md', rightRelativePath: 'b.md' }],
      'a.md',
      'c.md',
    )

    expect(pairs).toEqual([{ leftRelativePath: 'a.md', rightRelativePath: 'c.md' }])
  })

  it('reapplies Align With pairs after a fresh compare result', () => {
    const rows = [
      orphan('left', 'notes.md', 'D:/left/notes.md'),
      orphan('right', 'extra-right.md', 'D:/right/extra-right.md'),
      {
        id: 'readme-md',
        relativePath: 'README.md',
        depth: 0,
        leftName: 'README.md',
        rightName: 'README.md',
        leftPath: 'D:/left/README.md',
        rightPath: 'D:/right/README.md',
        status: 'Same' as const,
        kind: 'file' as const,
      },
    ]
    const pairs = upsertManualAlignment([], 'notes.md', 'extra-right.md')
    const next = applyManualAlignments(rows, pairs)
    const merged = next.find((row) => row.manualAlignment)

    expect(merged?.relativePath).toBe('notes.md <--> extra-right.md')
    expect(merged?.alignedLeftRelativePath).toBe('notes.md')
    expect(merged?.alignedRightRelativePath).toBe('extra-right.md')
    expect(next.some((row) => row.relativePath === 'notes.md')).toBe(false)
    expect(next.some((row) => row.relativePath === 'extra-right.md')).toBe(false)
    expect(mergeAlignedOrphans(rows[0], rows[1]).id).toContain('align-')
  })

  it('persists Align With pairs per compare roots', () => {
    const storage = {
      store: {} as Record<string, string>,
      getItem(key: string) {
        return this.store[key] ?? null
      },
      setItem(key: string, value: string) {
        this.store[key] = value
      },
    }

    saveManualAlignmentsForRoots(
      '/left',
      '/right',
      [{ leftRelativePath: 'a.md', rightRelativePath: 'b.md' }],
      storage,
    )

    expect(storage.store[folderManualAlignmentsStorageKey]).toContain('a.md')
    expect(loadManualAlignmentsForRoots('/left', '/right', storage)).toEqual([
      { leftRelativePath: 'a.md', rightRelativePath: 'b.md' },
    ])
    expect(loadManualAlignmentsForRoots('/other', '/right', storage)).toEqual([])

    saveManualAlignmentsForRoots('/left', '/right', [], storage)
    expect(loadManualAlignmentsForRoots('/left', '/right', storage)).toEqual([])
  })
})
