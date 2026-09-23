<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { compareVersionFiles, pathFileStamp, saveTextFile } from '@/api/diff'
import { buildVersionReportText, defaultVersionReportOutputPath } from '@/app/versionReport'
import { useI18n } from '@/i18n'
import { formatCompareError } from '@/app/compareError'
import { elapsedSecondsSince } from '@/app/statusBarPhrases'
import { useStatusBarStore } from '@/stores/statusBar'
import type {
  FileStamp,
  VersionCompareResponse,
  VersionFieldRow,
  VersionFieldStatus,
  VersionSideSummary,
} from '@/types/diff'
import { pickNativePath } from '@/app/filePicker'
import PathMetaFooter from '@/components/workbench/PathMetaFooter.vue'
import SessionPathActions from '@/components/workbench/SessionPathActions.vue'
import WorkbenchShell from '@/components/workbench/WorkbenchShell.vue'
import SessionSettingsDialog from '@/components/session/SessionSettingsDialog.vue'
import WorkbenchInspector from '@/components/workbench/WorkbenchInspector.vue'
import { buildVersionCompareToolbar, pathPairTitle } from '@/app/sessionToolbars'
import {
  buildVersionRulesCatalog,
  defaultUnimportantVersionFields,
  isVersionFieldImportant,
  loadVersionCompareOptions,
  saveVersionCompareOptions,
  toggleVersionFieldImportance,
  type VersionCompareOptionsState,
  type VersionFieldFilter,
} from '@/app/versionCompareOptions'
import { useSessionLaunchStore } from '@/stores/sessionLaunch'
import { useViewActionsStore } from '@/stores/viewActions'
import { useTabsStore } from '@/stores/tabs'
import { useSettingsStore } from '@/stores/settings'

const settings = useSettingsStore()
const versionStatuses: VersionFieldStatus[] = ['added', 'removed', 'modified', 'unchanged']

const emptyVersionSide: VersionSideSummary = {
  name: '',
  fileType: '',
  targetOs: '',
  fileVersion: '',
  productVersion: '',
}
const { t } = useI18n()
const leftPath = ref('')
const rightPath = ref('')
const leftFileStamp = ref<FileStamp | null>(null)
const rightFileStamp = ref<FileStamp | null>(null)
const sessionLaunch = useSessionLaunchStore()
const tabs = useTabsStore()
const viewActions = useViewActionsStore()
const router = useRouter()
const leftVersion = ref<VersionSideSummary>({ ...emptyVersionSide })
const rightVersion = ref<VersionSideSummary>({ ...emptyVersionSide })
const versionFields = ref<VersionFieldRow[]>([])
const versionSummaryOverride = ref<Record<VersionFieldStatus, number> | null>(null)
const versionOptions = ref<VersionCompareOptionsState>(loadVersionCompareOptions())
const fieldFilter = ref<VersionFieldFilter>(versionOptions.value.defaultFilter)
const activeFieldIndex = ref(0)
const loading = ref(false)
const error = ref('')
const reportStatus = ref('')
const showVersionRules = ref(versionOptions.value.showRules)
const showSessionSettings = ref(false)
const statusBar = useStatusBarStore()
const loadTimeSeconds = ref<number | null>(null)

onMounted(() => {
  const launch = sessionLaunch.consumeLaunch('/compare/version')

  if (!launch) {
    return
  }

  leftPath.value = launch.locations.left?.uri ?? leftPath.value
  rightPath.value = launch.locations.right?.uri ?? rightPath.value

  if (launch.autoRun && launch.locations.left?.uri && launch.locations.right?.uri) {
    void runVersionCompare()
  }
})

const versionSummary = computed<Record<VersionFieldStatus, number>>(() => {
  if (versionSummaryOverride.value) {
    return versionSummaryOverride.value
  }

  const summary: Record<VersionFieldStatus, number> = {
    added: 0,
    removed: 0,
    modified: 0,
    unchanged: 0,
  }

  for (const field of versionFields.value) {
    summary[field.status] += 1
  }

  return summary
})

