<script setup lang="ts">
import { computed, ref } from 'vue'

type FolderSide = 'left' | 'right'
type FolderStatus = 'Same' | 'Different' | 'Left only' | 'Right only'

interface FolderTreeRow {
  id: string
  parentId?: string
  depth: number
  leftName?: string
  rightName?: string
  leftSize?: string
  rightSize?: string
  leftModified?: string
  rightModified?: string
  status: FolderStatus
  kind: 'file' | 'directory'
}

const generatedRows: FolderTreeRow[] = Array.from({ length: 180 }, (_, index): FolderTreeRow => {
  const number = index + 1
  const padded = String(number).padStart(3, '0')
  const sizeLabel = `${String(number + 1)}.0 KB`

  return {
    id: `generated-${padded}`,
    depth: 0,
    leftName: `generated-${padded}.log`,
    rightName: `generated-${padded}.log`,
    leftSize: sizeLabel,
    rightSize: sizeLabel,
    leftModified: '2026-06-24 10:00',
    rightModified: '2026-06-24 10:00',
    status: 'Same',
    kind: 'file',
  }
})

const rows = ref<FolderTreeRow[]>([
  {
    id: 'src',
    depth: 0,
    leftName: 'src',
    rightName: 'src',
    leftSize: '--',
    rightSize: '--',
    leftModified: '2026-06-20 10:12',
    rightModified: '2026-06-20 10:12',
    status: 'Same',
    kind: 'directory',
  },
  {
    id: 'src-main',
    parentId: 'src',
    depth: 1,
    leftName: 'main.ts',
    rightName: 'main.ts',
    leftSize: '8.4 KB',
    rightSize: '9.1 KB',
    leftModified: '2026-06-21 15:44',
    rightModified: '2026-06-22 09:08',
    status: 'Different',
    kind: 'file',
  },
  {
    id: 'readme',
    depth: 0,
    leftName: 'README.md',
    rightName: 'README.md',
    leftSize: '12.2 KB',
    rightSize: '12.2 KB',
    leftModified: '2026-06-18 08:30',
    rightModified: '2026-06-18 08:30',
    status: 'Same',
    kind: 'file',
  },
  {
    id: 'notes',
    depth: 0,
    leftName: 'release-notes.md',
    leftSize: '3.5 KB',
    leftModified: '2026-06-23 11:02',
    status: 'Left only',
    kind: 'file',
  },
  ...generatedRows,
])
const expandedDirectoryIds = ref<Set<string>>(new Set(['src']))
const rowHeight = 34
const virtualViewportRows = 18
const virtualOverscanRows = 4
const scrollTop = ref(0)

const summary = computed(() => ({
  total: rows.value.length,
  different: rows.value.filter((row) => row.status === 'Different').length,
  orphans: rows.value.filter((row) => row.status === 'Left only' || row.status === 'Right only')
    .length,
}))
const directoryRows = computed(() => rows.value.filter((row) => row.kind === 'directory'))
const visibleRows = computed(() =>
  rows.value.filter((row) => !row.parentId || expandedDirectoryIds.value.has(row.parentId)),
)
const virtualStartIndex = computed(() =>
  Math.max(0, Math.floor(scrollTop.value / rowHeight) - virtualOverscanRows),
)
const virtualEndIndex = computed(() =>
  Math.min(
    visibleRows.value.length,
    virtualStartIndex.value + virtualViewportRows + virtualOverscanRows * 2,
  ),
)
const virtualRows = computed(() =>
  visibleRows.value.slice(virtualStartIndex.value, virtualEndIndex.value),
)
const virtualSpacerHeight = computed(() => {
  const height = String(visibleRows.value.length * rowHeight)

  return `${height}px`
})
const virtualOffset = computed(() => {
  const offset = String(virtualStartIndex.value * rowHeight)

  return `translateY(${offset}px)`
})

function rowIndent(row: FolderTreeRow): string {
  const indent = String(row.depth * 18)

  return `${indent}px`
}

function sideValue(
  row: FolderTreeRow,
  side: FolderSide,
  field: 'name' | 'size' | 'modified',
): string {
  const key = `${side}${field[0].toUpperCase()}${field.slice(1)}` as keyof FolderTreeRow
  const value = row[key]

  return typeof value === 'string' ? value : '--'
}

function toggleFolder(row: FolderTreeRow): void {
  if (row.kind !== 'directory') {
    return
  }

  const next = new Set(expandedDirectoryIds.value)

  if (next.has(row.id)) {
    next.delete(row.id)
  } else {
    next.add(row.id)
  }

  expandedDirectoryIds.value = next
}

function expandAllFolders(): void {
  expandedDirectoryIds.value = new Set(directoryRows.value.map((row) => row.id))
}

function collapseAllFolders(): void {
  expandedDirectoryIds.value = new Set()
}

function isExpanded(row: FolderTreeRow): boolean {
  return expandedDirectoryIds.value.has(row.id)
}

function handleTreeScroll(event: Event): void {
  scrollTop.value = (event.currentTarget as HTMLElement).scrollTop
}
</script>

