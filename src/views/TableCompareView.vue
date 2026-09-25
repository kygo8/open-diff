<script setup lang="ts">
import { computed, onMounted, ref, watch, watchEffect } from 'vue'
import { useRouter } from 'vue-router'
import { compareTable, readTextFile, saveTextFile } from '@/api/diff'
import { buildTableReportText, defaultTableReportOutputPath } from '@/app/tableReport'
import type {
  FileStamp,
  TableCompareChangedCell,
  TableCompareRequest,
  TableCompareResponse,
} from '@/types/diff'
import { pickNativePath } from '@/app/filePicker'
import PathMetaFooter from '@/components/workbench/PathMetaFooter.vue'
import SessionPathActions from '@/components/workbench/SessionPathActions.vue'
import WorkbenchShell from '@/components/workbench/WorkbenchShell.vue'
import WorkbenchInspector from '@/components/workbench/WorkbenchInspector.vue'
import StatusSummaryGrid from '@/components/workbench/StatusSummaryGrid.vue'
import { buildTableCompareToolbar, pathPairTitle } from '@/app/sessionToolbars'
import {
  preferredSheetSelection,
  tableFormatFromPaths,
  usesWorkbookSheets,
} from '@/app/tableSheets'
import { useSessionLaunchStore } from '@/stores/sessionLaunch'
import { useTabsStore } from '@/stores/tabs'
import { useStatusBarStore } from '@/stores/statusBar'
import { elapsedSecondsSince } from '@/app/statusBarPhrases'
import { useViewActionsStore } from '@/stores/viewActions'
import { useSettingsStore } from '@/stores/settings'
import { useI18n } from '@/i18n'
import SessionSettingsDialog from '@/components/session/SessionSettingsDialog.vue'
import {
  loadTableCompareSessionOptions,
  saveTableCompareSessionOptions,
  type TableCompareSessionOptions,
} from '@/app/tableCompareSessionOptions'

interface TableColumnModel {
  name: string
  side: 'left' | 'right'
}

interface ColumnMappingModel {
  leftColumn?: string
  rightColumn?: string
  source: 'Automatic' | 'Manual' | 'Left Only' | 'Right Only'
}

interface VirtualGridCell {
  key: string
  columnKey: string
  testId: string
  text: string
  rightText?: string
}

interface VirtualGridRow {
  key: string
  cells: VirtualGridCell[]
}

interface VirtualGridColumn {
  key: string
  label: string
}

interface TableCellLocation {
  key: string
  text: string
}

const settings = useSettingsStore()
const leftCsv = ref('')
const rightCsv = ref('')
const leftPath = ref('')
const rightPath = ref('')
const leftFileStamp = ref<FileStamp | null>(null)
const rightFileStamp = ref<FileStamp | null>(null)
const leftEncoding = ref('')
const rightEncoding = ref('')
const tableFormat = ref<NonNullable<TableCompareRequest['format']>>('csv')
const leftSheet = ref('')
const rightSheet = ref('')
const leftSheets = ref<string[]>([])
const rightSheets = ref<string[]>([])
const initialTableOptions = loadTableCompareSessionOptions()
const keyColumnsInput = ref(initialTableOptions.keyColumns)
const delimiterInput = ref(initialTableOptions.delimiter)
const ignoreCase = ref(initialTableOptions.ignoreCase)
const firstRowIsHeader = ref(initialTableOptions.firstRowIsHeader)
const showSessionSettings = ref(false)
const suppressSessionOptionRecompare = ref(false)
const viewActions = useViewActionsStore()
const suppressSheetCompare = ref(false)
const sessionLaunch = useSessionLaunchStore()
const tabs = useTabsStore()
const router = useRouter()
const { t } = useI18n()
const leftColumns = ref<TableColumnModel[]>([])
const rightColumns = ref<TableColumnModel[]>([])
const virtualGridColumns = ref<VirtualGridColumn[]>([])
const comparedRows = ref<VirtualGridRow[] | null>(null)
const manualLeftColumn = ref('')
const manualRightColumn = ref('')
const manualMappings = ref<ColumnMappingModel[]>([])
const leftGridViewport = ref<HTMLElement | null>(null)
const rightGridViewport = ref<HTMLElement | null>(null)
const ignoredColumnKeys = ref<string[]>([...initialTableOptions.ignoredColumns])
const tableSearchQuery = ref('')
const activeDifferenceIndex = ref(0)
const loading = ref(false)
const loadTimeSeconds = ref<number | null>(null)
const statusBar = useStatusBarStore()
const error = ref('')
const reportStatus = ref('')
const tableDifferenceCells = ref<TableCellLocation[]>([])

function currentTableSessionOptions(): TableCompareSessionOptions {
  return {
    keyColumns: keyColumnsInput.value,
    delimiter: delimiterInput.value,
    ignoredColumns: [...ignoredColumnKeys.value],
    ignoreCase: ignoreCase.value,
    firstRowIsHeader: firstRowIsHeader.value,
  }
}

function persistTableSessionOptions(): void {
  saveTableCompareSessionOptions(currentTableSessionOptions())
}

function openTableSessionSettings(): void {
  showSessionSettings.value = true
}

function applyTableSessionSettings(
  payload:
    | { kind: 'folder'; criteria: unknown }
    | { kind: 'text'; options: unknown }
    | { kind: 'table'; options: TableCompareSessionOptions }
    | { kind: 'hex'; options: unknown }
    | { kind: 'picture'; options: unknown }
    | { kind: 'media'; options: unknown }
    | { kind: 'version'; options: unknown }
    | { kind: 'registry'; options: unknown }
    | { kind: 'patch'; options: unknown },
): void {
  if (payload.kind !== 'table') {
    return
  }

  suppressSessionOptionRecompare.value = true
  keyColumnsInput.value = payload.options.keyColumns
  delimiterInput.value = payload.options.delimiter
  ignoredColumnKeys.value = [...payload.options.ignoredColumns]
  ignoreCase.value = payload.options.ignoreCase
  firstRowIsHeader.value = payload.options.firstRowIsHeader
  persistTableSessionOptions()
  suppressSessionOptionRecompare.value = false
  showSessionSettings.value = false
  if (
    comparedRows.value !== null ||
    leftCsv.value ||
    rightCsv.value ||
    (leftPath.value && rightPath.value)
  ) {
    void runTableCompare()
  }
}

