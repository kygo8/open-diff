<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { compareMediaFiles, saveTextFile } from '@/api/diff'
import { buildMediaReportText, defaultMediaReportOutputPath } from '@/app/mediaReport'
import type {
  MediaCompareResponse,
  MediaFieldRow,
  MediaFieldStatus,
  MediaSideSummary,
} from '@/types/diff'
import WorkbenchShell from '@/components/workbench/WorkbenchShell.vue'
import WorkbenchInspector from '@/components/workbench/WorkbenchInspector.vue'
import { localFileSrc } from '@/app/localFileSrc'
import { prefersVideoElement } from '@/app/mediaPlayback'
import { buildMediaCompareToolbar, pathPairTitle } from '@/app/sessionToolbars'
import {
  buildMediaRulesCatalog,
  isMediaFieldImportant,
  loadMediaCompareOptions,
  resetMediaCompareOptions,
  saveMediaCompareOptions,
  toggleMediaFieldImportance,
  type MediaCompareOptionsState,
} from '@/app/mediaCompareOptions'
import { useSessionLaunchStore } from '@/stores/sessionLaunch'
import { useTabsStore } from '@/stores/tabs'
import { useI18n } from '@/i18n'
import { formatCompareError } from '@/app/compareError'

const mediaStatuses: MediaFieldStatus[] = ['added', 'removed', 'modified', 'unchanged']

type MediaFieldFilter = 'all' | 'diffs' | 'same' | 'minor'

const { t } = useI18n()
const emptyMediaSide: MediaSideSummary = {
  name: '',
  container: '',
  duration: '',
  stream: {
    codec: '',
    sampleRate: '',
    channels: '',
    bitrate: '',
  },
}
const leftPath = ref('')
const rightPath = ref('')
const sessionLaunch = useSessionLaunchStore()
const tabs = useTabsStore()
const router = useRouter()
const leftMedia = ref<MediaSideSummary>({ ...emptyMediaSide, stream: { ...emptyMediaSide.stream } })
const rightMedia = ref<MediaSideSummary>({
  ...emptyMediaSide,
  stream: { ...emptyMediaSide.stream },
})
const mediaFields = ref<MediaFieldRow[]>([])
const mediaSummaryOverride = ref<Record<MediaFieldStatus, number> | null>(null)
const fieldFilter = ref<MediaFieldFilter>('all')
const loading = ref(false)
const error = ref('')
const reportStatus = ref('')
const showMediaRules = ref(false)
const mediaOptions = ref<MediaCompareOptionsState>(loadMediaCompareOptions())
const leftPlayer = ref<HTMLMediaElement | null>(null)
const rightPlayer = ref<HTMLMediaElement | null>(null)
const syncPlayback = ref(true)
const playbackPosition = ref(0)
const playbackDuration = ref(0)
const isPlaying = ref(false)

onMounted(() => {
  const launch = sessionLaunch.consumeLaunch('/compare/media')

  if (!launch) {
    return
  }

  leftPath.value = launch.locations.left?.uri ?? leftPath.value
  rightPath.value = launch.locations.right?.uri ?? rightPath.value

  if (launch.autoRun && launch.locations.left?.uri && launch.locations.right?.uri) {
    void runMediaCompare()
  }
})

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
    added: 'ui.added',
    removed: 'ui.removed',
    modified: 'ui.modified',
    unchanged: 'ui.unchanged',
  }

  return t(labels[status])
}

function valueText(value?: string): string {
  return value ?? '--'
}

function applyMediaResult(result: MediaCompareResponse): void {
  leftMedia.value = result.left
  rightMedia.value = result.right
  mediaFields.value = result.fields
  mediaSummaryOverride.value = result.summary
  reportStatus.value = ''
}

