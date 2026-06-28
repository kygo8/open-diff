<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import type { DiffLine, InlineDiffSegment } from '@/types/diff'

const textDiffRowHeightPx = 24
const textDiffRowHeight = `${String(textDiffRowHeightPx)}px`
const overscanRowCount = 12
const defaultViewportHeight = 480
const defaultDifferenceContextRows = 2

type DiffDisplayMode = 'all' | 'differences'

interface VisibleDiffRow {
  index: number
  sourceIndex: number
  line: DiffLine
}

interface DiffMarker {
  index: number
  kind: DiffLine['kind']
  top: number
}

interface DisplaySegmentPart {
  text: string
  changed: boolean
  whitespace: boolean
  grammarKind: string | null
  grammarScope: string | null
}

interface SyntaxGrammar {
  items: SyntaxGrammarItem[]
}

interface SyntaxGrammarItem {
  id: string
  kind: string
  matcher: SyntaxGrammarMatcher
  styleScope: string
}

type SyntaxGrammarMatcher =
  | {
      type: 'linePrefix'
      value: string
    }
  | {
      type: 'keywords'
      values: string[]
    }

interface SyntaxToken {
  start: number
  end: number
  kind: string
  scope: string
}

const props = defineProps<{
  lines: DiffLine[]
  grammar?: SyntaxGrammar
}>()

const scrollContainer = ref<HTMLElement | null>(null)
const scrollTop = ref(0)
const viewportHeight = ref(defaultViewportHeight)
const displayMode = ref<DiffDisplayMode>('all')
const differenceContextRows = ref(defaultDifferenceContextRows)
const showWhitespace = ref(false)
const wordWrap = ref(false)

const displayRows = computed((): VisibleDiffRow[] => {
  if (displayMode.value === 'all') {
    return props.lines.map((line, index) => ({ index, sourceIndex: index, line }))
  }

  const visibleSourceIndexes = new Set<number>()

  for (const [index, line] of props.lines.entries()) {
    if (line.kind === 'equal') {
      continue
    }

    const start = Math.max(0, index - differenceContextRows.value)
    const end = Math.min(props.lines.length - 1, index + differenceContextRows.value)

    for (let sourceIndex = start; sourceIndex <= end; sourceIndex += 1) {
      visibleSourceIndexes.add(sourceIndex)
    }
  }

  return [...visibleSourceIndexes]
    .sort((left, right) => left - right)
    .map((sourceIndex, index) => ({
      index,
      sourceIndex,
      line: props.lines[sourceIndex],
    }))
})
const totalHeight = computed(() => displayRows.value.length * textDiffRowHeightPx)
const visibleRowCount = computed(
  () => Math.ceil(viewportHeight.value / textDiffRowHeightPx) + overscanRowCount * 2,
)
const startIndex = computed(() =>
  Math.max(0, Math.floor(scrollTop.value / textDiffRowHeightPx) - overscanRowCount),
)
const endIndex = computed(() =>
  Math.min(displayRows.value.length, startIndex.value + visibleRowCount.value),
)
const visibleRows = computed(() => displayRows.value.slice(startIndex.value, endIndex.value))
const topOffset = computed(() => startIndex.value * textDiffRowHeightPx)
const diffMarkers = computed<DiffMarker[]>(() =>
  displayRows.value
    .filter(({ line }) => line.kind !== 'equal')
    .map(({ line, index }) => ({
      index,
      kind: line.kind,
      top: displayRows.value.length <= 1 ? 0 : (index / (displayRows.value.length - 1)) * 100,
    })),
)

const handleScroll = (event: Event): void => {
  const target = event.currentTarget

  if (!(target instanceof HTMLElement)) {
    return
  }

  scrollTop.value = target.scrollTop
  viewportHeight.value = target.clientHeight || defaultViewportHeight
}

const jumpToLine = (index: number): void => {
  const nextScrollTop = index * textDiffRowHeightPx

  scrollTop.value = nextScrollTop

  if (scrollContainer.value) {
    scrollContainer.value.scrollTop = nextScrollTop
    viewportHeight.value = scrollContainer.value.clientHeight || defaultViewportHeight
  }
}

