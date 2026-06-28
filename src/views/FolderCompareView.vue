<script setup lang="ts">
import {
  createAssociatedApplicationOpenAction,
  createDefaultOpenAction,
  createOpenWithAction,
  listEnabledExternalApplications,
  type ExternalApplicationConfig,
  type FileOpenAction,
} from '@/app/fileOpenActions'
import {
  createFileOperationConfirmation,
  type FileOperationConfirmation,
} from '@/app/fileOperationConfirmation'
import { computed, ref } from 'vue'

type FolderSide = 'left' | 'right'
type FolderStatus = 'Same' | 'Different' | 'Left only' | 'Right only'
type FolderColumnId = 'size' | 'modified' | 'type'
type SyncPreviewAction = 'Copy' | 'Overwrite' | 'Delete' | 'Error' | 'Leave'

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

interface SyncPreviewItem {
  id: string
  action: SyncPreviewAction
  sourcePath?: string
  targetPath?: string
  originalSourcePath?: string
  originalTargetPath?: string
  detail: string
}

const configurableColumns: { id: FolderColumnId; label: string }[] = [
  { id: 'size', label: 'Size' },
  { id: 'modified', label: 'Modified' },
  { id: 'type', label: 'Type' },
]
const externalApplicationConfigs = ref<ExternalApplicationConfig[]>([
  {
    id: 'vscode',
    name: 'Visual Studio Code',
    executable: 'code',
    enabled: true,
  },
  {
    id: 'text-patch',
    name: 'Text Patch',
    executable: 'open-diff-text-patch',
    enabled: true,
  },
])
const displayStatusOptions: { statuses: FolderStatus[]; label: string; testId: string }[] = [
  { statuses: ['Same'], label: 'Same', testId: 'same' },
  { statuses: ['Different'], label: 'Different', testId: 'different' },
  { statuses: ['Left only', 'Right only'], label: 'Orphans', testId: 'orphans' },
]
const alignWithTargetId = ref('')
const manualAlignments = ref<Record<string, string>>({})
const lastAlignmentAction = ref<string>()
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
  {
    id: 'release-summary',
    depth: 0,
    rightName: 'release-summary.md',
    rightSize: '3.8 KB',
    rightModified: '2026-06-23 11:40',
    rightPath: 'D:/workspace/right/release-summary.md',
    status: 'Right only',
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
const pendingCopyConfirmation = ref<FileOperationConfirmation>()
const pendingCopyDirection = ref<'Left' | 'Right'>()
const lastCopyAction = ref<string>()
const pendingDangerousOperation = ref<FileOperationConfirmation>()
const pendingDangerousOperationLabel = ref('')
const renamePanelOpen = ref(false)
const renameTargetName = ref('')
const lastFileOperationAction = ref<string>()
const selectedReadonly = ref(false)
const lastMetadataAction = ref<string>()
const excludedRowIds = ref<Set<string>>(new Set())
const lastSelectionAction = ref<string>()
const currentDifferenceIndex = ref(-1)
const lastDifferenceNavigation = ref<string>()
const syncPreviewItems = ref<SyncPreviewItem[]>([])
const pendingSyncSafetyItems = ref<SyncPreviewItem[]>([])
const lastSyncAction = ref<string>()

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
const alignWithCandidates = computed(() =>
  rows.value.filter(
    (row) =>
      row.kind === 'file' &&
      row.id !== selectedRowId.value &&
      (row.status === 'Left only' || row.status === 'Right only'),
  ),
)
const enabledExternalApplications = computed(() =>
  listEnabledExternalApplications(externalApplicationConfigs.value),
)
const differenceRows = computed(() =>
  visibleRows.value.filter((row) => row.status !== 'Same' && !isSuppressed(row)),
)
const visibleRows = computed(() =>
  rows.value.filter(
    (row) =>
      (!row.parentId || expandedDirectoryIds.value.has(row.parentId)) &&
      !excludedRowIds.value.has(row.id) &&
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
  alignWithTargetId.value = ''
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

function openSelectedFileWithExternalApplication(application: ExternalApplicationConfig): void {
  if (!selectedFilePath.value) {
    return
  }

  recordOpenAction(
    createOpenWithAction(selectedFilePath.value, application.name, application.executable),
  )
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

function copySelectedTo(direction: 'Left' | 'Right'): void {
  const row = selectedRow.value

  if (row?.kind !== 'file') {
    return
  }

  const targetPath = direction === 'Left' ? row.leftPath : row.rightPath

  if (!targetPath) {
    return
  }

  pendingCopyDirection.value = direction
  pendingCopyConfirmation.value = createFileOperationConfirmation({
    operation: 'copy',
    paths: [targetPath],
  })
}

function renameSelectedFile(): void {
  const row = selectedRow.value

  if (!row) {
    return
  }

  renamePanelOpen.value = true
  renameTargetName.value = displayName(row)
}

function displayName(row: FolderTreeRow): string {
  return row.leftName ?? row.rightName ?? row.id
}

function alignSelectedFileWithTarget(): void {
  const row = selectedRow.value
  const target = rows.value.find((candidate) => candidate.id === alignWithTargetId.value)

  if (!row || !target) {
    return
  }

  manualAlignments.value = {
    ...manualAlignments.value,
    [row.id]: target.id,
  }
  lastAlignmentAction.value = `${displayName(row)} aligned with ${displayName(target)}`
}

function breakSelectedAlignment(): void {
  const row = selectedRow.value

  if (!row) {
    return
  }

  manualAlignments.value = Object.fromEntries(
    Object.entries(manualAlignments.value).filter(([rowId]) => rowId !== row.id),
  )
  lastAlignmentAction.value = `Alignment cleared for ${displayName(row)}`
}

function confirmFolderCopy(): void {
  const confirmation = pendingCopyConfirmation.value
  const direction = pendingCopyDirection.value

  if (!confirmation || !direction) {
    return
  }

  lastCopyAction.value = `Copied to ${direction} -> ${confirmation.paths[0]} | Status refreshed`
  pendingCopyConfirmation.value = undefined
  pendingCopyDirection.value = undefined
}

function confirmRenameFile(): void {
  if (!renameTargetName.value) {
    return
  }

  lastFileOperationAction.value = `Renamed -> ${renameTargetName.value}`
  renamePanelOpen.value = false
}

function moveSelectedFile(): void {
  const path = selectedFilePath.value

  if (!path) {
    return
  }

  lastFileOperationAction.value = `Move -> ${archivePath(path)}`
}

function deleteSelectedFile(): void {
  const path = selectedFilePath.value

  if (!path) {
    return
  }

  pendingDangerousOperationLabel.value = `Deleted -> ${path}`
  pendingDangerousOperation.value = createFileOperationConfirmation({
    operation: 'delete',
    paths: [path],
  })
}

function confirmDangerousFileOperation(): void {
  if (!pendingDangerousOperation.value) {
    return
  }

  lastFileOperationAction.value = pendingDangerousOperationLabel.value
  pendingDangerousOperation.value = undefined
  pendingDangerousOperationLabel.value = ''
}

function toggleSelectedReadonly(selected: boolean): void {
  if (!selectedFilePath.value) {
    return
  }

  selectedReadonly.value = selected
  lastMetadataAction.value = `Attributes changed -> ${selected ? 'readonly' : 'writable'}`
}

function touchSelectedFile(): void {
  if (!selectedFilePath.value) {
    return
  }

  lastMetadataAction.value = `Touched -> ${selectedFilePath.value}`
}

function excludeSelectedRow(): void {
  const row = selectedRow.value

  if (!row) {
    return
  }

  excludedRowIds.value = new Set([...excludedRowIds.value, row.id])
  selectedRowId.value = undefined
  lastSelectionAction.value = `Excluded -> ${displayName(row)}`
}

function refreshSelectedRow(): void {
  const row = selectedRow.value

  if (!row) {
    return
  }

  lastSelectionAction.value = `Refreshed -> ${displayName(row)}`
}

function previewSyncPlan(): void {
  syncPreviewItems.value = [
    {
      id: 'copy-release-notes',
      action: 'Copy',
      sourcePath: 'D:/workspace/left/release-notes.md',
      targetPath: 'D:/workspace/right/release-notes.md',
      originalSourcePath: 'D:/workspace/left/release-notes.md',
      originalTargetPath: 'D:/workspace/right/release-notes.md',
      detail: 'Left-only item will be copied to the right side.',
    },
    {
      id: 'overwrite-main',
      action: 'Overwrite',
      sourcePath: 'D:/workspace/left/src/main.ts',
      targetPath: 'D:/workspace/right/src/main.ts',
      originalSourcePath: 'D:/workspace/left/src/main.ts',
      originalTargetPath: 'D:/workspace/right/src/main.ts',
      detail: 'Different file will overwrite the target side.',
    },
    {
      id: 'delete-legacy',
      action: 'Delete',
      targetPath: 'D:/workspace/right/archive/legacy.tmp',
      detail: 'Right-only item will be removed.',
    },
    {
      id: 'permission-error',
      action: 'Error',
      targetPath: 'D:/workspace/right/protected/settings.json',
      detail: 'Permission denied',
    },
  ]
}

function markSyncPreviewItemAsLeave(itemId: string): void {
  syncPreviewItems.value = syncPreviewItems.value.map((item) =>
    item.id === itemId
      ? {
          ...item,
          action: 'Leave',
          sourcePath: undefined,
          targetPath: item.targetPath ?? item.originalTargetPath,
          detail: 'No operation will be performed.',
        }
      : item,
  )
}

function reverseSyncPreviewItem(itemId: string): void {
  syncPreviewItems.value = syncPreviewItems.value.map((item) => {
    if (item.id !== itemId) {
      return item
    }

    const sourcePath = item.originalTargetPath ?? item.targetPath
    const targetPath = item.originalSourcePath ?? item.sourcePath

    return {
      ...item,
      action: 'Copy',
      sourcePath,
      targetPath,
      detail: 'Direction reversed by user.',
    }
  })
}

function runSyncPreview(): void {
  const riskyItems = syncPreviewItems.value.filter((item) =>
    ['Delete', 'Overwrite'].includes(item.action),
  )

  if (riskyItems.length > 0) {
    pendingSyncSafetyItems.value = riskyItems

    return
  }

  lastSyncAction.value = `Sync ready -> ${String(syncPreviewItems.value.length)} operations ready`
}

function confirmSyncSafety(): void {
  lastSyncAction.value = `Sync confirmed -> ${String(syncPreviewItems.value.length)} operations ready`
  pendingSyncSafetyItems.value = []
}

function closeSyncPreview(): void {
  syncPreviewItems.value = []
  pendingSyncSafetyItems.value = []
}

function navigateFolderDifference(direction: 'next' | 'previous'): void {
  if (differenceRows.value.length === 0) {
    currentDifferenceIndex.value = -1
    lastDifferenceNavigation.value = 'No folder differences'

    return
  }

  if (direction === 'next') {
    currentDifferenceIndex.value = (currentDifferenceIndex.value + 1) % differenceRows.value.length
  } else {
    currentDifferenceIndex.value =
      (currentDifferenceIndex.value - 1 + differenceRows.value.length) % differenceRows.value.length
  }

  const row = differenceRows.value[currentDifferenceIndex.value]

  selectedRowId.value = row.id
  lastDifferenceNavigation.value = `Difference ${String(currentDifferenceIndex.value + 1)} / ${String(
    differenceRows.value.length,
  )} -> ${displayName(row)}`
}

function archivePath(path: string): string {
  const separatorIndex = Math.max(path.lastIndexOf('/'), path.lastIndexOf('\\'))

  if (separatorIndex < 0) {
    return `archive/${path}`
  }

  return `${path.slice(0, separatorIndex)}/archive/${path.slice(separatorIndex + 1)}`
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
          data-testid="preview-sync-plan"
          @click="previewSyncPlan"
        >
          Preview Sync
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
          v-for="application in enabledExternalApplications"
          :key="application.id"
          size="small"
          secondary
          :data-testid="`open-with-custom-${application.id}`"
          :disabled="!selectedFilePath"
          @click="openSelectedFileWithExternalApplication(application)"
        >
          {{ application.name }}
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
          data-testid="copy-selected-to-left"
          :disabled="!selectedFilePath"
          @click="copySelectedTo('Left')"
        >
          Copy Left
        </NButton>
        <NButton
          size="small"
          secondary
          data-testid="copy-selected-to-right"
          :disabled="!selectedFilePath"
          @click="copySelectedTo('Right')"
        >
          Copy Right
        </NButton>
        <NButton
          size="small"
          secondary
          data-testid="move-selected-file"
          :disabled="!selectedFilePath"
          @click="moveSelectedFile"
        >
          Move
        </NButton>
        <NButton
          size="small"
          secondary
          data-testid="delete-selected-file"
          :disabled="!selectedFilePath"
          @click="deleteSelectedFile"
        >
          Delete
        </NButton>
        <NButton
          size="small"
          secondary
          data-testid="rename-selected-file"
          :disabled="!selectedFilePath"
          @click="renameSelectedFile"
        >
          Rename
        </NButton>
        <NButton
          size="small"
          secondary
          data-testid="exclude-selected-row"
          :disabled="!selectedRowId"
          @click="excludeSelectedRow"
        >
          Exclude
        </NButton>
        <NButton
          size="small"
          secondary
          data-testid="refresh-selected-row"
          :disabled="!selectedRowId"
          @click="refreshSelectedRow"
        >
          Refresh Selection
        </NButton>
        <NButton
          size="small"
          secondary
          data-testid="previous-folder-difference"
          :disabled="differenceRows.length === 0"
          @click="navigateFolderDifference('previous')"
        >
          Previous Difference
        </NButton>
        <NButton
          size="small"
          secondary
          data-testid="next-folder-difference"
          :disabled="differenceRows.length === 0"
          @click="navigateFolderDifference('next')"
        >
          Next Difference
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
      v-if="syncPreviewItems.length > 0"
      class="sync-preview-panel"
      data-testid="sync-preview-panel"
    >
      <header class="sync-preview-header">
        <div>
          <strong>Sync preview</strong>
          <span>{{ syncPreviewItems.length }} operations</span>
        </div>
        <NButton
          size="small"
          secondary
          data-testid="close-sync-preview"
          @click="closeSyncPreview"
        >
          Close
        </NButton>
        <NButton
          size="small"
          type="primary"
          data-testid="run-sync-preview"
          @click="runSyncPreview"
        >
          Run Sync
        </NButton>
      </header>
      <section
        v-if="pendingSyncSafetyItems.length > 0"
        class="sync-safety-confirmation"
        data-testid="sync-safety-confirmation"
      >
        <div>
          <strong>Confirm risky sync actions</strong>
          <span>{{ pendingSyncSafetyItems.length }} overwrite/delete operations need review.</span>
        </div>
        <ul>
          <li
            v-for="item in pendingSyncSafetyItems"
            :key="item.id"
          >
            <strong>{{ item.action }}</strong>
            <span>{{ item.targetPath ?? item.detail }}</span>
          </li>
        </ul>
        <NButton
          size="small"
          type="primary"
          data-testid="confirm-sync-safety"
          @click="confirmSyncSafety"
        >
          Confirm Sync
        </NButton>
      </section>
      <div class="sync-preview-table">
        <div class="sync-preview-row sync-preview-row-head">
          <span>Action</span>
          <span>Source</span>
          <span>Target</span>
          <span>Detail</span>
          <span>Change</span>
        </div>
        <div
          v-for="item in syncPreviewItems"
          :key="item.id"
          class="sync-preview-row"
          :class="`sync-preview-${item.action.toLowerCase()}`"
          :data-preview-id="item.id"
          data-testid="sync-preview-row"
        >
          <strong>{{ item.action }}</strong>
          <span>{{ item.sourcePath ?? '--' }}</span>
          <span>{{ item.targetPath ?? '--' }}</span>
          <span>{{ item.detail }}</span>
          <span class="sync-preview-change-actions">
            <NButton
              size="tiny"
              secondary
              :data-testid="`sync-preview-leave-${item.id}`"
              @click="markSyncPreviewItemAsLeave(item.id)"
            >
              Leave
            </NButton>
            <NButton
              size="tiny"
              secondary
              :disabled="!item.originalSourcePath || !item.originalTargetPath"
              :data-testid="`sync-preview-reverse-${item.id}`"
              @click="reverseSyncPreviewItem(item.id)"
            >
              Reverse
            </NButton>
          </span>
        </div>
      </div>
    </section>

    <section
      v-if="renamePanelOpen"
      class="folder-operation-panel"
      data-testid="folder-rename-panel"
    >
      <input
        v-model="renameTargetName"
        data-testid="rename-target-name"
      />
      <NButton
        size="small"
        type="primary"
        data-testid="confirm-rename-file"
        @click="confirmRenameFile"
      >
        Rename
      </NButton>
    </section>

    <section
      v-if="pendingDangerousOperation"
      class="folder-copy-confirmation"
      data-testid="folder-dangerous-confirmation"
    >
      <strong>{{ pendingDangerousOperation.title }}</strong>
      <span>{{ pendingDangerousOperation.message }}</span>
      <span>{{ pendingDangerousOperation.paths.join(', ') }}</span>
      <NButton
        size="small"
        type="primary"
        data-testid="confirm-dangerous-file-operation"
        @click="confirmDangerousFileOperation"
      >
        {{ pendingDangerousOperation.confirmLabel }}
      </NButton>
    </section>

    <section class="folder-operation-panel">
      <label class="metadata-option">
        <input
          data-testid="toggle-selected-readonly"
          type="checkbox"
          :checked="selectedReadonly"
          :disabled="!selectedFilePath"
          @change="toggleSelectedReadonly(($event.target as HTMLInputElement).checked)"
        />
        <span>Readonly</span>
      </label>
      <NButton
        size="small"
        secondary
        data-testid="touch-selected-file"
        :disabled="!selectedFilePath"
        @click="touchSelectedFile"
      >
        Touch
      </NButton>
    </section>

    <section
      v-if="pendingCopyConfirmation"
      class="folder-copy-confirmation"
      data-testid="folder-copy-confirmation"
    >
      <strong>{{ pendingCopyConfirmation.title }}</strong>
      <span>{{ pendingCopyConfirmation.message }}</span>
      <span>{{ pendingCopyConfirmation.paths.join(', ') }}</span>
      <NButton
        size="small"
        type="primary"
        data-testid="confirm-folder-copy"
        @click="confirmFolderCopy"
      >
        {{ pendingCopyConfirmation.confirmLabel }}
      </NButton>
    </section>

    <section class="manual-alignment-tools">
      <select
        v-model="alignWithTargetId"
        data-testid="align-with-target"
      >
        <option value="">Select target</option>
        <option
          v-for="candidate in alignWithCandidates"
          :key="candidate.id"
          :value="candidate.id"
        >
          {{ displayName(candidate) }}
        </option>
      </select>
      <NButton
        size="small"
        secondary
        data-testid="align-with-selected-file"
        :disabled="!selectedRowId || !alignWithTargetId"
        @click="alignSelectedFileWithTarget"
      >
        Align With
      </NButton>
      <NButton
        size="small"
        secondary
        data-testid="break-selected-alignment"
        :disabled="!selectedRowId"
        @click="breakSelectedAlignment"
      >
        Break Alignment
      </NButton>
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
      v-if="lastAlignmentAction"
      class="folder-action-status"
      data-testid="folder-alignment-action-status"
    >
      {{ lastAlignmentAction }}
    </section>
    <section
      v-if="lastCopyAction"
      class="folder-action-status"
      data-testid="folder-copy-action-status"
    >
      {{ lastCopyAction }}
    </section>
    <section
      v-if="lastFileOperationAction"
      class="folder-action-status"
      data-testid="folder-file-operation-status"
    >
      {{ lastFileOperationAction }}
    </section>
    <section
      v-if="lastMetadataAction"
      class="folder-action-status"
      data-testid="folder-metadata-operation-status"
    >
      {{ lastMetadataAction }}
    </section>
    <section
      v-if="lastSelectionAction"
      class="folder-action-status"
      data-testid="folder-selection-operation-status"
    >
      {{ lastSelectionAction }}
    </section>
    <section
      v-if="lastDifferenceNavigation"
      class="folder-action-status"
      data-testid="folder-difference-navigation-status"
    >
      {{ lastDifferenceNavigation }}
    </section>
    <section
      v-if="lastSyncAction"
      class="folder-action-status"
      data-testid="folder-sync-action-status"
    >
      {{ lastSyncAction }}
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
.display-filters,
.manual-alignment-tools {
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

.manual-alignment-tools {
  align-items: center;
}

.manual-alignment-tools select {
  min-width: 220px;
  height: 28px;
  padding: 0 8px;
  border: 1px solid var(--app-border);
  border-radius: 6px;
  background: var(--app-surface);
  color: var(--app-text);
  font-size: 12px;
}

.folder-copy-confirmation {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px 10px;
  border: 1px solid var(--app-border);
  border-radius: 6px;
  background: var(--app-surface-muted);
  color: var(--app-text-muted);
  font-size: 12px;
}

.folder-copy-confirmation strong {
  color: var(--app-text);
}

.folder-operation-panel {
  display: flex;
  align-items: center;
  gap: 10px;
}

.folder-operation-panel input {
  width: 260px;
  height: 28px;
  padding: 0 8px;
  border: 1px solid var(--app-border);
  border-radius: 6px;
  background: var(--app-surface);
  color: var(--app-text);
  font-size: 12px;
}

.folder-operation-panel .metadata-option {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  color: var(--app-text-muted);
  font-size: 12px;
}

.folder-operation-panel .metadata-option input {
  width: auto;
  height: auto;
  padding: 0;
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

.sync-preview-panel {
  display: grid;
  gap: 8px;
  padding: 10px;
  overflow: hidden;
  border: 1px solid var(--app-border);
  border-radius: 8px;
  background: var(--app-surface);
}

.sync-preview-header {
  display: flex;
  align-items: center;
  justify-content: end;
  gap: 12px;
}

.sync-preview-header div {
  display: grid;
  gap: 2px;
  margin-right: auto;
}

.sync-preview-header strong {
  font-size: 13px;
}

.sync-preview-header span {
  color: var(--app-text-muted);
  font-size: 12px;
}

.sync-preview-table {
  display: grid;
  overflow: auto;
  border: 1px solid var(--app-border);
  border-radius: 6px;
}

.sync-safety-confirmation {
  display: grid;
  grid-template-columns: minmax(180px, 0.8fr) minmax(260px, 1fr) auto;
  align-items: center;
  gap: 10px;
  padding: 9px 10px;
  border: 1px solid var(--diff-deleted-fg);
  border-radius: 6px;
  background: var(--app-surface-muted);
}

.sync-safety-confirmation div {
  display: grid;
  gap: 2px;
}

.sync-safety-confirmation strong {
  font-size: 12px;
}

.sync-safety-confirmation span {
  color: var(--app-text-muted);
  font-size: 12px;
}

.sync-safety-confirmation ul {
  display: grid;
  gap: 4px;
  min-width: 0;
  margin: 0;
  padding: 0;
  list-style: none;
}

.sync-safety-confirmation li {
  display: grid;
  grid-template-columns: 76px minmax(0, 1fr);
  gap: 8px;
  min-width: 0;
}

.sync-safety-confirmation li span {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.sync-preview-row {
  display: grid;
  grid-template-columns:
    104px minmax(180px, 1fr) minmax(180px, 1fr) minmax(160px, 0.8fr)
    150px;
  min-width: 1010px;
  border-bottom: 1px solid var(--app-border);
  color: var(--app-text);
  font-size: 12px;
}

.sync-preview-row:last-child {
  border-bottom: 0;
}

.sync-preview-row span,
.sync-preview-row strong {
  min-width: 0;
  padding: 8px 10px;
  overflow: hidden;
  border-right: 1px solid var(--app-border);
  text-overflow: ellipsis;
  white-space: nowrap;
}

.sync-preview-row span:last-child {
  border-right: 0;
}

.sync-preview-row-head {
  background: var(--app-surface-muted);
  color: var(--app-text-muted);
  font-weight: 700;
}

.sync-preview-copy strong {
  color: var(--diff-added-fg);
}

.sync-preview-overwrite strong {
  color: var(--diff-modified-fg);
}

.sync-preview-delete strong,
.sync-preview-error strong {
  color: var(--diff-deleted-fg);
}

.sync-preview-leave strong {
  color: var(--app-text-muted);
}

.sync-preview-change-actions {
  display: inline-flex;
  align-items: center;
  gap: 6px;
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
