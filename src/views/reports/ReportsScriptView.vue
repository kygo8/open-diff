<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { listen, type UnlistenFn } from '@tauri-apps/api/event'
import { exportFolderCompareReport, exportTextCompareReport } from '@/api/diff'
import { revealPathInOs } from '@/api/integration'
import { answerScriptPrompt, runScript, stopScript } from '@/api/script'
import { playCompareCompleteBeep } from '@/app/compareCompleteNotify'
import { formatCompareError } from '@/app/compareError'
import { useSettingsStore } from '@/stores/settings'
import { useTabsStore } from '@/stores/tabs'
import { useRouter } from 'vue-router'
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
const settings = useSettingsStore()
const tabs = useTabsStore()
const router = useRouter()
const scriptRunning = ref(false)
const selectedSampleId = ref(sampleScripts[0]?.id ?? 'text-report')
const viewActions = useViewActionsStore()
const scriptSourceIsEmpty = computed(() => !scriptSource.value.trim())
const runScriptDisabled = computed(() => scriptRunning.value || scriptSourceIsEmpty.value)
const runScriptTip = computed(() =>
  scriptSourceIsEmpty.value ? t('ui.runScriptNeedsSource') : t('ui.runScript'),
)
const showScriptEmptyHint = computed(
  () => scriptLog.value.length === 0 && !scriptResult.value && !error.value,
)
const hasUnsupportedCommands = computed(() => unsupportedCommandsLabel.trim().length > 0)

const scriptPromptVisible = ref(false)
const scriptPromptId = ref(0)
const scriptPromptMessage = ref('')
const scriptPromptAnswer = ref('')
const scriptPromptKind = ref<'prompt' | 'message'>('prompt')
let scriptPromptUnlisten: UnlistenFn | undefined

onMounted(() => {
  try {
    void listen<{
      id: number
      message: string
      default?: string | null
      kind?: string
    }>('script-prompt-request', (event) => {
      scriptPromptId.value = event.payload.id
      scriptPromptMessage.value = event.payload.message
      scriptPromptAnswer.value = event.payload.default ?? ''
      scriptPromptKind.value = event.payload.kind === 'message' ? 'message' : 'prompt'
      scriptPromptVisible.value = true
    })
      .then((unlisten) => {
        scriptPromptUnlisten = unlisten
      })
      .catch(() => {
        // Unit tests and non-Tauri hosts have no event IPC.
      })
  } catch {
    // listen() can throw synchronously when Tauri IPC is unavailable.
  }
})

onBeforeUnmount(() => {
  scriptPromptUnlisten?.()
  scriptPromptUnlisten = undefined
})

async function submitScriptPrompt(cancelled: boolean): Promise<void> {
  const id = scriptPromptId.value
  const value = scriptPromptAnswer.value

  scriptPromptVisible.value = false

  try {
    await answerScriptPrompt({
      id,
      value: cancelled ? undefined : value,
      cancelled,
    })
  } catch (event) {
    error.value = formatCompareError(event, t)
  }
}

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
    } else if (reportFormat.value === 'html-side-by-side' || reportFormat.value === 'html-print') {
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
            includeIdentical: loadReportPreferences().includeIdentical,
            includeOrphans: loadReportPreferences().includeOrphans,
            includeUnimportant: loadReportPreferences().includeUnimportant,
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

    if (loadReportPreferences().openAfterExport && lastExport.value) {
      try {
        await revealPathInOs(lastExport.value)
      } catch {
        // Reveal is best-effort; export already succeeded.
      }
    }
  } catch (event) {
    error.value = formatCompareError(event, t)
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
    error.value = formatCompareError(event, t)
  }
}