const setDisplayMode = (mode: DiffDisplayMode): void => {
  displayMode.value = mode
  jumpToLine(0)
}

const setDifferenceContextRows = (event: Event): void => {
  const target = event.currentTarget

  if (!(target instanceof HTMLInputElement)) {
    return
  }

  const nextValue = Number.parseInt(target.value, 10)

  if (Number.isNaN(nextValue)) {
    return
  }

  differenceContextRows.value = Math.min(99, Math.max(0, nextValue))
  jumpToLine(0)
}

const toggleWhitespace = (): void => {
  showWhitespace.value = !showWhitespace.value
}

const toggleWordWrap = (): void => {
  wordWrap.value = !wordWrap.value
}

const getCurrentLineIndex = (): number => Math.floor(scrollTop.value / textDiffRowHeightPx)

const jumpToNextDiff = (): void => {
  if (diffMarkers.value.length === 0) {
    return
  }

  const currentLineIndex = getCurrentLineIndex()
  const nextMarker =
    diffMarkers.value.find((marker) => marker.index > currentLineIndex) ?? diffMarkers.value[0]

  jumpToLine(nextMarker.index)
}

const jumpToPreviousDiff = (): void => {
  if (diffMarkers.value.length === 0) {
    return
  }

  const currentLineIndex = getCurrentLineIndex()
  const previousMarker =
    [...diffMarkers.value].reverse().find((marker) => marker.index < currentLineIndex) ??
    diffMarkers.value.at(-1)

  if (previousMarker) {
    jumpToLine(previousMarker.index)
  }
}

const handleKeydown = (event: KeyboardEvent): void => {
  if (event.key !== 'F7') {
    return
  }

  event.preventDefault()

  if (event.shiftKey) {
    jumpToPreviousDiff()

    return
  }

  jumpToNextDiff()
}

onMounted(() => {
  document.addEventListener('keydown', handleKeydown)
})

onBeforeUnmount(() => {
  document.removeEventListener('keydown', handleKeydown)
})

const getInlineSegments = (line: DiffLine, side: 'left' | 'right'): InlineDiffSegment[] => {
  const segments = line.inlineSegments[side]

  if (segments.length > 0) {
    return segments
  }

  return [{ text: side === 'left' ? line.leftText : line.rightText, changed: false }]
}

const splitTextByGrapheme = (text: string): string[] => {
  const segmenter = new Intl.Segmenter(undefined, { granularity: 'grapheme' })

  return Array.from(segmenter.segment(text), ({ segment }) => segment)
}

const getDisplaySegmentParts = (segment: InlineDiffSegment): DisplaySegmentPart[] => {
  const syntaxTokens = getSyntaxTokens(segment.text)
  const textParts = splitBySyntaxTokens(segment, syntaxTokens)

  if (!showWhitespace.value) {
    return textParts
  }

  return textParts.flatMap((part) =>
    splitTextByGrapheme(part.text).map((character): DisplaySegmentPart => {
      if (character === ' ') {
        return {
          ...part,
          text: '·',
          whitespace: true,
        }
      }

      if (character === '\t') {
        return {
          ...part,
          text: '→',
          whitespace: true,
        }
      }

      return { ...part, text: character, whitespace: false }
    }),
  )
}

const getSyntaxTokens = (text: string): SyntaxToken[] => {
  const grammar = props.grammar

  if (!grammar || text.length === 0) {
    return []
  }

  for (const item of grammar.items) {
    const range = getSyntaxRange(text, item.matcher)

    if (range) {
      return [
        {
          ...range,
          kind: item.kind,
          scope: item.styleScope,
        },
      ]
    }
  }

  return []
}

