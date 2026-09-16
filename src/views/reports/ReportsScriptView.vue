<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { exportFolderCompareReport, exportTextCompareReport } from '@/api/diff'
import { runScript, stopScript } from '@/api/script'
import {
  loadRecentReportExports,
  loadReportPreferences,
  recordRecentReportExport,
  type RecentReportExport,
  type ReportPreferenceFormat,
  type ReportPreferenceKind,
} from '@/app/reportExports'
import {
  compareReportExampleScript,
  formatCommandList,
  sampleScripts,
  supportedScriptCommands,
  unsupportedScriptCommands,
} from '@/app/scriptCommands'
import WorkbenchShell from '@/components/workbench/WorkbenchShell.vue'
import WorkbenchToolbar from '@/components/workbench/WorkbenchToolbar.vue'
import WorkbenchInspector from '@/components/workbench/WorkbenchInspector.vue'
import StatusSummaryGrid from '@/components/workbench/StatusSummaryGrid.vue'
import { useI18n } from '@/i18n'
import { useLastCompareStore } from '@/stores/lastCompare'
import { useViewActionsStore } from '@/stores/viewActions'

type ReportKind = ReportPreferenceKind
type ReportFormat = ReportPreferenceFormat | 'tsv' | 'yaml'

type ReportJob = RecentReportExport

const lastCompare = useLastCompareStore()
const { t } = useI18n()
const reportPreferences = loadReportPreferences()
const reportKind = ref<ReportKind>(initialReportKind())
const reportFormat = ref<ReportFormat>(reportPreferences.defaultFormat)
const leftPath = ref(lastCompare.text?.leftSource ?? lastCompare.folder?.leftRoot ?? '')
const rightPath = ref(lastCompare.text?.rightSource ?? lastCompare.folder?.rightRoot ?? '')
const outputPath = ref('')
const leftText = ref(lastCompare.text?.left ?? '')
const rightText = ref(lastCompare.text?.right ?? '')
const jobs = ref<ReportJob[]>(loadRecentReportExports())
const running = ref(false)
const error = ref('')
const lastExport = ref('')
const scriptSource = ref(compareReportExampleScript)
const supportedCommandsLabel = formatCommandList(supportedScriptCommands)
const unsupportedCommandsLabel = formatCommandList(unsupportedScriptCommands)
const scriptPath = ref('')
const scriptResult = ref('')
const scriptLog = ref<string[]>([])
const scriptRunning = ref(false)
const selectedSampleId = ref(sampleScripts[0]?.id ?? 'text-report')
const viewActions = useViewActionsStore()

function initialReportKind(): ReportKind {
  if (lastCompare.text) {
    return 'text'
  }

  if (lastCompare.folder) {
    return 'folder'
  }

  return loadReportPreferences().defaultKind
}

const completedCount = computed(
  () => jobs.value.filter((job) => job.stateKey === 'ui.completed').length,
)
const failedCount = computed(() => jobs.value.filter((job) => job.stateKey === 'ui.error').length)

async function runExport(): Promise<void> {
  running.value = true
  error.value = ''

  try {
    let extension: string = reportFormat.value

    if (reportFormat.value === 'text') {
      extension = 'txt'
    } else if (reportFormat.value === 'html-side-by-side') {
      extension = 'html'
    }

    const target = outputPath.value.trim() || `${reportKind.value}-compare.${extension}`

    const response =
      reportKind.value === 'folder'
        ? await exportFolderCompareReport({
            leftRoot: leftPath.value,
            rightRoot: rightPath.value,
            format: reportFormat.value,
            outputPath: target,
          })
        : await exportTextCompareReport({
            left: leftText.value ? leftText.value : (lastCompare.text?.left ?? ''),
            right: rightText.value ? rightText.value : (lastCompare.text?.right ?? ''),
            leftSource: leftPath.value || undefined,
            rightSource: rightPath.value || undefined,
            format: reportFormat.value,
            outputPath: target,
            algorithm: lastCompare.text?.algorithm,
            ignoreWhitespace: lastCompare.text?.ignoreWhitespace,
            ignoreCase: lastCompare.text?.ignoreCase,
            ignoreLineEndings: lastCompare.text?.ignoreLineEndings,
            ignoreRegexes: lastCompare.text?.ignoreRegexes,
          })

    lastExport.value = response.outputPath ?? target
    jobs.value = recordRecentReportExport(jobs.value, {
      name: lastExport.value.split(/[\\/]/u).at(-1) ?? lastExport.value,
      type: reportFormat.value.toUpperCase(),
      stateKey: 'ui.completed',
      target: lastExport.value,
    })
  } catch (event) {
    error.value = String(event)
    jobs.value = recordRecentReportExport(jobs.value, {
      name: t('ui.export'),
      type: reportFormat.value.toUpperCase(),
      stateKey: 'ui.error',
      target: outputPath.value || t('status.noComparisonYet'),
    })
  } finally {
    running.value = false
  }
}

