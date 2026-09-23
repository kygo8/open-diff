<script setup lang="ts">
import { executeFolderSync, previewFolderSync } from '@/api/sync'
import type {
  FolderSyncActionOverride,
  FolderSyncExecutionLog,
  FolderSyncExecutionStatus,
  FolderSyncOverrideAction,
  FolderSyncPreviewAction,
  FolderSyncPreviewRow,
  FolderSyncStrategy,
} from '@/types/sync'
import { computed, onMounted, onUnmounted, ref, watch, watchEffect } from 'vue'
import { useRouter } from 'vue-router'
import WorkbenchShell from '@/components/workbench/WorkbenchShell.vue'
import WorkbenchInspector from '@/components/workbench/WorkbenchInspector.vue'
import { Eye, Funnel, Save, Settings } from '@lucide/vue'
import { createFolderEntry, createFolderSnapshot, pathFileStamp, saveTextFile } from '@/api/diff'
import type { FileStamp } from '@/types/diff'
import { newFolderParentRelativePath, resolveNewFolderPaths } from '@/app/newFolderPath'
import {
  buildFolderSyncReportText,
  defaultFolderSyncReportOutputPath,
} from '@/app/folderSyncReport'
import { loadFolderSyncSessionOptions } from '@/app/folderSyncSessionOptions'
import {
  formatFolderNameFilterStripPattern,
  loadFolderNameFilters,
  parseFolderNameFilterStripPattern,
  saveFolderNameFilters,
  type FolderNameFilters,
} from '@/app/folderNameFilters'
import { folderSnapshotOutputPath } from '@/app/snapshotPath'
import { collectExpandablePrefixes, isPathHiddenByCollapse } from '@/app/folderPathGroups'
import { buildFolderSyncToolbar, pathBaseName, syncPathPairTitle } from '@/app/sessionToolbars'
import { useI18n } from '@/i18n'
import { useTabsStore } from '@/stores/tabs'
import { useSettingsStore } from '@/stores/settings'
import FolderStatusLegend from '@/components/workbench/FolderStatusLegend.vue'
import { useSessionLaunchStore } from '@/stores/sessionLaunch'
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
import { fetchPathVolumeInfo, formatFreeSpaceQuantity } from '@/app/diskFreeSpace'
import { useStatusBarStore } from '@/stores/statusBar'
import { parentDirectoryPath } from '@/app/parentDirectoryPath'
import { pickNativePath } from '@/app/filePicker'
import SessionPathActions from '@/components/workbench/SessionPathActions.vue'
import PathMetaFooter from '@/components/workbench/PathMetaFooter.vue'
import { createChildCompareLaunch } from '@/app/childSession'
import { openPathExternal, revealPathInOs } from '@/api/integration'
import { explorerRevealPath, explorerSelectTargetPath } from '@/app/folderCompareExtraActions'

interface SyncStrategyOption {
  value: FolderSyncStrategy
  labelKey: string
}

interface SyncPreviewRow {
  id: string
  relativePath: string
  action: FolderSyncPreviewAction
  plannedAction: FolderSyncOverrideAction
  overrideAction: FolderSyncOverrideAction
  sourcePath?: string
  targetPath?: string
  detail: string
}

const overrideOptions: { value: FolderSyncOverrideAction; labelKey: string }[] = [
  { value: 'leave', labelKey: 'ui.leaveAlone' },
  { value: 'copyLeftToRight', labelKey: 'ui.copyLeftToRight' },
  { value: 'copyRightToLeft', labelKey: 'ui.copyRightToLeft' },
  { value: 'deleteLeft', labelKey: 'ui.deleteLeft' },
  { value: 'deleteRight', labelKey: 'ui.deleteRight' },
  { value: 'delete', labelKey: 'ui.delete' },
]

const strategyOptions: SyncStrategyOption[] = [
  { value: 'updateRight', labelKey: 'sync.strategy.updateRight' },
  { value: 'updateLeft', labelKey: 'sync.strategy.updateLeft' },
  { value: 'updateBoth', labelKey: 'sync.strategy.updateBoth' },
  { value: 'mirrorRight', labelKey: 'sync.strategy.mirrorRight' },
  { value: 'mirrorLeft', labelKey: 'sync.strategy.mirrorLeft' },
]
const { t } = useI18n()
const statusBar = useStatusBarStore()
const tabs = useTabsStore()
const settings = useSettingsStore()
const router = useRouter()
const sessionLaunch = useSessionLaunchStore()
const viewActions = useViewActionsStore()
const leftPath = ref('')
const rightPath = ref('')
const leftFileStamp = ref<FileStamp | null>(null)
const rightFileStamp = ref<FileStamp | null>(null)

const newFolderPanelOpen = ref(false)
const newFolderName = ref('New Folder')

const folderPathNavStore = useFolderPathNavStore()
const folderMenuSelection = useFolderMenuSelectionStore()
const folderPathNavStack = ref(createFolderPathNavStack<FolderPathPair>())
let applyingFolderPathHistory = false

function currentSyncPathPair(): FolderPathPair {
  return { left: leftPath.value, right: rightPath.value }
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
    currentSyncPathPair(),
    folderPathPairsEqual,
  )
  publishFolderPathNavCapabilities()
}

function applySyncPathPair(pair: FolderPathPair): void {
  applyingFolderPathHistory = true
  leftPath.value = pair.left
  rightPath.value = pair.right
  applyingFolderPathHistory = false
  publishFolderPathNavCapabilities()
}

function goFolderPathBack(): void {
  const result = folderPathNavBack(folderPathNavStack.value)

  if (!result) {
    return
  }

  folderPathNavStack.value = result.stack
  applySyncPathPair(result.entry)
}

function goFolderPathForward(): void {
  const result = folderPathNavForward(folderPathNavStack.value)

  if (!result) {
    return
  }

  folderPathNavStack.value = result.stack
  applySyncPathPair(result.entry)
}

const leftFreeSpaceLabel = ref('')
const rightFreeSpaceLabel = ref('')
const selectedStrategy = ref<FolderSyncStrategy>(loadFolderSyncSessionOptions().strategy)
const previewName = ref('')
const previewLoading = ref(false)
const previewError = ref<string>()
const syncRunning = ref(false)
const syncRunError = ref<string>()
const previewRows = ref<SyncPreviewRow[]>([])
const completedOperations = ref(0)
const syncLogs = ref<string[]>([])
const syncExecutionStatusByPath = ref<Map<string, FolderSyncExecutionStatus>>(new Map())
const planAccepted = ref(false)
const pendingSyncSafetyRows = ref<SyncPreviewRow[]>([])
const syncChromeMessage = ref('')
const collapsedPrefixes = ref<Set<string>>(new Set())
const showSyncFilters = ref(false)
const folderNameFilters = ref<FolderNameFilters>(loadFolderNameFilters())
const folderFilterStripPattern = computed(() =>
  formatFolderNameFilterStripPattern(folderNameFilters.value),
)

function persistFolderNameFilters(): void {
  saveFolderNameFilters({ ...folderNameFilters.value })
}

function onFolderFilterStripChange(event: Event): void {
  folderNameFilters.value = {
    ...folderNameFilters.value,
    include: parseFolderNameFilterStripPattern((event.target as HTMLInputElement).value),
  }
  persistFolderNameFilters()
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

      if (previewLoading.value || syncRunning.value) {
        return
      }

      if (!leftPath.value || !rightPath.value) {
        return
      }

      if (!previewName.value && previewRows.value.length === 0) {
        return
      }

      void previewSync()
    }, 350)
  },
  { deep: true },
)

const showSyncSelect = ref(false)
const showSessionInfo = ref(false)
const checkedRowIds = ref<Set<string>>(new Set())
const showPeek = ref(false)
const peekTab = ref<'path' | 'action' | 'detail'>('path')
const minorOnly = ref(false)
const selectedPeekRowId = ref('')

watch(
  [checkedRowIds, selectedPeekRowId],
  () => {
    folderMenuSelection.setHasSelection(
      checkedRowIds.value.size > 0 || Boolean(selectedPeekRowId.value),
    )
  },
  { immediate: true },
)

watch([leftPath, rightPath], () => {
  folderMenuSelection.setRoots(leftPath.value, rightPath.value)
})
const visibleActions = ref<Set<FolderSyncPreviewAction>>(
  new Set(['Copy', 'Delete', 'Leave', 'Conflict']),
)
const lastSelectionAction = ref('')
const excludedRowIds = ref<Set<string>>(new Set())
const selectNameFilter = ref('')
const showSyncLog = ref(true)
const sessionLogLines = ref<string[]>([])
const syncOpenError = ref('')
const reportStatus = ref('')
const reportError = ref('')