async function exportMediaReport(): Promise<void> {
  if (mediaFields.value.length === 0) {
    return
  }

  const payload = buildMediaReportText({
    leftPath: leftPath.value,
    rightPath: rightPath.value,
    summary: mediaSummary.value,
    fields: mediaFields.value.map((row) => ({
      field: row.field,
      left: valueText(row.left),
      right: valueText(row.right),
      status: row.status,
      important: fieldIsImportant(row.field),
    })),
  })
  const outputPath = defaultMediaReportOutputPath(leftPath.value)

  try {
    await navigator.clipboard.writeText(payload)
  } catch {
    // Clipboard may be unavailable in headless tests; still try file export.
  }

  try {
    await saveTextFile({
      path: outputPath,
      text: payload,
      createBackup: false,
    })
    reportStatus.value = outputPath
  } catch (event) {
    error.value = formatCompareError(event, t)
  }
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
    error.value = formatCompareError(event, t)
  } finally {
    loading.value = false
  }
}

function fieldIsImportant(field: string): boolean {
  return isMediaFieldImportant(field, mediaOptions.value)
}

const visibleMediaFields = computed(() => {
  if (fieldFilter.value === 'diffs') {
    return mediaFields.value.filter(
      (field) => field.status !== 'unchanged' && fieldIsImportant(field.field),
    )
  }

  if (fieldFilter.value === 'same') {
    return mediaFields.value.filter((field) => field.status === 'unchanged')
  }

  if (fieldFilter.value === 'minor') {
    return mediaFields.value.filter(
      (field) => field.status !== 'unchanged' && !fieldIsImportant(field.field),
    )
  }

  return mediaFields.value
})

const mediaRulesCatalog = computed(() =>
  buildMediaRulesCatalog(mediaFields.value.map((row) => row.field)),
)

const minorDifferenceCount = computed(
  () =>
    mediaFields.value.filter(
      (field) => field.status !== 'unchanged' && !fieldIsImportant(field.field),
    ).length,
)

const mediaSessionToolbar = computed(() =>
  buildMediaCompareToolbar({
    home: true,
    all: true,
    diffs: true,
    same: true,
    minor: true,
    rules: true,
    swap: Boolean(leftPath.value || rightPath.value),
    reload: Boolean(leftPath.value && rightPath.value),
    play2: canPreviewMedia.value,
  }),
)

function persistMediaOptions(): void {
  saveMediaCompareOptions(mediaOptions.value)
}

function toggleFieldImportance(field: string): void {
  mediaOptions.value = toggleMediaFieldImportance(field, mediaOptions.value)
  persistMediaOptions()
}

function resetMediaRules(): void {
  mediaOptions.value = resetMediaCompareOptions()
  persistMediaOptions()
}

const leftMediaSrc = computed(() => (leftPath.value ? localFileSrc(leftPath.value) : ''))
const rightMediaSrc = computed(() => (rightPath.value ? localFileSrc(rightPath.value) : ''))
const useVideoPlayers = computed(() => prefersVideoElement(leftPath.value, rightPath.value))
const canPreviewMedia = computed(() => Boolean(leftMediaSrc.value || rightMediaSrc.value))

function syncMediaTabTitle(): void {
  if (!leftPath.value || !rightPath.value) {
    return
  }

  tabs.setTabTitle('/compare/media', pathPairTitle(leftPath.value, rightPath.value))
}

watch([leftPath, rightPath], () => {
  playbackPosition.value = 0
  playbackDuration.value = 0
  isPlaying.value = false
  syncMediaTabTitle()
})

function onMediaMeta(side: 'left' | 'right'): void {
  const el = side === 'left' ? leftPlayer.value : rightPlayer.value
  const duration = el?.duration

  if (typeof duration === 'number' && Number.isFinite(duration) && duration > 0) {
    playbackDuration.value = Math.max(playbackDuration.value, duration)
  }
}

function onMediaTime(side: 'left' | 'right'): void {
  const el = side === 'left' ? leftPlayer.value : rightPlayer.value

  if (!el) {
    return
  }

  playbackPosition.value = el.currentTime

  if (syncPlayback.value) {
    const other = side === 'left' ? rightPlayer.value : leftPlayer.value

    if (other && Math.abs(other.currentTime - el.currentTime) > 0.35) {
      other.currentTime = el.currentTime
    }
  }
}