function applySampleScript(id: string): void {
  const sample = sampleScripts.find((entry) => entry.id === id)

  if (!sample) {
    return
  }

  selectedSampleId.value = sample.id
  scriptSource.value = sample.source
}

function onSampleChange(event: Event): void {
  const target = event.target

  if (target instanceof HTMLSelectElement) {
    applySampleScript(target.value)
  }
}

async function stopCurrentScript(): Promise<void> {
  try {
    await stopScript()
    scriptLog.value = [...scriptLog.value, t('ui.scriptStopped')]
  } catch (event) {
    error.value = String(event)
  }
}

async function runCurrentScript(): Promise<void> {
  scriptRunning.value = true
  error.value = ''
  scriptResult.value = ''
  scriptLog.value = [t('ui.scriptRunLog')]

  try {
    const response = await runScript({
      source: scriptSource.value,
      path: scriptPath.value.trim() || undefined,
    })

    const lines = [
      `executed=${String(response.executed)}`,
      `compared=${String(response.compared)}`,
      `different=${String(response.different)}`,
      `reports=${String(response.reportsWritten)}`,
      ...(response.cancelled ? [t('ui.scriptStopped')] : []),
      ...response.logs,
    ]

    scriptLog.value = lines
    scriptResult.value = lines.join('\n')
    jobs.value = recordRecentReportExport(jobs.value, {
      name: scriptPath.value.trim() || t('ui.script'),
      type: 'SCRIPT',
      stateKey: 'ui.completed',
      target: response.logs.at(-1) ?? scriptResult.value,
    })
  } catch (event) {
    error.value = String(event)
    jobs.value = recordRecentReportExport(jobs.value, {
      name: t('ui.runScript'),
      type: 'SCRIPT',
      stateKey: 'ui.error',
      target: scriptPath.value || t('ui.scriptSource'),
    })
  } finally {
    scriptRunning.value = false
  }
}

watch(
  () => [viewActions.sequence, viewActions.name] as const,
  ([sequence]) => {
    if (!sequence) {
      return
    }

    switch (viewActions.name) {
      case 'run-script':
        void runCurrentScript()
        break
      case 'save-report':
        void runExport()
        break
      case null:
      case 'about':
      case 'check-for-updates':
      case 'close-tab':
      case 'clear-session':
      case 'collapse-all':
      case 'compare':
      case 'copy':
      case 'copy-left':
      case 'copy-right':
      case 'cut':
      case 'delete':
      case 'expand-all':
      case 'export':
      case 'export-settings':
      case 'filters':
      case 'help-contents':
      case 'help-support':
      case 'import-settings':
      case 'next-conflict':
      case 'next-difference':
      case 'paste':
      case 'previous-conflict':
      case 'previous-difference':
      case 'redo':
      case 'reload':
      case 'restore-factory-defaults':
      case 'rules':
      case 'save':
      case 'save-as':
      case 'save-snapshot':
      case 'session-settings':
      case 'show-all':
      case 'show-differences':
      case 'swap':
      case 'sync-now':
      case 'browse-folder':
      case 'up-one-level':
      case 'path-back':
      case 'path-forward':
      case 'toggle-session-locked':
      case 'toggle-minor':
      case 'undo':
      case 'workspace-load':
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
      case 'find-filename':
      case 'toggle-columns':
      case 'toggle-log':
      case 'toggle-toolbar':
      case 'change-attributes':
      case 'new-folder':
      case 'leave-alone':
      case 'sync-copy-left-to-right':
      case 'sync-copy-right-to-left':
      case 'sync-delete-left':
      case 'sync-delete-right':
      case 'touch-selected':
        break
    }
  },
)

function fillFromLastCompare(): void {
  if (reportKind.value === 'folder' && lastCompare.folder) {
    leftPath.value = lastCompare.folder.leftRoot
    rightPath.value = lastCompare.folder.rightRoot

    return
  }

  if (lastCompare.text) {
    leftPath.value = lastCompare.text.leftSource ?? ''
    rightPath.value = lastCompare.text.rightSource ?? ''
    leftText.value = lastCompare.text.left
    rightText.value = lastCompare.text.right
  }
}
</script>

