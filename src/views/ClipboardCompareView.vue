<script setup lang="ts">
import { computed, ref } from 'vue'
import { diffText } from '@/api/diff'
import { readClipboardTextSource } from '@/app/clipboardSource'
import TextDiffPanel from '@/components/diff/TextDiffPanel.vue'
import type { TextDiffResponse } from '@/types/diff'

interface ClipboardHistoryEntry {
  id: number
  title: string
  text: string
  lineCount: number
  characterCount: number
}

const history = ref<ClipboardHistoryEntry[]>([])
const leftEntryId = ref<number | null>(null)
const rightEntryId = ref<number | null>(null)
const nextEntryId = ref(1)
const captureStatus = ref('No clipboard text captured')
const error = ref('')
const loading = ref(false)
const comparing = ref(false)
const result = ref<TextDiffResponse | null>(null)

const historyCount = computed(() => `${String(history.value.length)} captured`)
const canCompare = computed(() => leftEntryId.value !== null && rightEntryId.value !== null)
const diffStats = computed(() => {
  if (!result.value) {
    return 'No comparison yet'
  }

  const { equal, modified, added, deleted } = result.value.stats

  return `${String(equal)} equal, ${String(modified)} modified, ${String(added)} added, ${String(
    deleted,
  )} deleted`
})

async function captureClipboard(): Promise<void> {
  loading.value = true
  error.value = ''

  try {
    const source = await readClipboardTextSource()
    const text = source.text

    if (history.value[0]?.text === text) {
      captureStatus.value = 'Clipboard text already captured'

      return
    }

    const entry: ClipboardHistoryEntry = {
      id: nextEntryId.value,
      title: `Clipboard ${String(nextEntryId.value)}`,
      text,
      lineCount: countLines(text),
      characterCount: text.length,
    }

    nextEntryId.value += 1
    history.value = [entry, ...history.value].slice(0, 20)
    captureStatus.value = `${entry.title} captured`

    if (leftEntryId.value === null) {
      leftEntryId.value = entry.id

      return
    }

    rightEntryId.value ??= entry.id
  } catch (event) {
    error.value =
      typeof event === 'object' && event !== null && 'message' in event
        ? String(event.message)
        : String(event)
  } finally {
    loading.value = false
  }
}

async function compareClipboardHistory(): Promise<void> {
  const left = history.value.find((entry) => entry.id === leftEntryId.value)
  const right = history.value.find((entry) => entry.id === rightEntryId.value)

  if (!left || !right) {
    return
  }

  comparing.value = true
  error.value = ''

  try {
    result.value = await diffText({
      left: left.text,
      right: right.text,
      algorithm: 'myers',
    })
  } catch (event) {
    error.value = String(event)
  } finally {
    comparing.value = false
  }
}

function selectEntry(id: number): void {
  if (leftEntryId.value === id) {
    return
  }

  if (rightEntryId.value === id) {
    leftEntryId.value = id
    rightEntryId.value = null

    return
  }

  if (leftEntryId.value === null) {
    leftEntryId.value = id

    return
  }

  rightEntryId.value = id
}

function selectionLabel(entry: ClipboardHistoryEntry): string {
  if (entry.id === leftEntryId.value) {
    return 'Left'
  }

  if (entry.id === rightEntryId.value) {
    return 'Right'
  }

  return 'Select'
}

function countLines(text: string): number {
  return text.length === 0 ? 0 : text.split('\n').length
}
</script>

