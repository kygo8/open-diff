<script setup lang="ts">
import { computed, ref } from 'vue'
import { saveTextFile } from '@/api/diff'

type MergePaneId = 'left' | 'base' | 'right' | 'output'
type MergeSource = 'left' | 'base' | 'right'

interface MergePane {
  id: MergePaneId
  title: string
  subtitle: string
  lines: string[]
}

interface MergeConflict {
  line: number
  title: string
  base: string
  left: string
  right: string
  resolved: boolean
}

const initialOutputLines = [
  'export const mode = "fast"',
  '<<<<<<< LEFT',
  'timeout = 45',
  '=======',
  'timeout = 60',
  '>>>>>>> RIGHT',
  'retry = true',
]
const outputLines = ref([...initialOutputLines])
const outputPath = ref('D:/workspace/output.txt')
const saveStatus = ref('Output not saved')
const saving = ref(false)
const conflicts = ref<MergeConflict[]>([
  {
    line: 2,
    title: 'Timeout changed on both sides',
    base: 'timeout = 30',
    left: 'timeout = 45',
    right: 'timeout = 60',
    resolved: false,
  },
])
const panes = computed<MergePane[]>(() => [
  {
    id: 'left',
    title: 'Left',
    subtitle: 'Feature branch',
    lines: ['export const mode = "fast"', 'timeout = 45', 'retry = true'],
  },
  {
    id: 'base',
    title: 'Base',
    subtitle: 'Common ancestor',
    lines: ['export const mode = "fast"', 'timeout = 30', 'retry = true'],
  },
  {
    id: 'right',
    title: 'Right',
    subtitle: 'Main branch',
    lines: ['export const mode = "fast"', 'timeout = 60', 'retry = true'],
  },
  {
    id: 'output',
    title: 'Output',
    subtitle: 'Merge result',
    lines: outputLines.value,
  },
])
const unresolvedConflicts = computed(() => conflicts.value.filter((conflict) => !conflict.resolved))
const currentConflict = computed<MergeConflict | undefined>(() => unresolvedConflicts.value.at(0))
const outputText = computed({
  get: () => outputLines.value.join('\n'),
  set: (value: string) => {
    outputLines.value = value.split('\n')
    saveStatus.value = 'Output has unsaved edits'
  },
})

const conflictStatus = computed(() => {
  const count = unresolvedConflicts.value.length

  return `${String(count)} ${count === 1 ? 'conflict' : 'conflicts'}`
})

function acceptConflict(source: MergeSource): void {
  const conflict = currentConflict.value

  if (!conflict) {
    return
  }

  outputLines.value = ['export const mode = "fast"', conflict[source], 'retry = true']
  conflicts.value = conflicts.value.map((item) =>
    item.line === conflict.line ? { ...item, resolved: true } : item,
  )
}

async function saveOutput(): Promise<void> {
  saving.value = true
  saveStatus.value = 'Saving output'
  try {
    const result = await saveTextFile({
      path: outputPath.value,
      text: outputText.value,
    })

    saveStatus.value = `Saved ${String(result.bytesWritten)} bytes${
      result.backupPath ? `, backup: ${result.backupPath}` : ''
    }`
  } catch (error) {
    saveStatus.value =
      typeof error === 'object' && error !== null && 'message' in error
        ? String(error.message)
        : String(error)
  } finally {
    saving.value = false
  }
}

function lineClass(line: string, paneId: MergePaneId): string {
  if (paneId === 'output' && /^(<{7}|={7}|>{7})/.test(line)) {
    return 'marker'
  }

  if (line.includes('timeout')) {
    return 'conflict'
  }

  return 'normal'
}
</script>

<template>
  <section class="text-merge-view">
    <div class="merge-toolbar">
      <div>
        <strong>{{ $t('ui.textMerge') }}</strong>
        <span>{{ $t('ui.threeWayMergeWorkspace') }}</span>
      </div>
      <span
        class="status-chip"
        data-testid="merge-conflict-status"
      >
        {{ conflictStatus }}
      </span>
      <span class="status-chip">{{ $t('ui.outputHasConflictMarkers') }}</span>
      <input
        v-model="outputPath"
        class="output-path-input"
        data-testid="merge-output-path"
        type="text"
        :aria-label="$t('ui.mergeOutputPath')"
      />
      <button
        type="button"
        class="toolbar-button"
        data-testid="save-merge-output"
        :disabled="saving"
        @click="saveOutput"
      >
        {{ $t('ui.saveOutput') }}
      </button>
      <span
        class="status-chip"
        data-testid="merge-save-status"
      >
        {{ saveStatus }}
      </span>
    </div>

    <div class="merge-grid">
      <section
        v-for="pane in panes"
        :key="pane.id"
        class="merge-pane"
        :data-testid="`merge-pane-${pane.id}`"
      >
        <header class="pane-header">
          <div>
            <h2>{{ pane.title }}</h2>
            <span>{{ pane.subtitle }}</span>
          </div>
          <small>{{ pane.lines.length }} lines</small>
        </header>
        <textarea
          v-if="pane.id === 'output'"
          v-model="outputText"
          class="output-editor"
          data-testid="merge-output-editor"
          spellcheck="false"
        />
        <ol
          v-else
          class="merge-lines"
        >
          <li
            v-for="(line, index) in pane.lines"
            :key="`${pane.id}-${String(index)}`"
            :class="lineClass(line, pane.id)"
          >
            <span class="line-number">{{ index + 1 }}</span>
            <code>{{ line }}</code>
          </li>
        </ol>
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
          :key="conflict.line"
        >
          <strong>Line {{ conflict.line }}: {{ conflict.title }}</strong>
          <div class="conflict-source">
            <span>Left: {{ conflict.left }}</span>
            <button
              type="button"
              data-testid="accept-left-conflict"
              @click="acceptConflict('left')"
            >
              {{ $t('ui.acceptLeft') }}
            </button>
          </div>
          <div class="conflict-source">
            <span>Base: {{ conflict.base }}</span>
            <button
              type="button"
              data-testid="accept-base-conflict"
              @click="acceptConflict('base')"
            >
              {{ $t('ui.acceptBase') }}
            </button>
          </div>
          <div class="conflict-source">
            <span>Right: {{ conflict.right }}</span>
            <button
              type="button"
              data-testid="accept-right-conflict"
              @click="acceptConflict('right')"
            >
              {{ $t('ui.acceptRight') }}
            </button>
          </div>
        </li>
      </ul>
    </section>
  </section>
