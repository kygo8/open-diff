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
    })
    expect(store.segments).toEqual([
      'Ready',
      'Differences: -',
      'Encoding: UTF-8',
      'Filter: All rows',
    ])
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
    })

    expect(store.report).toEqual({
      comparisonStatus: 'Compared',
      differenceCount: 3,
      encoding: 'UTF-8 / LF',
      filterStatus: '1 ignored',
      source: 'text-compare',
      loadTimeSeconds: 0.03,
    })
    expect(store.segments).toEqual([
      'Compared',
      '≠ 3 difference sections',
      'Encoding: UTF-8 / LF',
      'Filter: 1 ignored',
      'Load time: 0.03 seconds',
    ])
  })
})
