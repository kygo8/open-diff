import { defineStore } from 'pinia'
import { computed, ref, watch } from 'vue'
import {
  commandRegistry,
  type AppCommand,
  type CommandId,
  type CommandShortcut,
  type ShortcutScope,
} from '@/app/commandRegistry'
import { fallbackLocale, isSupportedLocale, type SupportedLocale } from '@/i18n/core'

export type ThemeMode = 'light' | 'dark' | 'system'
export type FontFamilyId = 'system' | 'segoe' | 'inter' | 'noto' | 'mono'

export interface DiffHighlightColors {
  addedBg: string
  addedFg: string
  deletedBg: string
  deletedFg: string
  modifiedBg: string
  modifiedFg: string
}

export const fontFamilyOptions: Record<FontFamilyId, string> = {
  system: 'ui-sans-serif, system-ui, sans-serif',
  segoe: "'Segoe UI', 'PingFang SC', 'Microsoft YaHei', ui-sans-serif, system-ui, sans-serif",
  inter:
    'Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", "PingFang SC", "Microsoft YaHei", sans-serif',
  noto: "'Noto Sans', 'Noto Sans SC', 'Noto Sans JP', ui-sans-serif, system-ui, sans-serif",
  mono: "var(--font-mono), 'JetBrains Mono', 'Cascadia Mono', Consolas, monospace",
}

export const defaultDiffHighlightColors: DiffHighlightColors = {
  addedBg: '#f4fff4',
  addedFg: '#005f18',
  deletedBg: '#ffe3e3',
  deletedFg: '#e00000',
  modifiedBg: '#ffe3e3',
  modifiedFg: '#e00000',
}

export const defaultDarkDiffHighlightColors: DiffHighlightColors = {
  addedBg: '#1f3d2e',
  addedFg: '#67d391',
  deletedBg: '#3d2220',
  deletedFg: '#ff8a80',
  modifiedBg: '#3d3420',
  modifiedFg: '#f5c56b',
}

const sharedSessionPathsStorageKey = 'open-diff-shared-session-paths'
const localeStorageKey = 'open-diff-locale'
const shortcutOverridesStorageKey = 'open-diff-shortcut-overrides'
const autoSaveLimitStorageKey = 'open-diff-auto-save-limit'
const fontFamilyStorageKey = 'open-diff-font-family'
const fontSizeStorageKey = 'open-diff-font-size'
const diffColorsStorageKey = 'open-diff-diff-colors'
const confirmBeforeDeleteStorageKey = 'open-diff-confirm-before-delete'
const wrapTextDefaultStorageKey = 'open-diff-wrap-text-default'
const fontFamilyIds = new Set<FontFamilyId>(['system', 'segoe', 'inter', 'noto', 'mono'])
const shortcutScopes = new Set<ShortcutScope>(['global', 'text-compare'])
const commandIds = new Set<string>(commandRegistry.map((command) => command.id))

type ShortcutOverrides = Partial<Record<CommandId, CommandShortcut>>