const getSyntaxRange = (
  text: string,
  matcher: SyntaxGrammarMatcher,
): Pick<SyntaxToken, 'start' | 'end'> | null => {
  if (matcher.type === 'linePrefix') {
    const start = text.indexOf(matcher.value)

    if (start < 0) {
      return null
    }

    return { start, end: text.length }
  }

  for (const keyword of matcher.values) {
    const range = getKeywordRange(text, keyword)

    if (range) {
      return range
    }
  }

  return null
}

const getKeywordRange = (
  text: string,
  keyword: string,
): Pick<SyntaxToken, 'start' | 'end'> | null => {
  let offset = 0

  while (offset < text.length) {
    const index = text.slice(offset).indexOf(keyword)

    if (index < 0) {
      return null
    }

    const start = offset + index
    const end = start + keyword.length

    if (isKeywordBoundary(text, start, end)) {
      return { start, end }
    }

    offset = end
  }

  return null
}

const isKeywordBoundary = (text: string, start: number, end: number): boolean => {
  const before = start > 0 ? text[start - 1] : ''
  const after = end < text.length ? text[end] : ''

  return !isIdentifierCharacter(before) && !isIdentifierCharacter(after)
}

const isIdentifierCharacter = (value: string): boolean => /^[A-Za-z0-9_]$/u.test(value)

const splitBySyntaxTokens = (
  segment: InlineDiffSegment,
  tokens: SyntaxToken[],
): DisplaySegmentPart[] => {
  if (tokens.length === 0) {
    return [
      {
        text: segment.text,
        changed: segment.changed,
        whitespace: false,
        grammarKind: null,
        grammarScope: null,
      },
    ]
  }

  const parts: DisplaySegmentPart[] = []
  let cursor = 0

  for (const token of tokens) {
    if (token.start > cursor) {
      parts.push({
        text: segment.text.slice(cursor, token.start),
        changed: segment.changed,
        whitespace: false,
        grammarKind: null,
        grammarScope: null,
      })
    }

    parts.push({
      text: segment.text.slice(token.start, token.end),
      changed: segment.changed,
      whitespace: false,
      grammarKind: token.kind,
      grammarScope: token.scope,
    })

    cursor = token.end
  }

  if (cursor < segment.text.length) {
    parts.push({
      text: segment.text.slice(cursor),
      changed: segment.changed,
      whitespace: false,
      grammarKind: null,
      grammarScope: null,
    })
  }

  return parts
}
</script>