watch(
  [keyColumnsInput, delimiterInput, ignoredColumnKeys, ignoreCase, firstRowIsHeader],
  () => {
    persistTableSessionOptions()
    maybeRecompareOnSessionOptionsChange()
  },
  { deep: true },
)

watch(
  () => [viewActions.sequence, viewActions.name] as const,
  ([, actionName]) => {
    if (!actionName) {
      return
    }

    switch (actionName) {
      case 'session-settings':
      case 'rules':
        openTableSessionSettings()
        break
      case 'compare':
      case 'reload':
        void runTableCompare()
        break
      case 'swap':
        swapTablePaths()
        break
      case 'previous-difference':
        goToPreviousTableDifference()
        break
      case 'next-difference':
        goToNextTableDifference()
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
        void exportTableReport()
        break
      case 'export-settings':
      case 'filters':
      case 'help-contents':
      case 'help-context':
      case 'help-support':
      case 'import-settings':
      case 'paste':
      case 'redo':
      case 'save-snapshot':
      case 'restore-factory-defaults':
      case 'save':
      case 'save-as':
      case 'show-all':
      case 'show-differences':
      case 'undo':
      case 'workspace-load':
      case 'collapse-all':
      case 'expand-all':
      case 'next-conflict':
      case 'previous-conflict':
      case 'sync-now':
      case 'browse-folder':
      case 'up-one-level':
      case 'path-back':
      case 'path-forward':
      case 'toggle-session-locked':
      case 'toggle-minor':
      case 'workspace-save':
      case 'select-all':
      case 'select-all-files':
      case 'select-orphans':
      case 'select-newer':
      case 'invert-selection':
      case 'open-selected':
      case 'open-with':
      case 'quick-compare':
      case 'exclude-selected':
      case 'refresh-selection':
      case 'show-same':
      case 'show-orphans':
      case 'show-no-orphans':
      case 'show-differences-no-orphans':
      case 'show-left-orphans':
      case 'show-right-orphans':
      case 'show-left-newer':
      case 'show-right-newer':
      case 'show-left-newer-orphans':
      case 'show-right-newer-orphans':
      case 'compare-files-and-folder-structure':
      case 'only-compare-files':
      case 'ignore-folder-structure':
      case 'always-show-folders':
      case 'show-changes':
      case 'show-conflicts':
      case 'toggle-center-pane':
      case 'compare-to-output':
      case 'suppress-filters':
      case 'compare-parent-folders':
      case 'run-script':
      case 'find-filename':
      case 'find-next-filename':
      case 'find-previous-filename':
      case 'full-refresh':
      case 'toggle-columns':
      case 'toggle-log':
      case 'toggle-legend':
      case 'toggle-toolbar':
      case 'change-attributes':
      case 'new-folder':
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
      case 'explorer':
      case 'ignored':
      case 'align-with':
      case 'break-alignment':
      case 'file-compare-report':
      case 'session-info':
      case 'copy-filename':
      case 'merge-execute':
      case 'copy-to-output':
      case 'touch-selected':
        break
    }
  },
)

onMounted(() => {
  const launch = sessionLaunch.consumeLaunch('/compare/table')

  if (!launch) {
    return
  }

  if (launch.autoRun && launch.locations.left?.uri && launch.locations.right?.uri) {
    void loadLaunchTables(launch.locations.left.uri, launch.locations.right.uri)
  }
})

const visibleGridColumns = computed<VirtualGridColumn[]>(() =>
  virtualGridColumns.value.filter((column) => !ignoredColumnKeys.value.includes(column.key)),
)
const visibleColumns = computed(() => visibleGridColumns.value.length)
const visibleRowCount = computed(() => virtualGridRows.value.length)
const virtualGridStyle = computed<Record<string, string>>(() => ({
  '--visible-columns': String(visibleColumns.value),
  '--visible-rows': String(visibleRowCount.value),
}))
const virtualGridRows = computed<VirtualGridRow[]>(() => {
  if (!comparedRows.value) {
    return []
  }

  return comparedRows.value.map((row) => ({
    ...row,
    cells: row.cells.filter((cell) => !ignoredColumnKeys.value.includes(cell.columnKey)),
  }))
})
const keyColumnIndexSet = computed(() => new Set(parseKeyColumnIndices()))
const columnRules = computed(() =>
  virtualGridColumns.value.map((column, index) => {
    const ignored = ignoredColumnKeys.value.includes(column.key)
    const isKey = keyColumnIndexSet.value.has(index)
    let status = t('status.compared')

    if (ignored) {
      status = t('ui.ignored')
    } else if (isKey) {
      status = t('ui.key')
    }

    return {
      ...column,
      index,
      ignored,
      isKey,
      importance: ignored ? t('ui.unimportant') : t('ui.important'),
      status,
    }
  }),
)
const searchableCells = computed<TableCellLocation[]>(() =>
  virtualGridRows.value.flatMap((row) =>
    row.cells.map((cell) => ({
      key: `${row.key}-${cell.columnKey}`,
      text: cell.text,
    })),
  ),
)
const tableSearchMatches = computed<TableCellLocation[]>(() => {
  const query = tableSearchQuery.value.trim().toLowerCase()

  if (!query) {
    return []
  }

  return searchableCells.value.filter((cell) => cell.text.toLowerCase().includes(query))
})
const activeTableCell = computed<TableCellLocation | undefined>(
  () => tableSearchMatches.value[0] ?? tableDifferenceCells.value[activeDifferenceIndex.value],
)
const tableSearchSummary = computed(() => {
  const count = tableSearchMatches.value.length

  return t(count === 1 ? 'status.matchCount' : 'status.matchCountPlural', { count })
})
const tableDifferenceSummary = computed(() => {
  if (tableDifferenceCells.value.length === 0) {
    return '0 / 0'
  }

  return `${String(activeDifferenceIndex.value + 1)} / ${String(tableDifferenceCells.value.length)}`
})
const columnMappings = computed<ColumnMappingModel[]>(() => {
  const usedLeft = new Set<string>()
  const usedRight = new Set<string>()
  const mappings: ColumnMappingModel[] = []

  for (const mapping of manualMappings.value) {
    if (!mapping.leftColumn || !mapping.rightColumn) {
      continue
    }

    usedLeft.add(mapping.leftColumn)
    usedRight.add(mapping.rightColumn)
    mappings.push(mapping)
  }

  for (const leftColumn of leftColumns.value) {
    if (usedLeft.has(leftColumn.name)) {
      continue
    }

    const rightColumn = rightColumns.value.find(
      (candidate) =>
        !usedRight.has(candidate.name) &&
        normalizeColumnName(candidate.name) === normalizeColumnName(leftColumn.name),
    )

    if (rightColumn) {
      usedLeft.add(leftColumn.name)
      usedRight.add(rightColumn.name)
      mappings.push({
        leftColumn: leftColumn.name,
        rightColumn: rightColumn.name,
        source: 'Automatic',
      })
    } else {
      mappings.push({
        leftColumn: leftColumn.name,
        source: 'Left Only',
      })
    }
  }

  for (const rightColumn of rightColumns.value) {
    if (!usedRight.has(rightColumn.name)) {
      mappings.push({
        rightColumn: rightColumn.name,
        source: 'Right Only',
      })
    }
  }

  return mappings
})

