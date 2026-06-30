<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { compareHexFiles } from '@/api/diff'
import type { HexCompareResponse, HexViewCell } from '@/types/diff'
import WorkbenchShell from '@/components/workbench/WorkbenchShell.vue'
import WorkbenchInspector from '@/components/workbench/WorkbenchInspector.vue'
import StatusSummaryGrid from '@/components/workbench/StatusSummaryGrid.vue'
import { useSessionLaunchStore } from '@/stores/sessionLaunch'

interface HexRow {
  offset: string
  hex: string
  ascii: string
  cells: HexViewCell[]
}

interface HexSideRows {
  rows: HexRow[]
  totalLen: number
  path: string
}

const leftViewport = ref<HTMLElement | null>(null)
const rightViewport = ref<HTMLElement | null>(null)
const bytes = Array.from({ length: 64 }, (_, index) => 0x41 + (index % 26))
const differentOffsets = new Set([1])
const leftPath = ref('C:/bin/left.bin')
const rightPath = ref('C:/bin/right.bin')
const leftCells = ref<HexViewCell[]>(defaultCells(bytes))
const rightCells = ref<HexViewCell[]>(defaultCells(bytes))
const leftTotalLen = ref(bytes.length)
const rightTotalLen = ref(bytes.length)
const diffRangeCount = ref(1)
const viewportWidth = ref(640)
const diffOnly = ref(false)
const loading = ref(false)
const error = ref('')
const sessionLaunch = useSessionLaunchStore()
const bytesPerRow = computed(() => (viewportWidth.value < 480 ? 8 : 16))

const leftHex = computed<HexSideRows>(() =>
  buildHexRows(leftCells.value, bytesPerRow.value, leftTotalLen.value, leftPath.value),
)
const rightHex = computed<HexSideRows>(() =>
  buildHexRows(rightCells.value, bytesPerRow.value, rightTotalLen.value, rightPath.value),
)

const visibleLeftHexRows = computed(() => visibleRows(leftHex.value.rows))
const visibleRightHexRows = computed(() => visibleRows(rightHex.value.rows))
const visiblePairedHexRows = computed(() => {
  const maxRows = Math.max(visibleLeftHexRows.value.length, visibleRightHexRows.value.length)

  return Array.from({ length: maxRows }, (_, index) => ({
    left: visibleLeftHexRows.value[index],
    right: visibleRightHexRows.value[index],
    key: visibleLeftHexRows.value[index]?.offset ?? `row-${String(index)}`,
  }))
})
const loadedBytesLabel = computed(
  () => `${String(leftTotalLen.value)} / ${String(rightTotalLen.value)}`,
)

onMounted(() => {
  const launch = sessionLaunch.consumeLaunch('/compare/hex')

  if (!launch) {
    return
  }

  leftPath.value = launch.locations.left?.uri ?? leftPath.value
  rightPath.value = launch.locations.right?.uri ?? rightPath.value

  if (launch.autoRun && launch.locations.left?.uri && launch.locations.right?.uri) {
    void runHexCompare()
  }
})

function defaultCells(source: number[]): HexViewCell[] {
  return source.map((byte, offset) => ({
    offset,
    byte,
    hex: byte.toString(16).toUpperCase().padStart(2, '0'),
    ascii: String.fromCharCode(byte),
    different: differentOffsets.has(offset),
  }))
}

function buildHexRows(
  cells: HexViewCell[],
  rowSize: number,
  totalLen: number,
  path: string,
): HexSideRows {
  const rows = Array.from({ length: Math.ceil(cells.length / rowSize) }, (_, rowIndex) => {
    const rowCells = cells.slice(rowIndex * rowSize, rowIndex * rowSize + rowSize)
    const rowOffset = rowCells[0]?.offset ?? rowIndex * rowSize

    return {
      offset: formatOffset(rowOffset),
      hex: rowCells.map((cell) => cell.hex).join(' '),
      ascii: rowCells.map((cell) => cell.ascii).join(''),
      cells: rowCells,
    }
  })

  return { rows, totalLen, path }
}

function visibleRows(rows: HexRow[]): HexRow[] {
  if (!diffOnly.value) {
    return rows
  }

  return rows.filter((row) => row.cells.some((cell) => cell.different))
}

function formatOffset(offset: number): string {
  return offset.toString(16).toUpperCase().padStart(8, '0')
}

function syncHexScroll(source: 'left' | 'right', event: Event): void {
  const sourceElement = event.currentTarget
  const targetElement = source === 'left' ? rightViewport.value : leftViewport.value

  if (!(sourceElement instanceof HTMLElement) || !targetElement) {
    return
  }

  targetElement.scrollTop = sourceElement.scrollTop
}

