<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import type { FolderCompareCriteria } from '@/types/diff'
import {
  formatIgnoredTimezoneHourOffsetsInput,
  parseIgnoredTimezoneHourOffsetsInput,
} from '@/app/folderCompareCriteria'
import {
  formatFolderNameFilterDraft,
  normalizeFolderNameFilters,
  parseFolderNameFilterDraft,
  type FolderNameFilters,
} from '@/app/folderNameFilters'
import type { TextCompareSessionOptions } from '@/app/textCompareSessionOptions'
import type { TableCompareSessionOptions } from '@/app/tableCompareSessionOptions'
import {
  defaultHexCompareSessionOptions,
  normalizeHexBytesPerRow,
  type HexCompareSessionOptions,
} from '@/app/hexCompareSessionOptions'
import {
  defaultPictureCompareOptions,
  type PictureCompareOptionsState,
} from '@/app/pictureCompareOptions'
import {
  defaultMediaCompareOptions,
  mediaFieldFilters,
  type MediaCompareOptionsState,
} from '@/app/mediaCompareOptions'
import {
  defaultVersionCompareOptions,
  versionFieldFilters,
  type VersionCompareOptionsState,
} from '@/app/versionCompareOptions'
import {
  defaultRegistryCompareOptions,
  registryValueFilters,
  type RegistryCompareOptionsState,
} from '@/app/registryCompareOptions'
import {
  defaultTextPatchSessionOptions,
  type TextPatchSessionOptions,
} from '@/app/textPatchSessionOptions'

export type SessionSettingsKind =
  'folder' | 'text' | 'table' | 'hex' | 'picture' | 'media' | 'version' | 'registry' | 'patch'

const props = withDefaults(
  defineProps<{
    open: boolean
    kind: SessionSettingsKind
    folderCriteria?: FolderCompareCriteria
    folderFilters?: FolderNameFilters
    textOptions?: TextCompareSessionOptions
    tableOptions?: TableCompareSessionOptions
    hexOptions?: HexCompareSessionOptions
    pictureOptions?: PictureCompareOptionsState
    mediaOptions?: MediaCompareOptionsState
    versionOptions?: VersionCompareOptionsState
    registryOptions?: RegistryCompareOptionsState
    patchOptions?: TextPatchSessionOptions
  }>(),
  {
    folderCriteria: () => ({
      compareSize: true,
      compareModifiedTime: false,
      compareContents: true,
      compareCrc: false,
      compareAttributes: false,
      sizeOnlyUnimportant: false,
      followSymlinks: false,
      timestampToleranceMs: 0,
      ignoreDaylightSavingHourOffset: false,
      caseSensitiveNames: true,
      ignoredTimezoneHourOffsets: [],
      excludeJunctionPoints: false,
    }),
    folderFilters: () => ({
      include: [],
      exclude: [],
      caseSensitive: false,
    }),
    textOptions: () => ({
      algorithm: 'myers',
      ignoreWhitespace: false,
      ignoreCase: false,
      ignoreLineEndings: false,
      ignoreRegexes: [],
    }),
    tableOptions: () => ({
      keyColumns: '0',
      delimiter: '',
      ignoredColumns: [],
      ignoreCase: true,
      firstRowIsHeader: true,
    }),
    hexOptions: () => defaultHexCompareSessionOptions(),
    pictureOptions: () => defaultPictureCompareOptions(),
    mediaOptions: () => defaultMediaCompareOptions(),
    versionOptions: () => defaultVersionCompareOptions(),
    registryOptions: () => defaultRegistryCompareOptions(),
    patchOptions: () => defaultTextPatchSessionOptions(),
  },
)

const emit = defineEmits<{
  close: []
  apply: [
    payload:
      | { kind: 'folder'; criteria: FolderCompareCriteria; filters: FolderNameFilters }
      | { kind: 'text'; options: TextCompareSessionOptions }
      | { kind: 'table'; options: TableCompareSessionOptions }
      | { kind: 'hex'; options: HexCompareSessionOptions }
      | { kind: 'picture'; options: PictureCompareOptionsState }
      | { kind: 'media'; options: MediaCompareOptionsState }
      | { kind: 'version'; options: VersionCompareOptionsState }
      | { kind: 'registry'; options: RegistryCompareOptionsState }
      | { kind: 'patch'; options: TextPatchSessionOptions },
  ]
}>()

