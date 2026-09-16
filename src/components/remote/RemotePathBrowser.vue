<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { listRemotePath, remoteEntryName, remoteParentPath, type RemoteEntry } from '@/api/remote'
import { useI18n } from '@/i18n'

const props = withDefaults(
  defineProps<{
    profileId: string
    profileLabel?: string
    initialPath?: string
    allowFiles?: boolean
  }>(),
  {
    profileLabel: '',
    initialPath: '/',
    allowFiles: false,
  },
)

const emit = defineEmits<{
  select: [path: string]
  cancel: []
}>()

const { t } = useI18n()
const currentPath = ref(normalizeBrowsePath(props.initialPath))
const entries = ref<RemoteEntry[]>([])
const loading = ref(false)
const errorKey = ref('')
const errorDetail = ref('')
const selectedPath = ref(currentPath.value)

const sortedEntries = computed(() =>
  [...entries.value].sort((left, right) => {
    if (left.kind !== right.kind) {
      return left.kind === 'directory' ? -1 : 1
    }

    return remoteEntryName(left.path).localeCompare(remoteEntryName(right.path))
  }),
)

const canGoUp = computed(() => currentPath.value !== '/')
const statusText = computed(() => {
  if (loading.value) {
    return t('status.remoteBrowsing', { path: currentPath.value })
  }

  if (errorKey.value) {
    return t(errorKey.value, { detail: errorDetail.value })
  }

  return t('status.remoteBrowseReady', {
    count: entries.value.length,
    path: currentPath.value,
  })
})

watch(
  () => [props.profileId, props.initialPath] as const,
  ([, path]) => {
    currentPath.value = normalizeBrowsePath(path)
    selectedPath.value = currentPath.value
    void loadEntries()
  },
  { immediate: true },
)

async function loadEntries(): Promise<void> {
  if (!props.profileId.trim()) {
    errorKey.value = 'status.remoteBrowseNeedsProfile'
    errorDetail.value = ''
    entries.value = []

    return
  }

  loading.value = true
  errorKey.value = ''
  errorDetail.value = ''

  try {
    entries.value = await listRemotePath(props.profileId, currentPath.value)
    selectedPath.value = currentPath.value
  } catch (event) {
    entries.value = []
    errorKey.value = 'status.remoteBrowseFailed'
    errorDetail.value = event instanceof Error ? event.message : String(event)
  } finally {
    loading.value = false
  }
}

function openEntry(entry: RemoteEntry): void {
  if (entry.kind === 'directory') {
    currentPath.value = normalizeBrowsePath(entry.path)
    void loadEntries()

    return
  }

  if (props.allowFiles) {
    selectedPath.value = entry.path
    emit('select', entry.path)
  }
}

function goUp(): void {
  if (!canGoUp.value) {
    return
  }

  currentPath.value = remoteParentPath(currentPath.value)
  void loadEntries()
}

function useCurrentPath(): void {
  emit('select', selectedPath.value || currentPath.value)
}

function normalizeBrowsePath(path: string | undefined): string {
  const trimmed = (path ?? '/').trim().replace(/\\/g, '/') || '/'

  return trimmed.startsWith('/') ? trimmed : `/${trimmed}`
}
</script>

