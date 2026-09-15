<script setup lang="ts">
import { computed, nextTick, onMounted, onUnmounted, ref, watch, watchEffect } from 'vue'
import { useRouter } from 'vue-router'
import { diffText, exportTextCompareReport, readTextFile } from '@/api/diff'
import { reportFileExtension } from '@/app/reportExports'
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
import { notifyCompareComplete } from '@/app/compareCompleteNotify'
import { useLastCompareStore } from '@/stores/lastCompare'
import { useSettingsStore } from '@/stores/settings'
import { useSessionLaunchStore } from '@/stores/sessionLaunch'
import { useTabsStore } from '@/stores/tabs'
import type { FileStamp, TextDiffAlgorithm, TextDiffRequest, TextDiffResponse } from '@/types/diff'
import TextDiffPanel from '@/components/diff/TextDiffPanel.vue'
import WorkbenchShell from '@/components/workbench/WorkbenchShell.vue'
import RemotePathBrowser from '@/components/remote/RemotePathBrowser.vue'
import WorkbenchToolbar from '@/components/workbench/WorkbenchToolbar.vue'
import WorkbenchInspector from '@/components/workbench/WorkbenchInspector.vue'
import StatusSummaryGrid from '@/components/workbench/StatusSummaryGrid.vue'
import { useI18n } from '@/i18n'
import { loadFileFormats, matchFileFormat } from '@/app/fileFormats'
import { textOptionsFromFormat } from '@/app/formatSessionRules'
import { grammarForPath } from '@/app/syntaxGrammars'
import { pickNativePath } from '@/app/filePicker'
import { isTauriRuntime } from '@/app/desktopDrop'
import { formatRemoteUri, isImplementedRemoteProtocol, parseRemoteUri } from '@/api/remote'
import { formatCompareError } from '@/app/compareError'
import { buildTextCompareToolbar, pathPairTitle } from '@/app/sessionToolbars'
import {
  loadTextCompareSessionOptions,
  saveTextCompareSessionOptions,
} from '@/app/textCompareSessionOptions'
import SessionSettingsDialog from '@/components/session/SessionSettingsDialog.vue'
import { useViewActionsStore } from '@/stores/viewActions'
import { defaultFolderCompareCriteria } from '@/app/folderCompareCriteria'

type DiffLine = TextDiffResponse['lines'][number]

const left = ref('')
const right = ref('')
const leftFileStamp = ref<FileStamp | null>(null)
const rightFileStamp = ref<FileStamp | null>(null)
const leftPathLabel = ref('')
const rightPathLabel = ref('')
const statusBar = useStatusBarStore()
const loadTimeSeconds = ref<number | null>(null)
const sessionLaunch = useSessionLaunchStore()
const lastCompare = useLastCompareStore()
const settings = useSettingsStore()
const tabs = useTabsStore()
const router = useRouter()
const { t } = useI18n()
const initialTextSessionOptions = loadTextCompareSessionOptions()
const algorithm = ref<TextDiffAlgorithm>(initialTextSessionOptions.algorithm)
const ignoreWhitespace = ref(initialTextSessionOptions.ignoreWhitespace)
const ignoreCase = ref(initialTextSessionOptions.ignoreCase)
const ignoreLineEndings = ref(initialTextSessionOptions.ignoreLineEndings)
const ignoreRegexInput = ref(initialTextSessionOptions.ignoreRegexes.join(', '))
const showTextRules = ref(true)
const showContextPanel = ref(false)
const contextLineCount = ref(2)
const showSessionSettings = ref(false)
const viewActions = useViewActionsStore()
const folderSettingsPlaceholder = defaultFolderCompareCriteria()
const fileFormats = ref(loadFileFormats())
const selectedFormatId = ref('')
const reportStatus = ref('')
const result = ref<TextDiffResponse | null>(null)
const loading = ref(false)
const error = ref('')
let textCompareGeneration = 0
const dirty = ref(false)
const showSourceEditors = ref(false)
const editMode = ref<TextEditMode>('insert')
const leftUndoStack = ref<string[]>([])
const leftRedoStack = ref<string[]>([])
const rightUndoStack = ref<string[]>([])
const rightRedoStack = ref<string[]>([])
const currentDiffIndex = ref(0)
const findQuery = ref('')
const replaceQuery = ref('')
const findRegex = ref(false)
const findCaseSensitive = ref(false)
const findWholeWord = ref(false)
const currentFindIndex = ref(0)
const ignoredDiffKeys = ref<Set<string>>(new Set())
const showHtmlPreview = ref(false)
const bookmarkSlots = Array.from({ length: 10 }, (_, index) => index)
const selectedBookmark = ref(0)
const bookmarks = ref<Record<number, string>>({})
const showRemoteBrowser = ref(false)
const remoteBrowseSide = ref<'left' | 'right'>('left')
const remoteBrowseProfileId = ref('')
const remoteBrowseProfileLabel = ref('')
const remoteBrowseInitialPath = ref('/')

function currentTextSessionOptions(): ReturnType<typeof loadTextCompareSessionOptions> {
  return {
    algorithm: algorithm.value,
    ignoreWhitespace: ignoreWhitespace.value,
    ignoreCase: ignoreCase.value,
    ignoreLineEndings: ignoreLineEndings.value,
    ignoreRegexes: ignoreRegexInput.value
      .split(/[,\n]/u)
      .map((item) => item.trim())
      .filter(Boolean),
  }
}

function persistTextSessionOptions(): void {
  saveTextCompareSessionOptions(currentTextSessionOptions())
}

function openTextSessionSettings(): void {
  showSessionSettings.value = true
}

function focusTextFormatSelect(): void {
  const select = document.querySelector<HTMLSelectElement>('[data-testid="text-format-select"]')

  select?.focus()
  if (selectedFormatId.value) {
    applySelectedFileFormat(selectedFormatId.value)
  }
}

function applyTextSessionSettings(
  payload:
    | { kind: 'folder'; criteria: ReturnType<typeof defaultFolderCompareCriteria> }
    | { kind: 'text'; options: ReturnType<typeof currentTextSessionOptions> }
    | { kind: 'table'; options: unknown }
    | { kind: 'hex'; options: unknown }
    | { kind: 'picture'; options: unknown },
): void {
  if (payload.kind !== 'text') {
    return
  }

  algorithm.value = payload.options.algorithm
  ignoreWhitespace.value = payload.options.ignoreWhitespace
  ignoreCase.value = payload.options.ignoreCase
  ignoreLineEndings.value = payload.options.ignoreLineEndings
  ignoreRegexInput.value = payload.options.ignoreRegexes.join(', ')
  persistTextSessionOptions()
  showSessionSettings.value = false
  if (left.value || right.value) {
    void runDiff()
  }
}

