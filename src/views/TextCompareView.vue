<script setup lang="ts">
import { computed, onMounted, ref, watchEffect } from 'vue'
import { diffText, readTextFile } from '@/api/diff'
import { useStatusBarStore } from '@/stores/statusBar'
import { useSessionLaunchStore } from '@/stores/sessionLaunch'
import type { TextDiffAlgorithm, TextDiffResponse } from '@/types/diff'
import TextDiffPanel from '@/components/diff/TextDiffPanel.vue'
import WorkbenchShell from '@/components/workbench/WorkbenchShell.vue'
import WorkbenchToolbar from '@/components/workbench/WorkbenchToolbar.vue'
import WorkbenchInspector from '@/components/workbench/WorkbenchInspector.vue'
import StatusSummaryGrid from '@/components/workbench/StatusSummaryGrid.vue'
import { useI18n } from '@/i18n'

type DiffLine = TextDiffResponse['lines'][number]

const builtInSyntaxGrammar = {
  items: [
    {
      id: 'line-comment',
      kind: 'comment',
      matcher: { type: 'linePrefix' as const, value: '//' },
      styleScope: 'comment.line',
    },
    {
      id: 'keyword',
      kind: 'keyword',
      matcher: { type: 'keywords' as const, values: ['fn', 'let', 'const', 'function'] },
      styleScope: 'keyword.control',
    },
  ],
}

const left = ref('line one\nline two\nline four')
const right = ref('line one\nline 2\nline three\nline four')
const leftPathLabel = ref('C:/Projects/app/main.ts')
const rightPathLabel = ref('C:/Projects/app/main.remote.ts')
const initialDiffResult: TextDiffResponse = {
  lines: [
    {
      leftNumber: 1,
      rightNumber: 1,
      leftText: 'line one',
      rightText: 'line one',
      kind: 'equal',
      inlineSegments: { left: [], right: [] },
    },
    {
      leftNumber: 2,
      rightNumber: 2,
      leftText: 'line two',
      rightText: 'line 2',
      kind: 'modified',
      inlineSegments: {
        left: [{ text: 'line two', changed: true }],
        right: [{ text: 'line 2', changed: true }],
      },
    },
    {
      leftNumber: null,
      rightNumber: 3,
      leftText: '',
      rightText: 'line three',
      kind: 'added',
      inlineSegments: {
        left: [],
        right: [{ text: 'line three', changed: true }],
      },
    },
    {
      leftNumber: 3,
      rightNumber: 4,
      leftText: 'line four',
      rightText: 'line four',
      kind: 'equal',
      inlineSegments: { left: [], right: [] },
    },
  ],
  stats: { added: 1, deleted: 0, modified: 1, equal: 2 },
}
const statusBar = useStatusBarStore()
const sessionLaunch = useSessionLaunchStore()
const { t } = useI18n()
const algorithm = ref<TextDiffAlgorithm>('myers')
const result = ref<TextDiffResponse | null>(initialDiffResult)
const loading = ref(false)
const error = ref('')
const dirty = ref(false)
const showSourceEditors = ref(false)
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
  if (!result.value) return t('status.noComparisonYet')
  const { added, deleted, modified, equal } = result.value.stats

  return t('status.diffStats', { equal, modified, added, deleted })
})
const lineEndingStatus = computed(
  () =>
    `${t('ui.left')}: ${detectLineEnding(left.value)} | ${t('ui.right')}: ${detectLineEnding(
      right.value,
    )}`,
)
const statusBarEncoding = computed(() => `UTF-8 | ${lineEndingStatus.value}`)
const dirtyStatus = computed(() => (dirty.value ? t('status.unsavedEdits') : t('status.noEdits')))
const diffRows = computed(() => result.value?.lines.filter((line) => line.kind !== 'equal') ?? [])
const activeDiffRows = computed(() =>
  diffRows.value.filter((line) => !ignoredDiffKeys.value.has(diffKey(line))),
)
const ignoredDiffCount = computed(() =>
  Math.max(0, diffRows.value.length - activeDiffRows.value.length),
)
const filterStatus = computed(() =>
  ignoredDiffCount.value === 0
    ? t('status.allRows')
    : t('status.ignoredCount', { count: ignoredDiffCount.value }),
)
const currentActiveDiff = computed<DiffLine | null>(() => {
  if (currentDiffIndex.value < 0 || currentDiffIndex.value >= activeDiffRows.value.length) {
    return null
  }

  return activeDiffRows.value[currentDiffIndex.value]
})
const activeDiffStatus = computed(() =>
  t('status.activeDiffCount', { count: activeDiffRows.value.length }),
)
const bookmarkStatus = computed(() =>
  bookmarks.value[selectedBookmark.value]
    ? t('status.bookmarkSet', { index: selectedBookmark.value })
    : t('status.noBookmark', { index: selectedBookmark.value }),
)
const textDetails = computed(() => {
  if (!currentActiveDiff.value) {
    return t('status.noActiveDifference')
  }

  const leftNumber = currentActiveDiff.value.leftNumber ?? '-'
  const rightNumber = currentActiveDiff.value.rightNumber ?? '-'

  return t('status.leftRightLineValue', {
    leftLine: leftNumber,
    leftText: currentActiveDiff.value.leftText,
    rightLine: rightNumber,
    rightText: currentActiveDiff.value.rightText,
  })
})
const hexDetails = computed(() => {
  if (!currentActiveDiff.value) {
    return t('status.noBytes')
  }

  return t('status.leftRightValue', {
    left: toHexBytes(currentActiveDiff.value.leftText),
    right: toHexBytes(currentActiveDiff.value.rightText),
  })
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
    return t('status.noSearch')
  }

  if (findMatches.value.length === 0) {
    return '0 / 0'
  }

  return `${String(currentFindIndex.value + 1)} / ${String(findMatches.value.length)}`
})
const comparisonStatus = computed(() => {
  if (loading.value) {
    return t('status.comparing')
  }

  if (result.value) {
    return t('status.compared')
  }

  return t('status.editing')
})

