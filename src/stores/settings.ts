import { defineStore } from 'pinia'
import { computed, ref, watch } from 'vue'
import {
  commandRegistry,
  type AppCommand,
  type CommandId,
  type CommandShortcut,
  type ShortcutScope,
} from '@/app/commandRegistry'
import { fallbackLocale, isSupportedLocale, type SupportedLocale } from '@/i18n/core'
import {
  isSettingsPackage,
  parseSettingsPackage,
  settingsPackageKind,
  settingsPackageVersion,
  type SettingsPackage,
} from '@/app/settingsPackage'
import {
  getArchiveSuffixes,
  loadArchiveSuffixes,
  resetArchiveSuffixes,
  setArchiveSuffixes,
} from '@/app/archivePath'
import { clampBinaryCompareBufferSize, type BinaryCompareBufferSize } from '@/app/diskChangeReload'
import {
  loadHexCompareSessionOptions,
  saveHexCompareSessionOptions,
} from '@/app/hexCompareSessionOptions'
import { setPreferIpv6 } from '@/api/remote'

export type ThemeMode = 'light' | 'dark' | 'system'
export type FontFamilyId = 'system' | 'segoe' | 'inter' | 'noto' | 'mono'

export interface DiffHighlightColors {
  addedBg: string
  addedFg: string
  deletedBg: string
  deletedFg: string
  modifiedBg: string
  modifiedFg: string
}

export const fontFamilyOptions: Record<FontFamilyId, string> = {
  system: 'ui-sans-serif, system-ui, sans-serif',
  segoe: "'Segoe UI', 'PingFang SC', 'Microsoft YaHei', ui-sans-serif, system-ui, sans-serif",
  inter:
    'Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", "PingFang SC", "Microsoft YaHei", sans-serif',
  noto: "'Noto Sans', 'Noto Sans SC', 'Noto Sans JP', ui-sans-serif, system-ui, sans-serif",
  mono: "var(--font-mono), 'JetBrains Mono', 'Cascadia Mono', Consolas, monospace",
}

export const defaultDiffHighlightColors: DiffHighlightColors = {
  addedBg: '#f4fff4',
  addedFg: '#005f18',
  deletedBg: '#ffe3e3',
  deletedFg: '#e00000',
  modifiedBg: '#ffe3e3',
  modifiedFg: '#e00000',
}

export const defaultDarkDiffHighlightColors: DiffHighlightColors = {
  addedBg: '#1f3d2e',
  addedFg: '#67d391',
  deletedBg: '#3d2220',
  deletedFg: '#ff8a80',
  modifiedBg: '#3d3420',
  modifiedFg: '#f5c56b',
}

const sharedSessionPathsStorageKey = 'open-diff-shared-session-paths'
const localeStorageKey = 'open-diff-locale'
const shortcutOverridesStorageKey = 'open-diff-shortcut-overrides'
const autoSaveLimitStorageKey = 'open-diff-auto-save-limit'
const fontFamilyStorageKey = 'open-diff-font-family'
const fontSizeStorageKey = 'open-diff-font-size'
const diffColorsStorageKey = 'open-diff-diff-colors'
const confirmBeforeDeleteStorageKey = 'open-diff-confirm-before-delete'
const wrapTextDefaultStorageKey = 'open-diff-wrap-text-default'
const confirmBeforeSyncOverwriteStorageKey = 'open-diff-confirm-before-sync-overwrite'
const autoScrollToFirstDifferenceStorageKey = 'open-diff-auto-scroll-first-difference'
const collapseIdenticalFoldersDefaultStorageKey = 'open-diff-collapse-identical-folders-default'
const showHiddenFilesStorageKey = 'open-diff-show-hidden-files'
const notifyOnCompareCompleteStorageKey = 'open-diff-notify-on-compare-complete'
const showSessionToolbarsStorageKey = 'open-diff-show-session-toolbars'
const showFolderLegendStorageKey = 'open-diff-show-folder-legend'
const showToolbarLabelsStorageKey = 'open-diff-show-toolbar-labels'
const largeToolbarButtonsStorageKey = 'open-diff-large-toolbar-buttons'
const createBackupOnSaveStorageKey = 'open-diff-create-backup-on-save'
const backupRetentionCountStorageKey = 'open-diff-backup-retention-count'
const showSessionsInToolbarStorageKey = 'open-diff-show-sessions-in-toolbar'
const showGotoInToolbarStorageKey = 'open-diff-show-goto-in-toolbar'
const showWrapInToolbarStorageKey = 'open-diff-show-wrap-in-toolbar'
const showSyncNowInToolbarStorageKey = 'open-diff-show-sync-now-in-toolbar'
const showSyncCancelAcceptInToolbarStorageKey = 'open-diff-show-sync-cancel-accept-in-toolbar'
const showStatusBarStorageKey = 'open-diff-show-status-bar'
const showPathBarsStorageKey = 'open-diff-show-path-bars'
const showSidebarStorageKey = 'open-diff-show-sidebar'
const showToolbarIconsStorageKey = 'open-diff-show-toolbar-icons'
const confirmBeforeCloseDirtyTabStorageKey = 'open-diff-confirm-before-close-dirty-tab'
const confirmBeforeOverwriteSaveStorageKey = 'open-diff-confirm-before-overwrite-save'
const alwaysShowTabBarStorageKey = 'open-diff-always-show-tab-bar'
const openSessionsInNewTabStorageKey = 'open-diff-open-sessions-in-new-tab'
const showNextDifferenceInToolbarStorageKey = 'open-diff-show-next-difference-in-toolbar'
const showPrevDifferenceInToolbarStorageKey = 'open-diff-show-prev-difference-in-toolbar'
const loadLastWorkspaceOnStartupStorageKey = 'open-diff-load-last-workspace-on-startup'
const showChromeUtilitiesStorageKey = 'open-diff-show-chrome-utilities'
const confirmBeforeQuitStorageKey = 'open-diff-confirm-before-quit'
const confirmBeforeCopyStorageKey = 'open-diff-confirm-before-copy'
const confirmBeforeMoveStorageKey = 'open-diff-confirm-before-move'
const confirmBeforeSyncDeleteStorageKey = 'open-diff-confirm-before-sync-delete'
const createBackupOnReportExportStorageKey = 'open-diff-create-backup-on-report-export'
const includeHiddenItemsInFileActionsStorageKey = 'open-diff-include-hidden-items-in-file-actions'
const beepAfterLongFileOperationsStorageKey = 'open-diff-beep-after-long-file-operations'
const preserveTimestampsOnCopyStorageKey = 'open-diff-preserve-timestamps-on-copy'
const overwriteReadOnlyFilesStorageKey = 'open-diff-overwrite-read-only-files'
const longFileOperationThresholdMsStorageKey = 'open-diff-long-file-operation-threshold-ms'
const showMillisecondsInTimestampsStorageKey = 'open-diff-show-milliseconds-in-timestamps'
const enableRarArchiveTypesStorageKey = 'open-diff-enable-rar-archive-types'
const escClosesFileViewsStorageKey = 'open-diff-esc-closes-file-views'
const beepWhenScriptFinishedStorageKey = 'open-diff-beep-when-script-finished'
const closeWhenScriptFinishedStorageKey = 'open-diff-close-when-script-finished'
const checkForFilesChangedOnDiskStorageKey = 'open-diff-check-for-files-changed-on-disk'
const autoReloadUnlessChangesDiscardedStorageKey = 'open-diff-auto-reload-unless-changes-discarded'
const stickyHomeSessionSelectionStorageKey = 'open-diff-sticky-home-session-selection'
const stickyHomeSessionIdStorageKey = 'open-diff-sticky-home-session-id'
const preferIpv6WhenAvailableStorageKey = 'open-diff-prefer-ipv6-when-available'
const watchFoldersForChangesStorageKey = 'open-diff-watch-folders-for-changes'
const binaryCompareBufferSizeStorageKey = 'open-diff-binary-compare-buffer-size'
const fontFamilyIds = new Set<FontFamilyId>(['system', 'segoe', 'inter', 'noto', 'mono'])
const shortcutScopes = new Set<ShortcutScope>(['global', 'text-compare'])
const commandIds = new Set<string>(commandRegistry.map((command) => command.id))

type ShortcutOverrides = Partial<Record<CommandId, CommandShortcut>>

