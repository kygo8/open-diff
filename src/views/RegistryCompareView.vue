<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { compareRegistryExports, readTextFile } from '@/api/diff'
import type {
  RegistryCompareResponse,
  RegistryDiffStatus,
  RegistryKeyNode,
  RegistryValueRow,
  RegistryValueSide,
} from '@/types/diff'
import WorkbenchShell from '@/components/workbench/WorkbenchShell.vue'
import WorkbenchInspector from '@/components/workbench/WorkbenchInspector.vue'
import { useSessionLaunchStore } from '@/stores/sessionLaunch'

interface FlatRegistryKeyNode extends RegistryKeyNode {
  depth: number
}

const defaultRegistryTree: RegistryKeyNode[] = [
  {
    path: 'HKCU/Software/OpenDiff',
    label: 'OpenDiff',
    status: 'modified',
    values: [
      {
        keyPath: 'HKCU/Software/OpenDiff',
        name: 'Theme',
        status: 'modified',
        left: { kind: 'REG_SZ', data: 'dark' },
        right: { kind: 'REG_SZ', data: 'light' },
      },
      {
        keyPath: 'HKCU/Software/OpenDiff',
        name: 'AutoSave',
        status: 'unchanged',
        left: { kind: 'REG_DWORD', data: '1' },
        right: { kind: 'REG_DWORD', data: '1' },
      },
      {
        keyPath: 'HKCU/Software/OpenDiff',
        name: 'CompareMode',
        status: 'unchanged',
        left: { kind: 'REG_SZ', data: 'SideBySide' },
        right: { kind: 'REG_SZ', data: 'SideBySide' },
      },
      {
        keyPath: 'HKCU/Software/OpenDiff',
        name: 'RecentLimit',
        status: 'modified',
        left: { kind: 'REG_DWORD', data: '10' },
        right: { kind: 'REG_DWORD', data: '20' },
      },
    ],
    children: [
      {
        path: 'HKCU/Software/OpenDiff/Editor',
        label: 'Editor',
        status: 'added',
        values: [
          {
            keyPath: 'HKCU/Software/OpenDiff/Editor',
            name: 'FontSize',
            status: 'added',
            right: { kind: 'REG_DWORD', data: '14' },
          },
        ],
        children: [],
      },
      {
        path: 'HKCU/Software/OpenDiff/Legacy',
        label: 'Legacy',
        status: 'removed',
        values: [
          {
            keyPath: 'HKCU/Software/OpenDiff/Legacy',
            name: 'Enabled',
            status: 'removed',
            left: { kind: 'REG_DWORD', data: '0' },
          },
        ],
        children: [],
      },
    ],
  },
]

const registryStatuses: RegistryDiffStatus[] = ['added', 'removed', 'modified', 'unchanged']
const defaultRegistrySummary: Record<RegistryDiffStatus, number> = {
  added: 1,
  removed: 1,
  modified: 2,
  unchanged: 2,
}
const defaultLeftExport = `Windows Registry Editor Version 5.00

[HKEY_CURRENT_USER\\Software\\OpenDiff]
"Theme"="dark"
"AutoSave"=dword:00000001
`
const defaultRightExport = `Windows Registry Editor Version 5.00

[HKEY_CURRENT_USER\\Software\\OpenDiff]
"Theme"="light"
"AutoSave"=dword:00000001
`
const leftExport = ref(defaultLeftExport)
const rightExport = ref(defaultRightExport)
const sessionLaunch = useSessionLaunchStore()
const leftName = ref('left.reg')
const rightName = ref('right.reg')
const registryTree = ref<RegistryKeyNode[]>(defaultRegistryTree)
const registrySummaryOverride = ref<Record<RegistryDiffStatus, number> | null>(
  defaultRegistrySummary,
)
const loading = ref(false)
const error = ref('')

