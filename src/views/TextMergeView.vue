<script setup lang="ts">
import { computed, nextTick, onMounted, onUnmounted, ref, watch, watchEffect } from 'vue'
import { mergeTextFiles, saveTextFile } from '@/api/diff'
import { buildTextMergeReportText, defaultTextMergeReportOutputPath } from '@/app/textMergeReport'
import { pickNativePath } from '@/app/filePicker'
import SessionPathActions from '@/components/workbench/SessionPathActions.vue'
import SessionSettingsDialog from '@/components/session/SessionSettingsDialog.vue'
import WorkbenchShell from '@/components/workbench/WorkbenchShell.vue'
import {
  loadTextCompareSessionOptions,
  saveTextCompareSessionOptions,
  type TextCompareSessionOptions,
} from '@/app/textCompareSessionOptions'
import WorkbenchInspector from '@/components/workbench/WorkbenchInspector.vue'
import { buildTextMergeToolbar, pathPairTitle, singlePathTitle } from '@/app/sessionToolbars'
import { ArrowDownToLine, ArrowLeftFromLine, ArrowRightFromLine, ArrowUpToLine } from '@lucide/vue'
import { useI18n } from '@/i18n'
import { useTabsStore } from '@/stores/tabs'
import { useSettingsStore } from '@/stores/settings'
import { useSessionLaunchStore } from '@/stores/sessionLaunch'
import { useViewActionsStore } from '@/stores/viewActions'
import {
  applyOverwriteTyping,
  isInsertToggleKey,
  shouldHandleOverwriteKeydown,
  toggleTextEditMode,
  type TextEditMode,
} from '@/app/textEditMode'
import { useStatusBarStore } from '@/stores/statusBar'
import { elapsedSecondsSince } from '@/app/statusBarPhrases'

type MergePaneId = 'left' | 'base' | 'right' | 'output'
type MergeSource = 'left' | 'base' | 'right'

interface MergePane {
  id: MergePaneId
  title: string
  subtitle: string
  lines: string[]
}

interface MergeConflict {
  id: number
  line: number
  title: string
  base: string
  left: string
  right: string
  outputStart: number
  outputSpan: number
  resolved: boolean
}

type ConflictPolicy = 'markConflict' | 'favorLeft' | 'favorRight'
type MergeTarget = 'left' | 'right' | 'other'

const { t } = useI18n()
const tabs = useTabsStore()
const settings = useSettingsStore()
const showSessionSettings = ref(false)
const textSessionOptions = ref<TextCompareSessionOptions>(loadTextCompareSessionOptions())
const sessionLaunch = useSessionLaunchStore()
const viewActions = useViewActionsStore()
const statusBar = useStatusBarStore()
const leftPath = ref('')
const rightPath = ref('')
const centerPath = ref('')
const outputPath = ref('')

async function browseMergePath(side: 'left' | 'center' | 'right' | 'output'): Promise<void> {
  const selected = await pickNativePath({ directory: false })

  if (!selected) {
    return
  }

  if (side === 'left') {
    leftPath.value = selected
  } else if (side === 'center') {
    centerPath.value = selected
  } else if (side === 'right') {
    rightPath.value = selected
  } else {
    outputPath.value = selected
  }
}

const customOutputPath = ref('')
const mergeTarget = ref<MergeTarget>('other')
const leftText = ref('')
const rightText = ref('')
const centerText = ref('')
const outputLines = ref<string[]>([])
const editMode = ref<TextEditMode>('insert')
const saveStatusKey = ref('ui.outputNotSaved')
const saveStatusParams = ref<Record<string, string | number>>({})
const saving = ref(false)
const reportStatus = ref('')
const loading = ref(false)
const loadTimeSeconds = ref<number | null>(null)
const conflicts = ref<MergeConflict[]>([])
const conflictPolicy = ref<ConflictPolicy>('markConflict')
const activeConflictIndex = ref(0)
const syncPanes = ref(true)
let syncingScroll = false
const paneBodyRefs: Partial<Record<MergePaneId, HTMLElement | null>> = {}
const sourcePanes = computed<MergePane[]>(() => [
  {
    id: 'left',
    title: t('ui.left'),
    subtitle: leftPath.value || t('ui.featureBranch'),
    lines: splitLines(leftText.value),
  },
  {
    id: 'base',
    title: t('ui.center'),
    subtitle: centerPath.value || t('ui.commonAncestor'),
    lines: splitLines(centerText.value),
  },
  {
    id: 'right',
    title: t('ui.right'),
    subtitle: rightPath.value || t('ui.mainBranch'),
    lines: splitLines(rightText.value),
  },
])
const outputPane = computed<MergePane>(() => ({
  id: 'output',
  title: t('ui.output'),
  subtitle: t('ui.mergeResult'),
  lines: outputLines.value,
}))
const mergeTargetLocked = computed(() => mergeTarget.value !== 'other')
const unresolvedConflicts = computed(() => conflicts.value.filter((conflict) => !conflict.resolved))

