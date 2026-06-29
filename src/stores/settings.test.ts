import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it } from 'vitest'
import { useSettingsStore } from './settings'
import { commandRegistry } from '@/app/commandRegistry'

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

  it('stores locale preferences and falls back from unsupported values', () => {
    localStorage.setItem('open-diff-locale', 'zh-CN')

    const store = useSettingsStore()

    expect(store.locale).toBe('zh-CN')

    expect(store.setLocale('fr-FR')).toBe(true)
    expect(store.locale).toBe('fr-FR')
    expect(localStorage.getItem('open-diff-locale')).toBe('fr-FR')

    expect(store.setLocale('invalid-locale')).toBe(false)
    expect(store.locale).toBe('fr-FR')
  })

  it('stores shortcut overrides by command id', () => {
    const store = useSettingsStore()

    expect(
      store.setShortcutOverride('theme.toggle', {
        keys: ['Ctrl', 'Shift', 'L'],
        scope: 'global',
      }),
    ).toBe(true)

    expect(store.shortcutOverrides['theme.toggle']).toEqual({
      keys: ['Ctrl', 'Shift', 'L'],
      scope: 'global',
    })
    expect(JSON.parse(localStorage.getItem('open-diff-shortcut-overrides') ?? '{}')).toEqual({
      'theme.toggle': {
        keys: ['Ctrl', 'Shift', 'L'],
        scope: 'global',
      },
    })
  })

  it('returns custom shortcuts when overrides exist and restores command defaults', () => {
    const store = useSettingsStore()
    const themeCommand = commandRegistry.find((command) => command.id === 'theme.toggle')

    if (!themeCommand) {
      throw new Error('theme.toggle command is missing')
    }

    expect(store.getEffectiveShortcut(themeCommand)).toEqual(themeCommand.defaultShortcut)

    store.setShortcutOverride('theme.toggle', {
      keys: ['Ctrl', 'Shift', 'L'],
      scope: 'global',
    })

    expect(store.getEffectiveShortcut(themeCommand)).toEqual({
      keys: ['Ctrl', 'Shift', 'L'],
      scope: 'global',
    })
    expect(store.resetShortcutOverride('theme.toggle')).toBe(true)
    expect(store.shortcutOverrides['theme.toggle']).toBeUndefined()
    expect(store.getEffectiveShortcut(themeCommand)).toEqual(themeCommand.defaultShortcut)
  })

  it('rejects invalid shortcut overrides', () => {
    const store = useSettingsStore()

    expect(
      store.setShortcutOverride('theme.toggle', {
        keys: ['Ctrl', '  '],
        scope: 'global',
      }),
    ).toBe(false)
    expect(
      store.setShortcutOverride('theme.toggle', {
        keys: ['Ctrl', 'K'],
        scope: 'unknown',
      }),
    ).toBe(false)
    expect(store.shortcutOverrides).toEqual({})
    expect(localStorage.getItem('open-diff-shortcut-overrides')).toBe('{}')
  })

  it('stores an auto-save session limit with safe bounds', () => {
    const store = useSettingsStore()

    expect(store.autoSaveLimit).toBe(10)

    store.setAutoSaveLimit(25)

    expect(store.autoSaveLimit).toBe(25)
    expect(localStorage.getItem('open-diff-auto-save-limit')).toBe('25')

    store.setAutoSaveLimit(99)

    expect(store.autoSaveLimit).toBe(50)

    store.setAutoSaveLimit(-1)

    expect(store.autoSaveLimit).toBe(0)
  })
})