export const useSettingsStore = defineStore('settings', () => {
  const theme = ref<ThemeMode>(loadTheme())
  const systemPrefersDark = ref(prefersDarkTheme())
  const resolvedTheme = computed(() => {
    if (theme.value === 'system') {
      return systemPrefersDark.value ? 'dark' : 'light'
    }

    return theme.value
  })
  const locale = ref<SupportedLocale>(loadLocale())
  const sharedSessionPaths = ref<string[]>(loadSharedSessionPaths())
  const shortcutOverrides = ref<ShortcutOverrides>(loadShortcutOverrides())
  const autoSaveLimit = ref(loadAutoSaveLimit())
  const fontFamily = ref<FontFamilyId>(loadFontFamily())
  const fontSize = ref(loadFontSize())
  const diffColors = ref<DiffHighlightColors>(loadDiffColors())
  const confirmBeforeDelete = ref(loadConfirmBeforeDelete())
  const wrapTextDefault = ref(loadWrapTextDefault())
  const confirmBeforeSyncOverwrite = ref(loadConfirmBeforeSyncOverwrite())
  const autoScrollToFirstDifference = ref(loadAutoScrollToFirstDifference())
  const collapseIdenticalFoldersDefault = ref(loadCollapseIdenticalFoldersDefault())
  const showHiddenFiles = ref(loadShowHiddenFiles())
  const notifyOnCompareComplete = ref(loadNotifyOnCompareComplete())
  const showSessionToolbars = ref(loadShowSessionToolbars())
  const showFolderLegend = ref(loadShowFolderLegend())
  const showToolbarLabels = ref(loadShowToolbarLabels())
  const largeToolbarButtons = ref(loadLargeToolbarButtons())
  const createBackupOnSave = ref(loadCreateBackupOnSave())
  const backupRetentionCount = ref(loadBackupRetentionCount())
  const showSessionsInToolbar = ref(loadShowSessionsInToolbar())
  const showGotoInToolbar = ref(loadShowGotoInToolbar())
  const showWrapInToolbar = ref(loadShowWrapInToolbar())
  const showSyncNowInToolbar = ref(loadShowSyncNowInToolbar())
  const showSyncCancelAcceptInToolbar = ref(loadShowSyncCancelAcceptInToolbar())
  const showStatusBar = ref(loadShowStatusBar())
  const showPathBars = ref(loadShowPathBars())
  const showSidebar = ref(loadShowSidebar())
  const showToolbarIcons = ref(loadShowToolbarIcons())
  const confirmBeforeCloseDirtyTab = ref(loadConfirmBeforeCloseDirtyTab())
  const confirmBeforeOverwriteSave = ref(loadConfirmBeforeOverwriteSave())
  const alwaysShowTabBar = ref(loadAlwaysShowTabBar())
  const openSessionsInNewTab = ref(loadOpenSessionsInNewTab())
  const showNextDifferenceInToolbar = ref(loadShowNextDifferenceInToolbar())
  const showPrevDifferenceInToolbar = ref(loadShowPrevDifferenceInToolbar())
  const archiveExtensions = ref<string[]>(setArchiveSuffixes(loadArchiveSuffixes()))
  const loadLastWorkspaceOnStartup = ref(loadLoadLastWorkspaceOnStartup())
  const showChromeUtilities = ref(loadShowChromeUtilities())
  const confirmBeforeQuit = ref(loadConfirmBeforeQuit())
  const confirmBeforeCopy = ref(loadConfirmBeforeCopy())
  const confirmBeforeMove = ref(loadConfirmBeforeMove())
  const confirmBeforeSyncDelete = ref(loadConfirmBeforeSyncDelete())
  const createBackupOnReportExport = ref(loadCreateBackupOnReportExport())
  const includeHiddenItemsInFileActions = ref(loadIncludeHiddenItemsInFileActions())
  const beepAfterLongFileOperations = ref(loadBeepAfterLongFileOperations())
  const preserveTimestampsOnCopy = ref(loadPreserveTimestampsOnCopy())
  const overwriteReadOnlyFiles = ref(loadOverwriteReadOnlyFiles())
  const longFileOperationThresholdMs = ref(loadLongFileOperationThresholdMs())
  const showMillisecondsInTimestamps = ref(loadShowMillisecondsInTimestamps())
  const enableRarArchiveTypes = ref(loadEnableRarArchiveTypes())
  const escClosesFileViews = ref(loadEscClosesFileViews())
  const beepWhenScriptFinished = ref(loadBeepWhenScriptFinished())
  const closeWhenScriptFinished = ref(loadCloseWhenScriptFinished())
  const checkForFilesChangedOnDisk = ref(loadCheckForFilesChangedOnDisk())
  const autoReloadUnlessChangesDiscarded = ref(loadAutoReloadUnlessChangesDiscarded())
  const stickyHomeSessionSelection = ref(loadStickyHomeSessionSelection())
  const stickyHomeSessionId = ref(loadStickyHomeSessionId())
  const preferIpv6WhenAvailable = ref(loadPreferIpv6WhenAvailable())
  const watchFoldersForChanges = ref(loadWatchFoldersForChanges())
  const binaryCompareBufferSize = ref(loadBinaryCompareBufferSize())

  bindSystemThemeListener((prefersDark) => {
    systemPrefersDark.value = prefersDark
  })

  watch(
    [theme, resolvedTheme],
    ([nextTheme, nextResolved]) => {
      localStorage.setItem('open-diff-theme', nextTheme)
      document.documentElement.dataset.theme = nextResolved
    },
    { immediate: true, flush: 'sync' },
  )

  watch(
    sharedSessionPaths,
    (value) => {
      localStorage.setItem(sharedSessionPathsStorageKey, JSON.stringify(value))
    },
    { deep: true, flush: 'sync' },
  )

  watch(
    locale,
    (value) => {
      localStorage.setItem(localeStorageKey, value)
      document.documentElement.lang = value
    },
    { immediate: true, flush: 'sync' },
  )

  watch(
    shortcutOverrides,
    (value) => {
      localStorage.setItem(shortcutOverridesStorageKey, JSON.stringify(value))
    },
    { deep: true, immediate: true, flush: 'sync' },
  )

  watch(
    autoSaveLimit,
    (value) => {
      localStorage.setItem(autoSaveLimitStorageKey, String(value))
    },
    { immediate: true, flush: 'sync' },
  )

  watch(
    fontFamily,
    (value) => {
      localStorage.setItem(fontFamilyStorageKey, value)
      document.documentElement.style.setProperty('--app-font-family', fontFamilyOptions[value])
    },
    { immediate: true, flush: 'sync' },
  )

  watch(
    fontSize,
    (value) => {
      localStorage.setItem(fontSizeStorageKey, String(value))
      document.documentElement.style.setProperty('--app-font-size', `${String(value)}px`)
    },
    { immediate: true, flush: 'sync' },
  )

  watch(
    diffColors,
    (value) => {
      localStorage.setItem(diffColorsStorageKey, JSON.stringify(value))
      applyDiffColors(value)
    },
    { deep: true, immediate: true, flush: 'sync' },
  )

  watch(
    confirmBeforeDelete,
    (value) => {
      localStorage.setItem(confirmBeforeDeleteStorageKey, value ? '1' : '0')
    },
    { immediate: true, flush: 'sync' },
  )

  watch(
    wrapTextDefault,
    (value) => {
      localStorage.setItem(wrapTextDefaultStorageKey, value ? '1' : '0')
    },
    { immediate: true, flush: 'sync' },
  )

  watch(
    confirmBeforeSyncOverwrite,
    (value) => {
      localStorage.setItem(confirmBeforeSyncOverwriteStorageKey, value ? '1' : '0')
    },
    { immediate: true, flush: 'sync' },
  )

  watch(
    autoScrollToFirstDifference,
    (value) => {
      localStorage.setItem(autoScrollToFirstDifferenceStorageKey, value ? '1' : '0')
    },
    { immediate: true, flush: 'sync' },
  )

  watch(
    collapseIdenticalFoldersDefault,
    (value) => {
      localStorage.setItem(collapseIdenticalFoldersDefaultStorageKey, value ? '1' : '0')
    },
    { immediate: true, flush: 'sync' },
  )

  watch(
    showHiddenFiles,
    (value) => {
      localStorage.setItem(showHiddenFilesStorageKey, value ? '1' : '0')
    },
    { immediate: true, flush: 'sync' },
  )

  watch(
    notifyOnCompareComplete,
    (value) => {
      localStorage.setItem(notifyOnCompareCompleteStorageKey, value ? '1' : '0')
    },
    { immediate: true, flush: 'sync' },
  )

  watch(
    showSessionToolbars,
    (value) => {
      localStorage.setItem(showSessionToolbarsStorageKey, value ? '1' : '0')
    },
    { immediate: true, flush: 'sync' },
  )

  watch(
    showFolderLegend,
    (value) => {
      localStorage.setItem(showFolderLegendStorageKey, value ? '1' : '0')
    },
    { immediate: true, flush: 'sync' },
  )

  watch(
    showToolbarLabels,
    (value) => {
      localStorage.setItem(showToolbarLabelsStorageKey, value ? '1' : '0')
    },
    { immediate: true, flush: 'sync' },
  )

  watch(
    largeToolbarButtons,
    (value) => {
      localStorage.setItem(largeToolbarButtonsStorageKey, value ? '1' : '0')
    },
    { immediate: true, flush: 'sync' },
  )

  watch(
    createBackupOnSave,
    (value) => {
      localStorage.setItem(createBackupOnSaveStorageKey, value ? '1' : '0')
    },
    { immediate: true, flush: 'sync' },
  )

  watch(
    backupRetentionCount,
    (value) => {
      localStorage.setItem(backupRetentionCountStorageKey, String(value))
    },
    { immediate: true, flush: 'sync' },
  )

  watch(
    showSessionsInToolbar,
    (value) => {
      localStorage.setItem(showSessionsInToolbarStorageKey, value ? '1' : '0')
    },
    { immediate: true, flush: 'sync' },
  )

  watch(
    showGotoInToolbar,
    (value) => {
      localStorage.setItem(showGotoInToolbarStorageKey, value ? '1' : '0')
    },
    { immediate: true, flush: 'sync' },
  )

  watch(
    showWrapInToolbar,
    (value) => {
      localStorage.setItem(showWrapInToolbarStorageKey, value ? '1' : '0')
    },
    { immediate: true, flush: 'sync' },
  )

  watch(
    showSyncNowInToolbar,
    (value) => {
      localStorage.setItem(showSyncNowInToolbarStorageKey, value ? '1' : '0')
    },
    { immediate: true, flush: 'sync' },
  )

  watch(
    showSyncCancelAcceptInToolbar,
    (value) => {
      localStorage.setItem(showSyncCancelAcceptInToolbarStorageKey, value ? '1' : '0')
    },
    { immediate: true, flush: 'sync' },
  )

  watch(
    showStatusBar,
    (value) => {
      localStorage.setItem(showStatusBarStorageKey, value ? '1' : '0')
    },
    { immediate: true, flush: 'sync' },
  )

  watch(
    showPathBars,
    (value) => {
      localStorage.setItem(showPathBarsStorageKey, value ? '1' : '0')
      document.documentElement.dataset.showPathBars = value ? '1' : '0'
    },
    { immediate: true, flush: 'sync' },
  )

  watch(
    showSidebar,
    (value) => {
      localStorage.setItem(showSidebarStorageKey, value ? '1' : '0')
      document.documentElement.dataset.showSidebar = value ? '1' : '0'
    },
    { immediate: true, flush: 'sync' },
  )

  watch(
    showToolbarIcons,
    (value) => {
      localStorage.setItem(showToolbarIconsStorageKey, value ? '1' : '0')
    },
    { immediate: true, flush: 'sync' },
  )

  watch(
    confirmBeforeCloseDirtyTab,
    (value) => {
      localStorage.setItem(confirmBeforeCloseDirtyTabStorageKey, value ? '1' : '0')
    },
    { immediate: true, flush: 'sync' },
  )

  watch(
    confirmBeforeOverwriteSave,
    (value) => {
      localStorage.setItem(confirmBeforeOverwriteSaveStorageKey, value ? '1' : '0')
    },
    { immediate: true, flush: 'sync' },
  )

  watch(
    alwaysShowTabBar,
    (value) => {
      localStorage.setItem(alwaysShowTabBarStorageKey, value ? '1' : '0')
    },
    { immediate: true, flush: 'sync' },
  )

  watch(
    openSessionsInNewTab,
    (value) => {
      localStorage.setItem(openSessionsInNewTabStorageKey, value ? '1' : '0')
    },
    { immediate: true, flush: 'sync' },
  )

  watch(
    showNextDifferenceInToolbar,
    (value) => {
      localStorage.setItem(showNextDifferenceInToolbarStorageKey, value ? '1' : '0')
    },
    { immediate: true, flush: 'sync' },
  )

  watch(
    showPrevDifferenceInToolbar,
    (value) => {
      localStorage.setItem(showPrevDifferenceInToolbarStorageKey, value ? '1' : '0')
    },
    { immediate: true, flush: 'sync' },
  )

  watch(
    archiveExtensions,
    (value) => {
      setArchiveSuffixes(value)
    },
    { flush: 'sync' },
  )

  watch(
    loadLastWorkspaceOnStartup,
    (value) => {
      localStorage.setItem(loadLastWorkspaceOnStartupStorageKey, value ? '1' : '0')
    },
    { immediate: true, flush: 'sync' },
  )

  watch(
    showChromeUtilities,
    (value) => {
      localStorage.setItem(showChromeUtilitiesStorageKey, value ? '1' : '0')
    },
    { immediate: true, flush: 'sync' },
  )

  watch(
    confirmBeforeQuit,
    (value) => {
      localStorage.setItem(confirmBeforeQuitStorageKey, value ? '1' : '0')
    },
    { immediate: true, flush: 'sync' },
  )

  watch(
    confirmBeforeCopy,
    (value) => {
      localStorage.setItem(confirmBeforeCopyStorageKey, value ? '1' : '0')
    },
    { immediate: true, flush: 'sync' },
  )

  watch(
    confirmBeforeMove,
    (value) => {
      localStorage.setItem(confirmBeforeMoveStorageKey, value ? '1' : '0')
    },
    { immediate: true, flush: 'sync' },
  )

  watch(
    confirmBeforeSyncDelete,
    (value) => {
      localStorage.setItem(confirmBeforeSyncDeleteStorageKey, value ? '1' : '0')
    },
    { immediate: true, flush: 'sync' },
  )

  watch(
    createBackupOnReportExport,
    (value) => {
      localStorage.setItem(createBackupOnReportExportStorageKey, value ? '1' : '0')
    },
    { immediate: true, flush: 'sync' },
  )

  watch(
    includeHiddenItemsInFileActions,
    (value) => {
      localStorage.setItem(includeHiddenItemsInFileActionsStorageKey, value ? '1' : '0')
    },
    { immediate: true, flush: 'sync' },
  )

  watch(
    beepAfterLongFileOperations,
    (value) => {
      localStorage.setItem(beepAfterLongFileOperationsStorageKey, value ? '1' : '0')
    },
    { immediate: true, flush: 'sync' },
  )

  watch(
    preserveTimestampsOnCopy,
    (value) => {
      localStorage.setItem(preserveTimestampsOnCopyStorageKey, value ? '1' : '0')
    },
    { immediate: true, flush: 'sync' },
  )

  watch(
    overwriteReadOnlyFiles,
    (value) => {
      localStorage.setItem(overwriteReadOnlyFilesStorageKey, value ? '1' : '0')
    },
    { immediate: true, flush: 'sync' },
  )

  watch(
    longFileOperationThresholdMs,
    (value) => {
      localStorage.setItem(longFileOperationThresholdMsStorageKey, String(value))
    },
    { immediate: true, flush: 'sync' },
  )

  watch(
    showMillisecondsInTimestamps,
    (value) => {
      localStorage.setItem(showMillisecondsInTimestampsStorageKey, value ? '1' : '0')
    },
    { immediate: true, flush: 'sync' },
  )

  watch(
    enableRarArchiveTypes,
    (value) => {
      localStorage.setItem(enableRarArchiveTypesStorageKey, value ? '1' : '0')
    },
    { immediate: true, flush: 'sync' },
  )

  watch(
    escClosesFileViews,
    (value) => {
      localStorage.setItem(escClosesFileViewsStorageKey, value ? '1' : '0')
    },
    { immediate: true, flush: 'sync' },
  )

  watch(
    beepWhenScriptFinished,
    (value) => {
      localStorage.setItem(beepWhenScriptFinishedStorageKey, value ? '1' : '0')
    },
    { immediate: true, flush: 'sync' },
  )

  watch(
    closeWhenScriptFinished,
    (value) => {
      localStorage.setItem(closeWhenScriptFinishedStorageKey, value ? '1' : '0')
    },
    { immediate: true, flush: 'sync' },
  )

  watch(
    checkForFilesChangedOnDisk,
    (value) => {
      localStorage.setItem(checkForFilesChangedOnDiskStorageKey, value ? '1' : '0')
    },
    { immediate: true, flush: 'sync' },
  )

  watch(
    autoReloadUnlessChangesDiscarded,
    (value) => {
      localStorage.setItem(autoReloadUnlessChangesDiscardedStorageKey, value ? '1' : '0')
    },
    { immediate: true, flush: 'sync' },
  )

  watch(
    stickyHomeSessionSelection,
    (value) => {
      localStorage.setItem(stickyHomeSessionSelectionStorageKey, value ? '1' : '0')
    },
    { immediate: true, flush: 'sync' },
  )

  watch(
    stickyHomeSessionId,
    (value) => {
      if (value) {
        localStorage.setItem(stickyHomeSessionIdStorageKey, value)
      } else {
        localStorage.removeItem(stickyHomeSessionIdStorageKey)
      }
    },
    { immediate: true, flush: 'sync' },
  )

  watch(
    preferIpv6WhenAvailable,
    (value) => {
      localStorage.setItem(preferIpv6WhenAvailableStorageKey, value ? '1' : '0')
      syncPreferIpv6Backend(value)
    },
    { immediate: true, flush: 'sync' },
  )

  watch(
    watchFoldersForChanges,
    (value) => {
      localStorage.setItem(watchFoldersForChangesStorageKey, value ? '1' : '0')
    },
    { immediate: true, flush: 'sync' },
  )

  watch(
    binaryCompareBufferSize,
    (value) => {
      localStorage.setItem(binaryCompareBufferSizeStorageKey, String(value))
      const hexOptions = loadHexCompareSessionOptions()

      if (hexOptions.windowLength !== value) {
        saveHexCompareSessionOptions({ ...hexOptions, windowLength: value })
      }
    },
    { immediate: true, flush: 'sync' },
  )

  function toggleTheme(): void {
    theme.value = resolvedTheme.value === 'dark' ? 'light' : 'dark'
  }

  function setTheme(nextTheme: ThemeMode): void {
    theme.value = nextTheme
  }

  function addSharedSessionPath(path: string): boolean {
    const normalized = path.trim()

    if (!normalized || sharedSessionPaths.value.includes(normalized)) {
      return false
    }

    sharedSessionPaths.value = [...sharedSessionPaths.value, normalized]

    return true
  }

  function removeSharedSessionPath(path: string): boolean {
    if (!sharedSessionPaths.value.includes(path)) {
      return false
    }

    sharedSessionPaths.value = sharedSessionPaths.value.filter((item) => item !== path)

    return true
  }

  function setLocale(nextLocale: string): boolean {
    if (!isSupportedLocale(nextLocale)) {
      return false
    }

    locale.value = nextLocale

    return true
  }

  function setShortcutOverride(
    commandId: string,
    shortcut: { keys: string[]; scope: string },
  ): boolean {
    if (!isCommandId(commandId) || !isShortcutScope(shortcut.scope)) {
      return false
    }

    const normalizedKeys = shortcut.keys.map((key) => key.trim())

    if (normalizedKeys.length === 0 || normalizedKeys.some((key) => key === '')) {
      return false
    }

    shortcutOverrides.value = {
      ...shortcutOverrides.value,
      [commandId]: {
        keys: normalizedKeys,
        scope: shortcut.scope,
      },
    }

    return true
  }

  function resetShortcutOverride(commandId: string): boolean {
    if (!isCommandId(commandId) || shortcutOverrides.value[commandId] === undefined) {
      return false
    }

    const { [commandId]: _removed, ...remainingOverrides } = shortcutOverrides.value

    shortcutOverrides.value = remainingOverrides

    return true
  }

  function getEffectiveShortcut(command: AppCommand): CommandShortcut {
    return shortcutOverrides.value[command.id] ?? command.defaultShortcut
  }

  function setAutoSaveLimit(value: number): void {
    autoSaveLimit.value = Math.max(0, Math.min(50, Math.floor(value)))
  }

  function setFontFamily(value: string): boolean {
    if (!isFontFamilyId(value)) {
      return false
    }

    fontFamily.value = value

    return true
  }

  function setFontSize(value: number): void {
    fontSize.value = Math.max(12, Math.min(24, Math.floor(value)))
  }

  function setDiffColor(key: keyof DiffHighlightColors, value: string): boolean {
    const normalized = value.trim()

    if (!isCssColor(normalized)) {
      return false
    }

    diffColors.value = {
      ...diffColors.value,
      [key]: normalized,
    }

    return true
  }

  function resetDiffColors(): void {
    diffColors.value = {
      ...(resolvedTheme.value === 'dark'
        ? defaultDarkDiffHighlightColors
        : defaultDiffHighlightColors),
    }
  }

  function setConfirmBeforeDelete(value: boolean): void {
    confirmBeforeDelete.value = value
  }

  function setWrapTextDefault(value: boolean): void {
    wrapTextDefault.value = value
  }

  function setConfirmBeforeSyncOverwrite(value: boolean): void {
    confirmBeforeSyncOverwrite.value = value
  }

  function setAutoScrollToFirstDifference(value: boolean): void {
    autoScrollToFirstDifference.value = value
  }

  function setCollapseIdenticalFoldersDefault(value: boolean): void {
    collapseIdenticalFoldersDefault.value = value
  }

  function setShowHiddenFiles(value: boolean): void {
    showHiddenFiles.value = value
  }

  function setNotifyOnCompareComplete(value: boolean): void {
    notifyOnCompareComplete.value = value
  }

  function setShowSessionToolbars(value: boolean): void {
    showSessionToolbars.value = value
  }

  function setShowFolderLegend(value: boolean): void {
    showFolderLegend.value = value
  }

  function setShowToolbarLabels(value: boolean): void {
    showToolbarLabels.value = value
  }

  function setLargeToolbarButtons(value: boolean): void {
    largeToolbarButtons.value = value
  }

  function setCreateBackupOnSave(value: boolean): void {
    createBackupOnSave.value = value
  }

  function setBackupRetentionCount(value: number): void {
    backupRetentionCount.value = Math.max(1, Math.min(9, Math.floor(value)))
  }

  function setShowSessionsInToolbar(value: boolean): void {
    showSessionsInToolbar.value = value
  }

  function setShowGotoInToolbar(value: boolean): void {
    showGotoInToolbar.value = value
  }

  function setShowWrapInToolbar(value: boolean): void {
    showWrapInToolbar.value = value
  }

  function setShowSyncNowInToolbar(value: boolean): void {
    showSyncNowInToolbar.value = value
  }

  function setShowSyncCancelAcceptInToolbar(value: boolean): void {
    showSyncCancelAcceptInToolbar.value = value
  }

  function setShowStatusBar(value: boolean): void {
    showStatusBar.value = value
  }

  function setShowPathBars(value: boolean): void {
    showPathBars.value = value
  }

  function setShowSidebar(value: boolean): void {
    showSidebar.value = value
  }

  function setShowToolbarIcons(value: boolean): void {
    showToolbarIcons.value = value
  }

  function setConfirmBeforeCloseDirtyTab(value: boolean): void {
    confirmBeforeCloseDirtyTab.value = value
  }

  function setConfirmBeforeOverwriteSave(value: boolean): void {
    confirmBeforeOverwriteSave.value = value
  }

  function setAlwaysShowTabBar(value: boolean): void {
    alwaysShowTabBar.value = value
  }

  function setOpenSessionsInNewTab(value: boolean): void {
    openSessionsInNewTab.value = value
  }

  function setShowNextDifferenceInToolbar(value: boolean): void {
    showNextDifferenceInToolbar.value = value
  }

  function setShowPrevDifferenceInToolbar(value: boolean): void {
    showPrevDifferenceInToolbar.value = value
  }

  function setArchiveExtensions(values: string[]): void {
    archiveExtensions.value = setArchiveSuffixes(values)
    enableRarArchiveTypes.value = archiveExtensions.value.includes('.rar')
  }

  function setLoadLastWorkspaceOnStartup(value: boolean): void {
    loadLastWorkspaceOnStartup.value = value
  }

  function setShowChromeUtilities(value: boolean): void {
    showChromeUtilities.value = value
  }

  function setConfirmBeforeQuit(value: boolean): void {
    confirmBeforeQuit.value = value
  }

  function setConfirmBeforeCopy(value: boolean): void {
    confirmBeforeCopy.value = value
  }

  function setConfirmBeforeMove(value: boolean): void {
    confirmBeforeMove.value = value
  }

  function setConfirmBeforeSyncDelete(value: boolean): void {
    confirmBeforeSyncDelete.value = value
  }

  function setCreateBackupOnReportExport(value: boolean): void {
    createBackupOnReportExport.value = value
  }

  function setIncludeHiddenItemsInFileActions(value: boolean): void {
    includeHiddenItemsInFileActions.value = value
  }

  function setBeepAfterLongFileOperations(value: boolean): void {
    beepAfterLongFileOperations.value = value
  }

  function setPreserveTimestampsOnCopy(value: boolean): void {
    preserveTimestampsOnCopy.value = value
  }

  function setOverwriteReadOnlyFiles(value: boolean): void {
    overwriteReadOnlyFiles.value = value
  }

  function setLongFileOperationThresholdMs(value: number): void {
    longFileOperationThresholdMs.value = clampLongFileOperationThresholdMs(value)
  }

  function setShowMillisecondsInTimestamps(value: boolean): void {
    showMillisecondsInTimestamps.value = value
  }

  function setEnableRarArchiveTypes(value: boolean): void {
    enableRarArchiveTypes.value = value
    const current = [...archiveExtensions.value]
    const hasRar = current.includes('.rar')

    if (value && !hasRar) {
      archiveExtensions.value = setArchiveSuffixes([...current, '.rar'])
    } else if (!value && hasRar) {
      archiveExtensions.value = setArchiveSuffixes(current.filter((suffix) => suffix !== '.rar'))
    }
  }

  function setEscClosesFileViews(value: boolean): void {
    escClosesFileViews.value = value
  }

  function setBeepWhenScriptFinished(value: boolean): void {
    beepWhenScriptFinished.value = value
  }

  function setCloseWhenScriptFinished(value: boolean): void {
    closeWhenScriptFinished.value = value
  }

  function setCheckForFilesChangedOnDisk(value: boolean): void {
    checkForFilesChangedOnDisk.value = value
  }

  function setAutoReloadUnlessChangesDiscarded(value: boolean): void {
    autoReloadUnlessChangesDiscarded.value = value
  }

  function setStickyHomeSessionSelection(value: boolean): void {
    stickyHomeSessionSelection.value = value
  }

  function setStickyHomeSessionId(value: string | null): void {
    stickyHomeSessionId.value = value?.trim() ? value.trim() : null
  }

  function setPreferIpv6WhenAvailable(value: boolean): void {
    preferIpv6WhenAvailable.value = value
  }

  function setWatchFoldersForChanges(value: boolean): void {
    watchFoldersForChanges.value = value
  }

  function setBinaryCompareBufferSize(value: number): void {
    binaryCompareBufferSize.value = clampBinaryCompareBufferSize(value)
  }

  function exportSettingsPackage(): SettingsPackage {
    return {
      kind: settingsPackageKind,
      version: settingsPackageVersion,
      theme: theme.value,
      locale: locale.value,
      sharedSessionPaths: [...sharedSessionPaths.value],
      shortcutOverrides: { ...shortcutOverrides.value },
      autoSaveLimit: autoSaveLimit.value,
      fontFamily: fontFamily.value,
      fontSize: fontSize.value,
      diffColors: { ...diffColors.value },
      confirmBeforeDelete: confirmBeforeDelete.value,
      wrapTextDefault: wrapTextDefault.value,
      confirmBeforeSyncOverwrite: confirmBeforeSyncOverwrite.value,
      autoScrollToFirstDifference: autoScrollToFirstDifference.value,
      collapseIdenticalFoldersDefault: collapseIdenticalFoldersDefault.value,
      showHiddenFilesDefault: showHiddenFiles.value,
      notifyOnCompareComplete: notifyOnCompareComplete.value,
      showSessionToolbars: showSessionToolbars.value,
      showFolderLegend: showFolderLegend.value,
      showToolbarLabels: showToolbarLabels.value,
      largeToolbarButtons: largeToolbarButtons.value,
      createBackupOnSave: createBackupOnSave.value,
      backupRetentionCount: backupRetentionCount.value,
      showSessionsInToolbar: showSessionsInToolbar.value,
      showGotoInToolbar: showGotoInToolbar.value,
      showWrapInToolbar: showWrapInToolbar.value,
      showSyncNowInToolbar: showSyncNowInToolbar.value,
      showSyncCancelAcceptInToolbar: showSyncCancelAcceptInToolbar.value,
      showStatusBar: showStatusBar.value,
      showPathBars: showPathBars.value,
      showSidebar: showSidebar.value,
      showToolbarIcons: showToolbarIcons.value,
      confirmBeforeCloseDirtyTab: confirmBeforeCloseDirtyTab.value,
      confirmBeforeOverwriteSave: confirmBeforeOverwriteSave.value,
      alwaysShowTabBar: alwaysShowTabBar.value,
      openSessionsInNewTab: openSessionsInNewTab.value,
      showNextDifferenceInToolbar: showNextDifferenceInToolbar.value,
      showPrevDifferenceInToolbar: showPrevDifferenceInToolbar.value,
      archiveExtensions: [...archiveExtensions.value],
      loadLastWorkspaceOnStartup: loadLastWorkspaceOnStartup.value,
      showChromeUtilities: showChromeUtilities.value,
      confirmBeforeQuit: confirmBeforeQuit.value,
      confirmBeforeCopy: confirmBeforeCopy.value,
      confirmBeforeMove: confirmBeforeMove.value,
      confirmBeforeSyncDelete: confirmBeforeSyncDelete.value,
      createBackupOnReportExport: createBackupOnReportExport.value,
      includeHiddenItemsInFileActions: includeHiddenItemsInFileActions.value,
      beepAfterLongFileOperations: beepAfterLongFileOperations.value,
      preserveTimestampsOnCopy: preserveTimestampsOnCopy.value,
      overwriteReadOnlyFiles: overwriteReadOnlyFiles.value,
      longFileOperationThresholdMs: longFileOperationThresholdMs.value,
      showMillisecondsInTimestamps: showMillisecondsInTimestamps.value,
      enableRarArchiveTypes: enableRarArchiveTypes.value,
      escClosesFileViews: escClosesFileViews.value,
      beepWhenScriptFinished: beepWhenScriptFinished.value,
      closeWhenScriptFinished: closeWhenScriptFinished.value,
      checkForFilesChangedOnDisk: checkForFilesChangedOnDisk.value,
      autoReloadUnlessChangesDiscarded: autoReloadUnlessChangesDiscarded.value,
      stickyHomeSessionSelection: stickyHomeSessionSelection.value,
      stickyHomeSessionId: stickyHomeSessionId.value,
      preferIpv6WhenAvailable: preferIpv6WhenAvailable.value,
      watchFoldersForChanges: watchFoldersForChanges.value,
      binaryCompareBufferSize: binaryCompareBufferSize.value,
    }
  }

  function importSettingsPackage(raw: string | SettingsPackage): boolean {
    let packageValue: SettingsPackage | null

    if (typeof raw === 'string') {
      packageValue = parseSettingsPackage(raw)
    } else if (isSettingsPackage(raw)) {
      packageValue = raw
    } else {
      packageValue = null
    }

    if (!packageValue) {
      return false
    }

    setTheme(packageValue.theme)
    setLocale(packageValue.locale)
    sharedSessionPaths.value = [...packageValue.sharedSessionPaths]
    shortcutOverrides.value = { ...packageValue.shortcutOverrides }
    setAutoSaveLimit(packageValue.autoSaveLimit)
    setFontFamily(packageValue.fontFamily)
    setFontSize(packageValue.fontSize)
    diffColors.value = { ...packageValue.diffColors }
    setConfirmBeforeDelete(packageValue.confirmBeforeDelete)
    setWrapTextDefault(packageValue.wrapTextDefault)
    setConfirmBeforeSyncOverwrite(
      typeof packageValue.confirmBeforeSyncOverwrite === 'boolean'
        ? packageValue.confirmBeforeSyncOverwrite
        : true,
    )
    setAutoScrollToFirstDifference(
      typeof packageValue.autoScrollToFirstDifference === 'boolean'
        ? packageValue.autoScrollToFirstDifference
        : false,
    )
    setCollapseIdenticalFoldersDefault(
      typeof packageValue.collapseIdenticalFoldersDefault === 'boolean'
        ? packageValue.collapseIdenticalFoldersDefault
        : false,
    )
    setShowHiddenFiles(
      typeof packageValue.showHiddenFilesDefault === 'boolean'
        ? packageValue.showHiddenFilesDefault
        : false,
    )
    setNotifyOnCompareComplete(
      typeof packageValue.notifyOnCompareComplete === 'boolean'
        ? packageValue.notifyOnCompareComplete
        : false,
    )
    setShowSessionToolbars(packageValue.showSessionToolbars)
    setShowFolderLegend(
      typeof packageValue.showFolderLegend === 'boolean' ? packageValue.showFolderLegend : false,
    )
    setShowToolbarLabels(packageValue.showToolbarLabels)
    setLargeToolbarButtons(packageValue.largeToolbarButtons)
    setCreateBackupOnSave(packageValue.createBackupOnSave)
    setBackupRetentionCount(
      typeof packageValue.backupRetentionCount === 'number' ? packageValue.backupRetentionCount : 1,
    )
    setShowSessionsInToolbar(
      typeof packageValue.showSessionsInToolbar === 'boolean'
        ? packageValue.showSessionsInToolbar
        : false,
    )
    setShowGotoInToolbar(
      typeof packageValue.showGotoInToolbar === 'boolean' ? packageValue.showGotoInToolbar : false,
    )
    setShowWrapInToolbar(
      typeof packageValue.showWrapInToolbar === 'boolean' ? packageValue.showWrapInToolbar : false,
    )
    setShowSyncNowInToolbar(
      typeof packageValue.showSyncNowInToolbar === 'boolean'
        ? packageValue.showSyncNowInToolbar
        : false,
    )
    setShowSyncCancelAcceptInToolbar(
      typeof packageValue.showSyncCancelAcceptInToolbar === 'boolean'
        ? packageValue.showSyncCancelAcceptInToolbar
        : false,
    )
    setShowStatusBar(
      typeof packageValue.showStatusBar === 'boolean' ? packageValue.showStatusBar : true,
    )
    setShowPathBars(
      typeof packageValue.showPathBars === 'boolean' ? packageValue.showPathBars : true,
    )
    setShowSidebar(typeof packageValue.showSidebar === 'boolean' ? packageValue.showSidebar : false)
    setShowToolbarIcons(
      typeof packageValue.showToolbarIcons === 'boolean' ? packageValue.showToolbarIcons : true,
    )
    setConfirmBeforeCloseDirtyTab(
      typeof packageValue.confirmBeforeCloseDirtyTab === 'boolean'
        ? packageValue.confirmBeforeCloseDirtyTab
        : true,
    )
    setConfirmBeforeOverwriteSave(
      typeof packageValue.confirmBeforeOverwriteSave === 'boolean'
        ? packageValue.confirmBeforeOverwriteSave
        : false,
    )
    setAlwaysShowTabBar(
      typeof packageValue.alwaysShowTabBar === 'boolean' ? packageValue.alwaysShowTabBar : false,
    )
    setOpenSessionsInNewTab(
      typeof packageValue.openSessionsInNewTab === 'boolean'
        ? packageValue.openSessionsInNewTab
        : false,
    )
    setShowNextDifferenceInToolbar(
      typeof packageValue.showNextDifferenceInToolbar === 'boolean'
        ? packageValue.showNextDifferenceInToolbar
        : true,
    )
    setShowPrevDifferenceInToolbar(
      typeof packageValue.showPrevDifferenceInToolbar === 'boolean'
        ? packageValue.showPrevDifferenceInToolbar
        : true,
    )
    setArchiveExtensions(
      Array.isArray(packageValue.archiveExtensions)
        ? packageValue.archiveExtensions.filter((item): item is string => typeof item === 'string')
        : getArchiveSuffixes(),
    )
    setLoadLastWorkspaceOnStartup(
      typeof packageValue.loadLastWorkspaceOnStartup === 'boolean'
        ? packageValue.loadLastWorkspaceOnStartup
        : false,
    )
    setShowChromeUtilities(
      typeof packageValue.showChromeUtilities === 'boolean'
        ? packageValue.showChromeUtilities
        : true,
    )
    setConfirmBeforeQuit(
      typeof packageValue.confirmBeforeQuit === 'boolean' ? packageValue.confirmBeforeQuit : false,
    )
    setConfirmBeforeCopy(
      typeof packageValue.confirmBeforeCopy === 'boolean' ? packageValue.confirmBeforeCopy : true,
    )
    setConfirmBeforeMove(
      typeof packageValue.confirmBeforeMove === 'boolean' ? packageValue.confirmBeforeMove : false,
    )
    setConfirmBeforeSyncDelete(
      typeof packageValue.confirmBeforeSyncDelete === 'boolean'
        ? packageValue.confirmBeforeSyncDelete
        : true,
    )
    setCreateBackupOnReportExport(
      typeof packageValue.createBackupOnReportExport === 'boolean'
        ? packageValue.createBackupOnReportExport
        : false,
    )
    setIncludeHiddenItemsInFileActions(
      typeof packageValue.includeHiddenItemsInFileActions === 'boolean'
        ? packageValue.includeHiddenItemsInFileActions
        : false,
    )
    setBeepAfterLongFileOperations(
      typeof packageValue.beepAfterLongFileOperations === 'boolean'
        ? packageValue.beepAfterLongFileOperations
        : false,
    )
    setPreserveTimestampsOnCopy(
      typeof packageValue.preserveTimestampsOnCopy === 'boolean'
        ? packageValue.preserveTimestampsOnCopy
        : false,
    )
    setOverwriteReadOnlyFiles(
      typeof packageValue.overwriteReadOnlyFiles === 'boolean'
        ? packageValue.overwriteReadOnlyFiles
        : false,
    )
    setLongFileOperationThresholdMs(
      typeof packageValue.longFileOperationThresholdMs === 'number'
        ? packageValue.longFileOperationThresholdMs
        : longFileOperationThresholdMs.value,
    )
    setShowMillisecondsInTimestamps(
      typeof packageValue.showMillisecondsInTimestamps === 'boolean'
        ? packageValue.showMillisecondsInTimestamps
        : false,
    )
    setEnableRarArchiveTypes(
      typeof packageValue.enableRarArchiveTypes === 'boolean'
        ? packageValue.enableRarArchiveTypes
        : false,
    )
    setEscClosesFileViews(
      typeof packageValue.escClosesFileViews === 'boolean'
        ? packageValue.escClosesFileViews
        : false,
    )
    setBeepWhenScriptFinished(
      typeof packageValue.beepWhenScriptFinished === 'boolean'
        ? packageValue.beepWhenScriptFinished
        : false,
    )
    setCloseWhenScriptFinished(
      typeof packageValue.closeWhenScriptFinished === 'boolean'
        ? packageValue.closeWhenScriptFinished
        : false,
    )
    setCheckForFilesChangedOnDisk(
      typeof packageValue.checkForFilesChangedOnDisk === 'boolean'
        ? packageValue.checkForFilesChangedOnDisk
        : false,
    )
    setAutoReloadUnlessChangesDiscarded(
      typeof packageValue.autoReloadUnlessChangesDiscarded === 'boolean'
        ? packageValue.autoReloadUnlessChangesDiscarded
        : false,
    )
    setStickyHomeSessionSelection(
      typeof packageValue.stickyHomeSessionSelection === 'boolean'
        ? packageValue.stickyHomeSessionSelection
        : false,
    )
    setStickyHomeSessionId(
      typeof packageValue.stickyHomeSessionId === 'string' ||
        packageValue.stickyHomeSessionId === null
        ? packageValue.stickyHomeSessionId
        : stickyHomeSessionId.value,
    )
    setPreferIpv6WhenAvailable(
      typeof packageValue.preferIpv6WhenAvailable === 'boolean'
        ? packageValue.preferIpv6WhenAvailable
        : false,
    )
    setWatchFoldersForChanges(
      typeof packageValue.watchFoldersForChanges === 'boolean'
        ? packageValue.watchFoldersForChanges
        : false,
    )
    setBinaryCompareBufferSize(
      typeof packageValue.binaryCompareBufferSize === 'number'
        ? packageValue.binaryCompareBufferSize
        : binaryCompareBufferSize.value,
    )

    return true
  }

  function restoreFactoryDefaults(): void {
    setTheme('light')
    setLocale(fallbackLocale)
    sharedSessionPaths.value = []
    shortcutOverrides.value = {}
    setAutoSaveLimit(10)
    setFontFamily('system')
    setFontSize(14)
    resetDiffColors()
    setConfirmBeforeDelete(true)
    setWrapTextDefault(false)
    setConfirmBeforeSyncOverwrite(true)
    setAutoScrollToFirstDifference(false)
    setCollapseIdenticalFoldersDefault(false)
    setShowHiddenFiles(false)
    setNotifyOnCompareComplete(false)
    setShowSessionToolbars(true)
    setShowFolderLegend(false)
    setShowToolbarLabels(true)
    setLargeToolbarButtons(true)
    setCreateBackupOnSave(false)
    setBackupRetentionCount(1)
    setShowSessionsInToolbar(false)
    setShowGotoInToolbar(false)
    setShowWrapInToolbar(false)
    setShowSyncNowInToolbar(false)
    setShowSyncCancelAcceptInToolbar(false)
    setShowStatusBar(true)
    setShowPathBars(true)
    setShowSidebar(false)
    setShowToolbarIcons(true)
    setConfirmBeforeCloseDirtyTab(true)
    setConfirmBeforeOverwriteSave(false)
    setAlwaysShowTabBar(true)
    setOpenSessionsInNewTab(false)
    setShowNextDifferenceInToolbar(true)
    setShowPrevDifferenceInToolbar(true)
    setArchiveExtensions(resetArchiveSuffixes())
    setLoadLastWorkspaceOnStartup(false)
    setShowChromeUtilities(true)
    setConfirmBeforeQuit(false)
    setConfirmBeforeCopy(true)
    setConfirmBeforeMove(false)
    setConfirmBeforeSyncDelete(true)
    setCreateBackupOnReportExport(false)
    setIncludeHiddenItemsInFileActions(false)
    setBeepAfterLongFileOperations(false)
    setPreserveTimestampsOnCopy(false)
    setOverwriteReadOnlyFiles(false)
    setLongFileOperationThresholdMs(3000)
    setShowMillisecondsInTimestamps(false)
    setEnableRarArchiveTypes(false)
    setEscClosesFileViews(false)
    setBeepWhenScriptFinished(false)
    setCloseWhenScriptFinished(false)
    setCheckForFilesChangedOnDisk(false)
    setAutoReloadUnlessChangesDiscarded(false)
    setStickyHomeSessionSelection(false)
    setStickyHomeSessionId(null)
    setPreferIpv6WhenAvailable(false)
    setWatchFoldersForChanges(false)
    setBinaryCompareBufferSize(256)
  }

  return {
    theme,
    resolvedTheme,
    locale,
    sharedSessionPaths,
    shortcutOverrides,
    autoSaveLimit,
    fontFamily,
    fontSize,
    diffColors,
    confirmBeforeDelete,
    wrapTextDefault,
    confirmBeforeSyncOverwrite,
    autoScrollToFirstDifference,
    collapseIdenticalFoldersDefault,
    showHiddenFiles,
    notifyOnCompareComplete,
    showSessionToolbars,
    showFolderLegend,
    showToolbarLabels,
    largeToolbarButtons,
    createBackupOnSave,
    backupRetentionCount,
    showSessionsInToolbar,
    showGotoInToolbar,
    showWrapInToolbar,
    showSyncNowInToolbar,
    showSyncCancelAcceptInToolbar,
    showStatusBar,
    showPathBars,
    showSidebar,
    showToolbarIcons,
    confirmBeforeCloseDirtyTab,
    confirmBeforeOverwriteSave,
    alwaysShowTabBar,
    openSessionsInNewTab,
    showNextDifferenceInToolbar,
    showPrevDifferenceInToolbar,
    archiveExtensions,
    loadLastWorkspaceOnStartup,
    showChromeUtilities,
    confirmBeforeQuit,
    confirmBeforeCopy,
    confirmBeforeMove,
    confirmBeforeSyncDelete,
    createBackupOnReportExport,
    includeHiddenItemsInFileActions,
    beepAfterLongFileOperations,
    preserveTimestampsOnCopy,
    overwriteReadOnlyFiles,
    longFileOperationThresholdMs,
    showMillisecondsInTimestamps,
    enableRarArchiveTypes,
    escClosesFileViews,
    beepWhenScriptFinished,
    closeWhenScriptFinished,
    checkForFilesChangedOnDisk,
    autoReloadUnlessChangesDiscarded,
    stickyHomeSessionSelection,
    stickyHomeSessionId,
    preferIpv6WhenAvailable,
    watchFoldersForChanges,
    binaryCompareBufferSize,
    toggleTheme,
    setTheme,
    setLocale,
    addSharedSessionPath,
    removeSharedSessionPath,
    setShortcutOverride,
    resetShortcutOverride,
    getEffectiveShortcut,
    setAutoSaveLimit,
    setFontFamily,
    setFontSize,
    setDiffColor,
    resetDiffColors,
    setConfirmBeforeDelete,
    setWrapTextDefault,
    setConfirmBeforeSyncOverwrite,
    setAutoScrollToFirstDifference,
    setCollapseIdenticalFoldersDefault,
    setShowHiddenFiles,
    setNotifyOnCompareComplete,
    setShowSessionToolbars,
    setShowFolderLegend,
    setShowToolbarLabels,
    setLargeToolbarButtons,
    setCreateBackupOnSave,
    setBackupRetentionCount,
    setShowSessionsInToolbar,
    setShowGotoInToolbar,
    setShowWrapInToolbar,
    setShowSyncNowInToolbar,
    setShowSyncCancelAcceptInToolbar,
    setShowStatusBar,
    setShowPathBars,
    setShowSidebar,
    setShowToolbarIcons,
    setConfirmBeforeCloseDirtyTab,
    setConfirmBeforeOverwriteSave,
    setAlwaysShowTabBar,
    setOpenSessionsInNewTab,
    setShowNextDifferenceInToolbar,
    setShowPrevDifferenceInToolbar,
    setArchiveExtensions,
    setLoadLastWorkspaceOnStartup,
    setShowChromeUtilities,
    setConfirmBeforeQuit,
    setConfirmBeforeCopy,
    setConfirmBeforeMove,
    setConfirmBeforeSyncDelete,
    setCreateBackupOnReportExport,
    setIncludeHiddenItemsInFileActions,
    setBeepAfterLongFileOperations,
    setPreserveTimestampsOnCopy,
    setOverwriteReadOnlyFiles,
    setLongFileOperationThresholdMs,
    setShowMillisecondsInTimestamps,
    setEnableRarArchiveTypes,
    setEscClosesFileViews,
    setBeepWhenScriptFinished,
    setCloseWhenScriptFinished,
    setCheckForFilesChangedOnDisk,
    setAutoReloadUnlessChangesDiscarded,
    setStickyHomeSessionSelection,
    setStickyHomeSessionId,
    setPreferIpv6WhenAvailable,
    setWatchFoldersForChanges,
    setBinaryCompareBufferSize,
    exportSettingsPackage,
    importSettingsPackage,
    restoreFactoryDefaults,
  }
})

