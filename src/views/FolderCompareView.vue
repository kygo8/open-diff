<script setup lang="ts">
import {
  createAssociatedApplicationOpenAction,
  createDefaultOpenAction,
  createOpenWithAction,
  type FileOpenAction,
} from '@/app/fileOpenActions'
import { computed, ref } from 'vue'

type FolderSide = 'left' | 'right'
type FolderStatus = 'Same' | 'Different' | 'Left only' | 'Right only'
type FolderColumnId = 'size' | 'modified' | 'type'

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
  leftPath?: string
  rightPath?: string
  status: FolderStatus
  kind: 'file' | 'directory'
}

const configurableColumns: { id: FolderColumnId; label: string }[] = [
  { id: 'size', label: 'Size' },
  { id: 'modified', label: 'Modified' },
  { id: 'type', label: 'Type' },
]
const displayStatusOptions: { statuses: FolderStatus[]; label: string; testId: string }[] = [
  { statuses: ['Same'], label: 'Same', testId: 'same' },
  { statuses: ['Different'], label: 'Different', testId: 'different' },
  { statuses: ['Left only', 'Right only'], label: 'Orphans', testId: 'orphans' },
]
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
    leftPath: `D:/workspace/left/generated-${padded}.log`,
    rightPath: `D:/workspace/right/generated-${padded}.log`,
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
    leftPath: 'D:/workspace/left/src',
    rightPath: 'D:/workspace/right/src',
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
    leftPath: 'D:/workspace/left/src/main.ts',
    rightPath: 'D:/workspace/right/src/main.ts',
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
    leftPath: 'D:/workspace/left/README.md',
    rightPath: 'D:/workspace/right/README.md',
    status: 'Same',
    kind: 'file',
  },
  {
    id: 'notes',
    depth: 0,
    leftName: 'release-notes.md',
    leftSize: '3.5 KB',
    leftModified: '2026-06-23 11:02',
    leftPath: 'D:/workspace/left/release-notes.md',
    status: 'Left only',
    kind: 'file',
  },
  ...generatedRows,
])
const expandedDirectoryIds = ref<Set<string>>(new Set(['src']))
const visibleStatuses = ref<Set<FolderStatus>>(
  new Set(['Same', 'Different', 'Left only', 'Right only']),
)
const showSuppressedFilters = ref(false)
const rowHeight = 34
const virtualViewportRows = 18
const virtualOverscanRows = 4
const scrollTop = ref(0)
const selectedRowId = ref<string>()
const lastOpenAction = ref<FileOpenAction>()
const lastCompareAction = ref<string>()

