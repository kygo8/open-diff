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
  FolderMergeActionKind,
  FolderMergeActionOverride,
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
import { useFolderMenuSelectionStore } from '@/stores/folderMenuSelection'
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
import SessionPathActions from '@/components/workbench/SessionPathActions.vue'
import { createChildCompareLaunch } from '@/app/childSession'
import { openPathExternal, revealPathInOs } from '@/api/integration'
import { explorerRevealPath, explorerSelectTargetPath } from '@/app/folderCompareExtraActions'
import { buildCopyToOutputOverrides } from '@/app/folderMergeCopyToOutput'
import {
  loadFolderMergeDisplay,
  mergeRowMatchesViewPreset,
  saveFolderMergeDisplay,
  type FolderMergeViewPreset,
} from '@/app/folderMergeDisplay'

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
const folderMenuSelection = useFolderMenuSelectionStore()
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
const initialMergeDisplay = loadFolderMergeDisplay()
const mergeViewPreset = ref<FolderMergeViewPreset>(initialMergeDisplay.viewPreset)
const alwaysShowFolders = ref(initialMergeDisplay.alwaysShowFolders)
const showCenterPane = ref(initialMergeDisplay.showCenterPane)
const compareToOutput = ref(initialMergeDisplay.compareToOutput)
const flatStructure = ref(false)
const loadTimeSeconds = ref<number | null>(null)
const showPeek = ref(false)
const peekTab = ref<'path' | 'sides' | 'action'>('path')
const showMergeRules = ref(false)
const selectedPlanRowId = ref('')
const mergeActionOptions: FolderMergeActionKind[] = [
  'Keep output',
  'Copy left to output',
  'Copy right to output',
  'Delete output',
  'Mark conflict',
]
const mergeActionOverrides = ref<FolderMergeActionOverride[]>([])
const pendingMergeSafetyRows = ref<FolderMergePlanRow[]>([])
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
const showSessionInfo = ref(false)
const checkedRowIds = ref<Set<string>>(new Set())

watch(
  [checkedRowIds, selectedPlanRowId],
  () => {
    folderMenuSelection.setHasSelection(
      checkedRowIds.value.size > 0 || Boolean(selectedPlanRowId.value),
    )
  },
  { immediate: true },
)

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

  rows = rows.filter((row) =>
    mergeRowMatchesViewPreset(row, {
      viewPreset: mergeViewPreset.value,
      alwaysShowFolders: alwaysShowFolders.value,
    }),
  )

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

