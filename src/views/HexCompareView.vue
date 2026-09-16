<script setup lang="ts">
import { computed, onMounted, ref, watch, watchEffect } from 'vue'
import { useRouter } from 'vue-router'
import {
  compareHexFiles,
  findHexInFile,
  pathFileStamp,
  saveHexEdits,
  saveTextFile,
} from '@/api/diff'
import type {
  FileStamp,
  HexByteEdit,
  HexCompareResponse,
  HexDiffRange,
  HexFindMatch,
  HexViewCell,
} from '@/types/diff'
import { formatPathModifiedAt } from '@/app/pathMetadata'
import WorkbenchShell from '@/components/workbench/WorkbenchShell.vue'
import WorkbenchInspector from '@/components/workbench/WorkbenchInspector.vue'
import StatusSummaryGrid from '@/components/workbench/StatusSummaryGrid.vue'
import { buildHexCompareToolbar, pathPairTitle } from '@/app/sessionToolbars'
import { filterHexRows, type HexRowFilter } from '@/app/hexRowFilter'
import {
  clampHexOffset,
  formatHexOffset,
  hexOffsetForInvoke,
  hexOffsetInputValue,
  parseHexOffset,
} from '@/app/hexOffset'
import { useSessionLaunchStore } from '@/stores/sessionLaunch'
import { useSettingsStore } from '@/stores/settings'
import { useTabsStore } from '@/stores/tabs'
import { useStatusBarStore } from '@/stores/statusBar'
import { elapsedSecondsSince } from '@/app/statusBarPhrases'
import { useViewActionsStore } from '@/stores/viewActions'
import SessionSettingsDialog from '@/components/session/SessionSettingsDialog.vue'
import {
  loadHexCompareSessionOptions,
  resolveHexBytesPerRow,
  saveHexCompareSessionOptions,
  type HexBytesPerRowPreference,
  type HexCompareSessionOptions,
} from '@/app/hexCompareSessionOptions'
import {
  buildHexReportText,
  defaultHexReportOutputPath,
  hexReportRowsFromDiffRanges,
} from '@/app/hexReport'
import { useI18n } from '@/i18n'
import { formatCompareError } from '@/app/compareError'

interface HexRow {
  offset: string
  hex: string
  ascii: string
  cells: HexViewCell[]
}

interface HexSideRows {
  rows: HexRow[]
  totalLen: number
  path: string
}

const leftViewport = ref<HTMLElement | null>(null)
const rightViewport = ref<HTMLElement | null>(null)
const leftPath = ref('')
const rightPath = ref('')
const leftCells = ref<HexViewCell[]>([])
const rightCells = ref<HexViewCell[]>([])
const leftTotalLen = ref(0)
const rightTotalLen = ref(0)
const leftFileStamp = ref<FileStamp | null>(null)
const rightFileStamp = ref<FileStamp | null>(null)
const diffRangeCount = ref(0)
const diffRanges = ref<HexDiffRange[]>([])
const navigationRanges = ref<HexDiffRange[]>([])
const activeDiffRangeIndex = ref(0)
const viewportWidth = ref(640)
const initialHexOptions = loadHexCompareSessionOptions()
const rowFilter = ref<HexRowFilter>(initialHexOptions.diffOnly ? 'diffs' : 'all')
const diffOnly = computed({
  get: () => rowFilter.value === 'diffs',
  set: (value: boolean) => {
    rowFilter.value = value ? 'diffs' : 'all'
  },
})
const hexOffset = ref(0)
const hexLength = ref(initialHexOptions.windowLength)
const bytesPerRowPreference = ref<HexBytesPerRowPreference>(initialHexOptions.bytesPerRow)
const showSessionSettings = ref(false)
const viewActions = useViewActionsStore()
const jumpOffsetInput = ref('0')
const showGoToDialog = ref(false)
const goToOffsetInput = ref('0')
const goToError = ref('')
const findQuery = ref('')
const findKind = ref<'text' | 'hex'>('hex')
const findMatches = ref<HexFindMatch[]>([])
const activeFindIndex = ref(-1)
const findStatus = ref('')
const pendingEdits = ref<HexByteEdit[]>([])
const editOffset = ref(0)
const editValue = ref('00')
const selectedByteOffset = ref<number | null>(null)
const selectedByteSide = ref<'left' | 'right'>('left')
const copyStatus = ref('')
const reportStatus = ref('')
const saveStatus = ref('')
const loading = ref(false)
const loadTimeSeconds = ref<number | null>(null)
const statusBar = useStatusBarStore()
const error = ref('')
const sessionLaunch = useSessionLaunchStore()
const tabs = useTabsStore()
const settings = useSettingsStore()
const router = useRouter()
const { t } = useI18n()
const bytesPerRow = computed(() =>
  resolveHexBytesPerRow(bytesPerRowPreference.value, viewportWidth.value),
)

const leftHex = computed<HexSideRows>(() =>
  buildHexRows(leftCells.value, bytesPerRow.value, leftTotalLen.value, leftPath.value),
)
const rightHex = computed<HexSideRows>(() =>
  buildHexRows(rightCells.value, bytesPerRow.value, rightTotalLen.value, rightPath.value),
)

