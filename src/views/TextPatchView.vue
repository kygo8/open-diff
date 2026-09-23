<script setup lang="ts">
import {
  loadTextPatchSessionOptions,
  saveTextPatchSessionOptions,
  type TextPatchSessionOptions,
} from '@/app/textPatchSessionOptions'
import { computed, nextTick, onMounted, ref, watch, watchEffect } from 'vue'
import { useRouter } from 'vue-router'
import { applyTextPatch, applyTextPatchToFile, parseTextPatch, readTextFile } from '@/api/diff'
import { buildTextPatchToolbar } from '@/app/sessionToolbars'
import {
  clampSectionIndex,
  flattenPatchSections,
  reconstructAlignedRowsFromHunk,
  reconstructSidesFromFile,
  reconstructSidesFromHunk,
} from '@/app/textPatchSections'
import WorkbenchInspector from '@/components/workbench/WorkbenchInspector.vue'
import { pickNativePath } from '@/app/filePicker'
import PathMetaFooter from '@/components/workbench/PathMetaFooter.vue'
import SessionPathActions from '@/components/workbench/SessionPathActions.vue'
import WorkbenchShell from '@/components/workbench/WorkbenchShell.vue'
import SessionSettingsDialog from '@/components/session/SessionSettingsDialog.vue'
import WorkbenchToolbar from '@/components/workbench/WorkbenchToolbar.vue'
import { useI18n } from '@/i18n'
import { formatCompareError } from '@/app/compareError'
import { useLastCompareStore } from '@/stores/lastCompare'
import { useSessionLaunchStore } from '@/stores/sessionLaunch'
import { useStatusBarStore } from '@/stores/statusBar'
import { elapsedSecondsSince } from '@/app/statusBarPhrases'
import { useTabsStore } from '@/stores/tabs'
import { useViewActionsStore } from '@/stores/viewActions'
import type { FileStamp, PatchFile, PatchLineKind, TextPatchResponse } from '@/types/diff'

const patchInput = ref('')
const result = ref<TextPatchResponse | null>(null)
const showSessionSettings = ref(false)
const patchSessionOptions = ref<TextPatchSessionOptions>(loadTextPatchSessionOptions())
const loading = ref(false)
const error = ref('')
const sourcePath = ref('')
const sourceFileStamp = ref<FileStamp | null>(null)
const targetPath = ref('')
const sourceText = ref('')
const patchedText = ref('')
const applyStatus = ref('')
const sourceEncoding = ref('UTF-8')
const sourceLineEnding = ref('LF')

async function browsePatchPath(side: 'source' | 'target'): Promise<void> {
  const selected = await pickNativePath({ directory: false })

  if (!selected) {
    return
  }

  if (side === 'source') {
    sourcePath.value = selected
  } else {
    targetPath.value = selected
  }
}

const statusBar = useStatusBarStore()
const sessionLaunch = useSessionLaunchStore()
const lastCompare = useLastCompareStore()
const tabs = useTabsStore()
const viewActions = useViewActionsStore()
const router = useRouter()
const { t } = useI18n()
const selectedSectionIndex = ref(0)
const loadTimeSeconds = ref<number | null>(null)

