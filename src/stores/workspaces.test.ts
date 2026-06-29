import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it } from 'vitest'
import { useWorkspacesStore } from './workspaces'

describe('useWorkspacesStore', () => {
  beforeEach(() => {
    localStorage.clear()
    setActivePinia(createPinia())
  })

  it('saves, restores, renames, and deletes workspace documents', () => {
    const store = useWorkspacesStore()

    const workspace = store.saveWorkspace('Release review', {
      activeTabId: 'home',
      tabs: [{ id: 'home', title: 'Home', route: '/', dirty: false }],
    })

    expect(store.workspaces).toHaveLength(1)
    expect(store.renameWorkspace(workspace.id, 'Release audit')).toBe(true)
    expect(store.workspaces[0]?.name).toBe('Release audit')
    expect(store.deleteWorkspace(workspace.id)).toBe(true)
    expect(store.workspaces).toHaveLength(0)
  })

  it('loads persisted workspace documents in a new store instance', () => {
    const store = useWorkspacesStore()

    store.saveWorkspace('Persisted workspace', {
      activeTabId: 'home',
      tabs: [{ id: 'home', title: 'Home', route: '/', dirty: false }],
    })

    setActivePinia(createPinia())

    expect(useWorkspacesStore().workspaces[0]?.name).toBe('Persisted workspace')
  })
})
