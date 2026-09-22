<script setup lang="ts">
import { computed, ref, watch, watchEffect } from 'vue'
import { useRouter } from 'vue-router'
import { diffText } from '@/api/diff'
import { readClipboardTextSource } from '@/app/clipboardSource'
import { buildClipboardCompareToolbar, pathPairTitle } from '@/app/sessionToolbars'
import TextDiffPanel from '@/components/diff/TextDiffPanel.vue'
import PathMetaFooter from '@/components/workbench/PathMetaFooter.vue'
import WorkbenchShell from '@/components/workbench/WorkbenchShell.vue'
import { useI18n } from '@/i18n'
import { useTabsStore } from '@/stores/tabs'
import { useStatusBarStore } from '@/stores/statusBar'
import { useViewActionsStore } from '@/stores/viewActions'
import type { TextDiffResponse } from '@/types/diff'

interface ClipboardHistoryEntry {
  id: number
  title: string
  text: string
  lineCount: number
  characterCount: number
}

const history = ref<ClipboardHistoryEntry[]>([])
const { t } = useI18n()
const router = useRouter()
const tabs = useTabsStore()
const statusBar = useStatusBarStore()
const viewActions = useViewActionsStore()
const leftEntryId = ref<number | null>(null)
const rightEntryId = ref<number | null>(null)
const nextEntryId = ref(1)
const captureStatusKey = ref('status.noClipboardTextCaptured')
const captureStatusParams = ref<Record<string, string | number>>({})
const error = ref('')
const loading = ref(false)
const comparing = ref(false)
const result = ref<TextDiffResponse | null>(null)

const captureStatus = computed(() => t(captureStatusKey.value, captureStatusParams.value))
const historyCount = computed(() => t('status.capturedCount', { count: history.value.length }))
const canCompare = computed(() => leftEntryId.value !== null && rightEntryId.value !== null)
const leftEntry = computed(() => history.value.find((entry) => entry.id === leftEntryId.value))
const rightEntry = computed(() => history.value.find((entry) => entry.id === rightEntryId.value))
const leftClipboardStamp = computed(() =>
  leftEntry.value ? { size: leftEntry.value.characterCount, modifiedAtMs: 0 } : null,
)
const rightClipboardStamp = computed(() =>
  rightEntry.value ? { size: rightEntry.value.characterCount, modifiedAtMs: 0 } : null,
)
const diffStats = computed(() => {
  if (!result.value) {
    return t('status.noComparisonYet')
  }

  const { equal, modified, added, deleted } = result.value.stats

  return t('status.diffStats', { equal, modified, added, deleted })
})
const clipboardToolbar = computed(() =>
  buildClipboardCompareToolbar({
    home: true,
    capture: !loading.value,
    compare: canCompare.value && !comparing.value,
    swap: leftEntryId.value !== null || rightEntryId.value !== null,
    reload: canCompare.value && !comparing.value,
  }),
)

watch(
  [leftEntry, rightEntry],
  ([left, right]) => {
    if (left && right) {
      tabs.setTabTitle('/compare/clipboard', pathPairTitle(left.title, right.title))
    }
  },
  { immediate: true },
)

watchEffect(() => {
  let comparisonStatus = t('status.readyIdle')

  if (comparing.value || loading.value) {
    comparisonStatus = t('status.comparing')
  } else if (result.value) {
    comparisonStatus = t('status.compared')
  }

  const differenceCount = result.value
    ? result.value.stats.added + result.value.stats.deleted + result.value.stats.modified
    : null

  statusBar.reportStatus({
    comparisonStatus,
    differenceCount,
    filterStatus: t('status.allRows'),
    source: 'clipboard-compare',
    chromeKind: 'clipboard-session',
  })
})

async function captureClipboard(): Promise<void> {
  loading.value = true
  error.value = ''

  try {
    const source = await readClipboardTextSource()
    const text = source.text

    if (history.value[0]?.text === text) {
      setCaptureStatus('status.clipboardTextAlreadyCaptured')

      return
    }

    const entry: ClipboardHistoryEntry = {
      id: nextEntryId.value,
      title: t('ui.clipboardEntryTitle', { index: nextEntryId.value }),
      text,
      lineCount: countLines(text),
      characterCount: text.length,
    }

    nextEntryId.value += 1
    history.value = [entry, ...history.value].slice(0, 20)
    setCaptureStatus('status.clipboardEntryCaptured', { title: entry.title })

    if (leftEntryId.value === null) {
      leftEntryId.value = entry.id

      return
    }

    rightEntryId.value ??= entry.id
  } catch (event) {
    error.value =
      typeof event === 'object' && event !== null && 'message' in event
        ? String(event.message)
        : String(event)
  } finally {
    loading.value = false
  }
}