const fileCount = computed(() => result.value?.files.length ?? 0)
const hunkCount = computed(
  () => result.value?.files.reduce((total, file) => total + file.hunks.length, 0) ?? 0,
)
const patchSections = computed(() => flattenPatchSections(result.value?.files ?? []))
const currentSection = computed(() => {
  const sections = patchSections.value

  if (sections.length === 0) {
    return undefined
  }

  return sections[clampSectionIndex(selectedSectionIndex.value, sections.length)]
})
const sectionPositionLabel = computed(() => {
  const total = patchSections.value.length

  if (total === 0) {
    return t('status.sectionPosition', { index: 0, total: 0 })
  }

  return t('status.sectionPosition', {
    index: clampSectionIndex(selectedSectionIndex.value, total) + 1,
    total,
  })
})
const currentSectionPreview = computed(() => {
  const section = currentSection.value
  const files = result.value?.files ?? []

  if (!section) {
    return null
  }

  const file = files[section.fileIndex]
  const hunk = file.hunks[section.hunkIndex]

  return reconstructAlignedRowsFromHunk(file, hunk)
})
const patchSessionToolbar = computed(() =>
  buildTextPatchToolbar({
    home: true,
    sessions: true,
    'next-section': patchSections.value.length > 0,
    'prev-section': patchSections.value.length > 0,
  }).map((item) => ({
    ...item,
    active: Boolean(item.active) || (item.id === 'sessions' && showSessionSettings.value),
  })),
)
const lineStats = computed(() => {
  const stats: Record<PatchLineKind, number> = {
    added: 0,
    context: 0,
    removed: 0,
  }

  for (const file of result.value?.files ?? []) {
    for (const hunk of file.hunks) {
      for (const line of hunk.lines) {
        stats[line.kind] += 1
      }
    }
  }

  return stats
})
const subtitle = computed(() => {
  if (!result.value) {
    return t('ui.pasteOrDropUnifiedDiff')
  }

  return t('status.patchSummary', { files: fileCount.value, hunks: hunkCount.value })
})
const comparisonStatus = computed(() => {
  if (loading.value) {
    return t('status.parsing')
  }

  if (result.value) {
    return t('status.parsed')
  }

  return t('app.ready')
})

watchEffect(() => {
  const differenceCount = result.value ? lineStats.value.added + lineStats.value.removed : null
  const importantDifferenceCount = differenceCount
  const unimportantDifferenceCount = result.value ? 0 : null

  statusBar.reportStatus({
    comparisonStatus: comparisonStatus.value,
    differenceCount,
    encoding: `${sourceEncoding.value} | ${sourceLineEnding.value}`,
    filterStatus: t('status.allRows'),
    source: 'text-patch',
    chromeKind: 'text-session',
    loadTimeSeconds: result.value ? loadTimeSeconds.value : null,
    importantDifferenceCount,
    unimportantDifferenceCount,
    editMode: result.value ? 'insert' : null,
  })
})

onMounted(() => {
  const launch = sessionLaunch.consumeLaunch('/patch/text')

  if (!launch) {
    return
  }

  const patchLocation = launch.locations.left ?? launch.locations.right

  if (!patchLocation) {
    return
  }

  sourcePath.value = patchLocation.displayName ?? patchLocation.uri

  if (launch.autoRun) {
    void loadAndParsePatchFile(patchLocation.uri)
  }
})

async function loadAndParsePatchFile(path: string): Promise<void> {
  const startedAt = performance.now()

  loading.value = true
  error.value = ''

  try {
    const file = await readTextFile(path)

    patchInput.value = file.text
    sourcePath.value = file.path
    sourceEncoding.value = file.encoding
    sourceLineEnding.value = file.lineEnding
    sourceFileStamp.value = file.fileStamp
    result.value = await parseTextPatch(file.text)
    loadTimeSeconds.value = elapsedSecondsSince(startedAt)
    selectedSectionIndex.value = 0
  } catch (event) {
    error.value = formatCompareError(event, t)
  } finally {
    loading.value = false
  }
}

async function applyPatchToTargetFile(): Promise<void> {
  const source = sourcePath.value.trim()

  if (!source) {
    error.value = t('ui.sourceFile')

    return
  }

  loading.value = true
  error.value = ''
  applyStatus.value = ''

  try {
    const outputPath = targetPath.value.trim() || source
    const response = await applyTextPatchToFile({
      sourcePath: source,
      patch: patchInput.value,
      outputPath,
    })

    patchedText.value = response.text
    applyStatus.value = t('status.patchWritten', { path: outputPath })
  } catch (event) {
    error.value = formatCompareError(event, t)
  } finally {
    loading.value = false
  }
}

async function openPatchedInTextCompare(): Promise<void> {
  if (!patchedText.value && sourceText.value) {
    await applyCurrentPatch()
  }

  lastCompare.recordTextCompare({
    left: sourceText.value,
    right: patchedText.value,
    leftSource: sourcePath.value || undefined,
    rightSource: targetPath.value || undefined,
  })
  sessionLaunch.setPendingLaunch({
    id: crypto.randomUUID(),
    source: 'command',
    sessionType: 'text-compare',
    title: t('ui.textCompare'),
    route: '/compare/text',
    autoRun: false,
    locations: {
      left: {
        uri: sourcePath.value || 'source',
        displayName: t('ui.sourceFile'),
        kind: 'file',
        readOnly: false,
      },
      right: {
        uri: targetPath.value || 'patched',
        displayName: t('ui.patchedOutput'),
        kind: 'file',
        readOnly: false,
      },
    },
  })
  await router.push('/compare/text')
}

