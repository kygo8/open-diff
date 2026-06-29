<script setup lang="ts">
import { computed, ref } from 'vue'
import { useRouter } from 'vue-router'
import { Code2, FolderOpen, FolderSync, GitMerge, type LucideIcon } from '@lucide/vue'
import { readClipboardTextSource } from '@/app/clipboardSource'
import { classifyDropInputs } from '@/app/dropInput'
import { filterSavedSessions } from '@/app/savedSessions'
import { selectSessionForDrop } from '@/app/sessionAutoSelect'
import { sessionCatalog } from '@/app/sessionCatalog'
import DenseDataTable from '@/components/workbench/DenseDataTable.vue'
import StatusSummaryGrid from '@/components/workbench/StatusSummaryGrid.vue'
import WorkbenchInspector from '@/components/workbench/WorkbenchInspector.vue'
import WorkbenchShell from '@/components/workbench/WorkbenchShell.vue'
import { useI18n } from '@/i18n'
import { useSavedSessionsStore } from '@/stores/savedSessions'
import { useTabsStore } from '@/stores/tabs'
import type { DropClassification, DropInput } from '@/app/dropInput'
import type { SessionSelection } from '@/app/sessionAutoSelect'
import type { SessionCatalogEntry } from '@/app/sessionCatalog'
import type { SessionDocument, SessionType } from '@/types/session'

type QuickStartType = 'text-compare' | 'folder-compare' | 'text-merge' | 'folder-sync'

interface QuickStartEntry extends SessionCatalogEntry {
  icon: LucideIcon
}

const quickStartTypes: QuickStartType[] = [
  'text-compare',
  'folder-compare',
  'text-merge',
  'folder-sync',
]

const quickStartIcons: Record<QuickStartType, LucideIcon> = {
  'folder-compare': FolderOpen,
  'folder-sync': FolderSync,
  'text-compare': Code2,
  'text-merge': GitMerge,
}

const router = useRouter()
const { t } = useI18n()
const tabs = useTabsStore()
const savedSessions = useSavedSessionsStore()
const dropResult = ref<DropClassification>({
  kind: 'invalid',
  reason: t('ui.dropExactlyTwoFilesOrFolders'),
})
const selectedDropSession = ref<SessionSelection>()
const isDragging = ref(false)
const sessionSearch = ref('')
const clipboardStatus = ref(t('ui.clipboardTextSourceNotLoaded'))
const filteredSavedSessions = computed(() =>
  filterSavedSessions(savedSessions.sessions, {
    query: sessionSearch.value,
    types: new Set(),
  }),
)
const quickStartEntries = computed<QuickStartEntry[]>(() =>
  quickStartTypes
    .map((type) => {
      const entry = sessionCatalog.find((item) => item.type === type)

      return entry ? { ...entry, icon: quickStartIcons[type] } : undefined
    })
    .filter((entry): entry is QuickStartEntry => Boolean(entry)),
)
const historyItems = computed(() => [
  {
    title: t('ui.configUpdated'),
    meta: `${t('ui.twoMinsAgo')} - ${t('ui.textCompare')}`,
    active: true,
  },
  {
    title: t('ui.releaseV12Diff'),
    meta: `${t('ui.yesterday')} - ${t('ui.folderCompare')}`,
    active: false,
  },
])

function openSession(entry: SessionCatalogEntry): void {
  if (!entry.implemented || !entry.route) {
    return
  }

  tabs.openTab({ title: entry.title, route: entry.route, dirty: false })
  void router.push(entry.route)
}

function openSavedSession(session: SessionDocument): void {
  const entry = sessionCatalog.find((item) => item.type === session.sessionType)

  if (!entry?.route) {
    return
  }

  tabs.openTab({ title: session.name, route: entry.route, dirty: session.metadata.dirty })
  void router.push(entry.route)
}

function handleDragOver(event: DragEvent): void {
  event.preventDefault()
  isDragging.value = true
}

function handleDragLeave(): void {
  isDragging.value = false
}

function handleDrop(event: DragEvent): void {
  event.preventDefault()
  isDragging.value = false
  dropResult.value = classifyDropInputs(inputsFromDataTransfer(event.dataTransfer))
  selectedDropSession.value =
    dropResult.value.kind === 'invalid' ? undefined : selectSessionForDrop(dropResult.value)
}