onMounted(() => {
  const launch = sessionLaunch.consumeLaunch('/compare/registry')

  if (!launch) {
    return
  }

  if (launch.locations.left?.displayName) {
    leftName.value = launch.locations.left.displayName
  }

  if (launch.locations.right?.displayName) {
    rightName.value = launch.locations.right.displayName
  }

  if (launch.autoRun && launch.locations.left?.uri && launch.locations.right?.uri) {
    void loadLaunchRegistryExports(launch.locations.left.uri, launch.locations.right.uri)
  }
})
const flatRegistryKeys = computed<FlatRegistryKeyNode[]>(() =>
  flattenRegistryKeys(registryTree.value),
)
const allRegistryValues = computed<RegistryValueRow[]>(() =>
  flatRegistryKeys.value.flatMap((key) => key.values),
)
const registrySummary = computed<Record<RegistryDiffStatus, number>>(() => {
  if (registrySummaryOverride.value) {
    return registrySummaryOverride.value
  }

  const initial: Record<RegistryDiffStatus, number> = {
    added: 0,
    removed: 0,
    modified: 0,
    unchanged: 0,
  }

  for (const value of allRegistryValues.value) {
    initial[value.status] += 1
  }

  return initial
})

function flattenRegistryKeys(nodes: RegistryKeyNode[], depth = 0): FlatRegistryKeyNode[] {
  return nodes.flatMap((node) => [
    { ...node, depth },
    ...flattenRegistryKeys(node.children, depth + 1),
  ])
}

function statusLabel(status: RegistryDiffStatus): string {
  const labels: Record<RegistryDiffStatus, string> = {
    added: 'Added',
    removed: 'Removed',
    modified: 'Modified',
    unchanged: 'Unchanged',
  }

  return labels[status]
}

function registryValueText(value?: RegistryValueSide): string {
  if (!value) {
    return '--'
  }

  return `${value.kind} ${value.data}`
}

function applyRegistryResult(result: RegistryCompareResponse): void {
  leftName.value = result.leftName
  rightName.value = result.rightName
  registryTree.value = result.tree
  registrySummaryOverride.value = result.summary
}

async function runRegistryCompare(): Promise<void> {
  loading.value = true
  error.value = ''
  try {
    const result = await compareRegistryExports({
      left: leftExport.value,
      right: rightExport.value,
      leftName: leftName.value,
      rightName: rightName.value,
    })

    applyRegistryResult(result)
  } catch (event) {
    error.value = String(event)
  } finally {
    loading.value = false
  }
}

async function loadLaunchRegistryExports(leftPath: string, rightPath: string): Promise<void> {
  loading.value = true
  error.value = ''

  try {
    const [leftFile, rightFile] = await Promise.all([
      readTextFile(leftPath),
      readTextFile(rightPath),
    ])

    leftExport.value = leftFile.text
    rightExport.value = rightFile.text
    leftName.value = fileNameFromPath(leftFile.path)
    rightName.value = fileNameFromPath(rightFile.path)
    await runRegistryCompare()
  } catch (event) {
    error.value = String(event)
    loading.value = false
  }
}

function fileNameFromPath(path: string): string {
  return path.replaceAll('\\', '/').split('/').filter(Boolean).at(-1) ?? path
}
</script>

