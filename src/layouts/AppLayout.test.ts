import { mount, type VueWrapper } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import AppLayout from './AppLayout.vue'
import { createAppI18n, installI18n } from '@/i18n'
import { useSettingsStore } from '@/stores/settings'
import { useStatusBarStore } from '@/stores/statusBar'

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
    const wrapper = mountAppLayout()

    await wrapper.find('[data-testid="open-command-palette"]').trigger('click')
    await wrapper.find('[data-testid="command-search"]').setValue('text')
    await wrapper.find('[data-command-id="open.textCompare"]').trigger('click')

    expect(push).toHaveBeenCalledWith('/compare/text')
  })

  it('opens folder compare from the toolbar', async () => {
    const wrapper = mountAppLayout()

    await wrapper.find('[data-testid="toolbar-command-open.folderCompare"]').trigger('click')

    expect(push).toHaveBeenCalledWith('/compare/folder')
  })

  it('opens settings through the shared top-bar command', async () => {
    const wrapper = mountAppLayout()

    await wrapper.find('[data-testid="top-command-open.settings"]').trigger('click')

    expect(push).toHaveBeenCalledWith('/settings')
  })

  it('executes theme toggle command', async () => {
    const wrapper = mountAppLayout()
    const settings = useSettingsStore()

    expect(settings.theme).toBe('dark')

    await wrapper.find('[data-testid="open-command-palette"]').trigger('click')
    await wrapper.find('[data-testid="command-search"]').setValue('theme')
    await wrapper.find('[data-command-id="theme.toggle"]').trigger('click')

    expect(settings.theme).toBe('light')
  })

  it('renders status bar segments from the shared status protocol', async () => {
    const wrapper = mountAppLayout()
    const statusBar = useStatusBarStore()

    statusBar.reportStatus({
      comparisonStatus: 'Compared',
      differenceCount: 4,
      encoding: 'UTF-8 / LF',
      filterStatus: 'All rows',
      source: 'text-compare',
    })
    await wrapper.vm.$nextTick()

    expect(wrapper.find('[data-testid="status-bar"]').text()).toContain('Compared')
    expect(wrapper.find('[data-testid="status-bar"]').text()).toContain('Differences: 4')
    expect(wrapper.find('[data-testid="status-bar"]').text()).toContain('Encoding: UTF-8 / LF')
    expect(wrapper.find('[data-testid="status-bar"]').text()).toContain('Filter: All rows')
  })
})

function mountAppLayout(): VueWrapper {
  return mount(AppLayout, {
    global: {
      plugins: [
        {
          install(app) {
            installI18n(app, createAppI18n('en-US'))
          },
        },
      ],
      stubs: {
        NButton: {
          props: ['disabled'],
          emits: ['click'],
          template: '<button :disabled="disabled" @click="$emit(\'click\')"><slot /></button>',
        },
      },
    },
  })
}
