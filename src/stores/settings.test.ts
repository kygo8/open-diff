import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it } from 'vitest'
import { useSettingsStore } from './settings'

describe('useSettingsStore', () => {
  beforeEach(() => {
    localStorage.clear()
    setActivePinia(createPinia())
  })

  it('stores shared session file paths without duplicates or empty values', () => {
    const store = useSettingsStore()

    expect(store.addSharedSessionPath('  C:/team/shared.open-diff-session.json  ')).toBe(true)
    expect(store.addSharedSessionPath('C:/team/shared.open-diff-session.json')).toBe(false)
    expect(store.addSharedSessionPath('')).toBe(false)

    expect(store.sharedSessionPaths).toEqual(['C:/team/shared.open-diff-session.json'])
    expect(JSON.parse(localStorage.getItem('open-diff-shared-session-paths') ?? '[]')).toEqual([
      'C:/team/shared.open-diff-session.json',
    ])
  })

  it('removes shared session file paths by value', () => {
    const store = useSettingsStore()

    store.addSharedSessionPath('C:/team/one.open-diff-session.json')
    store.addSharedSessionPath('C:/team/two.open-diff-session.json')

    expect(store.removeSharedSessionPath('C:/team/one.open-diff-session.json')).toBe(true)
    expect(store.removeSharedSessionPath('missing')).toBe(false)
    expect(store.sharedSessionPaths).toEqual(['C:/team/two.open-diff-session.json'])
  })
})