async function compareClipboardHistory(): Promise<void> {
  const left = leftEntry.value
  const right = rightEntry.value

  if (!left || !right) {
    return
  }

  comparing.value = true
  error.value = ''

  try {
    result.value = await diffText({
      left: left.text,
      right: right.text,
      algorithm: 'myers',
    })
  } catch (event) {
    error.value = String(event)
  } finally {
    comparing.value = false
  }
}

function selectEntry(id: number): void {
  if (leftEntryId.value === id) {
    return
  }

  if (rightEntryId.value === id) {
    leftEntryId.value = id
    rightEntryId.value = null

    return
  }

  if (leftEntryId.value === null) {
    leftEntryId.value = id

    return
  }

  rightEntryId.value = id
}

function selectionLabel(entry: ClipboardHistoryEntry): string {
  if (entry.id === leftEntryId.value) {
    return t('ui.left')
  }

  if (entry.id === rightEntryId.value) {
    return t('ui.right')
  }

  return t('ui.select')
}

function countLines(text: string): number {
  return text.length === 0 ? 0 : text.split('\n').length
}

function setCaptureStatus(key: string, params: Record<string, string | number> = {}): void {
  captureStatusKey.value = key
  captureStatusParams.value = params
}

function swapClipboardSides(): void {
  const nextLeft = rightEntryId.value

  rightEntryId.value = leftEntryId.value
  leftEntryId.value = nextLeft
  result.value = null
}

function goHome(): void {
  tabs.openTab({ title: 'Home', titleKey: 'ui.home', route: '/', dirty: false })
  void router.push('/')
}

function runClipboardToolbarCommand(commandId: string): void {
  switch (commandId) {
    case 'home':
      goHome()
      break
    case 'capture':
      void captureClipboard()
      break
    case 'compare':
    case 'reload':
      void compareClipboardHistory()
      break
    case 'swap':
      swapClipboardSides()
      break
    default:
      break
  }
}

watch(
  () => [viewActions.sequence, viewActions.name] as const,
  ([, actionName]) => {
    if (actionName === 'compare' || actionName === 'reload') {
      void compareClipboardHistory()

      return
    }

    if (actionName === 'swap') {
      swapClipboardSides()
    }
  },
)
</script>

<template>
  <WorkbenchShell
    :title="$t('ui.clipboardCompare')"
    :eyebrow="$t('ui.clipboardCompare')"
    :subtitle="captureStatus"
    :toolbar-commands="clipboardToolbar"
    toolbar-test-id-prefix="clipboard-toolbar"
    @toolbar-command="runClipboardToolbarCommand"
  >
    <section
      class="clipboard-compare-view"
      data-clipboard-chrome-density="capture-1to1"
    >
      <section class="clipboard-toolbar">
        <NButton
          size="small"
          type="primary"
          :loading="loading"
          data-testid="clipboard-capture"
          @click="captureClipboard"
          >{{ $t('ui.captureClipboard') }}</NButton
        >
        <NButton
          size="small"
          :disabled="!canCompare"
          :loading="comparing"
          data-testid="clipboard-compare"
          @click="compareClipboardHistory"
          >{{ $t('ui.compareSelected') }}</NButton
        >
        <NButton
          size="small"
          :disabled="!leftEntryId && !rightEntryId"
          data-testid="clipboard-swap"
          @click="swapClipboardSides"
          >{{ $t('ui.swap') }}</NButton
        >
        <span
          class="status-chip"
          data-testid="clipboard-history-count"
          >{{ historyCount }}</span
        >
        <span
          class="status-chip"
          data-testid="clipboard-diff-stats"
          >{{ diffStats }}</span
        >
      </section>

      <div
        class="bc-path-footers"
        data-testid="clipboard-path-footers"
      >
        <PathMetaFooter
          :stamp="leftClipboardStamp"
          :format-label="leftEntry?.title"
          test-id="clipboard-left-path-footer"
        />
        <PathMetaFooter
          :stamp="rightClipboardStamp"
          :format-label="rightEntry?.title"
          test-id="clipboard-right-path-footer"
        />
      </div>

      <NAlert
        v-if="error"
        type="error"
        :bordered="false"
        >{{ error }}</NAlert
      >

      <section class="clipboard-layout">
        <aside
          class="history-pane"
          data-clipboard-rows-density="capture-1to1"
        >
          <header>
            <strong>{{ $t('ui.history') }}</strong>
            <span>{{ $t('status.entryCount', { count: history.length }) }}</span>
          </header>
          <div class="history-list">
            <button
              v-for="entry in history"
              :key="entry.id"
              type="button"
              class="history-entry"
              :class="{
                selected: entry.id === leftEntryId || entry.id === rightEntryId,
              }"
              data-testid="clipboard-history-entry"
              @click="selectEntry(entry.id)"
            >
              <strong>{{ entry.title }}</strong>
              <span>{{ selectionLabel(entry) }}</span>
              <small>{{
                $t('status.lineCharCount', {
                  lines: entry.lineCount,
                  chars: entry.characterCount,
                })
              }}</small>
              <code>{{ entry.text }}</code>
            </button>
          </div>
        </aside>

        <section class="diff-pane">
          <TextDiffPanel
            v-if="result"
            :lines="result.lines"
          />
          <div
            v-else
            class="empty"
          >
            {{ $t('ui.captureTwoClipboardTextsAndCompareThem') }}
          </div>
        </section>
      </section>
    </section>
  </WorkbenchShell>
