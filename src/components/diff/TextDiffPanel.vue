<script setup lang="ts">
import { computed, ref } from 'vue'
import type { DiffLine, InlineDiffSegment } from '@/types/diff'

const textDiffRowHeightPx = 24
const textDiffRowHeight = `${String(textDiffRowHeightPx)}px`
const overscanRowCount = 12
const defaultViewportHeight = 480

interface VisibleDiffRow {
  index: number
  line: DiffLine
}

const props = defineProps<{
  lines: DiffLine[]
}>()

const scrollContainer = ref<HTMLElement | null>(null)
const scrollTop = ref(0)
const viewportHeight = ref(defaultViewportHeight)

const totalHeight = computed(() => props.lines.length * textDiffRowHeightPx)
const visibleRowCount = computed(
  () => Math.ceil(viewportHeight.value / textDiffRowHeightPx) + overscanRowCount * 2,
)
const startIndex = computed(() =>
  Math.max(0, Math.floor(scrollTop.value / textDiffRowHeightPx) - overscanRowCount),
)
const endIndex = computed(() =>
  Math.min(props.lines.length, startIndex.value + visibleRowCount.value),
)
const visibleRows = computed(() =>
  props.lines.slice(startIndex.value, endIndex.value).map(
    (line, index): VisibleDiffRow => ({
      index: startIndex.value + index,
      line,
    }),
  ),
)
const topOffset = computed(() => startIndex.value * textDiffRowHeightPx)
const diffMarkers = computed(() =>
  props.lines
    .map((line, index) => ({ line, index }))
    .filter(({ line }) => line.kind !== 'equal')
    .map(({ line, index }) => ({
      index,
      kind: line.kind,
      top: props.lines.length <= 1 ? 0 : (index / (props.lines.length - 1)) * 100,
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

const getInlineSegments = (line: DiffLine, side: 'left' | 'right'): InlineDiffSegment[] => {
  const segments = line.inlineSegments[side]

  if (segments.length > 0) {
    return segments
  }

  return [{ text: side === 'left' ? line.leftText : line.rightText, changed: false }]
}
</script>

<template>
  <div class="diff-panel">
    <div class="diff-header">
      <span>Left</span>
      <span>Right</span>
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
            v-for="{ line, index } in visibleRows"
            :key="index"
            class="diff-row"
            :class="line.kind"
            :style="{ '--text-diff-row-height': textDiffRowHeight }"
          >
            <div class="gutter">{{ line.leftNumber ?? '' }}</div>
            <pre class="cell"><span
              v-for="(segment, segmentIndex) in getInlineSegments(line, 'left')"
                :key="`left-${segmentIndex}`"
                class="inline-segment"
                :class="{ 'inline-segment-changed': segment.changed }"
            >{{ segment.text }}</span></pre>
            <div class="gutter">{{ line.rightNumber ?? '' }}</div>
            <pre class="cell"><span
              v-for="(segment, segmentIndex) in getInlineSegments(line, 'right')"
                :key="`right-${segmentIndex}`"
                class="inline-segment"
                :class="{ 'inline-segment-changed': segment.changed }"
            >{{ segment.text }}</span></pre>
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

.inline-segment-changed {
  border-radius: 3px;
  background: color-mix(in srgb, currentcolor 22%, transparent);
  box-shadow: 0 0 0 1px color-mix(in srgb, currentcolor 16%, transparent);
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
