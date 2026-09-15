<script setup lang="ts">
import { useI18n } from '@/i18n'
import type { WorkbenchSummaryItem } from '@/layouts/workbench'

defineProps<{
  items: WorkbenchSummaryItem[]
}>()

const { t } = useI18n()

function isEmptyValue(value: string | number): boolean {
  return value === '' || value === '--'
}

function displayValue(value: string | number): string {
  if (isEmptyValue(value)) {
    return t('status.panePlaceholder')
  }

  return String(value)
}
</script>

<template>
  <section
    class="status-summary-grid"
    data-testid="status-summary-grid"
  >
    <article
      v-for="item in items"
      :key="item.label"
      :data-tone="item.tone ?? 'default'"
      :data-empty="isEmptyValue(item.value) ? 'true' : 'false'"
    >
      <strong>{{ displayValue(item.value) }}</strong>
      <span>{{ item.label }}</span>
    </article>
  </section>
</template>
