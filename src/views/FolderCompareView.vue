<script setup lang="ts">
import {
  createAssociatedApplicationOpenAction,
  createDefaultOpenAction,
  createOpenWithAction,
  listEnabledExternalApplications,
  type ExternalApplicationConfig,
  type FileOpenAction,
} from '@/app/fileOpenActions'
import {
  createFileOperationConfirmation,
  type FileOperationConfirmation,
} from '@/app/fileOperationConfirmation'
import { createChildCompareLaunch } from '@/app/childSession'
import { isArchivePath } from '@/app/archivePath'
import { folderSnapshotOutputPath, isSnapshotPath } from '@/app/snapshotPath'
import { pickNativePath } from '@/app/filePicker'
import { formatCompareError } from '@/app/compareError'
import {
  folderRowMatchesStatusFilter,
  loadFolderDisplayFilters,
  saveFolderDisplayFilters,
} from '@/app/folderDisplayFilters'
import { loadFolderCompareCriteria, saveFolderCompareCriteria } from '@/app/folderCompareCriteria'
import {
  formatFolderNameFilterStripPattern,
  loadFolderNameFilters,
  parseFolderNameFilterStripPattern,
  saveFolderNameFilters,
  type FolderNameFilters,
} from '@/app/folderNameFilters'
import {
  applyManualAlignments,
  mergeAlignedOrphans,
  removeManualAlignment,
  upsertManualAlignment,
  type ManualAlignmentPair,
} from '@/app/folderManualAlignments'
import { loadExternalApplications } from '@/app/externalApplications'
import {
  folderCopyTargetsForDirection,
  folderEntryPaths,
  invertRowIds,
  expandHiddenDescendantsForFileActions,
  resolveOperationRows,
  selectAllRowIds,
  stepRowIdByNameFilter,
  selectFileRowIds,
  selectNewerRowIds,
  rowMatchesNewerViewPreset,
  type FolderNewerViewPreset,
  selectRowIdsByNameFilter,
  selectRowIdsByStatuses,
} from '@/app/folderRowSelection'
import {
  folderExternalTransferPlans,
  folderSideTransferPlans,
  inferCopyToSideDirectionForRows,
  resolveNewFolderRoots,
  type FolderTransferSide,
} from '@/app/folderSideTransfer'
import {
  createFolderSyncHandoffLaunch,
  explorerRevealPath,
  explorerSelectTargetPath,
  toggleIgnoredRowId,
} from '@/app/folderCompareExtraActions'
import {
  loadIgnoredRelativePathsForRoots,
  saveIgnoredRelativePathsForRoots,
} from '@/app/folderIgnoredPaths'
import { buildFolderCompareSelectionReportContent } from '@/app/folderCompareSelectionReport'
import {
  canOpenFileCompareReport,
  defaultFileCompareReportDialogState,
  fileCompareReportFormatLabelKey,
  fileCompareReportFormats,
  fileCompareReportOutputPath,
  type FileCompareReportFormat,
  type FileCompareReportScope,
} from '@/app/fileCompareReportDialog'
import { aggregateFolderSelection, formatFolderSelectionLabel } from '@/app/folderSelectionStatus'
import { useStatusBarStore } from '@/stores/statusBar'
import SessionSettingsDialog from '@/components/session/SessionSettingsDialog.vue'
import { Eye, Funnel, Save, Settings } from '@lucide/vue'
import { useViewActionsStore } from '@/stores/viewActions'
import { useFolderPathNavStore } from '@/stores/folderPathNav'
import { useFolderMenuSelectionStore } from '@/stores/folderMenuSelection'
import {
  createFolderPathNavStack,
  folderPathNavBack,
  folderPathNavCanBack,
  folderPathNavCanForward,
  folderPathNavCommit,
  folderPathNavForward,
  folderPathPairsEqual,
  type FolderPathPair,
} from '@/app/folderPathNavigation'
import { parentDirectoryPath } from '@/app/parentDirectoryPath'
import { defaultTextCompareSessionOptions } from '@/app/textCompareSessionOptions'
import { buildFolderCompareToolbar, pathBaseName, pathPairTitle } from '@/app/sessionToolbars'
import {
  changeFolderEntryAttributes,
  compareFolderPaths,
  copyFolderCompareEntry,
  copyFolderEntry,
  createFolderEntry,
  createFolderSnapshot,
  deleteFolderEntry,
  exportFolderCompareReport,
  moveFolderEntry,
  pathFileStamp,
  renameFolderEntry,
  saveTextFile,
  touchFolderEntry,
} from '@/api/diff'
import { loadReportPreferences } from '@/app/reportExports'
import { loadFileOperationPreferences } from '@/app/fileOperationPreferences'
import { newFolderParentRelativePath, resolveNewFolderPaths } from '@/app/newFolderPath'
import { openPathExternal, revealPathInOs } from '@/api/integration'
import {
  formatRemoteUri,
  isImplementedRemoteProtocol,
  listRemoteProfiles,
  parseRemoteUri,
  type RemoteProfileView,
} from '@/api/remote'
import { isTauriRuntime } from '@/app/desktopDrop'
import { loadLocalRemoteProfiles } from '@/app/remoteProfilesLocal'
import type {
  FileStamp,
  FolderCompareCriteria,
  FolderCompareResponse,
  FolderCompareRow as FolderCompareResponseRow,
  FolderCompareSideEntry,
} from '@/types/diff'
import { computed, onMounted, onUnmounted, ref, watch, watchEffect } from 'vue'
import { FOLDER_WATCH_REFRESH_MS } from '@/app/diskChangeReload'
import { useRouter } from 'vue-router'
import WorkbenchShell from '@/components/workbench/WorkbenchShell.vue'
import RemotePathBrowser from '@/components/remote/RemotePathBrowser.vue'
import SessionPathActions from '@/components/workbench/SessionPathActions.vue'
import PathMetaFooter from '@/components/workbench/PathMetaFooter.vue'
import WorkbenchInspector from '@/components/workbench/WorkbenchInspector.vue'
import StatusSummaryGrid from '@/components/workbench/StatusSummaryGrid.vue'
import { executeFolderSync, previewFolderSync } from '@/api/sync'
import { useI18n } from '@/i18n'
import { notifyCompareComplete, playCompareCompleteBeep } from '@/app/compareCompleteNotify'
import { fetchPathVolumeInfo, formatFreeSpaceQuantity } from '@/app/diskFreeSpace'
import { elapsedSecondsSince, formatImportancePhrase } from '@/app/statusBarPhrases'
import { useLastCompareStore } from '@/stores/lastCompare'
import { useSessionLaunchStore } from '@/stores/sessionLaunch'
import { useSettingsStore } from '@/stores/settings'
import FolderStatusLegend from '@/components/workbench/FolderStatusLegend.vue'
import { useTabsStore } from '@/stores/tabs'
import type { FolderSyncOverrideAction } from '@/types/sync'

type FolderSide = 'left' | 'right'
type FolderStatus = 'Same' | 'Different' | 'Left only' | 'Right only'
type FolderColumnId = 'size' | 'modified' | 'type'
type SyncPreviewAction = 'Copy' | 'Overwrite' | 'Delete' | 'Error' | 'Leave'

interface FolderTreeRow {
  id: string
  relativePath: string
  parentId?: string
  depth: number
  leftName?: string
  rightName?: string
  leftSize?: string
  rightSize?: string
  leftByteSize?: number
  rightByteSize?: number
  leftModified?: string
  rightModified?: string
  leftModifiedAtMs?: number
  rightModifiedAtMs?: number
  leftPath?: string
  rightPath?: string
  status: FolderStatus
  kind: 'file' | 'directory'
  unimportant?: boolean
  manualAlignment?: boolean
  alignedLeftRelativePath?: string
  alignedRightRelativePath?: string
}

interface SyncPreviewItem {
  id: string
  relativePath: string
  action: SyncPreviewAction
  sourcePath?: string
  targetPath?: string
  originalSourcePath?: string
  originalTargetPath?: string
  detailKey: string
}

const configurableColumns: { id: FolderColumnId; labelKey: string }[] = [
  { id: 'size', labelKey: 'ui.size' },
  { id: 'modified', labelKey: 'ui.modified' },
  { id: 'type', labelKey: 'ui.type' },
]
const externalApplicationConfigs = ref<ExternalApplicationConfig[]>(loadExternalApplications())
const displayStatusOptions: { statuses: FolderStatus[]; labelKey: string; testId: string }[] = [
  { statuses: ['Same'], labelKey: 'ui.same', testId: 'same' },
  { statuses: ['Different'], labelKey: 'ui.different', testId: 'different' },
  { statuses: ['Left only', 'Right only'], labelKey: 'ui.orphans', testId: 'orphans' },
]
const alignWithTargetId = ref('')
const manualAlignments = ref<ManualAlignmentPair[]>([])
const alignmentRootKey = ref('')
const rows = ref<FolderTreeRow[]>([])
const expandedDirectoryIds = ref<Set<string>>(new Set())
const archiveSessionActive = ref(false)
const leftRoot = ref('')
const rightRoot = ref('')
const leftFreeSpaceLabel = ref('')
const rightFreeSpaceLabel = ref('')
const leftFileStamp = ref<FileStamp | null>(null)
const rightFileStamp = ref<FileStamp | null>(null)
const folderCriteria = ref<FolderCompareCriteria>(loadFolderCompareCriteria())
const folderNameFilters = ref<FolderNameFilters>(loadFolderNameFilters())
const showSessionSettings = ref(false)
const showPeekPanel = ref(loadFolderDisplayFilters().showPeekPanel)
const peekTab = ref<'left' | 'right' | 'status'>('left')
const viewActions = useViewActionsStore()
const folderPathNavStore = useFolderPathNavStore()
const folderMenuSelection = useFolderMenuSelectionStore()
const folderPathNavStack = ref(createFolderPathNavStack<FolderPathPair>())
let applyingFolderPathHistory = false

function currentFolderPathPair(): FolderPathPair {
  return { left: leftRoot.value, right: rightRoot.value }
}

function publishFolderPathNavCapabilities(): void {
  folderPathNavStore.setCapabilities({
    canGoBack: folderPathNavCanBack(folderPathNavStack.value),
    canGoForward: folderPathNavCanForward(folderPathNavStack.value),
  })
}

function recordFolderPathCommit(): void {
  if (applyingFolderPathHistory) {
    return
  }

  folderPathNavStack.value = folderPathNavCommit(
    folderPathNavStack.value,
    currentFolderPathPair(),
    folderPathPairsEqual,
  )
  publishFolderPathNavCapabilities()
}

function applyFolderPathPair(pair: FolderPathPair): void {
  applyingFolderPathHistory = true
  leftRoot.value = pair.left
  rightRoot.value = pair.right
  applyingFolderPathHistory = false
  publishFolderPathNavCapabilities()
}

function goFolderPathBack(): void {
  const result = folderPathNavBack(folderPathNavStack.value)

  if (!result) {
    return
  }

  folderPathNavStack.value = result.stack
  applyFolderPathPair(result.entry)
}

function goFolderPathForward(): void {
  const result = folderPathNavForward(folderPathNavStack.value)

  if (!result) {
    return
  }

  folderPathNavStack.value = result.stack
  applyFolderPathPair(result.entry)
}

const textSettingsPlaceholder = defaultTextCompareSessionOptions()
const sessionLaunch = useSessionLaunchStore()
const lastCompare = useLastCompareStore()
const tabs = useTabsStore()
const settings = useSettingsStore()
const statusBar = useStatusBarStore()
const peekImportancePhrase = computed(() =>
  formatImportancePhrase(
    statusBar.report.importantDifferenceCount,
    statusBar.report.unimportantDifferenceCount,
  ),
)

const router = useRouter()
const syncRunning = ref(false)
const reportStatus = ref('')
const { t } = useI18n()
const folderCompareLoading = ref(false)
const folderCompareError = ref<string>()
const initialDisplayFilters = loadFolderDisplayFilters()
const visibleStatuses = ref<Set<FolderStatus>>(new Set(initialDisplayFilters.statuses))
const showSuppressedFilters = ref(initialDisplayFilters.showSuppressed)
const filesOnlyFilter = ref(initialDisplayFilters.filesOnly)
const alwaysShowFolders = ref(initialDisplayFilters.alwaysShowFolders)
const flatStructure = ref(false)
const newerViewPreset = ref<FolderNewerViewPreset | 'none'>('none')
const loadTimeSeconds = ref<number | null>(null)
const minorOnly = ref(false)
const showFolderRules = ref(true)
const showFolderFilters = ref(initialDisplayFilters.showFiltersPanel)
const showFolderSelect = ref(false)
const checkedRowIds = ref<Set<string>>(new Set())
const selectNameFilter = ref('')
let folderCompareGeneration = 0
let folderWatchTimer: ReturnType<typeof setInterval> | undefined
const rowHeight = 16
const showFolderLog = ref(true)
const sessionLogLines = ref<string[]>([])
const virtualViewportRows = 18
const virtualOverscanRows = 4
const scrollTop = ref(0)
const selectedRowId = ref<string>()
const lastOpenAction = ref<FileOpenAction>()
const lastCompareAction = ref<string>()
const pendingCopyConfirmation = ref<FileOperationConfirmation>()
const pendingCopyRows = ref<FolderTreeRow[]>([])
const pendingCopyDirection = ref<'Left' | 'Right'>()
const lastCopyAction = ref<string>()
const pendingDangerousOperation = ref<FileOperationConfirmation>()
const pendingDangerousOperationLabel = ref('')
const renamePanelOpen = ref(false)
const renameTargetName = ref('')
const focusedPathSide = ref<'left' | 'right'>('left')
const sideTransferPanelOpen = ref(false)
const sideTransferMode = ref<'copy' | 'move'>('copy')
const sideTransferDirection = ref<FolderTransferSide>('Right')
const newFolderPanelOpen = ref(false)
const newFolderName = ref('New Folder')
const fileCompareReportPanelOpen = ref(false)
const fileCompareReportFormat = ref<FileCompareReportFormat>(
  defaultFileCompareReportDialogState().format,
)
const fileCompareReportScope = ref<FileCompareReportScope>(
  defaultFileCompareReportDialogState().scope,
)
const lastFileOperationAction = ref<string>()
const selectedReadonly = ref(false)
const lastMetadataAction = ref<string>()
const excludedRowIds = ref<Set<string>>(new Set())
const ignoredRelativePaths = ref<Set<string>>(new Set())
const lastSelectionAction = ref<string>()
const lastAlignmentAction = ref<string>()
const currentDifferenceIndex = ref(-1)
const lastDifferenceNavigation = ref<string>()
const syncPreviewItems = ref<SyncPreviewItem[]>([])
const pendingSyncSafetyItems = ref<SyncPreviewItem[]>([])
const lastSyncAction = ref<string>()
const remoteProfiles = ref<RemoteProfileView[]>([])
const selectedLeftProfileId = ref('')
const selectedRightProfileId = ref('')
const showRemoteBrowser = ref(false)
const remoteBrowseSide = ref<'left' | 'right'>('left')
const remoteBrowseProfileId = ref('')
const remoteBrowseProfileLabel = ref('')
const remoteBrowseInitialPath = ref('/')

async function loadRemoteProfileChoices(): Promise<void> {
  try {
    remoteProfiles.value = await listRemoteProfiles()
  } catch {
    remoteProfiles.value = loadLocalRemoteProfiles().map((profile) => ({
      id: profile.id,
      name: profile.name,
      protocol: profile.protocol,
      host: profile.host,
      port: profile.port,
      rootPath: profile.rootPath,
      implemented: true,
      uri: formatRemoteUri(profile.protocol, profile.id, profile.rootPath),
      username: profile.username,
    }))
  }
}

function applyRemoteProfile(side: FolderSide, profileId: string): void {
  const profile = remoteProfiles.value.find((item) => item.id === profileId)

  if (!profile) {
    return
  }

  const uri = formatRemoteUri(profile.protocol, profile.id, profile.rootPath || '/')

  if (side === 'left') {
    selectedLeftProfileId.value = profile.id
    leftRoot.value = uri
  } else {
    selectedRightProfileId.value = profile.id
    rightRoot.value = uri
  }

  syncFolderTabTitle()
  recordFolderPathCommit()
}

function applyFolderLaunch(
  launch: NonNullable<ReturnType<typeof sessionLaunch.consumeLaunch>>,
): void {
  leftRoot.value = launch.locations.left?.uri ?? leftRoot.value
  rightRoot.value = launch.locations.right?.uri ?? rightRoot.value
  archiveSessionActive.value =
    launch.sessionType === 'archive-compare' ||
    (isArchivePath(leftRoot.value) && isArchivePath(rightRoot.value))
  syncFolderTabTitle()
  recordFolderPathCommit()

  if (launch.autoRun && launch.locations.left?.uri && launch.locations.right?.uri) {
    void runFolderCompare()
  }
}

onMounted(() => {
  window.addEventListener('click', closeContextMenus)
  void loadRemoteProfileChoices()

  const launch = sessionLaunch.consumeLaunch('/compare/folder')

  if (launch) {
    applyFolderLaunch(launch)
  }
})

// AppLayout owns the single Tauri drop listener; apply fresh launches while this view stays mounted.
watch(
  () => sessionLaunch.pendingLaunch,
  (pending) => {
    if (pending?.route !== '/compare/folder') {
      return
    }

    const launch = sessionLaunch.consumeLaunch('/compare/folder')

    if (launch) {
      applyFolderLaunch(launch)
    }
  },
)

watch([leftRoot, rightRoot], () => {
  folderMenuSelection.setRoots(leftRoot.value, rightRoot.value)
  if (isArchivePath(leftRoot.value) && isArchivePath(rightRoot.value)) {
    archiveSessionActive.value = true
  }
  ignoredRelativePaths.value = loadIgnoredRelativePathsForRoots(leftRoot.value, rightRoot.value)
  syncFolderTabTitle()
  void refreshRootFreeSpace()
  void refreshFolderPathStamps()
})

async function refreshFolderPathStamps(): Promise<void> {
  const [left, right] = await Promise.all([
    leftRoot.value ? pathFileStamp(leftRoot.value).catch(() => null) : Promise.resolve(null),
    rightRoot.value ? pathFileStamp(rightRoot.value).catch(() => null) : Promise.resolve(null),
  ])

  leftFileStamp.value = left
  rightFileStamp.value = right
}

async function refreshRootFreeSpace(): Promise<void> {
  const [leftInfo, rightInfo] = await Promise.all([
    fetchPathVolumeInfo(leftRoot.value),
    fetchPathVolumeInfo(rightRoot.value),
  ])

  leftFreeSpaceLabel.value = leftInfo
    ? t('status.diskFreeOn', {
        quantity: formatFreeSpaceQuantity(leftInfo.freeBytes),
        root: leftInfo.displayRoot,
      })
    : ''
  rightFreeSpaceLabel.value = rightInfo
    ? t('status.diskFreeOn', {
        quantity: formatFreeSpaceQuantity(rightInfo.freeBytes),
        root: rightInfo.displayRoot,
      })
    : ''
}

const summary = computed(() => ({
  total: rows.value.length,
  different: rows.value.filter((row) => row.status === 'Different').length,
  minor: rows.value.filter((row) => rowLooksUnimportant(row)).length,
  orphans: rows.value.filter((row) => row.status === 'Left only' || row.status === 'Right only')
    .length,
}))
const directoryRows = computed(() => rows.value.filter((row) => row.kind === 'directory'))
const selectedRow = computed(() => rows.value.find((row) => row.id === selectedRowId.value))