export const useSettingsStore = defineStore('settings', () => {
  const theme = ref<ThemeMode>(loadTheme())
  const systemPrefersDark = ref(prefersDarkTheme())
  const resolvedTheme = computed(() => {
    if (theme.value === 'system') {
      return systemPrefersDark.value ? 'dark' : 'light'
    }

    return theme.value
  })
  const locale = ref<SupportedLocale>(loadLocale())
  const sharedSessionPaths = ref<string[]>(loadSharedSessionPaths())
  const shortcutOverrides = ref<ShortcutOverrides>(loadShortcutOverrides())
  const autoSaveLimit = ref(loadAutoSaveLimit())
  const fontFamily = ref<FontFamilyId>(loadFontFamily())
  const fontSize = ref(loadFontSize())
  const diffColors = ref<DiffHighlightColors>(loadDiffColors())
  const confirmBeforeDelete = ref(loadConfirmBeforeDelete())
  const wrapTextDefault = ref(loadWrapTextDefault())

  bindSystemThemeListener((prefersDark) => {
    systemPrefersDark.value = prefersDark
  })

  watch(
    [theme, resolvedTheme],
    ([nextTheme, nextResolved]) => {
      localStorage.setItem('open-diff-theme', nextTheme)
      document.documentElement.dataset.theme = nextResolved
    },
    { immediate: true, flush: 'sync' },
  )

  watch(
    sharedSessionPaths,
    (value) => {
      localStorage.setItem(sharedSessionPathsStorageKey, JSON.stringify(value))
    },
    { deep: true, flush: 'sync' },
  )

  watch(
    locale,
    (value) => {
      localStorage.setItem(localeStorageKey, value)
      document.documentElement.lang = value
    },
    { immediate: true, flush: 'sync' },
  )

  watch(
    shortcutOverrides,
    (value) => {
      localStorage.setItem(shortcutOverridesStorageKey, JSON.stringify(value))
    },
    { deep: true, immediate: true, flush: 'sync' },
  )

  watch(
    autoSaveLimit,
    (value) => {
      localStorage.setItem(autoSaveLimitStorageKey, String(value))
    },
    { immediate: true, flush: 'sync' },
  )

  watch(
    fontFamily,
    (value) => {
      localStorage.setItem(fontFamilyStorageKey, value)
      document.documentElement.style.setProperty('--app-font-family', fontFamilyOptions[value])
    },
    { immediate: true, flush: 'sync' },
  )

  watch(
    fontSize,
    (value) => {
      localStorage.setItem(fontSizeStorageKey, String(value))
      document.documentElement.style.setProperty('--app-font-size', `${String(value)}px`)
    },
    { immediate: true, flush: 'sync' },
  )

  watch(
    diffColors,
    (value) => {
      localStorage.setItem(diffColorsStorageKey, JSON.stringify(value))
      applyDiffColors(value)
    },
    { deep: true, immediate: true, flush: 'sync' },
  )

  watch(
    confirmBeforeDelete,
    (value) => {
      localStorage.setItem(confirmBeforeDeleteStorageKey, value ? '1' : '0')
    },
    { immediate: true, flush: 'sync' },
  )

  watch(
    wrapTextDefault,
    (value) => {
      localStorage.setItem(wrapTextDefaultStorageKey, value ? '1' : '0')
    },
    { immediate: true, flush: 'sync' },
  )

  function toggleTheme(): void {
    theme.value = resolvedTheme.value === 'dark' ? 'light' : 'dark'
  }

  function setTheme(nextTheme: ThemeMode): void {
    theme.value = nextTheme
  }

  function addSharedSessionPath(path: string): boolean {
    const normalized = path.trim()

    if (!normalized || sharedSessionPaths.value.includes(normalized)) {
      return false
    }

    sharedSessionPaths.value = [...sharedSessionPaths.value, normalized]

    return true
  }

  function removeSharedSessionPath(path: string): boolean {
    if (!sharedSessionPaths.value.includes(path)) {
      return false
    }

    sharedSessionPaths.value = sharedSessionPaths.value.filter((item) => item !== path)

    return true
  }

  function setLocale(nextLocale: string): boolean {
    if (!isSupportedLocale(nextLocale)) {
      return false
    }

    locale.value = nextLocale

    return true
  }

  function setShortcutOverride(
    commandId: string,
    shortcut: { keys: string[]; scope: string },
  ): boolean {
    if (!isCommandId(commandId) || !isShortcutScope(shortcut.scope)) {
      return false
    }

    const normalizedKeys = shortcut.keys.map((key) => key.trim())

    if (normalizedKeys.length === 0 || normalizedKeys.some((key) => key === '')) {
      return false
    }

    shortcutOverrides.value = {
      ...shortcutOverrides.value,
      [commandId]: {
        keys: normalizedKeys,
        scope: shortcut.scope,
      },
    }

    return true
  }

  function resetShortcutOverride(commandId: string): boolean {
    if (!isCommandId(commandId) || shortcutOverrides.value[commandId] === undefined) {
      return false
    }

    const { [commandId]: _removed, ...remainingOverrides } = shortcutOverrides.value

    shortcutOverrides.value = remainingOverrides

    return true
  }

  function getEffectiveShortcut(command: AppCommand): CommandShortcut {
    return shortcutOverrides.value[command.id] ?? command.defaultShortcut
  }

  function setAutoSaveLimit(value: number): void {
    autoSaveLimit.value = Math.max(0, Math.min(50, Math.floor(value)))
  }

  function setFontFamily(value: string): boolean {
    if (!isFontFamilyId(value)) {
      return false
    }

    fontFamily.value = value

    return true
  }

  function setFontSize(value: number): void {
    fontSize.value = Math.max(12, Math.min(24, Math.floor(value)))
  }

  function setDiffColor(key: keyof DiffHighlightColors, value: string): boolean {
    const normalized = value.trim()

    if (!isCssColor(normalized)) {
      return false
    }

    diffColors.value = {
      ...diffColors.value,
      [key]: normalized,
    }

    return true
  }

  function resetDiffColors(): void {
    diffColors.value = {
      ...(resolvedTheme.value === 'dark'
        ? defaultDarkDiffHighlightColors
        : defaultDiffHighlightColors),
    }
  }

  function setConfirmBeforeDelete(value: boolean): void {
    confirmBeforeDelete.value = value
  }

  function setWrapTextDefault(value: boolean): void {
    wrapTextDefault.value = value
  }

  return {
    theme,
    resolvedTheme,
    locale,
    sharedSessionPaths,
    shortcutOverrides,
    autoSaveLimit,
    fontFamily,
    fontSize,
    diffColors,
    confirmBeforeDelete,
    wrapTextDefault,
    toggleTheme,
    setTheme,
    setLocale,
    addSharedSessionPath,
    removeSharedSessionPath,
    setShortcutOverride,
    resetShortcutOverride,
    getEffectiveShortcut,
    setAutoSaveLimit,
    setFontFamily,
    setFontSize,
    setDiffColor,
    resetDiffColors,
    setConfirmBeforeDelete,
    setWrapTextDefault,
  }
})