function inputsFromDataTransfer(dataTransfer: DataTransfer | null): DropInput[] {
  if (!dataTransfer) {
    return []
  }

  const fileInputs = [...dataTransfer.files].map<DropInput>((file) => ({
    path: file.webkitRelativePath || file.name,
    kind: 'file',
  }))

  if (fileInputs.length > 0) {
    return fileInputs
  }

  return [...dataTransfer.items]
    .filter((item) => item.kind === 'file')
    .map<DropInput>((item) => ({ path: item.type || 'Unknown item', kind: 'unknown' }))
}

function openSelectedDropSession(): void {
  if (!selectedDropSession.value?.enabled || !selectedDropSession.value.route) {
    return
  }

  tabs.openTab({
    title: selectedDropSession.value.title,
    route: selectedDropSession.value.route,
    dirty: false,
  })
  void router.push(selectedDropSession.value.route)
}

async function openClipboardText(): Promise<void> {
  try {
    const source = await readClipboardTextSource()

    clipboardStatus.value = `${source.title} ready`
    tabs.openTab({ title: source.title, route: '/compare/text', dirty: false })
    void router.push('/compare/text')
  } catch (error) {
    clipboardStatus.value =
      typeof error === 'object' && error !== null && 'message' in error
        ? String(error.message)
        : String(error)
  }
}

function renameSavedSession(id: string): void {
  const session = savedSessions.sessions.find((item) => item.id === id)

  if (!session) {
    return
  }

  savedSessions.renameSession(id, `${session.name} Renamed`)
}

function copySavedSession(id: string): void {
  savedSessions.copySession(id)
}

function moveSavedSession(id: string): void {
  savedSessions.moveSession(id, t('ui.archive'))
}

function deleteSavedSession(id: string): void {
  savedSessions.requestDeleteSession(id)
}

function changeSavedSessionRules(id: string): void {
  savedSessions.updateSessionRules(id, { comparison: { whitespace: 'ignore' } })
}

function saveAndClosePendingSession(): void {
  const pending = savedSessions.pendingSavePrompt

  if (!pending) {
    return
  }

  savedSessions.markSessionSaved(pending.id)
  savedSessions.requestDeleteSession(pending.id)
}

function restoreWorkspaceFromRecovery(): void {
  const first = savedSessions.recoveryCandidates.at(0)

  savedSessions.restoreRecoverySessions()

  if (!first) {
    return
  }

  const entry = sessionCatalog.find((item) => item.type === first.sessionType)

  if (!entry?.implemented || !entry.route) {
    return
  }

  tabs.openTab({ title: first.name, route: entry.route, dirty: first.metadata.dirty })
  void router.push(entry.route)
}

function sessionTypeLabel(type: SessionType): string {
  const labels: Partial<Record<SessionType, string>> = {
    'folder-compare': t('ui.folder'),
    'folder-sync': t('ui.sync'),
    'text-compare': t('ui.text'),
    'text-merge': t('ui.threeWay'),
  }

  return labels[type] ?? type
}

function sessionPath(session: SessionDocument, side: 'left' | 'right'): string {
  return session.locations[side]?.uri ?? '--'
}

function lastOpenedLabel(session: SessionDocument, index: number): string {
  if (session.metadata.lastOpenedAt) {
    return session.metadata.lastOpenedAt
  }

  return (
    [t('ui.twoMinsAgo'), t('ui.yesterday'), 'Oct 12, 14:30', 'Oct 10, 09:15'][index] ??
    t('ui.recently')
  )
}
</script>