<template>
  <section class="folder-compare-view">
    <header class="folder-toolbar">
      <div class="path-pair">
        <label>
          <span>Left folder</span>
          <input
            value="D:/workspace/left"
            readonly
          />
        </label>
        <label>
          <span>Right folder</span>
          <input
            value="D:/workspace/right"
            readonly
          />
        </label>
      </div>
      <div class="folder-actions">
        <NButton size="small">Compare</NButton>
        <NButton
          size="small"
          secondary
        >
          Refresh
        </NButton>
        <NButton
          size="small"
          secondary
          data-testid="expand-all-folders"
          @click="expandAllFolders"
        >
          Open All
        </NButton>
        <NButton
          size="small"
          secondary
          data-testid="collapse-all-folders"
          @click="collapseAllFolders"
        >
          Close All
        </NButton>
      </div>
    </header>

    <section class="folder-summary">
      <div>
        <strong>{{ summary.total }}</strong>
        <span>Items</span>
      </div>
      <div>
        <strong>{{ summary.different }}</strong>
        <span>Different</span>
      </div>
      <div>
        <strong>{{ summary.orphans }}</strong>
        <span>Orphans</span>
      </div>
    </section>

    <section
      class="folder-tree-table"
      data-testid="folder-tree-table"
      @scroll="handleTreeScroll"
    >
      <div class="tree-head">
        <span>Name</span>
        <span>Size</span>
        <span>Modified</span>
        <span>Status</span>
        <span>Name</span>
        <span>Size</span>
        <span>Modified</span>
      </div>
      <div
        class="tree-body"
        data-testid="folder-virtual-spacer"
        :style="{ height: virtualSpacerHeight }"
      >
        <div
          class="tree-window"
          :style="{ transform: virtualOffset }"
        >
          <div
            v-for="row in virtualRows"
            :key="row.id"
            class="tree-row"
            :class="[`status-${row.status.toLowerCase().replaceAll(' ', '-')}`, row.kind]"
            data-testid="folder-row"
          >
            <span
              class="name-cell left-name"
              :style="{ paddingLeft: rowIndent(row) }"
            >
              <button
                v-if="row.kind === 'directory'"
                type="button"
                class="folder-toggle"
                :data-testid="`toggle-folder-${row.id}`"
                :aria-expanded="isExpanded(row)"
                @click="toggleFolder(row)"
              >
                {{ isExpanded(row) ? '▾' : '▸' }}
              </button>
              {{ sideValue(row, 'left', 'name') }}
            </span>
            <span>{{ sideValue(row, 'left', 'size') }}</span>
            <span>{{ sideValue(row, 'left', 'modified') }}</span>
            <strong>{{ row.status }}</strong>
            <span
              class="name-cell"
              :style="{ paddingLeft: rowIndent(row) }"
            >
              {{ sideValue(row, 'right', 'name') }}
            </span>
            <span>{{ sideValue(row, 'right', 'size') }}</span>
            <span>{{ sideValue(row, 'right', 'modified') }}</span>
          </div>
        </div>
      </div>
    </section>
  </section>
</template>

<style scoped>
.folder-compare-view {
  display: grid;
  grid-template-rows: auto auto minmax(0, 1fr);
  gap: 12px;
  height: 100%;
  padding: 16px;
  overflow: hidden;
}

.folder-toolbar {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  align-items: end;
  gap: 12px;
}

.path-pair {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 10px;
}

.path-pair label {
  display: grid;
  gap: 5px;
  min-width: 0;
}

.path-pair span {
  color: var(--app-text-muted);
  font-size: 12px;
}

.path-pair input {
  width: 100%;
  height: 32px;
  padding: 0 9px;
  overflow: hidden;
  border: 1px solid var(--app-border);
  border-radius: 6px;
  background: var(--app-surface);
  color: var(--app-text);
  text-overflow: ellipsis;
}

.folder-actions {
  display: flex;
  gap: 8px;
}

.folder-summary {
  display: grid;
  grid-template-columns: repeat(3, 110px);
  gap: 8px;
}

.folder-summary div {
  display: grid;
  gap: 2px;
  padding: 9px 10px;
  border: 1px solid var(--app-border);
  border-radius: 8px;
  background: var(--app-surface);
}

.folder-summary strong {
  font-size: 18px;
  line-height: 1;
}

.folder-summary span {
  color: var(--app-text-muted);
  font-size: 12px;
}

.folder-tree-table {
  position: relative;
  min-height: 0;
  overflow: auto;
  border: 1px solid var(--app-border);
  border-radius: 8px;
  background: var(--app-surface);
}

.tree-body {
  position: relative;
}

.tree-window {
  position: absolute;
  inset: 0 0 auto;
}

.tree-head,
.tree-row {
  display: grid;
  grid-template-columns: minmax(180px, 1.2fr) 90px 150px 104px minmax(180px, 1.2fr) 90px 150px;
  min-width: 1040px;
}

.tree-head {
  position: sticky;
  top: 0;
  z-index: 1;
  border-bottom: 1px solid var(--app-border);
  background: var(--app-surface-muted);
  color: var(--app-text-muted);
  font-size: 12px;
  font-weight: 700;
}

.tree-head span,
.tree-row span,
.tree-row strong {
  min-width: 0;
  padding: 8px 10px;
  overflow: hidden;
  border-right: 1px solid var(--app-border);
  text-overflow: ellipsis;
  white-space: nowrap;
}

.tree-row {
  border-bottom: 1px solid var(--app-border);
  color: var(--app-text);
  font-size: 13px;
}

.tree-row.directory .name-cell {
  font-weight: 700;
}

.tree-row strong {
  font-size: 12px;
  font-weight: 700;
}

.status-same strong {
  color: var(--diff-added-fg);
}

.status-different strong {
  color: var(--diff-modified-fg);
}

.status-left-only strong,
.status-right-only strong {
  color: var(--diff-deleted-fg);
}

@media (width <= 760px) {
  .folder-toolbar,
  .path-pair,
  .folder-summary {
    grid-template-columns: 1fr;
  }

  .folder-actions {
    justify-content: start;
  }
}
</style>
