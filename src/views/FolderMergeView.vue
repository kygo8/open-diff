<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch, watchEffect } from 'vue'
import { useStatusBarStore } from '@/stores/statusBar'
import { elapsedSecondsSince } from '@/app/statusBarPhrases'
import { useRouter } from 'vue-router'
import { useTabsStore } from '@/stores/tabs'
import { useSettingsStore } from '@/stores/settings'
import FolderStatusLegend from '@/components/workbench/FolderStatusLegend.vue'
import {
  buildFolderMergePlan as requestFolderMergePlan,
  executeFolderMergePlan,
} from '@/api/folderMerge'
import { useSessionLaunchStore } from '@/stores/sessionLaunch'
import type {
  FolderMergeConflict,
  FolderMergeEntryKind,
  FolderMergeExecutionResponse,
  FolderMergePlanResponse,
  FolderMergePlanRow,
  FolderMergeSide,
} from '@/types/folderMerge'
import WorkbenchShell from '@/components/workbench/WorkbenchShell.vue'
import WorkbenchInspector from '@/components/workbench/WorkbenchInspector.vue'
import { Eye, Funnel } from '@lucide/vue'
import { createFolderEntry, createFolderSnapshot, saveTextFile } from '@/api/diff'
import { newFolderParentRelativePath, resolveNewFolderPaths } from '@/app/newFolderPath'
import {
  formatFolderNameFilterStripPattern,
  loadFolderNameFilters,
  parseFolderNameFilterStripPattern,
  saveFolderNameFilters,
  type FolderNameFilters,
} from '@/app/folderNameFilters'
import {
  buildFolderMergeReportText,
  defaultFolderMergeReportOutputPath,
} from '@/app/folderMergeReport'
import { folderSnapshotOutputPath } from '@/app/snapshotPath'
import { collectExpandablePrefixes, isPathHiddenByCollapse } from '@/app/folderPathGroups'
import { buildFolderMergeToolbar, mergeSessionTitle, pathBaseName } from '@/app/sessionToolbars'
import { useI18n } from '@/i18n'
import { useViewActionsStore } from '@/stores/viewActions'
import { useFolderPathNavStore } from '@/stores/folderPathNav'
import {
  createFolderPathNavStack,
  folderPathNavBack,
  folderPathNavCanBack,
  folderPathNavCanForward,
  folderPathNavCommit,
  folderPathNavForward,
  folderMergePathTriplesEqual,
  type FolderMergePathTriple,
} from '@/app/folderPathNavigation'
import { parentDirectoryPath } from '@/app/parentDirectoryPath'
import { pickNativePath } from '@/app/filePicker'
import { createChildCompareLaunch } from '@/app/childSession'
import { openPathExternal, revealPathInOs } from '@/api/integration'
import { explorerRevealPath, explorerSelectTargetPath } from '@/app/folderCompareExtraActions'

const leftPath = ref('')
const newFolderPanelOpen = ref(false)
const newFolderName = ref('New Folder')
const basePath = ref('')
const rightPath = ref('')
const outputPath = ref('')
const plan = ref<FolderMergePlanResponse>()
const execution = ref<FolderMergeExecutionResponse>()
const mergeExecuting = ref(false)
const mergeExecutionError = ref<string>()
const reportStatus = ref('')
const reportError = ref('')
const router = useRouter()
const sessionLaunch = useSessionLaunchStore()
const tabs = useTabsStore()
const settings = useSettingsStore()
const { t } = useI18n()
const statusBar = useStatusBarStore()
const viewActions = useViewActionsStore()
const folderPathNavStore = useFolderPathNavStore()
const folderPathNavStack = ref(createFolderPathNavStack<FolderMergePathTriple>())
let applyingFolderPathHistory = false

function currentMergePathTriple(): FolderMergePathTriple {
  return { left: leftPath.value, base: basePath.value, right: rightPath.value }
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
    currentMergePathTriple(),
    folderMergePathTriplesEqual,
  )
  publishFolderPathNavCapabilities()
}

function applyMergePathTriple(triple: FolderMergePathTriple): void {
  applyingFolderPathHistory = true
  leftPath.value = triple.left
  basePath.value = triple.base
  rightPath.value = triple.right
  applyingFolderPathHistory = false
  publishFolderPathNavCapabilities()
}

function goFolderPathBack(): void {
  const result = folderPathNavBack(folderPathNavStack.value)

  if (!result) {
    return
  }

  folderPathNavStack.value = result.stack
  applyMergePathTriple(result.entry)
}

function goFolderPathForward(): void {
  const result = folderPathNavForward(folderPathNavStack.value)

  if (!result) {
    return
  }

  folderPathNavStack.value = result.stack
  applyMergePathTriple(result.entry)
}

const lastOpenedConflictPath = ref('')
const sameOkOnly = ref(false)
const importanceFilter = ref<'all' | 'same' | 'minor' | 'diffs'>('all')
const filesOnlyFilter = ref(false)
const flatStructure = ref(false)
const loadTimeSeconds = ref<number | null>(null)
const showPeek = ref(false)
const peekTab = ref<'path' | 'sides' | 'action'>('path')
const showMergeRules = ref(false)
const selectedPlanRowId = ref('')
const collapsedPrefixes = ref<Set<string>>(new Set())
const showMergeFilters = ref(false)
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

      if (plan.value === undefined || mergeExecuting.value) {
        return
      }

      if (!leftPath.value || !basePath.value || !rightPath.value) {
        return
      }

      void buildFolderMergePlan()
    }, 350)
  },
  { deep: true },
)

const showMergeSelect = ref(false)
const checkedRowIds = ref<Set<string>>(new Set())

const lastSelectionAction = ref('')
const excludedRowIds = ref<Set<string>>(new Set())
const selectNameFilter = ref('')
const showMergeLog = ref(true)
const mergeOpenError = ref('')
const mergeChromeMessage = ref('')

