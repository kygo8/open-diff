import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { mount, type VueWrapper } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import AppLayout from './AppLayout.vue'
import { createAppI18n, installI18n } from '@/i18n'
import { useSettingsStore } from '@/stores/settings'
import { useTabsStore } from '@/stores/tabs'
import { useStatusBarStore } from '@/stores/statusBar'
import { useSessionLaunchStore } from '@/stores/sessionLaunch'

const push = vi.fn()
let routePath = '/compare/text'

vi.mock('vue-router', () => ({
  RouterView: { template: '<div />' },
  useRoute: () => ({
    get path() {
      return routePath
    },
  }),
  useRouter: () => ({ push }),
}))

const desktopDropHandlers: ((paths: string[]) => void | Promise<void>)[] = []

vi.mock('@/api/integration', () => ({
  takeShellCompareLaunch: vi.fn().mockResolvedValue(null),
  openPathExternal: vi.fn().mockResolvedValue({ path: 'https://example.com', launched: true }),
}))

vi.mock('@/app/desktopDrop', () => ({
  listenDesktopPathDrop: vi.fn(
    (onPaths: (paths: string[]) => void | Promise<void>, _onPhase?: unknown) => {
      desktopDropHandlers.push(onPaths)

      return Promise.resolve(() => undefined)
    },
  ),
  resolveDropInputsFromPaths: vi.fn((paths: string[]) =>
    Promise.resolve(
      paths.map((path) => ({
        path,
        kind: path.includes('.') && !path.endsWith('/') ? 'file' : 'directory',
      })),
    ),
  ),
}))