watchEffect(() => {
  const hasContent = Boolean(leftPath.value || rightPath.value || outputLines.value.length)
  let comparisonStatus = t('status.editing')

  if (loading.value) {
    comparisonStatus = t('status.comparing')
  } else if (hasContent) {
    comparisonStatus = t('status.compared')
  }

  const conflictCount = hasContent ? unresolvedConflicts.value.length : null

  statusBar.reportStatus({
    comparisonStatus,
    differenceCount: conflictCount,
    encoding: 'UTF-8',
    filterStatus: t('status.allRows'),
    source: 'text-merge',
    chromeKind: 'text-session',
    loadTimeSeconds: loadTimeSeconds.value,
    importantDifferenceCount: conflictCount,
    unimportantDifferenceCount: hasContent ? 0 : null,
    editMode: hasContent ? editMode.value : null,
  })
})
const currentConflict = computed<MergeConflict | undefined>(() => {
  const list = unresolvedConflicts.value

  if (list.length === 0) {
    return undefined
  }

  const index = Math.min(Math.max(activeConflictIndex.value, 0), list.length - 1)

  return list[index]
})
const conflictPositionLabel = computed(() => {
  const list = unresolvedConflicts.value

  if (list.length === 0) {
    return t('status.conflictCountPlural', { count: 0 })
  }

  const index = Math.min(Math.max(activeConflictIndex.value, 0), list.length - 1)

  return t('status.conflictPosition', { index: index + 1, total: list.length })
})

const mergeSessionToolbar = computed(() =>
  buildTextMergeToolbar({
    home: true,
    sessions: true,
    all: true,
    diffs: true,
    same: true,
    context: true,
    minor: true,
    'same-ok': true,
    'favor-left': Boolean(currentConflict.value && !currentConflict.value.resolved),
    'favor-right': Boolean(currentConflict.value && !currentConflict.value.resolved),
    rules: true,
    format: true,
    conflict: unresolvedConflicts.value.length > 0,
    left: true,
    center: true,
    right: true,
    'next-conflict': unresolvedConflicts.value.length > 0,
    'prev-conflict': unresolvedConflicts.value.length > 0,
    swap: Boolean(leftPath.value || rightPath.value),
    reload: Boolean(leftPath.value && rightPath.value),
  }).map((item) => ({
    ...item,
    active: item.id === 'sessions' && showSessionSettings.value,
  })),
)

function openTextMergeSessionSettings(): void {
  showSessionSettings.value = true
}

function applyTextMergeSessionSettings(
  payload:
    | { kind: 'folder'; criteria: unknown }
    | { kind: 'text'; options: TextCompareSessionOptions }
    | { kind: 'table'; options: unknown }
    | { kind: 'hex'; options: unknown }
    | { kind: 'picture'; options: unknown },
): void {
  if (payload.kind !== 'text') {
    return
  }

  textSessionOptions.value = payload.options
  saveTextCompareSessionOptions(payload.options)
  showSessionSettings.value = false
}

function runMergeToolbarCommand(commandId: string): void {
  switch (commandId) {
    case 'home':
      tabs.openTab({ title: t('ui.home'), titleKey: 'ui.home', route: '/', dirty: false })
      break
    case 'sessions':
      openTextMergeSessionSettings()
      break
    case 'favor-left':
      favorSide('left')
      break
    case 'favor-right':
      favorSide('right')
      break
    case 'next-conflict':
      goToConflict(1)
      break
    case 'prev-conflict':
      goToConflict(-1)
      break
    case 'swap': {
      const nextLeft = rightPath.value

      rightPath.value = leftPath.value
      leftPath.value = nextLeft
      break
    }
    case 'reload':
      void loadMerge()
      break
    default:
      break
  }
}

const outputHasConflictMarkers = computed(() =>
  outputLines.value.some((line) => /^(<{7}|={7}|>{7})/u.test(line)),
)
const outputText = computed({
  get: () => outputLines.value.join('\n'),
  set: (value: string) => {
    outputLines.value = value.split('\n')
    setSaveStatus('status.outputHasUnsavedEdits')
  },
})
const saveStatus = computed(() => t(saveStatusKey.value, saveStatusParams.value))

const conflictStatus = computed(() => {
  const count = unresolvedConflicts.value.length

  return t(count === 1 ? 'status.conflictCount' : 'status.conflictCountPlural', { count })
})

function onOutputEditorKeydown(event: KeyboardEvent): void {
  if (editMode.value !== 'overwrite' || !shouldHandleOverwriteKeydown(event)) {
    return
  }

  const target = event.target

  if (!(target instanceof HTMLTextAreaElement)) {
    return
  }

  event.preventDefault()
  const next = applyOverwriteTyping(
    outputText.value,
    target.selectionStart,
    target.selectionEnd,
    event.key,
  )

  outputText.value = next.text

  void nextTick(() => {
    target.setSelectionRange(next.caret, next.caret)
  })
}

function onSessionInsertKeydown(event: KeyboardEvent): void {
  if (!isInsertToggleKey(event)) {
    return
  }

  event.preventDefault()
  editMode.value = toggleTextEditMode(editMode.value)
}

onUnmounted(() => {
  window.removeEventListener('keydown', onSessionInsertKeydown)
})

