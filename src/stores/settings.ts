import { defineStore } from 'pinia'
import { ref, watch } from 'vue'

export type ThemeMode = 'light' | 'dark'

const sharedSessionPathsStorageKey = 'open-diff-shared-session-paths'

export const useSettingsStore = defineStore('settings', () => {
  const theme = ref<ThemeMode>(
    (localStorage.getItem('open-diff-theme') as ThemeMode | null) ?? 'dark',
  )
  const sharedSessionPaths = ref<string[]>(loadSharedSessionPaths())

  watch(
    theme,
    (value) => {
      localStorage.setItem('open-diff-theme', value)
      document.documentElement.dataset.theme = value
    },
    { immediate: true },
  )

  watch(
    sharedSessionPaths,
    (value) => {
      localStorage.setItem(sharedSessionPathsStorageKey, JSON.stringify(value))
    },
    { deep: true, flush: 'sync' },
  )

  function toggleTheme(): void {
    theme.value = theme.value === 'dark' ? 'light' : 'dark'
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

  return { theme, sharedSessionPaths, toggleTheme, addSharedSessionPath, removeSharedSessionPath }
})

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
