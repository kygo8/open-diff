import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import AppLayout from './AppLayout.vue'
import { useSettingsStore } from '@/stores/settings'

const push = vi.fn()

vi.mock('vue-router', () => ({
  RouterView: { template: '<div />' },
  useRouter: () => ({ push }),
}))

describe('AppLayout command palette', () => {
  beforeEach(() => {
    localStorage.clear()
    setActivePinia(createPinia())
    push.mockClear()
  })

  it('searches and executes navigation commands', async () => {
    const wrapper = mount(AppLayout, {
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

    await wrapper.find('[data-testid="open-command-palette"]').trigger('click')
    await wrapper.find('[data-testid="command-search"]').setValue('text')
    await wrapper.find('[data-command-id="open.textCompare"]').trigger('click')

    expect(push).toHaveBeenCalledWith('/compare/text')
  })

  it('opens folder compare from the toolbar', async () => {
    const wrapper = mount(AppLayout, {
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

    await wrapper.find('[data-testid="open-folder-compare"]').trigger('click')

    expect(push).toHaveBeenCalledWith('/compare/folder')
  })

  it('executes theme toggle command', async () => {
    const wrapper = mount(AppLayout, {
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
    const settings = useSettingsStore()

    expect(settings.theme).toBe('dark')

    await wrapper.find('[data-testid="open-command-palette"]').trigger('click')
    await wrapper.find('[data-testid="command-search"]').setValue('theme')
    await wrapper.find('[data-command-id="theme.toggle"]').trigger('click')

    expect(settings.theme).toBe('light')
  })
})
