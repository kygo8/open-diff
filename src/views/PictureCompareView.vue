<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { comparePictureFiles } from '@/api/diff'
import type { PictureCompareResponse, PictureMetadataRow } from '@/types/diff'
import WorkbenchShell from '@/components/workbench/WorkbenchShell.vue'
import WorkbenchInspector from '@/components/workbench/WorkbenchInspector.vue'
import StatusSummaryGrid from '@/components/workbench/StatusSummaryGrid.vue'
import { useSessionLaunchStore } from '@/stores/sessionLaunch'

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
const defaultMetadataRows: PictureMetadataRow[] = [
  {
    key: 'dimensions',
    label: 'Dimensions',
    left: '1024 x 768',
    right: '1024 x 760',
    status: 'different',
  },
  {
    key: 'format',
    label: 'Format',
    left: 'PNG',
    right: 'PNG',
    status: 'equal',
  },
  {
    key: 'color-depth',
    label: 'Color Depth',
    left: '24-bit',
    right: '32-bit',
    status: 'different',
  },
  {
    key: 'exif',
    label: 'EXIF',
    left: 'Camera Model: Studio A',
    right: 'Camera Model: Studio B',
    status: 'different',
  },
] as const
const leftPath = ref('C:/images/left.png')
const rightPath = ref('C:/images/right.png')
const sessionLaunch = useSessionLaunchStore()
const leftPictureName = ref('left.png')
const rightPictureName = ref('right.png')
const loading = ref(false)
const error = ref('')
const metadataRows = ref<PictureMetadataRow[]>(defaultMetadataRows)
const pictureStatistics = ref<PictureCompareResponse['statistics']>({
  totalPixels: 786_432,
  differentPixels: 18_240,
  differenceRatio: 18_240 / 786_432,
  boundingRect: {
    x: 752,
    y: 572,
    width: 210,
    height: 166,
  },
})

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

const pictureDifferenceRatioText = computed(
  () => `${(pictureStatistics.value.differenceRatio * 100).toFixed(2)}%`,
)

const pictureBoundingRectText = computed(() => {
  const rect = pictureStatistics.value.boundingRect

  if (!rect) {
    return '--'
  }

  return `${String(rect.x)}, ${String(rect.y)}, ${String(rect.width)} x ${String(rect.height)}`
})

function rotatePicture(delta: number): void {
  rotationDeg.value = (rotationDeg.value + delta + 360) % 360
}

function buildPreviewColor(side: 'Left' | 'Right', x: number, y: number): string {
  const red = side === 'Left' ? 28 : 225
  const green = Math.min(255, Math.max(0, 128 + Math.round(x / 4)))
  const blue = Math.min(255, Math.max(0, 90 + Math.round(y / 4)))

  return `rgb(${String(red)}, ${String(green)}, ${String(blue)})`
}

function updatePixelPreview(side: 'Left' | 'Right', event: MouseEvent): void {
  const x = Math.max(0, Math.round(event.offsetX || event.clientX))
  const y = Math.max(0, Math.round(event.offsetY || event.clientY))

  pixelPreview.value = {
    side,
    x,
    y,
    color: buildPreviewColor(side, x, y),
  }
}

function applyPictureResult(result: PictureCompareResponse): void {
  leftPictureName.value = result.left.name
  rightPictureName.value = result.right.name
  metadataRows.value = result.metadataRows
  pictureStatistics.value = result.statistics
}

