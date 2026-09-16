<script setup lang="ts">
import { computed, onMounted, ref, watch, watchEffect } from 'vue'
import { useRouter } from 'vue-router'
import { comparePictureFiles, pathFileStamp, saveTextFile } from '@/api/diff'
import { buildPictureReportText, defaultPictureReportOutputPath } from '@/app/pictureReport'
import { localFileSrc } from '@/app/localFileSrc'
import type { FileStamp, PictureCompareResponse, PictureMetadataRow } from '@/types/diff'
import WorkbenchShell from '@/components/workbench/WorkbenchShell.vue'
import WorkbenchInspector from '@/components/workbench/WorkbenchInspector.vue'
import StatusSummaryGrid from '@/components/workbench/StatusSummaryGrid.vue'
import { buildPictureCompareToolbar, pathPairTitle } from '@/app/sessionToolbars'
import {
  loadPictureCompareOptions,
  pictureBlendModes,
  pictureIgnoreColors,
  savePictureCompareOptions,
  type PictureBlendMode,
  type PictureCompareOptionsState,
} from '@/app/pictureCompareOptions'
import { useSessionLaunchStore } from '@/stores/sessionLaunch'
import { useTabsStore } from '@/stores/tabs'
import { useStatusBarStore } from '@/stores/statusBar'
import { elapsedSecondsSince } from '@/app/statusBarPhrases'
import { formatPathModifiedAt } from '@/app/pathMetadata'
import { useViewActionsStore } from '@/stores/viewActions'
import { useI18n } from '@/i18n'
import SessionSettingsDialog from '@/components/session/SessionSettingsDialog.vue'

const zoom = ref(100)
const panX = ref(0)
const panY = ref(0)
const showOverlay = ref(true)
const rotationDeg = ref(0)
const flipHorizontal = ref(false)
const flipVertical = ref(false)
const alignmentOffsetX = ref(0)
const alignmentOffsetY = ref(0)
const pixelPreview = ref<{
  side: 'Left' | 'Right'
  x: number
  y: number
  color: string
} | null>(null)
const { t } = useI18n()
const leftPath = ref('')
const rightPath = ref('')
const leftFileStamp = ref<FileStamp | null>(null)
const rightFileStamp = ref<FileStamp | null>(null)
const leftPictureDimensions = ref('')
const rightPictureDimensions = ref('')
const sessionLaunch = useSessionLaunchStore()
const tabs = useTabsStore()
const router = useRouter()
const leftPictureName = ref('')
const rightPictureName = ref('')
const loading = ref(false)
const error = ref('')
const initialPictureOptions = loadPictureCompareOptions()
const rgbTolerance = ref(initialPictureOptions.rgbTolerance)
const compareAlpha = ref(initialPictureOptions.compareAlpha)
const alphaTolerance = ref(initialPictureOptions.alphaTolerance)
const ignoreColorFrom = ref<number[] | null>(initialPictureOptions.ignoreColorFrom)
const ignoreColorTo = ref<number[] | null>(initialPictureOptions.ignoreColorTo)
const showSessionSettings = ref(false)
const viewActions = useViewActionsStore()
const showTolPanel = ref(false)
const showRangePanel = ref(false)
const blendEnabled = ref(initialPictureOptions.blendEnabled)
const blendOpacity = ref(initialPictureOptions.blendOpacity)
const blendMode = ref<PictureBlendMode>(initialPictureOptions.blendMode)
const showMetaPanel = ref(initialPictureOptions.showMeta)
const showMinor = ref(initialPictureOptions.showMinor)
const showBlendPanel = ref(false)
const metadataRows = ref<PictureMetadataRow[]>([])
const pictureStatistics = ref<PictureCompareResponse['statistics']>({
  totalPixels: 0,
  differentPixels: 0,
  differenceRatio: 0,
})
const compared = ref(false)
const reportStatus = ref('')
const loadTimeSeconds = ref<number | null>(null)
const statusBar = useStatusBarStore()
const leftImageSrc = computed(() => (compared.value ? localFileSrc(leftPath.value) : ''))
const rightImageSrc = computed(() => (compared.value ? localFileSrc(rightPath.value) : ''))
const overlayStyle = computed(() => {
  const rect = pictureStatistics.value.boundingRect

  if (!rect) {
    return {}
  }

  return {
    left: `${String(rect.x)}px`,
    top: `${String(rect.y)}px`,
    width: `${String(rect.width)}px`,
    height: `${String(rect.height)}px`,
  }
})

function openPictureSessionSettings(): void {
  showSessionSettings.value = true
}

function applyPictureSessionSettings(
  payload:
    | { kind: 'folder'; criteria: unknown }
    | { kind: 'text'; options: unknown }
    | { kind: 'table'; options: unknown }
    | { kind: 'hex'; options: unknown }
    | { kind: 'picture'; options: PictureCompareOptionsState },
): void {
  if (payload.kind !== 'picture') {
    return
  }

  rgbTolerance.value = payload.options.rgbTolerance
  compareAlpha.value = payload.options.compareAlpha
  alphaTolerance.value = payload.options.alphaTolerance
  ignoreColorFrom.value = payload.options.ignoreColorFrom
  ignoreColorTo.value = payload.options.ignoreColorTo
  blendEnabled.value = payload.options.blendEnabled
  blendOpacity.value = payload.options.blendOpacity
  blendMode.value = payload.options.blendMode
  showMetaPanel.value = payload.options.showMeta
  showMinor.value = payload.options.showMinor
  savePictureCompareOptions({
    rgbTolerance: payload.options.rgbTolerance,
    compareAlpha: payload.options.compareAlpha,
    alphaTolerance: payload.options.alphaTolerance,
    ignoreColorFrom: payload.options.ignoreColorFrom,
    ignoreColorTo: payload.options.ignoreColorTo,
    blendEnabled: payload.options.blendEnabled,
    blendOpacity: payload.options.blendOpacity,
    blendMode: payload.options.blendMode,
    showMeta: payload.options.showMeta,
    showMinor: payload.options.showMinor,
  })
  showSessionSettings.value = false
  if (leftPath.value && rightPath.value) {
    void runPictureCompare()
  }
}

