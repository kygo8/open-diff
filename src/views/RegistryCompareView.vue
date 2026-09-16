<script setup lang="ts">
import { computed, onMounted, ref, watch, watchEffect } from 'vue'
import { useRouter } from 'vue-router'
import {
  applyLiveRegistryValue,
  compareRegistryExports,
  compareRegistryHiveFiles,
  compareRegistryLiveKeys,
  readTextFile,
  saveTextFile,
} from '@/api/diff'
import { queryLiveWindowsRegistry } from '@/api/policy'
import { usePolicyStore } from '@/stores/policy'
import type {
  FileStamp,
  RegistryCompareResponse,
  RegistryDiffStatus,
  RegistryKeyNode,
  RegistryValueRow,
  RegistryValueSide,
} from '@/types/diff'
import WorkbenchShell from '@/components/workbench/WorkbenchShell.vue'
import WorkbenchInspector from '@/components/workbench/WorkbenchInspector.vue'
import {
  applyRegistryValueSide,
  collectExpandableKeyPaths,
  registryValueMatchesFilter,
  type RegistryValueFilter,
} from '@/app/registryWorkspace'
import { buildRegistryReportText, defaultRegistryReportOutputPath } from '@/app/registryReport'
import { buildRegistryCompareToolbar, pathPairTitle } from '@/app/sessionToolbars'
import { useSessionLaunchStore } from '@/stores/sessionLaunch'
import { useTabsStore } from '@/stores/tabs'
import { useStatusBarStore } from '@/stores/statusBar'
import { elapsedSecondsSince } from '@/app/statusBarPhrases'
import { formatPathModifiedAt } from '@/app/pathMetadata'
import { useViewActionsStore } from '@/stores/viewActions'
import { useSettingsStore } from '@/stores/settings'
import { useI18n } from '@/i18n'

interface FlatRegistryKeyNode extends RegistryKeyNode {
  depth: number
}

const settings = useSettingsStore()
const registryStatuses: RegistryDiffStatus[] = ['added', 'removed', 'modified', 'unchanged']
const leftExport = ref('')
const rightExport = ref('')
const sessionLaunch = useSessionLaunchStore()
const tabs = useTabsStore()
const router = useRouter()
const { t } = useI18n()
const leftName = ref('left.reg')
const rightName = ref('right.reg')
const registryTree = ref<RegistryKeyNode[]>([])
const loading = ref(false)
const error = ref('')
const valueFilter = ref<RegistryValueFilter>('all')
const collapsedKeyPaths = ref<Set<string>>(new Set())
const selectedKeyPath = ref<string>()
const selectedValueKey = ref<string>()
const lastApplyAction = ref('')
const liveQueryKey = ref('')
const liveQueryResult = ref('')
const liveQueryError = ref('')
const liveQueryLoading = ref(false)
const leftLiveKey = ref('HKCU\\Software')
const rightLiveKey = ref('HKLM\\Software')
const liveCompareLoading = ref(false)
const leftHivePath = ref('')
const rightHivePath = ref('')
const hiveRootSubpath = ref('')
const hiveCompareLoading = ref(false)
const policy = usePolicyStore()
const leftSourcePath = ref('')
const rightSourcePath = ref('')
const leftFileStamp = ref<FileStamp | null>(null)
const rightFileStamp = ref<FileStamp | null>(null)
const leftEncoding = ref('')
const rightEncoding = ref('')
const reportStatus = ref('')
const loadTimeSeconds = ref<number | null>(null)
const statusBar = useStatusBarStore()
const viewActions = useViewActionsStore()

onMounted(() => {
  void policy.load()
  const launch = sessionLaunch.consumeLaunch('/compare/registry')

  if (!launch) {
    return
  }

  if (launch.locations.left?.displayName) {
    leftName.value = launch.locations.left.displayName
  }

  if (launch.locations.right?.displayName) {
    rightName.value = launch.locations.right.displayName
  }

  if (launch.autoRun && launch.locations.left?.uri && launch.locations.right?.uri) {
    void loadLaunchRegistryExports(launch.locations.left.uri, launch.locations.right.uri)
  }
})

function syncRegistryTabTitle(): void {
  if (!leftName.value || !rightName.value) {
    return
  }

  tabs.setTabTitle('/compare/registry', pathPairTitle(leftName.value, rightName.value))
}

watch(
  [leftName, rightName],
  () => {
    syncRegistryTabTitle()
  },
  { immediate: true },
)

