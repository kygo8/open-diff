<script setup lang="ts">
import { computed, ref } from 'vue'

interface HexRow {
  offset: string
  hex: string
  ascii: string
  cells: HexCell[]
}

interface HexCell {
  offset: string
  hex: string
  different: boolean
}

const leftViewport = ref<HTMLElement | null>(null)
const rightViewport = ref<HTMLElement | null>(null)
const bytes = Array.from({ length: 64 }, (_, index) => 0x41 + (index % 26))
const differentOffsets = new Set([1])
const viewportWidth = ref(640)
const bytesPerRow = computed(() => (viewportWidth.value < 480 ? 8 : 16))

const hexRows = computed<HexRow[]>(() =>
  Array.from({ length: Math.ceil(bytes.length / bytesPerRow.value) }, (_, rowIndex) => {
    const rowOffset = rowIndex * bytesPerRow.value
    const rowBytes = bytes.slice(rowOffset, rowOffset + bytesPerRow.value)

    return {
      offset: rowOffset.toString(16).toUpperCase().padStart(8, '0'),
      hex: rowBytes.map((byte) => byte.toString(16).toUpperCase().padStart(2, '0')).join(' '),
      ascii: rowBytes.map((byte) => String.fromCharCode(byte)).join(''),
      cells: rowBytes.map((byte, byteIndex) => {
        const absoluteOffset = rowOffset + byteIndex

        return {
          offset: absoluteOffset.toString(16).toUpperCase().padStart(8, '0'),
          hex: byte.toString(16).toUpperCase().padStart(2, '0'),
          different: differentOffsets.has(absoluteOffset),
        }
      }),
    }
  }),
)

function syncHexScroll(source: 'left' | 'right', event: Event): void {
  const sourceElement = event.currentTarget
  const targetElement = source === 'left' ? rightViewport.value : leftViewport.value

  if (!(sourceElement instanceof HTMLElement) || !targetElement) {
    return
  }

  targetElement.scrollTop = sourceElement.scrollTop
}
</script>

<template>
  <section class="hex-compare-view">
    <header class="hex-header">
      <div>
        <p class="eyebrow">Hex Compare</p>
        <h1>Hex Compare</h1>
      </div>
      <div class="hex-summary">
        <strong>{{ bytes.length }}</strong>
        <span>bytes loaded</span>
      </div>
    </header>

    <section class="hex-wrap-controls">
      <label>
        <span>Viewport width</span>
        <input
          v-model.number="viewportWidth"
          type="range"
          min="320"
          max="760"
          step="40"
          data-testid="hex-width-control"
        />
      </label>
      <strong data-testid="hex-bytes-per-row">{{ bytesPerRow }} bytes / row</strong>
    </section>

    <section class="hex-pane-grid">
      <section class="hex-side">
        <h2>Left</h2>
        <div
          ref="leftViewport"
          class="hex-viewport"
          data-testid="left-hex-viewport"
          @scroll="syncHexScroll('left', $event)"
        >
          <div
            v-for="row in hexRows"
            :key="`left-${row.offset}`"
            class="hex-row"
            data-testid="hex-row"
          >
            <span
              class="hex-offset"
              data-testid="hex-offset-pane"
            >
              {{ row.offset }}
            </span>
            <span
              class="hex-bytes"
              data-testid="hex-byte-pane"
            >
              <span
                v-for="cell in row.cells"
                :key="cell.offset"
                class="hex-byte"
                :class="{ 'hex-byte-different': cell.different }"
                :data-testid="cell.different ? `hex-byte-diff-${cell.offset}` : undefined"
              >
                {{ cell.hex }}
              </span>
            </span>
            <span
              class="hex-ascii"
              data-testid="hex-ascii-pane"
            >
              {{ row.ascii }}
            </span>
          </div>
        </div>
      </section>

      <section class="hex-side">
        <h2>Right</h2>
        <div
          ref="rightViewport"
          class="hex-viewport"
          data-testid="right-hex-viewport"
          @scroll="syncHexScroll('right', $event)"
        >
          <div
            v-for="row in hexRows"
            :key="`right-${row.offset}`"
            class="hex-row"
          >
            <span class="hex-offset">{{ row.offset }}</span>
            <span class="hex-bytes">{{ row.hex }}</span>
            <span class="hex-ascii">{{ row.ascii }}</span>
          </div>
        </div>
      </section>
    </section>
  </section>
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
