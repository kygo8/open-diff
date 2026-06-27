<script setup lang="ts">
import { computed, ref } from 'vue'

interface TableColumnModel {
  name: string
  side: 'left' | 'right'
}

interface ColumnMappingModel {
  leftColumn?: string
  rightColumn?: string
  source: 'Automatic' | 'Manual' | 'Left Only' | 'Right Only'
}

interface VirtualGridCell {
  key: string
  text: string
}

interface VirtualGridRow {
  key: string
  cells: VirtualGridCell[]
}

const leftColumns: TableColumnModel[] = [
  { side: 'left', name: 'SKU' },
  { side: 'left', name: 'Unit Price' },
  { side: 'left', name: 'Left Only' },
]
const rightColumns: TableColumnModel[] = [
  { side: 'right', name: 'sku' },
  { side: 'right', name: 'unitprice' },
  { side: 'right', name: 'Right Only' },
]
const visibleRows = 8
const visibleColumns = 5
const manualLeftColumn = ref('SKU')
const manualRightColumn = ref('sku')
const manualMappings = ref<ColumnMappingModel[]>([])

const virtualGridStyle = computed<Record<string, string>>(() => ({
  '--visible-columns': String(visibleColumns),
  '--visible-rows': String(visibleRows),
}))

const virtualGridRows = computed<VirtualGridRow[]>(() =>
  Array.from({ length: visibleRows }, (_, rowIndex) => {
    const rowNumber = rowIndex + 1
    const rowLabel = String(rowNumber)

    return {
      key: `row-${rowLabel}`,
      cells: Array.from({ length: visibleColumns }, (_, columnIndex) => {
        const columnLabel = String(columnIndex + 1)

        return {
          key: `cell-${rowLabel}-${columnLabel}`,
          text: `R${rowLabel}C${columnLabel}`,
        }
      }),
    }
  }),
)

const columnMappings = computed<ColumnMappingModel[]>(() => {
  const usedLeft = new Set<string>()
  const usedRight = new Set<string>()
  const mappings: ColumnMappingModel[] = []

  for (const mapping of manualMappings.value) {
    if (!mapping.leftColumn || !mapping.rightColumn) {
      continue
    }

    usedLeft.add(mapping.leftColumn)
    usedRight.add(mapping.rightColumn)
    mappings.push(mapping)
  }

  for (const leftColumn of leftColumns) {
    if (usedLeft.has(leftColumn.name)) {
      continue
    }

    const rightColumn = rightColumns.find(
      (candidate) =>
        !usedRight.has(candidate.name) &&
        normalizeColumnName(candidate.name) === normalizeColumnName(leftColumn.name),
    )

    if (rightColumn) {
      usedLeft.add(leftColumn.name)
      usedRight.add(rightColumn.name)
      mappings.push({
        leftColumn: leftColumn.name,
        rightColumn: rightColumn.name,
        source: 'Automatic',
      })
    } else {
      mappings.push({
        leftColumn: leftColumn.name,
        source: 'Left Only',
      })
    }
  }

  for (const rightColumn of rightColumns) {
    if (!usedRight.has(rightColumn.name)) {
      mappings.push({
        rightColumn: rightColumn.name,
        source: 'Right Only',
      })
    }
  }

  return mappings
})

function normalizeColumnName(name: string): string {
  return name.replace(/\s+/g, '').toLowerCase()
}

function addManualMapping(): void {
  const leftColumn = manualLeftColumn.value
  const rightColumn = manualRightColumn.value

  manualMappings.value = [
    ...manualMappings.value.filter((mapping) => mapping.leftColumn !== leftColumn),
    {
      leftColumn,
      rightColumn,
      source: 'Manual',
    },
  ]
}
</script>

<template>
  <section class="table-compare-view">
    <header class="table-compare-header">
      <div>
        <p class="eyebrow">Table Compare</p>
        <h1>Table Compare</h1>
      </div>
      <div class="table-summary">
        <strong>{{ columnMappings.length }}</strong>
        <span>Column mappings</span>
      </div>
    </header>

    <section class="column-map-controls">
      <label>
        <span>Left column</span>
        <select
          v-model="manualLeftColumn"
          data-testid="manual-left-column"
        >
          <option
            v-for="column in leftColumns"
            :key="column.name"
            :value="column.name"
          >
            {{ column.name }}
          </option>
        </select>
      </label>
      <label>
        <span>Right column</span>
        <select
          v-model="manualRightColumn"
          data-testid="manual-right-column"
        >
          <option
            v-for="column in rightColumns"
            :key="column.name"
            :value="column.name"
          >
            {{ column.name }}
          </option>
        </select>
      </label>
      <NButton
        size="small"
        type="primary"
        data-testid="add-column-mapping"
        @click="addManualMapping"
      >
        Add Mapping
      </NButton>
    </section>

    <section class="column-source-grid">
      <section>
        <h2>Left Columns</h2>
        <ul>
          <li
            v-for="column in leftColumns"
            :key="column.name"
          >
            {{ column.name }}
          </li>
        </ul>
      </section>
      <section>
        <h2>Right Columns</h2>
        <ul>
          <li
            v-for="column in rightColumns"
            :key="column.name"
          >
            {{ column.name }}
          </li>
        </ul>
      </section>
    </section>

    <section class="table-grid-panel">
      <header>
        <strong>Data Grid</strong>
        <span>{{ visibleRows }} rows x {{ visibleColumns }} columns</span>
      </header>
      <div class="table-grid-viewport">
        <div
          class="table-virtual-grid"
          data-testid="table-virtual-grid"
          :style="virtualGridStyle"
        >
          <div
            v-for="row in virtualGridRows"
            :key="row.key"
            class="table-grid-row"
            data-testid="table-grid-row"
          >
            <span
              v-for="cell in row.cells"
              :key="cell.key"
              class="table-grid-cell"
              data-testid="table-grid-cell"
            >
              {{ cell.text }}
            </span>
          </div>
        </div>
      </div>
    </section>

    <section
      class="column-mapping-list"
      data-testid="column-mapping-list"
    >
      <header>
        <strong>Column Mapping</strong>
        <span>Manual mappings override automatic name matches.</span>
      </header>
      <div class="column-map-table">
        <div class="column-map-row column-map-head">
          <span>Left</span>
          <span>Right</span>
          <span>Source</span>
        </div>
        <div
          v-for="mapping in columnMappings"
          :key="`${mapping.leftColumn ?? '--'}-${mapping.rightColumn ?? '--'}-${mapping.source}`"
          class="column-map-row"
        >
          <span>{{ mapping.leftColumn ?? '--' }}</span>
          <span>{{ mapping.rightColumn ?? '--' }}</span>
          <strong>{{ mapping.source }}</strong>
          <small>{{ mapping.leftColumn ?? '--' }} -> {{ mapping.rightColumn ?? '--' }}</small>
        </div>
      </div>
    </section>
  </section>
