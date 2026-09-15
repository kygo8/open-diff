import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it } from 'vitest'
import { useStatusBarStore } from './statusBar'

describe('useStatusBarStore', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  it('starts with a ready status for views that have not reported yet', () => {
    const store = useStatusBarStore()

    expect(store.report).toEqual({
      comparisonStatus: 'Ready',
      differenceCount: null,
      encoding: 'UTF-8',
      filterStatus: 'All rows',
      source: 'workspace',
      loadTimeSeconds: null,
      importantDifferenceCount: null,
      unimportantDifferenceCount: null,
      editMode: null,
      chromeKind: 'standard',
      leftSelection: null,
      leftFreeSpace: null,
      rightSelection: null,
      rightFreeSpace: null,
    })
    expect(store.segments).toEqual([
      'Ready',
      'Differences: -',
      'Encoding: UTF-8',
      'Filter: All rows',
    ])
    expect(store.chromeKind).toBe('standard')
  })

  it('accepts partial status reports while preserving the protocol shape', () => {
    const store = useStatusBarStore()

    store.reportStatus({
      comparisonStatus: 'Compared',
      differenceCount: 3,
      encoding: 'UTF-8 / LF',
      filterStatus: '1 ignored',
      source: 'text-compare',
      loadTimeSeconds: 0.03,
      editMode: 'insert',
      chromeKind: 'text-session',
    })

    expect(store.report).toEqual({
      comparisonStatus: 'Compared',
      differenceCount: 3,
      encoding: 'UTF-8 / LF',
      filterStatus: '1 ignored',
      source: 'text-compare',
      loadTimeSeconds: 0.03,
      importantDifferenceCount: null,
      unimportantDifferenceCount: null,
      editMode: 'insert',
      chromeKind: 'text-session',
      leftSelection: null,
      leftFreeSpace: null,
      rightSelection: null,
      rightFreeSpace: null,
    })
    expect(store.segments).toEqual([
      'Compared',
      '≠ 3 difference sections',
      'Encoding: UTF-8 / LF',
      'Filter: 1 ignored',
      'Insert',
      'Load time: 0.03 seconds',
    ])
    expect(store.chromeKind).toBe('text-session')
  })

  it('derives folder-pair chrome from folder sources', () => {
    const store = useStatusBarStore()

    store.reportStatus({
      source: 'folder-compare',
      leftSelection: '2 file(s) selected, 40 bytes',
      leftFreeSpace: '1 GB free on /',
      rightSelection: null,
      rightFreeSpace: '1 GB free on /',
    })

    expect(store.chromeKind).toBe('folder-pair')
    expect(store.report.leftSelection).toContain('2 file(s)')
  })
})
