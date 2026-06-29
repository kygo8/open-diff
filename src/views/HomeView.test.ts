import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import HomeView from './HomeView.vue'
import { readClipboardTextSource } from '@/app/clipboardSource'
import { createAppI18n, installI18n } from '@/i18n'
import { useSavedSessionsStore } from '@/stores/savedSessions'

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
    setActivePinia(createPinia())
    push.mockClear()
    vi.mocked(readClipboardTextSource).mockClear()
  })

  it('renders the four design quick-start session cards', () => {
    const wrapper = mountHomeView()

    const cards = wrapper.findAll('[data-testid="home-new-session-card"]')

    expect(cards).toHaveLength(4)
    expect(cards.map((card) => card.attributes('data-session-type'))).toEqual([
      'text-compare',
      'folder-compare',
      'text-merge',
      'folder-sync',
    ])
  })

  it('renders new session cards, recent sessions table and workspace inspector first', () => {
    const wrapper = mountHomeView()

    expect(wrapper.find('[data-testid="home-new-session"]').exists()).toBe(true)
    expect(wrapper.findAll('[data-testid="home-new-session-card"]')).toHaveLength(4)
    expect(wrapper.find('[data-testid="home-recent-sessions"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="home-workspace-inspector"]').exists()).toBe(true)
    expect(wrapper.find('.drop-zone').exists()).toBe(false)
    expect(wrapper.find('.priority-groups').exists()).toBe(false)
  })

  it('opens quick-start session cards', async () => {
    const wrapper = mountHomeView()

    const textCompare = wrapper.find('[data-session-type="text-compare"]')
    const folderCompare = wrapper.find('[data-session-type="folder-compare"]')
    const folderSync = wrapper.find('[data-session-type="folder-sync"]')
    const textMerge = wrapper.find('[data-session-type="text-merge"]')

    await textCompare.trigger('click')

    expect(push).toHaveBeenCalledWith('/compare/text')

    await folderCompare.trigger('click')

    expect(push).toHaveBeenCalledWith('/compare/folder')

    await folderSync.trigger('click')

    expect(push).toHaveBeenCalledWith('/sync/folder')

    await textMerge.trigger('click')

    expect(push).toHaveBeenCalledWith('/merge/text')
  })

  it('shows saved sessions in a dense recent sessions table', () => {
    const wrapper = mountHomeView()

    expect(wrapper.find('[data-testid="home-recent-sessions"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="home-recent-sessions-table"]').exists()).toBe(true)
    expect(wrapper.text()).toContain('Compare sample text')
    expect(wrapper.text()).toContain('Review release folder')
  })

  it('filters recent sessions by search keyword', async () => {
    const wrapper = mountHomeView()

    await wrapper.find('[data-testid="session-search"]').setValue('release')

    expect(wrapper.text()).toContain('Review release folder')
    expect(wrapper.text()).not.toContain('Compare sample text')
  })

  it('applies saved session management actions from the tree', async () => {
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
    const wrapper = mountHomeView()

    await wrapper.find('[data-testid="change-rules-session-sample-text"]').trigger('click')
    await wrapper.find('[data-testid="delete-session-sample-text"]').trigger('click')

    expect(wrapper.find('[data-testid="save-prompt"]').exists()).toBe(true)
    expect(wrapper.text()).toContain('Save changes before closing Compare sample text?')
  })

  it('shows a recovery entry for auto-saved sessions', async () => {
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
})
