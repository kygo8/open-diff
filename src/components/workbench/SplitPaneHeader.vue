<script setup lang="ts">
defineProps<{
  title: string
  subtitle?: string
  active?: boolean
}>()
</script>

<template>
  <header
    class="split-pane-header"
    :class="{ active }"
  >
    <strong>{{ title }}</strong>
    <span v-if="subtitle">{{ subtitle }}</span>
    <slot />
  </header>
</template>