watch(
  () => [viewActions.sequence, viewActions.name] as const,
  ([, actionName]) => {
    if (!actionName) {
      return
    }

    switch (actionName) {
      case 'session-settings':
      case 'rules':
        openPictureSessionSettings()
        break
      case 'compare':
      case 'reload':
        void runPictureCompare()
        break
      case 'swap':
        swapPicturePaths()
        break
      case 'export':
      case 'save':
      case 'save-as':
        void exportPictureReport()
        break
      case 'toggle-minor':
        showMinor.value = !showMinor.value
        break
      case 'about':
      case 'check-for-updates':
      case 'close-tab':
      case 'clear-session':
      case 'copy':
      case 'copy-left':
      case 'copy-right':
      case 'cut':
      case 'delete':
      case 'export-settings':
      case 'filters':
      case 'help-contents':
      case 'help-support':
      case 'import-settings':
      case 'next-difference':
      case 'paste':
      case 'previous-difference':
      case 'redo':
      case 'save-snapshot':
      case 'restore-factory-defaults':
      case 'show-all':
      case 'show-differences':
      case 'undo':
      case 'workspace-load':
      case 'collapse-all':
      case 'expand-all':
      case 'next-conflict':
      case 'previous-conflict':
      case 'sync-now':
      case 'browse-folder':
      case 'up-one-level':
      case 'path-back':
      case 'path-forward':
      case 'toggle-session-locked':
      case 'workspace-save':
      case 'select-all':
      case 'select-all-files':
      case 'select-orphans':
      case 'invert-selection':
      case 'open-selected':
      case 'open-with':
      case 'quick-compare':
      case 'exclude-selected':
      case 'refresh-selection':
      case 'show-same':
      case 'run-script':
      case 'save-report':
      case 'find-filename':
      case 'toggle-columns':
      case 'toggle-log':
      case 'toggle-toolbar':
      case 'change-attributes':
      case 'touch-selected':
        break
    }
  },
)

onMounted(() => {
  const launch = sessionLaunch.consumeLaunch('/compare/picture')

  if (!launch) {
    return
  }

  leftPath.value = launch.locations.left?.uri ?? leftPath.value
  rightPath.value = launch.locations.right?.uri ?? rightPath.value

  if (launch.autoRun && launch.locations.left?.uri && launch.locations.right?.uri) {
    void runPictureCompare()
  }
})

const sharedTransformParts = computed(() => [
  `translate(${String(panX.value)}px, ${String(panY.value)}px)`,
  `rotate(${String(rotationDeg.value)}deg)`,
  `scaleX(${flipHorizontal.value ? '-1' : '1'})`,
  `scaleY(${flipVertical.value ? '-1' : '1'})`,
  `scale(${String(zoom.value / 100)})`,
])

const imageTransform = computed(() => sharedTransformParts.value.join(' '))

const rightImageTransform = computed(() =>
  [
    ...sharedTransformParts.value,
    `translate(${String(alignmentOffsetX.value)}px, ${String(alignmentOffsetY.value)}px)`,
  ].join(' '),
)

const imageStyle = computed<Record<string, string>>(() => ({
  transform: imageTransform.value,
}))

const rightImageStyle = computed<Record<string, string>>(() => ({
  transform: rightImageTransform.value,
}))

const pictureDifferenceRatioText = computed(() => {
  if (!compared.value) {
    return '--'
  }

  return `${(pictureStatistics.value.differenceRatio * 100).toFixed(2)}%`
})

const pictureTotalPixelsText = computed(() =>
  compared.value ? String(pictureStatistics.value.totalPixels) : '--',
)
const pictureDifferentPixelsText = computed(() =>
  compared.value ? String(pictureStatistics.value.differentPixels) : '--',
)

const pictureBoundingRectText = computed(() => {
  if (!compared.value) {
    return '--'
  }

  const rect = pictureStatistics.value.boundingRect

  if (!rect) {
    return '--'
  }

  return `${String(rect.x)}, ${String(rect.y)}, ${String(rect.width)} x ${String(rect.height)}`
})

function syncPictureTabTitle(): void {
  if (!leftPath.value || !rightPath.value) {
    return
  }

  tabs.setTabTitle('/compare/picture', pathPairTitle(leftPath.value, rightPath.value))
}

function goHomeFromPicture(): void {
  tabs.openTab({ title: 'Home', titleKey: 'ui.home', route: '/', dirty: false })
  void router.push('/')
}

function swapPicturePaths(): void {
  const nextLeftPath = rightPath.value

  rightPath.value = leftPath.value
  leftPath.value = nextLeftPath
  const nextLeftName = rightPictureName.value

  rightPictureName.value = leftPictureName.value
  leftPictureName.value = nextLeftName
  syncPictureTabTitle()
  if (leftPath.value && rightPath.value && compared.value) {
    void runPictureCompare()
  }
}

const pictureSessionToolbar = computed(() =>
  buildPictureCompareToolbar({
    home: true,
    tol: true,
    range: true,
    blend: true,
    minor: true,
    rules: true,
    format: true,
    sessions: true,
    swap: Boolean(leftPath.value || rightPath.value),
    reload: Boolean(leftPath.value && rightPath.value),
    meta: true,
  }).map((item) => ({
    ...item,
    active:
      (item.id === 'tol' && showTolPanel.value) ||
      (item.id === 'range' && showRangePanel.value) ||
      (item.id === 'blend' && blendEnabled.value) ||
      (item.id === 'minor' && showMinor.value) ||
      (item.id === 'format' && showSessionSettings.value) ||
      (item.id === 'sessions' && showSessionSettings.value) ||
      (item.id === 'meta' && showMetaPanel.value),
  })),
)

function clampByte(value: number, fallback = 0): number {
  if (!Number.isFinite(value)) {
    return fallback
  }

  return Math.min(255, Math.max(0, Math.round(value)))
}

const pictureOptionsSnapshot = computed<PictureCompareOptionsState>(() => ({
  rgbTolerance: clampByte(rgbTolerance.value),
  compareAlpha: compareAlpha.value,
  alphaTolerance: clampByte(alphaTolerance.value),
  ignoreColorFrom: ignoreColorFrom.value,
  ignoreColorTo: ignoreColorTo.value,
  blendEnabled: blendEnabled.value,
  blendOpacity: Math.min(100, Math.max(0, Math.round(blendOpacity.value))),
  blendMode: blendMode.value,
  showMeta: showMetaPanel.value,
  showMinor: showMinor.value,
}))