watch(
  [checkedRowIds, selectedRowId],
  () => {
    folderMenuSelection.setHasSelection(
      checkedRowIds.value.size > 0 || Boolean(selectedRowId.value),
    )
  },
  { immediate: true },
)
const selectedFilePath = computed(() => {
  const row = selectedRow.value

  if (row?.kind !== 'file') {
    return undefined
  }

  return row.leftPath ?? row.rightPath
})
const selectedEntryPath = computed(() => {
  const row = selectedRow.value

  if (!row) {
    return undefined
  }

  return row.leftPath ?? row.rightPath
})
const alignWithCandidates = computed(() =>
  rows.value.filter(
    (row) =>
      row.kind === 'file' &&
      row.id !== selectedRowId.value &&
      (row.status === 'Left only' || row.status === 'Right only'),
  ),
)
const canAlignWith = computed(() => {
  const selected = selectedRow.value
  const target = rows.value.find((row) => row.id === alignWithTargetId.value)

  if (!selected || !target || selected.kind !== 'file' || target.kind !== 'file') {
    return false
  }

  return (
    (selected.status === 'Left only' && target.status === 'Right only') ||
    (selected.status === 'Right only' && target.status === 'Left only')
  )
})
const canBreakAlignment = computed(() => {
  const selected = selectedRow.value

  return Boolean(
    selected?.kind === 'file' &&
    selected.leftPath &&
    selected.rightPath &&
    (selected.manualAlignment === true ||
      selected.status === 'Different' ||
      selected.status === 'Same'),
  )
})
const enabledExternalApplications = computed(() =>
  listEnabledExternalApplications(externalApplicationConfigs.value),
)
const differenceRows = computed(() =>
  visibleRows.value.filter((row) => row.status !== 'Same' && !isSuppressed(row)),
)
const visibleRows = computed(() =>
  rows.value.filter(
    (row) =>
      (flatStructure.value || !row.parentId || expandedDirectoryIds.value.has(row.parentId)) &&
      !excludedRowIds.value.has(row.id) &&
      folderRowMatchesStatusFilter({
        kind: row.kind,
        status: row.status,
        statuses: [...visibleStatuses.value],
        showSuppressed: showSuppressedFilters.value,
        alwaysShowFolders: alwaysShowFolders.value,
      }) &&
      (!filesOnlyFilter.value || row.kind === 'file') &&
      (!minorOnly.value || rowLooksUnimportant(row)) &&
      (newerViewPreset.value === 'none' || rowMatchesNewerViewPreset(row, newerViewPreset.value)),
  ),
)
const virtualStartIndex = computed(() =>
  Math.max(0, Math.floor(scrollTop.value / rowHeight) - virtualOverscanRows),
)
const virtualEndIndex = computed(() =>
  Math.min(
    visibleRows.value.length,
    virtualStartIndex.value + virtualViewportRows + virtualOverscanRows * 2,
  ),
)
const virtualRows = computed(() =>
  visibleRows.value.slice(virtualStartIndex.value, virtualEndIndex.value),
)
const virtualSpacerHeight = computed(() => {
  const height = String(visibleRows.value.length * rowHeight)

  return `${height}px`
})
const virtualOffset = computed(() => {
  const offset = String(virtualStartIndex.value * rowHeight)

  return `translateY(${offset}px)`
})
const visibleColumnIds = ref<Set<FolderColumnId>>(new Set(['size', 'modified']))
const showColumnConfig = ref(true)
const showSessionInfo = ref(false)
const gridTemplateColumns = computed(() => {
  const columns = ['minmax(180px, 1.2fr)']

  if (isColumnVisible('size')) {
    columns.push('90px')
  }

  if (isColumnVisible('modified')) {
    columns.push('150px')
  }

  if (isColumnVisible('type')) {
    columns.push('96px')
  }

  columns.push('96px', 'minmax(180px, 1.2fr)')

  if (isColumnVisible('size')) {
    columns.push('90px')
  }

  if (isColumnVisible('modified')) {
    columns.push('150px')
  }

  if (isColumnVisible('type')) {
    columns.push('96px')
  }

  return columns.join(' ')
})

function rowIndent(row: FolderTreeRow): string {
  const indent = String(row.depth * 14)

  return `${indent}px`
}

function sideValue(
  row: FolderTreeRow,
  side: FolderSide,
  field: 'name' | 'size' | 'modified',
): string {
  const key = `${side}${field[0].toUpperCase()}${field.slice(1)}` as keyof FolderTreeRow
  const value = row[key]

  return typeof value === 'string' ? value : '--'
}

function typeLabel(row: FolderTreeRow): string {
  return row.kind === 'directory' ? t('ui.directory') : t('ui.file')
}

function folderStatusLabel(status: FolderStatus): string {
  const keys: Record<FolderStatus, string> = {
    Different: 'ui.different',
    'Left only': 'ui.leftOnly',
    'Right only': 'ui.rightOnly',
    Same: 'ui.same',
  }

  return t(keys[status])
}

function rowLooksUnimportant(row: FolderTreeRow): boolean {
  return row.unimportant === true || ignoredRelativePaths.value.has(row.relativePath)
}

function folderRowStatusLabel(row: FolderTreeRow): string {
  if (rowLooksUnimportant(row) && row.status === 'Different') {
    return t('ui.minor')
  }

  if (ignoredRelativePaths.value.has(row.relativePath)) {
    return t('ui.ignored')
  }

  return folderStatusLabel(row.status)
}

function syncPreviewActionLabel(action: SyncPreviewAction): string {
  const keys: Record<SyncPreviewAction, string> = {
    Copy: 'ui.copy',
    Delete: 'ui.delete',
    Error: 'ui.error',
    Leave: 'ui.leave',
    Overwrite: 'ui.overwrite',
  }

  return t(keys[action])
}

function isColumnVisible(columnId: FolderColumnId): boolean {
  return visibleColumnIds.value.has(columnId)
}

function toggleColumn(columnId: FolderColumnId, selected: boolean): void {
  const next = new Set(visibleColumnIds.value)

  if (selected) {
    next.add(columnId)
  } else {
    next.delete(columnId)
  }

  visibleColumnIds.value = next
}

function areStatusesVisible(statuses: FolderStatus[]): boolean {
  return statuses.every((status) => visibleStatuses.value.has(status))
}

function isSuppressed(row: FolderTreeRow): boolean {
  return !visibleStatuses.value.has(row.status)
}

function persistFolderCriteria(): void {
  saveFolderCompareCriteria({ ...folderCriteria.value })
}

function openFolderSessionSettings(): void {
  showSessionSettings.value = true
}

function persistFolderNameFilters(): void {
  saveFolderNameFilters({ ...folderNameFilters.value })
}

const folderFilterStripPattern = computed(() =>
  formatFolderNameFilterStripPattern(folderNameFilters.value),
)

function applyFolderFilterStripPattern(raw: string): void {
  folderNameFilters.value = {
    ...folderNameFilters.value,
    include: parseFolderNameFilterStripPattern(raw),
  }
  persistFolderNameFilters()
}

function onFolderFilterStripChange(event: Event): void {
  applyFolderFilterStripPattern((event.target as HTMLInputElement).value)
}

let folderNameFilterRebuildTimer: ReturnType<typeof setTimeout> | undefined

watch(
  folderNameFilters,
  () => {
    if (folderNameFilterRebuildTimer !== undefined) {
      clearTimeout(folderNameFilterRebuildTimer)
    }

    folderNameFilterRebuildTimer = setTimeout(() => {
      folderNameFilterRebuildTimer = undefined

      if (folderCompareLoading.value) {
        return
      }

      if (!leftRoot.value || !rightRoot.value) {
        return
      }

      if (rows.value.length === 0) {
        return
      }

      void runFolderCompare()
    }, 350)
  },
  { deep: true },
)

function applyFolderSessionSettings(
  payload:
    | { kind: 'folder'; criteria: FolderCompareCriteria; filters: FolderNameFilters }
    | { kind: 'text'; options: typeof textSettingsPlaceholder }
    | { kind: 'table'; options: unknown }
    | { kind: 'hex'; options: unknown }
    | { kind: 'picture'; options: unknown }
    | { kind: 'media'; options: unknown }
    | { kind: 'version'; options: unknown }
    | { kind: 'registry'; options: unknown }
    | { kind: 'patch'; options: unknown },
): void {
  if (payload.kind !== 'folder') {
    return
  }

  folderCriteria.value = { ...payload.criteria }
  folderNameFilters.value = { ...payload.filters }
  persistFolderCriteria()
  persistFolderNameFilters()
  showSessionSettings.value = false
  if (leftRoot.value && rightRoot.value) {
    void runFolderCompare()
  }
}

async function saveFolderSnapshot(): Promise<void> {
  const sourceRoot = leftRoot.value.trim()

  if (!sourceRoot) {
    return
  }

  const normalizedRoot = sourceRoot.replace(/[/\\]+$/u, '')
  const outputPath = folderSnapshotOutputPath(normalizedRoot)

  try {
    await createFolderSnapshot({
      sourceRoot: normalizedRoot,
      outputPath,
      name: pathBaseName(normalizedRoot),
    })
    lastCompareAction.value = `Snapshot saved: ${outputPath}`
  } catch (error) {
    lastCompareAction.value = error instanceof Error ? error.message : String(error)
  }
}

watch(
  () => [viewActions.sequence, viewActions.name] as const,
  ([, actionName]) => {
    if (!actionName) {
      return
    }

    switch (actionName) {
      case 'session-settings':
        openFolderSessionSettings()
        break
      case 'save-snapshot':
        void saveFolderSnapshot()
        break
      case 'compare':
      case 'reload':
        if (leftRoot.value && rightRoot.value) {
          void runFolderCompare()
        }
        break
      case 'swap':
        swapFolderRoots()
        break
      case 'rules':
        showFolderRules.value = !showFolderRules.value
        break
      case 'filters':
        showFolderFilters.value = !showFolderFilters.value
        break
      case 'export':
        void exportFolderReport('html')
        break
      case 'show-all':
        showAllFolderStatuses()
        break
      case 'show-differences':
        applyStatusViewPreset(['Different', 'Left only', 'Right only'])
        break
      case 'copy-left':
        copySelectedTo('Left')
        break
      case 'copy-right':
        copySelectedTo('Right')
        break
      case 'copy-to-side':
        copySelectedToSide()
        break
      case 'move-to-side':
        void moveSelectedToSide()
        break
      case 'copy-to-folder':
        void copySelectedToFolder()
        break
      case 'move-to-folder':
        void moveSelectedToFolder()
        break
      case 'rename-selected':
        renameSelectedFile()
        break
      case 'copy-filename':
        void copyRowPath()
        break
      case 'compare-contents':
        compareContentsSelected()
        break
      case 'synchronize':
        synchronizeFromFolderCompare()
        break
      case 'explorer':
        void revealSelectedInExplorer()
        break
      case 'ignored':
        toggleIgnoredSelected()
        break
      case 'align-with':
        alignWithFromAction()
        break
      case 'break-alignment':
        breakSelectedAlignment()
        break
      case 'file-compare-report':
        openFileCompareReportPanel()
        break
      case 'toggle-minor':
        showMinorFolderDifferences()
        break
      case 'expand-all':
        expandAllFolders()
        break
      case 'collapse-all':
        collapseAllFolders()
        break
      case 'browse-folder':
        void browseFolder('left')
        break
      case 'up-one-level':
        upOneFolderLevel()
        break
      case 'path-back':
        goFolderPathBack()
        break
      case 'path-forward':
        goFolderPathForward()
        break
      case 'about':
      case 'check-for-updates':
      case 'close-tab':
      case 'clear-session':
      case 'copy':
      case 'cut':
      case 'export-settings':
      case 'help-contents':
      case 'help-context':
      case 'help-support':
      case 'import-settings':
      case 'next-difference':
        navigateFolderDifference('next')
        break
      case 'previous-difference':
        navigateFolderDifference('previous')
        break
      case 'paste':
      case 'redo':
      case 'restore-factory-defaults':
      case 'save':
      case 'save-as':
      case 'undo':
      case 'workspace-load':
      case 'next-conflict':
      case 'previous-conflict':
      case 'sync-now':
      case 'toggle-session-locked':
      case 'workspace-save':
      case 'select-all':
        selectVisibleAll()
        break
      case 'select-all-files':
        selectVisibleFiles()
        break
      case 'select-orphans':
        selectVisibleByStatuses(['Left only', 'Right only'], 'ui.orphans')
        break
      case 'select-newer':
        selectVisibleNewer()
        break
      case 'invert-selection':
        invertVisibleSelection()
        break
      case 'open-selected':
        openSelectedFile()
        break
      case 'open-with':
        void openSelectedWithAssociatedApplication()
        break
      case 'quick-compare':
        quickCompareSelectedFile()
        break
      case 'exclude-selected':
        excludeSelectedRow()
        break
      case 'refresh-selection':
        void refreshSelectedRow()
        break
      case 'show-same':
        showSameFolderStatuses()
        break
      case 'show-orphans':
        applyStatusViewPreset(['Left only', 'Right only'])
        break
      case 'show-no-orphans':
        applyStatusViewPreset(['Same', 'Different'])
        break
      case 'show-differences-no-orphans':
        applyStatusViewPreset(['Different'])
        break
      case 'show-left-orphans':
        applyStatusViewPreset(['Left only'])
        break
      case 'show-right-orphans':
        applyStatusViewPreset(['Right only'])
        break
      case 'show-left-newer':
        applyNewerViewPreset('left-newer')
        break
      case 'show-right-newer':
        applyNewerViewPreset('right-newer')
        break
      case 'show-left-newer-orphans':
        applyNewerViewPreset('left-newer-orphans')
        break
      case 'show-right-newer-orphans':
        applyNewerViewPreset('right-newer-orphans')
        break
      case 'compare-files-and-folder-structure':
        applyFolderStructurePreset('structure')
        break
      case 'only-compare-files':
        applyFolderStructurePreset('files')
        break
      case 'ignore-folder-structure':
        applyFolderStructurePreset('flat')
        break
      case 'always-show-folders':
        alwaysShowFolders.value = !alwaysShowFolders.value
        persistDisplayFilters()
        break
      case 'show-changes':
      case 'show-conflicts':
      case 'toggle-center-pane':
      case 'compare-to-output':
        break
      case 'suppress-filters':
        showSuppressedFilters.value = !showSuppressedFilters.value
        break
      case 'compare-parent-folders':
        upOneFolderLevel()
        break
      case 'find-filename':
        showFolderSelect.value = true
        selectVisibleByName()
        break
      case 'find-next-filename':
        stepFindFilename(1)
        break
      case 'find-previous-filename':
        stepFindFilename(-1)
        break
      case 'full-refresh':
        excludedRowIds.value = new Set()
        if (leftRoot.value && rightRoot.value) {
          void runFolderCompare()
        }
        break
      case 'toggle-columns':
        showColumnConfig.value = !showColumnConfig.value
        break
      case 'session-info':
        showSessionInfo.value = !showSessionInfo.value
        break
      case 'change-attributes':
        void toggleSelectedReadonly(!selectedReadonly.value)
        break
      case 'touch-selected':
        void touchSelectedFile()
        break
      case 'merge-execute':
      case 'copy-to-output':
        break
      case 'new-folder':
        openNewFolderPanel()
        break
      case 'delete':
        deleteSelectedFile()
        break
      case 'leave-alone':
      case 'sync-copy-left-to-right':
      case 'sync-copy-right-to-left':
      case 'sync-delete-left':
      case 'sync-delete-right':
        break
      case 'save-report':
        openFileCompareReportPanel()
        break
      case 'run-script':
      case 'toggle-legend':
      case 'toggle-toolbar':
        break
      case 'toggle-log':
        showFolderLog.value = !showFolderLog.value
        break
    }
  },
)

watch(
  folderCriteria,
  () => {
    persistFolderCriteria()
  },
  { deep: true },
)

function persistDisplayFilters(): void {
  saveFolderDisplayFilters({
    statuses: [...visibleStatuses.value],
    showSuppressed: showSuppressedFilters.value,
    filesOnly: filesOnlyFilter.value,
    alwaysShowFolders: alwaysShowFolders.value,
    showFiltersPanel: showFolderFilters.value,
    showPeekPanel: showPeekPanel.value,
  })
}

function toggleStatuses(statuses: FolderStatus[], selected: boolean): void {
  const next = new Set(visibleStatuses.value)

  for (const status of statuses) {
    if (selected) {
      next.add(status)
    } else {
      next.delete(status)
    }
  }

  visibleStatuses.value = next
  scrollTop.value = 0
  persistDisplayFilters()
}

watch(showSuppressedFilters, () => {
  persistDisplayFilters()
})

watch(filesOnlyFilter, () => {
  persistDisplayFilters()
})

watch(showFolderFilters, () => {
  persistDisplayFilters()
})

watch(showPeekPanel, () => {
  persistDisplayFilters()
})

watch(alwaysShowFolders, () => {
  persistDisplayFilters()
})

function toggleFolder(row: FolderTreeRow): void {
  if (row.kind !== 'directory') {
    return
  }

  const next = new Set(expandedDirectoryIds.value)

  if (next.has(row.id)) {
    next.delete(row.id)
  } else {
    next.add(row.id)
  }

  expandedDirectoryIds.value = next
}

function expandAllFolders(): void {
  expandedDirectoryIds.value = new Set(directoryRows.value.map((row) => row.id))
}

function collapseAllFolders(): void {
  expandedDirectoryIds.value = new Set()
}

function swapFolderRoots(): void {
  const nextLeft = rightRoot.value

  rightRoot.value = leftRoot.value
  leftRoot.value = nextLeft
  syncFolderTabTitle()
  recordFolderPathCommit()
}

function showAllFolderStatuses(): void {
  minorOnly.value = false
  newerViewPreset.value = 'none'
  visibleStatuses.value = new Set(['Same', 'Different', 'Left only', 'Right only'])
  persistDisplayFilters()
}

function showSameFolderStatuses(): void {
  minorOnly.value = false
  newerViewPreset.value = 'none'
  visibleStatuses.value = new Set(['Same'])
  persistDisplayFilters()
}

function showDiffsFolderStatuses(): void {
  minorOnly.value = false
  newerViewPreset.value = 'none'
  visibleStatuses.value = new Set(['Different', 'Left only', 'Right only'])
  persistDisplayFilters()
}

function isDiffsFolderFilterActive(): boolean {
  return (
    !minorOnly.value &&
    visibleStatuses.value.size === 3 &&
    visibleStatuses.value.has('Different') &&
    visibleStatuses.value.has('Left only') &&
    visibleStatuses.value.has('Right only')
  )
}

function applyStatusViewPreset(statuses: FolderStatus[]): void {
  minorOnly.value = false
  newerViewPreset.value = 'none'
  visibleStatuses.value = new Set(statuses)
  persistDisplayFilters()
}

function applyNewerViewPreset(preset: FolderNewerViewPreset): void {
  minorOnly.value = false
  newerViewPreset.value = preset
  if (preset === 'left-newer' || preset === 'right-newer') {
    visibleStatuses.value = new Set(['Different'])
  } else if (preset === 'left-newer-orphans') {
    visibleStatuses.value = new Set(['Different', 'Left only'])
  } else {
    visibleStatuses.value = new Set(['Different', 'Right only'])
  }
  persistDisplayFilters()
}

function applyFolderStructurePreset(mode: 'structure' | 'files' | 'flat'): void {
  if (mode === 'structure') {
    filesOnlyFilter.value = false
    flatStructure.value = false
  } else if (mode === 'files') {
    filesOnlyFilter.value = true
    flatStructure.value = false
  } else {
    flatStructure.value = true
  }
  scrollTop.value = 0
  persistDisplayFilters()
}

function toggleFlatStructure(): void {
  flatStructure.value = !flatStructure.value
  scrollTop.value = 0
}

function showMinorFolderDifferences(): void {
  minorOnly.value = !minorOnly.value
  if (minorOnly.value) {
    visibleStatuses.value = new Set(['Same', 'Different', 'Left only', 'Right only'])
    persistDisplayFilters()
  }
}

function toggleFilesOnlyFilter(): void {
  filesOnlyFilter.value = !filesOnlyFilter.value
  scrollTop.value = 0
}

function syncFolderTabTitle(): void {
  if (!leftRoot.value || !rightRoot.value) {
    return
  }

  tabs.setTabTitle('/compare/folder', pathPairTitle(leftRoot.value, rightRoot.value))
}

function goHomeFromFolder(): void {
  tabs.openTab({ title: 'Home', titleKey: 'ui.home', route: '/', dirty: false })
  void router.push('/')
}

const folderSessionToolbar = computed(() =>
  buildFolderCompareToolbar({
    home: true,
    all: true,
    diffs: true,
    same: true,
    structure: true,
    minor: rows.value.length > 0,
    rules: true,
    sessions: true,
    copy: canCopyToRight.value,
    expand: true,
    collapse: true,
    select: true,
    files: true,
    refresh: Boolean(leftRoot.value && rightRoot.value) && !folderCompareLoading.value,
    swap: Boolean(leftRoot.value || rightRoot.value),
    stop: folderCompareLoading.value,
    filters: true,
    peek: true,
  }).map((item) => ({
    ...item,
    active:
      (item.id === 'all' && !minorOnly.value && visibleStatuses.value.size === 4) ||
      (item.id === 'diffs' && isDiffsFolderFilterActive()) ||
      (item.id === 'same' &&
        !minorOnly.value &&
        visibleStatuses.value.size === 1 &&
        visibleStatuses.value.has('Same')) ||
      (item.id === 'structure' && flatStructure.value) ||
      (item.id === 'minor' && minorOnly.value) ||
      (item.id === 'rules' && showFolderRules.value) ||
      (item.id === 'sessions' && showSessionSettings.value) ||
      (item.id === 'filters' && showFolderFilters.value) ||
      (item.id === 'select' && showFolderSelect.value) ||
      (item.id === 'files' && filesOnlyFilter.value) ||
      (item.id === 'peek' && showPeekPanel.value),
  })),
)

