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
    expect(store.workspaceSnapshot()).toEqual({
      tabs: store.tabs,
      activeTabId: 'text-1',
    })
  })
})