function fieldIsImportant(field: string): boolean {
  return isVersionFieldImportant(field, versionOptions.value)
}

const visibleVersionFields = computed(() => {
  if (fieldFilter.value === 'diffs') {
    return versionFields.value.filter(
      (field) => field.status !== 'unchanged' && fieldIsImportant(field.field),
    )
  }

  if (fieldFilter.value === 'same') {
    return versionFields.value.filter((field) => field.status === 'unchanged')
  }

  if (fieldFilter.value === 'minor') {
    return versionFields.value.filter(
      (field) => field.status !== 'unchanged' && !fieldIsImportant(field.field),
    )
  }

  return versionFields.value
})
const differenceFields = computed(() =>
  versionFields.value.filter((field) => {
    if (field.status === 'unchanged') {
      return false
    }

    if (fieldFilter.value === 'minor') {
      return !fieldIsImportant(field.field)
    }

    if (fieldFilter.value === 'diffs') {
      return fieldIsImportant(field.field)
    }

    return true
  }),
)

const versionRulesCatalog = computed(() =>
  buildVersionRulesCatalog(versionFields.value.map((row) => row.field)),
)

const minorDifferenceCount = computed(
  () =>
    versionFields.value.filter(
      (field) => field.status !== 'unchanged' && !fieldIsImportant(field.field),
    ).length,
)

const versionSessionToolbar = computed(() =>
  buildVersionCompareToolbar({
    home: true,
    sessions: true,
    all: true,
    diffs: true,
    same: true,
    minor: true,
    rules: true,
    'next-diff': differenceFields.value.length > 0,
    'prev-diff': differenceFields.value.length > 0,
    swap: Boolean(leftPath.value || rightPath.value),
    reload: Boolean(leftPath.value && rightPath.value),
  }).map((item) => ({
    ...item,
    active:
      Boolean(item.active) ||
      (item.id === 'rules' && showVersionRules.value) ||
      (item.id === 'sessions' && showSessionSettings.value),
  })),
)

const versionSubtitle = computed(() => {
  const left = leftVersion.value.name || leftPath.value
  const right = rightVersion.value.name || rightPath.value

  if (!left && !right) {
    return ''
  }

  return `${left || '—'} -> ${right || '—'}`
})