<template>
  <div
    class="diff-panel"
    :class="{ 'diff-panel-word-wrap': wordWrap }"
  >
    <div class="diff-header">
      <span>Left</span>
      <span>Right</span>
      <div class="diff-tools">
        <div
          class="diff-filter"
          aria-label="Diff display mode"
        >
          <button
            type="button"
            class="diff-filter-button"
            :class="{ 'diff-filter-button-active': displayMode === 'all' }"
            data-testid="text-diff-show-all"
            @click="setDisplayMode('all')"
          >
            Show All
          </button>
          <button
            type="button"
            class="diff-filter-button"
            :class="{ 'diff-filter-button-active': displayMode === 'differences' }"
            data-testid="text-diff-show-differences"
            @click="setDisplayMode('differences')"
          >
            Show Differences
          </button>
        </div>
        <label class="diff-context-control">
          Context
          <input
            class="diff-context-input"
            data-testid="text-diff-context-lines"
            type="number"
            min="0"
            max="99"
            step="1"
            :value="differenceContextRows"
            @input="setDifferenceContextRows"
          />
        </label>
        <button
          type="button"
          class="diff-option-button"
          :class="{ 'diff-option-button-active': showWhitespace }"
          data-testid="text-diff-toggle-whitespace"
          @click="toggleWhitespace"
        >
          Whitespace
        </button>
        <button
          type="button"
          class="diff-option-button"
          :class="{ 'diff-option-button-active': wordWrap }"
          data-testid="text-diff-toggle-word-wrap"
          @click="toggleWordWrap"
        >
          Wrap
        </button>
        <div
          class="diff-navigation"
          aria-label="Difference navigation"
        >
          <button
            type="button"
            class="diff-navigation-button"
            data-testid="text-diff-previous-diff"
            :disabled="diffMarkers.length === 0"
            aria-label="Previous difference"
            @click="jumpToPreviousDiff"
          >
            Previous
          </button>
          <button
            type="button"
            class="diff-navigation-button"
            data-testid="text-diff-next-diff"
            :disabled="diffMarkers.length === 0"
            aria-label="Next difference"
            @click="jumpToNextDiff"
          >
            Next
          </button>
        </div>
      </div>
    </div>
    <div
      ref="scrollContainer"
      class="diff-body diff-body-synchronized"
      data-testid="text-diff-scroll-container"
      @scroll="handleScroll"
    >
      <div
        class="diff-virtual-spacer"
        data-testid="text-diff-virtual-spacer"
        :style="{ height: `${String(totalHeight)}px` }"
      >
        <div
          class="diff-virtual-window"
          :style="{ transform: `translateY(${String(topOffset)}px)` }"
        >
          <div
            v-for="{ line, sourceIndex } in visibleRows"
            :key="sourceIndex"
            class="diff-row"
            :class="line.kind"
            :style="{ '--text-diff-row-height': textDiffRowHeight }"
          >
            <div class="gutter">{{ line.leftNumber ?? '' }}</div>
            <pre
              class="cell"
              :class="{ 'cell-word-wrap': wordWrap }"
            ><span
              v-for="(segment, segmentIndex) in getInlineSegments(line, 'left')"
                :key="`left-${segmentIndex}`"
                class="inline-segment"
                :class="{ 'inline-segment-changed': segment.changed }"
            ><span
              v-for="(part, partIndex) in getDisplaySegmentParts(segment)"
              :key="`left-${segmentIndex}-${partIndex}`"
              class="syntax-part"
              :class="{
                'visible-whitespace': part.whitespace,
                'syntax-keyword': part.grammarKind === 'keyword',
                'syntax-comment': part.grammarKind === 'comment',
              }"
              :data-grammar-token="part.grammarKind ?? undefined"
              :data-grammar-scope="part.grammarScope ?? undefined"
            >{{ part.text }}</span></span></pre>
            <div class="gutter">{{ line.rightNumber ?? '' }}</div>
            <pre
              class="cell"
              :class="{ 'cell-word-wrap': wordWrap }"
            ><span
              v-for="(segment, segmentIndex) in getInlineSegments(line, 'right')"
                :key="`right-${segmentIndex}`"
                class="inline-segment"
                :class="{ 'inline-segment-changed': segment.changed }"
            ><span
              v-for="(part, partIndex) in getDisplaySegmentParts(segment)"
              :key="`right-${segmentIndex}-${partIndex}`"
              class="syntax-part"
              :class="{
                'visible-whitespace': part.whitespace,
                'syntax-keyword': part.grammarKind === 'keyword',
                'syntax-comment': part.grammarKind === 'comment',
              }"
              :data-grammar-token="part.grammarKind ?? undefined"
              :data-grammar-scope="part.grammarScope ?? undefined"
            >{{ part.text }}</span></span></pre>
          </div>
        </div>
      </div>
    </div>
    <div
      class="diff-minimap"
      aria-label="Difference map"
      data-testid="text-diff-minimap"
    >
      <button
        v-for="marker in diffMarkers"
        :key="`${marker.kind}-${marker.index}`"
        type="button"
        class="diff-minimap-marker"
        :class="`diff-minimap-marker-${marker.kind}`"
        :style="{ top: `${String(marker.top)}%` }"
        data-testid="text-diff-minimap-marker"
        :aria-label="`Jump to diff line ${String(marker.index + 1)}`"
        @click="jumpToLine(marker.index)"
      />
    </div>
  </div>
</template>

<style scoped>
.diff-panel {
  position: relative;
  flex: 1;
  min-height: 0;
  overflow: hidden;
  border: 1px solid var(--app-border);
  border-radius: 8px;
  background: var(--app-surface);
}

