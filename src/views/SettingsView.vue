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
  loadFolderCompareCriteria,
  saveFolderCompareCriteria,
  defaultFolderCompareCriteria,
} from '@/app/folderCompareCriteria'
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
  loadFileFormats,
  optionsFormatAssociationIds,
  saveFileFormats,
  setFileFormatEnabled,
  type FileFormatDefinition,
} from '@/app/fileFormats'
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
  loadRemoteProfileDefaults,
  saveRemoteProfileDefaults,
  type RemoteProfileDefaults,
} from '@/app/remoteProfilesLocal'
import {
  defaultPictureCompareOptions,
  loadPictureCompareOptions,
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
  | 'hexCompare'
  | 'pictureCompare'
  | 'mediaCompare'
  | 'versionCompare'
  | 'tableCompare'
  | 'fileFilters'
  | 'openWith'
  | 'shell'
  | 'backup'
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
const reportPreferencesDraft = ref<ReportPreferences>(loadReportPreferences())
const profileDefaultsDraft = ref<RemoteProfileDefaults>(loadRemoteProfileDefaults())
const pictureCompareDefaultsDraft = ref(loadPictureCompareOptions())
const mediaCompareDefaultsDraft = ref(loadMediaCompareOptions())
const versionCompareDefaultsDraft = ref(loadVersionCompareOptions())
const tableCompareDefaultsDraft = ref(loadTableCompareSessionOptions())
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
  reportPreferencesDraft.value = defaultReportPreferences()
  saveReportPreferences(reportPreferencesDraft.value)
  profileDefaultsDraft.value = defaultRemoteProfileDefaults()
  saveRemoteProfileDefaults(profileDefaultsDraft.value)
  pictureCompareDefaultsDraft.value = defaultPictureCompareOptions()
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

function persistTextCompareDefaultsDraft(): void {
  saveTextCompareSessionOptions(textCompareDefaultsDraft.value)
}

function persistHexCompareDefaultsDraft(): void {
  hexCompareDefaultsDraft.value = {
    ...hexCompareDefaultsDraft.value,
    bytesPerRow: normalizeHexBytesPerRow(hexCompareDefaultsDraft.value.bytesPerRow),
  }
  saveHexCompareSessionOptions(hexCompareDefaultsDraft.value)
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

function persistMediaCompareDefaultsDraft(): void {
  saveMediaCompareOptions(mediaCompareDefaultsDraft.value)
}

function persistVersionCompareDefaultsDraft(): void {
  saveVersionCompareOptions(versionCompareDefaultsDraft.value)
}

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
    <section class="settings-view">
      <nav
        class="options-section-nav options-section-tree"
        data-testid="options-section-nav"
        :aria-label="$t('ui.options')"
      >
        <div
          v-for="group in optionsTree"
          :key="group.groupKey"
          class="options-tree-group"
        >
          <p class="options-tree-group-label">{{ $t(group.groupKey) }}</p>
          <button
            v-for="section in group.items"
            :key="section.id"
            type="button"
            class="options-section-button"
            :class="{ active: optionsSection === section.id }"
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
              v-model="folderCriteriaDraft.compareContents"
              data-testid="folder-compare-contents"
              type="checkbox"
              @change="persistFolderCriteriaDraft"
            />
            <span>{{ $t('ui.compareBinaryContents') }}</span>
          </label>
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
              v-model="folderCriteriaDraft.followSymlinks"
              data-testid="folder-compare-follow-symlinks"
              type="checkbox"
              @change="persistFolderCriteriaDraft"
            />
            <span>{{ $t('ui.followSymlinks') }}</span>
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
          <p class="options-hint">{{ $t('ui.folderCompareOptionsHint') }}</p>
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
            <span>{{ $t('ui.profileDefaultRootPath') }}</span>
            <input
              v-model="profileDefaultsDraft.defaultRootPath"
              data-testid="profile-default-root-path"
              type="text"
              @change="persistProfileDefaultsDraft"
            />
          </label>
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
  grid-template-columns: 180px minmax(0, 1fr);
  align-content: start;
  align-items: start;
  gap: 6px;
  height: 100%;
  padding: 6px;
  overflow: auto;
  font-size: 11px;
}

.options-content {
  display: grid;
  gap: 6px;
  align-content: start;
  min-width: 0;
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
  padding: 1px;
  overflow: auto;
  border: 1px solid var(--app-border);
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
}

.options-tree-group-label {
  min-width: 0;
  margin: 0;
  padding: 3px 6px 1px;
  color: var(--app-text-muted);
  font-size: 10px;
  font-weight: 700;
  line-height: 12px;
  text-transform: uppercase;
}

.options-hint {
  margin: 2px 0 0;
  color: var(--app-text-muted);
  font-size: 10px;
  line-height: 12px;
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
  padding: 0 6px;
  border: 1px solid var(--app-border);
  border-radius: 2px;
  background: var(--app-bg);
  color: var(--app-text);
  font-size: 11px;
}

.options-section-button {
  box-sizing: border-box;
  width: 100%;
  min-height: 20px;
  padding: 0 6px;
  border: 0;
  border-radius: 0;
  background: transparent;
  color: var(--app-text);
  font-size: 11px;
  line-height: 18px;
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
}

.stack-row {
  display: grid;
  gap: 2px;
  margin-bottom: 4px;
  font-size: 11px;
}

.stack-row input,
.stack-row select {
  min-width: 0;
  height: 20px;
  padding: 0 6px;
  border: 1px solid var(--app-border);
  border-radius: 2px;
  background: var(--app-bg);
  color: var(--app-text);
  font-size: 11px;
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
  min-height: 22px;
}

.diff-color-picker {
  width: 28px;
  height: 22px;
  padding: 0;
  border: 1px solid var(--app-border);
  border-radius: 2px;
  background: transparent;
  cursor: pointer;
}

.diff-color-text {
  min-width: 0;
  height: 22px;
  padding: 0 6px;
  border: 1px solid var(--app-border);
  border-radius: 2px;
  background: var(--app-bg);
  color: var(--app-text);
  font-family: var(--font-mono);
  font-size: 11px;
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
  min-height: 20px;
  padding: 0 6px;
  border-radius: 2px;
  font-size: 10px;
  font-weight: 600;
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
  --n-padding-top: 8px;
  --n-padding-bottom: 8px;
  --n-padding-left: 10px;
  --n-padding-right: 10px;
  --n-title-font-size: 12px;
  --n-border-radius: 0;

  font-size: 11px;
}

.settings-view :deep(.n-card-header) {
  min-height: 28px;
  padding: 6px 10px !important;
}

.settings-view :deep(.n-space) {
  gap: 6px !important;
}

.settings-view :deep(.n-input),
.settings-view :deep(.n-base-selection),
.settings-view :deep(.n-input-number),
.settings-view :deep(.n-button) {
  --n-height: 22px;
  --n-font-size: 11px;
}

.settings-view :deep(label),
.settings-view :deep(.n-checkbox),
.settings-view :deep(.n-radio-button) {
  font-size: 11px;
  line-height: 18px;
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
  height: 32px;
  padding: 0 8px;
  border: 1px solid var(--app-border);
  border-radius: 6px;
  background: var(--app-bg);
  color: var(--app-text);
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
  gap: 12px;
}

.shortcut-list {
  display: grid;
  gap: 8px;
}

.shortcut-row {
  display: grid;
  grid-template-columns:
    minmax(160px, 1.3fr) minmax(90px, 0.7fr) minmax(90px, 0.7fr) minmax(140px, 1fr)
    auto auto;
  align-items: center;
  gap: 10px;
  padding: 10px;
  border: 1px solid var(--app-border);
  border-radius: 6px;
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
  gap: 10px;
}

.shared-session-import {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  align-items: end;
  gap: 10px;
}

.shared-session-error {
  margin: 0;
  color: var(--diff-deleted-fg);
  font-size: 12px;
}

.shared-session-list {
  display: grid;
  gap: 8px;
  margin: 0;
  padding: 0;
  list-style: none;
}

.shared-session-list li {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  align-items: center;
  gap: 10px;
  padding: 8px 10px;
  border: 1px solid var(--app-border);
  border-radius: 6px;
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
