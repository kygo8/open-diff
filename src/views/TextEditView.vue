<script setup lang="ts">
import { computed, nextTick, onMounted, onUnmounted, ref, watch, watchEffect } from 'vue'
import { readTextFile, saveTextFile } from '@/api/diff'
import { useRouter } from 'vue-router'
import { useI18n } from '@/i18n'
import { useSessionLaunchStore } from '@/stores/sessionLaunch'
import { useViewActionsStore } from '@/stores/viewActions'
import { useTabsStore } from '@/stores/tabs'
import { useSettingsStore, type FontFamilyId } from '@/stores/settings'
import { useStatusBarStore } from '@/stores/statusBar'
import { elapsedSecondsSince } from '@/app/statusBarPhrases'
import { formatPathModifiedAt } from '@/app/pathMetadata'
import {
  applyOverwriteTyping,
  isInsertToggleKey,
  shouldHandleOverwriteKeydown,
  toggleTextEditMode,
  type TextEditMode,
} from '@/app/textEditMode'
import type { FileStamp } from '@/types/diff'
import {
  resolveSyntaxGrammar,
  splitLineBySyntaxTokens,
  syntaxLanguageOptions,
  tokenizeSyntaxLine,
} from '@/app/syntaxGrammars'
import { resolveGoToLine } from '@/app/textEditNavigation'
import { visualForSessionToolbarCommand } from '@/app/sessionToolbarIcons'

interface LoadedTextDocument {
  path: string
  text: string
  encoding: string
  lineEnding: string
  fileStamp: FileStamp
}

const pathInput = ref('')
const { t } = useI18n()
const sessionLaunch = useSessionLaunchStore()
const viewActions = useViewActionsStore()
const tabs = useTabsStore()
const settings = useSettingsStore()
const statusBar = useStatusBarStore()
const router = useRouter()
const document = ref<LoadedTextDocument | null>(null)
const editorText = ref('')
const savedText = ref('')
const undoStack = ref<string[]>([])
const redoStack = ref<string[]>([])
const localClipboard = ref('')
const applyingHistory = ref(false)
const loading = ref(false)
const saving = ref(false)
const error = ref('')
const saveStatusKey = ref('status.noFileSavedYet')
const saveStatusParams = ref<Record<string, string | number>>({})
const findQuery = ref('')
const replaceQuery = ref('')
const currentFindIndex = ref(0)
const syntaxMenuOpen = ref(false)
const fontMenuOpen = ref(false)
const fontFamilyOptionsList: { id: FontFamilyId; label: string }[] = [
  { id: 'system', label: 'System UI' },
  { id: 'segoe', label: 'Segoe UI' },
  { id: 'inter', label: 'Inter' },
  { id: 'noto', label: 'Noto Sans' },
  { id: 'mono', label: 'Monospace' },
]
const syntaxLanguageId = ref('auto')
const wordWrap = ref(settings.wrapTextDefault)
const goToMenuOpen = ref(false)
const goToLineInput = ref('1')
const goToLineStatus = ref('')
const editorHostRef = ref<HTMLElement | null>(null)
const editMode = ref<TextEditMode>('insert')
const loadTimeSeconds = ref<number | null>(null)

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

  const base = t('status.documentMetadata', {
    encoding: document.value.encoding,
    lineEnding: document.value.lineEnding,
    bytes: document.value.fileStamp.size,
  })
  const modified = formatPathModifiedAt(document.value.fileStamp.modifiedAtMs)

  return modified ? `${base} | ${modified}` : base
})
const dirty = computed(() => editorText.value !== savedText.value)
const dirtyLabel = computed(() => (dirty.value ? t('status.unsavedChanges') : t('status.saved')))

watchEffect(() => {
  let comparisonStatus = t('status.noDocumentLoaded')

  if (document.value) {
    comparisonStatus = dirty.value ? t('status.unsavedChanges') : t('status.saved')
  }

  statusBar.reportStatus({
    comparisonStatus,
    differenceCount: null,
    encoding: document.value?.encoding ?? 'UTF-8',
    filterStatus: t('status.allRows'),
    source: 'text-edit',
    loadTimeSeconds: document.value ? loadTimeSeconds.value : null,
    editMode: document.value ? editMode.value : null,
  })
})
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

