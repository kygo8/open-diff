import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it } from 'vitest'
import { useSavedSessionsStore } from './savedSessions'

describe('useSavedSessionsStore', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  it('renames, copies, moves, and deletes sessions with a consistent snapshot', () => {
    const store = useSavedSessionsStore()

    store.renameSession('sample-text', 'Review text changes')
    expect(store.sessions.find((session) => session.id === 'sample-text')?.name).toBe(
      'Review text changes',
    )

    const copy = store.copySession('sample-text')

    expect(copy.name).toBe('Review text changes Copy')
    expect(copy.id).not.toBe('sample-text')

    store.moveSession(copy.id, 'Archive/Text')
    expect(store.sessions.find((session) => session.id === copy.id)?.metadata.folder).toBe(
      'Archive/Text',
    )

    store.deleteSession('sample-folder')
    expect(store.sessions.some((session) => session.id === 'sample-folder')).toBe(false)
    expect(store.snapshot()).toEqual(store.sessions)
  })
})
