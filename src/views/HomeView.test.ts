import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import HomeView from './HomeView.vue'
import { readClipboardTextSource } from '@/app/clipboardSource'
import { sessionCatalog } from '@/app/sessionCatalog'
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

describe('HomeView', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    push.mockClear()
    vi.mocked(readClipboardTextSource).mockClear()
  })

  it('renders every session type entry grouped by priority', () => {
    const wrapper = mount(HomeView, {
      global: {
        stubs: {
          NButton: {
            props: ['disabled'],
            template: '<button :disabled="disabled"><slot /></button>',
          },
        },
      },
    })

    expect(wrapper.findAll('[data-testid="session-entry"]')).toHaveLength(sessionCatalog.length)
    expect(wrapper.findAll('[data-testid="session-priority"]')).toHaveLength(4)

    for (const entry of sessionCatalog) {
      expect(wrapper.text()).toContain(entry.title)
    }
  })

  it('opens implemented compare entries and disables planned entries', async () => {
    const wrapper = mount(HomeView, {
      global: {
        stubs: {
          NButton: {
            props: ['disabled'],
            emits: ['click'],
            template: '<button :disabled="disabled" @click="$emit(\'click\')"><slot /></button>',
          },
        },
      },
    })

    const textCompare = wrapper.find('[data-session-type="text-compare"] button')
    const folderCompare = wrapper.find('[data-session-type="folder-compare"] button')
    const folderSync = wrapper.find('[data-session-type="folder-sync"] button')
    const textMerge = wrapper.find('[data-session-type="text-merge"] button')
    const folderMerge = wrapper.find('[data-session-type="folder-merge"] button')
    const tableCompare = wrapper.find('[data-session-type="table-compare"] button')
    const hexCompare = wrapper.find('[data-session-type="hex-compare"] button')
    const pictureCompare = wrapper.find('[data-session-type="picture-compare"] button')
    const registryCompare = wrapper.find('[data-session-type="registry-compare"] button')
    const mediaCompare = wrapper.find('[data-session-type="media-compare"] button')
    const versionCompare = wrapper.find('[data-session-type="version-compare"] button')
    const textEdit = wrapper.find('[data-session-type="text-edit"] button')
    const clipboardCompare = wrapper.find('[data-session-type="clipboard-compare"] button')

    expect(textCompare.attributes('disabled')).toBeUndefined()
    expect(folderCompare.attributes('disabled')).toBeUndefined()
    expect(folderSync.attributes('disabled')).toBeUndefined()
    expect(textMerge.attributes('disabled')).toBeUndefined()
    expect(folderMerge.attributes('disabled')).toBeUndefined()
    expect(tableCompare.attributes('disabled')).toBeUndefined()
    expect(hexCompare.attributes('disabled')).toBeUndefined()
    expect(pictureCompare.attributes('disabled')).toBeUndefined()
    expect(registryCompare.attributes('disabled')).toBeUndefined()
    expect(mediaCompare.attributes('disabled')).toBeUndefined()
    expect(versionCompare.attributes('disabled')).toBeUndefined()
    expect(textEdit.attributes('disabled')).toBeUndefined()
    expect(clipboardCompare.attributes('disabled')).toBeUndefined()

    await textCompare.trigger('click')

    expect(push).toHaveBeenCalledWith('/compare/text')

    await folderCompare.trigger('click')

    expect(push).toHaveBeenCalledWith('/compare/folder')

    await folderSync.trigger('click')

    expect(push).toHaveBeenCalledWith('/sync/folder')

    await textMerge.trigger('click')

    expect(push).toHaveBeenCalledWith('/merge/text')

    await folderMerge.trigger('click')

    expect(push).toHaveBeenCalledWith('/merge/folder')

    await tableCompare.trigger('click')

    expect(push).toHaveBeenCalledWith('/compare/table')

    await hexCompare.trigger('click')

    expect(push).toHaveBeenCalledWith('/compare/hex')

    await pictureCompare.trigger('click')

    expect(push).toHaveBeenCalledWith('/compare/picture')

    await registryCompare.trigger('click')

    expect(push).toHaveBeenCalledWith('/compare/registry')

    await mediaCompare.trigger('click')

    expect(push).toHaveBeenCalledWith('/compare/media')

    await versionCompare.trigger('click')

    expect(push).toHaveBeenCalledWith('/compare/version')

    await textEdit.trigger('click')

    expect(push).toHaveBeenCalledWith('/edit/text')

    await clipboardCompare.trigger('click')

    expect(push).toHaveBeenCalledWith('/compare/clipboard')
  })

  it('shows saved sessions grouped by folder', () => {
    const wrapper = mount(HomeView, {
      global: {
        stubs: {
          NButton: {
            props: ['disabled'],
            template: '<button :disabled="disabled"><slot /></button>',
          },
        },
      },
    })

    expect(wrapper.find('[data-testid="saved-sessions"]').exists()).toBe(true)
    expect(wrapper.text()).toContain('Saved Sessions')
    expect(wrapper.text()).toContain('Work')
    expect(wrapper.text()).toContain('Compare sample text')
  })

  it('filters saved sessions by search keyword and session type', async () => {
    const wrapper = mount(HomeView, {
      global: {
        stubs: {
          NButton: {
            props: ['disabled'],
            template: '<button :disabled="disabled"><slot /></button>',
          },
        },
      },
    })

    await wrapper.find('[data-testid="session-search"]').setValue('release')

    expect(wrapper.text()).toContain('Review release folder')
    expect(wrapper.text()).not.toContain('Compare sample text')

    await wrapper.find('[data-testid="type-filter-text-compare"]').setValue(true)

    expect(wrapper.text()).not.toContain('Review release folder')
  })

  it('applies saved session management actions from the tree', async () => {
    const wrapper = mount(HomeView, {
      global: {
        stubs: {
          NButton: {
            props: ['disabled'],
            emits: ['click'],
            template: '<button :disabled="disabled" @click="$emit(\'click\')"><slot /></button>',
          },
        },
      },
    })

    await wrapper.find('[data-testid="rename-session-sample-text"]').trigger('click')
    expect(wrapper.text()).toContain('Compare sample text Renamed')

    await wrapper.find('[data-testid="copy-session-sample-text"]').trigger('click')
    expect(wrapper.text()).toContain('Compare sample text Renamed Copy')

    await wrapper.find('[data-testid="move-session-sample-text"]').trigger('click')
    expect(wrapper.text()).toContain('Archive')

    await wrapper.find('[data-testid="delete-session-sample-text"]').trigger('click')
    expect(wrapper.find('[data-testid="delete-session-sample-text"]').exists()).toBe(false)
    expect(wrapper.text()).toContain('Compare sample text Renamed Copy')
  })

  it('disables overwrite actions for locked sessions', () => {
    const wrapper = mount(HomeView, {
      global: {
        stubs: {
          NButton: {
            props: ['disabled'],
            template: '<button :disabled="disabled"><slot /></button>',
          },
        },
      },
    })

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
    const wrapper = mount(HomeView, {
      global: {
        stubs: {
          NButton: {
            props: ['disabled'],
            emits: ['click'],
            template: '<button :disabled="disabled" @click="$emit(\'click\')"><slot /></button>',
          },
        },
      },
    })

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

    const wrapper = mount(HomeView, {
      global: {
        stubs: {
          NButton: {
            props: ['disabled'],
            emits: ['click'],
            template: '<button :disabled="disabled" @click="$emit(\'click\')"><slot /></button>',
          },
        },
      },
    })

    expect(wrapper.find('[data-testid="recovery-entry"]').exists()).toBe(true)
    expect(wrapper.text()).toContain('Recovered text')

    await wrapper.find('[data-testid="restore-recovery"]').trigger('click')

    expect(wrapper.find('[data-testid="recovery-entry"]').exists()).toBe(false)
    expect(wrapper.text()).toContain('Recovered text')
    expect(push).toHaveBeenCalledWith('/compare/text')
  })

  it('opens text compare from clipboard text', async () => {
    const wrapper = mount(HomeView, {
      global: {
        stubs: {
          NButton: {
            props: ['disabled'],
            emits: ['click'],
            template: '<button :disabled="disabled" @click="$emit(\'click\')"><slot /></button>',
          },
        },
      },
    })

    await wrapper.find('[data-testid="open-clipboard-text"]').trigger('click')

    expect(readClipboardTextSource).toHaveBeenCalled()
    expect(push).toHaveBeenCalledWith('/compare/text')
    expect(wrapper.text()).toContain('Clipboard Text ready')
  })
})
