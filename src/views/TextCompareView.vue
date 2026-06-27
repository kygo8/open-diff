<script setup lang="ts">
import { computed, ref } from 'vue'
import { diffText } from '@/api/diff'
import type { TextDiffAlgorithm, TextDiffResponse } from '@/types/diff'
import TextDiffPanel from '@/components/diff/TextDiffPanel.vue'

const left = ref('line one\nline two\nline four')
const right = ref('line one\nline 2\nline three\nline four')
const algorithm = ref<TextDiffAlgorithm>('myers')
const result = ref<TextDiffResponse | null>(null)
const loading = ref(false)
const error = ref('')
const dirty = ref(false)
const leftUndoStack = ref<string[]>([])
const leftRedoStack = ref<string[]>([])
const rightUndoStack = ref<string[]>([])
const rightRedoStack = ref<string[]>([])
const currentDiffIndex = ref(0)
const findQuery = ref('')
const currentFindIndex = ref(0)

const statsLabel = computed(() => {
  if (!result.value) return 'No comparison yet'
  const { added, deleted, modified, equal } = result.value.stats

  return `${String(equal)} equal, ${String(modified)} modified, ${String(added)} added, ${String(
    deleted,
  )} deleted`
})
const lineEndingStatus = computed(
  () => `Left: ${detectLineEnding(left.value)} | Right: ${detectLineEnding(right.value)}`,
)
const dirtyStatus = computed(() => (dirty.value ? 'Unsaved edits' : 'No edits'))
const diffRows = computed(() => result.value?.lines.filter((line) => line.kind !== 'equal') ?? [])
const findMatches = computed(() => {
  const query = findQuery.value.toLocaleLowerCase()

  if (!query) {
    return []
  }

  return [left.value, right.value].flatMap((content, sideIndex) =>
    content
      .toLocaleLowerCase()
      .split('\n')
      .flatMap((line, lineIndex) =>
        line.includes(query) ? [{ sideIndex, lineIndex, columnIndex: line.indexOf(query) }] : [],
      ),
  )
})
const findStatus = computed(() => {
  if (!findQuery.value) {
    return 'No search'
  }

  if (findMatches.value.length === 0) {
    return '0 / 0'
  }

  return `${String(currentFindIndex.value + 1)} / ${String(findMatches.value.length)}`
})

function detectLineEnding(value: string): string {
  if (value.includes('\r\n')) {
    return 'CRLF'
  }

  if (value.includes('\n')) {
    return 'LF'
  }

  if (value.includes('\r')) {
    return 'CR'
  }

  return 'None'
}

async function runDiff(): Promise<void> {
  loading.value = true
  error.value = ''
  try {
    result.value = await diffText({
      left: left.value,
      right: right.value,
      algorithm: algorithm.value,
    })
    currentDiffIndex.value = 0
    dirty.value = false
  } catch (event) {
    error.value = String(event)
  } finally {
    loading.value = false
  }
}

function updateLeft(value: string): void {
  leftUndoStack.value.push(left.value)
  leftRedoStack.value = []
  left.value = value
  dirty.value = true
}

function updateRight(value: string): void {
  rightUndoStack.value.push(right.value)
  rightRedoStack.value = []
  right.value = value
  dirty.value = true
}

function updateFindQuery(event: Event): void {
  const target = event.currentTarget

  if (!(target instanceof HTMLInputElement)) {
    return
  }

  findQuery.value = target.value
  currentFindIndex.value = 0
}

function findNext(): void {
  if (findMatches.value.length === 0) {
    currentFindIndex.value = 0

    return
  }

  currentFindIndex.value = (currentFindIndex.value + 1) % findMatches.value.length
}

function findPrevious(): void {
  if (findMatches.value.length === 0) {
    currentFindIndex.value = 0

    return
  }

  currentFindIndex.value =
    (currentFindIndex.value - 1 + findMatches.value.length) % findMatches.value.length
}

function undoLeft(): void {
  const previous = leftUndoStack.value.pop()

  if (previous === undefined) {
    return
  }

  leftRedoStack.value.push(left.value)
  left.value = previous
  dirty.value = true
}

function redoLeft(): void {
  const next = leftRedoStack.value.pop()

  if (next === undefined) {
    return
  }

  leftUndoStack.value.push(left.value)
  left.value = next
  dirty.value = true
}

function copyCurrentDiff(direction: 'leftToRight' | 'rightToLeft'): void {
  if (diffRows.value.length === 0) {
    return
  }

  const currentDiff = diffRows.value[currentDiffIndex.value]

  if (direction === 'leftToRight') {
    copyLineToSide(currentDiff.rightNumber, currentDiff.leftText, 'right')

    return
  }

  copyLineToSide(currentDiff.leftNumber, currentDiff.rightText, 'left')
}

