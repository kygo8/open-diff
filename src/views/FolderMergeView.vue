<script setup lang="ts">
import { computed, ref } from 'vue'
import { useRouter } from 'vue-router'

type MergeRole = 'Base' | 'Left' | 'Right'
type MergeEntryKind = 'File' | 'Directory' | 'Missing'
type MergeActionKind =
  | 'Keep output'
  | 'Copy left to output'
  | 'Copy right to output'
  | 'Delete output'
  | 'Mark conflict'

interface MergeSide {
  role: MergeRole
  kind: MergeEntryKind
  size?: string
  modified?: string
}

interface MergePlanRow {
  id: string
  path: string
  base: MergeSide
  left: MergeSide
  right: MergeSide
  action: MergeActionKind
  detail: string
  conflict?: MergeConflict
}

interface MergeConflict {
  path: string
  reason: string
  baseContext: string
  leftContext: string
  rightContext: string
}

const leftPath = ref('D:/workspace/merge/left')
const basePath = ref('D:/workspace/merge/base')
const rightPath = ref('D:/workspace/merge/right')
const outputPath = ref('D:/workspace/merge/output')
const planRows = ref<MergePlanRow[]>([])
const router = useRouter()
const lastOpenedConflictPath = ref('')

const hasPlan = computed(() => planRows.value.length > 0)
const conflicts = computed(() =>
  planRows.value.flatMap((row) => (row.conflict ? [row.conflict] : [])),
)
const automaticActions = computed(
  () => planRows.value.filter((row) => row.action !== 'Mark conflict').length,
)
const summary = computed(() => ({
  actions: planRows.value.length,
  automatic: automaticActions.value,
  conflicts: conflicts.value.length,
}))

function buildFolderMergePlan(): void {
  planRows.value = [
    {
      id: 'same-txt',
      path: 'same.txt',
      base: createSide('Base', 'File', '1.2 KB', '2026-06-20 09:00'),
      left: createSide('Left', 'File', '1.2 KB', '2026-06-20 09:00'),
      right: createSide('Right', 'File', '1.2 KB', '2026-06-20 09:00'),
      action: 'Keep output',
      detail: 'All sides match; output keeps the current file.',
    },
    {
      id: 'left-add',
      path: 'left-add.txt',
      base: createSide('Base', 'Missing'),
      left: createSide('Left', 'File', '2.4 KB', '2026-06-25 10:12'),
      right: createSide('Right', 'Missing'),
      action: 'Copy left to output',
      detail: 'Left added a new file and right has no competing change.',
    },
    {
      id: 'right-add',
      path: 'right-add.txt',
      base: createSide('Base', 'Missing'),
      left: createSide('Left', 'Missing'),
      right: createSide('Right', 'File', '3.0 KB', '2026-06-25 10:15'),
      action: 'Copy right to output',
      detail: 'Right added a new file and left has no competing change.',
    },
    {
      id: 'stale-cache',
      path: 'cache/stale.tmp',
      base: createSide('Base', 'File', '800 B', '2026-06-18 08:30'),
      left: createSide('Left', 'Missing'),
      right: createSide('Right', 'Missing'),
      action: 'Delete output',
      detail: 'Both sides deleted the base file.',
    },
    {
      id: 'config',
      path: 'config',
      base: createSide('Base', 'Directory', '--', '2026-06-18 08:30'),
      left: createSide('Left', 'File', '4.1 KB', '2026-06-26 11:20'),
      right: createSide('Right', 'Directory', '--', '2026-06-26 11:25'),
      action: 'Mark conflict',
      detail: 'Left and right changed the same path differently.',
      conflict: {
        path: 'config',
        reason: 'Left and right changed the same path differently',
        baseContext: 'Base: Directory',
        leftContext: 'Left: File',
        rightContext: 'Right: Directory',
      },
    },
  ]
}

function createSide(
  role: MergeRole,
  kind: MergeEntryKind,
  size?: string,
  modified?: string,
): MergeSide {
  return {
    role,
    kind,
    size,
    modified,
  }
}

function sideLabel(side: MergeSide): string {
  if (side.kind === 'Missing') {
    return 'Missing'
  }

  return `${side.kind} | ${side.size ?? '--'} | ${side.modified ?? '--'}`
}

function openConflictInTextMerge(conflict: MergeConflict): void {
  lastOpenedConflictPath.value = conflict.path
  void router.push('/merge/text')
}
</script>

<template>
  <section class="folder-merge-view">
    <header class="merge-header">
      <div>
        <p class="eyebrow">Folder Merge</p>
        <h1>Folder Merge</h1>
      </div>
      <section
        class="merge-summary"
        data-testid="folder-merge-summary"
      >
        <div>
          <strong>{{ summary.actions }}</strong>
          <span>Actions</span>
        </div>
        <div>
          <strong>{{ summary.automatic }}</strong>
          <span>Automatic</span>
        </div>
        <div>
          <strong>{{ summary.conflicts }}</strong>
          <span>Conflicts</span>
        </div>
      </section>
    </header>

    <section class="merge-paths">
      <label>
        <span>Left folder</span>
        <input
          v-model="leftPath"
          data-testid="folder-merge-left-path"
        />
      </label>
      <label>
        <span>Base folder</span>
        <input
          v-model="basePath"
          data-testid="folder-merge-base-path"
        />
      </label>
      <label>
        <span>Right folder</span>
        <input
          v-model="rightPath"
          data-testid="folder-merge-right-path"
        />
      </label>
      <label>
        <span>Output folder</span>
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
        >
          Build Plan
        </NButton>
      </div>
    </section>

    <section
      v-if="lastOpenedConflictPath"
      class="merge-open-status"
      data-testid="folder-merge-open-status"
    >
      Opening Text Merge for {{ lastOpenedConflictPath }} -> /merge/text
    </section>

    <section
      v-if="hasPlan"
      class="merge-plan"
      data-testid="folder-merge-plan"
    >
      <header>
        <strong>Merge plan</strong>
        <span>{{ outputPath }}</span>
      </header>
      <div class="merge-plan-table">
        <div class="merge-plan-row merge-plan-head">
          <span>Path</span>
          <span>Base</span>
          <span>Left</span>
          <span>Right</span>
          <span>Action</span>
          <span>Detail</span>
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
          <strong>{{ row.action }}</strong>
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
        <strong>Conflicts</strong>
        <span>{{ conflicts.length }} item requires review</span>
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
          >
            Open Text Merge
          </NButton>
        </li>
      </ul>
    </section>
  </section>
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