<template>
  <WorkbenchShell
    class="home-view"
    :title="$t('ui.newSession')"
    :subtitle="$t('ui.chooseAComparisonWorkspace')"
    :eyebrow="$t('ui.workspace')"
    :inspector-label="$t('ui.workspaceInspector')"
  >
    <template #title-actions>
      <span class="home-title-count">{{ sessionCatalog.length }} {{ $t('ui.sessionTypes') }}</span>
    </template>

    <section class="home-workspace">
      <section
        class="new-session-panel"
        data-testid="home-new-session"
      >
        <h2>{{ $t('ui.newSession') }}</h2>
        <div class="new-session-grid">
          <article
            v-for="entry in quickStartEntries"
            :key="entry.type"
            class="new-session-card"
            data-testid="home-new-session-card"
            :data-session-type="entry.type"
            tabindex="0"
            @click="openSession(entry)"
            @keydown.enter="openSession(entry)"
            @keydown.space.prevent="openSession(entry)"
          >
            <span class="session-card-icon">
              <component
                :is="entry.icon"
                :size="17"
              />
            </span>
            <h3>{{ entry.type === 'text-merge' ? '3-Way Merge' : entry.title }}</h3>
            <p>{{ entry.summary }}</p>
            <button type="button">{{ $t('ui.open') }}</button>
          </article>
        </div>
      </section>

      <section
        class="recent-session-panel"
        data-testid="home-recent-sessions"
      >
        <header>
          <h2>{{ $t('ui.recentSessions') }}</h2>
          <input
            v-model="sessionSearch"
            data-testid="session-search"
            type="search"
            :placeholder="$t('ui.filterSessions')"
          />
        </header>

        <div
          v-if="savedSessions.recoveryCandidates.length > 0"
          class="recovery-entry"
          data-testid="recovery-entry"
        >
          <span>{{
            $t('ui.recoverSession', { name: savedSessions.recoveryCandidates[0]?.name ?? '' })
          }}</span>
          <button
            type="button"
            data-testid="restore-recovery"
            @click="restoreWorkspaceFromRecovery"
          >
            {{ $t('ui.restoreRecent') }}
          </button>
        </div>

        <DenseDataTable>
          <table data-testid="home-recent-sessions-table">
            <thead>
              <tr>
                <th class="icon-col"></th>
                <th>{{ $t('ui.name') }}</th>
                <th>{{ $t('ui.type') }}</th>
                <th>{{ $t('ui.leftPath') }}</th>
                <th>{{ $t('ui.rightPath') }}</th>
                <th>{{ $t('ui.lastOpened') }}</th>
              </tr>
            </thead>
            <tbody>
              <tr
                v-for="(session, index) in filteredSavedSessions"
                :key="session.id"
                @dblclick="openSavedSession(session)"
              >
                <td class="icon-col">
                  <span class="recent-session-icon">{{
                    sessionTypeLabel(session.sessionType)[0]
                  }}</span>
                </td>
                <td>
                  <strong>{{ session.name }}</strong>
                  <span class="row-actions">
                    <button
                      type="button"
                      :data-testid="`rename-session-${session.id}`"
                      :disabled="session.metadata.locked"
                      @click="renameSavedSession(session.id)"
                    >
                      {{ $t('ui.rename') }}
                    </button>
                    <button
                      type="button"
                      :data-testid="`copy-session-${session.id}`"
                      @click="copySavedSession(session.id)"
                    >
                      {{ $t('ui.copy') }}
                    </button>
                    <button
                      type="button"
                      :data-testid="`move-session-${session.id}`"
                      :disabled="session.metadata.locked"
                      @click="moveSavedSession(session.id)"
                    >
                      {{ $t('ui.move') }}
                    </button>
                    <button
                      type="button"
                      :data-testid="`change-rules-session-${session.id}`"
                      :disabled="session.metadata.locked"
                      @click="changeSavedSessionRules(session.id)"
                    >
                      {{ $t('ui.rules') }}
                    </button>
                    <button
                      type="button"
                      :data-testid="`delete-session-${session.id}`"
                      :disabled="session.metadata.locked"
                      @click="deleteSavedSession(session.id)"
                    >
                      {{ $t('ui.delete') }}
                    </button>
                  </span>
                </td>
                <td>{{ sessionTypeLabel(session.sessionType) }}</td>
                <td class="path-cell">{{ sessionPath(session, 'left') }}</td>
                <td class="path-cell">{{ sessionPath(session, 'right') }}</td>
                <td>{{ lastOpenedLabel(session, index) }}</td>
              </tr>
            </tbody>
          </table>
        </DenseDataTable>

        <div
          v-if="savedSessions.pendingSavePrompt"
          class="save-prompt"
          data-testid="save-prompt"
        >
          <span>{{
            $t('ui.saveChangesBeforeClosing', { name: savedSessions.pendingSavePrompt.name })
          }}</span>
          <button
            type="button"
            @click="saveAndClosePendingSession"
          >
            {{ $t('ui.save') }}
          </button>
        </div>
      </section>
    </section>

    <template #inspector>
      <WorkbenchInspector data-testid="home-workspace-inspector">
        <section class="workbench-inspector-section">
          <h2>{{ $t('ui.workspaceProperties') }}</h2>
          <dl>
            <div>
              <dt>{{ $t('ui.totalSessions') }}</dt>
              <dd>142</dd>
            </div>
            <div>
              <dt>{{ $t('ui.defaultEncoding') }}</dt>
              <dd>{{ $t('ui.utf8') }}</dd>
            </div>
            <div>
              <dt>{{ $t('ui.lineEndings') }}</dt>
              <dd>{{ $t('ui.crlf') }}</dd>
            </div>
          </dl>
        </section>

        <section class="workbench-inspector-section">
          <h2>{{ $t('ui.quickInput') }}</h2>
          <div class="quick-input-stack">
            <div
              class="quick-input-zone"
              :class="{ dragging: isDragging }"
              @dragover="handleDragOver"
              @dragleave="handleDragLeave"
              @drop="handleDrop"
            >
              <strong>{{ $t('ui.dropTwoFilesOrFolders') }}</strong>
              <span v-if="dropResult.kind === 'invalid'">{{ dropResult.reason }}</span>
              <span v-else>
                {{ dropResult.kind }} detected: {{ dropResult.left.displayName }} and
                {{ dropResult.right.displayName }}
              </span>
              <button
                type="button"
                :disabled="!selectedDropSession?.enabled"
                @click="openSelectedDropSession"
              >
                {{ $t('ui.openSuggestedView') }}
              </button>
            </div>
            <div class="clipboard-source">
              <strong>{{ $t('ui.clipboardText') }}</strong>
              <span>{{ clipboardStatus }}</span>
              <NButton
                size="small"
                data-testid="open-clipboard-text"
                @click="openClipboardText"
                >{{ $t('ui.openClipboard') }}</NButton
              >
            </div>
          </div>
        </section>

        <section class="workbench-inspector-section">
          <h2>{{ $t('ui.sessionHistory') }}</h2>
          <ol class="history-list">
            <li
              v-for="item in historyItems"
              :key="item.title"
              :class="{ active: item.active }"
            >
              <strong>{{ item.title }}</strong>
              <span>{{ item.meta }}</span>
            </li>
          </ol>
        </section>

        <section class="workbench-inspector-section">
          <h2>{{ $t('ui.workspace') }}</h2>
          <StatusSummaryGrid
            :items="[
              { label: $t('ui.sessionTypes'), value: sessionCatalog.length },
              { label: $t('ui.savedSessions'), value: filteredSavedSessions.length },
              { label: $t('ui.restoreRecent'), value: savedSessions.recoveryCandidates.length },
            ]"
          />
        </section>
      </WorkbenchInspector>
    </template>
  </WorkbenchShell>