function togglePlayback(): void {
  const players = [leftPlayer.value, rightPlayer.value].filter(
    (item): item is HTMLMediaElement => item !== null,
  )

  if (players.length === 0) {
    return
  }

  if (isPlaying.value) {
    for (const player of players) {
      player.pause()
    }
    isPlaying.value = false

    return
  }

  for (const player of players) {
    void player.play().catch(() => undefined)
  }
  isPlaying.value = true
}

function onScrubInput(event: Event): void {
  const target = event.target

  if (!(target instanceof HTMLInputElement)) {
    return
  }

  const next = Number(target.value)

  if (!Number.isFinite(next)) {
    return
  }

  playbackPosition.value = next

  for (const player of [leftPlayer.value, rightPlayer.value]) {
    if (player) {
      player.currentTime = next
    }
  }
}

function formatClock(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) {
    return '0:00'
  }

  const total = Math.floor(seconds)
  const mins = Math.floor(total / 60)
  const secs = total % 60

  return `${String(mins)}:${String(secs).padStart(2, '0')}`
}

function runMediaToolbarCommand(commandId: string): void {
  if (commandId === 'home') {
    tabs.openTab({ title: 'Home', titleKey: 'ui.home', route: '/', dirty: false })
    void router.push('/')

    return
  }

  if (
    commandId === 'all' ||
    commandId === 'diffs' ||
    commandId === 'same' ||
    commandId === 'minor'
  ) {
    fieldFilter.value = commandId

    return
  }

  if (commandId === 'rules') {
    showMediaRules.value = !showMediaRules.value

    return
  }

  if (commandId === 'swap') {
    const nextLeftPath = rightPath.value

    rightPath.value = leftPath.value
    leftPath.value = nextLeftPath
    const nextLeft = rightMedia.value

    rightMedia.value = leftMedia.value
    leftMedia.value = nextLeft
    if (leftPath.value && rightPath.value) {
      void runMediaCompare()
    }

    return
  }

  if (commandId === 'reload') {
    void runMediaCompare()

    return
  }

  if (commandId === 'play2') {
    togglePlayback()
  }
}
</script>