watchEffect(() => {
  statusBar.reportStatus({
    comparisonStatus: comparisonStatus.value,
    differenceCount: result.value ? diffRows.value.length : null,
    encoding: statusBarEncoding.value,
    filterStatus: filterStatus.value,
    source: 'text-compare',
  })
})

onMounted(() => {
  const launch = sessionLaunch.consumeLaunch('/compare/text')

  if (!launch) {
    return
  }

  leftPathLabel.value =
    launch.locations.left?.displayName ?? launch.locations.left?.uri ?? leftPathLabel.value
  rightPathLabel.value =
    launch.locations.right?.displayName ?? launch.locations.right?.uri ?? rightPathLabel.value

  if (launch.autoRun && launch.locations.left?.uri && launch.locations.right?.uri) {
    void loadLaunchTextFiles(launch.locations.left.uri, launch.locations.right.uri)
  }
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

async function loadLaunchTextFiles(leftPath: string, rightPath: string): Promise<void> {
  loading.value = true
  error.value = ''

  try {
    const [leftFile, rightFile] = await Promise.all([
      readTextFile(leftPath),
      readTextFile(rightPath),
    ])

    left.value = leftFile.text
    right.value = rightFile.text
    leftPathLabel.value = leftFile.path
    rightPathLabel.value = rightFile.path
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

function toggleSourceEditors(): void {
  showSourceEditors.value = !showSourceEditors.value
}
</script>

<template>
  <WorkbenchShell
    class="text-compare-view"
    :title="$t('ui.textCompare')"
    :eyebrow="$t('ui.text')"
    :subtitle="statsLabel"
    :inspector-label="$t('ui.textCompareInspector')"
    data-testid="text-workbench"
  >
    <template #title-actions>
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
    </template>

    <template #toolbar>
      <WorkbenchToolbar class="compare-toolbar">
        <button
          type="button"
          class="toolbar-button"
          data-testid="toggle-source-editors"
          @click="toggleSourceEditors"
        >
          {{ showSourceEditors ? $t('ui.hideSources') : $t('ui.editSources') }}
        </button>
        <button
          type="button"
          class="toolbar-button"
          data-testid="undo-left"
          :disabled="leftUndoStack.length === 0"
          @click="undoLeft"
        >
          {{ $t('ui.undo') }}
        </button>
        <button
          type="button"
          class="toolbar-button"
          data-testid="redo-left"
          :disabled="leftRedoStack.length === 0"
          @click="redoLeft"
        >
          {{ $t('ui.redo') }}
        </button>
        <button
          type="button"
          class="toolbar-button"
          data-testid="copy-left-to-right"
          :disabled="!result"
          @click="copyCurrentDiff('leftToRight')"
        >
          {{ $t('ui.leftToRight') }}
        </button>
        <button
          type="button"
          class="toolbar-button"
          data-testid="copy-right-to-left"
          :disabled="!result"
          @click="copyCurrentDiff('rightToLeft')"
        >
          {{ $t('ui.rightToLeft') }}
        </button>
        <button
          type="button"
          class="toolbar-button"
          data-testid="ignore-current-diff"
          :disabled="activeDiffRows.length === 0"
          @click="ignoreCurrentDiff"
        >
          {{ $t('ui.ignore') }}
        </button>
        <button
          type="button"
          class="toolbar-button"
          data-testid="toggle-html-preview"
          :disabled="!canPreviewHtml"
          @click="toggleHtmlPreview"
        >
          {{ $t('ui.preview') }}
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
          {{ $t('ui.set') }}
        </button>
        <button
          type="button"
          class="toolbar-button"
          data-testid="jump-bookmark"
          :disabled="!bookmarks[selectedBookmark]"
          @click="jumpToBookmark"
        >
          {{ $t('ui.jump') }}
        </button>
        <button
          type="button"
          class="toolbar-button"
          data-testid="clear-bookmark"
          :disabled="!bookmarks[selectedBookmark]"
          @click="clearBookmark"
        >
          {{ $t('ui.clear') }}
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
          <option value="myers">{{ $t('ui.myers') }}</option>
          <option value="patience">{{ $t('ui.patience') }}</option>
          <option value="histogram">{{ $t('ui.histogram') }}</option>
        </select>
        <NButton
          size="small"
          type="primary"
          :loading="loading"
          data-testid="run-diff"
          @click="runDiff"
          >{{ $t('ui.runDiff') }}</NButton
        >
      </WorkbenchToolbar>
      <WorkbenchToolbar class="find-toolbar">
        <input
          class="find-input"
          data-testid="find-query"
          type="search"
          :placeholder="$t('ui.find')"
          :value="findQuery"
          @input="updateFindQuery"
        />
        <input
          class="find-input"
          data-testid="replace-query"
          type="text"
          :placeholder="$t('ui.replace')"
          :value="replaceQuery"
          @input="updateReplaceQuery"
        />
        <label class="find-option">
          <input
            v-model="findRegex"
            data-testid="find-regex"
            type="checkbox"
          />{{ $t('ui.regex') }}</label
        >
        <label class="find-option">
          <input
            v-model="findCaseSensitive"
            data-testid="find-case-sensitive"
            type="checkbox"
          />{{ $t('ui.case') }}</label
        >
        <label class="find-option">
          <input
            v-model="findWholeWord"
            data-testid="find-whole-word"
            type="checkbox"
          />{{ $t('ui.word') }}</label
        >
        <button
          type="button"
          class="toolbar-button"
          data-testid="find-previous"
          :disabled="findMatches.length === 0"
          @click="findPrevious"
        >
          {{ $t('ui.previous') }}
        </button>
        <button
          type="button"
          class="toolbar-button"
          data-testid="find-next"
          :disabled="findMatches.length === 0"
          @click="findNext"
        >
          {{ $t('ui.next') }}
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
          {{ $t('ui.replaceAll') }}
        </button>
      </WorkbenchToolbar>
    </template>

    <section class="text-workbench-main">
      <div
        v-show="showSourceEditors"
        class="input-row"
      >
        <section class="text-source-pane">
          <header class="split-pane-header active">
            <strong>{{ $t('ui.left') }}</strong>
            <span data-testid="left-path-label">{{ leftPathLabel }}</span>
          </header>
          <NInput
            :value="left"
            type="textarea"
            :placeholder="$t('ui.leftContent')"
            @update:value="updateLeft"
          />
        </section>
        <section class="text-source-pane">
          <header class="split-pane-header">
            <strong>{{ $t('ui.right') }}</strong>
            <span data-testid="right-path-label">{{ rightPathLabel }}</span>
          </header>
          <NInput
            :value="right"
            type="textarea"
            :placeholder="$t('ui.rightContent')"
            @update:value="updateRight"
          />
        </section>
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
        :grammar="builtInSyntaxGrammar"
      />
      <div
        v-else
        class="empty"
      >
        {{ $t('ui.runTheSampleComparisonToRenderTheCustomDiffView') }}
      </div>
    </section>

    <template #inspector>
      <WorkbenchInspector>
        <section class="workbench-inspector-section">
          <h2>{{ $t('ui.change') }}</h2>
          <StatusSummaryGrid
            :items="[
              { label: $t('ui.add'), value: result?.stats.added ?? 0, tone: 'added' },
              { label: $t('ui.delete'), value: result?.stats.deleted ?? 0, tone: 'deleted' },
              { label: $t('ui.modified'), value: result?.stats.modified ?? 0, tone: 'modified' },
              { label: $t('ui.differencesOnly'), value: activeDiffRows.length },
            ]"
          />
        </section>
        <section
          class="workbench-inspector-section"
          :aria-label="$t('ui.textAndHexDetails')"
        >
          <h2>{{ $t('ui.selection') }}</h2>
          <dl>
            <div>
              <dt>{{ $t('ui.encoding') }}</dt>
              <dd>{{ statusBarEncoding }}</dd>
            </div>
            <div>
              <dt>{{ $t('ui.defaultView') }}</dt>
              <dd>{{ filterStatus }}</dd>
            </div>
            <div>
              <dt>{{ $t('ui.history') }}</dt>
              <dd data-testid="bookmark-status">{{ bookmarkStatus }}</dd>
            </div>
          </dl>
        </section>
        <section
          v-if="result"
          class="workbench-inspector-section"
          :aria-label="$t('ui.textAndHexDetails')"
        >
          <h2>{{ $t('ui.detail') }}</h2>
          <dl>
            <div data-testid="text-details">
              <dt>{{ $t('ui.textDetails') }}</dt>
              <dd>{{ textDetails }}</dd>
            </div>
            <div data-testid="hex-details">
              <dt>{{ $t('ui.hexDetails') }}</dt>
              <dd>{{ hexDetails }}</dd>
            </div>
          </dl>
        </section>
      </WorkbenchInspector>
    </template>

    <section
      v-if="showHtmlPreview"
      class="html-preview-panel"
      :aria-label="$t('ui.htmlPreview')"
    >
      <iframe
        class="html-preview-frame"
        data-testid="html-preview"
        :title="$t('ui.leftHtmlPreview')"
        sandbox=""
        :srcdoc="left"
      />
      <iframe
        class="html-preview-frame"
        :title="$t('ui.rightHtmlPreview')"
        sandbox=""
        :srcdoc="right"
      />
    </section>
  </WorkbenchShell>
</template>
<style scoped>
.compare-toolbar {
  gap: 6px;
}

.stats {
  color: var(--app-text-muted);
  font-size: 12px;
}

.status-chip {
  color: var(--app-text-muted);
  font-size: 12px;
}

.algorithm-select {
  height: 24px;
  padding: 0 8px;
  border: 1px solid var(--app-border);
  border-radius: 4px;
  background: var(--app-canvas);
  color: var(--app-text);
  font-size: 12px;
}

.toolbar-button {
  height: 24px;
  padding: 0 8px;
  border: 1px solid var(--app-border);
  border-radius: 4px;
  background: var(--app-canvas);
  color: var(--app-text);
  font-size: 12px;
  cursor: pointer;
}

.toolbar-button:disabled {
  cursor: not-allowed;
  opacity: 0.5;
}

.find-toolbar {
  gap: 8px;
}

.find-input {
  width: 220px;
  height: 24px;
  padding: 0 8px;
  border: 1px solid var(--app-border);
  border-radius: 4px;
  background: var(--app-canvas);
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

.text-workbench-main {
  display: flex;
  flex-direction: column;
  gap: 8px;
  height: 100%;
  min-height: 0;
  padding: 8px;
  overflow: hidden;
}

.input-row {
  display: grid;
  grid-template-columns: 1fr 1fr;
  flex: 0 0 128px;
  gap: 8px;
  min-height: 0;
}

.text-source-pane {
  display: grid;
  grid-template-rows: 28px minmax(0, 1fr);
  min-width: 0;
  min-height: 0;
  overflow: hidden;
  border: 1px solid var(--app-border);
  background: var(--app-canvas);
}

.text-source-pane :deep(.n-input) {
  height: 100%;
  border-radius: 0;
}

.empty {
  display: grid;
  min-height: 0;
  border: 1px dashed var(--app-border);
  border-radius: 4px;
  color: var(--app-text-muted);
  place-items: center;
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