async function applyCurrentPatch(): Promise<void> {
  loading.value = true
  error.value = ''
  applyStatus.value = ''

  try {
    const response = await applyTextPatch({
      source: sourceText.value,
      patch: patchInput.value,
    })

    patchedText.value = response.text
    applyStatus.value = t('status.patchApplied')
  } catch (event) {
    error.value = formatCompareError(event, t)
  } finally {
    loading.value = false
  }
}

async function parseCurrentPatch(): Promise<void> {
  const startedAt = performance.now()

  loading.value = true
  error.value = ''

  try {
    result.value = await parseTextPatch(patchInput.value)
    loadTimeSeconds.value = elapsedSecondsSince(startedAt)
    selectedSectionIndex.value = 0
    await nextTick()
    scrollToSelectedSection()
  } catch (event) {
    error.value = formatCompareError(event, t)
  } finally {
    loading.value = false
  }
}

function goHomeFromPatch(): void {
  tabs.openTab({ title: t('ui.home'), titleKey: 'ui.home', route: '/', dirty: false })
  void router.push('/')
}

function goToSection(delta: number): void {
  const total = patchSections.value.length

  if (total === 0) {
    return
  }

  selectedSectionIndex.value = clampSectionIndex(selectedSectionIndex.value + delta, total)
  void nextTick().then(() => scrollToSelectedSection())
}

function selectSection(fileIndex: number, hunkIndex: number): void {
  const index = patchSections.value.findIndex(
    (section) => section.fileIndex === fileIndex && section.hunkIndex === hunkIndex,
  )

  if (index < 0) {
    return
  }

  selectedSectionIndex.value = index
  void nextTick().then(() => scrollToSelectedSection())
}

function scrollToSelectedSection(): void {
  const section = currentSection.value

  if (!section) {
    return
  }

  const target = document.querySelector(`[data-section-id="${section.id}"]`)

  if (target instanceof HTMLElement && typeof target.scrollIntoView === 'function') {
    target.scrollIntoView({ block: 'center' })
  }
}

function isSelectedHunk(fileIndex: number, hunkIndex: number): boolean {
  const section = currentSection.value

  return section?.fileIndex === fileIndex && section.hunkIndex === hunkIndex
}

function isSelectedFile(fileIndex: number): boolean {
  const section = currentSection.value

  return section?.fileIndex === fileIndex
}

function launchTextCompare(sides: {
  left: string
  right: string
  leftSource: string
  rightSource: string
}): void {
  lastCompare.recordTextCompare({
    left: sides.left,
    right: sides.right,
    leftSource: sides.leftSource,
    rightSource: sides.rightSource,
  })
  sessionLaunch.setPendingLaunch({
    id: crypto.randomUUID(),
    source: 'command',
    sessionType: 'text-compare',
    title: t('ui.textCompare'),
    route: '/compare/text',
    autoRun: false,
    locations: {
      left: {
        uri: sides.leftSource || 'source',
        displayName: sides.leftSource || t('ui.sourceFile'),
        kind: 'file',
        readOnly: false,
      },
      right: {
        uri: sides.rightSource || 'patched',
        displayName: sides.rightSource || t('ui.patchedOutput'),
        kind: 'file',
        readOnly: false,
      },
    },
  })
  void router.push('/compare/text')
}

function openSelectedInTextCompare(): void {
  const section = currentSection.value
  const files = result.value?.files ?? []

  if (!section) {
    void openPatchedInTextCompare()

    return
  }

  const file = files[section.fileIndex]
  const hunk = file.hunks[section.hunkIndex]

  launchTextCompare(reconstructSidesFromHunk(file, hunk))
}

function openFileInTextCompare(file: PatchFile): void {
  launchTextCompare(reconstructSidesFromFile(file))
}

function openPatchSessionSettings(): void {
  showSessionSettings.value = true
}

