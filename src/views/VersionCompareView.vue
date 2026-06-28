<script setup lang="ts">
import { computed } from 'vue'

type VersionFieldStatus = 'added' | 'removed' | 'modified' | 'unchanged'

interface VersionSideSummary {
  name: string
  fileType: string
  targetOs: string
  fileVersion: string
  productVersion: string
}

interface VersionFieldRow {
  field: string
  group: 'Fixed Info' | 'String Info'
  left?: string
  right?: string
  status: VersionFieldStatus
}

const versionStatuses: VersionFieldStatus[] = ['added', 'removed', 'modified', 'unchanged']
const leftVersion: VersionSideSummary = {
  name: 'left-app.exe',
  fileType: 'Application',
  targetOs: 'Windows 32-bit',
  fileVersion: '1.4.2.0',
  productVersion: '1.5.0.0',
}
const rightVersion: VersionSideSummary = {
  name: 'right-app.exe',
  fileType: 'Application',
  targetOs: 'Windows 32-bit',
  fileVersion: '1.5.0.0',
  productVersion: '1.5.0.0',
}
const versionFields: VersionFieldRow[] = [
  {
    field: 'FileVersion',
    group: 'Fixed Info',
    left: '1.4.2.0',
    right: '1.5.0.0',
    status: 'modified',
  },
  {
    field: 'ProductVersion',
    group: 'Fixed Info',
    left: '1.5.0.0',
    right: '1.5.0.0',
    status: 'unchanged',
  },
  {
    field: 'FileType',
    group: 'Fixed Info',
    left: 'Application',
    right: 'Application',
    status: 'unchanged',
  },
  {
    field: 'FileDescription',
    group: 'String Info',
    left: 'Open Diff Desktop',
    right: 'Open Diff Desktop Preview',
    status: 'modified',
  },
  {
    field: 'CompanyName',
    group: 'String Info',
    right: 'Open Diff Labs',
    status: 'added',
  },
  {
    field: 'LegalCopyright',
    group: 'String Info',
    left: 'Copyright 2025',
    status: 'removed',
  },
]

const versionSummary = computed<Record<VersionFieldStatus, number>>(() => {
  const summary: Record<VersionFieldStatus, number> = {
    added: 0,
    removed: 0,
    modified: 0,
    unchanged: 0,
  }

  for (const field of versionFields) {
    summary[field.status] += 1
  }

  return summary
})

function statusLabel(status: VersionFieldStatus): string {
  const labels: Record<VersionFieldStatus, string> = {
    added: 'Added',
    removed: 'Removed',
    modified: 'Modified',
    unchanged: 'Unchanged',
  }

  return labels[status]
}

function valueText(value?: string): string {
  return value ?? '--'
}
</script>

<template>
  <section class="version-compare-view">
    <header class="version-header">
      <div>
        <p class="eyebrow">Version Compare</p>
        <h1>Version Compare</h1>
      </div>
      <div class="version-source-pair">
        <span>Left: {{ leftVersion.name }}</span>
        <span>Right: {{ rightVersion.name }}</span>
      </div>
    </header>

    <section class="version-summary-grid">
      <article
        v-for="status in versionStatuses"
        :key="status"
        class="version-summary-item"
        :class="`status-${status}`"
      >
        <strong :data-testid="`version-summary-${status}`">{{ versionSummary[status] }}</strong>
        <span>{{ statusLabel(status) }}</span>
      </article>
    </section>

    <section class="version-side-grid">
      <article class="version-side">
        <header>
          <strong>{{ leftVersion.name }}</strong>
          <span>{{ leftVersion.fileType }}</span>
        </header>
        <dl>
          <div>
            <dt>File Version</dt>
            <dd>{{ leftVersion.fileVersion }}</dd>
          </div>
          <div>
            <dt>Product Version</dt>
            <dd>{{ leftVersion.productVersion }}</dd>
          </div>
          <div>
            <dt>Target OS</dt>
            <dd>{{ leftVersion.targetOs }}</dd>
          </div>
        </dl>
      </article>

      <article class="version-side">
        <header>
          <strong>{{ rightVersion.name }}</strong>
          <span>{{ rightVersion.fileType }}</span>
        </header>
        <dl>
          <div>
            <dt>File Version</dt>
            <dd>{{ rightVersion.fileVersion }}</dd>
          </div>
          <div>
            <dt>Product Version</dt>
            <dd>{{ rightVersion.productVersion }}</dd>
          </div>
          <div>
            <dt>Target OS</dt>
            <dd>{{ rightVersion.targetOs }}</dd>
          </div>
        </dl>
      </article>
    </section>

    <section class="version-report-panel">
      <header>
        <strong>Version Field Report</strong>
        <span>{{ versionFields.length }} fields</span>
      </header>
      <div
        class="version-report-table"
        data-testid="version-report-table"
      >
        <div class="version-field-row version-field-head">
          <span>Group</span>
          <span>Field</span>
          <span>Left</span>
          <span>Right</span>
          <span>Status</span>
        </div>
        <div
          v-for="row in versionFields"
          :key="row.field"
          class="version-field-row"
          :class="`status-${row.status}`"
          :data-testid="`version-field-${row.field}`"
        >
          <span>{{ row.group }}</span>
          <strong>{{ row.field }}</strong>
          <code>{{ valueText(row.left) }}</code>
          <code>{{ valueText(row.right) }}</code>
          <em>{{ statusLabel(row.status) }}</em>
        </div>
      </div>
    </section>
  </section>
