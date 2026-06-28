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
    })

    expect(store.report).toEqual({
      comparisonStatus: 'Compared',
      differenceCount: 3,
      encoding: 'UTF-8 / LF',
      filterStatus: '1 ignored',
      source: 'text-compare',
    })
    expect(store.segments).toEqual([
      'Compared',
      'Differences: 3',
      'Encoding: UTF-8 / LF',
      'Filter: 1 ignored',
    ])
  })
})
