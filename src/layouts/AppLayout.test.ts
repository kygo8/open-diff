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
import { useFolderPathNavStore } from '@/stores/folderPathNav'
import { useFolderMenuSelectionStore } from '@/stores/folderMenuSelection'
import { useSessionLaunchStore } from '@/stores/sessionLaunch'

const push = vi.fn()
let routePath = '/compare/text'

vi.mock('@/api/diff', () => ({
  setArchiveExtensions: vi.fn().mockResolvedValue([]),
}))

vi.mock('vue-router', () => ({
  RouterView: { template: '<div />' },
  useRoute: () => ({
    get path() {
      return routePath
    },
    get fullPath() {
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
    expect(wrapper.find('[data-testid="menu-command-help.contextHelp"]').exists()).toBe(true)
    expect(
      wrapper.find('[data-testid="menu-command-help.contextHelp"]').attributes('disabled'),
    ).toBeUndefined()
    expect(wrapper.find('[data-testid="menu-panel"]').text()).not.toContain('unimplemented')
    expect(wrapper.find('[data-testid="menu-panel"]').text()).not.toContain('未实现')

    await wrapper.find('[data-testid="menu-session"]').trigger('click')
    expect(
      wrapper.find('[data-testid="menu-command-session.newWindow"]').attributes('disabled'),
    ).toBeUndefined()
    expect(wrapper.find('[data-testid="menu-command-session.newTab"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="menu-command-open.folderMerge"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="menu-command-open.hexCompare"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="menu-command-open.tableCompare"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="menu-command-open.archiveCompare"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="menu-command-open.textEdit"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="menu-command-open.textPatch"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="menu-command-open.clipboardCompare"]').exists()).toBe(true)
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

  it('dispatches Session Compare and Swap from the Session menu on Clipboard Compare', async () => {
    routePath = '/compare/clipboard'
    const wrapper = mountAppLayout()

    await wrapper.find('[data-testid="menu-session"]').trigger('click')
    expect(
      wrapper.find('[data-testid="menu-command-session.compare"]').attributes('disabled'),
    ).toBeUndefined()
    expect(
      wrapper.find('[data-testid="menu-command-session.swap"]').attributes('disabled'),
    ).toBeUndefined()

    await wrapper.find('[data-testid="menu-command-session.compare"]').trigger('click')
    expect(wrapper.find('[data-testid="last-view-action"]').text()).toContain('compare')

    await wrapper.find('[data-testid="menu-session"]').trigger('click')
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

  it('enables Save Report where reports exist and disables leftover Picture/Hex/Table View verbs', async () => {
    routePath = '/compare/picture'
    const picture = mountAppLayout()

    await picture.find('[data-testid="menu-session"]').trigger('click')
    expect(
      picture.find('[data-testid="menu-command-report.save"]').attributes('disabled'),
    ).toBeUndefined()
    await picture.find('[data-testid="menu-view"]').trigger('click')
    expect(
      picture.find('[data-testid="menu-command-view.showAll"]').attributes('disabled'),
    ).toBeDefined()
    expect(
      picture.find('[data-testid="menu-command-view.toggleMinor"]').attributes('disabled'),
    ).toBeUndefined()
    await picture.find('[data-testid="menu-edit"]').trigger('click')
    expect(
      picture.find('[data-testid="menu-command-edit.paste"]').attributes('disabled'),
    ).toBeDefined()
    picture.unmount()

    routePath = '/compare/hex'
    const hex = mountAppLayout()

    await hex.find('[data-testid="menu-view"]').trigger('click')
    expect(
      hex.find('[data-testid="menu-command-view.showAll"]').attributes('disabled'),
    ).toBeUndefined()
    expect(
      hex.find('[data-testid="menu-command-view.toggleMinor"]').attributes('disabled'),
    ).toBeDefined()
    hex.unmount()

    routePath = '/compare/table'
    const table = mountAppLayout()

    await table.find('[data-testid="menu-view"]').trigger('click')
    expect(
      table.find('[data-testid="menu-command-view.showDifferences"]').attributes('disabled'),
    ).toBeDefined()
    expect(
      table.find('[data-testid="menu-command-view.toggleMinor"]').attributes('disabled'),
    ).toBeDefined()
    table.unmount()

    routePath = '/compare/text'
    const text = mountAppLayout()

    await text.find('[data-testid="menu-session"]').trigger('click')
    expect(
      text.find('[data-testid="menu-command-report.save"]').attributes('disabled'),
    ).toBeUndefined()
    text.unmount()
  })

  it('disables leftover Clipboard/Patch/Edit/Registry View and Edit verbs', async () => {
    routePath = '/compare/clipboard'
    const clipboard = mountAppLayout()

    await clipboard.find('[data-testid="menu-view"]').trigger('click')
    expect(
      clipboard.find('[data-testid="menu-command-view.showAll"]').attributes('disabled'),
    ).toBeDefined()
    expect(
      clipboard.find('[data-testid="menu-command-view.toggleMinor"]').attributes('disabled'),
    ).toBeDefined()
    await clipboard.find('[data-testid="menu-edit"]').trigger('click')
    expect(
      clipboard.find('[data-testid="menu-command-edit.paste"]').attributes('disabled'),
    ).toBeDefined()
    await clipboard.find('[data-testid="menu-session"]').trigger('click')
    expect(
      clipboard.find('[data-testid="menu-command-session.rules"]').attributes('disabled'),
    ).toBeDefined()
    expect(
      clipboard.find('[data-testid="menu-command-session.settings"]').attributes('disabled'),
    ).toBeDefined()
    expect(
      clipboard.find('[data-testid="menu-command-session.export"]').attributes('disabled'),
    ).toBeDefined()
    clipboard.unmount()

    routePath = '/patch/text'
    const patch = mountAppLayout()

    await patch.find('[data-testid="menu-session"]').trigger('click')
    expect(
      patch.find('[data-testid="menu-command-session.compare"]').attributes('disabled'),
    ).toBeUndefined()
    expect(
      patch.find('[data-testid="menu-command-session.swap"]').attributes('disabled'),
    ).toBeDefined()
    await patch.find('[data-testid="menu-search"]').trigger('click')
    expect(
      patch.find('[data-testid="menu-command-diff.next"]').attributes('disabled'),
    ).toBeUndefined()
    patch.unmount()

    routePath = '/edit/text'
    const textEdit = mountAppLayout()

    await textEdit.find('[data-testid="menu-edit"]').trigger('click')
    expect(
      textEdit.find('[data-testid="menu-command-edit.paste"]').attributes('disabled'),
    ).toBeUndefined()
    expect(
      textEdit.find('[data-testid="menu-command-edit.copyLeft"]').attributes('disabled'),
    ).toBeDefined()
    await textEdit.find('[data-testid="menu-view"]').trigger('click')
    expect(
      textEdit.find('[data-testid="menu-command-view.showAll"]').attributes('disabled'),
    ).toBeDefined()
    await textEdit.find('[data-testid="menu-session"]').trigger('click')
    expect(
      textEdit.find('[data-testid="menu-command-session.compare"]').attributes('disabled'),
    ).toBeDefined()
    textEdit.unmount()

    routePath = '/compare/registry'
    const registry = mountAppLayout()

    await registry.find('[data-testid="menu-view"]').trigger('click')
    expect(
      registry.find('[data-testid="menu-command-view.showAll"]').attributes('disabled'),
    ).toBeUndefined()
    expect(
      registry.find('[data-testid="menu-command-view.toggleMinor"]').attributes('disabled'),
    ).toBeDefined()
    await registry.find('[data-testid="menu-edit"]').trigger('click')
    expect(
      registry.find('[data-testid="menu-command-edit.copyLeft"]').attributes('disabled'),
    ).toBeUndefined()
    expect(
      registry.find('[data-testid="menu-command-edit.copyRight"]').attributes('disabled'),
    ).toBeUndefined()
    expect(
      registry.find('[data-testid="menu-command-edit.selectAll"]').attributes('disabled'),
    ).toBeDefined()
    await registry.find('[data-testid="menu-session"]').trigger('click')
    expect(
      registry.find('[data-testid="menu-command-session.rules"]').attributes('disabled'),
    ).toBeDefined()
    expect(
      registry.find('[data-testid="menu-command-session.settings"]').attributes('disabled'),
    ).toBeDefined()
    registry.unmount()

    routePath = '/compare/media'
    const media = mountAppLayout()

    await media.find('[data-testid="menu-view"]').trigger('click')
    expect(
      media.find('[data-testid="menu-command-view.showAll"]').attributes('disabled'),
    ).toBeUndefined()
    expect(
      media.find('[data-testid="menu-command-view.toggleMinor"]').attributes('disabled'),
    ).toBeUndefined()
    await media.find('[data-testid="menu-session"]').trigger('click')
    expect(
      media.find('[data-testid="menu-command-session.rules"]').attributes('disabled'),
    ).toBeUndefined()
    expect(
      media.find('[data-testid="menu-command-session.settings"]').attributes('disabled'),
    ).toBeUndefined()
    media.unmount()

    routePath = '/compare/version'
    const version = mountAppLayout()

    await version.find('[data-testid="menu-session"]').trigger('click')
    expect(
      version.find('[data-testid="menu-command-session.rules"]').attributes('disabled'),
    ).toBeUndefined()
    expect(
      version.find('[data-testid="menu-command-session.settings"]').attributes('disabled'),
    ).toBeUndefined()
    version.unmount()

    routePath = '/reports/scripts'
    const reports = mountAppLayout()

    await reports.find('[data-testid="menu-session"]').trigger('click')
    expect(
      reports.find('[data-testid="menu-command-session.compare"]').attributes('disabled'),
    ).toBeDefined()
    expect(
      reports.find('[data-testid="menu-command-session.swap"]').attributes('disabled'),
    ).toBeDefined()
    expect(
      reports.find('[data-testid="menu-command-session.rules"]').attributes('disabled'),
    ).toBeDefined()
    await reports.find('[data-testid="menu-tools"]').trigger('click')
    expect(
      reports.find('[data-testid="menu-command-script.run"]').attributes('disabled'),
    ).toBeUndefined()
    await reports.find('[data-testid="menu-view"]').trigger('click')
    expect(
      reports.find('[data-testid="menu-command-view.showAll"]').attributes('disabled'),
    ).toBeDefined()
    reports.unmount()
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

  it('disables inapplicable commands in the palette on Picture Compare', async () => {
    routePath = '/compare/picture'
    const wrapper = mountAppLayout()

    await wrapper.find('[data-testid="open-command-palette"]').trigger('click')
    await wrapper.find('[data-testid="command-search"]').setValue('show all')

    const showAll = wrapper.find('[data-command-id="view.showAll"]')

    expect(showAll.exists()).toBe(true)
    expect(showAll.attributes('disabled')).toBeDefined()
    expect(showAll.text()).toContain('Planned')

    await showAll.trigger('click')
    expect(wrapper.find('[data-testid="last-view-action"]').exists()).toBe(false)
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

  it('opens Help contents from the top chrome control', async () => {
    const { openPathExternal } = await import('@/api/integration')
    const { DOCS_URL } = await import('@/app/appMeta')
    const wrapper = mountAppLayout()

    vi.mocked(openPathExternal).mockClear()
    await wrapper.find('[data-testid="top-command-help.contents"]').trigger('click')

    expect(openPathExternal).toHaveBeenCalledWith(DOCS_URL)
  })

  it('filters sidebar session types and opens a matching saved session', async () => {
    const { createUntitledSession } = await import('@/app/sessionFactory')
    const savedSessions = (await import('@/stores/savedSessions')).useSavedSessionsStore()
    const sessionLaunch = useSessionLaunchStore()
    const session = createUntitledSession('folder-sync')

    session.name = 'Nightly deploy sync'
    session.locations = {
      left: { uri: 'D:/deploy/package', readOnly: false },
      right: { uri: 'D:/deploy/prod', readOnly: false },
    }
    savedSessions.saveSession(session)

    const wrapper = mountAppLayout()

    expect(wrapper.find('[data-testid="sidebar-nav-folder-compare"]').exists()).toBe(true)
    expect(wrapper.find(`[data-testid="sidebar-saved-session-${session.id}"]`).exists()).toBe(false)

    await wrapper.find('[data-testid="sidebar-session-search"]').setValue('deploy')
    await wrapper.vm.$nextTick()

    expect(wrapper.find('[data-testid="sidebar-nav-folder-compare"]').exists()).toBe(false)
    expect(wrapper.find('[data-testid="sidebar-nav-home"]').exists()).toBe(false)
    expect(wrapper.find(`[data-testid="sidebar-saved-session-${session.id}"]`).exists()).toBe(true)
    expect(wrapper.find(`[data-testid="sidebar-saved-session-${session.id}"]`).text()).toContain(
      'Nightly deploy sync',
    )

    await wrapper.find(`[data-testid="sidebar-saved-session-${session.id}"]`).trigger('click')

    expect(push).toHaveBeenCalledWith('/sync/folder')
    expect(sessionLaunch.pendingLaunch).toMatchObject({
      source: 'saved-session',
      sessionType: 'folder-sync',
      title: 'Nightly deploy sync',
      route: '/sync/folder',
      autoRun: true,
      locations: {
        left: { uri: 'D:/deploy/package', kind: 'directory' },
        right: { uri: 'D:/deploy/prod', kind: 'directory' },
      },
    })
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
    expect(wrapper.find('[data-testid="menu-command-open.pictureCompare"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="menu-command-open.mediaCompare"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="menu-command-open.versionCompare"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="menu-command-open.archiveCompare"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="menu-command-open.textEdit"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="menu-command-open.textPatch"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="menu-command-open.clipboardCompare"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="menu-command-edit.copyLeft"]').exists()).toBe(false)

    await wrapper.find('[data-testid="menu-edit"]').trigger('click')

    expect(
      wrapper.find('[data-testid="menu-edit-group"] [data-testid="menu-panel"]').exists(),
    ).toBe(true)
    expect(wrapper.find('[data-testid="menu-command-edit.copyLeft"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="menu-command-edit.undo"]').exists()).toBe(true)
    expect(
      wrapper.find('[data-testid="menu-command-edit.paste"]').attributes('disabled'),
    ).toBeDefined()
    expect(
      wrapper.find('[data-testid="menu-command-edit.copyLeft"]').attributes('disabled'),
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

  it('honors capture-like next-difference shortcuts on text routes', async () => {
    routePath = '/compare/text'
    const wrapper = mountAppLayout()
    const viewActions = (await import('@/stores/viewActions')).useViewActionsStore()

    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'n', ctrlKey: true }))
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

  it('wires File menu Save/Export/Reload commands that session views already handle', async () => {
    const wrapper = mountAppLayout()

    await wrapper.find('[data-testid="menu-file"]').trigger('click')

    expect(
      wrapper.find('[data-testid="menu-command-session.save"]').attributes('disabled'),
    ).toBeUndefined()
    expect(
      wrapper.find('[data-testid="menu-command-session.saveAs"]').attributes('disabled'),
    ).toBeUndefined()
    expect(
      wrapper.find('[data-testid="menu-command-session.export"]').attributes('disabled'),
    ).toBeUndefined()
    expect(
      wrapper.find('[data-testid="menu-command-session.reload"]').attributes('disabled'),
    ).toBeUndefined()
  })

  it('labels Save Session and wires View Next/Prev Diff plus Clear Session', async () => {
    const wrapper = mountAppLayout()

    await wrapper.find('[data-testid="menu-file"]').trigger('click')
    expect(wrapper.find('[data-testid="menu-command-session.save"]').text()).toContain(
      'Save Session',
    )
    expect(wrapper.find('[data-testid="menu-command-session.saveAs"]').text()).toContain(
      'Save Session As',
    )

    await wrapper.find('[data-testid="menu-view"]').trigger('click')
    expect(wrapper.find('[data-testid="menu-command-diff.next"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="menu-command-diff.previous"]').exists()).toBe(true)
    expect(
      wrapper.find('[data-testid="menu-command-diff.next"]').attributes('disabled'),
    ).toBeUndefined()

    await wrapper.find('[data-testid="menu-session"]').trigger('click')
    expect(wrapper.find('[data-testid="menu-command-session.clear"]').exists()).toBe(true)
    expect(
      wrapper.find('[data-testid="menu-command-session.clear"]').attributes('disabled'),
    ).toBeUndefined()
    expect(wrapper.find('[data-testid="menu-command-report.save"]').exists()).toBe(true)
  })

  it('honestly disables session Save/Clear on Home', async () => {
    routePath = '/'
    const wrapper = mountAppLayout()

    await wrapper.find('[data-testid="menu-session"]').trigger('click')
    expect(
      wrapper.find('[data-testid="menu-command-session.save"]').attributes('disabled'),
    ).toBeDefined()
    expect(
      wrapper.find('[data-testid="menu-command-session.clear"]').attributes('disabled'),
    ).toBeDefined()
    expect(
      wrapper.find('[data-testid="menu-command-session.closeTab"]').attributes('disabled'),
    ).toBeDefined()
  })

  it('wires Locked, Browse for Folder, and Up One Level with honest disablement', async () => {
    routePath = '/compare/folder'
    const wrapper = mountAppLayout()
    const savedSessions = (await import('@/stores/savedSessions')).useSavedSessionsStore()

    await wrapper.find('[data-testid="menu-session"]').trigger('click')
    expect(wrapper.find('[data-testid="menu-command-session.browseFolder"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="menu-command-session.upOneLevel"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="menu-command-session.back"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="menu-command-session.forward"]').exists()).toBe(true)
    expect(
      wrapper.find('[data-testid="menu-command-session.browseFolder"]').attributes('disabled'),
    ).toBeUndefined()
    expect(
      wrapper.find('[data-testid="menu-command-session.back"]').attributes('disabled'),
    ).toBeDefined()
    expect(
      wrapper.find('[data-testid="menu-command-session.forward"]').attributes('disabled'),
    ).toBeDefined()
    expect(
      wrapper.find('[data-testid="menu-command-session.locked"]').attributes('disabled'),
    ).toBeDefined()

    await wrapper.find('[data-testid="menu-command-session.save"]').trigger('click')
    await wrapper.find('[data-testid="menu-session"]').trigger('click')
    expect(
      wrapper.find('[data-testid="menu-command-session.locked"]').attributes('disabled'),
    ).toBeUndefined()

    const beforeLocked = savedSessions.sessions.at(-1)?.metadata.locked

    await wrapper.find('[data-testid="menu-command-session.locked"]').trigger('click')
    expect(savedSessions.sessions.at(-1)?.metadata.locked).toBe(!beforeLocked)

    await wrapper.find('[data-testid="menu-view"]').trigger('click')
    expect(wrapper.find('[data-testid="menu-command-session.browseFolder"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="menu-command-session.upOneLevel"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="menu-command-session.back"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="menu-command-session.forward"]').exists()).toBe(true)
  })

  it('enables Session Back/Forward from folder path history capabilities', async () => {
    routePath = '/compare/folder'
    const wrapper = mountAppLayout()
    const folderPathNav = useFolderPathNavStore()

    await wrapper.find('[data-testid="menu-session"]').trigger('click')
    expect(
      wrapper.find('[data-testid="menu-command-session.back"]').attributes('disabled'),
    ).toBeDefined()

    folderPathNav.setCapabilities({ canGoBack: true, canGoForward: false })
    await wrapper.vm.$nextTick()
    expect(
      wrapper.find('[data-testid="menu-command-session.back"]').attributes('disabled'),
    ).toBeUndefined()
    expect(
      wrapper.find('[data-testid="menu-command-session.forward"]').attributes('disabled'),
    ).toBeDefined()

    folderPathNav.setCapabilities({ canGoBack: true, canGoForward: true })
    await wrapper.vm.$nextTick()
    expect(
      wrapper.find('[data-testid="menu-command-session.forward"]').attributes('disabled'),
    ).toBeUndefined()

    folderPathNav.reset()
  })

  it('disables Browse/Up One Level outside folder sessions', async () => {
    routePath = '/compare/text'
    const wrapper = mountAppLayout()

    await wrapper.find('[data-testid="menu-file"]').trigger('click')
    expect(
      wrapper.find('[data-testid="menu-command-session.browseFolder"]').attributes('disabled'),
    ).toBeDefined()
    expect(
      wrapper.find('[data-testid="menu-command-session.upOneLevel"]').attributes('disabled'),
    ).toBeDefined()
    expect(
      wrapper.find('[data-testid="menu-command-session.back"]').attributes('disabled'),
    ).toBeDefined()
    expect(
      wrapper.find('[data-testid="menu-command-session.forward"]').attributes('disabled'),
    ).toBeDefined()
  })

  it('persists the active session from Save Session menu', async () => {
    const wrapper = mountAppLayout()
    const savedSessions = (await import('@/stores/savedSessions')).useSavedSessionsStore()
    const before = savedSessions.sessions.length

    await wrapper.find('[data-testid="menu-session"]').trigger('click')
    await wrapper.find('[data-testid="menu-command-session.save"]').trigger('click')

    expect(savedSessions.sessions.length).toBe(before + 1)
    expect(savedSessions.sessions.at(-1)?.sessionType).toBe('text-compare')
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
    const tabs = useTabsStore()

    await wrapper.find('[data-testid="open-command-palette"]').trigger('click')
    await wrapper.find('[data-testid="command-search"]').setValue('text')
    await wrapper.find('[data-command-id="open.textCompare"]').trigger('click')

    const closeButton = wrapper
      .findAll('button')
      .find((button) => button.attributes('data-testid')?.startsWith('close-tab-'))

    if (!closeButton) {
      throw new Error('Expected close tab button.')
    }

    tabs.setTabDirty(tabs.activeTab.id, true)
    await wrapper.vm.$nextTick()
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
      chromeKind: 'text-session',
      loadTimeSeconds: 0.03,
      editMode: 'insert',
    })
    await wrapper.vm.$nextTick()

    const status = wrapper.find('[data-testid="status-bar"]')

    expect(status.text()).toContain('≠ 4 difference sections')
    expect(status.text()).toContain('All rows')
    expect(status.text()).toContain('Insert')
    expect(status.text()).toContain('Load time: 0.03 seconds')
    expect(status.find('[data-testid="status-pane-diff"]').exists()).toBe(true)
    expect(status.find('[data-testid="status-pane-edit"]').text()).toContain('Insert')
  })

  it('keeps a folder-pair segmented status strip structure', async () => {
    const wrapper = mountAppLayout()
    const statusBar = useStatusBarStore()

    statusBar.reportStatus({
      source: 'folder-compare',
      chromeKind: 'folder-pair',
      leftSelection: '1 file(s) selected, 22 bytes',
      leftFreeSpace: '91.8 GB free on C:\\',
      rightSelection: '1 file(s) selected, 23 bytes',
      rightFreeSpace: '91.8 GB free on C:\\',
    })
    await wrapper.vm.$nextTick()

    const status = wrapper.find('[data-testid="status-bar"]')

    expect(status.attributes('data-chrome-kind')).toBe('folder-pair')
    expect(status.attributes('data-pane-count')).toBe('4')
    expect(status.findAll('.status-bar-pane')).toHaveLength(4)
    expect(status.find('[data-testid="status-pane-left-selection"]').text()).toContain('22 bytes')
    expect(status.find('[data-testid="status-pane-left-free"]').text()).toContain('91.8 GB')
    expect(status.find('[data-testid="status-pane-right-selection"]').text()).toContain('23 bytes')
    expect(status.find('[data-testid="status-pane-right-free"]').text()).toContain('91.8 GB')
  })

  it('keeps empty folder-pair status panes instead of a blank bar', async () => {
    const wrapper = mountAppLayout()
    const statusBar = useStatusBarStore()

    statusBar.reportStatus({
      source: 'folder-compare',
      chromeKind: 'folder-pair',
      leftSelection: null,
      leftFreeSpace: null,
      rightSelection: null,
      rightFreeSpace: null,
    })
    await wrapper.vm.$nextTick()

    const status = wrapper.find('[data-testid="status-bar"]')

    expect(status.findAll('.status-bar-pane')).toHaveLength(4)
    expect(status.find('[data-testid="status-pane-left-selection"]').attributes('data-muted')).toBe(
      'true',
    )
    expect(status.find('[data-testid="status-pane-left-selection"]').text()).toBe('—')
  })

  it('caps folder-pair at 4 panes when importance would add a 5th', async () => {
    const wrapper = mountAppLayout()
    const statusBar = useStatusBarStore()

    statusBar.reportStatus({
      source: 'folder-compare',
      chromeKind: 'folder-pair',
      importantDifferenceCount: 3,
      unimportantDifferenceCount: 1,
      leftSelection: '1 file(s) selected, 22 bytes',
      leftFreeSpace: '91.8 GB free on C:\\',
      rightSelection: '1 file(s) selected, 23 bytes',
      rightFreeSpace: '40.0 GB free on D:\\',
    })
    await wrapper.vm.$nextTick()

    const status = wrapper.find('[data-testid="status-bar"]')

    expect(status.attributes('data-pane-count')).toBe('4')
    expect(status.findAll('.status-bar-pane')).toHaveLength(4)
    expect(status.find('[data-testid="status-pane-importance"]').exists()).toBe(false)
    expect(status.find('[data-testid="status-pane-left-selection"]').text()).toContain('22 bytes')
    expect(status.find('[data-testid="status-pane-left-free"]').text()).toContain('91.8 GB')
    expect(status.find('[data-testid="status-pane-right-selection"]').text()).toContain('23 bytes')
    expect(status.find('[data-testid="status-pane-right-free"]').text()).toContain('40.0 GB')
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

  it('shows capture-like accelerators on Session/Edit/Search menu commands', async () => {
    routePath = '/compare/folder'
    const wrapper = mountAppLayout()

    await wrapper.find('[data-testid="menu-session"]').trigger('click')
    expect(
      wrapper.find('[data-testid="menu-command-session.openSession"]').attributes('data-shortcut'),
    ).toBe('Ctrl+Shift+O')
    expect(
      wrapper.find('[data-testid="menu-command-session.exit"]').attributes('data-shortcut'),
    ).toBe('Ctrl+Q')
    expect(
      wrapper.find('[data-testid="menu-command-session.save"]').attributes('data-shortcut'),
    ).toBe('Ctrl+Shift+S')
    expect(wrapper.find('[data-testid="menu-command-session.openSession"]').text()).toContain(
      'Ctrl+Shift+O',
    )

    await wrapper.find('[data-testid="menu-edit"]').trigger('click')
    expect(
      wrapper.find('[data-testid="menu-command-edit.selectAll"]').attributes('data-shortcut'),
    ).toBe('Ctrl+A')
    expect(
      wrapper.find('[data-testid="menu-command-edit.selectAllFiles"]').attributes('data-shortcut'),
    ).toBe('Ctrl+Shift+A')
    expect(
      wrapper.find('[data-testid="menu-command-session.reload"]').attributes('data-shortcut'),
    ).toBe('F5')
    expect(
      wrapper.find('[data-testid="menu-command-edit.fullRefresh"]').attributes('data-shortcut'),
    ).toBe('Ctrl+F5')
    expect(
      wrapper.find('[data-testid="menu-command-edit.fullRefresh"]').attributes('disabled'),
    ).toBeUndefined()

    await wrapper.find('[data-testid="menu-search"]').trigger('click')
    expect(wrapper.find('[data-testid="menu-command-diff.next"]').attributes('data-shortcut')).toBe(
      'Ctrl+N',
    )
    expect(
      wrapper.find('[data-testid="menu-command-diff.previous"]').attributes('data-shortcut'),
    ).toBe('Ctrl+P')
    expect(
      wrapper.find('[data-testid="menu-command-search.findFilename"]').attributes('data-shortcut'),
    ).toBe('Ctrl+F')
    expect(
      wrapper
        .find('[data-testid="menu-command-search.findNextFilename"]')
        .attributes('data-shortcut'),
    ).toBe('F3')
    expect(
      wrapper
        .find('[data-testid="menu-command-search.findPreviousFilename"]')
        .attributes('data-shortcut'),
    ).toBe('Shift+F3')
    expect(
      wrapper.find('[data-testid="menu-command-merge.nextConflict"]').attributes('disabled'),
    ).toBeDefined()

    await wrapper.find('[data-testid="menu-view"]').trigger('click')
    expect(
      wrapper.find('[data-testid="menu-command-view.legend"]').attributes('data-shortcut'),
    ).toBe('Ctrl+Alt+L')
    expect(wrapper.find('[data-testid="menu-command-view.legend"]').text()).toContain('Ctrl+Alt+L')
    expect(
      wrapper.find('[data-testid="menu-command-view.legend"]').attributes('disabled'),
    ).toBeUndefined()

    await wrapper.find('[data-testid="menu-actions"]').trigger('click')
    expect(
      wrapper.find('[data-testid="menu-command-actions.rename"]').attributes('data-shortcut'),
    ).toBe('F2')
    expect(
      wrapper.find('[data-testid="menu-command-actions.newFolder"]').attributes('data-shortcut'),
    ).toBe('Ins')
    expect(
      wrapper
        .find('[data-testid="menu-command-actions.refreshSelection"]')
        .attributes('data-shortcut'),
    ).toBe('Shift+F5')

    await wrapper.find('[data-testid="menu-session"]').trigger('click')
    expect(
      wrapper.find('[data-testid="menu-command-session.info"]').attributes('data-shortcut'),
    ).toBe('Ctrl+I')
    expect(wrapper.find('[data-testid="menu-command-report.save"]').text()).toContain('Save Report')

    await wrapper.find('[data-testid="menu-edit"]').trigger('click')
    expect(wrapper.find('[data-testid="menu-command-edit.selectNewer"]').exists()).toBe(true)

    await wrapper.find('[data-testid="menu-view"]').trigger('click')
    expect(wrapper.find('[data-testid="menu-command-view.showOrphans"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="menu-command-view.suppressFilters"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="menu-command-view.showLeftNewer"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="menu-command-view.alwaysShowFolders"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="menu-command-view.showChanges"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="menu-command-view.showConflicts"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="menu-command-view.centerPane"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="menu-command-view.ignoreFolderStructure"]').exists()).toBe(
      true,
    )

    await wrapper.find('[data-testid="menu-session"]').trigger('click')
    expect(wrapper.find('[data-testid="menu-command-session.newSession"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="menu-command-session.compareParentFolders"]').exists()).toBe(
      true,
    )
    expect(wrapper.find('[data-testid="menu-command-session.compareToOutput"]').exists()).toBe(true)

    wrapper.unmount()
  })

  it('toggles folder legend with Ctrl+Alt+L and disables off folder sessions', async () => {
    routePath = '/sync/folder'
    const wrapper = mountAppLayout()
    const settings = useSettingsStore()

    expect(settings.showFolderLegend).toBe(false)
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'l', ctrlKey: true, altKey: true }))
    await wrapper.vm.$nextTick()
    expect(settings.showFolderLegend).toBe(true)

    await wrapper.find('[data-testid="menu-view"]').trigger('click')
    expect(
      wrapper.find('[data-testid="menu-command-view.legend"]').attributes('data-shortcut'),
    ).toBe('Ctrl+Alt+L')
    wrapper.unmount()

    routePath = '/compare/text'
    const textSession = mountAppLayout()

    settings.setShowFolderLegend(false)
    await textSession.find('[data-testid="menu-view"]').trigger('click')
    expect(
      textSession.find('[data-testid="menu-command-view.legend"]').attributes('disabled'),
    ).toBeDefined()
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'l', ctrlKey: true, altKey: true }))
    await textSession.vm.$nextTick()
    expect(settings.showFolderLegend).toBe(false)
    textSession.unmount()

    routePath = '/'
    const home = mountAppLayout()

    await home.find('[data-testid="menu-view"]').trigger('click')
    expect(
      home.find('[data-testid="menu-command-view.legend"]').attributes('disabled'),
    ).toBeDefined()
    home.unmount()
  })

  it('disables selection Actions until a folder row is selected', async () => {
    routePath = '/compare/folder'
    const folderMenuSelection = useFolderMenuSelectionStore()

    folderMenuSelection.setHasSelection(false)

    const wrapper = mountAppLayout()

    await wrapper.find('[data-testid="menu-actions"]').trigger('click')
    expect(
      wrapper.find('[data-testid="menu-command-actions.rename"]').attributes('disabled'),
    ).toBeDefined()
    expect(
      wrapper.find('[data-testid="menu-command-actions.open"]').attributes('disabled'),
    ).toBeDefined()
    expect(
      wrapper.find('[data-testid="menu-command-actions.newFolder"]').attributes('disabled'),
    ).toBeUndefined()

    wrapper.unmount()

    folderMenuSelection.setHasSelection(true)

    const enabled = mountAppLayout()

    await enabled.find('[data-testid="menu-actions"]').trigger('click')
    expect(
      enabled.find('[data-testid="menu-command-actions.rename"]').attributes('disabled'),
    ).toBeUndefined()
    enabled.unmount()
  })

  it('dispatches niche toggle-minor and sync-now shortcuts from chrome keydown', async () => {
    routePath = '/sync/folder'
    const wrapper = mountAppLayout()
    const viewActions = (await import('@/stores/viewActions')).useViewActionsStore()

    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'm', ctrlKey: true, shiftKey: true }))
    await wrapper.vm.$nextTick()
    expect(viewActions.name).toBe('toggle-minor')

    window.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'Enter', ctrlKey: true, shiftKey: true }),
    )
    await wrapper.vm.$nextTick()
    expect(viewActions.name).toBe('sync-now')
    wrapper.unmount()
  })

  it('navigates picture/media/version/archive opens and dispatches script/report chords', async () => {
    routePath = '/reports/scripts'
    const wrapper = mountAppLayout()
    const viewActions = (await import('@/stores/viewActions')).useViewActionsStore()
    const tabs = useTabsStore()

    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'u', ctrlKey: true, altKey: true }))
    await wrapper.vm.$nextTick()
    expect(tabs.tabs.some((tab) => tab.route === '/compare/picture')).toBe(true)

    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'c', ctrlKey: true, altKey: true }))
    await wrapper.vm.$nextTick()
    expect(viewActions.name).toBe('run-script')

    routePath = '/compare/folder'
    await wrapper.vm.$nextTick()
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'p', ctrlKey: true, shiftKey: true }))
    await wrapper.vm.$nextTick()
    expect(viewActions.name).toBe('save-report')
    wrapper.unmount()
  })

  it('skips niche shortcuts while focus is in an editable field', async () => {
    routePath = '/sync/folder'
    const wrapper = mountAppLayout()
    const viewActions = (await import('@/stores/viewActions')).useViewActionsStore()

    viewActions.dispatch('compare')
    const input = document.createElement('input')

    document.body.append(input)

    const event = new KeyboardEvent('keydown', { key: 'Enter', ctrlKey: true, shiftKey: true })

    Object.defineProperty(event, 'target', { value: input })
    window.dispatchEvent(event)
    await wrapper.vm.$nextTick()

    expect(viewActions.name).toBe('compare')
    input.remove()
    wrapper.unmount()
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

describe('AppLayout tab strip chrome', () => {
  beforeEach(() => {
    localStorage.clear()
    setActivePinia(createPinia())
    push.mockClear()
    routePath = '/'
  })

  it('hides the tab strip for a sole Home tab even when alwaysShowTabBar is true', () => {
    const settings = useSettingsStore()

    settings.setAlwaysShowTabBar(true)
    const wrapper = mountAppLayout()

    expect(wrapper.find('[data-testid="app-shell"]').attributes('data-show-tab-strip')).toBe(
      'false',
    )
    expect(wrapper.find('[data-testid="tab-strip"]').isVisible()).toBe(false)
    expect(wrapper.find('[data-testid="app-shell"]').attributes('data-single-session-frame')).toBe(
      'false',
    )
    expect(wrapper.find('[data-testid="app-shell"]').attributes('data-dense-chrome')).toBe('true')
    expect(wrapper.find('[data-testid="app-shell"]').classes()).toContain('app-shell-dense-chrome')
    wrapper.unmount()
  })

  it('hides the tab strip for a sole session when alwaysShowTabBar is false', () => {
    routePath = '/compare/text'
    const settings = useSettingsStore()
    const tabs = useTabsStore()

    settings.setAlwaysShowTabBar(false)
    tabs.tabs = [
      {
        id: 'sess-1',
        title: 'Text Compare',
        titleKey: 'ui.textCompare',
        route: '/compare/text',
        dirty: false,
      },
    ]
    tabs.activeTabId = 'sess-1'

    const wrapper = mountAppLayout()

    expect(wrapper.find('[data-testid="app-shell"]').attributes('data-show-tab-strip')).toBe(
      'false',
    )
    expect(wrapper.find('[data-testid="app-shell"]').attributes('data-single-session-frame')).toBe(
      'true',
    )
    expect(wrapper.find('[data-testid="tab-strip"]').isVisible()).toBe(false)
    expect(wrapper.find('[data-testid="app-shell"]').attributes('data-dense-chrome')).toBe('true')
    expect(wrapper.find('[data-testid="app-shell"]').classes()).toContain(
      'app-shell-single-session',
    )
    wrapper.unmount()
  })

  it('shows the tab strip for a sole session when alwaysShowTabBar is true', () => {
    routePath = '/compare/text'
    const settings = useSettingsStore()
    const tabs = useTabsStore()

    settings.setAlwaysShowTabBar(true)
    tabs.tabs = [
      {
        id: 'sess-1',
        title: 'Text Compare',
        titleKey: 'ui.textCompare',
        route: '/compare/text',
        dirty: false,
      },
    ]
    tabs.activeTabId = 'sess-1'

    const wrapper = mountAppLayout()

    expect(wrapper.find('[data-testid="app-shell"]').attributes('data-show-tab-strip')).toBe('true')
    expect(wrapper.find('[data-testid="tab-strip"]').isVisible()).toBe(true)
    expect(wrapper.find('[data-testid="app-shell"]').attributes('data-single-session-frame')).toBe(
      'false',
    )
    expect(wrapper.find('[data-testid="app-shell"]').attributes('data-dense-chrome')).toBe('false')
    wrapper.unmount()
  })

  it('defaults alwaysShowTabBar to false so Home starts without a tab strip', () => {
    const settings = useSettingsStore()

    expect(settings.alwaysShowTabBar).toBe(false)

    const wrapper = mountAppLayout()

    expect(wrapper.find('[data-testid="app-shell"]').attributes('data-show-tab-strip')).toBe(
      'false',
    )
    wrapper.unmount()
  })
})

describe('global menu depth parity', () => {
  beforeEach(() => {
    localStorage.clear()
    setActivePinia(createPinia())
    push.mockClear()
    routePath = '/compare/folder'
  })

  it('wires Folder Actions Open/Exclude and Edit Select with honest Home disablement', async () => {
    const folderMenuSelection = useFolderMenuSelectionStore()

    folderMenuSelection.setHasSelection(true)

    const wrapper = mountAppLayout()

    await wrapper.find('[data-testid="menu-actions"]').trigger('click')
    expect(wrapper.find('[data-testid="menu-command-actions.open"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="menu-command-actions.exclude"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="menu-command-actions.attributes"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="menu-command-actions.touch"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="menu-command-actions.newFolder"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="menu-command-actions.copyToSide"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="menu-command-actions.moveToFolder"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="menu-command-actions.rename"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="menu-command-actions.rename"]').text()).toContain(
      'Rename...',
    )
    expect(wrapper.find('[data-testid="menu-command-actions.delete"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="menu-command-actions.delete"]').text()).toContain(
      'Delete...',
    )
    expect(wrapper.find('[data-testid="menu-command-actions.exclude"]').text()).toContain(
      'Exclude...',
    )
    expect(wrapper.find('[data-testid="menu-command-actions.copyFilename"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="menu-command-actions.compareContents"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="menu-command-actions.synchronize"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="menu-command-actions.explorer"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="menu-command-actions.ignored"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="menu-command-actions.alignWith"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="menu-command-actions.breakAlignment"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="menu-command-actions.fileCompareReport"]').exists()).toBe(
      true,
    )
    expect(
      wrapper.find('[data-testid="menu-command-actions.newFolder"]').attributes('disabled'),
    ).toBeUndefined()
    expect(
      wrapper.find('[data-testid="menu-command-actions.copyToSide"]').attributes('disabled'),
    ).toBeUndefined()
    expect(
      wrapper.find('[data-testid="menu-command-actions.rename"]').attributes('disabled'),
    ).toBeUndefined()
    expect(
      wrapper.find('[data-testid="menu-command-actions.leaveAlone"]').attributes('disabled'),
    ).toBeDefined()
    expect(
      wrapper.find('[data-testid="menu-command-actions.open"]').attributes('disabled'),
    ).toBeUndefined()
    expect(
      wrapper.find('[data-testid="menu-command-actions.attributes"]').attributes('disabled'),
    ).toBeUndefined()
    expect(
      wrapper.find('[data-testid="menu-command-actions.copyToOutput"]').attributes('disabled'),
    ).toBeDefined()

    await wrapper.find('[data-testid="menu-edit"]').trigger('click')
    expect(wrapper.find('[data-testid="menu-command-edit.selectAll"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="menu-command-view.expandAll"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="menu-command-edit.invertSelection"]').exists()).toBe(true)

    await wrapper.find('[data-testid="menu-search"]').trigger('click')
    expect(wrapper.find('[data-testid="menu-command-search.findFilename"]').exists()).toBe(true)

    await wrapper.find('[data-testid="menu-view"]').trigger('click')
    expect(wrapper.find('[data-testid="menu-command-view.showSame"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="menu-command-view.columns"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="menu-command-view.legend"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="menu-command-view.toolbar"]').exists()).toBe(true)
    expect(
      wrapper.find('[data-testid="menu-command-view.columns"]').attributes('disabled'),
    ).toBeUndefined()
    expect(
      wrapper.find('[data-testid="menu-command-view.legend"]').attributes('disabled'),
    ).toBeUndefined()

    await wrapper.find('[data-testid="menu-session"]').trigger('click')
    expect(wrapper.find('[data-testid="menu-command-actions.newFolder"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="menu-command-session.mergeBaseFolders"]').exists()).toBe(
      true,
    )
    expect(
      wrapper.find('[data-testid="menu-command-session.mergeBaseFolders"]').attributes('disabled'),
    ).toBeUndefined()
    expect(
      wrapper.find('[data-testid="menu-command-sync.syncNow"]').attributes('disabled'),
    ).toBeDefined()

    wrapper.unmount()

    routePath = '/sync/folder'
    folderMenuSelection.setHasSelection(true)

    const sync = mountAppLayout()

    await sync.find('[data-testid="menu-actions"]').trigger('click')
    expect(
      sync.find('[data-testid="menu-command-actions.open"]').attributes('disabled'),
    ).toBeUndefined()
    expect(
      sync.find('[data-testid="menu-command-actions.attributes"]').attributes('disabled'),
    ).toBeDefined()
    expect(
      sync.find('[data-testid="menu-command-actions.leaveAlone"]').attributes('disabled'),
    ).toBeUndefined()
    expect(
      sync.find('[data-testid="menu-command-actions.copyLeftToRight"]').attributes('disabled'),
    ).toBeUndefined()
    expect(
      sync.find('[data-testid="menu-command-actions.copyToSide"]').attributes('disabled'),
    ).toBeDefined()
    expect(
      sync.find('[data-testid="menu-command-actions.rename"]').attributes('disabled'),
    ).toBeDefined()
    expect(
      sync.find('[data-testid="menu-command-actions.deleteRight"]').attributes('disabled'),
    ).toBeUndefined()
    expect(
      sync.find('[data-testid="menu-command-actions.newFolder"]').attributes('disabled'),
    ).toBeUndefined()
    expect(
      sync.find('[data-testid="menu-command-actions.explorer"]').attributes('disabled'),
    ).toBeUndefined()
    await sync.find('[data-testid="menu-edit"]').trigger('click')
    expect(
      sync.find('[data-testid="menu-command-edit.selectAll"]').attributes('disabled'),
    ).toBeUndefined()
    expect(
      sync.find('[data-testid="menu-command-edit.selectOrphans"]').attributes('disabled'),
    ).toBeDefined()
    await sync.find('[data-testid="menu-view"]').trigger('click')
    expect(
      sync.find('[data-testid="menu-command-view.log"]').attributes('disabled'),
    ).toBeUndefined()
    expect(
      sync.find('[data-testid="menu-command-view.legend"]').attributes('disabled'),
    ).toBeUndefined()
    expect(
      sync.find('[data-testid="menu-command-view.columns"]').attributes('disabled'),
    ).toBeDefined()
    expect(
      sync.find('[data-testid="menu-command-view.showConflicts"]').attributes('disabled'),
    ).toBeUndefined()
    await sync.find('[data-testid="menu-search"]').trigger('click')
    expect(
      sync.find('[data-testid="menu-command-merge.nextConflict"]').attributes('disabled'),
    ).toBeUndefined()
    expect(sync.find('[data-testid="menu-command-diff.next"]').attributes('disabled')).toBeDefined()
    expect(
      sync.find('[data-testid="menu-command-diff.previous"]').attributes('disabled'),
    ).toBeDefined()
    sync.unmount()

    routePath = '/merge/folder'
    const merge = mountAppLayout()

    await merge.find('[data-testid="menu-actions"]').trigger('click')
    expect(
      merge.find('[data-testid="menu-command-actions.exclude"]').attributes('disabled'),
    ).toBeUndefined()
    expect(
      merge.find('[data-testid="menu-command-actions.explorer"]').attributes('disabled'),
    ).toBeUndefined()
    expect(merge.find('[data-testid="menu-command-actions.copyToOutput"]').exists()).toBe(true)
    expect(
      merge.find('[data-testid="menu-command-actions.copyToOutput"]').attributes('disabled'),
    ).toBeUndefined()
    expect(merge.find('[data-testid="menu-command-actions.merge"]').exists()).toBe(true)
    expect(merge.find('[data-testid="menu-command-actions.merge"]').text()).toContain('Merge...')
    expect(
      merge.find('[data-testid="menu-command-actions.merge"]').attributes('disabled'),
    ).toBeUndefined()
    expect(
      merge.find('[data-testid="menu-command-actions.compareContents"]').attributes('disabled'),
    ).toBeUndefined()
    expect(
      merge.find('[data-testid="menu-command-actions.attributes"]').attributes('disabled'),
    ).toBeDefined()
    await merge.find('[data-testid="menu-edit"]').trigger('click')
    expect(
      merge.find('[data-testid="menu-command-edit.selectAllFiles"]').attributes('disabled'),
    ).toBeUndefined()
    await merge.find('[data-testid="menu-search"]').trigger('click')
    expect(
      merge.find('[data-testid="menu-command-merge.nextConflict"]').attributes('disabled'),
    ).toBeUndefined()
    expect(
      merge.find('[data-testid="menu-command-diff.next"]').attributes('disabled'),
    ).toBeDefined()
    merge.unmount()

    routePath = '/merge/text'
    const textMerge = mountAppLayout()

    expect(textMerge.find('[data-testid="menu-file"]').exists()).toBe(true)
    expect(textMerge.find('[data-testid="menu-actions"]').exists()).toBe(false)
    await textMerge.find('[data-testid="menu-search"]').trigger('click')
    expect(
      textMerge.find('[data-testid="menu-command-merge.nextConflict"]').attributes('disabled'),
    ).toBeUndefined()
    await textMerge.find('[data-testid="menu-edit"]').trigger('click')
    expect(
      textMerge.find('[data-testid="menu-command-edit.paste"]').attributes('disabled'),
    ).toBeDefined()
    expect(
      textMerge.find('[data-testid="menu-command-edit.copyLeft"]').attributes('disabled'),
    ).toBeUndefined()
    await textMerge.find('[data-testid="menu-view"]').trigger('click')
    expect(
      textMerge.find('[data-testid="menu-command-view.centerPane"]').attributes('disabled'),
    ).toBeDefined()
    expect(
      textMerge.find('[data-testid="menu-command-view.showAll"]').attributes('disabled'),
    ).toBeDefined()
    await textMerge.find('[data-testid="menu-session"]').trigger('click')
    expect(
      textMerge.find('[data-testid="menu-command-session.swap"]').attributes('disabled'),
    ).toBeDefined()
    textMerge.unmount()

    routePath = '/'
    const home = mountAppLayout()

    await home.find('[data-testid="menu-view"]').trigger('click')
    expect(
      home.find('[data-testid="menu-command-view.expandAll"]').attributes('disabled'),
    ).toBeDefined()
    expect(
      home.find('[data-testid="menu-command-view.showSame"]').attributes('disabled'),
    ).toBeDefined()
    expect(
      home.find('[data-testid="menu-command-view.legend"]').attributes('disabled'),
    ).toBeDefined()
    home.unmount()
  })
})