function loadTheme(): ThemeMode {
  const stored = localStorage.getItem('open-diff-theme')

  if (stored === 'light' || stored === 'dark' || stored === 'system') {
    return stored
  }

  return 'light'
}

function prefersDarkTheme(): boolean {
  if (typeof window.matchMedia !== 'function') {
    return false
  }

  return window.matchMedia('(prefers-color-scheme: dark)').matches
}

function bindSystemThemeListener(onChange: (prefersDark: boolean) => void): void {
  if (typeof window.matchMedia !== 'function') {
    return
  }

  const media = window.matchMedia('(prefers-color-scheme: dark)')
  const listener = (event: MediaQueryListEvent): void => {
    onChange(event.matches)
  }

  if (typeof media.addEventListener === 'function') {
    media.addEventListener('change', listener)
  }
}

function loadLocale(): SupportedLocale {
  const storedLocale = localStorage.getItem(localeStorageKey)

  if (!storedLocale || !isSupportedLocale(storedLocale)) {
    return fallbackLocale
  }

  return storedLocale
}

function loadSharedSessionPaths(): string[] {
  try {
    const parsed = JSON.parse(localStorage.getItem(sharedSessionPathsStorageKey) ?? '[]') as unknown

    if (!Array.isArray(parsed)) {
      return []
    }

    return parsed.filter((item): item is string => typeof item === 'string' && item.trim() !== '')
  } catch {
    return []
  }
}

function loadShortcutOverrides(): ShortcutOverrides {
  try {
    const parsed = JSON.parse(localStorage.getItem(shortcutOverridesStorageKey) ?? '{}') as unknown

    if (!isPlainRecord(parsed)) {
      return {}
    }

    return Object.entries(parsed).reduce<ShortcutOverrides>((overrides, [commandId, shortcut]) => {
      if (!isCommandId(commandId) || !isShortcutLike(shortcut)) {
        return overrides
      }

      overrides[commandId] = shortcut

      return overrides
    }, {})
  } catch {
    return {}
  }
}