const showSheetSelectors = computed(
  () =>
    usesWorkbookSheets(tableFormat.value) ||
    leftSheets.value.length > 1 ||
    rightSheets.value.length > 1,
)
const sheetSelectionSummary = computed(() => {
  const leftCount = leftSheets.value.length
  const rightCount = rightSheets.value.length

  if (leftCount === 0 && rightCount === 0) {
    return t('ui.sheetSelectionEmpty')
  }

  return t('ui.sheetSelectionSummary', {
    leftCount,
    rightCount,
    leftSheet: leftSheet.value || t('ui.sheetNotSelected'),
    rightSheet: rightSheet.value || t('ui.sheetNotSelected'),
  })
})

function parseKeyColumnIndices(): number[] {
  return keyColumnsInput.value
    .split(',')
    .map((value) => Number.parseInt(value.trim(), 10))
    .filter((value) => Number.isInteger(value) && value >= 0)
}

function syncKeyColumnsInput(indices: number[]): void {
  const unique = [
    ...new Set(indices.filter((value) => Number.isInteger(value) && value >= 0)),
  ].sort((left, right) => left - right)

  keyColumnsInput.value = unique.length > 0 ? unique.join(',') : '0'
}

function toggleKeyColumn(columnIndex: number, enabled: boolean): void {
  const current = new Set(parseKeyColumnIndices())

  if (enabled) {
    current.add(columnIndex)
  } else {
    current.delete(columnIndex)
  }

  syncKeyColumnsInput([...current])
}

function onKeyColumnToggle(columnIndex: number, event: Event): void {
  const target = event.target

  if (!(target instanceof HTMLInputElement)) {
    return
  }

  toggleKeyColumn(columnIndex, target.checked)
}

function maybeRecompareOnSessionOptionsChange(): void {
  if (suppressSessionOptionRecompare.value || loading.value) {
    return
  }

  if (
    comparedRows.value !== null ||
    (leftCsv.value && rightCsv.value) ||
    (leftPath.value && rightPath.value)
  ) {
    void runTableCompare()
  }
}

function normalizeColumnName(name: string): string {
  return name.replace(/\s+/g, '').toLowerCase()
}

function columnsFromResult(result: TableCompareResponse): VirtualGridColumn[] {
  const mappedColumns = result.columnMappings.map((mapping, index) => {
    const label = mapping.leftColumn ?? mapping.rightColumn ?? `Column ${String(index + 1)}`

    return {
      key: normalizeColumnName(label) || `column-${String(index)}`,
      label,
    }
  })

  return mappedColumns.length > 0
    ? mappedColumns
    : result.leftColumns.map((column, index) => ({
        key: normalizeColumnName(column.name) || `column-${String(index)}`,
        label: column.name,
      }))
}

function rowsFromResult(
  result: TableCompareResponse,
  columns: VirtualGridColumn[],
): VirtualGridRow[] {
  return result.rows.map((row) => ({
    key: `row-${String(row.index + 1)}`,
    cells: columns.map((column, columnIndex) => ({
      key: `cell-${String(row.index + 1)}-${column.key}`,
      columnKey: column.key,
      testId: `table-grid-cell-${column.key}`,
      text: row.leftCells[columnIndex] ?? '',
      rightText: row.rightCells[columnIndex] ?? '',
    })),
  }))
}

function changedCellsFromResult(
  cells: TableCompareChangedCell[],
  columns: VirtualGridColumn[],
): TableCellLocation[] {
  return cells.map((cell) => {
    const columnKey = columns[cell.columnIndex].key
    const leftValue = cell.leftValue ?? ''
    const rightValue = cell.rightValue ?? ''

    return {
      key: `row-${String(cell.rowIndex + 1)}-${columnKey}`,
      text: `${leftValue} -> ${rightValue}`,
    }
  })
}

function tableMappingSourceKey(source: ColumnMappingModel['source']): string {
  const keys: Record<ColumnMappingModel['source'], string> = {
    Automatic: 'ui.automatic',
    'Left Only': 'ui.leftOnly',
    Manual: 'ui.manual',
    'Right Only': 'ui.rightOnly',
  }

  return keys[source]
}

function addManualMapping(): void {
  const leftColumn = manualLeftColumn.value
  const rightColumn = manualRightColumn.value

  manualMappings.value = [
    ...manualMappings.value.filter((mapping) => mapping.leftColumn !== leftColumn),
    {
      leftColumn,
      rightColumn,
      source: 'Manual',
    },
  ]
}

async function browseTablePath(side: 'left' | 'right'): Promise<void> {
  const selected = await pickNativePath({ directory: false })

  if (!selected) {
    return
  }

  if (side === 'left') {
    leftPath.value = selected
  } else {
    rightPath.value = selected
  }
}

const tableStatusEncoding = computed(() => {
  if (leftEncoding.value && rightEncoding.value) {
    if (leftEncoding.value === rightEncoding.value) {
      return leftEncoding.value
    }

    return `${leftEncoding.value} / ${rightEncoding.value}`
  }

  return leftEncoding.value || rightEncoding.value || 'UTF-8'
})

