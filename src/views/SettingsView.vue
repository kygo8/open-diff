<script setup lang="ts">
import { computed, ref } from 'vue'
import { useRouter } from 'vue-router'
import type { SelectOption } from 'naive-ui'
import {
  commandRegistry,
  filterCommands,
  type AppCommand,
  type CommandShortcut,
} from '@/app/commandRegistry'
import { parseSessionPackage } from '@/app/sessionFile'
import {
  registerUnixShellIntegration,
  registerWindowsShellExtension,
  unregisterUnixShellIntegration,
  unregisterWindowsShellExtension,
  writeGitIntegration,
  writeSvnIntegration,
} from '@/api/integration'
import { usePolicyStore } from '@/stores/policy'
import { useSavedSessionsStore } from '@/stores/savedSessions'
import { type DiffHighlightColors, useSettingsStore } from '@/stores/settings'
import { formatArchiveSuffixesInput, parseArchiveSuffixesInput } from '@/app/archivePath'
import {
  formatIgnoredTimezoneHourOffsetsInput,
  loadFolderCompareCriteria,
  parseIgnoredTimezoneHourOffsetsInput,
  saveFolderCompareCriteria,
  defaultFolderCompareCriteria,
} from '@/app/folderCompareCriteria'
import {
  defaultFolderDisplayFilters,
  loadFolderDisplayFilters,
  saveFolderDisplayFilters,
  type FolderDisplayStatus,
} from '@/app/folderDisplayFilters'
import {
  defaultFolderMergeDisplay,
  loadFolderMergeDisplay,
  saveFolderMergeDisplay,
  type FolderMergeViewPreset,
} from '@/app/folderMergeDisplay'
import {
  defaultFolderSyncSessionOptions,
  loadFolderSyncSessionOptions,
  saveFolderSyncSessionOptions,
  type FolderSyncSessionOptions,
} from '@/app/folderSyncSessionOptions'
import {
  formatFolderNameFilterDraft,
  formatFolderNameFilterStripPattern,
  loadFolderNameFilters,
  parseFolderNameFilterStripPattern,
  saveFolderNameFilters,
  defaultFolderNameFilters,
} from '@/app/folderNameFilters'
import {
  defaultTextCompareSessionOptions,
  loadTextCompareSessionOptions,
  saveTextCompareSessionOptions,
} from '@/app/textCompareSessionOptions'
import {
  defaultHexCompareSessionOptions,
  loadHexCompareSessionOptions,
  normalizeHexBytesPerRow,
  saveHexCompareSessionOptions,
} from '@/app/hexCompareSessionOptions'
import {
  builtInFileFormats,
  defaultFileFormatPreferences,
  loadFileFormatPreferences,
  loadFileFormats,
  optionsFormatAssociationIds,
  saveFileFormatPreferences,
  saveFileFormats,
  setFileFormatEnabled,
  type FileFormatDefinition,
} from '@/app/fileFormats'
import {
  defaultFileOperationPreferences,
  loadFileOperationPreferences,
  saveFileOperationPreferences,
} from '@/app/fileOperationPreferences'
import {
  clearRecentReportExports,
  defaultReportPreferences,
  loadReportPreferences,
  saveReportPreferences,
  type ReportPreferenceFormat,
  type ReportPreferenceKind,
  type ReportPreferences,
} from '@/app/reportExports'
import {
  defaultRemoteProfileDefaults,
  loadLocalRemoteProfiles,
  loadRemoteProfileDefaults,
  saveRemoteProfileDefaults,
  type RemoteProfileDefaults,
} from '@/app/remoteProfilesLocal'
import {
  defaultPictureCompareOptions,
  loadPictureCompareOptions,
  normalizeRgba,
  pictureBlendModes,
  savePictureCompareOptions,
} from '@/app/pictureCompareOptions'
import {
  defaultMediaCompareOptions,
  loadMediaCompareOptions,
  mediaFieldFilters,
  saveMediaCompareOptions,
} from '@/app/mediaCompareOptions'
import {
  defaultVersionCompareOptions,
  loadVersionCompareOptions,
  saveVersionCompareOptions,
  versionFieldFilters,
} from '@/app/versionCompareOptions'
import {
  defaultTableCompareSessionOptions,
  loadTableCompareSessionOptions,
  saveTableCompareSessionOptions,
} from '@/app/tableCompareSessionOptions'
import type { RemoteProtocol } from '@/api/remote'
import { setArchiveExtensions as syncArchiveExtensionsBackend } from '@/api/diff'
import { loadExternalApplications, saveExternalApplications } from '@/app/externalApplications'
import type { ExternalApplicationConfig } from '@/app/fileOpenActions'
import WorkbenchShell from '@/components/workbench/WorkbenchShell.vue'
import WorkbenchInspector from '@/components/workbench/WorkbenchInspector.vue'
import { useI18n } from '@/i18n'

const settings = useSettingsStore()
const policy = usePolicyStore()
const savedSessions = useSavedSessionsStore()
const router = useRouter()
const { t } = useI18n()
const sharedSessionPathDraft = ref('')
const sharedSessionJsonDraft = ref('')
const sharedSessionImportError = ref('')
const gitKind = ref<'difftool' | 'mergetool'>('mergetool')
const gitScope = ref<'global' | 'local'>('global')
const executablePath = ref('open-diff')
const svnWrapperPath = ref('')
const integrationStatus = ref('')
const optionsStatus = ref('')
const integrationError = ref('')
const integrationWriting = ref(false)
const shortcutSearch = ref('')

type OptionsSectionId =
  | 'appearance'
  | 'colors'
  | 'toolbars'
  | 'tabs'
  | 'startup'
  | 'textEditing'
  | 'folderCompare'
  | 'folderMerge'
  | 'folderSync'
  | 'hexCompare'
  | 'pictureCompare'
  | 'mediaCompare'
  | 'versionCompare'
  | 'tableCompare'
  | 'fileFilters'
  | 'openWith'
  | 'shell'
  | 'backup'
  | 'fileOperations'
  | 'archiveTypes'
  | 'confirmations'
  | 'tweaks'
  | 'commands'
  | 'formats'
  | 'profiles'
  | 'reports'
  | 'shortcuts'
  | 'integration'
  | 'sessions'

const optionsSection = ref<OptionsSectionId>('appearance')
const archiveExtensionsDraft = ref(formatArchiveSuffixesInput(settings.archiveExtensions))
const folderCriteriaDraft = ref(loadFolderCompareCriteria())
const folderDisplayFiltersDraft = ref(loadFolderDisplayFilters())
const folderMergeDisplayDraft = ref(loadFolderMergeDisplay())
const folderSyncDefaultsDraft = ref(loadFolderSyncSessionOptions())
const folderSyncStrategyOptions: {
  value: FolderSyncSessionOptions['strategy']
  labelKey: string
}[] = [
  { value: 'updateRight', labelKey: 'sync.strategy.updateRight' },
  { value: 'updateLeft', labelKey: 'sync.strategy.updateLeft' },
  { value: 'updateBoth', labelKey: 'sync.strategy.updateBoth' },
  { value: 'mirrorRight', labelKey: 'sync.strategy.mirrorRight' },
  { value: 'mirrorLeft', labelKey: 'sync.strategy.mirrorLeft' },
]
const folderMergeViewPresetOptions: { value: FolderMergeViewPreset; labelKey: string }[] = [
  { value: 'all', labelKey: 'ui.showAll' },
  { value: 'changes', labelKey: 'ui.showChanges' },
  { value: 'conflicts', labelKey: 'ui.showConflicts' },
]
const folderDisplayStatusOptions: {
  statuses: FolderDisplayStatus[]
  labelKey: string
  testId: string
}[] = [
  { statuses: ['Same'], labelKey: 'ui.same', testId: 'same' },
  { statuses: ['Different'], labelKey: 'ui.different', testId: 'different' },
  { statuses: ['Left only', 'Right only'], labelKey: 'ui.orphans', testId: 'orphans' },
]
const textCompareDefaultsDraft = ref(loadTextCompareSessionOptions())
const hexCompareDefaultsDraft = ref(loadHexCompareSessionOptions())
const fileFiltersDraft = ref(loadFolderNameFilters())
const fileFiltersIncludeDraft = ref(
  formatFolderNameFilterStripPattern(fileFiltersDraft.value) === '*.*'
    ? ''
    : formatFolderNameFilterStripPattern(fileFiltersDraft.value),
)
const fileFiltersExcludeDraft = ref(formatFolderNameFilterDraft(fileFiltersDraft.value.exclude))
const fileFormatsDraft = ref<FileFormatDefinition[]>(loadFileFormats())
const fileFormatPreferencesDraft = ref(loadFileFormatPreferences())
const fileOperationPreferencesDraft = ref(loadFileOperationPreferences())
const reportPreferencesDraft = ref<ReportPreferences>(loadReportPreferences())
const profileDefaultsDraft = ref<RemoteProfileDefaults>(loadRemoteProfileDefaults())
const savedRemoteProfilesCount = computed(() => loadLocalRemoteProfiles().length)

function formatRgbaDraft(value: number[] | null): string {
  return value?.join(',') ?? ''
}

function parseRgbaDraft(value: string): number[] | null {
  return normalizeRgba(
    value
      .split(/[,\s]+/)
      .map((part) => part.trim())
      .filter(Boolean)
      .map(Number),
  )
}

const pictureCompareDefaultsDraft = ref(loadPictureCompareOptions())
const pictureIgnoreColorFromDraft = ref(
  formatRgbaDraft(pictureCompareDefaultsDraft.value.ignoreColorFrom),
)
const pictureIgnoreColorToDraft = ref(
  formatRgbaDraft(pictureCompareDefaultsDraft.value.ignoreColorTo),
)
const mediaCompareDefaultsDraft = ref(loadMediaCompareOptions())
const versionCompareDefaultsDraft = ref(loadVersionCompareOptions())
const tableCompareDefaultsDraft = ref(loadTableCompareSessionOptions())
const pictureBlendOptions = pictureBlendModes.map((value) => ({
  value,
  labelKey: `ui.blendMode${value.charAt(0).toUpperCase()}${value.slice(1)}`,
}))
const mediaFilterOptions = mediaFieldFilters.map((value) => ({
  value,
  labelKey: `ui.${value}` as const,
}))
const versionFilterOptions = versionFieldFilters.map((value) => ({
  value,
  labelKey: `ui.${value}` as const,
}))
const reportFormatOptions: { value: ReportPreferenceFormat; labelKey: string }[] = [
  { value: 'html', labelKey: 'ui.reportFormatHtml' },
  { value: 'html-side-by-side', labelKey: 'ui.reportFormatHtmlSideBySide' },
  { value: 'text', labelKey: 'ui.reportFormatText' },
  { value: 'json', labelKey: 'ui.reportFormatJson' },
  { value: 'csv', labelKey: 'ui.reportFormatCsv' },
  { value: 'markdown', labelKey: 'ui.reportFormatMarkdown' },
  { value: 'xml', labelKey: 'ui.reportFormatXml' },
]
const reportKindOptions: { value: ReportPreferenceKind; labelKey: string }[] = [
  { value: 'text', labelKey: 'ui.textCompare' },
  { value: 'folder', labelKey: 'ui.folderCompare' },
]
const profileProtocolOptions: { value: RemoteProtocol; label: string }[] = [
  { value: 'sftp', label: 'SFTP' },
  { value: 'ftp', label: 'FTP' },
  { value: 'ftps', label: 'FTPS' },
  { value: 'web-dav', label: 'WebDAV' },
  { value: 's3', label: 'S3' },
  { value: 'dropbox', label: 'Dropbox' },
  { value: 'one-drive', label: 'OneDrive' },
  { value: 'subversion', label: 'Subversion' },
]
const formatAssociationRows = computed(() =>
  optionsFormatAssociationIds
    .map((id) => fileFormatsDraft.value.find((format) => format.id === id))
    .filter((format): format is FileFormatDefinition => Boolean(format)),
)
const optionsTree = [
  {
    groupKey: 'ui.optionsGroupDisplay',
    items: [
      { id: 'appearance' as const, labelKey: 'ui.appearance' },
      { id: 'colors' as const, labelKey: 'ui.colors' },
      { id: 'toolbars' as const, labelKey: 'ui.toolbars' },
      { id: 'tabs' as const, labelKey: 'ui.tabs' },
      { id: 'startup' as const, labelKey: 'ui.startup' },
    ],
  },
  {
    groupKey: 'ui.optionsGroupEditing',
    items: [
      { id: 'textEditing' as const, labelKey: 'ui.textEditing' },
      { id: 'openWith' as const, labelKey: 'ui.openWith' },
      { id: 'backup' as const, labelKey: 'ui.backup' },
    ],
  },
  {
    groupKey: 'ui.optionsGroupCompare',
    items: [
      { id: 'folderCompare' as const, labelKey: 'ui.folderCompare' },
      { id: 'folderMerge' as const, labelKey: 'ui.folderMerge' },
      { id: 'folderSync' as const, labelKey: 'ui.folderSync' },
      { id: 'hexCompare' as const, labelKey: 'ui.hexCompare' },
      { id: 'pictureCompare' as const, labelKey: 'ui.pictureCompare' },
      { id: 'mediaCompare' as const, labelKey: 'ui.mediaCompare' },
      { id: 'versionCompare' as const, labelKey: 'ui.versionCompare' },
      { id: 'tableCompare' as const, labelKey: 'ui.tableCompare' },
      { id: 'fileFilters' as const, labelKey: 'ui.fileFilters' },
    ],
  },
  {
    groupKey: 'ui.optionsGroupSystem',
    items: [
      { id: 'shell' as const, labelKey: 'ui.shell' },
      { id: 'fileOperations' as const, labelKey: 'ui.fileOperations' },
      { id: 'archiveTypes' as const, labelKey: 'ui.archiveTypes' },
      { id: 'confirmations' as const, labelKey: 'ui.confirmations' },
      { id: 'tweaks' as const, labelKey: 'ui.tweaks' },
      { id: 'commands' as const, labelKey: 'ui.commandsVisibility' },
      { id: 'formats' as const, labelKey: 'ui.fileFormats' },
      { id: 'profiles' as const, labelKey: 'ui.profiles' },
      { id: 'reports' as const, labelKey: 'ui.reportsScripts' },
      { id: 'shortcuts' as const, labelKey: 'ui.shortcuts' },
      { id: 'integration' as const, labelKey: 'ui.integration' },
      { id: 'sessions' as const, labelKey: 'ui.sessions' },
    ],
  },
]
const openWithApps = ref<ExternalApplicationConfig[]>(loadExternalApplications())
const openWithDraft = ref({ name: '', executable: '' })
const fontFamilySelectOptions: SelectOption[] = [
  { label: 'System UI', value: 'system' },
  { label: 'Segoe UI', value: 'segoe' },
  { label: 'Inter', value: 'inter' },
  { label: 'Noto Sans', value: 'noto' },
  { label: 'Monospace', value: 'mono' },
]
const diffColorFields: { key: keyof DiffHighlightColors; labelKey: string }[] = [
  { key: 'addedBg', labelKey: 'ui.addedBackground' },
  { key: 'addedFg', labelKey: 'ui.addedForeground' },
  { key: 'deletedBg', labelKey: 'ui.deletedBackground' },
  { key: 'deletedFg', labelKey: 'ui.deletedForeground' },
  { key: 'modifiedBg', labelKey: 'ui.modifiedBackground' },
  { key: 'modifiedFg', labelKey: 'ui.modifiedForeground' },
]
const shortcutDrafts = ref<Record<string, string>>(
  Object.fromEntries(
    commandRegistry.map((command) => [
      command.id,
      shortcutToText(settings.getEffectiveShortcut(command)),
    ]),
  ),
)
const localeOptions: SelectOption[] = [
  { label: 'English', value: 'en-US' },
  { label: '简体中文', value: 'zh-CN' },
  { label: '繁體中文', value: 'zh-TW' },
  { label: 'Deutsch', value: 'de-DE' },
  { label: 'Français', value: 'fr-FR' },
  { label: 'Español', value: 'es-ES' },
  { label: '한국어', value: 'ko-KR' },
  { label: '日本語', value: 'ja-JP' },
]
const filteredShortcutCommands = computed(() =>
  filterCommands(commandRegistry, shortcutSearch.value),
)