onMounted(() => {
  window.addEventListener('keydown', onSessionInsertKeydown)
  const launch = sessionLaunch.consumeLaunch('/merge/text')

  if (!launch) {
    return
  }

  leftPath.value = launch.locations.left?.uri ?? ''
  rightPath.value = launch.locations.right?.uri ?? ''
  centerPath.value = launch.locations.center?.uri ?? ''
  outputPath.value = launch.locations.output?.uri ?? outputPath.value
  customOutputPath.value = outputPath.value
  if (outputPath.value && outputPath.value === leftPath.value) {
    mergeTarget.value = 'left'
  } else if (outputPath.value && outputPath.value === rightPath.value) {
    mergeTarget.value = 'right'
  } else {
    mergeTarget.value = 'other'
  }

  if (launch.favor === 'left') {
    conflictPolicy.value = 'favorLeft'
  } else if (launch.favor === 'right') {
    conflictPolicy.value = 'favorRight'
  }

  if (launch.autoRun && leftPath.value && rightPath.value) {
    void loadMerge()
  }
})

function splitLines(value: string): string[] {
  return value === '' ? [] : value.split(/\r?\n/u)
}

function applyMergeTarget(): void {
  if (mergeTarget.value === 'left') {
    outputPath.value = leftPath.value

    return
  }

  if (mergeTarget.value === 'right') {
    outputPath.value = rightPath.value

    return
  }

  outputPath.value = customOutputPath.value
}

function setSaveStatus(key: string, params: Record<string, string | number> = {}): void {
  saveStatusKey.value = key
  saveStatusParams.value = params
}

async function loadMerge(): Promise<void> {
  if (!leftPath.value || !rightPath.value) {
    return
  }

  loading.value = true
  const mergeStartedAt = performance.now()

  try {
    const result = await mergeTextFiles({
      leftPath: leftPath.value,
      rightPath: rightPath.value,
      centerPath: centerPath.value || undefined,
      outputPath: outputPath.value || undefined,
      conflictPolicy: conflictPolicy.value,
    })

    leftText.value = result.leftText
    rightText.value = result.rightText
    centerText.value = result.centerText
    outputLines.value = splitLines(result.outputText)
    if (mergeTarget.value === 'other') {
      outputPath.value = result.outputPath ?? outputPath.value
      customOutputPath.value = outputPath.value
    } else {
      applyMergeTarget()
    }
    conflicts.value = result.conflicts.map((conflict, index) => ({
      id: index,
      line: conflict.lineIndex + 1,
      title: conflict.title,
      base: conflict.base,
      left: conflict.left,
      right: conflict.right,
      outputStart: conflict.lineIndex,
      outputSpan: Math.max(1, conflict.outputSpan),
      resolved: false,
    }))
    activeConflictIndex.value = 0
    await nextTick()
    scrollPanesToCurrentConflict()
  } finally {
    loadTimeSeconds.value = elapsedSecondsSince(mergeStartedAt)
    loading.value = false
  }
}

function favorSide(side: 'left' | 'right'): void {
  conflictPolicy.value = side === 'left' ? 'favorLeft' : 'favorRight'
  acceptConflict(side)
}

function clampActiveConflictIndex(): void {
  const max = Math.max(0, unresolvedConflicts.value.length - 1)

  activeConflictIndex.value = Math.min(Math.max(activeConflictIndex.value, 0), max)
}

function goToConflict(delta: number): void {
  const list = unresolvedConflicts.value

  if (list.length === 0) {
    return
  }

  activeConflictIndex.value = (activeConflictIndex.value + delta + list.length) % list.length
  void nextTick().then(() => scrollPanesToCurrentConflict())
}

function selectConflict(id: number): void {
  const index = unresolvedConflicts.value.findIndex((conflict) => conflict.id === id)

  if (index < 0) {
    return
  }

  activeConflictIndex.value = index
  void nextTick().then(() => scrollPanesToCurrentConflict())
}

function acceptConflict(source: MergeSource, advance = false): void {
  const conflict = currentConflict.value

  if (!conflict) {
    return
  }

  const replacementLines = splitLines(conflict[source])
  const start = Math.max(0, conflict.outputStart)
  const span = Math.max(1, conflict.outputSpan)
  const nextLines = [...outputLines.value]

  nextLines.splice(start, span, ...replacementLines)
  outputLines.value = nextLines

  const delta = replacementLines.length - span

  conflicts.value = conflicts.value.map((item) => {
    if (item.id === conflict.id) {
      return { ...item, resolved: true }
    }
    if (item.resolved || item.outputStart <= start) {
      return item
    }

    return {
      ...item,
      outputStart: item.outputStart + delta,
      line: item.outputStart + delta + 1,
    }
  })
  setSaveStatus('status.outputHasUnsavedEdits')
  clampActiveConflictIndex()
  if (advance && unresolvedConflicts.value.length > 0) {
    void nextTick().then(() => scrollPanesToCurrentConflict())
  }
}

function acceptThenNext(source: MergeSource): void {
  acceptConflict(source, true)
}

function setPaneBodyRef(paneId: MergePaneId, element: Element | null): void {
  const next = element instanceof HTMLElement ? element : null

  if (paneBodyRefs[paneId] === next) {
    return
  }
  paneBodyRefs[paneId] = next
}