function loadAutoSaveLimit(): number {
  const rawValue = localStorage.getItem(autoSaveLimitStorageKey)

  if (rawValue === null) {
    return 10
  }

  const stored = Number(rawValue)

  if (!Number.isFinite(stored)) {
    return 10
  }

  return Math.max(0, Math.min(50, Math.floor(stored)))
}

function loadFontFamily(): FontFamilyId {
  const stored = localStorage.getItem(fontFamilyStorageKey)

  if (stored && isFontFamilyId(stored)) {
    return stored
  }

  return 'segoe'
}

function loadFontSize(): number {
  const rawValue = localStorage.getItem(fontSizeStorageKey)

  if (rawValue === null) {
    return 18
  }

  const stored = Number(rawValue)

  if (!Number.isFinite(stored)) {
    return 18
  }

  return Math.max(12, Math.min(24, Math.floor(stored)))
}

function loadDiffColors(): DiffHighlightColors {
  try {
    const parsed = JSON.parse(localStorage.getItem(diffColorsStorageKey) ?? 'null') as unknown

    if (!isPlainRecord(parsed)) {
      return { ...defaultDiffHighlightColors }
    }

    const next: DiffHighlightColors = { ...defaultDiffHighlightColors }

    for (const key of Object.keys(defaultDiffHighlightColors) as (keyof DiffHighlightColors)[]) {
      const value = parsed[key]

      if (typeof value === 'string' && isCssColor(value)) {
        next[key] = value.trim()
      }
    }

    return next
  } catch {
    return { ...defaultDiffHighlightColors }
  }
}

function loadConfirmBeforeDelete(): boolean {
  const stored = localStorage.getItem(confirmBeforeDeleteStorageKey)

  if (stored === null) {
    return true
  }

  return stored !== '0'
}

function loadWrapTextDefault(): boolean {
  const stored = localStorage.getItem(wrapTextDefaultStorageKey)

  if (stored === null) {
    return false
  }

  return stored === '1'
}

function applyDiffColors(colors: DiffHighlightColors): void {
  const root = document.documentElement.style

  root.setProperty('--diff-added-bg', colors.addedBg)
  root.setProperty('--diff-added-fg', colors.addedFg)
  root.setProperty('--diff-deleted-bg', colors.deletedBg)
  root.setProperty('--diff-deleted-fg', colors.deletedFg)
  root.setProperty('--diff-modified-bg', colors.modifiedBg)
  root.setProperty('--diff-modified-fg', colors.modifiedFg)
}

function isFontFamilyId(value: string): value is FontFamilyId {
  return fontFamilyIds.has(value as FontFamilyId)
}

function isCssColor(value: string): boolean {
  if (value.length === 0 || value.length > 64) {
    return false
  }

  return (
    /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/.test(value) ||
    /^rgba?\(\s*\d{1,3}\s+\d{1,3}\s+\d{1,3}\s*(?:\/\s*[\d.]+%?\s*)?\)$/.test(value) ||
    /^rgba?\(\s*\d{1,3}\s*,\s*\d{1,3}\s*,\s*\d{1,3}\s*(?:,\s*[\d.]+\s*)?\)$/.test(value)
  )
}

function isCommandId(value: string): value is CommandId {
  return commandIds.has(value)
}

function isShortcutScope(value: string): value is ShortcutScope {
  return shortcutScopes.has(value as ShortcutScope)
}

function isShortcutLike(value: unknown): value is CommandShortcut {
  if (
    !isPlainRecord(value) ||
    !Array.isArray(value.keys) ||
    !isShortcutScope(String(value.scope))
  ) {
    return false
  }

  const keys = value.keys

  return keys.length > 0 && keys.every((key) => typeof key === 'string' && key.trim() !== '')
}

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}