</template>

<style scoped>
.version-compare-view {
  display: grid;
  gap: 14px;
  height: 100%;
  padding: 16px;
  overflow: auto;
}

.version-header {
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

.version-source-pair {
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

.version-summary-grid,
.version-side-grid {
  display: grid;
  gap: 10px;
}

.version-summary-grid {
  grid-template-columns: repeat(4, minmax(120px, 1fr));
}

.version-side-grid {
  grid-template-columns: repeat(2, minmax(0, 1fr));
}

.version-summary-item,
.version-side,
.version-report-panel {
  display: grid;
  gap: 8px;
  padding: 10px 12px;
  border: 1px solid var(--app-border);
  border-radius: 8px;
  background: var(--app-surface);
}

.version-summary-item {
  gap: 4px;
}

.version-summary-item strong {
  font-size: 18px;
  line-height: 1;
}

.version-summary-item span,
.version-side header span,
.version-report-panel header span {
  color: var(--app-text-muted);
  font-size: 12px;
}

.version-side header,
.version-report-panel header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.version-side dl {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 8px;
  margin: 0;
}

.version-side dl div {
  display: grid;
  gap: 4px;
  min-width: 0;
  padding: 8px;
  border: 1px solid var(--app-border);
  border-radius: 6px;
  background: var(--app-bg);
}

.version-side dt {
  color: var(--app-text-muted);
  font-size: 11px;
}

.version-side dd {
  min-width: 0;
  margin: 0;
  overflow: hidden;
  font-size: 12px;
  font-weight: 700;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.version-report-table {
  display: grid;
  overflow: auto;
  border: 1px solid var(--app-border);
  border-radius: 6px;
  background: var(--app-bg);
}

.version-field-row {
  display: grid;
  grid-template-columns:
    120px 150px minmax(180px, 1fr) minmax(180px, 1fr)
    98px;
  min-width: 760px;
  border-bottom: 1px solid var(--app-border);
  font-size: 12px;
}

.version-field-row:last-child {
  border-bottom: 0;
}

.version-field-row > * {
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

.version-field-row > *:last-child {
  border-right: 0;
}

.version-field-row code {
  font-family: var(--font-mono);
}

.version-field-head {
  background: var(--app-surface-muted);
  color: var(--app-text-muted);
  font-weight: 700;
}

.status-added {
  background: var(--diff-added-bg);
}

.status-added strong,
.status-added em,
.status-added.version-summary-item {
  color: var(--diff-added-fg);
}

.status-removed {
  background: var(--diff-deleted-bg);
}

.status-removed strong,
.status-removed em,
.status-removed.version-summary-item {
  color: var(--diff-deleted-fg);
}

.status-modified {
  background: var(--diff-modified-bg);
}

.status-modified strong,
.status-modified em,
.status-modified.version-summary-item {
  color: var(--diff-modified-fg);
}

.status-unchanged em {
  color: var(--app-text-muted);
}

@media (width <= 820px) {
  .version-header,
  .version-summary-grid,
  .version-side-grid {
    grid-template-columns: 1fr;
  }

  .version-header {
    display: grid;
  }

  .version-source-pair {
    text-align: left;
  }

  .version-side dl {
    grid-template-columns: 1fr;
  }
}
</style>