<template>
  <div
    class="remote-path-browser-backdrop"
    data-testid="remote-path-browser"
    role="dialog"
    aria-modal="true"
    :aria-label="$t('ui.browseRemotePath')"
  >
    <section class="remote-path-browser">
      <header class="browser-header">
        <div>
          <p class="eyebrow">{{ $t('ui.remoteProfile') }}</p>
          <h2>{{ profileLabel || profileId }}</h2>
        </div>
        <div class="browser-actions">
          <button
            type="button"
            data-testid="remote-browse-up"
            :disabled="!canGoUp || loading"
            @click="goUp"
          >
            {{ $t('ui.parentFolder') }}
          </button>
          <button
            type="button"
            data-testid="remote-browse-refresh"
            :disabled="loading || !profileId"
            @click="loadEntries"
          >
            {{ $t('ui.refresh') }}
          </button>
        </div>
      </header>

      <p
        class="current-path"
        data-testid="remote-browse-current-path"
      >
        {{ currentPath }}
      </p>

      <div
        class="entry-list"
        data-testid="remote-browse-entry-list"
      >
        <button
          v-for="entry in sortedEntries"
          :key="`${entry.kind}:${entry.path}`"
          type="button"
          class="entry-row"
          :class="{
            directory: entry.kind === 'directory',
            file: entry.kind === 'file',
            selected: selectedPath === entry.path,
          }"
          :data-testid="`remote-browse-entry-${entry.kind}`"
          @click="openEntry(entry)"
        >
          <span>{{ remoteEntryName(entry.path) }}</span>
          <small>
            {{
              entry.kind === 'directory' ? $t('ui.directory') : `${$t('ui.file')} · ${entry.size}`
            }}
          </small>
        </button>
        <p
          v-if="!loading && sortedEntries.length === 0 && !errorKey"
          class="empty-state"
          data-testid="remote-browse-empty"
        >
          {{ $t('ui.remoteBrowseEmpty') }}
        </p>
      </div>

      <p
        class="browser-status"
        data-testid="remote-browse-status"
      >
        {{ statusText }}
      </p>

      <footer class="browser-footer">
        <button
          type="button"
          data-testid="remote-browse-cancel"
          @click="emit('cancel')"
        >
          {{ $t('ui.cancel') }}
        </button>
        <button
          type="button"
          data-testid="remote-browse-use-path"
          :disabled="loading || Boolean(errorKey)"
          @click="useCurrentPath"
        >
          {{ allowFiles ? $t('ui.useRemotePath') : $t('ui.useRemoteFolder') }}
        </button>
      </footer>
    </section>
  </div>
</template>

<style scoped>
.remote-path-browser-backdrop {
  position: fixed;
  inset: 0;
  z-index: 40;
  display: grid;
  place-items: center;
  padding: 4px;
  background: rgb(15 23 42 / 0.45);
}

.remote-path-browser {
  display: grid;
  gap: 4px;
  width: min(640px, 100%);
  max-height: min(80vh, 720px);
  padding: 4px 6px;
  border: 1px solid var(--app-border);
  border-radius: 0;
  background: var(--app-surface);
}

.browser-header,
.browser-actions,
.browser-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 4px;
  min-height: 20px;
}

.browser-actions,
.browser-footer {
  flex-wrap: wrap;
  justify-content: flex-end;
}

.eyebrow {
  margin: 0 0 2px;
  color: var(--app-text-muted);
  font-size: 11px;
  font-weight: 700;
  text-transform: uppercase;
}

h2 {
  margin: 0;
  font-size: 12px;
  line-height: 1.25;
}

.current-path,
.browser-status,
.empty-state {
  margin: 0;
  padding: 2px 4px;
  border: 1px solid var(--app-border);
  border-radius: 0;
  background: var(--app-bg);
  color: var(--app-text-muted);
  font-size: 12px;
}

.entry-list {
  display: grid;
  gap: 2px;
  min-height: 180px;
  max-height: 360px;
  padding: 2px;
  overflow: auto;
  border: 1px solid var(--app-border);
  border-radius: 0;
  background: var(--app-bg);
}

.entry-row {
  display: grid;
  justify-items: start;
  gap: 0;
  width: 100%;
  height: auto;
  min-height: 20px;
  padding: 2px 4px;
  border: 1px solid transparent;
  border-radius: 0;
  background: transparent;
  color: var(--app-text);
  font: inherit;
  text-align: left;
  cursor: pointer;
}

.entry-row:hover,
.entry-row.selected {
  border-color: #2563eb;
  background: rgb(37 99 235 / 0.1);
}

.entry-row small {
  color: var(--app-text-muted);
  font-size: 11px;
}

button {
  height: 18px;
  min-height: 18px;
  padding: 0 8px;
  border: 1px solid var(--app-border);
  border-radius: 0;
  background: var(--app-bg);
  color: var(--app-text);
  font: inherit;
  cursor: pointer;
}

button:disabled {
  cursor: not-allowed;
  opacity: 0.5;
}

button:hover:not(:disabled) {
  background: var(--app-surface-muted);
}
</style>
