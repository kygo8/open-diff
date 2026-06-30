<script setup lang="ts">
import { computed, onMounted, ref, watchEffect } from 'vue'
import { parseTextPatch, readTextFile } from '@/api/diff'
import WorkbenchInspector from '@/components/workbench/WorkbenchInspector.vue'
import WorkbenchShell from '@/components/workbench/WorkbenchShell.vue'
import WorkbenchToolbar from '@/components/workbench/WorkbenchToolbar.vue'
import { useI18n } from '@/i18n'
import { useSessionLaunchStore } from '@/stores/sessionLaunch'
import { useStatusBarStore } from '@/stores/statusBar'
import type { PatchLineKind, TextPatchResponse } from '@/types/diff'

const patchInput = ref('')
const result = ref<TextPatchResponse | null>(null)
const loading = ref(false)
const error = ref('')
const sourcePath = ref('')
const sourceEncoding = ref('UTF-8')
const sourceLineEnding = ref('LF')
const statusBar = useStatusBarStore()
const sessionLaunch = useSessionLaunchStore()
const { t } = useI18n()

const fileCount = computed(() => result.value?.files.length ?? 0)
const hunkCount = computed(
  () => result.value?.files.reduce((total, file) => total + file.hunks.length, 0) ?? 0,
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
  statusBar.reportStatus({
    comparisonStatus: comparisonStatus.value,
    differenceCount: lineStats.value.added + lineStats.value.removed,
    encoding: `${sourceEncoding.value} | ${sourceLineEnding.value}`,
    filterStatus: t('status.allRows'),
    source: 'text-patch',
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
  loading.value = true
  error.value = ''

  try {
    const file = await readTextFile(path)

    patchInput.value = file.text
    sourcePath.value = file.path
    sourceEncoding.value = file.encoding
    sourceLineEnding.value = file.lineEnding
    result.value = await parseTextPatch(file.text)
  } catch (event) {
    error.value = event instanceof Error ? event.message : String(event)
  } finally {
    loading.value = false
  }
}

async function parseCurrentPatch(): Promise<void> {
  loading.value = true
  error.value = ''

  try {
    result.value = await parseTextPatch(patchInput.value)
  } catch (event) {
    error.value = event instanceof Error ? event.message : String(event)
  } finally {
    loading.value = false
  }
}

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
    :title="$t('ui.textPatch')"
    :eyebrow="$t('ui.patch')"
    :subtitle="subtitle"
    :inspector-label="$t('ui.textPatchInspector')"
    data-testid="text-patch-workbench"
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
        v-if="result"
        class="patch-result"
        data-testid="text-patch-result"
      >
        <article
          v-for="file in result.files"
          :key="`${file.oldPath}->${file.newPath}`"
          class="patch-file"
          data-testid="text-patch-file"
        >
          <header>
            <strong>{{ file.oldPath }}</strong>
            <span>{{ file.newPath }}</span>
          </header>

          <section
            v-for="hunk in file.hunks"
            :key="`${hunk.oldStart}-${hunk.newStart}-${hunk.heading}`"
            class="patch-hunk"
            data-testid="text-patch-hunk"
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
  </WorkbenchShell>
</template>

<style scoped>
.status-chip {
  color: var(--app-text-muted);
  font-size: 12px;
}

.patch-toolbar {
  gap: 8px;
}

.patch-workbench-main {
  display: grid;
  grid-template-rows: minmax(112px, 0.34fr) auto minmax(0, 1fr);
  gap: 10px;
  height: 100%;
  min-height: 0;
  padding: 8px;
  overflow: hidden;
}

.patch-input-pane {
  display: grid;
  grid-template-rows: 28px minmax(0, 1fr);
  min-height: 0;
  overflow: hidden;
  border: 1px solid var(--app-border);
  background: var(--app-canvas);
}

.patch-input-pane header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  padding: 0 10px;
  border-bottom: 1px solid var(--app-border);
  background: var(--app-surface-low);
  color: var(--app-text-muted);
  font-size: 12px;
}

.patch-input-pane strong {
  color: var(--app-text);
}

.patch-input-pane :deep(.n-input) {
  height: 100%;
  border-radius: 0;
}

.patch-result {
  display: grid;
  gap: 10px;
  min-height: 0;
  overflow: auto;
}

.patch-file {
  display: grid;
  gap: 8px;
  min-width: 0;
  border: 1px solid var(--app-border);
  border-radius: 4px;
  background: var(--app-canvas);
}

.patch-file > header {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
  gap: 8px;
  padding: 8px 10px;
  border-bottom: 1px solid var(--app-border);
  background: var(--app-surface-low);
  font-family: var(--font-mono);
  font-size: 12px;
}

.patch-file > header span,
.patch-file > header strong {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.patch-hunk {
  display: grid;
  gap: 0;
  padding: 0 8px 8px;
}

.patch-hunk > header {
  padding: 5px 8px;
  border: 1px solid var(--app-border);
  border-bottom: 0;
  background: var(--app-surface-muted);
  color: var(--app-text-muted);
  font-family: var(--font-mono);
  font-size: 12px;
}

.patch-lines {
  display: grid;
  overflow: auto;
  border: 1px solid var(--app-border);
}

.patch-line {
  display: grid;
  grid-template-columns: 44px 44px 22px minmax(0, 1fr);
  min-width: 520px;
  border-bottom: 1px solid var(--app-border-soft);
  font-family: var(--font-mono);
  font-size: 12px;
  line-height: 24px;
}

.patch-line:last-child {
  border-bottom: 0;
}

.patch-line-number,
.patch-line-prefix {
  padding: 0 8px;
  border-right: 1px solid var(--app-border-soft);
  color: var(--app-text-muted);
  text-align: right;
}

.patch-line-prefix {
  text-align: center;
}

.patch-line code {
  min-width: 0;
  padding: 0 8px;
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
  border-radius: 4px;
  color: var(--app-text-muted);
  place-items: center;
}
</style>
