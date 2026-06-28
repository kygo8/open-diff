import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import SettingsView from './SettingsView.vue'

const push = vi.fn()

vi.mock('vue-router', () => ({
  useRouter: () => ({ push }),
}))

describe('SettingsView', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    push.mockClear()
  })

  it('opens the file format management route', async () => {
    const wrapper = mount(SettingsView, {
      global: {
        stubs: {
          NButton: {
            props: ['disabled'],
            emits: ['click'],
            template: '<button :disabled="disabled" @click="$emit(\'click\')"><slot /></button>',
          },
          NCard: {
            template: '<section><slot name="header" /><slot /></section>',
          },
          NSpace: {
            template: '<div><slot /></div>',
          },
          NRadioGroup: {
            template: '<div><slot /></div>',
          },
          NRadioButton: {
            template: '<button><slot /></button>',
          },
        },
      },
    })

    await wrapper.find('[data-testid="open-file-formats"]').trigger('click')

    expect(push).toHaveBeenCalledWith('/settings/file-formats')
  })
})