const visibleLeftHexRows = computed(() => visibleRows(leftHex.value.rows))
const visibleRightHexRows = computed(() => visibleRows(rightHex.value.rows))
const visiblePairedHexRows = computed(() => {
  const maxRows = Math.max(visibleLeftHexRows.value.length, visibleRightHexRows.value.length)

  return Array.from({ length: maxRows }, (_, index) => ({
    left: visibleLeftHexRows.value[index],
    right: visibleRightHexRows.value[index],
    key: visibleLeftHexRows.value[index]?.offset ?? `row-${String(index)}`,
  }))
})
const loadedBytesLabel = computed(
  () => `${String(leftTotalLen.value)} / ${String(rightTotalLen.value)}`,
)
const hexFileTotal = computed(() => Math.max(leftTotalLen.value, rightTotalLen.value))
const hexWindowEndExclusive = computed(() => {
  if (hexFileTotal.value <= 0) {
    return hexOffset.value + Math.max(0, hexLength.value)
  }

  return Math.min(hexFileTotal.value, hexOffset.value + Math.max(0, hexLength.value))
})
const canPagePrevious = computed(() => hexOffset.value > 0)
const canPageNext = computed(
  () =>
    hexFileTotal.value > 0 && hexOffset.value + Math.max(0, hexLength.value) < hexFileTotal.value,
)
const hexWindowRangeLabel = computed(() => {
  if (hexFileTotal.value <= 0) {
    return formatOffset(hexOffset.value)
  }

  const endInclusive = Math.max(hexOffset.value, hexWindowEndExclusive.value - 1)

  return `${formatOffset(hexOffset.value)}–${formatOffset(endInclusive)} / ${formatOffset(hexFileTotal.value)}`
})

function currentHexSessionOptions(): HexCompareSessionOptions {
  return {
    windowLength: hexLength.value,
    diffOnly: diffOnly.value,
    bytesPerRow: bytesPerRowPreference.value,
  }
}

function persistHexSessionOptions(): void {
  saveHexCompareSessionOptions(currentHexSessionOptions())
}

function openHexSessionSettings(): void {
  showSessionSettings.value = true
}

function applyHexSessionSettings(
  payload:
    | { kind: 'folder'; criteria: unknown }
    | { kind: 'text'; options: unknown }
    | { kind: 'table'; options: unknown }
    | { kind: 'hex'; options: HexCompareSessionOptions }
    | { kind: 'picture'; options: unknown },
): void {
  if (payload.kind !== 'hex') {
    return
  }

  hexLength.value = payload.options.windowLength
  diffOnly.value = payload.options.diffOnly
  bytesPerRowPreference.value = payload.options.bytesPerRow
  persistHexSessionOptions()
  showSessionSettings.value = false
  if (leftPath.value && rightPath.value) {
    void runHexCompare()
  }
}

watch([hexLength, diffOnly, bytesPerRowPreference], () => {
  persistHexSessionOptions()
})

watch(
  () => [viewActions.sequence, viewActions.name] as const,
  ([, actionName]) => {
    if (!actionName) {
      return
    }

    switch (actionName) {
      case 'session-settings':
      case 'rules':
        openHexSessionSettings()
        break
      case 'compare':
      case 'reload':
        void runHexCompare()
        break
      case 'swap':
        swapHexPaths()
        break
      case 'show-all':
        diffOnly.value = false
        break
      case 'show-differences':
      case 'filters':
        diffOnly.value = true
        break
      case 'previous-difference':
        goToHexDiffRange(activeDiffRangeIndex.value - 1)
        break
      case 'next-difference':
        goToHexDiffRange(activeDiffRangeIndex.value + 1)
        break
      case 'save':
        void runHexSave()
        break
      case 'copy':
        void copySelectedHexByte()
        break
      case 'export':
        void exportHexReport()
        break
      case 'about':
      case 'check-for-updates':
      case 'close-tab':
      case 'clear-session':
      case 'copy-left':
      case 'copy-right':
      case 'cut':
      case 'delete':
      case 'export-settings':
      case 'help-contents':
      case 'help-support':
      case 'import-settings':
      case 'paste':
      case 'redo':
      case 'save-snapshot':
      case 'restore-factory-defaults':
      case 'save-as':
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
      case 'invert-selection':
      case 'open-selected':
      case 'open-with':
      case 'quick-compare':
      case 'exclude-selected':
      case 'refresh-selection':
      case 'show-same':
      case 'run-script':
      case 'save-report':
      case 'find-filename':
      case 'toggle-columns':
      case 'toggle-log':
      case 'toggle-toolbar':
      case 'change-attributes':
      case 'touch-selected':
        break
    }
  },
)

onMounted(() => {
  const launch = sessionLaunch.consumeLaunch('/compare/hex')

  if (!launch) {
    return
  }

  leftPath.value = launch.locations.left?.uri ?? leftPath.value
  rightPath.value = launch.locations.right?.uri ?? rightPath.value

  if (launch.autoRun && launch.locations.left?.uri && launch.locations.right?.uri) {
    void runHexCompare()
  }
})

function buildHexRows(
  cells: HexViewCell[],
  rowSize: number,
  totalLen: number,
  path: string,
): HexSideRows {
  const rows = Array.from({ length: Math.ceil(cells.length / rowSize) }, (_, rowIndex) => {
    const rowCells = cells.slice(rowIndex * rowSize, rowIndex * rowSize + rowSize)
    const rowOffset = rowCells[0]?.offset ?? rowIndex * rowSize

    return {
      offset: formatOffset(rowOffset),
      hex: rowCells.map((cell) => cell.hex).join(' '),
      ascii: rowCells.map((cell) => cell.ascii).join(''),
      cells: rowCells,
    }
  })

  return { rows, totalLen, path }
}

