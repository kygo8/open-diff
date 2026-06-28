<script setup lang="ts">
import { computed, ref } from 'vue'
import { compareMediaFiles } from '@/api/diff'
import type {
  MediaCompareResponse,
  MediaFieldRow,
  MediaFieldStatus,
  MediaSideSummary,
} from '@/types/diff'

const mediaStatuses: MediaFieldStatus[] = ['added', 'removed', 'modified', 'unchanged']
const defaultLeftMedia: MediaSideSummary = {
  name: 'left-track.flac',
  container: 'FLAC',
  duration: '04:00.000',
  stream: {
    codec: 'FLAC',
    sampleRate: '44.1 kHz',
    channels: '2 channels',
    bitrate: 'Lossless',
  },
}
const defaultRightMedia: MediaSideSummary = {
  name: 'right-track.flac',
  container: 'FLAC',
  duration: '04:00.000',
  stream: {
    codec: 'FLAC',
    sampleRate: '44.1 kHz',
    channels: '2 channels',
    bitrate: 'Lossless',
  },
}
const defaultMediaFields: MediaFieldRow[] = [
  {
    field: 'Title',
    left: 'Northern Lights',
    right: 'Northern Lights (Remaster)',
    status: 'modified',
  },
  {
    field: 'Album',
    left: 'Winter',
    right: 'Winter',
    status: 'unchanged',
  },
  {
    field: 'Artist',
    left: 'Aster',
    right: 'Aster feat. Vega',
    status: 'modified',
  },
  {
    field: 'Comment',
    left: 'Draft',
    status: 'removed',
  },
  {
    field: 'Genre',
    right: 'Ambient',
    status: 'added',
  },
]
const leftPath = ref('C:/music/left-track.flac')
const rightPath = ref('C:/music/right-track.flac')
const leftMedia = ref<MediaSideSummary>(defaultLeftMedia)
const rightMedia = ref<MediaSideSummary>(defaultRightMedia)
const mediaFields = ref<MediaFieldRow[]>(defaultMediaFields)
const mediaSummaryOverride = ref<Record<MediaFieldStatus, number> | null>(null)
const loading = ref(false)
const error = ref('')

const mediaSummary = computed<Record<MediaFieldStatus, number>>(() => {
  if (mediaSummaryOverride.value) {
    return mediaSummaryOverride.value
  }

  const summary: Record<MediaFieldStatus, number> = {
    added: 0,
    removed: 0,
    modified: 0,
    unchanged: 0,
  }

  for (const row of mediaFields.value) {
    summary[row.status] += 1
  }

  return summary
})