</template>
<style scoped>
.text-merge-view {
  display: grid;
  grid-template-rows: auto minmax(0, 1fr) auto;
  gap: 10px;
  height: 100%;
  padding: 10px;
  overflow: hidden;
}

.merge-toolbar {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 12px;
  min-height: 34px;
}

.merge-toolbar > div {
  display: flex;
  align-items: baseline;
  gap: 10px;
  min-width: 0;
}

.merge-toolbar span,
.status-chip {
  color: var(--app-text-muted);
  font-size: 12px;
}

.status-chip {
  padding: 3px 7px;
  border: 1px solid var(--app-border);
  border-radius: 6px;
  background: var(--app-surface);
  white-space: nowrap;
}

.output-path-input {
  width: 220px;
  height: 28px;
  padding: 0 8px;
  border: 1px solid var(--app-border);
  border-radius: 6px;
  background: var(--app-surface);
  color: var(--app-text);
  font-size: 12px;
}

.toolbar-button {
  height: 28px;
  padding: 0 8px;
  border: 1px solid var(--app-border);
  border-radius: 6px;
  background: var(--app-surface);
  color: var(--app-text);
  font-size: 12px;
  cursor: pointer;
}

.toolbar-button:disabled {
  cursor: not-allowed;
  opacity: 0.5;
}

.merge-grid {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 10px;
  min-height: 0;
}

.merge-pane {
  display: grid;
  grid-template-rows: auto minmax(0, 1fr);
  min-width: 0;
  min-height: 0;
  overflow: hidden;
  border: 1px solid var(--app-border);
  border-radius: 8px;
  background: var(--app-surface);
}

.pane-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  min-height: 46px;
  padding: 8px 10px;
  border-bottom: 1px solid var(--app-border);
  background: var(--app-surface-muted);
}

.pane-header h2 {
  margin: 0 0 2px;
  font-size: 14px;
  line-height: 1.2;
}

.pane-header span,
.pane-header small {
  color: var(--app-text-muted);
  font-size: 11px;
}

.merge-lines {
  display: grid;
  align-content: start;
  min-height: 0;
  margin: 0;
  padding: 0;
  overflow: auto;
  font-family: var(--font-mono);
  font-size: 12px;
  list-style: none;
}

.output-editor {
  width: 100%;
  min-width: 0;
  min-height: 0;
  padding: 8px;
  border: 0;
  outline: 0;
  background: var(--app-surface);
  color: var(--app-text);
  font-family: var(--font-mono);
  font-size: 12px;
  line-height: 24px;
  resize: none;
  white-space: pre;
}

.merge-lines li {
  display: grid;
  grid-template-columns: 42px minmax(0, 1fr);
  min-height: 24px;
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
  padding: 0 8px;
  background: var(--diff-gutter-bg);
  color: var(--app-text-muted);
  user-select: none;
}

.merge-lines code {
  min-width: 0;
  padding: 4px 8px;
  overflow-wrap: anywhere;
  color: inherit;
  font-family: inherit;
  white-space: pre-wrap;
}

.conflict-panel {
  display: grid;
  gap: 8px;
  padding: 10px;
  border: 1px solid var(--app-border);
  border-radius: 8px;
  background: var(--app-surface);
}

.conflict-panel header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
}

.conflict-panel h2 {
  margin: 0;
  font-size: 14px;
}

.conflict-panel header span {
  color: var(--app-text-muted);
  font-size: 12px;
}

.conflict-list {
  display: grid;
  gap: 8px;
  margin: 0;
  padding: 0;
  list-style: none;
}

.conflict-list li {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 8px;
  padding: 8px;
  border: 1px solid var(--app-border);
  border-radius: 6px;
  background: var(--app-surface-muted);
  color: var(--app-text-muted);
  font-family: var(--font-mono);
  font-size: 12px;
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

.conflict-source button {
  justify-self: start;
  height: 26px;
  padding: 0 8px;
  border: 1px solid var(--app-border);
  border-radius: 6px;
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

  .merge-pane {
    min-height: 220px;
  }
}
</style>
