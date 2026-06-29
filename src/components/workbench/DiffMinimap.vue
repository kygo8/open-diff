<script setup lang="ts">
defineProps<{
  markers: {
    id: string
    top: number
    tone?: 'added' | 'deleted' | 'modified' | 'conflict'
  }[]
}>()
</script>

<template>
  <aside class="diff-minimap">
    <span
      v-for="marker in markers"
      :key="marker.id"
      class="diff-minimap-tick"
      :data-tone="marker.tone ?? 'modified'"
      :style="{ top: `${String(marker.top)}%` }"
    />
  </aside>
</template>

<style scoped>
.diff-minimap {
  position: relative;
  width: 14px;
  min-height: 100%;
  border-left: 1px solid var(--app-border);
  background: var(--app-surface-low);
}

.diff-minimap-tick {
  position: absolute;
  right: 2px;
  left: 2px;
  height: 3px;
  border-radius: 2px;
  background: var(--diff-modified-fg);
}

.diff-minimap-tick[data-tone='added'] {
  background: var(--diff-added-fg);
}

.diff-minimap-tick[data-tone='deleted'] {
  background: var(--diff-deleted-fg);
}

.diff-minimap-tick[data-tone='conflict'] {
  background: var(--diff-conflict-fg);
}
</style>
