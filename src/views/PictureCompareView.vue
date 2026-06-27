<script setup lang="ts">
import { computed, ref } from 'vue'

const zoom = ref(100)
const panX = ref(0)
const panY = ref(0)
const showOverlay = ref(true)
const rotationDeg = ref(0)
const flipHorizontal = ref(false)
const flipVertical = ref(false)
const alignmentOffsetX = ref(0)
const alignmentOffsetY = ref(0)

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

function rotatePicture(delta: number): void {
  rotationDeg.value = (rotationDeg.value + delta + 360) % 360
}
</script>

<template>
  <section class="picture-compare-view">
    <header class="picture-header">
      <div>
        <p class="eyebrow">Picture Compare</p>
        <h1>Picture Compare</h1>
      </div>
      <div class="picture-summary">
        <strong data-testid="picture-zoom-value">{{ zoom }}%</strong>
        <span>shared zoom</span>
      </div>
    </header>

    <section class="picture-controls">
      <label>
        <span>Zoom</span>
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
        <span>Pan X</span>
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
        <span>Pan Y</span>
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
        <span>Overlay</span>
      </label>
      <div class="picture-transform-tools">
        <button
          type="button"
          data-testid="picture-rotate-counterclockwise"
          @click="rotatePicture(-90)"
        >
          Rotate Left
        </button>
        <button
          type="button"
          data-testid="picture-rotate-clockwise"
          @click="rotatePicture(90)"
        >
          Rotate Right
        </button>
        <button
          type="button"
          data-testid="picture-flip-horizontal"
          @click="flipHorizontal = !flipHorizontal"
        >
          Flip H
        </button>
        <button
          type="button"
          data-testid="picture-flip-vertical"
          @click="flipVertical = !flipVertical"
        >
          Flip V
        </button>
      </div>
      <div class="picture-alignment-controls">
        <label>
          <span>Offset X</span>
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
          <span>Offset Y</span>
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
    </section>

    <section class="picture-pane-grid">
      <section
        class="picture-side"
        data-testid="left-picture-pane"
      >
        <h2>Left</h2>
        <div
          class="picture-canvas-frame"
          data-testid="picture-canvas-frame"
        >
          <div
            class="picture-image left-image"
            :style="imageStyle"
            data-testid="left-picture-image"
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
        <h2>Right</h2>
        <div
          class="picture-canvas-frame"
          data-testid="picture-canvas-frame"
        >
          <div
            class="picture-image right-image"
            :style="rightImageStyle"
            data-testid="right-picture-image"
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
  </section>
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

.picture-controls {
  display: grid;
  grid-template-columns: repeat(3, minmax(140px, 1fr)) auto minmax(260px, auto) minmax(180px, auto);
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

.picture-pane-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 12px;
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
  .picture-pane-grid {
    grid-template-columns: 1fr;
  }

  .picture-canvas-frame {
    min-height: 260px;
  }
}
</style>