async function runCurrentScript(): Promise<void> {
  if (scriptSourceIsEmpty.value || scriptRunning.value) {
    return
  }

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
      t('ui.scriptLogExecuted', { count: response.executed }),
      t('ui.scriptLogCompared', { count: response.compared }),
      t('ui.scriptLogDifferent', { count: response.different }),
      t('ui.scriptLogReports', { count: response.reportsWritten }),
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

    if (settings.beepWhenScriptFinished) {
      playCompareCompleteBeep()
    }

    if (settings.closeWhenScriptFinished && !response.cancelled) {
      const active = tabs.activeTab

      if (tabs.canCloseTab(active.id)) {
        tabs.closeTab(active.id)
      }

      void router.push('/')
    }
  } catch (event) {
    error.value = formatCompareError(event, t)
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
      case 'help-context':
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
          {{ $t('ui.saveReport') }}
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
          :disabled="runScriptDisabled"
          :title="runScriptTip"
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
              <option value="html-print">{{ $t('ui.htmlPrint') }}</option>
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
        <p
          class="script-docs-hint"
          data-testid="script-docs-hint"
        >
          {{ $t('ui.scriptCommandDocsHint') }}
        </p>
        <section
          class="script-command-lists"
          data-testid="script-command-lists"
        >
          <div>
            <strong>{{ $t('ui.scriptingSupportedCommands') }}</strong>
            <p data-testid="script-supported-commands">{{ supportedCommandsLabel }}</p>
          </div>
          <div v-if="hasUnsupportedCommands">
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
            :placeholder="$t('ui.scriptPathPlaceholder')"
            :title="scriptPath || $t('ui.scriptPathPlaceholder')"
          />
        </label>
        <textarea
          v-model="scriptSource"
          data-testid="script-source"
          :placeholder="$t('ui.scriptSourcePlaceholder')"
          @keydown.ctrl.enter.prevent="runCurrentScript"
          @keydown.meta.enter.prevent="runCurrentScript"
        />
        <p
          v-if="showScriptEmptyHint"
          class="script-empty-hint"
          data-testid="script-empty-hint"
        >
          {{ $t('ui.scriptEmptyHint') }}
        </p>
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

  <div
    v-if="scriptPromptVisible"
    class="script-prompt-overlay"
    data-testid="script-prompt-overlay"
  >
    <section
      class="script-prompt-dialog"
      role="dialog"
      aria-modal="true"
      :aria-label="
        scriptPromptKind === 'message' ? $t('ui.scriptMessageTitle') : $t('ui.scriptPromptTitle')
      "
      data-testid="script-prompt-dialog"
    >
      <header>
        <h2>
          {{
            scriptPromptKind === 'message'
              ? $t('ui.scriptMessageTitle')
              : $t('ui.scriptPromptTitle')
          }}
        </h2>
        <p data-testid="script-prompt-message">{{ scriptPromptMessage }}</p>
      </header>
      <label v-if="scriptPromptKind === 'prompt'">
        <span>{{ $t('ui.scriptPromptAnswer') }}</span>
        <input
          v-model="scriptPromptAnswer"
          type="text"
          data-testid="script-prompt-input"
          @keydown.enter.prevent="submitScriptPrompt(false)"
        />
      </label>
      <footer>
        <button
          v-if="scriptPromptKind === 'prompt'"
          type="button"
          class="secondary-action"
          data-testid="script-prompt-cancel"
          @click="submitScriptPrompt(true)"
        >
          {{ $t('ui.cancel') }}
        </button>
        <button
          type="button"
          class="primary-action"
          data-testid="script-prompt-ok"
          @click="submitScriptPrompt(false)"
        >
          {{ $t('ui.ok') }}
        </button>
      </footer>
    </section>
  </div>
</template>

<style scoped>
.reports-script-view {
  display: grid;
  grid-template-rows: minmax(0, 1fr) minmax(220px, 0.7fr);
  gap: 4px;
  height: 100%;
  min-height: 0;
  padding: 2px 4px;
  overflow: hidden;
}

.report-panel,
.script-panel {
  display: grid;
  grid-template-rows: 22px auto minmax(0, 1fr) auto;
  min-height: 0;
  overflow: hidden;
  border: 1px solid var(--app-border);
  background: var(--app-canvas);
}

.report-export-form {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 4px 6px;
  padding: 2px 4px;
}

.report-export-form label {
  display: grid;
  gap: 2px;
}

.report-export-form span {
  color: var(--app-text-muted);
  font-size: 10px;
  line-height: 12px;
}

.report-export-form input,
.report-export-form select {
  height: 20px;
  padding: 0 4px;
  border: 1px solid var(--app-border);
  border-radius: 2px;
  background: var(--app-bg);
  color: var(--app-text);
  font-size: 11px;
}

.report-error,
.report-empty,
.script-empty-hint,
.script-docs-hint {
  padding: 2px 4px;
  color: var(--app-text-muted);
  font-size: 12px;
}

.script-docs-hint {
  margin: 0;
}

.report-table {
  overflow: auto;
}

.report-row {
  display: grid;
  grid-template-columns: minmax(220px, 1.4fr) 110px 110px minmax(180px, 1fr);
  min-height: 20px;
  border-bottom: 1px solid var(--app-border);
  font-size: 11px;
}

.report-row > * {
  min-width: 0;
  margin: 0;
  padding: 1px 4px;
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
  gap: 2px;
  padding: 2px 4px 0;
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
  padding: 2px 4px;
  border: 1px solid var(--app-border);
  border-radius: 0;
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
  gap: 4px;
  padding: 2px 4px;
  border: 1px solid var(--app-border);
  border-radius: 0;
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

.script-prompt-overlay {
  position: fixed;
  inset: 0;
  z-index: 40;
  display: grid;
  place-items: center;
  background: color-mix(in srgb, var(--app-canvas) 55%, transparent);
}

.script-prompt-dialog {
  display: grid;
  gap: 8px;
  width: min(420px, calc(100vw - 24px));
  padding: 10px 12px;
  border: 1px solid var(--app-border);
  background: var(--app-surface);
  box-shadow: 0 8px 24px color-mix(in srgb, #000000 25%, transparent);
}

.script-prompt-dialog header {
  display: grid;
  gap: 4px;
}

.script-prompt-dialog h2 {
  margin: 0;
  font-size: 14px;
}

.script-prompt-dialog p {
  margin: 0;
  color: var(--app-text-muted);
  white-space: pre-wrap;
}

.script-prompt-dialog label {
  display: grid;
  gap: 4px;
}

.script-prompt-dialog label span {
  color: var(--app-text-muted);
  font-size: 11px;
}

.script-prompt-dialog input {
  min-height: 28px;
  padding: 4px 6px;
  border: 1px solid var(--app-border);
  background: var(--app-canvas);
  color: inherit;
}

.script-prompt-dialog footer {
  display: flex;
  justify-content: flex-end;
  gap: 6px;
}
</style>