watch(
  () => [viewActions.sequence, viewActions.name] as const,
  ([, actionName]) => {
    if (!actionName) {
      return
    }

    switch (actionName) {
      case 'session-settings':
        openTextSessionSettings()
        break
      case 'compare':
        void runDiff()
        break
      case 'reload':
        if (leftPathLabel.value && rightPathLabel.value) {
          void loadLaunchTextFiles(leftPathLabel.value, rightPathLabel.value)
        } else {
          void runDiff()
        }
        break
      case 'swap':
        swapPaths()
        break
      case 'rules':
        showTextRules.value = !showTextRules.value
        break
      case 'filters':
        leaveTextContextMode('differences')
        break
      case 'export':
        void exportCurrentReport('html')
        break
      case 'show-all':
        leaveTextContextMode('all')
        break
      case 'show-differences':
        leaveTextContextMode('differences')
        break
      case 'previous-difference':
        goToPreviousDiff()
        break
      case 'next-difference':
        goToNextDiff()
        break
      case 'copy-left':
        copyCurrentDiff('rightToLeft')
        break
      case 'copy-right':
        copyCurrentDiff('leftToRight')
        break
      case 'toggle-minor':
        toggleTextMinorRules()
        break
      case 'about':
      case 'check-for-updates':
      case 'close-tab':
      case 'copy':
      case 'cut':
      case 'delete':
      case 'export-settings':
      case 'help-contents':
      case 'help-support':
      case 'import-settings':
      case 'paste':
      case 'redo':
      case 'save-snapshot':
      case 'restore-factory-defaults':
      case 'save':
      case 'save-as':
      case 'undo':
      case 'workspace-load':
      case 'collapse-all':
      case 'expand-all':
      case 'next-conflict':
      case 'previous-conflict':
      case 'sync-now':
      case 'workspace-save':
      case 'run-script':
      case 'save-report':
        break
    }
  },
)

watch([algorithm, ignoreWhitespace, ignoreCase, ignoreLineEndings, ignoreRegexInput], () => {
  persistTextSessionOptions()
})

async function browseTextPath(side: 'left' | 'right'): Promise<void> {
  const current = side === 'left' ? leftPathLabel.value : rightPathLabel.value
  const parsed = parseRemoteUri(current)

  if (isTauriRuntime() && parsed && isImplementedRemoteProtocol(parsed.protocol)) {
    remoteBrowseSide.value = side
    remoteBrowseProfileId.value = parsed.profileRef
    remoteBrowseProfileLabel.value = parsed.profileRef
    remoteBrowseInitialPath.value = parsed.remotePath || '/'
    showRemoteBrowser.value = true

    return
  }

  const selected = await pickNativePath({ directory: false })

  if (!selected) {
    return
  }

  if (side === 'left') {
    leftPathLabel.value = selected
  } else {
    rightPathLabel.value = selected
  }
}

function applyRemoteTextBrowsePath(path: string): void {
  const parsed = parseRemoteUri(
    remoteBrowseSide.value === 'left' ? leftPathLabel.value : rightPathLabel.value,
  )

  showRemoteBrowser.value = false

  if (!parsed) {
    return
  }

  const uri = formatRemoteUri(parsed.protocol, parsed.profileRef, path || '/')

  if (remoteBrowseSide.value === 'left') {
    leftPathLabel.value = uri
  } else {
    rightPathLabel.value = uri
  }
}