function copyLineToSide(lineNumber: number | null, text: string, side: 'left' | 'right'): void {
  if (lineNumber === null) {
    return
  }

  const target = side === 'left' ? left : right
  const lines = target.value.split('\n')

  lines[lineNumber - 1] = text
  target.value = lines.join('\n')
  dirty.value = true
  goToNextDiff()
}

function goToNextDiff(): void {
  if (diffRows.value.length === 0) {
    currentDiffIndex.value = 0

    return
  }

  currentDiffIndex.value = Math.min(currentDiffIndex.value + 1, diffRows.value.length - 1)
}
</script>

<template>
  <section class="text-compare-view">
    <div class="compare-toolbar">
      <strong>Text Compare</strong>
      <span class="stats">{{ statsLabel }}</span>
      <span
        class="status-chip"
        data-testid="line-ending-status"
        >{{ lineEndingStatus }}</span
      >
      <span
        class="status-chip"
        data-testid="dirty-status"
        >{{ dirtyStatus }}</span
      >
      <div class="spacer" />
      <button
        type="button"
        class="toolbar-button"
        data-testid="undo-left"
        :disabled="leftUndoStack.length === 0"
        @click="undoLeft"
      >
        Undo
      </button>
      <button
        type="button"
        class="toolbar-button"
        data-testid="redo-left"
        :disabled="leftRedoStack.length === 0"
        @click="redoLeft"
      >
        Redo
      </button>
      <button
        type="button"
        class="toolbar-button"
        data-testid="copy-left-to-right"
        :disabled="!result"
        @click="copyCurrentDiff('leftToRight')"
      >
        Left to Right
      </button>
      <button
        type="button"
        class="toolbar-button"
        data-testid="copy-right-to-left"
        :disabled="!result"
        @click="copyCurrentDiff('rightToLeft')"
      >
        Right to Left
      </button>
      <select
        v-model="algorithm"
        class="algorithm-select"
        data-testid="algorithm-select"
      >
        <option value="myers">Myers</option>
        <option value="patience">Patience</option>
        <option value="histogram">Histogram</option>
      </select>
      <NButton
        size="small"
        type="primary"
        :loading="loading"
        data-testid="run-diff"
        @click="runDiff"
        >Run Diff</NButton
      >
    </div>

    <div class="input-row">
      <NInput
        :value="left"
        type="textarea"
        placeholder="Left content"
        @update:value="updateLeft"
      />
      <NInput
        :value="right"
        type="textarea"
        placeholder="Right content"
        @update:value="updateRight"
      />
    </div>

    <div class="find-toolbar">
      <input
        class="find-input"
        data-testid="find-query"
        type="search"
        placeholder="Find"
        :value="findQuery"
        @input="updateFindQuery"
      />
      <button
        type="button"
        class="toolbar-button"
        data-testid="find-previous"
        :disabled="findMatches.length === 0"
        @click="findPrevious"
      >
        Previous
      </button>
      <button
        type="button"
        class="toolbar-button"
        data-testid="find-next"
        :disabled="findMatches.length === 0"
        @click="findNext"
      >
        Next
      </button>
      <span
        class="status-chip"
        data-testid="find-status"
        >{{ findStatus }}</span
      >
    </div>

    <NAlert
      v-if="error"
      type="error"
      :bordered="false"
      >{{ error }}</NAlert
    >

    <TextDiffPanel
      v-if="result"
      :lines="result.lines"
    />
    <div
      v-else
      class="empty"
    >
      Run the sample comparison to render the custom diff view.
    </div>
  </section>
</template>

<style scoped>
.text-compare-view {
  display: flex;
  flex-direction: column;
  gap: 10px;
  height: 100%;
  padding: 10px;
}

.compare-toolbar {
  display: flex;
  align-items: center;
  gap: 12px;
  min-height: 34px;
}

.stats {
  color: var(--app-text-muted);
  font-size: 12px;
}

.status-chip {
  color: var(--app-text-muted);
  font-size: 12px;
}

.spacer {
  flex: 1;
}

.algorithm-select {
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

.find-toolbar {
  display: flex;
  align-items: center;
  gap: 8px;
}

.find-input {
  width: 220px;
  height: 28px;
  padding: 0 8px;
  border: 1px solid var(--app-border);
  border-radius: 6px;
  background: var(--app-surface);
  color: var(--app-text);
  font-size: 12px;
}

.input-row {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 10px;
  min-height: 120px;
}

.empty {
  display: grid;
  flex: 1;
  border: 1px dashed var(--app-border);
  border-radius: 8px;
  color: var(--app-text-muted);
  place-items: center;
}
</style>