function openFileFormats(): void {
  void router.push('/settings/file-formats')
}

function openRemoteProfiles(): void {
  void router.push('/settings/remote-profiles')
}

async function writeGitConfig(): Promise<void> {
  // eslint-disable-next-line no-alert -- existing Git write confirmation
  if (!window.confirm(t('ui.confirmWriteGitConfig', { kind: gitKind.value }))) {
    return
  }

  integrationWriting.value = true
  integrationError.value = ''

  try {
    await writeGitIntegration(
      gitKind.value,
      executablePath.value.trim() || 'open-diff',
      gitScope.value,
    )
    integrationStatus.value = t('status.gitConfigWritten', { kind: gitKind.value })
  } catch (error) {
    integrationError.value = error instanceof Error ? error.message : String(error)
  } finally {
    integrationWriting.value = false
  }
}

async function writeSvnConfig(): Promise<void> {
  // eslint-disable-next-line no-alert -- existing SVN write confirmation
  if (!window.confirm(t('ui.confirmWriteSvnConfig'))) {
    return
  }

  integrationWriting.value = true
  integrationError.value = ''

  try {
    const wrapper =
      svnWrapperPath.value.trim() || `${executablePath.value.trim() || 'open-diff'}-svn.sh`

    await writeSvnIntegration(executablePath.value.trim() || 'open-diff', wrapper)
    integrationStatus.value = t('status.svnConfigWritten')
  } catch (error) {
    integrationError.value = error instanceof Error ? error.message : String(error)
  } finally {
    integrationWriting.value = false
  }
}

function addSharedSessionPath(): void {
  if (settings.addSharedSessionPath(sharedSessionPathDraft.value)) {
    sharedSessionPathDraft.value = ''
  }
}

function loadSharedSessionJson(): void {
  sharedSessionImportError.value = ''

  try {
    const parsed = parseSessionPackage(sharedSessionJsonDraft.value)

    for (const session of parsed.sessions) {
      savedSessions.loadSharedSession(session)
    }

    sharedSessionJsonDraft.value = ''
  } catch (error) {
    sharedSessionImportError.value = error instanceof Error ? error.message : String(error)
  }
}

function updateLocale(value: string): void {
  settings.setLocale(value)
}

function updateFontFamily(value: string): void {
  settings.setFontFamily(value)
}

function onFontSizeInput(event: Event): void {
  const target = event.target

  if (!(target instanceof HTMLInputElement)) {
    return
  }

  settings.setFontSize(Number(target.value))
}

function onDiffColorInput(key: keyof DiffHighlightColors, event: Event): void {
  const target = event.target

  if (!(target instanceof HTMLInputElement)) {
    return
  }

  settings.setDiffColor(key, target.value)
}

function colorInputValue(value: string): string {
  if (/^#[0-9a-fA-F]{6}$/.test(value)) {
    return value
  }

  if (/^#[0-9a-fA-F]{3}$/.test(value)) {
    const [, a, b, c] = value

    return `#${a}${a}${b}${b}${c}${c}`
  }

  return '#000000'
}

function onConfirmBeforeDeleteChange(event: Event): void {
  const target = event.target

  if (!(target instanceof HTMLInputElement)) {
    return
  }

  settings.setConfirmBeforeDelete(target.checked)
}

function onWrapTextDefaultChange(event: Event): void {
  const target = event.target

  if (!(target instanceof HTMLInputElement)) {
    return
  }

  settings.setWrapTextDefault(target.checked)
}

function onConfirmBeforeSyncOverwriteChange(event: Event): void {
  const target = event.target

  if (!(target instanceof HTMLInputElement)) {
    return
  }

  settings.setConfirmBeforeSyncOverwrite(target.checked)
}

function onAutoScrollToFirstDifferenceChange(event: Event): void {
  const target = event.target

  if (!(target instanceof HTMLInputElement)) {
    return
  }

  settings.setAutoScrollToFirstDifference(target.checked)
}

function onCollapseIdenticalFoldersDefaultChange(event: Event): void {
  const target = event.target

  if (!(target instanceof HTMLInputElement)) {
    return
  }

  settings.setCollapseIdenticalFoldersDefault(target.checked)
}

function onShowHiddenFilesChange(event: Event): void {
  const target = event.target

  if (!(target instanceof HTMLInputElement)) {
    return
  }

  settings.setShowHiddenFiles(target.checked)
}

function onNotifyOnCompareCompleteChange(event: Event): void {
  const target = event.target

  if (!(target instanceof HTMLInputElement)) {
    return
  }

  settings.setNotifyOnCompareComplete(target.checked)
}

function onShowSessionToolbarsChange(event: Event): void {
  const target = event.target

  if (!(target instanceof HTMLInputElement)) {
    return
  }

  settings.setShowSessionToolbars(target.checked)
}

function onShowToolbarLabelsChange(event: Event): void {
  const target = event.target

  if (!(target instanceof HTMLInputElement)) {
    return
  }

  settings.setShowToolbarLabels(target.checked)
}

function onLargeToolbarButtonsChange(event: Event): void {
  const target = event.target

  if (!(target instanceof HTMLInputElement)) {
    return
  }

  settings.setLargeToolbarButtons(target.checked)
}

function onShowStatusBarChange(event: Event): void {
  const target = event.target

  if (!(target instanceof HTMLInputElement)) {
    return
  }

  settings.setShowStatusBar(target.checked)
}

function onShowPathBarsChange(event: Event): void {
  const target = event.target

  if (!(target instanceof HTMLInputElement)) {
    return
  }

  settings.setShowPathBars(target.checked)
}

function onShowSidebarChange(event: Event): void {
  const target = event.target

  if (!(target instanceof HTMLInputElement)) {
    return
  }

  settings.setShowSidebar(target.checked)
}

function onShowToolbarIconsChange(event: Event): void {
  const target = event.target

  if (!(target instanceof HTMLInputElement)) {
    return
  }

  settings.setShowToolbarIcons(target.checked)
}

function onConfirmBeforeCloseDirtyTabChange(event: Event): void {
  const target = event.target

  if (!(target instanceof HTMLInputElement)) {
    return
  }

  settings.setConfirmBeforeCloseDirtyTab(target.checked)
}

function onShowChromeUtilitiesChange(event: Event): void {
  const target = event.target

  if (!(target instanceof HTMLInputElement)) {
    return
  }

  settings.setShowChromeUtilities(target.checked)
}

function onConfirmBeforeQuitChange(event: Event): void {
  const target = event.target

  if (!(target instanceof HTMLInputElement)) {
    return
  }

  settings.setConfirmBeforeQuit(target.checked)
}

function onConfirmBeforeCopyChange(event: Event): void {
  const target = event.target

  if (!(target instanceof HTMLInputElement)) {
    return
  }

  settings.setConfirmBeforeCopy(target.checked)
}

function onIncludeHiddenItemsInFileActionsChange(event: Event): void {
  const target = event.target

  if (!(target instanceof HTMLInputElement)) {
    return
  }

  settings.setIncludeHiddenItemsInFileActions(target.checked)
}

function onBeepAfterLongFileOperationsChange(event: Event): void {
  const target = event.target

  if (!(target instanceof HTMLInputElement)) {
    return
  }

  settings.setBeepAfterLongFileOperations(target.checked)
}

function onPreserveTimestampsOnCopyChange(event: Event): void {
  const target = event.target

  if (!(target instanceof HTMLInputElement)) {
    return
  }

  settings.setPreserveTimestampsOnCopy(target.checked)
}

function onOverwriteReadOnlyFilesChange(event: Event): void {
  const target = event.target

  if (!(target instanceof HTMLInputElement)) {
    return
  }

  settings.setOverwriteReadOnlyFiles(target.checked)
}

function onLongFileOperationThresholdChange(event: Event): void {
  const target = event.target

  if (!(target instanceof HTMLInputElement)) {
    return
  }

  settings.setLongFileOperationThresholdMs(Math.max(1, Number(target.value) || 3) * 1000)
}

function onShowMillisecondsInTimestampsChange(event: Event): void {
  const target = event.target

  if (!(target instanceof HTMLInputElement)) {
    return
  }

  settings.setShowMillisecondsInTimestamps(target.checked)
}

function onProfileDefaultPortChange(event: Event): void {
  const target = event.target

  if (!(target instanceof HTMLInputElement)) {
    return
  }

  const raw = target.value.trim()

  profileDefaultsDraft.value.defaultPort =
    raw === '' ? null : Math.max(0, Math.round(Number(raw) || 0))
  persistProfileDefaultsDraft()
}

function onEnableRarArchiveTypesChange(event: Event): void {
  const target = event.target

  if (!(target instanceof HTMLInputElement)) {
    return
  }

  settings.setEnableRarArchiveTypes(target.checked)
  archiveExtensionsDraft.value = formatArchiveSuffixesInput(settings.archiveExtensions)
}

function onEscClosesFileViewsChange(event: Event): void {
  const target = event.target

  if (!(target instanceof HTMLInputElement)) {
    return
  }

  settings.setEscClosesFileViews(target.checked)
}

function onBeepWhenScriptFinishedChange(event: Event): void {
  const target = event.target

  if (!(target instanceof HTMLInputElement)) {
    return
  }

  settings.setBeepWhenScriptFinished(target.checked)
}

function onCloseWhenScriptFinishedChange(event: Event): void {
  const target = event.target

  if (!(target instanceof HTMLInputElement)) {
    return
  }

  settings.setCloseWhenScriptFinished(target.checked)
}

function onCheckForFilesChangedOnDiskChange(event: Event): void {
  const target = event.target

  if (!(target instanceof HTMLInputElement)) {
    return
  }

  settings.setCheckForFilesChangedOnDisk(target.checked)
}

function onAutoReloadUnlessChangesDiscardedChange(event: Event): void {
  const target = event.target

  if (!(target instanceof HTMLInputElement)) {
    return
  }

  settings.setAutoReloadUnlessChangesDiscarded(target.checked)
}

function onStickyHomeSessionSelectionChange(event: Event): void {
  const target = event.target

  if (!(target instanceof HTMLInputElement)) {
    return
  }

  settings.setStickyHomeSessionSelection(target.checked)
}

function onPreferIpv6WhenAvailableChange(event: Event): void {
  const target = event.target

  if (!(target instanceof HTMLInputElement)) {
    return
  }

  settings.setPreferIpv6WhenAvailable(target.checked)
}

function onWatchFoldersForChangesChange(event: Event): void {
  const target = event.target

  if (!(target instanceof HTMLInputElement)) {
    return
  }

  settings.setWatchFoldersForChanges(target.checked)
}

function onBinaryCompareBufferSizeChange(event: Event): void {
  const target = event.target

  if (!(target instanceof HTMLSelectElement) && !(target instanceof HTMLInputElement)) {
    return
  }

  settings.setBinaryCompareBufferSize(Number(target.value))
}

function onConfirmBeforeMoveChange(event: Event): void {
  const target = event.target

  if (!(target instanceof HTMLInputElement)) {
    return
  }

  settings.setConfirmBeforeMove(target.checked)
}

function onConfirmBeforeSyncDeleteChange(event: Event): void {
  const target = event.target

  if (!(target instanceof HTMLInputElement)) {
    return
  }

  settings.setConfirmBeforeSyncDelete(target.checked)
}

function onCreateBackupOnReportExportChange(event: Event): void {
  const target = event.target

  if (!(target instanceof HTMLInputElement)) {
    return
  }

  settings.setCreateBackupOnReportExport(target.checked)
}

function onShowFolderLegendChange(event: Event): void {
  const target = event.target

  if (!(target instanceof HTMLInputElement)) {
    return
  }

  settings.setShowFolderLegend(target.checked)
}

function onConfirmBeforeOverwriteSaveChange(event: Event): void {
  const target = event.target

  if (!(target instanceof HTMLInputElement)) {
    return
  }

  settings.setConfirmBeforeOverwriteSave(target.checked)
}

function onAlwaysShowTabBarChange(event: Event): void {
  const target = event.target

  if (!(target instanceof HTMLInputElement)) {
    return
  }

  settings.setAlwaysShowTabBar(target.checked)
}

function onOpenSessionsInNewTabChange(event: Event): void {
  const target = event.target

  if (!(target instanceof HTMLInputElement)) {
    return
  }

  settings.setOpenSessionsInNewTab(target.checked)
}

function onShowNextDifferenceInToolbarChange(event: Event): void {
  const target = event.target

  if (!(target instanceof HTMLInputElement)) {
    return
  }

  settings.setShowNextDifferenceInToolbar(target.checked)
}

function onShowPrevDifferenceInToolbarChange(event: Event): void {
  const target = event.target

  if (!(target instanceof HTMLInputElement)) {
    return
  }

  settings.setShowPrevDifferenceInToolbar(target.checked)
}

async function applyArchiveExtensionsFromOptions(): Promise<void> {
  settings.setArchiveExtensions(parseArchiveSuffixesInput(archiveExtensionsDraft.value))
  archiveExtensionsDraft.value = formatArchiveSuffixesInput(settings.archiveExtensions)
  try {
    await syncArchiveExtensionsBackend([...settings.archiveExtensions])
    optionsStatus.value = t('ui.archiveTypesSynced')
  } catch {
    optionsStatus.value = t('ui.archiveTypesLocalOnly')
  }
}

function onLoadLastWorkspaceOnStartupChange(event: Event): void {
  const target = event.target

  if (!(target instanceof HTMLInputElement)) {
    return
  }

  settings.setLoadLastWorkspaceOnStartup(target.checked)
}

function restoreFactoryDefaultsFromOptions(): void {
  settings.restoreFactoryDefaults()
  folderCriteriaDraft.value = defaultFolderCompareCriteria()
  saveFolderCompareCriteria(folderCriteriaDraft.value)
  folderDisplayFiltersDraft.value = defaultFolderDisplayFilters()
  saveFolderDisplayFilters(folderDisplayFiltersDraft.value)
  folderMergeDisplayDraft.value = defaultFolderMergeDisplay()
  saveFolderMergeDisplay(folderMergeDisplayDraft.value)
  folderSyncDefaultsDraft.value = defaultFolderSyncSessionOptions()
  saveFolderSyncSessionOptions(folderSyncDefaultsDraft.value)
  textCompareDefaultsDraft.value = defaultTextCompareSessionOptions()
  saveTextCompareSessionOptions(textCompareDefaultsDraft.value)
  hexCompareDefaultsDraft.value = defaultHexCompareSessionOptions()
  saveHexCompareSessionOptions(hexCompareDefaultsDraft.value)
  fileFiltersDraft.value = defaultFolderNameFilters()
  saveFolderNameFilters(fileFiltersDraft.value)
  fileFiltersIncludeDraft.value = ''
  fileFiltersExcludeDraft.value = ''
  fileFormatsDraft.value = builtInFileFormats.map((format) => ({
    ...format,
    enabled: true,
    matcher: {
      extensions: [...format.matcher.extensions],
      fileNames: [...format.matcher.fileNames],
      globs: [...format.matcher.globs],
    },
    rules: { ...format.rules, ignore: [...format.rules.ignore] },
  }))
  saveFileFormats(fileFormatsDraft.value)
  fileFormatPreferencesDraft.value = defaultFileFormatPreferences()
  saveFileFormatPreferences(fileFormatPreferencesDraft.value)
  fileOperationPreferencesDraft.value = defaultFileOperationPreferences()
  saveFileOperationPreferences(fileOperationPreferencesDraft.value)
  reportPreferencesDraft.value = defaultReportPreferences()
  saveReportPreferences(reportPreferencesDraft.value)
  profileDefaultsDraft.value = defaultRemoteProfileDefaults()
  saveRemoteProfileDefaults(profileDefaultsDraft.value)
  pictureCompareDefaultsDraft.value = defaultPictureCompareOptions()
  pictureIgnoreColorFromDraft.value = ''
  pictureIgnoreColorToDraft.value = ''
  savePictureCompareOptions(pictureCompareDefaultsDraft.value)
  mediaCompareDefaultsDraft.value = defaultMediaCompareOptions()
  saveMediaCompareOptions(mediaCompareDefaultsDraft.value)
  versionCompareDefaultsDraft.value = defaultVersionCompareOptions()
  saveVersionCompareOptions(versionCompareDefaultsDraft.value)
  tableCompareDefaultsDraft.value = defaultTableCompareSessionOptions()
  saveTableCompareSessionOptions(tableCompareDefaultsDraft.value)
  optionsStatus.value = t('ui.restoreFactoryDefaults')
}

