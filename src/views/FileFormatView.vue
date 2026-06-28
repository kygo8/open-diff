<script setup lang="ts">
import { computed, ref } from 'vue'

type FileFormatViewMode = 'text' | 'table' | 'hex' | 'picture'

interface FileFormatMatcher {
  extensions: string[]
  fileNames: string[]
  globs: string[]
}

interface FileFormatRuleRefs {
  grammar: string
  ignore: string[]
  conversion: string
}

interface FileFormatDefinition {
  id: string
  name: string
  priority: number
  defaultView: FileFormatViewMode
  matcher: FileFormatMatcher
  rules: FileFormatRuleRefs
}

interface FileFormatDraft {
  id: string
  name: string
  priority: number
  defaultView: FileFormatViewMode
  extensions: string
  fileNames: string
  globs: string
  grammar: string
  ignore: string
  conversion: string
}

interface ImportedFileFormat {
  id?: string
  name?: string
  priority?: number
  defaultView?: string
  matcher?: Partial<FileFormatMatcher>
  rules?: Partial<FileFormatRuleRefs>
}

const builtInFormats: FileFormatDefinition[] = [
  {
    id: 'plain-text',
    name: 'Plain Text',
    priority: 10,
    defaultView: 'text',
    matcher: {
      extensions: ['txt', 'text', 'log'],
      fileNames: ['README', 'LICENSE'],
      globs: ['*.env.*'],
    },
    rules: {
      grammar: 'plain-text',
      ignore: ['whitespace-trim'],
      conversion: '',
    },
  },
  {
    id: 'rust',
    name: 'Rust Source',
    priority: 80,
    defaultView: 'text',
    matcher: {
      extensions: ['rs'],
      fileNames: ['Cargo.toml', 'Cargo.lock'],
      globs: ['**/src-tauri/**/*.rs'],
    },
    rules: {
      grammar: 'rust-grammar',
      ignore: ['comments', 'formatting'],
      conversion: '',
    },
  },
  {
    id: 'csv',
    name: 'Delimited Table',
    priority: 60,
    defaultView: 'table',
    matcher: {
      extensions: ['csv', 'tsv'],
      fileNames: [],
      globs: ['*.tab'],
    },
    rules: {
      grammar: '',
      ignore: ['empty-trailing-columns'],
      conversion: 'table-delimiter',
    },
  },
]

const formats = ref<FileFormatDefinition[]>(builtInFormats.map((format) => cloneFormat(format)))
const selectedFormatId = ref(formats.value[0]?.id ?? '')
const draft = ref<FileFormatDraft>(toDraft(formats.value[0] ?? emptyFormat()))
const exportJson = ref('')
const importJson = ref('')
const importStatus = ref('No import loaded')

const selectedFormat = computed(() =>
  formats.value.find((format) => format.id === selectedFormatId.value),
)

const sortedFormats = computed(() =>
  [...formats.value].sort(
    (left, right) => right.priority - left.priority || left.name.localeCompare(right.name),
  ),
)

const selectedFormatSummary = computed(
  () =>
    `${draft.value.name || 'Untitled'} - Priority ${String(draft.value.priority)} - ${viewLabel(draft.value.defaultView)}`,
)

const ruleSummary = computed(() => {
  const rules = [
    draft.value.grammar ? `Grammar: ${draft.value.grammar}` : 'Grammar: none',
    draft.value.ignore.trim() ? `Ignore: ${draft.value.ignore.trim()}` : 'Ignore: none',
    draft.value.conversion.trim()
      ? `Conversion: ${draft.value.conversion.trim()}`
      : 'Conversion: none',
  ]

  return rules.join(' | ')
})

function selectFormat(formatId: string): void {
  const format = formats.value.find((item) => item.id === formatId)

  if (!format) {
    return
  }

  selectedFormatId.value = format.id
  draft.value = toDraft(format)
}

function createNewFormat(): void {
  selectedFormatId.value = ''
  draft.value = {
    id: '',
    name: '',
    priority: 50,
    defaultView: 'text',
    extensions: '',
    fileNames: '',
    globs: '',
    grammar: '',
    ignore: '',
    conversion: '',
  }
}