watchEffect(() => {
  let comparisonStatus = t('status.readyIdle')

  if (loading.value) {
    comparisonStatus = t('status.comparing')
  } else if (comparedRows.value) {
    comparisonStatus = t('status.compared')
  }

  statusBar.reportStatus({
    comparisonStatus,
    differenceCount: comparedRows.value ? tableDifferenceCells.value.length : null,
    encoding: tableStatusEncoding.value,
    filterStatus: t('status.allRows'),
    source: 'table-compare',
    loadTimeSeconds: comparedRows.value ? loadTimeSeconds.value : null,
    chromeKind: 'table-session',
  })
})

async function runTableCompare(): Promise<void> {
  const startedAt = performance.now()

  loading.value = true
  error.value = ''
  try {
    const result = await compareTable({
      left: leftCsv.value,
      right: rightCsv.value,
      format: tableFormat.value,
      leftPath: leftPath.value || undefined,
      rightPath: rightPath.value || undefined,
      leftSheet: leftSheet.value || undefined,
      rightSheet: rightSheet.value || undefined,
      keyColumnIndices: parseKeyColumnIndices(),
      ignoredColumns: ignoredColumnKeys.value
        .map((key) => virtualGridColumns.value.find((column) => column.key === key)?.label)
        .filter((label): label is string => Boolean(label)),
      manualMappings: manualMappings.value
        .filter((mapping) => mapping.source === 'Manual')
        .map((mapping) => ({
          leftColumn: mapping.leftColumn,
          rightColumn: mapping.rightColumn,
        })),
      delimiter: delimiterInput.value || undefined,
      ignoreCase: ignoreCase.value,
      firstRowIsHeader: firstRowIsHeader.value,
    })
    const columns = columnsFromResult(result)

    leftColumns.value = result.leftColumns
    rightColumns.value = result.rightColumns
    leftSheets.value = result.leftSheets ?? []
    rightSheets.value = result.rightSheets ?? []
    suppressSheetCompare.value = true
    leftSheet.value = preferredSheetSelection(leftSheets.value, leftSheet.value, result.leftSheet)
    rightSheet.value = preferredSheetSelection(
      rightSheets.value,
      rightSheet.value,
      result.rightSheet,
    )
    suppressSheetCompare.value = false
    virtualGridColumns.value = columns
    comparedRows.value = rowsFromResult(result, columns)
    tableDifferenceCells.value = changedCellsFromResult(result.changedCells, columns)
    loadTimeSeconds.value = elapsedSecondsSince(startedAt)
    reportStatus.value = ''
    activeDifferenceIndex.value = 0
    manualLeftColumn.value = result.leftColumns[0]?.name ?? ''
    manualRightColumn.value = result.rightColumns[0]?.name ?? ''
  } catch (event) {
    error.value = String(event)
  } finally {
    loading.value = false
  }
}

async function loadLaunchTables(nextLeftPath: string, nextRightPath: string): Promise<void> {
  leftPath.value = nextLeftPath
  rightPath.value = nextRightPath
  tableFormat.value = tableFormatFromPaths(nextLeftPath, nextRightPath)
  leftSheet.value = ''
  rightSheet.value = ''
  leftSheets.value = []
  rightSheets.value = []

  if (tableFormat.value === 'xlsx' || tableFormat.value === 'xls') {
    await runTableCompare()

    return
  }

  loading.value = true
  error.value = ''

  try {
    const [leftFile, rightFile] = await Promise.all([
      readTextFile(nextLeftPath),
      readTextFile(nextRightPath),
    ])

    leftCsv.value = leftFile.text
    rightCsv.value = rightFile.text
    leftFileStamp.value = leftFile.fileStamp
    rightFileStamp.value = rightFile.fileStamp
    leftEncoding.value = leftFile.encoding
    rightEncoding.value = rightFile.encoding
    await runTableCompare()
  } catch (event) {
    error.value = String(event)
    loading.value = false
  }
}

function syncGridScroll(source: 'left' | 'right', event: Event): void {
  const sourceElement = event.currentTarget
  const targetElement = source === 'left' ? rightGridViewport.value : leftGridViewport.value

  if (!(sourceElement instanceof HTMLElement) || !targetElement) {
    return
  }

  targetElement.scrollTop = sourceElement.scrollTop
  targetElement.scrollLeft = sourceElement.scrollLeft
}

function goToNextTableDifference(): void {
  if (tableSearchQuery.value.trim()) {
    tableSearchQuery.value = ''
    activeDifferenceIndex.value = 0

    return
  }

  if (tableDifferenceCells.value.length === 0) {
    activeDifferenceIndex.value = 0

    return
  }

  activeDifferenceIndex.value =
    (activeDifferenceIndex.value + 1) % tableDifferenceCells.value.length
}

function goToPreviousTableDifference(): void {
  if (tableSearchQuery.value.trim()) {
    tableSearchQuery.value = ''
  }

  if (tableDifferenceCells.value.length === 0) {
    activeDifferenceIndex.value = 0

    return
  }

  activeDifferenceIndex.value =
    (activeDifferenceIndex.value - 1 + tableDifferenceCells.value.length) %
    tableDifferenceCells.value.length
}

function syncTableTabTitle(): void {
  if (!leftPath.value || !rightPath.value) {
    return
  }

  tabs.setTabTitle('/compare/table', pathPairTitle(leftPath.value, rightPath.value))
}

async function exportTableReport(): Promise<void> {
  if (comparedRows.value === null) {
    return
  }

  const payload = buildTableReportText({
    leftPath: leftPath.value,
    rightPath: rightPath.value,
    format: tableFormat.value,
    keyColumns: keyColumnsInput.value,
    ignoredColumns: [...ignoredColumnKeys.value],
    rowCount: comparedRows.value.length,
    differenceCount: tableDifferenceCells.value.length,
    differences: tableDifferenceCells.value.map((cell) => ({
      key: cell.key,
      text: cell.text,
    })),
  })
  const outputPath = defaultTableReportOutputPath(leftPath.value)

  try {
    await navigator.clipboard.writeText(payload)
  } catch {
    // Clipboard may be unavailable in headless tests; still try file export.
  }

  try {
    await saveTextFile({
      path: outputPath,
      text: payload,
      createBackup: settings.createBackupOnReportExport,
      backupRetention: settings.backupRetentionCount,
    })
    reportStatus.value = outputPath
  } catch (event) {
    error.value = String(event)
  }
}