const planRows = computed<FolderMergePlanRow[]>(() => plan.value?.rows ?? [])
const hasPlan = computed(() => planRows.value.length > 0)
const filteredPlanRows = computed(() => {
  let rows = planRows.value.filter((row) => !excludedRowIds.value.has(row.id))

  if (sameOkOnly.value || importanceFilter.value === 'same') {
    rows = rows.filter((row) => row.action === 'Keep output')
  } else if (importanceFilter.value === 'diffs') {
    rows = rows.filter((row) => Boolean(row.conflict) || row.action !== 'Keep output')
  } else if (importanceFilter.value === 'minor') {
    rows = rows.filter((row) => !row.conflict && row.action !== 'Keep output')
  }

  if (filesOnlyFilter.value) {
    rows = rows.filter(
      (row) => row.left.kind === 'File' || row.right.kind === 'File' || row.base.kind === 'File',
    )
  }

  return rows
})
const visiblePlanRows = computed(() =>
  filteredPlanRows.value.filter(
    (row) => flatStructure.value || !isPathHiddenByCollapse(row.path, collapsedPrefixes.value),
  ),
)
const canBuildMergePlan = computed(() =>
  Boolean(leftPath.value && basePath.value && rightPath.value),
)
const mergeSessionToolbar = computed(() =>
  buildFolderMergeToolbar({
    home: true,
    all: hasPlan.value,
    diffs: hasPlan.value,
    same: hasPlan.value,
    structure: hasPlan.value,
    minor: hasPlan.value,
    'same-ok': hasPlan.value,
    rules: hasPlan.value,
    sessions: true,
    merge: hasPlan.value && Boolean(outputPath.value) && !mergeExecuting.value,
    'to-output': Boolean(outputPath.value),
    expand: hasPlan.value,
    collapse: hasPlan.value,
    select: hasPlan.value,
    files: hasPlan.value,
    refresh: canBuildMergePlan.value,
    swap: Boolean(leftPath.value || rightPath.value),
    stop: mergeExecuting.value,
    filters: hasPlan.value,
    peek: hasPlan.value,
  }).map((item) => ({
    ...item,
    active:
      (item.id === 'all' && importanceFilter.value === 'all' && !sameOkOnly.value) ||
      (item.id === 'diffs' && importanceFilter.value === 'diffs') ||
      (item.id === 'same' && importanceFilter.value === 'same') ||
      (item.id === 'structure' && flatStructure.value) ||
      (item.id === 'minor' && importanceFilter.value === 'minor') ||
      (item.id === 'same-ok' && sameOkOnly.value) ||
      (item.id === 'rules' && showMergeRules.value) ||
      (item.id === 'sessions' && showMergeRules.value) ||
      (item.id === 'filters' && showMergeFilters.value) ||
      (item.id === 'select' && showMergeSelect.value) ||
      (item.id === 'files' && filesOnlyFilter.value) ||
      (item.id === 'peek' && showPeek.value),
  })),
)

function goHomeFromMerge(): void {
  tabs.openTab({ title: 'Home', titleKey: 'ui.home', route: '/', dirty: false })
  void router.push('/')
}

function expandAllMergePaths(): void {
  collapsedPrefixes.value = new Set()
}

function collapseAllMergePaths(): void {
  collapsedPrefixes.value = new Set(
    collectExpandablePrefixes(planRows.value.map((row) => row.path)),
  )
}

function selectVisibleMergeRows(): void {
  checkedRowIds.value = new Set(visiblePlanRows.value.map((row) => row.id))
  lastSelectionAction.value = t('status.selectedRowCount', {
    count: checkedRowIds.value.size,
    action: t('ui.selectAll'),
  })
}

function clearMergeSelection(): void {
  checkedRowIds.value = new Set()
  lastSelectionAction.value = t('status.selectedRowCount', {
    count: 0,
    action: t('ui.clearSelection'),
  })
}