async function runPictureCompare(): Promise<void> {
  loading.value = true
  error.value = ''
  try {
    const result = await comparePictureFiles({
      leftPath: leftPath.value,
      rightPath: rightPath.value,
    })

    applyPictureResult(result)
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
    eyebrow="Picture"
    :subtitle="pictureDifferenceRatioText"
    inspector-label="Picture compare inspector"
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
      </section>
      <p
        v-if="error"
        class="picture-error"
        data-testid="picture-compare-error"
      >
        {{ error }}
      </p>

      <section class="picture-stat-grid">
        <article>
          <span>{{ $t('ui.totalPixels') }}</span>
          <strong data-testid="picture-total-pixels">{{ pictureStatistics.totalPixels }}</strong>
        </article>
        <article>
          <span>{{ $t('ui.differentPixels') }}</span>
          <strong data-testid="picture-different-pixels">
            {{ pictureStatistics.differentPixels }}
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
          <span>{{ pixelPreview?.side ?? 'No pixel' }}</span>
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
              <span class="picture-marker marker-a"></span>
              <span class="picture-marker marker-b"></span>
              <span
                v-if="showOverlay"
                class="picture-diff-overlay"
                data-testid="picture-diff-overlay"
              >
                <span
                  class="picture-diff-region"
                  data-testid="picture-diff-region"
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
              <span class="picture-marker marker-a"></span>
              <span class="picture-marker marker-b marker-shifted"></span>
              <span
                v-if="showOverlay"
                class="picture-diff-overlay"
                data-testid="picture-diff-overlay"
              >
                <span
                  class="picture-diff-region shifted-region"
                  data-testid="picture-diff-region"
                ></span>
              </span>
            </div>
          </div>
        </section>
      </section>

      <section
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
            v-for="row in metadataRows"
            :key="row.key"
          >
            <div
              class="metadata-row"
              :data-testid="`picture-metadata-${row.key}`"
              :data-metadata-status="row.status"
            >
              <div class="metadata-cell metadata-label">{{ row.label }}</div>
              <div class="metadata-cell">{{ row.left }}</div>
              <div class="metadata-cell">{{ row.right }}</div>
              <div class="metadata-cell metadata-status">
                {{ row.status }}
              </div>
            </div>
          </template>
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
                value: pictureStatistics.differentPixels,
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
              <dd>{{ showOverlay ? 'On' : 'Off' }}</dd>
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
  </WorkbenchShell>
</template>
<style scoped>
.picture-compare-view {
  display: grid;
  gap: 14px;
  height: 100%;
  padding: 16px;
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
  gap: 10px;
  padding: 10px;
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
  gap: 10px;
  padding: 10px;
  border: 1px solid var(--app-border);
  border-radius: 8px;
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
  grid-template-columns: auto auto 18px auto;
  align-items: center;
  align-content: end;
  gap: 8px;
  min-height: 32px;
  padding: 0 8px;
  border: 1px solid var(--app-border);
  border-radius: 6px;
  background: var(--app-bg);
}

.picture-pixel-preview strong {
  font-size: 12px;
  font-weight: 700;
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
  width: min(78%, 420px);
  aspect-ratio: 4 / 3;
  transform-origin: center;
  border: 1px solid rgb(15 23 42 / 0.18);
  border-radius: 6px;
  box-shadow: 0 16px 42px rgb(15 23 42 / 0.16);
}

.left-image {
  background:
    linear-gradient(135deg, rgb(28 128 145 / 0.85), rgb(240 183 77 / 0.88)),
    radial-gradient(circle at 72% 28%, rgb(255 255 255 / 0.55), transparent 28%);
}

.right-image {
  background:
    linear-gradient(135deg, rgb(28 128 145 / 0.85), rgb(225 107 90 / 0.88)),
    radial-gradient(circle at 72% 28%, rgb(255 255 255 / 0.55), transparent 28%);
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
  right: 15%;
  bottom: 18%;
  width: 24%;
  height: 24%;
  border: 2px solid rgb(255 255 255 / 0.9);
  border-radius: 6px;
  background: rgb(217 70 70 / 0.34);
  box-shadow:
    0 0 0 1px rgb(127 29 29 / 0.5),
    0 0 22px rgb(217 70 70 / 0.42);
}

.shifted-region {
  right: 9%;
  bottom: 22%;
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
</style>