const statsLabel = computed(() => {
  if (!result.value) return t('status.noComparisonYet')
  const { added, deleted, modified, equal } = result.value.stats

  return t('status.diffStats', { equal, modified, added, deleted })
})
const lineEndingStatus = computed(
  () =>
    `${t('ui.left')}: ${detectLineEnding(left.value)} | ${t('ui.right')}: ${detectLineEnding(
      right.value,
    )}`,
)
const statusBarEncoding = computed(() => `UTF-8 | ${lineEndingStatus.value}`)
const dirtyStatus = computed(() => (dirty.value ? t('status.unsavedEdits') : t('status.noEdits')))
const diffRows = computed(() => result.value?.lines.filter((line) => line.kind !== 'equal') ?? [])
const activeDiffRows = computed(() =>
  diffRows.value.filter((line) => !ignoredDiffKeys.value.has(diffKey(line))),
)
const ignoredDiffCount = computed(() =>
  Math.max(0, diffRows.value.length - activeDiffRows.value.length),
)
const filterStatus = computed(() =>
  ignoredDiffCount.value === 0
    ? t('status.allRows')
    : t('status.ignoredCount', { count: ignoredDiffCount.value }),
)
const currentActiveDiff = computed<DiffLine | null>(() => {
  if (currentDiffIndex.value < 0 || currentDiffIndex.value >= activeDiffRows.value.length) {
    return null
  }

  return activeDiffRows.value[currentDiffIndex.value]
})
const activeDiffStatus = computed(() =>
  t('status.activeDiffCount', { count: activeDiffRows.value.length }),
)
const bookmarkStatus = computed(() =>
  bookmarks.value[selectedBookmark.value]
    ? t('status.bookmarkSet', { index: selectedBookmark.value })
    : t('status.noBookmark', { index: selectedBookmark.value }),
)
const textDetails = computed(() => {
  if (!currentActiveDiff.value) {
    return t('status.noActiveDifference')
  }

  const leftNumber = currentActiveDiff.value.leftNumber ?? '-'
  const rightNumber = currentActiveDiff.value.rightNumber ?? '-'

  return t('status.leftRightLineValue', {
    leftLine: leftNumber,
    leftText: currentActiveDiff.value.leftText,
    rightLine: rightNumber,
    rightText: currentActiveDiff.value.rightText,
  })
})
const hexDetails = computed(() => {
  if (!currentActiveDiff.value) {
    return t('status.noBytes')
  }

  return t('status.leftRightValue', {
    left: toHexBytes(currentActiveDiff.value.leftText),
    right: toHexBytes(currentActiveDiff.value.rightText),
  })
})
const canPreviewHtml = computed(() => looksLikeHtml(left.value) || looksLikeHtml(right.value))
const findMatches = computed(() => {
  const matcher = createFindMatcher()

  if (!matcher) {
    return []
  }

  return [left.value, right.value].flatMap((content, sideIndex) =>
    content.split('\n').flatMap((line, lineIndex) => {
      const columnIndex = matcher.findIndex(line)

      return columnIndex >= 0 ? [{ sideIndex, lineIndex, columnIndex }] : []
    }),
  )
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
const leftPathFooterLabel = computed(() => formatPathSideFooter(leftFileStamp.value))
const rightPathFooterLabel = computed(() => formatPathSideFooter(rightFileStamp.value))

function formatPathSideFooter(stamp: FileStamp | null): string {
  if (!stamp) {
    return ''
  }

  const modified = formatPathModifiedAt(stamp.modifiedAtMs)

  if (!modified) {
    return t('status.bytes', { count: stamp.size })
  }

  return t('status.pathFileMetadata', { bytes: stamp.size, modified })
}

const comparisonStatus = computed(() => {
  if (loading.value) {
    return t('status.comparing')
  }

  if (result.value) {
    return t('status.compared')
  }

  return t('status.editing')
})

watchEffect(() => {
  const hasResult = Boolean(result.value)
  const importantDifferenceCount = hasResult
    ? diffRows.value.filter((line) => line.important !== false).length
    : null
  const unimportantDifferenceCount = hasResult
    ? diffRows.value.filter((line) => line.important === false).length
    : null

  statusBar.reportStatus({
    comparisonStatus: comparisonStatus.value,
    differenceCount: hasResult ? diffRows.value.length : null,
    encoding: statusBarEncoding.value,
    filterStatus: filterStatus.value,
    source: 'text-compare',
    chromeKind: 'text-session',
    loadTimeSeconds: hasResult ? loadTimeSeconds.value : null,
    importantDifferenceCount,
    unimportantDifferenceCount,
    editMode: editMode.value,
  })
})

onUnmounted(() => {
  window.removeEventListener('keydown', onSessionInsertKeydown)
})

onMounted(() => {
  window.addEventListener('keydown', onSessionInsertKeydown)
  const launch = sessionLaunch.consumeLaunch('/compare/text')

  if (!launch) {
    return
  }

  leftPathLabel.value =
    launch.locations.left?.displayName ?? launch.locations.left?.uri ?? leftPathLabel.value
  rightPathLabel.value =
    launch.locations.right?.displayName ?? launch.locations.right?.uri ?? rightPathLabel.value

  if (launch.autoRun && launch.locations.left?.uri && launch.locations.right?.uri) {
    void loadLaunchTextFiles(launch.locations.left.uri, launch.locations.right.uri)

    return
  }

  if (lastCompare.text) {
    left.value = lastCompare.text.left
    right.value = lastCompare.text.right
    leftPathLabel.value = lastCompare.text.leftSource ?? leftPathLabel.value
    rightPathLabel.value = lastCompare.text.rightSource ?? rightPathLabel.value
  }

  syncFormatFromPaths()
})

function applySelectedFileFormat(formatId = selectedFormatId.value): void {
  const format = fileFormats.value.find((item) => item.id === formatId)

  if (!format) {
    return
  }

  selectedFormatId.value = format.id
  const next = textOptionsFromFormat(format, {
    ignoreWhitespace: ignoreWhitespace.value,
    ignoreCase: ignoreCase.value,
    ignoreLineEndings: ignoreLineEndings.value,
    ignoreRegexes: ignoreRegexInput.value
      .split('\n')
      .map((value) => value.trim())
      .filter(Boolean),
  })

  ignoreWhitespace.value = next.ignoreWhitespace
  ignoreCase.value = next.ignoreCase
  ignoreLineEndings.value = next.ignoreLineEndings
  ignoreRegexInput.value = next.ignoreRegexes.join('\n')
}

function syncFormatFromPaths(): void {
  const matched = matchFileFormat(leftPathLabel.value || rightPathLabel.value, fileFormats.value)

  if (!matched) {
    return
  }

  selectedFormatId.value = matched.id
}

watch([leftPathLabel, rightPathLabel], () => {
  syncFormatFromPaths()
})

function detectLineEnding(value: string): string {
  if (value.includes('\r\n')) {
    return 'CRLF'
  }

  if (value.includes('\n')) {
    return 'LF'
  }

  if (value.includes('\r')) {
    return 'CR'
  }

  return 'None'
}

function buildDiffRequest(): TextDiffRequest {
  return {
    left: left.value,
    right: right.value,
    algorithm: algorithm.value,
    ignoreWhitespace: ignoreWhitespace.value,
    ignoreCase: ignoreCase.value,
    ignoreLineEndings: ignoreLineEndings.value,
    ignoreRegexes: ignoreRegexInput.value
      .split('\n')
      .map((value) => value.trim())
      .filter(Boolean),
  }
}

function recordCurrentTextCompare(): void {
  lastCompare.recordTextCompare({
    ...buildDiffRequest(),
    leftSource: leftPathLabel.value || undefined,
    rightSource: rightPathLabel.value || undefined,
  })
}

async function runDiff(): Promise<void> {
  const generation = ++textCompareGeneration
  const startedAt = performance.now()

  loading.value = true
  error.value = ''
  try {
    const next = await diffText(buildDiffRequest())

    if (generation !== textCompareGeneration) {
      return
    }

    result.value = next
    loadTimeSeconds.value = elapsedSecondsSince(startedAt)
    recordCurrentTextCompare()
    ignoredDiffKeys.value = new Set()
    bookmarks.value = {}
    currentDiffIndex.value = 0
    dirty.value = false
    void notifyCompareComplete(
      settings.notifyOnCompareComplete,
      t('ui.notifyOnCompareComplete'),
      t('status.compareCompleteNotifyBody'),
    )
  } catch (event) {
    if (generation !== textCompareGeneration) {
      return
    }

    error.value = formatCompareError(event, t)
  } finally {
    if (generation === textCompareGeneration) {
      loading.value = false
    }
  }
}

function cancelTextCompare(): void {
  if (!loading.value) {
    return
  }

  textCompareGeneration += 1
  loading.value = false
  error.value = t('error.compare.cancelled')
}

async function loadLaunchTextFiles(leftPath: string, rightPath: string): Promise<void> {
  const generation = ++textCompareGeneration
  const startedAt = performance.now()

  loading.value = true
  error.value = ''

  try {
    const [leftFile, rightFile] = await Promise.all([
      readTextFile(leftPath),
      readTextFile(rightPath),
    ])

    if (generation !== textCompareGeneration) {
      return
    }

    left.value = leftFile.text
    right.value = rightFile.text
    leftPathLabel.value = leftFile.path
    rightPathLabel.value = rightFile.path
    leftFileStamp.value = leftFile.fileStamp
    rightFileStamp.value = rightFile.fileStamp
    result.value = await diffText(buildDiffRequest())
    loadTimeSeconds.value = elapsedSecondsSince(startedAt)

    if (generation !== textCompareGeneration) {
      return
    }

    recordCurrentTextCompare()
    ignoredDiffKeys.value = new Set()
    bookmarks.value = {}
    currentDiffIndex.value = 0
    dirty.value = false
  } catch (event) {
    if (generation !== textCompareGeneration) {
      return
    }

    error.value = formatCompareError(event, t)
  } finally {
    if (generation === textCompareGeneration) {
      loading.value = false
    }
  }
}

function swapPaths(): void {
  const nextLeft = right.value
  const nextRight = left.value
  const nextLeftPath = rightPathLabel.value
  const nextLeftStamp = rightFileStamp.value

  left.value = nextLeft
  right.value = nextRight
  rightPathLabel.value = leftPathLabel.value
  leftPathLabel.value = nextLeftPath
  rightFileStamp.value = leftFileStamp.value
  leftFileStamp.value = nextLeftStamp
  dirty.value = true
}

async function exportCurrentReport(
  format: 'html' | 'text' | 'json' | 'xml' | 'csv' | 'markdown',
): Promise<void> {
  const extension = reportFileExtension(format)
  const outputPath = `${leftPathLabel.value || 'text-compare'}.${extension}`
  const response = await exportTextCompareReport({
    ...buildDiffRequest(),
    format,
    leftSource: leftPathLabel.value || undefined,
    rightSource: rightPathLabel.value || undefined,
    outputPath,
  })

  reportStatus.value = response.outputPath ?? outputPath
}

function onSourceEditorKeydown(side: 'left' | 'right', event: KeyboardEvent): void {
  if (editMode.value !== 'overwrite' || !shouldHandleOverwriteKeydown(event)) {
    return
  }

  const target = event.target

  if (!(target instanceof HTMLTextAreaElement)) {
    return
  }

  event.preventDefault()
  const current = side === 'left' ? left.value : right.value
  const next = applyOverwriteTyping(current, target.selectionStart, target.selectionEnd, event.key)

  if (side === 'left') {
    updateLeft(next.text)
  } else {
    updateRight(next.text)
  }

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

function updateLeft(value: string): void {
  leftUndoStack.value.push(left.value)
  leftRedoStack.value = []
  left.value = value
  closeHtmlPreviewWhenUnavailable()
  dirty.value = true
}

function updateRight(value: string): void {
  rightUndoStack.value.push(right.value)
  rightRedoStack.value = []
  right.value = value
  closeHtmlPreviewWhenUnavailable()
  dirty.value = true
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
  const matcher = createFindMatcher()

  if (!matcher) {
    return
  }

  left.value = matcher.replace(left.value, replaceQuery.value)
  right.value = matcher.replace(right.value, replaceQuery.value)
  dirty.value = true
  currentFindIndex.value = 0
}

function undoLeft(): void {
  const previous = leftUndoStack.value.pop()

  if (previous === undefined) {
    return
  }

  leftRedoStack.value.push(left.value)
  left.value = previous
  dirty.value = true
}

function redoLeft(): void {
  const next = leftRedoStack.value.pop()

  if (next === undefined) {
    return
  }

  leftUndoStack.value.push(left.value)
  left.value = next
  dirty.value = true
}

function copyCurrentDiff(direction: 'leftToRight' | 'rightToLeft'): void {
  if (activeDiffRows.value.length === 0) {
    return
  }

  const currentDiff = activeDiffRows.value[currentDiffIndex.value]

  if (direction === 'leftToRight') {
    copyLineToSide(currentDiff.rightNumber, currentDiff.leftText, 'right')

    return
  }

  copyLineToSide(currentDiff.leftNumber, currentDiff.rightText, 'left')
}

function copyLineToSide(lineNumber: number | null, text: string, side: 'left' | 'right'): void {
  if (lineNumber === null) {
    return
  }

  const target = side === 'left' ? left : right
  const lines = target.value.split('\n')

  lines[lineNumber - 1] = text
  target.value = lines.join('\n')
  dirty.value = true
  goToNextDiff()
}

function goToNextDiff(): void {
  if (activeDiffRows.value.length === 0) {
    currentDiffIndex.value = 0

    return
  }

  currentDiffIndex.value = Math.min(currentDiffIndex.value + 1, activeDiffRows.value.length - 1)
}

function goToPreviousDiff(): void {
  if (activeDiffRows.value.length === 0) {
    currentDiffIndex.value = 0

    return
  }

  currentDiffIndex.value = Math.max(currentDiffIndex.value - 1, 0)
}

function ignoreCurrentDiff(): void {
  if (activeDiffRows.value.length === 0) {
    return
  }

  const currentDiff = activeDiffRows.value[currentDiffIndex.value]

  ignoredDiffKeys.value = new Set([...ignoredDiffKeys.value, diffKey(currentDiff)])
  currentDiffIndex.value = Math.min(currentDiffIndex.value, activeDiffRows.value.length - 1)
}

function setBookmark(): void {
  if (activeDiffRows.value.length === 0) {
    return
  }

  bookmarks.value = {
    ...bookmarks.value,
    [selectedBookmark.value]: diffKey(activeDiffRows.value[currentDiffIndex.value]),
  }
}

function jumpToBookmark(): void {
  const key = bookmarks.value[selectedBookmark.value]

  if (!key) {
    return
  }

  const index = activeDiffRows.value.findIndex((line) => diffKey(line) === key)

  if (index >= 0) {
    currentDiffIndex.value = index
  }
}

function clearBookmark(): void {
  bookmarks.value = Object.entries(bookmarks.value).reduce<Record<number, string>>(
    (nextBookmarks, [slot, key]) => {
      if (Number(slot) !== selectedBookmark.value) {
        nextBookmarks[Number(slot)] = key
      }

      return nextBookmarks
    },
    {},
  )
}

function diffKey(line: TextDiffResponse['lines'][number]): string {
  return [
    line.kind,
    line.leftNumber ?? '',
    line.rightNumber ?? '',
    line.leftText,
    line.rightText,
  ].join('|')
}

interface FindMatcher {
  findIndex: (value: string) => number
  replace: (value: string, replacement: string) => string
}

function createFindMatcher(): FindMatcher | null {
  if (!findQuery.value) {
    return null
  }

  if (findRegex.value) {
    return createRegexMatcher()
  }

  return createPlainTextMatcher()
}

function createRegexMatcher(): FindMatcher | null {
  try {
    const expression = new RegExp(findQuery.value, findCaseSensitive.value ? 'g' : 'gi')

    return {
      findIndex: (value: string): number => value.search(expression),
      replace: (value: string, replacement: string): string =>
        value.replace(expression, replacement),
    }
  } catch {
    return null
  }
}

function createPlainTextMatcher(): FindMatcher {
  const flags = findCaseSensitive.value ? 'g' : 'gi'
  const escaped = escapeRegExp(findQuery.value)
  const source = findWholeWord.value ? `\\b${escaped}\\b` : escaped
  const expression = new RegExp(source, flags)

  return {
    findIndex: (value: string): number => value.search(expression),
    replace: (value: string, replacement: string): string => value.replace(expression, replacement),
  }
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function toHexBytes(value: string): string {
  if (!value) {
    return '(empty)'
  }

  return Array.from(new TextEncoder().encode(value))
    .map((byte) => byte.toString(16).toUpperCase().padStart(2, '0'))
    .join(' ')
}

function looksLikeHtml(value: string): boolean {
  return /<!doctype html|<html[\s>]|<\/?[a-z][\s\S]*>/iu.test(value)
}

function toggleHtmlPreview(): void {
  if (!canPreviewHtml.value) {
    showHtmlPreview.value = false

    return
  }

  showHtmlPreview.value = !showHtmlPreview.value
}

function closeHtmlPreviewWhenUnavailable(): void {
  if (!canPreviewHtml.value) {
    showHtmlPreview.value = false
  }
}

const textDiffPanelRef = ref<{
  setDisplayMode: (mode: 'all' | 'differences' | 'same') => void
  getDisplayMode: () => 'all' | 'differences' | 'same'
  setDifferenceContextRowCount: (value: number) => void
  getDifferenceContextRowCount: () => number
} | null>(null)
const textDisplayMode = ref<'all' | 'differences' | 'same' | 'context'>('all')

function syncTextTabTitle(): void {
  if (!leftPathLabel.value || !rightPathLabel.value) {
    return
  }

  tabs.setTabTitle('/compare/text', pathPairTitle(leftPathLabel.value, rightPathLabel.value))
}

function goHomeFromText(): void {
  tabs.openTab({ title: 'Home', titleKey: 'ui.home', route: '/', dirty: false })
  void router.push('/')
}

const textSessionToolbar = computed(() =>
  buildTextCompareToolbar({
    home: true,
    all: true,
    diffs: true,
    same: true,
    context: true,
    minor: true,
    rules: true,
    format: fileFormats.value.length > 0,
    sessions: true,
    copy: Boolean(result.value) && activeDiffRows.value.length > 0,
    'next-section': activeDiffRows.value.length > 0,
    'prev-section': activeDiffRows.value.length > 0,
    swap: Boolean(leftPathLabel.value || rightPathLabel.value || left.value || right.value),
    reload:
      Boolean(leftPathLabel.value && rightPathLabel.value) || Boolean(left.value || right.value),
  }).map((item) => ({
    ...item,
    active:
      (item.id === 'all' && textDisplayMode.value === 'all') ||
      (item.id === 'diffs' && textDisplayMode.value === 'differences') ||
      (item.id === 'same' && textDisplayMode.value === 'same') ||
      (item.id === 'context' && textDisplayMode.value === 'context') ||
      (item.id === 'minor' && ignoreWhitespace.value) ||
      (item.id === 'rules' && showTextRules.value),
  })),
)

function toggleTextMinorRules(): void {
  ignoreWhitespace.value = !ignoreWhitespace.value

  if (left.value || right.value || result.value) {
    void runDiff()
  }
}

function leaveTextContextMode(mode?: 'all' | 'differences' | 'same'): void {
  showContextPanel.value = false
  if (mode) {
    textDisplayMode.value = mode
    textDiffPanelRef.value?.setDisplayMode(mode)
  }
}

function showTextContextMode(): void {
  if (showContextPanel.value) {
    leaveTextContextMode('all')

    return
  }

  showContextPanel.value = true
  textDisplayMode.value = 'context'
  textDiffPanelRef.value?.setDisplayMode('differences')
  textDiffPanelRef.value?.setDifferenceContextRowCount(contextLineCount.value)
}

function onContextLineCountInput(event: Event): void {
  const target = event.target

  if (!(target instanceof HTMLInputElement)) {
    return
  }

  const parsed = Number.parseInt(target.value, 10)

  if (Number.isNaN(parsed)) {
    return
  }

  contextLineCount.value = Math.min(99, Math.max(0, parsed))
  if (showContextPanel.value) {
    textDiffPanelRef.value?.setDifferenceContextRowCount(contextLineCount.value)
  }
}

function runTextToolbarCommand(commandId: string): void {
  switch (commandId) {
    case 'home':
      goHomeFromText()
      break
    case 'all':
      leaveTextContextMode('all')
      break
    case 'diffs':
      leaveTextContextMode('differences')
      break
    case 'same':
      leaveTextContextMode('same')
      break
    case 'context':
      showTextContextMode()
      break
    case 'minor':
      toggleTextMinorRules()
      break
    case 'rules':
      showTextRules.value = !showTextRules.value
      break
    case 'format':
      focusTextFormatSelect()
      break
    case 'sessions':
      openTextSessionSettings()
      break
    case 'copy':
      copyCurrentDiff('leftToRight')
      break
    case 'next-section':
      goToNextDiff()
      break
    case 'prev-section':
      goToPreviousDiff()
      break
    case 'swap':
      swapPaths()
      break
    case 'reload':
      if (leftPathLabel.value && rightPathLabel.value) {
        void loadLaunchTextFiles(leftPathLabel.value, rightPathLabel.value)
      } else {
        void runDiff()
      }
      break
    default:
      break
  }
}

watch([leftPathLabel, rightPathLabel], () => {
  syncTextTabTitle()
})

function toggleSourceEditors(): void {
  showSourceEditors.value = !showSourceEditors.value
}
</script>

<template>
  <WorkbenchShell
    class="text-compare-view"
    :title="$t('ui.textCompare')"
    :eyebrow="$t('ui.text')"
    :subtitle="statsLabel"
    :inspector-label="$t('ui.textCompareInspector')"
    data-testid="text-workbench"
    :toolbar-commands="textSessionToolbar"
    toolbar-test-id-prefix="text-session-toolbar"
    @toolbar-command="runTextToolbarCommand"
  >
    <template #title-actions>
      <span class="stats">{{ statsLabel }}</span>
      <span
        class="status-chip"
        data-testid="line-ending-status"
        >{{ lineEndingStatus }}</span
      >
      <span
        class="status-chip"
        data-testid="dirty-status"
        >{{ dirtyStatus }}</span
      >
      <span
        class="status-chip"
        data-testid="active-diff-status"
        >{{ activeDiffStatus }}</span
      >
    </template>

    <template #toolbar>
      <WorkbenchToolbar class="compare-toolbar">
        <button
          type="button"
          class="toolbar-button"
          data-testid="toggle-source-editors"
          @click="toggleSourceEditors"
        >
          {{ showSourceEditors ? $t('ui.hideSources') : $t('ui.editSources') }}
        </button>
        <button
          type="button"
          class="toolbar-button"
          data-testid="undo-left"
          :disabled="leftUndoStack.length === 0"
          @click="undoLeft"
        >
          {{ $t('ui.undo') }}
        </button>
        <button
          type="button"
          class="toolbar-button"
          data-testid="redo-left"
          :disabled="leftRedoStack.length === 0"
          @click="redoLeft"
        >
          {{ $t('ui.redo') }}
        </button>
        <button
          type="button"
          class="toolbar-button"
          data-testid="copy-left-to-right"
          :disabled="!result"
          @click="copyCurrentDiff('leftToRight')"
        >
          {{ $t('ui.leftToRight') }}
        </button>
        <button
          type="button"
          class="toolbar-button"
          data-testid="copy-right-to-left"
          :disabled="!result"
          @click="copyCurrentDiff('rightToLeft')"
        >
          {{ $t('ui.rightToLeft') }}
        </button>
        <button
          type="button"
          class="toolbar-button"
          data-testid="ignore-current-diff"
          :disabled="activeDiffRows.length === 0"
          @click="ignoreCurrentDiff"
        >
          {{ $t('ui.ignore') }}
        </button>
        <button
          type="button"
          class="toolbar-button"
          data-testid="toggle-html-preview"
          :disabled="!canPreviewHtml"
          @click="toggleHtmlPreview"
        >
          {{ $t('ui.preview') }}
        </button>
        <select
          v-model.number="selectedBookmark"
          class="algorithm-select"
          data-testid="bookmark-slot"
        >
          <option
            v-for="slot in bookmarkSlots"
            :key="slot"
            :value="slot"
          >
            {{ slot }}
          </option>
        </select>
        <button
          type="button"
          class="toolbar-button"
          data-testid="set-bookmark"
          :disabled="activeDiffRows.length === 0"
          @click="setBookmark"
        >
          {{ $t('ui.set') }}
        </button>
        <button
          type="button"
          class="toolbar-button"
          data-testid="jump-bookmark"
          :disabled="!bookmarks[selectedBookmark]"
          @click="jumpToBookmark"
        >
          {{ $t('ui.jump') }}
        </button>
        <button
          type="button"
          class="toolbar-button"
          data-testid="clear-bookmark"
          :disabled="!bookmarks[selectedBookmark]"
          @click="clearBookmark"
        >
          {{ $t('ui.clear') }}
        </button>
        <span
          class="status-chip"
          data-testid="bookmark-status"
          >{{ bookmarkStatus }}</span
        >
        <label class="find-option format-select-label">
          <span>{{ $t('ui.fileFormat') }}</span>
          <select
            v-model="selectedFormatId"
            class="algorithm-select"
            data-testid="text-format-select"
            @change="applySelectedFileFormat()"
          >
            <option value="">{{ $t('ui.auto') }}</option>
            <option
              v-for="format in fileFormats"
              :key="format.id"
              :value="format.id"
            >
              {{ format.name }}
            </option>
          </select>
        </label>
        <button
          type="button"
          class="toolbar-button"
          data-testid="apply-text-format"
          :disabled="!selectedFormatId"
          @click="applySelectedFileFormat()"
        >
          {{ $t('ui.applyFormatRules') }}
        </button>
        <select
          v-model="algorithm"
          class="algorithm-select"
          data-testid="algorithm-select"
        >
          <option value="myers">{{ $t('ui.myers') }}</option>
          <option value="patience">{{ $t('ui.patience') }}</option>
          <option value="histogram">{{ $t('ui.histogram') }}</option>
        </select>
        <fieldset
          v-show="showTextRules"
          class="text-rules-panel"
          data-testid="text-rules-panel"
        >
          <legend>{{ $t('ui.rules') }}</legend>
          <label class="find-option">
            <input
              v-model="ignoreWhitespace"
              data-testid="ignore-whitespace"
              type="checkbox"
            />{{ $t('ui.whitespace') }}</label
          >
          <label class="find-option">
            <input
              v-model="ignoreCase"
              data-testid="ignore-case"
              type="checkbox"
            />{{ $t('ui.case') }}</label
          >
          <label class="find-option">
            <input
              v-model="ignoreLineEndings"
              data-testid="ignore-line-endings"
              type="checkbox"
            />{{ $t('ui.lineEndings') }}</label
          >
          <input
            v-model="ignoreRegexInput"
            class="find-input"
            data-testid="ignore-regexes"
            type="text"
            :placeholder="$t('ui.regex')"
          />
        </fieldset>
        <section
          v-if="showContextPanel"
          class="text-context-panel"
          data-testid="text-context-panel"
        >
          <header>
            <strong>{{ $t('ui.context') }}</strong>
            <span>{{ $t('ui.contextLinesHint') }}</span>
          </header>
          <label class="text-context-lines">
            <span>{{ $t('ui.contextLines') }}</span>
            <input
              data-testid="text-context-lines"
              type="number"
              min="0"
              max="99"
              step="1"
              :value="contextLineCount"
              @input="onContextLineCountInput"
            />
          </label>
        </section>
        <button
          type="button"
          data-testid="open-text-session-settings"
          @click="openTextSessionSettings"
        >
          {{ $t('ui.sessionSettings') }}
        </button>

        <button
          type="button"
          data-testid="export-text-html-report"
          @click="exportCurrentReport('html')"
        >
          {{ $t('ui.export') }} {{ $t('ui.html') }}
        </button>
        <button
          type="button"
          data-testid="export-text-text-report"
          @click="exportCurrentReport('text')"
        >
          {{ $t('ui.export') }} {{ $t('ui.text') }}
        </button>
        <button
          type="button"
          data-testid="export-text-csv-report"
          @click="exportCurrentReport('csv')"
        >
          {{ $t('ui.export') }} {{ $t('ui.csv') }}
        </button>
        <button
          type="button"
          data-testid="export-text-markdown-report"
          @click="exportCurrentReport('markdown')"
        >
          {{ $t('ui.export') }} {{ $t('ui.markdown') }}
        </button>
        <span
          v-if="reportStatus"
          data-testid="text-report-status"
          >{{ reportStatus }}</span
        >
        <NButton
          size="small"
          type="primary"
          :loading="loading"
          data-testid="run-diff"
          @click="runDiff"
          >{{ $t('ui.runDiff') }}</NButton
        >
        <button
          v-if="loading"
          type="button"
          class="toolbar-button"
          data-testid="cancel-text-compare"
          @click="cancelTextCompare"
        >
          {{ $t('ui.cancel') }}
        </button>
      </WorkbenchToolbar>
      <section
        v-if="loading"
        class="text-compare-progress"
        data-testid="text-compare-progress"
      >
        <span>{{ $t('status.comparing') }}…</span>
        <button
          type="button"
          data-testid="cancel-text-compare-banner"
          @click="cancelTextCompare"
        >
          {{ $t('ui.cancel') }}
        </button>
      </section>
      <section class="bc-path-block">
        <div class="bc-path-row">
          <input
            v-model="leftPathLabel"
            type="text"
            class="path-input"
            data-testid="text-left-path"
            :title="leftPathLabel"
            :placeholder="$t('ui.remoteUriHint')"
          />
          <button
            type="button"
            data-testid="text-browse-left"
            @click="browseTextPath('left')"
          >
            {{ $t('ui.browse') }}
          </button>
          <button
            type="button"
            data-testid="swap-text-paths"
            @click="swapPaths"
          >
            &lt;&gt;
          </button>
          <input
            v-model="rightPathLabel"
            type="text"
            class="path-input"
            data-testid="text-right-path"
            :title="rightPathLabel"
            :placeholder="$t('ui.remoteUriHint')"
          />
          <button
            type="button"
            data-testid="text-browse-right"
            @click="browseTextPath('right')"
          >
            {{ $t('ui.browse') }}
          </button>
          <button
            type="button"
            data-testid="load-text-files"
            :disabled="loading || !leftPathLabel || !rightPathLabel"
            @click="loadLaunchTextFiles(leftPathLabel, rightPathLabel)"
          >
            {{ $t('ui.loadFiles') }}
          </button>
        </div>
        <div
          class="bc-path-footers"
          data-testid="text-path-footers"
        >
          <span
            class="path-side-footer"
            :class="{ 'path-side-footer-muted': !leftPathFooterLabel }"
            data-testid="text-left-path-footer"
            >{{ leftPathFooterLabel || $t('status.panePlaceholder') }}</span
          >
          <span
            class="path-side-footer"
            :class="{ 'path-side-footer-muted': !rightPathFooterLabel }"
            data-testid="text-right-path-footer"
            >{{ rightPathFooterLabel || $t('status.panePlaceholder') }}</span
          >
        </div>
      </section>
      <WorkbenchToolbar class="find-toolbar">
        <input
          class="find-input"
          data-testid="find-query"
          type="search"
          :placeholder="$t('ui.find')"
          :value="findQuery"
          @input="updateFindQuery"
        />
        <input
          class="find-input"
          data-testid="replace-query"
          type="text"
          :placeholder="$t('ui.replace')"
          :value="replaceQuery"
          @input="updateReplaceQuery"
        />
        <label class="find-option">
          <input
            v-model="findRegex"
            data-testid="find-regex"
            type="checkbox"
          />{{ $t('ui.regex') }}</label
        >
        <label class="find-option">
          <input
            v-model="findCaseSensitive"
            data-testid="find-case-sensitive"
            type="checkbox"
          />{{ $t('ui.case') }}</label
        >
        <label class="find-option">
          <input
            v-model="findWholeWord"
            data-testid="find-whole-word"
            type="checkbox"
          />{{ $t('ui.word') }}</label
        >
        <button
          type="button"
          class="toolbar-button"
          data-testid="find-previous"
          :disabled="findMatches.length === 0"
          @click="findPrevious"
        >
          {{ $t('ui.previous') }}
        </button>
        <button
          type="button"
          class="toolbar-button"
          data-testid="find-next"
          :disabled="findMatches.length === 0"
          @click="findNext"
        >
          {{ $t('ui.next') }}
        </button>
        <span
          class="status-chip"
          data-testid="find-status"
          >{{ findStatus }}</span
        >
        <button
          type="button"
          class="toolbar-button"
          data-testid="replace-all"
          :disabled="findMatches.length === 0"
          @click="replaceAll"
        >
          {{ $t('ui.replaceAll') }}
        </button>
      </WorkbenchToolbar>
    </template>

    <section class="text-workbench-main">
      <div
        v-show="showSourceEditors"
        class="input-row"
      >
        <section class="text-source-pane">
          <header class="split-pane-header active">
            <strong>{{ $t('ui.left') }}</strong>
            <span data-testid="left-path-label">{{ leftPathLabel }}</span>
          </header>
          <NInput
            :value="left"
            type="textarea"
            :placeholder="$t('ui.leftContent')"
            @keydown="onSourceEditorKeydown('left', $event)"
            @update:value="updateLeft"
          />
        </section>
        <section class="text-source-pane">
          <header class="split-pane-header">
            <strong>{{ $t('ui.right') }}</strong>
            <span data-testid="right-path-label">{{ rightPathLabel }}</span>
          </header>
          <NInput
            :value="right"
            type="textarea"
            :placeholder="$t('ui.rightContent')"
            @keydown="onSourceEditorKeydown('right', $event)"
            @update:value="updateRight"
          />
        </section>
      </div>

      <NAlert
        v-if="error"
        type="error"
        :bordered="false"
        >{{ error }}</NAlert
      >

      <TextDiffPanel
        v-if="result"
        ref="textDiffPanelRef"
        :lines="result.lines"
        :grammar="grammarForPath(leftPathLabel || rightPathLabel)"
      />
      <div
        v-else
        class="empty"
      >
        {{ $t('ui.emptyCompareHint') }}
      </div>
    </section>

    <template #inspector>
      <WorkbenchInspector>
        <section class="workbench-inspector-section">
          <h2>{{ $t('ui.change') }}</h2>
          <StatusSummaryGrid
            :items="[
              { label: $t('ui.add'), value: result?.stats.added ?? 0, tone: 'added' },
              { label: $t('ui.delete'), value: result?.stats.deleted ?? 0, tone: 'deleted' },
              { label: $t('ui.modified'), value: result?.stats.modified ?? 0, tone: 'modified' },
              { label: $t('ui.differencesOnly'), value: activeDiffRows.length },
            ]"
          />
        </section>
        <section
          class="workbench-inspector-section"
          :aria-label="$t('ui.textAndHexDetails')"
        >
          <h2>{{ $t('ui.selection') }}</h2>
          <dl>
            <div>
              <dt>{{ $t('ui.encoding') }}</dt>
              <dd>{{ statusBarEncoding }}</dd>
            </div>
            <div>
              <dt>{{ $t('ui.defaultView') }}</dt>
              <dd>{{ filterStatus }}</dd>
            </div>
            <div>
              <dt>{{ $t('ui.history') }}</dt>
              <dd data-testid="bookmark-status">{{ bookmarkStatus }}</dd>
            </div>
          </dl>
        </section>
        <section
          v-if="result"
          class="workbench-inspector-section"
          :aria-label="$t('ui.textAndHexDetails')"
        >
          <h2>{{ $t('ui.detail') }}</h2>
          <dl>
            <div data-testid="text-details">
              <dt>{{ $t('ui.textDetails') }}</dt>
              <dd>{{ textDetails }}</dd>
            </div>
            <div data-testid="hex-details">
              <dt>{{ $t('ui.hexDetails') }}</dt>
              <dd>{{ hexDetails }}</dd>
            </div>
          </dl>
        </section>
      </WorkbenchInspector>
    </template>

    <section
      v-if="showHtmlPreview"
      class="html-preview-panel"
      :aria-label="$t('ui.htmlPreview')"
    >
      <iframe
        class="html-preview-frame"
        data-testid="html-preview"
        :title="$t('ui.leftHtmlPreview')"
        sandbox=""
        :srcdoc="left"
      />
      <iframe
        class="html-preview-frame"
        :title="$t('ui.rightHtmlPreview')"
        sandbox=""
        :srcdoc="right"
      />
    </section>
    <RemotePathBrowser
      v-if="showRemoteBrowser"
      :profile-id="remoteBrowseProfileId"
      :profile-label="remoteBrowseProfileLabel"
      :initial-path="remoteBrowseInitialPath"
      allow-files
      @select="applyRemoteTextBrowsePath"
      @cancel="showRemoteBrowser = false"
    />

    <SessionSettingsDialog
      :open="showSessionSettings"
      kind="text"
      :folder-criteria="folderSettingsPlaceholder"
      :text-options="currentTextSessionOptions()"
      @close="showSessionSettings = false"
      @apply="applyTextSessionSettings"
    />
  </WorkbenchShell>
</template>
<style scoped>
.text-compare-progress {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 6px 10px;
  border-bottom: 1px solid var(--app-border-soft, #d7dbe3);
  background: var(--app-surface-low, #f3f3f3);
  color: var(--app-text-muted);
  font-size: 12px;
}

.text-compare-progress button,
.toolbar-button:focus-visible {
  outline: 2px solid var(--app-primary, #4aa3ff);
  outline-offset: 1px;
}

.text-compare-progress button {
  height: 26px;
  padding: 0 10px;
  border: 1px solid var(--app-border, #c7cdd6);
  border-radius: 4px;
  background: var(--app-canvas, #ffffff);
  color: var(--app-text, #111111);
  cursor: pointer;
}

.compare-toolbar {
  gap: 6px;
}

.stats {
  color: var(--app-text-muted);
  font-size: 12px;
}

.status-chip {
  color: var(--app-text-muted);
  font-size: 12px;
}

.text-rules-panel {
  display: inline-flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
  margin: 0;
  padding: 6px 8px;
  border: 1px solid var(--od-border, #d0d7de);
  border-radius: 6px;
}

.text-rules-panel legend {
  padding: 0 4px;
  font-size: 12px;
}

.text-context-panel {
  display: inline-flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
  margin: 0;
  padding: 6px 8px;
  border: 1px solid var(--od-border, #d0d7de);
  border-radius: 6px;
}

.text-context-panel header {
  display: inline-flex;
  flex-direction: column;
  gap: 2px;
  font-size: 12px;
}

.text-context-panel header span {
  color: var(--app-text-muted);
}

.text-context-lines {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
}

.text-context-lines input {
  width: 64px;
  height: 24px;
  padding: 0 6px;
  border: 1px solid var(--app-border);
  border-radius: 4px;
  background: var(--app-canvas);
  color: var(--app-text);
}

.algorithm-select {
  height: 24px;
  padding: 0 8px;
  border: 1px solid var(--app-border);
  border-radius: 4px;
  background: var(--app-canvas);
  color: var(--app-text);
  font-size: 12px;
}

.toolbar-button {
  flex: 0 0 auto;
  width: auto;
  max-width: 12em;
  height: 28px;
  padding: 0 10px;
  overflow: hidden;
  border: 1px solid var(--app-border);
  border-radius: 4px;
  background: var(--app-canvas);
  color: var(--app-text);
  font-size: 12px;
  line-height: 1.2;
  text-overflow: ellipsis;
  white-space: nowrap;
  cursor: pointer;
}

.toolbar-button:disabled {
  cursor: not-allowed;
  opacity: 0.5;
}

.bc-path-block {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.bc-path-footers {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 8px;
  padding: 0 2px;
}

.path-side-footer {
  min-height: 14px;
  color: var(--od-muted, #6b7280);
  font-size: 11px;
  line-height: 14px;
}

.path-side-footer-muted {
  color: #9ca3af;
}

.find-toolbar {
  gap: 8px;
}

.find-input {
  width: 220px;
  height: 24px;
  padding: 0 8px;
  border: 1px solid var(--app-border);
  border-radius: 4px;
  background: var(--app-canvas);
  color: var(--app-text);
  font-size: 12px;
}

.find-option {
  display: flex;
  align-items: center;
  gap: 4px;
  color: var(--app-text-muted);
  font-size: 12px;
}

.text-workbench-main {
  display: flex;
  flex-direction: column;
  gap: 8px;
  height: 100%;
  min-height: 0;
  padding: 8px;
  overflow: hidden;
}

.input-row {
  display: grid;
  grid-template-columns: 1fr 1fr;
  flex: 0 0 128px;
  gap: 8px;
  min-height: 0;
}

.text-source-pane {
  display: grid;
  grid-template-rows: 28px minmax(0, 1fr);
  min-width: 0;
  min-height: 0;
  overflow: hidden;
  border: 1px solid var(--app-border);
  background: var(--app-canvas);
}

.text-source-pane :deep(.n-input) {
  height: 100%;
  border-radius: 0;
}

.empty {
  display: grid;
  min-height: 0;
  border: 1px dashed var(--app-border);
  border-radius: 4px;
  color: var(--app-text-muted);
  place-items: center;
}

.html-preview-panel {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 10px;
  min-height: 180px;
}

.html-preview-frame {
  width: 100%;
  height: 220px;
  border: 1px solid var(--app-border);
  border-radius: 6px;
  background: #ffffff;
}
</style>
