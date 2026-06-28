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
  columnKey: string
  testId: string
  text: string
}

interface VirtualGridRow {
  key: string
  cells: VirtualGridCell[]
}

interface VirtualGridColumn {
  key: string
  label: string
}

interface TableCellLocation {
  key: string
  text: string
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
const virtualGridColumns: VirtualGridColumn[] = [
  { key: 'sku', label: 'SKU' },
  { key: 'region', label: 'Region' },
  { key: 'quantity', label: 'Quantity' },
  { key: 'price', label: 'Price' },
  { key: 'updated', label: 'Updated' },
]
const manualLeftColumn = ref('SKU')
const manualRightColumn = ref('sku')
const manualMappings = ref<ColumnMappingModel[]>([])
const leftGridViewport = ref<HTMLElement | null>(null)
const rightGridViewport = ref<HTMLElement | null>(null)
const ignoredColumnKeys = ref<string[]>([])
const tableSearchQuery = ref('')
const activeDifferenceIndex = ref(0)

const tableDifferenceCells: TableCellLocation[] = [
  { key: 'row-2-quantity', text: 'R2C3' },
  { key: 'row-5-price', text: 'R5C4' },
]

const visibleGridColumns = computed<VirtualGridColumn[]>(() =>
  virtualGridColumns.filter((column) => !ignoredColumnKeys.value.includes(column.key)),
)

const visibleColumns = computed(() => visibleGridColumns.value.length)

const virtualGridStyle = computed<Record<string, string>>(() => ({
  '--visible-columns': String(visibleColumns.value),
  '--visible-rows': String(visibleRows),
}))

const virtualGridRows = computed<VirtualGridRow[]>(() =>
  Array.from({ length: visibleRows }, (_, rowIndex) => {
    const rowNumber = rowIndex + 1
    const rowLabel = String(rowNumber)

    return {
      key: `row-${rowLabel}`,
      cells: visibleGridColumns.value.map((column, columnIndex) => {
        const columnLabel = String(columnIndex + 1)

        return {
          key: `cell-${rowLabel}-${column.key}`,
          columnKey: column.key,
          testId: `table-grid-cell-${column.key}`,
          text: `R${rowLabel}C${columnLabel}`,
        }
      }),
    }
  }),
)

const columnRules = computed(() =>
  virtualGridColumns.map((column) => {
    const ignored = ignoredColumnKeys.value.includes(column.key)

    return {
      ...column,
      ignored,
      importance: ignored ? 'Unimportant' : 'Important',
      status: ignored ? 'Ignored' : 'Compared',
    }
  }),
)

const searchableCells = computed<TableCellLocation[]>(() =>
  virtualGridRows.value.flatMap((row) =>
    row.cells.map((cell) => ({
      key: `${row.key}-${cell.columnKey}`,
      text: cell.text,
    })),
  ),
)

const tableSearchMatches = computed<TableCellLocation[]>(() => {
  const query = tableSearchQuery.value.trim().toLowerCase()

  if (!query) {
    return []
  }

  return searchableCells.value.filter((cell) => cell.text.toLowerCase().includes(query))
})

const activeTableCell = computed<TableCellLocation | undefined>(
  () => tableSearchMatches.value[0] ?? tableDifferenceCells[activeDifferenceIndex.value],
)

const tableSearchSummary = computed(() => {
  const count = tableSearchMatches.value.length

  return `${String(count)} ${count === 1 ? 'match' : 'matches'}`
})

const tableDifferenceSummary = computed(
  () => `${String(activeDifferenceIndex.value + 1)} / ${String(tableDifferenceCells.length)}`,
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

function syncGridScroll(source: 'left' | 'right', event: Event): void {
  const sourceElement = event.currentTarget
  const targetElement = source === 'left' ? rightGridViewport.value : leftGridViewport.value

  if (!(sourceElement instanceof HTMLElement) || !targetElement) {
    return
  }

  targetElement.scrollTop = sourceElement.scrollTop
  targetElement.scrollLeft = sourceElement.scrollLeft
}

function goToNextTableDifference(): void {
  if (tableSearchQuery.value.trim()) {
    tableSearchQuery.value = ''
    activeDifferenceIndex.value = 0

    return
  }

  activeDifferenceIndex.value = (activeDifferenceIndex.value + 1) % tableDifferenceCells.length
}
</script>

<template>
  <section class="table-compare-view">
    <header class="table-compare-header">
      <div>
        <p class="eyebrow">{{ $t('ui.tableCompare') }}</p>
        <h1>{{ $t('ui.tableCompare') }}</h1>
      </div>
      <div class="table-summary">
        <strong>{{ columnMappings.length }}</strong>
        <span>{{ $t('ui.columnMappings') }}</span>
      </div>
    </header>

    <section class="column-map-controls">
      <label>
        <span>{{ $t('ui.leftColumn') }}</span>
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
        <span>{{ $t('ui.rightColumn') }}</span>
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
        >{{ $t('ui.addMapping') }}</NButton
      >
    </section>

    <section class="column-source-grid">
      <section>
        <h2>{{ $t('ui.leftColumns') }}</h2>
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
        <h2>{{ $t('ui.rightColumns') }}</h2>
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
        <strong>{{ $t('ui.dataGrid') }}</strong>
        <span>{{ visibleRows }} rows x {{ visibleColumns }} columns</span>
      </header>
      <div class="table-navigation-bar">
        <label>
          <span>{{ $t('ui.find') }}</span>
          <input
            v-model="tableSearchQuery"
            type="search"
            data-testid="table-search-input"
          />
        </label>
        <span data-testid="table-search-summary">{{ tableSearchSummary }}</span>
        <button
          type="button"
          data-testid="next-table-difference"
          @click="goToNextTableDifference"
        >
          {{ $t('ui.nextDifference') }}
        </button>
        <span data-testid="table-difference-summary">{{ tableDifferenceSummary }}</span>
        <strong data-testid="active-table-cell">{{ activeTableCell?.text ?? '--' }}</strong>
      </div>
      <div class="table-column-rules">
        <label
          v-for="rule in columnRules"
          :key="rule.key"
          class="table-column-rule"
          :data-testid="`column-rule-${rule.key}`"
        >
          <input
            v-model="ignoredColumnKeys"
            type="checkbox"
            :value="rule.key"
            :data-testid="`ignore-column-${rule.key}`"
          />
          <span>{{ rule.label }}</span>
          <strong>{{ rule.status }}</strong>
          <small>{{ rule.importance }}</small>
        </label>
      </div>
      <div class="table-grid-panes">
        <section class="table-grid-pane">
          <strong>{{ $t('ui.left') }}</strong>
          <div
            ref="leftGridViewport"
            class="table-grid-viewport"
            data-testid="left-table-grid-viewport"
            @scroll="syncGridScroll('left', $event)"
          >
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
                  :data-column-key="cell.columnKey"
                  data-testid="table-grid-cell"
                >
                  <span :data-testid="cell.testId">{{ cell.text }}</span>
                </span>
              </div>
            </div>
          </div>
        </section>
        <section class="table-grid-pane">
          <strong>{{ $t('ui.right') }}</strong>
          <div
            ref="rightGridViewport"
            class="table-grid-viewport"
            data-testid="right-table-grid-viewport"
            @scroll="syncGridScroll('right', $event)"
          >
            <div
              class="table-virtual-grid"
              :style="virtualGridStyle"
            >
              <div
                v-for="row in virtualGridRows"
                :key="row.key"
                class="table-grid-row"
              >
                <span
                  v-for="cell in row.cells"
                  :key="cell.key"
                  class="table-grid-cell"
                  :data-column-key="cell.columnKey"
                >
                  {{ cell.text }}
                </span>
              </div>
            </div>
          </div>
        </section>
      </div>
    </section>

    <section
      class="column-mapping-list"
      data-testid="column-mapping-list"
    >
      <header>
        <strong>{{ $t('ui.columnMapping') }}</strong>
        <span>{{ $t('ui.manualMappingsOverrideAutomaticNameMatches') }}</span>
      </header>
      <div class="column-map-table">
        <div class="column-map-row column-map-head">
          <span>{{ $t('ui.left') }}</span>
          <span>{{ $t('ui.right') }}</span>
          <span>{{ $t('ui.source') }}</span>
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

.table-navigation-bar {
  display: grid;
  grid-template-columns: minmax(180px, 1fr) auto auto auto auto;
  align-items: end;
  gap: 8px;
}

.table-navigation-bar label {
  display: grid;
  gap: 4px;
}

.table-navigation-bar label span,
.table-navigation-bar > span {
  color: var(--app-text-muted);
  font-size: 12px;
}

.table-navigation-bar input {
  width: 100%;
  height: 32px;
  padding: 0 9px;
  border: 1px solid var(--app-border);
  border-radius: 6px;
  background: var(--app-bg);
  color: var(--app-text);
  font-size: 13px;
}

.table-navigation-bar button {
  height: 32px;
  padding: 0 10px;
  border: 1px solid var(--app-border);
  border-radius: 6px;
  background: var(--app-surface-muted);
  color: var(--app-text);
  font-size: 12px;
}

.table-navigation-bar > strong {
  min-width: 72px;
  padding: 7px 9px;
  border: 1px solid var(--app-border);
  border-radius: 6px;
  background: var(--app-bg);
  font-size: 12px;
  text-align: center;
}

.table-column-rules {
  display: grid;
  grid-template-columns: repeat(5, minmax(128px, 1fr));
  gap: 8px;
  overflow: auto;
}

.table-column-rule {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr);
  align-items: center;
  gap: 4px 8px;
  min-width: 128px;
  padding: 8px;
  border: 1px solid var(--app-border);
  border-radius: 6px;
  background: var(--app-bg);
  font-size: 12px;
}

.table-column-rule input {
  width: 14px;
  height: 14px;
  margin: 0;
}

.table-column-rule strong,
.table-column-rule small {
  grid-column: 2;
  color: var(--app-text-muted);
  line-height: 1.2;
}

.table-column-rule small {
  font-size: 11px;
}

.table-grid-panes {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 10px;
}

.table-grid-pane {
  display: grid;
  gap: 6px;
  min-width: 0;
}

.table-grid-pane > strong {
  color: var(--app-text-muted);
  font-size: 12px;
}

.table-grid-viewport {
  max-width: 100%;
  max-height: 178px;
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
  .column-source-grid,
  .table-navigation-bar,
  .table-column-rules,
  .table-grid-panes {
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