function saveFormat(): void {
  const nextFormat = fromDraft(draft.value)
  const existingIndex = formats.value.findIndex((format) => format.id === nextFormat.id)

  if (existingIndex >= 0) {
    formats.value.splice(existingIndex, 1, nextFormat)
  } else {
    formats.value.push(nextFormat)
  }

  selectedFormatId.value = nextFormat.id
  draft.value = toDraft(nextFormat)
}

function exportFormats(): void {
  exportJson.value = JSON.stringify(formats.value, null, 2)
}

function importFormats(): void {
  try {
    const parsed = JSON.parse(importJson.value) as ImportedFileFormat[]
    const importedFormats = parsed.map((format) => normalizeFormat(format))

    if (importedFormats.length === 0) {
      importStatus.value = 'Import file contained no formats'

      return
    }

    const nextFormats = [...formats.value]

    for (const importedFormat of importedFormats) {
      const existingIndex = nextFormats.findIndex((format) => format.id === importedFormat.id)

      if (existingIndex >= 0) {
        nextFormats.splice(existingIndex, 1, importedFormat)
      } else {
        nextFormats.push(importedFormat)
      }
    }

    formats.value = nextFormats
    selectedFormatId.value = importedFormats[0].id
    draft.value = toDraft(importedFormats[0])
    const importedCount = importedFormats.length
    const pluralSuffix = importedCount === 1 ? '' : 's'

    importStatus.value = `Imported ${String(importedCount)} format${pluralSuffix}`
  } catch {
    importStatus.value = 'Import failed: invalid JSON'
  }
}

function toDraft(format: FileFormatDefinition): FileFormatDraft {
  return {
    id: format.id,
    name: format.name,
    priority: format.priority,
    defaultView: format.defaultView,
    extensions: format.matcher.extensions.join(', '),
    fileNames: format.matcher.fileNames.join(', '),
    globs: format.matcher.globs.join(', '),
    grammar: format.rules.grammar,
    ignore: format.rules.ignore.join(', '),
    conversion: format.rules.conversion,
  }
}

function fromDraft(source: FileFormatDraft): FileFormatDefinition {
  const name = valueOrFallback(source.name, 'Untitled Format')

  return {
    id: source.id || slugify(name),
    name,
    priority: Number.isFinite(source.priority) ? source.priority : 50,
    defaultView: source.defaultView,
    matcher: {
      extensions: splitList(source.extensions),
      fileNames: splitList(source.fileNames),
      globs: splitList(source.globs),
    },
    rules: {
      grammar: source.grammar.trim(),
      ignore: splitList(source.ignore),
      conversion: source.conversion.trim(),
    },
  }
}

function normalizeFormat(format: ImportedFileFormat): FileFormatDefinition {
  const name = valueOrFallback(format.name, 'Imported Format')
  const matcher = format.matcher ?? {}
  const rules = format.rules ?? {}
  const priority =
    typeof format.priority === 'number' && Number.isFinite(format.priority) ? format.priority : 50

  return {
    id: valueOrFallback(format.id, slugify(name)),
    name,
    priority,
    defaultView: isViewMode(format.defaultView) ? format.defaultView : 'text',
    matcher: {
      extensions: matcher.extensions ?? [],
      fileNames: matcher.fileNames ?? [],
      globs: matcher.globs ?? [],
    },
    rules: {
      grammar: rules.grammar ?? '',
      ignore: rules.ignore ?? [],
      conversion: rules.conversion ?? '',
    },
  }
}

function emptyFormat(): FileFormatDefinition {
  return {
    id: '',
    name: '',
    priority: 50,
    defaultView: 'text',
    matcher: {
      extensions: [],
      fileNames: [],
      globs: [],
    },
    rules: {
      grammar: '',
      ignore: [],
      conversion: '',
    },
  }
}

function cloneFormat(format: FileFormatDefinition): FileFormatDefinition {
  return JSON.parse(JSON.stringify(format)) as FileFormatDefinition
}

function splitList(value: string): string[] {
  return value
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean)
}

function valueOrFallback(value: string | undefined, fallback: string): string {
  const trimmedValue = value?.trim() ?? ''

  return trimmedValue.length > 0 ? trimmedValue : fallback
}

