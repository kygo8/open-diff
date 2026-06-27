<script setup lang="ts">
import { computed, ref } from 'vue'

type SyncStrategy = 'updateRight' | 'updateLeft' | 'updateBoth' | 'mirrorRight' | 'mirrorLeft'

interface SyncStrategyOption {
  value: SyncStrategy
  label: string
}

interface SyncPreviewRow {
  id: string
  action: 'Copy' | 'Delete' | 'Leave'
  sourcePath?: string
  targetPath?: string
  detail: string
}

const strategyOptions: SyncStrategyOption[] = [
  { value: 'updateRight', label: 'Update Right' },
  { value: 'updateLeft', label: 'Update Left' },
  { value: 'updateBoth', label: 'Update Both' },
  { value: 'mirrorRight', label: 'Mirror to Right' },
  { value: 'mirrorLeft', label: 'Mirror to Left' },
]
const leftPath = ref('D:/workspace/left')
const rightPath = ref('D:/workspace/right')
const selectedStrategy = ref<SyncStrategy>('updateBoth')
const previewRows = ref<SyncPreviewRow[]>([])
const completedOperations = ref(0)
const syncLogs = ref<string[]>([])

const selectedStrategyLabel = computed(
  () =>
    strategyOptions.find((option) => option.value === selectedStrategy.value)?.label ??
    'Update Both',
)
const canRunSync = computed(() => previewRows.value.length > 0)

function buildPreviewRows(): SyncPreviewRow[] {
  const mirrorMode =
    selectedStrategy.value === 'mirrorRight' || selectedStrategy.value === 'mirrorLeft'
  const sourceRoot = selectedStrategy.value === 'mirrorLeft' ? rightPath.value : leftPath.value
  const targetRoot = selectedStrategy.value === 'mirrorLeft' ? leftPath.value : rightPath.value

  return [
    {
      id: 'copy-app',
      action: 'Copy',
      sourcePath: `${sourceRoot}/package/app.exe`,
      targetPath: `${targetRoot}/package/app.exe`,
      detail: `${selectedStrategyLabel.value} copies the newer application file.`,
    },
    {
      id: 'copy-config',
      action: 'Copy',
      sourcePath: `${sourceRoot}/package/app.config`,
      targetPath: `${targetRoot}/package/app.config`,
      detail: `${selectedStrategyLabel.value} updates configuration.`,
    },
    {
      id: 'delete-old',
      action: mirrorMode ? 'Delete' : 'Leave',
      targetPath: `${targetRoot}/prod/old.dll`,
      detail: mirrorMode
        ? `${selectedStrategyLabel.value} removes target-only files.`
        : 'No deletion is planned for update mode.',
    },
  ]
}

function previewSync(): void {
  previewRows.value = buildPreviewRows()
  completedOperations.value = 0
  syncLogs.value = []
}

function runSync(): void {
  if (!canRunSync.value) {
    return
  }

  completedOperations.value = previewRows.value.length
  syncLogs.value = previewRows.value.map((row) => {
    if (row.action === 'Delete') {
      return 'Deleted prod/old.dll'
    }

    if (row.action === 'Leave') {
      return 'Left prod/old.dll unchanged'
    }

    return row.id === 'copy-app' ? 'Copied package/app.exe' : 'Copied package/app.config'
  })
}
</script>