const visibleMetadataRows = computed(() => {
  if (!showMinor.value) {
    return metadataRows.value
  }

  return metadataRows.value.filter((row) => row.status !== 'equal')
})

const blendOverlayStyle = computed(() => ({
  opacity: String(blendOpacity.value / 100),
  mixBlendMode: blendMode.value,
}))

const blendModeOptions = pictureBlendModes.map((mode) => ({
  value: mode,
  labelKey: `ui.blendMode${mode[0].toUpperCase()}${mode.slice(1)}`,
}))

function onBlendModeChange(event: Event): void {
  const target = event.target

  if (!(target instanceof HTMLSelectElement)) {
    return
  }
  blendMode.value = (pictureBlendModes as readonly string[]).includes(target.value)
    ? (target.value as PictureBlendMode)
    : 'normal'
  persistPictureOptions()
}

const ignoreFromChannels = computed(() => ignoreColorFrom.value ?? [0, 0, 0, 255])
const ignoreToChannels = computed(() => ignoreColorTo.value ?? [0, 0, 0, 255])
const hasIgnoreColorRule = computed(() => Boolean(ignoreColorFrom.value && ignoreColorTo.value))

function persistPictureOptions(): void {
  savePictureCompareOptions(pictureOptionsSnapshot.value)
}

function maybeRerunPictureCompare(): void {
  if (compared.value && leftPath.value && rightPath.value) {
    void runPictureCompare()
  }
}

function updateIgnoreChannel(side: 'from' | 'to', index: number, event: Event): void {
  const target = event.target

  if (!(target instanceof HTMLInputElement)) {
    return
  }

  const current = side === 'from' ? [...ignoreFromChannels.value] : [...ignoreToChannels.value]
  const numeric = Number(target.value)

  current[index] = clampByte(numeric)

  if (side === 'from') {
    ignoreColorFrom.value = current
    ignoreColorTo.value ??= [...ignoreToChannels.value]
  } else {
    ignoreColorTo.value = current
    ignoreColorFrom.value ??= [...ignoreFromChannels.value]
  }
}

function clearIgnoreColors(): void {
  ignoreColorFrom.value = null
  ignoreColorTo.value = null
}

function runPictureToolbarCommand(commandId: string): void {
  switch (commandId) {
    case 'home':
      goHomeFromPicture()
      break
    case 'tol':
      showTolPanel.value = !showTolPanel.value
      if (showTolPanel.value) {
        showRangePanel.value = false
        showBlendPanel.value = false
      }
      break
    case 'range':
      showRangePanel.value = !showRangePanel.value
      if (showRangePanel.value) {
        showTolPanel.value = false
        showBlendPanel.value = false
      }
      break
    case 'blend':
      blendEnabled.value = !blendEnabled.value
      showBlendPanel.value = blendEnabled.value
      if (showBlendPanel.value) {
        showTolPanel.value = false
        showRangePanel.value = false
      }
      persistPictureOptions()
      break
    case 'minor':
      showMinor.value = !showMinor.value
      persistPictureOptions()
      break
    case 'rules':
      openPictureSessionSettings()
      break
    case 'format':
      openPictureSessionSettings()
      break
    case 'sessions':
      openPictureSessionSettings()
      break
    case 'meta':
      showMetaPanel.value = !showMetaPanel.value
      persistPictureOptions()
      break
    case 'swap':
      swapPicturePaths()
      break
    case 'reload':
      void runPictureCompare()
      break
    default:
      break
  }
}

watch([leftPath, rightPath], () => {
  syncPictureTabTitle()
})

watch(
  pictureOptionsSnapshot,
  () => {
    persistPictureOptions()
    maybeRerunPictureCompare()
  },
  { deep: true },
)

function rotatePicture(delta: number): void {
  rotationDeg.value = (rotationDeg.value + delta + 360) % 360
}

function metadataLabel(row: PictureMetadataRow): string {
  return row.label.startsWith('ui.') ? t(row.label) : row.label
}

function updatePixelPreview(side: 'Left' | 'Right', event: MouseEvent): void {
  const x = Math.max(0, Math.round(event.offsetX || event.clientX))
  const y = Math.max(0, Math.round(event.offsetY || event.clientY))

  pixelPreview.value = {
    side,
    x,
    y,
    color: 'rgb(--, --, --)',
  }
}

const leftPathFooterLabel = computed(() =>
  formatPicturePathFooter(leftFileStamp.value, leftPictureDimensions.value),
)
const rightPathFooterLabel = computed(() =>
  formatPicturePathFooter(rightFileStamp.value, rightPictureDimensions.value),
)

function formatPicturePathFooter(stamp: FileStamp | null, dimensions: string): string {
  if (!stamp) {
    return ''
  }

  const modified = formatPathModifiedAt(stamp.modifiedAtMs)
  const base = modified
    ? t('status.pathFileMetadata', { bytes: stamp.size, modified })
    : t('status.bytes', { count: stamp.size })

  if (!dimensions) {
    return base
  }

  return t('status.pathFileMetadataWithDetail', { metadata: base, detail: dimensions })
}

async function refreshPicturePathStamps(): Promise<void> {
  const [left, right] = await Promise.all([
    leftPath.value ? pathFileStamp(leftPath.value).catch(() => null) : Promise.resolve(null),
    rightPath.value ? pathFileStamp(rightPath.value).catch(() => null) : Promise.resolve(null),
  ])

  leftFileStamp.value = left
  rightFileStamp.value = right
}

function applyPictureResult(result: PictureCompareResponse): void {
  leftPictureName.value = result.left.name
  rightPictureName.value = result.right.name
  leftPictureDimensions.value = result.left.dimensions
  rightPictureDimensions.value = result.right.dimensions
  metadataRows.value = result.metadataRows
  pictureStatistics.value = result.statistics
  syncPictureTabTitle()
}

async function exportPictureReport(): Promise<void> {
  if (!compared.value) {
    return
  }

  const payload = buildPictureReportText({
    leftPath: leftPath.value,
    rightPath: rightPath.value,
    statistics: pictureStatistics.value,
    metadataRows: visibleMetadataRows.value,
    boundingRectText: pictureBoundingRectText.value,
  })
  const outputPath = defaultPictureReportOutputPath(leftPath.value)

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
    error.value = String(event)
  }
}