function loadTheme(): ThemeMode {
  const stored = localStorage.getItem('open-diff-theme')

  if (stored === 'light' || stored === 'dark' || stored === 'system') {
    return stored
  }

  return 'light'
}

function prefersDarkTheme(): boolean {
  if (typeof window.matchMedia !== 'function') {
    return false
  }

  return window.matchMedia('(prefers-color-scheme: dark)').matches
}

function bindSystemThemeListener(onChange: (prefersDark: boolean) => void): void {
  if (typeof window.matchMedia !== 'function') {
    return
  }

  const media = window.matchMedia('(prefers-color-scheme: dark)')
  const listener = (event: MediaQueryListEvent): void => {
    onChange(event.matches)
  }

  if (typeof media.addEventListener === 'function') {
    media.addEventListener('change', listener)
  }
}

function loadLocale(): SupportedLocale {
  const storedLocale = localStorage.getItem(localeStorageKey)

  if (!storedLocale || !isSupportedLocale(storedLocale)) {
    return fallbackLocale
  }

  return storedLocale
}

function loadSharedSessionPaths(): string[] {
  try {
    const parsed = JSON.parse(localStorage.getItem(sharedSessionPathsStorageKey) ?? '[]') as unknown

    if (!Array.isArray(parsed)) {
      return []
    }

    return parsed.filter((item): item is string => typeof item === 'string' && item.trim() !== '')
  } catch {
    return []
  }
}

