<script setup lang="ts">
import { computed, ref } from 'vue'
import { diffText } from '@/api/diff'
import type { TextDiffAlgorithm, TextDiffResponse } from '@/types/diff'
import TextDiffPanel from '@/components/diff/TextDiffPanel.vue'

type DiffLine = TextDiffResponse['lines'][number]

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
const replaceQuery = ref('')
const findRegex = ref(false)
const findCaseSensitive = ref(false)
const findWholeWord = ref(false)
const currentFindIndex = ref(0)
const ignoredDiffKeys = ref<Set<string>>(new Set())
const showHtmlPreview = ref(false)
const bookmarkSlots = Array.from({ length: 10 }, (_, index) => index)
const selectedBookmark = ref(0)
const bookmarks = ref<Record<number, string>>({})

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
const activeDiffRows = computed(() =>
  diffRows.value.filter((line) => !ignoredDiffKeys.value.has(diffKey(line))),
)
const currentActiveDiff = computed<DiffLine | null>(() => {
  if (currentDiffIndex.value < 0 || currentDiffIndex.value >= activeDiffRows.value.length) {
    return null
  }

  return activeDiffRows.value[currentDiffIndex.value]
})
const activeDiffStatus = computed(() => `${String(activeDiffRows.value.length)} active diff`)
const bookmarkStatus = computed(() =>
  bookmarks.value[selectedBookmark.value]
    ? `Bookmark ${String(selectedBookmark.value)} set`
    : `No bookmark ${String(selectedBookmark.value)}`,
)
const textDetails = computed(() => {
  if (!currentActiveDiff.value) {
    return 'No active difference'
  }

  const leftNumber = currentActiveDiff.value.leftNumber ?? '-'
  const rightNumber = currentActiveDiff.value.rightNumber ?? '-'

  return `Left ${String(leftNumber)}: ${currentActiveDiff.value.leftText} | Right ${String(rightNumber)}: ${
    currentActiveDiff.value.rightText
  }`
})
const hexDetails = computed(() => {
  if (!currentActiveDiff.value) {
    return 'No bytes'
  }

  return `Left: ${toHexBytes(currentActiveDiff.value.leftText)} | Right: ${toHexBytes(
    currentActiveDiff.value.rightText,
  )}`
})
const canPreviewHtml = computed(() => looksLikeHtml(left.value) || looksLikeHtml(right.value))
const findMatches = computed(() => {
  const matcher = createFindMatcher()

  if (!matcher) {
    return []
  }

  return [left.value, right.value].flatMap((content, sideIndex) =>
    content.split('\n').flatMap((line, lineIndex) => {
      const columnIndex = matcher.findIndex(line)

      return columnIndex >= 0 ? [{ sideIndex, lineIndex, columnIndex }] : []
    }),
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
    ignoredDiffKeys.value = new Set()
    bookmarks.value = {}
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
  closeHtmlPreviewWhenUnavailable()
  dirty.value = true
}

function updateRight(value: string): void {
  rightUndoStack.value.push(right.value)
  rightRedoStack.value = []
  right.value = value
  closeHtmlPreviewWhenUnavailable()
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

function updateReplaceQuery(event: Event): void {
  const target = event.currentTarget

  if (!(target instanceof HTMLInputElement)) {
    return
  }

  replaceQuery.value = target.value
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

function replaceAll(): void {
  const matcher = createFindMatcher()

  if (!matcher) {
    return
  }

  left.value = matcher.replace(left.value, replaceQuery.value)
  right.value = matcher.replace(right.value, replaceQuery.value)
  dirty.value = true
  currentFindIndex.value = 0
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
  if (activeDiffRows.value.length === 0) {
    return
  }

  const currentDiff = activeDiffRows.value[currentDiffIndex.value]

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
  if (activeDiffRows.value.length === 0) {
    currentDiffIndex.value = 0

    return
  }

  currentDiffIndex.value = Math.min(currentDiffIndex.value + 1, activeDiffRows.value.length - 1)
}

function ignoreCurrentDiff(): void {
  if (activeDiffRows.value.length === 0) {
    return
  }

  const currentDiff = activeDiffRows.value[currentDiffIndex.value]

  ignoredDiffKeys.value = new Set([...ignoredDiffKeys.value, diffKey(currentDiff)])
  currentDiffIndex.value = Math.min(currentDiffIndex.value, activeDiffRows.value.length - 1)
}

function setBookmark(): void {
  if (activeDiffRows.value.length === 0) {
    return
  }

  bookmarks.value = {
    ...bookmarks.value,
    [selectedBookmark.value]: diffKey(activeDiffRows.value[currentDiffIndex.value]),
  }
}

function jumpToBookmark(): void {
  const key = bookmarks.value[selectedBookmark.value]

  if (!key) {
    return
  }

  const index = activeDiffRows.value.findIndex((line) => diffKey(line) === key)

  if (index >= 0) {
    currentDiffIndex.value = index
  }
}

function clearBookmark(): void {
  bookmarks.value = Object.entries(bookmarks.value).reduce<Record<number, string>>(
    (nextBookmarks, [slot, key]) => {
      if (Number(slot) !== selectedBookmark.value) {
        nextBookmarks[Number(slot)] = key
      }

      return nextBookmarks
    },
    {},
  )
}

function diffKey(line: TextDiffResponse['lines'][number]): string {
  return [
    line.kind,
    line.leftNumber ?? '',
    line.rightNumber ?? '',
    line.leftText,
    line.rightText,
  ].join('|')
}

interface FindMatcher {
  findIndex: (value: string) => number
  replace: (value: string, replacement: string) => string
}

function createFindMatcher(): FindMatcher | null {
  if (!findQuery.value) {
    return null
  }

  if (findRegex.value) {
    return createRegexMatcher()
  }

  return createPlainTextMatcher()
}

function createRegexMatcher(): FindMatcher | null {
  try {
    const expression = new RegExp(findQuery.value, findCaseSensitive.value ? 'g' : 'gi')

    return {
      findIndex: (value: string): number => value.search(expression),
      replace: (value: string, replacement: string): string =>
        value.replace(expression, replacement),
    }
  } catch {
    return null
  }
}

function createPlainTextMatcher(): FindMatcher {
  const flags = findCaseSensitive.value ? 'g' : 'gi'
  const escaped = escapeRegExp(findQuery.value)
  const source = findWholeWord.value ? `\\b${escaped}\\b` : escaped
  const expression = new RegExp(source, flags)

  return {
    findIndex: (value: string): number => value.search(expression),
    replace: (value: string, replacement: string): string => value.replace(expression, replacement),
  }
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function toHexBytes(value: string): string {
  if (!value) {
    return '(empty)'
  }

  return Array.from(new TextEncoder().encode(value))
    .map((byte) => byte.toString(16).toUpperCase().padStart(2, '0'))
    .join(' ')
}

function looksLikeHtml(value: string): boolean {
  return /<!doctype html|<html[\s>]|<\/?[a-z][\s\S]*>/iu.test(value)
}

function toggleHtmlPreview(): void {
  if (!canPreviewHtml.value) {
    showHtmlPreview.value = false

    return
  }

  showHtmlPreview.value = !showHtmlPreview.value
}

function closeHtmlPreviewWhenUnavailable(): void {
  if (!canPreviewHtml.value) {
    showHtmlPreview.value = false
  }
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
      <span
        class="status-chip"
        data-testid="active-diff-status"
        >{{ activeDiffStatus }}</span
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
      <button
        type="button"
        class="toolbar-button"
        data-testid="ignore-current-diff"
        :disabled="activeDiffRows.length === 0"
        @click="ignoreCurrentDiff"
      >
        Ignore
      </button>
      <button
        type="button"
        class="toolbar-button"
        data-testid="toggle-html-preview"
        :disabled="!canPreviewHtml"
        @click="toggleHtmlPreview"
      >
        Preview
      </button>
      <select
        v-model.number="selectedBookmark"
        class="algorithm-select"
        data-testid="bookmark-slot"
      >
        <option
          v-for="slot in bookmarkSlots"
          :key="slot"
          :value="slot"
        >
          {{ slot }}
        </option>
      </select>
      <button
        type="button"
        class="toolbar-button"
        data-testid="set-bookmark"
        :disabled="activeDiffRows.length === 0"
        @click="setBookmark"
      >
        Set
      </button>
      <button
        type="button"
        class="toolbar-button"
        data-testid="jump-bookmark"
        :disabled="!bookmarks[selectedBookmark]"
        @click="jumpToBookmark"
      >
        Jump
      </button>
      <button
        type="button"
        class="toolbar-button"
        data-testid="clear-bookmark"
        :disabled="!bookmarks[selectedBookmark]"
        @click="clearBookmark"
      >
        Clear
      </button>
      <span
        class="status-chip"
        data-testid="bookmark-status"
        >{{ bookmarkStatus }}</span
      >
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
      <input
        class="find-input"
        data-testid="replace-query"
        type="text"
        placeholder="Replace"
        :value="replaceQuery"
        @input="updateReplaceQuery"
      />
      <label class="find-option">
        <input
          v-model="findRegex"
          data-testid="find-regex"
          type="checkbox"
        />
        Regex
      </label>
      <label class="find-option">
        <input
          v-model="findCaseSensitive"
          data-testid="find-case-sensitive"
          type="checkbox"
        />
        Case
      </label>
      <label class="find-option">
        <input
          v-model="findWholeWord"
          data-testid="find-whole-word"
          type="checkbox"
        />
        Word
      </label>
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
      <button
        type="button"
        class="toolbar-button"
        data-testid="replace-all"
        :disabled="findMatches.length === 0"
        @click="replaceAll"
      >
        Replace All
      </button>
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

    <section
      v-if="result"
      class="details-panel"
      aria-label="Text and hex details"
    >
      <div
        class="details-cell"
        data-testid="text-details"
      >
        <strong>Text Details</strong>
        <span>{{ textDetails }}</span>
      </div>
      <div
        class="details-cell"
        data-testid="hex-details"
      >
        <strong>Hex Details</strong>
        <span>{{ hexDetails }}</span>
      </div>
    </section>

    <section
      v-if="showHtmlPreview"
      class="html-preview-panel"
      aria-label="HTML preview"
    >
      <iframe
        class="html-preview-frame"
        data-testid="html-preview"
        title="Left HTML preview"
        sandbox=""
        :srcdoc="left"
      />
      <iframe
        class="html-preview-frame"
        title="Right HTML preview"
        sandbox=""
        :srcdoc="right"
      />
    </section>
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

.find-option {
  display: flex;
  align-items: center;
  gap: 4px;
  color: var(--app-text-muted);
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

.details-panel {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 10px;
}

.details-cell {
  display: grid;
  gap: 4px;
  min-width: 0;
  padding: 8px;
  border: 1px solid var(--app-border);
  border-radius: 6px;
  background: var(--app-surface);
  font-size: 12px;
}

.details-cell span {
  overflow-wrap: anywhere;
  color: var(--app-text-muted);
  font-family: var(--app-font-mono);
}

.html-preview-panel {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 10px;
  min-height: 180px;
}

.html-preview-frame {
  width: 100%;
  height: 220px;
  border: 1px solid var(--app-border);
  border-radius: 6px;
  background: #ffffff;
}
</style>