function onPaneScroll(paneId: MergePaneId, event: Event): void {
  if (!syncPanes.value || syncingScroll) {
    return
  }

  const source = event.target

  if (!(source instanceof HTMLElement)) {
    return
  }

  syncingScroll = true
  for (const [id, body] of Object.entries(paneBodyRefs)) {
    if (id === paneId || !body) {
      continue
    }
    body.scrollTop = source.scrollTop
  }
  syncingScroll = false
}

function scrollPanesToCurrentConflict(): void {
  const conflict = currentConflict.value

  if (!conflict) {
    return
  }

  const lineIndex = Math.max(0, conflict.line - 1)

  for (const body of Object.values(paneBodyRefs)) {
    if (!body) {
      continue
    }
    const target = body.querySelector(`[data-line-index="${String(lineIndex)}"]`)

    if (target instanceof HTMLElement && typeof target.scrollIntoView === 'function') {
      target.scrollIntoView({ block: 'center' })
    } else {
      body.scrollTop = Math.max(0, lineIndex * 22 - 40)
    }
  }
}

async function saveOutput(): Promise<void> {
  if (settings.confirmBeforeOverwriteSave) {
    // eslint-disable-next-line no-alert -- Options Backup overwrite confirmation
    const accepted = window.confirm(t('ui.confirmOverwriteSavePrompt'))

    if (!accepted) {
      return
    }
  }

  saving.value = true
  setSaveStatus('status.savingOutput')
  try {
    const result = await saveTextFile({
      path: outputPath.value,
      text: outputText.value,
      createBackup: settings.createBackupOnSave,
      backupRetention: settings.backupRetentionCount,
    })

    setSaveStatus(result.backupPath ? 'status.savedBytesWithBackup' : 'status.savedBytes', {
      backupPath: result.backupPath ?? '',
      count: result.bytesWritten,
    })
  } catch (error) {
    setSaveStatus('status.rawMessage', {
      message:
        typeof error === 'object' && error !== null && 'message' in error
          ? String(error.message)
          : String(error),
    })
  } finally {
    saving.value = false
  }
}

function lineClass(line: string, paneId: MergePaneId): string {
  if (paneId === 'output' && /^(<{7}|={7}|>{7})/.test(line)) {
    return 'marker'
  }

  if (currentConflict.value?.left === line) {
    return 'conflict'
  }

  if (currentConflict.value?.right === line) {
    return 'conflict'
  }

  return 'normal'
}

watch(mergeTarget, (_next, previous) => {
  if (previous === 'other') {
    customOutputPath.value = outputPath.value
  }
  applyMergeTarget()
})

watch([leftPath, rightPath], () => {
  if (mergeTarget.value !== 'other') {
    applyMergeTarget()
  }
})

watch(outputPath, (value) => {
  if (mergeTarget.value === 'other') {
    customOutputPath.value = value
  }
})

watch(
  [leftPath, rightPath, outputPath],
  ([left, right, output]) => {
    if (output) {
      tabs.setTabTitle('/merge/text', singlePathTitle(output))
    } else if (left && right) {
      tabs.setTabTitle('/merge/text', pathPairTitle(left, right))
    }
  },
  { immediate: true },
)