function visibleRows(rows: HexRow[]): HexRow[] {
  return filterHexRows(rows, rowFilter.value)
}

function formatOffset(offset: number | string): string {
  return formatHexOffset(offset)
}

function numericOffset(value: number | string | bigint): number {
  const asBig = typeof value === 'bigint' ? value : BigInt(value)

  return Number(clampHexOffset(asBig, BigInt(Number.MAX_SAFE_INTEGER) + 1n))
}

function syncHexScroll(source: 'left' | 'right', event: Event): void {
  const sourceElement = event.currentTarget
  const targetElement = source === 'left' ? rightViewport.value : leftViewport.value

  if (!(sourceElement instanceof HTMLElement) || !targetElement) {
    return
  }

  targetElement.scrollTop = sourceElement.scrollTop
}

function applyHexResult(result: HexCompareResponse, preserveNavigationRanges = false): void {
  leftPath.value = result.left.path
  rightPath.value = result.right.path
  leftCells.value = result.left.cells
  rightCells.value = result.right.cells
  leftTotalLen.value = result.summary.leftBytes
  rightTotalLen.value = result.summary.rightBytes
  diffRanges.value = result.diffRanges
  if (!preserveNavigationRanges) {
    navigationRanges.value = result.diffRanges
    activeDiffRangeIndex.value = 0
  } else if (activeDiffRangeIndex.value >= navigationRanges.value.length) {
    activeDiffRangeIndex.value = 0
  }
  diffRangeCount.value = result.summary.differentRanges
  syncHexTabTitle()
}

function syncHexTabTitle(): void {
  if (!leftPath.value || !rightPath.value) {
    return
  }

  tabs.setTabTitle('/compare/hex', pathPairTitle(leftPath.value, rightPath.value))
}

function goHomeFromHex(): void {
  tabs.openTab({ title: 'Home', titleKey: 'ui.home', route: '/', dirty: false })
  void router.push('/')
}

function swapHexPaths(): void {
  const nextLeftPath = rightPath.value

  rightPath.value = leftPath.value
  leftPath.value = nextLeftPath
  const nextLeftCells = rightCells.value

  rightCells.value = leftCells.value
  leftCells.value = nextLeftCells
  const nextLeftLen = rightTotalLen.value

  rightTotalLen.value = leftTotalLen.value
  leftTotalLen.value = nextLeftLen
  const nextLeftStamp = rightFileStamp.value

  rightFileStamp.value = leftFileStamp.value
  leftFileStamp.value = nextLeftStamp
  syncHexTabTitle()
}

function goToHexDiffRange(index: number): void {
  if (navigationRanges.value.length === 0) {
    return
  }

  const nextIndex = (index + navigationRanges.value.length) % navigationRanges.value.length

  activeDiffRangeIndex.value = nextIndex
  const range = navigationRanges.value[nextIndex]

  hexOffset.value = numericOffset(range.offset)
  jumpOffsetInput.value = hexOffsetInputValue(range.offset)
  void runHexCompare({ preserveNavigationRanges: true })
}

const hexSessionToolbar = computed(() =>
  buildHexCompareToolbar({
    home: true,
    all: true,
    diffs: true,
    same: leftCells.value.length > 0 || rightCells.value.length > 0,
    rules: true,
    format: true,
    sessions: true,
    copy: selectedByteOffset.value !== null,
    'next-diff': navigationRanges.value.length > 0,
    'prev-diff': navigationRanges.value.length > 0,
    swap: Boolean(leftPath.value || rightPath.value),
    reload: Boolean(leftPath.value && rightPath.value),
  }),
)

function runHexToolbarCommand(commandId: string): void {
  switch (commandId) {
    case 'home':
      goHomeFromHex()
      break
    case 'all':
      rowFilter.value = 'all'
      break
    case 'diffs':
      rowFilter.value = 'diffs'
      break
    case 'same':
      rowFilter.value = 'same'
      break
    case 'rules':
      openHexSessionSettings()
      break
    case 'format':
      openHexSessionSettings()
      break
    case 'sessions':
      openHexSessionSettings()
      break
    case 'copy':
      void copySelectedHexByte()
      break
    case 'next-diff':
      goToHexDiffRange(activeDiffRangeIndex.value + 1)
      break
    case 'prev-diff':
      goToHexDiffRange(activeDiffRangeIndex.value - 1)
      break
    case 'swap':
      swapHexPaths()
      break
    case 'reload':
      void runHexCompare()
      break
    default:
      break
  }
}

watch([leftPath, rightPath], () => {
  syncHexTabTitle()
})

const leftPathFooterLabel = computed(() => formatHexPathFooter(leftFileStamp.value))
const rightPathFooterLabel = computed(() => formatHexPathFooter(rightFileStamp.value))

function formatHexPathFooter(stamp: FileStamp | null): string {
  if (!stamp) {
    return ''
  }

  const modified = formatPathModifiedAt(stamp.modifiedAtMs)

  return modified
    ? t('status.pathFileMetadata', { bytes: stamp.size, modified })
    : t('status.bytes', { count: stamp.size })
}

async function refreshHexPathStamps(): Promise<void> {
  const [left, right] = await Promise.all([
    leftPath.value ? pathFileStamp(leftPath.value).catch(() => null) : Promise.resolve(null),
    rightPath.value ? pathFileStamp(rightPath.value).catch(() => null) : Promise.resolve(null),
  ])

  leftFileStamp.value = left
  rightFileStamp.value = right
}