function loadShortcutOverrides(): ShortcutOverrides {
  try {
    const parsed = JSON.parse(localStorage.getItem(shortcutOverridesStorageKey) ?? '{}') as unknown

    if (!isPlainRecord(parsed)) {
      return {}
    }

    return Object.entries(parsed).reduce<ShortcutOverrides>((overrides, [commandId, shortcut]) => {
      if (!isCommandId(commandId) || !isShortcutLike(shortcut)) {
        return overrides
      }

      overrides[commandId] = shortcut

      return overrides
    }, {})
  } catch {
    return {}
  }
}

function loadAutoSaveLimit(): number {
  const rawValue = localStorage.getItem(autoSaveLimitStorageKey)

  if (rawValue === null) {
    return 10
  }

  const stored = Number(rawValue)

  if (!Number.isFinite(stored)) {
    return 10
  }

  return Math.max(0, Math.min(50, Math.floor(stored)))
}

function loadFontFamily(): FontFamilyId {
  const stored = localStorage.getItem(fontFamilyStorageKey)

  if (stored && isFontFamilyId(stored)) {
    return stored
  }

  return 'segoe'
}

function loadFontSize(): number {
  const rawValue = localStorage.getItem(fontSizeStorageKey)

  if (rawValue === null) {
    return 18
  }

  const stored = Number(rawValue)

  if (!Number.isFinite(stored)) {
    return 18
  }

  return Math.max(12, Math.min(24, Math.floor(stored)))
}