const selectedStrategyLabel = computed(() =>
  t(
    strategyOptions.find((option) => option.value === selectedStrategy.value)?.labelKey ??
      'sync.strategy.updateBoth',
  ),
)
const canRunSync = computed(() => previewRows.value.length > 0 && !syncRunning.value)
const overriddenRowCount = computed(
  () => previewRows.value.filter((row) => row.overrideAction !== row.plannedAction).length,
)
const includedSyncRows = computed(() =>
  previewRows.value.filter((row) => !excludedRowIds.value.has(row.id)),
)
const includedSyncRowCount = computed(() => includedSyncRows.value.length)
const excludedSyncRowCount = computed(() => excludedRowIds.value.size)
const lastIncludedSyncTotal = ref<number | null>(null)
const syncProgressTotal = computed(() => lastIncludedSyncTotal.value ?? includedSyncRowCount.value)
const syncSessionTitle = computed(() => {
  if (leftPath.value && rightPath.value) {
    return syncPathPairTitle(leftPath.value, rightPath.value)
  }

  return t('ui.folderSync')
})
const filteredPreviewRows = computed(() =>
  previewRows.value.filter((row) => {
    if (excludedRowIds.value.has(row.id)) {
      return false
    }

    if (!visibleActions.value.has(row.action)) {
      return false
    }

    if (minorOnly.value) {
      return row.action === 'Leave'
    }

    return true
  }),
)
const visiblePreviewRows = computed(() =>
  filteredPreviewRows.value.filter(
    (row) => !isPathHiddenByCollapse(row.relativePath, collapsedPrefixes.value),
  ),
)
const selectedPeekRow = computed(
  () => previewRows.value.find((row) => row.id === selectedPeekRowId.value) ?? null,
)
const syncSessionToolbar = computed(() =>
  buildFolderSyncToolbar({
    home: true,
    minor: previewRows.value.length > 0,
    expand: previewRows.value.length > 0,
    collapse: previewRows.value.length > 0,
    select: previewRows.value.length > 0,
    refresh: Boolean(leftPath.value && rightPath.value) && !previewLoading.value,
    stop: previewLoading.value || syncRunning.value,
    peek: previewRows.value.length > 0,
    'sync-now': canRunSync.value,
    cancel: previewRows.value.length > 0,
    accept: previewRows.value.length > 0 && !planAccepted.value,
  }).map((item) => ({
    ...item,
    active:
      (item.id === 'minor' && minorOnly.value) ||
      (item.id === 'select' && showSyncSelect.value) ||
      (item.id === 'peek' && showPeek.value) ||
      (item.id === 'sync-now' && syncRunning.value) ||
      (item.id === 'accept' && planAccepted.value) ||
      (item.id === 'stop' && (previewLoading.value || syncRunning.value)),
  })),
)

function goHomeFromSync(): void {
  tabs.openTab({ title: 'Home', titleKey: 'ui.home', route: '/', dirty: false })
  void router.push('/')
}

function expandAllSyncPaths(): void {
  collapsedPrefixes.value = new Set()
}

function collapseAllSyncPaths(): void {
  collapsedPrefixes.value = new Set(
    collectExpandablePrefixes(previewRows.value.map((row) => row.relativePath)),
  )
}

function toggleSyncActionFilter(action: FolderSyncPreviewAction): void {
  const next = new Set(visibleActions.value)

  if (next.has(action)) {
    next.delete(action)
  } else {
    next.add(action)
  }

  visibleActions.value = next
}

function selectVisibleSyncRows(): void {
  checkedRowIds.value = new Set(visiblePreviewRows.value.map((row) => row.id))
  lastSelectionAction.value = t('status.selectedRowCount', {
    count: checkedRowIds.value.size,
    action: t('ui.selectAll'),
  })
}

function clearSyncSelection(): void {
  checkedRowIds.value = new Set()
  lastSelectionAction.value = t('status.selectedRowCount', {
    count: 0,
    action: t('ui.clearSelection'),
  })
}

function invertSyncSelection(): void {
  const next = new Set(checkedRowIds.value)

  for (const row of visiblePreviewRows.value) {
    if (next.has(row.id)) {
      next.delete(row.id)
    } else {
      next.add(row.id)
    }
  }

  checkedRowIds.value = next
  lastSelectionAction.value = t('status.selectedRowCount', {
    count: next.size,
    action: t('ui.invertSelection'),
  })
}

