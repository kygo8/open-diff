<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { compareMediaFiles, pathFileStamp, saveTextFile } from '@/api/diff'
import { buildMediaReportText, defaultMediaReportOutputPath } from '@/app/mediaReport'
import type {
  FileStamp,
  MediaCompareResponse,
  MediaFieldRow,
  MediaFieldStatus,
  MediaSideSummary,
} from '@/types/diff'
import { pickNativePath } from '@/app/filePicker'
import PathMetaFooter from '@/components/workbench/PathMetaFooter.vue'
import SessionPathActions from '@/components/workbench/SessionPathActions.vue'
import WorkbenchShell from '@/components/workbench/WorkbenchShell.vue'
import WorkbenchInspector from '@/components/workbench/WorkbenchInspector.vue'
import SessionSettingsDialog from '@/components/session/SessionSettingsDialog.vue'
import { localFileSrc } from '@/app/localFileSrc'
import { prefersVideoElement } from '@/app/mediaPlayback'
import { Pause, Play } from '@lucide/vue'
import { buildMediaCompareToolbar, pathPairTitle } from '@/app/sessionToolbars'
import {
  buildMediaRulesCatalog,
  defaultUnimportantMediaFields,
  isMediaFieldImportant,
  loadMediaCompareOptions,
  saveMediaCompareOptions,
  toggleMediaFieldImportance,
  type MediaCompareOptionsState,
  type MediaFieldFilter,
} from '@/app/mediaCompareOptions'
import { useSessionLaunchStore } from '@/stores/sessionLaunch'
import { useViewActionsStore } from '@/stores/viewActions'
import { useTabsStore } from '@/stores/tabs'
import { useI18n } from '@/i18n'
import { formatCompareError } from '@/app/compareError'
import { elapsedSecondsSince } from '@/app/statusBarPhrases'
import { useStatusBarStore } from '@/stores/statusBar'
import { useSettingsStore } from '@/stores/settings'

const settings = useSettingsStore()
const mediaStatuses: MediaFieldStatus[] = ['added', 'removed', 'modified', 'unchanged']

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
const leftFileStamp = ref<FileStamp | null>(null)
const rightFileStamp = ref<FileStamp | null>(null)
const sessionLaunch = useSessionLaunchStore()
const tabs = useTabsStore()
const viewActions = useViewActionsStore()
const router = useRouter()
const leftMedia = ref<MediaSideSummary>({ ...emptyMediaSide, stream: { ...emptyMediaSide.stream } })
const rightMedia = ref<MediaSideSummary>({
  ...emptyMediaSide,
  stream: { ...emptyMediaSide.stream },
})
const mediaFields = ref<MediaFieldRow[]>([])
const mediaSummaryOverride = ref<Record<MediaFieldStatus, number> | null>(null)
const mediaOptions = ref<MediaCompareOptionsState>(loadMediaCompareOptions())
const fieldFilter = ref<MediaFieldFilter>(mediaOptions.value.defaultFilter)
const loading = ref(false)
const error = ref('')
const reportStatus = ref('')
const showMediaRules = ref(mediaOptions.value.showRules)
const showSessionSettings = ref(false)
const leftPlayer = ref<HTMLMediaElement | null>(null)
const rightPlayer = ref<HTMLMediaElement | null>(null)
const syncPlayback = ref(mediaOptions.value.syncPlayback)
const playbackPosition = ref(0)
const playbackDuration = ref(0)
const isPlaying = ref(false)
const statusBar = useStatusBarStore()
const loadTimeSeconds = ref<number | null>(null)

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

async function browseMediaPath(side: 'left' | 'right'): Promise<void> {
  const selected = await pickNativePath({ directory: false })

  if (!selected) {
    return
  }

  if (side === 'left') {
    leftPath.value = selected
  } else {
    rightPath.value = selected
  }
}

async function refreshMediaPathStamps(): Promise<void> {
  const [left, right] = await Promise.all([
    leftPath.value ? pathFileStamp(leftPath.value).catch(() => null) : Promise.resolve(null),
    rightPath.value ? pathFileStamp(rightPath.value).catch(() => null) : Promise.resolve(null),
  ])

  leftFileStamp.value = left
  rightFileStamp.value = right
}