function loadDiffColors(): DiffHighlightColors {
  try {
    const parsed = JSON.parse(localStorage.getItem(diffColorsStorageKey) ?? 'null') as unknown

    if (!isPlainRecord(parsed)) {
      return { ...defaultDiffHighlightColors }
    }

    const next: DiffHighlightColors = { ...defaultDiffHighlightColors }

    for (const key of Object.keys(defaultDiffHighlightColors) as (keyof DiffHighlightColors)[]) {
      const value = parsed[key]

      if (typeof value === 'string' && isCssColor(value)) {
        next[key] = value.trim()
      }
    }

    return next
  } catch {
    return { ...defaultDiffHighlightColors }
  }
}

function loadConfirmBeforeDelete(): boolean {
  const stored = localStorage.getItem(confirmBeforeDeleteStorageKey)

  if (stored === null) {
    return true
  }

  return stored !== '0'
}

function loadWrapTextDefault(): boolean {
  const stored = localStorage.getItem(wrapTextDefaultStorageKey)

  if (stored === null) {
    return false
  }

  return stored === '1'
}

function loadConfirmBeforeSyncOverwrite(): boolean {
  const stored = localStorage.getItem(confirmBeforeSyncOverwriteStorageKey)

  if (stored === null) {
    return true
  }

  return stored === '1'
}

