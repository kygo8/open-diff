<script setup lang="ts">
import { computed, ref } from 'vue'
import { useRouter } from 'vue-router'
import {
  buildFolderMergePlan as requestFolderMergePlan,
  executeFolderMergePlan,
} from '@/api/folderMerge'
import type {
  FolderMergeConflict,
  FolderMergeExecutionResponse,
  FolderMergePlanResponse,
  FolderMergePlanRow,
  FolderMergeSide,
} from '@/types/folderMerge'
import WorkbenchShell from '@/components/workbench/WorkbenchShell.vue'
import WorkbenchInspector from '@/components/workbench/WorkbenchInspector.vue'
import { useI18n } from '@/i18n'

const leftPath = ref('D:/workspace/merge/left')
const basePath = ref('D:/workspace/merge/base')
const rightPath = ref('D:/workspace/merge/right')
const outputPath = ref('D:/workspace/merge/output')
const plan = ref<FolderMergePlanResponse>()
const execution = ref<FolderMergeExecutionResponse>()
const mergeExecuting = ref(false)
const mergeExecutionError = ref<string>()
const router = useRouter()
const { t } = useI18n()
const lastOpenedConflictPath = ref('')

const planRows = computed<FolderMergePlanRow[]>(() => plan.value?.rows ?? [])
const hasPlan = computed(() => planRows.value.length > 0)
const conflicts = computed(() =>
  planRows.value.flatMap((row) => (row.conflict ? [row.conflict] : [])),
)
const summary = computed(() => ({
  actions: plan.value?.summary.actions ?? 0,
  automatic: plan.value?.summary.automatic ?? 0,
  conflicts: plan.value?.summary.conflicts ?? 0,
}))
const executionSummary = computed(() => execution.value?.summary)

async function buildFolderMergePlan(): Promise<void> {
  plan.value = await requestFolderMergePlan({
    leftRoot: leftPath.value,
    baseRoot: basePath.value,
    rightRoot: rightPath.value,
    outputRoot: outputPath.value,
  })
  execution.value = undefined
  mergeExecutionError.value = undefined
}

async function runFolderMerge(): Promise<void> {
  mergeExecuting.value = true
  mergeExecutionError.value = undefined

  try {
    execution.value = await executeFolderMergePlan({
      leftRoot: leftPath.value,
      baseRoot: basePath.value,
      rightRoot: rightPath.value,
      outputRoot: outputPath.value,
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

function openConflictInTextMerge(conflict: FolderMergeConflict): void {
  lastOpenedConflictPath.value = conflict.path
  void router.push('/merge/text')
}
</script>

<template>
  <WorkbenchShell
    :title="$t('ui.folderMerge')"
    :eyebrow="$t('ui.merge')"
    :subtitle="$t('status.actionCount', { count: summary.actions })"
    :inspector-label="$t('ui.folderMergeInspector')"
  >
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

      <section class="merge-paths">
        <label>
          <span>{{ $t('ui.leftFolder') }}</span>
          <input
            v-model="leftPath"
            data-testid="folder-merge-left-path"
          />
        </label>
        <label>
          <span>{{ $t('ui.baseFolder') }}</span>
          <input
            v-model="basePath"
            data-testid="folder-merge-base-path"
          />
        </label>
        <label>
          <span>{{ $t('ui.rightFolder') }}</span>
          <input
            v-model="rightPath"
            data-testid="folder-merge-right-path"
          />
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
            data-testid="folder-merge-execute-plan"
            :disabled="!hasPlan || mergeExecuting"
            :loading="mergeExecuting"
            @click="runFolderMerge"
            >{{ $t('ui.merge') }} -> {{ $t('ui.output') }}</NButton
          >
        </div>
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
        v-if="executionSummary"
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
        v-if="hasPlan"
        class="merge-plan"
        data-testid="folder-merge-plan"
      >
        <header>
          <strong>{{ $t('ui.mergePlan') }}</strong>
          <span>{{ outputPath }}</span>
        </header>
        <div class="merge-plan-table">
          <div class="merge-plan-row merge-plan-head">
            <span>{{ $t('ui.path') }}</span>
            <span>{{ $t('ui.base') }}</span>
            <span>{{ $t('ui.left') }}</span>
            <span>{{ $t('ui.right') }}</span>
            <span>{{ $t('ui.action') }}</span>
            <span>{{ $t('ui.detail') }}</span>
          </div>
          <div
            v-for="row in planRows"
            :key="row.id"
            class="merge-plan-row"
            :class="{ conflict: row.action === 'Mark conflict' }"
            data-testid="folder-merge-row"
          >
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
              size="tiny"
              secondary
              :data-testid="`open-folder-conflict-${conflict.path}`"
              @click="openConflictInTextMerge(conflict)"
              >{{ $t('ui.openTextMerge') }}</NButton
            >
          </li>
        </ul>
      </section>
    </section>

    <template #inspector>
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
  gap: 12px;
  height: 100%;
  padding: 16px;
  overflow: auto;
}

.merge-header {
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
  gap: 10px;
  padding: 12px;
  border: 1px solid var(--app-border);
  border-radius: 8px;
  background: var(--app-surface);
}

.merge-paths label {
  display: grid;
  gap: 5px;
  min-width: 0;
}

.merge-paths label span {
  color: var(--app-text-muted);
  font-size: 12px;
}

.merge-paths input {
  width: 100%;
  height: 32px;
  padding: 0 9px;
  overflow: hidden;
  border: 1px solid var(--app-border);
  border-radius: 6px;
  background: var(--app-bg);
  color: var(--app-text);
  font-size: 13px;
  text-overflow: ellipsis;
}

.merge-actions {
  display: flex;
  justify-content: flex-end;
}

.merge-open-status,
.merge-plan,
.conflict-panel {
  display: grid;
  gap: 8px;
  padding: 10px;
  border: 1px solid var(--app-border);
  border-radius: 8px;
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
  border-radius: 6px;
}

.merge-plan-row {
  display: grid;
  grid-template-columns:
    minmax(150px, 0.75fr) minmax(170px, 1fr) minmax(170px, 1fr) minmax(170px, 1fr)
    140px minmax(220px, 1fr);
  min-width: 1080px;
  border-bottom: 1px solid var(--app-border);
  color: var(--app-text);
  font-size: 12px;
}

.merge-plan-row:last-child {
  border-bottom: 0;
}

.merge-plan-row span,
.merge-plan-row strong {
  min-width: 0;
  padding: 8px 10px;
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
</style>
