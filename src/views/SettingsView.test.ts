import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import SettingsView from './SettingsView.vue'
import { useSettingsStore } from '@/stores/settings'

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

  it('opens the remote profile management route', async () => {
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

    await wrapper.find('[data-testid="open-remote-profiles"]').trigger('click')

    expect(push).toHaveBeenCalledWith('/settings/remote-profiles')
  })

  it('adds shared session file paths from settings', async () => {
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
          NInput: {
            props: ['value'],
            emits: ['update:value'],
            template:
              '<input :value="value" @input="$emit(\'update:value\', $event.target.value)" />',
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

    await wrapper.find('[data-testid="shared-session-path-input"]').setValue('C:/team/shared.json')
    await wrapper.find('[data-testid="add-shared-session-path"]').trigger('click')

    expect(wrapper.text()).toContain('C:/team/shared.json')
  })

  it('changes the locale from settings', async () => {
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
          NInput: {
            props: ['value'],
            emits: ['update:value'],
            template:
              '<input :value="value" @input="$emit(\'update:value\', $event.target.value)" />',
          },
          NSelect: {
            props: ['value', 'options'],
            emits: ['update:value'],
            template:
              '<select :value="value" data-testid="locale-select" @change="$emit(\'update:value\', $event.target.value)"><option v-for="option in options" :key="option.value" :value="option.value">{{ option.label }}</option></select>',
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
    const settings = useSettingsStore()

    await wrapper.find('[data-testid="locale-select"]').setValue('zh-CN')

    expect(settings.locale).toBe('zh-CN')
  })
})
