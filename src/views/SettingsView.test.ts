import { mount, type VueWrapper } from '@vue/test-utils'
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
    localStorage.clear()
    setActivePinia(createPinia())
    push.mockClear()
  })

  it('opens the file format management route', async () => {
    const wrapper = mountSettingsView()

    await wrapper.find('[data-testid="open-file-formats"]').trigger('click')

    expect(push).toHaveBeenCalledWith('/settings/file-formats')
  })

  it('opens the remote profile management route', async () => {
    const wrapper = mountSettingsView()

    await wrapper.find('[data-testid="open-remote-profiles"]').trigger('click')

    expect(push).toHaveBeenCalledWith('/settings/remote-profiles')
  })

  it('adds shared session file paths from settings', async () => {
    const wrapper = mountSettingsView()

    await wrapper.find('[data-testid="shared-session-path-input"]').setValue('C:/team/shared.json')
    await wrapper.find('[data-testid="add-shared-session-path"]').trigger('click')

    expect(wrapper.text()).toContain('C:/team/shared.json')
  })

  it('changes the locale from settings', async () => {
    const wrapper = mountSettingsView()
    const settings = useSettingsStore()

    await wrapper.find('[data-testid="locale-select"]').setValue('zh-CN')

    expect(settings.locale).toBe('zh-CN')
  })

  it('searches and customizes command shortcuts from settings', async () => {
    const wrapper = mountSettingsView()
    const settings = useSettingsStore()

    await wrapper.find('[data-testid="shortcut-search"]').setValue('theme')

    expect(wrapper.text()).toContain('Toggle Theme')
    expect(wrapper.text()).not.toContain('Open Text Compare')

    await wrapper.find('[data-testid="shortcut-input-theme.toggle"]').setValue('Ctrl+Shift+L')
    await wrapper.find('[data-testid="save-shortcut-theme.toggle"]').trigger('click')

    expect(settings.shortcutOverrides['theme.toggle']).toEqual({
      keys: ['Ctrl', 'Shift', 'L'],
      scope: 'global',
    })
    expect(wrapper.find('[data-testid="shortcut-current-theme.toggle"]').text()).toBe(
      'Ctrl+Shift+L',
    )
  })

  it('restores customized shortcuts to their defaults', async () => {
    const wrapper = mountSettingsView()
    const settings = useSettingsStore()

    await wrapper.find('[data-testid="shortcut-search"]').setValue('theme')
    await wrapper.find('[data-testid="shortcut-input-theme.toggle"]').setValue('Ctrl+Shift+L')
    await wrapper.find('[data-testid="save-shortcut-theme.toggle"]').trigger('click')
    await wrapper.find('[data-testid="reset-shortcut-theme.toggle"]').trigger('click')

    expect(settings.shortcutOverrides['theme.toggle']).toBeUndefined()
    expect(wrapper.find('[data-testid="shortcut-current-theme.toggle"]').text()).toBe('Ctrl+Alt+L')
  })
})

function mountSettingsView(): VueWrapper {
  return mount(SettingsView, {
    global: {
      stubs: {
        NButton: {
          props: ['disabled'],
          emits: ['click'],
          template: '<button :disabled="disabled" @click="$emit(\'click\')"><slot /></button>',
        },
        NCard: {
          props: ['title'],
          template:
            '<section><h2 v-if="title">{{ title }}</h2><slot name="header" /><slot /></section>',
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
}