<template>
  <WorkbenchShell
    :title="$t('ui.reportsScripts')"
    :eyebrow="$t('ui.automation')"
    :subtitle="$t('ui.cliReportsAndRepeatableComparisonJobs')"
    :inspector-label="$t('ui.reportsInspector')"
  >
    <template #toolbar>
      <WorkbenchToolbar>
        <button
          type="button"
          class="primary"
          data-testid="run-report-export"
          :disabled="running"
          @click="runExport"
        >
          {{ $t('ui.runDiff') }}
        </button>
        <button
          type="button"
          data-testid="fill-last-compare"
          @click="fillFromLastCompare"
        >
          {{ $t('ui.restoreRecent') }}
        </button>
        <button
          type="button"
          class="primary"
          data-testid="run-script"
          :disabled="scriptRunning"
          @click="runCurrentScript"
        >
          {{ $t('ui.runScript') }}
        </button>
        <button
          type="button"
          data-testid="stop-script"
          :disabled="!scriptRunning"
          @click="stopCurrentScript"
        >
          {{ $t('ui.stop') }}
        </button>
      </WorkbenchToolbar>
    </template>

    <section class="reports-script-view">
      <section class="report-panel">
        <header class="split-pane-header active">
          <strong>{{ $t('ui.recentExports') }}</strong>
          <span>{{ $t('status.definitions', { count: jobs.length }) }}</span>
        </header>
        <section class="report-export-form">
          <label>
            <span>{{ $t('ui.reportKind') }}</span>
            <select
              v-model="reportKind"
              data-testid="report-kind"
            >
              <option value="text">{{ $t('ui.textCompare') }}</option>
              <option value="folder">{{ $t('ui.folderCompare') }}</option>
            </select>
          </label>
          <label>
            <span>{{ $t('ui.type') }}</span>
            <select
              v-model="reportFormat"
              data-testid="report-format"
            >
              <option value="html">{{ $t('ui.html') }}</option>
              <option value="html-side-by-side">{{ $t('ui.htmlSideBySide') }}</option>
              <option value="text">{{ $t('ui.text') }}</option>
              <option value="json">{{ $t('ui.exportJson') }}</option>
              <option value="csv">{{ $t('ui.csv') }}</option>
              <option value="markdown">{{ $t('ui.markdown') }}</option>
              <option value="tsv">{{ $t('ui.tsv') }}</option>
              <option value="yaml">{{ $t('ui.yaml') }}</option>
              <option value="xml">{{ $t('ui.xml') }}</option>
            </select>
          </label>
          <label>
            <span>{{ $t('ui.leftPath') }}</span>
            <input
              v-model="leftPath"
              type="text"
              data-testid="report-left-path"
            />
          </label>
          <label>
            <span>{{ $t('ui.rightPath') }}</span>
            <input
              v-model="rightPath"
              type="text"
              data-testid="report-right-path"
            />
          </label>
          <label>
            <span>{{ $t('ui.output') }}</span>
            <input
              v-model="outputPath"
              type="text"
              data-testid="report-output-path"
            />
          </label>
        </section>
        <p
          v-if="error"
          class="report-error"
          data-testid="report-export-error"
        >
          {{ error }}
        </p>
        <p
          v-if="lastExport"
          data-testid="report-export-status"
        >
          {{ lastExport }}
        </p>
        <div
          v-if="jobs.length === 0"
          class="report-empty"
          data-testid="report-empty-jobs"
        >
          {{ $t('status.noComparisonYet') }}
        </div>
        <div
          v-else
          class="report-table"
        >
          <div class="report-row report-head">
            <span>{{ $t('ui.name') }}</span>
            <span>{{ $t('ui.type') }}</span>
            <span>{{ $t('ui.state') }}</span>
            <span>{{ $t('ui.target') }}</span>
          </div>
          <div
            v-for="job in jobs"
            :key="`${job.name}-${job.target}`"
            class="report-row"
          >
            <strong>{{ job.name }}</strong>
            <span>{{ job.type }}</span>
            <span>{{ $t(job.stateKey) }}</span>
            <code>{{ job.target }}</code>
          </div>
        </div>
      </section>

      <section class="script-panel">
        <header class="split-pane-header">
          <strong>{{ $t('ui.scriptCli') }}</strong>
          <span>{{ $t('ui.scriptingNotImplemented') }}</span>
        </header>
        <section
          class="script-command-lists"
          data-testid="script-command-lists"
        >
          <div>
            <strong>{{ $t('ui.scriptingSupportedCommands') }}</strong>
            <p data-testid="script-supported-commands">{{ supportedCommandsLabel }}</p>
          </div>
          <div>
            <strong>{{ $t('ui.scriptingUnsupportedCommands') }}</strong>
            <p data-testid="script-unsupported-commands">{{ unsupportedCommandsLabel }}</p>
          </div>
        </section>
        <label class="script-path">
          <span>{{ $t('ui.scriptSample') }}</span>
          <select
            data-testid="script-sample"
            :value="selectedSampleId"
            @change="onSampleChange"
          >
            <option
              v-for="sample in sampleScripts"
              :key="sample.id"
              :value="sample.id"
            >
              {{ $t(sample.titleKey) }}
            </option>
          </select>
        </label>
        <label class="script-path">
          <span>{{ $t('ui.scriptPath') }}</span>
          <input
            v-model="scriptPath"
            type="text"
            data-testid="script-path"
          />
        </label>
        <textarea
          v-model="scriptSource"
          data-testid="script-source"
          :placeholder="$t('ui.scriptSource')"
        />
        <pre
          v-if="scriptLog.length > 0"
          data-testid="script-run-log"
        ><code>{{ scriptLog.join('\n') }}</code></pre>
        <pre
          v-if="scriptResult"
          data-testid="script-result"
        ><code>{{ scriptResult }}</code></pre>
      </section>
    </section>

    <template #inspector>
      <WorkbenchInspector>
        <section class="workbench-inspector-section">
          <h2>{{ $t('ui.recentExports') }}</h2>
          <StatusSummaryGrid
            :items="[
              { label: $t('ui.completed'), value: completedCount, tone: 'added' },
              { label: $t('ui.error'), value: failedCount, tone: 'modified' },
              { label: $t('ui.draft'), value: jobs.length === 0 ? 0 : 0 },
            ]"
          />
        </section>
        <section class="workbench-inspector-section">
          <h2>{{ $t('ui.output') }}</h2>
          <dl>
            <div>
              <dt>{{ $t('ui.type') }}</dt>
              <dd>{{ reportFormat }}</dd>
            </div>
            <div>
              <dt>{{ $t('ui.output') }}</dt>
              <dd>{{ lastExport || $t('status.noComparisonYet') }}</dd>
            </div>
          </dl>
        </section>
      </WorkbenchInspector>
    </template>
  </WorkbenchShell>