function syncVersionTabTitle(): void {
  if (!leftPath.value || !rightPath.value) {
    return
  }

  tabs.setTabTitle('/compare/version', pathPairTitle(leftPath.value, rightPath.value))
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
        void runVersionCompare()
        break
      case 'swap':
        runVersionToolbarCommand('swap')
        break
      case 'export':
      case 'save-report':
        void exportVersionReport()
        break

      case 'previous-difference':
        runVersionToolbarCommand('prev-diff')
        break
      case 'next-difference':
        runVersionToolbarCommand('next-diff')
        break
      case 'show-all':
        runVersionToolbarCommand('all')
        break
      case 'show-differences':
        runVersionToolbarCommand('diffs')
        break
      case 'toggle-minor':
        runVersionToolbarCommand(fieldFilter.value === 'minor' ? 'all' : 'minor')
        break
      case 'session-settings':
        openVersionSessionSettings()
        break
      case 'rules':
        runVersionToolbarCommand('rules')
        break
      case 'copy-left':
      case 'copy-right':
      case 'undo':
      case 'redo':
      case 'cut':
      case 'copy':
      case 'paste':
      case 'delete':
      case 'save':
      case 'save-as':
      case 'workspace-save':
      case 'close-tab':
      case 'clear-session':
      case 'about':
      case 'check-for-updates':
      case 'help-contents':
      case 'help-context':
      case 'help-support':
      case 'filters':
      case 'workspace-load':
      case 'export-settings':
      case 'import-settings':
      case 'restore-factory-defaults':
      case 'save-snapshot':
      case 'previous-conflict':
      case 'next-conflict':
      case 'expand-all':
      case 'collapse-all':
      case 'sync-now':
      case 'browse-folder':
      case 'up-one-level':
      case 'path-back':
      case 'path-forward':
      case 'toggle-session-locked':
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

watch([leftPath, rightPath], () => {
  syncVersionTabTitle()
})

function openVersionSessionSettings(): void {
  showSessionSettings.value = true
}

function applyVersionSessionSettings(
  payload:
    | { kind: 'folder'; criteria: unknown; filters?: unknown }
    | { kind: 'text'; options: unknown }
    | { kind: 'table'; options: unknown }
    | { kind: 'hex'; options: unknown }
    | { kind: 'picture'; options: unknown }
    | { kind: 'media'; options: unknown }
    | { kind: 'version'; options: VersionCompareOptionsState }
    | { kind: 'registry'; options: unknown }
    | { kind: 'patch'; options: unknown },
): void {
  if (payload.kind !== 'version') {
    return
  }

  versionOptions.value = { ...versionOptions.value, ...payload.options }
  fieldFilter.value = payload.options.defaultFilter
  showVersionRules.value = payload.options.showRules
  saveVersionCompareOptions(versionOptions.value)
  showSessionSettings.value = false
}

function runVersionToolbarCommand(commandId: string): void {
  if (commandId === 'home') {
    tabs.openTab({ title: 'Home', titleKey: 'ui.home', route: '/', dirty: false })
    void router.push('/')

    return
  }

  if (
    commandId === 'all' ||
    commandId === 'diffs' ||
    commandId === 'same' ||
    commandId === 'minor'
  ) {
    fieldFilter.value = commandId
    activeFieldIndex.value = 0

    return
  }

  if (commandId === 'rules') {
    showVersionRules.value = !showVersionRules.value

    return
  }

  if (commandId === 'sessions') {
    openVersionSessionSettings()

    return
  }

  if (commandId === 'swap') {
    const nextLeftPath = rightPath.value

    rightPath.value = leftPath.value
    leftPath.value = nextLeftPath
    const nextLeftStamp = rightFileStamp.value

    rightFileStamp.value = leftFileStamp.value
    leftFileStamp.value = nextLeftStamp
    const nextLeft = rightVersion.value

    rightVersion.value = leftVersion.value
    leftVersion.value = nextLeft
    syncVersionTabTitle()

    return
  }

  if (commandId === 'reload') {
    void runVersionCompare()

    return
  }

  if (commandId === 'next-diff' && differenceFields.value.length > 0) {
    activeFieldIndex.value = (activeFieldIndex.value + 1) % differenceFields.value.length

    return
  }

  if (commandId === 'prev-diff' && differenceFields.value.length > 0) {
    activeFieldIndex.value =
      (activeFieldIndex.value - 1 + differenceFields.value.length) % differenceFields.value.length
  }
}

function statusLabel(status: VersionFieldStatus): string {
  const labels: Record<VersionFieldStatus, string> = {
    added: 'ui.added',
    removed: 'ui.removed',
    modified: 'ui.modified',
    unchanged: 'ui.unchanged',
  }

  return t(labels[status])
}

function valueText(value?: string): string {
  return value ?? '--'
}

async function browseVersionPath(side: 'left' | 'right'): Promise<void> {
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

async function refreshVersionPathStamps(): Promise<void> {
  const [left, right] = await Promise.all([
    leftPath.value ? pathFileStamp(leftPath.value).catch(() => null) : Promise.resolve(null),
    rightPath.value ? pathFileStamp(rightPath.value).catch(() => null) : Promise.resolve(null),
  ])

  leftFileStamp.value = left
  rightFileStamp.value = right
}

function applyVersionResult(result: VersionCompareResponse): void {
  leftVersion.value = result.left
  rightVersion.value = result.right
  versionFields.value = result.fields
  versionSummaryOverride.value = result.summary
  activeFieldIndex.value = 0
  reportStatus.value = ''
  syncVersionTabTitle()
}

function persistVersionOptions(): void {
  saveVersionCompareOptions(versionOptions.value)
}

function toggleFieldImportance(field: string): void {
  versionOptions.value = toggleVersionFieldImportance(field, versionOptions.value)
  persistVersionOptions()
}

function resetVersionRules(): void {
  versionOptions.value = {
    ...versionOptions.value,
    unimportantFields: [...defaultUnimportantVersionFields],
  }
  persistVersionOptions()
}

async function exportVersionReport(): Promise<void> {
  if (versionFields.value.length === 0) {
    return
  }

  const payload = buildVersionReportText({
    leftPath: leftPath.value,
    rightPath: rightPath.value,
    summary: versionSummary.value,
    fields: versionFields.value.map((row) => ({
      group: row.group,
      field: row.field,
      left: valueText(row.left),
      right: valueText(row.right),
      status: row.status,
      important: fieldIsImportant(row.field),
    })),
  })
  const outputPath = defaultVersionReportOutputPath(leftPath.value)

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
    error.value = formatCompareError(event, t)
  }
}

async function runVersionCompare(): Promise<void> {
  const startedAt = performance.now()

  loading.value = true
  error.value = ''
  try {
    const result = await compareVersionFiles({
      leftPath: leftPath.value,
      rightPath: rightPath.value,
    })

    applyVersionResult(result)
    loadTimeSeconds.value = elapsedSecondsSince(startedAt)
    await refreshVersionPathStamps()
  } catch (event) {
    error.value = formatCompareError(event, t)
    await refreshVersionPathStamps()
  } finally {
    loading.value = false
  }
}

watch(
  [loading, versionFields, loadTimeSeconds],
  () => {
    const hasResult = versionFields.value.length > 0
    let comparisonStatus = t('status.readyIdle')

    if (loading.value) {
      comparisonStatus = t('status.comparing')
    } else if (hasResult) {
      comparisonStatus = t('status.compared')
    }

    statusBar.reportStatus({
      comparisonStatus,
      differenceCount: hasResult
        ? versionFields.value.filter((field) => field.status !== 'unchanged').length
        : null,
      filterStatus: t('status.allRows'),
      source: 'version-compare',
      loadTimeSeconds: hasResult ? loadTimeSeconds.value : null,
      chromeKind: 'version-session',
    })
  },
  { immediate: true },
)
</script>

<template>
  <WorkbenchShell
    :title="$t('ui.versionCompare')"
    :eyebrow="$t('ui.version')"
    :subtitle="versionSubtitle"
    :inspector-label="$t('ui.versionCompareInspector')"
    :toolbar-commands="versionSessionToolbar"
    toolbar-test-id-prefix="version-session-toolbar"
    @toolbar-command="runVersionToolbarCommand"
  >
    <section class="version-compare-view">
      <header class="version-header">
        <div>
          <p class="eyebrow">{{ $t('ui.versionCompare') }}</p>
          <h1>{{ $t('ui.versionCompare') }}</h1>
        </div>
        <div class="version-source-pair">
          <span>{{ $t('status.sideName', { side: $t('ui.left'), name: leftVersion.name }) }}</span>
          <span>{{
            $t('status.sideName', { side: $t('ui.right'), name: rightVersion.name })
          }}</span>
        </div>
      </header>

      <section class="version-path-panel">
        <label>
          <span>{{ $t('ui.left') }} {{ $t('ui.path') }}</span>
          <div class="path-field-row">
            <input
              v-model="leftPath"
              type="text"
              class="path-input"
              data-testid="version-left-path"
              :title="leftPath"
            />
            <SessionPathActions
              browse-test-id="version-browse-left"
              save-test-id="version-save-left"
              :can-save="false"
              @browse="browseVersionPath('left')"
            />
          </div>
        </label>
        <label>
          <span>{{ $t('ui.right') }} {{ $t('ui.path') }}</span>
          <div class="path-field-row">
            <input
              v-model="rightPath"
              type="text"
              class="path-input"
              data-testid="version-right-path"
              :title="rightPath"
            />
            <SessionPathActions
              browse-test-id="version-browse-right"
              save-test-id="version-save-right"
              :can-save="false"
              @browse="browseVersionPath('right')"
            />
          </div>
        </label>
        <button
          type="button"
          data-testid="run-version-compare"
          :disabled="loading"
          @click="runVersionCompare"
        >
          {{ $t('ui.runDiff') }}
        </button>
        <div
          class="bc-path-footers version-secondary-strip"
          data-testid="version-path-footers"
          data-secondary-density="capture-1to1"
        >
          <PathMetaFooter
            :stamp="leftFileStamp"
            :format-label="leftVersion.fileVersion || undefined"
            :show-milliseconds="settings.showMillisecondsInTimestamps"
            test-id="version-left-path-footer"
          />
          <PathMetaFooter
            :stamp="rightFileStamp"
            :format-label="rightVersion.fileVersion || undefined"
            :show-milliseconds="settings.showMillisecondsInTimestamps"
            test-id="version-right-path-footer"
          />
        </div>
      </section>
      <p
        v-if="error"
        class="version-error"
        data-testid="version-compare-error"
      >
        {{ error }}
      </p>

      <section class="version-summary-grid">
        <article
          v-for="status in versionStatuses"
          :key="status"
          class="version-summary-item"
          :class="`status-${status}`"
        >
          <strong :data-testid="`version-summary-${status}`">{{ versionSummary[status] }}</strong>
          <span>{{ statusLabel(status) }}</span>
        </article>
        <article class="version-summary-item status-minor">
          <strong data-testid="version-summary-minor">{{ minorDifferenceCount }}</strong>
          <span>{{ $t('ui.minor') }}</span>
        </article>
      </section>

      <section class="version-side-grid">
        <article class="version-side">
          <header>
            <strong>{{ leftVersion.name }}</strong>
            <span>{{ leftVersion.fileType }}</span>
          </header>
          <dl>
            <div>
              <dt>{{ $t('ui.fileVersion') }}</dt>
              <dd>{{ leftVersion.fileVersion }}</dd>
            </div>
            <div>
              <dt>{{ $t('ui.productVersion') }}</dt>
              <dd>{{ leftVersion.productVersion }}</dd>
            </div>
            <div>
              <dt>{{ $t('ui.targetOs') }}</dt>
              <dd>{{ leftVersion.targetOs }}</dd>
            </div>
          </dl>
        </article>

        <article class="version-side">
          <header>
            <strong>{{ rightVersion.name }}</strong>
            <span>{{ rightVersion.fileType }}</span>
          </header>
          <dl>
            <div>
              <dt>{{ $t('ui.fileVersion') }}</dt>
              <dd>{{ rightVersion.fileVersion }}</dd>
            </div>
            <div>
              <dt>{{ $t('ui.productVersion') }}</dt>
              <dd>{{ rightVersion.productVersion }}</dd>
            </div>
            <div>
              <dt>{{ $t('ui.targetOs') }}</dt>
              <dd>{{ rightVersion.targetOs }}</dd>
            </div>
          </dl>
        </article>
      </section>

      <section
        class="version-report-panel"
        data-version-chrome-density="capture-1to1"
      >
        <header>
          <strong>{{ $t('ui.versionFieldReport') }}</strong>
          <span>{{ $t('status.fieldCount', { count: versionFields.length }) }}</span>
          <button
            type="button"
            data-testid="export-version-report"
            :disabled="versionFields.length === 0"
            @click="exportVersionReport"
          >
            {{ $t('ui.export') }}
          </button>
          <span
            v-if="reportStatus"
            data-testid="version-report-status"
            >{{ reportStatus }}</span
          >
        </header>
        <div
          class="version-report-table"
          data-testid="version-report-table"
        >
          <div
            class="version-field-row version-field-head"
            data-version-rows-density="capture-1to1"
          >
            <span>{{ $t('ui.group') }}</span>
            <span>{{ $t('ui.field') }}</span>
            <span>{{ $t('ui.left') }}</span>
            <span>{{ $t('ui.right') }}</span>
            <span>{{ $t('ui.status') }}</span>
            <span>{{ $t('ui.importance') }}</span>
          </div>
          <div
            v-for="row in visibleVersionFields"
            :key="row.field"
            class="version-field-row"
            :class="[
              `status-${row.status}`,
              { 'version-field-minor': !fieldIsImportant(row.field) },
            ]"
            :data-testid="`version-field-${row.field}`"
            :data-important="fieldIsImportant(row.field) ? 'true' : 'false'"
          >
            <span>{{ row.group }}</span>
            <strong>{{ row.field }}</strong>
            <code>{{ valueText(row.left) }}</code>
            <code>{{ valueText(row.right) }}</code>
            <em>{{ statusLabel(row.status) }}</em>
            <span>{{
              fieldIsImportant(row.field) ? $t('ui.important') : $t('ui.unimportant')
            }}</span>
          </div>
        </div>
      </section>

      <section
        v-if="showVersionRules"
        class="version-rules-panel"
        data-testid="version-rules-panel"
      >
        <header>
          <strong>{{ $t('ui.importanceRules') }}</strong>
          <span>{{ $t('ui.versionRulesHint') }}</span>
          <button
            type="button"
            data-testid="version-rules-reset"
            @click="resetVersionRules"
          >
            {{ $t('ui.reset') }}
          </button>
        </header>
        <div class="version-rules-list">
          <label
            v-for="row in versionRulesCatalog"
            :key="`rule-${row.field}`"
            class="version-rule-row"
            :data-testid="`version-rule-${row.field}`"
          >
            <input
              type="checkbox"
              :checked="fieldIsImportant(row.field)"
              @change="toggleFieldImportance(row.field)"
            />
            <span>{{ row.field }}</span>
            <em>{{ row.group }}</em>
          </label>
        </div>
      </section>
    </section>

    <template #inspector>
      <WorkbenchInspector>
        <section class="workbench-inspector-section">
          <h2>{{ $t('ui.metadata') }}</h2>
          <dl>
            <div>
              <dt>{{ $t('ui.add') }}</dt>
              <dd data-tone="added">{{ versionSummary.added }}</dd>
            </div>
            <div>
              <dt>{{ $t('ui.delete') }}</dt>
              <dd data-tone="deleted">{{ versionSummary.removed }}</dd>
            </div>
            <div>
              <dt>{{ $t('ui.modified') }}</dt>
              <dd data-tone="modified">{{ versionSummary.modified }}</dd>
            </div>
            <div>
              <dt>{{ $t('ui.minor') }}</dt>
              <dd>{{ minorDifferenceCount }}</dd>
            </div>
            <div>
              <dt>{{ $t('ui.fileVersion') }}</dt>
              <dd>{{ leftVersion.fileVersion }} / {{ rightVersion.fileVersion }}</dd>
            </div>
          </dl>
        </section>
      </WorkbenchInspector>
    </template>
    <SessionSettingsDialog
      :open="showSessionSettings"
      kind="version"
      :version-options="versionOptions"
      @close="showSessionSettings = false"
      @apply="applyVersionSessionSettings"
    />
  </WorkbenchShell>
