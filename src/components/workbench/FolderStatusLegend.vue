<script setup lang="ts">
import { Square } from '@lucide/vue'
import { folderStatusLegendItems } from '@/app/folderStatusLegend'
</script>

<template>
  <aside
    class="folder-status-legend"
    data-testid="folder-status-legend"
    :aria-label="$t('ui.legend')"
  >
    <header class="folder-status-legend-title">{{ $t('ui.legend') }}</header>
    <ul class="folder-status-legend-list">
      <li
        v-for="item in folderStatusLegendItems"
        :key="item.id"
        class="folder-status-legend-item"
        :data-tone="item.tone"
        :data-testid="`folder-legend-item-${item.id}`"
        :title="$t(item.descriptionKey)"
      >
        <span
          class="folder-status-legend-swatch"
          aria-hidden="true"
        >
          <Square
            class="folder-status-legend-icon"
            :size="10"
            :stroke-width="2.5"
          />
        </span>
        <span class="folder-status-legend-label">{{ $t(item.labelKey) }}</span>
      </li>
    </ul>
  </aside>
</template>

<style scoped>
.folder-status-legend {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 4px 10px;
  min-height: 22px;
  padding: 2px 6px;
  border: 1px solid var(--app-border);
  border-radius: 3px;
  background: var(--app-surface-muted, var(--app-surface));
  color: var(--app-text);
  font-size: 11px;
  line-height: 1.2;
}

.folder-status-legend-title {
  margin-right: 2px;
  color: var(--app-text-muted);
  font-size: 10px;
  font-weight: 700;
  letter-spacing: 0.02em;
  text-transform: uppercase;
}

.folder-status-legend-list {
  display: flex;
  flex: 1 1 auto;
  flex-wrap: wrap;
  align-items: center;
  gap: 2px 10px;
  margin: 0;
  padding: 0;
  list-style: none;
}

.folder-status-legend-item {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  min-height: 16px;
  white-space: nowrap;
}

.folder-status-legend-swatch {
  display: inline-grid;
  place-items: center;
  width: 12px;
  height: 12px;
}

.folder-status-legend-icon {
  display: block;
}

.folder-status-legend-item[data-tone='same'] .folder-status-legend-icon {
  color: var(--diff-added-fg);
  fill: var(--diff-added-fg);
}

.folder-status-legend-item[data-tone='different'] .folder-status-legend-icon {
  color: var(--diff-modified-fg);
  fill: var(--diff-modified-fg);
}

.folder-status-legend-item[data-tone='orphan'] .folder-status-legend-icon {
  color: var(--diff-deleted-fg);
  fill: var(--diff-deleted-fg);
}

.folder-status-legend-item[data-tone='ignored'] .folder-status-legend-icon {
  color: var(--app-text-muted);
  fill: transparent;
  opacity: 0.85;
}

.folder-status-legend-item[data-tone='minor'] .folder-status-legend-icon {
  color: var(--diff-modified-fg);
  fill: transparent;
  opacity: 0.75;
}

.folder-status-legend-item[data-tone='minor'] .folder-status-legend-label {
  font-style: italic;
  opacity: 0.9;
}

.folder-status-legend-label {
  font-size: 11px;
  font-weight: 600;
}
</style>