function persistFolderCriteriaDraft(): void {
  saveFolderCompareCriteria(folderCriteriaDraft.value)
}

function persistFolderDisplayFiltersDraft(): void {
  saveFolderDisplayFilters(folderDisplayFiltersDraft.value)
}

function persistFolderMergeDisplayDraft(): void {
  saveFolderMergeDisplay(folderMergeDisplayDraft.value)
}

function persistFolderSyncDefaultsDraft(): void {
  saveFolderSyncSessionOptions(folderSyncDefaultsDraft.value)
}

function folderDisplayStatusChecked(statuses: FolderDisplayStatus[]): boolean {
  return statuses.every((status) => folderDisplayFiltersDraft.value.statuses.includes(status))
}

function toggleFolderDisplayStatuses(statuses: FolderDisplayStatus[], selected: boolean): void {
  const next = new Set(folderDisplayFiltersDraft.value.statuses)

  for (const status of statuses) {
    if (selected) {
      next.add(status)
    } else {
      next.delete(status)
    }
  }

  folderDisplayFiltersDraft.value = {
    ...folderDisplayFiltersDraft.value,
    statuses: [...next],
  }
  persistFolderDisplayFiltersDraft()
}

function onIgnoredTimezoneOffsetsChange(event: Event): void {
  const target = event.target

  if (!(target instanceof HTMLInputElement)) {
    return
  }

  folderCriteriaDraft.value.ignoredTimezoneHourOffsets = parseIgnoredTimezoneHourOffsetsInput(
    target.value,
  )
  persistFolderCriteriaDraft()
}

function persistFileFormatPreferencesDraft(): void {
  saveFileFormatPreferences(fileFormatPreferencesDraft.value)
}

function persistFileOperationPreferencesDraft(): void {
  saveFileOperationPreferences(fileOperationPreferencesDraft.value)
}

function onProfileConnectionTimeoutChange(event: Event): void {
  const target = event.target

  if (!(target instanceof HTMLInputElement)) {
    return
  }

  profileDefaultsDraft.value.connectionTimeoutSeconds = Math.max(
    1,
    Math.round(Number(target.value) || 30),
  )
  persistProfileDefaultsDraft()
}

function onFolderTimestampToleranceChange(event: Event): void {
  const target = event.target

  if (!(target instanceof HTMLInputElement)) {
    return
  }

  folderCriteriaDraft.value.timestampToleranceMs = Math.max(
    0,
    Math.round(Number(target.value) || 0) * 1000,
  )
  persistFolderCriteriaDraft()
}

function persistTextCompareDefaultsDraft(): void {
  textCompareDefaultsDraft.value = {
    ...textCompareDefaultsDraft.value,
    ignoreRegexes: textCompareDefaultsDraft.value.ignoreRegexes
      .map((item) => item.trim())
      .filter(Boolean),
  }
  saveTextCompareSessionOptions(textCompareDefaultsDraft.value)
}

const textIgnoreRegexesDraft = computed({
  get: () => textCompareDefaultsDraft.value.ignoreRegexes.join(', '),
  set: (value: string) => {
    textCompareDefaultsDraft.value = {
      ...textCompareDefaultsDraft.value,
      ignoreRegexes: value
        .split(/[,\n]/u)
        .map((item) => item.trim())
        .filter(Boolean),
    }
  },
})

function persistHexCompareDefaultsDraft(): void {
  hexCompareDefaultsDraft.value = {
    ...hexCompareDefaultsDraft.value,
    bytesPerRow: normalizeHexBytesPerRow(hexCompareDefaultsDraft.value.bytesPerRow),
  }
  saveHexCompareSessionOptions(hexCompareDefaultsDraft.value)
  settings.setBinaryCompareBufferSize(hexCompareDefaultsDraft.value.windowLength)
}

function persistFileFiltersDraft(): void {
  fileFiltersDraft.value = {
    include: parseFolderNameFilterStripPattern(fileFiltersIncludeDraft.value),
    exclude: fileFiltersExcludeDraft.value
      .split(/[\n,;]/u)
      .map((item) => item.trim())
      .filter(Boolean),
    caseSensitive: fileFiltersDraft.value.caseSensitive,
  }
  saveFolderNameFilters(fileFiltersDraft.value)
}

function onFormatAssociationToggle(id: string, event: Event): void {
  const target = event.target

  if (!(target instanceof HTMLInputElement)) {
    return
  }
  fileFormatsDraft.value = setFileFormatEnabled(fileFormatsDraft.value, id, target.checked)
}

function persistReportPreferencesDraft(): void {
  saveReportPreferences(reportPreferencesDraft.value)
}

function persistProfileDefaultsDraft(): void {
  saveRemoteProfileDefaults(profileDefaultsDraft.value)
}

function persistPictureCompareDefaultsDraft(): void {
  savePictureCompareOptions(pictureCompareDefaultsDraft.value)
}

function persistPictureIgnoreColorDefaults(): void {
  pictureCompareDefaultsDraft.value = {
    ...pictureCompareDefaultsDraft.value,
    ignoreColorFrom: parseRgbaDraft(pictureIgnoreColorFromDraft.value),
    ignoreColorTo: parseRgbaDraft(pictureIgnoreColorToDraft.value),
  }
  persistPictureCompareDefaultsDraft()
  pictureIgnoreColorFromDraft.value = formatRgbaDraft(
    pictureCompareDefaultsDraft.value.ignoreColorFrom,
  )
  pictureIgnoreColorToDraft.value = formatRgbaDraft(pictureCompareDefaultsDraft.value.ignoreColorTo)
}

function persistMediaCompareDefaultsDraft(): void {
  saveMediaCompareOptions(mediaCompareDefaultsDraft.value)
}

function persistVersionCompareDefaultsDraft(): void {
  saveVersionCompareOptions(versionCompareDefaultsDraft.value)
}

const mediaUnimportantFieldsDraft = computed({
  get: () => mediaCompareDefaultsDraft.value.unimportantFields.join(', '),
  set: (value: string) => {
    mediaCompareDefaultsDraft.value = {
      ...mediaCompareDefaultsDraft.value,
      unimportantFields: value
        .split(/[,\n]/u)
        .map((item) => item.trim())
        .filter(Boolean),
    }
  },
})

const versionUnimportantFieldsDraft = computed({
  get: () => versionCompareDefaultsDraft.value.unimportantFields.join(', '),
  set: (value: string) => {
    versionCompareDefaultsDraft.value = {
      ...versionCompareDefaultsDraft.value,
      unimportantFields: value
        .split(/[,\n]/u)
        .map((item) => item.trim())
        .filter(Boolean),
    }
  },
})

function persistTableCompareDefaultsDraft(): void {
  tableCompareDefaultsDraft.value = {
    ...tableCompareDefaultsDraft.value,
    keyColumns: tableCompareDefaultsDraft.value.keyColumns.trim() || '0',
    ignoredColumns: tableCompareDefaultsDraft.value.ignoredColumns
      .map((item) => item.trim())
      .filter(Boolean),
  }
  saveTableCompareSessionOptions(tableCompareDefaultsDraft.value)
}

const tableIgnoredColumnsDraft = computed({
  get: () => tableCompareDefaultsDraft.value.ignoredColumns.join(', '),
  set: (value: string) => {
    tableCompareDefaultsDraft.value = {
      ...tableCompareDefaultsDraft.value,
      ignoredColumns: value
        .split(/[,\n]/u)
        .map((item) => item.trim())
        .filter(Boolean),
    }
  },
})

function clearReportExportHistoryFromOptions(): void {
  clearRecentReportExports()
  optionsStatus.value = t('ui.reportHistoryCleared')
}

function openReportsScripts(): void {
  void router.push('/reports/scripts')
}

function onCreateBackupOnSaveChange(event: Event): void {
  const target = event.target

  if (!(target instanceof HTMLInputElement)) {
    return
  }

  settings.setCreateBackupOnSave(target.checked)
}

function onBackupRetentionCountChange(event: Event): void {
  const target = event.target

  if (!(target instanceof HTMLInputElement)) {
    return
  }

  settings.setBackupRetentionCount(Number(target.value))
}

function onShowSessionsInToolbarChange(event: Event): void {
  const target = event.target

  if (!(target instanceof HTMLInputElement)) {
    return
  }

  settings.setShowSessionsInToolbar(target.checked)
}

function onShowGotoInToolbarChange(event: Event): void {
  const target = event.target

  if (!(target instanceof HTMLInputElement)) {
    return
  }

  settings.setShowGotoInToolbar(target.checked)
}

function onShowWrapInToolbarChange(event: Event): void {
  const target = event.target

  if (!(target instanceof HTMLInputElement)) {
    return
  }

  settings.setShowWrapInToolbar(target.checked)
}

function onShowSyncNowInToolbarChange(event: Event): void {
  const target = event.target

  if (!(target instanceof HTMLInputElement)) {
    return
  }

  settings.setShowSyncNowInToolbar(target.checked)
}

function onShowSyncCancelAcceptInToolbarChange(event: Event): void {
  const target = event.target

  if (!(target instanceof HTMLInputElement)) {
    return
  }

  settings.setShowSyncCancelAcceptInToolbar(target.checked)
}

function persistOpenWithApps(): void {
  saveExternalApplications(openWithApps.value)
}

function toggleOpenWithApp(id: string, enabled: boolean): void {
  openWithApps.value = openWithApps.value.map((app) => (app.id === id ? { ...app, enabled } : app))
  persistOpenWithApps()
}

function removeOpenWithApp(id: string): void {
  openWithApps.value = openWithApps.value.filter((app) => app.id !== id)
  persistOpenWithApps()
}

function addOpenWithApp(): void {
  const name = openWithDraft.value.name.trim()
  const executable = openWithDraft.value.executable.trim()

  if (!name || !executable) {
    return
  }

  const id = `${name.toLowerCase().replace(/[^a-z0-9]+/gu, '-')}-${String(openWithApps.value.length + 1)}`

  openWithApps.value = [
    ...openWithApps.value,
    {
      id,
      name,
      executable,
      enabled: true,
    },
  ]
  openWithDraft.value = { name: '', executable: '' }
  persistOpenWithApps()
}

async function registerShellExtension(): Promise<void> {
  integrationWriting.value = true
  integrationError.value = ''

  try {
    const result = await registerWindowsShellExtension(executablePath.value.trim() || undefined)

    integrationStatus.value = result.applied
      ? t('status.shellRegistered')
      : t('status.shellScriptGenerated')
  } catch (error) {
    integrationError.value = error instanceof Error ? error.message : String(error)
  } finally {
    integrationWriting.value = false
  }
}

async function unregisterShellExtension(): Promise<void> {
  integrationWriting.value = true
  integrationError.value = ''

  try {
    const result = await unregisterWindowsShellExtension(executablePath.value.trim() || undefined)

    integrationStatus.value = result.applied
      ? t('status.shellUnregistered')
      : t('status.shellUnregisterScriptGenerated')
  } catch (error) {
    integrationError.value = error instanceof Error ? error.message : String(error)
  } finally {
    integrationWriting.value = false
  }
}

async function registerUnixShell(): Promise<void> {
  integrationWriting.value = true
  integrationError.value = ''

  try {
    const result = await registerUnixShellIntegration(executablePath.value.trim() || undefined)

    integrationStatus.value = result.applied
      ? t('status.unixShellRegistered')
      : t('status.unixShellScriptGenerated')
  } catch (error) {
    integrationError.value = error instanceof Error ? error.message : String(error)
  } finally {
    integrationWriting.value = false
  }
}

async function unregisterUnixShell(): Promise<void> {
  integrationWriting.value = true
  integrationError.value = ''

  try {
    const result = await unregisterUnixShellIntegration(executablePath.value.trim() || undefined)

    integrationStatus.value = result.applied
      ? t('status.unixShellUnregistered')
      : t('status.unixShellScriptGenerated')
  } catch (error) {
    integrationError.value = error instanceof Error ? error.message : String(error)
  } finally {
    integrationWriting.value = false
  }
}

function saveShortcut(command: AppCommand): void {
  const keys = parseShortcutText(shortcutDrafts.value[command.id] ?? '')

  if (
    settings.setShortcutOverride(command.id, {
      keys,
      scope: command.defaultShortcut.scope,
    })
  ) {
    shortcutDrafts.value[command.id] = shortcutToText(settings.getEffectiveShortcut(command))
  }
}

function resetShortcut(command: AppCommand): void {
  settings.resetShortcutOverride(command.id)
  shortcutDrafts.value[command.id] = shortcutToText(command.defaultShortcut)
}

function shortcutToText(shortcut: CommandShortcut): string {
  return shortcut.keys.join('+')
}

function onAutoSaveLimitInput(event: Event): void {
  const target = event.target

  if (!(target instanceof HTMLInputElement)) {
    return
  }

  settings.setAutoSaveLimit(Number(target.value))
}

function parseShortcutText(value: string): string[] {
  return value
    .split('+')
    .map((key) => key.trim())
    .filter(Boolean)
}
</script>