</template>
<style scoped>
.version-compare-view {
  display: grid;
  gap: 4px;
  height: 100%;
  padding: 2px 4px;
  overflow: auto;
}

.version-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 8px;
}

.eyebrow {
  margin: 0 0 2px;
  color: var(--app-text-muted);
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0;
  text-transform: uppercase;
  line-height: 14px;
}

h1 {
  margin: 0;
  font-size: 16px;
  line-height: 1.2;
}

.version-source-pair {
  display: grid;
  gap: 2px;
  min-width: 180px;
  min-height: 20px;
  padding: 4px 6px;
  border: 1px solid #a0a0a0;
  border-radius: 0;
  background: var(--app-surface);
  color: var(--app-text-muted);
  font-size: 11px;
  line-height: 16px;
  text-align: right;
}

.version-path-panel {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr)) auto;
  align-items: end;
  gap: 4px 6px;
  min-height: 20px;
  padding: 2px 4px;
  border: 1px solid #a0a0a0;
  border-radius: 0;
  background: var(--app-surface);
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

.version-path-panel label {
  display: grid;
  gap: 2px;
  min-width: 0;
}

.version-path-panel span {
  color: var(--app-text-muted);
  font-size: 11px;
  line-height: 16px;
}

.version-path-panel input {
  height: 20px;
  min-height: 20px;
  padding: 0 6px;
  border: 1px solid #a0a0a0;
  border-radius: 0;
  background: var(--app-bg);
  color: var(--app-text);
  font: inherit;
  font-size: 12px;
  line-height: 16px;
}