function runFolderToolbarCommand(commandId: string): void {
  switch (commandId) {
    case 'home':
      goHomeFromFolder()
      break
    case 'all':
      showAllFolderStatuses()
      break
    case 'diffs':
      showDiffsFolderStatuses()
      break
    case 'same':
      showSameFolderStatuses()
      break
    case 'structure':
      toggleFlatStructure()
      break
    case 'minor':
      showMinorFolderDifferences()
      break
    case 'rules':
      showFolderRules.value = !showFolderRules.value
      break
    case 'sessions':
      openFolderSessionSettings()
      break
    case 'copy':
      if (canCopyToRight.value) {
        copySelectedTo('Right')
      }
      break
    case 'expand':
      expandAllFolders()
      break
    case 'collapse':
      collapseAllFolders()
      break
    case 'files':
      toggleFilesOnlyFilter()
      break
    case 'refresh':
      void runFolderCompare()
      break
    case 'swap':
      swapFolderRoots()
      break
    case 'stop':
      cancelFolderCompare()
      break
    case 'filters':
      showFolderFilters.value = !showFolderFilters.value
      break
    case 'select':
      showFolderSelect.value = !showFolderSelect.value
      break
    case 'peek':
      showPeekPanel.value = !showPeekPanel.value
      break
    default:
      break
  }
}

function applyCheckedRowIds(ids: string[], actionLabel: string): void {
  checkedRowIds.value = new Set(ids)
  lastSelectionAction.value = t('status.selectedRowCount', {
    count: ids.length,
    action: actionLabel,
  })
}

function selectVisibleAll(): void {
  applyCheckedRowIds(selectAllRowIds(visibleRows.value), t('ui.selectAll'))
}

function selectVisibleFiles(): void {
  applyCheckedRowIds(selectFileRowIds(visibleRows.value), t('ui.selectAllFiles'))
}

function selectVisibleByStatuses(statuses: FolderStatus[], labelKey: string): void {
  applyCheckedRowIds(selectRowIdsByStatuses(visibleRows.value, statuses), t(labelKey))
}

function selectVisibleNewer(): void {
  applyCheckedRowIds(selectNewerRowIds(visibleRows.value), t('ui.selectNewer'))
}

function stepFindFilename(direction: 1 | -1): void {
  if (!selectNameFilter.value.trim()) {
    showFolderSelect.value = true

    return
  }

  const nextId = stepRowIdByNameFilter(
    visibleRows.value,
    selectNameFilter.value,
    selectedRowId.value,
    direction,
  )

  if (!nextId) {
    showFolderSelect.value = true

    return
  }

  selectedRowId.value = nextId
  applyCheckedRowIds([nextId], t('ui.findFilename'))
}

function selectVisibleByName(): void {
  applyCheckedRowIds(
    selectRowIdsByNameFilter(visibleRows.value, selectNameFilter.value),
    t('ui.selectByName'),
  )
}

function invertVisibleSelection(): void {
  applyCheckedRowIds(invertRowIds(visibleRows.value, checkedRowIds.value), t('ui.invertSelection'))
}

function clearVisibleSelection(): void {
  applyCheckedRowIds([], t('ui.clearSelection'))
}

function toggleCheckedRow(rowId: string, checked: boolean): void {
  const next = new Set(checkedRowIds.value)

  if (checked) {
    next.add(rowId)
  } else {
    next.delete(rowId)
  }

  checkedRowIds.value = next
}

function isRowChecked(rowId: string): boolean {
  return checkedRowIds.value.has(rowId)
}

const selectionFooterLabels = {
  filesSelectedBytes: (count: number, bytes: number) =>
    t('status.filesSelectedBytes', { count, bytes }),
  filesSelectedBytesWithDate: (count: number, bytes: number, modified: string) =>
    t('status.filesSelectedBytesWithDate', { count, bytes, modified }),
  filesAndFoldersSelectedBytes: (files: number, folders: number, bytes: number) =>
    t('status.filesAndFoldersSelectedBytes', { files, folders, bytes }),
  foldersSelected: (count: number) => t('status.foldersSelected', { count }),
  itemsSelected: (count: number) => t('status.itemsSelected', { count }),
}

const sessionInfoStats = computed(() => {
  const counts = { total: rows.value.length, same: 0, different: 0, leftOnly: 0, rightOnly: 0 }

  for (const row of rows.value) {
    if (row.status === 'Same') {
      counts.same += 1
    } else if (row.status === 'Different') {
      counts.different += 1
    } else if (row.status === 'Left only') {
      counts.leftOnly += 1
    } else {
      counts.rightOnly += 1
    }
  }

  return counts
})

const folderSelectionSummary = computed(() => {
  const aggregate = aggregateFolderSelection(rows.value, checkedRowIds.value, selectedRowId.value)

  return {
    ...aggregate,
    hasRoots: Boolean(leftRoot.value || rightRoot.value),
    leftSelectionLabel: formatFolderSelectionLabel(
      { ...aggregate, bytes: aggregate.leftBytes, modified: aggregate.leftModified },
      selectionFooterLabels,
    ),
    rightSelectionLabel: formatFolderSelectionLabel(
      { ...aggregate, bytes: aggregate.rightBytes, modified: aggregate.rightModified },
      selectionFooterLabels,
    ),
  }
})

watchEffect(() => {
  const summary = folderSelectionSummary.value
  const leftSelection = summary.leftSelectionLabel || null
  const rightSelection = summary.rightSelectionLabel || null

  let comparisonStatus = t('status.readyIdle')

  if (folderCompareLoading.value) {
    comparisonStatus = t('status.comparing')
  } else if (rows.value.length > 0) {
    comparisonStatus = t('status.compared')
  }

  const hasRows = rows.value.length > 0
  const differentRows = rows.value.filter((row) => row.status === 'Different')
  const importantDifferenceCount = hasRows
    ? differentRows.filter((row) => !rowLooksUnimportant(row)).length
    : null
  const unimportantDifferenceCount = hasRows
    ? differentRows.filter((row) => rowLooksUnimportant(row)).length
    : null

  statusBar.reportStatus({
    comparisonStatus,
    differenceCount: hasRows ? differentRows.length : null,
    filterStatus: t('status.allRows'),
    source: 'folder-compare',
    chromeKind: 'folder-pair',
    loadTimeSeconds: hasRows ? loadTimeSeconds.value : null,
    importantDifferenceCount,
    unimportantDifferenceCount,
    leftSelection,
    leftFreeSpace: leftFreeSpaceLabel.value || null,
    rightSelection,
    rightFreeSpace: rightFreeSpaceLabel.value || null,
  })
})

function isExpanded(row: FolderTreeRow): boolean {
  return expandedDirectoryIds.value.has(row.id)
}

function formatSessionLogTimestamp(date = new Date()): string {
  const year = String(date.getFullYear())
  const month = String(date.getMonth() + 1)
  const day = String(date.getDate())
  const hours = String(date.getHours()).padStart(2, '0')
  const minutes = String(date.getMinutes()).padStart(2, '0')
  const seconds = String(date.getSeconds()).padStart(2, '0')

  return `${year}/${month}/${day} ${hours}:${minutes}:${seconds}`
}

function appendSessionLog(message: string): void {
  sessionLogLines.value = [...sessionLogLines.value, `${formatSessionLogTimestamp()} ${message}`]
}

function saveSessionLog(): void {
  const payload = sessionLogLines.value.join('\n')

  if (!payload) {
    return
  }

  void navigator.clipboard.writeText(payload)
}

async function runFolderCompare(): Promise<void> {
  const generation = ++folderCompareGeneration
  const startedAt = performance.now()

  folderCompareLoading.value = true
  folderCompareError.value = undefined
  appendSessionLog(`${t('ui.username')}:`)
  if (leftRoot.value) {
    appendSessionLog(`Load ${leftRoot.value}`)
  }
  if (rightRoot.value) {
    appendSessionLog(`Load ${rightRoot.value}`)
  }

  try {
    const response = await compareFolderPaths({
      leftRoot: leftRoot.value,
      rightRoot: rightRoot.value,
      criteria: {
        ...folderCriteria.value,
        showHiddenFiles: settings.showHiddenFiles,
      },
      filters: { ...folderNameFilters.value },
      archiveExtensions: [...settings.archiveExtensions],
    })

    if (generation !== folderCompareGeneration) {
      return
    }

    applyFolderCompareResponse(response)
    loadTimeSeconds.value = elapsedSecondsSince(startedAt)
    lastCompare.recordFolderCompare({
      leftRoot: response.leftRoot,
      rightRoot: response.rightRoot,
    })
    void notifyCompareComplete(
      settings.notifyOnCompareComplete,
      t('ui.notifyOnCompareComplete'),
      t('status.compareCompleteNotifyBody'),
    )
  } catch (error) {
    if (generation !== folderCompareGeneration) {
      return
    }

    folderCompareError.value = formatCompareError(error, t)
  } finally {
    if (generation === folderCompareGeneration) {
      folderCompareLoading.value = false
    }
  }
}

function cancelFolderCompare(): void {
  if (!folderCompareLoading.value) {
    return
  }

  folderCompareGeneration += 1
  folderCompareLoading.value = false
  folderCompareError.value = t('error.compare.cancelled')
}

function applyFolderCompareResponse(response: FolderCompareResponse): void {
  const nextRows = response.rows.map(folderCompareResponseRowToTreeRow)
  const rowIds = new Set(nextRows.map((row) => row.id))
  const normalized = nextRows.map((row) =>
    row.parentId && !rowIds.has(row.parentId) ? { ...row, parentId: undefined } : row,
  )
  const nextRootKey = `${response.leftRoot}|${response.rightRoot}`

  if (alignmentRootKey.value && alignmentRootKey.value !== nextRootKey) {
    manualAlignments.value = []
  }

  const previousExpanded = expandedDirectoryIds.value
  const keepExpansion =
    loadFileOperationPreferences().keepFolderExpansionOnReload &&
    alignmentRootKey.value === nextRootKey

  alignmentRootKey.value = nextRootKey
  rows.value = applyManualAlignments(normalized, manualAlignments.value)
  leftRoot.value = response.leftRoot
  rightRoot.value = response.rightRoot
  ignoredRelativePaths.value = loadIgnoredRelativePathsForRoots(
    response.leftRoot,
    response.rightRoot,
  )
  const directoryIds = new Set(
    rows.value.filter((row) => row.kind === 'directory').map((row) => row.id),
  )

  if (keepExpansion) {
    expandedDirectoryIds.value = new Set([...previousExpanded].filter((id) => directoryIds.has(id)))
  } else {
    expandedDirectoryIds.value = settings.collapseIdenticalFoldersDefault
      ? directoryIdsWithDifferences(rows.value)
      : directoryIds
  }
  selectedRowId.value = undefined
  excludedRowIds.value = new Set()
  alignWithTargetId.value = ''
  lastAlignmentAction.value = undefined
  currentDifferenceIndex.value = -1
  lastDifferenceNavigation.value = undefined
  minorOnly.value = false
  scrollTop.value = 0

  if (settings.autoScrollToFirstDifference && differenceRows.value.length > 0) {
    const firstDifference = differenceRows.value[0]

    currentDifferenceIndex.value = 0
    selectedRowId.value = firstDifference.id
    lastDifferenceNavigation.value = t('status.folderDifferencePosition', {
      index: 1,
      total: differenceRows.value.length,
      name: displayName(firstDifference),
    })
  }
}

function directoryIdsWithDifferences(treeRows: FolderTreeRow[]): Set<string> {
  const expandIds = new Set<string>()
  const byId = new Map(treeRows.map((row) => [row.id, row]))

  for (const row of treeRows) {
    if (row.status === 'Same') {
      continue
    }

    let parentId = row.parentId

    while (parentId) {
      expandIds.add(parentId)
      parentId = byId.get(parentId)?.parentId
    }

    if (row.kind === 'directory') {
      expandIds.add(row.id)
    }
  }

  return expandIds
}

function folderCompareResponseRowToTreeRow(row: FolderCompareResponseRow): FolderTreeRow {
  return {
    id: rowIdFromRelativePath(row.relativePath),
    relativePath: row.relativePath,
    parentId: parentIdFromRelativePath(row.relativePath),
    depth: row.depth,
    leftName: row.left?.name,
    rightName: row.right?.name,
    leftSize: formatFolderSideSize(row.left),
    rightSize: formatFolderSideSize(row.right),
    leftByteSize: row.left?.kind === 'file' ? row.left.size : undefined,
    rightByteSize: row.right?.kind === 'file' ? row.right.size : undefined,
    leftModified: formatFolderModified(row.left?.modifiedAtMs),
    rightModified: formatFolderModified(row.right?.modifiedAtMs),
    leftModifiedAtMs: row.left?.modifiedAtMs,
    rightModifiedAtMs: row.right?.modifiedAtMs,
    leftPath: row.left?.path,
    rightPath: row.right?.path,
    status: row.status,
    kind: row.left?.kind ?? row.right?.kind ?? 'file',
    unimportant: row.unimportant === true,
  }
}

function rowIdFromRelativePath(relativePath: string): string {
  const normalized = relativePath.replaceAll('\\', '/').trim()

  if (!normalized) {
    return 'root'
  }

  return normalized
    .toLowerCase()
    .replaceAll(/[^a-z0-9]+/gu, '-')
    .replaceAll(/^-|-$/gu, '')
}

function parentIdFromRelativePath(relativePath: string): string | undefined {
  const normalized = relativePath.replaceAll('\\', '/')
  const separatorIndex = normalized.lastIndexOf('/')

  if (separatorIndex < 0) {
    return undefined
  }

  return rowIdFromRelativePath(normalized.slice(0, separatorIndex))
}

function formatFolderSideSize(side: FolderCompareSideEntry | undefined): string {
  if (!side || side.kind === 'directory') {
    return '--'
  }

  return formatBytes(side.size)
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) {
    return `${String(bytes)} B`
  }

  const units = ['KB', 'MB', 'GB', 'TB']
  let value = bytes / 1024
  let unitIndex = 0

  while (value >= 1024 && unitIndex < units.length - 1) {
    value /= 1024
    unitIndex += 1
  }

  return `${value.toFixed(1)} ${units[unitIndex]}`
}

function formatFolderModified(modifiedAtMs: number | undefined): string {
  if (!modifiedAtMs) {
    return '--'
  }

  const date = new Date(modifiedAtMs)
  const year = String(date.getFullYear())
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  const hours = String(date.getHours()).padStart(2, '0')
  const minutes = String(date.getMinutes()).padStart(2, '0')
  const base = `${year}-${month}-${day} ${hours}:${minutes}`

  if (!settings.showMillisecondsInTimestamps) {
    return base
  }

  const seconds = String(date.getSeconds()).padStart(2, '0')
  const millis = String(date.getMilliseconds()).padStart(3, '0')

  return `${base}:${seconds}.${millis}`
}

function alignSelectedWithTarget(): void {
  const selected = selectedRow.value
  const target = rows.value.find((row) => row.id === alignWithTargetId.value)

  if (!selected || !target || !canAlignWith.value) {
    lastAlignmentAction.value = t('status.alignWithNeedsOrphans')

    return
  }

  const leftSide = selected.status === 'Left only' ? selected : target
  const rightSide = selected.status === 'Right only' ? selected : target
  const merged = mergeAlignedOrphans(leftSide, rightSide)

  manualAlignments.value = upsertManualAlignment(
    manualAlignments.value,
    leftSide.relativePath,
    rightSide.relativePath,
  )
  alignmentRootKey.value = `${leftRoot.value}|${rightRoot.value}`
  rows.value = rows.value
    .filter((row) => row.id !== leftSide.id && row.id !== rightSide.id)
    .concat(merged)
  selectedRowId.value = merged.id
  alignWithTargetId.value = ''
  lastAlignmentAction.value = t('status.alignWithApplied', {
    source: displayName(leftSide),
    target: displayName(rightSide),
  })
}

function breakSelectedAlignment(): void {
  const selected = selectedRow.value

  if (!selected || !canBreakAlignment.value || !selected.leftPath || !selected.rightPath) {
    return
  }

  const leftRelative = selected.alignedLeftRelativePath ?? pathBaseFromPath(selected.leftPath)
  const rightRelative = selected.alignedRightRelativePath ?? pathBaseFromPath(selected.rightPath)

  manualAlignments.value = removeManualAlignment(
    manualAlignments.value,
    leftRelative,
    rightRelative,
  )

  const leftOnly: FolderTreeRow = {
    id: `${selected.id}-left`,
    relativePath: leftRelative,
    parentId: selected.parentId,
    depth: selected.depth,
    leftName: selected.leftName ?? pathBaseFromPath(selected.leftPath),
    leftSize: selected.leftSize,
    leftModified: selected.leftModified,
    leftPath: selected.leftPath,
    status: 'Left only',
    kind: 'file',
  }
  const rightOnly: FolderTreeRow = {
    id: `${selected.id}-right`,
    relativePath: rightRelative,
    parentId: selected.parentId,
    depth: selected.depth,
    rightName: selected.rightName ?? pathBaseFromPath(selected.rightPath),
    rightSize: selected.rightSize,
    rightModified: selected.rightModified,
    rightPath: selected.rightPath,
    status: 'Right only',
    kind: 'file',
  }

  rows.value = rows.value.filter((row) => row.id !== selected.id).concat(leftOnly, rightOnly)
  selectedRowId.value = leftOnly.id
  alignWithTargetId.value = ''
  lastAlignmentAction.value = t('status.breakAlignmentApplied', {
    name: displayName(selected),
  })
}

function pathBaseFromPath(path: string): string {
  const normalized = path.replaceAll('\\', '/').replace(/\/+$/u, '')
  const parts = normalized.split('/').filter(Boolean)

  return parts.at(-1) ?? path
}

function selectRow(row: FolderTreeRow): void {
  selectedRowId.value = row.id
  alignWithTargetId.value = ''
}

function recordOpenAction(action: FileOpenAction): void {
  lastOpenAction.value = action
}

async function openSelectedWithAssociatedApplication(): Promise<void> {
  const path = selectedFilePath.value

  if (!path) {
    return
  }

  try {
    await openPathExternal(path)
    recordOpenAction(createAssociatedApplicationOpenAction(path))
  } catch (error) {
    folderCompareError.value = formatCompareError(error, t)
  }
}

async function openSelectedWithApplication(application: ExternalApplicationConfig): Promise<void> {
  const path = selectedFilePath.value

  if (!path || !application.enabled || !application.executable.trim()) {
    return
  }

  try {
    await openPathExternal(path, application.executable)
    recordOpenAction(createOpenWithAction(path, application.name, application.executable))
  } catch (error) {
    folderCompareError.value = formatCompareError(error, t)
  }
}

function openSelectedFile(): void {
  openChildCompareForSelected('open')
}

function quickCompareSelectedFile(): void {
  openChildCompareForSelected('quick')
}

function compareSelectedFileToCounterpart(): void {
  openChildCompareForSelected('compare')
}

function openChildCompareForSelected(kind: 'open' | 'quick' | 'compare'): void {
  const row = selectedRow.value

  if (row?.kind !== 'file') {
    return
  }

  const leftPath = row.leftPath ?? folderSidePath(leftRoot.value, row.relativePath)
  const rightPath = row.rightPath ?? folderSidePath(rightRoot.value, row.relativePath)
  const launch = createChildCompareLaunch(leftPath, rightPath)

  if (!launch) {
    return
  }

  if (selectedFilePath.value) {
    recordOpenAction(createDefaultOpenAction(selectedFilePath.value))
  }

  lastCompareAction.value =
    kind === 'quick'
      ? `${t('ui.quickCompare')} -> ${launch.route}`
      : `${t('ui.compareTo')} -> ${launch.route}`
  sessionLaunch.setPendingLaunch(launch)
  tabs.openTab({ title: launch.title, route: launch.route, dirty: false })
  void router.push(launch.route)
}

