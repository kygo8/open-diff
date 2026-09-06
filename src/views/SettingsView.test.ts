import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import SettingsView from './SettingsView.vue'
import { useSettingsStore } from '@/stores/settings'
import { useSavedSessionsStore } from '@/stores/savedSessions'
import { serializeSessionPackage } from '@/app/sessionFile'
import { sampleSavedSessions } from '@/app/savedSessions'
import { writeGitIntegration, writeSvnIntegration } from '@/api/integration'

const push = vi.fn()

vi.mock('vue-router', () => ({
  useRouter: () => ({ push }),
}))

vi.mock('@/api/integration', () => ({
  writeGitIntegration: vi.fn().mockResolvedValue('wrote git'),
  writeSvnIntegration: vi.fn().mockResolvedValue('wrote svn'),
  registerWindowsShellExtension: vi.fn().mockResolvedValue({
    windows: false,
    applied: false,
    script: '',
    message: 'Windows only',
  }),
  unregisterWindowsShellExtension: vi.fn().mockResolvedValue({
    windows: false,
    applied: false,
    script: '',
    message: 'Windows only',
  }),
  registerUnixShellIntegration: vi.fn().mockResolvedValue({
    windows: false,
    applied: true,
    script: '',
    message: 'unix ok',
  }),
  unregisterUnixShellIntegration: vi.fn().mockResolvedValue({
    windows: false,
    applied: true,
    script: '',
    message: 'unix ok',
  }),
}))

