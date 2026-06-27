import { describe, expect, it } from 'vitest'
import { addRecentPath, clearRecentPaths } from './pathHistory'

describe('pathHistory', () => {
  it('keeps recent paths newest first and deduplicated', () => {
    const history = [
      { path: 'C:/work/old.txt', kind: 'file' as const },
      { path: 'C:/work/reused.txt', kind: 'file' as const },
    ]

    expect(addRecentPath(history, { path: 'C:/work/reused.txt', kind: 'file' })).toEqual([
      { path: 'C:/work/reused.txt', kind: 'file' },
      { path: 'C:/work/old.txt', kind: 'file' },
    ])
  })

  it('trims history to the configured maximum size', () => {
    const history = [
      { path: 'one', kind: 'file' as const },
      { path: 'two', kind: 'file' as const },
    ]

    expect(addRecentPath(history, { path: 'three', kind: 'folder' }, 2)).toEqual([
      { path: 'three', kind: 'folder' },
      { path: 'one', kind: 'file' },
    ])
  })

  it('clears all recent paths', () => {
    expect(clearRecentPaths()).toEqual([])
  })
})