function applyPatchSessionSettings(
  payload:
    | { kind: 'folder'; criteria: unknown; filters?: unknown }
    | { kind: 'text'; options: unknown }
    | { kind: 'table'; options: unknown }
    | { kind: 'hex'; options: unknown }
    | { kind: 'picture'; options: unknown }
    | { kind: 'media'; options: unknown }
    | { kind: 'version'; options: unknown }
    | { kind: 'registry'; options: unknown }
    | { kind: 'patch'; options: TextPatchSessionOptions },
): void {
  if (payload.kind !== 'patch') {
    return
  }

  patchSessionOptions.value = { ...patchSessionOptions.value, ...payload.options }
  saveTextPatchSessionOptions(patchSessionOptions.value)
  showSessionSettings.value = false
}

function runPatchToolbarCommand(commandId: string): void {
  if (commandId === 'sessions') {
    openPatchSessionSettings()

    return
  }

  switch (commandId) {
    case 'home':
      goHomeFromPatch()
      break
    case 'next-section':
      goToSection(1)
      break
    case 'prev-section':
      goToSection(-1)
      break
    default:
      break
  }
}

watch(
  () => [viewActions.sequence, viewActions.name] as const,
  ([, actionName]) => {
    if (actionName === 'compare' || actionName === 'reload') {
      void parseCurrentPatch()

      return
    }

    if (actionName === 'save') {
      void applyPatchToTargetFile()

      return
    }

    if (actionName === 'next-difference') {
      goToSection(1)

      return
    }

    if (actionName === 'previous-difference') {
      goToSection(-1)
    }
  },
)

watch(patchSections, (sections) => {
  if (sections.length === 0) {
    selectedSectionIndex.value = 0

    return
  }

  selectedSectionIndex.value = clampSectionIndex(selectedSectionIndex.value, sections.length)
})

function lineClass(kind: PatchLineKind): string {
  return `patch-line-${kind}`
}

function linePrefix(kind: PatchLineKind): string {
  if (kind === 'added') {
    return '+'
  }

  if (kind === 'removed') {
    return '-'
  }

  return ' '
}

function lineNumber(value: number | null): string {
  return value === null ? '-' : String(value)
}
</script>