describe('SettingsView', () => {
  beforeEach(() => {
    localStorage.clear()
    setActivePinia(createPinia())
    push.mockClear()
    vi.mocked(writeGitIntegration).mockClear()
    vi.mocked(writeSvnIntegration).mockClear()
    vi.spyOn(window, 'confirm').mockReturnValue(true)
  })

  it('switches options sections and persists the auto-save limit', async () => {
    const wrapper = mountSettingsView()
    const settings = useSettingsStore()

    expect(wrapper.find('[data-testid="options-appearance-card"]').isVisible()).toBe(true)

    await wrapper.find('[data-testid="options-section-formats"]').trigger('click')

    expect(wrapper.find('[data-testid="options-formats-card"]').isVisible()).toBe(true)

    await wrapper.find('[data-testid="options-section-appearance"]').trigger('click')
    await wrapper.find('[data-testid="auto-save-limit"]').setValue('18')

    expect(settings.autoSaveLimit).toBe(18)
    expect(localStorage.getItem('open-diff-auto-save-limit')).toBe('18')
  })

  it('opens the file format management route', async () => {
    const wrapper = mountSettingsView()

    await wrapper.find('[data-testid="options-section-formats"]').trigger('click')
    await wrapper.find('[data-testid="open-file-formats"]').trigger('click')

    expect(push).toHaveBeenCalledWith('/settings/file-formats')
  })

  it('opens the remote profile management route', async () => {
    const wrapper = mountSettingsView()

    await wrapper.find('[data-testid="options-section-formats"]').trigger('click')
    await wrapper.find('[data-testid="open-remote-profiles"]').trigger('click')

    expect(push).toHaveBeenCalledWith('/settings/remote-profiles')
  })

  it('adds shared session file paths from settings', async () => {
    const wrapper = mountSettingsView()

    await wrapper.find('[data-testid="options-section-sessions"]').trigger('click')
    await wrapper.find('[data-testid="shared-session-path-input"]').setValue('C:/team/shared.json')
    await wrapper.find('[data-testid="add-shared-session-path"]').trigger('click')

    expect(wrapper.text()).toContain('C:/team/shared.json')
  })

  it('imports shared session JSON as read-only saved sessions', async () => {
    const wrapper = mountSettingsView()
    const savedSessions = useSavedSessionsStore()
    const sample = sampleSavedSessions[0]

    await wrapper.find('[data-testid="options-section-sessions"]').trigger('click')
    await wrapper
      .find('[data-testid="shared-session-json-input"]')
      .setValue(serializeSessionPackage([sample]))
    await wrapper.find('[data-testid="load-shared-session-json"]').trigger('click')

    const imported = savedSessions.sessions.find(
      (session) => session.name === sample.name && session.metadata.shared,
    )

    expect(imported?.metadata.locked).toBe(true)
    expect(imported?.locations.left?.readOnly).toBe(true)
  })

  it('writes git and svn integration config after confirm', async () => {
    const wrapper = mountSettingsView()

    await wrapper.find('[data-testid="options-section-integration"]').trigger('click')
    await wrapper.find('[data-testid="integration-executable-path"]').setValue('/usr/bin/open-diff')
    await wrapper.find('[data-testid="git-kind"]').setValue('difftool')
    await wrapper.find('[data-testid="write-git-config"]').trigger('click')
    await flushPromises()

    expect(writeGitIntegration).toHaveBeenCalledWith('difftool', '/usr/bin/open-diff', 'global')
    expect(wrapper.find('[data-testid="integration-status"]').text()).toContain('difftool')

    await wrapper.find('[data-testid="svn-wrapper-path"]').setValue('/tmp/open-diff-svn.sh')
    await wrapper.find('[data-testid="write-svn-config"]').trigger('click')
    await flushPromises()

    expect(writeSvnIntegration).toHaveBeenCalledWith('/usr/bin/open-diff', '/tmp/open-diff-svn.sh')
    expect(wrapper.find('[data-testid="integration-status"]').text()).toContain('SVN')
  })

  it('applies follow-system theme without inventing a command success', async () => {
    const wrapper = mountSettingsView()
    const settings = useSettingsStore()

    await wrapper.find('[data-testid="theme-follow-system"]').trigger('click')

    expect(settings.theme).toBe('system')
    expect(document.documentElement.dataset.theme).toMatch(/^(light|dark)$/)
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

    await wrapper.find('[data-testid="options-section-shortcuts"]').trigger('click')
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

    await wrapper.find('[data-testid="options-section-shortcuts"]').trigger('click')
    await wrapper.find('[data-testid="shortcut-search"]').setValue('theme')
    await wrapper.find('[data-testid="shortcut-input-theme.toggle"]').setValue('Ctrl+Shift+L')
    await wrapper.find('[data-testid="save-shortcut-theme.toggle"]').trigger('click')
    await wrapper.find('[data-testid="reset-shortcut-theme.toggle"]').trigger('click')

    expect(settings.shortcutOverrides['theme.toggle']).toBeUndefined()
    expect(wrapper.find('[data-testid="shortcut-current-theme.toggle"]').text()).toBe('Ctrl+Alt+L')
  })

  it('updates font family and size from appearance options', async () => {
    const wrapper = mountSettingsView()
    const settings = useSettingsStore()

    await wrapper.find('[data-testid="font-family-select"]').setValue('mono')
    await wrapper.find('[data-testid="font-size-input"]').setValue('16')

    expect(settings.fontFamily).toBe('mono')
    expect(settings.fontSize).toBe(16)
    expect(document.documentElement.style.getPropertyValue('--app-font-size')).toBe('16px')
  })

  it('edits and resets persisted diff highlight colors', async () => {
    const wrapper = mountSettingsView()
    const settings = useSettingsStore()

    await wrapper.find('[data-testid="options-section-colors"]').trigger('click')
    expect(wrapper.find('[data-testid="options-colors-card"]').isVisible()).toBe(true)

    await wrapper.find('[data-testid="diff-color-text-addedBg"]').setValue('#abcdef')
    await wrapper.find('[data-testid="diff-color-text-addedBg"]').trigger('change')

    expect(settings.diffColors.addedBg).toBe('#abcdef')
    expect(document.documentElement.style.getPropertyValue('--diff-added-bg')).toBe('#abcdef')

    await wrapper.find('[data-testid="reset-diff-colors"]').trigger('click')
    expect(settings.diffColors.addedBg).toBe('#f4fff4')
  })

  it('persists tweaks for confirm-before-delete and wrap-text default', async () => {
    const wrapper = mountSettingsView()
    const settings = useSettingsStore()

    await wrapper.find('[data-testid="options-section-tweaks"]').trigger('click')
    expect(wrapper.find('[data-testid="options-tweaks-card"]').isVisible()).toBe(true)

    const confirm = wrapper.find('[data-testid="confirm-before-delete"]')
    const wrap = wrapper.find('[data-testid="wrap-text-default"]')

    await confirm.setValue(false)
    await wrap.setValue(true)

    expect(settings.confirmBeforeDelete).toBe(false)
    expect(settings.wrapTextDefault).toBe(true)
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
            '<select :value="value" @change="$emit(\'update:value\', $event.target.value)"><option v-for="option in options" :key="option.value" :value="option.value">{{ option.label }}</option></select>',
        },
        NSpace: {
          template: '<div><slot /></div>',
        },
        NRadioGroup: {
          props: ['value'],
          emits: ['update:value'],
          template: '<div class="n-radio-group"><slot /></div>',
        },
        NRadioButton: {
          props: ['value'],
          template:
            '<button type="button" @click="$parent.$emit(\'update:value\', value)"><slot /></button>',
        },
      },
    },
  })
}
