<script setup lang="ts">
import { ChevronDown } from '@lucide/vue'
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import type { PathFileStampLike } from '@/app/pathMetadata'
import { buildPathFooterMeta } from '@/app/pathMetadata'
import {
  defaultPathEncodings,
  resolvePathMetaChipOptions,
  type PathMetaChipOption,
} from '@/app/pathMetaChipOptions'
import { useI18n } from '@/i18n'

const props = withDefaults(
  defineProps<{
    stamp?: PathFileStampLike | null
    formatLabel?: string
    encoding?: string
    lineEnding?: string
    formatOptions?: PathMetaChipOption[] | string[]
    encodingOptions?: PathMetaChipOption[] | string[]
    showMilliseconds?: boolean
    muted?: boolean
    testId?: string
  }>(),
  {
    stamp: null,
    formatLabel: undefined,
    encoding: undefined,
    lineEnding: undefined,
    formatOptions: undefined,
    encodingOptions: undefined,
    showMilliseconds: false,
    muted: false,
    testId: undefined,
  },
)

const emit = defineEmits<{
  'update:format-label': [value: string]
  'update:encoding': [value: string]
  'select-format': [option: PathMetaChipOption]
  'select-encoding': [option: PathMetaChipOption]
}>()

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

const formatMenuOpen = ref(false)
const encodingMenuOpen = ref(false)
const rootEl = ref<HTMLElement | null>(null)

const resolvedFormatOptions = computed(() =>
  resolvePathMetaChipOptions(props.formatOptions, meta.value?.formatLabel, [
    'Everything Else',
    'Plain Text',
    'Source Code',
  ]),
)

const resolvedEncodingOptions = computed(() =>
  resolvePathMetaChipOptions(props.encodingOptions, meta.value?.encoding, [
    ...defaultPathEncodings,
  ]),
)

function closeMenus(): void {
  formatMenuOpen.value = false
  encodingMenuOpen.value = false
}

function toggleFormatMenu(): void {
  encodingMenuOpen.value = false
  formatMenuOpen.value = !formatMenuOpen.value
}

function toggleEncodingMenu(): void {
  formatMenuOpen.value = false
  encodingMenuOpen.value = !encodingMenuOpen.value
}

function selectFormat(option: PathMetaChipOption): void {
  emit('update:format-label', option.label)
  emit('select-format', option)
  closeMenus()
}

function selectEncoding(option: PathMetaChipOption): void {
  emit('update:encoding', option.label)
  emit('select-encoding', option)
  closeMenus()
}

function onDocumentPointerDown(event: PointerEvent): void {
  const target = event.target

  if (!(target instanceof Node) || !rootEl.value?.contains(target)) {
    closeMenus()
  }
}

function onDocumentKeydown(event: KeyboardEvent): void {
  if (event.key === 'Escape') {
    closeMenus()
  }
}

onMounted(() => {
  document.addEventListener('pointerdown', onDocumentPointerDown, true)
  document.addEventListener('keydown', onDocumentKeydown)
})

onBeforeUnmount(() => {
  document.removeEventListener('pointerdown', onDocumentPointerDown, true)
  document.removeEventListener('keydown', onDocumentKeydown)
})
</script>