function goHomeFromTable(): void {
  tabs.openTab({ title: 'Home', titleKey: 'ui.home', route: '/', dirty: false })
  void router.push('/')
}

function swapTablePaths(): void {
  const nextLeftPath = rightPath.value

  rightPath.value = leftPath.value
  leftPath.value = nextLeftPath
  const nextLeftCsv = rightCsv.value

  rightCsv.value = leftCsv.value
  leftCsv.value = nextLeftCsv
  const nextLeftSheet = rightSheet.value

  rightSheet.value = leftSheet.value
  leftSheet.value = nextLeftSheet
  syncTableTabTitle()
  if ((leftCsv.value && rightCsv.value) || (leftPath.value && rightPath.value)) {
    void runTableCompare()
  }
}

const tableSessionToolbar = computed(() =>
  buildTableCompareToolbar({
    home: true,
    all: false,
    diffs: false,
    same: false,
    minor: false,
    rules: false,
    format: true,
    sessions: true,
    copy: false,
    'next-diff': tableDifferenceCells.value.length > 0,
    'prev-diff': tableDifferenceCells.value.length > 0,
    swap: Boolean(leftPath.value || rightPath.value || leftCsv.value || rightCsv.value),
    reload: Boolean((leftPath.value && rightPath.value) || (leftCsv.value && rightCsv.value)),
  }),
)

function runTableToolbarCommand(commandId: string): void {
  switch (commandId) {
    case 'home':
      goHomeFromTable()
      break
    case 'format':
      openTableSessionSettings()
      break
    case 'sessions':
      openTableSessionSettings()
      break
    case 'next-diff':
      goToNextTableDifference()
      break
    case 'prev-diff':
      goToPreviousTableDifference()
      break
    case 'swap':
      swapTablePaths()
      break
    case 'reload':
      void runTableCompare()
      break
    default:
      break
  }
}

function onSheetSelectionChange(): void {
  if (suppressSheetCompare.value) {
    return
  }

  if ((leftCsv.value && rightCsv.value) || (leftPath.value && rightPath.value)) {
    void runTableCompare()
  }
}

watch([leftPath, rightPath], () => {
  syncTableTabTitle()
})
</script>

