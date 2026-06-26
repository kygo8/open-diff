import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import HomeView from './HomeView.vue'
import { sessionCatalog } from '@/app/sessionCatalog'

const push = vi.fn()

vi.mock('vue-router', () => ({
  useRouter: () => ({ push }),
}))

describe('HomeView', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    push.mockClear()
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

  it('opens the implemented text compare entry and disables planned entries', async () => {
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

    expect(textCompare.attributes('disabled')).toBeUndefined()
    expect(folderCompare.attributes('disabled')).toBeDefined()

    await textCompare.trigger('click')

    expect(push).toHaveBeenCalledWith('/compare/text')
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
})
