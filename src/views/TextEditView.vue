<script setup lang="ts">
import { computed, ref } from 'vue'
import { readTextFile, saveTextFile } from '@/api/diff'
import { useI18n } from '@/i18n'
import type { FileStamp } from '@/types/diff'

interface LoadedTextDocument {
  path: string
  text: string
  encoding: string
  lineEnding: string
  fileStamp: FileStamp
}

const pathInput = ref('D:/workspace/notes.txt')
const { t } = useI18n()
const document = ref<LoadedTextDocument | null>(null)
const editorText = ref('')
const savedText = ref('')
const loading = ref(false)
const saving = ref(false)
const error = ref('')
const saveStatusKey = ref('status.noFileSavedYet')
const saveStatusParams = ref<Record<string, string | number>>({})
const findQuery = ref('')
const replaceQuery = ref('')
const currentFindIndex = ref(0)

const fileTitle = computed(() => {
  if (!document.value) {
    return t('ui.untitled')
  }

  return fileName(document.value.path)
})
const metadataLabel = computed(() => {
  if (!document.value) {
    return t('status.noDocumentLoaded')
  }

  return t('status.documentMetadata', {
    encoding: document.value.encoding,
    lineEnding: document.value.lineEnding,
    bytes: document.value.fileStamp.size,
  })
})
const dirty = computed(() => editorText.value !== savedText.value)
const dirtyLabel = computed(() => (dirty.value ? t('status.unsavedChanges') : t('status.saved')))
const lineCount = computed(() =>
  editorText.value.length === 0 ? 0 : editorText.value.split('\n').length,
)
const characterCount = computed(() => editorText.value.length)
const findMatches = computed(() => {
  if (!findQuery.value) {
    return []
  }

  const expression = new RegExp(escapeRegExp(findQuery.value), 'gi')
  const matches: number[] = []
  let match: RegExpExecArray | null

  while ((match = expression.exec(editorText.value)) !== null) {
    matches.push(match.index)

    if (match[0].length === 0) {
      expression.lastIndex += 1
    }
  }

  return matches
})
const findStatus = computed(() => {
  if (!findQuery.value) {
    return t('status.noSearch')
  }

  if (findMatches.value.length === 0) {
    return '0 / 0'
  }

  return `${String(currentFindIndex.value + 1)} / ${String(findMatches.value.length)}`
})

async function openDocument(): Promise<void> {
  loading.value = true
  error.value = ''

  try {
    const result = await readTextFile(pathInput.value)

    document.value = result
    editorText.value = result.text
    savedText.value = result.text
    setSaveStatus('status.loaded')
    currentFindIndex.value = 0
  } catch (event) {
    error.value = String(event)
  } finally {
    loading.value = false
  }
}

async function saveDocument(): Promise<void> {
  if (!document.value) {
    return
  }

  saving.value = true
  error.value = ''

  try {
    const result = await saveTextFile({
      path: document.value.path,
      text: editorText.value,
    })

    document.value = {
      ...document.value,
      fileStamp: result.fileStamp,
      text: editorText.value,
    }
    savedText.value = editorText.value
    setSaveStatus(result.backupPath ? 'status.bytesWrittenWithBackup' : 'status.bytesWritten', {
      count: result.bytesWritten,
    })
  } catch (event) {
    error.value = String(event)
  } finally {
    saving.value = false
  }
}

function updateEditorText(value: string): void {
  editorText.value = value
  clampFindIndex()
}

function updateFindQuery(event: Event): void {
  const target = event.currentTarget

  if (!(target instanceof HTMLInputElement)) {
    return
  }

  findQuery.value = target.value
  currentFindIndex.value = 0
}

function updateReplaceQuery(event: Event): void {
  const target = event.currentTarget

  if (!(target instanceof HTMLInputElement)) {
    return
  }

  replaceQuery.value = target.value
}

function findNext(): void {
  if (findMatches.value.length === 0) {
    currentFindIndex.value = 0

    return
  }

  currentFindIndex.value = (currentFindIndex.value + 1) % findMatches.value.length
}

function findPrevious(): void {
  if (findMatches.value.length === 0) {
    currentFindIndex.value = 0

    return
  }

  currentFindIndex.value =
    (currentFindIndex.value - 1 + findMatches.value.length) % findMatches.value.length
}

function replaceAll(): void {
  if (!findQuery.value) {
    return
  }

  const expression = new RegExp(escapeRegExp(findQuery.value), 'gi')

  editorText.value = editorText.value.replace(expression, replaceQuery.value)
  currentFindIndex.value = 0
}

function clampFindIndex(): void {
  if (currentFindIndex.value >= findMatches.value.length) {
    currentFindIndex.value = Math.max(findMatches.value.length - 1, 0)
  }
}