async function exportTextMergeReport(): Promise<void> {
  if (!leftPath.value || !rightPath.value) {
    return
  }

  const payload = buildTextMergeReportText({
    leftPath: leftPath.value,
    rightPath: rightPath.value,
    centerPath: centerPath.value,
    outputPath: outputPath.value,
    conflictPolicy: conflictPolicy.value,
    outputLineCount: outputLines.value.length,
    conflicts: conflicts.value.map((conflict) => ({
      line: conflict.line,
      title: conflict.title,
      resolved: conflict.resolved,
      base: conflict.base,
      left: conflict.left,
      right: conflict.right,
    })),
  })
  const reportPath = defaultTextMergeReportOutputPath(outputPath.value || leftPath.value)

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
  } catch (event) {
    setSaveStatus('status.rawMessage', {
      message: event instanceof Error ? event.message : String(event),
    })
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
        void loadMerge()
        break
      case 'save':
        void saveOutput()
        break
      case 'export':
      case 'save-report':
        void exportTextMergeReport()
        break
      case 'copy-left':
        favorSide('left')
        break
      case 'copy-right':
        favorSide('right')
        break
      case 'previous-conflict':
        goToConflict(-1)
        break
      case 'next-conflict':
        goToConflict(1)
        break
      case 'about':
      case 'check-for-updates':
      case 'close-tab':
      case 'clear-session':
      case 'copy':
      case 'cut':
      case 'delete':
      case 'export-settings':
      case 'filters':
      case 'help-contents':
      case 'help-context':
      case 'help-support':
      case 'import-settings':
      case 'next-difference':
      case 'paste':
      case 'previous-difference':
      case 'redo':
      case 'save-snapshot':
      case 'restore-factory-defaults':
      case 'rules':
      case 'save-as':
      case 'session-settings':
        openTextMergeSessionSettings()
        break
      case 'show-all':
      case 'show-differences':
      case 'swap':
      case 'undo':
      case 'workspace-load':
      case 'collapse-all':
      case 'expand-all':
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
</script>

<template>
  <WorkbenchShell
    :title="$t('ui.textMerge')"
    :eyebrow="$t('ui.merge')"
    :subtitle="conflictStatus"
    :inspector-label="$t('ui.textMergeInspector')"
    :toolbar-commands="mergeSessionToolbar"
    toolbar-test-id-prefix="merge-session-toolbar"
    session-toolbar-wrap
    @toolbar-command="runMergeToolbarCommand"
  >
    <section class="text-merge-view">
      <div class="merge-toolbar">
        <div>
          <strong>{{ $t('ui.textMerge') }}</strong>
          <span>{{ $t('ui.fourWayMergeWorkspace') }}</span>
        </div>
        <span
          class="status-chip"
          data-testid="merge-conflict-status"
        >
          {{ conflictStatus }}
        </span>
        <span
          v-if="outputHasConflictMarkers"
          class="status-chip"
          data-testid="merge-conflict-markers-chip"
          >{{ $t('ui.outputHasConflictMarkers') }}</span
        >
        <select
          v-model="conflictPolicy"
          class="output-path-input"
          data-testid="merge-conflict-policy"
          :aria-label="$t('ui.conflictPolicy')"
        >
          <option value="markConflict">{{ $t('merge.action.markConflict') }}</option>
          <option value="favorLeft">{{ $t('ui.favorLeft') }}</option>
          <option value="favorRight">{{ $t('ui.favorRight') }}</option>
        </select>
        <span
          class="favor-chrome"
          data-testid="merge-favor-chrome"
        >
          <button
            type="button"
            class="toolbar-button toolbar-button-icon toolbar-button-dense"
            data-testid="merge-favor-left"
            :disabled="!currentConflict || currentConflict.resolved"
            :title="$t('ui.favorLeft')"
            :aria-label="$t('ui.favorLeft')"
            @click="favorSide('left')"
          >
            <ArrowLeftFromLine
              class="toolbar-button-glyph"
              aria-hidden="true"
              :size="settings.largeToolbarButtons ? 18 : 16"
              :stroke-width="1.75"
            />
          </button>
          <button
            type="button"
            class="toolbar-button toolbar-button-icon toolbar-button-dense"
            data-testid="merge-favor-right"
            :disabled="!currentConflict || currentConflict.resolved"
            :title="$t('ui.favorRight')"
            :aria-label="$t('ui.favorRight')"
            @click="favorSide('right')"
          >
            <ArrowRightFromLine
              class="toolbar-button-glyph"
              aria-hidden="true"
              :size="settings.largeToolbarButtons ? 18 : 16"
              :stroke-width="1.75"
            />
          </button>
        </span>
        <span
          class="conflict-nav-chrome"
          data-testid="merge-conflict-nav"
        >
          <span data-testid="merge-conflict-position">{{ conflictPositionLabel }}</span>
          <button
            type="button"
            class="toolbar-button toolbar-button-icon toolbar-button-dense"
            data-testid="merge-next-conflict"
            :disabled="unresolvedConflicts.length === 0"
            :title="$t('ui.nextConflict')"
            :aria-label="$t('ui.nextConflict')"
            @click="goToConflict(1)"
          >
            <ArrowDownToLine
              class="toolbar-button-glyph"
              aria-hidden="true"
              :size="settings.largeToolbarButtons ? 18 : 16"
              :stroke-width="1.75"
            />
          </button>
          <button
            type="button"
            class="toolbar-button toolbar-button-icon toolbar-button-dense"
            data-testid="merge-prev-conflict"
            :disabled="unresolvedConflicts.length === 0"
            :title="$t('ui.previousConflict')"
            :aria-label="$t('ui.previousConflict')"
            @click="goToConflict(-1)"
          >
            <ArrowUpToLine
              class="toolbar-button-glyph"
              aria-hidden="true"
              :size="settings.largeToolbarButtons ? 18 : 16"
              :stroke-width="1.75"
            />
          </button>
        </span>
        <span
          class="accept-chrome"
          data-testid="merge-accept-chrome"
        >
          <button
            type="button"
            class="toolbar-button"
            data-testid="merge-accept-left-then-next"
            :disabled="!currentConflict"
            :title="$t('ui.acceptLeftThenNext')"
            @click="acceptThenNext('left')"
          >
            {{ $t('ui.acceptLeftThenNext') }}
          </button>
          <button
            type="button"
            class="toolbar-button"
            data-testid="merge-accept-right-then-next"
            :disabled="!currentConflict"
            :title="$t('ui.acceptRightThenNext')"
            @click="acceptThenNext('right')"
          >
            {{ $t('ui.acceptRightThenNext') }}
          </button>
          <button
            type="button"
            class="toolbar-button"
            data-testid="merge-accept-base-then-next"
            :disabled="!currentConflict"
            :title="$t('ui.acceptBaseThenNext')"
            @click="acceptThenNext('base')"
          >
            {{ $t('ui.acceptBaseThenNext') }}
          </button>
          <label class="sync-panes-toggle">
            <input
              v-model="syncPanes"
              data-testid="merge-sync-panes"
              type="checkbox"
            />
            <span>{{ $t('ui.syncPanes') }}</span>
          </label>
        </span>

        <span class="path-field-row merge-path-field">
          <input
            v-model="leftPath"
            class="output-path-input path-input"
            data-testid="merge-left-path"
            :title="leftPath"
            type="text"
            :aria-label="$t('ui.leftPath')"
          />
          <SessionPathActions
            browse-test-id="merge-browse-left"
            :show-save="false"
            @browse="browseMergePath('left')"
          />
        </span>
        <span class="path-field-row merge-path-field">
          <input
            v-model="centerPath"
            class="output-path-input path-input"
            data-testid="merge-center-path"
            :title="centerPath"
            type="text"
            :aria-label="$t('ui.base')"
          />
          <SessionPathActions
            browse-test-id="merge-browse-center"
            :show-save="false"
            @browse="browseMergePath('center')"
          />
        </span>
        <span class="path-field-row merge-path-field">
          <input
            v-model="rightPath"
            class="output-path-input path-input"
            data-testid="merge-right-path"
            :title="rightPath"
            type="text"
            :aria-label="$t('ui.rightPath')"
          />
          <SessionPathActions
            browse-test-id="merge-browse-right"
            :show-save="false"
            @browse="browseMergePath('right')"
          />
        </span>
        <span
          class="merge-to-chrome"
          data-testid="merge-to-chrome"
        >
          <span>{{ $t('ui.mergeTo') }}</span>
          <label class="merge-to-option">
            <input
              v-model="mergeTarget"
              data-testid="merge-to-left"
              type="radio"
              value="left"
            />
            <span>{{ $t('ui.left') }}</span>
          </label>
          <label class="merge-to-option">
            <input
              v-model="mergeTarget"
              data-testid="merge-to-right"
              type="radio"
              value="right"
            />
            <span>{{ $t('ui.right') }}</span>
          </label>
          <label class="merge-to-option">
            <input
              v-model="mergeTarget"
              data-testid="merge-to-other"
              type="radio"
              value="other"
            />
            <span>{{ $t('ui.other') }}</span>
          </label>
          <span class="path-field-row merge-path-field">
            <input
              v-model="outputPath"
              class="output-path-input path-input"
              data-testid="merge-output-path"
              :title="outputPath"
              type="text"
              :disabled="mergeTargetLocked"
              :aria-label="$t('ui.mergeOutputPath')"
            />
            <SessionPathActions
              browse-test-id="merge-browse-output"
              :show-save="false"
              @browse="browseMergePath('output')"
            />
          </span>
        </span>
        <button
          type="button"
          class="bc-path-load"
          data-testid="load-text-merge"
          :disabled="loading || !leftPath || !rightPath"
          :aria-label="$t('ui.loadFiles')"
          :title="$t('ui.loadFiles')"
          @click="loadMerge"
        >
          {{ $t('ui.loadFiles') }}
        </button>
        <button
          type="button"
          class="toolbar-button"
          data-testid="save-merge-output"
          :disabled="saving"
          @click="saveOutput"
        >
          {{ $t('ui.saveOutput') }}
        </button>
        <button
          type="button"
          class="toolbar-button"
          data-testid="export-text-merge-report"
          :disabled="!leftPath || !rightPath"
          @click="exportTextMergeReport"
        >
          {{ $t('ui.exportMergeReport') }}
        </button>
        <span
          class="status-chip"
          data-testid="merge-save-status"
        >
          {{ saveStatus }}
        </span>
        <span
          v-if="reportStatus"
          class="status-chip"
          data-testid="text-merge-report-status"
          >{{ reportStatus }}</span
        >
      </div>

      <p
        v-if="!leftPath && !rightPath && outputLines.length === 0"
        class="empty"
        data-testid="text-merge-empty-hint"
      >
        {{ $t('ui.emptyCompareHint') }}
      </p>
      <div
        class="merge-grid"
        data-testid="merge-four-way-grid"
      >
        <section
          v-for="pane in sourcePanes"
          :key="pane.id"
          class="merge-pane merge-pane-source"
          :data-testid="`merge-pane-${pane.id}`"
        >
          <header class="pane-header">
            <div>
              <h2>{{ pane.title }}</h2>
              <span>{{ pane.subtitle }}</span>
            </div>
            <small>{{ $t('status.lines', { count: pane.lines.length }) }}</small>
          </header>
          <ol
            :ref="(el) => setPaneBodyRef(pane.id, el as Element | null)"
            class="merge-lines"
            @scroll="onPaneScroll(pane.id, $event)"
          >
            <li
              v-for="(line, index) in pane.lines"
              :key="`${pane.id}-${String(index)}`"
              :data-line-index="index"
              :class="[
                lineClass(line, pane.id),
                { active: currentConflict && index === currentConflict.line - 1 },
              ]"
            >
              <span class="line-number">{{ index + 1 }}</span>
              <code>{{ line }}</code>
            </li>
          </ol>
        </section>
        <section
          class="merge-pane merge-pane-output"
          data-testid="merge-pane-output"
        >
          <header class="pane-header">
            <div>
              <h2>{{ outputPane.title }}</h2>
              <span>{{ outputPane.subtitle }}</span>
            </div>
            <small>{{ $t('status.lines', { count: outputPane.lines.length }) }}</small>
          </header>
          <textarea
            :ref="(el) => setPaneBodyRef('output', el as Element | null)"
            v-model="outputText"
            class="output-editor"
            data-testid="merge-output-editor"
            spellcheck="false"
            @keydown="onOutputEditorKeydown"
            @scroll="onPaneScroll('output', $event)"
          />
        </section>
      </div>

      <section
        class="conflict-panel"
        :aria-label="$t('ui.mergeConflicts')"
      >
        <header>
          <h2>{{ $t('ui.conflicts') }}</h2>
          <span>{{ conflictStatus }}</span>
        </header>
        <ul
          class="conflict-list"
          data-testid="merge-conflict-list"
        >
          <li
            v-for="conflict in unresolvedConflicts"
            :key="conflict.id"
            :class="{ active: currentConflict?.id === conflict.id }"
            :data-testid="`merge-conflict-item-${conflict.id}`"
            @click="selectConflict(conflict.id)"
          >
            <strong>{{ $t('ui.line') }} {{ conflict.line }}: {{ conflict.title }}</strong>
            <div class="conflict-source">
              <span class="conflict-text">{{ $t('ui.left') }}: {{ conflict.left }}</span>
              <button
                type="button"
                data-testid="accept-left-conflict"
                @click.stop="acceptConflict('left')"
              >
                {{ $t('ui.acceptLeft') }}
              </button>
            </div>
            <div class="conflict-source">
              <span class="conflict-text">{{ $t('ui.base') }}: {{ conflict.base }}</span>
              <button
                type="button"
                data-testid="accept-base-conflict"
                @click.stop="acceptConflict('base')"
              >
                {{ $t('ui.acceptBase') }}
              </button>
            </div>
            <div class="conflict-source">
              <span class="conflict-text">{{ $t('ui.right') }}: {{ conflict.right }}</span>
              <button
                type="button"
                data-testid="accept-right-conflict"
                @click.stop="acceptConflict('right')"
              >
                {{ $t('ui.acceptRight') }}
              </button>
            </div>
          </li>
        </ul>
      </section>
    </section>

    <template #inspector>
      <WorkbenchInspector>
        <section class="workbench-inspector-section">
          <h2>{{ $t('ui.mergeConflicts') }}</h2>
          <dl>
            <div>
              <dt>{{ $t('ui.conflicts') }}</dt>
              <dd data-tone="conflict">{{ conflictStatus }}</dd>
            </div>
            <div>
              <dt>{{ $t('ui.selection') }}</dt>
              <dd>{{ currentConflict?.title ?? '--' }}</dd>
            </div>
            <div>
              <dt>{{ $t('ui.outputFolder') }}</dt>
              <dd>{{ outputPath }}</dd>
            </div>
            <div>
              <dt>{{ $t('ui.status') }}</dt>
              <dd>{{ saveStatus }}</dd>
            </div>
          </dl>
        </section>
      </WorkbenchInspector>
    </template>
  </WorkbenchShell>

  <SessionSettingsDialog
    :open="showSessionSettings"
    kind="text"
    :text-options="textSessionOptions"
    @close="showSessionSettings = false"
    @apply="applyTextMergeSessionSettings"
  />
