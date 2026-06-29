<script setup lang="ts">
import WorkbenchShell from '@/components/workbench/WorkbenchShell.vue'
import WorkbenchToolbar from '@/components/workbench/WorkbenchToolbar.vue'
import WorkbenchInspector from '@/components/workbench/WorkbenchInspector.vue'
import StatusSummaryGrid from '@/components/workbench/StatusSummaryGrid.vue'

const jobs = [
  {
    name: 'release-folder-diff.md',
    type: 'Markdown',
    state: 'Completed',
    target: 'reports/release',
  },
  { name: 'regression-summary.json', type: 'JSON', state: 'Queued', target: 'artifacts/nightly' },
  { name: 'media-tags.csv', type: 'CSV', state: 'Draft', target: 'exports/media' },
]

const scriptLines = [
  'opendiff compare folder --left D:/workspace/left --right D:/workspace/right',
  'opendiff report --format markdown --out reports/release-folder-diff.md',
  'opendiff script run ./rules/release-policy.odiff.js',
]
</script>

<template>
  <WorkbenchShell
    title="Reports / Scripts"
    eyebrow="Automation"
    subtitle="CLI, reports, and repeatable comparison jobs"
    inspector-label="Reports inspector"
  >
    <template #toolbar>
      <WorkbenchToolbar>
        <button
          type="button"
          class="primary"
        >
          {{ $t('ui.runDiff') }}
        </button>
        <button type="button">{{ $t('ui.export') }}</button>
        <button type="button">{{ $t('ui.save') }}</button>
      </WorkbenchToolbar>
    </template>

    <section class="reports-script-view">
      <section class="report-panel">
        <header class="split-pane-header active">
          <strong>Jobs</strong>
          <span>{{ jobs.length }} definitions</span>
        </header>
        <div class="report-table">
          <div class="report-row report-head">
            <span>Name</span>
            <span>Type</span>
            <span>State</span>
            <span>Target</span>
          </div>
          <div
            v-for="job in jobs"
            :key="job.name"
            class="report-row"
          >
            <strong>{{ job.name }}</strong>
            <span>{{ job.type }}</span>
            <span>{{ job.state }}</span>
            <code>{{ job.target }}</code>
          </div>
        </div>
      </section>

      <section class="script-panel">
        <header class="split-pane-header">
          <strong>Script / CLI</strong>
          <span>PowerShell ready</span>
        </header>
        <pre><code>{{ scriptLines.join('\n') }}</code></pre>
      </section>
    </section>

    <template #inspector>
      <WorkbenchInspector>
        <section class="workbench-inspector-section">
          <h2>{{ $t('ui.jobs') }}</h2>
          <StatusSummaryGrid
            :items="[
              { label: $t('ui.completed'), value: 1, tone: 'added' },
              { label: 'Queued', value: 1, tone: 'modified' },
              { label: 'Draft', value: 1 },
            ]"
          />
        </section>
        <section class="workbench-inspector-section">
          <h2>CLI</h2>
          <dl>
            <div>
              <dt>Shell</dt>
              <dd>PowerShell 7.6.1</dd>
            </div>
            <div>
              <dt>Output</dt>
              <dd>reports/release-folder-diff.md</dd>
            </div>
          </dl>
        </section>
      </WorkbenchInspector>
    </template>
  </WorkbenchShell>
</template>

<style scoped>
.reports-script-view {
  display: grid;
  grid-template-rows: minmax(0, 1fr) 220px;
  gap: 8px;
  height: 100%;
  min-height: 0;
  padding: 8px;
  overflow: hidden;
}

.report-panel,
.script-panel {
  display: grid;
  grid-template-rows: 28px minmax(0, 1fr);
  min-height: 0;
  overflow: hidden;
  border: 1px solid var(--app-border);
  background: var(--app-canvas);
}

.report-table {
  overflow: auto;
}

.report-row {
  display: grid;
  grid-template-columns: minmax(220px, 1.4fr) 110px 110px minmax(180px, 1fr);
  min-height: 30px;
  border-bottom: 1px solid var(--app-border);
  font-size: 12px;
}

.report-row > * {
  min-width: 0;
  margin: 0;
  padding: 6px 8px;
  overflow: hidden;
  border-right: 1px solid var(--app-border);
  text-overflow: ellipsis;
  white-space: nowrap;
}

.report-row > *:last-child {
  border-right: 0;
}

.report-head {
  background: var(--app-surface-muted);
  color: var(--app-text-muted);
  font-weight: 700;
}

.script-panel pre {
  min-height: 0;
  margin: 0;
  padding: 10px;
  overflow: auto;
  background: var(--app-bg);
  color: var(--app-text);
  font-family: var(--font-mono);
  font-size: 12px;
  line-height: 20px;
}
</style>
