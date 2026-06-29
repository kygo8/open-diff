import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it } from 'vitest'
import { useSessionLaunchStore } from './sessionLaunch'

describe('useSessionLaunchStore', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  it('stores and consumes a launch payload for the matching route', () => {
    const store = useSessionLaunchStore()

    store.setPendingLaunch({
      id: 'launch-1',
      source: 'drop',
      sessionType: 'text-compare',
      title: 'left.txt vs right.txt',
      route: '/compare/text',
      autoRun: true,
      locations: {
        left: { uri: 'C:/work/left.txt', kind: 'file', readOnly: false },
        right: { uri: 'C:/work/right.txt', kind: 'file', readOnly: false },
      },
    })

    expect(store.consumeLaunch('/compare/folder')).toBeUndefined()
    expect(store.consumeLaunch('/compare/text')?.title).toBe('left.txt vs right.txt')
    expect(store.pendingLaunch).toBeUndefined()
  })
})
