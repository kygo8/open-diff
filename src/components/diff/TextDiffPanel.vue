<script setup lang="ts">
import type { DiffLine } from '@/types/diff'

defineProps<{
  lines: DiffLine[]
}>()
</script>

<template>
  <div class="diff-panel">
    <div class="diff-header">
      <span>Left</span>
      <span>Right</span>
    </div>
    <div class="diff-body">
      <div
        v-for="(line, index) in lines"
        :key="index"
        class="diff-row"
        :class="line.kind"
      >
        <div class="gutter">{{ line.leftNumber ?? '' }}</div>
        <pre class="cell">{{ line.leftText }}</pre>
        <div class="gutter">{{ line.rightNumber ?? '' }}</div>
        <pre class="cell">{{ line.rightText }}</pre>
      </div>
    </div>
  </div>
</template>

<style scoped>
.diff-panel {
  flex: 1;
  min-height: 0;
  overflow: hidden;
  border: 1px solid var(--app-border);
  border-radius: 8px;
  background: var(--app-surface);
}

.diff-header {
  display: grid;
  grid-template-columns: 1fr 1fr;
  align-items: center;
  height: 30px;
  border-bottom: 1px solid var(--app-border);
  background: var(--app-surface-muted);
  color: var(--app-text-muted);
  font-size: 12px;
  font-weight: 700;
  padding-left: 52px;
}

.diff-body {
  height: calc(100% - 30px);
  overflow: auto;
  font-family: var(--font-mono);
  font-size: 13px;
}

.diff-row {
  display: grid;
  grid-template-columns: 52px minmax(0, 1fr) 52px minmax(0, 1fr);
  min-height: 24px;
  border-bottom: 1px solid rgb(128 128 128 / 0.12);
}

.diff-row.added {
  background: var(--diff-added-bg);
  color: var(--diff-added-fg);
}

.diff-row.deleted {
  background: var(--diff-deleted-bg);
  color: var(--diff-deleted-fg);
}

.diff-row.modified {
  background: var(--diff-modified-bg);
  color: var(--diff-modified-fg);
}

.gutter {
  padding: 3px 8px;
  background: var(--diff-gutter-bg);
  color: var(--app-text-muted);
  text-align: right;
  user-select: none;
}

.cell {
  margin: 0;
  padding: 3px 8px;
  overflow: hidden;
  white-space: pre;
}
</style>