</template>
<style scoped>
.text-merge-view {
  display: grid;
  grid-template-rows: auto minmax(0, 1fr) auto;
  gap: 2px;
  height: 100%;
  padding: 2px 4px;
  overflow: hidden;
}

.merge-toolbar {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 2px;
  min-height: 20px;
}

.merge-toolbar > div {
  display: flex;
  align-items: baseline;
  gap: 6px;
  min-width: 0;
}

.merge-toolbar span,
.status-chip {
  color: var(--app-text-muted);
  font-size: 11px;
}

.status-chip {
  max-width: min(280px, 100%);
  padding: 1px 5px;
  overflow: hidden;
  border: 1px solid var(--app-border);
  border-radius: 2px;
  background: var(--app-surface);
  text-overflow: ellipsis;
  white-space: nowrap;
}

.path-field-row,
.merge-path-field {
  display: inline-flex;
  align-items: center;
  gap: 2px;
  min-width: 0;
}

.path-field-row .output-path-input,
.merge-path-field .output-path-input {
  flex: 1;
  min-width: 0;
}

.output-path-input {
  width: 220px;
  min-width: 0;
  max-width: 100%;
  height: 20px;
  padding: 0 4px;
  overflow: hidden;
  border: 1px solid var(--app-border);
  border-radius: 0;
  background: var(--app-surface);
  color: var(--app-text);
  font-size: 12px;
  white-space: nowrap;
  text-overflow: ellipsis;
}