function operationTargetRows(): FolderTreeRow[] {
  const selected = resolveOperationRows(rows.value, checkedRowIds.value, selectedRowId.value)

  if (!settings.includeHiddenItemsInFileActions) {
    return selected
  }

  return expandHiddenDescendantsForFileActions(rows.value, selected)
}

function maybeBeepAfterLongFileOperation(startedAt: number): void {
  if (!settings.beepAfterLongFileOperations) {
    return
  }

  if (Date.now() - startedAt < settings.longFileOperationThresholdMs) {
    return
  }

  playCompareCompleteBeep()
}

function operationEntryPaths(): string[] {
  return folderEntryPaths(operationTargetRows())
}

const leftSideIsArchive = computed(() => isArchivePath(leftRoot.value))
const rightSideIsArchive = computed(() => isArchivePath(rightRoot.value))
const leftSideIsSnapshot = computed(() => isSnapshotPath(leftRoot.value))
const rightSideIsSnapshot = computed(() => isSnapshotPath(rightRoot.value))
/** Archives/snapshots are read-only targets; copy from archive into a folder is supported. */
const canCopyToLeft = computed(
  () => Boolean(selectedFilePath.value) && !leftSideIsArchive.value && !leftSideIsSnapshot.value,
)
const canCopyToRight = computed(
  () => Boolean(selectedFilePath.value) && !rightSideIsArchive.value && !rightSideIsSnapshot.value,
)

async function browseArchive(side: 'left' | 'right'): Promise<void> {
  const selected = await pickNativePath({ directory: false })

  if (!selected) {
    return
  }

  if (!isArchivePath(selected)) {
    folderCompareError.value = t('status.notAnArchivePath', { path: selected })

    return
  }

  if (side === 'left') {
    leftRoot.value = selected
  } else {
    rightRoot.value = selected
  }

  recordFolderPathCommit()
}

function copySelectedTo(direction: 'Left' | 'Right'): void {
  const targets = folderCopyTargetsForDirection(operationTargetRows(), direction, (relativePath) =>
    folderSidePath(direction === 'Left' ? leftRoot.value : rightRoot.value, relativePath),
  )

  if (targets.length === 0) {
    return
  }

  const targetRows = operationTargetRows().filter((row) =>
    targets.some((target) => target.relativePath === row.relativePath),
  )

  pendingCopyRows.value = targetRows
  pendingCopyDirection.value = direction
  pendingCopyConfirmation.value = createFileOperationConfirmation({
    operation: 'copy',
    paths: targets.map((target) => target.targetPath),
  })

  if (!settings.confirmBeforeCopy) {
    void confirmFolderCopy()
  }
}

function renameSelectedFile(): void {
  const targets = operationTargetRows()

  if (targets.length === 0) {
    return
  }

  renamePanelOpen.value = true
  renameTargetName.value = displayName(targets[0])
}

function displayName(row: FolderTreeRow): string {
  return row.leftName ?? row.rightName ?? row.id
}

