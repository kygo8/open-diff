import { mount, type VueWrapper } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import WorkspaceManager from './WorkspaceManager.vue'
import { useWorkspacesStore } from '@/stores/workspaces'
import type { WorkspaceTabsSnapshot } from '@/stores/tabs'

const snapshot: WorkspaceTabsSnapshot = {
  activeTabId: 'home',
  tabs: [{ id: 'home', title: 'Home', route: '/', dirty: false }],
}

function mountWorkspaceManager(): VueWrapper {
  return mount(WorkspaceManager, {
    props: {
      snapshot,
    },
  })
}

describe('WorkspaceManager', () => {
  beforeEach(() => {
    localStorage.clear()
    setActivePinia(createPinia())
  })

  it('saves and deletes named workspaces', async () => {
    const wrapper = mountWorkspaceManager()

    await wrapper.find('[data-testid="workspace-name-input"]').setValue('Release review')
    await wrapper.find('[data-testid="save-workspace"]').trigger('click')

    expect(useWorkspacesStore().workspaces[0]?.name).toBe('Release review')
    expect(wrapper.text()).toContain('Release review')

    const id = useWorkspacesStore().workspaces[0]?.id

    if (!id) {
      throw new Error('Expected workspace id.')
    }

    await wrapper.find(`[data-testid="delete-workspace-${id}"]`).trigger('click')

    expect(useWorkspacesStore().workspaces).toHaveLength(0)
  })

  it('emits restore when a workspace is selected', async () => {
    const wrapper = mountWorkspaceManager()

    await wrapper.find('[data-testid="workspace-name-input"]').setValue('Release review')
    await wrapper.find('[data-testid="save-workspace"]').trigger('click')

    const id = useWorkspacesStore().workspaces[0]?.id

    if (!id) {
      throw new Error('Expected workspace id.')
    }

    await wrapper.find(`[data-testid="restore-workspace-${id}"]`).trigger('click')

    expect(wrapper.emitted('restore')).toEqual([[id]])
  })

  it('does not save blank workspace names', async () => {
    const wrapper = mountWorkspaceManager()
    const saveSpy = vi.spyOn(useWorkspacesStore(), 'saveWorkspace')

    await wrapper.find('[data-testid="workspace-name-input"]').setValue('   ')
    await wrapper.find('[data-testid="save-workspace"]').trigger('click')

    expect(saveSpy).not.toHaveBeenCalled()
  })
})
