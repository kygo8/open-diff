import { describe, expect, it } from 'vitest'
import {
  expandHiddenDescendantsForFileActions,
  folderCopyTargetsForDirection,
  folderEntryPaths,
  invertRowIds,
  resolveOperationRows,
  selectAllRowIds,
  stepRowIdByNameFilter,
  selectFileRowIds,
  selectRowIdsByNameFilter,
  selectNewerRowIds,
  selectRowIdsByStatuses,
} from './folderRowSelection'

const rows = [
  {
    id: 'a',
    kind: 'file' as const,
    status: 'Same' as const,
    relativePath: 'a.txt',
    leftName: 'a.txt',
  },
  {
    id: 'b',
    kind: 'file' as const,
    status: 'Different' as const,
    relativePath: 'notes/b.md',
    leftName: 'b.md',
  },
  {
    id: 'c',
    kind: 'directory' as const,
    status: 'Left only' as const,
    relativePath: 'docs',
    leftName: 'docs',
  },
  {
    id: 'd',
    kind: 'file' as const,
    status: 'Right only' as const,
    relativePath: 'only-right.log',
    rightName: 'only-right.log',
  },
]

describe('folderRowSelection', () => {
  it('selects all, files, statuses, name matches, and invert', () => {
    expect(selectAllRowIds(rows)).toEqual(['a', 'b', 'c', 'd'])
    expect(selectFileRowIds(rows)).toEqual(['a', 'b', 'd'])
    expect(selectRowIdsByStatuses(rows, ['Same', 'Different'])).toEqual(['a', 'b'])
    expect(selectRowIdsByStatuses(rows, ['Left only', 'Right only'])).toEqual(['c', 'd'])
    expect(selectRowIdsByNameFilter(rows, 'B.MD')).toEqual(['b'])
    expect(selectRowIdsByNameFilter(rows, '  ')).toEqual([])
    expect(invertRowIds(rows, ['a', 'c'])).toEqual(['b', 'd'])
  })

  it('prefers checked rows for bulk ops, else the focused selection', () => {
    expect(resolveOperationRows(rows, ['a', 'd'], 'b').map((row) => row.id)).toEqual(['a', 'd'])
    expect(resolveOperationRows(rows, [], 'b').map((row) => row.id)).toEqual(['b'])
    expect(resolveOperationRows(rows, [], undefined)).toEqual([])
  })

  it('builds copy targets and entry paths for checked rows', () => {
    const withPaths = [
      {
        id: 'a',
        kind: 'file' as const,
        status: 'Different' as const,
        relativePath: 'a.txt',
        leftPath: '/L/a.txt',
        rightPath: '/R/a.txt',
      },
      {
        id: 'd',
        kind: 'file' as const,
        status: 'Right only' as const,
        relativePath: 'only-right.log',
        rightPath: '/R/only-right.log',
      },
    ]

    expect(
      folderCopyTargetsForDirection(withPaths, 'Right', (relative) => `/L/${relative}`),
    ).toEqual([
      {
        relativePath: 'a.txt',
        sourcePath: '/L/a.txt',
        targetPath: '/R/a.txt',
      },
    ])
    expect(
      folderCopyTargetsForDirection(withPaths, 'Left', (relative) => `/L/${relative}`),
    ).toEqual([
      {
        relativePath: 'a.txt',
        sourcePath: '/R/a.txt',
        targetPath: '/L/a.txt',
      },
      {
        relativePath: 'only-right.log',
        sourcePath: '/R/only-right.log',
        targetPath: '/L/only-right.log',
      },
    ])
    expect(folderEntryPaths(withPaths)).toEqual(['/L/a.txt', '/R/only-right.log'])
  })

  it('expands directory selections to hidden descendants for file actions', () => {
    const allRows = [
      { id: 'dir', kind: 'directory' as const, relativePath: 'pkg', status: 'Different' as const },
      { id: 'a', kind: 'file' as const, relativePath: 'pkg/a.txt', status: 'Different' as const },
      { id: 'b', kind: 'file' as const, relativePath: 'pkg/b.txt', status: 'Same' as const },
      {
        id: 'other',
        kind: 'file' as const,
        relativePath: 'other.txt',
        status: 'Different' as const,
      },
    ]
    const operationRows = [allRows[0]]

    expect(
      expandHiddenDescendantsForFileActions(allRows, operationRows)
        .map((row) => row.id)
        .sort(),
    ).toEqual(['a', 'b', 'dir'])
  })
})

it('steps through name-filter matches for Find Next/Previous Filename', () => {
  const rows = [
    {
      id: 'a',
      kind: 'file' as const,
      status: 'Same' as const,
      relativePath: 'alpha.txt',
      leftName: 'alpha.txt',
    },
    {
      id: 'b',
      kind: 'file' as const,
      status: 'Same' as const,
      relativePath: 'beta.txt',
      leftName: 'beta.txt',
    },
    {
      id: 'c',
      kind: 'file' as const,
      status: 'Same' as const,
      relativePath: 'alpha-2.txt',
      leftName: 'alpha-2.txt',
    },
  ]

  expect(stepRowIdByNameFilter(rows, 'alpha', undefined, 1)).toBe('a')
  expect(stepRowIdByNameFilter(rows, 'alpha', 'a', 1)).toBe('c')
  expect(stepRowIdByNameFilter(rows, 'alpha', 'c', 1)).toBe('a')
  expect(stepRowIdByNameFilter(rows, 'alpha', 'a', -1)).toBe('c')
  expect(stepRowIdByNameFilter(rows, 'missing', 'a', 1)).toBeUndefined()
})

it('selects rows where both sides exist and timestamps differ', () => {
  expect(
    selectNewerRowIds([
      { id: 'a', leftModifiedAtMs: 100, rightModifiedAtMs: 100 },
      { id: 'b', leftModifiedAtMs: 200, rightModifiedAtMs: 100 },
      { id: 'c', leftModifiedAtMs: 100 },
      { id: 'd', rightModifiedAtMs: 100 },
    ]),
  ).toEqual(['b'])
})