function folderSidePath(root: string, relativePath: string): string {
  const normalizedRoot = root.replaceAll('\\', '/').replace(/\/$/u, '')
  const normalizedRelativePath = relativePath.replaceAll('\\', '/').replace(/^\//u, '')

  if (!normalizedRelativePath) {
    return normalizedRoot
  }

  return `${normalizedRoot}/${normalizedRelativePath}`
}

function fileOpenActionLabel(action: FileOpenAction): string {
  return t(action.labelKey, action.labelParams)
}

function fileOperationTitle(confirmation: FileOperationConfirmation): string {
  return t(confirmation.titleKey, confirmation.titleParams)
}

async function confirmFolderCopy(): Promise<void> {
  const confirmation = pendingCopyConfirmation.value
  const direction = pendingCopyDirection.value
  const copyRows = pendingCopyRows.value

  if (!confirmation || !direction || copyRows.length === 0) {
    return
  }

  const startedAt = Date.now()

  try {
    for (const row of copyRows) {
      await copyFolderCompareEntry({
        leftRoot: leftRoot.value,
        rightRoot: rightRoot.value,
        relativePath: row.relativePath,
        direction: direction === 'Left' ? 'toLeft' : 'toRight',
      })
    }
    lastCopyAction.value =
      copyRows.length === 1
        ? t('status.copiedToSide', {
            side: direction === 'Left' ? t('ui.left') : t('ui.right'),
            path: confirmation.paths[0],
          })
        : t('status.copiedBulkToSide', {
            side: direction === 'Left' ? t('ui.left') : t('ui.right'),
            count: copyRows.length,
          })
    pendingCopyConfirmation.value = undefined
    pendingCopyDirection.value = undefined
    pendingCopyRows.value = []
    checkedRowIds.value = new Set()
    maybeBeepAfterLongFileOperation(startedAt)
    await runFolderCompare()
  } catch (error) {
    folderCompareError.value = formatCompareError(error, t)
  }
}

async function confirmRenameFile(): Promise<void> {
  const paths = operationEntryPaths()

  if (paths.length === 0 || !renameTargetName.value) {
    return
  }

  try {
    for (const path of paths) {
      await renameFolderEntry({ path, newName: renameTargetName.value })
    }
    lastFileOperationAction.value =
      paths.length === 1
        ? t('status.renamedPath', { path: renameTargetName.value })
        : t('status.renamedBulkPaths', {
            count: paths.length,
            path: renameTargetName.value,
          })
    renamePanelOpen.value = false
    checkedRowIds.value = new Set()
    await runFolderCompare()
  } catch (error) {
    folderCompareError.value = formatCompareError(error, t)
  }
}

function openNewFolderPanel(): void {
  if (!leftRoot.value && !rightRoot.value) {
    return
  }

  if (leftSideIsArchive.value && rightSideIsArchive.value) {
    return
  }

  newFolderName.value = 'New Folder'
  newFolderPanelOpen.value = true
}

async function confirmNewFolder(): Promise<void> {
  const selected = operationTargetRows().at(0)
  const parentRelative = newFolderParentRelativePath({
    selectedRelativePath: selected?.relativePath,
    selectedKind: selected?.kind,
  })
  const roots = resolveNewFolderRoots({
    leftRoot: leftRoot.value,
    rightRoot: rightRoot.value,
    leftWritable: Boolean(leftRoot.value) && !leftSideIsArchive.value && !leftSideIsSnapshot.value,
    rightWritable:
      Boolean(rightRoot.value) && !rightSideIsArchive.value && !rightSideIsSnapshot.value,
    focusedSide: focusedPathSide.value,
  })

  const paths = resolveNewFolderPaths({
    roots,
    folderName: newFolderName.value,
    parentRelativePath: parentRelative,
  })

  if (paths.length === 0) {
    return
  }

  try {
    for (const path of paths) {
      await createFolderEntry({ path })
    }
    lastFileOperationAction.value =
      paths.length === 1
        ? t('status.createdFolder', { path: paths[0] })
        : t('status.createdFolders', { count: paths.length })
    newFolderPanelOpen.value = false
    checkedRowIds.value = new Set()
    await runFolderCompare()
  } catch (error) {
    folderCompareError.value = formatCompareError(error, t)
  }
}

function openSideTransferPanel(mode: 'copy' | 'move', direction: FolderTransferSide): void {
  sideTransferMode.value = mode
  sideTransferDirection.value = direction
  sideTransferPanelOpen.value = true
}

function copySelectedToSide(direction?: FolderTransferSide): void {
  const rows = operationTargetRows()

  if (rows.length === 0) {
    return
  }

  const inferred = direction ?? inferCopyToSideDirectionForRows(rows)

  if (!inferred) {
    return
  }

  if (inferred === 'ambiguous') {
    openSideTransferPanel('copy', 'Right')

    return
  }

  copySelectedTo(inferred)
}

async function confirmSideTransfer(): Promise<void> {
  const direction = sideTransferDirection.value
  const mode = sideTransferMode.value

  sideTransferPanelOpen.value = false

  if (mode === 'copy') {
    copySelectedTo(direction)

    return
  }

  await executeMoveToSide(direction)
}

async function moveSelectedToSide(direction?: FolderTransferSide): Promise<void> {
  const rows = operationTargetRows()

  if (rows.length === 0) {
    return
  }

  const inferred = direction ?? inferCopyToSideDirectionForRows(rows)

  if (!inferred) {
    return
  }

  if (inferred === 'ambiguous') {
    openSideTransferPanel('move', 'Right')

    return
  }

  await executeMoveToSide(inferred)
}

async function executeMoveToSide(direction: FolderTransferSide): Promise<void> {
  const plans = folderSideTransferPlans(
    operationTargetRows(),
    direction,
    leftRoot.value,
    rightRoot.value,
  )

  if (plans.length === 0) {
    return
  }

  const startedAt = Date.now()

  if (settings.confirmBeforeMove) {
    // eslint-disable-next-line no-alert -- Options Confirmations move gate
    const accepted = window.confirm(
      `${t('ui.confirmBeforeMoveHint')}\n${plans.map((plan) => plan.targetPath).join('\n')}`,
    )

    if (!accepted) {
      return
    }
  }

  const targetWritable =
    direction === 'Left'
      ? !leftSideIsArchive.value && !leftSideIsSnapshot.value
      : !rightSideIsArchive.value && !rightSideIsSnapshot.value

  if (!targetWritable) {
    return
  }

  try {
    for (const plan of plans) {
      await moveFolderEntry({ sourcePath: plan.sourcePath, targetPath: plan.targetPath })
    }
    lastFileOperationAction.value =
      plans.length === 1
        ? `${t('ui.moveToSide')} -> ${plans[0].targetPath}`
        : t('status.movedBulkPaths', { count: plans.length })
    checkedRowIds.value = new Set()
    maybeBeepAfterLongFileOperation(startedAt)
    await runFolderCompare()
  } catch (error) {
    folderCompareError.value = formatCompareError(error, t)
  }
}

async function copySelectedToFolder(): Promise<void> {
  const rows = operationTargetRows()

  if (rows.length === 0) {
    return
  }

  const destination = await pickNativePath({ directory: true })

  if (!destination) {
    return
  }

  const plans = folderExternalTransferPlans(rows, destination)

  if (plans.length === 0) {
    return
  }

  const startedAt = Date.now()

  try {
    for (const plan of plans) {
      await copyFolderEntry({
        sourcePath: plan.sourcePath,
        targetPath: plan.targetPath,
        preserveTimestamps: settings.preserveTimestampsOnCopy,
        overwriteReadOnly: settings.overwriteReadOnlyFiles,
        sourceModifiedAtMs: plan.sourceModifiedAtMs,
        copyEmptyFolders: loadFileOperationPreferences().copyEmptyFolders,
        skipNewerTargets: loadFileOperationPreferences().skipNewerTargetsOnCopy,
      })
    }
    lastFileOperationAction.value =
      plans.length === 1
        ? t('status.copiedPath', { path: plans[0].targetPath })
        : t('status.copiedBulkToSide', { count: plans.length, side: destination })
    checkedRowIds.value = new Set()
    maybeBeepAfterLongFileOperation(startedAt)
    await runFolderCompare()
  } catch (error) {
    folderCompareError.value = formatCompareError(error, t)
  }
}

async function moveSelectedToFolder(): Promise<void> {
  const rows = operationTargetRows()

  if (rows.length === 0) {
    return
  }

  const destination = await pickNativePath({ directory: true })

  if (!destination) {
    return
  }

  const plans = folderExternalTransferPlans(rows, destination)

  if (plans.length === 0) {
    return
  }

  if (settings.confirmBeforeMove) {
    // eslint-disable-next-line no-alert -- Options Confirmations move gate
    const accepted = window.confirm(
      `${t('ui.confirmBeforeMoveHint')}\n${plans.map((plan) => plan.targetPath).join('\n')}`,
    )

    if (!accepted) {
      return
    }
  }

  const startedAt = Date.now()

  try {
    for (const plan of plans) {
      await moveFolderEntry({ sourcePath: plan.sourcePath, targetPath: plan.targetPath })
    }
    lastFileOperationAction.value =
      plans.length === 1
        ? `${t('ui.moveToFolder')} -> ${plans[0].targetPath}`
        : t('status.movedBulkPaths', { count: plans.length })
    checkedRowIds.value = new Set()
    maybeBeepAfterLongFileOperation(startedAt)
    await runFolderCompare()
  } catch (error) {
    folderCompareError.value = formatCompareError(error, t)
  }
}

function deleteSelectedFile(): void {
  const paths = folderEntryPaths(operationTargetRows())

  if (paths.length === 0) {
    return
  }

  pendingDangerousOperationLabel.value =
    paths.length === 1
      ? t('status.deletedArrowPath', { path: paths[0] })
      : t('status.deletedBulkPaths', { count: paths.length })
  pendingDangerousOperation.value = createFileOperationConfirmation({
    operation: 'delete',
    paths,
  })

  if (!settings.confirmBeforeDelete) {
    void confirmDangerousFileOperation()
  }
}

async function confirmDangerousFileOperation(): Promise<void> {
  if (!pendingDangerousOperation.value) {
    return
  }

  const startedAt = Date.now()

  try {
    await Promise.all(
      pendingDangerousOperation.value.paths.map((path) => deleteFolderEntry({ path })),
    )
    lastFileOperationAction.value = pendingDangerousOperationLabel.value
    pendingDangerousOperation.value = undefined
    pendingDangerousOperationLabel.value = ''
    checkedRowIds.value = new Set()
    maybeBeepAfterLongFileOperation(startedAt)
    await runFolderCompare()
  } catch (error) {
    folderCompareError.value = formatCompareError(error, t)
  }
}

async function toggleSelectedReadonly(selected: boolean): Promise<void> {
  const paths = operationEntryPaths()

  if (paths.length === 0) {
    return
  }

  try {
    for (const path of paths) {
      await changeFolderEntryAttributes({ path, readonly: selected })
    }
    selectedReadonly.value = selected
    lastMetadataAction.value =
      paths.length === 1
        ? t('status.attributesChanged', {
            state: selected ? 'readonly' : 'writable',
          })
        : t('status.attributesChangedBulk', {
            count: paths.length,
            state: selected ? 'readonly' : 'writable',
          })
    checkedRowIds.value = new Set()
    await runFolderCompare()
  } catch (error) {
    folderCompareError.value = formatCompareError(error, t)
  }
}

async function touchSelectedFile(): Promise<void> {
  const path = selectedEntryPath.value

  if (!path) {
    return
  }

  try {
    await touchFolderEntry({ path, modifiedAtMs: Date.now() })
    lastMetadataAction.value = t('status.touchedPath', { path })
    await runFolderCompare()
  } catch (error) {
    folderCompareError.value = formatCompareError(error, t)
  }
}

function excludeSelectedRow(): void {
  const row = selectedRow.value

  if (!row) {
    return
  }

  excludedRowIds.value = new Set([...excludedRowIds.value, row.id])
  selectedRowId.value = undefined
  lastSelectionAction.value = t('status.excludedPath', { path: displayName(row) })
}

function compareContentsSelected(): void {
  const row = selectedRow.value

  if (row?.kind !== 'file') {
    lastCompareAction.value = t('status.compareContentsNeedsFile')

    return
  }

  const leftPath = row.leftPath ?? folderSidePath(leftRoot.value, row.relativePath)
  const rightPath = row.rightPath ?? folderSidePath(rightRoot.value, row.relativePath)
  const launch = createChildCompareLaunch(leftPath, rightPath)

  if (!launch) {
    lastCompareAction.value = t('status.compareContentsNoRoute')

    return
  }

  if (selectedFilePath.value) {
    recordOpenAction(createDefaultOpenAction(selectedFilePath.value))
  }

  lastCompareAction.value = `${t('ui.compareContents')} -> ${launch.route}`
  sessionLaunch.setPendingLaunch(launch)
  tabs.openTab({ title: launch.title, route: launch.route, dirty: false })
  void router.push(launch.route)
}

function synchronizeFromFolderCompare(): void {
  const launch = createFolderSyncHandoffLaunch(leftRoot.value, rightRoot.value, t('ui.folderSync'))

  if (!launch) {
    lastCompareAction.value = t('status.synchronizeNeedsRoots')

    return
  }

  lastCompareAction.value = `${t('ui.synchronize')} -> ${launch.route}`
  sessionLaunch.setPendingLaunch(launch)
  tabs.openTab({ title: launch.title, route: launch.route, dirty: false })
  void router.push(launch.route)
}

async function revealSelectedInExplorer(): Promise<void> {
  const row = selectedRow.value
  const entryPath = selectedEntryPath.value

  if (!row || !entryPath) {
    return
  }

  const selectPath = explorerSelectTargetPath(entryPath)
  const fallbackPath = explorerRevealPath(entryPath, row.kind)

  try {
    const result = await revealPathInOs(selectPath)
    const revealedPath = result.selected ? selectPath : result.path || fallbackPath

    lastOpenAction.value = createDefaultOpenAction(revealedPath)
    lastSelectionAction.value = result.selected
      ? t('status.explorerRevealed', { path: selectPath })
      : t('status.explorerOpenedParent', { path: revealedPath })
  } catch {
    try {
      await openPathExternal(fallbackPath)
      lastOpenAction.value = createDefaultOpenAction(fallbackPath)
      lastSelectionAction.value = t('status.explorerOpenedParent', { path: fallbackPath })
    } catch (fallbackError) {
      folderCompareError.value = formatCompareError(fallbackError, t)
    }
  }
}

function toggleIgnoredSelected(): void {
  const row = selectedRow.value

  if (!row) {
    return
  }

  const result = toggleIgnoredRowId(ignoredRelativePaths.value, row.relativePath)

  ignoredRelativePaths.value = result.next
  saveIgnoredRelativePathsForRoots(leftRoot.value, rightRoot.value, result.next)
  lastSelectionAction.value = result.marked
    ? t('status.ignoredMarked', { path: displayName(row) })
    : t('status.ignoredUnmarked', { path: displayName(row) })
}

function alignWithFromAction(): void {
  const selected = selectedRow.value

  if (!alignWithTargetId.value && selected) {
    const candidate = alignWithCandidates.value.find(
      (row) =>
        (selected.status === 'Left only' && row.status === 'Right only') ||
        (selected.status === 'Right only' && row.status === 'Left only'),
    )

    if (candidate) {
      alignWithTargetId.value = candidate.id
    }
  }

  alignSelectedWithTarget()
}

async function refreshSelectedRow(): Promise<void> {
  await runFolderCompare()
  const row = selectedRow.value

  lastSelectionAction.value = row
    ? t('status.refreshedPath', { path: displayName(row) })
    : t('ui.refresh')
}

async function previewSyncPlan(): Promise<void> {
  if (!leftRoot.value || !rightRoot.value) {
    syncPreviewItems.value = []

    return
  }

  const preview = await previewFolderSync({
    leftRoot: leftRoot.value,
    rightRoot: rightRoot.value,
    strategy: 'updateRight',
  })

  syncPreviewItems.value = preview.rows.map((row) => ({
    id: row.id,
    relativePath: row.relativePath,
    action: mapSyncPreviewAction(row.action),
    sourcePath: row.sourcePath,
    targetPath: row.targetPath,
    originalSourcePath: row.sourcePath,
    originalTargetPath: row.targetPath,
    detailKey: row.detail || 'sync.detail.leftOnlyCopiedToRight',
  }))
}

function mapSyncPreviewAction(action: string): SyncPreviewAction {
  if (action === 'Delete') {
    return 'Delete'
  }
  if (action === 'Leave') {
    return 'Leave'
  }
  if (action === 'Error' || action === 'Conflict') {
    return 'Error'
  }

  return action === 'Overwrite' ? 'Overwrite' : 'Copy'
}

const canFileCompareReport = computed(() =>
  canOpenFileCompareReport(
    rows.value.length > 0 && Boolean(leftRoot.value) && Boolean(rightRoot.value),
  ),
)

function openFileCompareReportPanel(): void {
  if (!canFileCompareReport.value) {
    reportStatus.value = t('status.fileCompareReportNeedsCompare')
    lastCompareAction.value = t('status.fileCompareReportNeedsCompare')

    return
  }

  renamePanelOpen.value = false
  sideTransferPanelOpen.value = false
  newFolderPanelOpen.value = false
  fileCompareReportPanelOpen.value = true
}

function closeFileCompareReportPanel(): void {
  fileCompareReportPanelOpen.value = false
}

async function confirmFileCompareReport(): Promise<void> {
  if (!canFileCompareReport.value || !leftRoot.value || !rightRoot.value) {
    reportStatus.value = t('status.fileCompareReportNeedsCompare')

    return
  }

  await exportFolderReport(fileCompareReportFormat.value, fileCompareReportScope.value)
  fileCompareReportPanelOpen.value = false
}

async function exportFolderReport(
  format: 'html' | 'text' | 'json' | 'xml' | 'csv' | 'markdown',
  scope: FileCompareReportScope = 'full',
): Promise<void> {
  if (!leftRoot.value || !rightRoot.value) {
    return
  }

  if (scope === 'selection') {
    const selectionRows = resolveOperationRows(rows.value, checkedRowIds.value, selectedRowId.value)
    const scopeLabel = checkedRowIds.value.size > 0 ? 'checked' : 'selection'
    const selectionInput = {
      leftRoot: leftRoot.value,
      rightRoot: rightRoot.value,
      scopeLabel,
      rows: selectionRows.map((row) => ({
        relativePath: row.relativePath,
        status: row.status,
        kind: row.kind,
        leftPath: row.leftPath,
        rightPath: row.rightPath,
        ignored: ignoredRelativePaths.value.has(row.relativePath),
      })),
    }
    const selectionPath = fileCompareReportOutputPath(leftRoot.value, format, 'selection')
    const selectionText = buildFolderCompareSelectionReportContent(format, selectionInput)

    try {
      await saveTextFile({ path: selectionPath, text: selectionText })
      reportStatus.value = selectionPath
      lastCompareAction.value = selectionPath
    } catch {
      reportStatus.value = t('status.selectionReportReady', { count: selectionRows.length })
      lastCompareAction.value = reportStatus.value
    }

    return
  }

  const response = await exportFolderCompareReport({
    leftRoot: leftRoot.value,
    rightRoot: rightRoot.value,
    format,
    outputPath: fileCompareReportOutputPath(leftRoot.value, format, 'full'),
    includeIdentical: loadReportPreferences().includeIdentical,
    includeOrphans: loadReportPreferences().includeOrphans,
    includeUnimportant: loadReportPreferences().includeUnimportant,
  })

  reportStatus.value = response.outputPath ?? format
  lastCompareAction.value = reportStatus.value
}

function markSyncPreviewItemAsLeave(itemId: string): void {
  syncPreviewItems.value = syncPreviewItems.value.map((item) =>
    item.id === itemId
      ? {
          ...item,
          action: 'Leave',
          sourcePath: undefined,
          targetPath: item.targetPath ?? item.originalTargetPath,
          detailKey: 'sync.detail.noOperation',
        }
      : item,
  )
}

function reverseSyncPreviewItem(itemId: string): void {
  syncPreviewItems.value = syncPreviewItems.value.map((item) => {
    if (item.id !== itemId) {
      return item
    }

    const sourcePath = item.originalTargetPath ?? item.targetPath
    const targetPath = item.originalSourcePath ?? item.sourcePath

    return {
      ...item,
      action: 'Copy',
      sourcePath,
      targetPath,
      detailKey: 'sync.detail.directionReversed',
    }
  })
}

function runSyncPreview(): void {
  const riskyItems = syncPreviewItems.value.filter((item) =>
    ['Delete', 'Overwrite'].includes(item.action),
  )

  if (riskyItems.length > 0 && settings.confirmBeforeSyncOverwrite) {
    pendingSyncSafetyItems.value = riskyItems

    return
  }

  void executeSyncPreview()
}

function confirmSyncSafety(): void {
  pendingSyncSafetyItems.value = []
  void executeSyncPreview()
}

function syncOverrideAction(item: SyncPreviewItem): FolderSyncOverrideAction {
  if (item.action === 'Delete') {
    return 'delete'
  }

  if (item.action === 'Leave' || item.action === 'Error') {
    return 'leave'
  }

  const source = item.sourcePath ?? ''

  if (rightRoot.value && source.startsWith(rightRoot.value)) {
    return 'copyRightToLeft'
  }

  return 'copyLeftToRight'
}

async function executeSyncPreview(): Promise<void> {
  if (!leftRoot.value || !rightRoot.value || syncRunning.value) {
    return
  }

  syncRunning.value = true

  try {
    const response = await executeFolderSync({
      leftRoot: leftRoot.value,
      rightRoot: rightRoot.value,
      strategy: 'updateRight',
      overrides: syncPreviewItems.value.map((item) => ({
        relativePath: item.relativePath,
        action: syncOverrideAction(item),
      })),
    })

    lastSyncAction.value = t('status.syncCompleted', {
      succeeded: response.succeeded,
      failed: response.failed,
    })
    await runFolderCompare()
  } catch (error) {
    lastSyncAction.value = error instanceof Error ? error.message : String(error)
  } finally {
    syncRunning.value = false
  }
}

function closeSyncPreview(): void {
  syncPreviewItems.value = []
  pendingSyncSafetyItems.value = []
}

function navigateFolderDifference(direction: 'next' | 'previous'): void {
  if (differenceRows.value.length === 0) {
    currentDifferenceIndex.value = -1
    lastDifferenceNavigation.value = t('status.noFolderDifferences')

    return
  }

  if (direction === 'next') {
    currentDifferenceIndex.value = (currentDifferenceIndex.value + 1) % differenceRows.value.length
  } else {
    currentDifferenceIndex.value =
      (currentDifferenceIndex.value - 1 + differenceRows.value.length) % differenceRows.value.length
  }

  const row = differenceRows.value[currentDifferenceIndex.value]

  selectedRowId.value = row.id
  lastDifferenceNavigation.value = t('status.folderDifferencePosition', {
    index: currentDifferenceIndex.value + 1,
    total: differenceRows.value.length,
    name: displayName(row),
  })
}

const rowContextMenu = ref<{ x: number; y: number; rowId: string }>()
const pathContextMenu = ref<{ x: number; y: number; side: 'left' | 'right' }>()

async function browseFolder(side: 'left' | 'right'): Promise<void> {
  const profileId = side === 'left' ? selectedLeftProfileId.value : selectedRightProfileId.value
  const currentRoot = side === 'left' ? leftRoot.value : rightRoot.value
  const profile = remoteProfiles.value.find((item) => item.id === profileId)
  const parsed = parseRemoteUri(currentRoot)

  if (isTauriRuntime() && profile && isImplementedRemoteProtocol(profile.protocol)) {
    openRemoteFolderBrowser(side, profile, firstRemotePath(profile.rootPath, parsed?.remotePath))

    return
  }

  if (isTauriRuntime() && parsed) {
    const matched = remoteProfiles.value.find((item) => item.id === parsed.profileRef)

    if (matched && isImplementedRemoteProtocol(matched.protocol)) {
      openRemoteFolderBrowser(side, matched, firstRemotePath(parsed.remotePath, matched.rootPath))

      return
    }
  }

  const selected = await pickNativePath({ directory: true })

  if (!selected) {
    return
  }

  if (side === 'left') {
    leftRoot.value = selected
  } else {
    rightRoot.value = selected
  }

  recordFolderPathCommit()
}

function upOneFolderLevel(): void {
  const nextLeft = parentDirectoryPath(leftRoot.value)
  const nextRight = parentDirectoryPath(rightRoot.value)
  let changed = false

  if (nextLeft) {
    leftRoot.value = nextLeft
    changed = true
  }

  if (nextRight) {
    rightRoot.value = nextRight
    changed = true
  }

  if (changed) {
    recordFolderPathCommit()
  }
}

function firstRemotePath(...candidates: (string | undefined)[]): string {
  for (const candidate of candidates) {
    if (candidate && candidate.trim().length > 0) {
      return candidate
    }
  }

  return '/'
}

function openRemoteFolderBrowser(
  side: 'left' | 'right',
  profile: RemoteProfileView,
  initialPath: string,
): void {
  remoteBrowseSide.value = side
  remoteBrowseProfileId.value = profile.id
  remoteBrowseProfileLabel.value = profile.name || profile.id
  remoteBrowseInitialPath.value = initialPath || profile.rootPath || '/'
  showRemoteBrowser.value = true
}

function applyRemoteBrowsePath(path: string): void {
  const profile = remoteProfiles.value.find((item) => item.id === remoteBrowseProfileId.value)

  showRemoteBrowser.value = false

  if (!profile) {
    return
  }

  const uri = formatRemoteUri(profile.protocol, profile.id, path || '/')

  if (remoteBrowseSide.value === 'left') {
    selectedLeftProfileId.value = profile.id
    leftRoot.value = uri
  } else {
    selectedRightProfileId.value = profile.id
    rightRoot.value = uri
  }

  syncFolderTabTitle()
  recordFolderPathCommit()
}

function handlePathFieldDrop(event: DragEvent, side: 'left' | 'right'): void {
  event.preventDefault()
  const text = event.dataTransfer?.getData('text/plain').trim()
  const file = event.dataTransfer?.files.item(0) ?? undefined
  const path = text && text.length > 0 ? text : (file?.webkitRelativePath ?? file?.name)

  if (!path) {
    return
  }

  if (side === 'left') {
    leftRoot.value = path
  } else {
    rightRoot.value = path
  }

  recordFolderPathCommit()
}

function openRowContextMenu(event: MouseEvent, row: FolderTreeRow): void {
  event.preventDefault()
  selectRow(row)
  rowContextMenu.value = { x: event.clientX, y: event.clientY, rowId: row.id }
  pathContextMenu.value = undefined
}

function openPathContextMenu(event: MouseEvent, side: 'left' | 'right'): void {
  focusedPathSide.value = side
  event.preventDefault()
  pathContextMenu.value = { x: event.clientX, y: event.clientY, side }
  rowContextMenu.value = undefined
}

function closeContextMenus(): void {
  rowContextMenu.value = undefined
  pathContextMenu.value = undefined
}

async function copyRowPath(): Promise<void> {
  const row = selectedRow.value
  const root = leftRoot.value.length > 0 ? leftRoot.value : rightRoot.value
  const path =
    row?.leftPath ??
    row?.rightPath ??
    (row && root.length > 0 ? folderSidePath(root, row.relativePath) : undefined)

  closeContextMenus()

  if (!path) {
    return
  }

  try {
    await navigator.clipboard.writeText(path)
  } catch {
    // ponytail: ignore clipboard denial
  }
}

function contextOpenSelected(): void {
  closeContextMenus()
  openSelectedFile()
}

function contextCopySelectedTo(direction: 'Left' | 'Right'): void {
  closeContextMenus()
  copySelectedTo(direction)
}

async function runPathMenuAction(action: 'clear' | 'paste'): Promise<void> {
  const side = pathContextMenu.value?.side

  closeContextMenus()

  if (!side) {
    return
  }

  if (action === 'clear') {
    if (side === 'left') {
      leftRoot.value = ''
    } else {
      rightRoot.value = ''
    }

    recordFolderPathCommit()

    return
  }

  try {
    const text = await navigator.clipboard.readText()

    if (!text) {
      return
    }

    if (side === 'left') {
      leftRoot.value = text.trim()
    } else {
      rightRoot.value = text.trim()
    }

    recordFolderPathCommit()
  } catch {
    // ponytail: ignore clipboard denial
  }
}

function handleTreeScroll(event: Event): void {
  scrollTop.value = (event.currentTarget as HTMLElement).scrollTop
}

watch(
  () => settings.watchFoldersForChanges,
  (enabled) => {
    if (folderWatchTimer !== undefined) {
      clearInterval(folderWatchTimer)
      folderWatchTimer = undefined
    }

    if (!enabled) {
      return
    }

    folderWatchTimer = setInterval(() => {
      if (!leftRoot.value || !rightRoot.value || folderCompareLoading.value) {
        return
      }

      void runFolderCompare()
    }, FOLDER_WATCH_REFRESH_MS)
  },
  { immediate: true },
)

onUnmounted(() => {
  window.removeEventListener('click', closeContextMenus)
  if (folderWatchTimer !== undefined) {
    clearInterval(folderWatchTimer)
    folderWatchTimer = undefined
  }
  folderPathNavStore.reset()
  folderMenuSelection.reset()
})
</script>

<template>
  <WorkbenchShell
    :title="$t('ui.folderCompare')"
    :eyebrow="$t('ui.folder')"
    :subtitle="`${leftRoot} -> ${rightRoot}`"
    :inspector-label="$t('ui.folderCompareInspector')"
    :toolbar-commands="folderSessionToolbar"
    toolbar-test-id-prefix="folder-session-toolbar"
    @toolbar-command="runFolderToolbarCommand"
  >
    <template #toolbar>
      <section
        class="folder-filter-chrome"
        data-filters-density="capture-1to1"
        data-filters-align="capture-1to1-residual"
        data-mainbar-row2="capture-1to1-residual"
        data-testid="folder-filter-chrome"
      >
        <div
          class="folder-filter-strip"
          data-testid="folder-filter-strip"
        >
          <span class="folder-filter-strip-label">{{ $t('ui.filters') }}:</span>
          <input
            class="folder-filter-pattern"
            type="text"
            data-testid="folder-filter-pattern"
            spellcheck="false"
            autocomplete="off"
            :value="folderFilterStripPattern"
            :aria-label="$t('ui.filters')"
            @change="onFolderFilterStripChange"
            @keydown.enter.prevent="onFolderFilterStripChange"
          />
          <div
            class="folder-filter-strip-actions"
            data-testid="folder-filter-strip-actions"
          >
            <button
              type="button"
              class="folder-filter-strip-btn"
              :class="{ 'folder-filter-strip-btn-active': showFolderFilters }"
              data-testid="folder-filter-strip-filters"
              :aria-label="$t('ui.filters')"
              :aria-pressed="showFolderFilters ? 'true' : 'false'"
              :title="$t('ui.filters')"
              @click="showFolderFilters = !showFolderFilters"
            >
              <Funnel
                class="folder-filter-strip-icon"
                :size="16"
                :stroke-width="2.25"
                absolute-stroke-width
                aria-hidden="true"
              />
              <span>{{ $t('ui.filters') }}</span>
            </button>
            <button
              type="button"
              class="folder-filter-strip-btn"
              :class="{ 'folder-filter-strip-btn-active': showPeekPanel }"
              data-testid="folder-filter-strip-peek"
              :aria-label="$t('ui.peek')"
              :aria-pressed="showPeekPanel ? 'true' : 'false'"
              :title="$t('ui.peek')"
              @click="showPeekPanel = !showPeekPanel"
            >
              <Eye
                class="folder-filter-strip-icon"
                :size="16"
                :stroke-width="2.25"
                absolute-stroke-width
                aria-hidden="true"
              />
              <span>{{ $t('ui.peek') }}</span>
            </button>
          </div>
        </div>
      </section>
    </template>

    <section class="folder-compare-view">
      <section
        v-show="showFolderFilters"
        class="display-filters"
        data-testid="folder-display-filters"
      >
        <label
          v-for="option in displayStatusOptions"
          :key="option.testId"
        >
          <input
            :data-testid="`toggle-status-${option.testId}`"
            type="checkbox"
            :checked="areStatusesVisible(option.statuses)"
            @change="toggleStatuses(option.statuses, ($event.target as HTMLInputElement).checked)"
          />
          <span>{{ $t(option.labelKey) }}</span>
        </label>
        <label>
          <input
            v-model="showSuppressedFilters"
            data-testid="toggle-suppressed-filters"
            type="checkbox"
          />
          <span>{{ $t('ui.suppressed') }}</span>
        </label>
        <label>
          <input
            v-model="filesOnlyFilter"
            data-testid="toggle-files-only-filter"
            type="checkbox"
          />
          <span>{{ $t('ui.filesOnly') }}</span>
        </label>
      </section>
      <header class="folder-toolbar">
        <div class="path-pair">
          <label>
            <span>{{ $t('ui.leftFolder') }}</span>
            <div class="path-field-row">
              <input
                v-model="leftRoot"
                type="text"
                class="path-input"
                data-testid="folder-left-root"
                autocomplete="off"
                spellcheck="false"
                :title="leftRoot"
                @focus="focusedPathSide = 'left'"
                @dragover.prevent
                @drop="handlePathFieldDrop($event, 'left')"
                @contextmenu="openPathContextMenu($event, 'left')"
                @keydown.enter.prevent="recordFolderPathCommit"
                @change="recordFolderPathCommit"
              />
              <SessionPathActions
                browse-test-id="folder-browse-left"
                archive-test-id="folder-browse-archive-left"
                :show-save="false"
                show-archive
                @browse="browseFolder('left')"
                @archive="browseArchive('left')"
              />
              <span
                v-if="leftSideIsArchive"
                class="archive-side-chip"
                data-testid="folder-left-archive-chip"
                >{{ $t('ui.archiveSide') }}</span
              >
              <span
                v-if="leftSideIsSnapshot"
                class="archive-side-chip"
                data-testid="folder-left-snapshot-chip"
                >{{ $t('ui.snapshotSide') }}</span
              >
            </div>
            <PathMetaFooter
              :stamp="leftFileStamp"
              test-id="folder-left-path-footer"
            />
          </label>
          <label>
            <span>{{ $t('ui.rightFolder') }}</span>
            <div class="path-field-row">
              <input
                v-model="rightRoot"
                type="text"
                class="path-input"
                data-testid="folder-right-root"
                autocomplete="off"
                spellcheck="false"
                :title="rightRoot"
                @focus="focusedPathSide = 'right'"
                @dragover.prevent
                @drop="handlePathFieldDrop($event, 'right')"
                @contextmenu="openPathContextMenu($event, 'right')"
                @keydown.enter.prevent="recordFolderPathCommit"
                @change="recordFolderPathCommit"
              />
              <SessionPathActions
                browse-test-id="folder-browse-right"
                archive-test-id="folder-browse-archive-right"
                :show-save="false"
                show-archive
                @browse="browseFolder('right')"
                @archive="browseArchive('right')"
              />
              <span
                v-if="rightSideIsArchive"
                class="archive-side-chip"
                data-testid="folder-right-archive-chip"
                >{{ $t('ui.archiveSide') }}</span
              >
              <span
                v-if="rightSideIsSnapshot"
                class="archive-side-chip"
                data-testid="folder-right-snapshot-chip"
                >{{ $t('ui.snapshotSide') }}</span
              >
            </div>
            <PathMetaFooter
              :stamp="rightFileStamp"
              test-id="folder-right-path-footer"
            />
          </label>
        </div>

        <div
          v-if="remoteProfiles.length > 0"
          class="path-pair remote-profile-pair"
          data-testid="folder-remote-profile-bar"
        >
          <label>
            <span>{{ $t('ui.remoteProfile') }} ({{ $t('ui.left') }})</span>
            <select
              v-model="selectedLeftProfileId"
              data-testid="folder-left-profile"
              @change="applyRemoteProfile('left', selectedLeftProfileId)"
            >
              <option value="">{{ $t('ui.localPath') }}</option>
              <option
                v-for="profile in remoteProfiles"
                :key="`left-${profile.id}`"
                :value="profile.id"
              >
                {{ profile.name }}
              </option>
            </select>
          </label>
          <label>
            <span>{{ $t('ui.remoteProfile') }} ({{ $t('ui.right') }})</span>
            <select
              v-model="selectedRightProfileId"
              data-testid="folder-right-profile"
              @change="applyRemoteProfile('right', selectedRightProfileId)"
            >
              <option value="">{{ $t('ui.localPath') }}</option>
              <option
                v-for="profile in remoteProfiles"
                :key="`right-${profile.id}`"
                :value="profile.id"
              >
                {{ profile.name }}
              </option>
            </select>
          </label>
        </div>
        <p
          v-if="archiveSessionActive"
          class="archive-session-status"
          data-testid="folder-archive-session-status"
        >
          {{ $t('ui.archiveSessionStatus') }}
        </p>
        <p
          class="archive-path-hint"
          data-testid="folder-path-hint"
        >
          {{ $t('ui.archivePathHint') }}
        </p>
        <fieldset
          v-show="showFolderRules"
          class="folder-criteria"
          data-testid="folder-criteria"
        >
          <legend>{{ $t('ui.folderCriteria') }}</legend>
          <label>
            <input
              v-model="folderCriteria.compareSize"
              data-testid="folder-criteria-size"
              type="checkbox"
            />
            <span>{{ $t('ui.compareBySize') }}</span>
          </label>
          <label>
            <input
              v-model="folderCriteria.compareModifiedTime"
              data-testid="folder-criteria-timestamp"
              type="checkbox"
            />
            <span>{{ $t('ui.compareByTimestamp') }}</span>
          </label>
          <label>
            <input
              v-model="folderCriteria.compareContents"
              data-testid="folder-criteria-contents"
              type="checkbox"
            />
            <span>{{ $t('ui.compareBinaryContents') }}</span>
          </label>
          <label>
            <input
              v-model="folderCriteria.compareCrc"
              data-testid="folder-criteria-crc"
              type="checkbox"
            />
            <span>{{ $t('ui.compareCrc') }}</span>
          </label>
          <label>
            <input
              v-model="folderCriteria.compareAttributes"
              data-testid="folder-criteria-attributes"
              type="checkbox"
            />
            <span>{{ $t('ui.compareAttributes') }}</span>
          </label>
          <label>
            <input
              v-model="folderCriteria.sizeOnlyUnimportant"
              data-testid="folder-criteria-size-only"
              type="checkbox"
            />
            <span>{{ $t('ui.sizeOnlyUnimportant') }}</span>
          </label>
          <label>
            <input
              v-model="folderCriteria.followSymlinks"
              data-testid="folder-criteria-follow-symlinks"
              type="checkbox"
            />
            <span>{{ $t('ui.followSymlinks') }}</span>
          </label>
          <label class="folder-criteria-tolerance">
            <span>{{ $t('ui.timestampToleranceSeconds') }}</span>
            <input
              :value="Math.round((folderCriteria.timestampToleranceMs ?? 0) / 1000)"
              data-testid="folder-criteria-timestamp-tolerance"
              type="number"
              min="0"
              max="86400"
              step="1"
              @input="
                folderCriteria.timestampToleranceMs = Math.max(
                  0,
                  Math.round(Number(($event.target as HTMLInputElement).value) || 0) * 1000,
                )
              "
            />
          </label>
          <label>
            <input
              v-model="folderCriteria.ignoreDaylightSavingHourOffset"
              data-testid="folder-criteria-ignore-dst"
              type="checkbox"
            />
            <span>{{ $t('ui.ignoreDaylightSavingHourOffset') }}</span>
          </label>
          <label>
            <input
              v-model="folderCriteria.caseSensitiveNames"
              data-testid="folder-criteria-case-sensitive-names"
              type="checkbox"
            />
            <span>{{ $t('ui.caseSensitiveNames') }}</span>
          </label>
          <label>
            <input
              v-model="folderCriteria.excludeJunctionPoints"
              data-testid="folder-criteria-exclude-junctions"
              type="checkbox"
            />
            <span>{{ $t('ui.excludeJunctionPoints') }}</span>
          </label>
        </fieldset>
        <button
          type="button"
          data-testid="open-folder-session-settings"
          @click="openFolderSessionSettings"
        >
          {{ $t('ui.sessionSettings') }}
        </button>

        <div class="folder-actions">
          <NButton
            size="small"
            type="primary"
            data-testid="run-folder-compare"
            :disabled="folderCompareLoading || !leftRoot || !rightRoot"
            :loading="folderCompareLoading"
            @click="runFolderCompare"
            >{{ $t('ui.compare') }}</NButton
          >
          <NButton
            v-if="folderCompareLoading"
            size="small"
            secondary
            data-testid="cancel-folder-compare"
            @click="cancelFolderCompare"
            >{{ $t('ui.cancel') }}</NButton
          >
          <NButton
            size="small"
            secondary
            data-testid="refresh-folder-compare"
            :disabled="folderCompareLoading"
            @click="runFolderCompare"
            >{{ $t('ui.refresh') }}</NButton
          >
          <NButton
            size="small"
            secondary
            data-testid="export-folder-html-report"
            :disabled="!leftRoot || !rightRoot"
            @click="exportFolderReport('html')"
            >{{ $t('ui.export') }} {{ $t('ui.html') }}</NButton
          >
          <NButton
            size="small"
            secondary
            data-testid="export-folder-csv-report"
            :disabled="!leftRoot || !rightRoot"
            @click="exportFolderReport('csv')"
            >{{ $t('ui.export') }} {{ $t('ui.csv') }}</NButton
          >
          <NButton
            size="small"
            secondary
            data-testid="export-folder-markdown-report"
            :disabled="!leftRoot || !rightRoot"
            @click="exportFolderReport('markdown')"
            >{{ $t('ui.export') }} {{ $t('ui.markdown') }}</NButton
          >
          <NButton
            size="small"
            secondary
            data-testid="preview-sync-plan"
            :disabled="!leftRoot || !rightRoot"
            @click="previewSyncPlan"
            >{{ $t('ui.previewSync') }}</NButton
          >
          <NButton
            size="small"
            secondary
            data-testid="open-selected-file"
            :disabled="!selectedFilePath"
            @click="openSelectedFile"
            >{{ $t('ui.open') }}</NButton
          >
          <NButton
            size="small"
            secondary
            data-testid="open-with-selected-file"
            :disabled="!selectedFilePath"
            @click="openSelectedWithAssociatedApplication"
            >{{ $t('ui.openWith') }}</NButton
          >
          <NButton
            v-for="application in enabledExternalApplications"
            :key="application.id"
            size="small"
            secondary
            :data-testid="`open-with-custom-${application.id}`"
            :disabled="!selectedFilePath || !application.executable"
            @click="openSelectedWithApplication(application)"
          >
            {{ application.name }}
          </NButton>
          <NButton
            size="small"
            secondary
            data-testid="open-associated-file"
            :disabled="!selectedFilePath"
            @click="openSelectedWithAssociatedApplication"
            >{{ $t('ui.associatedApp') }}</NButton
          >
          <NButton
            size="small"
            secondary
            data-testid="quick-compare-selected-file"
            :disabled="!selectedFilePath"
            @click="quickCompareSelectedFile"
            >{{ $t('ui.quickCompare') }}</NButton
          >
          <NButton
            size="small"
            secondary
            data-testid="compare-to-selected-file"
            :disabled="!selectedFilePath"
            @click="compareSelectedFileToCounterpart"
            >{{ $t('ui.compareTo') }}</NButton
          >
          <NButton
            size="small"
            secondary
            data-testid="copy-selected-to-left"
            :disabled="!canCopyToLeft"
            @click="copySelectedTo('Left')"
            >{{ $t('ui.copyLeft') }}</NButton
          >
          <NButton
            size="small"
            secondary
            data-testid="copy-selected-to-right"
            :disabled="!canCopyToRight"
            @click="copySelectedTo('Right')"
            >{{ $t('ui.copyRight') }}</NButton
          >
          <NButton
            size="small"
            secondary
            data-testid="copy-selected-to-side"
            :disabled="!selectedEntryPath"
            @click="copySelectedToSide()"
            >{{ $t('ui.copyToSide') }}</NButton
          >
          <NButton
            size="small"
            secondary
            data-testid="move-selected-to-side"
            :disabled="!selectedEntryPath"
            @click="moveSelectedToSide()"
            >{{ $t('ui.moveToSide') }}</NButton
          >
          <NButton
            size="small"
            secondary
            data-testid="copy-selected-to-folder"
            :disabled="!selectedEntryPath"
            @click="copySelectedToFolder"
            >{{ $t('ui.copyToFolder') }}</NButton
          >
          <NButton
            size="small"
            secondary
            data-testid="move-selected-file"
            :disabled="!selectedEntryPath"
            @click="moveSelectedToFolder"
            >{{ $t('ui.moveToFolder') }}</NButton
          >
          <NButton
            size="small"
            secondary
            data-testid="delete-selected-file"
            :disabled="!selectedEntryPath"
            @click="deleteSelectedFile"
            >{{ $t('ui.deleteAction') }}</NButton
          >
          <NButton
            size="small"
            secondary
            data-testid="rename-selected-file"
            :disabled="!selectedEntryPath"
            @click="renameSelectedFile"
            >{{ $t('ui.renameAction') }}</NButton
          >
          <NButton
            size="small"
            secondary
            data-testid="exclude-selected-row"
            :disabled="!selectedRowId"
            @click="excludeSelectedRow"
            >{{ $t('ui.exclude') }}</NButton
          >
          <NButton
            size="small"
            secondary
            data-testid="refresh-selected-row"
            :disabled="!selectedRowId"
            @click="refreshSelectedRow"
            >{{ $t('ui.refreshSelection') }}</NButton
          >
          <NButton
            size="small"
            secondary
            data-testid="compare-contents-selected"
            :disabled="!selectedFilePath"
            @click="compareContentsSelected"
            >{{ $t('ui.compareContents') }}</NButton
          >
          <NButton
            size="small"
            secondary
            data-testid="synchronize-from-folder"
            :disabled="!leftRoot || !rightRoot"
            @click="synchronizeFromFolderCompare"
            >{{ $t('ui.synchronize') }}</NButton
          >
          <NButton
            size="small"
            secondary
            data-testid="reveal-selected-in-explorer"
            :disabled="!selectedEntryPath"
            @click="revealSelectedInExplorer"
            >{{ $t('ui.explorer') }}</NButton
          >
          <NButton
            size="small"
            secondary
            data-testid="toggle-ignored-selected"
            :disabled="!selectedRowId"
            @click="toggleIgnoredSelected"
            >{{ $t('ui.ignored') }}</NButton
          >
          <NButton
            size="small"
            secondary
            data-testid="file-compare-report"
            :disabled="!canFileCompareReport"
            @click="openFileCompareReportPanel"
            >{{ $t('ui.fileCompareReport') }}</NButton
          >
          <NButton
            size="small"
            secondary
            data-testid="previous-folder-difference"
            :disabled="differenceRows.length === 0"
            @click="navigateFolderDifference('previous')"
            >{{ $t('ui.previousDifference') }}</NButton
          >
          <NButton
            size="small"
            secondary
            data-testid="next-folder-difference"
            :disabled="differenceRows.length === 0"
            @click="navigateFolderDifference('next')"
            >{{ $t('ui.nextDifference') }}</NButton
          >
          <NButton
            size="small"
            secondary
            data-testid="expand-all-folders"
            @click="expandAllFolders"
            >{{ $t('ui.openAll') }}</NButton
          >
          <NButton
            size="small"
            secondary
            data-testid="collapse-all-folders"
            @click="collapseAllFolders"
            >{{ $t('ui.closeAll') }}</NButton
          >
        </div>
      </header>

      <section
        class="folder-root-summary"
        data-testid="folder-root-summary"
      >
        <span>{{ leftRoot }}</span>
        <span>{{ rightRoot }}</span>
      </section>

      <section
        v-if="folderCompareLoading"
        class="folder-action-status folder-compare-progress"
        data-testid="folder-compare-progress"
      >
        <span>{{ $t('status.comparing') }}…</span>
        <button
          type="button"
          data-testid="cancel-folder-compare-banner"
          @click="cancelFolderCompare"
        >
          {{ $t('ui.cancel') }}
        </button>
      </section>

      <section
        v-if="folderCompareError"
        class="folder-action-status"
        data-testid="folder-compare-error"
      >
        {{ folderCompareError }}
      </section>

      <FolderStatusLegend
        v-if="settings.showFolderLegend"
        class="folder-status-legend-slot"
        data-column-legend="capture-1to1-residual"
      />

      <section
        v-show="showSessionInfo"
        class="folder-session-info-panel display-filters"
        data-testid="folder-session-info"
      >
        <h3>{{ $t('ui.folderCompareInfo') }}</h3>
        <dl class="folder-session-info-grid">
          <div>
            <dt>{{ $t('ui.left') }}</dt>
            <dd data-testid="folder-session-info-left">{{ leftRoot || '—' }}</dd>
          </div>
          <div>
            <dt>{{ $t('ui.right') }}</dt>
            <dd data-testid="folder-session-info-right">{{ rightRoot || '—' }}</dd>
          </div>
          <div>
            <dt>{{ $t('ui.sessionInfoTotal') }}</dt>
            <dd data-testid="folder-session-info-total">{{ sessionInfoStats.total }}</dd>
          </div>
          <div>
            <dt>{{ $t('ui.same') }}</dt>
            <dd>{{ sessionInfoStats.same }}</dd>
          </div>
          <div>
            <dt>{{ $t('ui.different') }}</dt>
            <dd>{{ sessionInfoStats.different }}</dd>
          </div>
          <div>
            <dt>{{ $t('ui.orphans') }}</dt>
            <dd>{{ sessionInfoStats.leftOnly + sessionInfoStats.rightOnly }}</dd>
          </div>
        </dl>
        <button
          type="button"
          data-testid="folder-session-info-close"
          @click="showSessionInfo = false"
        >
          {{ $t('ui.close') }}
        </button>
      </section>

      <section
        v-show="showColumnConfig"
        class="column-config"
        data-testid="folder-column-config"
      >
        <label
          v-for="column in configurableColumns"
          :key="column.id"
        >
          <input
            :data-testid="`toggle-column-${column.id}`"
            type="checkbox"
            :checked="isColumnVisible(column.id)"
            @change="toggleColumn(column.id, ($event.target as HTMLInputElement).checked)"
          />
          <span>{{ $t(column.labelKey) }}</span>
        </label>
      </section>

      <section
        v-show="showFolderSelect"
        class="folder-select-panel display-filters"
        data-testid="folder-select-panel"
      >
        <button
          type="button"
          data-testid="folder-select-all"
          @click="selectVisibleAll"
        >
          {{ $t('ui.selectAll') }}
        </button>
        <button
          type="button"
          data-testid="folder-select-all-files"
          @click="selectVisibleFiles"
        >
          {{ $t('ui.selectAllFiles') }}
        </button>
        <button
          type="button"
          data-testid="folder-select-same"
          @click="selectVisibleByStatuses(['Same'], 'ui.same')"
        >
          {{ $t('ui.selectSame') }}
        </button>
        <button
          type="button"
          data-testid="folder-select-different"
          @click="selectVisibleByStatuses(['Different'], 'ui.different')"
        >
          {{ $t('ui.selectDifferent') }}
        </button>
        <button
          type="button"
          data-testid="folder-select-orphans"
          @click="selectVisibleByStatuses(['Left only', 'Right only'], 'ui.orphans')"
        >
          {{ $t('ui.selectOrphans') }}
        </button>
        <button
          type="button"
          data-testid="folder-select-invert"
          @click="invertVisibleSelection"
        >
          {{ $t('ui.invertSelection') }}
        </button>
        <button
          type="button"
          data-testid="folder-select-clear"
          @click="clearVisibleSelection"
        >
          {{ $t('ui.clearSelection') }}
        </button>
        <label class="folder-select-name">
          <span>{{ $t('ui.selectByName') }}</span>
          <input
            v-model="selectNameFilter"
            type="text"
            data-testid="folder-select-name-filter"
            @keydown.enter.prevent="selectVisibleByName"
          />
          <button
            type="button"
            data-testid="folder-select-name-apply"
            @click="selectVisibleByName"
          >
            {{ $t('ui.apply') }}
          </button>
        </label>
        <span
          class="folder-select-count"
          data-testid="folder-select-count"
          >{{ $t('status.checkedRowCount', { count: checkedRowIds.size }) }}</span
        >
      </section>

      <section
        v-show="showPeekPanel"
        class="folder-peek-panel"
        data-peek-density="capture-1to1"
        data-peek-residual="capture-1to1"
        data-testid="folder-peek-panel"
      >
        <header>
          <strong>{{ $t('ui.peekPanel') }}</strong>
          <button
            type="button"
            data-testid="folder-peek-close"
            @click="showPeekPanel = false"
          >
            {{ $t('ui.close') }}
          </button>
        </header>
        <template v-if="selectedRow && selectedRow.kind === 'file'">
          <div
            class="peek-tabs"
            role="tablist"
            data-testid="folder-peek-tabs"
          >
            <button
              type="button"
              class="peek-tab"
              :class="{ 'peek-tab-active': peekTab === 'left' }"
              role="tab"
              data-testid="folder-peek-tab-left"
              :aria-selected="peekTab === 'left' ? 'true' : 'false'"
              @click="peekTab = 'left'"
            >
              {{ $t('ui.left') }}
            </button>
            <button
              type="button"
              class="peek-tab"
              :class="{ 'peek-tab-active': peekTab === 'right' }"
              role="tab"
              data-testid="folder-peek-tab-right"
              :aria-selected="peekTab === 'right' ? 'true' : 'false'"
              @click="peekTab = 'right'"
            >
              {{ $t('ui.right') }}
            </button>
            <button
              type="button"
              class="peek-tab"
              :class="{ 'peek-tab-active': peekTab === 'status' }"
              role="tab"
              data-testid="folder-peek-tab-status"
              :aria-selected="peekTab === 'status' ? 'true' : 'false'"
              @click="peekTab = 'status'"
            >
              {{ $t('ui.status') }}
            </button>
          </div>
          <div
            class="peek-dual-columns"
            data-testid="folder-peek-dual"
          >
            <article
              class="peek-column"
              :class="{ 'peek-column-focus': peekTab === 'left' }"
              data-testid="folder-peek-left-col"
            >
              <strong>{{ $t('ui.left') }}</strong>
              <dl>
                <div>
                  <dt>{{ $t('ui.path') }}</dt>
                  <dd data-testid="folder-peek-left">{{ selectedRow.leftPath || '—' }}</dd>
                </div>
                <div>
                  <dt>{{ $t('ui.size') }}</dt>
                  <dd data-testid="folder-peek-left-size">{{ selectedRow.leftSize || '—' }}</dd>
                </div>
                <div>
                  <dt>{{ $t('ui.modified') }}</dt>
                  <dd data-testid="folder-peek-left-modified">
                    {{ selectedRow.leftModified || '—' }}
                  </dd>
                </div>
              </dl>
            </article>
            <article
              class="peek-column"
              :class="{ 'peek-column-focus': peekTab === 'right' }"
              data-testid="folder-peek-right-col"
            >
              <strong>{{ $t('ui.right') }}</strong>
              <dl>
                <div>
                  <dt>{{ $t('ui.path') }}</dt>
                  <dd data-testid="folder-peek-right">{{ selectedRow.rightPath || '—' }}</dd>
                </div>
                <div>
                  <dt>{{ $t('ui.size') }}</dt>
                  <dd data-testid="folder-peek-right-size">{{ selectedRow.rightSize || '—' }}</dd>
                </div>
                <div>
                  <dt>{{ $t('ui.modified') }}</dt>
                  <dd data-testid="folder-peek-right-modified">
                    {{ selectedRow.rightModified || '—' }}
                  </dd>
                </div>
              </dl>
            </article>
          </div>
          <div
            v-show="peekTab === 'status'"
            class="peek-status-block"
            data-testid="folder-peek-status-block"
          >
            <dl>
              <div>
                <dt>{{ $t('ui.status') }}</dt>
                <dd data-testid="folder-peek-status">{{ selectedRow.status }}</dd>
              </div>
              <div v-if="peekImportancePhrase">
                <dd data-testid="folder-peek-importance">{{ peekImportancePhrase }}</dd>
              </div>
            </dl>
          </div>
          <button
            type="button"
            data-testid="folder-peek-open-compare"
            :disabled="!selectedRow.leftPath || !selectedRow.rightPath"
            @click="openChildCompareForSelected('compare')"
          >
            {{ $t('ui.openPeekCompare') }}
          </button>
        </template>
        <p
          v-else
          data-testid="folder-peek-empty"
        >
          {{ $t('ui.noPeekSelection') }}
        </p>
      </section>

      <section class="folder-summary">
        <div>
          <strong>{{ summary.total }}</strong>
          <span>{{ $t('ui.items') }}</span>
        </div>
        <div>
          <strong>{{ summary.different }}</strong>
          <span>{{ $t('ui.different') }}</span>
        </div>
        <div data-testid="folder-summary-minor">
          <strong>{{ summary.minor }}</strong>
          <span>{{ $t('ui.minor') }}</span>
        </div>
        <div>
          <strong>{{ summary.orphans }}</strong>
          <span>{{ $t('ui.orphans') }}</span>
        </div>
      </section>

      <section
        v-if="syncPreviewItems.length > 0"
        class="sync-preview-panel"
        data-testid="sync-preview-panel"
      >
        <header class="sync-preview-header">
          <div>
            <strong>{{ $t('ui.syncPreview') }}</strong>
            <span>{{ $t('status.operationCount', { count: syncPreviewItems.length }) }}</span>
          </div>
          <NButton
            size="small"
            secondary
            data-testid="close-sync-preview"
            @click="closeSyncPreview"
            >{{ $t('ui.close') }}</NButton
          >
          <NButton
            size="small"
            type="primary"
            data-testid="run-sync-preview"
            :disabled="syncRunning"
            :loading="syncRunning"
            @click="runSyncPreview"
            >{{ $t('ui.runSync') }}</NButton
          >
        </header>
        <section
          v-if="pendingSyncSafetyItems.length > 0"
          class="sync-safety-confirmation"
          data-testid="sync-safety-confirmation"
        >
          <div>
            <strong>{{ $t('ui.confirmRiskySyncActions') }}</strong>
            <span>{{
              $t('status.overwriteDeleteOperationsNeedReview', {
                count: pendingSyncSafetyItems.length,
              })
            }}</span>
          </div>
          <ul>
            <li
              v-for="item in pendingSyncSafetyItems"
              :key="item.id"
            >
              <strong>{{ syncPreviewActionLabel(item.action) }}</strong>
              <span>{{ item.targetPath ?? $t(item.detailKey) }}</span>
            </li>
          </ul>
          <NButton
            size="small"
            type="primary"
            data-testid="confirm-sync-safety"
            @click="confirmSyncSafety"
            >{{ $t('ui.confirmSync') }}</NButton
          >
        </section>
        <div class="sync-preview-table">
          <div class="sync-preview-row sync-preview-row-head">
            <span>{{ $t('ui.action') }}</span>
            <span>{{ $t('ui.source') }}</span>
            <span>{{ $t('ui.target') }}</span>
            <span>{{ $t('ui.detail') }}</span>
            <span>{{ $t('ui.change') }}</span>
          </div>
          <div
            v-for="item in syncPreviewItems"
            :key="item.id"
            class="sync-preview-row"
            :class="`sync-preview-${item.action.toLowerCase()}`"
            :data-preview-id="item.id"
            data-testid="sync-preview-row"
          >
            <strong>{{ syncPreviewActionLabel(item.action) }}</strong>
            <span>{{ item.sourcePath ?? '--' }}</span>
            <span>{{ item.targetPath ?? '--' }}</span>
            <span>{{ $t(item.detailKey) }}</span>
            <span class="sync-preview-change-actions">
              <NButton
                size="tiny"
                secondary
                :data-testid="`sync-preview-leave-${item.id}`"
                @click="markSyncPreviewItemAsLeave(item.id)"
                >{{ $t('ui.leave') }}</NButton
              >
              <NButton
                size="tiny"
                secondary
                :disabled="!item.originalSourcePath || !item.originalTargetPath"
                :data-testid="`sync-preview-reverse-${item.id}`"
                @click="reverseSyncPreviewItem(item.id)"
                >{{ $t('ui.reverse') }}</NButton
              >
            </span>
          </div>
        </div>
      </section>

      <section
        v-if="renamePanelOpen"
        class="folder-operation-panel"
        data-testid="folder-rename-panel"
      >
        <input
          v-model="renameTargetName"
          data-testid="rename-target-name"
        />
        <NButton
          size="small"
          type="primary"
          data-testid="confirm-rename-file"
          @click="confirmRenameFile"
          >{{ $t('ui.rename') }}</NButton
        >
      </section>

      <section
        v-if="sideTransferPanelOpen"
        class="folder-operation-panel"
        data-testid="folder-side-transfer-panel"
      >
        <span>{{ sideTransferMode === 'copy' ? $t('ui.copyToSide') : $t('ui.moveToSide') }}</span>
        <label>
          <input
            v-model="sideTransferDirection"
            type="radio"
            value="Left"
            data-testid="side-transfer-left"
          />
          {{ $t('ui.left') }}
        </label>
        <label>
          <input
            v-model="sideTransferDirection"
            type="radio"
            value="Right"
            data-testid="side-transfer-right"
          />
          {{ $t('ui.right') }}
        </label>
        <NButton
          size="small"
          type="primary"
          data-testid="confirm-side-transfer"
          @click="confirmSideTransfer"
          >{{ $t('ui.apply') }}</NButton
        >
      </section>

      <section
        v-if="newFolderPanelOpen"
        class="folder-operation-panel"
        data-testid="folder-compare-new-folder-panel"
      >
        <input
          v-model="newFolderName"
          data-testid="folder-compare-new-folder-name"
        />
        <NButton
          size="small"
          type="primary"
          data-testid="folder-compare-confirm-new-folder"
          @click="confirmNewFolder"
          >{{ $t('ui.newFolder') }}</NButton
        >
      </section>

      <div
        v-if="fileCompareReportPanelOpen"
        class="file-compare-report-backdrop"
        data-testid="file-compare-report-backdrop"
        @click.self="closeFileCompareReportPanel"
      >
        <section
          class="file-compare-report-panel"
          data-testid="file-compare-report-panel"
          role="dialog"
          aria-modal="true"
          :aria-label="$t('ui.fileCompareReport')"
        >
          <header class="file-compare-report-header">
            <strong>{{ $t('ui.fileCompareReport') }}</strong>
          </header>
          <div class="file-compare-report-body">
            <label class="file-compare-report-row">
              <span>{{ $t('ui.reportFormat') }}</span>
              <select
                v-model="fileCompareReportFormat"
                data-testid="file-compare-report-format"
              >
                <option
                  v-for="format in fileCompareReportFormats"
                  :key="format"
                  :value="format"
                >
                  {{ $t(fileCompareReportFormatLabelKey(format)) }}
                </option>
              </select>
            </label>
            <fieldset class="file-compare-report-scope">
              <legend>{{ $t('ui.reportScope') }}</legend>
              <label>
                <input
                  v-model="fileCompareReportScope"
                  type="radio"
                  value="full"
                  data-testid="file-compare-report-scope-full"
                />
                <span>{{ $t('ui.reportScopeFull') }}</span>
              </label>
              <label>
                <input
                  v-model="fileCompareReportScope"
                  type="radio"
                  value="selection"
                  data-testid="file-compare-report-scope-selection"
                />
                <span>{{ $t('ui.reportScopeSelection') }}</span>
              </label>
            </fieldset>
          </div>
          <footer class="file-compare-report-footer">
            <NButton
              size="tiny"
              secondary
              data-testid="file-compare-report-cancel"
              @click="closeFileCompareReportPanel"
              >{{ $t('ui.cancel') }}</NButton
            >
            <NButton
              size="tiny"
              type="primary"
              data-testid="file-compare-report-save"
              @click="confirmFileCompareReport"
              >{{ $t('ui.saveReport') }}</NButton
            >
          </footer>
        </section>
      </div>

      <section
        v-if="pendingDangerousOperation"
        class="folder-copy-confirmation"
        data-testid="folder-dangerous-confirmation"
      >
        <strong>{{ fileOperationTitle(pendingDangerousOperation) }}</strong>
        <span>{{ $t(pendingDangerousOperation.messageKey) }}</span>
        <span>{{ pendingDangerousOperation.paths.join(', ') }}</span>
        <NButton
          size="small"
          type="primary"
          data-testid="confirm-dangerous-file-operation"
          @click="confirmDangerousFileOperation"
        >
          {{ $t(pendingDangerousOperation.confirmLabelKey) }}
        </NButton>
      </section>

      <section class="folder-operation-panel">
        <label class="metadata-option">
          <input
            data-testid="toggle-selected-readonly"
            type="checkbox"
            :checked="selectedReadonly"
            :disabled="operationEntryPaths().length === 0"
            @change="toggleSelectedReadonly(($event.target as HTMLInputElement).checked)"
          />
          <span>{{ $t('ui.readonly') }}</span>
        </label>
        <NButton
          size="small"
          secondary
          data-testid="touch-selected-file"
          :disabled="!selectedEntryPath"
          @click="touchSelectedFile"
          >{{ $t('ui.touch') }}</NButton
        >
      </section>

      <section
        v-if="pendingCopyConfirmation"
        class="folder-copy-confirmation"
        data-testid="folder-copy-confirmation"
      >
        <strong>{{ fileOperationTitle(pendingCopyConfirmation) }}</strong>
        <span>{{ $t(pendingCopyConfirmation.messageKey) }}</span>
        <span>{{ pendingCopyConfirmation.paths.join(', ') }}</span>
        <NButton
          size="small"
          type="primary"
          data-testid="confirm-folder-copy"
          @click="confirmFolderCopy"
        >
          {{ $t(pendingCopyConfirmation.confirmLabelKey) }}
        </NButton>
      </section>

      <section class="manual-alignment-tools">
        <select
          v-model="alignWithTargetId"
          data-testid="align-with-target"
        >
          <option value="">{{ $t('ui.selectTarget') }}</option>
          <option
            v-for="candidate in alignWithCandidates"
            :key="candidate.id"
            :value="candidate.id"
          >
            {{ displayName(candidate) }}
          </option>
        </select>
        <NButton
          size="small"
          secondary
          data-testid="align-with-selected-file"
          :disabled="!canAlignWith"
          @click="alignSelectedWithTarget"
          >{{ $t('ui.alignWith') }}</NButton
        >
        <NButton
          size="small"
          secondary
          data-testid="break-selected-alignment"
          :disabled="!canBreakAlignment"
          @click="breakSelectedAlignment"
          >{{ $t('ui.breakAlignment') }}</NButton
        >
      </section>

      <section
        v-if="lastAlignmentAction"
        class="folder-action-status"
        data-testid="folder-alignment-action-status"
      >
        {{ lastAlignmentAction }}
      </section>

      <section
        v-if="lastOpenAction"
        class="folder-action-status"
        data-testid="folder-open-action-status"
      >
        {{
          $t('status.fileOpenAction', {
            action: fileOpenActionLabel(lastOpenAction),
            path: lastOpenAction.path,
          })
        }}
      </section>
      <section
        v-if="lastCompareAction"
        class="folder-action-status"
        data-testid="folder-compare-action-status"
      >
        {{ lastCompareAction }}
      </section>
      <section
        v-if="reportStatus"
        class="folder-action-status"
        data-testid="folder-report-status"
      >
        {{ reportStatus }}
      </section>
      <section
        v-if="lastCopyAction"
        class="folder-action-status"
        data-testid="folder-copy-action-status"
      >
        {{ lastCopyAction }}
      </section>
      <section
        v-if="lastFileOperationAction"
        class="folder-action-status"
        data-testid="folder-file-operation-status"
      >
        {{ lastFileOperationAction }}
      </section>
      <section
        v-if="lastMetadataAction"
        class="folder-action-status"
        data-testid="folder-metadata-operation-status"
      >
        {{ lastMetadataAction }}
      </section>
      <section
        v-if="lastSelectionAction"
        class="folder-action-status"
        data-testid="folder-selection-operation-status"
      >
        {{ lastSelectionAction }}
      </section>
      <section
        v-if="lastDifferenceNavigation"
        class="folder-action-status"
        data-testid="folder-difference-navigation-status"
      >
        {{ lastDifferenceNavigation }}
      </section>
      <section
        v-if="lastSyncAction"
        class="folder-action-status"
        data-testid="folder-sync-action-status"
      >
        {{ lastSyncAction }}
      </section>

      <section
        class="folder-tree-table"
        data-testid="folder-tree-table"
        @scroll="handleTreeScroll"
      >
        <div
          class="tree-head"
          :style="{ gridTemplateColumns }"
        >
          <span>{{ $t('ui.name') }}</span>
          <span
            v-if="isColumnVisible('size')"
            data-column="left-size"
            >{{ $t('ui.size') }}</span
          >
          <span
            v-if="isColumnVisible('modified')"
            data-column="left-modified"
            >{{ $t('ui.modified') }}</span
          >
          <span
            v-if="isColumnVisible('type')"
            data-column="left-type"
            >{{ $t('ui.type') }}</span
          >
          <span>{{ $t('ui.status') }}</span>
          <span>{{ $t('ui.name') }}</span>
          <span
            v-if="isColumnVisible('size')"
            data-column="right-size"
            >{{ $t('ui.size') }}</span
          >
          <span
            v-if="isColumnVisible('modified')"
            data-column="right-modified"
            >{{ $t('ui.modified') }}</span
          >
          <span
            v-if="isColumnVisible('type')"
            data-column="right-type"
            >{{ $t('ui.type') }}</span
          >
        </div>
        <div
          v-if="rows.length === 0 && !folderCompareLoading"
          class="folder-empty-state"
          data-testid="folder-empty-state"
        >
          {{ $t('ui.emptyCompareHint') }}
        </div>
        <div
          v-else-if="rows.length > 0 && visibleRows.length === 0"
          class="folder-empty-state"
          data-testid="folder-filtered-empty"
        >
          {{ $t('ui.noFilteredRows') }}
        </div>
        <div
          class="tree-body"
          data-testid="folder-virtual-spacer"
          :style="{ height: virtualSpacerHeight }"
        >
          <div
            class="tree-window"
            :style="{ transform: virtualOffset }"
          >
            <div
              v-for="row in virtualRows"
              :key="row.id"
              class="tree-row"
              :class="[
                `status-${row.status.toLowerCase().replaceAll(' ', '-')}`,
                row.kind,
                {
                  selected: selectedRowId === row.id,
                  checked: isRowChecked(row.id),
                  suppressed: isSuppressed(row),
                  'status-unimportant': rowLooksUnimportant(row),
                },
              ]"
              :data-unimportant="rowLooksUnimportant(row) ? 'true' : undefined"
              :style="{ gridTemplateColumns }"
              :data-row-id="row.id"
              data-testid="folder-row"
              @click="selectRow(row)"
              @contextmenu="openRowContextMenu($event, row)"
            >
              <span
                class="name-cell left-name"
                :style="{ paddingLeft: rowIndent(row) }"
              >
                <input
                  class="folder-row-check"
                  type="checkbox"
                  :data-testid="`folder-row-check-${row.id}`"
                  :checked="isRowChecked(row.id)"
                  @click.stop
                  @change="toggleCheckedRow(row.id, ($event.target as HTMLInputElement).checked)"
                />
                <button
                  v-if="row.kind === 'directory'"
                  type="button"
                  class="folder-toggle"
                  :data-testid="`toggle-folder-${row.id}`"
                  :aria-expanded="isExpanded(row)"
                  @click.stop="toggleFolder(row)"
                >
                  {{ isExpanded(row) ? '▾' : '▸' }}
                </button>
                {{ sideValue(row, 'left', 'name') }}
                <small
                  v-if="isSuppressed(row)"
                  :data-testid="`suppressed-marker-${row.id}`"
                  >{{ $t('ui.suppressed') }}</small
                >
              </span>
              <span
                v-if="isColumnVisible('size')"
                data-column="left-size"
              >
                {{ sideValue(row, 'left', 'size') }}
              </span>
              <span
                v-if="isColumnVisible('modified')"
                data-column="left-modified"
              >
                {{ sideValue(row, 'left', 'modified') }}
              </span>
              <span
                v-if="isColumnVisible('type')"
                data-column="left-type"
              >
                {{ typeLabel(row) }}
              </span>
              <strong>{{ folderRowStatusLabel(row) }}</strong>
              <span
                class="name-cell"
                :style="{ paddingLeft: rowIndent(row) }"
              >
                {{ sideValue(row, 'right', 'name') }}
              </span>
              <span
                v-if="isColumnVisible('size')"
                data-column="right-size"
              >
                {{ sideValue(row, 'right', 'size') }}
              </span>
              <span
                v-if="isColumnVisible('modified')"
                data-column="right-modified"
              >
                {{ sideValue(row, 'right', 'modified') }}
              </span>
              <span
                v-if="isColumnVisible('type')"
                data-column="right-type"
              >
                {{ typeLabel(row) }}
              </span>
            </div>
          </div>
        </div>
      </section>

      <section
        v-if="showFolderLog"
        class="folder-session-log"
        data-testid="folder-session-log"
        data-log-density="capture-1to1"
      >
        <div
          class="folder-session-log-gutter"
          data-testid="folder-session-log-gutter"
        >
          <button
            type="button"
            class="folder-session-log-gutter-btn"
            data-testid="folder-session-log-settings"
            :title="$t('ui.settings')"
            :aria-label="$t('ui.settings')"
            @click="openFolderSessionSettings"
          >
            <Settings
              :size="14"
              :stroke-width="2"
              absolute-stroke-width
              aria-hidden="true"
            />
          </button>
          <button
            type="button"
            class="folder-session-log-gutter-btn"
            data-testid="folder-session-log-save"
            :title="$t('ui.save')"
            :aria-label="$t('ui.save')"
            @click="saveSessionLog"
          >
            <Save
              :size="14"
              :stroke-width="2"
              absolute-stroke-width
              aria-hidden="true"
            />
          </button>
        </div>
        <div
          class="folder-session-log-body"
          data-testid="folder-session-log-body"
        >
          <p
            v-for="(line, index) in sessionLogLines"
            :key="`${index}-${line}`"
            class="folder-session-log-line"
          >
            {{ line }}
          </p>
        </div>
      </section>
    </section>

    <div
      v-if="rowContextMenu"
      class="in-app-context-menu"
      data-testid="folder-row-context-menu"
      :style="{ left: `${rowContextMenu.x}px`, top: `${rowContextMenu.y}px` }"
      @click.stop
    >
      <button
        type="button"
        data-testid="folder-ctx-copy-path"
        @click="copyRowPath"
      >
        {{ $t('ui.copyPath') }}
      </button>
      <button
        type="button"
        data-testid="folder-ctx-open"
        :disabled="!selectedFilePath"
        @click="contextOpenSelected"
      >
        {{ $t('ui.open') }}
      </button>
      <button
        type="button"
        data-testid="folder-ctx-copy-left"
        :disabled="!canCopyToLeft"
        @click="contextCopySelectedTo('Left')"
      >
        {{ $t('ui.copyLeft') }}
      </button>
      <button
        type="button"
        data-testid="folder-ctx-copy-right"
        :disabled="!canCopyToRight"
        @click="contextCopySelectedTo('Right')"
      >
        {{ $t('ui.copyRight') }}
      </button>
    </div>
    <div
      v-if="pathContextMenu"
      class="in-app-context-menu"
      data-testid="folder-path-context-menu"
      :style="{ left: `${pathContextMenu.x}px`, top: `${pathContextMenu.y}px` }"
      @click.stop
    >
      <button
        type="button"
        @click="runPathMenuAction('clear')"
      >
        {{ $t('ui.clear') }}
      </button>
      <button
        type="button"
        @click="runPathMenuAction('paste')"
      >
        {{ $t('ui.paste') }}
      </button>
    </div>
    <template #inspector>
      <WorkbenchInspector>
        <section class="workbench-inspector-section">
          <h2>{{ $t('ui.selection') }}</h2>
          <dl>
            <div>
              <dt>{{ $t('ui.name') }}</dt>
              <dd>{{ selectedRow ? displayName(selectedRow) : '--' }}</dd>
            </div>
            <div>
              <dt>{{ $t('ui.status') }}</dt>
              <dd :data-tone="selectedRow?.status === 'Different' ? 'modified' : 'default'">
                {{ selectedRow ? folderRowStatusLabel(selectedRow) : '--' }}
              </dd>
            </div>
            <div>
              <dt>{{ $t('ui.left') }}</dt>
              <dd>{{ selectedRow?.leftPath ?? leftRoot }}</dd>
            </div>
            <div>
              <dt>{{ $t('ui.right') }}</dt>
              <dd>{{ selectedRow?.rightPath ?? rightRoot }}</dd>
            </div>
          </dl>
        </section>
        <section class="workbench-inspector-section">
          <h2>{{ $t('ui.change') }}</h2>
          <StatusSummaryGrid
            :items="[
              { label: $t('ui.items'), value: summary.total },
              { label: $t('ui.different'), value: summary.different, tone: 'modified' },
              { label: $t('ui.orphans'), value: summary.orphans, tone: 'deleted' },
              { label: $t('ui.suppressed'), value: excludedRowIds.size },
            ]"
          />
        </section>
        <section class="workbench-inspector-section">
          <h2>{{ $t('ui.jobs') }}</h2>
          <dl>
            <div>
              <dt>{{ $t('ui.compare') }}</dt>
              <dd>{{ folderCompareLoading ? $t('status.running') : $t('status.idle') }}</dd>
            </div>
            <div>
              <dt>{{ $t('ui.syncPreview') }}</dt>
              <dd>{{ $t('status.operationCount', { count: syncPreviewItems.length }) }}</dd>
            </div>
          </dl>
        </section>
      </WorkbenchInspector>
    </template>
    <RemotePathBrowser
      v-if="showRemoteBrowser"
      :profile-id="remoteBrowseProfileId"
      :profile-label="remoteBrowseProfileLabel"
      :initial-path="remoteBrowseInitialPath"
      @select="applyRemoteBrowsePath"
      @cancel="showRemoteBrowser = false"
    />

    <SessionSettingsDialog
      :open="showSessionSettings"
      kind="folder"
      :folder-criteria="folderCriteria"
      :folder-filters="folderNameFilters"
      :text-options="textSettingsPlaceholder"
      @close="showSessionSettings = false"
      @apply="applyFolderSessionSettings"
    />
  </WorkbenchShell>
