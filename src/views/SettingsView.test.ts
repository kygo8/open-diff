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

vi.mock('@/api/diff', () => ({
  setArchiveExtensions: vi.fn().mockResolvedValue(['.zip', '.rar']),
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

    await wrapper.find('[data-testid="options-section-profiles"]').trigger('click')
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
    expect(wrapper.find('[data-testid="shortcut-current-theme.toggle"]').text()).toBe(
      'Ctrl+Alt+Shift+Z',
    )
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

  it('persists confirmations and wrap-text default from Options', async () => {
    const wrapper = mountSettingsView()
    const settings = useSettingsStore()

    await wrapper.find('[data-testid="options-section-confirmations"]').trigger('click')
    expect(wrapper.find('[data-testid="options-confirmations-card"]').isVisible()).toBe(true)

    const confirm = wrapper.find('[data-testid="confirm-before-delete"]')

    await confirm.setValue(false)
    expect(settings.confirmBeforeDelete).toBe(false)

    await wrapper.find('[data-testid="options-section-tweaks"]').trigger('click')
    expect(wrapper.find('[data-testid="options-tweaks-card"]').isVisible()).toBe(true)
    await wrapper.find('[data-testid="wrap-text-default"]').setValue(true)
    expect(settings.wrapTextDefault).toBe(true)
  })

  it('persists sync-confirm, auto-scroll, and collapse-identical options', async () => {
    const wrapper = mountSettingsView()
    const settings = useSettingsStore()

    await wrapper.find('[data-testid="options-section-confirmations"]').trigger('click')
    await wrapper.find('[data-testid="confirm-before-sync-overwrite"]').setValue(false)

    await wrapper.find('[data-testid="options-section-tweaks"]').trigger('click')
    await wrapper.find('[data-testid="auto-scroll-first-difference"]').setValue(true)
    await wrapper.find('[data-testid="collapse-identical-folders-default"]').setValue(true)
    await wrapper.find('[data-testid="show-hidden-files"]').setValue(true)
    await wrapper.find('[data-testid="notify-on-compare-complete"]').setValue(true)

    expect(settings.confirmBeforeSyncOverwrite).toBe(false)
    expect(settings.autoScrollToFirstDifference).toBe(true)
    expect(settings.collapseIdenticalFoldersDefault).toBe(true)
    expect(settings.showHiddenFiles).toBe(true)
    expect(settings.notifyOnCompareComplete).toBe(true)
  })

  it('deepens text editing options with auto-scroll', async () => {
    const wrapper = mountSettingsView()
    const settings = useSettingsStore()

    await wrapper.find('[data-testid="options-section-textEditing"]').trigger('click')
    expect(wrapper.find('[data-testid="options-text-editing-card"]').isVisible()).toBe(true)
    await wrapper.find('[data-testid="auto-scroll-first-difference-editing"]').setValue(true)
    expect(settings.autoScrollToFirstDifference).toBe(true)
  })

  it('restores factory defaults from the Tweaks options card', async () => {
    const wrapper = mountSettingsView()
    const settings = useSettingsStore()

    settings.setTheme('dark')
    settings.setFontSize(18)
    settings.setConfirmBeforeDelete(false)
    settings.setShowSessionToolbars(false)

    await wrapper.find('[data-testid="options-section-tweaks"]').trigger('click')
    await wrapper.find('[data-testid="restore-factory-defaults"]').trigger('click')

    expect(settings.theme).toBe('light')
    expect(settings.fontSize).toBe(14)
    expect(settings.confirmBeforeDelete).toBe(true)
    expect(settings.showSessionToolbars).toBe(true)
    expect(wrapper.find('[data-testid="options-restore-status"]').text()).toContain(
      'Restore Factory Defaults',
    )
  })

  it('toggles status bar and path bars from appearance options', async () => {
    const wrapper = mountSettingsView()
    const settings = useSettingsStore()

    await wrapper.find('[data-testid="options-section-appearance"]').trigger('click')
    expect(wrapper.find('[data-testid="options-appearance-card"]').isVisible()).toBe(true)

    await wrapper.find('[data-testid="show-status-bar"]').setValue(false)
    expect(settings.showStatusBar).toBe(false)

    await wrapper.find('[data-testid="show-path-bars"]').setValue(false)
    expect(settings.showPathBars).toBe(false)
    expect(document.documentElement.dataset.showPathBars).toBe('0')
  })

  it('toggles load last workspace from Startup options', async () => {
    const wrapper = mountSettingsView()
    const settings = useSettingsStore()

    await wrapper.find('[data-testid="options-section-startup"]').trigger('click')
    expect(wrapper.find('[data-testid="options-startup-card"]').isVisible()).toBe(true)
    expect(settings.loadLastWorkspaceOnStartup).toBe(false)

    await wrapper.find('[data-testid="load-last-workspace-on-startup"]').setValue(true)
    expect(settings.loadLastWorkspaceOnStartup).toBe(true)
  })

  it('exposes tree-style options for toolbars, open with, shell, and backup', async () => {
    const wrapper = mountSettingsView()
    const settings = useSettingsStore()

    await wrapper.find('[data-testid="options-section-toolbars"]').trigger('click')
    expect(wrapper.find('[data-testid="options-toolbars-card"]').isVisible()).toBe(true)
    await wrapper.find('[data-testid="show-session-toolbars"]').setValue(false)
    expect(settings.showSessionToolbars).toBe(false)
    await wrapper.find('[data-testid="large-toolbar-buttons"]').setValue(false)
    expect(settings.largeToolbarButtons).toBe(false)

    await wrapper.find('[data-testid="options-section-openWith"]').trigger('click')
    expect(wrapper.find('[data-testid="options-open-with-card"]').isVisible()).toBe(true)
    await wrapper.find('[data-testid="open-with-name"]').setValue('Notes')
    await wrapper.find('[data-testid="open-with-executable"]').setValue('notes')
    await wrapper.find('[data-testid="open-with-add"]').trigger('click')
    expect(wrapper.text()).toContain('Notes')

    await wrapper.find('[data-testid="options-section-shell"]').trigger('click')
    expect(wrapper.find('[data-testid="options-shell-card"]').isVisible()).toBe(true)

    await wrapper.find('[data-testid="options-section-backup"]').trigger('click')
    expect(wrapper.find('[data-testid="options-backup-card"]').isVisible()).toBe(true)
    await wrapper.find('[data-testid="create-backup-on-save"]').setValue(false)
    expect(settings.createBackupOnSave).toBe(false)
    await wrapper.find('[data-testid="backup-retention-count"]').setValue('4')
    expect(settings.backupRetentionCount).toBe(4)

    await wrapper.find('[data-testid="options-section-commands"]').trigger('click')
    expect(wrapper.find('[data-testid="options-commands-card"]').isVisible()).toBe(true)
    expect(settings.showSessionsInToolbar).toBe(false)
    expect(settings.showGotoInToolbar).toBe(false)
    expect(settings.showWrapInToolbar).toBe(false)
    expect(settings.showSyncNowInToolbar).toBe(false)
    expect(settings.showSyncCancelAcceptInToolbar).toBe(false)
    await wrapper.find('[data-testid="show-sessions-in-toolbar"]').setValue(true)
    expect(settings.showSessionsInToolbar).toBe(true)
    await wrapper.find('[data-testid="show-goto-in-toolbar"]').setValue(true)
    expect(settings.showGotoInToolbar).toBe(true)
    await wrapper.find('[data-testid="show-wrap-in-toolbar"]').setValue(true)
    expect(settings.showWrapInToolbar).toBe(true)
    await wrapper.find('[data-testid="show-sync-now-in-toolbar"]').setValue(true)
    expect(settings.showSyncNowInToolbar).toBe(true)
    await wrapper.find('[data-testid="show-sync-cancel-accept-in-toolbar"]').setValue(true)
    expect(settings.showSyncCancelAcceptInToolbar).toBe(true)

    await wrapper.find('[data-testid="options-section-confirmations"]').trigger('click')
    expect(wrapper.find('[data-testid="options-confirmations-card"]').isVisible()).toBe(true)
  })
  it('persists Tabs, Next/Prev Difference toolbar, and Archive Types options', async () => {
    const wrapper = mountSettingsView()
    const settings = useSettingsStore()

    await wrapper.find('[data-testid="options-section-tabs"]').trigger('click')
    expect(wrapper.find('[data-testid="options-tabs-card"]').isVisible()).toBe(true)
    await wrapper.find('[data-testid="always-show-tab-bar"]').setValue(true)
    expect(settings.alwaysShowTabBar).toBe(true)
    await wrapper.find('[data-testid="always-show-tab-bar"]').setValue(false)
    expect(settings.alwaysShowTabBar).toBe(false)
    await wrapper.find('[data-testid="open-sessions-in-new-tab"]').setValue(true)
    expect(settings.openSessionsInNewTab).toBe(true)

    await wrapper.find('[data-testid="options-section-toolbars"]').trigger('click')
    await wrapper.find('[data-testid="show-next-difference-in-toolbar"]').setValue(false)
    expect(settings.showNextDifferenceInToolbar).toBe(false)
    await wrapper.find('[data-testid="show-prev-difference-in-toolbar"]').setValue(false)
    expect(settings.showPrevDifferenceInToolbar).toBe(false)

    await wrapper.find('[data-testid="options-section-archiveTypes"]').trigger('click')
    expect(wrapper.find('[data-testid="options-archive-types-card"]').isVisible()).toBe(true)
    await wrapper.find('[data-testid="archive-extensions-input"]').setValue('.zip, rar')
    await wrapper.find('[data-testid="apply-archive-extensions"]').trigger('click')
    await flushPromises()
    expect(settings.archiveExtensions).toEqual(['.rar', '.zip'])
    expect(settings.enableRarArchiveTypes).toBe(true)
  })

  it('persists Appearance sidebar, Toolbars icons, Backup overwrite confirm, and Confirmations dirty-tab confirm', async () => {
    const wrapper = mount(SettingsView)
    const settings = useSettingsStore()

    await wrapper.find('[data-testid="options-section-appearance"]').trigger('click')
    await wrapper.find('[data-testid="show-sidebar"]').setValue(true)
    expect(settings.showSidebar).toBe(true)
    expect(document.documentElement.dataset.showSidebar).toBe('1')

    await wrapper.find('[data-testid="options-section-toolbars"]').trigger('click')
    await wrapper.find('[data-testid="show-toolbar-icons"]').setValue(false)
    expect(settings.showToolbarIcons).toBe(false)

    await wrapper.find('[data-testid="options-section-backup"]').trigger('click')
    await wrapper.find('[data-testid="confirm-before-overwrite-save"]').setValue(true)
    expect(settings.confirmBeforeOverwriteSave).toBe(true)

    await wrapper.find('[data-testid="options-section-confirmations"]').trigger('click')
    await wrapper.find('[data-testid="confirm-before-close-dirty-tab"]').setValue(false)
    expect(settings.confirmBeforeCloseDirtyTab).toBe(false)
  })

  it('persists Appearance chrome utilities/legend and Confirmations quit/copy/move leftovers', async () => {
    const wrapper = mountSettingsView()
    const settings = useSettingsStore()

    await wrapper.find('[data-testid="options-section-appearance"]').trigger('click')
    expect(wrapper.find('[data-testid="show-chrome-utilities"]').exists()).toBe(true)
    await wrapper.find('[data-testid="show-chrome-utilities"]').setValue(false)
    expect(settings.showChromeUtilities).toBe(false)
    expect(wrapper.find('[data-testid="show-folder-legend"]').exists()).toBe(true)
    await wrapper.find('[data-testid="show-folder-legend"]').setValue(true)
    expect(settings.showFolderLegend).toBe(true)

    await wrapper.find('[data-testid="options-section-backup"]').trigger('click')
    expect(wrapper.find('[data-testid="create-backup-on-report-export"]').exists()).toBe(true)
    await wrapper.find('[data-testid="create-backup-on-report-export"]').setValue(true)
    expect(settings.createBackupOnReportExport).toBe(true)

    await wrapper.find('[data-testid="options-section-confirmations"]').trigger('click')
    expect(wrapper.find('[data-testid="confirm-before-quit"]').exists()).toBe(true)
    await wrapper.find('[data-testid="confirm-before-quit"]').setValue(true)
    expect(settings.confirmBeforeQuit).toBe(true)
    await wrapper.find('[data-testid="confirm-before-copy"]').setValue(false)
    expect(settings.confirmBeforeCopy).toBe(false)
    await wrapper.find('[data-testid="confirm-before-move"]').setValue(true)
    expect(settings.confirmBeforeMove).toBe(true)
    await wrapper.find('[data-testid="confirm-before-sync-delete"]').setValue(false)
    expect(settings.confirmBeforeSyncDelete).toBe(false)
    wrapper.unmount()
  })

  it('persists File Operations, Archive Types RAR, and remaining Tweaks leftovers', async () => {
    const wrapper = mountSettingsView()
    const settings = useSettingsStore()

    await wrapper.find('[data-testid="options-section-fileOperations"]').trigger('click')
    expect(wrapper.find('[data-testid="options-file-operations-card"]').isVisible()).toBe(true)
    await wrapper.find('[data-testid="include-hidden-items-in-file-actions"]').setValue(true)
    expect(settings.includeHiddenItemsInFileActions).toBe(true)
    await wrapper.find('[data-testid="beep-after-long-file-operations"]').setValue(true)
    expect(settings.beepAfterLongFileOperations).toBe(true)
    await wrapper.find('[data-testid="copy-empty-folders"]').setValue(false)
    await wrapper.find('[data-testid="keep-folder-expansion-on-reload"]').setValue(true)
    await wrapper.find('[data-testid="skip-newer-targets-on-copy"]').setValue(true)
    expect(
      JSON.parse(localStorage.getItem('open-diff-file-operation-preferences') ?? '{}'),
    ).toMatchObject({
      copyEmptyFolders: false,
      keepFolderExpansionOnReload: true,
      skipNewerTargetsOnCopy: true,
    })

    await wrapper.find('[data-testid="options-section-archiveTypes"]').trigger('click')
    await wrapper.find('[data-testid="enable-rar-archive-types"]').setValue(true)
    expect(settings.enableRarArchiveTypes).toBe(true)
    expect(settings.archiveExtensions).toContain('.rar')

    await wrapper.find('[data-testid="options-section-tweaks"]').trigger('click')
    await wrapper.find('[data-testid="esc-closes-file-views"]').setValue(true)
    expect(settings.escClosesFileViews).toBe(true)
    await wrapper.find('[data-testid="beep-when-script-finished"]').setValue(true)
    expect(settings.beepWhenScriptFinished).toBe(true)
    await wrapper.find('[data-testid="close-when-script-finished"]').setValue(true)
    expect(settings.closeWhenScriptFinished).toBe(true)
    wrapper.unmount()
  })
  it('persists Tweaks leftovers for disk reload, sticky Home, IPv6, watch folders, and binary buffer', async () => {
    const wrapper = mountSettingsView()
    const settings = useSettingsStore()

    await wrapper.find('[data-testid="options-section-tweaks"]').trigger('click')
    await wrapper.find('[data-testid="check-for-files-changed-on-disk"]').setValue(true)
    expect(settings.checkForFilesChangedOnDisk).toBe(true)
    await wrapper.find('[data-testid="auto-reload-unless-changes-discarded"]').setValue(true)
    expect(settings.autoReloadUnlessChangesDiscarded).toBe(true)
    await wrapper.find('[data-testid="sticky-home-session-selection"]').setValue(true)
    expect(settings.stickyHomeSessionSelection).toBe(true)
    await wrapper.find('[data-testid="prefer-ipv6-when-available"]').setValue(true)
    expect(settings.preferIpv6WhenAvailable).toBe(true)
    await wrapper.find('[data-testid="watch-folders-for-changes"]').setValue(true)
    expect(settings.watchFoldersForChanges).toBe(true)
    await wrapper.find('[data-testid="binary-compare-buffer-size"]').setValue('2048')
    await wrapper.find('[data-testid="binary-compare-buffer-size"]').trigger('change')
    expect(settings.binaryCompareBufferSize).toBe(2048)
    wrapper.unmount()
  })
})

it('persists Folder/Hex/File Filters compare options and text ignore defaults', async () => {
  const wrapper = mountSettingsView()

  await wrapper.find('[data-testid="options-section-textEditing"]').trigger('click')
  await wrapper.find('[data-testid="ignore-whitespace-default"]').setValue(true)
  await wrapper.find('[data-testid="ignore-case-default"]').setValue(true)
  await wrapper.find('[data-testid="ignore-line-endings-default"]').setValue(true)
  await wrapper.find('[data-testid="text-compare-algorithm-default"]').setValue('patience')
  await wrapper.find('[data-testid="text-compare-algorithm-default"]').trigger('change')
  await wrapper
    .find('[data-testid="text-compare-ignore-regexes-default"]')
    .setValue('^TODO, ^FIXME')
  await wrapper.find('[data-testid="text-compare-ignore-regexes-default"]').trigger('change')
  expect(
    JSON.parse(localStorage.getItem('open-diff-text-compare-session-options') ?? '{}'),
  ).toMatchObject({
    ignoreWhitespace: true,
    ignoreCase: true,
    ignoreLineEndings: true,
    algorithm: 'patience',
    ignoreRegexes: ['^TODO', '^FIXME'],
  })

  await wrapper.find('[data-testid="options-section-folderCompare"]').trigger('click')
  expect(wrapper.find('[data-testid="options-folder-compare-card"]').isVisible()).toBe(true)
  await wrapper.find('[data-testid="folder-compare-timestamp"]').setValue(true)
  await wrapper.find('[data-testid="folder-compare-crc"]').setValue(true)
  await wrapper.find('[data-testid="folder-compare-attributes"]').setValue(true)
  await wrapper.find('[data-testid="folder-compare-follow-symlinks"]').setValue(true)
  await wrapper.find('[data-testid="folder-compare-size-only-unimportant"]').setValue(true)
  await wrapper.find('[data-testid="folder-compare-ignore-dst"]').setValue(true)
  await wrapper.find('[data-testid="folder-compare-case-sensitive-names"]').setValue(false)
  await wrapper.find('[data-testid="folder-compare-timestamp-tolerance"]').setValue('3')
  await wrapper.find('[data-testid="folder-compare-timestamp-tolerance"]').trigger('change')
  await wrapper.find('[data-testid="folder-compare-ignored-timezone-offsets"]').setValue('8, -5')
  await wrapper.find('[data-testid="folder-compare-ignored-timezone-offsets"]').trigger('change')
  await wrapper.find('[data-testid="folder-compare-exclude-junctions"]').setValue(true)
  expect(
    JSON.parse(localStorage.getItem('open-diff-folder-compare-criteria') ?? '{}'),
  ).toMatchObject({
    compareModifiedTime: true,
    compareCrc: true,
    compareAttributes: true,
    followSymlinks: true,
    sizeOnlyUnimportant: true,
    ignoreDaylightSavingHourOffset: true,
    timestampToleranceMs: 3000,
    caseSensitiveNames: false,
    ignoredTimezoneHourOffsets: [8, -5],
    excludeJunctionPoints: true,
  })

  await wrapper.find('[data-testid="options-section-hexCompare"]').trigger('click')
  expect(wrapper.find('[data-testid="options-hex-compare-card"]').isVisible()).toBe(true)
  await wrapper.find('[data-testid="hex-diff-only-default"]').setValue(true)
  await wrapper.find('[data-testid="hex-window-length-default"]').setValue('512')
  await wrapper.find('[data-testid="hex-window-length-default"]').trigger('change')
  await wrapper.find('[data-testid="hex-bytes-per-row-default"]').setValue('8')
  await wrapper.find('[data-testid="hex-bytes-per-row-default"]').trigger('change')
  expect(
    JSON.parse(localStorage.getItem('open-diff-hex-compare-session-options') ?? '{}'),
  ).toMatchObject({
    diffOnly: true,
    windowLength: 512,
    bytesPerRow: '8',
  })

  await wrapper.find('[data-testid="options-section-fileFilters"]').trigger('click')
  expect(wrapper.find('[data-testid="options-file-filters-card"]').isVisible()).toBe(true)
  await wrapper.find('[data-testid="file-filters-include"]').setValue('*.bin;*.dat')
  await wrapper.find('[data-testid="file-filters-include"]').trigger('change')
  await wrapper.find('[data-testid="file-filters-exclude"]').setValue('*.tmp')
  await wrapper.find('[data-testid="file-filters-exclude"]').trigger('change')
  await wrapper.find('[data-testid="file-filters-case-sensitive"]').setValue(true)
  expect(JSON.parse(localStorage.getItem('open-diff-folder-name-filters') ?? '{}')).toMatchObject({
    include: ['*.bin', '*.dat'],
    exclude: ['*.tmp'],
    caseSensitive: true,
  })
})

it('persists Formats associations, Profiles defaults, Reports prefs, and Picture defaults', async () => {
  const wrapper = mountSettingsView()

  await wrapper.find('[data-testid="options-section-formats"]').trigger('click')
  expect(wrapper.find('[data-testid="options-formats-card"]').isVisible()).toBe(true)
  await wrapper.find('[data-testid="format-association-images"]').setValue(false)
  await wrapper.find('[data-testid="format-association-plain-text"]').setValue(false)
  await wrapper.find('[data-testid="format-association-zip-archive"]').setValue(false)
  await wrapper.find('[data-testid="format-association-hex-binary"]').setValue(false)

  const formats = JSON.parse(localStorage.getItem('open-diff-file-formats') ?? '[]') as {
    id: string
    enabled?: boolean
  }[]

  expect(formats.find((item) => item.id === 'images')).toMatchObject({ enabled: false })
  expect(formats.find((item) => item.id === 'plain-text')).toMatchObject({ enabled: false })
  expect(formats.find((item) => item.id === 'zip-archive')).toMatchObject({ enabled: false })
  expect(formats.find((item) => item.id === 'hex-binary')).toMatchObject({ enabled: false })
  await wrapper.find('[data-testid="treat-unknown-as-text"]').setValue(true)
  await wrapper.find('[data-testid="prefer-hex-for-no-extension"]').setValue(true)
  expect(
    JSON.parse(localStorage.getItem('open-diff-file-format-preferences') ?? '{}'),
  ).toMatchObject({ treatUnknownAsText: true, preferHexForNoExtension: true })

  await wrapper.find('[data-testid="options-section-profiles"]').trigger('click')
  expect(wrapper.find('[data-testid="options-profiles-card"]').isVisible()).toBe(true)
  await wrapper.find('[data-testid="profile-default-name"]').setValue('Stage Box')
  await wrapper.find('[data-testid="profile-default-name"]').trigger('change')
  await wrapper.find('[data-testid="profile-default-protocol"]').setValue('ftps')
  await wrapper.find('[data-testid="profile-default-protocol"]').trigger('change')
  await wrapper.find('[data-testid="profile-default-host"]').setValue('stage.example.com')
  await wrapper.find('[data-testid="profile-default-host"]').trigger('change')
  await wrapper.find('[data-testid="profile-default-username"]').setValue('deploy')
  await wrapper.find('[data-testid="profile-default-username"]').trigger('change')
  await wrapper.find('[data-testid="profile-default-port"]').setValue('990')
  await wrapper.find('[data-testid="profile-default-port"]').trigger('change')
  await wrapper.find('[data-testid="profile-default-root-path"]').setValue('/data')
  await wrapper.find('[data-testid="profile-default-root-path"]').trigger('change')
  await wrapper.find('[data-testid="profile-connection-timeout"]').setValue('45')
  await wrapper.find('[data-testid="profile-connection-timeout"]').trigger('change')
  await wrapper.find('[data-testid="profile-passive-ftp"]').setValue(false)
  await wrapper.find('[data-testid="profile-anonymous-login"]').setValue(true)
  expect(
    JSON.parse(localStorage.getItem('open-diff-remote-profile-defaults') ?? '{}'),
  ).toMatchObject({
    defaultName: 'Stage Box',
    defaultProtocol: 'ftps',
    defaultHost: 'stage.example.com',
    defaultUsername: 'deploy',
    defaultPort: 990,
    defaultRootPath: '/data',
    connectionTimeoutSeconds: 45,
    passiveFtp: false,
    anonymousLogin: true,
  })

  await wrapper.find('[data-testid="options-section-reports"]').trigger('click')
  expect(wrapper.find('[data-testid="options-reports-card"]').isVisible()).toBe(true)
  await wrapper.find('[data-testid="report-default-format"]').setValue('markdown')
  await wrapper.find('[data-testid="report-default-format"]').trigger('change')
  await wrapper.find('[data-testid="report-default-kind"]').setValue('folder')
  await wrapper.find('[data-testid="report-default-kind"]').trigger('change')
  await wrapper.find('[data-testid="report-open-after-export"]').setValue(true)
  await wrapper.find('[data-testid="report-clear-history-on-exit"]').setValue(true)
  await wrapper.find('[data-testid="report-include-identical"]').setValue(false)
  await wrapper.find('[data-testid="report-include-orphans"]').setValue(false)
  await wrapper.find('[data-testid="report-include-unimportant"]').setValue(false)
  expect(JSON.parse(localStorage.getItem('open-diff-report-preferences') ?? '{}')).toMatchObject({
    defaultFormat: 'markdown',
    defaultKind: 'folder',
    openAfterExport: true,
    clearHistoryOnExit: true,
    includeIdentical: false,
    includeOrphans: false,
    includeUnimportant: false,
  })
  await wrapper.find('[data-testid="open-reports-scripts"]').trigger('click')
  expect(push).toHaveBeenCalledWith('/reports/scripts')

  await wrapper.find('[data-testid="options-section-pictureCompare"]').trigger('click')
  expect(wrapper.find('[data-testid="options-picture-compare-card"]').isVisible()).toBe(true)
  await wrapper.find('[data-testid="picture-rgb-tolerance-default"]').setValue('12')
  await wrapper.find('[data-testid="picture-rgb-tolerance-default"]').trigger('change')
  await wrapper.find('[data-testid="picture-compare-alpha-default"]').setValue(false)
  await wrapper.find('[data-testid="picture-alpha-tolerance-default"]').setValue('8')
  await wrapper.find('[data-testid="picture-alpha-tolerance-default"]').trigger('change')
  await wrapper.find('[data-testid="picture-blend-enabled-default"]').setValue(true)
  await wrapper.find('[data-testid="picture-blend-opacity-default"]').setValue('40')
  await wrapper.find('[data-testid="picture-blend-opacity-default"]').trigger('change')
  await wrapper.find('[data-testid="picture-blend-mode-default"]').setValue('difference')
  await wrapper.find('[data-testid="picture-blend-mode-default"]').trigger('change')
  await wrapper.find('[data-testid="picture-ignore-color-from-default"]').setValue('255,0,0,255')
  await wrapper.find('[data-testid="picture-ignore-color-from-default"]').trigger('change')
  await wrapper.find('[data-testid="picture-ignore-color-to-default"]').setValue('0,255,0')
  await wrapper.find('[data-testid="picture-ignore-color-to-default"]').trigger('change')
  await wrapper.find('[data-testid="picture-show-meta-default"]').setValue(false)
  await wrapper.find('[data-testid="picture-show-minor-default"]').setValue(true)
  expect(
    JSON.parse(localStorage.getItem('open-diff-picture-compare-options') ?? '{}'),
  ).toMatchObject({
    rgbTolerance: 12,
    compareAlpha: false,
    alphaTolerance: 8,
    blendEnabled: true,
    blendOpacity: 40,
    blendMode: 'difference',
    ignoreColorFrom: [255, 0, 0, 255],
    ignoreColorTo: [0, 255, 0, 255],
    showMeta: false,
    showMinor: true,
  })

  await wrapper.find('[data-testid="options-section-mediaCompare"]').trigger('click')
  expect(wrapper.find('[data-testid="options-media-compare-card"]').isVisible()).toBe(true)
  await wrapper.find('[data-testid="media-sync-playback-default"]').setValue(false)
  await wrapper.find('[data-testid="media-default-filter"]').setValue('diffs')
  await wrapper.find('[data-testid="media-default-filter"]').trigger('change')
  await wrapper.find('[data-testid="media-show-rules-default"]').setValue(true)
  expect(JSON.parse(localStorage.getItem('open-diff-media-compare-options') ?? '{}')).toMatchObject(
    {
      syncPlayback: false,
      defaultFilter: 'diffs',
      showRules: true,
    },
  )

  await wrapper.find('[data-testid="options-section-versionCompare"]').trigger('click')
  expect(wrapper.find('[data-testid="options-version-compare-card"]').isVisible()).toBe(true)
  await wrapper.find('[data-testid="version-default-filter"]').setValue('minor')
  await wrapper.find('[data-testid="version-default-filter"]').trigger('change')
  await wrapper.find('[data-testid="version-show-rules-default"]').setValue(true)
  expect(
    JSON.parse(localStorage.getItem('open-diff-version-compare-options') ?? '{}'),
  ).toMatchObject({
    defaultFilter: 'minor',
    showRules: true,
  })

  await wrapper.find('[data-testid="options-section-tableCompare"]').trigger('click')
  expect(wrapper.find('[data-testid="options-table-compare-card"]').isVisible()).toBe(true)
  await wrapper.find('[data-testid="table-key-columns-default"]').setValue('0,1')
  await wrapper.find('[data-testid="table-key-columns-default"]').trigger('change')
  await wrapper.find('[data-testid="table-delimiter-default"]').setValue(';')
  await wrapper.find('[data-testid="table-delimiter-default"]').trigger('change')
  await wrapper.find('[data-testid="table-ignored-columns-default"]').setValue('notes')
  await wrapper.find('[data-testid="table-ignored-columns-default"]').trigger('change')
  await wrapper.find('[data-testid="table-first-row-header-default"]').setValue(false)
  await wrapper.find('[data-testid="table-ignore-case-default"]').setValue(false)
  expect(
    JSON.parse(localStorage.getItem('open-diff-table-compare-session-options') ?? '{}'),
  ).toMatchObject({
    keyColumns: '0,1',
    delimiter: ';',
    ignoredColumns: ['notes'],
    firstRowIsHeader: false,
    ignoreCase: false,
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

it('persists Options depth-3 File Operations and Tweaks leftovers', async () => {
  const wrapper = mountSettingsView()
  const settings = useSettingsStore()

  await wrapper.find('[data-testid="options-section-fileOperations"]').trigger('click')
  await wrapper.find('[data-testid="preserve-timestamps-on-copy"]').setValue(true)
  expect(settings.preserveTimestampsOnCopy).toBe(true)
  await wrapper.find('[data-testid="overwrite-read-only-files"]').setValue(true)
  expect(settings.overwriteReadOnlyFiles).toBe(true)
  await wrapper.find('[data-testid="long-file-operation-threshold"]').setValue('5')
  await wrapper.find('[data-testid="long-file-operation-threshold"]').trigger('change')
  expect(settings.longFileOperationThresholdMs).toBe(5000)

  await wrapper.find('[data-testid="options-section-tweaks"]').trigger('click')
  await wrapper.find('[data-testid="show-milliseconds-in-timestamps"]').setValue(true)
  expect(settings.showMillisecondsInTimestamps).toBe(true)
  wrapper.unmount()
})