type FolderTab = 'comparison' | 'filters'
type TextTab = 'importance' | 'alignment'

const folderTab = ref<FolderTab>('comparison')
const textTab = ref<TextTab>('importance')
const draftFolder = ref<FolderCompareCriteria>({ ...props.folderCriteria })
const draftFolderFilters = ref<FolderNameFilters>(normalizeFolderNameFilters(props.folderFilters))
const includeFiltersDraft = ref(formatFolderNameFilterDraft(props.folderFilters.include))
const excludeFiltersDraft = ref(formatFolderNameFilterDraft(props.folderFilters.exclude))
const draftText = ref<TextCompareSessionOptions>({
  ...props.textOptions,
  ignoreRegexes: [...props.textOptions.ignoreRegexes],
})
const draftTable = ref<TableCompareSessionOptions>({
  ...props.tableOptions,
  ignoredColumns: [...props.tableOptions.ignoredColumns],
})
const draftHex = ref<HexCompareSessionOptions>({
  ...defaultHexCompareSessionOptions(),
  ...props.hexOptions,
  bytesPerRow: normalizeHexBytesPerRow(props.hexOptions.bytesPerRow),
})
const draftPicture = ref<PictureCompareOptionsState>({ ...props.pictureOptions })
const draftMedia = ref<MediaCompareOptionsState>({ ...props.mediaOptions })
const draftVersion = ref<VersionCompareOptionsState>({ ...props.versionOptions })
const draftRegistry = ref<RegistryCompareOptionsState>({ ...props.registryOptions })
const draftPatch = ref<TextPatchSessionOptions>({ ...props.patchOptions })
const ignoreRegexDraft = ref(props.textOptions.ignoreRegexes.join(', '))
const ignoredColumnsDraft = ref(props.tableOptions.ignoredColumns.join(', '))

watch(
  () =>
    [
      props.open,
      props.folderCriteria,
      props.folderFilters,
      props.textOptions,
      props.tableOptions,
      props.hexOptions,
      props.pictureOptions,
      props.mediaOptions,
    ] as const,
  ([open]) => {
    if (!open) {
      return
    }

    draftFolder.value = { ...props.folderCriteria }
    draftFolderFilters.value = normalizeFolderNameFilters(props.folderFilters)
    includeFiltersDraft.value = formatFolderNameFilterDraft(props.folderFilters.include)
    excludeFiltersDraft.value = formatFolderNameFilterDraft(props.folderFilters.exclude)
    draftText.value = {
      ...props.textOptions,
      ignoreRegexes: [...props.textOptions.ignoreRegexes],
    }
    draftTable.value = {
      ...props.tableOptions,
      ignoredColumns: [...props.tableOptions.ignoredColumns],
    }
    draftHex.value = {
      ...defaultHexCompareSessionOptions(),
      ...props.hexOptions,
      bytesPerRow: normalizeHexBytesPerRow(props.hexOptions.bytesPerRow),
    }
    draftPicture.value = { ...props.pictureOptions }
    draftMedia.value = { ...props.mediaOptions }
    ignoreRegexDraft.value = props.textOptions.ignoreRegexes.join(', ')
    ignoredColumnsDraft.value = props.tableOptions.ignoredColumns.join(', ')
    folderTab.value = 'comparison'
    textTab.value = 'importance'
  },
)

const titleKey = computed(() => {
  switch (props.kind) {
    case 'folder':
      return 'ui.folderSessionSettings'
    case 'text':
      return 'ui.textSessionSettings'
    case 'table':
      return 'ui.tableSessionSettings'
    case 'hex':
      return 'ui.hexSessionSettings'
    case 'picture':
      return 'ui.pictureSessionSettings'
    case 'media':
      return 'ui.mediaSessionSettings'
    case 'version':
    case 'registry':
    case 'patch':
      return 'ui.sessionSettings'
  }

  return 'ui.sessionSettings'
})