const flatRegistryKeys = computed<FlatRegistryKeyNode[]>(() =>
  flattenRegistryKeys(registryTree.value),
)
const differingRegistryKeys = computed(() =>
  flatRegistryKeys.value.filter((key) => key.status !== 'unchanged'),
)
const visibleRegistryKeys = computed<FlatRegistryKeyNode[]>(() =>
  flattenRegistryKeys(registryTree.value, 0, collapsedKeyPaths.value),
)
const allRegistryValues = computed<RegistryValueRow[]>(() =>
  flatRegistryKeys.value.flatMap((key) => key.values),
)
const visibleRegistryValues = computed<RegistryValueRow[]>(() => {
  const values = selectedKeyPath.value
    ? (flatRegistryKeys.value.find((key) => key.path === selectedKeyPath.value)?.values ?? [])
    : allRegistryValues.value

  return values.filter((value) => registryValueMatchesFilter(value.status, valueFilter.value))
})
const registrySummary = computed<Record<RegistryDiffStatus, number>>(() => {
  const initial: Record<RegistryDiffStatus, number> = {
    added: 0,
    removed: 0,
    modified: 0,
    unchanged: 0,
  }

  for (const value of allRegistryValues.value) {
    initial[value.status] += 1
  }

  return initial
})
const selectedValue = computed(() =>
  allRegistryValues.value.find(
    (value) => `${value.keyPath}::${value.name}` === selectedValueKey.value,
  ),
)

function flattenRegistryKeys(
  nodes: RegistryKeyNode[],
  depth = 0,
  collapsed?: Set<string>,
): FlatRegistryKeyNode[] {
  const rows: FlatRegistryKeyNode[] = []

  for (const node of nodes) {
    rows.push({ ...node, depth })
    if (collapsed?.has(node.path)) {
      continue
    }
    rows.push(...flattenRegistryKeys(node.children, depth + 1, collapsed))
  }

  return rows
}

function statusLabel(status: RegistryDiffStatus): string {
  const labels: Record<RegistryDiffStatus, string> = {
    added: 'ui.added',
    removed: 'ui.removed',
    modified: 'ui.modified',
    unchanged: 'ui.unchanged',
  }

  return t(labels[status])
}

function registryValueText(value?: RegistryValueSide): string {
  if (!value) {
    return '--'
  }

  return `${value.kind} ${value.data}`
}

function applyRegistryResult(result: RegistryCompareResponse): void {
  leftName.value = result.leftName
  rightName.value = result.rightName
  registryTree.value = result.tree
  collapsedKeyPaths.value = new Set()
  selectedKeyPath.value = result.tree[0]?.path
  selectedValueKey.value = undefined
  lastApplyAction.value = ''
}

const leftPathFooterLabel = computed(() => formatRegistryPathFooter(leftFileStamp.value))
const rightPathFooterLabel = computed(() => formatRegistryPathFooter(rightFileStamp.value))

function formatRegistryPathFooter(stamp: FileStamp | null): string {
  if (!stamp) {
    return ''
  }

  const modified = formatPathModifiedAt(stamp.modifiedAtMs, {
    showMilliseconds: settings.showMillisecondsInTimestamps,
  })

  if (!modified) {
    return t('status.bytes', { count: stamp.size })
  }

  return t('status.pathFileMetadata', { bytes: stamp.size, modified })
}

const registryStatusEncoding = computed(() => {
  if (leftEncoding.value && rightEncoding.value) {
    if (leftEncoding.value === rightEncoding.value) {
      return leftEncoding.value
    }

    return `${leftEncoding.value} / ${rightEncoding.value}`
  }

  return leftEncoding.value || rightEncoding.value || 'UTF-8'
})

watchEffect(() => {
  const hasTree = registryTree.value.length > 0
  let comparisonStatus = t('status.readyIdle')

  if (loading.value) {
    comparisonStatus = t('status.comparing')
  } else if (hasTree) {
    comparisonStatus = t('status.compared')
  }

  // Registry has no minor/unimportant classification — differing keys are Important.
  const importantDifferenceCount = hasTree ? differingRegistryKeys.value.length : null
  const unimportantDifferenceCount = hasTree ? 0 : null

  statusBar.reportStatus({
    comparisonStatus,
    differenceCount: hasTree ? differingRegistryKeys.value.length : null,
    encoding: registryStatusEncoding.value,
    filterStatus: t('status.allRows'),
    source: 'registry-compare',
    chromeKind: 'registry-session',
    loadTimeSeconds: hasTree ? loadTimeSeconds.value : null,
    importantDifferenceCount,
    unimportantDifferenceCount,
  })
})

async function runRegistryCompare(): Promise<void> {
  const startedAt = performance.now()

  loading.value = true
  error.value = ''
  try {
    const result = await compareRegistryExports({
      left: leftExport.value,
      right: rightExport.value,
      leftName: leftName.value,
      rightName: rightName.value,
    })

    applyRegistryResult(result)
    loadTimeSeconds.value = elapsedSecondsSince(startedAt)
  } catch (event) {
    error.value = String(event)
  } finally {
    loading.value = false
  }
}