.version-path-panel button {
  height: 20px;
  min-height: 20px;
  padding: 0 6px;
  border: 1px solid #a0a0a0;
  border-radius: 0;
  background: #ffffff;
  color: #111111;
  font: inherit;
  font-size: 11px;
  line-height: 16px;
}

.version-path-panel button:hover {
  border-color: var(--app-accent);
}

.version-path-panel button:disabled {
  opacity: 0.65;
}

.version-error {
  min-height: 18px;
  margin: 0;
  padding: 2px 6px;
  border: 1px solid var(--app-danger);
  border-radius: 0;
  background: var(--diff-deleted-bg);
  color: var(--diff-deleted-fg);
  font-size: 11px;
  line-height: 16px;
}

.version-summary-grid,
.version-side-grid {
  display: grid;
  gap: 4px;
}

.version-summary-grid {
  grid-template-columns: repeat(4, minmax(120px, 1fr));
}

.version-side-grid {
  grid-template-columns: repeat(2, minmax(0, 1fr));
}

.version-summary-item,
.version-side,
.version-report-panel {
  display: grid;
  gap: 4px 6px;
  min-height: 20px;
  padding: 4px 6px;
  border: 1px solid #a0a0a0;
  border-radius: 0;
  background: var(--app-surface);
}

.version-summary-item {
  gap: 2px;
}