</template>

<style scoped>
.reports-script-view {
  display: grid;
  grid-template-rows: minmax(0, 1fr) minmax(220px, 0.7fr);
  gap: 8px;
  height: 100%;
  min-height: 0;
  padding: 8px;
  overflow: hidden;
}

.report-panel,
.script-panel {
  display: grid;
  grid-template-rows: 28px auto minmax(0, 1fr) auto;
  min-height: 0;
  overflow: hidden;
  border: 1px solid var(--app-border);
  background: var(--app-canvas);
}

.report-export-form {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 8px;
  padding: 8px;
}

.report-export-form label {
  display: grid;
  gap: 4px;
}

.report-export-form span {
  color: var(--app-text-muted);
  font-size: 12px;
}

.report-export-form input,
.report-export-form select {
  height: 30px;
  padding: 0 8px;
  border: 1px solid var(--app-border);
  border-radius: 6px;
  background: var(--app-bg);
  color: var(--app-text);
}

.report-error,
.report-empty {
  padding: 8px;
  color: var(--app-text-muted);
  font-size: 12px;
}

.report-table {
  overflow: auto;
}

.report-row {
  display: grid;
  grid-template-columns: minmax(220px, 1.4fr) 110px 110px minmax(180px, 1fr);
  min-height: 30px;
  border-bottom: 1px solid var(--app-border);
  font-size: 12px;
}

.report-row > * {
  min-width: 0;
  margin: 0;
  padding: 6px 8px;
  overflow: hidden;
  border-right: 1px solid var(--app-border);
  text-overflow: ellipsis;
  white-space: nowrap;
}

.report-row > *:last-child {
  border-right: 0;
}

.report-head {
  background: var(--app-surface-muted);
  color: var(--app-text-muted);
  font-weight: 700;
}

.script-path {
  display: grid;
  gap: 4px;
  padding: 8px 8px 0;
}

.script-path span {
  color: var(--app-text-muted);
  font-size: 12px;
}

.script-path input,
.script-path select,
.script-panel textarea {
  width: 100%;
  min-width: 0;
  padding: 6px 8px;
  border: 1px solid var(--app-border);
  border-radius: 6px;
  background: var(--app-bg);
  color: var(--app-text);
  font: inherit;
}

.script-panel textarea {
  min-height: 96px;
  resize: vertical;
  font-family: var(--font-mono);
  font-size: 12px;
}

.script-panel pre {
  min-height: 0;
  margin: 0;
  padding: 10px;
  overflow: auto;
  background: var(--app-bg);
  color: var(--app-text);
  font-family: var(--font-mono);
  font-size: 12px;
  line-height: 20px;
}

.script-command-lists {
  display: grid;
  gap: 10px;
  padding: 10px 12px;
  border: 1px solid var(--app-border);
  border-radius: 8px;
  background: var(--app-bg);
}

.script-command-lists strong {
  display: block;
  margin-bottom: 4px;
  font-size: 12px;
}

.script-command-lists p {
  margin: 0;
  color: var(--app-text-muted);
  font-size: 12px;
  line-height: 1.45;
  overflow-wrap: anywhere;
}
</style>
