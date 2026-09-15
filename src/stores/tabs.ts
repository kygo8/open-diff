import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import { sessionCatalog } from '@/app/sessionCatalog'
import { tabRoutePathname, withUniqueSessionQuery } from '@/app/sessionTabRoute'

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

  function openTab(tab: Omit<AppTab, 'id'> & { forceNew?: boolean }): AppTab {
    const { forceNew, ...tabFields } = tab
    const pathname = tabRoutePathname(tabFields.route)

    if (!forceNew) {
      const existing = tabs.value.find((item) => tabRoutePathname(item.route) === pathname)

      if (existing) {
        activeTabId.value = existing.id

        return existing
      }
    }

    const route = forceNew ? withUniqueSessionQuery(tabFields.route) : tabFields.route
    const next = normalizeTab({ ...tabFields, route, id: crypto.randomUUID() })

    tabs.value.push(next)
    activeTabId.value = next.id

    return next
  }

  function activateTab(id: string): AppTab | undefined {
    const tab = tabs.value.find((item) => item.id === id)

    if (!tab) {
      return undefined
    }

    activeTabId.value = id

    return tab
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

  function canCloseTab(id: string): boolean {
    return id !== 'home' && tabs.value.some((tab) => tab.id === id)
  }

  function canCloseOtherTabs(id: string): boolean {
    return tabs.value.some((tab) => tab.id !== id && tab.id !== 'home')
  }

  function canCloseTabsToTheRight(id: string): boolean {
    const index = tabs.value.findIndex((tab) => tab.id === id)

    if (index < 0) {
      return false
    }

    return tabs.value.slice(index + 1).some((tab) => tab.id !== 'home')
  }

  function closeOtherTabs(id: string): void {
    if (!tabs.value.some((tab) => tab.id === id)) {
      return
    }

    tabs.value = tabs.value.filter((tab) => tab.id === id || tab.id === 'home')
    activeTabId.value = id
  }

  function closeTabsToTheRight(id: string): void {
    const index = tabs.value.findIndex((tab) => tab.id === id)

    if (index < 0) {
      return
    }

    const kept = tabs.value.slice(0, index + 1)
    const closedActive = !kept.some((tab) => tab.id === activeTabId.value)

    tabs.value = kept
    if (closedActive) {
      activeTabId.value = id
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

  function setTabTitle(idOrRoute: string, title: string): boolean {
    const tab = tabs.value.find(
      (item) =>
        item.id === idOrRoute ||
        item.route === idOrRoute ||
        tabRoutePathname(item.route) === idOrRoute,
    )

    if (!tab || tab.id === 'home') {
      return false
    }

    tab.title = title
    tab.titleKey = undefined

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
    activateTab,
    closeTab,
    canCloseTab,
    canCloseOtherTabs,
    canCloseTabsToTheRight,
    closeOtherTabs,
    closeTabsToTheRight,
    setTabDirty,
    setTabTitle,
    workspaceSnapshot,
    restoreWorkspaceTabs,
  }
})

function normalizeTab(tab: AppTab): AppTab {
  return {
    ...tab,
    titleKey: tab.titleKey ?? routeTitleKeys.get(tabRoutePathname(tab.route)),
  }
}
