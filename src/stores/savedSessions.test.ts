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

    store.deleteSession(copy.id)
    expect(store.sessions.some((session) => session.id === copy.id)).toBe(false)
    expect(store.snapshot()).toEqual(store.sessions)
  })

  it('protects locked sessions from direct overwrite operations', () => {
    const store = useSavedSessionsStore()

    store.setSessionLocked('sample-text', true)
    const locked = store.sessions.find((session) => session.id === 'sample-text')

    if (!locked) {
      throw new Error('Expected sample-text session to exist.')
    }

    expect(locked.metadata.locked).toBe(true)
    expect(store.renameSession('sample-text', 'Blocked rename')).toBe(false)
    expect(store.moveSession('sample-text', 'Archive')).toBe(false)
    expect(store.deleteSession('sample-text')).toBe(false)
    expect(store.overwriteSession('sample-text', { ...locked, name: 'Blocked overwrite' })).toBe(
      false,
    )
    expect(store.sessions.find((session) => session.id === 'sample-text')?.name).toBe(
      'Compare sample text',
    )

    const copy = store.copySession('sample-text')

    expect(copy.metadata.locked).toBe(false)
    expect(copy.name).toBe('Compare sample text Copy')
  })

  it('marks sessions dirty after rule changes and prompts before closing', () => {
    const store = useSavedSessionsStore()

    store.updateSessionRules('sample-text', { comparison: { whitespace: 'ignore' } })

    expect(store.sessions.find((session) => session.id === 'sample-text')?.metadata.dirty).toBe(
      true,
    )
    expect(store.requestDeleteSession('sample-text')).toBe(false)
    expect(store.pendingSavePrompt?.id).toBe('sample-text')

    store.markSessionSaved('sample-text')

    expect(store.sessions.find((session) => session.id === 'sample-text')?.metadata.dirty).toBe(
      false,
    )
    expect(store.requestDeleteSession('sample-text')).toBe(true)
  })
})