<template>
  <WorkbenchShell
    :title="$t('ui.registryCompare')"
    eyebrow="Registry"
    :subtitle="`${leftName} -> ${rightName}`"
    inspector-label="Registry compare inspector"
  >
    <section class="registry-compare-view">
      <header class="registry-header">
        <div>
          <p class="eyebrow">{{ $t('ui.registryCompare') }}</p>
          <h1>{{ $t('ui.registryCompare') }}</h1>
        </div>
        <div class="registry-source-pair">
          <span>{{ leftName }}</span>
          <span>{{ rightName }}</span>
        </div>
      </header>

      <section class="registry-input-panel">
        <label>
          <span>{{ $t('ui.leftCurrentExport') }}</span>
          <textarea
            v-model="leftExport"
            data-testid="registry-left-export"
          />
        </label>
        <label>
          <span>{{ $t('ui.rightUpdatedExport') }}</span>
          <textarea
            v-model="rightExport"
            data-testid="registry-right-export"
          />
        </label>
        <button
          type="button"
          data-testid="run-registry-compare"
          :disabled="loading"
          @click="runRegistryCompare"
        >
          {{ $t('ui.runDiff') }}
        </button>
      </section>

      <p
        v-if="error"
        class="registry-error"
        data-testid="registry-compare-error"
      >
        {{ error }}
      </p>

      <section class="registry-summary-grid">
        <article
          v-for="status in registryStatuses"
          :key="status"
          class="registry-summary-item"
          :class="`status-${status}`"
        >
          <strong :data-testid="`registry-summary-${status}`">
            {{ registrySummary[status] }}
          </strong>
          <span>{{ statusLabel(status) }}</span>
        </article>
      </section>

      <section class="registry-layout">
        <aside class="registry-key-pane">
          <header>
            <strong>{{ $t('ui.keys') }}</strong>
            <span>{{ flatRegistryKeys.length }} keys</span>
          </header>
          <div class="registry-key-list">
            <button
              v-for="key in flatRegistryKeys"
              :key="key.path"
              type="button"
              class="registry-key-row"
              :class="`status-${key.status}`"
              :style="{ paddingLeft: `${10 + key.depth * 18}px` }"
              :data-testid="`registry-key-${key.path}`"
            >
              <span>{{ key.label }}</span>
              <small>{{ key.path }}</small>
              <strong>{{ statusLabel(key.status) }}</strong>
            </button>
          </div>
        </aside>

        <section class="registry-value-pane">
          <header>
            <strong>{{ $t('ui.values') }}</strong>
            <span>{{ allRegistryValues.length }} values</span>
          </header>
          <div class="registry-value-table">
            <div class="registry-value-row registry-value-head">
              <span>{{ $t('ui.key') }}</span>
              <span>{{ $t('ui.name') }}</span>
              <span>{{ $t('ui.left') }}</span>
              <span>{{ $t('ui.right') }}</span>
              <span>{{ $t('ui.status') }}</span>
            </div>
            <div
              v-for="value in allRegistryValues"
              :key="`${value.keyPath}::${value.name}`"
              class="registry-value-row"
              :class="`status-${value.status}`"
              :data-testid="`registry-value-${value.keyPath}::${value.name}`"
            >
              <span>{{ value.keyPath }}</span>
              <strong>{{ value.name }}</strong>
              <code>{{ registryValueText(value.left) }}</code>
              <code>{{ registryValueText(value.right) }}</code>
              <em>{{ statusLabel(value.status) }}</em>
            </div>
          </div>
        </section>
      </section>
    </section>

    <template #inspector>
      <WorkbenchInspector>
        <section class="workbench-inspector-section">
          <h2>{{ $t('ui.values') }}</h2>
          <dl>
            <div>
              <dt>{{ $t('ui.add') }}</dt>
              <dd data-tone="added">{{ registrySummary.added }}</dd>
            </div>
            <div>
              <dt>{{ $t('ui.delete') }}</dt>
              <dd data-tone="deleted">{{ registrySummary.removed }}</dd>
            </div>
            <div>
              <dt>{{ $t('ui.modified') }}</dt>
              <dd data-tone="modified">{{ registrySummary.modified }}</dd>
            </div>
            <div>
              <dt>{{ $t('ui.keys') }}</dt>
              <dd>{{ flatRegistryKeys.length }}</dd>
            </div>
          </dl>
        </section>
      </WorkbenchInspector>
    </template>
  </WorkbenchShell>
</template>
<style scoped>
.registry-compare-view {
  display: grid;
  gap: 14px;
  height: 100%;
  padding: 16px;
  overflow: auto;
}

