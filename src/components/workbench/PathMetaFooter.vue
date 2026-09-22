<script setup lang="ts">
import { ChevronDown } from '@lucide/vue'
import { computed } from 'vue'
import type { PathFileStampLike } from '@/app/pathMetadata'
import { buildPathFooterMeta } from '@/app/pathMetadata'
import { useI18n } from '@/i18n'

const props = withDefaults(
  defineProps<{
    stamp?: PathFileStampLike | null
    formatLabel?: string
    encoding?: string
    lineEnding?: string
    showMilliseconds?: boolean
    muted?: boolean
    testId?: string
  }>(),
  {
    stamp: null,
    formatLabel: undefined,
    encoding: undefined,
    lineEnding: undefined,
    showMilliseconds: false,
    muted: false,
    testId: undefined,
  },
)

const { t } = useI18n()

const meta = computed(() =>
  buildPathFooterMeta(props.stamp, {
    formatLabel: props.formatLabel,
    encoding: props.encoding,
    lineEnding: props.lineEnding,
    showMilliseconds: props.showMilliseconds,
  }),
)

const isMuted = computed(() => props.muted || !meta.value)
</script>

<template>
  <div
    class="path-side-footer path-meta-footer"
    :class="{ 'path-side-footer-muted': isMuted }"
    data-path-meta-density="capture-1to1"
    :data-testid="testId"
  >
    <template v-if="meta">
      <span
        v-if="meta.modified"
        class="path-meta-modified"
        >{{ meta.modified }}</span
      >
      <span class="path-meta-size">{{ meta.sizeLabel }}</span>
      <button
        v-if="meta.formatLabel"
        class="path-meta-chip"
        type="button"
        tabindex="-1"
        :title="meta.formatLabel"
        :aria-label="meta.formatLabel"
      >
        <span>{{ meta.formatLabel }}</span>
        <ChevronDown
          :size="12"
          aria-hidden="true"
        />
      </button>
      <button
        v-if="meta.encoding"
        class="path-meta-chip"
        type="button"
        tabindex="-1"
        :title="meta.encoding"
        :aria-label="meta.encoding"
      >
        <span>{{ meta.encoding }}</span>
        <ChevronDown
          :size="12"
          aria-hidden="true"
        />
      </button>
      <span
        v-if="meta.lineEnding"
        class="path-meta-eol"
        >{{ meta.lineEnding }}</span
      >
    </template>
    <span v-else>{{ t('status.panePlaceholder') }}</span>
  </div>
</template>

<style scoped>
.path-meta-footer {
  display: flex;
  flex-wrap: nowrap;
  align-items: center;
  gap: 10px;
  min-width: 0;
  min-height: 20px;
  overflow: hidden;
  color: #111111;
  font-size: 11px;
  line-height: 16px;
  white-space: nowrap;
}

.path-side-footer-muted {
  color: #9ca3af;
}

.path-meta-modified,
.path-meta-size,
.path-meta-eol {
  flex: 0 0 auto;
  line-height: 16px;
}

.path-meta-chip {
  display: inline-flex;
  flex: 0 1 auto;
  align-items: center;
  gap: 2px;
  min-width: 0;
  max-width: 14em;
  height: 18px;
  min-height: 18px;
  padding: 0 4px;
  overflow: hidden;
  border: 0;
  border-radius: 0;
  background: transparent;
  color: inherit;
  font: inherit;
  font-size: 11px;
  line-height: 16px;
  white-space: nowrap;
  cursor: default;
  text-overflow: ellipsis;
}

.path-meta-chip span {
  overflow: hidden;
  line-height: 16px;
  text-overflow: ellipsis;
}

.path-meta-eol {
  letter-spacing: 0;
}
</style>