function applyHexResult(result: HexCompareResponse): void {
  leftPath.value = result.left.path
  rightPath.value = result.right.path
  leftCells.value = result.left.cells
  rightCells.value = result.right.cells
  leftTotalLen.value = result.summary.leftBytes
  rightTotalLen.value = result.summary.rightBytes
  diffRangeCount.value = result.summary.differentRanges
}

async function runHexCompare(): Promise<void> {
  loading.value = true
  error.value = ''
  try {
    const result = await compareHexFiles({
      leftPath: leftPath.value,
      rightPath: rightPath.value,
      offset: 0,
      length: 256,
    })

    applyHexResult(result)
  } catch (event) {
    error.value = String(event)
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <WorkbenchShell
    :title="$t('ui.hexCompare')"
    :eyebrow="$t('ui.hex')"
    :subtitle="loadedBytesLabel"
    :inspector-label="$t('ui.hexCompareInspector')"
  >
    <section class="hex-compare-view">
      <header class="hex-header">
        <div>
          <p class="eyebrow">{{ $t('ui.hexCompare') }}</p>
          <h1>{{ $t('ui.hexCompare') }}</h1>
        </div>
        <div class="hex-summary">
          <strong>{{ loadedBytesLabel }}</strong>
          <span>{{ $t('ui.bytesLoaded') }}</span>
        </div>
      </header>

      <section class="hex-wrap-controls">
        <label>
          <span>{{ $t('ui.left') }} {{ $t('ui.path') }}</span>
          <input
            v-model="leftPath"
            type="text"
            data-testid="hex-left-path"
          />
        </label>
        <label>
          <span>{{ $t('ui.right') }} {{ $t('ui.path') }}</span>
          <input
            v-model="rightPath"
            type="text"
            data-testid="hex-right-path"
          />
        </label>
        <label>
          <span>{{ $t('ui.viewportWidth') }}</span>
          <input
            v-model.number="viewportWidth"
            type="range"
            min="320"
            max="760"
            step="40"
            data-testid="hex-width-control"
          />
        </label>
        <label class="hex-toggle">
          <input
            v-model="diffOnly"
            type="checkbox"
            data-testid="hex-diff-only-toggle"
          />
          <span>{{ $t('ui.differencesOnly') }}</span>
        </label>
        <strong data-testid="hex-bytes-per-row">{{
          $t('status.bytesPerRow', { count: bytesPerRow })
        }}</strong>
        <strong data-testid="hex-diff-ranges">{{
          $t('status.ranges', { count: diffRangeCount })
        }}</strong>
        <button
          type="button"
          data-testid="run-hex-compare"
          :disabled="loading"
          @click="runHexCompare"
        >
          {{ $t('ui.runDiff') }}
        </button>
      </section>

      <p
        v-if="error"
        class="hex-error"
        data-testid="hex-compare-error"
      >
        {{ error }}
      </p>

      <section class="hex-pane-grid">
        <section class="hex-side">
          <h2>{{ $t('ui.left') }} · {{ leftHex.path }}</h2>
          <div
            ref="leftViewport"
            class="hex-viewport"
            data-testid="left-hex-viewport"
            @scroll="syncHexScroll('left', $event)"
          >
            <div
              v-for="pair in visiblePairedHexRows"
              :key="`left-${pair.key}`"
              class="hex-row"
              data-testid="hex-row"
            >
              <span
                class="hex-offset"
                data-testid="hex-offset-pane"
              >
                {{ pair.left?.offset ?? pair.right?.offset }}
              </span>
              <span
                class="hex-bytes"
                data-testid="hex-byte-pane"
              >
                <span
                  v-for="cell in pair.left?.cells ?? []"
                  :key="cell.offset"
                  class="hex-byte"
                  :class="{ 'hex-byte-different': cell.different }"
                  :data-testid="
                    cell.different ? `left-hex-byte-diff-${formatOffset(cell.offset)}` : undefined
                  "
                >
                  {{ cell.hex }}
                </span>
              </span>
              <span
                class="hex-ascii"
                data-testid="hex-ascii-pane"
              >
                {{ pair.left?.ascii ?? '' }}
              </span>
            </div>
          </div>
        </section>

        <section class="hex-side">
          <h2>{{ $t('ui.right') }} · {{ rightHex.path }}</h2>
          <div
            ref="rightViewport"
            class="hex-viewport"
            data-testid="right-hex-viewport"
            @scroll="syncHexScroll('right', $event)"
          >
            <div
              v-for="pair in visiblePairedHexRows"
              :key="`right-${pair.key}`"
              class="hex-row"
            >
              <span class="hex-offset">{{ pair.right?.offset ?? pair.left?.offset }}</span>
              <span class="hex-bytes">
                <span
                  v-for="cell in pair.right?.cells ?? []"
                  :key="cell.offset"
                  class="hex-byte"
                  :class="{ 'hex-byte-different': cell.different }"
                  :data-testid="
                    cell.different ? `right-hex-byte-diff-${formatOffset(cell.offset)}` : undefined
                  "
                >
                  {{ cell.hex }}
                </span>
              </span>
              <span class="hex-ascii">{{ pair.right?.ascii ?? '' }}</span>
            </div>
          </div>
        </section>
      </section>
    </section>

    <template #inspector>
      <WorkbenchInspector>
        <section class="workbench-inspector-section">
          <h2>{{ $t('ui.hexDetails') }}</h2>
          <StatusSummaryGrid
            :items="[
              { label: $t('ui.bytesLoaded'), value: loadedBytesLabel },
              { label: $t('ui.differencesOnly'), value: diffRangeCount, tone: 'modified' },
              { label: $t('ui.viewportWidth'), value: viewportWidth },
              { label: $t('status.rowLabel'), value: $t('status.bytes', { count: bytesPerRow }) },
            ]"
          />
        </section>
        <section class="workbench-inspector-section">
          <h2>{{ $t('ui.formatDetails') }}</h2>
          <dl>
            <div>
              <dt>{{ $t('ui.left') }}</dt>
              <dd>{{ leftHex.path }}</dd>
            </div>
            <div>
              <dt>{{ $t('ui.right') }}</dt>
              <dd>{{ rightHex.path }}</dd>
            </div>
            <div>
              <dt>{{ $t('ui.differencesOnly') }}</dt>
              <dd>{{ diffOnly ? $t('ui.on') : $t('ui.off') }}</dd>
            </div>
          </dl>
        </section>
      </WorkbenchInspector>
    </template>
  </WorkbenchShell>
</template>
<style scoped>
.hex-compare-view {
  display: grid;
  gap: 14px;
  height: 100%;
  padding: 16px;
  overflow: auto;
}

.hex-header {
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

h1,
h2 {
  margin: 0;
}

h1 {
  font-size: 22px;
  line-height: 1.2;
}

h2 {
  font-size: 13px;
}

.hex-summary {
  display: grid;
  min-width: 118px;
  padding: 10px 12px;
  border: 1px solid var(--app-border);
  border-radius: 8px;
  background: var(--app-surface);
  text-align: right;
}

.hex-summary strong {
  font-size: 18px;
  line-height: 1;
}

.hex-summary span {
  color: var(--app-text-muted);
  font-size: 12px;
}

.hex-wrap-controls {
  display: grid;
  grid-template-columns: minmax(180px, 1fr) auto;
  align-items: end;
  gap: 10px;
  padding: 10px;
  border: 1px solid var(--app-border);
  border-radius: 8px;
  background: var(--app-surface);
}

.hex-wrap-controls label {
  display: grid;
  gap: 5px;
}

.hex-wrap-controls span {
  color: var(--app-text-muted);
  font-size: 12px;
}

.hex-wrap-controls input {
  width: 100%;
}

.hex-wrap-controls strong {
  min-width: 102px;
  padding: 7px 9px;
  border: 1px solid var(--app-border);
  border-radius: 6px;
  background: var(--app-bg);
  font-size: 12px;
  text-align: center;
}

.hex-pane-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 12px;
}

.hex-side {
  display: grid;
  gap: 8px;
  min-width: 0;
  padding: 10px;
  border: 1px solid var(--app-border);
  border-radius: 8px;
  background: var(--app-surface);
}

.hex-viewport {
  max-height: 190px;
  overflow: auto;
  border: 1px solid var(--app-border);
  border-radius: 6px;
  background: var(--app-bg);
}

.hex-row {
  display: grid;
  grid-template-columns: 84px minmax(240px, 1fr) 132px;
  min-width: 460px;
  min-height: 34px;
  border-bottom: 1px solid var(--app-border);
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', monospace;
  font-size: 12px;
}

.hex-row:last-child {
  border-bottom: 0;
}

.hex-offset,
.hex-bytes,
.hex-ascii {
  min-width: 0;
  padding: 8px 10px;
  overflow: hidden;
  border-right: 1px solid var(--app-border);
  text-overflow: ellipsis;
  white-space: nowrap;
}

.hex-offset {
  color: var(--app-text-muted);
}

.hex-byte {
  display: inline-flex;
  justify-content: center;
  width: 22px;
  margin-right: 6px;
  border-radius: 4px;
}

.hex-byte-different {
  background: var(--diff-modified-bg);
  color: var(--diff-modified-fg);
  font-weight: 700;
}

.hex-ascii {
  border-right: 0;
}

@media (width <= 760px) {
  .hex-header,
  .hex-wrap-controls,
  .hex-pane-grid {
    grid-template-columns: 1fr;
  }

  .hex-header {
    display: grid;
  }

  .hex-summary {
    text-align: left;
  }
}
</style>
