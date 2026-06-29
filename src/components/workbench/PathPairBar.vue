<script setup lang="ts">
import { ArrowLeftRight, FolderOpen, Play } from '@lucide/vue'

withDefaults(
  defineProps<{
    leftLabel?: string
    rightLabel?: string
    left: string
    right: string
    actionLabel?: string
    loading?: boolean
  }>(),
  {
    leftLabel: 'Left',
    rightLabel: 'Right',
    actionLabel: 'Compare',
    loading: false,
  },
)

const emit = defineEmits<{
  'update:left': [value: string]
  'update:right': [value: string]
  swap: []
  run: []
}>()
</script>

<template>
  <section class="path-pair-bar">
    <label class="path-pair-field">
      <span>{{ leftLabel }}</span>
      <FolderOpen :size="14" />
      <input
        :value="left"
        type="text"
        data-testid="path-pair-left"
        @input="emit('update:left', ($event.target as HTMLInputElement).value)"
      />
    </label>
    <button
      class="path-pair-swap"
      type="button"
      aria-label="Swap paths"
      @click="emit('swap')"
    >
      <ArrowLeftRight :size="14" />
    </button>
    <label class="path-pair-field">
      <span>{{ rightLabel }}</span>
      <FolderOpen :size="14" />
      <input
        :value="right"
        type="text"
        data-testid="path-pair-right"
        @input="emit('update:right', ($event.target as HTMLInputElement).value)"
      />
    </label>
    <button
      class="path-pair-run"
      type="button"
      :disabled="loading"
      @click="emit('run')"
    >
      <Play :size="14" />
      <span>{{ actionLabel }}</span>
    </button>
  </section>
</template>