</template>

<style scoped>
.home-title-count {
  color: var(--app-text-muted);
  font-size: 12px;
}

.home-workspace {
  display: grid;
  align-content: start;
  gap: 24px;
  height: 100%;
  min-height: 0;
  padding: 20px;
  overflow: auto;
}

.new-session-panel,
.recent-session-panel {
  display: grid;
  gap: 12px;
  min-width: 0;
}

.new-session-panel h2,
.recent-session-panel h2 {
  margin: 0;
  font-size: 14px;
  line-height: 20px;
}

.new-session-grid {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 12px;
}

.new-session-card {
  position: relative;
  display: grid;
  align-content: start;
  gap: 6px;
  min-height: 126px;
  padding: 16px;
  border: 1px solid var(--app-border);
  border-radius: 4px;
  background: var(--app-canvas);
  cursor: pointer;
}

.new-session-card:hover,
.new-session-card:focus {
  border-color: var(--app-primary);
  outline: 0;
}

.session-card-icon {
  display: inline-grid;
  width: 28px;
  height: 28px;
  border-radius: 4px;
  background: var(--app-surface-low);
  color: var(--app-primary);
  place-items: center;
}

.new-session-card h3 {
  margin: 8px 0 0;
  font-size: 13px;
  line-height: 18px;
}