</template>
<style scoped>
.folder-compare-view {
  display: grid;
  grid-template-rows:
    max-content max-content max-content max-content max-content minmax(0, 1fr)
    max-content;
  gap: 2px;
  height: 100%;
  padding: 2px 4px;
  overflow: hidden;
}

.folder-toolbar {
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  align-content: start;
  align-items: stretch;
  align-self: start;
  gap: 2px;
  height: auto;
  min-height: min-content;
  overflow: visible;
}

.path-pair,
.archive-path-hint,
.folder-criteria,
.folder-actions {
  position: static;
  grid-column: 1;
  width: 100%;
  min-width: 0;
  min-height: min-content;
  margin: 0;
}

.path-pair {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 3px;
  height: auto;
  min-height: min-content;
}

.path-pair label {
  display: grid;
  gap: 1px;
  min-width: 0;
}

.path-pair span {
  color: var(--app-text-muted);
  font-size: 11px;
}

.archive-side-chip {
  display: inline-flex;
  align-items: center;
  height: 16px;
  padding: 0 4px;
  border: 1px solid var(--app-border);
  border-radius: 0;
  background: var(--app-surface-muted);
  color: var(--app-text-muted);
  font-size: 11px;
  white-space: nowrap;
}

.archive-session-status {
  margin: 4px 0;
  padding: 2px 4px;
  border-radius: 0;
  background: var(--app-surface-muted);
  color: var(--app-text-muted);
  font-size: 11px;
  line-height: 14px;
}