<template>
  <WorkbenchShell
    :title="$t('ui.mediaCompare')"
    :eyebrow="$t('ui.media')"
    :subtitle="`${leftMedia.name} -> ${rightMedia.name}`"
    :inspector-label="$t('ui.mediaCompareInspector')"
    :toolbar-commands="mediaSessionToolbar"
    toolbar-test-id-prefix="media-session-toolbar"
    @toolbar-command="runMediaToolbarCommand"
  >
    <section class="media-compare-view">
      <header class="media-header">
        <div>
          <p class="eyebrow">{{ $t('ui.mediaCompare') }}</p>
          <h1>{{ $t('ui.mediaCompare') }}</h1>
        </div>
        <div class="media-source-pair">
          <span>{{ $t('ui.left') }}: {{ leftMedia.name }}</span>
          <span>{{ $t('ui.right') }}: {{ rightMedia.name }}</span>
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
      <section
        v-if="canPreviewMedia"
        class="media-playback-panel"
        data-testid="media-playback-panel"
      >
        <header class="media-playback-header">
          <strong>{{ $t('ui.mediaPlayback') }}</strong>
          <label class="media-sync-toggle">
            <input
              v-model="syncPlayback"
              type="checkbox"
              data-testid="media-sync-playback"
            />
            <span>{{ $t('ui.syncPlayback') }}</span>
          </label>
        </header>
        <div class="media-players">
          <article class="media-player-card">
            <span>{{ $t('ui.left') }}</span>
            <video
              v-if="useVideoPlayers && leftMediaSrc"
              ref="leftPlayer"
              :src="leftMediaSrc"
              controls
              data-testid="media-left-video"
              @loadedmetadata="onMediaMeta('left')"
              @timeupdate="onMediaTime('left')"
            />
            <audio
              v-else-if="leftMediaSrc"
              ref="leftPlayer"
              :src="leftMediaSrc"
              controls
              data-testid="media-left-audio"
              @loadedmetadata="onMediaMeta('left')"
              @timeupdate="onMediaTime('left')"
            />
            <p
              v-else
              class="media-player-empty"
            >
              {{ $t('ui.noMediaPreview') }}
            </p>
          </article>
          <article class="media-player-card">
            <span>{{ $t('ui.right') }}</span>
            <video
              v-if="useVideoPlayers && rightMediaSrc"
              ref="rightPlayer"
              :src="rightMediaSrc"
              controls
              data-testid="media-right-video"
              @loadedmetadata="onMediaMeta('right')"
              @timeupdate="onMediaTime('right')"
            />
            <audio
              v-else-if="rightMediaSrc"
              ref="rightPlayer"
              :src="rightMediaSrc"
              controls
              data-testid="media-right-audio"
              @loadedmetadata="onMediaMeta('right')"
              @timeupdate="onMediaTime('right')"
            />
            <p
              v-else
              class="media-player-empty"
            >
              {{ $t('ui.noMediaPreview') }}
            </p>
          </article>
        </div>
        <div class="media-scrub-row">
          <button
            type="button"
            data-testid="media-play-toggle"
            @click="togglePlayback"
          >
            {{ isPlaying ? $t('ui.pause') : $t('ui.play') }}
          </button>
          <input
            class="media-scrub"
            type="range"
            min="0"
            :max="playbackDuration || 1"
            step="0.05"
            :value="playbackPosition"
            data-testid="media-scrub"
            @input="onScrubInput"
          />
          <span data-testid="media-clock"
            >{{ formatClock(playbackPosition) }} / {{ formatClock(playbackDuration) }}</span
          >
        </div>
        <p class="media-playback-hint">{{ $t('ui.mediaPlaybackHint') }}</p>
      </section>

      <p
        v-if="error"
        class="media-error"
        data-testid="media-compare-error"
      >
        {{ error }}
      </p>
      <p
        v-else-if="mediaFields.length === 0"
        class="empty"
        data-testid="media-empty-hint"
      >
        {{ $t('ui.emptyCompareHint') }}
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
        <article class="media-summary-item status-minor">
          <strong data-testid="media-summary-minor">{{ minorDifferenceCount }}</strong>
          <span>{{ $t('ui.minor') }}</span>
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
          <span>{{ $t('status.fieldCount', { count: mediaFields.length }) }}</span>
          <button
            type="button"
            data-testid="export-media-report"
            :disabled="mediaFields.length === 0"
            @click="exportMediaReport"
          >
            {{ $t('ui.export') }}
          </button>
          <span
            v-if="reportStatus"
            data-testid="media-report-status"
            >{{ reportStatus }}</span
          >
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
            <span>{{ $t('ui.importance') }}</span>
          </div>
          <div
            v-for="row in visibleMediaFields"
            :key="row.field"
            class="media-field-row"
            :class="[`status-${row.status}`, { 'media-field-minor': !fieldIsImportant(row.field) }]"
            :data-testid="`media-field-${row.field}`"
            :data-important="fieldIsImportant(row.field) ? 'true' : 'false'"
          >
            <strong>{{ row.field }}</strong>
            <code>{{ valueText(row.left) }}</code>
            <code>{{ valueText(row.right) }}</code>
            <em>{{ statusLabel(row.status) }}</em>
            <span>{{
              fieldIsImportant(row.field) ? $t('ui.important') : $t('ui.unimportant')
            }}</span>
          </div>
        </div>
      </section>

      <section
        v-if="showMediaRules"
        class="media-rules-panel"
        data-testid="media-rules-panel"
      >
        <header>
          <strong>{{ $t('ui.importanceRules') }}</strong>
          <span>{{ $t('ui.versionRulesHint') }}</span>
          <button
            type="button"
            data-testid="media-rules-reset"
            @click="resetMediaRules"
          >
            {{ $t('ui.reset') }}
          </button>
        </header>
        <div class="media-rules-list">
          <label
            v-for="row in mediaRulesCatalog"
            :key="`rule-${row.field}`"
            class="media-rule-row"
            :data-testid="`media-rule-${row.field}`"
          >
            <input
              type="checkbox"
              :checked="fieldIsImportant(row.field)"
              @change="toggleFieldImportance(row.field)"
            />
            <span>{{ row.field }}</span>
            <em>{{ row.group }}</em>
          </label>
        </div>
      </section>
    </section>

    <template #inspector>
      <WorkbenchInspector>
        <section class="workbench-inspector-section">
          <h2>{{ $t('ui.metadata') }}</h2>
          <dl>
            <div>
              <dt>{{ $t('ui.add') }}</dt>
              <dd data-tone="added">{{ mediaSummary.added }}</dd>
            </div>
            <div>
              <dt>{{ $t('ui.delete') }}</dt>
              <dd data-tone="deleted">{{ mediaSummary.removed }}</dd>
            </div>
            <div>
              <dt>{{ $t('ui.modified') }}</dt>
              <dd data-tone="modified">{{ mediaSummary.modified }}</dd>
            </div>
            <div>
              <dt>{{ $t('ui.codec') }}</dt>
              <dd>{{ leftMedia.stream.codec }} / {{ rightMedia.stream.codec }}</dd>
            </div>
          </dl>
        </section>
      </WorkbenchInspector>
    </template>
  </WorkbenchShell>
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