.new-session-card p {
  display: -webkit-box;
  margin: 0;
  overflow: hidden;
  color: var(--app-text-muted);
  font-size: 12px;
  line-height: 16px;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 2;
}

.new-session-card button {
  position: absolute;
  right: 10px;
  bottom: 10px;
  height: 24px;
  padding: 0 10px;
  border: 1px solid var(--app-primary);
  border-radius: 4px;
  background: var(--app-primary);
  color: #ffffff;
  cursor: pointer;
}

.recent-session-panel header {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 320px;
  align-items: center;
  gap: 12px;
}

.recent-session-panel input[type='search'] {
  width: 100%;
  height: 30px;
  padding: 0 10px;
  border: 1px solid var(--app-border);
  border-radius: 4px;
  background: var(--app-canvas);
  color: var(--app-text);
  font-size: 12px;
}

.dense-data-table table {
  width: 100%;
  border-collapse: collapse;
  table-layout: fixed;
}

.dense-data-table th,
.dense-data-table td {
  height: 34px;
  padding: 0 10px;
  overflow: hidden;
  border-bottom: 1px solid var(--app-border-soft);
  text-align: left;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.dense-data-table th {
  height: 28px;
  background: var(--app-surface-low);
  color: var(--app-text-muted);
  font-size: 11px;
  font-weight: 700;
}

.dense-data-table tbody tr:hover {
  background: var(--app-surface-low);
}

.icon-col {
  width: 44px;
  text-align: center;
}

.recent-session-icon {
  display: inline-grid;
  width: 18px;
  height: 18px;
  border: 1px solid var(--app-border);
  border-radius: 4px;
  color: var(--app-primary);
  font-size: 11px;
  font-weight: 700;
  place-items: center;
}

.path-cell {
  color: var(--app-text-muted);
  font-family: var(--font-mono);
  font-size: 11px;
}

.row-actions {
  display: inline-flex;
  gap: 3px;
  margin-left: 8px;
  opacity: 0;
}

tr:hover .row-actions,
.row-actions:focus-within {
  opacity: 1;
}

.row-actions button {
  height: 20px;
  padding: 0 5px;
  border: 1px solid var(--app-border);
  border-radius: 4px;
  background: var(--app-canvas);
  color: var(--app-text-muted);
  font-size: 11px;
  cursor: pointer;
}

.row-actions button:disabled {
  cursor: not-allowed;
  opacity: 0.45;
}

.recovery-entry,
.save-prompt {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  padding: 8px 10px;
  border: 1px solid var(--app-primary);
  border-radius: 4px;
  background: var(--app-primary-soft);
  font-size: 12px;
}

.recovery-entry button,
.save-prompt button,
.quick-input-zone button {
  height: 24px;
  padding: 0 8px;
  border: 1px solid var(--app-border);
  border-radius: 4px;
  background: var(--app-canvas);
  color: var(--app-text);
  cursor: pointer;
}

.quick-input-stack {
  display: grid;
  gap: 8px;
  padding: 8px;
}

.quick-input-zone,
.clipboard-source {
  display: grid;
  gap: 6px;
  min-width: 0;
  padding: 8px;
  border: 1px dashed var(--app-border);
  border-radius: 4px;
  background: var(--app-canvas);
  font-size: 12px;
}

.quick-input-zone.dragging {
  border-color: var(--app-primary);
  background: var(--app-primary-soft);
}

.quick-input-zone span,
.clipboard-source span {
  color: var(--app-text-muted);
}

.history-list {
  display: grid;
  gap: 8px;
  margin: 0;
  padding: 8px;
  list-style: none;
}

.history-list li {
  position: relative;
  display: grid;
  gap: 2px;
  padding-left: 12px;
  color: var(--app-text-muted);
  font-size: 11px;
}

.history-list li::before {
  content: '';
  position: absolute;
  top: 4px;
  left: 0;
  width: 8px;
  height: 8px;
  border-radius: 999px;
  background: var(--app-border);
}

.history-list li.active::before {
  background: var(--app-primary);
}

.history-list strong {
  color: var(--app-text);
  font-size: 12px;
}

@media (width <= 900px) {
  .new-session-grid,
  .recent-session-panel header {
    grid-template-columns: 1fr;
  }
}
</style>