.toolbar-button {
  height: 18px;
  padding: 0 4px;
  border: 1px solid var(--app-border);
  border-radius: 2px;
  background: var(--app-surface);
  color: var(--app-text);
  font-size: 11px;
  line-height: 1.2;
  cursor: pointer;
}

.toolbar-button-icon {
  display: inline-flex;
  align-items: center;
  gap: 4px;
}

.favor-chrome,
.conflict-nav-chrome,
.accept-chrome {
  display: inline-flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 4px;
}

.toolbar-button-dense {
  justify-content: center;
  width: 20px;
  padding: 0;
}

.toolbar-button-glyph {
  flex-shrink: 0;
  color: #2f353d;
}

.toolbar-button:disabled {
  cursor: not-allowed;
  opacity: 0.5;
}

.conflict-nav-chrome,
.favor-chrome {
  display: inline-flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 4px;
}

.sync-panes-toggle {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  color: var(--app-text-muted);
  font-size: 11px;
}

.merge-lines li.active,
.conflict-list li.active {
  outline: 1px solid var(--app-accent);
  background: color-mix(in srgb, var(--app-accent) 12%, transparent);
}

.merge-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  grid-template-rows: minmax(0, 1fr) minmax(0, 1.15fr);
  gap: 4px;
  min-height: 0;
}

