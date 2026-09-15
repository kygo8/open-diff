import { defineStore } from 'pinia'
import { ref } from 'vue'

/** Active folder session publishes Back/Forward enablement for Session menus. */
export const useFolderPathNavStore = defineStore('folderPathNav', () => {
  const canGoBack = ref(false)
  const canGoForward = ref(false)

  function setCapabilities(next: { canGoBack: boolean; canGoForward: boolean }): void {
    canGoBack.value = next.canGoBack
    canGoForward.value = next.canGoForward
  }

  function reset(): void {
    canGoBack.value = false
    canGoForward.value = false
  }

  return {
    canGoBack,
    canGoForward,
    setCapabilities,
    reset,
  }
})