<template>
  <section class="folder-sync-view">
    <header class="folder-sync-header">
      <div>
        <p class="eyebrow">Folder Sync</p>
        <h1>Folder Sync</h1>
      </div>
      <div class="sync-progress">
        <strong>{{ completedOperations }} / {{ previewRows.length }}</strong>
        <span>Completed</span>
      </div>
    </header>

    <section class="sync-settings">
      <label>
        <span>Left folder</span>
        <input
          v-model="leftPath"
          data-testid="folder-sync-left-path"
        />
      </label>
      <label>
        <span>Right folder</span>
        <input
          v-model="rightPath"
          data-testid="folder-sync-right-path"
        />
      </label>
      <label>
        <span>Strategy</span>
        <select
          v-model="selectedStrategy"
          data-testid="folder-sync-strategy"
        >
          <option
            v-for="option in strategyOptions"
            :key="option.value"
            :value="option.value"
          >
            {{ option.label }}
          </option>
        </select>
      </label>
      <div class="sync-setting-actions">
        <NButton
          size="small"
          secondary
          data-testid="folder-sync-preview"
          @click="previewSync"
        >
          Preview
        </NButton>
        <NButton
          size="small"
          type="primary"
          data-testid="folder-sync-run"
          :disabled="!canRunSync"
          @click="runSync"
        >
          Run Sync
        </NButton>
      </div>
    </section>

    <section
      v-if="previewRows.length > 0"
      class="sync-preview"
      data-testid="folder-sync-preview-panel"
    >
      <header>
        <strong>{{ selectedStrategyLabel }}</strong>
        <span>{{ leftPath }} -> {{ rightPath }}</span>
      </header>
      <div class="sync-preview-table">
        <div class="sync-preview-row sync-preview-head">
          <span>Action</span>
          <span>Source</span>
          <span>Target</span>
          <span>Detail</span>
        </div>
        <div
          v-for="row in previewRows"
          :key="row.id"
          class="sync-preview-row"
        >
          <strong>{{ row.action }}</strong>
          <span>{{ row.sourcePath ?? '--' }}</span>
          <span>{{ row.targetPath ?? '--' }}</span>
          <span>{{ row.detail }}</span>
        </div>
      </div>
    </section>

    <section
      v-if="completedOperations > 0"
      class="sync-run-status"
      data-testid="folder-sync-run-status"
    >
      <strong>Completed {{ completedOperations }} / {{ previewRows.length }}</strong>
      <ul>
        <li
          v-for="log in syncLogs"
          :key="log"
        >
          {{ log }}
        </li>
      </ul>
    </section>
  </section>
</template>

<style scoped>
.folder-sync-view {
  display: grid;
  gap: 14px;
  height: 100%;
  padding: 16px;
  overflow: auto;
}

.folder-sync-header {
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

h1 {
  margin: 0;
  font-size: 22px;
  line-height: 1.2;
}

.sync-progress {
  display: grid;
  min-width: 112px;
  padding: 10px 12px;
  border: 1px solid var(--app-border);
  border-radius: 8px;
  background: var(--app-surface);
  text-align: right;
}

.sync-progress strong {
  font-size: 18px;
  line-height: 1;
}

.sync-progress span {
  color: var(--app-text-muted);
  font-size: 12px;
}

.sync-settings {
  display: grid;
  grid-template-columns: minmax(180px, 1fr) minmax(180px, 1fr) 180px auto;
  align-items: end;
  gap: 10px;
  padding: 12px;
  border: 1px solid var(--app-border);
  border-radius: 8px;
  background: var(--app-surface);
}

.sync-settings label {
  display: grid;
  gap: 5px;
  min-width: 0;
}

.sync-settings span {
  color: var(--app-text-muted);
  font-size: 12px;
}

.sync-settings input,
.sync-settings select {
  width: 100%;
  height: 32px;
  padding: 0 9px;
  border: 1px solid var(--app-border);
  border-radius: 6px;
  background: var(--app-bg);
  color: var(--app-text);
  font-size: 13px;
}

.sync-setting-actions {
  display: flex;
  gap: 8px;
}

.sync-preview,
.sync-run-status {
  display: grid;
  gap: 8px;
  padding: 10px;
  border: 1px solid var(--app-border);
  border-radius: 8px;
  background: var(--app-surface);
}

.sync-preview header {
  display: grid;
  gap: 2px;
}

.sync-preview header strong,
.sync-run-status strong {
  font-size: 13px;
}

.sync-preview header span {
  color: var(--app-text-muted);
  font-size: 12px;
}

.sync-preview-table {
  display: grid;
  overflow: auto;
  border: 1px solid var(--app-border);
  border-radius: 6px;
}

.sync-preview-row {
  display: grid;
  grid-template-columns: 96px minmax(190px, 1fr) minmax(190px, 1fr) minmax(180px, 0.8fr);
  min-width: 860px;
  border-bottom: 1px solid var(--app-border);
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

.sync-preview-head {
  background: var(--app-surface-muted);
  color: var(--app-text-muted);
  font-weight: 700;
}

.sync-run-status ul {
  display: grid;
  gap: 5px;
  margin: 0;
  padding-left: 18px;
  color: var(--app-text-muted);
  font-size: 12px;
}

@media (width <= 860px) {
  .folder-sync-header,
  .sync-settings {
    grid-template-columns: 1fr;
  }

  .folder-sync-header {
    display: grid;
  }

  .sync-progress {
    text-align: left;
  }
}
</style>