function loadAutoScrollToFirstDifference(): boolean {
  const stored = localStorage.getItem(autoScrollToFirstDifferenceStorageKey)

  if (stored === null) {
    return false
  }

  return stored === '1'
}

function loadCollapseIdenticalFoldersDefault(): boolean {
  const stored = localStorage.getItem(collapseIdenticalFoldersDefaultStorageKey)

  if (stored === null) {
    return false
  }

  return stored === '1'
}

function loadShowHiddenFiles(): boolean {
  const stored = localStorage.getItem(showHiddenFilesStorageKey)

  if (stored === null) {
    return false
  }

  return stored === '1'
}

function loadNotifyOnCompareComplete(): boolean {
  const stored = localStorage.getItem(notifyOnCompareCompleteStorageKey)

  if (stored === null) {
    return false
  }

  return stored === '1'
}

function loadShowSessionToolbars(): boolean {
  const stored = localStorage.getItem(showSessionToolbarsStorageKey)

  if (stored === null) {
    return true
  }

  return stored !== '0'
}

function loadShowFolderLegend(): boolean {
  const stored = localStorage.getItem(showFolderLegendStorageKey)

  if (stored === null) {
    return false
  }

  return stored === '1'
}

function loadShowToolbarLabels(): boolean {
  const stored = localStorage.getItem(showToolbarLabelsStorageKey)

  if (stored === null) {
    return true
  }

  return stored !== '0'
}

