<script setup lang="ts">
import type { WorkbenchInspectorSection } from '@/layouts/workbench'

defineProps<{
  sections?: WorkbenchInspectorSection[]
}>()
</script>

<template>
  <div class="workbench-inspector-stack">
    <slot />
    <section
      v-for="section in sections"
      :key="section.title"
      class="workbench-inspector-section"
    >
      <h2>{{ section.title }}</h2>
      <dl v-if="section.rows?.length">
        <div
          v-for="row in section.rows"
          :key="`${section.title}-${row.label}`"
        >
          <dt>{{ row.label }}</dt>
          <dd :data-tone="row.tone ?? 'default'">{{ row.value }}</dd>
        </div>
      </dl>
    </section>
  </div>
</template>