function selectVisibleMergeNewer(): void {
  const ids = visiblePlanRows.value
    .filter((row) => Boolean(row.conflict) || row.action !== 'Keep output')
    .map((row) => row.id)

  checkedRowIds.value = new Set(ids)
  lastSelectionAction.value = t('status.selectedRowCount', {
    count: ids.length,
    action: t('ui.selectNewer'),
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

function compareMergeContentsSelected(): void {
  const row = mergeSelectedRow()

  if (!row) {
    lastSelectionAction.value = t('status.compareContentsNeedsFile')

    return
  }

  const left = leftPath.value ? joinMergeSidePath(leftPath.value, row.path) : ''
  const right = rightPath.value ? joinMergeSidePath(rightPath.value, row.path) : ''

  if (!left || !right) {
    lastSelectionAction.value = t('status.compareContentsNeedsFile')

    return
  }

  if (row.left.kind !== 'File' && row.right.kind !== 'File') {
    lastSelectionAction.value = t('status.compareContentsNeedsFile')

    return
  }

  const launch = createChildCompareLaunch(left, right)

  if (!launch) {
    lastSelectionAction.value = t('status.compareContentsNoRoute')

    return
  }

  lastSelectionAction.value = `${t('ui.compareContents')} -> ${launch.route}`
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

function stepSessionFindFilename(direction: 1 | -1): void {
  const query = selectNameFilter.value.trim().toLowerCase()

  if (!query) {
    openMergeFindFilename()

    return
  }

  const matches = visiblePlanRows.value.filter((row) => row.path.toLowerCase().includes(query))

  if (matches.length === 0) {
    openMergeFindFilename()

    return
  }

  const currentId = selectedPlanRowId.value
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
  selectedPlanRowId.value = next.id
  lastSelectionAction.value = t('status.selectedRowCount', {
    count: 1,
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
    selectedPlanRowId.value = rowId
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
const includedMergeRows = computed(() =>
  planRows.value.filter((row) => !excludedRowIds.value.has(row.id)),
)
const excludedMergeRowCount = computed(() => excludedRowIds.value.size)
const sameOkCount = computed(
  () => includedMergeRows.value.filter((row) => row.action === 'Keep output').length,
)
const conflicts = computed(() =>
  planRows.value.flatMap((row) => (row.conflict ? [row.conflict] : [])),
)
const summary = computed(() => {
  if (excludedRowIds.value.size === 0) {
    return {
      actions: plan.value?.summary.actions ?? 0,
      automatic: plan.value?.summary.automatic ?? 0,
      conflicts: plan.value?.summary.conflicts ?? 0,
    }
  }

  const conflictCount = includedMergeRows.value.filter((row) => Boolean(row.conflict)).length

  return {
    actions: includedMergeRows.value.length,
    automatic: includedMergeRows.value.length - conflictCount,
    conflicts: conflictCount,
  }
})
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
  folderMenuSelection.reset()
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
  mergeActionOverrides.value = []
  pendingMergeSafetyRows.value = []
  lastSelectionAction.value = ''
  mergeOpenError.value = ''
  if (plan.value.rows.length > 0) {
    selectedPlanRowId.value = plan.value.rows[0].id
  }
}

function mergeCopyToOutputTargetRows(): FolderMergePlanRow[] {
  const checked = visiblePlanRows.value.filter((row) => checkedRowIds.value.has(row.id))

  if (checked.length > 0) {
    return checked
  }

  const selected = mergeSelectedRow()

  return selected ? [selected] : []
}

function applyCopyToOutputToSelection(): void {
  if (!plan.value) {
    return
  }

  const targets = mergeCopyToOutputTargetRows()
  const overrides = buildCopyToOutputOverrides(targets)

  if (overrides.length === 0) {
    return
  }

  showMergeSelect.value = true

  const byPath = new Map(overrides.map((item) => [item.relativePath, item.action]))

  plan.value = {
    ...plan.value,
    rows: plan.value.rows.map((row) => {
      const action = byPath.get(row.path)

      if (!action) {
        return row
      }

      return {
        ...row,
        action,
        conflict: undefined,
        detail: action,
      }
    }),
  }

  const existing = new Map(
    mergeActionOverrides.value.map((item) => [item.relativePath, item] as const),
  )

  for (const item of overrides) {
    existing.set(item.relativePath, item)
  }

  mergeActionOverrides.value = [...existing.values()]

  const sampleAction = overrides[0]?.action ?? 'Copy left to output'

  lastSelectionAction.value = t('status.mergeCopyToOutputApplied', {
    action: folderMergeActionLabel(sampleAction),
    count: overrides.length,
  })
  pendingMergeSafetyRows.value = []
}

function applyMergeRowAction(row: FolderMergePlanRow, action: FolderMergeActionKind): void {
  if (!plan.value) {
    return
  }

  plan.value = {
    ...plan.value,
    rows: plan.value.rows.map((item) => {
      if (item.id !== row.id) {
        return item
      }

      return {
        ...item,
        action,
        conflict: action === 'Mark conflict' ? item.conflict : undefined,
        detail: action,
      }
    }),
  }

  const existing = new Map(
    mergeActionOverrides.value.map((item) => [item.relativePath, item] as const),
  )

  existing.set(row.path, { relativePath: row.path, action })
  mergeActionOverrides.value = [...existing.values()]
  pendingMergeSafetyRows.value = []
}

function onMergeRowActionChange(row: FolderMergePlanRow, event: Event): void {
  applyMergeRowAction(row, (event.target as HTMLSelectElement).value as FolderMergeActionKind)
}

function applyMergeActionToRows(rows: FolderMergePlanRow[], action: FolderMergeActionKind): void {
  if (!plan.value || rows.length === 0) {
    return
  }

  const ids = new Set(rows.map((row) => row.id))

  plan.value = {
    ...plan.value,
    rows: plan.value.rows.map((item) => {
      if (!ids.has(item.id)) {
        return item
      }

      return {
        ...item,
        action,
        conflict: action === 'Mark conflict' ? item.conflict : undefined,
        detail: action,
      }
    }),
  }

  const existing = new Map(
    mergeActionOverrides.value.map((item) => [item.relativePath, item] as const),
  )

  for (const row of rows) {
    existing.set(row.path, { relativePath: row.path, action })
  }

  mergeActionOverrides.value = [...existing.values()]
  pendingMergeSafetyRows.value = []
  lastSelectionAction.value = t('status.mergeCopyToOutputApplied', {
    action: folderMergeActionLabel(action),
    count: rows.length,
  })
}

function applyMergeActionToAll(): void {
  const selected = mergeSelectedRow()

  if (!selected) {
    return
  }

  applyMergeActionToRows(visiblePlanRows.value, selected.action)
}

function skipRemainingMergeRows(): void {
  applyMergeActionToRows(visiblePlanRows.value, 'Keep output')
}

function isWriteMergeAction(action: FolderMergeActionKind): boolean {
  return (
    action === 'Copy left to output' ||
    action === 'Copy right to output' ||
    action === 'Delete output'
  )
}

function collectMergeSafetyRows(): FolderMergePlanRow[] {
  return planRows.value.filter((row) => {
    if (excludedRowIds.value.has(row.id)) {
      return false
    }

    if (row.action === 'Mark conflict') {
      return true
    }

    return isWriteMergeAction(row.action) && settings.confirmBeforeCopy
  })
}

function currentMergeOverrides(): FolderMergeActionOverride[] {
  const overrides = new Map(
    mergeActionOverrides.value.map((item) => [item.relativePath, item] as const),
  )

  for (const row of planRows.value) {
    if (excludedRowIds.value.has(row.id)) {
      overrides.set(row.path, { relativePath: row.path, action: 'Keep output' })
    }
  }

  return [...overrides.values()]
}

async function runFolderMerge(): Promise<void> {
  if (!hasPlan.value || mergeExecuting.value) {
    return
  }

  const riskyRows = collectMergeSafetyRows()

  if (riskyRows.length > 0) {
    pendingMergeSafetyRows.value = riskyRows

    return
  }

  await executeMergeNow()
}

function confirmMergeSafety(): void {
  pendingMergeSafetyRows.value = []
  void executeMergeNow()
}

function cancelMergeSafety(): void {
  pendingMergeSafetyRows.value = []
}

async function executeMergeNow(): Promise<void> {
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
      overrides: currentMergeOverrides(),
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

function mergeRowExecutionStatus(row: FolderMergePlanRow): string {
  return execution.value?.rows.find((item) => item.path === row.path)?.status ?? '—'
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

function persistMergeDisplay(): void {
  saveFolderMergeDisplay({
    viewPreset: mergeViewPreset.value,
    alwaysShowFolders: alwaysShowFolders.value,
    showCenterPane: showCenterPane.value,
    compareToOutput: compareToOutput.value,
  })
}

function applyMergeViewPreset(preset: FolderMergeViewPreset): void {
  mergeViewPreset.value = preset
  if (preset === 'all') {
    compareToOutput.value = false
  }
  persistMergeDisplay()
}

function mergeConflictRows(): FolderMergePlanRow[] {
  return planRows.value.filter(
    (row) =>
      !excludedRowIds.value.has(row.id) &&
      (row.action === 'Mark conflict' || Boolean(row.conflict)),
  )
}

function stepMergeConflict(direction: 1 | -1): void {
  const matches = mergeConflictRows()

  if (matches.length === 0) {
    return
  }

  applyMergeViewPreset('conflicts')

  const currentId = selectedPlanRowId.value
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
  selectPlanRow(next)
  lastSelectionAction.value = t('status.selectedRowCount', {
    count: 1,
    action: t('ui.conflicts'),
  })
}

function toggleCompareToOutput(): void {
  compareToOutput.value = !compareToOutput.value
  mergeViewPreset.value = compareToOutput.value ? 'changes' : 'all'
  persistMergeDisplay()
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
      createBackup: settings.createBackupOnReportExport,
      backupRetention: settings.backupRetentionCount,
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

async function browseMergeFolderSide(side: 'left' | 'base' | 'right' | 'output'): Promise<void> {
  const selected = await pickNativePath({ directory: true })

  if (!selected) {
    return
  }

  if (side === 'left') {
    leftPath.value = selected
  } else if (side === 'base') {
    basePath.value = selected
  } else if (side === 'right') {
    rightPath.value = selected
  } else {
    outputPath.value = selected
  }

  recordFolderPathCommit()
}

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
      case 'save-report':
        void exportFolderMergeReport()
        break
      case 'export-settings':
      case 'filters':
        showMergeFilters.value = !showMergeFilters.value
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
        showMergeRules.value = true
        break
      case 'show-all':
        setImportanceFilter('all')
        applyMergeViewPreset('all')
        break
      case 'show-differences':
        setImportanceFilter('diffs')
        applyMergeViewPreset('changes')
        break
      case 'show-same':
        setImportanceFilter('same')
        applyMergeViewPreset('all')
        break
      case 'show-changes':
        applyMergeViewPreset('changes')
        break
      case 'show-conflicts':
        applyMergeViewPreset('conflicts')
        break
      case 'always-show-folders':
        alwaysShowFolders.value = !alwaysShowFolders.value
        persistMergeDisplay()
        break
      case 'toggle-center-pane':
        showCenterPane.value = !showCenterPane.value
        persistMergeDisplay()
        break
      case 'compare-to-output':
        toggleCompareToOutput()
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
      case 'suppress-filters':
        break
      case 'only-compare-files':
        filesOnlyFilter.value = true
        flatStructure.value = false
        break
      case 'compare-files-and-folder-structure':
        filesOnlyFilter.value = false
        flatStructure.value = false
        break
      case 'ignore-folder-structure':
        flatStructure.value = true
        break
      case 'compare-parent-folders':
        upOneMergeLevel()
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
      case 'select-newer':
        showMergeSelect.value = true
        selectVisibleMergeNewer()
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
      case 'find-next-filename':
        stepSessionFindFilename(1)
        break
      case 'find-previous-filename':
        stepSessionFindFilename(-1)
        break
      case 'full-refresh':
        void buildFolderMergePlan()
        break
      case 'toggle-log':
        toggleMergeLogPanel()
        break
      case 'session-info':
        showSessionInfo.value = !showSessionInfo.value
        break
      case 'toggle-legend':
        break
      case 'new-folder':
        openNewFolderPanel()
        break
      case 'copy-to-output':
        applyCopyToOutputToSelection()
        break
      case 'merge-execute':
        void runFolderMerge()
        break
      case 'compare-contents':
        compareMergeContentsSelected()
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
      case 'synchronize':
      case 'ignored':
      case 'align-with':
      case 'break-alignment':
      case 'file-compare-report':
      case 'copy-filename':
        break
      case 'swap':
        swapMergeSides()
        break
      case 'next-conflict':
        stepMergeConflict(1)
        break
      case 'previous-conflict':
        stepMergeConflict(-1)
        break
      case 'undo':
      case 'workspace-load':
      case 'sync-now':
      case 'workspace-save':
      case 'run-script':
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
        data-filters-density="capture-1to1"
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

      <section
        class="merge-paths"
        :class="{ 'merge-paths-no-center': !showCenterPane }"
      >
        <label>
          <span>{{ $t('ui.leftFolder') }}</span>
          <div class="path-field-row">
            <input
              v-model="leftPath"
              class="path-input"
              data-testid="folder-merge-left-path"
              :title="leftPath"
              @keydown.enter.prevent="recordFolderPathCommit"
              @change="recordFolderPathCommit"
            />
            <SessionPathActions
              browse-test-id="folder-merge-browse-left"
              :show-save="false"
              @browse="browseMergeFolderSide('left')"
            />
          </div>
          <span
            class="merge-path-footer"
            data-testid="folder-merge-left-editing-status"
            >{{ $t('status.editingDisabled') }}</span
          >
        </label>
        <label
          v-if="showCenterPane"
          data-testid="folder-merge-center-pane"
        >
          <span>{{ $t('ui.baseFolder') }}</span>
          <div class="path-field-row">
            <input
              v-model="basePath"
              class="path-input"
              data-testid="folder-merge-base-path"
              :title="basePath"
              @keydown.enter.prevent="recordFolderPathCommit"
              @change="recordFolderPathCommit"
            />
            <SessionPathActions
              browse-test-id="folder-merge-browse-base"
              :show-save="false"
              @browse="browseMergeFolderSide('base')"
            />
          </div>
          <span
            class="merge-path-footer"
            data-testid="folder-merge-base-editing-status"
            >{{ $t('status.editingDisabled') }}</span
          >
        </label>
        <label>
          <span>{{ $t('ui.rightFolder') }}</span>
          <div class="path-field-row">
            <input
              v-model="rightPath"
              class="path-input"
              data-testid="folder-merge-right-path"
              :title="rightPath"
              @keydown.enter.prevent="recordFolderPathCommit"
              @change="recordFolderPathCommit"
            />
            <SessionPathActions
              browse-test-id="folder-merge-browse-right"
              :show-save="false"
              @browse="browseMergeFolderSide('right')"
            />
          </div>
          <span
            class="merge-path-footer"
            data-testid="folder-merge-right-editing-status"
            >{{ $t('status.editingDisabled') }}</span
          >
        </label>
        <label>
          <span>{{ $t('ui.outputFolder') }}</span>
          <div class="path-field-row">
            <input
              v-model="outputPath"
              class="path-input"
              data-testid="folder-merge-output-path"
              :title="outputPath"
            />
            <SessionPathActions
              browse-test-id="folder-merge-browse-output"
              :show-save="false"
              @browse="browseMergeFolderSide('output')"
            />
          </div>
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
          <NButton
            size="small"
            secondary
            data-testid="folder-merge-apply-to-all"
            :disabled="!selectedPlanRow || mergeExecuting"
            @click="applyMergeActionToAll"
            >{{ $t('ui.apply') }} {{ $t('ui.all') }}</NButton
          >
          <NButton
            size="small"
            secondary
            data-testid="folder-merge-skip-remaining"
            :disabled="!hasPlan || mergeExecuting"
            @click="skipRemainingMergeRows"
            >{{ $t('ui.leaveAlone') }}</NButton
          >
        </div>
      </section>

      <p
        v-if="compareToOutput"
        class="merge-open-status"
        data-testid="folder-merge-compare-to-output"
      >
        {{ $t('ui.compareToOutputHint') }}
      </p>

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
        <ul
          v-if="execution?.rows.length"
          data-testid="folder-merge-execution-rows"
        >
          <li
            v-for="row in execution.rows"
            :key="row.path"
            :data-testid="`folder-merge-execution-row-${row.path}`"
          >
            <strong>{{ row.status }}</strong>
            <span>{{ row.path }}</span>
            <span>{{ row.detail }}</span>
          </li>
        </ul>
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
        v-show="showSessionInfo"
        class="folder-session-info-panel display-filters"
        data-testid="folder-merge-session-info"
      >
        <h3>{{ $t('ui.folderMergeInfo') }}</h3>
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
            <dd>{{ planRows.length }}</dd>
          </div>
        </dl>
        <button
          type="button"
          data-testid="folder-merge-session-info-close"
          @click="showSessionInfo = false"
        >
          {{ $t('ui.close') }}
        </button>
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
        <section
          v-if="pendingMergeSafetyRows.length > 0"
          class="merge-safety-confirmation"
          data-testid="folder-merge-safety-confirmation"
        >
          <div>
            <strong>{{ $t('ui.mergePlan') }}</strong>
            <span>{{
              $t('status.overwriteDeleteOperationsNeedReview', {
                count: pendingMergeSafetyRows.length,
              })
            }}</span>
            <span
              v-if="excludedMergeRowCount > 0"
              data-testid="folder-merge-excluded-count"
            >
              {{ $t('ui.suppressed') }}: {{ excludedMergeRowCount }}
            </span>
          </div>
          <ul>
            <li
              v-for="row in pendingMergeSafetyRows"
              :key="row.id"
            >
              <strong>{{ folderMergeActionLabel(row.action) }}</strong>
              <span>{{ row.path }}</span>
            </li>
          </ul>
          <div class="merge-safety-actions">
            <NButton
              size="small"
              secondary
              data-testid="folder-merge-cancel-safety"
              @click="cancelMergeSafety"
              >{{ $t('ui.cancel') }}</NButton
            >
            <NButton
              size="small"
              type="primary"
              data-testid="folder-merge-confirm-safety"
              @click="confirmMergeSafety"
              >{{ $t('ui.merge') }}</NButton
            >
          </div>
        </section>
        <div class="merge-plan-table">
          <div class="merge-plan-row merge-plan-head">
            <span>{{ $t('ui.select') }}</span>
            <span>{{ $t('ui.path') }}</span>
            <span>{{ $t('ui.base') }}</span>
            <span>{{ $t('ui.left') }}</span>
            <span>{{ $t('ui.right') }}</span>
            <span>{{ $t('ui.action') }}</span>
            <span>{{ $t('ui.detail') }}</span>
            <span>{{ $t('ui.status') }}</span>
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
            <label
              class="merge-action-cell"
              @click.stop
            >
              <span class="sr-only">{{ $t('ui.action') }}</span>
              <select
                :value="row.action"
                :data-testid="`folder-merge-action-${row.id}`"
                @change="onMergeRowActionChange(row, $event)"
              >
                <option
                  v-for="action in mergeActionOptions"
                  :key="action"
                  :value="action"
                >
                  {{ folderMergeActionLabel(action) }}
                </option>
              </select>
            </label>
            <span>{{ row.detail }}</span>
            <span :data-testid="`folder-merge-row-status-${row.id}`">{{
              mergeRowExecutionStatus(row)
            }}</span>
          </div>
        </div>
      </section>

      <section
        v-if="showPeek"
        class="folder-merge-peek-panel"
        data-peek-density="capture-1to1"
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
          <dl v-show="peekTab === 'path'">
            <div>
              <dt>{{ $t('ui.path') }}</dt>
              <dd data-testid="folder-merge-peek-path">{{ selectedPlanRow.path }}</dd>
            </div>
          </dl>
          <div
            v-show="peekTab === 'sides'"
            class="peek-dual-columns"
            data-testid="folder-merge-peek-dual"
          >
            <article class="peek-column">
              <strong>{{ $t('ui.left') }}</strong>
              <dl>
                <div>
                  <dt>{{ $t('ui.left') }}</dt>
                  <dd data-testid="folder-merge-peek-left">
                    {{ sideLabel(selectedPlanRow.left) }}
                  </dd>
                </div>
                <div v-if="showCenterPane">
                  <dt>{{ $t('ui.base') }}</dt>
                  <dd data-testid="folder-merge-peek-base">
                    {{ sideLabel(selectedPlanRow.base) }}
                  </dd>
                </div>
              </dl>
            </article>
            <article class="peek-column">
              <strong>{{ $t('ui.right') }}</strong>
              <dl>
                <div>
                  <dt>{{ $t('ui.right') }}</dt>
                  <dd data-testid="folder-merge-peek-right">
                    {{ sideLabel(selectedPlanRow.right) }}
                  </dd>
                </div>
                <div v-if="showCenterPane">
                  <dt>{{ $t('ui.base') }}</dt>
                  <dd>{{ sideLabel(selectedPlanRow.base) }}</dd>
                </div>
              </dl>
            </article>
          </div>
          <dl v-show="peekTab === 'action'">
            <div>
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
  padding: 2px 4px;
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
  padding: 2px 4px;
  border: 1px solid var(--app-border);
  border-radius: 0;
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

.merge-paths {
  display: grid;
  grid-template-columns: repeat(4, minmax(150px, 1fr)) auto;
  align-items: end;
  gap: 2px;
  min-height: 22px;
  padding: 2px 4px;
  border: 1px solid var(--app-border);
  border-radius: 0;
  background: var(--app-surface);
}

.merge-paths-no-center {
  grid-template-columns: repeat(3, minmax(150px, 1fr)) auto;
}

.merge-paths label {
  display: grid;
  gap: 1px;
  min-width: 0;
}

.merge-path-footer {
  display: block;
  min-height: 20px;
  margin-top: 0;
  color: var(--od-muted, #6b7280);
  font-size: 11px;
  line-height: 16px;
}

.merge-paths label span {
  color: var(--app-text-muted);
  font-size: 11px;
}

.merge-paths input {
  width: 100%;
  height: 18px;
  padding: 0 4px;
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
  gap: 2px;
  padding: 2px 4px;
  border: 1px solid var(--app-border);
  border-radius: 0;
  background: var(--app-surface);
}

.merge-open-status {
  color: var(--app-text-muted);
  font-size: 11px;
  line-height: 14px;
}

.merge-open-status ul {
  margin: 2px 0 0;
  padding-left: 14px;
}

.merge-plan header,
.conflict-panel header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}

.merge-plan header strong,
.conflict-panel header strong {
  font-size: 12px;
  line-height: 16px;
}

.merge-plan header span,
.conflict-panel header span {
  min-width: 0;
  overflow: hidden;
  color: var(--app-text-muted);
  font-size: 11px;
  line-height: 14px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.merge-plan-table {
  display: grid;
  overflow: auto;
  border: 1px solid var(--app-border);
  border-radius: 0;
}

.merge-safety-confirmation {
  display: grid;
  grid-template-columns: minmax(180px, 0.8fr) minmax(260px, 1fr) auto;
  align-items: center;
  gap: 6px;
  padding: 2px 4px;
  border: 1px solid var(--diff-deleted-fg);
  border-radius: 0;
  background: var(--app-surface-muted);
}

.merge-safety-confirmation div {
  display: grid;
  gap: 2px;
}

.merge-safety-confirmation strong {
  font-size: 12px;
}

.merge-safety-confirmation span {
  color: var(--app-text-muted);
  font-size: 12px;
}

.merge-safety-confirmation ul {
  display: grid;
  gap: 4px;
  min-width: 0;
  margin: 0;
  padding: 0;
  list-style: none;
}

.merge-safety-confirmation li {
  display: grid;
  grid-template-columns: minmax(90px, auto) minmax(0, 1fr);
  gap: 8px;
  min-width: 0;
}

.merge-safety-confirmation li span {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.merge-safety-actions {
  display: inline-flex;
  gap: 4px;
}

.merge-plan-row {
  display: grid;
  grid-template-columns:
    44px minmax(150px, 0.75fr) minmax(170px, 1fr) minmax(170px, 1fr) minmax(170px, 1fr)
    minmax(180px, 0.8fr) minmax(220px, 1fr) 88px;
  min-width: 1212px;
  border-bottom: 1px solid var(--app-border);
  color: var(--app-text);
  font-size: 11px;
  cursor: pointer;
}

.merge-plan-row:last-child {
  border-bottom: 0;
}

.merge-plan-row span,
.merge-plan-row strong {
  min-width: 0;
  padding: 1px 4px;
  overflow: hidden;
  border-right: 1px solid var(--app-border);
  font-size: 11px;
  line-height: 16px;
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

.merge-action-cell {
  display: grid;
  min-width: 0;
  padding: 1px 4px;
  border-right: 1px solid var(--app-border);
}

.merge-action-cell select {
  width: 100%;
  min-height: 18px;
  padding: 0 2px;
  border: 1px solid var(--app-border);
  border-radius: 0;
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

.conflict-panel ul {
  display: grid;
  gap: 4px;
  margin: 0;
  padding: 0;
  list-style: none;
}

.conflict-panel li {
  display: grid;
  grid-template-columns:
    minmax(120px, 0.5fr) minmax(200px, 1fr) repeat(3, minmax(120px, 0.7fr))
    130px;
  gap: 4px;
  padding: 2px 4px;
  border: 1px solid var(--diff-deleted-fg);
  border-radius: 0;
  background: var(--app-surface-muted);
  color: var(--app-text-muted);
  font-size: 11px;
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
  gap: 0;
  padding: 0;
  border: 1px solid #c9cdd3;
  border-radius: 0;
  background: #ffffff;
  font-size: 11px;
  line-height: 14px;
}

.folder-merge-peek-panel header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 4px;
  min-height: 20px;
  margin: 0;
  padding: 2px 4px;
  border-bottom: 1px solid #dfe3e8;
}

.folder-merge-peek-panel dl {
  display: grid;
  gap: 0;
  margin: 0;
}

.folder-merge-peek-panel dt {
  color: #5a6270;
  font-size: 11px;
  line-height: 14px;
}

.folder-merge-peek-panel dd {
  margin: 0;
  color: #000000;
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
  gap: 2px 4px;
  min-height: 18px;
  padding: 2px 4px;
  border: 1px solid var(--app-border);
  border-radius: 2px;
  background: var(--app-surface);
  font-size: 11px;
}

.merge-chrome-panel button {
  height: 18px;
  padding: 0 5px;
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