.registry-header {
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

.registry-source-pair {
  display: grid;
  gap: 4px;
  min-width: 220px;
  padding: 10px 12px;
  border: 1px solid var(--app-border);
  border-radius: 8px;
  background: var(--app-surface);
  color: var(--app-text-muted);
  font-size: 12px;
  text-align: right;
}

.registry-input-panel {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(0, 1fr) auto;
  align-items: end;
  gap: 10px;
  padding: 10px;
  border: 1px solid var(--app-border);
  border-radius: 8px;
  background: var(--app-surface);
}

.registry-input-panel label {
  display: grid;
  gap: 5px;
  min-width: 0;
}

.registry-input-panel span {
  color: var(--app-text-muted);
  font-size: 12px;
}

.registry-input-panel textarea {
  min-width: 0;
  min-height: 96px;
  padding: 8px;
  font-family: var(--font-mono);
  resize: vertical;
}

.registry-input-panel textarea,
.registry-input-panel button {
  border: 1px solid var(--app-border);
  border-radius: 6px;
  background: var(--app-bg);
  color: var(--app-text);
  font: inherit;
  font-size: 12px;
}

.registry-input-panel button {
  min-height: 32px;
  padding: 0 12px;
}

.registry-input-panel button:hover {
  border-color: var(--app-accent);
}

.registry-input-panel button:disabled {
  opacity: 0.65;
}

.registry-error {
  margin: 0;
  padding: 8px 10px;
  border: 1px solid var(--app-danger);
  border-radius: 6px;
  background: var(--diff-deleted-bg);
  color: var(--diff-deleted-fg);
  font-size: 12px;
}

.registry-summary-grid {
  display: grid;
  grid-template-columns: repeat(4, minmax(120px, 1fr));
  gap: 10px;
}

.registry-summary-item {
  display: grid;
  gap: 4px;
  padding: 10px 12px;
  border: 1px solid var(--app-border);
  border-radius: 8px;
  background: var(--app-surface);
}

.registry-summary-item strong {
  font-size: 18px;
  line-height: 1;
}

.registry-summary-item span {
  color: var(--app-text-muted);
  font-size: 12px;
}

.registry-layout {
  display: grid;
  grid-template-columns: minmax(280px, 360px) minmax(0, 1fr);
  gap: 12px;
  min-height: 0;
}

.registry-key-pane,
.registry-value-pane {
  display: grid;
  grid-template-rows: auto minmax(0, 1fr);
  gap: 8px;
  min-width: 0;
  padding: 10px;
  border: 1px solid var(--app-border);
  border-radius: 8px;
  background: var(--app-surface);
}

.registry-key-pane header,
.registry-value-pane header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.registry-key-pane header span,
.registry-value-pane header span {
  color: var(--app-text-muted);
  font-size: 12px;
}

.registry-key-list {
  display: grid;
  align-content: start;
  overflow: auto;
  border: 1px solid var(--app-border);
  border-radius: 6px;
  background: var(--app-bg);
}

.registry-key-row {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  gap: 2px 8px;
  min-height: 46px;
  padding: 7px 8px 7px calc(10px + var(--key-depth) * 18px);
  border: 0;
  border-bottom: 1px solid var(--app-border);
  background: transparent;
  color: var(--app-text);
  text-align: left;
}

.registry-key-row:last-child {
  border-bottom: 0;
}

.registry-key-row small {
  grid-column: 1 / -1;
  min-width: 0;
  overflow: hidden;
  color: var(--app-text-muted);
  font-family: var(--font-mono);
  font-size: 11px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.registry-key-row strong {
  color: var(--app-text-muted);
  font-size: 11px;
}

.registry-value-table {
  display: grid;
  overflow: auto;
  border: 1px solid var(--app-border);
  border-radius: 6px;
  background: var(--app-bg);
}

.registry-value-row {
  display: grid;
  grid-template-columns:
    minmax(220px, 1.35fr) minmax(112px, 0.7fr) minmax(150px, 1fr)
    minmax(150px, 1fr) 92px;
  min-width: 760px;
  border-bottom: 1px solid var(--app-border);
  font-size: 12px;
}

.registry-value-row:last-child {
  border-bottom: 0;
}

.registry-value-row > * {
  min-width: 0;
  margin: 0;
  padding: 8px 10px;
  overflow: hidden;
  border-right: 1px solid var(--app-border);
  font-style: normal;
  line-height: 18px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.registry-value-row > *:last-child {
  border-right: 0;
}

.registry-value-row code {
  font-family: var(--font-mono);
}

.registry-value-head {
  background: var(--app-surface-muted);
  color: var(--app-text-muted);
  font-weight: 700;
}

.status-added {
  background: var(--diff-added-bg);
}

.status-added strong,
.status-added em,
.status-added.registry-summary-item {
  color: var(--diff-added-fg);
}

.status-removed {
  background: var(--diff-deleted-bg);
}

.status-removed strong,
.status-removed em,
.status-removed.registry-summary-item {
  color: var(--diff-deleted-fg);
}

.status-modified {
  background: var(--diff-modified-bg);
}

.status-modified strong,
.status-modified em,
.status-modified.registry-summary-item {
  color: var(--diff-modified-fg);
}

.status-unchanged em {
  color: var(--app-text-muted);
}

@media (width <= 820px) {
  .registry-header,
  .registry-input-panel,
  .registry-layout,
  .registry-summary-grid {
    grid-template-columns: 1fr;
  }

  .registry-header {
    display: grid;
  }

  .registry-source-pair {
    text-align: left;
  }
}
</style>