function applySettings(): void {
  if (props.kind === 'folder') {
    emit('apply', {
      kind: 'folder',
      criteria: { ...draftFolder.value },
      filters: normalizeFolderNameFilters({
        include: parseFolderNameFilterDraft(includeFiltersDraft.value),
        exclude: parseFolderNameFilterDraft(excludeFiltersDraft.value),
        caseSensitive: draftFolderFilters.value.caseSensitive,
      }),
    })

    return
  }

  if (props.kind === 'text') {
    const ignoreRegexes = ignoreRegexDraft.value
      .split(/[,\n]/u)
      .map((item) => item.trim())
      .filter(Boolean)

    emit('apply', {
      kind: 'text',
      options: {
        ...draftText.value,
        ignoreRegexes,
      },
    })

    return
  }

  if (props.kind === 'table') {
    const ignoredColumns = ignoredColumnsDraft.value
      .split(/[,\n]/u)
      .map((item) => item.trim())
      .filter(Boolean)

    emit('apply', {
      kind: 'table',
      options: {
        ...draftTable.value,
        ignoredColumns,
      },
    })

    return
  }

  if (props.kind === 'hex') {
    emit('apply', {
      kind: 'hex',
      options: {
        ...draftHex.value,
        bytesPerRow: normalizeHexBytesPerRow(draftHex.value.bytesPerRow),
      },
    })

    return
  }

  if (props.kind === 'media') {
    emit('apply', { kind: 'media', options: { ...draftMedia.value } })

    return
  }

  if (props.kind === 'version') {
    emit('apply', { kind: 'version', options: { ...draftVersion.value } })

    return
  }

  if (props.kind === 'registry') {
    emit('apply', { kind: 'registry', options: { ...draftRegistry.value } })

    return
  }

  if (props.kind === 'patch') {
    emit('apply', { kind: 'patch', options: { ...draftPatch.value } })

    return
  }

  emit('apply', { kind: 'picture', options: { ...draftPicture.value } })
}
</script>