describe('AppLayout command palette', () => {
  beforeEach(() => {
    localStorage.clear()
    setActivePinia(createPinia())
    routePath = '/compare/text'
    push.mockClear()
    desktopDropHandlers.length = 0
  })

  it('shows Session View Tools Help menus on Home', async () => {
    routePath = '/'
    const wrapper = mountAppLayout()

    expect(wrapper.find('[data-testid="menu-session"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="menu-view"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="menu-tools"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="menu-help"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="menu-file"]').exists()).toBe(false)
    expect(wrapper.find('[data-testid="menu-actions"]').exists()).toBe(false)

    await wrapper.find('[data-testid="menu-help"]').trigger('click')
    expect(wrapper.find('[data-testid="menu-command-help.about"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="menu-command-help.checkForUpdates"]').exists()).toBe(true)
    expect(
      wrapper.find('[data-testid="menu-command-help.contents"]').attributes('disabled'),
    ).toBeUndefined()
    expect(wrapper.find('[data-testid="menu-command-help.support"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="menu-panel"]').text()).not.toContain('unimplemented')
    expect(wrapper.find('[data-testid="menu-panel"]').text()).not.toContain('未实现')

    await wrapper.find('[data-testid="menu-session"]').trigger('click')
    expect(
      wrapper.find('[data-testid="menu-command-session.newWindow"]').attributes('disabled'),
    ).toBeUndefined()
    expect(wrapper.find('[data-testid="menu-command-session.newTab"]').exists()).toBe(true)
  })

  it('enables Session compare/swap/reload/rules and Tools settings actions', async () => {
    routePath = '/compare/folder'
    const wrapper = mountAppLayout()

    await wrapper.find('[data-testid="menu-session"]').trigger('click')
    expect(
      wrapper.find('[data-testid="menu-command-session.compare"]').attributes('disabled'),
    ).toBeUndefined()
    expect(
      wrapper.find('[data-testid="menu-command-session.swap"]').attributes('disabled'),
    ).toBeUndefined()
    expect(
      wrapper.find('[data-testid="menu-command-session.reload"]').attributes('disabled'),
    ).toBeUndefined()
    expect(
      wrapper.find('[data-testid="menu-command-session.rules"]').attributes('disabled'),
    ).toBeUndefined()
    expect(
      wrapper.find('[data-testid="menu-command-session.export"]').attributes('disabled'),
    ).toBeUndefined()
    expect(
      wrapper.find('[data-testid="menu-command-session.loadWorkspace"]').attributes('disabled'),
    ).toBeUndefined()
    expect(
      wrapper.find('[data-testid="menu-command-session.newWindow"]').attributes('disabled'),
    ).toBeUndefined()
    expect(
      wrapper.find('[data-testid="menu-command-session.exit"]').attributes('disabled'),
    ).toBeUndefined()

    await wrapper.find('[data-testid="menu-view"]').trigger('click')
    expect(
      wrapper.find('[data-testid="menu-command-view.filters"]').attributes('disabled'),
    ).toBeUndefined()

    await wrapper.find('[data-testid="menu-tools"]').trigger('click')
    expect(
      wrapper.find('[data-testid="menu-command-tools.exportSettings"]').attributes('disabled'),
    ).toBeUndefined()
    expect(
      wrapper.find('[data-testid="menu-command-tools.importSettings"]').attributes('disabled'),
    ).toBeUndefined()
    expect(
      wrapper
        .find('[data-testid="menu-command-tools.restoreFactoryDefaults"]')
        .attributes('disabled'),
    ).toBeUndefined()
    expect(
      wrapper.find('[data-testid="menu-command-tools.saveSnapshot"]').attributes('disabled'),
    ).toBeUndefined()
  })

  it('dispatches Session swap from the Actions menu on Folder Compare', async () => {
    routePath = '/compare/folder'
    const wrapper = mountAppLayout()

    await wrapper.find('[data-testid="menu-actions"]').trigger('click')
    await wrapper.find('[data-testid="menu-command-session.swap"]').trigger('click')

    expect(wrapper.find('[data-testid="last-view-action"]').text()).toContain('swap')
  })

  it('opens the About dialog from Help', async () => {
    routePath = '/'
    const wrapper = mountAppLayout()

    await wrapper.find('[data-testid="menu-help"]').trigger('click')
    await wrapper.find('[data-testid="menu-command-help.about"]').trigger('click')

    expect(wrapper.find('[data-testid="about-dialog"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="about-dialog"]').text()).toContain('About Open Diff')
    expect(wrapper.find('[data-testid="about-dialog"]').text()).toContain('1.1.2')
  })

  it('shows Session Actions Edit Search View Tools Help on Folder Compare', () => {
    routePath = '/compare/folder'
    const wrapper = mountAppLayout()
    const menuOrder = [
      'menu-session',
      'menu-actions',
      'menu-edit',
      'menu-search',
      'menu-view',
      'menu-tools',
      'menu-help',
    ]

    expect(
      wrapper
        .findAll('.menus > .menu-group > button')
        .map((node) => node.attributes('data-testid')),
    ).toEqual(menuOrder)
    expect(wrapper.find('[data-testid="menu-file"]').exists()).toBe(false)
  })

  it('shows Session File Edit View Tools Help on Picture Compare without Search', () => {
    routePath = '/compare/picture'
    const wrapper = mountAppLayout()

    expect(wrapper.find('[data-testid="menu-session"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="menu-file"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="menu-edit"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="menu-search"]').exists()).toBe(false)
    expect(wrapper.find('[data-testid="menu-view"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="menu-tools"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="menu-help"]').exists()).toBe(true)
  })

  it('shows Session File Edit Search View Tools Help on Text Compare', () => {
    routePath = '/compare/text'
    const wrapper = mountAppLayout()

    expect(wrapper.find('[data-testid="menu-session"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="menu-file"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="menu-edit"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="menu-search"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="menu-view"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="menu-tools"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="menu-help"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="menu-actions"]').exists()).toBe(false)
  })

  it('formats window title with path pair when the active tab has known paths', async () => {
    routePath = '/compare/text'
    const wrapper = mountAppLayout()
    const tabs = useTabsStore()

    tabs.openTab({
      title: 'Text Compare',
      titleKey: 'ui.textCompare',
      route: '/compare/text',
      dirty: false,
    })
    tabs.setTabTitle('/compare/text', 'left.txt <--> right.txt')
    await wrapper.vm.$nextTick()

    expect(wrapper.find('.brand').text()).toContain('left.txt <--> right.txt - Text Compare')
    expect(document.title).toContain('left.txt <--> right.txt - Text Compare')
  })

  it('does not show hardcoded fake session counts in the chrome', () => {
    const wrapper = mountAppLayout()

    expect(wrapper.html()).not.toContain('<b>142</b>')
    expect(wrapper.html()).not.toContain('<b>34</b>')
    expect(wrapper.html()).not.toContain('>5</b>')
  })

  it('searches and executes navigation commands', async () => {
    const wrapper = mountAppLayout()

    await wrapper.find('[data-testid="open-command-palette"]').trigger('click')
    await wrapper.find('[data-testid="command-search"]').setValue('text')
    await wrapper.find('[data-command-id="open.textCompare"]').trigger('click')

    expect(push).toHaveBeenCalledWith('/compare/text')
  })

  it('renders only global chrome outside routed workbench content', () => {
    const wrapper = mountAppLayout()

    expect(wrapper.find('.menu-bar').exists()).toBe(true)
    expect(wrapper.find('.sidebar').exists()).toBe(true)
    expect(wrapper.find('.status-bar').exists()).toBe(true)
    expect(wrapper.find('.command-bar').exists()).toBe(false)
    expect(wrapper.find('.pathbar').exists()).toBe(false)
    expect(wrapper.find('.page-head').exists()).toBe(false)
    expect(wrapper.find('.inspector').exists()).toBe(false)
  })

  it('hides the status bar when Appearance disables it', () => {
    const settings = useSettingsStore()

    settings.setShowStatusBar(false)

    const wrapper = mountAppLayout()

    expect(wrapper.find('[data-testid="status-bar"]').exists()).toBe(false)
  })

  it('opens folder compare from the side navigation', async () => {
    const wrapper = mountAppLayout()

    await wrapper
      .findAll('.nav-item')
      .find((item) => item.text().includes('Folder Compare'))
      ?.trigger('click')

    expect(push).toHaveBeenCalledWith('/compare/folder')
  })

  it('opens settings through the shared top-bar command', async () => {
    const wrapper = mountAppLayout()

    await wrapper.find('[data-testid="top-command-open.settings"]').trigger('click')

    expect(push).toHaveBeenCalledWith('/settings')
  })

  it('executes menu and toolbar commands through the shared command system', async () => {
    const wrapper = mountAppLayout()

    await wrapper.find('[data-testid="menu-file"]').trigger('click')

    expect(wrapper.find('[data-testid="menu-panel"]').exists()).toBe(true)

    await wrapper.find('[data-testid="menu-command-open.textPatch"]').trigger('click')

    expect(push).toHaveBeenCalledWith('/patch/text')

    await wrapper.find('[data-testid="toolbar-command-session.save"]').trigger('click')

    expect(wrapper.find('[data-testid="last-view-action"]').text()).toContain('save')

    await wrapper.find('[data-testid="toolbar-command-edit.copyRight"]').trigger('click')

    expect(wrapper.find('[data-testid="last-view-action"]').text()).toContain('copy-right')

    await wrapper.find('[data-testid="view-show-differences"]').trigger('click')

    expect(wrapper.find('[data-testid="last-view-action"]').text()).toContain('show-differences')
  })

  it('shows the commands that belong to the selected application menu', async () => {
    const wrapper = mountAppLayout()

    await wrapper.find('[data-testid="menu-file"]').trigger('click')

    expect(
      wrapper.find('[data-testid="menu-file-group"] [data-testid="menu-panel"]').exists(),
    ).toBe(true)
    expect(wrapper.find('[data-testid="menu-command-open.textCompare"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="menu-command-edit.copyLeft"]').exists()).toBe(false)

    await wrapper.find('[data-testid="menu-edit"]').trigger('click')

    expect(
      wrapper.find('[data-testid="menu-edit-group"] [data-testid="menu-panel"]').exists(),
    ).toBe(true)
    expect(wrapper.find('[data-testid="menu-command-edit.copyLeft"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="menu-command-edit.undo"]').exists()).toBe(true)
    expect(
      wrapper.find('[data-testid="menu-command-edit.paste"]').attributes('disabled'),
    ).toBeUndefined()
    expect(wrapper.find('[data-testid="menu-command-open.textCompare"]').exists()).toBe(false)

    await wrapper.find('[data-testid="menu-view"]').trigger('click')

    expect(
      wrapper.find('[data-testid="menu-view-group"] [data-testid="menu-panel"]').exists(),
    ).toBe(true)
    expect(wrapper.find('[data-testid="menu-command-view.showDifferences"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="menu-command-edit.copyLeft"]').exists()).toBe(false)
  })

  it('closes an open application menu with Escape', async () => {
    const wrapper = mountAppLayout()

    await wrapper.find('[data-testid="menu-file"]').trigger('click')
    expect(wrapper.find('[data-testid="menu-panel"]').exists()).toBe(true)

    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))
    await wrapper.vm.$nextTick()

    expect(wrapper.find('[data-testid="menu-panel"]').exists()).toBe(false)
  })

  it('dispatches rebound session compare shortcuts from the chrome keydown handler', async () => {
    routePath = '/compare/folder'
    const wrapper = mountAppLayout()
    const settings = useSettingsStore()
    const viewActions = (await import('@/stores/viewActions')).useViewActionsStore()

    expect(
      settings.setShortcutOverride('session.compare', {
        keys: ['F8'],
        scope: 'global',
      }),
    ).toBe(true)

    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'F8' }))
    await wrapper.vm.$nextTick()

    expect(viewActions.name).toBe('compare')
    wrapper.unmount()
  })

  it('honors text-compare scoped next-difference shortcuts on text routes', async () => {
    routePath = '/compare/text'
    const wrapper = mountAppLayout()
    const viewActions = (await import('@/stores/viewActions')).useViewActionsStore()

    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'F7' }))
    await wrapper.vm.$nextTick()

    expect(viewActions.name).toBe('next-difference')
    wrapper.unmount()
  })

  it('exposes clickable menus with aria-haspopup on Home', async () => {
    routePath = '/'
    const wrapper = mountAppLayout()

    expect(wrapper.find('[data-testid="menu-session"]').attributes('aria-haspopup')).toBe('menu')
    await wrapper.find('[data-testid="menu-session"]').trigger('click')
    expect(wrapper.find('[data-testid="menu-panel"]').attributes('role')).toBe('menu')
    expect(wrapper.find('[data-testid="menu-command-open.textCompare"]').exists()).toBe(true)
  })

  it('closes an open application menu when clicking outside it', async () => {
    const wrapper = mountAppLayout()

    await wrapper.find('[data-testid="menu-file"]').trigger('click')

    expect(wrapper.find('[data-testid="menu-panel"]').exists()).toBe(true)

    await wrapper.find('.desktop').trigger('click')

    expect(wrapper.find('[data-testid="menu-panel"]').exists()).toBe(false)
  })

  it('prompts before closing a dirty tab and closes after confirmation', async () => {
    const wrapper = mountAppLayout()

    await wrapper.find('[data-testid="open-command-palette"]').trigger('click')
    await wrapper.find('[data-testid="command-search"]').setValue('text')
    await wrapper.find('[data-command-id="open.textCompare"]').trigger('click')

    const closeButton = wrapper
      .findAll('button')
      .find((button) => button.attributes('data-testid')?.startsWith('close-tab-'))

    if (!closeButton) {
      throw new Error('Expected close tab button.')
    }

    await wrapper.find('[data-testid="toolbar-command-session.save"]').trigger('click')
    await closeButton.trigger('click')

    expect(wrapper.find('[data-testid="close-dirty-tab-prompt"]').exists()).toBe(true)

    await wrapper.find('[data-testid="confirm-close-dirty-tab"]').trigger('click')

    expect(wrapper.find('[data-testid="close-dirty-tab-prompt"]').exists()).toBe(false)
  })

  it('executes theme toggle command', async () => {
    const wrapper = mountAppLayout()
    const settings = useSettingsStore()

    expect(settings.theme).toBe('light')

    await wrapper.find('[data-testid="open-command-palette"]').trigger('click')
    await wrapper.find('[data-testid="command-search"]').setValue('theme')
    await wrapper.find('[data-command-id="theme.toggle"]').trigger('click')

    expect(settings.theme).toBe('dark')
  })

  it('opens a language menu and applies the selected locale', async () => {
    const wrapper = mountAppLayout()
    const settings = useSettingsStore()

    await wrapper.find('[data-testid="language-menu-trigger"]').trigger('click')

    expect(wrapper.find('[data-testid="language-menu"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="language-menu"]').text()).not.toContain('zh-CN')

    await wrapper.find('[data-testid="language-option-zh-CN"]').trigger('click')

    expect(settings.locale).toBe('zh-CN')
    expect(wrapper.find('[data-testid="language-menu"]').exists()).toBe(false)
    expect(wrapper.text()).toContain('文件')
  })

  it('localizes side navigation and existing tab titles when the locale changes', async () => {
    const wrapper = mountAppLayout()

    await wrapper.find('[data-testid="menu-file"]').trigger('click')
    await wrapper.find('[data-testid="menu-command-open.textCompare"]').trigger('click')

    expect(wrapper.find('[data-testid="tab-strip"]').text()).toContain('Text Compare')
    expect(wrapper.find('.session-nav').text()).toContain('Folder Compare')

    await wrapper.find('[data-testid="language-menu-trigger"]').trigger('click')
    await wrapper.find('[data-testid="language-option-zh-CN"]').trigger('click')

    expect(wrapper.find('[data-testid="tab-strip"]').text()).toContain('文本比较')
    expect(wrapper.find('[data-testid="tab-strip"]').text()).not.toContain('Text Compare')
    expect(wrapper.find('.session-nav').text()).toContain('文件夹比较')
    expect(wrapper.find('.session-nav').text()).not.toContain('Folder Compare')
    expect(wrapper.find('[data-testid="status-bar"]').text()).toContain('就绪')
    expect(wrapper.find('[data-testid="status-bar"]').text()).toContain('差异: -')
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

  it('launches a compare session from a global desktop path drop', async () => {
    mountAppLayout()
    const launchStore = useSessionLaunchStore()

    expect(desktopDropHandlers).toHaveLength(1)

    await desktopDropHandlers[0]?.(['C:/work/left.txt', 'C:/work/right.txt'])

    expect(push).toHaveBeenCalledWith('/compare/text')
    expect(launchStore.pendingLaunch).toMatchObject({
      source: 'drop',
      sessionType: 'text-compare',
      route: '/compare/text',
      autoRun: true,
      locations: {
        left: { uri: 'C:/work/left.txt', kind: 'file' },
        right: { uri: 'C:/work/right.txt', kind: 'file' },
      },
    })
  })

  it('reports invalid desktop drops on the status bar without navigating', async () => {
    mountAppLayout()
    const statusBar = useStatusBarStore()
    const launchStore = useSessionLaunchStore()

    await desktopDropHandlers[0]?.(['C:/work/only.txt'])

    expect(push).not.toHaveBeenCalled()
    expect(launchStore.pendingLaunch).toBeUndefined()
    expect(statusBar.report.comparisonStatus).toBe('Drop exactly two files or folders.')
    expect(statusBar.report.source).toBe('drop')
  })

  it('does not clip application menus with overflow-y hidden on .menus', () => {
    const source = readFileSync(
      resolve(dirname(fileURLToPath(import.meta.url)), './AppLayout.vue'),
      'utf8',
    )
    const menusBlock = /\.menus\s*\{[^}]+\}/.exec(source)

    expect(menusBlock?.[0]).toBeTruthy()

    expect(menusBlock?.[0]).toContain('overflow: visible')
    expect(menusBlock?.[0]).not.toContain('overflow: auto hidden')
  })

  it('shows tab context menu actions and closes others', async () => {
    const wrapper = mountAppLayout()
    const tabs = useTabsStore()

    tabs.openTab({ title: 'Text', route: '/compare/text', dirty: false })
    tabs.openTab({ title: 'Folder', route: '/compare/folder', dirty: false })
    await wrapper.vm.$nextTick()
    const folderId = tabs.activeTabId

    await wrapper.find(`[data-testid="tab-chip-${folderId}"]`).trigger('contextmenu')
    expect(wrapper.find('[data-testid="tab-context-menu"]').exists()).toBe(true)
    expect(
      wrapper.find('[data-testid="tab-ctx-close-others"]').attributes('disabled'),
    ).toBeUndefined()

    await wrapper.find('[data-testid="tab-ctx-close-others"]').trigger('click')
    expect(tabs.tabs.map((tab) => tab.route)).toEqual(['/', '/compare/folder'])
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
