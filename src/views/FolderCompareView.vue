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
import { pickNativePath } from '@/app/filePicker'
import { formatCompareError } from '@/app/compareError'
import { loadFolderDisplayFilters, saveFolderDisplayFilters } from '@/app/folderDisplayFilters'
import { buildFolderCompareToolbar, pathPairTitle } from '@/app/sessionToolbars'
import {
  changeFolderEntryAttributes,
  compareFolderPaths,
  copyFolderCompareEntry,
  deleteFolderEntry,
  exportFolderCompareReport,
  moveFolderEntry,
  renameFolderEntry,
  touchFolderEntry,
} from '@/api/diff'
import { openPathExternal } from '@/api/integration'
import { formatRemoteUri, listRemoteProfiles, type RemoteProfileView } from '@/api/remote'
import { loadLocalRemoteProfiles } from '@/app/remoteProfilesLocal'
import type {
  FolderCompareCriteria,
  FolderCompareResponse,
  FolderCompareRow as FolderCompareResponseRow,
  FolderCompareSideEntry,
} from '@/types/diff'
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import WorkbenchShell from '@/components/workbench/WorkbenchShell.vue'
import WorkbenchInspector from '@/components/workbench/WorkbenchInspector.vue'
import StatusSummaryGrid from '@/components/workbench/StatusSummaryGrid.vue'
import { executeFolderSync, previewFolderSync } from '@/api/sync'
import { useI18n } from '@/i18n'
import { useLastCompareStore } from '@/stores/lastCompare'
import { useSessionLaunchStore } from '@/stores/sessionLaunch'
import { useSettingsStore } from '@/stores/settings'
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
  leftModified?: string
  rightModified?: string
  leftPath?: string
  rightPath?: string
  status: FolderStatus
  kind: 'file' | 'directory'
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
const externalApplicationConfigs = ref<ExternalApplicationConfig[]>([
  {
    id: 'vscode',
    name: 'Visual Studio Code',
    executable: 'code',
    enabled: true,
  },
  {
    id: 'text-patch',
    name: 'Text Patch',
    executable: 'open-diff-text-patch',
    enabled: true,
  },
])
const displayStatusOptions: { statuses: FolderStatus[]; labelKey: string; testId: string }[] = [
  { statuses: ['Same'], labelKey: 'ui.same', testId: 'same' },
  { statuses: ['Different'], labelKey: 'ui.different', testId: 'different' },
  { statuses: ['Left only', 'Right only'], labelKey: 'ui.orphans', testId: 'orphans' },
]
const alignWithTargetId = ref('')
const rows = ref<FolderTreeRow[]>([])
const expandedDirectoryIds = ref<Set<string>>(new Set())
const leftRoot = ref('')
const rightRoot = ref('')
const folderCriteria = ref<FolderCompareCriteria>({
  compareSize: true,
  compareModifiedTime: false,
  compareContents: true,
  compareCrc: false,
})
const sessionLaunch = useSessionLaunchStore()
const lastCompare = useLastCompareStore()
const tabs = useTabsStore()
const settings = useSettingsStore()
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
const showFolderRules = ref(true)
const showFolderFilters = ref(true)
let folderCompareGeneration = 0
const rowHeight = 34
const virtualViewportRows = 18
const virtualOverscanRows = 4
const scrollTop = ref(0)
const selectedRowId = ref<string>()
const lastOpenAction = ref<FileOpenAction>()
const lastCompareAction = ref<string>()
const pendingCopyConfirmation = ref<FileOperationConfirmation>()
const pendingCopyDirection = ref<'Left' | 'Right'>()
const lastCopyAction = ref<string>()
const pendingDangerousOperation = ref<FileOperationConfirmation>()
const pendingDangerousOperationLabel = ref('')
const renamePanelOpen = ref(false)
const renameTargetName = ref('')
const lastFileOperationAction = ref<string>()
const selectedReadonly = ref(false)
const lastMetadataAction = ref<string>()
const excludedRowIds = ref<Set<string>>(new Set())
const lastSelectionAction = ref<string>()
const currentDifferenceIndex = ref(-1)
const lastDifferenceNavigation = ref<string>()
const syncPreviewItems = ref<SyncPreviewItem[]>([])
const pendingSyncSafetyItems = ref<SyncPreviewItem[]>([])
const lastSyncAction = ref<string>()
const remoteProfiles = ref<RemoteProfileView[]>([])
const selectedLeftProfileId = ref('')
const selectedRightProfileId = ref('')

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
}