function invertMergeSelection(): void {
  const next = new Set(checkedRowIds.value)

  for (const row of visiblePlanRows.value) {
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

function joinMergeSidePath(root: string, relativePath: string): string {
  const normalizedRoot = root.replaceAll('\\', '/').replace(/\/$/u, '')
  const normalizedRelativePath = relativePath.replaceAll('\\', '/').replace(/^\//u, '')

  if (!normalizedRelativePath) {
    return normalizedRoot
  }

  return `${normalizedRoot}/${normalizedRelativePath}`
}

function mergeSelectedRow(): FolderMergePlanRow | undefined {
  const selected = planRows.value.find((row) => row.id === selectedPlanRowId.value)

  if (selected) {
    return selected
  }

  return visiblePlanRows.value.find((row) => checkedRowIds.value.has(row.id))
}

function selectVisibleMergeFiles(): void {
  const ids = visiblePlanRows.value
    .filter(
      (row) => row.left.kind === 'File' || row.right.kind === 'File' || row.base.kind === 'File',
    )
    .map((row) => row.id)

  checkedRowIds.value = new Set(ids)
  lastSelectionAction.value = t('status.selectedRowCount', {
    count: ids.length,
    action: t('ui.selectAllFiles'),
  })
}

function selectVisibleMergeOrphans(): void {
  const ids = visiblePlanRows.value
    .filter(
      (row) =>
        row.left.kind === 'Missing' || row.right.kind === 'Missing' || row.base.kind === 'Missing',
    )
    .map((row) => row.id)

  checkedRowIds.value = new Set(ids)
  lastSelectionAction.value = t('status.selectedRowCount', {
    count: ids.length,
    action: t('ui.selectOrphans'),
  })
}

function openMergeChildCompare(kind: 'open' | 'quick'): void {
  const row = mergeSelectedRow()

  if (!row) {
    return
  }

  const left = leftPath.value ? joinMergeSidePath(leftPath.value, row.path) : ''
  const right = rightPath.value ? joinMergeSidePath(rightPath.value, row.path) : ''

  if (!left || !right) {
    const single = left || right

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

function mergeExplorerTarget(
  row: FolderMergePlanRow,
): { path: string; kind: 'file' | 'directory' } | undefined {
  let path: string | undefined
  let entryKind: FolderMergeEntryKind | undefined

  if (row.left.kind !== 'Missing' && leftPath.value) {
    path = joinMergeSidePath(leftPath.value, row.path)
    entryKind = row.left.kind
  } else if (row.right.kind !== 'Missing' && rightPath.value) {
    path = joinMergeSidePath(rightPath.value, row.path)
    entryKind = row.right.kind
  } else if (row.base.kind !== 'Missing' && basePath.value) {
    path = joinMergeSidePath(basePath.value, row.path)
    entryKind = row.base.kind
  } else if (basePath.value) {
    path = joinMergeSidePath(basePath.value, row.path)
    entryKind = row.base.kind === 'Missing' ? undefined : row.base.kind
  }

  if (!path) {
    return undefined
  }

  const kind: 'file' | 'directory' = entryKind === 'Directory' ? 'directory' : 'file'

  return { path, kind }
}

async function openMergeSelectedWithAssociatedApplication(): Promise<void> {
  const row = mergeSelectedRow()

  if (!row) {
    return
  }

  const target = mergeExplorerTarget(row)
  const path = target?.path

  if (!path) {
    return
  }

  try {
    await openPathExternal(path)
    lastSelectionAction.value = `${t('ui.openWith')} -> ${path}`
  } catch (error) {
    mergeOpenError.value = error instanceof Error ? error.message : String(error)
  }
}

const mergeExplorerEntryPath = computed(() => {
  const row = mergeSelectedRow()

  return row ? mergeExplorerTarget(row)?.path : undefined
})

async function revealMergeSelectedInExplorer(): Promise<void> {
  const row = mergeSelectedRow()
  const target = row ? mergeExplorerTarget(row) : undefined

  if (!target) {
    return
  }

  const selectPath = explorerSelectTargetPath(target.path)
  const fallbackPath = explorerRevealPath(target.path, target.kind)

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
      mergeOpenError.value =
        fallbackError instanceof Error ? fallbackError.message : String(fallbackError)
    }
  }
}

function excludeMergeSelectedRows(): void {
  const targets = new Set<string>()

  for (const row of visiblePlanRows.value) {
    if (checkedRowIds.value.has(row.id)) {
      targets.add(row.id)
    }
  }

  const selected = mergeSelectedRow()

  if (selected) {
    targets.add(selected.id)
  }

  if (targets.size === 0) {
    return
  }

  excludedRowIds.value = new Set([...excludedRowIds.value, ...targets])
  checkedRowIds.value = new Set([...checkedRowIds.value].filter((id) => !targets.has(id)))

  if (selectedPlanRowId.value && targets.has(selectedPlanRowId.value)) {
    selectedPlanRowId.value = ''
  }

  const label = selected?.path ?? String(targets.size)

  lastSelectionAction.value = t('status.excludedPath', { path: label })
}

async function refreshMergeSelection(): Promise<void> {
  await buildFolderMergePlan()
  const row = mergeSelectedRow()

  lastSelectionAction.value = row ? t('status.refreshedPath', { path: row.path }) : t('ui.refresh')
}

function selectMergeRowsByName(): void {
  const query = selectNameFilter.value.trim().toLowerCase()

  if (!query) {
    return
  }

  const matches = visiblePlanRows.value.filter((row) => row.path.toLowerCase().includes(query))

  checkedRowIds.value = new Set(matches.map((row) => row.id))

  if (matches[0]) {
    selectedPlanRowId.value = matches[0].id
  }

  lastSelectionAction.value = t('status.selectedRowCount', {
    count: matches.length,
    action: t('ui.findFilename'),
  })
}

function openMergeFindFilename(): void {
  showMergeSelect.value = true
  selectMergeRowsByName()
}

function toggleMergeLogPanel(): void {
  showMergeLog.value = !showMergeLog.value
}

function toggleMergeRowChecked(rowId: string): void {
  const next = new Set(checkedRowIds.value)

  if (next.has(rowId)) {
    next.delete(rowId)
  } else {
    next.add(rowId)
  }

  checkedRowIds.value = next
}

function runMergeToolbarCommand(commandId: string): void {
  switch (commandId) {
    case 'home':
      goHomeFromMerge()
      break
    case 'all':
      setImportanceFilter('all')
      break
    case 'diffs':
      setImportanceFilter('diffs')
      break
    case 'same':
      setImportanceFilter('same')
      break
    case 'structure':
      flatStructure.value = !flatStructure.value
      break
    case 'minor':
      toggleMinorImportanceFilter()
      break
    case 'same-ok':
      toggleSameOkFilter()
      break
    case 'rules':
      showMergeRules.value = !showMergeRules.value
      break
    case 'sessions':
      showMergeRules.value = !showMergeRules.value
      break
    case 'merge':
      void runFolderMerge()
      break
    case 'to-output':
      openOutputFolderCompare()
      break
    case 'expand':
      expandAllMergePaths()
      break
    case 'collapse':
      collapseAllMergePaths()
      break
    case 'select':
      showMergeSelect.value = !showMergeSelect.value
      break
    case 'files':
      filesOnlyFilter.value = !filesOnlyFilter.value
      break
    case 'filters':
      showMergeFilters.value = !showMergeFilters.value
      break
    case 'refresh':
      void buildFolderMergePlan()
      break
    case 'swap':
      swapMergeSides()
      break
    case 'stop':
      stopMergeWork()
      break
    case 'peek':
      togglePeekPanel()
      break
    default:
      break
  }
}

function swapMergeSides(): void {
  const previousLeft = leftPath.value

  leftPath.value = rightPath.value
  rightPath.value = previousLeft
  plan.value = undefined
  execution.value = undefined
  mergeChromeMessage.value = t('ui.swap')
  recordFolderPathCommit()
}

function stopMergeWork(): void {
  mergeChromeMessage.value = t('ui.stop')
}

function openOutputFolderCompare(): void {
  const output = outputPath.value.trim()

  if (!output) {
    return
  }

  const compareRight = leftPath.value.trim() || basePath.value.trim() || rightPath.value.trim()

  sessionLaunch.setPendingLaunch({
    id: crypto.randomUUID(),
    source: 'command',
    sessionType: 'folder-compare',
    title: pathBaseName(output),
    route: '/compare/folder',
    autoRun: Boolean(compareRight),
    locations: {
      left: { uri: output, kind: 'directory', readOnly: false },
      ...(compareRight ? { right: { uri: compareRight, kind: 'directory', readOnly: false } } : {}),
    },
  })
  tabs.openTab({ title: pathBaseName(output), route: '/compare/folder', dirty: false })
  void router.push('/compare/folder')
}

const selectedPlanRow = computed(
  () => planRows.value.find((row) => row.id === selectedPlanRowId.value) ?? null,
)
const sameOkCount = computed(
  () => planRows.value.filter((row) => row.action === 'Keep output').length,
)
const conflicts = computed(() =>
  planRows.value.flatMap((row) => (row.conflict ? [row.conflict] : [])),
)
const summary = computed(() => ({
  actions: plan.value?.summary.actions ?? 0,
  automatic: plan.value?.summary.automatic ?? 0,
  conflicts: plan.value?.summary.conflicts ?? 0,
}))
const executionSummary = computed(() => execution.value?.summary)

onMounted(() => {
  const launch = sessionLaunch.consumeLaunch('/merge/folder')

  if (!launch) {
    return
  }

  leftPath.value = launch.locations.left?.uri ?? leftPath.value
  basePath.value = launch.locations.center?.uri ?? basePath.value
  rightPath.value = launch.locations.right?.uri ?? rightPath.value
  outputPath.value = launch.locations.output?.uri ?? outputPath.value
  recordFolderPathCommit()

  if (
    launch.autoRun &&
    launch.locations.left?.uri &&
    launch.locations.center?.uri &&
    launch.locations.right?.uri
  ) {
    void buildFolderMergePlan()
  }
})

onUnmounted(() => {
  if (folderNameFilterRebuildTimer !== undefined) {
    clearTimeout(folderNameFilterRebuildTimer)
    folderNameFilterRebuildTimer = undefined
  }

  folderPathNavStore.reset()
})

watchEffect(() => {
  const selection =
    checkedRowIds.value.size > 0
      ? t('status.itemsSelected', { count: checkedRowIds.value.size })
      : null
  const editing = t('status.editingDisabled')

  statusBar.reportStatus({
    comparisonStatus: hasPlan.value ? t('status.compared') : t('status.readyIdle'),
    differenceCount: hasPlan.value ? summary.value.conflicts : null,
    filterStatus: t('status.allRows'),
    source: 'folder-merge',
    chromeKind: 'folder-pair',
    loadTimeSeconds: hasPlan.value ? loadTimeSeconds.value : null,
    leftSelection: selection ?? editing,
    leftFreeSpace: null,
    rightSelection: selection ?? editing,
    rightFreeSpace: null,
  })
})

async function saveMergeFolderSnapshot(): Promise<void> {
  const sourceRoot = (leftPath.value || basePath.value || rightPath.value).trim()

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
    // ponytail: menu status is reported by AppLayout fallback paths
  }
}

async function buildFolderMergePlan(): Promise<void> {
  const startedAt = performance.now()

  plan.value = await requestFolderMergePlan({
    leftRoot: leftPath.value,
    baseRoot: basePath.value,
    rightRoot: rightPath.value,
    outputRoot: outputPath.value,
    archiveExtensions: [...settings.archiveExtensions],
    filters: { ...folderNameFilters.value },
  })

  loadTimeSeconds.value = elapsedSecondsSince(startedAt)
  execution.value = undefined
  mergeExecutionError.value = undefined
  reportStatus.value = ''
  reportError.value = ''
  collapsedPrefixes.value = new Set()
  checkedRowIds.value = new Set()
  excludedRowIds.value = new Set()
  lastSelectionAction.value = ''
  mergeOpenError.value = ''
  if (plan.value.rows.length > 0) {
    selectedPlanRowId.value = plan.value.rows[0].id
  }
}

async function runFolderMerge(): Promise<void> {
  mergeExecuting.value = true
  mergeExecutionError.value = undefined
  mergeChromeMessage.value = ''

  try {
    execution.value = await executeFolderMergePlan({
      leftRoot: leftPath.value,
      baseRoot: basePath.value,
      rightRoot: rightPath.value,
      outputRoot: outputPath.value,
      archiveExtensions: [...settings.archiveExtensions],
      filters: { ...folderNameFilters.value },
    })
  } catch (error) {
    mergeExecutionError.value = error instanceof Error ? error.message : String(error)
  } finally {
    mergeExecuting.value = false
  }
}

function sideLabel(side: FolderMergeSide): string {
  if (side.kind === 'Missing') {
    return t('ui.missing')
  }

  return `${folderMergeEntryKindLabel(side.kind)} | ${side.size ?? '--'} | ${side.modified ?? '--'}`
}

function folderMergeEntryKindLabel(kind: FolderMergeSide['kind']): string {
  const keys: Record<FolderMergeSide['kind'], string> = {
    Directory: 'ui.directory',
    File: 'ui.file',
    Missing: 'ui.missing',
  }

  return t(keys[kind])
}

function folderMergeActionLabel(action: FolderMergePlanRow['action']): string {
  const keys: Record<FolderMergePlanRow['action'], string> = {
    'Copy left to output': 'merge.action.copyLeftToOutput',
    'Copy right to output': 'merge.action.copyRightToOutput',
    'Delete output': 'merge.action.deleteOutput',
    'Keep output': 'merge.action.keepOutput',
    'Mark conflict': 'merge.action.markConflict',
  }

  return t(keys[action])
}

function canOpenConflictInTextMerge(conflict: FolderMergeConflict): boolean {
  return (
    (conflict.leftContext?.includes('File') ?? false) &&
    (conflict.rightContext?.includes('File') ?? false)
  )
}

function openConflictInTextMerge(conflict: FolderMergeConflict): void {
  if (!canOpenConflictInTextMerge(conflict)) {
    lastOpenedConflictPath.value = ''

    return
  }

  lastOpenedConflictPath.value = conflict.path
  sessionLaunch.setPendingLaunch({
    id: crypto.randomUUID(),
    source: 'command',
    sessionType: 'text-merge',
    title: conflict.path,
    route: '/merge/text',
    autoRun: true,
    locations: {
      left: { uri: joinRoot(leftPath.value, conflict.path), kind: 'file', readOnly: false },
      right: { uri: joinRoot(rightPath.value, conflict.path), kind: 'file', readOnly: false },
      center: { uri: joinRoot(basePath.value, conflict.path), kind: 'file', readOnly: false },
      output: { uri: joinRoot(outputPath.value, conflict.path), kind: 'file', readOnly: false },
    },
  })
  tabs.openTab({ title: conflict.path, route: '/merge/text', dirty: false })
  void router.push('/merge/text')
}

function selectPlanRow(row: FolderMergePlanRow): void {
  selectedPlanRowId.value = row.id
  if (!showPeek.value) {
    showPeek.value = true
  }
}

function toggleSameOkFilter(): void {
  sameOkOnly.value = !sameOkOnly.value
}

function setImportanceFilter(next: 'all' | 'same' | 'minor' | 'diffs'): void {
  importanceFilter.value = next
  sameOkOnly.value = false
}

function toggleMinorImportanceFilter(): void {
  setImportanceFilter(importanceFilter.value === 'minor' ? 'all' : 'minor')
}

function togglePeekPanel(): void {
  showPeek.value = !showPeek.value
  if (showPeek.value && !selectedPlanRowId.value && visiblePlanRows.value[0]) {
    selectedPlanRowId.value = visiblePlanRows.value[0].id
  }
}

async function exportFolderMergeReport(): Promise<void> {
  if (!hasPlan.value) {
    return
  }

  const payload = buildFolderMergeReportText({
    leftPath: leftPath.value,
    basePath: basePath.value,
    rightPath: rightPath.value,
    outputPath: outputPath.value,
    summary: summary.value,
    rows: planRows.value.map((row) => ({
      path: row.path,
      action: row.action,
      detail: row.detail,
    })),
  })
  const reportPath = defaultFolderMergeReportOutputPath(leftPath.value)

  try {
    await navigator.clipboard.writeText(payload)
  } catch {
    // Clipboard may be unavailable in headless tests; still try file export.
  }

  try {
    await saveTextFile({
      path: reportPath,
      text: payload,
      createBackup: false,
    })
    reportStatus.value = reportPath
    reportError.value = ''
  } catch (event) {
    reportError.value = String(event)
  }
}

function joinRoot(root: string, relativePath: string): string {
  const normalizedRoot = root.replaceAll('\\', '/').replace(/\/$/u, '')
  const normalizedRelative = relativePath.replaceAll('\\', '/').replace(/^\//u, '')

  return normalizedRelative ? `${normalizedRoot}/${normalizedRelative}` : normalizedRoot
}

watch(
  [leftPath, rightPath, outputPath],
  ([left, right, output]) => {
    const title = mergeSessionTitle(left, right, output)

    if (title) {
      tabs.setTabTitle('/merge/folder', title)
    }
  },
  { immediate: true },
)

async function browseMergeFolder(): Promise<void> {
  const selected = await pickNativePath({ directory: true })

  if (!selected) {
    return
  }

  leftPath.value = selected
  recordFolderPathCommit()
}

function upOneMergeLevel(): void {
  const nextLeft = parentDirectoryPath(leftPath.value)
  const nextBase = parentDirectoryPath(basePath.value)
  const nextRight = parentDirectoryPath(rightPath.value)
  let changed = false

  if (nextLeft) {
    leftPath.value = nextLeft
    changed = true
  }

  if (nextBase) {
    basePath.value = nextBase
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

function openNewFolderPanel(): void {
  if (!leftPath.value && !rightPath.value && !outputPath.value) {
    return
  }

  newFolderName.value = 'New Folder'
  newFolderPanelOpen.value = true
}

async function confirmNewFolder(): Promise<void> {
  const selected = mergeSelectedRow()
  const selectedKind =
    selected && (selected.left.kind === 'Directory' || selected.right.kind === 'Directory')
      ? 'directory'
      : 'file'
  const parentRelative = newFolderParentRelativePath({
    selectedRelativePath: selected?.path,
    selectedKind,
  })
  const paths = resolveNewFolderPaths({
    roots: [leftPath.value, rightPath.value, outputPath.value],
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
  } catch (error) {
    mergeOpenError.value = error instanceof Error ? error.message : String(error)
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
      case 'reload':
        void buildFolderMergePlan()
        break
      case 'save-snapshot':
        void saveMergeFolderSnapshot()
        break
      case 'save':
        void runFolderMerge()
        break
      case 'toggle-minor':
        toggleMinorImportanceFilter()
        break
      case 'expand-all':
        expandAllMergePaths()
        break
      case 'collapse-all':
        collapseAllMergePaths()
        break
      case 'browse-folder':
        void browseMergeFolder()
        break
      case 'up-one-level':
        upOneMergeLevel()
        break
      case 'path-back':
        goFolderPathBack()
        break
      case 'path-forward':
        goFolderPathForward()
        break
      case 'toggle-session-locked':
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
        void exportFolderMergeReport()
        break
      case 'export-settings':
      case 'filters':
        showMergeFilters.value = !showMergeFilters.value
        break
      case 'help-contents':
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
        showMergeRules.value = true
        break
      case 'show-all':
        setImportanceFilter('all')
        break
      case 'show-differences':
        setImportanceFilter('diffs')
        break
      case 'show-same':
        setImportanceFilter('same')
        break
      case 'select-all':
        showMergeSelect.value = true
        selectVisibleMergeRows()
        break
      case 'select-all-files':
        showMergeSelect.value = true
        selectVisibleMergeFiles()
        break
      case 'select-orphans':
        showMergeSelect.value = true
        selectVisibleMergeOrphans()
        break
      case 'invert-selection':
        showMergeSelect.value = true
        invertMergeSelection()
        break
      case 'open-selected':
        openMergeChildCompare('open')
        break
      case 'open-with':
        void openMergeSelectedWithAssociatedApplication()
        break
      case 'explorer':
        void revealMergeSelectedInExplorer()
        break
      case 'quick-compare':
        openMergeChildCompare('quick')
        break
      case 'exclude-selected':
        excludeMergeSelectedRows()
        break
      case 'refresh-selection':
        void refreshMergeSelection()
        break
      case 'find-filename':
        openMergeFindFilename()
        break
      case 'toggle-log':
        toggleMergeLogPanel()
        break
      case 'toggle-legend':
        break
      case 'new-folder':
        openNewFolderPanel()
        break
      case 'leave-alone':
      case 'sync-copy-left-to-right':
      case 'sync-copy-right-to-left':
      case 'sync-delete-left':
      case 'sync-delete-right':
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
      case 'swap':
      case 'undo':
      case 'workspace-load':
      case 'next-conflict':
      case 'previous-conflict':
      case 'sync-now':
      case 'workspace-save':
      case 'run-script':
      case 'save-report':
      case 'toggle-columns':
      case 'toggle-toolbar':
      case 'change-attributes':
      case 'touch-selected':
        break
    }
  },
)
</script>

<template>
  <WorkbenchShell
    :title="$t('ui.folderMerge')"
    :eyebrow="$t('ui.merge')"
    :subtitle="$t('status.actionCount', { count: summary.actions })"
    :inspector-label="$t('ui.folderMergeInspector')"
    :toolbar-commands="mergeSessionToolbar"
    toolbar-test-id-prefix="folder-merge-session-toolbar"
    @toolbar-command="runMergeToolbarCommand"
  >
    <FolderStatusLegend
      v-if="settings.showFolderLegend"
      class="folder-status-legend-slot"
    />
    <section class="folder-merge-view">
      <header class="merge-header">
        <div>
          <p class="eyebrow">{{ $t('ui.folderMerge') }}</p>
          <h1>{{ $t('ui.folderMerge') }}</h1>
        </div>
        <section
          class="merge-summary"
          data-testid="folder-merge-summary"
        >
          <div>
            <strong>{{ summary.actions }}</strong>
            <span>{{ $t('ui.actions') }}</span>
          </div>
          <div>
            <strong>{{ summary.automatic }}</strong>
            <span>{{ $t('ui.automatic') }}</span>
          </div>
          <div>
            <strong>{{ summary.conflicts }}</strong>
            <span>{{ $t('ui.conflicts') }}</span>
          </div>
        </section>
      </header>

      <section
        class="display-filters folder-filter-chrome"
        data-testid="folder-merge-filter-strip"
      >
        <div class="folder-filter-strip">
          <span class="folder-filter-strip-label">{{ $t('ui.filters') }}:</span>
          <input
            class="folder-filter-pattern"
            type="text"
            data-testid="folder-merge-filter-pattern"
            spellcheck="false"
            autocomplete="off"
            :value="folderFilterStripPattern"
            :aria-label="$t('ui.filters')"
            @change="onFolderFilterStripChange"
            @keydown.enter.prevent="onFolderFilterStripChange"
          />
          <div
            class="folder-filter-strip-actions"
            data-testid="folder-merge-filter-strip-actions"
          >
            <button
              type="button"
              class="folder-filter-strip-btn"
              :class="{ 'folder-filter-strip-btn-active': showMergeFilters }"
              data-testid="folder-merge-filter-strip-filters"
              :aria-label="$t('ui.filters')"
              :aria-pressed="showMergeFilters ? 'true' : 'false'"
              :title="$t('ui.filters')"
              :disabled="!hasPlan"
              @click="showMergeFilters = !showMergeFilters"
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
              data-testid="folder-merge-filter-strip-peek"
              :aria-label="$t('ui.peek')"
              :aria-pressed="showPeek ? 'true' : 'false'"
              :title="$t('ui.peek')"
              :disabled="!hasPlan"
              @click="togglePeekPanel()"
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

      <section class="merge-paths">
        <label>
          <span>{{ $t('ui.leftFolder') }}</span>
          <input
            v-model="leftPath"
            data-testid="folder-merge-left-path"
            @keydown.enter.prevent="recordFolderPathCommit"
            @change="recordFolderPathCommit"
          />
          <span
            class="merge-path-footer"
            data-testid="folder-merge-left-editing-status"
            >{{ $t('status.editingDisabled') }}</span
          >
        </label>
        <label>
          <span>{{ $t('ui.baseFolder') }}</span>
          <input
            v-model="basePath"
            data-testid="folder-merge-base-path"
            @keydown.enter.prevent="recordFolderPathCommit"
            @change="recordFolderPathCommit"
          />
          <span
            class="merge-path-footer"
            data-testid="folder-merge-base-editing-status"
            >{{ $t('status.editingDisabled') }}</span
          >
        </label>
        <label>
          <span>{{ $t('ui.rightFolder') }}</span>
          <input
            v-model="rightPath"
            data-testid="folder-merge-right-path"
            @keydown.enter.prevent="recordFolderPathCommit"
            @change="recordFolderPathCommit"
          />
          <span
            class="merge-path-footer"
            data-testid="folder-merge-right-editing-status"
            >{{ $t('status.editingDisabled') }}</span
          >
        </label>
        <label>
          <span>{{ $t('ui.outputFolder') }}</span>
          <input
            v-model="outputPath"
            data-testid="folder-merge-output-path"
          />
        </label>
        <div class="merge-actions">
          <NButton
            size="small"
            type="primary"
            data-testid="folder-merge-build-plan"
            @click="buildFolderMergePlan"
            >{{ $t('ui.buildPlan') }}</NButton
          >
          <NButton
            size="small"
            secondary
            data-testid="folder-merge-same-ok"
            :disabled="!hasPlan"
            :type="sameOkOnly ? 'primary' : 'tertiary'"
            @click="toggleSameOkFilter"
            >{{ $t('ui.sameOk') }} ({{ sameOkCount }})</NButton
          >
          <NButton
            size="small"
            secondary
            data-testid="folder-merge-peek"
            :disabled="!hasPlan"
            @click="togglePeekPanel"
            >{{ $t('ui.peek') }}</NButton
          >
          <NButton
            size="small"
            secondary
            data-testid="export-folder-merge-report"
            :disabled="!hasPlan"
            @click="exportFolderMergeReport"
            >{{ $t('ui.export') }}</NButton
          >
          <span
            v-if="reportStatus"
            data-testid="folder-merge-report-status"
            >{{ reportStatus }}</span
          >
          <span
            v-if="reportError"
            data-testid="folder-merge-report-error"
            >{{ reportError }}</span
          >
          <NButton
            size="small"
            secondary
            data-testid="folder-merge-execute-plan"
            :disabled="!hasPlan || mergeExecuting"
            :loading="mergeExecuting"
            @click="runFolderMerge"
            >{{ $t('ui.merge') }} -> {{ $t('ui.output') }}</NButton
          >
        </div>
      </section>

      <p
        v-if="mergeChromeMessage"
        class="merge-open-status"
        data-testid="folder-merge-chrome-status"
      >
        {{ mergeChromeMessage }}
      </p>

      <section
        v-if="showMergeRules && hasPlan"
        class="merge-chrome-panel"
        data-testid="folder-merge-rules-panel"
      >
        <strong>{{ $t('ui.rules') }}</strong>
        <span data-testid="folder-merge-rules-summary">
          {{ $t('ui.actions') }}: {{ summary.actions }} / {{ $t('ui.conflicts') }}:
          {{ summary.conflicts }} / {{ $t('ui.sameOk') }}: {{ sameOkCount }}
        </span>
        <span>{{ $t('ui.folderMergeRulesHint') }}</span>
      </section>

      <section
        v-if="lastOpenedConflictPath"
        class="merge-open-status"
        data-testid="folder-merge-open-status"
      >
        {{
          $t('status.openingTextMergeRouteFor', {
            path: lastOpenedConflictPath,
            route: '/merge/text',
          })
        }}
      </section>

      <section
        v-if="mergeExecutionError"
        class="merge-open-status"
        data-testid="folder-merge-execution-error"
      >
        {{ mergeExecutionError }}
      </section>

      <section
        v-if="mergeOpenError"
        class="merge-open-status"
        data-testid="folder-merge-open-error"
      >
        {{ mergeOpenError }}
      </section>

      <section
        v-if="showMergeLog && executionSummary"
        class="merge-open-status"
        data-testid="folder-merge-execution-status"
      >
        <strong>{{
          $t('status.completedCount', {
            count:
              executionSummary.executed + executionSummary.skipped + executionSummary.conflicts,
            total: executionSummary.total,
          })
        }}</strong>
        <span>
          {{ $t('ui.actions') }}: {{ executionSummary.executed }} / {{ $t('ui.conflicts') }}:
          {{ executionSummary.conflicts }} / {{ $t('ui.errors') }}: {{ executionSummary.failed }}
        </span>
      </section>

      <section
        v-if="showMergeFilters && hasPlan"
        class="merge-chrome-panel"
        data-testid="folder-merge-filters-panel"
      >
        <strong>{{ $t('ui.filters') }}</strong>
        <button
          type="button"
          data-testid="folder-merge-filter-all"
          @click="setImportanceFilter('all')"
        >
          {{ $t('ui.all') }}
        </button>
        <button
          type="button"
          data-testid="folder-merge-filter-same"
          @click="setImportanceFilter('same')"
        >
          {{ $t('ui.same') }}
        </button>
        <button
          type="button"
          data-testid="folder-merge-filter-minor"
          @click="toggleMinorImportanceFilter"
        >
          {{ $t('ui.minor') }}
        </button>
        <button
          type="button"
          data-testid="folder-merge-filter-same-ok"
          @click="toggleSameOkFilter"
        >
          {{ $t('ui.sameOk') }} ({{ sameOkCount }})
        </button>
        <label class="merge-files-only">
          <input
            v-model="filesOnlyFilter"
            type="checkbox"
            data-testid="folder-merge-files-only"
          />
          <span>{{ $t('ui.filesOnly') }}</span>
        </label>
        <span data-testid="folder-merge-filter-state">{{
          sameOkOnly
            ? $t('ui.sameOk')
            : importanceFilter === 'same'
              ? $t('ui.same')
              : importanceFilter === 'minor'
                ? $t('ui.minor')
                : $t('ui.all')
        }}</span>
      </section>

      <section
        v-if="showMergeSelect && hasPlan"
        class="merge-chrome-panel"
        data-testid="folder-merge-select-panel"
      >
        <strong>{{ $t('ui.select') }}</strong>
        <button
          type="button"
          data-testid="folder-merge-select-all"
          @click="selectVisibleMergeRows"
        >
          {{ $t('ui.selectAll') }}
        </button>
        <button
          type="button"
          data-testid="folder-merge-select-invert"
          @click="invertMergeSelection"
        >
          {{ $t('ui.invertSelection') }}
        </button>
        <button
          type="button"
          data-testid="folder-merge-select-clear"
          @click="clearMergeSelection"
        >
          {{ $t('ui.clearSelection') }}
        </button>
        <label class="merge-select-name">
          <span>{{ $t('ui.findFilename') }}</span>
          <input
            v-model="selectNameFilter"
            type="text"
            data-testid="folder-merge-find-filename"
            @keydown.enter.prevent="selectMergeRowsByName"
          />
          <button
            type="button"
            data-testid="folder-merge-find-filename-apply"
            @click="selectMergeRowsByName"
          >
            {{ $t('ui.apply') }}
          </button>
        </label>
        <span
          v-if="lastSelectionAction"
          data-testid="folder-merge-selection-status"
          >{{ lastSelectionAction }}</span
        >
      </section>

      <section
        v-if="hasPlan"
        class="merge-plan"
        data-testid="folder-merge-plan"
      >
        <header>
          <strong>{{ $t('ui.mergePlan') }}</strong>
          <span>{{ outputPath }}</span>
          <button
            type="button"
            data-testid="reveal-merge-selected-in-explorer"
            :disabled="!mergeExplorerEntryPath"
            @click="revealMergeSelectedInExplorer"
          >
            {{ $t('ui.explorer') }}
          </button>
        </header>
        <div class="merge-plan-table">
          <div class="merge-plan-row merge-plan-head">
            <span>{{ $t('ui.select') }}</span>
            <span>{{ $t('ui.path') }}</span>
            <span>{{ $t('ui.base') }}</span>
            <span>{{ $t('ui.left') }}</span>
            <span>{{ $t('ui.right') }}</span>
            <span>{{ $t('ui.action') }}</span>
            <span>{{ $t('ui.detail') }}</span>
          </div>
          <div
            v-for="row in visiblePlanRows"
            :key="row.id"
            class="merge-plan-row"
            :class="{
              conflict: row.action === 'Mark conflict',
              selected: row.id === selectedPlanRowId || checkedRowIds.has(row.id),
            }"
            data-testid="folder-merge-row"
            @click="selectPlanRow(row)"
          >
            <label
              class="merge-select-cell"
              @click.stop
            >
              <input
                type="checkbox"
                :checked="checkedRowIds.has(row.id)"
                :data-testid="`folder-merge-check-${row.id}`"
                @change="toggleMergeRowChecked(row.id)"
              />
            </label>
            <strong>{{ row.path }}</strong>
            <span>{{ sideLabel(row.base) }}</span>
            <span>{{ sideLabel(row.left) }}</span>
            <span>{{ sideLabel(row.right) }}</span>
            <strong>{{ folderMergeActionLabel(row.action) }}</strong>
            <span>{{ row.detail }}</span>
          </div>
        </div>
      </section>

      <section
        v-if="showPeek"
        class="folder-merge-peek-panel"
        data-testid="folder-merge-peek-panel"
      >
        <header>
          <strong>{{ $t('ui.peekPanel') }}</strong>
          <button
            type="button"
            data-testid="folder-merge-peek-close"
            @click="showPeek = false"
          >
            {{ $t('ui.close') }}
          </button>
        </header>
        <template v-if="selectedPlanRow">
          <div
            class="peek-tabs"
            role="tablist"
            data-testid="folder-merge-peek-tabs"
          >
            <button
              type="button"
              class="peek-tab"
              :class="{ 'peek-tab-active': peekTab === 'path' }"
              role="tab"
              data-testid="folder-merge-peek-tab-path"
              :aria-selected="peekTab === 'path' ? 'true' : 'false'"
              @click="peekTab = 'path'"
            >
              {{ $t('ui.path') }}
            </button>
            <button
              type="button"
              class="peek-tab"
              :class="{ 'peek-tab-active': peekTab === 'sides' }"
              role="tab"
              data-testid="folder-merge-peek-tab-sides"
              :aria-selected="peekTab === 'sides' ? 'true' : 'false'"
              @click="peekTab = 'sides'"
            >
              {{ $t('ui.left') }}
            </button>
            <button
              type="button"
              class="peek-tab"
              :class="{ 'peek-tab-active': peekTab === 'action' }"
              role="tab"
              data-testid="folder-merge-peek-tab-action"
              :aria-selected="peekTab === 'action' ? 'true' : 'false'"
              @click="peekTab = 'action'"
            >
              {{ $t('ui.action') }}
            </button>
          </div>
          <dl>
            <div v-show="peekTab === 'path'">
              <dt>{{ $t('ui.path') }}</dt>
              <dd data-testid="folder-merge-peek-path">{{ selectedPlanRow.path }}</dd>
            </div>
            <div v-show="peekTab === 'sides'">
              <dt>{{ $t('ui.base') }}</dt>
              <dd>{{ sideLabel(selectedPlanRow.base) }}</dd>
              <dt>{{ $t('ui.left') }}</dt>
              <dd>{{ sideLabel(selectedPlanRow.left) }}</dd>
              <dt>{{ $t('ui.right') }}</dt>
              <dd>{{ sideLabel(selectedPlanRow.right) }}</dd>
            </div>
            <div v-show="peekTab === 'action'">
              <dt>{{ $t('ui.action') }}</dt>
              <dd data-testid="folder-merge-peek-action">
                {{ folderMergeActionLabel(selectedPlanRow.action) }}
              </dd>
              <dt>{{ $t('ui.detail') }}</dt>
              <dd>{{ selectedPlanRow.detail }}</dd>
            </div>
          </dl>
        </template>
        <p
          v-else
          data-testid="folder-merge-peek-empty"
        >
          {{ $t('ui.noSelection') }}
        </p>
      </section>

      <section
        v-if="conflicts.length > 0"
        class="conflict-panel"
        data-testid="folder-merge-conflict-list"
      >
        <header>
          <strong>{{ $t('ui.conflicts') }}</strong>
          <span>{{
            $t(
              conflicts.length === 1
                ? 'status.itemRequiresReview'
                : 'status.itemRequiresReviewPlural',
              { count: conflicts.length },
            )
          }}</span>
        </header>
        <ul>
          <li
            v-for="conflict in conflicts"
            :key="conflict.path"
          >
            <strong>{{ conflict.path }}</strong>
            <span>{{ conflict.reason }}</span>
            <span>{{ conflict.baseContext }}</span>
            <span>{{ conflict.leftContext }}</span>
            <span>{{ conflict.rightContext }}</span>
            <NButton
              v-if="canOpenConflictInTextMerge(conflict)"
              size="tiny"
              secondary
              :data-testid="`open-folder-conflict-${conflict.path}`"
              @click="openConflictInTextMerge(conflict)"
              >{{ $t('ui.openTextMerge') }}</NButton
            >
            <span
              v-else
              data-testid="folder-merge-conflict-manual"
              >{{ $t('ui.conflicts') }}</span
            >
          </li>
        </ul>
      </section>
    </section>

    <template #inspector>
      <section
        v-if="newFolderPanelOpen"
        class="folder-operation-panel"
        data-testid="folder-merge-new-folder-panel"
      >
        <input
          v-model="newFolderName"
          data-testid="folder-merge-new-folder-name"
        />
        <NButton
          size="small"
          type="primary"
          data-testid="folder-merge-confirm-new-folder"
          @click="confirmNewFolder"
        >
          {{ $t('ui.newFolder') }}
        </NButton>
      </section>

      <WorkbenchInspector>
        <section class="workbench-inspector-section">
          <h2>{{ $t('ui.mergePlan') }}</h2>
          <dl>
            <div>
              <dt>{{ $t('ui.actions') }}</dt>
              <dd>{{ summary.actions }}</dd>
            </div>
            <div>
              <dt>{{ $t('ui.automatic') }}</dt>
              <dd data-tone="added">{{ summary.automatic }}</dd>
            </div>
            <div>
              <dt>{{ $t('ui.conflicts') }}</dt>
              <dd data-tone="conflict">{{ summary.conflicts }}</dd>
            </div>
            <div>
              <dt>{{ $t('ui.outputFolder') }}</dt>
              <dd>{{ outputPath }}</dd>
            </div>
          </dl>
        </section>
      </WorkbenchInspector>
    </template>
  </WorkbenchShell>
</template>
<style scoped>
.folder-merge-view {
  display: grid;
  grid-template-rows: auto auto auto minmax(0, auto);
  gap: 4px;
  height: 100%;
  padding: 4px 6px;
  overflow: auto;
}

.merge-header {
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
  font-size: 22px;
  line-height: 1.2;
}

.merge-summary {
  display: grid;
  grid-template-columns: repeat(3, 108px);
  gap: 8px;
}

.merge-summary div {
  display: grid;
  gap: 2px;
  padding: 9px 10px;
  border: 1px solid var(--app-border);
  border-radius: 8px;
  background: var(--app-surface);
  text-align: right;
}

.merge-summary strong {
  font-size: 18px;
  line-height: 1;
}

.merge-summary span {
  color: var(--app-text-muted);
  font-size: 12px;
}

.merge-paths {
  display: grid;
  grid-template-columns: repeat(4, minmax(150px, 1fr)) auto;
  align-items: end;
  gap: 4px;
  min-height: 26px;
  padding: 4px 6px;
  border: 1px solid var(--app-border);
  border-radius: 0;
  background: var(--app-surface);
}

.merge-paths label {
  display: grid;
  gap: 2px;
  min-width: 0;
}

.merge-path-footer {
  display: block;
  min-height: 11px;
  margin-top: 1px;
  color: var(--od-muted, #6b7280);
  font-size: 10px;
  line-height: 11px;
}

.merge-paths label span {
  color: var(--app-text-muted);
  font-size: 11px;
}

.merge-paths input {
  width: 100%;
  height: 22px;
  padding: 0 6px;
  overflow: hidden;
  border: 1px solid var(--app-border);
  border-radius: 2px;
  background: var(--app-bg);
  color: var(--app-text);
  font-size: 11px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.merge-actions {
  display: flex;
  justify-content: flex-end;
}

.merge-open-status,
.merge-plan,
.conflict-panel {
  display: grid;
  gap: 4px;
  padding: 4px 6px;
  border: 1px solid var(--app-border);
  border-radius: 0;
  background: var(--app-surface);
}

.merge-open-status {
  color: var(--app-text-muted);
  font-size: 12px;
}

.merge-plan header,
.conflict-panel header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.merge-plan header strong,
.conflict-panel header strong {
  font-size: 13px;
}

.merge-plan header span,
.conflict-panel header span {
  min-width: 0;
  overflow: hidden;
  color: var(--app-text-muted);
  font-size: 12px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.merge-plan-table {
  display: grid;
  overflow: auto;
  border: 1px solid var(--app-border);
  border-radius: 0;
}

.merge-plan-row {
  display: grid;
  grid-template-columns:
    44px minmax(150px, 0.75fr) minmax(170px, 1fr) minmax(170px, 1fr) minmax(170px, 1fr)
    140px minmax(220px, 1fr);
  min-width: 1124px;
  border-bottom: 1px solid var(--app-border);
  color: var(--app-text);
  font-size: 12px;
  cursor: pointer;
}

.merge-plan-row:last-child {
  border-bottom: 0;
}

.merge-plan-row span,
.merge-plan-row strong {
  min-width: 0;
  padding: 4px 8px;
  overflow: hidden;
  border-right: 1px solid var(--app-border);
  text-overflow: ellipsis;
  white-space: nowrap;
}

.merge-plan-row span:last-child {
  border-right: 0;
}

.merge-plan-head {
  background: var(--app-surface-muted);
  color: var(--app-text-muted);
  font-weight: 700;
}

.merge-plan-row.conflict strong {
  color: var(--diff-deleted-fg);
}

.conflict-panel ul {
  display: grid;
  gap: 8px;
  margin: 0;
  padding: 0;
  list-style: none;
}

.conflict-panel li {
  display: grid;
  grid-template-columns:
    minmax(120px, 0.5fr) minmax(200px, 1fr) repeat(3, minmax(120px, 0.7fr))
    130px;
  gap: 8px;
  padding: 8px;
  border: 1px solid var(--diff-deleted-fg);
  border-radius: 6px;
  background: var(--app-surface-muted);
  color: var(--app-text-muted);
  font-size: 12px;
}

.conflict-panel li strong {
  color: var(--app-text);
}

.conflict-panel li span {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

@media (width <= 1180px) {
  .merge-paths {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .merge-actions {
    justify-content: flex-start;
  }
}

@media (width <= 760px) {
  .merge-header,
  .merge-paths,
  .merge-summary,
  .conflict-panel li {
    grid-template-columns: 1fr;
  }

  .merge-header {
    display: grid;
  }

  .merge-summary div {
    text-align: left;
  }
}

.folder-merge-peek-panel {
  display: grid;
  gap: 2px;
  padding: 2px 6px 4px;
  border: 1px solid var(--app-border);
  border-radius: 0;
  background: var(--app-surface);
  font-size: 11px;
}

.folder-merge-peek-panel header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 4px;
  min-height: 20px;
}

.folder-merge-peek-panel dl {
  display: grid;
  gap: 2px;
  margin: 0;
}

.folder-merge-peek-panel dt {
  color: var(--app-text-muted);
  font-size: 10px;
  line-height: 12px;
}

.folder-merge-peek-panel dd {
  margin: 0;
  font-size: 11px;
  line-height: 14px;
}

.merge-plan-row.selected {
  outline: 1px solid var(--app-accent);
  background: color-mix(in srgb, var(--app-accent) 12%, transparent);
}

.merge-chrome-panel {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 4px 8px;
  min-height: 22px;
  padding: 2px 6px;
  border: 1px solid var(--app-border);
  border-radius: 2px;
  background: var(--app-surface);
  font-size: 11px;
}

.merge-chrome-panel button {
  height: 22px;
  padding: 0 8px;
  border: 1px solid var(--app-border);
  border-radius: 2px;
  background: var(--app-bg);
  color: var(--app-text);
  font-size: 11px;
  cursor: pointer;
}

.merge-select-cell {
  display: flex;
  align-items: center;
}

.folder-filter-chrome {
  align-items: center;
  min-height: 36px;
  padding: 1px 0;
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
  grid-template-rows: 16px auto;
  align-content: center;
  justify-items: center;
  box-sizing: border-box;
  min-width: 44px;
  max-width: 56px;
  height: 36px;
  padding: 1px 4px;
  border: 0;
  border-right: 1px solid #c9cdd3;
  background: transparent;
  color: #1a1a1a;
  font-size: 10px;
  line-height: 11px;
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
  font-size: 11px;
  white-space: nowrap;
}

.folder-filter-pattern {
  flex: 1 1 auto;
  min-width: 0;
  height: 22px;
  padding: 0 6px;
  border: 1px solid #bfc4cc;
  border-radius: 2px;
  background: #ffffff;
  color: #111111;
  font-size: 11px;
}
</style>