<template>
  <WorkbenchShell
    :title="$t('ui.tableCompare')"
    :eyebrow="$t('ui.table')"
    :subtitle="$t('status.rowColumnCount', { rows: visibleRowCount, columns: visibleColumns })"
    :inspector-label="$t('ui.tableCompareInspector')"
    :toolbar-commands="tableSessionToolbar"
    toolbar-test-id-prefix="table-session-toolbar"
    @toolbar-command="runTableToolbarCommand"
  >
    <section
      class="table-compare-view"
      data-table-grid-density="capture-1to1-residual"
    >
      <header class="table-compare-header">
        <div>
          <p class="eyebrow">{{ $t('ui.tableCompare') }}</p>
          <h1>{{ $t('ui.tableCompare') }}</h1>
        </div>
        <div class="table-summary">
          <strong>{{ columnMappings.length }}</strong>
          <span>{{ $t('ui.columnMappings') }}</span>
        </div>
        <div
          class="table-summary table-report-actions"
          data-table-secondary-density="capture-1to1"
        >
          <NButton
            size="small"
            data-testid="export-table-report"
            :disabled="comparedRows === null"
            @click="exportTableReport"
          >
            {{ $t('ui.export') }}
          </NButton>
          <span
            v-if="reportStatus"
            data-testid="table-report-status"
            >{{ reportStatus }}</span
          >
        </div>
        <div
          v-if="showSheetSelectors"
          class="table-summary"
          data-testid="table-sheet-summary"
        >
          <span>{{ sheetSelectionSummary }}</span>
        </div>
      </header>

      <section class="table-source-controls">
        <label>
          <span>{{ $t('ui.leftPath') }}</span>
          <div class="path-field-row">
            <input
              v-model="leftPath"
              type="text"
              class="path-input"
              data-testid="table-left-path"
              :title="leftPath"
            />
            <SessionPathActions
              browse-test-id="table-browse-left"
              save-test-id="table-save-left"
              :can-save="false"
              @browse="browseTablePath('left')"
            />
          </div>
        </label>
        <label>
          <span>{{ $t('ui.rightPath') }}</span>
          <div class="path-field-row">
            <input
              v-model="rightPath"
              type="text"
              class="path-input"
              data-testid="table-right-path"
              :title="rightPath"
            />
            <SessionPathActions
              browse-test-id="table-browse-right"
              save-test-id="table-save-right"
              :can-save="false"
              @browse="browseTablePath('right')"
            />
          </div>
        </label>
        <div
          class="bc-path-footers table-secondary-strip"
          data-testid="table-path-footers"
          data-secondary-density="capture-1to1"
        >
          <PathMetaFooter
            :stamp="leftFileStamp"
            :show-milliseconds="settings.showMillisecondsInTimestamps"
            test-id="table-left-path-footer"
          />
          <PathMetaFooter
            :stamp="rightFileStamp"
            :show-milliseconds="settings.showMillisecondsInTimestamps"
            test-id="table-right-path-footer"
          />
        </div>
        <label>
          <span>{{ $t('ui.tableFormat') }}</span>
          <select
            v-model="tableFormat"
            data-testid="table-format"
          >
            <option value="csv">{{ $t('ui.csv') }}</option>
            <option value="tsv">{{ $t('ui.tsv') }}</option>
            <option value="xlsx">{{ $t('ui.xlsx') }}</option>
            <option value="xls">{{ $t('ui.xls') }}</option>
            <option value="html">{{ $t('ui.html') }}</option>
          </select>
        </label>
        <label v-if="showSheetSelectors">
          <span>{{ $t('ui.leftSheet') }}</span>
          <select
            v-if="leftSheets.length > 0"
            v-model="leftSheet"
            data-testid="table-left-sheet"
            @change="onSheetSelectionChange"
          >
            <option
              v-for="sheet in leftSheets"
              :key="`left-${sheet}`"
              :value="sheet"
            >
              {{ sheet }}
            </option>
          </select>
          <input
            v-else
            v-model="leftSheet"
            type="text"
            data-testid="table-left-sheet"
            :placeholder="$t('ui.sheetNamePlaceholder')"
            @change="onSheetSelectionChange"
          />
        </label>
        <label v-if="showSheetSelectors">
          <span>{{ $t('ui.rightSheet') }}</span>
          <select
            v-if="rightSheets.length > 0"
            v-model="rightSheet"
            data-testid="table-right-sheet"
            @change="onSheetSelectionChange"
          >
            <option
              v-for="sheet in rightSheets"
              :key="`right-${sheet}`"
              :value="sheet"
            >
              {{ sheet }}
            </option>
          </select>
          <input
            v-else
            v-model="rightSheet"
            type="text"
            data-testid="table-right-sheet"
            :placeholder="$t('ui.sheetNamePlaceholder')"
            @change="onSheetSelectionChange"
          />
        </label>
        <label>
          <span>{{ $t('ui.keyColumns') }}</span>
          <input
            v-model="keyColumnsInput"
            type="text"
            data-testid="table-key-columns"
            :placeholder="$t('ui.keyColumnsHint')"
          />
        </label>
        <label>
          <span>{{ $t('ui.delimiter') }}</span>
          <input
            v-model="delimiterInput"
            type="text"
            maxlength="1"
            data-testid="table-delimiter"
          />
        </label>
        <label class="table-option-toggle">
          <input
            v-model="firstRowIsHeader"
            type="checkbox"
            data-testid="table-first-row-header"
          />
          <span>{{ $t('ui.tableFirstRowIsHeader') }}</span>
        </label>
        <label class="table-option-toggle">
          <input
            v-model="ignoreCase"
            type="checkbox"
            data-testid="table-ignore-case"
          />
          <span>{{ $t('ui.tableIgnoreCaseDefault') }}</span>
        </label>
      </section>

      <section class="column-map-controls">
        <label>
          <span>{{ $t('ui.leftColumn') }}</span>
          <select
            v-model="manualLeftColumn"
            data-testid="manual-left-column"
          >
            <option
              v-for="column in leftColumns"
              :key="column.name"
              :value="column.name"
            >
              {{ column.name }}
            </option>
          </select>
        </label>
        <label>
          <span>{{ $t('ui.rightColumn') }}</span>
          <select
            v-model="manualRightColumn"
            data-testid="manual-right-column"
          >
            <option
              v-for="column in rightColumns"
              :key="column.name"
              :value="column.name"
            >
              {{ column.name }}
            </option>
          </select>
        </label>
        <NButton
          size="small"
          type="primary"
          data-testid="add-column-mapping"
          @click="addManualMapping"
          >{{ $t('ui.addMapping') }}</NButton
        >
      </section>

      <section class="column-source-grid">
        <section>
          <h2>{{ $t('ui.leftColumns') }}</h2>
          <ul>
            <li
              v-for="column in leftColumns"
              :key="column.name"
            >
              {{ column.name }}
            </li>
          </ul>
        </section>
        <section>
          <h2>{{ $t('ui.rightColumns') }}</h2>
          <ul>
            <li
              v-for="column in rightColumns"
              :key="column.name"
            >
              {{ column.name }}
            </li>
          </ul>
        </section>
      </section>

      <section class="table-grid-panel">
        <header>
          <strong>{{ $t('ui.dataGrid') }}</strong>
          <span>{{
            $t('status.rowColumnCount', { rows: visibleRowCount, columns: visibleColumns })
          }}</span>
        </header>
        <div
          class="table-navigation-bar"
          data-table-secondary-density="capture-1to1"
        >
          <label>
            <span>{{ $t('ui.find') }}</span>
            <input
              v-model="tableSearchQuery"
              type="search"
              data-testid="table-search-input"
            />
          </label>
          <span data-testid="table-search-summary">{{ tableSearchSummary }}</span>
          <button
            type="button"
            data-testid="run-table-compare"
            :disabled="loading"
            @click="runTableCompare"
          >
            {{ $t('ui.runDiff') }}
          </button>
          <button
            type="button"
            data-testid="next-table-difference"
            @click="goToNextTableDifference"
          >
            {{ $t('ui.nextDifference') }}
          </button>
          <span data-testid="table-difference-summary">{{ tableDifferenceSummary }}</span>
          <strong data-testid="active-table-cell">{{ activeTableCell?.text ?? '--' }}</strong>
        </div>
        <p
          v-if="error"
          class="table-error"
          data-testid="table-compare-error"
        >
          {{ error }}
        </p>
        <p
          v-else-if="visibleRowCount === 0"
          class="empty"
          data-testid="table-empty-hint"
        >
          {{ $t('ui.emptyCompareHint') }}
        </p>
        <div class="table-column-rules">
          <label
            v-for="rule in columnRules"
            :key="rule.key"
            class="table-column-rule"
            :data-testid="`column-rule-${rule.key}`"
          >
            <input
              v-model="ignoredColumnKeys"
              type="checkbox"
              :value="rule.key"
              :data-testid="`ignore-column-${rule.key}`"
            />
            <span>{{ $t('ui.ignored') }}</span>
            <input
              type="checkbox"
              :checked="rule.isKey"
              :data-testid="`key-column-${rule.key}`"
              @change="onKeyColumnToggle(rule.index, $event)"
            />
            <span>{{ $t('ui.key') }}</span>
            <span>{{ rule.label }}</span>
            <strong>{{ rule.status }}</strong>
            <small>{{ rule.importance }}</small>
          </label>
        </div>
        <div class="table-grid-panes">
          <section class="table-grid-pane">
            <strong>{{ $t('ui.left') }}</strong>
            <div
              ref="leftGridViewport"
              class="table-grid-viewport"
              data-testid="left-table-grid-viewport"
              @scroll="syncGridScroll('left', $event)"
            >
              <div
                class="table-virtual-grid"
                data-testid="table-virtual-grid"
                :style="virtualGridStyle"
              >
                <div
                  v-for="row in virtualGridRows"
                  :key="row.key"
                  class="table-grid-row"
                  data-testid="table-grid-row"
                >
                  <span
                    v-for="cell in row.cells"
                    :key="cell.key"
                    class="table-grid-cell"
                    :data-column-key="cell.columnKey"
                    data-testid="table-grid-cell"
                  >
                    <span :data-testid="cell.testId">{{ cell.text }}</span>
                  </span>
                </div>
              </div>
            </div>
          </section>
          <section class="table-grid-pane">
            <strong>{{ $t('ui.right') }}</strong>
            <div
              ref="rightGridViewport"
              class="table-grid-viewport"
              data-testid="right-table-grid-viewport"
              @scroll="syncGridScroll('right', $event)"
            >
              <div
                class="table-virtual-grid"
                :style="virtualGridStyle"
              >
                <div
                  v-for="row in virtualGridRows"
                  :key="row.key"
                  class="table-grid-row"
                >
                  <span
                    v-for="cell in row.cells"
                    :key="cell.key"
                    class="table-grid-cell"
                    :data-column-key="cell.columnKey"
                  >
                    {{ cell.rightText ?? cell.text }}
                  </span>
                </div>
              </div>
            </div>
          </section>
        </div>
      </section>

      <section
        class="column-mapping-list"
        data-testid="column-mapping-list"
      >
        <header>
          <strong>{{ $t('ui.columnMapping') }}</strong>
          <span>{{ $t('ui.manualMappingsOverrideAutomaticNameMatches') }}</span>
        </header>
        <div class="column-map-table">
          <div class="column-map-row column-map-head">
            <span>{{ $t('ui.left') }}</span>
            <span>{{ $t('ui.right') }}</span>
            <span>{{ $t('ui.source') }}</span>
          </div>
          <div
            v-for="mapping in columnMappings"
            :key="`${mapping.leftColumn ?? '--'}-${mapping.rightColumn ?? '--'}-${mapping.source}`"
            class="column-map-row"
          >
            <span>{{ mapping.leftColumn ?? '--' }}</span>
            <span>{{ mapping.rightColumn ?? '--' }}</span>
            <strong>{{ $t(tableMappingSourceKey(mapping.source)) }}</strong>
            <small>{{ mapping.leftColumn ?? '--' }} -> {{ mapping.rightColumn ?? '--' }}</small>
          </div>
        </div>
      </section>
    </section>

    <template #inspector>
      <WorkbenchInspector>
        <section class="workbench-inspector-section">
          <h2>{{ $t('ui.columnMapping') }}</h2>
          <StatusSummaryGrid
            :items="[
              { label: $t('ui.columnMappings'), value: columnMappings.length },
              { label: $t('ui.leftColumns'), value: leftColumns.length },
              { label: $t('ui.rightColumns'), value: rightColumns.length },
              {
                label: $t('ui.differencesOnly'),
                value: tableDifferenceCells.length,
                tone: 'modified',
              },
            ]"
          />
        </section>
        <section class="workbench-inspector-section">
          <h2>{{ $t('ui.selection') }}</h2>
          <dl>
            <div>
              <dt>{{ $t('ui.find') }}</dt>
              <dd>{{ tableSearchSummary }}</dd>
            </div>
            <div>
              <dt>{{ $t('ui.nextDifference') }}</dt>
              <dd>{{ tableDifferenceSummary }}</dd>
            </div>
            <div>
              <dt>{{ $t('ui.field') }}</dt>
              <dd>{{ activeTableCell?.text ?? '--' }}</dd>
            </div>
          </dl>
        </section>
      </WorkbenchInspector>
    </template>
    <SessionSettingsDialog
      :open="showSessionSettings"
      kind="table"
      :table-options="currentTableSessionOptions()"
      @close="showSessionSettings = false"
      @apply="applyTableSessionSettings"
    />
  </WorkbenchShell>
