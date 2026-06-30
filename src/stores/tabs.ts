import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import { sessionCatalog } from '@/app/sessionCatalog'

export interface AppTab {
  id: string
  title: string
  titleKey?: string
  route: string
  dirty: boolean
}

export interface WorkspaceTabsSnapshot {
  tabs: AppTab[]
  activeTabId: string
}

const homeTab: AppTab = { id: 'home', title: 'Home', titleKey: 'ui.home', route: '/', dirty: false }
const routeTitleKeys = new Map<string, string>([
  ['/', 'ui.home'],
  ['/settings', 'ui.settings'],
  ['/settings/file-formats', 'ui.fileFormats'],
  ['/settings/remote-profiles', 'ui.remoteProfiles'],
  ...sessionCatalog
    .filter((entry): entry is typeof entry & { route: string } => Boolean(entry.route))
    .map((entry) => [entry.route, entry.titleKey] as const),
])

export const useTabsStore = defineStore('tabs', () => {
  const tabs = ref<AppTab[]>([{ ...homeTab }])
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

    const next = normalizeTab({ ...tab, id: crypto.randomUUID() })

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

  function setTabDirty(id: string, dirty: boolean): boolean {
    const tab = tabs.value.find((item) => item.id === id)

    if (!tab) {
      return false
    }

    tab.dirty = dirty

    return true
  }

  function workspaceSnapshot(): WorkspaceTabsSnapshot {
    return {
      tabs: tabs.value.map((tab) => ({ ...tab })),
      activeTabId: activeTabId.value,
    }
  }

  function restoreWorkspaceTabs(snapshot: WorkspaceTabsSnapshot): void {
    const restoredTabs = snapshot.tabs.map((tab) => normalizeTab({ ...tab }))

    if (!restoredTabs.some((tab) => tab.id === 'home')) {
      restoredTabs.unshift({ ...homeTab })
    }

    tabs.value = restoredTabs
    activeTabId.value = restoredTabs.some((tab) => tab.id === snapshot.activeTabId)
      ? snapshot.activeTabId
      : 'home'
  }

  return {
    tabs,
    activeTabId,
    activeTab,
    openTab,
    closeTab,
    setTabDirty,
    workspaceSnapshot,
    restoreWorkspaceTabs,
  }
})

function normalizeTab(tab: AppTab): AppTab {
  return {
    ...tab,
    titleKey: tab.titleKey ?? routeTitleKeys.get(tab.route),
  }
}