watchEffect(() => {
  const hasResult = leftCells.value.length > 0 || rightCells.value.length > 0
  let comparisonStatus = t('status.readyIdle')

  if (loading.value) {
    comparisonStatus = t('status.comparing')
  } else if (hasResult) {
    comparisonStatus = t('status.compared')
  }

  statusBar.reportStatus({
    comparisonStatus,
    differenceCount: hasResult ? diffRanges.value.length : null,
    encoding: 'Binary',
    filterStatus: t('status.allRows'),
    source: 'hex-compare',
    loadTimeSeconds: hasResult ? loadTimeSeconds.value : null,
    chromeKind: 'hex-session',
    editMode: 'insert',
  })
})

async function runHexCompare(options?: { preserveNavigationRanges?: boolean }): Promise<void> {
  const startedAt = performance.now()

  loading.value = true
  error.value = ''
  try {
    const result = await compareHexFiles({
      leftPath: leftPath.value,
      rightPath: rightPath.value,
      offset: hexOffsetForInvoke(hexOffset.value),
      length: hexLength.value,
    })

    applyHexResult(result, options?.preserveNavigationRanges === true)
    await refreshHexPathStamps()
    loadTimeSeconds.value = elapsedSecondsSince(startedAt)
  } catch (event) {
    error.value = formatCompareError(event, t)
  } finally {
    loading.value = false
  }
}

function goToPreviousHexPage(): void {
  if (!canPagePrevious.value) {
    return
  }

  hexOffset.value = Math.max(0, hexOffset.value - Math.max(1, hexLength.value))
  jumpOffsetInput.value = hexOffsetInputValue(hexOffset.value)
  void runHexCompare()
}

function goToNextHexPage(): void {
  if (!canPageNext.value) {
    return
  }

  const step = Math.max(1, hexLength.value)
  const last = Math.max(0, hexFileTotal.value - step)

  hexOffset.value = Math.min(hexOffset.value + step, last)
  jumpOffsetInput.value = hexOffsetInputValue(hexOffset.value)
  void runHexCompare()
}

function goToFirstHexPage(): void {
  if (!canPagePrevious.value) {
    return
  }

  hexOffset.value = 0
  jumpOffsetInput.value = hexOffsetInputValue(0)
  void runHexCompare()
}

function goToLastHexPage(): void {
  if (!canPageNext.value) {
    return
  }

  const last = Math.max(0, hexFileTotal.value - Math.max(1, hexLength.value))

  hexOffset.value = last
  jumpOffsetInput.value = hexOffsetInputValue(last)
  void runHexCompare()
}

function openGoToDialog(): void {
  goToOffsetInput.value = jumpOffsetInput.value || hexOffsetInputValue(hexOffset.value)
  goToError.value = ''
  showGoToDialog.value = true
}

function applyGoToOffset(): void {
  const parsed = parseHexOffset(goToOffsetInput.value)

  if (parsed === undefined) {
    goToError.value = 'invalid'

    return
  }
  const clamped = clampHexOffset(parsed)

  hexOffset.value = numericOffset(clamped)
  jumpOffsetInput.value = hexOffsetInputValue(clamped)
  showGoToDialog.value = false
  goToError.value = ''
  void runHexCompare()
}

function jumpToHexOffset(): void {
  const parsed = parseHexOffset(jumpOffsetInput.value)

  if (parsed === undefined) {
    openGoToDialog()

    return
  }
  const clamped = clampHexOffset(parsed)

  hexOffset.value = numericOffset(clamped)
  jumpOffsetInput.value = hexOffsetInputValue(clamped)
  void runHexCompare()
}

async function runHexFind(): Promise<void> {
  if (!findQuery.value.trim() || !leftPath.value) {
    return
  }

  try {
    findMatches.value = await findHexInFile({
      path: leftPath.value,
      queryKind: findKind.value,
      query: findQuery.value.trim(),
    })
    findStatus.value = String(findMatches.value.length)
    if (findMatches.value.length === 0) {
      activeFindIndex.value = -1

      return
    }

    await jumpToFindMatch(0)
  } catch (event) {
    error.value = formatCompareError(event, t)
  }
}

async function jumpToFindMatch(index: number): Promise<void> {
  if (index < 0 || index >= findMatches.value.length) {
    return
  }

  const match = findMatches.value[index]

  activeFindIndex.value = index
  hexOffset.value = numericOffset(match.offset)
  jumpOffsetInput.value = hexOffsetInputValue(match.offset)
  findStatus.value = `${String(index + 1)}/${String(findMatches.value.length)}`
  await runHexCompare()
}

function goToFindMatch(delta: number): void {
  if (findMatches.value.length === 0) {
    return
  }

  const current = activeFindIndex.value < 0 ? 0 : activeFindIndex.value
  const next = (current + delta + findMatches.value.length) % findMatches.value.length

  void jumpToFindMatch(next)
}

function selectHexByte(side: 'left' | 'right', cell: HexViewCell): void {
  const offset = numericOffset(cell.offset)

  selectedByteOffset.value = offset
  selectedByteSide.value = side
  editOffset.value = offset
  editValue.value = cell.hex
  copyStatus.value = ''
}