<template>
  <div
    v-if="open"
    class="session-settings-backdrop"
    data-testid="session-settings-dialog"
  >
    <section
      class="session-settings-dialog"
      role="dialog"
      aria-modal="true"
      :aria-label="$t(titleKey)"
    >
      <header>
        <h2>{{ $t(titleKey) }}</h2>
        <button
          type="button"
          data-testid="session-settings-close"
          @click="emit('close')"
        >
          {{ $t('ui.close') }}
        </button>
      </header>

      <nav
        v-if="kind === 'folder'"
        class="settings-tabs"
      >
        <button
          type="button"
          :class="{ active: folderTab === 'comparison' }"
          data-testid="session-settings-tab-comparison"
          @click="folderTab = 'comparison'"
        >
          {{ $t('ui.comparison') }}
        </button>
        <button
          type="button"
          :class="{ active: folderTab === 'filters' }"
          data-testid="session-settings-tab-filters"
          @click="folderTab = 'filters'"
        >
          {{ $t('ui.filters') }}
        </button>
      </nav>

      <nav
        v-else-if="kind === 'text'"
        class="settings-tabs"
      >
        <button
          type="button"
          :class="{ active: textTab === 'importance' }"
          data-testid="session-settings-tab-importance"
          @click="textTab = 'importance'"
        >
          {{ $t('ui.importance') }}
        </button>
        <button
          type="button"
          :class="{ active: textTab === 'alignment' }"
          data-testid="session-settings-tab-alignment"
          @click="textTab = 'alignment'"
        >
          {{ $t('ui.alignment') }}
        </button>
      </nav>

      <div
        v-if="kind === 'folder' && folderTab === 'comparison'"
        class="settings-body"
        data-testid="session-settings-folder-comparison"
      >
        <label>
          <input
            v-model="draftFolder.compareSize"
            type="checkbox"
            data-testid="session-settings-compare-size"
          />
          <span>{{ $t('ui.compareBySize') }}</span>
        </label>
        <label>
          <input
            v-model="draftFolder.compareModifiedTime"
            type="checkbox"
            data-testid="session-settings-compare-timestamp"
          />
          <span>{{ $t('ui.compareByTimestamp') }}</span>
        </label>
        <label>
          <input
            v-model="draftFolder.compareContents"
            type="checkbox"
            data-testid="session-settings-compare-contents"
          />
          <span>{{ $t('ui.compareBinaryContents') }}</span>
        </label>
        <label>
          <input
            v-model="draftFolder.compareCrc"
            type="checkbox"
            data-testid="session-settings-compare-crc"
          />
          <span>{{ $t('ui.compareCrc') }}</span>
        </label>
        <label>
          <input
            v-model="draftFolder.compareAttributes"
            type="checkbox"
            data-testid="session-settings-compare-attributes"
          />
          <span>{{ $t('ui.compareAttributes') }}</span>
        </label>
        <label>
          <input
            v-model="draftFolder.sizeOnlyUnimportant"
            type="checkbox"
            data-testid="session-settings-size-only-unimportant"
          />
          <span>{{ $t('ui.sizeOnlyUnimportant') }}</span>
        </label>
        <label>
          <input
            v-model="draftFolder.followSymlinks"
            type="checkbox"
            data-testid="session-settings-follow-symlinks"
          />
          <span>{{ $t('ui.followSymlinks') }}</span>
        </label>
        <label class="stack">
          <span>{{ $t('ui.timestampToleranceSeconds') }}</span>
          <input
            :value="Math.round((draftFolder.timestampToleranceMs ?? 0) / 1000)"
            type="number"
            min="0"
            max="86400"
            step="1"
            data-testid="session-settings-timestamp-tolerance"
            @input="
              draftFolder.timestampToleranceMs = Math.max(
                0,
                Math.round(Number(($event.target as HTMLInputElement).value) || 0) * 1000,
              )
            "
          />
        </label>
        <label>
          <input
            v-model="draftFolder.ignoreDaylightSavingHourOffset"
            type="checkbox"
            data-testid="session-settings-ignore-dst"
          />
          <span>{{ $t('ui.ignoreDaylightSavingHourOffset') }}</span>
        </label>
        <label>
          <input
            v-model="draftFolder.caseSensitiveNames"
            type="checkbox"
            data-testid="session-settings-case-sensitive-names"
          />
          <span>{{ $t('ui.caseSensitiveNames') }}</span>
        </label>
        <label>
          <input
            v-model="draftFolder.excludeJunctionPoints"
            type="checkbox"
            data-testid="session-settings-exclude-junctions"
          />
          <span>{{ $t('ui.excludeJunctionPoints') }}</span>
        </label>
        <label class="stack">
          <span>{{ $t('ui.ignoredTimezoneHourOffsets') }}</span>
          <input
            :value="
              formatIgnoredTimezoneHourOffsetsInput(draftFolder.ignoredTimezoneHourOffsets ?? [])
            "
            type="text"
            data-testid="session-settings-ignored-timezone-offsets"
            @change="
              draftFolder.ignoredTimezoneHourOffsets = parseIgnoredTimezoneHourOffsetsInput(
                ($event.target as HTMLInputElement).value,
              )
            "
          />
        </label>
      </div>

      <div
        v-else-if="kind === 'folder'"
        class="settings-body"
        data-testid="session-settings-folder-filters"
      >
        <p>{{ $t('ui.sessionSettingsFiltersHint') }}</p>
        <label class="stack">
          <span>{{ $t('ui.includePatterns') }}</span>
          <textarea
            v-model="includeFiltersDraft"
            rows="4"
            data-testid="session-settings-include-patterns"
            :placeholder="$t('ui.globPatterns')"
          />
        </label>
        <label class="stack">
          <span>{{ $t('ui.excludePatterns') }}</span>
          <textarea
            v-model="excludeFiltersDraft"
            rows="4"
            data-testid="session-settings-exclude-patterns"
            :placeholder="$t('ui.globPatterns')"
          />
        </label>
        <label>
          <input
            v-model="draftFolderFilters.caseSensitive"
            type="checkbox"
            data-testid="session-settings-filters-case-sensitive"
          />
          <span>{{ $t('ui.caseSensitiveNames') }}</span>
        </label>
      </div>

      <div
        v-else-if="kind === 'text' && textTab === 'importance'"
        class="settings-body"
        data-testid="session-settings-text-importance"
      >
        <label>
          <input
            v-model="draftText.ignoreWhitespace"
            type="checkbox"
            data-testid="session-settings-ignore-whitespace"
          />
          <span>{{ $t('ui.whitespace') }}</span>
        </label>
        <label>
          <input
            v-model="draftText.ignoreCase"
            type="checkbox"
            data-testid="session-settings-ignore-case"
          />
          <span>{{ $t('ui.case') }}</span>
        </label>
        <label>
          <input
            v-model="draftText.ignoreLineEndings"
            type="checkbox"
            data-testid="session-settings-ignore-line-endings"
          />
          <span>{{ $t('ui.lineEndings') }}</span>
        </label>
        <label class="stack">
          <span>{{ $t('ui.replacements') }}</span>
          <input
            v-model="ignoreRegexDraft"
            type="text"
            data-testid="session-settings-ignore-regexes"
            :placeholder="$t('ui.regex')"
          />
        </label>
      </div>

      <div
        v-else-if="kind === 'text'"
        class="settings-body"
        data-testid="session-settings-text-alignment"
      >
        <label class="stack">
          <span>{{ $t('ui.alignment') }}</span>
          <select
            v-model="draftText.algorithm"
            data-testid="session-settings-algorithm"
          >
            <option value="myers">{{ $t('ui.myers') }}</option>
            <option value="patience">{{ $t('ui.patience') }}</option>
            <option value="histogram">{{ $t('ui.histogram') }}</option>
          </select>
        </label>
      </div>

      <div
        v-else-if="kind === 'table'"
        class="settings-body"
        data-testid="session-settings-table"
      >
        <label class="stack">
          <span>{{ $t('ui.keyColumns') }}</span>
          <input
            v-model="draftTable.keyColumns"
            type="text"
            data-testid="session-settings-table-keys"
          />
        </label>
        <label class="stack">
          <span>{{ $t('ui.delimiter') }}</span>
          <input
            v-model="draftTable.delimiter"
            type="text"
            data-testid="session-settings-table-delimiter"
          />
        </label>
        <label class="stack">
          <span>{{ $t('ui.ignoredColumns') }}</span>
          <input
            v-model="ignoredColumnsDraft"
            type="text"
            data-testid="session-settings-table-ignored"
            :placeholder="$t('ui.ignoredColumnsHint')"
          />
        </label>
        <label>
          <input
            v-model="draftTable.firstRowIsHeader"
            type="checkbox"
            data-testid="session-settings-table-header-row"
          />
          <span>{{ $t('ui.tableFirstRowIsHeader') }}</span>
        </label>
        <label>
          <input
            v-model="draftTable.ignoreCase"
            type="checkbox"
            data-testid="session-settings-table-ignore-case"
          />
          <span>{{ $t('ui.tableIgnoreCaseDefault') }}</span>
        </label>
      </div>

      <div
        v-else-if="kind === 'hex'"
        class="settings-body"
        data-testid="session-settings-hex"
      >
        <label class="stack">
          <span>{{ $t('ui.windowLength') }}</span>
          <input
            v-model.number="draftHex.windowLength"
            type="number"
            min="16"
            max="4096"
            data-testid="session-settings-hex-window"
          />
        </label>
        <label>
          <input
            v-model="draftHex.diffOnly"
            type="checkbox"
            data-testid="session-settings-hex-diff-only"
          />
          <span>{{ $t('ui.diffs') }}</span>
        </label>
        <label class="stack">
          <span>{{ $t('ui.hexBytesPerRow') }}</span>
          <select
            v-model="draftHex.bytesPerRow"
            data-testid="session-settings-hex-bytes-per-row"
          >
            <option value="auto">{{ $t('ui.hexBytesPerRowAuto') }}</option>
            <option value="8">8</option>
            <option value="16">16</option>
          </select>
        </label>
      </div>

      <div
        v-else-if="kind === 'picture'"
        class="settings-body"
        data-testid="session-settings-picture"
      >
        <label class="stack">
          <span>{{ $t('ui.rgbTolerance') }}</span>
          <input
            v-model.number="draftPicture.rgbTolerance"
            type="number"
            min="0"
            max="255"
            data-testid="session-settings-picture-tolerance"
          />
        </label>
        <label>
          <input
            v-model="draftPicture.compareAlpha"
            type="checkbox"
            data-testid="session-settings-picture-alpha"
          />
          <span>{{ $t('ui.compareAlpha') }}</span>
        </label>
        <label
          v-if="draftPicture.compareAlpha"
          class="stack"
        >
          <span>{{ $t('ui.alphaTolerance') }}</span>
          <input
            v-model.number="draftPicture.alphaTolerance"
            type="number"
            min="0"
            max="255"
            data-testid="session-settings-picture-alpha-tolerance"
          />
        </label>
      </div>

      <div
        v-else-if="kind === 'media'"
        class="settings-panel"
        data-testid="session-settings-media"
      >
        <label class="settings-check">
          <input
            v-model="draftMedia.syncPlayback"
            data-testid="session-settings-media-sync-playback"
            type="checkbox"
          />
          <span>{{ $t('ui.syncPlayback') }}</span>
        </label>
        <label class="settings-check">
          <input
            v-model="draftMedia.showRules"
            data-testid="session-settings-media-show-rules"
            type="checkbox"
          />
          <span>{{ $t('ui.rules') }}</span>
        </label>
        <label class="settings-field">
          <span>{{ $t('ui.filter') }}</span>
          <select
            v-model="draftMedia.defaultFilter"
            data-testid="session-settings-media-default-filter"
          >
            <option
              v-for="filter in mediaFieldFilters"
              :key="filter"
              :value="filter"
            >
              {{ filter }}
            </option>
          </select>
        </label>
      </div>

      <div
        v-else-if="kind === 'version'"
        class="settings-body"
        data-testid="session-settings-version"
      >
        <label class="settings-check">
          <input
            v-model="draftVersion.showRules"
            data-testid="session-settings-version-show-rules"
            type="checkbox"
          />
          <span>{{ $t('ui.rules') }}</span>
        </label>
        <label class="settings-field">
          <span>{{ $t('ui.filter') }}</span>
          <select
            v-model="draftVersion.defaultFilter"
            data-testid="session-settings-version-default-filter"
          >
            <option
              v-for="filter in versionFieldFilters"
              :key="filter"
              :value="filter"
            >
              {{ filter }}
            </option>
          </select>
        </label>
      </div>

      <div
        v-else-if="kind === 'registry'"
        class="settings-body"
        data-testid="session-settings-registry"
      >
        <label class="settings-field">
          <span>{{ $t('ui.filter') }}</span>
          <select
            v-model="draftRegistry.defaultFilter"
            data-testid="session-settings-registry-default-filter"
          >
            <option
              v-for="filter in registryValueFilters"
              :key="filter"
              :value="filter"
            >
              {{ filter }}
            </option>
          </select>
        </label>
      </div>

      <div
        v-else-if="kind === 'patch'"
        class="settings-body"
        data-testid="session-settings-patch"
      >
        <label class="settings-check">
          <input
            v-model="draftPatch.wrapLongLines"
            data-testid="session-settings-patch-wrap"
            type="checkbox"
          />
          <span>{{ $t('ui.wrap') }}</span>
        </label>
      </div>

      <footer>
        <button
          type="button"
          data-testid="session-settings-cancel"
          @click="emit('close')"
        >
          {{ $t('ui.cancel') }}
        </button>
        <button
          type="button"
          class="primary"
          data-testid="session-settings-apply"
          @click="applySettings"
        >
          {{ $t('ui.apply') }}
        </button>
      </footer>
    </section>
  </div>