.version-summary-item strong {
  font-size: 12px;
  line-height: 16px;
}

.version-summary-item span,
.version-side header span,
.version-report-panel header span {
  color: var(--app-text-muted);
  font-size: 11px;
  line-height: 16px;
}

.version-side header,
.version-report-panel header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 6px;
  min-height: 20px;
}

.version-report-panel header button {
  height: 18px;
  min-height: 18px;
  margin-left: auto;
  padding: 0 6px;
  border: 1px solid #a0a0a0;
  border-radius: 0;
  font-size: 11px;
  line-height: 16px;
}

.version-side dl {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 4px;
  margin: 0;
}

.version-side dl div {
  display: grid;
  gap: 2px;
  min-width: 0;
  min-height: 18px;
  padding: 2px 6px;
  border: 1px solid #a0a0a0;
  border-radius: 0;
  background: var(--app-bg);
}

.version-side dt {
  color: var(--app-text-muted);
  font-size: 11px;
  line-height: 16px;
}

.version-side dd {
  min-width: 0;
  margin: 0;
  overflow: hidden;
  font-size: 11px;
  font-weight: 700;
  line-height: 16px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.version-report-table {
  display: grid;
  overflow: auto;
  border: 1px solid #a0a0a0;
  border-radius: 0;
  background: var(--app-bg);
}

.version-field-row {
  display: grid;
  grid-template-columns:
    110px 140px minmax(160px, 1fr) minmax(160px, 1fr)
    98px 98px;
  min-width: 820px;
  min-height: 18px;
  border-bottom: 1px solid #a0a0a0;
  font-size: 11px;
}

.version-field-minor {
  opacity: 0.78;
}

.version-rules-panel {
  display: grid;
  gap: 4px 6px;
  min-height: 20px;
  padding: 4px 6px;
  border: 1px solid #a0a0a0;
  border-radius: 0;
  background: var(--app-surface);
}

.version-rules-panel header {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 6px;
  min-height: 20px;
}

.version-rules-panel header button {
  height: 18px;
  min-height: 18px;
  margin-left: auto;
  padding: 0 6px;
  border: 1px solid #a0a0a0;
  border-radius: 0;
  font-size: 11px;
  line-height: 16px;
}

.version-rules-panel header span {
  color: var(--app-text-muted);
  font-size: 11px;
  line-height: 16px;
}

.version-rules-list {
  display: grid;
  gap: 2px;
  max-height: 240px;
  overflow: auto;
}

.version-rule-row {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr) auto;
  align-items: center;
  gap: 6px;
  min-height: 18px;
  font-size: 11px;
  line-height: 16px;
}