function selectedHexCell(): HexViewCell | undefined {
  if (selectedByteOffset.value === null) {
    return undefined
  }

  const cells = selectedByteSide.value === 'left' ? leftCells.value : rightCells.value

  return cells.find((cell) => numericOffset(cell.offset) === selectedByteOffset.value)
}

function formatSelectedHexClipboardPayload(cell: HexViewCell): string {
  return `${formatOffset(cell.offset)}\t${cell.hex}\t${cell.ascii}`
}

async function copySelectedHexByte(): Promise<void> {
  const cell = selectedHexCell()

  if (!cell) {
    return
  }

  const payload = formatSelectedHexClipboardPayload(cell)

  try {
    await navigator.clipboard.writeText(payload)
    copyStatus.value = t('status.copiedPath', { path: payload })
  } catch (event) {
    error.value = formatCompareError(event, t)
  }
}

async function exportHexReport(): Promise<void> {
  if (!leftPath.value || !rightPath.value) {
    return
  }

  const rows = hexReportRowsFromDiffRanges(diffRanges.value)
  const payload = buildHexReportText({
    leftPath: leftPath.value,
    rightPath: rightPath.value,
    originalLen: leftTotalLen.value,
    modifiedLen: rightTotalLen.value,
    rows,
  })
  const outputPath = defaultHexReportOutputPath(leftPath.value)

  try {
    await navigator.clipboard.writeText(payload)
  } catch {
    // Clipboard may be unavailable in headless tests; still try file export.
  }

  try {
    await saveTextFile({
      path: outputPath,
      text: payload,
      createBackup: false,
    })
    reportStatus.value = outputPath
  } catch (event) {
    error.value = formatCompareError(event, t)
  }
}

function queueHexEdit(): void {
  const value = Number.parseInt(editValue.value, 16)

  if (!Number.isInteger(value) || value < 0 || value > 255) {
    return
  }

  pendingEdits.value = [
    ...pendingEdits.value.filter((edit) => edit.offset !== editOffset.value),
    { offset: editOffset.value, value },
  ]
}

async function runHexSave(): Promise<void> {
  if (!leftPath.value || pendingEdits.value.length === 0) {
    return
  }

  if (settings.confirmBeforeOverwriteSave) {
    // eslint-disable-next-line no-alert -- Options Backup overwrite confirmation
    const accepted = window.confirm(t('ui.confirmOverwriteSavePrompt'))

    if (!accepted) {
      return
    }
  }

  try {
    const result = await saveHexEdits({
      path: leftPath.value,
      edits: pendingEdits.value,
      createBackup: settings.createBackupOnSave,
      backupRetention: settings.backupRetentionCount,
    })

    saveStatus.value = String(result.bytesWritten)
    pendingEdits.value = []
    await runHexCompare()
  } catch (event) {
    error.value = formatCompareError(event, t)
  }
}
</script>