function statusLabel(status: MediaFieldStatus): string {
  const labels: Record<MediaFieldStatus, string> = {
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

function applyMediaResult(result: MediaCompareResponse): void {
  leftMedia.value = result.left
  rightMedia.value = result.right
  mediaFields.value = result.fields
  mediaSummaryOverride.value = result.summary
}

async function runMediaCompare(): Promise<void> {
  loading.value = true
  error.value = ''
  try {
    const result = await compareMediaFiles({
      leftPath: leftPath.value,
      rightPath: rightPath.value,
    })

    applyMediaResult(result)
  } catch (event) {
    error.value = String(event)
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <section class="media-compare-view">
    <header class="media-header">
      <div>
        <p class="eyebrow">{{ $t('ui.mediaCompare') }}</p>
        <h1>{{ $t('ui.mediaCompare') }}</h1>
      </div>
      <div class="media-source-pair">
        <span>Left: {{ leftMedia.name }}</span>
        <span>Right: {{ rightMedia.name }}</span>
      </div>
    </header>

    <section class="media-path-panel">
      <label>
        <span>{{ $t('ui.left') }} {{ $t('ui.path') }}</span>
        <input
          v-model="leftPath"
          type="text"
          data-testid="media-left-path"
        />
      </label>
      <label>
        <span>{{ $t('ui.right') }} {{ $t('ui.path') }}</span>
        <input
          v-model="rightPath"
          type="text"
          data-testid="media-right-path"
        />
      </label>
      <button
        type="button"
        data-testid="run-media-compare"
        :disabled="loading"
        @click="runMediaCompare"
      >
        {{ $t('ui.runDiff') }}
      </button>
    </section>
    <p
      v-if="error"
      class="media-error"
      data-testid="media-compare-error"
    >
      {{ error }}
    </p>

    <section class="media-summary-grid">
      <article
        v-for="status in mediaStatuses"
        :key="status"
        class="media-summary-item"
        :class="`status-${status}`"
      >
        <strong :data-testid="`media-summary-${status}`">{{ mediaSummary[status] }}</strong>
        <span>{{ statusLabel(status) }}</span>
      </article>
    </section>

    <section class="media-side-grid">
      <article class="media-side">
        <header>
          <strong>{{ leftMedia.name }}</strong>
          <span>{{ leftMedia.container }}</span>
        </header>
        <dl>
          <div>
            <dt>{{ $t('ui.duration') }}</dt>
            <dd>{{ leftMedia.duration }}</dd>
          </div>
          <div>
            <dt>{{ $t('ui.codec') }}</dt>
            <dd>{{ leftMedia.stream.codec }}</dd>
          </div>
          <div>
            <dt>{{ $t('ui.sampleRate') }}</dt>
            <dd>{{ leftMedia.stream.sampleRate }}</dd>
          </div>
          <div>
            <dt>{{ $t('ui.channels') }}</dt>
            <dd>{{ leftMedia.stream.channels }}</dd>
          </div>
          <div>
            <dt>{{ $t('ui.bitrate') }}</dt>
            <dd>{{ leftMedia.stream.bitrate }}</dd>
          </div>
        </dl>
      </article>

      <article class="media-side">
        <header>
          <strong>{{ rightMedia.name }}</strong>
          <span>{{ rightMedia.container }}</span>
        </header>
        <dl>
          <div>
            <dt>{{ $t('ui.duration') }}</dt>
            <dd>{{ rightMedia.duration }}</dd>
          </div>
          <div>
            <dt>{{ $t('ui.codec') }}</dt>
            <dd>{{ rightMedia.stream.codec }}</dd>
          </div>
          <div>
            <dt>{{ $t('ui.sampleRate') }}</dt>
            <dd>{{ rightMedia.stream.sampleRate }}</dd>
          </div>
          <div>
            <dt>{{ $t('ui.channels') }}</dt>
            <dd>{{ rightMedia.stream.channels }}</dd>
          </div>
          <div>
            <dt>{{ $t('ui.bitrate') }}</dt>
            <dd>{{ rightMedia.stream.bitrate }}</dd>
          </div>
        </dl>
      </article>
    </section>

    <section class="media-report-panel">
      <header>
        <strong>{{ $t('ui.tagFieldReport') }}</strong>
        <span>{{ mediaFields.length }} fields</span>
      </header>
      <div
        class="media-report-table"
        data-testid="media-report-table"
      >
        <div class="media-field-row media-field-head">
          <span>{{ $t('ui.field') }}</span>
          <span>{{ $t('ui.left') }}</span>
          <span>{{ $t('ui.right') }}</span>
          <span>{{ $t('ui.status') }}</span>
        </div>
        <div
          v-for="row in mediaFields"
          :key="row.field"
          class="media-field-row"
          :class="`status-${row.status}`"
          :data-testid="`media-field-${row.field}`"
        >
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
.media-compare-view {
  display: grid;
  gap: 14px;
  height: 100%;
  padding: 16px;
  overflow: auto;
}

.media-header {
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

.media-source-pair {
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

.media-summary-grid,
.media-side-grid {
  display: grid;
  gap: 10px;
}

.media-summary-grid {
  grid-template-columns: repeat(4, minmax(120px, 1fr));
}

.media-side-grid {
  grid-template-columns: repeat(2, minmax(0, 1fr));
}

.media-summary-item,
.media-side,
.media-report-panel {
  display: grid;
  gap: 8px;
  padding: 10px 12px;
  border: 1px solid var(--app-border);
  border-radius: 8px;
  background: var(--app-surface);
}

.media-summary-item {
  gap: 4px;
}

.media-summary-item strong {
  font-size: 18px;
  line-height: 1;
}

.media-summary-item span,
.media-side header span,
.media-report-panel header span {
  color: var(--app-text-muted);
  font-size: 12px;
}

.media-side header,
.media-report-panel header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.media-side dl {
  display: grid;
  grid-template-columns: repeat(5, minmax(0, 1fr));
  gap: 8px;
  margin: 0;
}

.media-side dl div {
  display: grid;
  gap: 4px;
  min-width: 0;
  padding: 8px;
  border: 1px solid var(--app-border);
  border-radius: 6px;
  background: var(--app-bg);
}

.media-side dt {
  color: var(--app-text-muted);
  font-size: 11px;
}

.media-side dd {
  min-width: 0;
  margin: 0;
  overflow: hidden;
  font-size: 12px;
  font-weight: 700;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.media-report-table {
  display: grid;
  overflow: auto;
  border: 1px solid var(--app-border);
  border-radius: 6px;
  background: var(--app-bg);
}

.media-field-row {
  display: grid;
  grid-template-columns: 140px minmax(180px, 1fr) minmax(180px, 1fr) 98px;
  min-width: 640px;
  border-bottom: 1px solid var(--app-border);
  font-size: 12px;
}

.media-field-row:last-child {
  border-bottom: 0;
}

.media-field-row > * {
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

.media-field-row > *:last-child {
  border-right: 0;
}

.media-field-row code {
  font-family: var(--font-mono);
}

.media-field-head {
  background: var(--app-surface-muted);
  color: var(--app-text-muted);
  font-weight: 700;
}

.status-added {
  background: var(--diff-added-bg);
}

.status-added strong,
.status-added em,
.status-added.media-summary-item {
  color: var(--diff-added-fg);
}

.status-removed {
  background: var(--diff-deleted-bg);
}

.status-removed strong,
.status-removed em,
.status-removed.media-summary-item {
  color: var(--diff-deleted-fg);
}

.status-modified {
  background: var(--diff-modified-bg);
}

.status-modified strong,
.status-modified em,
.status-modified.media-summary-item {
  color: var(--diff-modified-fg);
}

.status-unchanged em {
  color: var(--app-text-muted);
}

@media (width <= 820px) {
  .media-header,
  .media-summary-grid,
  .media-side-grid {
    grid-template-columns: 1fr;
  }

  .media-header {
    display: grid;
  }

  .media-source-pair {
    text-align: left;
  }

  .media-side dl {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}
</style>