.media-report-panel header button {
  margin-left: auto;
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
  grid-template-columns: 140px minmax(160px, 1fr) minmax(160px, 1fr) 98px 98px;
  min-width: 760px;
  border-bottom: 1px solid var(--app-border);
  font-size: 12px;
}

.media-field-minor {
  opacity: 0.78;
}

.media-rules-panel {
  display: grid;
  gap: 10px;
  padding: 12px;
  border: 1px solid var(--app-border);
  border-radius: 8px;
  background: var(--app-surface);
}

.media-rules-panel header {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 10px;
}

.media-rules-panel header button {
  margin-left: auto;
}

.media-rules-panel header span {
  color: var(--app-text-muted);
  font-size: 12px;
}

.media-rules-list {
  display: grid;
  gap: 6px;
  max-height: 220px;
  overflow: auto;
}

.media-rule-row {
  display: grid;
  grid-template-columns: auto 1fr auto;
  align-items: center;
  gap: 10px;
  font-size: 12px;
}

.media-rule-row em {
  color: var(--app-text-muted);
  font-style: normal;
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

.status-minor.media-summary-item {
  border-color: color-mix(in srgb, var(--bc-warning, #c9a227) 55%, var(--bc-border));
}

.status-minor.media-summary-item strong {
  color: var(--bc-warning, #c9a227);
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

.media-playback-panel {
  display: grid;
  gap: 10px;
  padding: 12px;
  border: 1px solid var(--app-border);
  border-radius: 8px;
  background: var(--app-surface);
}

.media-playback-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.media-sync-toggle {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
}

.media-players {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 12px;
}

.media-player-card {
  display: grid;
  gap: 6px;
  min-width: 0;
}

.media-player-card video,
.media-player-card audio {
  width: 100%;
  max-height: 220px;
}

.media-player-empty {
  margin: 0;
  color: var(--app-text-muted);
  font-size: 12px;
}

.media-scrub-row {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 10px;
}

.media-scrub {
  flex: 1;
  min-width: 160px;
}

.media-playback-hint {
  margin: 0;
  color: var(--app-text-muted);
  font-size: 12px;
}
</style>
