import { beforeEach, describe, expect, it } from 'vitest'
import { loadNamedSessions, namedSessionsStorageKey, saveNamedSessions } from './sessionPersistence'
import { sampleSavedSessions } from './savedSessions'

describe('sessionPersistence', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('saves and loads named sessions from localStorage', () => {
    saveNamedSessions(sampleSavedSessions)

    expect(JSON.parse(localStorage.getItem(namedSessionsStorageKey) ?? '[]')).toHaveLength(
      sampleSavedSessions.length,
    )
    expect(loadNamedSessions()).toEqual(sampleSavedSessions)
  })

  it('falls back to sample sessions when localStorage is empty or invalid', () => {
    expect(loadNamedSessions()).toEqual(sampleSavedSessions)

    localStorage.setItem(namedSessionsStorageKey, '{')

    expect(loadNamedSessions()).toEqual(sampleSavedSessions)
  })
})
