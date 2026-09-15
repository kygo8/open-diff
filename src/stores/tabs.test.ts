import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it } from 'vitest'
import { useTabsStore } from './tabs'

describe('useTabsStore workspace restore', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  it('restores tabs and active tab from a workspace snapshot', () => {
    const store = useTabsStore()

    store.restoreWorkspaceTabs({
      tabs: [
        { id: 'home', title: 'Home', route: '/', dirty: false },
        { id: 'text-1', title: 'Text Compare', route: '/compare/text', dirty: true },
      ],
      activeTabId: 'text-1',
    })

    expect(store.tabs).toHaveLength(2)
    expect(store.activeTabId).toBe('text-1')
    expect(store.activeTab.title).toBe('Text Compare')
    expect(store.activeTab.titleKey).toBe('ui.textCompare')
    expect(store.workspaceSnapshot()).toEqual({
      tabs: store.tabs,
      activeTabId: 'text-1',
    })
  })
})

describe('useTabsStore close actions', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  it('closes other tabs while keeping home and the target', () => {
    const store = useTabsStore()

    store.openTab({ title: 'Text', route: '/compare/text', dirty: false })
    store.openTab({ title: 'Folder', route: '/compare/folder', dirty: false })
    const folderId = store.activeTabId

    expect(store.canCloseOtherTabs(folderId)).toBe(true)
    store.closeOtherTabs(folderId)

    expect(store.tabs.map((tab) => tab.route)).toEqual(['/', '/compare/folder'])
    expect(store.activeTabId).toBe(folderId)
  })

  it('closes tabs to the right of the selected tab', () => {
    const store = useTabsStore()

    store.openTab({ title: 'Text', route: '/compare/text', dirty: false })
    const textId = store.activeTabId

    store.openTab({ title: 'Folder', route: '/compare/folder', dirty: false })
    store.openTab({ title: 'Hex', route: '/compare/hex', dirty: false })

    expect(store.canCloseTabsToTheRight(textId)).toBe(true)
    store.closeTabsToTheRight(textId)

    expect(store.tabs.map((tab) => tab.route)).toEqual(['/', '/compare/text'])
    expect(store.activeTabId).toBe(textId)
  })

  it('disables close actions that would be no-ops', () => {
    const store = useTabsStore()

    expect(store.canCloseTab('home')).toBe(false)
    expect(store.canCloseOtherTabs('home')).toBe(false)
    expect(store.canCloseTabsToTheRight('home')).toBe(false)

    store.openTab({ title: 'Text', route: '/compare/text', dirty: false })
    expect(store.canCloseTab(store.activeTabId)).toBe(true)
    expect(store.canCloseOtherTabs(store.activeTabId)).toBe(false)
    expect(store.canCloseTabsToTheRight(store.activeTabId)).toBe(false)
  })
})

describe('useTabsStore openTab forceNew', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  it('reuses an existing route by default and creates another tab when forceNew is set', () => {
    const store = useTabsStore()

    const first = store.openTab({ title: 'Hex', route: '/compare/hex', dirty: false })
    const reused = store.openTab({ title: 'Hex again', route: '/compare/hex', dirty: false })

    expect(reused.id).toBe(first.id)
    expect(store.tabs.filter((tab) => tab.route === '/compare/hex')).toHaveLength(1)

    const forced = store.openTab({
      title: 'Hex copy',
      route: '/compare/hex',
      dirty: false,
      forceNew: true,
    })

    expect(forced.id).not.toBe(first.id)
    expect(store.tabs.filter((tab) => tab.route === '/compare/hex')).toHaveLength(2)
  })
})