.diff-header {
  display: grid;
  grid-template-columns: 1fr 1fr auto;
  align-items: center;
  gap: 8px;
  height: 30px;
  border-bottom: 1px solid var(--app-border);
  background: var(--app-surface-muted);
  color: var(--app-text-muted);
  font-size: 12px;
  font-weight: 700;
  padding-right: 18px;
  padding-left: 52px;
}

.diff-navigation {
  display: flex;
  gap: 4px;
}

.diff-tools {
  display: flex;
  align-items: center;
  gap: 8px;
}

.diff-filter {
  display: flex;
  overflow: hidden;
  border: 1px solid var(--app-border);
  border-radius: 4px;
}

.diff-filter-button {
  height: 22px;
  padding: 0 8px;
  border: 0;
  background: transparent;
  color: var(--app-text-muted);
  font: inherit;
  cursor: pointer;
}

.diff-filter-button-active {
  background: var(--app-surface);
  color: var(--app-text);
}

.diff-option-button {
  height: 22px;
  padding: 0 8px;
  border: 1px solid var(--app-border);
  border-radius: 4px;
  background: transparent;
  color: var(--app-text-muted);
  font: inherit;
  cursor: pointer;
}

.diff-option-button-active {
  background: var(--app-surface);
  color: var(--app-text);
}

.diff-context-control {
  display: flex;
  align-items: center;
  gap: 4px;
  font-weight: 600;
}

.diff-context-input {
  width: 48px;
  height: 22px;
  padding: 0 4px;
  border: 1px solid var(--app-border);
  border-radius: 4px;
  background: var(--app-surface);
  color: var(--app-text);
  font: inherit;
}

.diff-navigation-button {
  height: 22px;
  padding: 0 8px;
  border: 1px solid var(--app-border);
  border-radius: 4px;
  background: var(--app-surface);
  color: var(--app-text);
  font: inherit;
  cursor: pointer;
}

.diff-navigation-button:disabled {
  cursor: not-allowed;
  opacity: 0.5;
}

.diff-body {
  height: calc(100% - 30px);
  margin-right: 14px;
  overflow: auto;
  font-family: var(--font-mono);
  font-size: 13px;
}

.diff-virtual-spacer {
  position: relative;
  min-width: 0;
}

.diff-virtual-window {
  position: absolute;
  top: 0;
  right: 0;
  left: 0;
}

.diff-row {
  display: grid;
  grid-template-columns: 52px minmax(0, 1fr) 52px minmax(0, 1fr);
  height: var(--text-diff-row-height);
  min-height: var(--text-diff-row-height);
  max-height: var(--text-diff-row-height);
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
  line-height: 18px;
  text-align: right;
  user-select: none;
}

.cell {
  margin: 0;
  padding: 3px 8px;
  overflow: hidden;
  line-height: 18px;
  white-space: pre;
}

.cell-word-wrap {
  overflow-wrap: anywhere;
  white-space: pre-wrap;
}

.inline-segment-changed {
  border-radius: 3px;
  background: color-mix(in srgb, currentcolor 22%, transparent);
  box-shadow: 0 0 0 1px color-mix(in srgb, currentcolor 16%, transparent);
}

.visible-whitespace {
  color: var(--app-text-muted);
}

.syntax-part {
  border-radius: 2px;
}

.syntax-keyword {
  color: #2563eb;
  font-weight: 700;
}

.syntax-comment {
  color: #64748b;
  font-style: italic;
}

.diff-minimap {
  position: absolute;
  top: 32px;
  right: 4px;
  bottom: 4px;
  width: 8px;
  border-radius: 4px;
  background: color-mix(in srgb, var(--app-text-muted) 12%, transparent);
}

.diff-minimap-marker {
  position: absolute;
  left: 0;
  width: 8px;
  height: 5px;
  padding: 0;
  border: 0;
  border-radius: 2px;
  cursor: pointer;
}

.diff-minimap-marker-added {
  background: var(--diff-added-fg);
}

.diff-minimap-marker-deleted {
  background: var(--diff-deleted-fg);
}

.diff-minimap-marker-modified {
  background: var(--diff-modified-fg);
}
</style>