<template>
  <WorkbenchShell
    :title="$t('ui.settings')"
    :eyebrow="$t('ui.policy')"
    :subtitle="$t('ui.manageMatchingRulesDefaultViewsAndRuleReferences')"
    :inspector-label="$t('ui.settingsInspector')"
  >
    <section
      class="settings-view"
      data-options-density="capture-1to1"
    >
      <nav
        class="options-section-nav options-section-tree"
        data-testid="options-section-nav"
        data-options-tree-depth="capture-1to1"
        :aria-label="$t('ui.options')"
      >
        <div
          v-for="group in optionsTree"
          :key="group.groupKey"
          class="options-tree-group"
          data-tree-depth="0"
        >
          <p
            class="options-tree-group-label"
            data-tree-depth="0"
          >
            {{ $t(group.groupKey) }}
          </p>
          <button
            v-for="section in group.items"
            :key="section.id"
            type="button"
            class="options-section-button"
            :class="{ active: optionsSection === section.id }"
            data-tree-depth="1"
            :data-testid="`options-section-${section.id}`"
            @click="optionsSection = section.id"
          >
            {{ $t(section.labelKey) }}
          </button>
        </div>
      </nav>

      <div
        class="options-content"
        data-testid="options-content"
        data-options-content-density="capture-1to1"
      >
        <NCard
          v-show="optionsSection === 'appearance'"
          :title="$t('ui.appearance')"
          size="small"
          data-testid="options-appearance-card"
        >
          <NSpace align="center">
            <span>{{ $t('ui.theme') }}</span>
            <NRadioGroup v-model:value="settings.theme">
              <NRadioButton value="dark">{{ $t('ui.dark') }}</NRadioButton>
              <NRadioButton value="light">{{ $t('ui.light') }}</NRadioButton>
              <NRadioButton
                data-testid="theme-follow-system"
                value="system"
                >{{ $t('ui.followSystem') }}</NRadioButton
              >
            </NRadioGroup>
          </NSpace>
          <NSpace align="center">
            <span>{{ $t('ui.language') }}</span>
            <NSelect
              :value="settings.locale"
              class="locale-select"
              data-testid="locale-select"
              :options="localeOptions"
              @update:value="updateLocale"
            />
          </NSpace>
          <label class="auto-save-limit-row">
            <span>{{ $t('ui.autoSaveLimit') }}</span>
            <input
              class="auto-save-limit-input"
              data-testid="auto-save-limit"
              type="number"
              min="0"
              max="50"
              :value="settings.autoSaveLimit"
              @input="onAutoSaveLimitInput"
            />
          </label>
          <NSpace align="center">
            <span>{{ $t('ui.fontFamily') }}</span>
            <NSelect
              :value="settings.fontFamily"
              class="font-family-select"
              data-testid="font-family-select"
              :options="fontFamilySelectOptions"
              @update:value="updateFontFamily"
            />
          </NSpace>
          <label class="font-size-row">
            <span>{{ $t('ui.fontSize') }}</span>
            <input
              class="font-size-input"
              data-testid="font-size-input"
              type="number"
              min="12"
              max="24"
              :value="settings.fontSize"
              @input="onFontSizeInput"
            />
          </label>
          <label class="tweak-row">
            <input
              data-testid="show-status-bar"
              type="checkbox"
              :checked="settings.showStatusBar"
              @change="onShowStatusBarChange"
            />
            <span>{{ $t('ui.showStatusBar') }}</span>
          </label>
          <label class="tweak-row">
            <input
              data-testid="show-path-bars"
              type="checkbox"
              :checked="settings.showPathBars"
              @change="onShowPathBarsChange"
            />
            <span>{{ $t('ui.showPathBars') }}</span>
          </label>
          <label class="tweak-row">
            <input
              data-testid="show-sidebar"
              type="checkbox"
              :checked="settings.showSidebar"
              @change="onShowSidebarChange"
            />
            <span>{{ $t('ui.showSidebar') }}</span>
          </label>
          <label class="tweak-row">
            <input
              data-testid="show-chrome-utilities"
              type="checkbox"
              :checked="settings.showChromeUtilities"
              @change="onShowChromeUtilitiesChange"
            />
            <span>{{ $t('ui.showChromeUtilities') }}</span>
          </label>
          <p class="options-hint">{{ $t('ui.showChromeUtilitiesHint') }}</p>
          <label class="tweak-row">
            <input
              data-testid="show-folder-legend"
              type="checkbox"
              :checked="settings.showFolderLegend"
              @change="onShowFolderLegendChange"
            />
            <span>{{ $t('ui.showFolderLegend') }}</span>
          </label>
          <p class="options-hint">{{ $t('ui.showFolderLegendHint') }}</p>
          <p class="options-hint">{{ $t('ui.appearanceChromeHint') }}</p>
        </NCard>

        <NCard
          v-show="optionsSection === 'colors'"
          :title="$t('ui.diffHighlightColors')"
          size="small"
          data-testid="options-colors-card"
        >
          <div class="diff-color-grid">
            <label
              v-for="field in diffColorFields"
              :key="field.key"
              class="diff-color-row"
            >
              <span>{{ $t(field.labelKey) }}</span>
              <input
                class="diff-color-picker"
                type="color"
                :data-testid="`diff-color-${field.key}`"
                :value="colorInputValue(settings.diffColors[field.key])"
                @input="onDiffColorInput(field.key, $event)"
              />
              <input
                class="diff-color-text"
                type="text"
                :data-testid="`diff-color-text-${field.key}`"
                :value="settings.diffColors[field.key]"
                @change="onDiffColorInput(field.key, $event)"
              />
            </label>
          </div>
          <div
            class="diff-color-preview"
            data-testid="diff-color-preview"
          >
            <span class="preview-swatch added">{{ $t('ui.added') }}</span>
            <span class="preview-swatch deleted">{{ $t('ui.removed') }}</span>
            <span class="preview-swatch modified">{{ $t('ui.modified') }}</span>
          </div>
          <NButton
            size="small"
            data-testid="reset-diff-colors"
            @click="settings.resetDiffColors()"
            >{{ $t('ui.resetColors') }}</NButton
          >
        </NCard>

        <NCard
          v-show="optionsSection === 'toolbars'"
          :title="$t('ui.toolbars')"
          size="small"
          data-testid="options-toolbars-card"
        >
          <label class="tweak-row">
            <input
              data-testid="show-session-toolbars"
              type="checkbox"
              :checked="settings.showSessionToolbars"
              @change="onShowSessionToolbarsChange"
            />
            <span>{{ $t('ui.showSessionToolbars') }}</span>
          </label>
          <label class="tweak-row">
            <input
              data-testid="show-toolbar-labels"
              type="checkbox"
              :checked="settings.showToolbarLabels"
              @change="onShowToolbarLabelsChange"
            />
            <span>{{ $t('ui.showToolbarLabels') }}</span>
          </label>
          <label class="tweak-row">
            <input
              data-testid="large-toolbar-buttons"
              type="checkbox"
              :checked="settings.largeToolbarButtons"
              @change="onLargeToolbarButtonsChange"
            />
            <span>{{ $t('ui.largeToolbarButtons') }}</span>
          </label>
          <label class="tweak-row">
            <input
              data-testid="show-toolbar-icons"
              type="checkbox"
              :checked="settings.showToolbarIcons"
              @change="onShowToolbarIconsChange"
            />
            <span>{{ $t('ui.showToolbarIcons') }}</span>
          </label>
          <label class="tweak-row">
            <input
              data-testid="show-next-difference-in-toolbar"
              type="checkbox"
              :checked="settings.showNextDifferenceInToolbar"
              @change="onShowNextDifferenceInToolbarChange"
            />
            <span>{{ $t('ui.showNextDifferenceInToolbar') }}</span>
          </label>
          <label class="tweak-row">
            <input
              data-testid="show-prev-difference-in-toolbar"
              type="checkbox"
              :checked="settings.showPrevDifferenceInToolbar"
              @change="onShowPrevDifferenceInToolbarChange"
            />
            <span>{{ $t('ui.showPrevDifferenceInToolbar') }}</span>
          </label>
          <p class="options-hint">{{ $t('ui.toolbarsHint') }}</p>
        </NCard>

        <NCard
          v-show="optionsSection === 'tabs'"
          :title="$t('ui.tabs')"
          size="small"
          data-testid="options-tabs-card"
        >
          <label class="tweak-row">
            <input
              data-testid="always-show-tab-bar"
              type="checkbox"
              :checked="settings.alwaysShowTabBar"
              @change="onAlwaysShowTabBarChange"
            />
            <span>{{ $t('ui.alwaysShowTabBar') }}</span>
          </label>
          <label class="tweak-row">
            <input
              data-testid="open-sessions-in-new-tab"
              type="checkbox"
              :checked="settings.openSessionsInNewTab"
              @change="onOpenSessionsInNewTabChange"
            />
            <span>{{ $t('ui.openSessionsInNewTab') }}</span>
          </label>
          <p class="options-hint">{{ $t('ui.tabsHint') }}</p>
        </NCard>

        <NCard
          v-show="optionsSection === 'startup'"
          :title="$t('ui.startup')"
          size="small"
          data-testid="options-startup-card"
        >
          <label class="tweak-row">
            <input
              data-testid="load-last-workspace-on-startup"
              type="checkbox"
              :checked="settings.loadLastWorkspaceOnStartup"
              @change="onLoadLastWorkspaceOnStartupChange"
            />
            <span>{{ $t('ui.loadLastWorkspaceOnStartup') }}</span>
          </label>
          <p class="options-hint">{{ $t('ui.startupHint') }}</p>
        </NCard>

        <NCard
          v-show="optionsSection === 'textEditing'"
          :title="$t('ui.textEditing')"
          size="small"
          data-testid="options-text-editing-card"
        >
          <label class="tweak-row">
            <input
              data-testid="wrap-text-default-editing"
              type="checkbox"
              :checked="settings.wrapTextDefault"
              @change="onWrapTextDefaultChange"
            />
            <span>{{ $t('ui.wrapTextDefault') }}</span>
          </label>
          <label class="tweak-row">
            <input
              data-testid="auto-scroll-first-difference-editing"
              type="checkbox"
              :checked="settings.autoScrollToFirstDifference"
              @change="onAutoScrollToFirstDifferenceChange"
            />
            <span>{{ $t('ui.autoScrollToFirstDifference') }}</span>
          </label>
          <label class="tweak-row">
            <input
              v-model="textCompareDefaultsDraft.ignoreWhitespace"
              data-testid="ignore-whitespace-default"
              type="checkbox"
              @change="persistTextCompareDefaultsDraft"
            />
            <span>{{ $t('ui.ignoreWhitespaceDifferences') }}</span>
          </label>
          <label class="tweak-row">
            <input
              v-model="textCompareDefaultsDraft.ignoreCase"
              data-testid="ignore-case-default"
              type="checkbox"
              @change="persistTextCompareDefaultsDraft"
            />
            <span>{{ $t('ui.ignoreCaseDifferences') }}</span>
          </label>
          <label class="tweak-row">
            <input
              v-model="textCompareDefaultsDraft.ignoreLineEndings"
              data-testid="ignore-line-endings-default"
              type="checkbox"
              @change="persistTextCompareDefaultsDraft"
            />
            <span>{{ $t('ui.ignoreLineEndingDifferences') }}</span>
          </label>
          <label class="stack-row">
            <span>{{ $t('ui.diffAlgorithm') }}</span>
            <select
              v-model="textCompareDefaultsDraft.algorithm"
              data-testid="text-compare-algorithm-default"
              @change="persistTextCompareDefaultsDraft"
            >
              <option value="myers">{{ $t('ui.myers') }}</option>
              <option value="patience">{{ $t('ui.patience') }}</option>
              <option value="histogram">{{ $t('ui.histogram') }}</option>
            </select>
          </label>
          <label class="stack-row">
            <span>{{ $t('ui.replacements') }}</span>
            <input
              v-model="textIgnoreRegexesDraft"
              data-testid="text-compare-ignore-regexes-default"
              type="text"
              :placeholder="$t('ui.regex')"
              @change="persistTextCompareDefaultsDraft"
            />
          </label>
          <p class="options-hint">{{ $t('ui.textEditingHint') }}</p>
        </NCard>

        <NCard
          v-show="optionsSection === 'folderCompare'"
          :title="$t('ui.folderCompare')"
          size="small"
          data-testid="options-folder-compare-card"
        >
          <label class="tweak-row">
            <input
              v-model="folderCriteriaDraft.compareSize"
              data-testid="folder-compare-size"
              type="checkbox"
              @change="persistFolderCriteriaDraft"
            />
            <span>{{ $t('ui.compareBySize') }}</span>
          </label>
          <label class="tweak-row">
            <input
              v-model="folderCriteriaDraft.compareModifiedTime"
              data-testid="folder-compare-timestamp"
              type="checkbox"
              @change="persistFolderCriteriaDraft"
            />
            <span>{{ $t('ui.compareByTimestamp') }}</span>
          </label>
          <label class="tweak-row">
            <input
              v-model="folderCriteriaDraft.compareContents"
              data-testid="folder-compare-contents"
              type="checkbox"
              @change="persistFolderCriteriaDraft"
            />
            <span>{{ $t('ui.compareBinaryContents') }}</span>
          </label>
          <label class="tweak-row">
            <input
              v-model="folderCriteriaDraft.compareCrc"
              data-testid="folder-compare-crc"
              type="checkbox"
              @change="persistFolderCriteriaDraft"
            />
            <span>{{ $t('ui.compareCrc') }}</span>
          </label>
          <label class="tweak-row">
            <input
              v-model="folderCriteriaDraft.compareAttributes"
              data-testid="folder-compare-attributes"
              type="checkbox"
              @change="persistFolderCriteriaDraft"
            />
            <span>{{ $t('ui.compareAttributes') }}</span>
          </label>
          <label class="tweak-row">
            <input
              v-model="folderCriteriaDraft.sizeOnlyUnimportant"
              data-testid="folder-compare-size-only-unimportant"
              type="checkbox"
              @change="persistFolderCriteriaDraft"
            />
            <span>{{ $t('ui.sizeOnlyUnimportant') }}</span>
          </label>
          <label class="tweak-row">
            <input
              v-model="folderCriteriaDraft.followSymlinks"
              data-testid="folder-compare-follow-symlinks"
              type="checkbox"
              @change="persistFolderCriteriaDraft"
            />
            <span>{{ $t('ui.followSymlinks') }}</span>
          </label>
          <label class="auto-save-limit-row">
            <span>{{ $t('ui.timestampToleranceSeconds') }}</span>
            <input
              class="auto-save-limit-input"
              data-testid="folder-compare-timestamp-tolerance"
              type="number"
              min="0"
              max="86400"
              step="1"
              :value="Math.round((folderCriteriaDraft.timestampToleranceMs ?? 0) / 1000)"
              @change="onFolderTimestampToleranceChange"
            />
          </label>
          <label class="tweak-row">
            <input
              v-model="folderCriteriaDraft.ignoreDaylightSavingHourOffset"
              data-testid="folder-compare-ignore-dst"
              type="checkbox"
              @change="persistFolderCriteriaDraft"
            />
            <span>{{ $t('ui.ignoreDaylightSavingHourOffset') }}</span>
          </label>
          <label class="tweak-row">
            <input
              v-model="folderCriteriaDraft.caseSensitiveNames"
              data-testid="folder-compare-case-sensitive-names"
              type="checkbox"
              @change="persistFolderCriteriaDraft"
            />
            <span>{{ $t('ui.caseSensitiveNames') }}</span>
          </label>
          <label class="auto-save-limit-row">
            <span>{{ $t('ui.ignoredTimezoneHourOffsets') }}</span>
            <input
              class="auto-save-limit-input"
              data-testid="folder-compare-ignored-timezone-offsets"
              type="text"
              :value="
                formatIgnoredTimezoneHourOffsetsInput(
                  folderCriteriaDraft.ignoredTimezoneHourOffsets ?? [],
                )
              "
              @change="onIgnoredTimezoneOffsetsChange"
            />
          </label>
          <p class="options-hint">{{ $t('ui.ignoredTimezoneHourOffsetsHint') }}</p>
          <label class="tweak-row">
            <input
              v-model="folderCriteriaDraft.excludeJunctionPoints"
              data-testid="folder-compare-exclude-junctions"
              type="checkbox"
              @change="persistFolderCriteriaDraft"
            />
            <span>{{ $t('ui.excludeJunctionPoints') }}</span>
          </label>
          <p class="options-hint">{{ $t('ui.excludeJunctionPointsHint') }}</p>
          <label class="tweak-row">
            <input
              v-model="folderDisplayFiltersDraft.alwaysShowFolders"
              data-testid="folder-compare-always-show-folders"
              type="checkbox"
              @change="persistFolderDisplayFiltersDraft"
            />
            <span>{{ $t('ui.alwaysShowFolders') }}</span>
          </label>
          <label class="tweak-row">
            <input
              v-model="folderDisplayFiltersDraft.filesOnly"
              data-testid="folder-compare-files-only-default"
              type="checkbox"
              @change="persistFolderDisplayFiltersDraft"
            />
            <span>{{ $t('ui.filesOnly') }}</span>
          </label>
          <label class="tweak-row">
            <input
              v-model="folderDisplayFiltersDraft.showSuppressed"
              data-testid="folder-compare-show-suppressed-default"
              type="checkbox"
              @change="persistFolderDisplayFiltersDraft"
            />
            <span>{{ $t('ui.suppressed') }}</span>
          </label>
          <label
            v-for="option in folderDisplayStatusOptions"
            :key="option.testId"
            class="tweak-row"
          >
            <input
              :checked="folderDisplayStatusChecked(option.statuses)"
              :data-testid="`folder-compare-status-${option.testId}-default`"
              type="checkbox"
              @change="
                toggleFolderDisplayStatuses(
                  option.statuses,
                  ($event.target as HTMLInputElement).checked,
                )
              "
            />
            <span>{{ $t(option.labelKey) }}</span>
          </label>
          <p class="options-hint">{{ $t('ui.folderCompareOptionsHint') }}</p>
        </NCard>

        <NCard
          v-show="optionsSection === 'folderMerge'"
          :title="$t('ui.folderMerge')"
          size="small"
          data-testid="options-folder-merge-card"
        >
          <label class="auto-save-limit-row">
            <span>{{ $t('ui.showAll') }}</span>
            <select
              v-model="folderMergeDisplayDraft.viewPreset"
              data-testid="folder-merge-view-preset-default"
              @change="persistFolderMergeDisplayDraft"
            >
              <option
                v-for="option in folderMergeViewPresetOptions"
                :key="option.value"
                :value="option.value"
              >
                {{ $t(option.labelKey) }}
              </option>
            </select>
          </label>
          <label class="tweak-row">
            <input
              v-model="folderMergeDisplayDraft.alwaysShowFolders"
              data-testid="folder-merge-always-show-folders"
              type="checkbox"
              @change="persistFolderMergeDisplayDraft"
            />
            <span>{{ $t('ui.alwaysShowFolders') }}</span>
          </label>
          <label class="tweak-row">
            <input
              v-model="folderMergeDisplayDraft.showCenterPane"
              data-testid="folder-merge-show-center-pane"
              type="checkbox"
              @change="persistFolderMergeDisplayDraft"
            />
            <span>{{ $t('ui.centerPane') }}</span>
          </label>
          <label class="tweak-row">
            <input
              v-model="folderMergeDisplayDraft.compareToOutput"
              data-testid="folder-merge-compare-to-output"
              type="checkbox"
              @change="persistFolderMergeDisplayDraft"
            />
            <span>{{ $t('ui.compareToOutput') }}</span>
          </label>
          <p class="options-hint">{{ $t('ui.folderMergeRulesHint') }}</p>
        </NCard>

        <NCard
          v-show="optionsSection === 'folderSync'"
          :title="$t('ui.folderSync')"
          size="small"
          data-testid="options-folder-sync-card"
        >
          <label class="auto-save-limit-row">
            <span>{{ $t('ui.strategy') }}</span>
            <select
              v-model="folderSyncDefaultsDraft.strategy"
              data-testid="folder-sync-strategy-default"
              @change="persistFolderSyncDefaultsDraft"
            >
              <option
                v-for="option in folderSyncStrategyOptions"
                :key="option.value"
                :value="option.value"
              >
                {{ $t(option.labelKey) }}
              </option>
            </select>
          </label>
          <p class="options-hint">{{ $t('ui.folderSyncOptionsHint') }}</p>
        </NCard>

        <NCard
          v-show="optionsSection === 'hexCompare'"
          :title="$t('ui.hexCompare')"
          size="small"
          data-testid="options-hex-compare-card"
        >
          <label class="tweak-row">
            <input
              v-model="hexCompareDefaultsDraft.diffOnly"
              data-testid="hex-diff-only-default"
              type="checkbox"
              @change="persistHexCompareDefaultsDraft"
            />
            <span>{{ $t('ui.hexDiffOnlyDefault') }}</span>
          </label>
          <label class="auto-save-limit-row">
            <span>{{ $t('ui.windowLength') }}</span>
            <input
              v-model.number="hexCompareDefaultsDraft.windowLength"
              class="auto-save-limit-input"
              data-testid="hex-window-length-default"
              type="number"
              min="16"
              max="4096"
              @change="persistHexCompareDefaultsDraft"
            />
          </label>
          <label class="auto-save-limit-row">
            <span>{{ $t('ui.hexBytesPerRow') }}</span>
            <select
              v-model="hexCompareDefaultsDraft.bytesPerRow"
              data-testid="hex-bytes-per-row-default"
              @change="persistHexCompareDefaultsDraft"
            >
              <option value="auto">{{ $t('ui.hexBytesPerRowAuto') }}</option>
              <option value="8">8</option>
              <option value="16">16</option>
            </select>
          </label>
          <p class="options-hint">{{ $t('ui.hexCompareOptionsHint') }}</p>
        </NCard>

        <NCard
          v-show="optionsSection === 'pictureCompare'"
          :title="$t('ui.pictureCompare')"
          size="small"
          data-testid="options-picture-compare-card"
        >
          <label class="auto-save-limit-row">
            <span>{{ $t('ui.rgbTolerance') }}</span>
            <input
              v-model.number="pictureCompareDefaultsDraft.rgbTolerance"
              class="auto-save-limit-input"
              data-testid="picture-rgb-tolerance-default"
              type="number"
              min="0"
              max="255"
              @change="persistPictureCompareDefaultsDraft"
            />
          </label>
          <label class="tweak-row">
            <input
              v-model="pictureCompareDefaultsDraft.compareAlpha"
              data-testid="picture-compare-alpha-default"
              type="checkbox"
              @change="persistPictureCompareDefaultsDraft"
            />
            <span>{{ $t('ui.compareAlpha') }}</span>
          </label>
          <label class="auto-save-limit-row">
            <span>{{ $t('ui.alphaTolerance') }}</span>
            <input
              v-model.number="pictureCompareDefaultsDraft.alphaTolerance"
              class="auto-save-limit-input"
              data-testid="picture-alpha-tolerance-default"
              type="number"
              min="0"
              max="255"
              @change="persistPictureCompareDefaultsDraft"
            />
          </label>
          <label class="tweak-row">
            <input
              v-model="pictureCompareDefaultsDraft.blendEnabled"
              data-testid="picture-blend-enabled-default"
              type="checkbox"
              @change="persistPictureCompareDefaultsDraft"
            />
            <span>{{ $t('ui.blend') }}</span>
          </label>
          <label class="auto-save-limit-row">
            <span>{{ $t('ui.blendOpacity') }}</span>
            <input
              v-model.number="pictureCompareDefaultsDraft.blendOpacity"
              class="auto-save-limit-input"
              data-testid="picture-blend-opacity-default"
              type="number"
              min="0"
              max="100"
              @change="persistPictureCompareDefaultsDraft"
            />
          </label>
          <label class="stack-row">
            <span>{{ $t('ui.blendMode') }}</span>
            <select
              v-model="pictureCompareDefaultsDraft.blendMode"
              data-testid="picture-blend-mode-default"
              @change="persistPictureCompareDefaultsDraft"
            >
              <option
                v-for="option in pictureBlendOptions"
                :key="option.value"
                :value="option.value"
              >
                {{ $t(option.labelKey) }}
              </option>
            </select>
          </label>
          <label class="auto-save-limit-row">
            <span>{{ $t('ui.ignoreColorFrom') }}</span>
            <input
              v-model="pictureIgnoreColorFromDraft"
              class="auto-save-limit-input"
              data-testid="picture-ignore-color-from-default"
              type="text"
              @change="persistPictureIgnoreColorDefaults"
            />
          </label>
          <label class="auto-save-limit-row">
            <span>{{ $t('ui.ignoreColorTo') }}</span>
            <input
              v-model="pictureIgnoreColorToDraft"
              class="auto-save-limit-input"
              data-testid="picture-ignore-color-to-default"
              type="text"
              @change="persistPictureIgnoreColorDefaults"
            />
          </label>
          <label class="tweak-row">
            <input
              v-model="pictureCompareDefaultsDraft.showMeta"
              data-testid="picture-show-meta-default"
              type="checkbox"
              @change="persistPictureCompareDefaultsDraft"
            />
            <span>{{ $t('ui.pictureShowMetaDefault') }}</span>
          </label>
          <label class="tweak-row">
            <input
              v-model="pictureCompareDefaultsDraft.showMinor"
              data-testid="picture-show-minor-default"
              type="checkbox"
              @change="persistPictureCompareDefaultsDraft"
            />
            <span>{{ $t('ui.pictureShowMinorDefault') }}</span>
          </label>
          <p class="options-hint">{{ $t('ui.pictureCompareOptionsHint') }}</p>
        </NCard>

        <NCard
          v-show="optionsSection === 'mediaCompare'"
          :title="$t('ui.mediaCompare')"
          size="small"
          data-testid="options-media-compare-card"
        >
          <label class="tweak-row">
            <input
              v-model="mediaCompareDefaultsDraft.syncPlayback"
              data-testid="media-sync-playback-default"
              type="checkbox"
              @change="persistMediaCompareDefaultsDraft"
            />
            <span>{{ $t('ui.mediaSyncPlaybackDefault') }}</span>
          </label>
          <label class="auto-save-limit-row">
            <span>{{ $t('ui.mediaDefaultFilter') }}</span>
            <select
              v-model="mediaCompareDefaultsDraft.defaultFilter"
              data-testid="media-default-filter"
              @change="persistMediaCompareDefaultsDraft"
            >
              <option
                v-for="option in mediaFilterOptions"
                :key="option.value"
                :value="option.value"
              >
                {{ $t(option.labelKey) }}
              </option>
            </select>
          </label>
          <label class="tweak-row">
            <input
              v-model="mediaCompareDefaultsDraft.showRules"
              data-testid="media-show-rules-default"
              type="checkbox"
              @change="persistMediaCompareDefaultsDraft"
            />
            <span>{{ $t('ui.mediaShowRulesDefault') }}</span>
          </label>
          <label class="auto-save-limit-row">
            <span>{{ $t('ui.unimportant') }}</span>
            <input
              v-model="mediaUnimportantFieldsDraft"
              class="auto-save-limit-input"
              data-testid="media-unimportant-fields-default"
              type="text"
              @change="persistMediaCompareDefaultsDraft"
            />
          </label>
          <p class="options-hint">{{ $t('ui.mediaCompareOptionsHint') }}</p>
        </NCard>

        <NCard
          v-show="optionsSection === 'versionCompare'"
          :title="$t('ui.versionCompare')"
          size="small"
          data-testid="options-version-compare-card"
        >
          <label class="auto-save-limit-row">
            <span>{{ $t('ui.versionDefaultFilter') }}</span>
            <select
              v-model="versionCompareDefaultsDraft.defaultFilter"
              data-testid="version-default-filter"
              @change="persistVersionCompareDefaultsDraft"
            >
              <option
                v-for="option in versionFilterOptions"
                :key="option.value"
                :value="option.value"
              >
                {{ $t(option.labelKey) }}
              </option>
            </select>
          </label>
          <label class="tweak-row">
            <input
              v-model="versionCompareDefaultsDraft.showRules"
              data-testid="version-show-rules-default"
              type="checkbox"
              @change="persistVersionCompareDefaultsDraft"
            />
            <span>{{ $t('ui.versionShowRulesDefault') }}</span>
          </label>
          <label class="auto-save-limit-row">
            <span>{{ $t('ui.unimportant') }}</span>
            <input
              v-model="versionUnimportantFieldsDraft"
              class="auto-save-limit-input"
              data-testid="version-unimportant-fields-default"
              type="text"
              @change="persistVersionCompareDefaultsDraft"
            />
          </label>
          <p class="options-hint">{{ $t('ui.versionCompareOptionsHint') }}</p>
        </NCard>

        <NCard
          v-show="optionsSection === 'tableCompare'"
          :title="$t('ui.tableCompare')"
          size="small"
          data-testid="options-table-compare-card"
        >
          <label class="auto-save-limit-row">
            <span>{{ $t('ui.keyColumns') }}</span>
            <input
              v-model="tableCompareDefaultsDraft.keyColumns"
              class="auto-save-limit-input"
              data-testid="table-key-columns-default"
              type="text"
              :placeholder="$t('ui.keyColumnsHint')"
              @change="persistTableCompareDefaultsDraft"
            />
          </label>
          <label class="auto-save-limit-row">
            <span>{{ $t('ui.delimiter') }}</span>
            <input
              v-model="tableCompareDefaultsDraft.delimiter"
              class="auto-save-limit-input"
              data-testid="table-delimiter-default"
              type="text"
              maxlength="1"
              @change="persistTableCompareDefaultsDraft"
            />
          </label>
          <label class="auto-save-limit-row">
            <span>{{ $t('ui.ignoredColumns') }}</span>
            <input
              v-model="tableIgnoredColumnsDraft"
              class="auto-save-limit-input"
              data-testid="table-ignored-columns-default"
              type="text"
              :placeholder="$t('ui.ignoredColumnsHint')"
              @change="persistTableCompareDefaultsDraft"
            />
          </label>
          <label class="tweak-row">
            <input
              v-model="tableCompareDefaultsDraft.firstRowIsHeader"
              data-testid="table-first-row-header-default"
              type="checkbox"
              @change="persistTableCompareDefaultsDraft"
            />
            <span>{{ $t('ui.tableFirstRowIsHeader') }}</span>
          </label>
          <label class="tweak-row">
            <input
              v-model="tableCompareDefaultsDraft.ignoreCase"
              data-testid="table-ignore-case-default"
              type="checkbox"
              @change="persistTableCompareDefaultsDraft"
            />
            <span>{{ $t('ui.tableIgnoreCaseDefault') }}</span>
          </label>
          <p class="options-hint">{{ $t('ui.tableCompareOptionsHint') }}</p>
        </NCard>

        <NCard
          v-show="optionsSection === 'fileFilters'"
          :title="$t('ui.fileFilters')"
          size="small"
          data-testid="options-file-filters-card"
        >
          <label class="stack-row">
            <span>{{ $t('ui.includePatterns') }}</span>
            <input
              v-model="fileFiltersIncludeDraft"
              data-testid="file-filters-include"
              type="text"
              :placeholder="$t('ui.fileFiltersIncludePlaceholder')"
              @change="persistFileFiltersDraft"
            />
          </label>
          <label class="stack-row">
            <span>{{ $t('ui.excludePatterns') }}</span>
            <input
              v-model="fileFiltersExcludeDraft"
              data-testid="file-filters-exclude"
              type="text"
              :placeholder="$t('ui.globPatterns')"
              @change="persistFileFiltersDraft"
            />
          </label>
          <label class="tweak-row">
            <input
              v-model="fileFiltersDraft.caseSensitive"
              data-testid="file-filters-case-sensitive"
              type="checkbox"
              @change="persistFileFiltersDraft"
            />
            <span>{{ $t('ui.caseSensitiveNames') }}</span>
          </label>
          <p class="options-hint">{{ $t('ui.fileFiltersHint') }}</p>
        </NCard>

        <NCard
          v-show="optionsSection === 'openWith'"
          :title="$t('ui.openWith')"
          size="small"
          data-testid="options-open-with-card"
        >
          <p class="options-hint">{{ $t('ui.openWithHint') }}</p>
          <ul
            class="open-with-list"
            data-testid="open-with-app-list"
          >
            <li
              v-for="app in openWithApps"
              :key="app.id"
              class="open-with-row"
            >
              <label class="tweak-row">
                <input
                  type="checkbox"
                  :data-testid="`open-with-enabled-${app.id}`"
                  :checked="app.enabled"
                  @change="toggleOpenWithApp(app.id, ($event.target as HTMLInputElement).checked)"
                />
                <span
                  >{{ app.name }} <code>{{ app.executable }}</code></span
                >
              </label>
              <NButton
                text
                size="small"
                :data-testid="`open-with-remove-${app.id}`"
                @click="removeOpenWithApp(app.id)"
                >{{ $t('ui.remove') }}</NButton
              >
            </li>
          </ul>
          <div class="open-with-draft">
            <input
              v-model="openWithDraft.name"
              type="text"
              data-testid="open-with-name"
              :placeholder="$t('ui.applicationName')"
            />
            <input
              v-model="openWithDraft.executable"
              type="text"
              data-testid="open-with-executable"
              :placeholder="$t('ui.executablePath')"
            />
            <NButton
              size="small"
              data-testid="open-with-add"
              @click="addOpenWithApp"
              >{{ $t('ui.add') }}</NButton
            >
          </div>
        </NCard>

        <NCard
          v-show="optionsSection === 'shell'"
          :title="$t('ui.shell')"
          size="small"
          data-testid="options-shell-card"
        >
          <p class="options-hint">{{ $t('ui.shellOptionsHint') }}</p>
          <div class="integration-config">
            <label>
              <span>{{ $t('ui.executablePath') }}</span>
              <input
                v-model="executablePath"
                type="text"
                data-testid="shell-executable-path"
              />
            </label>
            <div class="settings-row shell-extension-row">
              <div>
                <strong>{{ $t('ui.windowsShell') }}</strong>
                <span>{{ $t('ui.shellExtensionHint') }}</span>
              </div>
              <NSpace>
                <NButton
                  size="small"
                  type="primary"
                  data-testid="shell-register-windows"
                  :disabled="!policy.isWindows || integrationWriting"
                  @click="registerShellExtension"
                  >{{ $t('ui.installExplorerContextMenu') }}</NButton
                >
                <NButton
                  size="small"
                  data-testid="shell-unregister-windows"
                  :disabled="!policy.isWindows || integrationWriting"
                  @click="unregisterShellExtension"
                  >{{ $t('ui.removeExplorerContextMenu') }}</NButton
                >
              </NSpace>
            </div>
            <div class="settings-row shell-extension-row">
              <div>
                <strong>{{ $t('ui.unixShell') }}</strong>
                <span>{{ $t('ui.unixShellHint') }}</span>
              </div>
              <NSpace>
                <NButton
                  size="small"
                  type="primary"
                  data-testid="shell-register-unix"
                  :disabled="!policy.supportsUnixShell || integrationWriting"
                  @click="registerUnixShell"
                  >{{ $t('ui.installUnixShellIntegration') }}</NButton
                >
                <NButton
                  size="small"
                  data-testid="shell-unregister-unix"
                  :disabled="!policy.supportsUnixShell || integrationWriting"
                  @click="unregisterUnixShell"
                  >{{ $t('ui.removeUnixShellIntegration') }}</NButton
                >
              </NSpace>
            </div>
            <p
              v-if="integrationStatus"
              data-testid="shell-integration-status"
            >
              {{ integrationStatus }}
            </p>
            <p
              v-if="integrationError"
              data-testid="shell-integration-error"
            >
              {{ integrationError }}
            </p>
          </div>
        </NCard>

        <NCard
          v-show="optionsSection === 'backup'"
          :title="$t('ui.backup')"
          size="small"
          data-testid="options-backup-card"
        >
          <label class="tweak-row">
            <input
              data-testid="create-backup-on-save"
              type="checkbox"
              :checked="settings.createBackupOnSave"
              @change="onCreateBackupOnSaveChange"
            />
            <span>{{ $t('ui.createBackupOnSave') }}</span>
          </label>
          <label class="tweak-row">
            <input
              data-testid="confirm-before-overwrite-save"
              type="checkbox"
              :checked="settings.confirmBeforeOverwriteSave"
              @change="onConfirmBeforeOverwriteSaveChange"
            />
            <span>{{ $t('ui.confirmBeforeOverwriteSave') }}</span>
          </label>
          <label class="tweak-row">
            <span>{{ $t('ui.backupRetentionCount') }}</span>
            <input
              data-testid="backup-retention-count"
              type="number"
              min="1"
              max="9"
              :value="settings.backupRetentionCount"
              @change="onBackupRetentionCountChange"
            />
          </label>
          <label class="tweak-row">
            <input
              data-testid="create-backup-on-report-export"
              type="checkbox"
              :checked="settings.createBackupOnReportExport"
              @change="onCreateBackupOnReportExportChange"
            />
            <span>{{ $t('ui.createBackupOnReportExport') }}</span>
          </label>
          <p class="options-hint">{{ $t('ui.createBackupOnReportExportHint') }}</p>
          <p class="options-hint">{{ $t('ui.backupHint') }}</p>
        </NCard>

        <NCard
          v-show="optionsSection === 'fileOperations'"
          :title="$t('ui.fileOperations')"
          size="small"
          data-testid="options-file-operations-card"
        >
          <label class="tweak-row">
            <input
              data-testid="include-hidden-items-in-file-actions"
              type="checkbox"
              :checked="settings.includeHiddenItemsInFileActions"
              @change="onIncludeHiddenItemsInFileActionsChange"
            />
            <span>{{ $t('ui.includeHiddenItemsInFileActions') }}</span>
          </label>
          <p class="options-hint">{{ $t('ui.includeHiddenItemsInFileActionsHint') }}</p>
          <label class="tweak-row">
            <input
              data-testid="beep-after-long-file-operations"
              type="checkbox"
              :checked="settings.beepAfterLongFileOperations"
              @change="onBeepAfterLongFileOperationsChange"
            />
            <span>{{ $t('ui.beepAfterLongFileOperations') }}</span>
          </label>
          <p class="options-hint">{{ $t('ui.beepAfterLongFileOperationsHint') }}</p>
          <label class="auto-save-limit-row">
            <span>{{ $t('ui.longFileOperationThresholdSeconds') }}</span>
            <input
              class="auto-save-limit-input"
              data-testid="long-file-operation-threshold"
              type="number"
              min="1"
              max="60"
              step="1"
              :value="Math.round(settings.longFileOperationThresholdMs / 1000)"
              @change="onLongFileOperationThresholdChange"
            />
          </label>
          <p class="options-hint">{{ $t('ui.longFileOperationThresholdHint') }}</p>
          <label class="tweak-row">
            <input
              data-testid="preserve-timestamps-on-copy"
              type="checkbox"
              :checked="settings.preserveTimestampsOnCopy"
              @change="onPreserveTimestampsOnCopyChange"
            />
            <span>{{ $t('ui.preserveTimestampsOnCopy') }}</span>
          </label>
          <p class="options-hint">{{ $t('ui.preserveTimestampsOnCopyHint') }}</p>
          <label class="tweak-row">
            <input
              data-testid="overwrite-read-only-files"
              type="checkbox"
              :checked="settings.overwriteReadOnlyFiles"
              @change="onOverwriteReadOnlyFilesChange"
            />
            <span>{{ $t('ui.overwriteReadOnlyFiles') }}</span>
          </label>
          <p class="options-hint">{{ $t('ui.overwriteReadOnlyFilesHint') }}</p>
          <label class="tweak-row">
            <input
              v-model="fileOperationPreferencesDraft.copyEmptyFolders"
              data-testid="copy-empty-folders"
              type="checkbox"
              @change="persistFileOperationPreferencesDraft"
            />
            <span>{{ $t('ui.copyEmptyFolders') }}</span>
          </label>
          <p class="options-hint">{{ $t('ui.copyEmptyFoldersHint') }}</p>
          <label class="tweak-row">
            <input
              v-model="fileOperationPreferencesDraft.keepFolderExpansionOnReload"
              data-testid="keep-folder-expansion-on-reload"
              type="checkbox"
              @change="persistFileOperationPreferencesDraft"
            />
            <span>{{ $t('ui.keepFolderExpansionOnReload') }}</span>
          </label>
          <p class="options-hint">{{ $t('ui.keepFolderExpansionOnReloadHint') }}</p>
          <label class="tweak-row">
            <input
              v-model="fileOperationPreferencesDraft.skipNewerTargetsOnCopy"
              data-testid="skip-newer-targets-on-copy"
              type="checkbox"
              @change="persistFileOperationPreferencesDraft"
            />
            <span>{{ $t('ui.skipNewerTargetsOnCopy') }}</span>
          </label>
          <p class="options-hint">{{ $t('ui.skipNewerTargetsOnCopyHint') }}</p>
          <p class="options-hint">{{ $t('ui.fileOperationsHint') }}</p>
        </NCard>

        <NCard
          v-show="optionsSection === 'archiveTypes'"
          :title="$t('ui.archiveTypes')"
          size="small"
          data-testid="options-archive-types-card"
        >
          <div class="settings-row archive-types-row">
            <div>
              <strong>{{ $t('ui.archiveTypes') }}</strong>
              <span>{{ $t('ui.archiveTypesHint') }}</span>
            </div>
          </div>
          <div class="shared-session-input">
            <NInput
              v-model:value="archiveExtensionsDraft"
              data-testid="archive-extensions-input"
              :placeholder="$t('ui.archiveTypesPlaceholder')"
            />
            <NButton
              size="small"
              data-testid="apply-archive-extensions"
              @click="applyArchiveExtensionsFromOptions"
              >{{ $t('ui.apply') }}</NButton
            >
          </div>
          <label class="tweak-row">
            <input
              data-testid="enable-rar-archive-types"
              type="checkbox"
              :checked="settings.enableRarArchiveTypes"
              @change="onEnableRarArchiveTypesChange"
            />
            <span>{{ $t('ui.enableRarArchiveTypes') }}</span>
          </label>
          <p class="options-hint">{{ $t('ui.enableRarArchiveTypesHint') }}</p>
        </NCard>

        <NCard
          v-show="optionsSection === 'confirmations'"
          :title="$t('ui.confirmations')"
          size="small"
          data-testid="options-confirmations-card"
        >
          <label class="tweak-row">
            <input
              data-testid="confirm-before-delete"
              type="checkbox"
              :checked="settings.confirmBeforeDelete"
              @change="onConfirmBeforeDeleteChange"
            />
            <span>{{ $t('ui.confirmBeforeDelete') }}</span>
          </label>
          <label class="tweak-row">
            <input
              data-testid="confirm-before-sync-overwrite"
              type="checkbox"
              :checked="settings.confirmBeforeSyncOverwrite"
              @change="onConfirmBeforeSyncOverwriteChange"
            />
            <span>{{ $t('ui.confirmBeforeSyncOverwrite') }}</span>
          </label>
          <label class="tweak-row">
            <input
              data-testid="confirm-before-copy"
              type="checkbox"
              :checked="settings.confirmBeforeCopy"
              @change="onConfirmBeforeCopyChange"
            />
            <span>{{ $t('ui.confirmBeforeCopy') }}</span>
          </label>
          <p class="options-hint">{{ $t('ui.confirmBeforeCopyHint') }}</p>
          <label class="tweak-row">
            <input
              data-testid="confirm-before-move"
              type="checkbox"
              :checked="settings.confirmBeforeMove"
              @change="onConfirmBeforeMoveChange"
            />
            <span>{{ $t('ui.confirmBeforeMove') }}</span>
          </label>
          <p class="options-hint">{{ $t('ui.confirmBeforeMoveHint') }}</p>
          <label class="tweak-row">
            <input
              data-testid="confirm-before-sync-delete"
              type="checkbox"
              :checked="settings.confirmBeforeSyncDelete"
              @change="onConfirmBeforeSyncDeleteChange"
            />
            <span>{{ $t('ui.confirmBeforeSyncDelete') }}</span>
          </label>
          <p class="options-hint">{{ $t('ui.confirmBeforeSyncDeleteHint') }}</p>
          <label class="tweak-row">
            <input
              data-testid="confirm-before-close-dirty-tab"
              type="checkbox"
              :checked="settings.confirmBeforeCloseDirtyTab"
              @change="onConfirmBeforeCloseDirtyTabChange"
            />
            <span>{{ $t('ui.confirmBeforeCloseDirtyTab') }}</span>
          </label>
          <label class="tweak-row">
            <input
              data-testid="confirm-before-quit"
              type="checkbox"
              :checked="settings.confirmBeforeQuit"
              @change="onConfirmBeforeQuitChange"
            />
            <span>{{ $t('ui.confirmBeforeQuit') }}</span>
          </label>
          <p class="options-hint">{{ $t('ui.confirmationsHint') }}</p>
        </NCard>

        <NCard
          v-show="optionsSection === 'tweaks'"
          :title="$t('ui.tweaks')"
          size="small"
          data-testid="options-tweaks-card"
        >
          <label class="tweak-row">
            <input
              data-testid="wrap-text-default"
              type="checkbox"
              :checked="settings.wrapTextDefault"
              @change="onWrapTextDefaultChange"
            />
            <span>{{ $t('ui.wrapTextDefault') }}</span>
          </label>
          <label class="tweak-row">
            <input
              data-testid="auto-scroll-first-difference"
              type="checkbox"
              :checked="settings.autoScrollToFirstDifference"
              @change="onAutoScrollToFirstDifferenceChange"
            />
            <span>{{ $t('ui.autoScrollToFirstDifference') }}</span>
          </label>
          <label class="tweak-row">
            <input
              data-testid="collapse-identical-folders-default"
              type="checkbox"
              :checked="settings.collapseIdenticalFoldersDefault"
              @change="onCollapseIdenticalFoldersDefaultChange"
            />
            <span>{{ $t('ui.collapseIdenticalFoldersDefault') }}</span>
          </label>
          <label class="tweak-row">
            <input
              data-testid="show-hidden-files"
              type="checkbox"
              :checked="settings.showHiddenFiles"
              @change="onShowHiddenFilesChange"
            />
            <span>{{ $t('ui.showHiddenFiles') }}</span>
          </label>
          <p class="options-hint">{{ $t('ui.showHiddenFilesHint') }}</p>
          <label class="tweak-row">
            <input
              data-testid="notify-on-compare-complete"
              type="checkbox"
              :checked="settings.notifyOnCompareComplete"
              @change="onNotifyOnCompareCompleteChange"
            />
            <span>{{ $t('ui.notifyOnCompareComplete') }}</span>
          </label>
          <p class="options-hint">{{ $t('ui.notifyOnCompareCompleteHint') }}</p>
          <label class="tweak-row">
            <input
              data-testid="esc-closes-file-views"
              type="checkbox"
              :checked="settings.escClosesFileViews"
              @change="onEscClosesFileViewsChange"
            />
            <span>{{ $t('ui.escClosesFileViews') }}</span>
          </label>
          <p class="options-hint">{{ $t('ui.escClosesFileViewsHint') }}</p>
          <label class="tweak-row">
            <input
              data-testid="beep-when-script-finished"
              type="checkbox"
              :checked="settings.beepWhenScriptFinished"
              @change="onBeepWhenScriptFinishedChange"
            />
            <span>{{ $t('ui.beepWhenScriptFinished') }}</span>
          </label>
          <label class="tweak-row">
            <input
              data-testid="close-when-script-finished"
              type="checkbox"
              :checked="settings.closeWhenScriptFinished"
              @change="onCloseWhenScriptFinishedChange"
            />
            <span>{{ $t('ui.closeWhenScriptFinished') }}</span>
          </label>
          <p class="options-hint">{{ $t('ui.scriptFinishedTweaksHint') }}</p>
          <label class="tweak-row">
            <input
              data-testid="check-for-files-changed-on-disk"
              type="checkbox"
              :checked="settings.checkForFilesChangedOnDisk"
              @change="onCheckForFilesChangedOnDiskChange"
            />
            <span>{{ $t('ui.checkForFilesChangedOnDisk') }}</span>
          </label>
          <p class="options-hint">{{ $t('ui.checkForFilesChangedOnDiskHint') }}</p>
          <label class="tweak-row">
            <input
              data-testid="auto-reload-unless-changes-discarded"
              type="checkbox"
              :checked="settings.autoReloadUnlessChangesDiscarded"
              :disabled="!settings.checkForFilesChangedOnDisk"
              @change="onAutoReloadUnlessChangesDiscardedChange"
            />
            <span>{{ $t('ui.autoReloadUnlessChangesDiscarded') }}</span>
          </label>
          <p class="options-hint">{{ $t('ui.autoReloadUnlessChangesDiscardedHint') }}</p>
          <label class="tweak-row">
            <input
              data-testid="sticky-home-session-selection"
              type="checkbox"
              :checked="settings.stickyHomeSessionSelection"
              @change="onStickyHomeSessionSelectionChange"
            />
            <span>{{ $t('ui.stickyHomeSessionSelection') }}</span>
          </label>
          <p class="options-hint">{{ $t('ui.stickyHomeSessionSelectionHint') }}</p>
          <label class="tweak-row">
            <input
              data-testid="prefer-ipv6-when-available"
              type="checkbox"
              :checked="settings.preferIpv6WhenAvailable"
              @change="onPreferIpv6WhenAvailableChange"
            />
            <span>{{ $t('ui.preferIpv6WhenAvailable') }}</span>
          </label>
          <p class="options-hint">{{ $t('ui.preferIpv6WhenAvailableHint') }}</p>
          <label class="tweak-row">
            <input
              data-testid="watch-folders-for-changes"
              type="checkbox"
              :checked="settings.watchFoldersForChanges"
              @change="onWatchFoldersForChangesChange"
            />
            <span>{{ $t('ui.watchFoldersForChanges') }}</span>
          </label>
          <p class="options-hint">{{ $t('ui.watchFoldersForChangesHint') }}</p>
          <label class="auto-save-limit-row">
            <span>{{ $t('ui.binaryCompareBufferSize') }}</span>
            <select
              data-testid="binary-compare-buffer-size"
              :value="settings.binaryCompareBufferSize"
              @change="onBinaryCompareBufferSizeChange"
            >
              <option :value="256">256</option>
              <option :value="512">512</option>
              <option :value="1024">1024</option>
              <option :value="2048">2048</option>
              <option :value="4096">4096</option>
            </select>
          </label>
          <p class="options-hint">{{ $t('ui.binaryCompareBufferSizeHint') }}</p>
          <label class="tweak-row">
            <input
              data-testid="show-milliseconds-in-timestamps"
              type="checkbox"
              :checked="settings.showMillisecondsInTimestamps"
              @change="onShowMillisecondsInTimestampsChange"
            />
            <span>{{ $t('ui.showMillisecondsInTimestamps') }}</span>
          </label>
          <p class="options-hint">{{ $t('ui.showMillisecondsInTimestampsHint') }}</p>
          <NButton
            size="small"
            data-testid="restore-factory-defaults"
            @click="restoreFactoryDefaultsFromOptions"
            >{{ $t('ui.restoreFactoryDefaults') }}</NButton
          >
          <p
            v-if="optionsStatus"
            class="options-hint"
            data-testid="options-restore-status"
          >
            {{ optionsStatus }}
          </p>
        </NCard>

        <NCard
          v-show="optionsSection === 'commands'"
          :title="$t('ui.commandsVisibility')"
          size="small"
          data-testid="options-commands-card"
        >
          <label class="tweak-row">
            <input
              data-testid="show-sessions-in-toolbar"
              type="checkbox"
              :checked="settings.showSessionsInToolbar"
              @change="onShowSessionsInToolbarChange"
            />
            <span>{{ $t('ui.showSessionsInToolbar') }}</span>
          </label>
          <label class="tweak-row">
            <input
              data-testid="show-goto-in-toolbar"
              type="checkbox"
              :checked="settings.showGotoInToolbar"
              @change="onShowGotoInToolbarChange"
            />
            <span>{{ $t('ui.showGotoInToolbar') }}</span>
          </label>
          <label class="tweak-row">
            <input
              data-testid="show-wrap-in-toolbar"
              type="checkbox"
              :checked="settings.showWrapInToolbar"
              @change="onShowWrapInToolbarChange"
            />
            <span>{{ $t('ui.showWrapInToolbar') }}</span>
          </label>
          <label class="tweak-row">
            <input
              data-testid="show-sync-now-in-toolbar"
              type="checkbox"
              :checked="settings.showSyncNowInToolbar"
              @change="onShowSyncNowInToolbarChange"
            />
            <span>{{ $t('ui.showSyncNowInToolbar') }}</span>
          </label>
          <label class="tweak-row">
            <input
              data-testid="show-sync-cancel-accept-in-toolbar"
              type="checkbox"
              :checked="settings.showSyncCancelAcceptInToolbar"
              @change="onShowSyncCancelAcceptInToolbarChange"
            />
            <span>{{ $t('ui.showSyncCancelAcceptInToolbar') }}</span>
          </label>
          <p class="options-hint">{{ $t('ui.commandsVisibilityHint') }}</p>
        </NCard>

        <NCard
          v-show="optionsSection === 'formats'"
          :title="$t('ui.fileFormats')"
          size="small"
          data-testid="options-formats-card"
        >
          <div class="settings-row">
            <div>
              <strong>{{ $t('ui.formatDefinitions') }}</strong>
              <span>{{ $t('ui.manageMatchingRulesDefaultViewsAndRuleReferences') }}</span>
            </div>
            <NButton
              size="small"
              data-testid="open-file-formats"
              @click="openFileFormats"
              >{{ $t('ui.manage') }}</NButton
            >
          </div>
          <div class="settings-row archive-types-row">
            <div>
              <strong>{{ $t('ui.formatAssociations') }}</strong>
              <span>{{ $t('ui.formatAssociationsHint') }}</span>
            </div>
          </div>
          <label
            v-for="format in formatAssociationRows"
            :key="format.id"
            class="tweak-row"
          >
            <input
              type="checkbox"
              :data-testid="`format-association-${format.id}`"
              :checked="format.enabled !== false"
              @change="onFormatAssociationToggle(format.id, $event)"
            />
            <span>{{ format.name }}</span>
          </label>
          <label class="tweak-row">
            <input
              v-model="fileFormatPreferencesDraft.treatUnknownAsText"
              data-testid="treat-unknown-as-text"
              type="checkbox"
              @change="persistFileFormatPreferencesDraft"
            />
            <span>{{ $t('ui.treatUnknownAsText') }}</span>
          </label>
          <p class="options-hint">{{ $t('ui.treatUnknownAsTextHint') }}</p>
          <label class="tweak-row">
            <input
              v-model="fileFormatPreferencesDraft.preferHexForNoExtension"
              data-testid="prefer-hex-for-no-extension"
              type="checkbox"
              @change="persistFileFormatPreferencesDraft"
            />
            <span>{{ $t('ui.preferHexForNoExtension') }}</span>
          </label>
          <p class="options-hint">{{ $t('ui.preferHexForNoExtensionHint') }}</p>
        </NCard>

        <NCard
          v-show="optionsSection === 'profiles'"
          :title="$t('ui.profiles')"
          size="small"
          data-testid="options-profiles-card"
        >
          <label class="stack-row">
            <span>{{ $t('ui.profileDefaultName') }}</span>
            <input
              v-model="profileDefaultsDraft.defaultName"
              data-testid="profile-default-name"
              type="text"
              @change="persistProfileDefaultsDraft"
            />
          </label>
          <label class="stack-row">
            <span>{{ $t('ui.profileDefaultProtocol') }}</span>
            <select
              v-model="profileDefaultsDraft.defaultProtocol"
              data-testid="profile-default-protocol"
              @change="persistProfileDefaultsDraft"
            >
              <option
                v-for="option in profileProtocolOptions"
                :key="option.value"
                :value="option.value"
              >
                {{ option.label }}
              </option>
            </select>
          </label>
          <label class="stack-row">
            <span>{{ $t('ui.profileDefaultHost') }}</span>
            <input
              v-model="profileDefaultsDraft.defaultHost"
              data-testid="profile-default-host"
              type="text"
              @change="persistProfileDefaultsDraft"
            />
          </label>
          <label class="stack-row">
            <span>{{ $t('ui.profileDefaultUsername') }}</span>
            <input
              v-model="profileDefaultsDraft.defaultUsername"
              data-testid="profile-default-username"
              type="text"
              @change="persistProfileDefaultsDraft"
            />
          </label>
          <label class="stack-row">
            <span>{{ $t('ui.profileDefaultPort') }}</span>
            <input
              data-testid="profile-default-port"
              type="number"
              min="0"
              max="65535"
              step="1"
              :value="profileDefaultsDraft.defaultPort ?? ''"
              @change="onProfileDefaultPortChange"
            />
          </label>
          <label class="stack-row">
            <span>{{ $t('ui.profileDefaultRootPath') }}</span>
            <input
              v-model="profileDefaultsDraft.defaultRootPath"
              data-testid="profile-default-root-path"
              type="text"
              @change="persistProfileDefaultsDraft"
            />
          </label>
          <label class="auto-save-limit-row">
            <span>{{ $t('ui.profileConnectionTimeoutSeconds') }}</span>
            <input
              class="auto-save-limit-input"
              data-testid="profile-connection-timeout"
              type="number"
              min="1"
              max="600"
              step="1"
              :value="profileDefaultsDraft.connectionTimeoutSeconds"
              @change="onProfileConnectionTimeoutChange"
            />
          </label>
          <p class="options-hint">{{ $t('ui.profileConnectionTimeoutHint') }}</p>
          <label class="tweak-row">
            <input
              v-model="profileDefaultsDraft.passiveFtp"
              data-testid="profile-passive-ftp"
              type="checkbox"
              @change="persistProfileDefaultsDraft"
            />
            <span>{{ $t('ui.profilePassiveFtp') }}</span>
          </label>
          <p class="options-hint">{{ $t('ui.profilePassiveFtpHint') }}</p>
          <label class="tweak-row">
            <input
              v-model="profileDefaultsDraft.anonymousLogin"
              data-testid="profile-anonymous-login"
              type="checkbox"
              @change="persistProfileDefaultsDraft"
            />
            <span>{{ $t('ui.profileAnonymousLogin') }}</span>
          </label>
          <p class="options-hint">{{ $t('ui.profileAnonymousLoginHint') }}</p>
          <p class="options-hint">
            {{ $t('ui.profileSavedCount', { count: savedRemoteProfilesCount }) }}
          </p>
          <p class="options-hint">{{ $t('ui.profileDefaultsHint') }}</p>
          <div
            v-if="policy.remoteProfiles"
            class="settings-row"
          >
            <div>
              <strong>{{ $t('ui.connectionProfiles') }}</strong>
              <span>{{ $t('ui.manageRemoteEndpointsAndCredentialReferences') }}</span>
            </div>
            <NButton
              size="small"
              data-testid="open-remote-profiles"
              @click="openRemoteProfiles"
              >{{ $t('ui.manage') }}</NButton
            >
          </div>
        </NCard>

        <NCard
          v-show="optionsSection === 'reports'"
          :title="$t('ui.reportsScripts')"
          size="small"
          data-testid="options-reports-card"
        >
          <label class="stack-row">
            <span>{{ $t('ui.reportDefaultFormat') }}</span>
            <select
              v-model="reportPreferencesDraft.defaultFormat"
              data-testid="report-default-format"
              @change="persistReportPreferencesDraft"
            >
              <option
                v-for="option in reportFormatOptions"
                :key="option.value"
                :value="option.value"
              >
                {{ $t(option.labelKey) }}
              </option>
            </select>
          </label>
          <label class="stack-row">
            <span>{{ $t('ui.reportDefaultKind') }}</span>
            <select
              v-model="reportPreferencesDraft.defaultKind"
              data-testid="report-default-kind"
              @change="persistReportPreferencesDraft"
            >
              <option
                v-for="option in reportKindOptions"
                :key="option.value"
                :value="option.value"
              >
                {{ $t(option.labelKey) }}
              </option>
            </select>
          </label>
          <label class="tweak-row">
            <input
              v-model="reportPreferencesDraft.openAfterExport"
              data-testid="report-open-after-export"
              type="checkbox"
              @change="persistReportPreferencesDraft"
            />
            <span>{{ $t('ui.openReportAfterExport') }}</span>
          </label>
          <p class="options-hint">{{ $t('ui.openReportAfterExportHint') }}</p>
          <label class="tweak-row">
            <input
              v-model="reportPreferencesDraft.clearHistoryOnExit"
              data-testid="report-clear-history-on-exit"
              type="checkbox"
              @change="persistReportPreferencesDraft"
            />
            <span>{{ $t('ui.reportClearHistoryOnExit') }}</span>
          </label>
          <label class="tweak-row">
            <input
              v-model="reportPreferencesDraft.includeIdentical"
              data-testid="report-include-identical"
              type="checkbox"
              @change="persistReportPreferencesDraft"
            />
            <span>{{ $t('ui.reportIncludeIdentical') }}</span>
          </label>
          <p class="options-hint">{{ $t('ui.reportIncludeIdenticalHint') }}</p>
          <label class="tweak-row">
            <input
              v-model="reportPreferencesDraft.includeOrphans"
              data-testid="report-include-orphans"
              type="checkbox"
              @change="persistReportPreferencesDraft"
            />
            <span>{{ $t('ui.reportIncludeOrphans') }}</span>
          </label>
          <p class="options-hint">{{ $t('ui.reportIncludeOrphansHint') }}</p>
          <label class="tweak-row">
            <input
              v-model="reportPreferencesDraft.includeUnimportant"
              data-testid="report-include-unimportant"
              type="checkbox"
              @change="persistReportPreferencesDraft"
            />
            <span>{{ $t('ui.reportIncludeUnimportant') }}</span>
          </label>
          <p class="options-hint">{{ $t('ui.reportIncludeUnimportantHint') }}</p>
          <div class="settings-row">
            <NButton
              size="small"
              data-testid="clear-report-export-history"
              @click="clearReportExportHistoryFromOptions"
              >{{ $t('ui.clearReportHistory') }}</NButton
            >
            <NButton
              size="small"
              data-testid="open-reports-scripts"
              @click="openReportsScripts"
              >{{ $t('ui.openReportsScripts') }}</NButton
            >
          </div>
          <p class="options-hint">{{ $t('ui.reportPreferencesHint') }}</p>
        </NCard>

        <NCard
          v-show="optionsSection === 'shortcuts'"
          :title="$t('ui.shortcuts')"
          size="small"
          data-testid="options-shortcuts-card"
        >
          <div class="shortcut-config">
            <div class="settings-row">
              <div>
                <strong>{{ $t('ui.keyboardShortcuts') }}</strong>
                <span>{{ $t('ui.searchModifyAndRestoreCommandShortcuts') }}</span>
              </div>
            </div>
            <NInput
              v-model:value="shortcutSearch"
              data-testid="shortcut-search"
              :placeholder="$t('ui.searchCommands')"
            />
            <div class="shortcut-list">
              <div
                v-for="command in filteredShortcutCommands"
                :key="command.id"
                class="shortcut-row"
              >
                <div class="shortcut-command">
                  <strong>{{ $t(command.titleKey) }}</strong>
                  <span>{{ command.id }}</span>
                </div>
                <span class="shortcut-default">{{ shortcutToText(command.defaultShortcut) }}</span>
                <span
                  class="shortcut-current"
                  :data-testid="`shortcut-current-${command.id}`"
                  >{{ shortcutToText(settings.getEffectiveShortcut(command)) }}</span
                >
                <NInput
                  v-model:value="shortcutDrafts[command.id]"
                  class="shortcut-input"
                  :data-testid="`shortcut-input-${command.id}`"
                />
                <NButton
                  size="small"
                  :data-testid="`save-shortcut-${command.id}`"
                  @click="saveShortcut(command)"
                  >{{ $t('ui.save') }}</NButton
                >
                <NButton
                  size="small"
                  :data-testid="`reset-shortcut-${command.id}`"
                  @click="resetShortcut(command)"
                  >{{ $t('ui.restoreDefault') }}</NButton
                >
              </div>
            </div>
          </div>
        </NCard>

        <NCard
          v-show="optionsSection === 'integration'"
          :title="$t('ui.gitIntegration')"
          size="small"
          data-testid="options-integration-card"
        >
          <div class="integration-config">
            <p>{{ $t('ui.gitIntegration') }}</p>
            <div class="settings-row">
              <label>
                <span>{{ $t('ui.executablePath') }}</span>
                <input
                  v-model="executablePath"
                  type="text"
                  data-testid="integration-executable-path"
                />
              </label>
              <label>
                <span>{{ $t('ui.gitScope') }}</span>
                <select
                  v-model="gitScope"
                  data-testid="git-scope"
                >
                  <option value="global">{{ $t('ui.globalScope') }}</option>
                  <option value="local">{{ $t('ui.localScope') }}</option>
                </select>
              </label>
              <label>
                <span>{{ $t('ui.gitIntegration') }}</span>
                <select
                  v-model="gitKind"
                  data-testid="git-kind"
                >
                  <option value="difftool">{{ $t('ui.difftool') }}</option>
                  <option value="mergetool">{{ $t('ui.mergetool') }}</option>
                </select>
              </label>
            </div>
            <div class="settings-row">
              <NButton
                size="small"
                data-testid="write-git-config"
                :disabled="integrationWriting"
                @click="writeGitConfig"
                >{{ $t('ui.writeGitConfig') }}</NButton
              >
            </div>
            <div class="settings-row">
              <label>
                <span>{{ $t('ui.wrapperPath') }}</span>
                <input
                  v-model="svnWrapperPath"
                  type="text"
                  data-testid="svn-wrapper-path"
                />
              </label>
              <NButton
                size="small"
                data-testid="write-svn-config"
                :disabled="integrationWriting"
                @click="writeSvnConfig"
                >{{ $t('ui.writeSvnConfig') }}</NButton
              >
            </div>
            <p
              v-if="integrationStatus"
              data-testid="integration-status"
            >
              {{ integrationStatus }}
            </p>
            <p
              v-if="integrationError"
              data-testid="integration-error"
            >
              {{ integrationError }}
            </p>
            <div class="settings-row shell-extension-row">
              <div>
                <strong>{{ $t('ui.windowsShell') }}</strong>
                <span>{{ $t('ui.shellExtensionHint') }}</span>
                <span>{{ $t('ui.shellExtensionFlowHint') }}</span>
              </div>
              <NSpace>
                <NButton
                  size="small"
                  type="primary"
                  data-testid="register-shell-extension"
                  :disabled="!policy.isWindows || integrationWriting"
                  @click="registerShellExtension"
                  >{{ $t('ui.installExplorerContextMenu') }}</NButton
                >
                <NButton
                  size="small"
                  data-testid="unregister-shell-extension"
                  :disabled="!policy.isWindows || integrationWriting"
                  @click="unregisterShellExtension"
                  >{{ $t('ui.removeExplorerContextMenu') }}</NButton
                >
              </NSpace>
            </div>
            <div class="settings-row shell-extension-row">
              <div>
                <strong>{{ $t('ui.unixShell') }}</strong>
                <span>{{ $t('ui.unixShellHint') }}</span>
                <span>{{ $t('ui.unixShellCliHint') }}</span>
              </div>
              <NSpace>
                <NButton
                  size="small"
                  type="primary"
                  data-testid="register-unix-shell-integration"
                  :disabled="!policy.supportsUnixShell || integrationWriting"
                  @click="registerUnixShell"
                  >{{ $t('ui.installUnixShellIntegration') }}</NButton
                >
                <NButton
                  size="small"
                  data-testid="unregister-unix-shell-integration"
                  :disabled="!policy.supportsUnixShell || integrationWriting"
                  @click="unregisterUnixShell"
                  >{{ $t('ui.removeUnixShellIntegration') }}</NButton
                >
              </NSpace>
            </div>
          </div>
        </NCard>

        <NCard
          v-show="optionsSection === 'sessions'"
          :title="$t('ui.sharedSessions')"
          size="small"
          data-testid="options-sessions-card"
        >
          <div class="shared-session-config">
            <div class="settings-row">
              <div>
                <strong>{{ $t('ui.sessionFilePaths') }}</strong>
                <span>{{ $t('ui.loadTeamSessionsAsReadOnlyEntries') }}</span>
              </div>
            </div>
            <div class="shared-session-input">
              <NInput
                v-model:value="sharedSessionPathDraft"
                data-testid="shared-session-path-input"
                :placeholder="$t('ui.sharedSessionPathPlaceholder')"
              />
              <NButton
                size="small"
                data-testid="add-shared-session-path"
                @click="addSharedSessionPath"
                >{{ $t('ui.add') }}</NButton
              >
            </div>
            <ul class="shared-session-list">
              <li
                v-for="path in settings.sharedSessionPaths"
                :key="path"
              >
                <span>{{ path }}</span>
                <NButton
                  text
                  size="small"
                  @click="settings.removeSharedSessionPath(path)"
                  >{{ $t('ui.remove') }}</NButton
                >
              </li>
            </ul>
            <div class="shared-session-import">
              <NInput
                v-model:value="sharedSessionJsonDraft"
                type="textarea"
                data-testid="shared-session-json-input"
                :placeholder="$t('ui.importJson')"
              />
              <NButton
                size="small"
                data-testid="load-shared-session-json"
                @click="loadSharedSessionJson"
                >{{ $t('ui.import') }}</NButton
              >
            </div>
            <p
              v-if="sharedSessionImportError"
              class="shared-session-error"
              data-testid="shared-session-import-error"
            >
              {{ sharedSessionImportError }}
            </p>
          </div>
        </NCard>
      </div>
    </section>

    <template #inspector>
      <WorkbenchInspector>
        <section class="workbench-inspector-section">
          <h2>{{ $t('ui.shortcuts') }}</h2>
          <dl>
            <div>
              <dt>{{ $t('ui.theme') }}</dt>
              <dd>{{ settings.theme }}</dd>
            </div>
            <div>
              <dt>{{ $t('ui.language') }}</dt>
              <dd>{{ settings.locale }}</dd>
            </div>
            <div>
              <dt>{{ $t('ui.fontFamily') }}</dt>
              <dd>{{ settings.fontFamily }}</dd>
            </div>
            <div>
              <dt>{{ $t('ui.fontSize') }}</dt>
              <dd>{{ settings.fontSize }}</dd>
            </div>
            <div>
              <dt>{{ $t('ui.searchCommands') }}</dt>
              <dd>{{ filteredShortcutCommands.length }}</dd>
            </div>
            <div>
              <dt>{{ $t('ui.sharedSessions') }}</dt>
              <dd>{{ settings.sharedSessionPaths.length }}</dd>
            </div>
          </dl>
        </section>
      </WorkbenchInspector>
    </template>
  </WorkbenchShell>