watchEffect(() => {
  let comparisonStatus = t('status.readyIdle')

  if (loading.value) {
    comparisonStatus = t('status.comparing')
  } else if (compared.value) {
    comparisonStatus = t('status.compared')
  }

  statusBar.reportStatus({
    comparisonStatus,
    differenceCount: compared.value ? pictureStatistics.value.differentPixels : null,
    filterStatus: t('status.allRows'),
    source: 'picture-compare',
    loadTimeSeconds: compared.value ? loadTimeSeconds.value : null,
    chromeKind: 'picture-session',
  })
})

async function runPictureCompare(): Promise<void> {
  const startedAt = performance.now()

  loading.value = true
  error.value = ''
  try {
    const result = await comparePictureFiles({
      leftPath: leftPath.value,
      rightPath: rightPath.value,
      rgbTolerance: pictureOptionsSnapshot.value.rgbTolerance,
      compareAlpha: pictureOptionsSnapshot.value.compareAlpha,
      alphaTolerance: pictureOptionsSnapshot.value.alphaTolerance,
      ...pictureIgnoreColors(pictureOptionsSnapshot.value),
    })

    applyPictureResult(result)
    compared.value = true
    loadTimeSeconds.value = elapsedSecondsSince(startedAt)
    await refreshPicturePathStamps()
  } catch (event) {
    error.value = String(event)
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <WorkbenchShell
    :title="$t('ui.pictureCompare')"
    :eyebrow="$t('ui.picture')"
    :subtitle="pictureDifferenceRatioText"
    :inspector-label="$t('ui.pictureCompareInspector')"
    :toolbar-commands="pictureSessionToolbar"
    toolbar-test-id-prefix="picture-session-toolbar"
    @toolbar-command="runPictureToolbarCommand"
  >
    <section class="picture-compare-view">
      <header class="picture-header">
        <div>
          <p class="eyebrow">{{ $t('ui.pictureCompare') }}</p>
          <h1>{{ $t('ui.pictureCompare') }}</h1>
        </div>
        <div class="picture-summary">
          <strong data-testid="picture-zoom-value">{{ zoom }}%</strong>
          <span>{{ $t('ui.sharedZoom') }}</span>
        </div>
      </header>

      <section class="picture-path-panel">
        <label>
          <span>{{ $t('ui.left') }} {{ $t('ui.path') }}</span>
          <input
            v-model="leftPath"
            type="text"
            data-testid="picture-left-path"
          />
        </label>
        <label>
          <span>{{ $t('ui.right') }} {{ $t('ui.path') }}</span>
          <input
            v-model="rightPath"
            type="text"
            data-testid="picture-right-path"
          />
        </label>
        <button
          type="button"
          data-testid="run-picture-compare"
          :disabled="loading"
          @click="runPictureCompare"
        >
          {{ $t('ui.runDiff') }}
        </button>

        <div
          class="bc-path-footers"
          data-testid="picture-path-footers"
        >
          <span
            class="path-side-footer"
            :class="{ 'path-side-footer-muted': !leftPathFooterLabel }"
            data-testid="picture-left-path-footer"
            >{{ leftPathFooterLabel || $t('status.panePlaceholder') }}</span
          >
          <span
            class="path-side-footer"
            :class="{ 'path-side-footer-muted': !rightPathFooterLabel }"
            data-testid="picture-right-path-footer"
            >{{ rightPathFooterLabel || $t('status.panePlaceholder') }}</span
          >
        </div>
      </section>
      <p
        v-if="error"
        class="picture-error"
        data-testid="picture-compare-error"
      >
        {{ error }}
      </p>
      <p
        v-else-if="!compared"
        class="empty"
        data-testid="picture-empty-hint"
      >
        {{ $t('ui.emptyCompareHint') }}
      </p>

      <section
        v-if="showTolPanel"
        class="picture-options-panel"
        data-testid="picture-tol-panel"
      >
        <header>
          <h2>{{ $t('ui.tol') }}</h2>
          <span>{{ $t('ui.rgbTolerance') }}</span>
        </header>
        <label>
          <span>{{ $t('ui.rgbTolerance') }}</span>
          <input
            v-model.number="rgbTolerance"
            type="number"
            min="0"
            max="255"
            step="1"
            data-testid="picture-rgb-tolerance"
          />
        </label>
        <label class="picture-toggle picture-options-toggle">
          <input
            v-model="compareAlpha"
            type="checkbox"
            data-testid="picture-compare-alpha"
          />
          <span>{{ $t('ui.compareAlpha') }}</span>
        </label>
        <label v-if="compareAlpha">
          <span>{{ $t('ui.alphaTolerance') }}</span>
          <input
            v-model.number="alphaTolerance"
            type="number"
            min="0"
            max="255"
            step="1"
            data-testid="picture-alpha-tolerance"
          />
        </label>
      </section>

      <section
        v-if="showRangePanel"
        class="picture-options-panel"
        data-testid="picture-range-panel"
      >
        <header>
          <h2>{{ $t('ui.range') }}</h2>
          <span>{{ $t('ui.ignoreColorReplacement') }}</span>
        </header>
        <div class="picture-color-rule">
          <span>{{ $t('ui.ignoreColorFrom') }}</span>
          <input
            :value="ignoreFromChannels[0]"
            type="number"
            min="0"
            max="255"
            data-testid="picture-ignore-from-r"
            @input="updateIgnoreChannel('from', 0, $event)"
          />
          <input
            :value="ignoreFromChannels[1]"
            type="number"
            min="0"
            max="255"
            data-testid="picture-ignore-from-g"
            @input="updateIgnoreChannel('from', 1, $event)"
          />
          <input
            :value="ignoreFromChannels[2]"
            type="number"
            min="0"
            max="255"
            data-testid="picture-ignore-from-b"
            @input="updateIgnoreChannel('from', 2, $event)"
          />
          <input
            :value="ignoreFromChannels[3]"
            type="number"
            min="0"
            max="255"
            data-testid="picture-ignore-from-a"
            @input="updateIgnoreChannel('from', 3, $event)"
          />
        </div>
        <div class="picture-color-rule">
          <span>{{ $t('ui.ignoreColorTo') }}</span>
          <input
            :value="ignoreToChannels[0]"
            type="number"
            min="0"
            max="255"
            data-testid="picture-ignore-to-r"
            @input="updateIgnoreChannel('to', 0, $event)"
          />
          <input
            :value="ignoreToChannels[1]"
            type="number"
            min="0"
            max="255"
            data-testid="picture-ignore-to-g"
            @input="updateIgnoreChannel('to', 1, $event)"
          />
          <input
            :value="ignoreToChannels[2]"
            type="number"
            min="0"
            max="255"
            data-testid="picture-ignore-to-b"
            @input="updateIgnoreChannel('to', 2, $event)"
          />
          <input
            :value="ignoreToChannels[3]"
            type="number"
            min="0"
            max="255"
            data-testid="picture-ignore-to-a"
            @input="updateIgnoreChannel('to', 3, $event)"
          />
        </div>
        <button
          type="button"
          data-testid="picture-clear-ignore-colors"
          @click="clearIgnoreColors"
        >
          {{ $t('ui.clear') }}
        </button>
        <p
          class="picture-options-hint"
          data-testid="picture-range-status"
        >
          {{
            hasIgnoreColorRule
              ? $t('ui.ignoreColorReplacementOn')
              : $t('ui.ignoreColorReplacementOff')
          }}
        </p>
      </section>

      <section class="picture-stat-grid">
        <article>
          <span>{{ $t('ui.totalPixels') }}</span>
          <strong data-testid="picture-total-pixels">{{ pictureTotalPixelsText }}</strong>
        </article>
        <article>
          <span>{{ $t('ui.differentPixels') }}</span>
          <strong data-testid="picture-different-pixels">
            {{ pictureDifferentPixelsText }}
          </strong>
        </article>
        <article>
          <span>{{ $t('ui.differenceRatio') }}</span>
          <strong data-testid="picture-difference-ratio">{{ pictureDifferenceRatioText }}</strong>
        </article>
        <article>
          <span>{{ $t('ui.boundingRect') }}</span>
          <strong data-testid="picture-bounding-rect">{{ pictureBoundingRectText }}</strong>
        </article>
      </section>

      <section class="picture-controls">
        <label>
          <span>{{ $t('ui.zoom') }}</span>
          <input
            v-model.number="zoom"
            type="range"
            min="50"
            max="200"
            step="10"
            data-testid="picture-zoom-control"
          />
        </label>
        <label>
          <span>{{ $t('ui.panX') }}</span>
          <input
            v-model.number="panX"
            type="range"
            min="-80"
            max="80"
            step="4"
            data-testid="picture-pan-x"
          />
        </label>
        <label>
          <span>{{ $t('ui.panY') }}</span>
          <input
            v-model.number="panY"
            type="range"
            min="-80"
            max="80"
            step="4"
            data-testid="picture-pan-y"
          />
        </label>
        <label class="picture-toggle">
          <input
            v-model="showOverlay"
            type="checkbox"
            data-testid="picture-overlay-toggle"
          />
          <span>{{ $t('ui.overlay') }}</span>
        </label>
        <div class="picture-transform-tools">
          <button
            type="button"
            data-testid="picture-rotate-counterclockwise"
            @click="rotatePicture(-90)"
          >
            {{ $t('ui.rotateLeft') }}
          </button>
          <button
            type="button"
            data-testid="picture-rotate-clockwise"
            @click="rotatePicture(90)"
          >
            {{ $t('ui.rotateRight') }}
          </button>
          <button
            type="button"
            data-testid="picture-flip-horizontal"
            @click="flipHorizontal = !flipHorizontal"
          >
            {{ $t('ui.flipH') }}
          </button>
          <button
            type="button"
            data-testid="picture-flip-vertical"
            @click="flipVertical = !flipVertical"
          >
            {{ $t('ui.flipV') }}
          </button>
        </div>
        <div class="picture-alignment-controls">
          <label>
            <span>{{ $t('ui.offsetX') }}</span>
            <input
              v-model.number="alignmentOffsetX"
              type="number"
              min="-200"
              max="200"
              step="1"
              data-testid="picture-align-x"
            />
          </label>
          <label>
            <span>{{ $t('ui.offsetY') }}</span>
            <input
              v-model.number="alignmentOffsetY"
              type="number"
              min="-200"
              max="200"
              step="1"
              data-testid="picture-align-y"
            />
          </label>
        </div>
        <div
          class="picture-pixel-preview"
          data-testid="picture-pixel-preview"
        >
          <span>{{ pixelPreview?.side ?? $t('ui.noPixel') }}</span>
          <strong data-testid="picture-pixel-coordinates">
            {{ pixelPreview ? `${pixelPreview.x}, ${pixelPreview.y}` : '--, --' }}
          </strong>
          <span
            class="picture-pixel-swatch"
            :style="{ backgroundColor: pixelPreview?.color ?? 'transparent' }"
          ></span>
          <strong data-testid="picture-pixel-color">{{
            pixelPreview?.color ?? 'rgb(--, --, --)'
          }}</strong>
        </div>
      </section>

      <section
        v-if="showBlendPanel || blendEnabled"
        class="picture-blend-panel"
        data-testid="picture-blend-panel"
      >
        <header>
          <strong>{{ $t('ui.blend') }}</strong>
          <span
            >{{ $t('ui.blendOpacity') }}: {{ blendOpacity }}% ·
            {{ $t(`ui.blendMode${blendMode[0].toUpperCase()}${blendMode.slice(1)}`) }}</span
          >
        </header>
        <label>
          <span>{{ $t('ui.blendMode') }}</span>
          <select
            data-testid="picture-blend-mode"
            :value="blendMode"
            @change="onBlendModeChange"
          >
            <option
              v-for="option in blendModeOptions"
              :key="option.value"
              :value="option.value"
            >
              {{ $t(option.labelKey) }}
            </option>
          </select>
        </label>
        <label>
          <span>{{ $t('ui.blendOpacity') }}</span>
          <input
            v-model.number="blendOpacity"
            type="range"
            min="0"
            max="100"
            step="1"
            data-testid="picture-blend-opacity"
            @change="persistPictureOptions"
          />
        </label>
      </section>

      <section class="picture-pane-grid">
        <section
          class="picture-side"
          data-testid="left-picture-pane"
        >
          <h2>{{ $t('ui.left') }}: {{ leftPictureName }}</h2>
          <div
            class="picture-canvas-frame"
            data-testid="picture-canvas-frame"
          >
            <div
              class="picture-image left-image"
              :style="imageStyle"
              data-testid="left-picture-image"
              @mousemove="updatePixelPreview('Left', $event)"
              @mouseleave="pixelPreview = null"
            >
              <img
                v-if="leftImageSrc"
                :src="leftImageSrc"
                :alt="leftPictureName"
                data-testid="left-picture-img"
              />
              <img
                v-if="blendEnabled && rightImageSrc"
                class="picture-blend-overlay"
                :src="rightImageSrc"
                :alt="rightPictureName"
                :style="blendOverlayStyle"
                data-testid="picture-blend-overlay"
              />
              <span
                v-if="showOverlay && pictureStatistics.boundingRect"
                class="picture-diff-overlay"
                data-testid="picture-diff-overlay"
                :class="{ 'picture-diff-overlay-minor': showMinor }"
              >
                <span
                  class="picture-diff-region"
                  data-testid="picture-diff-region"
                  :style="overlayStyle"
                ></span>
              </span>
            </div>
          </div>
        </section>

        <section
          class="picture-side"
          data-testid="right-picture-pane"
        >
          <h2>{{ $t('ui.right') }}: {{ rightPictureName }}</h2>
          <div
            class="picture-canvas-frame"
            data-testid="picture-canvas-frame"
          >
            <div
              class="picture-image right-image"
              :style="rightImageStyle"
              data-testid="right-picture-image"
              @mousemove="updatePixelPreview('Right', $event)"
              @mouseleave="pixelPreview = null"
            >
              <img
                v-if="rightImageSrc"
                :src="rightImageSrc"
                :alt="rightPictureName"
                data-testid="right-picture-img"
              />
              <span
                v-if="showOverlay && pictureStatistics.boundingRect"
                class="picture-diff-overlay"
                data-testid="picture-diff-overlay"
              >
                <span
                  class="picture-diff-region"
                  :style="overlayStyle"
                  data-testid="picture-diff-region"
                ></span>
              </span>
            </div>
          </div>
        </section>
      </section>

      <section
        v-if="showMetaPanel"
        class="picture-metadata-panel"
        data-testid="picture-metadata-panel"
      >
        <header class="metadata-header">
          <h2>{{ $t('ui.metadata') }}</h2>
          <span>{{ $t('ui.leftVsRight') }}</span>
        </header>
        <div class="metadata-grid">
          <div class="metadata-grid-heading">{{ $t('ui.field') }}</div>
          <div class="metadata-grid-heading">{{ $t('ui.left') }}</div>
          <div class="metadata-grid-heading">{{ $t('ui.right') }}</div>
          <div class="metadata-grid-heading">{{ $t('ui.state') }}</div>
          <template
            v-for="row in visibleMetadataRows"
            :key="row.key"
          >
            <div
              class="metadata-row"
              :data-testid="`picture-metadata-${row.key}`"
              :data-metadata-status="row.status"
            >
              <div class="metadata-cell metadata-label">{{ metadataLabel(row) }}</div>
              <div class="metadata-cell">{{ row.left }}</div>
              <div class="metadata-cell">{{ row.right }}</div>
              <div class="metadata-cell metadata-status">
                {{ row.status }}
              </div>
            </div>
          </template>
        </div>
      </section>

      <section
        v-if="compared"
        class="picture-report-panel"
        data-testid="picture-report-panel"
      >
        <header>
          <strong>{{ $t('ui.pictureReport') }}</strong>
          <span>{{ $t('status.fieldCount', { count: visibleMetadataRows.length }) }}</span>
          <button
            type="button"
            data-testid="export-picture-report"
            @click="exportPictureReport"
          >
            {{ $t('ui.export') }}
          </button>
          <span
            v-if="reportStatus"
            data-testid="picture-report-status"
            >{{ reportStatus }}</span
          >
        </header>
        <div
          class="picture-report-table"
          data-testid="picture-report-table"
        >
          <div class="picture-report-row picture-report-head">
            <span>{{ $t('ui.totalPixels') }}</span>
            <span>{{ $t('ui.differentPixels') }}</span>
            <span>{{ $t('ui.differenceRatio') }}</span>
            <span>{{ $t('ui.boundingRect') }}</span>
          </div>
          <div
            class="picture-report-row"
            data-testid="picture-report-stats"
          >
            <strong>{{ pictureTotalPixelsText }}</strong>
            <code>{{ pictureDifferentPixelsText }}</code>
            <code>{{ pictureDifferenceRatioText }}</code>
            <em>{{ pictureBoundingRectText }}</em>
          </div>
        </div>
      </section>
    </section>

    <template #inspector>
      <WorkbenchInspector>
        <section class="workbench-inspector-section">
          <h2>{{ $t('ui.overlay') }}</h2>
          <StatusSummaryGrid
            :items="[
              { label: $t('ui.zoom'), value: `${zoom}%` },
              {
                label: $t('ui.differentPixels'),
                value: pictureDifferentPixelsText,
                tone: 'modified',
              },
              {
                label: $t('ui.differenceRatio'),
                value: pictureDifferenceRatioText,
                tone: 'modified',
              },
              { label: $t('ui.boundingRect'), value: pictureBoundingRectText },
            ]"
          />
        </section>
        <section class="workbench-inspector-section">
          <h2>{{ $t('ui.metadata') }}</h2>
          <dl>
            <div>
              <dt>{{ $t('ui.left') }}</dt>
              <dd>{{ leftPath }}</dd>
            </div>
            <div>
              <dt>{{ $t('ui.right') }}</dt>
              <dd>{{ rightPath }}</dd>
            </div>
            <div>
              <dt>{{ $t('ui.overlay') }}</dt>
              <dd>{{ showOverlay ? $t('ui.on') : $t('ui.off') }}</dd>
            </div>
            <div>
              <dt>{{ $t('ui.rgbTolerance') }}</dt>
              <dd data-testid="picture-inspector-tolerance">{{ rgbTolerance }}</dd>
            </div>
            <div>
              <dt>{{ $t('ui.compareAlpha') }}</dt>
              <dd data-testid="picture-inspector-alpha">
                {{ compareAlpha ? $t('ui.on') : $t('ui.off') }}
              </dd>
              <dt>{{ $t('ui.alphaTolerance') }}</dt>
              <dd data-testid="picture-inspector-alpha-tolerance">{{ alphaTolerance }}</dd>
            </div>
            <div>
              <dt>{{ $t('ui.range') }}</dt>
              <dd data-testid="picture-inspector-range">
                {{
                  hasIgnoreColorRule
                    ? $t('ui.ignoreColorReplacementOn')
                    : $t('ui.ignoreColorReplacementOff')
                }}
              </dd>
            </div>
            <div>
              <dt>{{ $t('ui.field') }}</dt>
              <dd>
                {{
                  pixelPreview ? `${pixelPreview.side} ${pixelPreview.x}, ${pixelPreview.y}` : '--'
                }}
              </dd>
            </div>
          </dl>
        </section>
      </WorkbenchInspector>
    </template>
    <SessionSettingsDialog
      :open="showSessionSettings"
      kind="picture"
      :picture-options="pictureOptionsSnapshot"
      @close="showSessionSettings = false"
      @apply="applyPictureSessionSettings"
    />
  </WorkbenchShell>
</template>
<style scoped>
.picture-compare-view {
  display: grid;
  gap: 4px;
  height: 100%;
  padding: 4px 6px;
  overflow: auto;
}

.picture-header {
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

h1,
h2 {
  margin: 0;
}

h1 {
  font-size: 22px;
  line-height: 1.2;
}

h2 {
  font-size: 13px;
}

.picture-summary {
  display: grid;
  min-width: 112px;
  padding: 10px 12px;
  border: 1px solid var(--app-border);
  border-radius: 8px;
  background: var(--app-surface);
  text-align: right;
}

.picture-summary strong {
  font-size: 18px;
  line-height: 1;
}

.picture-summary span {
  color: var(--app-text-muted);
  font-size: 12px;
}

.picture-path-panel,
.picture-stat-grid {
  display: grid;
  gap: 4px;
  padding: 4px 6px;
  border: 1px solid var(--app-border);
  border-radius: 8px;
  background: var(--app-surface);
}

.picture-path-panel {
  grid-template-columns: repeat(2, minmax(0, 1fr)) auto;
  align-items: end;
}

.picture-path-panel label,
.picture-stat-grid article {
  display: grid;
  gap: 5px;
  min-width: 0;
}

.picture-path-panel span,
.picture-stat-grid span {
  color: var(--app-text-muted);
  font-size: 12px;
}

.picture-path-panel input {
  min-height: 32px;
  padding: 0 8px;
  border: 1px solid var(--app-border);
  border-radius: 6px;
  background: var(--app-bg);
  color: var(--app-text);
  font: inherit;
  font-size: 12px;
}

.picture-path-panel button {
  min-height: 32px;
  padding: 0 12px;
  border: 1px solid var(--app-border);
  border-radius: 6px;
  background: var(--app-bg);
  color: var(--app-text);
  font: inherit;
  font-size: 12px;
}

.picture-path-panel button:hover {
  border-color: var(--app-accent);
}

.picture-path-panel button:disabled {
  opacity: 0.65;
}

.picture-error {
  margin: 0;
  padding: 8px 10px;
  border: 1px solid var(--app-danger);
  border-radius: 6px;
  background: var(--diff-deleted-bg);
  color: var(--diff-deleted-fg);
  font-size: 12px;
}

.picture-stat-grid {
  grid-template-columns: repeat(4, minmax(0, 1fr));
}

.picture-stat-grid strong {
  overflow: hidden;
  font-size: 16px;
  line-height: 1.2;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.picture-controls {
  display: grid;
  grid-template-columns:
    repeat(3, minmax(140px, 1fr)) auto minmax(260px, auto) minmax(180px, auto)
    minmax(180px, auto);
  gap: 4px 6px;
  min-height: 26px;
  padding: 2px 6px;
  border: 1px solid var(--app-border);
  border-radius: 0;
  background: var(--app-surface);
}

.picture-controls label {
  display: grid;
  gap: 5px;
}

.picture-controls span {
  color: var(--app-text-muted);
  font-size: 12px;
}

.picture-controls input {
  width: 100%;
}

.picture-toggle {
  grid-template-columns: auto auto;
  place-content: end;
}

.picture-toggle input {
  width: 16px;
  height: 16px;
}

.picture-options-panel {
  display: grid;
  gap: 4px 6px;
  padding: 4px 6px;
  border: 1px solid var(--app-border);
  border-radius: 10px;
  background: var(--app-surface);
}

.picture-options-panel header {
  display: flex;
  flex-wrap: wrap;
  align-items: baseline;
  justify-content: space-between;
  gap: 8px;
}

.picture-options-panel header span,
.picture-options-hint {
  margin: 0;
  color: var(--app-text-muted);
  font-size: 12px;
}

.picture-options-panel label {
  display: grid;
  gap: 6px;
}

.picture-options-toggle {
  place-content: start;
}

.picture-color-rule {
  display: grid;
  grid-template-columns: minmax(88px, auto) repeat(4, minmax(56px, 72px));
  align-items: center;
  gap: 8px;
}

.picture-options-panel input[type='number'] {
  width: 100%;
  height: 20px;
  min-height: 20px;
  padding: 0 6px;
  border: 1px solid var(--app-border);
  border-radius: 4px;
  background: var(--app-bg);
  color: var(--app-text);
  font: inherit;
  font-size: 11px;
}

.picture-options-panel button {
  width: fit-content;
  height: 20px;
  min-height: 20px;
  padding: 0 6px;
  border: 1px solid var(--app-border);
  border-radius: 6px;
  background: var(--app-bg);
  color: var(--app-text);
  font: inherit;
  font-size: 12px;
}

.picture-transform-tools {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 6px;
  align-content: end;
}

.picture-transform-tools button {
  min-height: 32px;
  padding: 0 8px;
  border: 1px solid var(--app-border);
  border-radius: 6px;
  background: var(--app-bg);
  color: var(--app-text);
  font: inherit;
  font-size: 12px;
}

.picture-transform-tools button:hover {
  border-color: var(--app-accent);
}

.picture-alignment-controls {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 8px;
}

.picture-alignment-controls input {
  min-height: 32px;
  padding: 0 8px;
  border: 1px solid var(--app-border);
  border-radius: 6px;
  background: var(--app-bg);
  color: var(--app-text);
  font: inherit;
  font-size: 12px;
}

.picture-pixel-preview {
  display: grid;
  grid-template-columns: minmax(0, auto) minmax(0, auto) 18px minmax(0, 1fr);
  align-items: center;
  align-content: end;
  gap: 8px;
  min-width: 0;
  min-height: 32px;
  padding: 0 8px;
  overflow: hidden;
  border: 1px solid var(--app-border);
  border-radius: 6px;
  background: var(--app-bg);
}

.picture-pixel-preview strong {
  min-width: 0;
  overflow: hidden;
  font-size: 12px;
  font-weight: 700;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.picture-pixel-swatch {
  width: 18px;
  height: 18px;
  border: 1px solid var(--app-border);
  border-radius: 4px;
}

.picture-pane-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 12px;
}

.picture-report-panel {
  display: grid;
  gap: 10px;
  padding: 12px;
  border: 1px solid var(--app-border);
  border-radius: 10px;
  background: var(--app-surface);
}

.picture-report-panel header {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 12px;
}

.picture-report-panel header button {
  margin-left: auto;
}

.picture-report-table {
  display: grid;
  gap: 6px;
}

.picture-report-row {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  align-items: center;
  gap: 8px;
}

.picture-report-head {
  color: var(--app-text-muted);
  font-size: 12px;
}

.picture-metadata-panel {
  display: grid;
  gap: 10px;
  padding: 10px;
  border: 1px solid var(--app-border);
  border-radius: 8px;
  background: var(--app-surface);
}

.metadata-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.metadata-header span {
  color: var(--app-text-muted);
  font-size: 12px;
}

.metadata-grid {
  display: grid;
  grid-template-columns: minmax(120px, 0.8fr) repeat(2, minmax(160px, 1fr)) minmax(90px, auto);
  overflow: hidden;
  border: 1px solid var(--app-border);
  border-radius: 6px;
}

.metadata-row {
  display: contents;
}

.metadata-grid-heading,
.metadata-cell {
  min-width: 0;
  padding: 8px 10px;
  border-bottom: 1px solid var(--app-border);
  font-size: 12px;
}

.metadata-grid-heading {
  background: var(--app-bg);
  color: var(--app-text-muted);
  font-weight: 700;
}

.metadata-label,
.metadata-status {
  font-weight: 700;
}

.metadata-row[data-metadata-status='different'] .metadata-status {
  color: var(--app-danger);
}

.metadata-row[data-metadata-status='equal'] .metadata-status {
  color: var(--app-success);
}

.picture-side {
  display: grid;
  gap: 8px;
  min-width: 0;
  padding: 10px;
  border: 1px solid var(--app-border);
  border-radius: 8px;
  background: var(--app-surface);
}

.picture-canvas-frame {
  position: relative;
  display: grid;
  place-items: center;
  min-height: 360px;
  overflow: hidden;
  border: 1px solid var(--app-border);
  border-radius: 6px;
  background:
    linear-gradient(45deg, rgb(148 163 184 / 0.16) 25%, transparent 25%),
    linear-gradient(-45deg, rgb(148 163 184 / 0.16) 25%, transparent 25%),
    linear-gradient(45deg, transparent 75%, rgb(148 163 184 / 0.16) 75%),
    linear-gradient(-45deg, transparent 75%, rgb(148 163 184 / 0.16) 75%), var(--app-bg);
  background-position:
    0 0,
    0 12px,
    12px -12px,
    -12px 0;
  background-size: 24px 24px;
}

.picture-image {
  position: relative;
  isolation: isolate;
  width: min(78%, 420px);
  aspect-ratio: 4 / 3;
  overflow: hidden;
  transform-origin: center;
  border: 1px solid rgb(15 23 42 / 0.18);
  border-radius: 6px;
  box-shadow: 0 16px 42px rgb(15 23 42 / 0.16);
  background: rgb(15 23 42 / 0.06);
}

.picture-image img {
  display: block;
  width: 100%;
  height: 100%;
  object-fit: contain;
}

.picture-marker {
  position: absolute;
  display: block;
  border: 2px solid rgb(255 255 255 / 0.78);
  border-radius: 999px;
  box-shadow: 0 0 0 1px rgb(15 23 42 / 0.18);
}

.marker-a {
  top: 18%;
  left: 18%;
  width: 24%;
  height: 24%;
}

.marker-b {
  right: 18%;
  bottom: 20%;
  width: 18%;
  height: 18%;
}

.marker-shifted {
  right: 12%;
  bottom: 24%;
}

.picture-diff-overlay {
  position: absolute;
  inset: 0;
  pointer-events: none;
}

.picture-diff-region {
  position: absolute;
  border: 2px solid rgb(255 255 255 / 0.9);
  border-radius: 6px;
  background: rgb(217 70 70 / 0.34);
  box-shadow:
    0 0 0 1px rgb(127 29 29 / 0.5),
    0 0 22px rgb(217 70 70 / 0.42);
}

@media (width <= 860px) {
  .picture-controls,
  .picture-pane-grid,
  .picture-path-panel,
  .picture-stat-grid {
    grid-template-columns: 1fr;
  }

  .picture-canvas-frame {
    min-height: 260px;
  }
}

.picture-blend-panel {
  display: grid;
  gap: 4px 6px;
  min-height: 26px;
  padding: 2px 6px;
  border: 1px solid var(--app-border);
  border-radius: 8px;
  background: var(--app-surface);
}

.picture-blend-panel header {
  display: flex;
  justify-content: space-between;
  gap: 8px;
  font-size: 12px;
}

.picture-blend-panel label {
  display: grid;
  gap: 4px;
  color: var(--app-text-muted);
  font-size: 12px;
}

.picture-blend-overlay {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  object-fit: contain;
  pointer-events: none;
}

.picture-diff-overlay-minor {
  opacity: 0.45;
}

.bc-path-footers {
  display: grid;
  grid-template-columns: 1fr 1fr;
  grid-column: 1 / -1;
  gap: 1px;
  width: 100%;
  margin-top: 0;
  padding: 0 2px;
}

.path-side-footer {
  min-height: 10px;
  margin-top: 0;
  overflow: hidden;
  color: var(--app-text-muted, #6b7280);
  font-size: 10px;
  line-height: 10px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.path-side-footer-muted {
  color: #9ca3af;
}
</style>