function applyMediaResult(result: MediaCompareResponse): void {
  leftMedia.value = result.left
  rightMedia.value = result.right
  mediaFields.value = result.fields
  activeMediaFieldIndex.value = 0
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
      createBackup: settings.createBackupOnReportExport,
      backupRetention: settings.backupRetentionCount,
    })
    reportStatus.value = outputPath
  } catch (event) {
    error.value = formatCompareError(event, t)
  }
}

async function runMediaCompare(): Promise<void> {
  const startedAt = performance.now()

  loading.value = true
  error.value = ''
  try {
    const result = await compareMediaFiles({
      leftPath: leftPath.value,
      rightPath: rightPath.value,
    })

    applyMediaResult(result)
    loadTimeSeconds.value = elapsedSecondsSince(startedAt)
    await refreshMediaPathStamps()
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

watch(
  [loading, mediaFields, loadTimeSeconds],
  () => {
    const hasResult = mediaFields.value.length > 0
    let comparisonStatus = t('status.readyIdle')

    if (loading.value) {
      comparisonStatus = t('status.comparing')
    } else if (hasResult) {
      comparisonStatus = t('status.compared')
    }

    statusBar.reportStatus({
      comparisonStatus,
      differenceCount: hasResult
        ? mediaFields.value.filter((field) => field.status !== 'unchanged').length
        : null,
      filterStatus: t('status.allRows'),
      source: 'media-compare',
      loadTimeSeconds: hasResult ? loadTimeSeconds.value : null,
      chromeKind: 'media-session',
    })
  },
  { immediate: true },
)

const differingMediaFields = computed(() =>
  mediaFields.value.filter((field) => field.status !== 'unchanged'),
)
const activeMediaFieldIndex = ref(0)

const mediaSessionToolbar = computed(() =>
  buildMediaCompareToolbar({
    home: true,
    sessions: true,
    all: true,
    diffs: true,
    same: true,
    minor: true,
    rules: true,
    'next-diff': differingMediaFields.value.length > 0,
    'prev-diff': differingMediaFields.value.length > 0,
    swap: Boolean(leftPath.value || rightPath.value),
    reload: Boolean(leftPath.value && rightPath.value),
    play2: canPreviewMedia.value,
  }).map((item) => ({
    ...item,
    active:
      Boolean(item.active) ||
      (item.id === 'rules' && showMediaRules.value) ||
      (item.id === 'sessions' && showSessionSettings.value),
  })),
)

function persistMediaOptions(): void {
  saveMediaCompareOptions(mediaOptions.value)
}

watch(syncPlayback, (value) => {
  mediaOptions.value = {
    ...mediaOptions.value,
    syncPlayback: value,
  }
  persistMediaOptions()
})

function toggleFieldImportance(field: string): void {
  mediaOptions.value = toggleMediaFieldImportance(field, mediaOptions.value)
  persistMediaOptions()
}

function resetMediaRules(): void {
  mediaOptions.value = {
    ...mediaOptions.value,
    unimportantFields: [...defaultUnimportantMediaFields],
  }
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

watch(
  () => [viewActions.sequence, viewActions.name] as const,
  ([, actionName]) => {
    if (!actionName) {
      return
    }

    switch (actionName) {
      case 'compare':
      case 'reload':
        void runMediaCompare()
        break
      case 'swap':
        runMediaToolbarCommand('swap')
        break
      case 'export':
      case 'save-report':
        void exportMediaReport()
        break

      case 'previous-difference':
        navigateMediaDifference(-1)
        break
      case 'next-difference':
        navigateMediaDifference(1)
        break
      case 'show-all':
        runMediaToolbarCommand('all')
        break
      case 'show-differences':
        runMediaToolbarCommand('diffs')
        break
      case 'toggle-minor':
        runMediaToolbarCommand(fieldFilter.value === 'minor' ? 'all' : 'minor')
        break
      case 'session-settings':
        openMediaSessionSettings()
        break
      case 'rules':
        runMediaToolbarCommand('rules')
        break
      case 'copy-left':
      case 'copy-right':
      case 'undo':
      case 'redo':
      case 'cut':
      case 'copy':
      case 'paste':
      case 'delete':
      case 'save':
      case 'save-as':
      case 'workspace-save':
      case 'close-tab':
      case 'clear-session':
      case 'about':
      case 'check-for-updates':
      case 'help-contents':
      case 'help-context':
      case 'help-support':
      case 'filters':
      case 'workspace-load':
      case 'export-settings':
      case 'import-settings':
      case 'restore-factory-defaults':
      case 'save-snapshot':
      case 'previous-conflict':
      case 'next-conflict':
      case 'expand-all':
      case 'collapse-all':
      case 'sync-now':
      case 'browse-folder':
      case 'up-one-level':
      case 'path-back':
      case 'path-forward':
      case 'toggle-session-locked':
      case 'select-all':
      case 'select-all-files':
      case 'select-orphans':
      case 'select-newer':
      case 'invert-selection':
      case 'open-selected':
      case 'open-with':
      case 'quick-compare':
      case 'exclude-selected':
      case 'refresh-selection':
      case 'show-same':
      case 'show-orphans':
      case 'show-no-orphans':
      case 'show-differences-no-orphans':
      case 'show-left-orphans':
      case 'show-right-orphans':
      case 'show-left-newer':
      case 'show-right-newer':
      case 'show-left-newer-orphans':
      case 'show-right-newer-orphans':
      case 'compare-files-and-folder-structure':
      case 'only-compare-files':
      case 'ignore-folder-structure':
      case 'always-show-folders':
      case 'show-changes':
      case 'show-conflicts':
      case 'toggle-center-pane':
      case 'compare-to-output':
      case 'suppress-filters':
      case 'compare-parent-folders':
      case 'run-script':
      case 'find-filename':
      case 'find-next-filename':
      case 'find-previous-filename':
      case 'full-refresh':
      case 'toggle-columns':
      case 'toggle-log':
      case 'toggle-legend':
      case 'toggle-toolbar':
      case 'change-attributes':
      case 'new-folder':
      case 'leave-alone':
      case 'sync-copy-left-to-right':
      case 'sync-copy-right-to-left':
      case 'sync-delete-left':
      case 'sync-delete-right':
      case 'copy-to-side':
      case 'move-to-side':
      case 'copy-to-folder':
      case 'move-to-folder':
      case 'rename-selected':
      case 'compare-contents':
      case 'synchronize':
      case 'explorer':
      case 'ignored':
      case 'align-with':
      case 'break-alignment':
      case 'file-compare-report':
      case 'session-info':
      case 'copy-filename':
      case 'merge-execute':
      case 'copy-to-output':
      case 'touch-selected':
        break
    }
  },
)

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

function navigateMediaDifference(direction: 1 | -1): void {
  const fields = differingMediaFields.value

  if (fields.length === 0) {
    return
  }

  activeMediaFieldIndex.value =
    (activeMediaFieldIndex.value + direction + fields.length) % fields.length
}

function openMediaSessionSettings(): void {
  showSessionSettings.value = true
}

function applyMediaSessionSettings(
  payload:
    | { kind: 'folder'; criteria: unknown; filters?: unknown }
    | { kind: 'text'; options: unknown }
    | { kind: 'table'; options: unknown }
    | { kind: 'hex'; options: unknown }
    | { kind: 'picture'; options: unknown }
    | { kind: 'media'; options: MediaCompareOptionsState }
    | { kind: 'version'; options: unknown }
    | { kind: 'registry'; options: unknown }
    | { kind: 'patch'; options: unknown },
): void {
  if (payload.kind !== 'media') {
    return
  }

  mediaOptions.value = {
    ...mediaOptions.value,
    ...payload.options,
  }
  syncPlayback.value = payload.options.syncPlayback
  fieldFilter.value = payload.options.defaultFilter
  showMediaRules.value = payload.options.showRules
  saveMediaCompareOptions(mediaOptions.value)
  showSessionSettings.value = false
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

  if (commandId === 'sessions') {
    openMediaSessionSettings()

    return
  }

  if (commandId === 'swap') {
    const nextLeftPath = rightPath.value

    rightPath.value = leftPath.value
    leftPath.value = nextLeftPath
    const nextLeftStamp = rightFileStamp.value

    rightFileStamp.value = leftFileStamp.value
    leftFileStamp.value = nextLeftStamp
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

    return
  }

  if (commandId === 'next-diff') {
    navigateMediaDifference(1)

    return
  }

  if (commandId === 'prev-diff') {
    navigateMediaDifference(-1)
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

      <section
        class="media-path-panel"
        data-testid="media-path-chrome"
        data-path-density="capture-1to1"
      >
        <div class="media-path-fields">
          <div class="path-field-row media-path-field">
            <input
              v-model="leftPath"
              type="text"
              class="path-input"
              data-testid="media-left-path"
              :title="leftPath"
              :placeholder="$t('ui.remoteUriHint')"
              :aria-label="$t('ui.left') + ' ' + $t('ui.path')"
            />
            <SessionPathActions
              browse-test-id="media-browse-left"
              save-test-id="media-save-left"
              :can-save="false"
              @browse="browseMediaPath('left')"
            />
          </div>
          <div class="path-field-row media-path-field">
            <input
              v-model="rightPath"
              type="text"
              class="path-input"
              data-testid="media-right-path"
              :title="rightPath"
              :placeholder="$t('ui.remoteUriHint')"
              :aria-label="$t('ui.right') + ' ' + $t('ui.path')"
            />
            <SessionPathActions
              browse-test-id="media-browse-right"
              save-test-id="media-save-right"
              :can-save="false"
              @browse="browseMediaPath('right')"
            />
          </div>
          <button
            type="button"
            class="media-path-run"
            data-testid="run-media-compare"
            :disabled="loading"
            @click="runMediaCompare"
          >
            {{ $t('ui.runDiff') }}
          </button>
        </div>

        <div
          class="bc-path-footers media-path-meta-strip"
          data-testid="media-path-footers"
          data-secondary-density="capture-1to1"
        >
          <PathMetaFooter
            :stamp="leftFileStamp"
            :format-label="leftMedia.duration || undefined"
            :show-milliseconds="settings.showMillisecondsInTimestamps"
            test-id="media-left-path-footer"
          />
          <PathMetaFooter
            :stamp="rightFileStamp"
            :format-label="rightMedia.duration || undefined"
            :show-milliseconds="settings.showMillisecondsInTimestamps"
            test-id="media-right-path-footer"
          />
        </div>
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
            <div
              class="media-scrub-row"
              data-testid="media-scrub-chrome"
              data-media-scrub-density="capture-1to1"
              data-media-scrub-residual="capture-1to1"
            >
              <button
                type="button"
                class="media-scrub-play"
                data-testid="media-play-toggle"
                :aria-label="isPlaying ? $t('ui.pause') : $t('ui.play')"
                @click="togglePlayback"
              >
                <Pause
                  v-if="isPlaying"
                  class="media-scrub-icon"
                  :size="12"
                  :stroke-width="2"
                  aria-hidden="true"
                />
                <Play
                  v-else
                  class="media-scrub-icon"
                  :size="12"
                  :stroke-width="2"
                  aria-hidden="true"
                />
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
            <div
              class="media-scrub-row"
              data-testid="media-scrub-chrome-right"
              data-media-scrub-density="capture-1to1"
              data-media-scrub-residual="capture-1to1"
            >
              <button
                type="button"
                class="media-scrub-play"
                data-testid="media-play-toggle-right"
                :aria-label="isPlaying ? $t('ui.pause') : $t('ui.play')"
                @click="togglePlayback"
              >
                <Pause
                  v-if="isPlaying"
                  class="media-scrub-icon"
                  :size="12"
                  :stroke-width="2"
                  aria-hidden="true"
                />
                <Play
                  v-else
                  class="media-scrub-icon"
                  :size="12"
                  :stroke-width="2"
                  aria-hidden="true"
                />
              </button>
              <input
                class="media-scrub"
                type="range"
                min="0"
                :max="playbackDuration || 1"
                step="0.05"
                :value="playbackPosition"
                data-testid="media-scrub-right"
                @input="onScrubInput"
              />
              <span data-testid="media-clock-right"
                >{{ formatClock(playbackPosition) }} / {{ formatClock(playbackDuration) }}</span
              >
            </div>
          </article>
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
          <div
            class="media-field-row media-field-head"
            data-media-field-density="capture-1to1"
          >
            <span>{{ $t('ui.field') }}</span>
            <span>{{ $t('ui.left') }}</span>
            <span>{{ $t('ui.right') }}</span>
            <span>{{ $t('ui.status') }}</span>
            <span data-importance-chrome="capture-1to1">{{ $t('ui.importance') }}</span>
          </div>
          <div
            v-for="row in visibleMediaFields"
            :key="row.field"
            class="media-field-row"
            :class="[
              `status-${row.status}`,
              {
                'media-field-minor': !fieldIsImportant(row.field),
                selected: differingMediaFields[activeMediaFieldIndex]?.field === row.field,
              },
            ]"
            :data-testid="`media-field-${row.field}`"
            :data-important="fieldIsImportant(row.field) ? 'true' : 'false'"
            :data-selected="
              differingMediaFields[activeMediaFieldIndex]?.field === row.field ? 'true' : 'false'
            "
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
        data-rules-density="capture-1to1"
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

    <SessionSettingsDialog
      :open="showSessionSettings"
      kind="media"
      :media-options="mediaOptions"
      @close="showSessionSettings = false"
      @apply="applyMediaSessionSettings"
    />
  </WorkbenchShell>
</template>
<style scoped>
.media-compare-view {
  display: grid;
  gap: 4px;
  height: 100%;
  padding: 2px 4px;
  overflow: auto;
}

.media-path-fields {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(0, 1fr) auto;
  align-items: center;
  gap: 2px;
  min-height: 22px;
}

.media-path-field {
  display: flex;
  align-items: center;
  gap: 2px;
  min-width: 0;
}

.media-path-field .path-input {
  flex: 1 1 auto;
  min-width: 0;
  height: 16.5px;
  padding: 0 4px;
  border: 1px solid #a0a0a0;
  border-radius: 0;
  font-size: 12px;
}

.media-path-run {
  height: 20px;
  min-height: 20px;
  padding: 0 8px;
  border: 1px solid #a0a0a0;
  border-radius: 0;
  font-size: 11px;
}

.media-path-meta-strip {
  min-height: 18px;
  padding: 1px 4px;
  border: 1px solid #c0c0c0;
  border-radius: 0;
  background: #f0f0f0;
}

.media-path-meta-strip :deep(.path-meta-footer) {
  gap: 6px;
  min-height: 18px;
  color: #111111;
  font-size: 11px;
  line-height: 16px;
}

.media-path-panel {
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  align-items: stretch;
  gap: 1px;
  min-height: 22px;
  padding: 1px 2px;
  border: 1px solid var(--app-border);
  border-radius: 0;
  background: var(--app-surface);
}

.path-field-row {
  display: flex;
  align-items: center;
  gap: 4px;
  min-width: 0;
}

.path-field-row input,
.path-field-row .path-input {
  flex: 1;
  min-width: 0;
}

.media-path-panel label {
  display: grid;
  gap: 2px;
  min-width: 0;
}

.media-path-panel span {
  color: var(--app-text-muted);
  font-size: 11px;
}

.media-path-panel input,
.media-path-panel button {
  height: 20px;
  min-height: 20px;
  padding: 0 4px;
  border: 1px solid var(--app-border);
  border-radius: 0;
  background: var(--app-bg);
  color: var(--app-text);
  font: inherit;
  font-size: 12px;
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
  gap: 2px;
  min-width: 220px;
  padding: 2px 4px;
  border: 1px solid var(--app-border);
  border-radius: 0;
  background: var(--app-surface);
  color: var(--app-text-muted);
  font-size: 11px;
  text-align: right;
}

.media-summary-grid,
.media-side-grid {
  display: grid;
  gap: 6px;
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
  gap: 2px 4px;
  min-height: 20px;
  padding: 2px 4px;
  border: 1px solid var(--app-border);
  border-radius: 0;
  background: var(--app-surface);
}

.media-report-panel {
  gap: 4px 6px;
  padding: 4px 6px;
  border: 1px solid #a0a0a0;
}

.media-summary-item {
  gap: 2px;
}

.media-summary-item strong {
  font-size: 12px;
  line-height: 16px;
}

.media-summary-item span,
.media-side header span,
.media-report-panel header span {
  color: var(--app-text-muted);
  font-size: 11px;
  line-height: 16px;
}

.media-side header,
.media-report-panel header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 6px;
  min-height: 20px;
}

.media-report-panel header button {
  margin-left: auto;
  height: 18px;
  min-height: 18px;
  padding: 0 5px;
  font-size: 11px;
  line-height: 18px;
}

.media-side dl {
  display: grid;
  grid-template-columns: repeat(5, minmax(0, 1fr));
  gap: 4px;
  margin: 0;
}

.media-side dl div {
  display: grid;
  gap: 2px;
  min-width: 0;
  min-height: 18px;
  padding: 2px 4px;
  border: 1px solid var(--app-border);
  border-radius: 0;
  background: var(--app-bg);
}

.media-side dt {
  color: var(--app-text-muted);
  font-size: 11px;
  line-height: 14px;
}

.media-side dd {
  min-width: 0;
  margin: 0;
  overflow: hidden;
  font-size: 11px;
  font-weight: 700;
  line-height: 14px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.media-report-table {
  display: grid;
  overflow: auto;
  border: 1px solid var(--app-border);
  border-radius: 0;
  background: var(--app-bg);
}

.media-field-row.selected {
  outline: 1px solid var(--app-accent, #2563eb);
  background: rgb(37 99 235 / 0.08);
}

.media-field-row {
  display: grid;
  grid-template-columns: 140px minmax(160px, 1fr) minmax(160px, 1fr) 98px 98px;
  min-width: 760px;
  min-height: 18px;
  border-bottom: 1px solid #a0a0a0;
  font-size: 11px;
}

.media-field-minor {
  opacity: 0.78;
}

.media-rules-panel {
  display: grid;
  gap: 2px 4px;
  min-height: 18px;
  padding: 2px 4px;
  border: 1px solid #a0a0a0;
  border-radius: 0;
  background: #f0f0f0;
}

.media-rules-panel header {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 4px;
  min-height: 18px;
}

.media-rules-panel header button {
  margin-left: auto;
  height: 18px;
  min-height: 18px;
  padding: 0 5px;
  font-size: 11px;
  line-height: 18px;
}

.media-rules-panel header span {
  color: var(--app-text-muted);
  font-size: 11px;
  line-height: 16px;
}

.media-rules-list {
  display: grid;
  gap: 2px;
  max-height: 220px;
  overflow: auto;
}

.media-rule-row {
  display: grid;
  grid-template-columns: 16px minmax(0, 1fr) auto;
  align-items: center;
  gap: 4px;
  min-height: 16px;
  font-size: 11px;
  line-height: 16px;
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
  padding: 2px 6px;
  overflow: hidden;
  border-right: 1px solid #a0a0a0;
  font-style: normal;
  line-height: 16px;
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
  gap: 4px 6px;
  padding: 2px 4px;
  border: 1px solid var(--app-border);
  border-radius: 0;
  background: var(--app-surface);
}

.media-playback-header {
  display: none;
  flex-wrap: wrap;
  align-items: center;
  gap: 6px;
  min-height: 20px;
  font-size: 11px;
  line-height: 16px;
}

.media-sync-toggle {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-size: 11px;
}

.media-players {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 4px;
}

.media-player-card {
  display: grid;
  gap: 4px;
  min-width: 0;
}

.media-player-card > span {
  display: none;
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
  gap: 4px;
  min-height: 26px;
  padding: 1px 4px;
  border: 0;
  border-top: 1px solid #c0c0c0;
  border-radius: 0;
  background: #f0f0f0;
}

.media-scrub-play {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  height: 26px;
  min-height: 26px;
  padding: 0 2px;
  border: 0;
  border-radius: 0;
  background: transparent;
  color: #606060;
  font: inherit;
  font-size: 11px;
  line-height: 16px;
  cursor: pointer;
}

.media-scrub-icon {
  flex: 0 0 auto;
}

.media-scrub {
  flex: 1;
  min-width: 160px;
  height: 19.5px;
  min-height: 19.5px;
  accent-color: #808080;
  background: #f0f0f0;
}

.media-scrub-row span {
  display: none;
  font-size: 11px;
  line-height: 16px;
}

.media-playback-hint {
  display: none;
  margin: 0;
  color: var(--app-text-muted);
  font-size: 11px;
  line-height: 16px;
}

.bc-path-footers {
  display: grid;
  grid-template-columns: 1fr 1fr;
  grid-column: 1 / -1;
  gap: 0;
  width: 100%;
  margin-top: 0;
  padding: 0 2px;
}

.path-side-footer {
  min-height: 18px;
  margin-top: 0;
  overflow: hidden;
  color: #111111;
  font-size: 11px;
  line-height: 16px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.path-side-footer-muted {
  color: #9ca3af;
}
</style>
