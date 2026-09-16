import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import HomeView from './HomeView.vue'
import { readClipboardTextSource } from '@/app/clipboardSource'
import { sampleSavedSessions } from '@/app/savedSessions'
import { saveNamedSessions } from '@/app/sessionPersistence'
import { createAppI18n, installI18n } from '@/i18n'
import { useSavedSessionsStore } from '@/stores/savedSessions'
import { useSessionLaunchStore } from '@/stores/sessionLaunch'

const push = vi.fn()

vi.mock('@/app/clipboardSource', () => ({
  readClipboardTextSource: vi.fn().mockResolvedValue({
    kind: 'clipboard-text',
    title: 'Clipboard Text',
    text: 'clipboard text',
  }),
}))

vi.mock('vue-router', () => ({
  useRouter: () => ({ push }),
}))

const nButtonStub = {
  props: ['disabled'],
  emits: ['click'],
  template: '<button :disabled="disabled" @click="$emit(\'click\')"><slot /></button>',
}

function seedSampleSessions(): void {
  saveNamedSessions(sampleSavedSessions)
}

function mountHomeView(): ReturnType<typeof mount<typeof HomeView>> {
  const i18n = createAppI18n('en-US')

  return mount(HomeView, {
    global: {
      plugins: [
        {
          install(app) {
            installI18n(app, i18n)
          },
        },
      ],
      stubs: {
        NButton: nButtonStub,
      },
    },
  })
}

