import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it } from 'vitest'
import { useSettingsStore } from './settings'
import { resetArchiveSuffixes } from '@/app/archivePath'
import { commandRegistry } from '@/app/commandRegistry'

describe('useSettingsStore', () => {
  beforeEach(() => {
    localStorage.clear()
    resetArchiveSuffixes()
    setActivePinia(createPinia())
  })

  it('stores shared session file paths without duplicates or empty values', () => {
    const store = useSettingsStore()

    expect(store.addSharedSessionPath('  C:/team/shared.open-diff-session.json  ')).toBe(true)
    expect(store.addSharedSessionPath('C:/team/shared.open-diff-session.json')).toBe(false)
    expect(store.addSharedSessionPath('')).toBe(false)

    expect(store.sharedSessionPaths).toEqual(['C:/team/shared.open-diff-session.json'])
    expect(JSON.parse(localStorage.getItem('open-diff-shared-session-paths') ?? '[]')).toEqual([
      'C:/team/shared.open-diff-session.json',
    ])
  })

  it('removes shared session file paths by value', () => {
    const store = useSettingsStore()

    store.addSharedSessionPath('C:/team/one.open-diff-session.json')
    store.addSharedSessionPath('C:/team/two.open-diff-session.json')

    expect(store.removeSharedSessionPath('C:/team/one.open-diff-session.json')).toBe(true)
    expect(store.removeSharedSessionPath('missing')).toBe(false)
    expect(store.sharedSessionPaths).toEqual(['C:/team/two.open-diff-session.json'])
  })

  it('stores locale preferences and falls back from unsupported values', () => {
    localStorage.setItem('open-diff-locale', 'zh-CN')

    const store = useSettingsStore()

    expect(store.locale).toBe('zh-CN')

    expect(store.setLocale('fr-FR')).toBe(true)
    expect(store.locale).toBe('fr-FR')
    expect(localStorage.getItem('open-diff-locale')).toBe('fr-FR')

    expect(store.setLocale('invalid-locale')).toBe(false)
    expect(store.locale).toBe('fr-FR')
  })

  it('stores shortcut overrides by command id', () => {
    const store = useSettingsStore()

    expect(
      store.setShortcutOverride('theme.toggle', {
        keys: ['Ctrl', 'Shift', 'L'],
        scope: 'global',
      }),
    ).toBe(true)

    expect(store.shortcutOverrides['theme.toggle']).toEqual({
      keys: ['Ctrl', 'Shift', 'L'],
      scope: 'global',
    })
    expect(JSON.parse(localStorage.getItem('open-diff-shortcut-overrides') ?? '{}')).toEqual({
      'theme.toggle': {
        keys: ['Ctrl', 'Shift', 'L'],
        scope: 'global',
      },
    })
  })

  it('returns custom shortcuts when overrides exist and restores command defaults', () => {
    const store = useSettingsStore()
    const themeCommand = commandRegistry.find((command) => command.id === 'theme.toggle')

    if (!themeCommand) {
      throw new Error('theme.toggle command is missing')
    }

    expect(store.getEffectiveShortcut(themeCommand)).toEqual(themeCommand.defaultShortcut)

    store.setShortcutOverride('theme.toggle', {
      keys: ['Ctrl', 'Shift', 'L'],
      scope: 'global',
    })

    expect(store.getEffectiveShortcut(themeCommand)).toEqual({
      keys: ['Ctrl', 'Shift', 'L'],
      scope: 'global',
    })
    expect(store.resetShortcutOverride('theme.toggle')).toBe(true)
    expect(store.shortcutOverrides['theme.toggle']).toBeUndefined()
    expect(store.getEffectiveShortcut(themeCommand)).toEqual(themeCommand.defaultShortcut)
  })

  it('rejects invalid shortcut overrides', () => {
    const store = useSettingsStore()

    expect(
      store.setShortcutOverride('theme.toggle', {
        keys: ['Ctrl', '  '],
        scope: 'global',
      }),
    ).toBe(false)
    expect(
      store.setShortcutOverride('theme.toggle', {
        keys: ['Ctrl', 'K'],
        scope: 'unknown',
      }),
    ).toBe(false)
    expect(store.shortcutOverrides).toEqual({})
    expect(localStorage.getItem('open-diff-shortcut-overrides')).toBe('{}')
  })

  it('stores an auto-save session limit with safe bounds', () => {
    const store = useSettingsStore()

    expect(store.autoSaveLimit).toBe(10)

    store.setAutoSaveLimit(25)

    expect(store.autoSaveLimit).toBe(25)
    expect(localStorage.getItem('open-diff-auto-save-limit')).toBe('25')

    store.setAutoSaveLimit(99)

    expect(store.autoSaveLimit).toBe(50)

    store.setAutoSaveLimit(-1)

    expect(store.autoSaveLimit).toBe(0)
  })

  it('resolves follow-system theme without requiring matchMedia', () => {
    localStorage.setItem('open-diff-theme', 'system')

    const store = useSettingsStore()

    expect(store.theme).toBe('system')
    expect(store.resolvedTheme).toBe('light')
    expect(document.documentElement.dataset.theme).toBe('light')

    store.setTheme('dark')

    expect(store.resolvedTheme).toBe('dark')
    expect(document.documentElement.dataset.theme).toBe('dark')
  })

  it('persists font family and font size onto CSS variables', () => {
    const store = useSettingsStore()

    expect(store.setFontFamily('inter')).toBe(true)
    expect(store.fontFamily).toBe('inter')
    expect(localStorage.getItem('open-diff-font-family')).toBe('inter')
    expect(document.documentElement.style.getPropertyValue('--app-font-family')).toContain('Inter')

    store.setFontSize(20)
    expect(store.fontSize).toBe(20)
    expect(localStorage.getItem('open-diff-font-size')).toBe('20')
    expect(document.documentElement.style.getPropertyValue('--app-font-size')).toBe('20px')

    store.setFontSize(99)
    expect(store.fontSize).toBe(24)
    expect(store.setFontFamily('not-a-font')).toBe(false)
  })

  it('persists and applies custom diff highlight colors', () => {
    const store = useSettingsStore()

    expect(store.setDiffColor('addedBg', '#112233')).toBe(true)
    expect(store.diffColors.addedBg).toBe('#112233')

    const storedColors = JSON.parse(localStorage.getItem('open-diff-diff-colors') ?? '{}') as {
      addedBg?: string
    }

    expect(storedColors.addedBg).toBe('#112233')
    expect(document.documentElement.style.getPropertyValue('--diff-added-bg')).toBe('#112233')

    expect(store.setDiffColor('addedBg', 'not-a-color')).toBe(false)

    store.setTheme('dark')
    store.resetDiffColors()
    expect(store.diffColors.addedFg).toBe('#67d391')
  })

  it('persists confirm-before-delete and wrap-text defaults', () => {
    const store = useSettingsStore()

    expect(store.confirmBeforeDelete).toBe(true)
    expect(store.wrapTextDefault).toBe(false)

    store.setConfirmBeforeDelete(false)
    store.setWrapTextDefault(true)

    expect(localStorage.getItem('open-diff-confirm-before-delete')).toBe('0')
    expect(localStorage.getItem('open-diff-wrap-text-default')).toBe('1')
  })

  it('persists folder compare behavior tweaks', () => {
    const store = useSettingsStore()

    expect(store.confirmBeforeSyncOverwrite).toBe(true)
    expect(store.autoScrollToFirstDifference).toBe(false)
    expect(store.collapseIdenticalFoldersDefault).toBe(false)
    expect(store.showHiddenFiles).toBe(false)
    expect(store.notifyOnCompareComplete).toBe(false)

    store.setConfirmBeforeSyncOverwrite(false)
    store.setAutoScrollToFirstDifference(true)
    store.setCollapseIdenticalFoldersDefault(true)
    store.setShowHiddenFiles(true)
    store.setNotifyOnCompareComplete(true)

    expect(localStorage.getItem('open-diff-confirm-before-sync-overwrite')).toBe('0')
    expect(localStorage.getItem('open-diff-auto-scroll-first-difference')).toBe('1')
    expect(localStorage.getItem('open-diff-collapse-identical-folders-default')).toBe('1')
    expect(localStorage.getItem('open-diff-show-hidden-files')).toBe('1')
    expect(localStorage.getItem('open-diff-notify-on-compare-complete')).toBe('1')
  })

  it('persists toolbar and backup option defaults', () => {
    const store = useSettingsStore()

    expect(store.showSessionToolbars).toBe(true)
    expect(store.showToolbarLabels).toBe(true)
    expect(store.largeToolbarButtons).toBe(true)
    expect(store.createBackupOnSave).toBe(true)
    expect(store.backupRetentionCount).toBe(1)
    expect(store.showSessionsInToolbar).toBe(false)
    expect(store.showGotoInToolbar).toBe(false)
    expect(store.showWrapInToolbar).toBe(false)
    expect(store.showSyncNowInToolbar).toBe(false)
    expect(store.showSyncCancelAcceptInToolbar).toBe(false)

    store.setShowSessionToolbars(false)
    store.setShowToolbarLabels(false)
    store.setLargeToolbarButtons(false)
    store.setCreateBackupOnSave(false)
    store.setBackupRetentionCount(3)
    store.setShowSessionsInToolbar(true)
    store.setShowGotoInToolbar(true)
    store.setShowWrapInToolbar(true)
    store.setShowSyncNowInToolbar(true)
    store.setShowSyncCancelAcceptInToolbar(true)

    expect(localStorage.getItem('open-diff-show-session-toolbars')).toBe('0')
    expect(localStorage.getItem('open-diff-show-toolbar-labels')).toBe('0')
    expect(localStorage.getItem('open-diff-large-toolbar-buttons')).toBe('0')
    expect(localStorage.getItem('open-diff-create-backup-on-save')).toBe('0')
    expect(localStorage.getItem('open-diff-backup-retention-count')).toBe('3')
    expect(localStorage.getItem('open-diff-show-sessions-in-toolbar')).toBe('1')
    expect(localStorage.getItem('open-diff-show-goto-in-toolbar')).toBe('1')
    expect(localStorage.getItem('open-diff-show-wrap-in-toolbar')).toBe('1')
    expect(localStorage.getItem('open-diff-show-sync-now-in-toolbar')).toBe('1')
    expect(localStorage.getItem('open-diff-show-sync-cancel-accept-in-toolbar')).toBe('1')
  })

  it('persists status bar and path bar appearance chrome', () => {
    const store = useSettingsStore()

    expect(store.showStatusBar).toBe(true)
    expect(store.showPathBars).toBe(true)
    expect(document.documentElement.dataset.showPathBars).toBe('1')

    store.setShowStatusBar(false)
    store.setShowPathBars(false)

    expect(localStorage.getItem('open-diff-show-status-bar')).toBe('0')
    expect(localStorage.getItem('open-diff-show-path-bars')).toBe('0')
    expect(document.documentElement.dataset.showPathBars).toBe('0')
  })

  it('persists load-last-workspace-on-startup default off', () => {
    const store = useSettingsStore()

    expect(store.loadLastWorkspaceOnStartup).toBe(false)
    store.setLoadLastWorkspaceOnStartup(true)
    expect(localStorage.getItem('open-diff-load-last-workspace-on-startup')).toBe('1')
    store.restoreFactoryDefaults()
    expect(store.loadLastWorkspaceOnStartup).toBe(false)
  })
  it('exports, imports, and restores factory settings packages', () => {
    const store = useSettingsStore()

    store.setTheme('dark')
    store.setLocale('zh-CN')
    store.setFontSize(18)

    const exported = store.exportSettingsPackage()

    expect(exported.theme).toBe('dark')
    expect(exported.locale).toBe('zh-CN')
    expect(exported.fontSize).toBe(18)

    store.restoreFactoryDefaults()
    expect(store.theme).toBe('light')
    expect(store.locale).toBe('en-US')
    expect(store.fontSize).toBe(14)

    expect(store.importSettingsPackage(exported)).toBe(true)
    expect(store.theme).toBe('dark')
    expect(store.locale).toBe('zh-CN')
    expect(store.fontSize).toBe(18)
    expect(store.importSettingsPackage('{')).toBe(false)
  })
  it('persists sidebar, toolbar icons, dirty-tab confirm, and overwrite-save confirm', () => {
    const store = useSettingsStore()

    expect(store.showSidebar).toBe(false)
    expect(store.showToolbarIcons).toBe(true)
    expect(store.confirmBeforeCloseDirtyTab).toBe(true)
    expect(store.confirmBeforeOverwriteSave).toBe(false)

    store.setShowSidebar(true)
    store.setShowToolbarIcons(false)
    store.setConfirmBeforeCloseDirtyTab(false)
    store.setConfirmBeforeOverwriteSave(true)

    expect(document.documentElement.dataset.showSidebar).toBe('1')
    expect(localStorage.getItem('open-diff-show-sidebar')).toBe('1')
    expect(localStorage.getItem('open-diff-show-toolbar-icons')).toBe('0')
    expect(localStorage.getItem('open-diff-confirm-before-close-dirty-tab')).toBe('0')
    expect(localStorage.getItem('open-diff-confirm-before-overwrite-save')).toBe('1')
  })
  it('persists tab bar, new-tab sessions, difference toolbar, and archive extensions', () => {
    const store = useSettingsStore()

    expect(store.alwaysShowTabBar).toBe(false)
    expect(store.openSessionsInNewTab).toBe(false)
    expect(store.showNextDifferenceInToolbar).toBe(true)
    expect(store.showPrevDifferenceInToolbar).toBe(true)
    expect(store.archiveExtensions).toContain('.zip')

    store.setAlwaysShowTabBar(true)
    expect(localStorage.getItem('open-diff-always-show-tab-bar')).toBe('1')
    store.setAlwaysShowTabBar(false)
    store.setOpenSessionsInNewTab(true)
    store.setShowNextDifferenceInToolbar(false)
    store.setShowPrevDifferenceInToolbar(false)
    store.setArchiveExtensions(['.zip', 'rar'])

    expect(localStorage.getItem('open-diff-always-show-tab-bar')).toBe('0')
    expect(localStorage.getItem('open-diff-open-sessions-in-new-tab')).toBe('1')
    expect(localStorage.getItem('open-diff-show-next-difference-in-toolbar')).toBe('0')
    expect(localStorage.getItem('open-diff-show-prev-difference-in-toolbar')).toBe('0')
    expect(store.archiveExtensions).toEqual(['.rar', '.zip'])
  })

  it('persists folder status legend visibility', () => {
    const store = useSettingsStore()

    expect(store.showFolderLegend).toBe(false)
    store.setShowFolderLegend(true)
    expect(store.showFolderLegend).toBe(true)
    expect(localStorage.getItem('open-diff-show-folder-legend')).toBe('1')

    store.setShowFolderLegend(false)
    expect(store.showFolderLegend).toBe(false)
    expect(localStorage.getItem('open-diff-show-folder-legend')).toBe('0')
  })

  it('persists Confirmations copy/move/sync-delete and Backup report-export defaults', () => {
    const store = useSettingsStore()

    expect(store.confirmBeforeCopy).toBe(true)
    expect(store.confirmBeforeMove).toBe(false)
    expect(store.confirmBeforeSyncDelete).toBe(true)
    expect(store.createBackupOnReportExport).toBe(false)

    store.setConfirmBeforeCopy(false)
    store.setConfirmBeforeMove(true)
    store.setConfirmBeforeSyncDelete(false)
    store.setCreateBackupOnReportExport(true)

    expect(localStorage.getItem('open-diff-confirm-before-copy')).toBe('0')
    expect(localStorage.getItem('open-diff-confirm-before-move')).toBe('1')
    expect(localStorage.getItem('open-diff-confirm-before-sync-delete')).toBe('0')
    expect(localStorage.getItem('open-diff-create-backup-on-report-export')).toBe('1')

    store.setConfirmBeforeCopy(true)
    store.setConfirmBeforeMove(false)
    store.setConfirmBeforeSyncDelete(true)
    store.setCreateBackupOnReportExport(false)
  })

  it('persists File Operations, Archive RAR, and remaining Tweaks leftovers', () => {
    const store = useSettingsStore()

    expect(store.includeHiddenItemsInFileActions).toBe(false)
    expect(store.beepAfterLongFileOperations).toBe(false)
    expect(store.enableRarArchiveTypes).toBe(false)
    expect(store.escClosesFileViews).toBe(false)
    expect(store.beepWhenScriptFinished).toBe(false)
    expect(store.closeWhenScriptFinished).toBe(false)

    store.setIncludeHiddenItemsInFileActions(true)
    store.setBeepAfterLongFileOperations(true)
    store.setEnableRarArchiveTypes(true)
    store.setEscClosesFileViews(true)
    store.setBeepWhenScriptFinished(true)
    store.setCloseWhenScriptFinished(true)

    expect(localStorage.getItem('open-diff-include-hidden-items-in-file-actions')).toBe('1')
    expect(localStorage.getItem('open-diff-beep-after-long-file-operations')).toBe('1')
    expect(localStorage.getItem('open-diff-enable-rar-archive-types')).toBe('1')
    expect(localStorage.getItem('open-diff-esc-closes-file-views')).toBe('1')
    expect(localStorage.getItem('open-diff-beep-when-script-finished')).toBe('1')
    expect(localStorage.getItem('open-diff-close-when-script-finished')).toBe('1')
    expect(store.archiveExtensions).toContain('.rar')

    store.setEnableRarArchiveTypes(false)
    expect(store.archiveExtensions).not.toContain('.rar')
  })
})