function loadLargeToolbarButtons(): boolean {
  const stored = localStorage.getItem(largeToolbarButtonsStorageKey)

  if (stored === null) {
    return true
  }

  return stored !== '0'
}

function loadShowStatusBar(): boolean {
  const stored = localStorage.getItem(showStatusBarStorageKey)

  if (stored === null) {
    return true
  }

  return stored !== '0'
}

function loadShowPathBars(): boolean {
  const stored = localStorage.getItem(showPathBarsStorageKey)

  if (stored === null) {
    return true
  }

  return stored !== '0'
}

function loadShowSidebar(): boolean {
  const stored = localStorage.getItem(showSidebarStorageKey)

  if (stored === null) {
    return false
  }

  return stored === '1'
}

function loadShowToolbarIcons(): boolean {
  const stored = localStorage.getItem(showToolbarIconsStorageKey)

  if (stored === null) {
    return true
  }

  return stored === '1'
}

function loadConfirmBeforeCloseDirtyTab(): boolean {
  const stored = localStorage.getItem(confirmBeforeCloseDirtyTabStorageKey)

  if (stored === null) {
    return true
  }

  return stored === '1'
}

function loadConfirmBeforeOverwriteSave(): boolean {
  const stored = localStorage.getItem(confirmBeforeOverwriteSaveStorageKey)

  if (stored === null) {
    return false
  }

  return stored === '1'
}

function loadAlwaysShowTabBar(): boolean {
  const stored = localStorage.getItem(alwaysShowTabBarStorageKey)

  if (stored === null) {
    // Capture-aligned default: single Home / session frames omit the tab strip.
    return false
  }

  return stored === '1'
}

function loadOpenSessionsInNewTab(): boolean {
  const stored = localStorage.getItem(openSessionsInNewTabStorageKey)

  if (stored === null) {
    return false
  }

  return stored === '1'
}

function loadShowNextDifferenceInToolbar(): boolean {
  const stored = localStorage.getItem(showNextDifferenceInToolbarStorageKey)

  if (stored === null) {
    return true
  }

  return stored === '1'
}