onMounted(() => {
  const launch = sessionLaunch.consumeLaunch('/edit/text')

  if (!launch) {
    return
  }

  pathInput.value = launch.locations.left?.uri ?? launch.locations.output?.uri ?? pathInput.value

  if (launch.autoRun && pathInput.value) {
    void openDocument()
  }
})

async function openDocument(): Promise<void> {
  const startedAt = performance.now()

  loading.value = true
  error.value = ''

  try {
    const result = await readTextFile(pathInput.value)

    document.value = result
    loadTimeSeconds.value = elapsedSecondsSince(startedAt)
    editorText.value = result.text
    savedText.value = result.text
    undoStack.value = []
    redoStack.value = []
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

  if (settings.confirmBeforeOverwriteSave) {
    // eslint-disable-next-line no-alert -- Options Backup overwrite confirmation
    const accepted = window.confirm(t('ui.confirmOverwriteSavePrompt'))

    if (!accepted) {
      saving.value = false

      return
    }
  }

  try {
    const result = await saveTextFile({
      path: document.value.path,
      text: editorText.value,
      createBackup: settings.createBackupOnSave,
      backupRetention: settings.backupRetentionCount,
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

function onEditorKeydown(event: KeyboardEvent): void {
  if (editMode.value !== 'overwrite' || !shouldHandleOverwriteKeydown(event)) {
    return
  }

  const target = event.target

  if (!(target instanceof HTMLTextAreaElement)) {
    return
  }

  event.preventDefault()
  const next = applyOverwriteTyping(
    editorText.value,
    target.selectionStart,
    target.selectionEnd,
    event.key,
  )

  updateEditorText(next.text)

  void nextTick(() => {
    target.setSelectionRange(next.caret, next.caret)
  })
}

function onSessionInsertKeydown(event: KeyboardEvent): void {
  if (!isInsertToggleKey(event)) {
    return
  }

  event.preventDefault()
  editMode.value = toggleTextEditMode(editMode.value)
}

function updateEditorText(value: string): void {
  if (!applyingHistory.value) {
    undoStack.value.push(editorText.value)
    redoStack.value = []
  }

  editorText.value = value
  clampFindIndex()
}

function undoEdit(): void {
  const previous = undoStack.value.pop()

  if (previous === undefined) {
    return
  }

  redoStack.value.push(editorText.value)
  applyingHistory.value = true
  editorText.value = previous
  applyingHistory.value = false
  clampFindIndex()
}

function redoEdit(): void {
  const next = redoStack.value.pop()

  if (next === undefined) {
    return
  }

  undoStack.value.push(editorText.value)
  applyingHistory.value = true
  editorText.value = next
  applyingHistory.value = false
  clampFindIndex()
}

function currentSelectionOrEditor(): string {
  const selected = window.getSelection()?.toString()

  if (!selected) {
    return editorText.value
  }

  return selected
}

async function copyEdit(): Promise<void> {
  const selected = currentSelectionOrEditor()

  localClipboard.value = selected

  try {
    await navigator.clipboard.writeText(selected)
  } catch {
    // Browser clipboard may be unavailable in tests or restricted contexts.
  }
}

async function cutEdit(): Promise<void> {
  const selected = currentSelectionOrEditor()

  await copyEdit()

  if (selected && editorText.value.includes(selected)) {
    updateEditorText(editorText.value.replace(selected, ''))
  }
}

async function pasteEdit(): Promise<void> {
  let pasted = localClipboard.value

  try {
    pasted = (await navigator.clipboard.readText()) || pasted
  } catch {
    // Fall back to the in-session clipboard.
  }

  updateEditorText(`${editorText.value}${pasted}`)
}

function deleteEdit(): void {
  const selected = window.getSelection()?.toString()

  if (selected && editorText.value.includes(selected)) {
    updateEditorText(editorText.value.replace(selected, ''))

    return
  }

  updateEditorText('')
}

function goHome(): void {
  tabs.openTab({ title: t('ui.home'), titleKey: 'ui.home', route: '/', dirty: false })
  void router.push('/')
}

function runTextEditCommand(commandId: string): void {
  if (commandId === 'home') {
    goHome()

    return
  }

  if (commandId === 'undo') {
    undoEdit()

    return
  }

  if (commandId === 'redo') {
    redoEdit()

    return
  }

  if (commandId === 'cut') {
    void cutEdit()

    return
  }

  if (commandId === 'copy') {
    void copyEdit()

    return
  }

  if (commandId === 'paste') {
    void pasteEdit()

    return
  }

  if (commandId === 'delete') {
    deleteEdit()

    return
  }

  if (commandId === 'syntax') {
    syntaxMenuOpen.value = !syntaxMenuOpen.value
    if (syntaxMenuOpen.value) {
      fontMenuOpen.value = false
    }

    return
  }

  if (commandId === 'font') {
    fontMenuOpen.value = !fontMenuOpen.value
    if (fontMenuOpen.value) {
      syntaxMenuOpen.value = false
      goToMenuOpen.value = false
    }

    return
  }

  if (commandId === 'goto') {
    goToMenuOpen.value = !goToMenuOpen.value
    goToLineStatus.value = ''
    if (goToMenuOpen.value) {
      fontMenuOpen.value = false
    }

    if (goToMenuOpen.value && lineCount.value > 0) {
      goToLineInput.value = '1'
    }

    return
  }

  if (commandId === 'wrap') {
    wordWrap.value = !wordWrap.value
  }
}

function resolveEditorTextarea(): HTMLTextAreaElement | null {
  const host = editorHostRef.value

  if (!host) {
    return null
  }

  if (host instanceof HTMLTextAreaElement) {
    return host
  }

  const nested = host.querySelector('textarea')

  if (nested instanceof HTMLTextAreaElement) {
    return nested
  }

  const byTestId = host.querySelector('[data-testid="text-edit-editor"]')

  if (byTestId instanceof HTMLTextAreaElement) {
    return byTestId
  }

  return null
}

function applyGoToLine(): void {
  const resolved = resolveGoToLine(editorText.value, goToLineInput.value)

  if (!resolved) {
    goToLineStatus.value = t('status.goToLineInvalid')

    return
  }

  goToLineInput.value = String(resolved.line)
  goToLineStatus.value = t('status.goToLinePosition', {
    line: resolved.line,
    total: resolved.totalLines,
  })

  void nextTick(() => {
    const editor = resolveEditorTextarea()

    if (!editor) {
      return
    }

    editor.focus()
    editor.setSelectionRange(resolved.start, resolved.end)
  })
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
  const next = editorText.value.replace(expression, replaceQuery.value)

  if (next !== editorText.value) {
    updateEditorText(next)
  }

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

watch(
  () => [viewActions.sequence, viewActions.name] as const,
  ([, actionName]) => {
    if (!actionName) {
      return
    }

    if (
      actionName === 'undo' ||
      actionName === 'redo' ||
      actionName === 'cut' ||
      actionName === 'copy' ||
      actionName === 'paste' ||
      actionName === 'delete'
    ) {
      runTextEditCommand(actionName)

      return
    }

    if (actionName === 'save' || actionName === 'save-as') {
      void saveDocument()

      return
    }

    if (actionName === 'reload') {
      void openDocument()
    }
  },
)

const activeSyntaxGrammar = computed(() =>
  resolveSyntaxGrammar(syntaxLanguageId.value, document.value?.path ?? pathInput.value),
)
const highlightedLines = computed(() =>
  editorText.value.split('\n').map((line) => {
    const tokens = tokenizeSyntaxLine(line, activeSyntaxGrammar.value)

    return splitLineBySyntaxTokens(line, tokens)
  }),
)
const hasEditorContent = computed(() => editorText.value.length > 0)
const canPaste = computed(() => localClipboard.value.length > 0)

onMounted(() => {
  window.addEventListener('keydown', onSessionInsertKeydown)
})

onUnmounted(() => {
  window.removeEventListener('keydown', onSessionInsertKeydown)
})

function onFontFamilyChange(event: Event): void {
  const target = event.target

  if (!(target instanceof HTMLSelectElement)) {
    return
  }

  settings.setFontFamily(target.value)
}

function onFontSizeChange(event: Event): void {
  const target = event.target

  if (!(target instanceof HTMLInputElement)) {
    return
  }

  const next = Number(target.value)

  if (!Number.isFinite(next)) {
    return
  }

  settings.setFontSize(Math.min(24, Math.max(12, Math.round(next))))
}

const textEditToolbarCommands = computed(() =>
  [
    { id: 'home', glyph: 'H', labelKey: 'ui.home', enabled: true },
    { id: 'undo', glyph: 'U', labelKey: 'ui.undo', enabled: undoStack.value.length > 0 },
    { id: 'redo', glyph: 'R', labelKey: 'ui.redo', enabled: redoStack.value.length > 0 },
    { id: 'cut', glyph: 'X', labelKey: 'ui.cut', enabled: hasEditorContent.value },
    { id: 'copy', glyph: 'C', labelKey: 'ui.copy', enabled: hasEditorContent.value },
    {
      id: 'paste',
      glyph: 'P',
      labelKey: 'ui.paste',
      enabled: canPaste.value || document.value !== null,
    },
    { id: 'delete', glyph: 'D', labelKey: 'ui.delete', enabled: hasEditorContent.value },
    { id: 'syntax', glyph: 'S', labelKey: 'ui.syntax', enabled: true },
    { id: 'font', glyph: 'A', labelKey: 'ui.font', enabled: true },
    { id: 'goto', glyph: '#', labelKey: 'ui.goToLine', enabled: hasEditorContent.value },
    { id: 'wrap', glyph: 'W', labelKey: 'ui.wrap', enabled: true },
  ].map((command) => {
    const visual = visualForSessionToolbarCommand(command.id)

    return {
      ...command,
      visual,
      icon: visual?.kind === 'icon' ? visual.icon : undefined,
      plate: visual?.kind === 'plate' ? visual : undefined,
    }
  }),
)
</script>

<template>
  <section
    class="bc-session-toolbar"
    :class="{
      'bc-session-toolbar-glyphs-only': !settings.showToolbarLabels,
      'bc-session-toolbar-compact': !settings.largeToolbarButtons,
    }"
    :data-large-buttons="settings.largeToolbarButtons ? 'true' : 'false'"
  >
    <button
      v-for="command in textEditToolbarCommands"
      :key="command.id"
      class="bc-toolbar-command"
      type="button"
      :class="{
        'bc-toolbar-command-active':
          (command.id === 'wrap' && wordWrap) ||
          (command.id === 'goto' && goToMenuOpen) ||
          (command.id === 'font' && fontMenuOpen) ||
          (command.id === 'syntax' && syntaxMenuOpen),
      }"
      :disabled="!command.enabled"
      :aria-label="$t(command.labelKey)"
      :aria-pressed="
        command.id === 'wrap'
          ? wordWrap
          : command.id === 'goto'
            ? goToMenuOpen
            : command.id === 'font'
              ? fontMenuOpen
              : command.id === 'syntax'
                ? syntaxMenuOpen
                : undefined
      "
      :data-testid="`text-edit-toolbar-${command.id}`"
      :data-has-icon="command.visual && settings.showToolbarIcons ? 'true' : 'false'"
      :data-has-plate="command.plate && settings.showToolbarIcons ? 'true' : 'false'"
      :title="$t(command.labelKey)"
      @click="runTextEditCommand(command.id)"
    >
      <span
        v-if="command.plate && settings.showToolbarIcons"
        class="bc-toolbar-plate"
        :data-plate="command.plate.plate"
        aria-hidden="true"
        >{{ command.plate.symbol }}</span
      >
      <component
        :is="command.icon"
        v-else-if="command.icon && settings.showToolbarIcons"
        class="bc-toolbar-icon"
        aria-hidden="true"
        :size="settings.largeToolbarButtons ? 22 : 18"
        :stroke-width="2.25"
        absolute-stroke-width
      />
      <span
        v-else
        class="bc-toolbar-glyph"
        aria-hidden="true"
        >{{ command.glyph }}</span
      >
      <span v-if="settings.showToolbarLabels">{{ $t(command.labelKey) }}</span>
    </button>
  </section>
  <section
    v-if="syntaxMenuOpen"
    class="syntax-language-bar"
    data-testid="text-edit-syntax-menu"
  >
    <label>
      <span>{{ $t('ui.syntaxLanguage') }}</span>
      <select
        v-model="syntaxLanguageId"
        data-testid="text-edit-syntax-language"
      >
        <option
          v-for="option in syntaxLanguageOptions"
          :key="option.id"
          :value="option.id"
        >
          {{ $t(option.labelKey) }}
        </option>
      </select>
    </label>
    <span data-testid="text-edit-syntax-grammar">{{ activeSyntaxGrammar.id }}</span>
  </section>
  <section
    v-if="fontMenuOpen"
    class="syntax-language-bar"
    data-testid="text-edit-font-menu"
  >
    <label>
      <span>{{ $t('ui.fontFamily') }}</span>
      <select
        :value="settings.fontFamily"
        data-testid="text-edit-font-family"
        @change="onFontFamilyChange"
      >
        <option
          v-for="option in fontFamilyOptionsList"
          :key="option.id"
          :value="option.id"
        >
          {{ option.label }}
        </option>
      </select>
    </label>
    <label>
      <span>{{ $t('ui.fontSize') }}</span>
      <input
        :value="settings.fontSize"
        data-testid="text-edit-font-size"
        type="number"
        min="12"
        max="24"
        @change="onFontSizeChange"
        @input="onFontSizeChange"
      />
    </label>
  </section>
  <section
    v-if="goToMenuOpen"
    class="syntax-language-bar"
    data-testid="text-edit-goto-menu"
  >
    <label>
      <span>{{ $t('ui.goToLine') }}</span>
      <input
        v-model="goToLineInput"
        data-testid="text-edit-goto-line"
        type="number"
        min="1"
        :aria-label="$t('ui.goToLine')"
        @keydown.enter.prevent="applyGoToLine"
      />
    </label>
    <button
      type="button"
      class="toolbar-button"
      data-testid="text-edit-goto-apply"
      @click="applyGoToLine"
    >
      {{ $t('ui.goTo') }}
    </button>
    <span
      class="status-chip"
      data-testid="text-edit-goto-status"
      >{{ goToLineStatus }}</span
    >
  </section>
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

    <div
      ref="editorHostRef"
      class="editor-host"
      data-testid="text-edit-editor-host"
    >
      <NInput
        :value="editorText"
        type="textarea"
        class="editor-input"
        data-testid="text-edit-editor"
        :class="{ 'editor-input-wrap': wordWrap, 'editor-input-nowrap': !wordWrap }"
        :placeholder="$t('ui.openATextFileToBeginEditing')"
        @keydown="onEditorKeydown"
        @update:value="updateEditorText"
      />
    </div>

    <pre
      v-if="syntaxMenuOpen && editorText.length > 0"
      class="syntax-preview"
      data-testid="text-edit-syntax-preview"
    ><code
        v-for="(parts, lineIndex) in highlightedLines"
        :key="lineIndex"
        class="syntax-line"
      ><span
          v-for="(part, partIndex) in parts"
          :key="partIndex"
          class="syntax-part"
          :class="{
            'syntax-keyword': part.kind === 'keyword',
            'syntax-comment': part.kind === 'comment',
          }"
          >{{ part.text }}</span
        >{{ '\n' }}</code
      ></pre>
  </section>
</template>
<style scoped>
.syntax-language-bar {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 8px 12px;
  border-bottom: 1px solid var(--app-border);
  background: var(--app-surface);
}

.syntax-language-bar label {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 12px;
}

.syntax-preview {
  margin: 0;
  padding: 10px 12px;
  overflow: auto;
  border: 1px solid var(--app-border);
  border-radius: 8px;
  background: var(--app-surface);
  font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  font-size: 12px;
  line-height: 1.45;
  white-space: pre-wrap;
}

.syntax-line {
  display: block;
}

.syntax-keyword {
  color: #7c3aed;
  font-weight: 600;
}

.syntax-comment {
  color: #64748b;
  font-style: italic;
}

.editor-host {
  display: grid;
  min-height: 0;
}

.text-edit-view {
  display: grid;
  grid-template-rows: auto auto auto auto auto minmax(0, 1fr) auto;
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

.bc-toolbar-command-active {
  background: color-mix(in srgb, var(--od-accent, #3b82f6) 28%, transparent);
}

:deep(.editor-input-wrap textarea),
.editor-input-wrap :deep(textarea) {
  white-space: pre-wrap;
  overflow-wrap: anywhere;
}

:deep(.editor-input-nowrap textarea),
.editor-input-nowrap :deep(textarea) {
  overflow-x: auto;
  white-space: pre;
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