.archive-path-hint {
  color: var(--app-text-muted);
  font-size: 11px;
  line-height: 1.25;
}

.folder-criteria {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 1px 4px;
  padding: 0;
  border: 0;
  color: var(--app-text-muted);
  font-size: 11px;
}

.folder-criteria legend {
  display: block;
  float: none;
  width: 100%;
  margin: 0 0 1px;
  padding: 0;
  color: var(--app-text);
  font-size: 11px;
  font-weight: 600;
}

.folder-criteria label {
  display: inline-flex;
  align-items: center;
  gap: 2px;
}

.path-pair input {
  width: 100%;
  min-width: 0;
  height: 16.5px;
  padding: 0 4px;
  overflow: hidden;
  border: 1px solid var(--app-border);
  border-radius: 0;
  background: var(--app-surface);
  color: var(--app-text);
  font-size: 12px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.folder-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 2px;
}

.folder-root-summary {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 10px;
  color: var(--app-text-muted);
  font-size: 12px;
}

.folder-root-summary span {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.column-config,
.display-filters,
.manual-alignment-tools {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 2px 6px;
  min-height: 20px;
  padding: 2px 4px;
  font-size: 11px;
}

.folder-filter-chrome {
  display: flex;
  align-items: center;
  gap: 4px 6px;
  min-height: 43.5px;
  padding: 0 4px;
  border-bottom: 1px solid #a0a0a0;
  background: #ffffff;
}

.folder-filter-chrome[data-mainbar-row2='capture-1to1-residual'] {
  min-height: 43.5px;
  background: #ffffff;
}

.folder-filter-strip {
  display: inline-flex;
  flex: 1 1 280px;
  align-items: center;
  gap: 6px;
  min-width: 220px;
  max-width: 640px;
  margin-right: 1px;
}

.folder-filter-strip-actions {
  display: inline-flex;
  flex: 0 0 auto;
  align-items: stretch;
  gap: 0;
}

.folder-filter-strip-btn {
  display: grid;
  grid-template-rows: 20px auto;
  align-content: center;
  justify-items: center;
  box-sizing: border-box;
  width: 59px;
  min-width: 59px;
  max-width: 59px;
  height: 37.5px;
  padding: 1px 2px 2px;
  border: 0;
  border-right: 1px solid #c0c0c0;
  background: transparent;
  color: #1a1a1a;
  font-size: 11px;
  line-height: 12px;
  cursor: default;
}

.folder-filter-strip-btn:first-child {
  border-left: 1px solid #c0c0c0;
}

.folder-filter-strip-btn:hover:not(:disabled) {
  background: #dceeff;
}

.folder-filter-strip-btn-active {
  background: #c8e4ff;
  box-shadow: inset 0 0 0 1px #89bdea;
}

.folder-filter-strip-btn:disabled {
  cursor: default;
  opacity: 0.45;
}

.folder-filter-strip-icon {
  color: #2a3038;
}

.folder-filter-strip-label {
  flex: 0 0 auto;
  color: #111827;
  font-size: 12px;
  white-space: nowrap;
}

.folder-filter-pattern {
  flex: 1 1 180px;
  min-width: 120px;
  height: 19.5px;
  padding: 0 6px;
  border: 1px solid #a0a0a0;
  border-radius: 0;
  background: #ffffff;
  color: #111111;
  font-size: 12px;
  line-height: 18px;
}

.column-config label,
.display-filters label {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  color: var(--app-text-muted);
  font-size: 11px;
}

.manual-alignment-tools {
  align-items: center;
}

.manual-alignment-tools select {
  min-width: 220px;
  height: 20px;
  padding: 0 4px;
  border: 1px solid var(--app-border);
  border-radius: 0;
  background: var(--app-surface);
  color: var(--app-text);
  font-size: 11px;
}

.folder-copy-confirmation {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 2px 4px;
  border: 1px solid var(--app-border);
  border-radius: 0;
  background: var(--app-surface-muted);
  color: var(--app-text-muted);
  font-size: 11px;
}

.folder-copy-confirmation strong {
  color: var(--app-text);
}

.folder-operation-panel {
  display: flex;
  align-items: center;
  gap: 10px;
}

.file-compare-report-backdrop {
  position: fixed;
  inset: 0;
  z-index: 40;
  display: grid;
  place-items: center;
  padding: 4px;
  background: rgb(15 23 42 / 0.35);
}

.file-compare-report-panel {
  display: grid;
  gap: 4px;
  width: min(340px, 100%);
  padding: 4px 6px;
  border: 1px solid var(--app-border);
  border-radius: 2px;
  background: var(--app-surface);
  box-shadow: 0 8px 24px rgb(15 23 42 / 0.16);
  color: var(--app-text);
  font-size: 11px;
}

.file-compare-report-header {
  display: flex;
  align-items: center;
  min-height: 18px;
  margin: 0;
  padding: 0 0 2px;
  border-bottom: 1px solid var(--app-border);
}

.file-compare-report-header strong {
  font-size: 12px;
  font-weight: 600;
  line-height: 16px;
}

.file-compare-report-body {
  display: grid;
  gap: 4px;
  padding: 2px 0;
}

.file-compare-report-row {
  display: grid;
  grid-template-columns: 72px minmax(0, 1fr);
  align-items: center;
  gap: 4px;
  min-height: 20px;
}

.file-compare-report-row span {
  color: var(--app-text-muted);
  font-size: 11px;
  line-height: 14px;
}

.file-compare-report-row select {
  box-sizing: border-box;
  width: 100%;
  height: 20px;
  padding: 0 4px;
  border: 1px solid var(--app-border);
  border-radius: 2px;
  background: var(--app-bg);
  color: var(--app-text);
  font-size: 11px;
}

.file-compare-report-scope {
  display: grid;
  gap: 2px;
  margin: 0;
  padding: 2px 4px;
  border: 1px solid var(--app-border);
  border-radius: 2px;
  background: var(--app-bg);
}

.file-compare-report-scope legend {
  margin: 0;
  padding: 0 2px;
  color: var(--app-text-muted);
  font-size: 10px;
  font-weight: 700;
  line-height: 12px;
}

.file-compare-report-scope label {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  min-height: 18px;
  color: var(--app-text);
  font-size: 11px;
  line-height: 14px;
}

.file-compare-report-scope input {
  width: auto;
  height: auto;
  margin: 0;
  padding: 0;
}

.file-compare-report-footer {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 4px;
  min-height: 20px;
  padding-top: 2px;
  border-top: 1px solid var(--app-border);
}

.file-compare-report-footer :deep(.n-button) {
  --n-height: 20px;
  --n-font-size: 11px;
  --n-padding: 0 8px;
  --n-border-radius: 2px;
}

.folder-operation-panel input {
  width: 260px;
  height: 20px;
  padding: 0 4px;
  border: 1px solid var(--app-border);
  border-radius: 0;
  background: var(--app-surface);
  color: var(--app-text);
  font-size: 11px;
}

.folder-operation-panel .metadata-option {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  color: var(--app-text-muted);
  font-size: 12px;
}

.folder-operation-panel .metadata-option input {
  width: auto;
  height: auto;
  padding: 0;
}

.folder-summary {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 110px));
  gap: 8px;
}

