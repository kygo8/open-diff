import { computed, ref } from 'vue'
import { defineStore } from 'pinia'

/** Active folder session publishes selection and roots for Session/Actions menu enablement. */
export const useFolderMenuSelectionStore = defineStore('folderMenuSelection', () => {
  const hasSelection = ref(false)
  const leftRoot = ref('')
  const rightRoot = ref('')
  const hasRoots = computed(() => Boolean(leftRoot.value.trim() && rightRoot.value.trim()))

  function setHasSelection(next: boolean): void {
    hasSelection.value = next
  }

  function setRoots(left: string, right: string): void {
    leftRoot.value = left
    rightRoot.value = right
  }

  function reset(): void {
    hasSelection.value = false
    leftRoot.value = ''
    rightRoot.value = ''
  }

  return {
    hasSelection,
    leftRoot,
    rightRoot,
    hasRoots,
    setHasSelection,
    setRoots,
    reset,
  }
})