<template>
  <WorkbenchShell
    :title="$t('ui.hexCompare')"
    :eyebrow="$t('ui.hex')"
    :subtitle="loadedBytesLabel"
    :inspector-label="$t('ui.hexCompareInspector')"
    :toolbar-commands="hexSessionToolbar"
    toolbar-test-id-prefix="hex-session-toolbar"
    @toolbar-command="runHexToolbarCommand"
  >
    <section class="hex-compare-view">
      <header class="hex-header">
        <div>
          <p class="eyebrow">{{ $t('ui.hexCompare') }}</p>
          <h1>{{ $t('ui.hexCompare') }}</h1>
        </div>
        <div class="hex-summary">
          <strong>{{ loadedBytesLabel }}</strong>
          <span>{{ $t('ui.bytesLoaded') }}</span>
        </div>
      </header>

      <section class="hex-wrap-controls">
        <label>
          <span>{{ $t('ui.left') }} {{ $t('ui.path') }}</span>
          <input
            v-model="leftPath"
            type="text"
            data-testid="hex-left-path"
            :title="leftPath"
          />
        </label>
        <label>
          <span>{{ $t('ui.right') }} {{ $t('ui.path') }}</span>
          <input
            v-model="rightPath"
            type="text"
            data-testid="hex-right-path"
            :title="rightPath"
          />
        </label>
        <div
          class="bc-path-footers"
          data-testid="hex-path-footers"
        >
          <span
            class="path-side-footer"
            :class="{ 'path-side-footer-muted': !leftPathFooterLabel }"
            data-testid="hex-left-path-footer"
            >{{ leftPathFooterLabel || $t('status.panePlaceholder') }}</span
          >
          <span
            class="path-side-footer"
            :class="{ 'path-side-footer-muted': !rightPathFooterLabel }"
            data-testid="hex-right-path-footer"
            >{{ rightPathFooterLabel || $t('status.panePlaceholder') }}</span
          >
        </div>
        <label>
          <span>{{ $t('ui.viewportWidth') }}</span>
          <input
            v-model.number="viewportWidth"
            type="range"
            min="320"
            max="760"
            step="40"
            data-testid="hex-width-control"
          />
        </label>
        <label class="hex-toggle">
          <input
            v-model="diffOnly"
            type="checkbox"
            data-testid="hex-diff-only-toggle"
          />
          <span>{{ $t('ui.differencesOnly') }}</span>
        </label>
        <strong data-testid="hex-bytes-per-row">{{
          $t('status.bytesPerRow', { count: bytesPerRow })
        }}</strong>
        <strong data-testid="hex-diff-ranges">{{
          $t('status.ranges', { count: diffRangeCount })
        }}</strong>
        <button
          type="button"
          data-testid="run-hex-compare"
          :disabled="loading"
          @click="runHexCompare()"
        >
          {{ $t('ui.runDiff') }}
        </button>
        <label>
          <span>{{ $t('ui.offset') }}</span>
          <input
            v-model.number="hexOffset"
            type="number"
            min="0"
            data-testid="hex-offset"
          />
        </label>
        <label>
          <span>{{ $t('ui.chunkLength') }}</span>
          <input
            v-model.number="hexLength"
            type="number"
            min="16"
            step="16"
            data-testid="hex-length"
          />
        </label>
        <label>
          <span>{{ $t('ui.jump') }}</span>
          <input
            v-model="jumpOffsetInput"
            type="text"
            data-testid="hex-jump-offset"
            :placeholder="$t('ui.hexOffsetHint')"
          />
        </label>
        <button
          type="button"
          data-testid="hex-go-to-open"
          :disabled="loading"
          @click="openGoToDialog"
        >
          {{ $t('ui.goTo') }}
        </button>
        <strong
          class="hex-window-range"
          data-testid="hex-window-range"
          >{{ hexWindowRangeLabel }}</strong
        >
        <button
          type="button"
          data-testid="hex-first-page"
          :disabled="loading || !canPagePrevious"
          @click="goToFirstHexPage"
        >
          {{ $t('ui.firstPage') }}
        </button>
        <button
          type="button"
          data-testid="hex-previous-page"
          :disabled="loading || !canPagePrevious"
          @click="goToPreviousHexPage"
        >
          {{ $t('ui.previous') }}
        </button>
        <button
          type="button"
          data-testid="hex-next-page"
          :disabled="loading || !canPageNext"
          @click="goToNextHexPage"
        >
          {{ $t('ui.next') }}
        </button>
        <button
          type="button"
          data-testid="hex-last-page"
          :disabled="loading || !canPageNext"
          @click="goToLastHexPage"
        >
          {{ $t('ui.lastPage') }}
        </button>
        <button
          type="button"
          data-testid="hex-jump"
          :disabled="loading"
          @click="jumpToHexOffset"
        >
          {{ $t('ui.jump') }}
        </button>
        <label>
          <span>{{ $t('ui.find') }}</span>
          <input
            v-model="findQuery"
            type="text"
            data-testid="hex-find-query"
          />
        </label>
        <select
          v-model="findKind"
          data-testid="hex-find-kind"
        >
          <option value="hex">{{ $t('ui.hex') }}</option>
          <option value="text">{{ $t('ui.text') }}</option>
        </select>
        <button
          type="button"
          data-testid="hex-find"
          @click="runHexFind"
        >
          {{ $t('ui.find') }}
        </button>
        <button
          type="button"
          data-testid="hex-find-prev"
          :disabled="findMatches.length === 0"
          @click="goToFindMatch(-1)"
        >
          {{ $t('ui.previous') }}
        </button>
        <button
          type="button"
          data-testid="hex-find-next"
          :disabled="findMatches.length === 0"
          @click="goToFindMatch(1)"
        >
          {{ $t('ui.next') }}
        </button>
        <strong data-testid="hex-find-status">{{ findStatus }}</strong>
        <label>
          <span>{{ $t('ui.offset') }}</span>
          <input
            v-model.number="editOffset"
            type="number"
            min="0"
            data-testid="hex-edit-offset"
          />
        </label>
        <label>
          <span>{{ $t('ui.hex') }}</span>
          <input
            v-model="editValue"
            type="text"
            maxlength="2"
            data-testid="hex-edit-value"
          />
        </label>
        <button
          type="button"
          data-testid="hex-add-edit"
          @click="queueHexEdit"
        >
          {{ $t('ui.add') }}
        </button>
        <button
          type="button"
          data-testid="hex-save"
          :disabled="pendingEdits.length === 0"
          @click="runHexSave"
        >
          {{ $t('ui.save') }}
        </button>
        <strong data-testid="hex-save-status">{{ saveStatus }}</strong>
      </section>

      <p
        v-if="error"
        class="hex-error"
        data-testid="hex-compare-error"
      >
        {{ error }}
      </p>
      <p
        v-else-if="visiblePairedHexRows.length === 0"
        class="empty"
        data-testid="hex-empty-hint"
      >
        {{ $t('ui.emptyCompareHint') }}
      </p>

      <section
        v-if="leftPath && rightPath"
        class="hex-report-panel"
        data-testid="hex-report-panel"
      >
        <header>
          <strong>{{ $t('ui.hexReport') }}</strong>
          <span>{{ $t('status.fieldCount', { count: diffRanges.length }) }}</span>
          <button
            type="button"
            data-testid="export-hex-report"
            :disabled="!leftPath || !rightPath"
            @click="exportHexReport"
          >
            {{ $t('ui.export') }}
          </button>
          <span
            v-if="reportStatus"
            data-testid="hex-report-status"
            >{{ reportStatus }}</span
          >
          <span
            v-if="copyStatus"
            data-testid="hex-copy-status"
            >{{ copyStatus }}</span
          >
        </header>
      </section>

      <section class="hex-pane-grid">
        <section class="hex-side">
          <h2>{{ $t('ui.left') }} · {{ leftHex.path }}</h2>
          <div
            ref="leftViewport"
            class="hex-viewport"
            data-testid="left-hex-viewport"
            @scroll="syncHexScroll('left', $event)"
          >
            <div
              v-for="pair in visiblePairedHexRows"
              :key="`left-${pair.key}`"
              class="hex-row"
              data-testid="hex-row"
            >
              <span
                class="hex-offset"
                data-testid="hex-offset-pane"
              >
                {{ pair.left?.offset ?? pair.right?.offset }}
              </span>
              <span
                class="hex-bytes"
                data-testid="hex-byte-pane"
              >
                <button
                  v-for="cell in pair.left?.cells ?? []"
                  :key="cell.offset"
                  type="button"
                  class="hex-byte"
                  :class="{
                    'hex-byte-different': cell.different,
                    'hex-byte-selected':
                      selectedByteOffset === numericOffset(cell.offset) &&
                      selectedByteSide === 'left',
                  }"
                  :data-testid="
                    cell.different
                      ? `left-hex-byte-diff-${formatOffset(cell.offset)}`
                      : `left-hex-byte-${formatOffset(cell.offset)}`
                  "
                  @click="selectHexByte('left', cell)"
                >
                  {{ cell.hex }}
                </button>
              </span>
              <span
                class="hex-ascii"
                data-testid="hex-ascii-pane"
              >
                {{ pair.left?.ascii ?? '' }}
              </span>
            </div>
          </div>
        </section>

        <section class="hex-side">
          <h2>{{ $t('ui.right') }} · {{ rightHex.path }}</h2>
          <div
            ref="rightViewport"
            class="hex-viewport"
            data-testid="right-hex-viewport"
            @scroll="syncHexScroll('right', $event)"
          >
            <div
              v-for="pair in visiblePairedHexRows"
              :key="`right-${pair.key}`"
              class="hex-row"
            >
              <span class="hex-offset">{{ pair.right?.offset ?? pair.left?.offset }}</span>
              <span class="hex-bytes">
                <button
                  v-for="cell in pair.right?.cells ?? []"
                  :key="cell.offset"
                  type="button"
                  class="hex-byte"
                  :class="{
                    'hex-byte-different': cell.different,
                    'hex-byte-selected':
                      selectedByteOffset === numericOffset(cell.offset) &&
                      selectedByteSide === 'right',
                  }"
                  :data-testid="
                    cell.different
                      ? `right-hex-byte-diff-${formatOffset(cell.offset)}`
                      : `right-hex-byte-${formatOffset(cell.offset)}`
                  "
                  @click="selectHexByte('right', cell)"
                >
                  {{ cell.hex }}
                </button>
              </span>
              <span class="hex-ascii">{{ pair.right?.ascii ?? '' }}</span>
            </div>
          </div>
        </section>
      </section>
    </section>

    <template #inspector>
      <WorkbenchInspector>
        <section class="workbench-inspector-section">
          <h2>{{ $t('ui.hexDetails') }}</h2>
          <StatusSummaryGrid
            :items="[
              { label: $t('ui.bytesLoaded'), value: loadedBytesLabel },
              { label: $t('ui.differencesOnly'), value: diffRangeCount, tone: 'modified' },
              { label: $t('ui.viewportWidth'), value: viewportWidth },
              { label: $t('status.rowLabel'), value: $t('status.bytes', { count: bytesPerRow }) },
            ]"
          />
        </section>
        <section
          class="workench-inspector-section"
          data-testid="hex-rules-panel"
        >
          <h2>{{ $t('ui.rules') }}</h2>
          <label class="hex-rules-row">
            <span>{{ $t('ui.windowLength') }}</span>
            <input
              v-model.number="hexLength"
              type="number"
              min="16"
              max="4096"
              step="16"
              data-testid="hex-rules-window"
            />
          </label>
          <label class="hex-rules-row">
            <input
              v-model="diffOnly"
              type="checkbox"
              data-testid="hex-rules-diff-only"
            />
            <span>{{ $t('ui.differencesOnly') }}</span>
          </label>
          <button
            type="button"
            data-testid="hex-rules-open"
            @click="openHexSessionSettings"
          >
            {{ $t('ui.sessionSettings') }}
          </button>
        </section>
        <section class="workench-inspector-section">
          <h2>{{ $t('ui.formatDetails') }}</h2>
          <dl>
            <div>
              <dt>{{ $t('ui.left') }}</dt>
              <dd>{{ leftHex.path }}</dd>
            </div>
            <div>
              <dt>{{ $t('ui.right') }}</dt>
              <dd>{{ rightHex.path }}</dd>
            </div>
            <div>
              <dt>{{ $t('ui.differencesOnly') }}</dt>
              <dd>{{ diffOnly ? $t('ui.on') : $t('ui.off') }}</dd>
            </div>
          </dl>
        </section>
      </WorkbenchInspector>
    </template>

    <div
      v-if="showGoToDialog"
      class="hex-goto-backdrop"
      data-testid="hex-goto-dialog"
    >
      <section
        class="hex-goto-dialog"
        role="dialog"
        aria-modal="true"
        :aria-label="$t('ui.goToOffset')"
      >
        <header>
          <h2>{{ $t('ui.goToOffset') }}</h2>
        </header>
        <p>{{ $t('ui.hexOffsetHint') }}</p>
        <input
          v-model="goToOffsetInput"
          type="text"
          data-testid="hex-goto-input"
        />
        <p
          v-if="goToError"
          data-testid="hex-goto-error"
        >
          {{ $t('ui.hexOffsetHint') }}
        </p>
        <footer>
          <button
            type="button"
            data-testid="hex-goto-cancel"
            @click="showGoToDialog = false"
          >
            {{ $t('ui.cancel') }}
          </button>
          <button
            type="button"
            data-testid="hex-goto-apply"
            @click="applyGoToOffset"
          >
            {{ $t('ui.goTo') }}
          </button>
        </footer>
      </section>
    </div>
    <SessionSettingsDialog
      :open="showSessionSettings"
      kind="hex"
      :hex-options="currentHexSessionOptions()"
      @close="showSessionSettings = false"
      @apply="applyHexSessionSettings"
    />
  </WorkbenchShell>