function slugify(value: string): string {
  const fallbackId = `format-${String(formats.value.length + 1)}`

  return (
    value
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/gu, '-')
      .replace(/(^-|-$)/gu, '') || fallbackId
  )
}

function isViewMode(value: unknown): value is FileFormatViewMode {
  return typeof value === 'string' && ['text', 'table', 'hex', 'picture'].includes(value)
}

function viewLabel(value: FileFormatViewMode): string {
  const labels: Record<FileFormatViewMode, string> = {
    text: 'Text',
    table: 'Table',
    hex: 'Hex',
    picture: 'Picture',
  }

  return labels[value]
}
</script>

<template>
  <section class="file-format-view">
    <header class="format-header">
      <div>
        <p class="eyebrow">Settings</p>
        <h1>File Formats</h1>
      </div>
      <div class="format-count">
        <strong>{{ formats.length }}</strong>
        <span>formats</span>
      </div>
    </header>

    <section class="format-workspace">
      <aside class="format-list-panel">
        <div class="panel-title">
          <h2>Definitions</h2>
          <button
            type="button"
            data-testid="new-format"
            @click="createNewFormat"
          >
            New
          </button>
        </div>
        <div
          class="format-list"
          data-testid="format-list"
        >
          <button
            v-for="format in sortedFormats"
            :key="format.id"
            type="button"
            class="format-row"
            :class="{ active: format.id === selectedFormatId }"
            :data-testid="`select-format-${format.id}`"
            @click="selectFormat(format.id)"
          >
            <span>{{ format.name }}</span>
            <small
              >{{ viewLabel(format.defaultView) }} ·
              {{ format.matcher.extensions.join(', ') }}</small
            >
          </button>
        </div>
      </aside>

      <section
        class="format-detail-panel"
        data-testid="format-detail"
      >
        <div class="panel-title">
          <h2>Format Details</h2>
          <button
            type="button"
            data-testid="save-format"
            @click="saveFormat"
          >
            Save
          </button>
        </div>

        <p
          class="selected-summary"
          data-testid="selected-format-summary"
        >
          {{ selectedFormatSummary }}
        </p>

        <div class="format-form">
          <label>
            <span>Name</span>
            <input
              v-model="draft.name"
              data-testid="format-name-input"
              type="text"
            />
          </label>
          <label>
            <span>Priority</span>
            <input
              v-model.number="draft.priority"
              data-testid="format-priority-input"
              type="number"
              min="0"
              max="999"
            />
          </label>
          <label>
            <span>Default View</span>
            <select
              v-model="draft.defaultView"
              data-testid="format-view-select"
            >
              <option value="text">Text</option>
              <option value="table">Table</option>
              <option value="hex">Hex</option>
              <option value="picture">Picture</option>
            </select>
          </label>
          <label>
            <span>Extensions</span>
            <input
              v-model="draft.extensions"
              data-testid="format-extension-input"
              type="text"
            />
          </label>
          <label>
            <span>File Names</span>
            <input
              v-model="draft.fileNames"
              data-testid="format-file-name-input"
              type="text"
            />
          </label>
          <label>
            <span>Glob Patterns</span>
            <input
              v-model="draft.globs"
              data-testid="format-glob-input"
              type="text"
            />
          </label>
          <label>
            <span>Grammar Rule</span>
            <input
              v-model="draft.grammar"
              data-testid="format-grammar-input"
              type="text"
            />
          </label>
          <label>
            <span>Ignore Rules</span>
            <input
              v-model="draft.ignore"
              data-testid="format-ignore-input"
              type="text"
            />
          </label>
          <label>
            <span>Conversion Rule</span>
            <input
              v-model="draft.conversion"
              data-testid="format-conversion-input"
              type="text"
            />
          </label>
        </div>

        <p
          class="rule-summary"
          data-testid="format-rule-summary"
        >
          {{ ruleSummary }}
        </p>
        <p class="format-source">
          {{
            selectedFormat
              ? 'Selected definition is editable in this session.'
              : 'Create a new format definition.'
          }}
        </p>
      </section>
    </section>

    <section class="format-import-export">
      <section class="format-io-panel">
        <div class="panel-title">
          <h2>Export</h2>
          <button
            type="button"
            data-testid="export-formats"
            @click="exportFormats"
          >
            Export JSON
          </button>
        </div>
        <textarea
          v-model="exportJson"
          data-testid="format-export-json"
          readonly
        />
      </section>

      <section class="format-io-panel">
        <div class="panel-title">
          <h2>Import</h2>
          <button
            type="button"
            data-testid="import-formats"
            @click="importFormats"
          >
            Import JSON
          </button>
        </div>
        <textarea
          v-model="importJson"
          data-testid="format-import-json"
        />
        <span class="import-status">{{ importStatus }}</span>
      </section>
    </section>
  </section>