.merge-pane {
  display: grid;
  grid-template-rows: auto minmax(0, 1fr);
  min-width: 0;
  min-height: 0;
  overflow: hidden;
  border: 1px solid var(--app-border);
  border-radius: 0;
  background: var(--app-surface);
}

.merge-pane-output {
  grid-column: 1 / -1;
}

.merge-to-chrome {
  display: inline-flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 4px;
}

.merge-to-option {
  display: inline-flex;
  align-items: center;
  gap: 3px;
  color: var(--app-text-muted);
  font-size: 11px;
}

.pane-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 2px;
  min-height: 20px;
  padding: 1px 3px;
  border-bottom: 1px solid var(--app-border);
  background: var(--app-surface-muted);
}

.pane-header h2 {
  margin: 0;
  font-size: 11px;
  line-height: 1.1;
}

.pane-header span,
.pane-header small {
  color: var(--app-text-muted);
  font-size: 10px;
}

.merge-lines {
  display: grid;
  align-content: start;
  min-height: 0;
  margin: 0;
  padding: 0;
  overflow: auto;
  font-family: var(--font-mono);
  font-size: 11px;
  line-height: 16px;
  list-style: none;
}

.output-editor {
  width: 100%;
  min-width: 0;
  min-height: 0;
  padding: 2px 4px;
  border: 0;
  outline: 0;
  background: var(--app-surface);
  color: var(--app-text);
  font-family: var(--font-mono);
  font-size: 11px;
  line-height: 18px;
  resize: none;
  white-space: pre;
}

.merge-lines li {
  display: grid;
  grid-template-columns: 36px minmax(0, 1fr);
  min-height: 18px;
  border-bottom: 1px solid var(--app-border);
}

.merge-lines li.conflict {
  background: var(--diff-modified-bg);
}

.merge-lines li.marker {
  background: var(--diff-deleted-bg);
  color: var(--diff-deleted-fg);
  font-weight: 700;
}

.line-number {
  display: grid;
  align-items: center;
  justify-content: end;
  padding: 0 6px;
  background: var(--diff-gutter-bg);
  color: var(--app-text-muted);
  user-select: none;
}

.merge-lines code {
  min-width: 0;
  padding: 0 4px;
  overflow-wrap: anywhere;
  color: inherit;
  font-family: inherit;
  line-height: 16px;
  white-space: pre-wrap;
}

.conflict-panel {
  display: grid;
  gap: 2px;
  padding: 2px 4px;
  border: 1px solid var(--app-border);
  border-radius: 0;
  background: var(--app-surface);
}

.conflict-panel header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 6px;
  min-height: 22px;
}

.conflict-panel h2 {
  margin: 0;
  font-size: 12px;
}

.conflict-panel header span {
  color: var(--app-text-muted);
  font-size: 11px;
}

.conflict-list {
  display: grid;
  gap: 4px;
  margin: 0;
  padding: 0;
  list-style: none;
}

.conflict-list li {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 4px;
  padding: 2px 4px;
  border: 1px solid var(--app-border);
  border-radius: 2px;
  background: var(--app-surface-muted);
  color: var(--app-text-muted);
  font-family: var(--font-mono);
  font-size: 11px;
}

.conflict-list strong {
  color: var(--app-text);
  font-family: inherit;
}

.conflict-source {
  display: grid;
  gap: 6px;
  min-width: 0;
}

.conflict-text {
  min-width: 0;
  overflow-wrap: anywhere;
  white-space: pre-wrap;
}

.conflict-source button {
  justify-self: start;
  height: 22px;
  padding: 0 6px;
  border: 1px solid var(--app-border);
  border-radius: 2px;
  background: var(--app-surface);
  color: var(--app-text);
  font: inherit;
  cursor: pointer;
}

.conflict-source button:hover {
  background: var(--app-bg);
}

@media (width <= 1100px) {
  .merge-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
    grid-template-rows: none;
  }

  .merge-pane-output {
    grid-column: 1 / -1;
  }

  .conflict-list li {
    grid-template-columns: 1fr 1fr;
  }
}

@media (width <= 640px) {
  .text-merge-view {
    overflow: auto;
  }

  .merge-toolbar {
    flex-direction: column;
    align-items: flex-start;
  }

  .merge-grid,
  .conflict-list li {
    grid-template-columns: 1fr;
  }

  .merge-pane-output {
    grid-column: auto;
  }

  .merge-pane {
    min-height: 220px;
  }
}

.favor-chrome {
  display: inline-flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 4px;
}
</style>