</template>
<style scoped>
.settings-view {
  display: grid;
  grid-template-columns: 176px minmax(0, 1fr);
  align-content: start;
  align-items: start;
  gap: 6px;
  height: 100%;
  padding: 4px 6px;
  overflow: auto;
  font-size: 11px;
  line-height: 16px;
}

.options-content {
  display: grid;
  gap: 4px;
  align-content: start;
  min-width: 0;
  padding: 0;
}

.options-content :deep([class='n-card__content']) {
  display: grid;
  gap: 4px;
  padding: 4px 6px;
}

.options-content :deep(.n-checkbox) {
  min-height: 18px;
  font-size: 11px;
  line-height: 16px;
}

.options-content :deep(.n-form-item) {
  min-height: 20px;
  margin: 0;
  padding: 0;
}

@media (width <= 900px) {
  .settings-view {
    grid-template-columns: 1fr;
  }

  .options-section-nav {
    max-height: none;
  }
}

.options-section-nav {
  display: grid;
  gap: 4px;
  max-height: calc(100vh - 120px);
  padding: 2px 4px;
  overflow: auto;
  border: 1px solid #a0a0a0;
  border-radius: 0;
  background: var(--app-surface);
  align-content: start;
}

.options-section-tree {
  display: grid;
  gap: 4px;
  align-content: start;
}

