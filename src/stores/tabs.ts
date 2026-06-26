import { defineStore } from 'pinia'
import { computed, ref } from 'vue'

export interface AppTab {
  id: string
  title: string
  route: string
  dirty: boolean
}

export const useTabsStore = defineStore('tabs', () => {
  const tabs = ref<AppTab[]>([{ id: 'home', title: 'Home', route: '/', dirty: false }])
  const activeTabId = ref('home')

  const activeTab = computed(
    () => tabs.value.find((tab) => tab.id === activeTabId.value) ?? tabs.value[0],
  )

  function openTab(tab: Omit<AppTab, 'id'>): AppTab {
    const existing = tabs.value.find((item) => item.route === tab.route)

    if (existing) {
      activeTabId.value = existing.id

      return existing
    }

    const next = { ...tab, id: crypto.randomUUID() }

    tabs.value.push(next)
    activeTabId.value = next.id

    return next
  }

  function closeTab(id: string): void {
    if (id === 'home') {
      return
    }

    const index = tabs.value.findIndex((tab) => tab.id === id)

    if (index < 0) {
      return
    }

    tabs.value.splice(index, 1)
    if (activeTabId.value === id) {
      activeTabId.value = tabs.value[Math.max(0, index - 1)]?.id ?? 'home'
    }
  }

  return { tabs, activeTabId, activeTab, openTab, closeTab }
})