</template>

<style scoped>
.session-settings-backdrop {
  position: fixed;
  inset: 0;
  z-index: 40;
  display: grid;
  place-items: center;
  padding: 4px;
  background: rgb(15 23 42 / 0.45);
}

.session-settings-dialog {
  display: grid;
  gap: 4px;
  width: min(520px, 100%);
  padding: 4px 6px;
  border: 1px solid var(--app-border);
  border-radius: 0;
  background: var(--app-surface);
}

header,
footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 4px;
  min-height: 20px;
}

h2 {
  margin: 0;
  font-size: 12px;
}

.settings-tabs {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
}

.settings-tabs button {
  height: 18px;
  padding: 0 6px;
  border-radius: 0;
}

.settings-tabs button.active {
  border-color: var(--app-accent, #2563eb);
  color: var(--app-accent, #2563eb);
}

.settings-body {
  display: grid;
  gap: 4px;
}

.settings-body label {
  display: flex;
  align-items: center;
  gap: 4px;
  min-height: 18px;
}

.settings-body label.stack {
  display: grid;
  gap: 2px;
}

.settings-body input:not([type='checkbox']),
.settings-body select {
  height: 20px;
  padding: 0 4px;
  border-radius: 0;
}

.settings-body textarea {
  width: 100%;
  min-height: 64px;
  padding: 2px 4px;
  border: 1px solid var(--app-border);
  border-radius: 0;
  background: var(--app-surface-low, #ffffff);
  color: var(--app-text);
  font: inherit;
  resize: vertical;
}

footer {
  justify-content: flex-end;
}

footer button {
  height: 18px;
  padding: 0 8px;
  border-radius: 0;
}

button.primary {
  background: var(--app-accent, #2563eb);
  color: #ffffff;
}
</style>
