<script setup lang="ts">
import { ArrowLeftRight, FolderOpen, Play } from '@lucide/vue'
import { useI18n } from '@/i18n'

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
    actionLabel: undefined,
    leftLabel: undefined,
    loading: false,
    rightLabel: undefined,
  },
)
const { t } = useI18n()

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
      <span>{{ leftLabel ?? t('ui.left') }}</span>
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
      :aria-label="$t('ui.swapPaths')"
      @click="emit('swap')"
    >
      <ArrowLeftRight :size="14" />
    </button>
    <label class="path-pair-field">
      <span>{{ rightLabel ?? t('ui.right') }}</span>
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
      <span>{{ actionLabel ?? t('ui.compare') }}</span>
    </button>
  </section>
</template>
