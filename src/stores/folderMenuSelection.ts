import { defineStore } from 'pinia'
import { ref } from 'vue'

/** Active folder session publishes selection presence for Actions menu enablement. */
export const useFolderMenuSelectionStore = defineStore('folderMenuSelection', () => {
  const hasSelection = ref(false)

  function setHasSelection(next: boolean): void {
    hasSelection.value = next
  }

  function reset(): void {
    hasSelection.value = false
  }

  return {
    hasSelection,
    setHasSelection,
    reset,
  }
})