function joinSyncSidePath(root: string, relativePath: string): string {
  const normalizedRoot = root.replaceAll('\\', '/').replace(/\/$/u, '')
  const normalizedRelativePath = relativePath.replaceAll('\\', '/').replace(/^\//u, '')

  if (!normalizedRelativePath) {
    return normalizedRoot
  }

  return `${normalizedRoot}/${normalizedRelativePath}`
}

function syncSelectedRow(): SyncPreviewRow | undefined {
  if (selectedPeekRow.value) {
    return selectedPeekRow.value
  }

  const checked = visiblePreviewRows.value.find((row) => checkedRowIds.value.has(row.id))

  return checked
}

function syncOpenPathForRow(row: SyncPreviewRow): string | undefined {
  if (row.sourcePath) {
    return row.sourcePath
  }

  if (row.targetPath) {
    return row.targetPath
  }

  if (leftPath.value) {
    return joinSyncSidePath(leftPath.value, row.relativePath)
  }

  if (rightPath.value) {
    return joinSyncSidePath(rightPath.value, row.relativePath)
  }

  return undefined
}

function openSyncChildCompare(kind: 'open' | 'quick'): void {
  const row = syncSelectedRow()

  if (!row) {
    return
  }

  const left =
    row.sourcePath ?? (leftPath.value ? joinSyncSidePath(leftPath.value, row.relativePath) : '')
  const right =
    row.targetPath ?? (rightPath.value ? joinSyncSidePath(rightPath.value, row.relativePath) : '')

  if (!left || !right) {
    const single = syncOpenPathForRow(row)

    if (single) {
      void openPathExternal(single)
    }

    return
  }

  const launch = createChildCompareLaunch(left, right)

  if (!launch) {
    return
  }

  lastSelectionAction.value =
    kind === 'quick'
      ? `${t('ui.quickCompare')} -> ${launch.route}`
      : `${t('ui.open')} -> ${launch.route}`
  sessionLaunch.setPendingLaunch(launch)
  tabs.openTab({ title: launch.title, route: launch.route, dirty: false })
  void router.push(launch.route)
}

async function openSyncSelectedWithAssociatedApplication(): Promise<void> {
  const row = syncSelectedRow()
  const path = row ? syncOpenPathForRow(row) : undefined

  if (!path) {
    return
  }

  try {
    await openPathExternal(path)
    lastSelectionAction.value = `${t('ui.openWith')} -> ${path}`
  } catch (error) {
    syncOpenError.value = error instanceof Error ? error.message : String(error)
  }
}

const syncExplorerEntryPath = computed(() => {
  const row = syncSelectedRow()

  return row ? syncOpenPathForRow(row) : undefined
})

async function revealSyncSelectedInExplorer(): Promise<void> {
  const entryPath = syncExplorerEntryPath.value

  if (!entryPath) {
    return
  }

  const selectPath = explorerSelectTargetPath(entryPath)
  const fallbackPath = explorerRevealPath(entryPath, 'file')

  try {
    const result = await revealPathInOs(selectPath)
    const revealedPath = result.selected ? selectPath : result.path || fallbackPath

    lastSelectionAction.value = result.selected
      ? t('status.explorerRevealed', { path: selectPath })
      : t('status.explorerOpenedParent', { path: revealedPath })
  } catch {
    try {
      await openPathExternal(fallbackPath)
      lastSelectionAction.value = t('status.explorerOpenedParent', { path: fallbackPath })
    } catch (fallbackError) {
      syncOpenError.value =
        fallbackError instanceof Error ? fallbackError.message : String(fallbackError)
    }
  }
}

function excludeSyncSelectedRows(): void {
  const targets = new Set<string>()

  for (const row of visiblePreviewRows.value) {
    if (checkedRowIds.value.has(row.id)) {
      targets.add(row.id)
    }
  }

  const selected = syncSelectedRow()

  if (selected) {
    targets.add(selected.id)
  }

  if (targets.size === 0) {
    return
  }

  excludedRowIds.value = new Set([...excludedRowIds.value, ...targets])
  checkedRowIds.value = new Set([...checkedRowIds.value].filter((id) => !targets.has(id)))

  if (selectedPeekRowId.value && targets.has(selectedPeekRowId.value)) {
    selectedPeekRowId.value = ''
  }

  const label = selected?.relativePath ?? String(targets.size)

  lastSelectionAction.value = t('status.excludedPath', { path: label })
}

async function refreshSyncSelection(): Promise<void> {
  await previewSync()
  const row = syncSelectedRow()

  lastSelectionAction.value = row
    ? t('status.refreshedPath', { path: row.relativePath })
    : t('ui.refresh')
}

function selectSyncRowsByName(): void {
  const query = selectNameFilter.value.trim().toLowerCase()

  if (!query) {
    return
  }

  const matches = visiblePreviewRows.value.filter((row) =>
    row.relativePath.toLowerCase().includes(query),
  )

  checkedRowIds.value = new Set(matches.map((row) => row.id))

  if (matches[0]) {
    selectedPeekRowId.value = matches[0].id
  }

  lastSelectionAction.value = t('status.selectedRowCount', {
    count: matches.length,
    action: t('ui.findFilename'),
  })
}

function stepSessionFindFilename(direction: 1 | -1): void {
  const query = selectNameFilter.value.trim().toLowerCase()

  if (!query) {
    openSyncFindFilename()

    return
  }

  const matches = visiblePreviewRows.value.filter((row) =>
    row.relativePath.toLowerCase().includes(query),
  )

  if (matches.length === 0) {
    openSyncFindFilename()

    return
  }

  const currentId = selectedPeekRowId.value
  const index = currentId ? matches.findIndex((row) => row.id === currentId) : -1
  let nextIndex: number

  if (index === -1) {
    nextIndex = direction === 1 ? 0 : matches.length - 1
  } else {
    nextIndex = index + direction
    if (nextIndex < 0) {
      nextIndex = matches.length - 1
    } else if (nextIndex >= matches.length) {
      nextIndex = 0
    }
  }

  const next = matches[nextIndex]

  checkedRowIds.value = new Set([next.id])
  selectedPeekRowId.value = next.id
  lastSelectionAction.value = t('status.selectedRowCount', {
    count: 1,
    action: t('ui.findFilename'),
  })
}

function openSyncFindFilename(): void {
  showSyncSelect.value = true
  selectSyncRowsByName()
}

function toggleSyncLogPanel(): void {
  showSyncLog.value = !showSyncLog.value
}

function toggleSyncRowChecked(rowId: string): void {
  const next = new Set(checkedRowIds.value)

  if (next.has(rowId)) {
    next.delete(rowId)
  } else {
    next.add(rowId)
    selectedPeekRowId.value = rowId
  }

  checkedRowIds.value = next
}

function stopSyncWork(): void {
  syncChromeMessage.value = t('ui.stop')
}

function selectSyncPeekRow(row: SyncPreviewRow): void {
  selectedPeekRowId.value = row.id
  if (!showPeek.value) {
    showPeek.value = true
  }
}

function toggleSyncPeekPanel(): void {
  showPeek.value = !showPeek.value
  if (showPeek.value && !selectedPeekRowId.value && visiblePreviewRows.value[0]) {
    selectedPeekRowId.value = visiblePreviewRows.value[0].id
  }
}

function runSyncToolbarCommand(commandId: string): void {
  switch (commandId) {
    case 'home':
      goHomeFromSync()
      break
    case 'minor':
      minorOnly.value = !minorOnly.value
      break
    case 'expand':
      expandAllSyncPaths()
      break
    case 'collapse':
      collapseAllSyncPaths()
      break
    case 'select':
      showSyncSelect.value = !showSyncSelect.value
      break
    case 'refresh':
      void previewSync()
      break
    case 'stop':
      stopSyncWork()
      break
    case 'peek':
      toggleSyncPeekPanel()
      break
    case 'sync-now':
      void runSync()
      break
    case 'cancel':
      cancelSyncOverrides()
      break
    case 'accept':
      acceptSyncPlan()
      break
    default:
      break
  }
}

onMounted(() => {
  const launch = sessionLaunch.consumeLaunch('/sync/folder')

  if (!launch) {
    return
  }

  leftPath.value = launch.locations.left?.uri ?? leftPath.value
  rightPath.value = launch.locations.right?.uri ?? rightPath.value
  recordFolderPathCommit()

  if (launch.autoRun && launch.locations.left?.uri && launch.locations.right?.uri) {
    void previewSync()
  }
})

onUnmounted(() => {
  if (folderNameFilterRebuildTimer !== undefined) {
    clearTimeout(folderNameFilterRebuildTimer)
    folderNameFilterRebuildTimer = undefined
  }

  folderPathNavStore.reset()
  folderMenuSelection.reset()
})

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

async function previewSync(options?: { keepRunStatus?: boolean }): Promise<void> {
  previewLoading.value = true
  previewError.value = undefined
  appendSessionLog(`${t('ui.username')}:`)
  if (leftPath.value && rightPath.value) {
    appendSessionLog(`Load comparison: ${leftPath.value} <-> ${rightPath.value}`)
  }

  try {
    const response = await previewFolderSync({
      leftRoot: leftPath.value,
      rightRoot: rightPath.value,
      strategy: selectedStrategy.value,
      archiveExtensions: [...settings.archiveExtensions],
      filters: { ...folderNameFilters.value },
    })

    previewName.value = response.name
    previewRows.value = response.rows.map(syncPreviewResponseRowToViewRow)
    leftPath.value = response.leftRoot
    rightPath.value = response.rightRoot
    pendingSyncSafetyRows.value = []
    collapsedPrefixes.value = new Set()
    checkedRowIds.value = new Set()
    excludedRowIds.value = new Set()
    selectedPeekRowId.value = ''
    showPeek.value = false
    minorOnly.value = false
    lastSelectionAction.value = ''
    syncOpenError.value = ''
    reportStatus.value = ''
    reportError.value = ''

    if (!options?.keepRunStatus) {
      completedOperations.value = 0
      syncLogs.value = []
      syncExecutionStatusByPath.value = new Map()
      syncRunError.value = undefined
      planAccepted.value = false
      syncChromeMessage.value = ''
      lastIncludedSyncTotal.value = null
    }
  } catch (error) {
    previewError.value = error instanceof Error ? error.message : String(error)
  } finally {
    previewLoading.value = false
  }
}

function isDeleteOverride(action: FolderSyncOverrideAction): boolean {
  return action === 'deleteLeft' || action === 'deleteRight'
}

function isCopyOverride(action: FolderSyncOverrideAction): boolean {
  return action === 'copyLeftToRight' || action === 'copyRightToLeft'
}

function collectRiskySyncRows(): SyncPreviewRow[] {
  return previewRows.value.filter((row) => {
    if (excludedRowIds.value.has(row.id) || row.overrideAction === 'leave') {
      return false
    }

    if (isDeleteOverride(row.overrideAction) && settings.confirmBeforeSyncDelete) {
      return true
    }

    return isCopyOverride(row.overrideAction) && settings.confirmBeforeSyncOverwrite
  })
}

function syncOverrideActionLabel(action: FolderSyncOverrideAction): string {
  return t(overrideOptions.find((option) => option.value === action)?.labelKey ?? 'ui.leaveAlone')
}

async function runSync(): Promise<void> {
  if (!canRunSync.value) {
    return
  }

  if (!planAccepted.value) {
    acceptSyncPlan()
  }

  const riskyRows = collectRiskySyncRows()

  if (riskyRows.length > 0) {
    pendingSyncSafetyRows.value = riskyRows

    return
  }

  await executeSyncNow()
}

function confirmSyncSafety(): void {
  pendingSyncSafetyRows.value = []
  void executeSyncNow()
}

function cancelSyncSafety(): void {
  pendingSyncSafetyRows.value = []
}

async function executeSyncNow(): Promise<void> {
  if (!canRunSync.value) {
    return
  }

  syncRunning.value = true
  syncRunError.value = undefined

  try {
    const response = await executeFolderSync({
      leftRoot: leftPath.value,
      rightRoot: rightPath.value,
      strategy: selectedStrategy.value,
      overrides: currentOverrides(),
      archiveExtensions: [...settings.archiveExtensions],
    })

    const excludedPaths = new Set(
      previewRows.value
        .filter((row) => excludedRowIds.value.has(row.id))
        .map((row) => row.relativePath),
    )
    const includedLogs = response.logs.filter((log) => !excludedPaths.has(log.relativePath))

    completedOperations.value = includedLogs.length
    lastIncludedSyncTotal.value = includedSyncRowCount.value
    syncLogs.value = includedLogs.map(folderSyncExecutionLogLabel)
    syncExecutionStatusByPath.value = new Map(
      includedLogs.map((log) => [log.relativePath, log.status]),
    )
    syncChromeMessage.value = t('status.syncCompleted', {
      succeeded: response.succeeded,
      failed: response.failed,
    })
    await previewSync({ keepRunStatus: true })
  } catch (error) {
    syncRunError.value = error instanceof Error ? error.message : String(error)
  } finally {
    syncRunning.value = false
  }
}

function currentOverrides(): FolderSyncActionOverride[] {
  return previewRows.value.map((row) => ({
    relativePath: row.relativePath,
    action: excludedRowIds.value.has(row.id) ? 'leave' : row.overrideAction,
  }))
}

function plannedOverride(
  row: FolderSyncPreviewRow,
  leftRoot: string,
  rightRoot: string,
): FolderSyncOverrideAction {
  if (row.action === 'Delete') {
    const target = (row.targetPath ?? '').replaceAll('\\', '/')
    const normalizedLeft = leftRoot.replaceAll('\\', '/')
    const normalizedRight = rightRoot.replaceAll('\\', '/')

    if (leftRoot && target.startsWith(normalizedLeft)) {
      return 'deleteLeft'
    }

    if (rightRoot && target.startsWith(normalizedRight)) {
      return 'deleteRight'
    }

    return 'deleteRight'
  }

  if (row.action === 'Leave' || row.action === 'Conflict') {
    return 'leave'
  }

  const source = row.sourcePath ?? ''

  if (source.startsWith(rightRoot)) {
    return 'copyRightToLeft'
  }

  if (source.startsWith(leftRoot)) {
    return 'copyLeftToRight'
  }

  return 'copyLeftToRight'
}

function folderSyncActionLabel(action: FolderSyncPreviewAction): string {
  const keys: Record<FolderSyncPreviewAction, string> = {
    Conflict: 'ui.conflicts',
    Copy: 'ui.copy',
    Delete: 'ui.delete',
    Leave: 'ui.leave',
  }

  return t(keys[action])
}

function syncPreviewResponseRowToViewRow(row: FolderSyncPreviewRow): SyncPreviewRow {
  const planned = plannedOverride(row, leftPath.value, rightPath.value)

  return {
    id: row.id,
    relativePath: row.relativePath,
    action: row.action,
    plannedAction: planned,
    overrideAction: planned,
    sourcePath: row.sourcePath,
    targetPath: row.targetPath,
    detail: row.detail,
  }
}

function acceptSyncPlan(): void {
  for (const row of previewRows.value) {
    row.overrideAction = row.plannedAction
  }
  planAccepted.value = true
  pendingSyncSafetyRows.value = []
  syncChromeMessage.value = t('status.syncPlanAccepted')
}

function cancelSyncOverrides(): void {
  for (const row of previewRows.value) {
    row.overrideAction = 'leave'
  }
  planAccepted.value = false
  pendingSyncSafetyRows.value = []
  syncChromeMessage.value = t('status.syncPlanCancelled')
}

function resetRowOverride(row: SyncPreviewRow): void {
  row.overrideAction = row.plannedAction
  pendingSyncSafetyRows.value = []
}

function onRowOverrideChange(): void {
  planAccepted.value = false
  pendingSyncSafetyRows.value = []
}

function syncOverrideTargetRows(): SyncPreviewRow[] {
  const checked = visiblePreviewRows.value.filter((row) => checkedRowIds.value.has(row.id))

  if (checked.length > 0) {
    return checked
  }

  const selected = syncSelectedRow()

  return selected ? [selected] : []
}

function applySyncOverrideAction(action: FolderSyncOverrideAction, rows?: SyncPreviewRow[]): void {
  const targets = rows ?? syncOverrideTargetRows()

  if (targets.length === 0 || previewRows.value.length === 0) {
    return
  }

  for (const row of targets) {
    row.overrideAction = action
  }
  pendingSyncSafetyRows.value = []

  const label =
    overrideOptions.find((option) => option.value === action)?.labelKey ?? 'ui.leaveAlone'

  lastSelectionAction.value = t('status.syncOverrideApplied', {
    action: t(label),
    count: targets.length,
  })
}

function applySyncOverrideToAll(): void {
  const selected = syncSelectedRow()

  if (!selected) {
    return
  }

  applySyncOverrideAction(selected.overrideAction, visiblePreviewRows.value)
}

function skipRemainingSyncRows(): void {
  applySyncOverrideAction('leave', visiblePreviewRows.value)
}

function syncConflictRows(): SyncPreviewRow[] {
  return previewRows.value.filter(
    (row) => !excludedRowIds.value.has(row.id) && row.action === 'Conflict',
  )
}

function stepSyncConflict(direction: 1 | -1): void {
  const matches = syncConflictRows()

  if (matches.length === 0) {
    return
  }

  visibleActions.value = new Set(['Conflict'])

  const currentId = selectedPeekRowId.value
  const index = currentId ? matches.findIndex((row) => row.id === currentId) : -1
  let nextIndex: number

  if (index === -1) {
    nextIndex = direction === 1 ? 0 : matches.length - 1
  } else {
    nextIndex = index + direction
    if (nextIndex < 0) {
      nextIndex = matches.length - 1
    } else if (nextIndex >= matches.length) {
      nextIndex = 0
    }
  }

  const next = matches[nextIndex]

  checkedRowIds.value = new Set([next.id])
  selectSyncPeekRow(next)
  lastSelectionAction.value = t('status.selectedRowCount', {
    count: 1,
    action: t('ui.conflicts'),
  })
}

function openNewFolderPanel(): void {
  if (!leftPath.value && !rightPath.value) {
    return
  }

  newFolderName.value = 'New Folder'
  newFolderPanelOpen.value = true
}

async function confirmNewFolder(): Promise<void> {
  const selected = syncSelectedRow()
  const parentRelative = newFolderParentRelativePath({
    selectedRelativePath: selected?.relativePath,
    selectedKind: 'file',
  })
  const paths = resolveNewFolderPaths({
    roots: [leftPath.value, rightPath.value],
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
    lastSelectionAction.value =
      paths.length === 1
        ? t('status.createdFolder', { path: paths[0] })
        : t('status.createdFolders', { count: paths.length })
    newFolderPanelOpen.value = false
    await previewSync()
  } catch (error) {
    syncRunError.value = error instanceof Error ? error.message : String(error)
  }
}

function syncRowExecutionStatus(row: SyncPreviewRow): string {
  return syncExecutionStatusByPath.value.get(row.relativePath) ?? '—'
}

function folderSyncExecutionLogLabel(log: FolderSyncExecutionLog): string {
  if (log.status === 'failed') {
    return `${log.relativePath} -> ${log.error ?? log.status}`
  }

  if (log.action === 'delete') {
    return t('status.deletedPath', { path: log.relativePath })
  }

  if (log.action === 'leave') {
    return `${t('ui.leave')} -> ${log.relativePath}`
  }

  if (log.action === 'conflict') {
    return `${t('ui.conflicts')} -> ${log.relativePath}`
  }

  return t('status.copiedPath', { path: log.relativePath })
}

watch(
  [leftPath, rightPath],
  ([left, right]) => {
    if (left && right) {
      tabs.setTabTitle('/sync/folder', syncPathPairTitle(left, right))
    }

    void refreshSyncFreeSpace()
    void refreshSyncPathStamps()
  },
  { immediate: true },
)

async function refreshSyncFreeSpace(): Promise<void> {
  const [leftInfo, rightInfo] = await Promise.all([
    fetchPathVolumeInfo(leftPath.value),
    fetchPathVolumeInfo(rightPath.value),
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

const syncSelectionLabel = computed(() => {
  const count = checkedRowIds.value.size

  if (count <= 0) {
    return ''
  }

  return t('status.itemsSelected', { count })
})

async function refreshSyncPathStamps(): Promise<void> {
  const [left, right] = await Promise.all([
    leftPath.value ? pathFileStamp(leftPath.value).catch(() => null) : Promise.resolve(null),
    rightPath.value ? pathFileStamp(rightPath.value).catch(() => null) : Promise.resolve(null),
  ])

  leftFileStamp.value = left
  rightFileStamp.value = right
}

watchEffect(() => {
  statusBar.reportStatus({
    comparisonStatus: previewRows.value.length > 0 ? t('status.compared') : t('status.readyIdle'),
    differenceCount: includedSyncRowCount.value > 0 ? includedSyncRowCount.value : null,
    filterStatus: t('status.allRows'),
    source: 'folder-sync',
    chromeKind: 'folder-pair',
    leftSelection: syncSelectionLabel.value || null,
    leftFreeSpace: leftFreeSpaceLabel.value || null,
    rightSelection: syncSelectionLabel.value || null,
    rightFreeSpace: rightFreeSpaceLabel.value || null,
  })
})

function swapSyncPaths(): void {
  const nextLeft = rightPath.value

  rightPath.value = leftPath.value
  leftPath.value = nextLeft
  recordFolderPathCommit()
}

async function exportFolderSyncReport(): Promise<void> {
  if (previewRows.value.length === 0) {
    return
  }

  const summary = {
    total: previewRows.value.length,
    copy: previewRows.value.filter((row) => row.action === 'Copy').length,
    delete: previewRows.value.filter((row) => row.action === 'Delete').length,
    leave: previewRows.value.filter((row) => row.action === 'Leave').length,
    conflict: previewRows.value.filter((row) => row.action === 'Conflict').length,
    overridden: previewRows.value.filter((row) => row.overrideAction !== row.plannedAction).length,
  }
  const payload = buildFolderSyncReportText({
    leftPath: leftPath.value,
    rightPath: rightPath.value,
    strategy: selectedStrategy.value,
    planName: previewName.value,
    summary,
    rows: previewRows.value.map((row) => ({
      path: row.relativePath,
      action: row.action,
      planned: row.plannedAction,
      override: row.overrideAction,
      detail: row.detail,
    })),
  })
  const reportPath = defaultFolderSyncReportOutputPath(leftPath.value)

  try {
    await navigator.clipboard.writeText(payload)
  } catch {
    // Clipboard may be unavailable in headless tests; still try file export.
  }

  try {
    await saveTextFile({
      path: reportPath,
      text: payload,
      createBackup: settings.createBackupOnReportExport,
      backupRetention: settings.backupRetentionCount,
    })
    reportStatus.value = reportPath
    reportError.value = ''
  } catch (event) {
    reportError.value = String(event)
  }
}

async function saveSyncFolderSnapshot(): Promise<void> {
  const sourceRoot = leftPath.value.trim()

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
  } catch {
    // ponytail: folder sync snapshot best-effort
  }
}

async function browseSyncFolderSide(side: 'left' | 'right'): Promise<void> {
  const selected = await pickNativePath({ directory: true })

  if (!selected) {
    return
  }

  if (side === 'left') {
    leftPath.value = selected
  } else {
    rightPath.value = selected
  }

  recordFolderPathCommit()
}

async function browseSyncFolder(): Promise<void> {
  const selected = await pickNativePath({ directory: true })

  if (!selected) {
    return
  }

  leftPath.value = selected
  recordFolderPathCommit()
}

function upOneSyncLevel(): void {
  const nextLeft = parentDirectoryPath(leftPath.value)
  const nextRight = parentDirectoryPath(rightPath.value)
  let changed = false

  if (nextLeft) {
    leftPath.value = nextLeft
    changed = true
  }

  if (nextRight) {
    rightPath.value = nextRight
    changed = true
  }

  if (changed) {
    recordFolderPathCommit()
  }
}

watch(
  () => [viewActions.sequence, viewActions.name] as const,
  ([, actionName]) => {
    if (!actionName) {
      return
    }

    switch (actionName) {
      case 'compare':
        void previewSync()
        break
      case 'save-snapshot':
        void saveSyncFolderSnapshot()
        break
      case 'reload':
        void previewSync()
        break
      case 'swap':
        swapSyncPaths()
        break
      case 'save':
        void runSync()
        break
      case 'sync-now':
        void runSync()
        break
      case 'browse-folder':
        void browseSyncFolder()
        break
      case 'up-one-level':
        upOneSyncLevel()
        break
      case 'path-back':
        goFolderPathBack()
        break
      case 'path-forward':
        goFolderPathForward()
        break
      case 'toggle-minor':
        minorOnly.value = !minorOnly.value
        break
      case 'expand-all':
        expandAllSyncPaths()
        break
      case 'collapse-all':
        collapseAllSyncPaths()
        break
      case 'about':
      case 'check-for-updates':
      case 'close-tab':
      case 'clear-session':
      case 'copy':
      case 'copy-left':
      case 'copy-right':
      case 'cut':
      case 'delete':
      case 'export':
      case 'save-report':
        void exportFolderSyncReport()
        break
      case 'export-settings':
      case 'filters':
        showSyncFilters.value = !showSyncFilters.value
        break
      case 'help-contents':
      case 'help-context':
      case 'help-support':
      case 'import-settings':
      case 'next-difference':
      case 'paste':
      case 'previous-difference':
      case 'redo':
      case 'restore-factory-defaults':
      case 'rules':
      case 'save-as':
      case 'session-settings':
        showSyncFilters.value = true
        break
      case 'show-all':
        visibleActions.value = new Set(['Copy', 'Delete', 'Leave', 'Conflict'])
        break
      case 'show-differences':
        visibleActions.value = new Set(['Copy', 'Delete', 'Conflict'])
        break
      case 'show-same':
        visibleActions.value = new Set(['Leave'])
        break
      case 'show-orphans':
      case 'show-no-orphans':
      case 'show-differences-no-orphans':
      case 'show-left-orphans':
      case 'show-right-orphans':
      case 'show-left-newer':
      case 'show-right-newer':
      case 'show-left-newer-orphans':
      case 'show-right-newer-orphans':
      case 'only-compare-files':
      case 'compare-files-and-folder-structure':
      case 'ignore-folder-structure':
      case 'always-show-folders':
      case 'show-conflicts':
        visibleActions.value = new Set(['Conflict'])
        break
      case 'show-changes':
      case 'toggle-center-pane':
      case 'compare-to-output':
      case 'suppress-filters':
        break
      case 'compare-parent-folders':
        upOneSyncLevel()
        break
      case 'select-all':
      case 'select-all-files':
        showSyncSelect.value = true
        selectVisibleSyncRows()
        break
      case 'select-orphans':
      case 'select-newer':
        break
      case 'invert-selection':
        showSyncSelect.value = true
        invertSyncSelection()
        break
      case 'open-selected':
        openSyncChildCompare('open')
        break
      case 'open-with':
        void openSyncSelectedWithAssociatedApplication()
        break
      case 'explorer':
        void revealSyncSelectedInExplorer()
        break
      case 'quick-compare':
        openSyncChildCompare('quick')
        break
      case 'exclude-selected':
        excludeSyncSelectedRows()
        break
      case 'refresh-selection':
        void refreshSyncSelection()
        break
      case 'find-filename':
        openSyncFindFilename()
        break
      case 'find-next-filename':
        stepSessionFindFilename(1)
        break
      case 'find-previous-filename':
        stepSessionFindFilename(-1)
        break
      case 'full-refresh':
        void previewSync()
        break
      case 'toggle-log':
        toggleSyncLogPanel()
        break
      case 'toggle-legend':
        break
      case 'session-info':
        showSessionInfo.value = !showSessionInfo.value
        break
      case 'leave-alone':
        applySyncOverrideAction('leave')
        break
      case 'sync-copy-left-to-right':
        applySyncOverrideAction('copyLeftToRight')
        break
      case 'sync-copy-right-to-left':
        applySyncOverrideAction('copyRightToLeft')
        break
      case 'sync-delete-left':
        applySyncOverrideAction('deleteLeft')
        break
      case 'sync-delete-right':
        applySyncOverrideAction('deleteRight')
        break
      case 'new-folder':
        openNewFolderPanel()
        break
      case 'undo':
      case 'workspace-load':
      case 'next-conflict':
        stepSyncConflict(1)
        break
      case 'previous-conflict':
        stepSyncConflict(-1)
        break
      case 'toggle-session-locked':
      case 'workspace-save':
      case 'run-script':
      case 'toggle-columns':
      case 'toggle-toolbar':
      case 'change-attributes':
      case 'merge-execute':
      case 'copy-to-output':
      case 'touch-selected':
      case 'copy-to-side':
      case 'move-to-side':
      case 'copy-to-folder':
      case 'move-to-folder':
      case 'rename-selected':
      case 'compare-contents':
      case 'synchronize':
      case 'ignored':
      case 'align-with':
      case 'break-alignment':
      case 'file-compare-report':
      case 'copy-filename':
        break
    }
  },
)
</script>

<template>
  <WorkbenchShell
    :title="syncSessionTitle"
    :eyebrow="$t('ui.sync')"
    :subtitle="selectedStrategyLabel"
    :inspector-label="$t('ui.folderSyncInspector')"
    :toolbar-commands="syncSessionToolbar"
    toolbar-test-id-prefix="folder-sync-session-toolbar"
    @toolbar-command="runSyncToolbarCommand"
  >
    <FolderStatusLegend
      v-if="settings.showFolderLegend"
      class="folder-status-legend-slot"
    />
    <section class="folder-sync-view">
      <header class="folder-sync-header">
        <div>
          <p class="eyebrow">{{ $t('ui.folderSync') }}</p>
          <h1 data-testid="folder-sync-title">{{ syncSessionTitle }}</h1>
        </div>
        <div
          class="sync-progress"
          data-testid="folder-sync-progress"
        >
          <strong>{{ completedOperations }} / {{ syncProgressTotal }}</strong>
          <span>{{ $t('ui.completed') }}</span>
        </div>
      </header>

      <section
        class="display-filters folder-filter-chrome"
        data-filters-density="capture-1to1"
        data-testid="folder-sync-filter-strip"
      >
        <div class="folder-filter-strip">
          <span class="folder-filter-strip-label">{{ $t('ui.filters') }}:</span>
          <input
            class="folder-filter-pattern"
            type="text"
            data-testid="folder-sync-filter-pattern"
            spellcheck="false"
            autocomplete="off"
            :value="folderFilterStripPattern"
            :aria-label="$t('ui.filters')"
            @change="onFolderFilterStripChange"
            @keydown.enter.prevent="onFolderFilterStripChange"
          />
          <div
            class="folder-filter-strip-actions"
            data-testid="folder-sync-filter-strip-actions"
          >
            <button
              type="button"
              class="folder-filter-strip-btn"
              :class="{ 'folder-filter-strip-btn-active': showSyncFilters }"
              data-testid="folder-sync-filter-strip-filters"
              :aria-label="$t('ui.filters')"
              :aria-pressed="showSyncFilters ? 'true' : 'false'"
              :title="$t('ui.filters')"
              :disabled="previewRows.length === 0"
              @click="showSyncFilters = !showSyncFilters"
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
              :class="{ 'folder-filter-strip-btn-active': showPeek }"
              data-testid="folder-sync-filter-strip-peek"
              :aria-label="$t('ui.peek')"
              :aria-pressed="showPeek ? 'true' : 'false'"
              :title="$t('ui.peek')"
              :disabled="previewRows.length === 0"
              @click="toggleSyncPeekPanel()"
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

      <section class="sync-settings">
        <label>
          <span>{{ $t('ui.leftFolder') }}</span>
          <div class="path-field-row">
            <input
              v-model="leftPath"
              class="path-input"
              data-testid="folder-sync-left-path"
              :title="leftPath"
              @keydown.enter.prevent="recordFolderPathCommit"
              @change="recordFolderPathCommit"
            />
            <SessionPathActions
              browse-test-id="folder-sync-browse-left"
              :show-save="false"
              @browse="browseSyncFolderSide('left')"
            />
          </div>
          <PathMetaFooter
            :stamp="leftFileStamp"
            test-id="folder-sync-left-path-footer"
          />
        </label>
        <label>
          <span>{{ $t('ui.rightFolder') }}</span>
          <div class="path-field-row">
            <input
              v-model="rightPath"
              class="path-input"
              data-testid="folder-sync-right-path"
              :title="rightPath"
              @keydown.enter.prevent="recordFolderPathCommit"
              @change="recordFolderPathCommit"
            />
            <SessionPathActions
              browse-test-id="folder-sync-browse-right"
              :show-save="false"
              @browse="browseSyncFolderSide('right')"
            />
          </div>
          <PathMetaFooter
            :stamp="rightFileStamp"
            test-id="folder-sync-right-path-footer"
          />
        </label>
        <label>
          <span>{{ $t('ui.strategy') }}</span>
          <select
            v-model="selectedStrategy"
            data-testid="folder-sync-strategy"
          >
            <option
              v-for="option in strategyOptions"
              :key="option.value"
              :value="option.value"
            >
              {{ $t(option.labelKey) }}
            </option>
          </select>
        </label>
        <div class="sync-setting-actions">
          <NButton
            size="small"
            secondary
            data-testid="folder-sync-preview"
            :disabled="previewLoading || !leftPath || !rightPath"
            :loading="previewLoading"
            @click="previewSync"
            >{{ $t('ui.preview') }}</NButton
          >
          <NButton
            size="small"
            secondary
            data-testid="folder-sync-accept"
            data-sync-action-density="capture-1to1"
            :disabled="previewRows.length === 0 || syncRunning"
            @click="acceptSyncPlan"
            >{{ $t('ui.accept') }}</NButton
          >
          <NButton
            size="small"
            secondary
            data-testid="folder-sync-cancel"
            :disabled="previewRows.length === 0 || syncRunning"
            @click="cancelSyncOverrides"
            >{{ $t('ui.cancel') }}</NButton
          >
          <NButton
            size="small"
            secondary
            data-testid="folder-sync-apply-to-all"
            :disabled="!syncSelectedRow() || syncRunning"
            @click="applySyncOverrideToAll"
            >{{ $t('ui.apply') }} {{ $t('ui.all') }}</NButton
          >
          <NButton
            size="small"
            secondary
            data-testid="folder-sync-skip-remaining"
            :disabled="previewRows.length === 0 || syncRunning"
            @click="skipRemainingSyncRows"
            >{{ $t('ui.leaveAlone') }}</NButton
          >
          <NButton
            size="small"
            secondary
            data-testid="export-folder-sync-report"
            :disabled="previewRows.length === 0 || syncRunning"
            @click="exportFolderSyncReport"
            >{{ $t('ui.export') }}</NButton
          >
          <span
            v-if="reportStatus"
            data-testid="folder-sync-report-status"
            >{{ reportStatus }}</span
          >
          <span
            v-if="reportError"
            data-testid="folder-sync-report-error"
            >{{ reportError }}</span
          >
          <NButton
            size="small"
            type="primary"
            data-testid="folder-sync-run"
            :disabled="!canRunSync"
            :loading="syncRunning"
            @click="runSync"
            >{{ $t('ui.syncNow') }}</NButton
          >
        </div>
      </section>

      <section
        v-if="previewError"
        class="sync-run-status"
        data-testid="folder-sync-preview-error"
      >
        {{ previewError }}
      </section>

      <section
        v-if="syncRunError"
        class="sync-run-status"
        data-testid="folder-sync-run-error"
      >
        {{ syncRunError }}
      </section>

      <section
        v-if="syncChromeMessage"
        class="sync-run-status"
        data-testid="folder-sync-chrome-status"
      >
        {{ syncChromeMessage }}
        <span v-if="planAccepted">
          · {{ $t('status.overrideCount', { count: overriddenRowCount }) }}</span
        >
      </section>

      <section
        v-if="showSyncFilters && previewRows.length > 0"
        class="sync-chrome-panel"
        data-testid="folder-sync-filters-panel"
      >
        <strong>{{ $t('ui.filters') }}</strong>
        <label
          v-for="action in ['Copy', 'Delete', 'Leave', 'Conflict'] as const"
          :key="action"
        >
          <input
            type="checkbox"
            :checked="visibleActions.has(action)"
            :data-testid="`folder-sync-filter-${action}`"
            @change="toggleSyncActionFilter(action)"
          />
          <span>{{ folderSyncActionLabel(action) }}</span>
        </label>
      </section>

      <section
        v-show="showSessionInfo"
        class="folder-session-info-panel display-filters"
        data-testid="folder-sync-session-info"
      >
        <h3>{{ $t('ui.folderSyncInfo') }}</h3>
        <dl class="folder-session-info-grid">
          <div>
            <dt>{{ $t('ui.left') }}</dt>
            <dd>{{ leftPath || '—' }}</dd>
          </div>
          <div>
            <dt>{{ $t('ui.right') }}</dt>
            <dd>{{ rightPath || '—' }}</dd>
          </div>
          <div>
            <dt>{{ $t('ui.sessionInfoTotal') }}</dt>
            <dd>{{ includedSyncRowCount }}</dd>
          </div>
        </dl>
        <button
          type="button"
          data-testid="folder-sync-session-info-close"
          @click="showSessionInfo = false"
        >
          {{ $t('ui.close') }}
        </button>
      </section>

      <section
        v-if="showSyncSelect && previewRows.length > 0"
        class="sync-chrome-panel"
        data-testid="folder-sync-select-panel"
      >
        <strong>{{ $t('ui.select') }}</strong>
        <button
          type="button"
          data-testid="folder-sync-select-all"
          @click="selectVisibleSyncRows"
        >
          {{ $t('ui.selectAll') }}
        </button>
        <button
          type="button"
          data-testid="folder-sync-select-invert"
          @click="invertSyncSelection"
        >
          {{ $t('ui.invertSelection') }}
        </button>
        <button
          type="button"
          data-testid="folder-sync-select-clear"
          @click="clearSyncSelection"
        >
          {{ $t('ui.clearSelection') }}
        </button>
        <label class="sync-select-name">
          <span>{{ $t('ui.findFilename') }}</span>
          <input
            v-model="selectNameFilter"
            type="text"
            data-testid="folder-sync-find-filename"
            @keydown.enter.prevent="selectSyncRowsByName"
          />
          <button
            type="button"
            data-testid="folder-sync-find-filename-apply"
            @click="selectSyncRowsByName"
          >
            {{ $t('ui.apply') }}
          </button>
        </label>
        <span
          v-if="lastSelectionAction"
          data-testid="folder-sync-selection-status"
          >{{ lastSelectionAction }}</span
        >
      </section>

      <section
        v-if="previewRows.length > 0"
        class="sync-preview"
        data-testid="folder-sync-preview-panel"
      >
        <header>
          <strong>{{ previewName || selectedStrategyLabel }}</strong>
          <span>{{ leftPath }} -> {{ rightPath }}</span>
          <button
            type="button"
            data-testid="reveal-sync-selected-in-explorer"
            :disabled="!syncExplorerEntryPath"
            @click="revealSyncSelectedInExplorer"
          >
            {{ $t('ui.explorer') }}
          </button>
          <em data-testid="folder-sync-accept-state">{{
            planAccepted ? $t('status.syncPlanAccepted') : $t('status.syncPlanPending')
          }}</em>
        </header>
        <section
          v-if="pendingSyncSafetyRows.length > 0"
          class="sync-safety-confirmation"
          data-testid="folder-sync-safety-confirmation"
        >
          <div>
            <strong>{{ $t('ui.confirmRiskySyncActions') }}</strong>
            <span>{{
              $t('status.overwriteDeleteOperationsNeedReview', {
                count: pendingSyncSafetyRows.length,
              })
            }}</span>
            <span
              v-if="excludedSyncRowCount > 0"
              data-testid="folder-sync-excluded-count"
            >
              {{ $t('ui.suppressed') }}: {{ excludedSyncRowCount }}
            </span>
          </div>
          <ul>
            <li
              v-for="row in pendingSyncSafetyRows"
              :key="row.id"
            >
              <strong>{{ syncOverrideActionLabel(row.overrideAction) }}</strong>
              <span>{{ row.targetPath ?? row.relativePath }}</span>
            </li>
          </ul>
          <div class="sync-safety-actions">
            <NButton
              size="small"
              secondary
              data-testid="folder-sync-cancel-safety"
              @click="cancelSyncSafety"
              >{{ $t('ui.cancel') }}</NButton
            >
            <NButton
              size="small"
              type="primary"
              data-testid="folder-sync-confirm-safety"
              @click="confirmSyncSafety"
              >{{ $t('ui.confirmSync') }}</NButton
            >
          </div>
        </section>
        <div class="sync-preview-table">
          <div class="sync-preview-row sync-preview-head">
            <span>{{ $t('ui.select') }}</span>
            <span>{{ $t('ui.plannedAction') }}</span>
            <span>{{ $t('ui.override') }}</span>
            <span>{{ $t('ui.source') }}</span>
            <span>{{ $t('ui.target') }}</span>
            <span>{{ $t('ui.detail') }}</span>
            <span>{{ $t('ui.status') }}</span>
          </div>
          <div
            v-for="row in visiblePreviewRows"
            :key="row.id"
            class="sync-preview-row"
            :class="{
              'sync-row-overridden': row.overrideAction !== row.plannedAction,
              'sync-row-selected': checkedRowIds.has(row.id) || row.id === selectedPeekRowId,
            }"
            :data-testid="`sync-row-${row.id}`"
            @click="selectSyncPeekRow(row)"
          >
            <label class="sync-select-cell">
              <input
                type="checkbox"
                :checked="checkedRowIds.has(row.id)"
                :data-testid="`sync-check-${row.id}`"
                @click.stop
                @change="toggleSyncRowChecked(row.id)"
              />
            </label>
            <span :data-testid="`sync-planned-${row.id}`">{{
              $t(
                overrideOptions.find((option) => option.value === row.plannedAction)?.labelKey ??
                  'ui.leave',
              )
            }}</span>
            <label class="sync-override-cell">
              <span class="sr-only">{{ folderSyncActionLabel(row.action) }}</span>
              <select
                v-model="row.overrideAction"
                :data-testid="`sync-override-${row.id}`"
                @click.stop
                @change="onRowOverrideChange"
              >
                <option
                  v-for="option in overrideOptions"
                  :key="option.value"
                  :value="option.value"
                >
                  {{ $t(option.labelKey) }}
                </option>
              </select>
              <button
                type="button"
                class="sync-reset-override"
                :data-testid="`sync-reset-${row.id}`"
                :disabled="row.overrideAction === row.plannedAction"
                @click.stop="resetRowOverride(row)"
              >
                {{ $t('ui.reset') }}
              </button>
            </label>
            <span>{{ row.sourcePath ?? '--' }}</span>
            <span>{{ row.targetPath ?? '--' }}</span>
            <span>{{ row.detail }}</span>
            <span :data-testid="`sync-row-status-${row.id}`">{{
              syncRowExecutionStatus(row)
            }}</span>
          </div>
        </div>
      </section>

      <section
        v-if="showPeek"
        class="folder-sync-peek-panel"
        data-peek-density="capture-1to1"
        data-testid="folder-sync-peek-panel"
      >
        <header>
          <strong>{{ $t('ui.peekPanel') }}</strong>
          <button
            type="button"
            data-testid="folder-sync-peek-close"
            @click="showPeek = false"
          >
            {{ $t('ui.close') }}
          </button>
        </header>
        <template v-if="selectedPeekRow">
          <div
            class="peek-tabs"
            role="tablist"
            data-testid="folder-sync-peek-tabs"
          >
            <button
              type="button"
              class="peek-tab"
              :class="{ 'peek-tab-active': peekTab === 'path' }"
              role="tab"
              data-testid="folder-sync-peek-tab-path"
              :aria-selected="peekTab === 'path' ? 'true' : 'false'"
              @click="peekTab = 'path'"
            >
              {{ $t('ui.path') }}
            </button>
            <button
              type="button"
              class="peek-tab"
              :class="{ 'peek-tab-active': peekTab === 'action' }"
              role="tab"
              data-testid="folder-sync-peek-tab-action"
              :aria-selected="peekTab === 'action' ? 'true' : 'false'"
              @click="peekTab = 'action'"
            >
              {{ $t('ui.action') }}
            </button>
            <button
              type="button"
              class="peek-tab"
              :class="{ 'peek-tab-active': peekTab === 'detail' }"
              role="tab"
              data-testid="folder-sync-peek-tab-detail"
              :aria-selected="peekTab === 'detail' ? 'true' : 'false'"
              @click="peekTab = 'detail'"
            >
              {{ $t('ui.detail') }}
            </button>
          </div>
          <div
            v-show="peekTab === 'path'"
            class="peek-dual-columns"
            data-testid="folder-sync-peek-dual"
          >
            <article class="peek-column">
              <strong>{{ $t('ui.source') }}</strong>
              <dl>
                <div>
                  <dt>{{ $t('ui.path') }}</dt>
                  <dd data-testid="folder-sync-peek-path">{{ selectedPeekRow.relativePath }}</dd>
                </div>
                <div>
                  <dt>{{ $t('ui.source') }}</dt>
                  <dd data-testid="folder-sync-peek-source">
                    {{ selectedPeekRow.sourcePath ?? '—' }}
                  </dd>
                </div>
              </dl>
            </article>
            <article class="peek-column">
              <strong>{{ $t('ui.target') }}</strong>
              <dl>
                <div>
                  <dt>{{ $t('ui.path') }}</dt>
                  <dd>{{ selectedPeekRow.relativePath }}</dd>
                </div>
                <div>
                  <dt>{{ $t('ui.target') }}</dt>
                  <dd data-testid="folder-sync-peek-target">
                    {{ selectedPeekRow.targetPath ?? '—' }}
                  </dd>
                </div>
              </dl>
            </article>
          </div>
          <dl v-show="peekTab === 'action'">
            <div>
              <dt>{{ $t('ui.plannedAction') }}</dt>
              <dd data-testid="folder-sync-peek-planned">
                {{
                  $t(
                    overrideOptions.find(
                      (option) => option.value === selectedPeekRow?.plannedAction,
                    )?.labelKey ?? 'ui.leave',
                  )
                }}
              </dd>
              <dt>{{ $t('ui.override') }}</dt>
              <dd data-testid="folder-sync-peek-override">
                {{
                  $t(
                    overrideOptions.find(
                      (option) => option.value === selectedPeekRow?.overrideAction,
                    )?.labelKey ?? 'ui.leave',
                  )
                }}
              </dd>
            </div>
          </dl>
          <dl v-show="peekTab === 'detail'">
            <div>
              <dt>{{ $t('ui.detail') }}</dt>
              <dd data-testid="folder-sync-peek-detail">{{ selectedPeekRow.detail }}</dd>
            </div>
          </dl>
        </template>
        <p
          v-else
          data-testid="folder-sync-peek-empty"
        >
          {{ $t('ui.noSelection') }}
        </p>
      </section>

      <section
        v-if="syncOpenError"
        class="folder-action-status"
        data-testid="folder-sync-open-error"
      >
        {{ syncOpenError }}
      </section>

      <section
        v-if="showSyncLog && completedOperations > 0"
        class="sync-run-status"
        data-testid="folder-sync-run-status"
      >
        <strong>{{
          $t('status.completedCount', { count: completedOperations, total: syncProgressTotal })
        }}</strong>
        <ul>
          <li
            v-for="log in syncLogs"
            :key="log"
          >
            {{ log }}
          </li>
        </ul>
      </section>

      <section
        v-if="showSyncLog"
        class="folder-session-log"
        data-testid="folder-sync-session-log"
        data-log-density="capture-1to1"
      >
        <div
          class="folder-session-log-gutter"
          data-testid="folder-sync-session-log-gutter"
        >
          <button
            type="button"
            class="folder-session-log-gutter-btn"
            data-testid="folder-sync-session-log-settings"
            :title="$t('ui.settings')"
            :aria-label="$t('ui.settings')"
            @click="showSyncFilters = true"
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
            data-testid="folder-sync-session-log-save"
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
          data-testid="folder-sync-session-log-body"
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

    <template #inspector>
      <section
        v-if="newFolderPanelOpen"
        class="folder-operation-panel"
        data-testid="folder-sync-new-folder-panel"
      >
        <input
          v-model="newFolderName"
          data-testid="folder-sync-new-folder-name"
        />
        <NButton
          size="small"
          type="primary"
          data-testid="folder-sync-confirm-new-folder"
          @click="confirmNewFolder"
        >
          {{ $t('ui.newFolder') }}
        </NButton>
      </section>

      <WorkbenchInspector>
        <section class="workbench-inspector-section">
          <h2>{{ $t('ui.syncPreview') }}</h2>
          <dl>
            <div>
              <dt>{{ $t('ui.strategy') }}</dt>
              <dd>{{ selectedStrategyLabel }}</dd>
            </div>
            <div>
              <dt>{{ $t('ui.items') }}</dt>
              <dd>{{ includedSyncRowCount }}</dd>
            </div>
            <div>
              <dt>{{ $t('ui.completed') }}</dt>
              <dd>{{ completedOperations }}</dd>
            </div>
            <div>
              <dt>{{ $t('ui.status') }}</dt>
              <dd>
                {{ previewLoading ? $t('status.running') : previewName || selectedStrategyLabel }}
              </dd>
            </div>
          </dl>
        </section>
      </WorkbenchInspector>
    </template>
  </WorkbenchShell>
</template>
<style scoped>
.folder-sync-view {
  display: grid;
  grid-template-rows: max-content max-content max-content minmax(0, 1fr) max-content;
  gap: 2px;
  height: 100%;
  padding: 2px 4px;
  overflow: hidden;
}

.folder-sync-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 8px;
}

.eyebrow {
  margin: 0 0 6px;
  color: var(--app-text-muted);
  font-size: 12px;
  font-weight: 700;
  letter-spacing: 0;
  text-transform: uppercase;
}

h1 {
  margin: 0;
  font-size: 13px;
  line-height: 18px;
  line-height: 1.2;
}

.sync-progress {
  display: grid;
  min-width: 112px;
  padding: 2px 4px;
  border: 1px solid var(--app-border);
  border-radius: 0;
  background: var(--app-surface);
  text-align: right;
}

.sync-progress strong {
  font-size: 18px;
  line-height: 1;
}

.sync-progress span {
  color: var(--app-text-muted);
  font-size: 12px;
}

.path-field-row {
  display: flex;
  align-items: center;
  gap: 4px;
  min-width: 0;
}

.path-field-row input,
.path-field-row .path-input {
  flex: 1;
  min-width: 0;
}

.sync-settings {
  display: grid;
  grid-template-columns: minmax(180px, 1fr) minmax(180px, 1fr) 180px auto;
  align-items: end;
  gap: 2px;
  min-height: 22px;
  padding: 2px 4px;
  border: 1px solid var(--app-border);
  border-radius: 0;
  background: var(--app-surface);
}

.sync-settings label {
  display: grid;
  gap: 2px;
  min-width: 0;
}

.sync-settings span {
  color: var(--app-text-muted);
  font-size: 11px;
}

.sync-settings input,
.sync-settings select {
  width: 100%;
  height: 18px;
  padding: 0 4px;
  border: 1px solid var(--app-border);
  border-radius: 2px;
  background: var(--app-bg);
  color: var(--app-text);
  font-size: 11px;
}

.sync-setting-actions {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 6px;
  min-height: 30px;
}

.sync-setting-actions :deep(.n-button) {
  height: 30px;
  min-height: 30px;
  padding: 0 10px;
  border-radius: 0;
  font-size: 12px;
}

.sync-setting-actions :deep(.n-button[data-testid='folder-sync-run']) {
  height: 48px;
  min-height: 48px;
}

.sync-preview,
.sync-run-status {
  display: grid;
  gap: 2px;
  padding: 2px 4px;
  border: 1px solid var(--app-border);
  border-radius: 0;
  background: var(--app-surface);
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

.sync-safety-actions {
  display: inline-flex;
  gap: 4px;
}

.sync-preview header {
  display: grid;
  gap: 2px;
}

.sync-preview header strong,
.sync-run-status strong {
  font-size: 12px;
  line-height: 16px;
}

.sync-preview header span {
  color: var(--app-text-muted);
  font-size: 11px;
  line-height: 14px;
}

.sync-preview-table {
  display: grid;
  overflow: auto;
  border: 1px solid var(--app-border);
  border-radius: 0;
}

.sync-preview-row {
  display: grid;
  grid-template-columns:
    44px 120px minmax(200px, 1fr) minmax(160px, 1.1fr) minmax(160px, 1.1fr)
    minmax(140px, 0.9fr) 88px;
  min-width: 1048px;
  min-height: 16px;
  border-bottom: 0;
  font-size: 11px;
  line-height: 14px;
}

.sync-row-overridden {
  background: color-mix(in srgb, var(--diff-modified-bg) 55%, transparent);
}

.sync-override-cell {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  align-items: center;
  gap: 4px;
  min-width: 0;
  padding: 2px 6px;
  border-right: 1px solid var(--app-border);
}

.sync-reset-override {
  height: 20px;
  min-height: 20px;
  padding: 0 6px;
  border: 1px solid var(--app-border);
  border-radius: 2px;
  background: var(--app-bg);
  color: var(--app-text);
  font: inherit;
  font-size: 11px;
}

.sync-reset-override:disabled {
  opacity: 0.55;
}

.sync-preview-row label {
  display: grid;
  min-width: 0;
  padding: 2px 6px;
  border-right: 1px solid var(--app-border);
}

.sync-preview-row select {
  width: 100%;
  height: 18px;
  min-height: 18px;
  border: 1px solid var(--app-border);
  border-radius: 2px;
  background: var(--app-bg);
  color: var(--app-text);
  font-size: 11px;
}

.sr-only {
  position: absolute;
  width: 1px;
  height: 1px;
  overflow: hidden;
  clip-path: inset(50%);
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
  font-size: 11px;
  line-height: 16px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.sync-preview-row span:last-child {
  border-right: 0;
}

.sync-preview-head {
  min-height: 20px;
  background: #f0f0f0;
  color: #000000;
  font-weight: 400;
}

.sync-run-status ul {
  display: grid;
  gap: 3px;
  margin: 0;
  padding-left: 18px;
  color: var(--app-text-muted);
  font-size: 11px;
}

@media (width <= 860px) {
  .folder-sync-header,
  .sync-settings {
    grid-template-columns: 1fr;
  }

  .folder-sync-header {
    display: grid;
  }

  .sync-progress {
    text-align: left;
  }
}

.sync-chrome-panel {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 2px 4px;
  min-height: 18px;
  padding: 2px 4px;
  border: 1px solid var(--app-border);
  border-radius: 2px;
  background: var(--app-surface);
}

.sync-chrome-panel label {
  display: inline-flex;
  align-items: center;
  gap: 3px;
  font-size: 11px;
}

.sync-chrome-panel button {
  height: 20px;
  padding: 0 6px;
  border: 1px solid var(--app-border);
  border-radius: 2px;
  background: var(--app-bg);
  color: var(--app-text);
  font-size: 11px;
  cursor: pointer;
}

.sync-select-cell {
  display: flex;
  align-items: center;
}

.sync-row-selected {
  background: #a8cdf1;
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

.folder-sync-peek-panel {
  display: grid;
  gap: 0;
  padding: 0;
  border: 1px solid #c9cdd3;
  border-radius: 0;
  background: #ffffff;
  font-size: 11px;
  line-height: 14px;
}

.folder-sync-peek-panel header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 4px;
  min-height: 20px;
  margin: 0;
  padding: 2px 4px;
  border-bottom: 1px solid #dfe3e8;
}

.folder-sync-peek-panel dl {
  display: grid;
  gap: 0;
  margin: 0;
}

.folder-sync-peek-panel dt {
  color: #5a6270;
  font-size: 11px;
  line-height: 14px;
}

.folder-sync-peek-panel dd {
  margin: 0;
  color: #000000;
  font-size: 11px;
  line-height: 14px;
}

.folder-filter-chrome {
  align-items: center;
  min-height: 38px;
  padding: 0 4px;
  border-bottom: 1px solid #a0a0a0;
  background: #f0f0f0;
}

.folder-filter-strip {
  display: inline-flex;
  flex: 1 1 280px;
  align-items: center;
  gap: 6px;
  min-width: 220px;
  max-width: 640px;
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
  min-width: 48px;
  max-width: 64px;
  height: 38px;
  padding: 1px 4px 2px;
  border: 0;
  border-right: 1px solid #c9cdd3;
  background: transparent;
  color: #1a1a1a;
  font-size: 11px;
  line-height: 12px;
  cursor: default;
}

.folder-filter-strip-btn:first-child {
  border-left: 1px solid #c9cdd3;
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
  flex: 1 1 auto;
  min-width: 0;
  height: 20px;
  padding: 0 6px;
  border: 1px solid #bfc4cc;
  border-radius: 0;
  background: #ffffff;
  color: #111111;
  font-size: 12px;
  line-height: 18px;
}

.peek-dual-columns {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
  gap: 0;
}

.peek-column {
  min-width: 0;
  padding: 2px 4px;
  border: 1px solid #dfe3e8;
  background: #fafafa;
}

.peek-column > strong {
  display: block;
  margin: 0 0 2px;
  color: #1a1a1a;
  font-size: 11px;
  font-weight: 600;
  line-height: 14px;
}
</style>