</template>
<style scoped>
.bc-path-footers {
  display: grid;
  grid-template-columns: 1fr 1fr;
  align-items: center;
  gap: 1px;
  min-height: 20px;
  padding: 0 2px;
}

.path-side-footer {
  min-height: 20px;
  font-size: 11px;
  line-height: 16px;
}

.clipboard-compare-view {
  display: grid;
  grid-template-rows: auto auto minmax(0, 1fr);
  gap: 4px;
  height: 100%;
  padding: 2px 4px;
  overflow: hidden;
}

.clipboard-toolbar {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 4px 6px;
  min-height: 22px;
  padding: 2px 4px;
  border: 1px solid #a0a0a0;
  border-radius: 0;
  background: var(--app-surface);
}

.status-chip {
  color: var(--app-text-muted);
  font-size: 11px;
  line-height: 16px;
}

:deep(.clipboard-toolbar .n-button) {
  --n-height: 18px;
  --n-padding: 0 6px;
  --n-font-size: 11px;

  height: 18px;
  min-height: 18px;
  padding: 0 6px;
  border-radius: 0;
  font-size: 11px;
  line-height: 16px;
}

.clipboard-layout {
  display: grid;
  grid-template-columns: minmax(220px, 300px) minmax(0, 1fr);
  gap: 4px;
  min-height: 0;
}

.history-pane,
.diff-pane {
  min-width: 0;
  min-height: 0;
  border: 1px solid #a0a0a0;
  border-radius: 0;
  background: var(--app-surface);
}

.history-pane {
  display: grid;
  grid-template-rows: auto minmax(0, 1fr);
  gap: 4px;
  padding: 4px 6px;
}

.history-pane header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 6px;
  min-height: 20px;
}

.history-pane header span {
  color: var(--app-text-muted);
  font-size: 11px;
  line-height: 16px;
}

.history-list {
  display: grid;
  align-content: start;
  gap: 2px;
  overflow: auto;
}

.history-entry {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  gap: 0 6px;
  min-height: 18px;
  padding: 2px 6px;
  border: 1px solid #a0a0a0;
  border-radius: 0;
  background: var(--app-bg);
  color: var(--app-text);
  font-size: 11px;
  line-height: 16px;
  text-align: left;
  cursor: pointer;
}

.history-entry.selected {
  border-color: #2563eb;
  background: rgb(37 99 235 / 0.08);
}

.history-entry small,
.history-entry code {
  grid-column: 1 / -1;
  min-width: 0;
  overflow: hidden;
  color: var(--app-text-muted);
  font-size: 11px;
  line-height: 16px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.history-entry code {
  font-family: var(--font-mono);
}

.diff-pane {
  overflow: hidden;
}

.empty {
  display: grid;
  height: 100%;
  color: var(--app-text-muted);
  place-items: center;
}

@media (width <= 820px) {
  .clipboard-compare-view {
    overflow: auto;
  }

  .clipboard-layout {
    grid-template-columns: 1fr;
  }
}
</style>
