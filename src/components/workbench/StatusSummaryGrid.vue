<script setup lang="ts">
import type { WorkbenchSummaryItem } from '@/layouts/workbench'

defineProps<{
  items: WorkbenchSummaryItem[]
}>()
</script>

<template>
  <section class="status-summary-grid">
    <article
      v-for="item in items"
      :key="item.label"
      :data-tone="item.tone ?? 'default'"
    >
      <strong>{{ item.value }}</strong>
      <span>{{ item.label }}</span>
    </article>
  </section>
</template>