async function loadLaunchRegistryExports(leftPath: string, rightPath: string): Promise<void> {
  loading.value = true
  error.value = ''

  try {
    const [leftFile, rightFile] = await Promise.all([
      readTextFile(leftPath),
      readTextFile(rightPath),
    ])

    leftExport.value = leftFile.text
    rightExport.value = rightFile.text
    leftSourcePath.value = leftFile.path
    rightSourcePath.value = rightFile.path
    leftFileStamp.value = leftFile.fileStamp
    rightFileStamp.value = rightFile.fileStamp
    leftEncoding.value = leftFile.encoding
    rightEncoding.value = rightFile.encoding
    leftName.value = fileNameFromPath(leftFile.path)
    rightName.value = fileNameFromPath(rightFile.path)
    await runRegistryCompare()
  } catch (event) {
    error.value = String(event)
    loading.value = false
  }
}

function fileNameFromPath(path: string): string {
  return path.replaceAll('\\', '/').split('/').filter(Boolean).at(-1) ?? path
}

function mapValueTree(
  nodes: RegistryKeyNode[],
  mapper: (value: RegistryValueRow) => RegistryValueRow,
): RegistryKeyNode[] {
  return nodes.map((node) => ({
    ...node,
    values: node.values.map(mapper),
    children: mapValueTree(node.children, mapper),
  }))
}

async function applySelectedValue(source: 'left' | 'right'): Promise<void> {
  const current = selectedValue.value

  if (!current) {
    return
  }

  const key = `${current.keyPath}::${current.name}`
  const side = current[source]

  registryTree.value = mapValueTree(registryTree.value, (value) => {
    if (`${value.keyPath}::${value.name}` !== key) {
      return value
    }

    return applyRegistryValueSide(value, source)
  })

  if (!policy.isWindows) {
    lastApplyAction.value = t(
      source === 'left' ? 'status.registryAppliedLeft' : 'status.registryAppliedRight',
      { name: current.name },
    )

    return
  }

  try {
    const result = await applyLiveRegistryValue({
      targetKey: current.keyPath.replaceAll('/', '\\'),
      name: current.name,
      kind: side?.kind,
      data: side?.data,
    })

    let statusKey = 'status.registryWroteRight'

    if (result.action === 'delete') {
      statusKey = 'status.registryDeletedLive'
    } else if (source === 'left') {
      statusKey = 'status.registryWroteLeft'
    }

    lastApplyAction.value = t(statusKey, { name: current.name })
  } catch (event) {
    lastApplyAction.value = String(event)
    liveQueryError.value = String(event)
  }
}

function selectKey(path: string): void {
  selectedKeyPath.value = path
  liveQueryKey.value = path.replaceAll('/', '\\')
}

function selectValue(value: RegistryValueRow): void {
  selectedKeyPath.value = value.keyPath
  selectedValueKey.value = `${value.keyPath}::${value.name}`
}

function expandAllKeys(): void {
  collapsedKeyPaths.value = new Set()
}

function collapseAllKeys(): void {
  collapsedKeyPaths.value = new Set(collectExpandableKeyPaths(registryTree.value))
}

function toggleKeyCollapsed(path: string, hasChildren: boolean): void {
  if (!hasChildren) {
    selectKey(path)

    return
  }

  const next = new Set(collapsedKeyPaths.value)

  if (next.has(path)) {
    next.delete(path)
  } else {
    next.add(path)
  }

  collapsedKeyPaths.value = next
  selectKey(path)
}

async function runLiveRegistryQuery(): Promise<void> {
  if (!liveQueryKey.value.trim()) {
    return
  }

  liveQueryLoading.value = true
  liveQueryError.value = ''
  liveQueryResult.value = ''

  try {
    liveQueryResult.value = await queryLiveWindowsRegistry(liveQueryKey.value.trim())
  } catch (event) {
    liveQueryError.value = String(event)
  } finally {
    liveQueryLoading.value = false
  }
}

async function runLiveRegistryCompare(): Promise<void> {
  if (!leftLiveKey.value.trim() || !rightLiveKey.value.trim()) {
    return
  }

  const startedAt = performance.now()

  liveCompareLoading.value = true
  error.value = ''
  liveQueryError.value = ''

  try {
    const result = await compareRegistryLiveKeys({
      leftKey: leftLiveKey.value.trim(),
      rightKey: rightLiveKey.value.trim(),
      leftName: leftLiveKey.value.trim(),
      rightName: rightLiveKey.value.trim(),
    })

    leftExport.value = ''
    rightExport.value = ''
    leftSourcePath.value = leftLiveKey.value.trim()
    rightSourcePath.value = rightLiveKey.value.trim()
    applyRegistryResult(result)
    loadTimeSeconds.value = elapsedSecondsSince(startedAt)
  } catch (event) {
    error.value = String(event)
  } finally {
    liveCompareLoading.value = false
  }
}

async function runHiveFileCompare(): Promise<void> {
  if (!leftHivePath.value.trim() || !rightHivePath.value.trim()) {
    return
  }

  const startedAt = performance.now()

  hiveCompareLoading.value = true
  error.value = ''

  try {
    const root = hiveRootSubpath.value.trim() || undefined
    const result = await compareRegistryHiveFiles({
      leftPath: leftHivePath.value.trim(),
      rightPath: rightHivePath.value.trim(),
      leftRoot: root,
      rightRoot: root,
    })

    leftExport.value = ''
    rightExport.value = ''
    leftSourcePath.value = leftHivePath.value.trim()
    rightSourcePath.value = rightHivePath.value.trim()
    applyRegistryResult(result)
    loadTimeSeconds.value = elapsedSecondsSince(startedAt)
  } catch (event) {
    error.value = String(event)
  } finally {
    hiveCompareLoading.value = false
  }
}