.options-tree-group {
  display: grid;
  gap: 1px;
  align-content: start;
  padding: 0 0 2px;
  border-bottom: 1px solid #e0e0e0;
}

.options-tree-group:last-child {
  border-bottom: 0;
  padding-bottom: 0;
}

.options-tree-group-label {
  min-width: 0;
  margin: 0;
  padding: 4px 6px 2px;
  color: var(--app-text-muted);
  font-size: 11px;
  font-weight: 700;
  line-height: 16px;
  text-transform: uppercase;
}

.options-section-button[data-tree-depth='1'] {
  padding-left: 14px;
}

.options-hint {
  margin: 2px 0 0;
  color: var(--app-text-muted);
  font-size: 11px;
  line-height: 16px;
}

.open-with-list {
  display: grid;
  gap: 4px;
  margin: 0 0 8px;
  padding: 0;
  list-style: none;
}

.open-with-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 6px;
  min-height: 20px;
}

.open-with-draft {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
}

.open-with-draft input {
  min-width: 160px;
  height: 20px;
  min-height: 20px;
  padding: 0 6px;
  border: 1px solid #a0a0a0;
  border-radius: 0;
  background: var(--app-bg);
  color: var(--app-text);
  font-size: 11px;
  line-height: 16px;
}

.options-section-button {
  box-sizing: border-box;
  width: 100%;
  min-height: 18px;
  padding: 2px 6px;
  border: 0;
  border-radius: 0;
  background: transparent;
  color: var(--app-text);
  font-size: 11px;
  line-height: 16px;
  text-align: left;
  cursor: pointer;
}