</template>
<style scoped>
.hex-compare-view {
  display: grid;
  gap: 4px;
  height: 100%;
  padding: 4px 6px;
  overflow: auto;
}

.hex-header {
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

.hex-summary {
  display: grid;
  min-width: 118px;
  padding: 10px 12px;
  border: 1px solid var(--app-border);
  border-radius: 8px;
  background: var(--app-surface);
  text-align: right;
}

.hex-summary strong {
  font-size: 18px;
  line-height: 1;
}

.hex-summary span {
  color: var(--app-text-muted);
  font-size: 12px;
}

.hex-wrap-controls {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  align-items: end;
  gap: 4px 6px;
  min-width: 0;
  padding: 4px 6px;
  border: 1px solid var(--app-border);
  border-radius: 0;
  background: var(--app-surface);
}

.hex-wrap-controls label {
  display: grid;
  gap: 2px;
  min-width: 0;
}

.hex-wrap-controls span {
  color: var(--app-text-muted);
  font-size: 11px;
}

.hex-wrap-controls input {
  width: 100%;
  min-width: 0;
}

.hex-wrap-controls strong {
  min-width: 0;
  max-width: 100%;
  height: 20px;
  padding: 0 6px;
  overflow: hidden;
  border: 1px solid var(--app-border);
  border-radius: 0;
  background: var(--app-bg);
  font-size: 11px;
  line-height: 20px;
  text-align: center;
  white-space: nowrap;
  text-overflow: ellipsis;
}

.hex-pane-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 4px;
}

