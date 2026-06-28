<script setup lang="ts">
import { computed } from 'vue'

type MergePaneId = 'left' | 'base' | 'right' | 'output'

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
}

const panes: MergePane[] = [
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
    lines: [
      'export const mode = "fast"',
      '<<<<<<< LEFT',
      'timeout = 45',
      '=======',
      'timeout = 60',
      '>>>>>>> RIGHT',
      'retry = true',
    ],
  },
]

const conflicts: MergeConflict[] = [
  {
    line: 2,
    title: 'Timeout changed on both sides',
    base: 'timeout = 30',
    left: 'timeout = 45',
    right: 'timeout = 60',
  },
]

const conflictStatus = computed(() => {
  const count = conflicts.length

  return `${String(count)} ${count === 1 ? 'conflict' : 'conflicts'}`
})

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
        <strong>Text Merge</strong>
        <span>Three-way merge workspace</span>
      </div>
      <span
        class="status-chip"
        data-testid="merge-conflict-status"
      >
        {{ conflictStatus }}
      </span>
      <span class="status-chip">Output has conflict markers</span>
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
        <ol class="merge-lines">
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
      aria-label="Merge conflicts"
    >
      <header>
        <h2>Conflicts</h2>
        <span>{{ conflictStatus }}</span>
      </header>
      <ul
        class="conflict-list"
        data-testid="merge-conflict-list"
      >
        <li
          v-for="conflict in conflicts"
          :key="conflict.line"
        >
          <strong>Line {{ conflict.line }}: {{ conflict.title }}</strong>
          <span>Base: {{ conflict.base }}</span>
          <span>Left: {{ conflict.left }}</span>
          <span>Right: {{ conflict.right }}</span>
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