.options-section-button:hover {
  background: #dceeff;
}

.options-section-button.active {
  background: #c8e4ff;
  box-shadow: inset 0 0 0 1px #89bdea;
}

.auto-save-limit-input,
.font-size-input {
  width: 120px;
}

.font-family-select {
  width: 180px;
}

.auto-save-limit-row,
.font-size-row,
.tweak-row {
  display: flex;
  align-items: center;
  gap: 6px;
  min-height: 20px;
  margin-bottom: 2px;
  font-size: 11px;
  line-height: 16px;
}

.stack-row {
  display: grid;
  gap: 2px;
  margin-bottom: 4px;
  font-size: 11px;
  line-height: 16px;
}

.stack-row input,
.stack-row select {
  min-width: 0;
  height: 20px;
  min-height: 20px;
  padding: 0 6px;
  border: 1px solid #a0a0a0;
  border-radius: 0;
  background: var(--app-bg);
  color: var(--app-text);
  font-size: 11px;
  line-height: 16px;
}

.diff-color-grid {
  display: grid;
  gap: 4px;
  margin-bottom: 8px;
}

.diff-color-row {
  display: grid;
  grid-template-columns: minmax(120px, 1fr) 28px minmax(100px, 0.8fr);
  align-items: center;
  gap: 6px;
  min-height: 20px;
}

