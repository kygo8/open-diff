import { defineStore } from 'pinia'
import { ref, watch } from 'vue'

export type ThemeMode = 'light' | 'dark'

export const useSettingsStore = defineStore('settings', () => {
  const theme = ref<ThemeMode>(
    (localStorage.getItem('open-diff-theme') as ThemeMode | null) ?? 'dark',
  )

  watch(
    theme,
    (value) => {
      localStorage.setItem('open-diff-theme', value)
      document.documentElement.dataset.theme = value
    },
    { immediate: true },
  )

  function toggleTheme(): void {
    theme.value = theme.value === 'dark' ? 'light' : 'dark'
  }

  return { theme, toggleTheme }
})