async function exportRegistryReport(): Promise<void> {
  if (allRegistryValues.value.length === 0) {
    return
  }

  const leftPath = leftSourcePath.value || leftName.value
  const rightPath = rightSourcePath.value || rightName.value
  const payload = buildRegistryReportText({
    leftPath,
    rightPath,
    summary: {
      added: registrySummary.value.added,
      removed: registrySummary.value.removed,
      modified: registrySummary.value.modified,
      unchanged: registrySummary.value.unchanged,
    },
    values: allRegistryValues.value.map((value) => ({
      keyPath: value.keyPath,
      name: value.name,
      left: registryValueText(value.left),
      right: registryValueText(value.right),
      status: value.status,
    })),
  })
  const outputPath = defaultRegistryReportOutputPath(leftPath)

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

watch(
  () => [viewActions.sequence, viewActions.name] as const,
  ([, actionName]) => {
    if (!actionName) {
      return
    }

    switch (actionName) {
      case 'compare':
      case 'reload':
        void runRegistryCompare()
        break
      case 'swap':
        runRegistryToolbarCommand('swap')
        break
      case 'export':
      case 'save':
      case 'save-as':
        void exportRegistryReport()
        break
      case 'show-all':
        valueFilter.value = 'all'
        break
      case 'show-differences':
      case 'filters':
        valueFilter.value = 'diffs'
        break
      case 'copy':
      case 'copy-right':
        void applySelectedValue('right')
        break
      case 'copy-left':
        void applySelectedValue('left')
        break
      case 'expand-all':
        expandAllKeys()
        break
      case 'collapse-all':
        collapseAllKeys()
        break
      case 'about':
      case 'check-for-updates':
      case 'close-tab':
      case 'clear-session':
      case 'cut':
      case 'delete':
      case 'export-settings':
      case 'help-contents':
      case 'help-context':
      case 'help-support':
      case 'import-settings':
      case 'next-difference':
        navigateRegistryDifference(1)
        break
      case 'previous-difference':
        navigateRegistryDifference(-1)
        break
      case 'paste':
      case 'redo':
      case 'restore-factory-defaults':
      case 'rules':
      case 'save-snapshot':
      case 'session-settings':
      case 'undo':
      case 'workspace-load':
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
      case 'save-report':
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

const registrySessionToolbar = computed(() =>
  buildRegistryCompareToolbar({
    home: true,
    all: true,
    diffs: true,
    same: true,
    copy: Boolean(selectedValue.value),
    'next-diff': differingRegistryKeys.value.length > 0,
    'prev-diff': differingRegistryKeys.value.length > 0,
    swap: Boolean(leftExport.value || rightExport.value),
    reload: Boolean(leftExport.value && rightExport.value),
    expand: registryTree.value.length > 0,
    collapse: registryTree.value.length > 0,
  }),
)

function navigateRegistryDifference(direction: 1 | -1): void {
  const keys = differingRegistryKeys.value

  if (keys.length === 0) {
    return
  }

  const currentIndex = keys.findIndex((key) => key.path === selectedKeyPath.value)
  let nextIndex = (currentIndex + direction + keys.length) % keys.length

  if (currentIndex < 0) {
    nextIndex = direction > 0 ? 0 : keys.length - 1
  }

  selectKey(keys[nextIndex].path)
}

function runRegistryToolbarCommand(commandId: string): void {
  if (commandId === 'home') {
    tabs.openTab({ title: 'Home', titleKey: 'ui.home', route: '/', dirty: false })
    void router.push('/')

    return
  }

  if (commandId === 'all') {
    valueFilter.value = 'all'

    return
  }

  if (commandId === 'diffs') {
    valueFilter.value = 'diffs'

    return
  }

  if (commandId === 'same') {
    valueFilter.value = 'same'

    return
  }

  if (commandId === 'expand') {
    expandAllKeys()

    return
  }

  if (commandId === 'collapse') {
    collapseAllKeys()

    return
  }

  if (commandId === 'copy') {
    void applySelectedValue('right')

    return
  }

  if (commandId === 'swap') {
    const nextLeft = rightExport.value

    rightExport.value = leftExport.value
    leftExport.value = nextLeft
    const nextLeftName = rightName.value

    rightName.value = leftName.value
    leftName.value = nextLeftName
    if (leftExport.value && rightExport.value) {
      void runRegistryCompare()
    }

    return
  }

  if (commandId === 'reload') {
    void runRegistryCompare()

    return
  }

  if (commandId === 'next-diff') {
    navigateRegistryDifference(1)

    return
  }

  if (commandId === 'prev-diff') {
    navigateRegistryDifference(-1)
  }
}
</script>

<template>
  <WorkbenchShell
    :title="$t('ui.registryCompare')"
    :eyebrow="$t('ui.registry')"
    :subtitle="`${leftName} -> ${rightName}`"
    :inspector-label="$t('ui.registryCompareInspector')"
    :toolbar-commands="registrySessionToolbar"
    toolbar-test-id-prefix="registry-session-toolbar"
    @toolbar-command="runRegistryToolbarCommand"
  >
    <section class="registry-compare-view">
      <header class="registry-header">
        <div>
          <p class="eyebrow">{{ $t('ui.registryCompare') }}</p>
          <h1>{{ $t('ui.registryCompare') }}</h1>
        </div>
        <div class="registry-source-pair">
          <span>{{ leftName }}</span>
          <span>{{ rightName }}</span>
        </div>
      </header>

      <p
        class="empty"
        data-testid="registry-export-hint"
      >
        {{ $t('ui.registryExportHint') }}
      </p>
      <p
        class="registry-maturity"
        data-testid="registry-maturity-note"
      >
        {{ $t('ui.registryMaturityNote') }}
      </p>
      <section class="registry-input-panel">
        <label>
          <span>{{ $t('ui.leftCurrentExport') }}</span>
          <textarea
            v-model="leftExport"
            data-testid="registry-left-export"
          />
        </label>
        <label>
          <span>{{ $t('ui.rightUpdatedExport') }}</span>
          <textarea
            v-model="rightExport"
            data-testid="registry-right-export"
          />
        </label>
        <button
          type="button"
          data-testid="run-registry-compare"
          :disabled="loading"
          @click="runRegistryCompare"
        >
          {{ $t('ui.runDiff') }}
        </button>
        <div
          class="bc-path-footers"
          data-testid="registry-path-footers"
        >
          <span
            class="path-side-footer"
            :class="{ 'path-side-footer-muted': !leftPathFooterLabel }"
            data-testid="registry-left-path-footer"
            >{{ leftPathFooterLabel || $t('status.panePlaceholder') }}</span
          >
          <span
            class="path-side-footer"
            :class="{ 'path-side-footer-muted': !rightPathFooterLabel }"
            data-testid="registry-right-path-footer"
            >{{ rightPathFooterLabel || $t('status.panePlaceholder') }}</span
          >
        </div>
      </section>

      <p
        v-if="error"
        class="registry-error"
        data-testid="registry-compare-error"
      >
        {{ error }}
      </p>

      <section class="registry-summary-grid">
        <article
          v-for="status in registryStatuses"
          :key="status"
          class="registry-summary-item"
          :class="`status-${status}`"
        >
          <strong :data-testid="`registry-summary-${status}`">
            {{ registrySummary[status] }}
          </strong>
          <span>{{ statusLabel(status) }}</span>
        </article>
      </section>

      <section
        v-if="allRegistryValues.length > 0"
        class="registry-report-panel"
        data-testid="registry-report-panel"
      >
        <header>
          <strong>{{ $t('ui.registryReport') }}</strong>
          <span>{{ $t('status.fieldCount', { count: allRegistryValues.length }) }}</span>
          <button
            type="button"
            data-testid="export-registry-report"
            @click="exportRegistryReport"
          >
            {{ $t('ui.export') }}
          </button>
          <span
            v-if="reportStatus"
            data-testid="registry-report-status"
            >{{ reportStatus }}</span
          >
        </header>
      </section>

      <section
        class="registry-filter-bar"
        data-testid="registry-filter-bar"
      >
        <span
          >{{ $t('ui.filters') }}:
          {{
            valueFilter === 'diffs'
              ? $t('ui.diffs')
              : valueFilter === 'same'
                ? $t('ui.same')
                : $t('ui.all')
          }}</span
        >
        <span
          v-if="lastApplyAction"
          data-testid="registry-apply-status"
          >{{ lastApplyAction }}</span
        >
        <button
          type="button"
          data-testid="registry-apply-left"
          :disabled="!selectedValue?.left"
          @click="applySelectedValue('left')"
        >
          {{ $t('ui.applyLeftValue') }}
        </button>
        <button
          type="button"
          data-testid="registry-apply-right"
          :disabled="!selectedValue?.right"
          @click="applySelectedValue('right')"
        >
          {{ $t('ui.applyRightValue') }}
        </button>
        <span
          v-if="!policy.isWindows"
          data-testid="registry-live-write-windows-only"
          >{{ $t('ui.liveRegistryWriteWindowsOnly') }}</span
        >
      </section>

      <section class="registry-layout">
        <aside class="registry-key-pane">
          <header>
            <strong>{{ $t('ui.keys') }}</strong>
            <span>{{ $t('status.keyCount', { count: flatRegistryKeys.length }) }}</span>
          </header>
          <div class="registry-key-list">
            <button
              v-for="key in visibleRegistryKeys"
              :key="key.path"
              type="button"
              class="registry-key-row"
              :class="[`status-${key.status}`, { selected: selectedKeyPath === key.path }]"
              :style="{ paddingLeft: `${8 + key.depth * 14}px` }"
              :data-testid="`registry-key-${key.path}`"
              @click="toggleKeyCollapsed(key.path, key.children.length > 0)"
            >
              <span
                >{{ key.children.length > 0 ? (collapsedKeyPaths.has(key.path) ? '+' : '-') : '·' }}
                {{ key.label }}</span
              >
              <small>{{ key.path }}</small>
              <strong>{{ statusLabel(key.status) }}</strong>
            </button>
          </div>
        </aside>

        <section class="registry-value-pane">
          <header>
            <strong>{{ $t('ui.values') }}</strong>
            <span>{{ $t('status.valueCount', { count: visibleRegistryValues.length }) }}</span>
          </header>
          <div class="registry-value-table">
            <div class="registry-value-row registry-value-head">
              <span>{{ $t('ui.key') }}</span>
              <span>{{ $t('ui.name') }}</span>
              <span>{{ $t('ui.left') }}</span>
              <span>{{ $t('ui.right') }}</span>
              <span>{{ $t('ui.status') }}</span>
            </div>
            <button
              v-for="value in visibleRegistryValues"
              :key="`${value.keyPath}::${value.name}`"
              type="button"
              class="registry-value-row"
              :class="[
                `status-${value.status}`,
                { selected: selectedValueKey === `${value.keyPath}::${value.name}` },
              ]"
              :data-testid="`registry-value-${value.keyPath}::${value.name}`"
              @click="selectValue(value)"
            >
              <span>{{ value.keyPath }}</span>
              <strong>{{ value.name }}</strong>
              <code>{{ registryValueText(value.left) }}</code>
              <code>{{ registryValueText(value.right) }}</code>
              <em>{{ statusLabel(value.status) }}</em>
            </button>
          </div>
        </section>
      </section>

      <section
        class="registry-live-panel"
        data-testid="registry-live-panel"
      >
        <header>
          <strong>{{ $t('ui.liveRegistryQuery') }}</strong>
          <span>{{ $t('ui.liveRegistryQueryHint') }}</span>
        </header>
        <div class="registry-live-row">
          <label>
            <span>{{ $t('ui.leftLiveKey') }}</span>
            <input
              v-model="leftLiveKey"
              data-testid="registry-live-left-key"
              type="text"
              :placeholder="$t('ui.liveRegistryKeyPlaceholder')"
            />
          </label>
          <label>
            <span>{{ $t('ui.rightLiveKey') }}</span>
            <input
              v-model="rightLiveKey"
              data-testid="registry-live-right-key"
              type="text"
              :placeholder="$t('ui.liveRegistryKeyPlaceholder')"
            />
          </label>
          <button
            type="button"
            data-testid="registry-live-compare"
            :disabled="liveCompareLoading || !leftLiveKey || !rightLiveKey || !policy.isWindows"
            @click="runLiveRegistryCompare"
          >
            {{ $t('ui.compareLiveRegistry') }}
          </button>
        </div>
        <p
          v-if="!policy.isWindows"
          class="empty"
          data-testid="registry-live-windows-only"
        >
          {{ $t('ui.liveRegistryWindowsOnly') }}
        </p>
        <div class="registry-live-row">
          <input
            v-model="liveQueryKey"
            data-testid="registry-live-key"
            type="text"
            :placeholder="$t('ui.liveRegistryKeyPlaceholder')"
          />
          <button
            type="button"
            data-testid="registry-live-query"
            :disabled="liveQueryLoading || !liveQueryKey"
            @click="runLiveRegistryQuery"
          >
            {{ $t('ui.queryLiveRegistry') }}
          </button>
        </div>
        <p
          v-if="liveQueryError"
          class="registry-error"
          data-testid="registry-live-error"
        >
          {{ liveQueryError }}
        </p>
        <pre
          v-if="liveQueryResult"
          class="registry-live-result"
          data-testid="registry-live-result"
          >{{ liveQueryResult }}</pre>
      </section>

      <section
        class="registry-live-panel"
        data-testid="registry-hive-panel"
      >
        <header>
          <strong>{{ $t('ui.hiveFileCompare') }}</strong>
          <span>{{ $t('ui.hiveFileCompareHint') }}</span>
        </header>
        <div class="registry-live-row">
          <label>
            <span>{{ $t('ui.leftHiveFile') }}</span>
            <input
              v-model="leftHivePath"
              data-testid="registry-hive-left-path"
              type="text"
            />
          </label>
          <label>
            <span>{{ $t('ui.rightHiveFile') }}</span>
            <input
              v-model="rightHivePath"
              data-testid="registry-hive-right-path"
              type="text"
            />
          </label>
          <label>
            <span>{{ $t('ui.hiveRootSubpath') }}</span>
            <input
              v-model="hiveRootSubpath"
              data-testid="registry-hive-root"
              type="text"
              :placeholder="$t('ui.hiveRootSubpath')"
            />
          </label>
          <button
            type="button"
            data-testid="registry-hive-compare"
            :disabled="hiveCompareLoading || !leftHivePath || !rightHivePath"
            @click="runHiveFileCompare"
          >
            {{ $t('ui.compareHiveFiles') }}
          </button>
        </div>
      </section>
    </section>

    <template #inspector>
      <WorkbenchInspector>
        <section class="workbench-inspector-section">
          <h2>{{ $t('ui.values') }}</h2>
          <dl>
            <div>
              <dt>{{ $t('ui.add') }}</dt>
              <dd data-tone="added">{{ registrySummary.added }}</dd>
            </div>
            <div>
              <dt>{{ $t('ui.delete') }}</dt>
              <dd data-tone="deleted">{{ registrySummary.removed }}</dd>
            </div>
            <div>
              <dt>{{ $t('ui.modified') }}</dt>
              <dd data-tone="modified">{{ registrySummary.modified }}</dd>
            </div>
            <div>
              <dt>{{ $t('ui.keys') }}</dt>
              <dd>{{ flatRegistryKeys.length }}</dd>
            </div>
          </dl>
        </section>
      </WorkbenchInspector>
    </template>
  </WorkbenchShell>
</template>
<style scoped>
.registry-compare-view {
  display: grid;
  gap: 2px;
  height: 100%;
  padding: 2px 4px;
  overflow: auto;
}

.registry-header {
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

h1 {
  margin: 0;
  font-size: 22px;
  line-height: 1.2;
}

.registry-source-pair {
  display: grid;
  gap: 2px;
  min-width: 220px;
  padding: 2px 6px;
  border: 1px solid var(--app-border);
  border-radius: 0;
  background: var(--app-surface);
  color: var(--app-text-muted);
  font-size: 11px;
  line-height: 14px;
  text-align: right;
}

.registry-input-panel {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(0, 1fr) auto;
  align-items: end;
  gap: 4px;
  min-height: 22px;
  padding: 1px 4px;
  border: 1px solid var(--app-border);
  border-radius: 0;
  background: var(--app-surface);
}

.registry-input-panel label {
  display: grid;
  gap: 2px;
  min-width: 0;
}

.registry-input-panel span {
  color: var(--app-text-muted);
  font-size: 11px;
}

.registry-input-panel textarea {
  min-width: 0;
  min-height: 72px;
  padding: 4px 6px;
  font-family: var(--font-mono);
  font-size: 11px;
  resize: vertical;
}

.registry-input-panel textarea,
.registry-input-panel button {
  border: 1px solid var(--app-border);
  border-radius: 4px;
  background: var(--app-bg);
  color: var(--app-text);
  font: inherit;
  font-size: 11px;
}

.registry-input-panel button {
  height: 20px;
  min-height: 20px;
  padding: 0 6px;
}

.registry-input-panel button:hover {
  border-color: var(--app-accent);
}

.registry-input-panel button:disabled {
  opacity: 0.65;
}

.registry-error {
  margin: 0;
  padding: 2px 6px;
  border: 1px solid var(--app-danger);
  border-radius: 0;
  background: var(--diff-deleted-bg);
  color: var(--diff-deleted-fg);
  font-size: 11px;
  line-height: 14px;
}

.registry-maturity,
.registry-filter-bar,
.registry-live-panel {
  margin: 0;
  padding: 2px 6px;
  border: 1px solid var(--app-border);
  border-radius: 0;
  background: var(--app-surface);
  color: var(--app-text-muted);
  font-size: 11px;
}

.registry-filter-bar,
.registry-live-row {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 4px 6px;
}

.registry-filter-bar button,
.registry-live-row button,
.registry-live-row input {
  height: 20px;
  min-height: 20px;
  padding: 0 6px;
  border: 1px solid var(--app-border);
  border-radius: 4px;
  background: var(--app-bg);
  color: var(--app-text);
  font: inherit;
  font-size: 11px;
}

.registry-live-row input {
  flex: 1 1 220px;
  min-width: 0;
}

.registry-live-row label {
  display: grid;
  flex: 1 1 200px;
  gap: 2px;
  min-width: 0;
  color: var(--app-text-muted);
  font-size: 11px;
  line-height: 14px;
}

.registry-live-result {
  margin: 4px 0 0;
  padding: 2px 6px;
  overflow: auto;
  border: 1px solid var(--app-border);
  border-radius: 0;
  background: var(--app-bg);
  font-family: var(--font-mono);
  font-size: 11px;
  line-height: 14px;
  white-space: pre-wrap;
}

.registry-key-row.selected,
.registry-value-row.selected {
  outline: 1px solid var(--app-accent);
}

.registry-report-panel {
  display: grid;
  gap: 4px;
  padding: 2px 6px;
  border: 1px solid var(--app-border);
  border-radius: 0;
  background: var(--app-surface);
}

.registry-report-panel header {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 6px;
  min-height: 18px;
}

.registry-report-panel header button {
  height: 20px;
  min-height: 20px;
  padding: 0 6px;
  border: 1px solid var(--app-border);
  border-radius: 4px;
  background: var(--app-bg);
  color: var(--app-text);
  font-size: 11px;
  cursor: pointer;
}

.registry-summary-grid {
  display: grid;
  grid-template-columns: repeat(4, minmax(120px, 1fr));
  gap: 4px 6px;
}

.registry-summary-item {
  display: grid;
  gap: 2px;
  min-height: 20px;
  padding: 1px 4px;
  border: 1px solid var(--app-border);
  border-radius: 0;
  background: var(--app-surface);
}

.registry-summary-item strong {
  font-size: 11px;
  line-height: 14px;
}

.registry-summary-item span {
  color: var(--app-text-muted);
  font-size: 11px;
  line-height: 14px;
}

.registry-layout {
  display: grid;
  grid-template-columns: minmax(280px, 360px) minmax(0, 1fr);
  gap: 4px;
  min-height: 0;
}

.registry-key-pane,
.registry-value-pane {
  display: grid;
  grid-template-rows: auto minmax(0, 1fr);
  gap: 4px;
  min-width: 0;
  padding: 1px 4px;
  border: 1px solid var(--app-border);
  border-radius: 0;
  background: var(--app-surface);
}

.registry-key-pane header,
.registry-value-pane header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 6px;
  min-height: 18px;
}

.registry-key-pane header span,
.registry-value-pane header span {
  color: var(--app-text-muted);
  font-size: 11px;
  line-height: 14px;
}

.registry-key-list {
  display: grid;
  align-content: start;
  overflow: auto;
  border: 1px solid var(--app-border);
  border-radius: 0;
  background: var(--app-bg);
}

.registry-key-row {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  gap: 0 6px;
  min-height: 22px;
  padding: 1px 4px 1px calc(8px + var(--key-depth, 0) * 14px);
  border: 0;
  border-bottom: 1px solid var(--app-border);
  background: transparent;
  color: var(--app-text);
  text-align: left;
}

.registry-key-row:last-child {
  border-bottom: 0;
}

.registry-key-row small {
  grid-column: 1 / -1;
  min-width: 0;
  overflow: hidden;
  color: var(--app-text-muted);
  font-family: var(--font-mono);
  font-size: 11px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.registry-key-row strong {
  color: var(--app-text-muted);
  font-size: 11px;
}

.registry-value-table {
  display: grid;
  overflow: auto;
  border: 1px solid var(--app-border);
  border-radius: 0;
  background: var(--app-bg);
}

.registry-value-row {
  display: grid;
  grid-template-columns:
    minmax(220px, 1.35fr) minmax(112px, 0.7fr) minmax(150px, 1fr)
    minmax(150px, 1fr) 92px;
  min-width: 760px;
  min-height: 20px;
  padding: 0;
  border: 0;
  border-bottom: 1px solid var(--app-border);
  border-radius: 0;
  background: transparent;
  color: inherit;
  font: inherit;
  font-size: 11px;
  text-align: left;
  cursor: pointer;
}

.registry-value-row:last-child {
  border-bottom: 0;
}

.registry-value-row > * {
  min-width: 0;
  margin: 0;
  padding: 1px 4px;
  overflow: hidden;
  border-right: 1px solid var(--app-border);
  font-style: normal;
  line-height: 14px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.registry-value-row > *:last-child {
  border-right: 0;
}

.registry-value-row code {
  font-family: var(--font-mono);
}

.registry-value-head {
  background: var(--app-surface-muted);
  color: var(--app-text-muted);
  font-weight: 700;
}

.status-added {
  background: var(--diff-added-bg);
}

.status-added strong,
.status-added em,
.status-added.registry-summary-item {
  color: var(--diff-added-fg);
}

.status-removed {
  background: var(--diff-deleted-bg);
}

.status-removed strong,
.status-removed em,
.status-removed.registry-summary-item {
  color: var(--diff-deleted-fg);
}

.status-modified {
  background: var(--diff-modified-bg);
}

.status-modified strong,
.status-modified em,
.status-modified.registry-summary-item {
  color: var(--diff-modified-fg);
}

.status-unchanged em {
  color: var(--app-text-muted);
}

@media (width <= 820px) {
  .registry-header,
  .registry-input-panel,
  .registry-layout,
  .registry-summary-grid {
    grid-template-columns: 1fr;
  }

  .registry-header {
    display: grid;
  }

  .registry-source-pair {
    text-align: left;
  }
}

.bc-path-footers {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 1px;
  width: 100%;
  margin-top: 0;
  padding: 0 2px;
}

.path-side-footer {
  min-height: 10px;
  margin-top: 0;
  overflow: hidden;
  color: var(--app-text-muted, #6b7280);
  font-size: 9px;
  line-height: 9px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.path-side-footer-muted {
  color: #9ca3af;
}
</style>