</template>

<style scoped>
.file-format-view {
  display: grid;
  gap: 14px;
  height: 100%;
  padding: 16px;
  overflow: auto;
}

.format-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px;
}

.eyebrow {
  margin: 0 0 6px;
  color: var(--app-text-muted);
  font-size: 12px;
  font-weight: 700;
  letter-spacing: 0;
  text-transform: uppercase;
}

h1,
h2 {
  margin: 0;
}

h1 {
  font-size: 22px;
  line-height: 1.2;
}

h2 {
  font-size: 13px;
}

.format-count {
  display: grid;
  min-width: 96px;
  padding: 10px 12px;
  border: 1px solid var(--app-border);
  border-radius: 8px;
  background: var(--app-surface);
  text-align: right;
}

.format-count strong {
  font-size: 18px;
  line-height: 1;
}

.format-count span {
  color: var(--app-text-muted);
  font-size: 12px;
}

.format-workspace {
  display: grid;
  grid-template-columns: 280px minmax(0, 1fr);
  gap: 12px;
  min-height: 360px;
}

.format-list-panel,
.format-detail-panel,
.format-io-panel {
  min-width: 0;
  padding: 10px;
  border: 1px solid var(--app-border);
  border-radius: 8px;
  background: var(--app-surface);
}

.format-list-panel,
.format-detail-panel {
  display: grid;
  align-content: start;
  gap: 10px;
}

.panel-title {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
}

button {
  min-height: 30px;
  padding: 0 10px;
  border: 1px solid var(--app-border);
  border-radius: 6px;
  background: var(--app-bg);
  color: var(--app-text);
  font: inherit;
  cursor: pointer;
}

button:hover {
  background: var(--app-surface-muted);
}

.format-list {
  display: grid;
  gap: 4px;
}

.format-row {
  display: grid;
  justify-items: start;
  gap: 3px;
  width: 100%;
  min-height: 54px;
  padding: 8px 10px;
  text-align: left;
}

.format-row.active {
  border-color: #2563eb;
  background: rgb(37 99 235 / 0.1);
}

.format-row span {
  font-weight: 700;
}

.format-row small,
.format-source,
.import-status {
  color: var(--app-text-muted);
  font-size: 12px;
}

.selected-summary,
.rule-summary {
  margin: 0;
  padding: 9px 10px;
  border: 1px solid var(--app-border);
  border-radius: 6px;
  background: var(--app-bg);
  font-size: 12px;
}

.format-form {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 10px;
}

label {
  display: grid;
  gap: 5px;
  min-width: 0;
}

label span {
  color: var(--app-text-muted);
  font-size: 12px;
}

input,
select,
textarea {
  width: 100%;
  min-width: 0;
  border: 1px solid var(--app-border);
  border-radius: 6px;
  background: var(--app-bg);
  color: var(--app-text);
  font: inherit;
}

input,
select {
  height: 32px;
  padding: 0 8px;
}

textarea {
  min-height: 136px;
  padding: 8px;
  resize: vertical;
  font-family: var(--font-mono);
  font-size: 12px;
  line-height: 1.45;
}

.format-source {
  margin: 0;
}

.format-import-export {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 12px;
}

.format-io-panel {
  display: grid;
  gap: 10px;
}

@media (width <= 820px) {
  .format-header,
  .format-workspace,
  .format-import-export {
    grid-template-columns: 1fr;
  }

  .format-header {
    display: grid;
  }

  .format-count {
    text-align: left;
  }

  .format-form {
    grid-template-columns: 1fr;
  }
}
</style>
