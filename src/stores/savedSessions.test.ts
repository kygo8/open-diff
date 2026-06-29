import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it } from 'vitest'
import { useSavedSessionsStore } from './savedSessions'

describe('useSavedSessionsStore', () => {
  beforeEach(() => {
    localStorage.clear()
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

  it('detects and restores auto-saved recovery candidates', () => {
    const store = useSavedSessionsStore()
    const baseSession = store.sessions.at(0)

    if (!baseSession) {
      throw new Error('Expected the sample session list to contain at least one session.')
    }

    store.detectRecoverySessions([
      {
        ...baseSession,
        id: 'autosaved-text',
        name: 'Recovered text',
        metadata: { ...baseSession.metadata, autoSaved: true },
      },
    ])

    expect(store.recoveryCandidates).toHaveLength(1)

    store.restoreRecoverySessions()

    expect(store.sessions.some((session) => session.id === 'autosaved-text')).toBe(true)
    expect(store.recoveryCandidates).toHaveLength(0)
  })

  it('loads shared sessions as read-only and edits through a copy', () => {
    const store = useSavedSessionsStore()
    const baseSession = store.sessions.at(0)

    if (!baseSession) {
      throw new Error('Expected the sample session list to contain at least one session.')
    }

    store.loadSharedSession({
      ...baseSession,
      id: 'shared-text',
      name: 'Shared text',
      metadata: { ...baseSession.metadata, shared: true },
    })

    const shared = store.sessions.find((session) => session.id === 'shared-text')

    expect(shared?.metadata.shared).toBe(true)
    expect(shared?.metadata.locked).toBe(true)
    expect(store.updateSessionRules('shared-text', { comparison: { whitespace: 'ignore' } })).toBe(
      false,
    )

    const editable = store.saveSharedSessionAsCopy('shared-text')

    expect(editable.metadata.shared).toBe(false)
    expect(editable.metadata.locked).toBe(false)
    expect(store.updateSessionRules(editable.id, { comparison: { whitespace: 'ignore' } })).toBe(
      true,
    )
  })

  it('persists named sessions and reloads them in a new store instance', () => {
    const store = useSavedSessionsStore()

    expect(store.renameSession('sample-text', 'Persisted text review')).toBe(true)

    setActivePinia(createPinia())

    const reloaded = useSavedSessionsStore()

    expect(reloaded.sessions.find((session) => session.id === 'sample-text')?.name).toBe(
      'Persisted text review',
    )
  })

  it('saves a new session and supports save as without overwriting the original', () => {
    const store = useSavedSessionsStore()
    const baseSession = store.sessions.find((session) => session.id === 'sample-text')

    if (!baseSession) {
      throw new Error('Expected sample-text session.')
    }

    const saved = store.saveSession({
      ...baseSession,
      id: 'new-session',
      name: 'Saved from view',
      metadata: { ...baseSession.metadata, dirty: true },
    })

    expect(saved.metadata.dirty).toBe(false)
    expect(store.sessions.some((session) => session.id === 'new-session')).toBe(true)

    const copy = store.saveSessionAs('new-session', 'Saved as copy')

    expect(copy.id).not.toBe('new-session')
    expect(copy.name).toBe('Saved as copy')
    expect(store.sessions.find((session) => session.id === 'new-session')?.name).toBe(
      'Saved from view',
    )
  })

  it('keeps auto-saved sessions within the configured limit and clears recovery entries', () => {
    const store = useSavedSessionsStore()
    const baseSession = store.sessions.find((session) => session.id === 'sample-text')

    if (!baseSession) {
      throw new Error('Expected sample-text session.')
    }

    store.autoSaveSession({ ...baseSession, id: 'auto-1', name: 'Auto 1' }, 2)
    store.autoSaveSession({ ...baseSession, id: 'auto-2', name: 'Auto 2' }, 2)
    store.autoSaveSession({ ...baseSession, id: 'auto-3', name: 'Auto 3' }, 2)

    expect(store.autoSavedSessions.map((session) => session.id)).toEqual(['auto-3', 'auto-2'])
    expect(store.recoveryCandidates.map((session) => session.id)).toEqual(['auto-3', 'auto-2'])

    store.clearAutoSavedSessions()

    expect(store.autoSavedSessions).toEqual([])
    expect(store.recoveryCandidates).toEqual([])
  })
})