<template>
  <section class="clipboard-compare-view">
    <header class="clipboard-header">
      <div>
        <p class="eyebrow">Clipboard Compare</p>
        <h1>Clipboard Compare</h1>
      </div>
      <div class="clipboard-status">
        <strong data-testid="clipboard-history-count">{{ historyCount }}</strong>
        <span>{{ captureStatus }}</span>
      </div>
    </header>

    <section class="clipboard-toolbar">
      <NButton
        size="small"
        type="primary"
        :loading="loading"
        data-testid="clipboard-capture"
        @click="captureClipboard"
        >Capture Clipboard</NButton
      >
      <NButton
        size="small"
        :disabled="!canCompare"
        :loading="comparing"
        data-testid="clipboard-compare"
        @click="compareClipboardHistory"
        >Compare Selected</NButton
      >
      <span
        class="status-chip"
        data-testid="clipboard-diff-stats"
        >{{ diffStats }}</span
      >
    </section>

    <NAlert
      v-if="error"
      type="error"
      :bordered="false"
      >{{ error }}</NAlert
    >

    <section class="clipboard-layout">
      <aside class="history-pane">
        <header>
          <strong>History</strong>
          <span>{{ history.length }} entries</span>
        </header>
        <div class="history-list">
          <button
            v-for="entry in history"
            :key="entry.id"
            type="button"
            class="history-entry"
            :class="{
              selected: entry.id === leftEntryId || entry.id === rightEntryId,
            }"
            data-testid="clipboard-history-entry"
            @click="selectEntry(entry.id)"
          >
            <strong>{{ entry.title }}</strong>
            <span>{{ selectionLabel(entry) }}</span>
            <small>{{ entry.lineCount }} lines | {{ entry.characterCount }} chars</small>
            <code>{{ entry.text }}</code>
          </button>
        </div>
      </aside>

      <section class="diff-pane">
        <TextDiffPanel
          v-if="result"
          :lines="result.lines"
        />
        <div
          v-else
          class="empty"
        >
          Capture two clipboard texts and compare them.
        </div>
      </section>
    </section>
  </section>
</template>

<style scoped>
.clipboard-compare-view {
  display: grid;
  grid-template-rows: auto auto auto minmax(0, 1fr);
  gap: 12px;
  height: 100%;
  padding: 14px;
  overflow: hidden;
}

.clipboard-header {
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

.clipboard-status {
  display: grid;
  gap: 4px;
  min-width: 180px;
  padding: 10px 12px;
  border: 1px solid var(--app-border);
  border-radius: 8px;
  background: var(--app-surface);
  text-align: right;
}

.clipboard-status span,
.status-chip,
.history-pane header span {
  color: var(--app-text-muted);
  font-size: 12px;
}

.clipboard-toolbar {
  display: flex;
  align-items: center;
  gap: 10px;
}

.clipboard-layout {
  display: grid;
  grid-template-columns: minmax(260px, 340px) minmax(0, 1fr);
  gap: 12px;
  min-height: 0;
}

.history-pane,
.diff-pane {
  min-width: 0;
  min-height: 0;
  border: 1px solid var(--app-border);
  border-radius: 8px;
  background: var(--app-surface);
}

.history-pane {
  display: grid;
  grid-template-rows: auto minmax(0, 1fr);
  gap: 8px;
  padding: 10px;
}

.history-pane header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.history-list {
  display: grid;
  align-content: start;
  gap: 8px;
  overflow: auto;
}

.history-entry {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  gap: 4px 8px;
  padding: 9px;
  border: 1px solid var(--app-border);
  border-radius: 6px;
  background: var(--app-bg);
  color: var(--app-text);
  text-align: left;
  cursor: pointer;
}

.history-entry.selected {
  border-color: #2563eb;
  background: rgb(37 99 235 / 0.08);
}

.history-entry small,
.history-entry code {
  grid-column: 1 / -1;
  min-width: 0;
  overflow: hidden;
  color: var(--app-text-muted);
  font-size: 11px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.history-entry code {
  font-family: var(--font-mono);
}

.diff-pane {
  overflow: hidden;
}

.empty {
  display: grid;
  height: 100%;
  color: var(--app-text-muted);
  place-items: center;
}

@media (width <= 820px) {
  .clipboard-compare-view {
    overflow: auto;
  }

  .clipboard-header,
  .clipboard-layout {
    grid-template-columns: 1fr;
  }

  .clipboard-header {
    display: grid;
  }

  .clipboard-status {
    text-align: left;
  }
}
</style>
