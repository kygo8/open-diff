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
})
