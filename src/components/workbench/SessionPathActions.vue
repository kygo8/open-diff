<script setup lang="ts">
import { Archive, ChevronDown, FolderOpen, Save } from '@lucide/vue'
import { useI18n } from '@/i18n'

withDefaults(
  defineProps<{
    browseTestId?: string
    saveTestId?: string
    archiveTestId?: string
    canSave?: boolean
    showSave?: boolean
    showArchive?: boolean
  }>(),
  {
    browseTestId: undefined,
    saveTestId: undefined,
    archiveTestId: undefined,
    canSave: false,
    showSave: true,
    showArchive: false,
  },
)

const emit = defineEmits<{
  browse: []
  save: []
  archive: []
}>()

const { t } = useI18n()
</script>

<template>
  <div class="bc-path-actions">
    <button
      class="bc-path-action bc-path-action-browse"
      type="button"
      :data-testid="browseTestId"
      :aria-label="t('ui.browse')"
      :title="t('ui.browse')"
      @click="emit('browse')"
    >
      <FolderOpen
        :size="14"
        aria-hidden="true"
      />
      <ChevronDown
        :size="10"
        aria-hidden="true"
      />
    </button>
    <button
      v-if="showArchive"
      class="bc-path-action bc-path-action-archive"
      type="button"
      :data-testid="archiveTestId"
      :aria-label="t('ui.browseArchive')"
      :title="t('ui.browseArchive')"
      @click="emit('archive')"
    >
      <Archive
        :size="14"
        aria-hidden="true"
      />
    </button>
    <button
      v-if="showSave"
      class="bc-path-action bc-path-action-save"
      type="button"
      :data-testid="saveTestId"
      :aria-label="t('ui.save')"
      :title="t('ui.save')"
      :disabled="!canSave"
      @click="emit('save')"
    >
      <Save
        :size="14"
        aria-hidden="true"
      />
    </button>
  </div>
</template>

<style scoped>
.bc-path-actions {
  display: inline-flex;
  flex: 0 0 auto;
  align-items: center;
  gap: 1px;
}

.bc-path-action {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 1px;
  box-sizing: border-box;
  width: 23px;
  min-width: 23px;
  height: 22px;
  padding: 0;
  border: 1px solid transparent;
  border-radius: 0;
  background: transparent;
  color: #333333;
  cursor: default;
}

.bc-path-action:hover:not(:disabled) {
  border-color: #a0a0a0;
  background: #f3f3f3;
}

.bc-path-action:disabled {
  opacity: 0.45;
}

.bc-path-action:focus-visible {
  outline: 2px solid var(--app-primary, #4aa3ff);
  outline-offset: 1px;
}
</style>