.version-rule-row em {
  color: var(--app-text-muted);
  font-style: normal;
}

.version-field-row:last-child {
  border-bottom: 0;
}

.version-field-row > * {
  min-width: 0;
  margin: 0;
  padding: 2px 6px;
  overflow: hidden;
  border-right: 1px solid #a0a0a0;
  font-style: normal;
  line-height: 16px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.version-field-row > *:last-child {
  border-right: 0;
}

.version-field-row code {
  font-family: var(--font-mono);
}

.version-field-head {
  background: var(--app-surface-muted);
  color: var(--app-text-muted);
  font-weight: 700;
}

.status-added {
  background: var(--diff-added-bg);
}

.status-added strong,
.status-added em,
.status-added.version-summary-item {
  color: var(--diff-added-fg);
}

.status-removed {
  background: var(--diff-deleted-bg);
}

.status-removed strong,
.status-removed em,
.status-removed.version-summary-item {
  color: var(--diff-deleted-fg);
}

.status-modified {
  background: var(--diff-modified-bg);
}

.status-modified strong,
.status-modified em,
.status-modified.version-summary-item {
  color: var(--diff-modified-fg);
}

.status-minor.version-summary-item {
  border-color: color-mix(in srgb, var(--bc-warning, #c9a227) 55%, var(--bc-border));
}

.status-minor.version-summary-item strong {
  color: var(--bc-warning, #c9a227);
}

.status-unchanged em {
  color: var(--app-text-muted);
}

@media (width <= 820px) {
  .version-header,
  .version-path-panel,
  .version-summary-grid,
  .version-side-grid {
    grid-template-columns: 1fr;
  }

  .version-header {
    display: grid;
  }

  .version-source-pair {
    text-align: left;
  }

  .version-side dl {
    grid-template-columns: 1fr;
  }
}

.bc-path-footers {
  display: grid;
  grid-template-columns: 1fr 1fr;
  grid-column: 1 / -1;
  gap: 1px;
  width: 100%;
  margin-top: 0;
  padding: 0;
}

.version-secondary-strip {
  min-height: 18px;
  padding: 1px 4px;
  border: 1px solid #d0d0d0;
  border-radius: 0;
  background: #f5f5f5;
}

.version-secondary-strip :deep(.path-meta-footer) {
  gap: 6px;
  min-height: 16px;
  color: #111111;
  font-size: 11px;
  line-height: 16px;
}

.version-secondary-strip :deep(.path-meta-chip),
.version-secondary-strip :deep(.path-meta-eol) {
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