.hex-side {
  display: grid;
  gap: 2px;
  min-width: 0;
  padding: 2px 4px;
  border: 1px solid var(--app-border);
  border-radius: 0;
  background: var(--app-surface);
}

.hex-viewport {
  max-height: none;
  overflow: auto;
  border: 1px solid var(--app-border);
  border-radius: 0;
  background: var(--app-bg);
}

.hex-row {
  display: grid;
  grid-template-columns: 84px minmax(240px, 1fr) 132px;
  min-width: 460px;
  min-height: 18px;
  border-bottom: 1px solid var(--app-border);
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', monospace;
  font-size: 12px;
  line-height: 18px;
}

.hex-row:last-child {
  border-bottom: 0;
}

.hex-offset,
.hex-bytes,
.hex-ascii {
  min-width: 0;
  padding: 0 6px;
  overflow: hidden;
  border-right: 1px solid var(--app-border);
  text-overflow: ellipsis;
  white-space: nowrap;
}

.hex-offset {
  color: var(--app-text-muted);
}

.hex-byte {
  display: inline-flex;
  justify-content: center;
  width: 20px;
  padding: 0;
  border: 1px solid transparent;
  border-radius: 0;
  background: transparent;
  color: inherit;
  font: inherit;
  cursor: pointer;
  margin-right: 4px;
}

.hex-byte-selected {
  border-color: var(--accent, #3b82f6);
  background: color-mix(in srgb, var(--accent, #3b82f6) 22%, transparent);
}

.hex-report-panel {
  display: grid;
  gap: 0.5rem;
  margin: 0.75rem 0;
  padding: 0.65rem 0.75rem;
  border: 1px solid var(--border, #d0d7de);
  border-radius: 0.4rem;
}

.hex-report-panel header {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.75rem;
}

.hex-byte-different {
  background: var(--diff-modified-bg);
  color: var(--diff-modified-fg);
  font-weight: 700;
}

.hex-ascii {
  border-right: 0;
}

@media (width <= 760px) {
  .hex-header,
  .hex-wrap-controls,
  .hex-pane-grid {
    grid-template-columns: 1fr;
  }

  .hex-header {
    display: grid;
  }

  .hex-summary {
    text-align: left;
  }
}

.hex-goto-backdrop {
  position: fixed;
  inset: 0;
  z-index: 40;
  display: grid;
  place-items: center;
  background: rgb(15 23 42 / 0.45);
}

.hex-goto-dialog {
  display: grid;
  gap: 10px;
  width: min(420px, 100%);
  padding: 16px;
  border: 1px solid var(--app-border);
  border-radius: 8px;
  background: var(--app-surface);
}

.hex-goto-dialog footer {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
}

.hex-rules-row {
  display: flex;
  align-items: center;
  gap: 8px;
  margin: 8px 0;
  font-size: 12px;
}

.hex-rules-row input[type='number'] {
  width: 96px;
}

.bc-path-footers {
  display: grid;
  grid-template-columns: 1fr 1fr;
  grid-column: 1 / -1;
  gap: 1px;
  width: 100%;
  padding: 0 2px;
}

.path-side-footer {
  min-height: 10px;
  margin-top: 0;
  color: var(--app-text-muted);
  font-size: 10px;
  line-height: 10px;
}

.path-side-footer-muted {
  color: #9ca3af;
}
</style>
