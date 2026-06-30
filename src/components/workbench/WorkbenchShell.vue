<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from '@/i18n'

const props = defineProps<{
  title: string
  eyebrow?: string
  subtitle?: string
  inspectorLabel?: string
}>()
const { t } = useI18n()
const resolvedInspectorLabel = computed(() => props.inspectorLabel ?? t('ui.inspector'))
</script>

<template>
  <section class="workbench-shell">
    <header class="workbench-titlebar">
      <div class="workbench-titlecopy">
        <span
          v-if="eyebrow"
          class="workbench-eyebrow"
          >{{ eyebrow }}</span
        >
        <h1>{{ title }}</h1>
        <span
          v-if="subtitle"
          class="workbench-subtitle"
          >{{ subtitle }}</span
        >
      </div>
      <div class="workbench-title-actions">
        <slot name="title-actions" />
      </div>
    </header>

    <div class="workbench-toolbar-stack">
      <slot name="toolbar" />
    </div>

    <div class="workbench-grid">
      <main class="workbench-main">
        <slot />
      </main>
      <aside
        class="workbench-inspector"
        :aria-label="resolvedInspectorLabel"
      >
        <slot name="inspector" />
      </aside>
    </div>
  </section>
</template>