<template>
  <WorkbenchShell
    class="text-patch-view"
    :data-wrap-long-lines="patchSessionOptions.wrapLongLines ? 'true' : 'false'"
    :title="$t('ui.textPatch')"
    :eyebrow="$t('ui.patch')"
    :subtitle="subtitle"
    :inspector-label="$t('ui.textPatchInspector')"
    data-testid="text-patch-workbench"
    :toolbar-commands="patchSessionToolbar"
    toolbar-test-id-prefix="patch-session-toolbar"
    @toolbar-command="runPatchToolbarCommand"
  >
    <template #title-actions>
      <span
        class="status-chip"
        data-testid="patch-source-path"
      >
        {{ sourcePath || $t('ui.unsavedPatchText') }}
      </span>
      <span class="status-chip">{{ comparisonStatus }}</span>
    </template>

    <template #toolbar>
      <WorkbenchToolbar class="patch-toolbar">
        <NButton
          size="small"
          type="primary"
          :loading="loading"
          data-testid="parse-text-patch"
          @click="parseCurrentPatch"
        >
          {{ $t('ui.parsePatch') }}
        </NButton>
        <NButton
          size="small"
          :loading="loading"
          data-testid="apply-text-patch"
          @click="applyCurrentPatch"
        >
          {{ $t('ui.applyPatch') }}
        </NButton>
        <NButton
          size="small"
          :loading="loading"
          data-testid="apply-text-patch-to-file"
          @click="applyPatchToTargetFile"
        >
          {{ $t('ui.applyToFile') }}
        </NButton>
        <NButton
          size="small"
          :loading="loading"
          data-testid="open-patched-text-compare"
          @click="openPatchedInTextCompare"
        >
          {{ $t('ui.openInTextCompare') }}
        </NButton>
        <NButton
          size="small"
          :disabled="patchSections.length === 0"
          data-testid="patch-prev-section"
          @click="goToSection(-1)"
        >
          {{ $t('ui.prevSection') }}
        </NButton>
        <NButton
          size="small"
          :disabled="patchSections.length === 0"
          data-testid="patch-next-section"
          @click="goToSection(1)"
        >
          {{ $t('ui.nextSection') }}
        </NButton>
        <NButton
          size="small"
          :disabled="!currentSection"
          data-testid="open-selected-text-compare"
          @click="openSelectedInTextCompare"
        >
          {{ $t('ui.openSelectedInTextCompare') }}
        </NButton>
        <span
          class="status-chip"
          data-testid="patch-section-position"
          >{{ sectionPositionLabel }}</span
        >
        <span class="status-chip">{{ $t('status.fileCount', { count: fileCount }) }}</span>
        <span class="status-chip">{{ $t('status.hunkCount', { count: hunkCount }) }}</span>
      </WorkbenchToolbar>
    </template>

    <section class="patch-workbench-main">
      <section class="patch-input-pane">
        <header>
          <strong>{{ $t('ui.patchInput') }}</strong>
          <span>{{ sourceEncoding }} | {{ sourceLineEnding }}</span>
        </header>
        <NInput
          :value="patchInput"
          type="textarea"
          data-testid="text-patch-input"
          :placeholder="$t('ui.pasteOrDropUnifiedDiff')"
          @update:value="patchInput = $event"
        />
        <label>
          <span>{{ $t('ui.sourceFile') }}</span>
          <div class="path-field-row">
            <input
              v-model="sourcePath"
              type="text"
              class="path-input"
              data-testid="patch-source-file"
              :title="sourcePath"
            />
            <SessionPathActions
              browse-test-id="patch-browse-source"
              :show-save="false"
              @browse="browsePatchPath('source')"
            />
          </div>
        </label>
        <label>
          <span>{{ $t('ui.targetFile') }}</span>
          <div class="path-field-row">
            <input
              v-model="targetPath"
              type="text"
              class="path-input"
              data-testid="patch-target-file"
              :title="targetPath"
            />
            <SessionPathActions
              browse-test-id="patch-browse-target"
              :show-save="false"
              @browse="browsePatchPath('target')"
            />
          </div>
        </label>
        <div
          class="bc-path-footers"
          data-testid="patch-path-footers"
        >
          <PathMetaFooter
            :stamp="sourceFileStamp"
            :encoding="sourceEncoding"
            :line-ending="sourceLineEnding"
            test-id="patch-source-path-footer"
          />
          <PathMetaFooter
            :stamp="null"
            muted
            test-id="patch-target-path-footer"
          />
        </div>
        <NInput
          :value="sourceText"
          type="textarea"
          data-testid="patch-source-text"
          :placeholder="$t('ui.sourceFile')"
          @update:value="sourceText = $event"
        />
        <NInput
          :value="patchedText"
          type="textarea"
          data-testid="patch-output-text"
          :placeholder="$t('ui.patchedOutput')"
          readonly
        />
        <span
          v-if="applyStatus"
          data-testid="patch-apply-status"
          >{{ applyStatus }}</span
        >
      </section>

      <NAlert
        v-if="error"
        type="error"
        :bordered="false"
        data-testid="text-patch-error"
      >
        {{ error }}
      </NAlert>

      <section
        v-if="currentSectionPreview"
        class="patch-section-preview"
        data-testid="patch-section-preview"
      >
        <header class="patch-section-preview-header">
          <strong>{{ $t('ui.section') }} · {{ $t('ui.preview') }}</strong>
          <span data-testid="patch-section-preview-position">{{ sectionPositionLabel }}</span>
        </header>
        <div class="patch-section-panes">
          <article
            class="patch-section-pane"
            data-testid="patch-section-preview-left"
          >
            <header data-testid="patch-section-preview-left-path">
              {{ currentSectionPreview.leftSource }}
            </header>
            <div class="patch-section-pane-body">
              <div
                v-for="(row, rowIndex) in currentSectionPreview.rows"
                :key="`left-${rowIndex}`"
                class="patch-preview-row"
                :class="`patch-preview-${row.left.kind}`"
                data-testid="patch-section-preview-left-row"
              >
                <span class="patch-preview-line-number">{{
                  row.left.lineNumber === null ? '' : row.left.lineNumber
                }}</span>
                <span class="patch-preview-text">{{ row.left.text }}</span>
              </div>
            </div>
          </article>
          <article
            class="patch-section-pane"
            data-testid="patch-section-preview-right"
          >
            <header data-testid="patch-section-preview-right-path">
              {{ currentSectionPreview.rightSource }}
            </header>
            <div class="patch-section-pane-body">
              <div
                v-for="(row, rowIndex) in currentSectionPreview.rows"
                :key="`right-${rowIndex}`"
                class="patch-preview-row"
                :class="`patch-preview-${row.right.kind}`"
                data-testid="patch-section-preview-right-row"
              >
                <span class="patch-preview-line-number">{{
                  row.right.lineNumber === null ? '' : row.right.lineNumber
                }}</span>
                <span class="patch-preview-text">{{ row.right.text }}</span>
              </div>
            </div>
          </article>
        </div>
      </section>

      <section
        v-if="result"
        class="patch-result"
        data-testid="text-patch-result"
      >
        <article
          v-for="(file, fileIndex) in result.files"
          :key="`${file.oldPath}->${file.newPath}`"
          class="patch-file"
          :class="{ 'patch-file-selected': isSelectedFile(fileIndex) }"
          data-testid="text-patch-file"
        >
          <header>
            <strong>{{ file.oldPath }}</strong>
            <span>{{ file.newPath }}</span>
            <button
              type="button"
              class="patch-open-file"
              data-testid="open-file-text-compare"
              @click.stop="openFileInTextCompare(file)"
            >
              {{ $t('ui.openInTextCompare') }}
            </button>
          </header>

          <section
            v-for="(hunk, hunkIndex) in file.hunks"
            :key="`${hunk.oldStart}-${hunk.newStart}-${hunk.heading}`"
            class="patch-hunk"
            :class="{ 'patch-hunk-selected': isSelectedHunk(fileIndex, hunkIndex) }"
            :data-section-id="`${fileIndex}:${hunkIndex}:${hunk.oldStart}:${hunk.newStart}`"
            data-testid="text-patch-hunk"
            @click="selectSection(fileIndex, hunkIndex)"
          >
            <header>
              @@ -{{ hunk.oldStart }},{{ hunk.oldCount }} +{{ hunk.newStart }},{{
                hunk.newCount
              }}
              @@ {{ hunk.heading }}
            </header>
            <div class="patch-lines">
              <div
                v-for="(line, index) in hunk.lines"
                :key="`${index}-${line.kind}-${line.text}`"
                class="patch-line"
                :class="lineClass(line.kind)"
                :data-line-label="`${lineNumber(line.oldNumber)} ${lineNumber(
                  line.newNumber,
                )} ${line.text}`"
                data-testid="text-patch-line"
              >
                <span class="patch-line-number">{{ lineNumber(line.oldNumber) }} </span>
                <span class="patch-line-number">{{ lineNumber(line.newNumber) }} </span>
                <span class="patch-line-prefix">{{ linePrefix(line.kind) }} </span>
                <code>{{ line.text }}</code>
              </div>
            </div>
          </section>
        </article>
      </section>

      <div
        v-else
        class="empty"
      >
        {{ $t('ui.unifiedDiffEmptyState') }}
      </div>
    </section>

    <template #inspector>
      <WorkbenchInspector>
        <section class="workbench-inspector-section">
          <h2>{{ $t('ui.patchSummaryTitle') }}</h2>
          <dl>
            <div>
              <dt>{{ $t('ui.files') }}</dt>
              <dd>{{ fileCount }}</dd>
            </div>
            <div>
              <dt>{{ $t('ui.hunks') }}</dt>
              <dd>{{ hunkCount }}</dd>
            </div>
            <div>
              <dt>{{ $t('ui.section') }}</dt>
              <dd data-testid="patch-inspector-section">{{ sectionPositionLabel }}</dd>
            </div>
            <div>
              <dt>{{ $t('ui.added') }}</dt>
              <dd data-tone="added">{{ lineStats.added }}</dd>
            </div>
            <div>
              <dt>{{ $t('ui.removed') }}</dt>
              <dd data-tone="deleted">{{ lineStats.removed }}</dd>
            </div>
            <div>
              <dt>{{ $t('ui.context') }}</dt>
              <dd>{{ lineStats.context }}</dd>
            </div>
          </dl>
        </section>
      </WorkbenchInspector>
    </template>
    <SessionSettingsDialog
      :open="showSessionSettings"
      kind="patch"
      :patch-options="patchSessionOptions"
      @close="showSessionSettings = false"
      @apply="applyPatchSessionSettings"
    />
  </WorkbenchShell>
</template>

<style scoped>
.status-chip {
  color: var(--app-text-muted);
  font-size: 11px;
}

.patch-toolbar {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 4px;
  min-height: 20px;
  padding: 1px 2px;
}

.patch-toolbar :deep(.n-button) {
  height: 18px;
  min-height: 18px;
  padding: 0 5px;
  border-radius: 0;
  font-size: 11px;
}

.patch-toolbar .status-chip,
.patch-toolbar [data-testid='patch-section-position'] {
  font-size: 11px;
  line-height: 16px;
}

.patch-workbench-main {
  display: grid;
  grid-template-rows: minmax(96px, 0.28fr) auto minmax(140px, 0.42fr) minmax(0, 1fr);
  gap: 2px;
  height: 100%;
  min-height: 0;
  padding: 2px 4px;
  overflow: hidden;
}

.patch-input-pane {
  display: grid;
  grid-template-rows: 20px minmax(0, 1fr);
  min-height: 0;
  overflow: hidden;
  border: 1px solid var(--app-border);
  border-radius: 0;
  background: var(--app-canvas);
}

.patch-input-pane header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 4px;
  padding: 0 4px;
  border-bottom: 1px solid var(--app-border);
  background: var(--app-surface-low);
  color: var(--app-text-muted);
  font-size: 11px;
}

.patch-input-pane strong {
  color: var(--app-text);
}

.patch-input-pane :deep(.n-input) {
  height: 100%;
  border-radius: 0;
}

.patch-input-pane :deep(textarea) {
  padding: 2px 4px;
  font-size: 11px;
  line-height: 18px;
}

.patch-result {
  display: grid;
  gap: 2px;
  min-height: 0;
  overflow: auto;
}

.patch-file {
  display: grid;
  gap: 2px;
  min-width: 0;
  border: 1px solid var(--app-border);
  border-radius: 0;
  background: var(--app-canvas);
}

.patch-file > header {
  display: flex;
  align-items: center;
  gap: 4px;
  min-height: 20px;
  padding: 2px 4px;
  border-bottom: 1px solid var(--app-border);
  background: var(--app-surface-low);
  font-family: var(--font-mono);
  font-size: 11px;
}

.patch-file > header span,
.patch-file > header strong {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.patch-file-selected > header {
  outline: 1px solid color-mix(in srgb, var(--app-accent, #3b82f6) 55%, transparent);
}

.patch-open-file {
  margin-left: auto;
  height: 20px;
  padding: 0 5px;
  border: 1px solid var(--app-border, #334155);
  border-radius: 0;
  background: transparent;
  color: inherit;
  font-size: 11px;
  cursor: pointer;
}

.patch-hunk-selected {
  outline: 2px solid color-mix(in srgb, var(--app-accent, #3b82f6) 70%, transparent);
  background: color-mix(in srgb, var(--app-accent, #3b82f6) 12%, transparent);
}

.patch-hunk {
  display: grid;
  gap: 0;
  padding: 0 4px 4px;
  cursor: pointer;
}

.patch-hunk > header {
  padding: 1px 4px;
  border: 1px solid var(--app-border);
  border-bottom: 0;
  background: var(--app-surface-muted);
  color: var(--app-text-muted);
  font-family: var(--font-mono);
  font-size: 11px;
  line-height: 16px;
}

.patch-lines {
  display: grid;
  overflow: auto;
  border: 1px solid var(--app-border);
}

.patch-line {
  display: grid;
  grid-template-columns: 36px 36px 18px minmax(0, 1fr);
  min-width: 520px;
  border-bottom: 1px solid var(--app-border-soft);
  font-family: var(--font-mono);
  font-size: 11px;
  line-height: 18px;
}

.patch-line:last-child {
  border-bottom: 0;
}

.patch-line-number,
.patch-line-prefix {
  padding: 0 4px;
  border-right: 1px solid var(--app-border-soft);
  color: var(--app-text-muted);
  text-align: right;
}

.patch-line-prefix {
  text-align: center;
}

.patch-line code {
  min-width: 0;
  padding: 0 4px;
  overflow: hidden;
  color: var(--app-text);
  text-overflow: ellipsis;
  white-space: pre;
}

.patch-line-added {
  background: var(--diff-added-bg);
}

.patch-line-removed {
  background: var(--diff-deleted-bg);
}

.empty {
  display: grid;
  min-height: 0;
  border: 1px dashed var(--app-border);
  border-radius: 0;
  color: var(--app-text-muted);
  place-items: center;
}

.patch-section-preview {
  display: grid;
  grid-template-rows: 20px minmax(0, 1fr);
  min-height: 0;
  overflow: hidden;
  border: 1px solid var(--app-border);
  border-radius: 0;
  background: var(--app-canvas);
}

.patch-section-preview-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 4px;
  padding: 0 4px;
  border-bottom: 1px solid var(--app-border);
  background: var(--app-surface-low);
  color: var(--app-text-muted);
  font-size: 11px;
}

.patch-section-preview-header strong {
  color: var(--app-text);
}

.patch-section-panes {
  display: grid;
  grid-template-columns: 1fr 1fr;
  min-height: 0;
  overflow: hidden;
}

.patch-section-pane {
  display: grid;
  grid-template-rows: 20px minmax(0, 1fr);
  min-width: 0;
  min-height: 0;
  border-right: 1px solid var(--app-border);
}

.patch-section-pane:last-child {
  border-right: none;
}

.patch-section-pane > header {
  display: flex;
  align-items: center;
  padding: 0 4px;
  overflow: hidden;
  border-bottom: 1px solid var(--app-border);
  background: var(--app-surface-low);
  color: var(--app-text-muted);
  font-family: var(--font-mono);
  font-size: 11px;
  white-space: nowrap;
  text-overflow: ellipsis;
}

.patch-section-pane-body {
  min-height: 0;
  overflow: auto;
  font-family: var(--font-mono);
  font-size: 11px;
  line-height: 18px;
}

.patch-preview-row {
  display: grid;
  grid-template-columns: 36px minmax(0, 1fr);
  gap: 4px;
  min-height: 18px;
  padding: 0 4px;
}

.patch-preview-line-number {
  color: var(--app-text-muted);
  text-align: right;
  user-select: none;
}

.patch-preview-text {
  overflow-wrap: anywhere;
  white-space: pre-wrap;
}

.patch-preview-removed {
  background: color-mix(in srgb, var(--diff-deleted-bg, #fff0f0) 85%, transparent);
  color: var(--diff-deleted-fg, #b42318);
}

.patch-preview-added {
  background: color-mix(in srgb, var(--diff-added-bg, #f0fff4) 85%, transparent);
  color: var(--diff-added-fg, #027a48);
}

.patch-preview-empty {
  background: transparent;
  color: transparent;
}

.patch-preview-context {
  background: transparent;
}

.path-field-row {
  display: flex;
  align-items: center;
  gap: 2px;
  min-width: 0;
  min-height: 20px;
  padding: 1px 0;
}

.path-field-row input,
.path-field-row .path-input {
  flex: 1;
  min-width: 0;
  height: 20px;
  min-height: 20px;
  padding: 0 4px;
  border: 1px solid #a0a0a0;
  border-radius: 0;
  font-size: 12px;
  line-height: 18px;
}

.bc-path-footers {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 1px;
  width: 100%;
  padding: 0 2px;
}

.path-side-footer {
  min-height: 20px;
  overflow: hidden;
  color: var(--app-text-muted, #6b7280);
  font-size: 11px;
  line-height: 16px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.path-side-footer-muted {
  color: #9ca3af;
}

:deep(.patch-toolbar .n-button) {
  --n-height: 18px;
  --n-padding: 0 5px;
  --n-font-size: 11px;

  height: 18px;
  min-height: 18px;
  padding: 0 5px;
  font-size: 11px;
}
</style>