</template>

<style scoped>
.table-compare-view {
  display: grid;
  gap: 14px;
  height: 100%;
  padding: 16px;
  overflow: auto;
}

.table-compare-header {
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

.table-summary {
  display: grid;
  min-width: 132px;
  padding: 10px 12px;
  border: 1px solid var(--app-border);
  border-radius: 8px;
  background: var(--app-surface);
  text-align: right;
}

.table-summary strong {
  font-size: 18px;
  line-height: 1;
}

.table-summary span {
  color: var(--app-text-muted);
  font-size: 12px;
}

.column-map-controls {
  display: grid;
  grid-template-columns: minmax(180px, 1fr) minmax(180px, 1fr) auto;
  align-items: end;
  gap: 10px;
  padding: 12px;
  border: 1px solid var(--app-border);
  border-radius: 8px;
  background: var(--app-surface);
}

.column-map-controls label {
  display: grid;
  gap: 5px;
}

.column-map-controls span,
.column-mapping-list header span {
  color: var(--app-text-muted);
  font-size: 12px;
}

.column-map-controls select {
  width: 100%;
  height: 32px;
  padding: 0 9px;
  border: 1px solid var(--app-border);
  border-radius: 6px;
  background: var(--app-bg);
  color: var(--app-text);
  font-size: 13px;
}

.column-source-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 10px;
}

.column-source-grid section,
.column-mapping-list,
.table-grid-panel {
  display: grid;
  gap: 8px;
  padding: 10px;
  border: 1px solid var(--app-border);
  border-radius: 8px;
  background: var(--app-surface);
}

.column-source-grid ul {
  display: grid;
  gap: 6px;
  margin: 0;
  padding: 0;
  list-style: none;
}

.column-source-grid li {
  padding: 7px 9px;
  border: 1px solid var(--app-border);
  border-radius: 6px;
  background: var(--app-bg);
  font-size: 12px;
}

.column-mapping-list header {
  display: grid;
  gap: 2px;
}

.table-grid-panel header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.table-grid-panel header span {
  color: var(--app-text-muted);
  font-size: 12px;
}

.table-grid-viewport {
  max-width: 100%;
  overflow: auto;
  border: 1px solid var(--app-border);
  border-radius: 6px;
  background: var(--app-bg);
}

.table-virtual-grid {
  display: grid;
  grid-template-rows: repeat(var(--visible-rows), 34px);
  min-width: calc(var(--visible-columns) * 132px);
}

.table-grid-row {
  display: grid;
  grid-template-columns: repeat(var(--visible-columns), minmax(132px, 1fr));
  min-height: 34px;
  border-bottom: 1px solid var(--app-border);
}

.table-grid-row:last-child {
  border-bottom: 0;
}

.table-grid-cell {
  min-width: 0;
  padding: 8px 10px;
  overflow: hidden;
  border-right: 1px solid var(--app-border);
  font-size: 12px;
  line-height: 18px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.table-grid-cell:last-child {
  border-right: 0;
}

.column-map-table {
  display: grid;
  overflow: auto;
  border: 1px solid var(--app-border);
  border-radius: 6px;
}

.column-map-row {
  display: grid;
  grid-template-columns: minmax(160px, 1fr) minmax(160px, 1fr) 120px;
  min-width: 520px;
  border-bottom: 1px solid var(--app-border);
  font-size: 12px;
}

.column-map-row:last-child {
  border-bottom: 0;
}

.column-map-row span,
.column-map-row strong {
  min-width: 0;
  padding: 8px 10px;
  overflow: hidden;
  border-right: 1px solid var(--app-border);
  text-overflow: ellipsis;
  white-space: nowrap;
}

.column-map-row strong {
  border-right: 0;
}

.column-map-row small {
  position: absolute;
  width: 1px;
  height: 1px;
  overflow: hidden;
  white-space: nowrap;
}

.column-map-head {
  background: var(--app-surface-muted);
  color: var(--app-text-muted);
  font-weight: 700;
}

@media (width <= 760px) {
  .table-compare-header,
  .column-map-controls,
  .column-source-grid {
    grid-template-columns: 1fr;
  }

  .table-compare-header {
    display: grid;
  }

  .table-summary {
    text-align: left;
  }
}
</style>