describe('HomeView', () => {
  beforeEach(() => {
    localStorage.clear()
    setActivePinia(createPinia())
    push.mockClear()
    vi.mocked(readClipboardTextSource).mockClear()
  })

  it('exposes capture-density layout flags on the Home workspace', () => {
    const wrapper = mountHomeView()
    const layout = wrapper.find('[data-testid="home-layout"]')

    expect(layout.exists()).toBe(true)
    expect(layout.attributes('data-home-density')).toBe('capture-pass7')
    expect(layout.attributes('data-home-chrome')).toBe('minimal')
    expect(wrapper.find('.workbench-shell').attributes('data-compact')).toBe('true')
    expect(wrapper.find('.bc-home-workspace').classes()).toContain('bc-home-workspace')
    expect(wrapper.find('.bc-home-instructions').exists()).toBe(true)
    expect(wrapper.find('.new-session-grid').exists()).toBe(true)
    expect(wrapper.findAll('[data-testid="home-new-session-card"]')).toHaveLength(12)
  })

  it('renders the full quick-start session catalog', () => {
    const wrapper = mountHomeView()

    const cards = wrapper.findAll('[data-testid="home-new-session-card"]')

    expect(cards).toHaveLength(12)
    expect(cards.map((card) => card.attributes('data-session-type'))).toEqual([
      'folder-compare',
      'folder-merge',
      'folder-sync',
      'text-compare',
      'text-merge',
      'text-edit',
      'hex-compare',
      'media-compare',
      'picture-compare',
      'registry-compare',
      'table-compare',
      'version-compare',
    ])
    expect(wrapper.find('[data-testid="home-how-to-start"]').text()).toContain(
      'Drag folders or files onto session icon',
    )
    expect(wrapper.find('[data-testid="home-browse-folders"]').exists()).toBe(false)
    expect(wrapper.find('[data-testid="home-drop-here"]').exists()).toBe(false)
    expect(wrapper.text()).toContain('Text Compare')
    expect(wrapper.find('[data-testid="home-tree-text-compare"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="home-tree-text-edit"]').exists()).toBe(false)
    expect(wrapper.find('[data-testid="home-tree-auto-saved"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="home-tree-today"]').exists()).toBe(true)
  })

  it('renders new session cards, recent sessions table and workspace inspector first', () => {
    const wrapper = mountHomeView()

    expect(wrapper.find('[data-testid="home-new-session"]').exists()).toBe(true)
    expect(wrapper.findAll('[data-testid="home-new-session-card"]')).toHaveLength(12)
    expect(wrapper.find('[data-testid="home-recent-sessions"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="home-workspace-inspector"]').exists()).toBe(true)
    expect(wrapper.find('.drop-zone').exists()).toBe(false)
    expect(wrapper.find('.priority-groups').exists()).toBe(false)
  })

  it('opens quick-start session cards', async () => {
    const wrapper = mountHomeView()
    const launchStore = useSessionLaunchStore()

    const textCompare = wrapper.find('[data-session-type="text-compare"]')
    const folderCompare = wrapper.find('[data-session-type="folder-compare"]')
    const folderSync = wrapper.find('[data-session-type="folder-sync"]')
    const textMerge = wrapper.find('[data-session-type="text-merge"]')

    await textCompare.trigger('click')

    expect(push).toHaveBeenCalledWith('/compare/text')
    expect(launchStore.pendingLaunch).toMatchObject({
      source: 'home',
      sessionType: 'text-compare',
      route: '/compare/text',
      autoRun: false,
    })

    await folderCompare.trigger('click')

    expect(push).toHaveBeenCalledWith('/compare/folder')

    await folderSync.trigger('click')

    expect(push).toHaveBeenCalledWith('/sync/folder')

    await textMerge.trigger('click')

    expect(push).toHaveBeenCalledWith('/merge/text')
  })

  it('auto-opens the suggested view when files are dropped on the HTML drop zone', async () => {
    const wrapper = mountHomeView()
    const launchStore = useSessionLaunchStore()
    const dropZone = wrapper.find('.quick-input-zone')

    const left = { name: 'left.txt', webkitRelativePath: '' }
    const right = { name: 'right.txt', webkitRelativePath: '' }
    const fileList = [left, right]
    const files = {
      0: left,
      1: right,
      length: 2,
      item: (index: number) => fileList[index] ?? null,
      *[Symbol.iterator]() {
        yield left
        yield right
      },
    }

    await dropZone.trigger('drop', {
      dataTransfer: {
        files,
        items: [],
      },
    })

    expect(push).toHaveBeenCalledWith('/compare/text')
    expect(launchStore.pendingLaunch).toMatchObject({
      source: 'drop',
      sessionType: 'text-compare',
      route: '/compare/text',
      autoRun: true,
      locations: {
        left: { uri: 'left.txt', kind: 'file' },
        right: { uri: 'right.txt', kind: 'file' },
      },
    })
  })

  it('opens the suggested view with dropped file paths as a launch payload', async () => {
    const wrapper = mountHomeView()
    const launchStore = useSessionLaunchStore()

    await wrapper.find('[data-testid="simulate-text-drop"]').trigger('click')
    await wrapper.find('[data-testid="open-suggested-view"]').trigger('click')

    expect(push).toHaveBeenCalledWith('/compare/text')
    expect(launchStore.pendingLaunch).toMatchObject({
      source: 'drop',
      sessionType: 'text-compare',
      route: '/compare/text',
      autoRun: true,
      locations: {
        left: { uri: 'C:/work/left.txt', kind: 'file' },
        right: { uri: 'C:/work/right.txt', kind: 'file' },
      },
    })
  })

  it('opens a single patch drop in Text Patch with the patch path', async () => {
    const wrapper = mountHomeView()
    const launchStore = useSessionLaunchStore()

    await wrapper.find('[data-testid="simulate-patch-drop"]').trigger('click')
    await wrapper.find('[data-testid="open-suggested-view"]').trigger('click')

    expect(push).toHaveBeenCalledWith('/patch/text')
    expect(launchStore.pendingLaunch).toMatchObject({
      source: 'drop',
      sessionType: 'text-patch',
      route: '/patch/text',
      autoRun: true,
      locations: {
        left: { uri: 'C:/work/change.patch', kind: 'file' },
      },
    })
  })

  it('starts without demo saved sessions or fake history', () => {
    const wrapper = mountHomeView()

    expect(wrapper.text()).not.toContain('Compare sample text')
    expect(wrapper.text()).not.toContain('Review release folder')
    expect(wrapper.text()).not.toContain('Config updated')
    expect(wrapper.text()).not.toContain('Release v1.2')
    expect(wrapper.find('[data-testid="home-session-history-empty"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="home-edit-selected"]').attributes('disabled')).toBeDefined()
    expect(wrapper.find('[data-testid="home-tree-add"]').attributes('disabled')).toBeUndefined()
    expect(wrapper.find('[data-testid="home-tree-remove"]').attributes('disabled')).toBeDefined()
    expect(wrapper.find('[data-testid="home-edit-selected"]').text()).toBe('Edit')
    expect(wrapper.find('[data-testid="home-edit-selected"]').text()).not.toContain('unimplemented')
    expect(wrapper.find('.workbench-shell').attributes('data-compact')).toBe('true')
  })

  it('enables Edit for a selected saved session and renames it', async () => {
    seedSampleSessions()
    const wrapper = mountHomeView()

    expect(
      wrapper.find('[data-testid="home-edit-selected"]').attributes('disabled'),
    ).toBeUndefined()

    await wrapper.find('[data-testid="home-edit-selected"]').trigger('click')
    expect(wrapper.find('[data-testid="home-edit-panel"]').exists()).toBe(true)

    await wrapper.find('[data-testid="home-edit-name-input"]').setValue('Renamed from Edit')
    await wrapper.find('[data-testid="home-edit-confirm"]').trigger('click')

    expect(wrapper.text()).toContain('Renamed from Edit')
    expect(wrapper.find('[data-testid="home-edit-panel"]').exists()).toBe(false)
  })

  it('shows saved sessions in a dense recent sessions table', () => {
    seedSampleSessions()
    const wrapper = mountHomeView()

    expect(wrapper.find('[data-testid="home-recent-sessions"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="home-recent-sessions-table"]').exists()).toBe(true)
    expect(wrapper.text()).toContain('Compare sample text')
    expect(wrapper.text()).toContain('Review release folder')
    expect(wrapper.text()).toContain('Never opened')
  })

  it('filters recent sessions by search keyword', async () => {
    seedSampleSessions()
    const wrapper = mountHomeView()

    await wrapper.find('[data-testid="session-search"]').setValue('release')
    const recentSessions = wrapper.find('[data-testid="home-recent-sessions-table"]')

    expect(recentSessions.text()).toContain('Review release folder')
    expect(recentSessions.text()).not.toContain('Compare sample text')
  })

  it('filters Auto-saved and Today tree rows by the same search box', async () => {
    seedSampleSessions()
    const store = useSavedSessionsStore()
    const baseSession = store.sessions.at(0)

    if (!baseSession) {
      throw new Error('Expected the sample session list to contain at least one session.')
    }

    const today = new Date().toISOString()

    store.saveSession({
      ...baseSession,
      id: 'today-release',
      name: 'Today release check',
      metadata: {
        ...baseSession.metadata,
        lastOpenedAt: today,
        autoSaved: false,
        locked: false,
      },
    })
    store.autoSaveSession(
      {
        ...baseSession,
        id: 'auto-other',
        name: 'Auto other draft',
        metadata: {
          ...baseSession.metadata,
          lastOpenedAt: today,
        },
      },
      10,
    )
    const wrapper = mountHomeView()

    expect(wrapper.find('[data-testid="home-tree-today-today-release"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="home-tree-autosaved-auto-other"]').exists()).toBe(true)

    await wrapper.find('[data-testid="session-search"]').setValue('release')

    expect(wrapper.find('[data-testid="home-tree-today-today-release"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="home-tree-autosaved-auto-other"]').exists()).toBe(false)
  })

  it('applies saved session management actions from the tree', async () => {
    seedSampleSessions()
    const wrapper = mountHomeView()

    await wrapper.find('[data-testid="rename-session-sample-text"]').trigger('click')
    expect(wrapper.text()).toContain('Compare sample text Renamed')

    await wrapper.find('[data-testid="copy-session-sample-text"]').trigger('click')
    expect(wrapper.text()).toContain('Compare sample text Renamed Copy')

    await wrapper.find('[data-testid="move-session-sample-text"]').trigger('click')
    expect(
      useSavedSessionsStore().sessions.find((session) => session.id === 'sample-text')?.metadata
        .folder,
    ).toBe('Archive')

    await wrapper.find('[data-testid="delete-session-sample-text"]').trigger('click')
    expect(wrapper.find('[data-testid="delete-session-sample-text"]').exists()).toBe(false)
    expect(wrapper.text()).toContain('Compare sample text Renamed Copy')
  })

  it('disables overwrite actions for locked sessions', () => {
    seedSampleSessions()
    const wrapper = mountHomeView()

    expect(
      wrapper.find('[data-testid="rename-session-sample-folder"]').attributes('disabled'),
    ).toBe('')
    expect(wrapper.find('[data-testid="move-session-sample-folder"]').attributes('disabled')).toBe(
      '',
    )
    expect(
      wrapper.find('[data-testid="delete-session-sample-folder"]').attributes('disabled'),
    ).toBe('')
    expect(wrapper.find('[data-testid="copy-session-sample-folder"]').attributes('disabled')).toBe(
      undefined,
    )
  })

  it('prompts to save when closing a dirty session', async () => {
    seedSampleSessions()
    const wrapper = mountHomeView()

    await wrapper.find('[data-testid="change-rules-session-sample-text"]').trigger('click')
    await wrapper.find('[data-testid="delete-session-sample-text"]').trigger('click')

    expect(wrapper.find('[data-testid="save-prompt"]').exists()).toBe(true)
    expect(wrapper.text()).toContain('Save changes before closing Compare sample text?')
  })

  it('shows a recovery entry for auto-saved sessions', async () => {
    seedSampleSessions()
    setActivePinia(createPinia())
    const store = useSavedSessionsStore()
    const baseSession = store.sessions.at(0)

    if (!baseSession) {
      throw new Error('Expected the sample session list to contain at least one session.')
    }

    store.detectRecoverySessions([
      {
        ...baseSession,
        id: 'autosaved-text',
        name: 'Recovered text',
        metadata: { ...baseSession.metadata, autoSaved: true },
      },
    ])

    const wrapper = mountHomeView()

    expect(wrapper.find('[data-testid="recovery-entry"]').exists()).toBe(true)
    expect(wrapper.text()).toContain('Recovered text')

    await wrapper.find('[data-testid="restore-recovery"]').trigger('click')

    expect(wrapper.find('[data-testid="recovery-entry"]').exists()).toBe(false)
    expect(wrapper.text()).toContain('Recovered text')
    expect(push).toHaveBeenCalledWith('/compare/text')
  })

  it('opens text compare from clipboard text', async () => {
    const wrapper = mountHomeView()

    await wrapper.find('[data-testid="open-clipboard-text"]').trigger('click')

    expect(readClipboardTextSource).toHaveBeenCalled()
    expect(push).toHaveBeenCalledWith('/compare/text')
    expect(wrapper.text()).toContain('Clipboard Text ready')
  })

  it('saves the current session as a named persistent entry', async () => {
    const wrapper = mountHomeView()

    await wrapper.find('[data-testid="save-current-session-as"]').trigger('click')
    await wrapper.find('[data-testid="session-name-input"]').setValue('Persisted from home')
    await wrapper.find('[data-testid="confirm-session-save"]').trigger('click')

    expect(wrapper.find('[data-testid="home-recent-sessions"]').text()).toContain(
      'Persisted from home',
    )

    setActivePinia(createPinia())

    const remounted = mountHomeView()

    expect(remounted.find('[data-testid="home-recent-sessions"]').text()).toContain(
      'Persisted from home',
    )
  })

  it('saves and restores a named workspace from the home inspector', async () => {
    const wrapper = mountHomeView()

    await wrapper.find('[data-session-type="text-compare"]').trigger('click')
    await wrapper.find('[data-testid="workspace-name-input"]').setValue('Text review workspace')
    await wrapper.find('[data-testid="save-workspace"]').trigger('click')

    expect(wrapper.text()).toContain('Text review workspace')

    const restoreButton = wrapper
      .findAll('button')
      .find((button) => button.attributes('data-testid')?.startsWith('restore-workspace-'))

    if (!restoreButton) {
      throw new Error('Expected restore workspace button.')
    }

    await restoreButton.trigger('click')

    expect(push).toHaveBeenCalledWith('/compare/text')
  })
})
