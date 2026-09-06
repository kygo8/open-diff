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

  it('resolves follow-system theme without requiring matchMedia', () => {
    localStorage.setItem('open-diff-theme', 'system')

    const store = useSettingsStore()

    expect(store.theme).toBe('system')
    expect(store.resolvedTheme).toBe('light')
    expect(document.documentElement.dataset.theme).toBe('light')

    store.setTheme('dark')

    expect(store.resolvedTheme).toBe('dark')
    expect(document.documentElement.dataset.theme).toBe('dark')
  })

  it('persists font family and font size onto CSS variables', () => {
    const store = useSettingsStore()

    expect(store.setFontFamily('inter')).toBe(true)
    expect(store.fontFamily).toBe('inter')
    expect(localStorage.getItem('open-diff-font-family')).toBe('inter')
    expect(document.documentElement.style.getPropertyValue('--app-font-family')).toContain('Inter')

    store.setFontSize(20)
    expect(store.fontSize).toBe(20)
    expect(localStorage.getItem('open-diff-font-size')).toBe('20')
    expect(document.documentElement.style.getPropertyValue('--app-font-size')).toBe('20px')

    store.setFontSize(99)
    expect(store.fontSize).toBe(24)
    expect(store.setFontFamily('not-a-font')).toBe(false)
  })

  it('persists and applies custom diff highlight colors', () => {
    const store = useSettingsStore()

    expect(store.setDiffColor('addedBg', '#112233')).toBe(true)
    expect(store.diffColors.addedBg).toBe('#112233')

    const storedColors = JSON.parse(localStorage.getItem('open-diff-diff-colors') ?? '{}') as {
      addedBg?: string
    }

    expect(storedColors.addedBg).toBe('#112233')
    expect(document.documentElement.style.getPropertyValue('--diff-added-bg')).toBe('#112233')

    expect(store.setDiffColor('addedBg', 'not-a-color')).toBe(false)

    store.setTheme('dark')
    store.resetDiffColors()
    expect(store.diffColors.addedFg).toBe('#67d391')
  })

  it('persists confirm-before-delete and wrap-text defaults', () => {
    const store = useSettingsStore()

    expect(store.confirmBeforeDelete).toBe(true)
    expect(store.wrapTextDefault).toBe(false)

    store.setConfirmBeforeDelete(false)
    store.setWrapTextDefault(true)

    expect(localStorage.getItem('open-diff-confirm-before-delete')).toBe('0')
    expect(localStorage.getItem('open-diff-wrap-text-default')).toBe('1')
  })
})