.folder-summary div {
  display: grid;
  gap: 2px;
  min-width: 0;
  padding: 2px 4px;
  overflow: hidden;
  border: 1px solid var(--app-border);
  border-radius: 0;
  background: var(--app-surface);
}

.folder-summary strong,
.folder-summary span {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.folder-summary strong {
  font-size: 14px;
  line-height: 1;
}

.folder-summary span {
  color: var(--app-text-muted);
  font-size: 11px;
}

.folder-action-status {
  padding: 2px 4px;
  border: 1px solid var(--app-border);
  border-radius: 0;
  background: var(--app-surface-muted);
  color: var(--app-text-muted);
  font-size: 11px;
}

.sync-preview-panel {
  display: grid;
  gap: 4px;
  padding: 2px 4px;
  overflow: hidden;
  border: 1px solid var(--app-border);
  border-radius: 0;
  background: var(--app-surface);
}

.sync-preview-header {
  display: flex;
  align-items: center;
  justify-content: end;
  gap: 12px;
}

.sync-preview-header div {
  display: grid;
  gap: 2px;
  margin-right: auto;
}

.sync-preview-header strong {
  font-size: 13px;
}

.sync-preview-header span {
  color: var(--app-text-muted);
  font-size: 12px;
}

.sync-preview-table {
  display: grid;
  overflow: auto;
  border: 1px solid var(--app-border);
  border-radius: 0;
}

.sync-safety-confirmation {
  display: grid;
  grid-template-columns: minmax(180px, 0.8fr) minmax(260px, 1fr) auto;
  align-items: center;
  gap: 6px;
  padding: 2px 4px;
  border: 1px solid var(--diff-deleted-fg);
  border-radius: 0;
  background: var(--app-surface-muted);
}

.sync-safety-confirmation div {
  display: grid;
  gap: 2px;
}

.sync-safety-confirmation strong {
  font-size: 12px;
}

.sync-safety-confirmation span {
  color: var(--app-text-muted);
  font-size: 12px;
}

.sync-safety-confirmation ul {
  display: grid;
  gap: 4px;
  min-width: 0;
  margin: 0;
  padding: 0;
  list-style: none;
}

.sync-safety-confirmation li {
  display: grid;
  grid-template-columns: 76px minmax(0, 1fr);
  gap: 8px;
  min-width: 0;
}

.sync-safety-confirmation li span {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.sync-preview-row {
  display: grid;
  grid-template-columns:
    104px minmax(180px, 1fr) minmax(180px, 1fr) minmax(160px, 0.8fr)
    150px;
  min-width: 1010px;
  border-bottom: 1px solid var(--app-border);
  color: var(--app-text);
  font-size: 12px;
}

.sync-preview-row:last-child {
  border-bottom: 0;
}

.sync-preview-row span,
.sync-preview-row strong {
  min-width: 0;
  padding: 1px 4px;
  overflow: hidden;
  border-right: 1px solid var(--app-border);
  text-overflow: ellipsis;
  white-space: nowrap;
}

.sync-preview-row span:last-child {
  border-right: 0;
}

.sync-preview-row-head {
  background: var(--app-surface-muted);
  color: var(--app-text-muted);
  font-weight: 700;
}

.sync-preview-copy strong {
  color: var(--diff-added-fg);
}

.sync-preview-overwrite strong {
  color: var(--diff-modified-fg);
}

.sync-preview-delete strong,
.sync-preview-error strong {
  color: var(--diff-deleted-fg);
}

.sync-preview-leave strong {
  color: var(--app-text-muted);
}

.sync-preview-change-actions {
  display: inline-flex;
  align-items: center;
  gap: 6px;
}

.folder-tree-table {
  position: relative;
  min-height: 0;
  overflow: auto;
  border: 1px solid var(--app-border);
  border-radius: 0;
  background: var(--app-surface);
}

.tree-body {
  position: relative;
}

.tree-window {
  position: absolute;
  inset: 0 0 auto;
}

.tree-head,
.tree-row {
  display: grid;
  min-width: 1040px;
}

.tree-head {
  position: sticky;
  top: 0;
  z-index: 1;
  min-height: 20px;
  border-bottom: 1px solid #a0a0a0;
  background: #f0f0f0;
  color: #000000;
  font-size: 11px;
  font-weight: 400;
  line-height: 16px;
}

.tree-row {
  min-height: 16px;
  border-bottom: 0;
  color: var(--app-text);
  font-size: 11px;
  line-height: 14px;
}

.tree-head span,
.tree-row span,
.tree-row strong {
  min-width: 0;
  padding: 1px 6px;
  overflow: hidden;
  border-right: 1px solid var(--app-border);
  font-size: 11px;
  line-height: 14px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.tree-row.selected {
  background: #a8cdf1;
  outline: 0;
}

.tree-row.suppressed {
  opacity: 0.56;
}

.tree-row small {
  margin-left: 4px;
  color: var(--app-text-muted);
  font-size: 10px;
  font-weight: 600;
  line-height: 14px;
}

.tree-row .name-cell {
  display: inline-flex;
  align-items: center;
  gap: 2px;
}

.tree-row.directory .name-cell {
  font-weight: 700;
}

.folder-toggle {
  display: inline-flex;
  flex: none;
  align-items: center;
  justify-content: center;
  width: 14px;
  height: 14px;
  margin: 0;
  padding: 0;
  border: 0;
  background: transparent;
  color: var(--app-text-muted);
  font-size: 10px;
  line-height: 1;
  cursor: pointer;
}

.folder-toggle:focus-visible {
  outline: 1px solid var(--app-accent);
  outline-offset: 1px;
}

.tree-row strong {
  font-size: 11px;
  font-weight: 700;
  text-align: center;
}

.tree-head span[data-column='left-size'],
.tree-head span[data-column='left-modified'],
.tree-head span[data-column='right-size'],
.tree-head span[data-column='right-modified'],
.tree-row span[data-column='left-size'],
.tree-row span[data-column='left-modified'],
.tree-row span[data-column='right-size'],
.tree-row span[data-column='right-modified'] {
  text-align: right;
}

.folder-session-log {
  display: grid;
  grid-template-columns: 22px minmax(0, 1fr);
  height: 96px;
  min-height: 96px;
  overflow: hidden;
  border: 1px solid #c0c0c0;
  border-radius: 0;
  background: #e7e7e7;
}

.folder-session-log-gutter {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;
  padding: 4px 0;
  border-right: 1px solid #c0c0c0;
  background: #d4d4d4;
}

.folder-session-log-gutter-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 16px;
  height: 16px;
  padding: 0;
  border: 0;
  border-radius: 0;
  background: transparent;
  color: #333333;
  cursor: pointer;
}

.folder-session-log-gutter-btn:hover {
  background: #c0c0c0;
}

.folder-session-log-body {
  min-width: 0;
  padding: 2px 6px;
  overflow: auto;
  background: #ffffff;
  color: #000000;
  font-family: 'Segoe UI', 'Microsoft YaHei', sans-serif;
  font-size: 11px;
  line-height: 14px;
}

.folder-session-log-line {
  margin: 0;
  padding: 0;
  white-space: pre;
}

.status-same strong {
  color: var(--diff-added-fg);
}

.status-different strong {
  color: var(--diff-modified-fg);
}

.status-unimportant strong {
  color: var(--diff-modified-fg);
  font-style: italic;
  opacity: 0.85;
}

.status-left-only strong,
.status-right-only strong {
  color: var(--diff-deleted-fg);
}

@media (width <= 1100px) {
  .path-pair {
    grid-template-columns: minmax(0, 1fr);
  }
}

@media (width <= 760px) {
  .folder-toolbar,
  .path-pair,
  .folder-summary {
    grid-template-columns: 1fr;
  }

  .folder-actions {
    justify-content: start;
  }
}

.path-field-row {
  display: flex;
  align-items: center;
  gap: 4px;
}

.path-field-row input,
.path-input {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.path-field-row button:focus-visible {
  outline: 2px solid var(--app-primary, #4aa3ff);
  outline-offset: 1px;
}

.folder-empty-state {
  display: grid;
  place-items: center;
  min-height: 120px;
  padding: 24px;
  color: var(--app-text-muted);
  font-size: 13px;
  text-align: center;
}

.folder-compare-progress {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.folder-compare-progress button {
  height: 18px;
  padding: 0 8px;
  border: 1px solid var(--app-border);
  border-radius: 0;
  background: var(--app-canvas);
  color: var(--app-text);
  cursor: pointer;
}

.folder-compare-progress button:focus-visible {
  outline: 2px solid var(--app-primary, #4aa3ff);
  outline-offset: 1px;
}

.path-field-row button,
.in-app-context-menu button {
  flex: none;
}

.in-app-context-menu {
  position: fixed;
  z-index: 40;
  display: grid;
  min-width: 160px;
  padding: 2px;
  border: 1px solid var(--app-border);
  border-radius: 0;
  background: var(--app-surface);
}

.in-app-context-menu button {
  padding: 2px 4px;
  border: 0;
  background: transparent;
  color: var(--app-text);
  font: inherit;
  text-align: left;
  cursor: pointer;
}

.in-app-context-menu button:hover,
.in-app-context-menu button:focus-visible {
  background: var(--app-surface-muted);
}

.in-app-context-menu button:disabled {
  cursor: default;
  opacity: 0.45;
}

.folder-peek-panel[data-peek-residual='capture-1to1'] {
  border: 1px solid #a0a0a0;
  background: #ffffff;
}

.folder-peek-panel {
  display: grid;
  gap: 0;
  padding: 0;
  border: 1px solid #c9cdd3;
  border-radius: 0;
  background: #ffffff;
  font-size: 11px;
  line-height: 14px;
}

.folder-peek-panel header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 4px;
  min-height: 20px;
  margin: 0;
  padding: 2px 4px;
  border-bottom: 1px solid #dfe3e8;
}

.folder-peek-panel dl {
  display: grid;
  gap: 0;
  margin: 0;
}

.folder-peek-panel dt {
  color: #5a6270;
  font-size: 11px;
  line-height: 14px;
}

.folder-peek-panel dd {
  margin: 0;
  color: #000000;
  font-size: 11px;
  line-height: 14px;
  word-break: break-all;
}

.peek-dual-columns {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
  gap: 0;
  min-height: 0;
}

.peek-column {
  min-width: 0;
  padding: 2px 4px;
  border: 1px solid #dfe3e8;
  background: #fafafa;
}

.peek-column-focus {
  border-color: #89bdea;
  background: #ffffff;
}

.peek-column > strong {
  display: block;
  margin: 0 0 2px;
  color: #1a1a1a;
  font-size: 11px;
  font-weight: 600;
  line-height: 14px;
}

.peek-status-block {
  margin-top: 0;
  padding: 2px 4px 0;
  border-top: 1px solid #dfe3e8;
}

.folder-select-panel {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
}

.folder-select-name {
  display: inline-flex;
  align-items: center;
  gap: 6px;
}

.folder-select-name input {
  width: 140px;
  height: 16px;
  padding: 0 4px;
  border: 1px solid var(--app-border);
  border-radius: 0;
  background: var(--app-bg);
  color: var(--app-text);
}

.folder-select-count {
  color: var(--app-text-muted);
  font-size: 12px;
}

.folder-row-check {
  flex: none;
  width: 12px;
  height: 12px;
  margin: 0 2px 0 0;
}

.tree-row.checked {
  outline: 1px solid rgb(37 99 235 / 0.45);
  background: rgb(37 99 235 / 0.08);
}
</style>