.diff-color-picker {
  width: 28px;
  height: 20px;
  padding: 0;
  border: 1px solid #a0a0a0;
  border-radius: 0;
  background: transparent;
  cursor: pointer;
}

.diff-color-text {
  min-width: 0;
  height: 20px;
  min-height: 20px;
  padding: 0 6px;
  border: 1px solid #a0a0a0;
  border-radius: 0;
  background: var(--app-bg);
  color: var(--app-text);
  font-family: var(--font-mono);
  font-size: 11px;
  line-height: 16px;
}

.diff-color-preview {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
  margin-bottom: 8px;
}

.preview-swatch {
  display: inline-flex;
  align-items: center;
  min-height: 18px;
  padding: 0 6px;
  border: 1px solid #a0a0a0;
  border-radius: 0;
  font-size: 11px;
  font-weight: 600;
  line-height: 16px;
}

.preview-swatch.added {
  background: var(--diff-added-bg);
  color: var(--diff-added-fg);
}

.preview-swatch.deleted {
  background: var(--diff-deleted-bg);
  color: var(--diff-deleted-fg);
}

.preview-swatch.modified {
  background: var(--diff-modified-bg);
  color: var(--diff-modified-fg);
}

.settings-view :deep(.n-card) {
  --n-padding-top: 4px;
  --n-padding-bottom: 4px;
  --n-padding-left: 6px;
  --n-padding-right: 6px;
  --n-title-font-size: 12px;
  --n-border-radius: 0;
  --n-border-color: #a0a0a0;

  border: 1px solid #a0a0a0;
  font-size: 11px;
  line-height: 16px;
}

.settings-view :deep(.n-card-header) {
  min-height: 20px;
  padding: 2px 6px !important;
  font-size: 12px;
  line-height: 16px;
}

.settings-view :deep(.n-space) {
  gap: 6px !important;
}

.settings-view :deep(.n-input),
.settings-view :deep(.n-base-selection),
.settings-view :deep(.n-input-number),
.settings-view :deep(.n-button) {
  --n-height: 20px;
  --n-font-size: 11px;
  --n-border-radius: 0;

  min-height: 20px;
  border-radius: 0;
  font-size: 11px;
  line-height: 16px;
}

.settings-view :deep(label),
.settings-view :deep(.n-checkbox),
.settings-view :deep(.n-radio-button) {
  font-size: 11px;
  line-height: 16px;
}

h1 {
  margin-top: 0;
}

.integration-config {
  display: grid;
  gap: 12px;
}

.integration-config label {
  display: grid;
  gap: 4px;
  min-width: 0;
}

.integration-config span {
  color: var(--app-text-muted);
  font-size: 12px;
}

.integration-config input,
.integration-config select {
  min-width: 180px;
  height: 20px;
  min-height: 20px;
  padding: 0 6px;
  border: 1px solid #a0a0a0;
  border-radius: 0;
  background: var(--app-bg);
  color: var(--app-text);
  font-size: 11px;
  line-height: 16px;
}

.settings-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  min-width: 0;
}

.settings-row div {
  display: grid;
  gap: 4px;
  min-width: 0;
}

.settings-row strong {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.settings-row span {
  min-width: 0;
  color: var(--app-text-muted);
  font-size: 12px;
  overflow-wrap: anywhere;
}

.locale-select {
  width: 180px;
}

.shared-session-config {
  display: grid;
  gap: 12px;
}

.shortcut-config {
  display: grid;
  gap: 4px;
}

.shortcut-list {
  display: grid;
  gap: 4px;
}

.shortcut-row {
  display: grid;
  grid-template-columns:
    minmax(160px, 1.3fr) minmax(90px, 0.7fr) minmax(90px, 0.7fr) minmax(140px, 1fr)
    auto auto;
  align-items: center;
  gap: 4px;
  min-height: 20px;
  padding: 2px 6px;
  border: 1px solid #a0a0a0;
  border-radius: 0;
}

.shortcut-command {
  display: grid;
  gap: 4px;
  min-width: 0;
}

.shortcut-command span,
.shortcut-default,
.shortcut-current {
  overflow: hidden;
  color: var(--app-text-muted);
  font-family:
    ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New',
    monospace;
  font-size: 12px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.shortcut-input {
  min-width: 0;
}

.shared-session-input {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  gap: 4px;
}

.shared-session-import {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  align-items: end;
  gap: 4px;
}

.shared-session-error {
  margin: 0;
  color: var(--diff-deleted-fg);
  font-size: 12px;
}

.shared-session-list {
  display: grid;
  gap: 4px;
  margin: 0;
  padding: 0;
  list-style: none;
}

.shared-session-list li {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  align-items: center;
  gap: 4px;
  min-height: 20px;
  padding: 2px 6px;
  border: 1px solid #a0a0a0;
  border-radius: 0;
}

.shared-session-list span {
  overflow: hidden;
  color: var(--app-text-muted);
  font-family:
    ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New',
    monospace;
  font-size: 12px;
  text-overflow: ellipsis;
  white-space: nowrap;
}
</style>