const summary = computed(() => ({
  total: rows.value.length,
  different: rows.value.filter((row) => row.status === 'Different').length,
  orphans: rows.value.filter((row) => row.status === 'Left only' || row.status === 'Right only')
    .length,
}))
const directoryRows = computed(() => rows.value.filter((row) => row.kind === 'directory'))
const selectedRow = computed(() => rows.value.find((row) => row.id === selectedRowId.value))
const selectedFilePath = computed(() => {
  const row = selectedRow.value

  if (row?.kind !== 'file') {
    return undefined
  }

  return row.leftPath ?? row.rightPath
})
const visibleRows = computed(() =>
  rows.value.filter(
    (row) =>
      (!row.parentId || expandedDirectoryIds.value.has(row.parentId)) &&
      (visibleStatuses.value.has(row.status) || showSuppressedFilters.value),
  ),
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
const visibleColumnIds = ref<Set<FolderColumnId>>(new Set(['size', 'modified']))
const gridTemplateColumns = computed(() => {
  const columns = ['minmax(180px, 1.2fr)']

  if (isColumnVisible('size')) {
    columns.push('90px')
  }

  if (isColumnVisible('modified')) {
    columns.push('150px')
  }

  if (isColumnVisible('type')) {
    columns.push('96px')
  }

  columns.push('104px', 'minmax(180px, 1.2fr)')

  if (isColumnVisible('size')) {
    columns.push('90px')
  }

  if (isColumnVisible('modified')) {
    columns.push('150px')
  }

  if (isColumnVisible('type')) {
    columns.push('96px')
  }

  return columns.join(' ')
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

function typeLabel(row: FolderTreeRow): string {
  return row.kind === 'directory' ? 'Directory' : 'File'
}

function isColumnVisible(columnId: FolderColumnId): boolean {
  return visibleColumnIds.value.has(columnId)
}

function toggleColumn(columnId: FolderColumnId, selected: boolean): void {
  const next = new Set(visibleColumnIds.value)

  if (selected) {
    next.add(columnId)
  } else {
    next.delete(columnId)
  }

  visibleColumnIds.value = next
}

function areStatusesVisible(statuses: FolderStatus[]): boolean {
  return statuses.every((status) => visibleStatuses.value.has(status))
}

function isSuppressed(row: FolderTreeRow): boolean {
  return !visibleStatuses.value.has(row.status)
}

function toggleStatuses(statuses: FolderStatus[], selected: boolean): void {
  const next = new Set(visibleStatuses.value)

  for (const status of statuses) {
    if (selected) {
      next.add(status)
    } else {
      next.delete(status)
    }
  }

  visibleStatuses.value = next
  scrollTop.value = 0
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

function selectRow(row: FolderTreeRow): void {
  selectedRowId.value = row.id
}

function recordOpenAction(action: FileOpenAction): void {
  lastOpenAction.value = action
}

function openSelectedFile(): void {
  if (!selectedFilePath.value) {
    return
  }

  recordOpenAction(createDefaultOpenAction(selectedFilePath.value))
}

function openSelectedFileWithTextEdit(): void {
  if (!selectedFilePath.value) {
    return
  }

  recordOpenAction(createOpenWithAction(selectedFilePath.value, 'Text Edit', 'open-diff-text-edit'))
}

function openSelectedFileWithAssociatedApplication(): void {
  if (!selectedFilePath.value) {
    return
  }

  recordOpenAction(createAssociatedApplicationOpenAction(selectedFilePath.value))
}

function quickCompareSelectedFile(): void {
  if (!selectedFilePath.value) {
    return
  }

  lastCompareAction.value = `Quick Compare -> ${selectedFilePath.value}`
}

function compareSelectedFileToCounterpart(): void {
  const row = selectedRow.value

  if (row?.kind !== 'file') {
    return
  }

  const sourcePath = row.leftPath ?? row.rightPath
  const targetPath = row.rightPath ?? row.leftPath

  if (!sourcePath || !targetPath) {
    return
  }

  lastCompareAction.value = `Compare To -> ${sourcePath} => ${targetPath}`
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
          data-testid="open-selected-file"
          :disabled="!selectedFilePath"
          @click="openSelectedFile"
        >
          Open
        </NButton>
        <NButton
          size="small"
          secondary
          data-testid="open-with-selected-file"
          :disabled="!selectedFilePath"
          @click="openSelectedFileWithTextEdit"
        >
          Open With
        </NButton>
        <NButton
          size="small"
          secondary
          data-testid="open-associated-file"
          :disabled="!selectedFilePath"
          @click="openSelectedFileWithAssociatedApplication"
        >
          Associated App
        </NButton>
        <NButton
          size="small"
          secondary
          data-testid="quick-compare-selected-file"
          :disabled="!selectedFilePath"
          @click="quickCompareSelectedFile"
        >
          Quick Compare
        </NButton>
        <NButton
          size="small"
          secondary
          data-testid="compare-to-selected-file"
          :disabled="!selectedFilePath"
          @click="compareSelectedFileToCounterpart"
        >
          Compare To
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

    <section class="column-config">
      <label
        v-for="column in configurableColumns"
        :key="column.id"
      >
        <input
          :data-testid="`toggle-column-${column.id}`"
          type="checkbox"
          :checked="isColumnVisible(column.id)"
          @change="toggleColumn(column.id, ($event.target as HTMLInputElement).checked)"
        />
        <span>{{ column.label }}</span>
      </label>
    </section>

    <section class="display-filters">
      <label
        v-for="option in displayStatusOptions"
        :key="option.testId"
      >
        <input
          :data-testid="`toggle-status-${option.testId}`"
          type="checkbox"
          :checked="areStatusesVisible(option.statuses)"
          @change="toggleStatuses(option.statuses, ($event.target as HTMLInputElement).checked)"
        />
        <span>{{ option.label }}</span>
      </label>
      <label>
        <input
          v-model="showSuppressedFilters"
          data-testid="toggle-suppressed-filters"
          type="checkbox"
        />
        <span>Suppressed</span>
      </label>
    </section>

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
      v-if="lastOpenAction"
      class="folder-action-status"
      data-testid="folder-open-action-status"
    >
      {{ lastOpenAction.label }} -> {{ lastOpenAction.path }}
    </section>
    <section
      v-if="lastCompareAction"
      class="folder-action-status"
      data-testid="folder-compare-action-status"
    >
      {{ lastCompareAction }}
    </section>

    <section
      class="folder-tree-table"
      data-testid="folder-tree-table"
      @scroll="handleTreeScroll"
    >
      <div
        class="tree-head"
        :style="{ gridTemplateColumns }"
      >
        <span>Name</span>
        <span
          v-if="isColumnVisible('size')"
          data-column="left-size"
        >
          Size
        </span>
        <span
          v-if="isColumnVisible('modified')"
          data-column="left-modified"
        >
          Modified
        </span>
        <span
          v-if="isColumnVisible('type')"
          data-column="left-type"
        >
          Type
        </span>
        <span>Status</span>
        <span>Name</span>
        <span
          v-if="isColumnVisible('size')"
          data-column="right-size"
        >
          Size
        </span>
        <span
          v-if="isColumnVisible('modified')"
          data-column="right-modified"
        >
          Modified
        </span>
        <span
          v-if="isColumnVisible('type')"
          data-column="right-type"
        >
          Type
        </span>
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
            :class="[
              `status-${row.status.toLowerCase().replaceAll(' ', '-')}`,
              row.kind,
              { selected: selectedRowId === row.id, suppressed: isSuppressed(row) },
            ]"
            :style="{ gridTemplateColumns }"
            :data-row-id="row.id"
            data-testid="folder-row"
            @click="selectRow(row)"
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
                @click.stop="toggleFolder(row)"
              >
                {{ isExpanded(row) ? '▾' : '▸' }}
              </button>
              {{ sideValue(row, 'left', 'name') }}
              <small
                v-if="isSuppressed(row)"
                :data-testid="`suppressed-marker-${row.id}`"
              >
                Suppressed
              </small>
            </span>
            <span
              v-if="isColumnVisible('size')"
              data-column="left-size"
            >
              {{ sideValue(row, 'left', 'size') }}
            </span>
            <span
              v-if="isColumnVisible('modified')"
              data-column="left-modified"
            >
              {{ sideValue(row, 'left', 'modified') }}
            </span>
            <span
              v-if="isColumnVisible('type')"
              data-column="left-type"
            >
              {{ typeLabel(row) }}
            </span>
            <strong>{{ row.status }}</strong>
            <span
              class="name-cell"
              :style="{ paddingLeft: rowIndent(row) }"
            >
              {{ sideValue(row, 'right', 'name') }}
            </span>
            <span
              v-if="isColumnVisible('size')"
              data-column="right-size"
            >
              {{ sideValue(row, 'right', 'size') }}
            </span>
            <span
              v-if="isColumnVisible('modified')"
              data-column="right-modified"
            >
              {{ sideValue(row, 'right', 'modified') }}
            </span>
            <span
              v-if="isColumnVisible('type')"
              data-column="right-type"
            >
              {{ typeLabel(row) }}
            </span>
          </div>
        </div>
      </div>
    </section>
  </section>
</template>

<style scoped>
.folder-compare-view {
  display: grid;
  grid-template-rows: auto auto auto auto auto minmax(0, 1fr);
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

.column-config,
.display-filters {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
}

.column-config label,
.display-filters label {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  color: var(--app-text-muted);
  font-size: 12px;
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

.folder-action-status {
  padding: 8px 10px;
  border: 1px solid var(--app-border);
  border-radius: 6px;
  background: var(--app-surface-muted);
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

.tree-row.selected {
  background: var(--app-surface-muted);
  outline: 1px solid var(--app-accent);
  outline-offset: -1px;
}

.tree-row.suppressed {
  opacity: 0.56;
}

.tree-row small {
  margin-left: 8px;
  color: var(--app-text-muted);
  font-size: 11px;
  font-weight: 600;
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