</template>
<style scoped>
.table-compare-view {
  display: grid;
  gap: 4px;
  height: 100%;
  padding: 2px 4px;
  overflow: auto;
}

.table-compare-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px;
}

.eyebrow {
  margin: 0 0 6px;
  color: var(--app-text-muted);
  font-size: 12px;
  font-weight: 700;
  letter-spacing: 0;
  text-transform: uppercase;
}

h1,
h2 {
  margin: 0;
}

h1 {
  font-size: 22px;
  line-height: 1.2;
}

h2 {
  font-size: 13px;
}

.table-summary {
  display: grid;
  min-width: 132px;
  padding: 4px 6px;
  border: 1px solid #a0a0a0;
  border-radius: 0;
  background: var(--app-surface);
  text-align: right;
}

.table-report-actions {
  display: flex;
  align-items: center;
  gap: 6px;
  min-height: 20px;
}

.table-summary strong {
  font-size: 12px;
  line-height: 16px;
}

.table-summary span {
  color: var(--app-text-muted);
  font-size: 12px;
  line-height: 16px;
}

:deep(.table-report-actions .n-button) {
  --n-height: 18px;
  --n-padding: 0 6px;
  --n-font-size: 11px;

  height: 18px;
  min-height: 18px;
  padding: 0 6px;
  border: 1px solid #a0a0a0;
  border-radius: 0;
  font-size: 11px;
  line-height: 16px;
}

.table-source-controls,
.column-map-controls {
  display: grid;
  grid-template-columns: minmax(180px, 1fr) minmax(180px, 1fr) auto;
  align-items: end;
  gap: 4px 6px;
  min-height: 20px;
  padding: 1px 3px;
  border: 1px solid var(--app-border);
  border-radius: 0;
  background: var(--app-surface);
}

.table-source-controls {
  grid-template-columns: repeat(4, minmax(140px, 1fr));
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
  height: 16.5px;
  min-height: 16.5px;
}

.table-source-controls label {
  display: grid;
  gap: 2px;
}

.table-source-controls input,
.table-source-controls select {
  width: 100%;
  height: 20px;
  min-height: 20px;
  padding: 0 4px;
  border: 1px solid var(--app-border);
  border-radius: 0;
  background: var(--app-bg);
  color: var(--app-text);
  font-size: 12px;
}

.column-map-controls label {
  display: grid;
  gap: 2px;
}

.column-map-controls span,
.column-mapping-list header span {
  color: var(--app-text-muted);
  font-size: 11px;
  line-height: 16px;
}

.column-map-controls select {
  width: 100%;
  height: 18px;
  min-height: 18px;
  padding: 0 6px;
  border: 1px solid #a0a0a0;
  border-radius: 0;
  background: var(--app-bg);
  color: var(--app-text);
  font-size: 11px;
  line-height: 16px;
}

.column-source-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 4px;
}

.column-source-grid section,
.column-mapping-list,
.table-grid-panel {
  display: grid;
  gap: 4px 6px;
  padding: 4px 6px;
  border: 1px solid #a0a0a0;
  border-radius: 0;
  background: var(--app-surface);
}