<template>
  <div
    ref="rootEl"
    class="path-side-footer path-meta-footer"
    :class="{ 'path-side-footer-muted': isMuted }"
    data-path-meta-density="capture-1to1"
    data-path-meta-eol="capture-1to1-residual"
    data-path-meta-gap="capture-1to1-residual"
    :data-testid="testId"
  >
    <template v-if="meta">
      <span
        v-if="meta.modified"
        class="path-meta-modified"
        >{{ meta.modified }}</span
      >
      <span class="path-meta-size">{{ meta.sizeLabel }}</span>
      <div
        v-if="meta.formatLabel"
        class="path-meta-chip-wrap"
      >
        <button
          class="path-meta-chip"
          type="button"
          :data-testid="testId ? `${testId}-format-chip` : 'path-meta-format-chip'"
          :title="meta.formatLabel"
          :aria-label="meta.formatLabel"
          :aria-expanded="formatMenuOpen"
          aria-haspopup="listbox"
          @click="toggleFormatMenu"
        >
          <span>{{ meta.formatLabel }}</span>
          <ChevronDown
            :size="12"
            aria-hidden="true"
          />
        </button>
        <ul
          v-if="formatMenuOpen"
          class="path-meta-chip-menu"
          role="listbox"
          :data-testid="testId ? `${testId}-format-menu` : 'path-meta-format-menu'"
        >
          <li
            v-for="option in resolvedFormatOptions"
            :key="`format-${option.id}`"
            role="option"
            class="path-meta-chip-menu-item"
            :class="{ 'is-active': option.label === meta.formatLabel }"
            :aria-selected="option.label === meta.formatLabel"
            :data-testid="
              testId
                ? `${testId}-format-option-${option.id}`
                : `path-meta-format-option-${option.id}`
            "
            @click="selectFormat(option)"
          >
            {{ option.label }}
          </li>
        </ul>
      </div>
      <div
        v-if="meta.encoding"
        class="path-meta-chip-wrap"
      >
        <button
          class="path-meta-chip"
          type="button"
          :data-testid="testId ? `${testId}-encoding-chip` : 'path-meta-encoding-chip'"
          :title="meta.encoding"
          :aria-label="meta.encoding"
          :aria-expanded="encodingMenuOpen"
          aria-haspopup="listbox"
          @click="toggleEncodingMenu"
        >
          <span>{{ meta.encoding }}</span>
          <ChevronDown
            :size="12"
            aria-hidden="true"
          />
        </button>
        <ul
          v-if="encodingMenuOpen"
          class="path-meta-chip-menu"
          role="listbox"
          :data-testid="testId ? `${testId}-encoding-menu` : 'path-meta-encoding-menu'"
        >
          <li
            v-for="option in resolvedEncodingOptions"
            :key="`encoding-${option.id}`"
            role="option"
            class="path-meta-chip-menu-item"
            :class="{ 'is-active': option.label === meta.encoding }"
            :aria-selected="option.label === meta.encoding"
            :data-testid="
              testId
                ? `${testId}-encoding-option-${option.id}`
                : `path-meta-encoding-option-${option.id}`
            "
            @click="selectEncoding(option)"
          >
            {{ option.label }}
          </li>
        </ul>
      </div>
      <span
        v-if="meta.lineEnding"
        class="path-meta-eol"
        :data-eol-kind="meta.lineEnding"
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
  gap: 6px;
  min-width: 0;
  min-height: 18px;
  overflow: visible;
  color: #111111;
  font-size: 11px;
  line-height: 16px;
  white-space: nowrap;
}

.path-side-footer-muted {
  color: #9ca3af;
}

.path-meta-modified,
.path-meta-size {
  flex: 0 0 auto;
  line-height: 16px;
}

.path-meta-eol {
  display: inline-flex;
  flex: 0 0 auto;
  align-items: center;
  height: 18px;
  min-height: 18px;
  padding: 0 4px;
  border: 1px solid #d0d0d0;
  border-radius: 0;
  background: #f7f7f7;
  color: #111111;
  font-size: 11px;
  font-weight: 600;
  line-height: 16px;
}

.path-meta-eol[data-eol-kind='MIX'],
.path-meta-eol[data-eol-kind='CRLF'],
.path-meta-eol[data-eol-kind='LF'],
.path-meta-eol[data-eol-kind='CR'] {
  letter-spacing: 0.02em;
}

.path-meta-chip-wrap {
  position: relative;
  flex: 0 1 auto;
  min-width: 0;
  max-width: 14em;
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
  border: 1px solid transparent;
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

.path-meta-chip:hover {
  background: #f0f0f0;
}

.path-meta-chip:focus-visible {
  outline: 1px solid #4aa3ff;
  outline-offset: 0;
}

.path-meta-chip span {
  overflow: hidden;
  line-height: 16px;
  text-overflow: ellipsis;
}

.path-meta-chip-menu {
  position: absolute;
  top: 100%;
  left: 0;
  z-index: 40;
  min-width: 100%;
  max-height: 220px;
  margin: 1px 0 0;
  padding: 2px 0;
  overflow: auto;
  border: 1px solid #a0a0a0;
  border-radius: 0;
  background: #ffffff;
  color: #111111;
  list-style: none;
  box-shadow: 1px 1px 3px rgb(0 0 0 / 0.18);
}

.path-meta-chip-menu-item {
  display: block;
  min-width: 9em;
  padding: 2px 8px;
  font-size: 11px;
  line-height: 16px;
  white-space: nowrap;
  cursor: default;
}

.path-meta-chip-menu-item:hover,
.path-meta-chip-menu-item.is-active {
  background: #e5f1fb;
}
</style>