function fileName(path: string): string {
  return path.replaceAll('\\', '/').split('/').at(-1) ?? path
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function setSaveStatus(key: string, params: Record<string, string | number> = {}): void {
  saveStatusKey.value = key
  saveStatusParams.value = params
}

const saveStatus = computed(() => t(saveStatusKey.value, saveStatusParams.value))
</script>

<template>
  <section class="text-edit-view">
    <header class="text-edit-header">
      <div>
        <p class="eyebrow">{{ $t('ui.textEdit') }}</p>
        <h1 data-testid="text-edit-title">{{ fileTitle }}</h1>
      </div>
      <div class="document-stats">
        <span>{{ $t('status.lines', { count: lineCount }) }}</span>
        <span>{{ $t('status.chars', { count: characterCount }) }}</span>
      </div>
    </header>

    <section class="path-toolbar">
      <input
        v-model="pathInput"
        class="path-input"
        data-testid="text-edit-path"
        type="text"
        :aria-label="$t('ui.textFilePath')"
      />
      <NButton
        size="small"
        :loading="loading"
        data-testid="text-edit-open"
        @click="openDocument"
        >{{ $t('ui.open') }}</NButton
      >
      <NButton
        size="small"
        type="primary"
        :disabled="!document"
        :loading="saving"
        data-testid="text-edit-save"
        @click="saveDocument"
        >{{ $t('ui.save') }}</NButton
      >
      <span
        class="status-chip"
        data-testid="text-edit-dirty"
        >{{ dirtyLabel }}</span
      >
    </section>

    <section class="metadata-row">
      <span data-testid="text-edit-metadata">{{ metadataLabel }}</span>
      <span data-testid="text-edit-save-status">{{ saveStatus }}</span>
    </section>

    <section class="find-toolbar">
      <input
        class="find-input"
        data-testid="text-edit-find"
        type="search"
        :placeholder="$t('ui.find')"
        :value="findQuery"
        @input="updateFindQuery"
      />
      <input
        class="find-input"
        data-testid="text-edit-replace"
        type="text"
        :placeholder="$t('ui.replace')"
        :value="replaceQuery"
        @input="updateReplaceQuery"
      />
      <button
        type="button"
        class="toolbar-button"
        data-testid="text-edit-find-previous"
        :disabled="findMatches.length === 0"
        @click="findPrevious"
      >
        {{ $t('ui.previous') }}
      </button>
      <button
        type="button"
        class="toolbar-button"
        data-testid="text-edit-find-next"
        :disabled="findMatches.length === 0"
        @click="findNext"
      >
        {{ $t('ui.next') }}
      </button>
      <span
        class="status-chip"
        data-testid="text-edit-find-status"
        >{{ findStatus }}</span
      >
      <button
        type="button"
        class="toolbar-button"
        data-testid="text-edit-replace-all"
        :disabled="findMatches.length === 0"
        @click="replaceAll"
      >
        {{ $t('ui.replaceAll') }}
      </button>
    </section>

    <NAlert
      v-if="error"
      type="error"
      :bordered="false"
      >{{ error }}</NAlert
    >

    <NInput
      :value="editorText"
      type="textarea"
      class="editor-input"
      :placeholder="$t('ui.openATextFileToBeginEditing')"
      @update:value="updateEditorText"
    />
  </section>
</template>
<style scoped>
.text-edit-view {
  display: grid;
  grid-template-rows: auto auto auto auto auto minmax(0, 1fr);
  gap: 10px;
  height: 100%;
  padding: 12px;
  overflow: hidden;
}

.text-edit-header {
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

h1 {
  margin: 0;
  font-size: 22px;
  line-height: 1.2;
}

.document-stats {
  display: flex;
  gap: 8px;
  color: var(--app-text-muted);
  font-size: 12px;
}

.path-toolbar,
.find-toolbar,
.metadata-row {
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
}

.path-input,
.find-input {
  min-width: 0;
  height: 30px;
  padding: 0 8px;
  border: 1px solid var(--app-border);
  border-radius: 6px;
  background: var(--app-surface);
  color: var(--app-text);
  font-size: 12px;
}

.path-input {
  flex: 1;
  font-family: var(--font-mono);
}

.find-input {
  width: 220px;
}

.metadata-row {
  justify-content: space-between;
  color: var(--app-text-muted);
  font-size: 12px;
}

.status-chip {
  color: var(--app-text-muted);
  font-size: 12px;
}

.toolbar-button {
  height: 28px;
  padding: 0 8px;
  border: 1px solid var(--app-border);
  border-radius: 6px;
  background: var(--app-surface);
  color: var(--app-text);
  font-size: 12px;
  cursor: pointer;
}

.toolbar-button:disabled {
  cursor: not-allowed;
  opacity: 0.5;
}

.editor-input {
  min-height: 0;
}

:deep(textarea) {
  min-height: 100%;
  font-family: var(--font-mono);
  font-size: 13px;
  line-height: 1.6;
  resize: none;
}

@media (width <= 820px) {
  .text-edit-view {
    overflow: auto;
  }

  .text-edit-header,
  .path-toolbar,
  .find-toolbar,
  .metadata-row {
    display: grid;
    grid-template-columns: 1fr;
  }

  .find-input {
    width: 100%;
  }
}
</style>