function applyFolderLaunch(
  launch: NonNullable<ReturnType<typeof sessionLaunch.consumeLaunch>>,
): void {
  leftRoot.value = launch.locations.left?.uri ?? leftRoot.value
  rightRoot.value = launch.locations.right?.uri ?? rightRoot.value
  syncFolderTabTitle()

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
  syncFolderTabTitle()
})

const summary = computed(() => ({
  total: rows.value.length,
  different: rows.value.filter((row) => row.status === 'Different').length,
  orphans: rows.value.filter((row) => row.status === 'Left only' || row.status === 'Right only')
    .length,
}))
const directoryRows = computed(() => rows.value.filter((row) => row.kind === 'directory'))
const selectedRow = computed(() => rows.value.find((row) => row.id === selectedRowId.value))
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
const enabledExternalApplications = computed(() =>
  listEnabledExternalApplications(externalApplicationConfigs.value),
)
const differenceRows = computed(() =>
  visibleRows.value.filter((row) => row.status !== 'Same' && !isSuppressed(row)),
)
const visibleRows = computed(() =>
  rows.value.filter(
    (row) =>
      (!row.parentId || expandedDirectoryIds.value.has(row.parentId)) &&
      !excludedRowIds.value.has(row.id) &&
      (visibleStatuses.value.has(row.status) || showSuppressedFilters.value) &&
      (!filesOnlyFilter.value || row.kind === 'file'),
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

  columns.push('104px', 'minmax(180px, 1.2fr)')

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
  const indent = String(row.depth * 18)

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

function persistDisplayFilters(): void {
  saveFolderDisplayFilters({
    statuses: [...visibleStatuses.value],
    showSuppressed: showSuppressedFilters.value,
    filesOnly: filesOnlyFilter.value,
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
}

function showAllFolderStatuses(): void {
  visibleStatuses.value = new Set(['Same', 'Different', 'Left only', 'Right only'])
  persistDisplayFilters()
}

function showSameFolderStatuses(): void {
  visibleStatuses.value = new Set(['Same'])
  persistDisplayFilters()
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
    same: true,
    minor: false,
    rules: true,
    copy: Boolean(selectedFilePath.value),
    expand: true,
    collapse: true,
    select: false,
    files: true,
    refresh: Boolean(leftRoot.value && rightRoot.value) && !folderCompareLoading.value,
    swap: Boolean(leftRoot.value || rightRoot.value),
    stop: folderCompareLoading.value,
    filters: true,
    peek: false,
  }),
)

function runFolderToolbarCommand(commandId: string): void {
  switch (commandId) {
    case 'home':
      goHomeFromFolder()
      break
    case 'all':
      showAllFolderStatuses()
      break
    case 'same':
      showSameFolderStatuses()
      break
    case 'rules':
      showFolderRules.value = !showFolderRules.value
      break
    case 'copy':
      if (selectedFilePath.value) {
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
    default:
      break
  }
}

function isExpanded(row: FolderTreeRow): boolean {
  return expandedDirectoryIds.value.has(row.id)
}

async function runFolderCompare(): Promise<void> {
  const generation = ++folderCompareGeneration

  folderCompareLoading.value = true
  folderCompareError.value = undefined

  try {
    const response = await compareFolderPaths({
      leftRoot: leftRoot.value,
      rightRoot: rightRoot.value,
      criteria: { ...folderCriteria.value },
    })

    if (generation !== folderCompareGeneration) {
      return
    }

    applyFolderCompareResponse(response)
    lastCompare.recordFolderCompare({
      leftRoot: response.leftRoot,
      rightRoot: response.rightRoot,
    })
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

  rows.value = nextRows.map((row) =>
    row.parentId && !rowIds.has(row.parentId) ? { ...row, parentId: undefined } : row,
  )
  leftRoot.value = response.leftRoot
  rightRoot.value = response.rightRoot
  expandedDirectoryIds.value = new Set(
    rows.value.filter((row) => row.kind === 'directory').map((row) => row.id),
  )
  selectedRowId.value = undefined
  excludedRowIds.value = new Set()
  alignWithTargetId.value = ''
  currentDifferenceIndex.value = -1
  lastDifferenceNavigation.value = undefined
  scrollTop.value = 0
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
    leftModified: formatFolderModified(row.left?.modifiedAtMs),
    rightModified: formatFolderModified(row.right?.modifiedAtMs),
    leftPath: row.left?.path,
    rightPath: row.right?.path,
    status: row.status,
    kind: row.left?.kind ?? row.right?.kind ?? 'file',
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

  return `${year}-${month}-${day} ${hours}:${minutes}`
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

function copySelectedTo(direction: 'Left' | 'Right'): void {
  const row = selectedRow.value

  if (row?.kind !== 'file') {
    return
  }

  const sourcePath = direction === 'Left' ? row.rightPath : row.leftPath
  const targetPath =
    direction === 'Left'
      ? (row.leftPath ?? folderSidePath(leftRoot.value, row.relativePath))
      : (row.rightPath ?? folderSidePath(rightRoot.value, row.relativePath))

  if (!sourcePath) {
    return
  }

  pendingCopyDirection.value = direction
  pendingCopyConfirmation.value = createFileOperationConfirmation({
    operation: 'copy',
    paths: [targetPath],
  })
}

function renameSelectedFile(): void {
  const row = selectedRow.value

  if (!row) {
    return
  }

  renamePanelOpen.value = true
  renameTargetName.value = displayName(row)
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
  const row = selectedRow.value

  if (!confirmation || !direction || !row) {
    return
  }

  try {
    await copyFolderCompareEntry({
      leftRoot: leftRoot.value,
      rightRoot: rightRoot.value,
      relativePath: row.relativePath,
      direction: direction === 'Left' ? 'toLeft' : 'toRight',
    })
    lastCopyAction.value = t('status.copiedToSide', {
      side: direction === 'Left' ? t('ui.left') : t('ui.right'),
      path: confirmation.paths[0],
    })
    pendingCopyConfirmation.value = undefined
    pendingCopyDirection.value = undefined
    await runFolderCompare()
  } catch (error) {
    folderCompareError.value = formatCompareError(error, t)
  }
}

async function confirmRenameFile(): Promise<void> {
  const path = selectedEntryPath.value

  if (!path || !renameTargetName.value) {
    return
  }

  try {
    await renameFolderEntry({ path, newName: renameTargetName.value })
    lastFileOperationAction.value = t('status.renamedPath', { path: renameTargetName.value })
    renamePanelOpen.value = false
    await runFolderCompare()
  } catch (error) {
    folderCompareError.value = formatCompareError(error, t)
  }
}

async function moveSelectedFile(): Promise<void> {
  const path = selectedEntryPath.value

  if (!path) {
    return
  }

  const targetPath = archivePath(path)

  try {
    await moveFolderEntry({ sourcePath: path, targetPath })
    lastFileOperationAction.value = `${t('ui.move')} -> ${targetPath}`
    await runFolderCompare()
  } catch (error) {
    folderCompareError.value = formatCompareError(error, t)
  }
}

function deleteSelectedFile(): void {
  const path = selectedEntryPath.value

  if (!path) {
    return
  }

  pendingDangerousOperationLabel.value = t('status.deletedArrowPath', { path })
  pendingDangerousOperation.value = createFileOperationConfirmation({
    operation: 'delete',
    paths: [path],
  })

  if (!settings.confirmBeforeDelete) {
    void confirmDangerousFileOperation()
  }
}

async function confirmDangerousFileOperation(): Promise<void> {
  if (!pendingDangerousOperation.value) {
    return
  }

  try {
    await Promise.all(
      pendingDangerousOperation.value.paths.map((path) => deleteFolderEntry({ path })),
    )
    lastFileOperationAction.value = pendingDangerousOperationLabel.value
    pendingDangerousOperation.value = undefined
    pendingDangerousOperationLabel.value = ''
    await runFolderCompare()
  } catch (error) {
    folderCompareError.value = formatCompareError(error, t)
  }
}

async function toggleSelectedReadonly(selected: boolean): Promise<void> {
  const path = selectedEntryPath.value

  if (!path) {
    return
  }

  try {
    await changeFolderEntryAttributes({ path, readonly: selected })
    selectedReadonly.value = selected
    lastMetadataAction.value = t('status.attributesChanged', {
      state: selected ? 'readonly' : 'writable',
    })
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

async function exportFolderReport(format: 'html' | 'text'): Promise<void> {
  if (!leftRoot.value || !rightRoot.value) {
    return
  }

  const response = await exportFolderCompareReport({
    leftRoot: leftRoot.value,
    rightRoot: rightRoot.value,
    format,
    outputPath: `${leftRoot.value}/folder-compare.${format === 'text' ? 'txt' : 'html'}`,
  })

  reportStatus.value = response.outputPath ?? format
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

  if (riskyItems.length > 0) {
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

function archivePath(path: string): string {
  const separatorIndex = Math.max(path.lastIndexOf('/'), path.lastIndexOf('\\'))

  if (separatorIndex < 0) {
    return `archive/${path}`
  }

  return `${path.slice(0, separatorIndex)}/archive/${path.slice(separatorIndex + 1)}`
}

const rowContextMenu = ref<{ x: number; y: number; rowId: string }>()
const pathContextMenu = ref<{ x: number; y: number; side: 'left' | 'right' }>()

async function browseFolder(side: 'left' | 'right'): Promise<void> {
  const selected = await pickNativePath({ directory: true })

  if (!selected) {
    return
  }

  if (side === 'left') {
    leftRoot.value = selected
  } else {
    rightRoot.value = selected
  }
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
}

function openRowContextMenu(event: MouseEvent, row: FolderTreeRow): void {
  event.preventDefault()
  selectRow(row)
  rowContextMenu.value = { x: event.clientX, y: event.clientY, rowId: row.id }
  pathContextMenu.value = undefined
}

function openPathContextMenu(event: MouseEvent, side: 'left' | 'right'): void {
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
  } catch {
    // ponytail: ignore clipboard denial
  }
}

function handleTreeScroll(event: Event): void {
  scrollTop.value = (event.currentTarget as HTMLElement).scrollTop
}

onUnmounted(() => {
  window.removeEventListener('click', closeContextMenus)
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
    <section class="folder-compare-view">
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
                @dragover.prevent
                @drop="handlePathFieldDrop($event, 'left')"
                @contextmenu="openPathContextMenu($event, 'left')"
              />
              <button
                type="button"
                data-testid="folder-browse-left"
                @click="browseFolder('left')"
              >
                {{ $t('ui.browse') }}
              </button>
            </div>
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
                @dragover.prevent
                @drop="handlePathFieldDrop($event, 'right')"
                @contextmenu="openPathContextMenu($event, 'right')"
              />
              <button
                type="button"
                data-testid="folder-browse-right"
                @click="browseFolder('right')"
              >
                {{ $t('ui.browse') }}
              </button>
            </div>
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
        </fieldset>
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
            :disabled="!selectedFilePath"
            @click="copySelectedTo('Left')"
            >{{ $t('ui.copyLeft') }}</NButton
          >
          <NButton
            size="small"
            secondary
            data-testid="copy-selected-to-right"
            :disabled="!selectedFilePath"
            @click="copySelectedTo('Right')"
            >{{ $t('ui.copyRight') }}</NButton
          >
          <NButton
            size="small"
            secondary
            data-testid="move-selected-file"
            :disabled="!selectedEntryPath"
            @click="moveSelectedFile"
            >{{ $t('ui.move') }}</NButton
          >
          <NButton
            size="small"
            secondary
            data-testid="delete-selected-file"
            :disabled="!selectedEntryPath"
            @click="deleteSelectedFile"
            >{{ $t('ui.delete') }}</NButton
          >
          <NButton
            size="small"
            secondary
            data-testid="rename-selected-file"
            :disabled="!selectedEntryPath"
            @click="renameSelectedFile"
            >{{ $t('ui.rename') }}</NButton
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

      <section class="column-config">
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

      <section class="folder-summary">
        <div>
          <strong>{{ summary.total }}</strong>
          <span>{{ $t('ui.items') }}</span>
        </div>
        <div>
          <strong>{{ summary.different }}</strong>
          <span>{{ $t('ui.different') }}</span>
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
            :disabled="!selectedEntryPath"
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
          disabled
          >{{ $t('ui.alignWith') }}</NButton
        >
        <NButton
          size="small"
          secondary
          data-testid="break-selected-alignment"
          disabled
          >{{ $t('ui.breakAlignment') }}</NButton
        >
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
                { selected: selectedRowId === row.id, suppressed: isSuppressed(row) },
              ]"
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
              <strong>{{ folderStatusLabel(row.status) }}</strong>
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
        :disabled="!selectedFilePath"
        @click="contextCopySelectedTo('Left')"
      >
        {{ $t('ui.copyLeft') }}
      </button>
      <button
        type="button"
        data-testid="folder-ctx-copy-right"
        :disabled="!selectedFilePath"
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
                {{ selectedRow ? folderStatusLabel(selectedRow.status) : '--' }}
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
  </WorkbenchShell>
</template>
<style scoped>
.folder-compare-view {
  display: grid;
  grid-template-rows: max-content max-content max-content max-content max-content minmax(0, 1fr);
  gap: 12px;
  height: 100%;
  padding: 16px;
  overflow: hidden;
}

.folder-toolbar {
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  align-content: start;
  align-items: stretch;
  align-self: start;
  gap: 10px;
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
  gap: 10px;
  height: auto;
  min-height: min-content;
}

.path-pair label {
  display: grid;
  gap: 5px;
  min-width: 0;
}

.path-pair span {
  color: var(--app-text-muted);
  font-size: 12px;
}

.archive-path-hint {
  color: var(--app-text-muted);
  font-size: 12px;
  line-height: 1.35;
}

.folder-criteria {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px 14px;
  padding: 0;
  border: 0;
  color: var(--app-text-muted);
  font-size: 12px;
}

.folder-criteria legend {
  display: block;
  float: none;
  width: 100%;
  margin: 0 0 6px;
  padding: 0;
  color: var(--app-text);
  font-weight: 600;
}

.folder-criteria label {
  display: inline-flex;
  align-items: center;
  gap: 6px;
}

.path-pair input {
  width: 100%;
  min-width: 0;
  height: 32px;
  padding: 0 9px;
  overflow: hidden;
  border: 1px solid var(--app-border);
  border-radius: 6px;
  background: var(--app-surface);
  color: var(--app-text);
  text-overflow: ellipsis;
  white-space: nowrap;
}

.folder-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
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
  gap: 10px;
}

.column-config label,
.display-filters label {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  color: var(--app-text-muted);
  font-size: 12px;
}

.manual-alignment-tools {
  align-items: center;
}

.manual-alignment-tools select {
  min-width: 220px;
  height: 28px;
  padding: 0 8px;
  border: 1px solid var(--app-border);
  border-radius: 6px;
  background: var(--app-surface);
  color: var(--app-text);
  font-size: 12px;
}

.folder-copy-confirmation {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px 10px;
  border: 1px solid var(--app-border);
  border-radius: 6px;
  background: var(--app-surface-muted);
  color: var(--app-text-muted);
  font-size: 12px;
}

.folder-copy-confirmation strong {
  color: var(--app-text);
}

.folder-operation-panel {
  display: flex;
  align-items: center;
  gap: 10px;
}

.folder-operation-panel input {
  width: 260px;
  height: 28px;
  padding: 0 8px;
  border: 1px solid var(--app-border);
  border-radius: 6px;
  background: var(--app-surface);
  color: var(--app-text);
  font-size: 12px;
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
  padding: 9px 10px;
  overflow: hidden;
  border: 1px solid var(--app-border);
  border-radius: 8px;
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
  font-size: 18px;
  line-height: 1;
}

.folder-summary span {
  color: var(--app-text-muted);
  font-size: 12px;
}

.folder-action-status {
  padding: 8px 10px;
  border: 1px solid var(--app-border);
  border-radius: 6px;
  background: var(--app-surface-muted);
  color: var(--app-text-muted);
  font-size: 12px;
}

.sync-preview-panel {
  display: grid;
  gap: 8px;
  padding: 10px;
  overflow: hidden;
  border: 1px solid var(--app-border);
  border-radius: 8px;
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
  border-radius: 6px;
}

.sync-safety-confirmation {
  display: grid;
  grid-template-columns: minmax(180px, 0.8fr) minmax(260px, 1fr) auto;
  align-items: center;
  gap: 10px;
  padding: 9px 10px;
  border: 1px solid var(--diff-deleted-fg);
  border-radius: 6px;
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
  padding: 8px 10px;
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
  border-radius: 8px;
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
  border-bottom: 1px solid var(--app-border);
  background: var(--app-surface-muted);
  color: var(--app-text-muted);
  font-size: 12px;
  font-weight: 700;
}

.tree-head span,
.tree-row span,
.tree-row strong {
  min-width: 0;
  padding: 8px 10px;
  overflow: hidden;
  border-right: 1px solid var(--app-border);
  text-overflow: ellipsis;
  white-space: nowrap;
}

.tree-row {
  border-bottom: 1px solid var(--app-border);
  color: var(--app-text);
  font-size: 13px;
}

.tree-row.selected {
  background: var(--app-surface-muted);
  outline: 1px solid var(--app-accent);
  outline-offset: -1px;
}

.tree-row.suppressed {
  opacity: 0.56;
}

.tree-row small {
  margin-left: 8px;
  color: var(--app-text-muted);
  font-size: 11px;
  font-weight: 600;
}

.tree-row.directory .name-cell {
  font-weight: 700;
}

.tree-row strong {
  font-size: 12px;
  font-weight: 700;
}

.status-same strong {
  color: var(--diff-added-fg);
}

.status-different strong {
  color: var(--diff-modified-fg);
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
  gap: 6px;
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
  height: 28px;
  padding: 0 10px;
  border: 1px solid var(--app-border);
  border-radius: 4px;
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
  padding: 4px;
  border: 1px solid var(--app-border);
  border-radius: 4px;
  background: var(--app-surface);
  box-shadow: 0 8px 24px rgb(0 0 0 / 0.16);
}

.in-app-context-menu button {
  padding: 6px 10px;
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
</style>