.column-source-grid ul {
  display: grid;
  gap: 2px;
  margin: 0;
  padding: 0;
  list-style: none;
}

.column-source-grid li {
  padding: 2px 6px;
  border: 1px solid #a0a0a0;
  border-radius: 0;
  background: var(--app-bg);
  font-size: 11px;
  line-height: 16px;
}

.column-mapping-list header {
  display: grid;
  gap: 2px;
}

.table-grid-panel header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 6px;
  min-height: 20px;
}

.table-grid-panel header span {
  color: var(--app-text-muted);
  font-size: 12px;
  line-height: 16px;
}

.table-navigation-bar {
  display: grid;
  grid-template-columns: minmax(180px, 1fr) auto auto auto auto;
  align-items: end;
  gap: 4px 6px;
  min-height: 22px;
  padding: 2px 4px;
  border: 1px solid #a0a0a0;
  border-radius: 0;
  background: var(--app-surface);
}

.table-navigation-bar label {
  display: grid;
  gap: 2px;
}

.table-navigation-bar label span,
.table-navigation-bar > span {
  color: var(--app-text-muted);
  font-size: 11px;
  line-height: 16px;
}

.table-navigation-bar input {
  width: 100%;
  height: 18px;
  min-height: 18px;
  padding: 0 6px;
  border: 1px solid #a0a0a0;
  border-radius: 0;
  background: var(--app-bg);
  color: var(--app-text);
  font-size: 11px;
  line-height: 16px;
}

.table-navigation-bar button {
  height: 18px;
  min-height: 18px;
  padding: 0 6px;
  border: 1px solid #a0a0a0;
  border-radius: 0;
  background: #ffffff;
  color: #111111;
  font-size: 11px;
  line-height: 16px;
}

.table-navigation-bar > strong {
  min-width: 72px;
  min-height: 18px;
  padding: 0 6px;
  border: 1px solid #a0a0a0;
  border-radius: 0;
  background: var(--app-bg);
  font-size: 11px;
  line-height: 16px;
  text-align: center;
}

.table-column-rules {
  display: grid;
  grid-template-columns: repeat(5, minmax(128px, 1fr));
  gap: 4px;
  overflow: auto;
}

.table-column-rule {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr);
  align-items: center;
  gap: 2px 4px;
  min-width: 128px;
  min-height: 18px;
  padding: 2px 6px;
  border: 1px solid #a0a0a0;
  border-radius: 0;
  background: var(--app-bg);
  font-size: 11px;
  line-height: 16px;
}

.table-column-rule input {
  width: 14px;
  height: 14px;
  margin: 0;
}

.table-column-rule strong,
.table-column-rule small {
  grid-column: 2;
  min-width: 0;
  overflow: hidden;
  color: var(--app-text-muted);
  line-height: 1.2;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.table-column-rule small {
  font-size: 11px;
}

.table-grid-panes {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 4px;
}

.table-grid-pane {
  display: grid;
  gap: 6px;
  min-width: 0;
}

.table-grid-pane > strong {
  color: var(--app-text-muted);
  font-size: 12px;
}

.table-grid-viewport {
  max-width: 100%;
  max-height: 178px;
  overflow: auto;
  border: 1px solid var(--app-border);
  border-radius: 0;
  background: var(--app-bg);
}

.table-virtual-grid {
  display: grid;
  grid-template-rows: repeat(var(--visible-rows), 20px);
  min-width: calc(var(--visible-columns) * 132px);
}

.table-grid-row {
  display: grid;
  grid-template-columns: repeat(var(--visible-columns), minmax(132px, 1fr));
  min-height: 16px;
  border-bottom: 1px solid #c0c0c0;
}

.table-grid-row:last-child {
  border-bottom: 0;
}

.table-grid-cell {
  min-width: 0;
  padding: 1px 4px;
  overflow: hidden;
  border-right: 1px solid #d0d0d0;
  font-size: 11px;
  line-height: 14px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.table-grid-cell:last-child {
  border-right: 0;
}

.column-map-table {
  display: grid;
  overflow: auto;
  border: 1px solid var(--app-border);
  border-radius: 0;
}

.column-map-row {
  display: grid;
  grid-template-columns: minmax(160px, 1fr) minmax(160px, 1fr) 120px;
  min-width: 520px;
  border-bottom: 1px solid var(--app-border);
  font-size: 12px;
}

.column-map-row:last-child {
  border-bottom: 0;
}

.column-map-row span,
.column-map-row strong {
  min-width: 0;
  padding: 2px 6px;
  overflow: hidden;
  border-right: 1px solid #a0a0a0;
  font-size: 11px;
  line-height: 16px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.column-map-row strong {
  border-right: 0;
}

.column-map-row small {
  position: absolute;
  width: 1px;
  height: 1px;
  overflow: hidden;
  white-space: nowrap;
}

.column-map-head {
  background: var(--app-surface-muted);
  color: var(--app-text-muted);
  font-weight: 700;
}

@media (width <= 760px) {
  .table-compare-header,
  .column-map-controls,
  .column-source-grid,
  .table-navigation-bar,
  .table-column-rules,
  .table-grid-panes {
    grid-template-columns: 1fr;
  }

  .table-compare-header {
    display: grid;
  }

  .table-summary {
    text-align: left;
  }
}

.bc-path-footers {
  display: grid;
  grid-template-columns: 1fr 1fr;
  grid-column: 1 / -1;
  gap: 1px;
  width: 100%;
  padding: 0;
}

.table-secondary-strip {
  min-height: 18px;
  padding: 1px 4px;
  border: 1px solid #c0c0c0;
  border-radius: 0;
  background: #f0f0f0;
}

.table-secondary-strip :deep(.path-meta-footer) {
  gap: 6px;
  min-height: 18px;
  color: #111111;
  font-size: 11px;
  line-height: 16px;
}

.table-secondary-strip :deep(.path-meta-chip),
.table-secondary-strip :deep(.path-meta-eol) {
  display: none;
}

.path-side-footer {
  min-height: 18px;
  margin-top: 0;
  overflow: hidden;
  color: #111111;
  font-size: 11px;
  line-height: 16px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.path-side-footer-muted {
  color: #9ca3af;
}
</style>