function loadShowPrevDifferenceInToolbar(): boolean {
  const stored = localStorage.getItem(showPrevDifferenceInToolbarStorageKey)

  if (stored === null) {
    return true
  }

  return stored === '1'
}

function loadLoadLastWorkspaceOnStartup(): boolean {
  const stored = localStorage.getItem(loadLastWorkspaceOnStartupStorageKey)

  if (stored === null) {
    return false
  }

  return stored !== '0'
}

function loadCreateBackupOnSave(): boolean {
  const stored = localStorage.getItem(createBackupOnSaveStorageKey)

  if (stored === null) {
    return true
  }

  return stored !== '0'
}

function loadBackupRetentionCount(): number {
  const rawValue = localStorage.getItem(backupRetentionCountStorageKey)

  if (rawValue === null) {
    return 1
  }

  const parsed = Number(rawValue)

  if (!Number.isFinite(parsed)) {
    return 1
  }

  return Math.max(1, Math.min(9, Math.floor(parsed)))
}

function loadShowSessionsInToolbar(): boolean {
  const stored = localStorage.getItem(showSessionsInToolbarStorageKey)

  if (stored === null) {
    return false
  }

  return stored === '1'
}

function loadShowGotoInToolbar(): boolean {
  const stored = localStorage.getItem(showGotoInToolbarStorageKey)

  if (stored === null) {
    return false
  }

  return stored === '1'
}

function loadShowWrapInToolbar(): boolean {
  const stored = localStorage.getItem(showWrapInToolbarStorageKey)

  if (stored === null) {
    return false
  }

  return stored === '1'
}

function loadShowSyncNowInToolbar(): boolean {
  const stored = localStorage.getItem(showSyncNowInToolbarStorageKey)

  if (stored === null) {
    return false
  }

  return stored === '1'
}

function loadShowSyncCancelAcceptInToolbar(): boolean {
  const stored = localStorage.getItem(showSyncCancelAcceptInToolbarStorageKey)

  if (stored === null) {
    return false
  }

  return stored === '1'
}

function applyDiffColors(colors: DiffHighlightColors): void {
  const root = document.documentElement.style

  root.setProperty('--diff-added-bg', colors.addedBg)
  root.setProperty('--diff-added-fg', colors.addedFg)
  root.setProperty('--diff-deleted-bg', colors.deletedBg)
  root.setProperty('--diff-deleted-fg', colors.deletedFg)
  root.setProperty('--diff-modified-bg', colors.modifiedBg)
  root.setProperty('--diff-modified-fg', colors.modifiedFg)
}

function isFontFamilyId(value: string): value is FontFamilyId {
  return fontFamilyIds.has(value as FontFamilyId)
}

function isCssColor(value: string): boolean {
  if (value.length === 0 || value.length > 64) {
    return false
  }

  return (
    /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/.test(value) ||
    /^rgba?\(\s*\d{1,3}\s+\d{1,3}\s+\d{1,3}\s*(?:\/\s*[\d.]+%?\s*)?\)$/.test(value) ||
    /^rgba?\(\s*\d{1,3}\s*,\s*\d{1,3}\s*,\s*\d{1,3}\s*(?:,\s*[\d.]+\s*)?\)$/.test(value)
  )
}

function isCommandId(value: string): value is CommandId {
  return commandIds.has(value)
}

function isShortcutScope(value: string): value is ShortcutScope {
  return shortcutScopes.has(value as ShortcutScope)
}

function isShortcutLike(value: unknown): value is CommandShortcut {
  if (
    !isPlainRecord(value) ||
    !Array.isArray(value.keys) ||
    !isShortcutScope(String(value.scope))
  ) {
    return false
  }

  const keys = value.keys

  return keys.length > 0 && keys.every((key) => typeof key === 'string' && key.trim() !== '')
}

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function loadShowChromeUtilities(): boolean {
  const stored = localStorage.getItem(showChromeUtilitiesStorageKey)

  if (stored === null) {
    return true
  }

  return stored === '1'
}

function loadConfirmBeforeQuit(): boolean {
  const stored = localStorage.getItem(confirmBeforeQuitStorageKey)

  if (stored === null) {
    return false
  }

  return stored === '1'
}

function loadConfirmBeforeCopy(): boolean {
  const stored = localStorage.getItem(confirmBeforeCopyStorageKey)

  if (stored === null) {
    return true
  }

  return stored === '1'
}

function loadConfirmBeforeMove(): boolean {
  const stored = localStorage.getItem(confirmBeforeMoveStorageKey)

  if (stored === null) {
    return false
  }

  return stored === '1'
}

function loadConfirmBeforeSyncDelete(): boolean {
  const stored = localStorage.getItem(confirmBeforeSyncDeleteStorageKey)

  if (stored === null) {
    return true
  }

  return stored === '1'
}

function loadCreateBackupOnReportExport(): boolean {
  const stored = localStorage.getItem(createBackupOnReportExportStorageKey)

  if (stored === null) {
    return false
  }

  return stored === '1'
}

function loadIncludeHiddenItemsInFileActions(): boolean {
  const stored = localStorage.getItem(includeHiddenItemsInFileActionsStorageKey)

  if (stored === null) {
    return false
  }

  return stored === '1'
}

function loadBeepAfterLongFileOperations(): boolean {
  const stored = localStorage.getItem(beepAfterLongFileOperationsStorageKey)

  if (stored === null) {
    return false
  }

  return stored === '1'
}

function loadPreserveTimestampsOnCopy(): boolean {
  const stored = localStorage.getItem(preserveTimestampsOnCopyStorageKey)

  if (stored === null) {
    return false
  }

  return stored === '1'
}

function loadOverwriteReadOnlyFiles(): boolean {
  const stored = localStorage.getItem(overwriteReadOnlyFilesStorageKey)

  if (stored === null) {
    return false
  }

  return stored === '1'
}

function clampLongFileOperationThresholdMs(value: number): number {
  if (!Number.isFinite(value)) {
    return 3000
  }

  return Math.min(60_000, Math.max(500, Math.round(value)))
}

function loadLongFileOperationThresholdMs(): number {
  const stored = localStorage.getItem(longFileOperationThresholdMsStorageKey)

  if (stored === null) {
    return 3000
  }

  return clampLongFileOperationThresholdMs(Number(stored))
}

function loadShowMillisecondsInTimestamps(): boolean {
  const stored = localStorage.getItem(showMillisecondsInTimestampsStorageKey)

  if (stored === null) {
    return false
  }

  return stored === '1'
}

function loadEnableRarArchiveTypes(): boolean {
  const stored = localStorage.getItem(enableRarArchiveTypesStorageKey)

  if (stored === null) {
    return loadArchiveSuffixes().includes('.rar')
  }

  return stored === '1'
}

function loadEscClosesFileViews(): boolean {
  const stored = localStorage.getItem(escClosesFileViewsStorageKey)

  if (stored === null) {
    return false
  }

  return stored === '1'
}

function loadBeepWhenScriptFinished(): boolean {
  const stored = localStorage.getItem(beepWhenScriptFinishedStorageKey)

  if (stored === null) {
    return false
  }

  return stored === '1'
}

function loadCloseWhenScriptFinished(): boolean {
  const stored = localStorage.getItem(closeWhenScriptFinishedStorageKey)

  if (stored === null) {
    return false
  }

  return stored === '1'
}

function loadCheckForFilesChangedOnDisk(): boolean {
  const stored = localStorage.getItem(checkForFilesChangedOnDiskStorageKey)

  if (stored === null) {
    return false
  }

  return stored === '1'
}

function loadAutoReloadUnlessChangesDiscarded(): boolean {
  const stored = localStorage.getItem(autoReloadUnlessChangesDiscardedStorageKey)

  if (stored === null) {
    return false
  }

  return stored === '1'
}

function loadStickyHomeSessionSelection(): boolean {
  const stored = localStorage.getItem(stickyHomeSessionSelectionStorageKey)

  if (stored === null) {
    return false
  }

  return stored === '1'
}

function loadStickyHomeSessionId(): string | null {
  const stored = localStorage.getItem(stickyHomeSessionIdStorageKey)

  if (!stored?.trim()) {
    return null
  }

  return stored.trim()
}

function loadPreferIpv6WhenAvailable(): boolean {
  const stored = localStorage.getItem(preferIpv6WhenAvailableStorageKey)

  if (stored === null) {
    return false
  }

  return stored === '1'
}

function loadWatchFoldersForChanges(): boolean {
  const stored = localStorage.getItem(watchFoldersForChangesStorageKey)

  if (stored === null) {
    return false
  }

  return stored === '1'
}

function loadBinaryCompareBufferSize(): BinaryCompareBufferSize {
  const stored = localStorage.getItem(binaryCompareBufferSizeStorageKey)

  if (stored === null) {
    return clampBinaryCompareBufferSize(loadHexCompareSessionOptions().windowLength)
  }

  return clampBinaryCompareBufferSize(Number(stored))
}

function syncPreferIpv6Backend(value: boolean): void {
  if (typeof window === 'undefined' || !('__TAURI_INTERNALS__' in window)) {
    return
  }

  void setPreferIpv6(value).catch(() => {
    // ponytail: web/dev without Tauri keeps frontend-only preference
  })
}
