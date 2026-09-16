<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import {
  Binary,
  Columns3,
  Code2,
  Database,
  FileCog,
  FileText,
  FolderGit2,
  FolderOpen,
  FolderSync,
  GitMerge,
  Image,
  Table2,
  type LucideIcon,
} from '@lucide/vue'
import { readClipboardTextSource } from '@/app/clipboardSource'
import { classifyDropInputs } from '@/app/dropInput'
import { createLaunchFromDrop } from '@/app/dropLaunch'
import { filterSavedSessions } from '@/app/savedSessions'
import { selectSessionForDrop } from '@/app/sessionAutoSelect'
import { sessionCatalog } from '@/app/sessionCatalog'
import { createSessionFromLaunch, createUntitledSession } from '@/app/sessionFactory'
import WorkspaceManager from '@/components/session/WorkspaceManager.vue'
import DenseDataTable from '@/components/workbench/DenseDataTable.vue'
import StatusSummaryGrid from '@/components/workbench/StatusSummaryGrid.vue'
import WorkbenchInspector from '@/components/workbench/WorkbenchInspector.vue'
import WorkbenchShell from '@/components/workbench/WorkbenchShell.vue'
import { useI18n } from '@/i18n'
import { useSavedSessionsStore } from '@/stores/savedSessions'
import { useSessionLaunchStore } from '@/stores/sessionLaunch'
import { useTabsStore } from '@/stores/tabs'
import { useSettingsStore } from '@/stores/settings'
import { useWorkspacesStore } from '@/stores/workspaces'
import type { DropClassification, DropInput } from '@/app/dropInput'
import type { SessionSelection } from '@/app/sessionAutoSelect'
import type { SessionCatalogEntry } from '@/app/sessionCatalog'
import type { SessionDocument, SessionType } from '@/types/session'
import type { SessionLaunchLocation, SessionLaunchPayload } from '@/types/sessionLaunch'

/** Home center launch buttons (12), matching home.png order. */
type HomeLaunchType =
  | 'folder-compare'
  | 'folder-merge'
  | 'folder-sync'
  | 'text-compare'
  | 'text-merge'
  | 'text-edit'
  | 'hex-compare'
  | 'media-compare'
  | 'picture-compare'
  | 'registry-compare'
  | 'table-compare'
  | 'version-compare'

/** Home left tree under New (Text Edit is center-only). */
type HomeTreeType = Exclude<HomeLaunchType, 'text-edit'>

interface QuickStartEntry extends SessionCatalogEntry {
  icon: LucideIcon
}

const homeLaunchTypes: HomeLaunchType[] = [
  'folder-compare',
  'folder-merge',
  'folder-sync',
  'text-compare',
  'text-merge',
  'text-edit',
  'hex-compare',
  'media-compare',
  'picture-compare',
  'registry-compare',
  'table-compare',
  'version-compare',
]

const homeTreeTypes: HomeTreeType[] = [
  'folder-compare',
  'folder-merge',
  'folder-sync',
  'text-compare',
  'text-merge',
  'hex-compare',
  'media-compare',
  'picture-compare',
  'registry-compare',
  'table-compare',
  'version-compare',
]

const quickStartIcons: Record<HomeLaunchType, LucideIcon> = {
  'folder-compare': FolderOpen,
  'folder-merge': FolderGit2,
  'folder-sync': FolderSync,
  'hex-compare': Binary,
  'media-compare': Columns3,
  'picture-compare': Image,
  'registry-compare': Database,
  'table-compare': Table2,
  'text-compare': Code2,
  'text-edit': FileText,
  'text-merge': GitMerge,
  'version-compare': FileCog,
}

const router = useRouter()
const { t } = useI18n()
const tabs = useTabsStore()
const settings = useSettingsStore()
const savedSessions = useSavedSessionsStore()
const sessionLaunch = useSessionLaunchStore()
const workspaces = useWorkspacesStore()
const selectedSessionId = ref<string>()
const selectedSavedSession = computed(() => {
  const selected =
    savedSessions.sessions.find((session) => session.id === selectedSessionId.value) ??
    savedSessions.autoSavedSessions.find((session) => session.id === selectedSessionId.value)

  return selected ?? savedSessions.sessions.at(0) ?? savedSessions.autoSavedSessions.at(0)
})
const selectedSessionPreview = computed(() => {
  const session = selectedSavedSession.value

  return {
    name: session?.name ?? t('ui.untitled'),
    leftPath: session?.locations.left?.uri ?? '',
    rightPath: session?.locations.right?.uri ?? '',
  }
})
const dropResult = ref<DropClassification>({
  kind: 'invalid',
  reason: t('ui.dropExactlyTwoFilesOrFolders'),
})
const selectedDropSession = ref<SessionSelection>()
const isDragging = ref(false)
const sessionSearch = ref('')
const clipboardStatus = ref(t('ui.clipboardTextSourceNotLoaded'))
const saveDialogOpen = ref(false)
const sessionNameDraft = ref('')
const editDialogOpen = ref(false)
const editNameDraft = ref('')
const filteredSavedSessions = computed(() =>
  filterSavedSessions(savedSessions.sessions, {
    query: sessionSearch.value,
    types: new Set(),
  }),
)
const quickStartEntries = computed<QuickStartEntry[]>(() =>
  homeLaunchTypes
    .map((type) => {
      const entry = sessionCatalog.find((item) => item.type === type)

      return entry ? { ...entry, icon: quickStartIcons[type] } : undefined
    })
    .filter((entry): entry is QuickStartEntry => Boolean(entry?.route)),
)
const homeTreeEntries = computed<QuickStartEntry[]>(() =>
  homeTreeTypes
    .map((type) => {
      const entry = sessionCatalog.find((item) => item.type === type)

      return entry ? { ...entry, icon: quickStartIcons[type] } : undefined
    })
    .filter((entry): entry is QuickStartEntry => Boolean(entry?.route)),
)
const todaySessions = computed(() => {
  const start = new Date()

  start.setHours(0, 0, 0, 0)

  const startMs = start.getTime()

  const todays = savedSessions.sessions.filter((session) => {
    const stamp = session.metadata.lastOpenedAt

    if (!stamp) {
      return false
    }

    const opened = Date.parse(stamp)

    return Number.isFinite(opened) && opened >= startMs
  })

  return filterSavedSessions(todays, {
    query: sessionSearch.value,
    types: new Set(),
  })
})
const autoSavedTreeSessions = computed(() =>
  filterSavedSessions(savedSessions.autoSavedSessions, {
    query: sessionSearch.value,
    types: new Set(),
  }),
)
const historyItems = computed(() =>
  savedSessions.sessions.slice(0, 6).map((session) => ({
    title: session.name,
    meta: lastOpenedLabel(session),
    active: session.id === selectedSavedSession.value?.id,
  })),
)

function openSession(entry: SessionCatalogEntry): void {
  if (!entry.route) {
    return
  }

  sessionLaunch.setPendingLaunch({
    id: crypto.randomUUID(),
    source: 'home',
    sessionType: entry.type,
    title: `${t('ui.untitled')} ${t(entry.titleKey)}`,
    route: entry.route,
    locations: {},
    autoRun: false,
  })
  const opened = tabs.openTab({
    title: entry.title,
    titleKey: entry.titleKey,
    route: entry.route,
    dirty: false,
    forceNew: settings.openSessionsInNewTab,
  })

  void router.push(opened.route)
}

function openSavedSession(session: SessionDocument): void {
  const entry = sessionCatalog.find((item) => item.type === session.sessionType)

  if (!entry?.route) {
    return
  }

  sessionLaunch.setPendingLaunch({
    id: crypto.randomUUID(),
    source: 'saved-session',
    sessionType: session.sessionType,
    title: session.name,
    route: entry.route,
    locations: {
      left: sessionLocationToLaunchLocation(session.locations.left, 'file'),
      right: sessionLocationToLaunchLocation(session.locations.right, 'file'),
      center: sessionLocationToLaunchLocation(session.locations.center, 'file'),
      output: sessionLocationToLaunchLocation(session.locations.output, 'file'),
    },
    autoRun: true,
    session,
  })
  const opened = tabs.openTab({
    title: session.name,
    route: entry.route,
    dirty: session.metadata.dirty,
    forceNew: settings.openSessionsInNewTab,
  })

  void router.push(opened.route)
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
  setDropInputs(inputsFromDataTransfer(event.dataTransfer))
  // ponytail: HTML drop zone also auto-opens when the drop is valid
  openSelectedDropSession()
}

function setDropInputs(inputs: DropInput[]): void {
  dropResult.value = classifyDropInputs(inputs)
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

  sessionLaunch.setPendingLaunch(buildDropLaunchPayload(selectedDropSession.value))
  const opened = tabs.openTab({
    title: selectedDropSession.value.title,
    titleKey: selectedDropSession.value.titleKey,
    route: selectedDropSession.value.route,
    dirty: false,
    forceNew: settings.openSessionsInNewTab,
  })

  void router.push(opened.route)
}

function buildDropLaunchPayload(selection: SessionSelection): SessionLaunchPayload {
  if (dropResult.value.kind === 'invalid' || !selection.route) {
    throw new Error('Cannot create a launch payload from an invalid drop.')
  }

  return createLaunchFromDrop(
    dropResult.value,
    { ...selection, route: selection.route },
    {
      autoRun: true,
    },
  )
}

async function openClipboardText(): Promise<void> {
  try {
    const source = await readClipboardTextSource()
    const title = t(source.title)

    clipboardStatus.value = t('status.sourceReady', { source: title })
    sessionLaunch.setPendingLaunch({
      id: crypto.randomUUID(),
      source: 'command',
      sessionType: 'text-compare',
      title,
      route: '/compare/text',
      locations: {
        left: {
          uri: source.text,
          displayName: title,
          kind: 'virtual',
          readOnly: true,
        },
      },
      autoRun: false,
    })
    const opened = tabs.openTab({
      title,
      titleKey: source.title,
      route: '/compare/text',
      dirty: false,
      forceNew: settings.openSessionsInNewTab,
    })

    void router.push(opened.route)
  } catch (error) {
    clipboardStatus.value =
      typeof error === 'object' && error !== null && 'message' in error
        ? String(error.message)
        : String(error)
  }
}

function simulateTextDrop(): void {
  setDropInputs([
    { path: 'C:/work/left.txt', kind: 'file' },
    { path: 'C:/work/right.txt', kind: 'file' },
  ])
}

function simulatePatchDrop(): void {
  setDropInputs([{ path: 'C:/work/change.patch', kind: 'file' }])
}

function sessionLocationToLaunchLocation(
  location: SessionDocument['locations']['left'],
  kind: SessionLaunchLocation['kind'],
): SessionLaunchLocation | undefined {
  if (!location) {
    return undefined
  }

  return {
    uri: location.uri,
    displayName: location.displayName,
    kind,
    readOnly: location.readOnly,
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

function openSaveCurrentSessionDialog(): void {
  saveDialogOpen.value = true
  sessionNameDraft.value = sessionLaunch.pendingLaunch?.title ?? tabs.activeTab.title
}

function confirmSaveCurrentSession(): void {
  const name = sessionNameDraft.value.trim()

  if (!name) {
    return
  }

  const session = createCurrentSessionDocument(name)

  savedSessions.saveSession(session)
  saveDialogOpen.value = false
  sessionNameDraft.value = ''
}

function createCurrentSessionDocument(name: string): SessionDocument {
  const pending = sessionLaunch.pendingLaunch

  if (pending) {
    return {
      ...createSessionFromLaunch({ ...pending, title: name }),
      name,
    }
  }

  const activeRoute = tabs.activeTab.route
  const entry =
    sessionCatalog.find((item) => item.route === activeRoute) ??
    sessionCatalog.find((item) => item.type === 'text-compare')

  if (!entry) {
    return createUntitledSession('text-compare')
  }

  const session = createUntitledSession(entry.type)

  session.name = name

  return session
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

  const opened = tabs.openTab({
    title: first.name,
    route: entry.route,
    dirty: first.metadata.dirty,
    forceNew: settings.openSessionsInNewTab,
  })

  void router.push(opened.route)
}

function restoreWorkspace(id: string): void {
  const workspace = workspaces.workspaces.find((item) => item.id === id)

  if (!workspace) {
    return
  }

  tabs.restoreWorkspaceTabs(workspace.tabs)
  void router.push(tabs.activeTab.route)
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

function lastOpenedLabel(session: SessionDocument): string {
  return session.metadata.lastOpenedAt ?? t('ui.neverOpened')
}

function selectSavedSession(session: SessionDocument): void {
  selectedSessionId.value = session.id
  if (settings.stickyHomeSessionSelection) {
    settings.setStickyHomeSessionId(session.id)
  }
}

const canEditSelected = computed(() => {
  const session = selectedSavedSession.value

  return Boolean(session && !session.metadata.locked)
})

const canRemoveSelected = computed(() => {
  const session = selectedSavedSession.value

  return Boolean(session && !session.metadata.locked)
})

function isTreeSessionSelected(sessionId: string): boolean {
  return selectedSavedSession.value?.id === sessionId
}

function openEditSelectedDialog(): void {
  const session = selectedSavedSession.value

  if (!session || session.metadata.locked) {
    return
  }

  editDialogOpen.value = true
  editNameDraft.value = session.name
}

function confirmEditSelected(): void {
  const session = selectedSavedSession.value
  const name = editNameDraft.value.trim()

  if (!session || !name) {
    return
  }

  savedSessions.renameSession(session.id, name)
  editDialogOpen.value = false
  editNameDraft.value = ''
}

function cancelEditSelected(): void {
  editDialogOpen.value = false
  editNameDraft.value = ''
}

function removeSelectedFromTree(): void {
  const session = selectedSavedSession.value

  if (!session || session.metadata.locked) {
    return
  }

  selectedSessionId.value = undefined
  savedSessions.requestDeleteSession(session.id)
}

function openSelectedPreview(): void {
  if (selectedSavedSession.value) {
    openSavedSession(selectedSavedSession.value)

    return
  }

  openSession(quickStartEntries.value[0])
}

onMounted(() => {
  if (!settings.stickyHomeSessionSelection || !settings.stickyHomeSessionId) {
    return
  }

  const stickyId = settings.stickyHomeSessionId
  const exists =
    savedSessions.sessions.some((session) => session.id === stickyId) ||
    savedSessions.autoSavedSessions.some((session) => session.id === stickyId)

  if (exists) {
    selectedSessionId.value = stickyId
  }
})
</script>

<template>
  <WorkbenchShell
    class="home-view"
    compact
    :title="$t('ui.newSession')"
    :inspector-label="$t('ui.workspaceInspector')"
  >
    <section
      class="home-workspace bc-home-workspace"
      data-testid="home-layout"
      data-home-density="capture-pass15"
      data-home-chrome="minimal"
    >
      <aside
        class="bc-session-tree"
        :aria-label="$t('ui.sessions')"
      >
        <header>{{ $t('ui.sessions') }}</header>
        <section class="bc-tree-list">
          <button
            type="button"
            class="bc-tree-row expanded"
          >
            <span>▾</span>
            <FolderOpen :size="11" />
            <strong>{{ $t('ui.new') }}</strong>
          </button>
          <button
            v-for="entry in homeTreeEntries"
            :key="`tree-${entry.type}`"
            type="button"
            class="bc-tree-row child"
            :data-testid="`home-tree-${entry.type}`"
            @click="openSession(entry)"
          >
            <span></span>
            <component
              :is="entry.icon"
              :size="11"
            />
            <strong>{{ $t(entry.titleKey) }}</strong>
          </button>
          <button
            type="button"
            class="bc-tree-row expanded"
            data-testid="home-tree-auto-saved"
          >
            <span>▾</span>
            <FolderOpen :size="11" />
            <strong>{{ $t('ui.autoSaved') }}</strong>
          </button>
          <button
            v-for="session in autoSavedTreeSessions"
            :key="`tree-autosaved-${session.id}`"
            type="button"
            class="bc-tree-row saved"
            :class="{ selected: isTreeSessionSelected(session.id) }"
            :data-testid="`home-tree-autosaved-${session.id}`"
            @click="selectSavedSession(session)"
            @dblclick="openSavedSession(session)"
          >
            <span></span>
            <FolderOpen :size="10" />
            <strong>{{ session.name }}</strong>
          </button>
          <button
            type="button"
            class="bc-tree-row child expanded"
            data-testid="home-tree-today"
          >
            <span>▾</span>
            <FolderOpen :size="11" />
            <strong>{{ $t('ui.today') }}</strong>
          </button>
          <button
            v-for="session in todaySessions"
            :key="`tree-today-${session.id}`"
            type="button"
            class="bc-tree-row saved"
            :class="{ selected: isTreeSessionSelected(session.id) }"
            :data-testid="`home-tree-today-${session.id}`"
            @click="selectSavedSession(session)"
            @dblclick="openSavedSession(session)"
          >
            <span></span>
            <FolderOpen :size="10" />
            <strong>{{ session.name }}</strong>
          </button>
        </section>
        <footer class="bc-tree-footer">
          <button
            type="button"
            data-testid="home-tree-add"
            :aria-label="$t('ui.add')"
            @click="openSaveCurrentSessionDialog"
          >
            +
          </button>
          <button
            type="button"
            data-testid="home-tree-remove"
            :aria-label="$t('ui.remove')"
            :disabled="!canRemoveSelected"
            @click="removeSelectedFromTree"
          >
            −
          </button>
          <input
            v-model="sessionSearch"
            data-testid="session-search"
            type="search"
            :placeholder="$t('ui.filterSessions')"
          />
        </footer>
      </aside>

      <main class="bc-home-main">
        <section class="bc-selected-session">
          <div class="bc-selected-title">
            <FolderOpen :size="11" />
            <div>
              <strong :title="selectedSessionPreview.name">{{
                selectedSessionPreview.name
              }}</strong>
              <span :title="selectedSessionPreview.leftPath">{{
                selectedSessionPreview.leftPath
              }}</span>
              <span :title="selectedSessionPreview.rightPath">{{
                selectedSessionPreview.rightPath
              }}</span>
            </div>
          </div>
          <div class="bc-selected-actions">
            <button
              type="button"
              data-testid="home-open-selected"
              @click="openSelectedPreview"
            >
              {{ $t('ui.open') }}
            </button>
            <button
              type="button"
              data-testid="home-edit-selected"
              :disabled="!canEditSelected"
              @click="openEditSelectedDialog"
            >
              {{ $t('ui.edit') }}
            </button>
          </div>
          <section
            v-if="editDialogOpen"
            class="session-edit-panel"
            data-testid="home-edit-panel"
          >
            <input
              v-model="editNameDraft"
              data-testid="home-edit-name-input"
              type="text"
              :placeholder="$t('ui.name')"
              :aria-label="$t('ui.rename')"
            />
            <button
              type="button"
              data-testid="home-edit-confirm"
              @click="confirmEditSelected"
            >
              {{ $t('ui.save') }}
            </button>
            <button
              type="button"
              data-testid="home-edit-cancel"
              @click="cancelEditSelected"
            >
              {{ $t('ui.cancel') }}
            </button>
          </section>
        </section>

        <section
          class="new-session-panel"
          data-testid="home-new-session"
        >
          <div
            class="bc-home-instructions"
            data-testid="home-how-to-start"
            :class="{ dragging: isDragging }"
            @dragover="handleDragOver"
            @dragleave="handleDragLeave"
            @drop="handleDrop"
          >
            <strong>{{ $t('ui.dragFoldersOrFilesOntoSessionIcon') }}</strong>
          </div>
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
                  :size="11"
                />
              </span>
              <h3>{{ $t(entry.titleKey) }}</h3>
              <span
                v-if="entry.maturity !== 'ready'"
                class="session-maturity"
                :data-testid="`home-maturity-${entry.type}`"
                :data-maturity="entry.maturity"
                >{{ $t(`ui.maturity.${entry.maturity}`) }}</span
              >
            </article>
          </div>
        </section>

        <section class="bc-home-secondary">
          <section
            class="recent-session-panel"
            data-testid="home-recent-sessions"
          >
            <header>
              <h2>{{ $t('ui.recentSessions') }}</h2>
              <div class="recent-session-actions">
                <button
                  type="button"
                  data-testid="save-current-session-as"
                  @click="openSaveCurrentSessionDialog"
                >
                  {{ $t('ui.save') }}
                </button>
                <input
                  v-model="sessionSearch"
                  data-testid="session-search"
                  type="search"
                  :placeholder="$t('ui.filterSessions')"
                />
              </div>
            </header>

            <section
              v-if="saveDialogOpen"
              class="session-save-panel"
              data-testid="session-save-panel"
            >
              <input
                v-model="sessionNameDraft"
                data-testid="session-name-input"
                type="text"
                :placeholder="$t('ui.name')"
              />
              <button
                type="button"
                data-testid="confirm-session-save"
                @click="confirmSaveCurrentSession"
              >
                {{ $t('ui.save') }}
              </button>
            </section>

            <div
              v-if="savedSessions.recoveryCandidates.length > 0"
              class="recovery-entry"
              data-testid="recovery-entry"
            >
              <span
                :title="
                  $t('ui.recoverSession', { name: savedSessions.recoveryCandidates[0]?.name ?? '' })
                "
                >{{
                  $t('ui.recoverSession', { name: savedSessions.recoveryCandidates[0]?.name ?? '' })
                }}</span
              >
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
                  <tr v-if="filteredSavedSessions.length === 0">
                    <td colspan="6">{{ $t('ui.noSavedSessionsYet') }}</td>
                  </tr>
                  <tr
                    v-for="session in filteredSavedSessions"
                    :key="session.id"
                    @click="selectSavedSession(session)"
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
                    <td>{{ lastOpenedLabel(session) }}</td>
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
      </main>
    </section>

    <template #inspector>
      <WorkbenchInspector data-testid="home-workspace-inspector">
        <section class="workbench-inspector-section">
          <h2>{{ $t('ui.workspaceProperties') }}</h2>
          <dl>
            <div>
              <dt>{{ $t('ui.totalSessions') }}</dt>
              <dd data-testid="home-total-sessions">{{ savedSessions.sessions.length }}</dd>
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
                {{
                  $t('status.dropDetected', {
                    kind: dropResult.kind,
                    left: dropResult.left.displayName,
                    right: dropResult.right.displayName,
                  })
                }}
              </span>
              <button
                type="button"
                data-testid="open-suggested-view"
                :disabled="!selectedDropSession?.enabled"
                @click="openSelectedDropSession"
              >
                {{ $t('ui.openSuggestedView') }}
              </button>
              <button
                type="button"
                hidden
                data-testid="simulate-text-drop"
                @click="simulateTextDrop"
              />
              <button
                type="button"
                hidden
                data-testid="simulate-patch-drop"
                @click="simulatePatchDrop"
              />
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
          <ol
            v-if="historyItems.length > 0"
            class="history-list"
            data-testid="home-session-history"
          >
            <li
              v-for="item in historyItems"
              :key="item.title"
              :class="{ active: item.active }"
            >
              <strong>{{ item.title }}</strong>
              <span>{{ item.meta }}</span>
            </li>
          </ol>
          <p
            v-else
            data-testid="home-session-history-empty"
          >
            {{ $t('ui.sessionHistoryEmpty') }}
          </p>
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
          <WorkspaceManager
            :snapshot="tabs.workspaceSnapshot()"
            @restore="restoreWorkspace"
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
  height: 100%;
  min-height: 0;
  overflow: hidden;
}

.bc-home-workspace {
  display: grid;

  /* Capture-aligned left tree; pass-11 denser non-web-card column toward home.png. */
  grid-template-columns: minmax(140px, 170px) minmax(0, 1fr);
  background: #ffffff;
}

.bc-session-tree {
  display: grid;
  grid-template-rows: 8px minmax(0, 1fr) 9px;
  min-width: 0;
  min-height: 0;
  border-right: 1px solid #a0a0a0;
  background: #e3e9f2;
}

.bc-session-tree header {
  display: flex;
  align-items: center;
  min-width: 0;
  padding: 0;
  overflow: hidden;
  border-bottom: 1px solid #a0a0a0;
  background: #eceff3;
  color: #111827;
  font-size: 9px;
  font-weight: 600;
  line-height: 1;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.bc-tree-list {
  min-height: 0;
  padding: 0;
  overflow: auto;
}

.bc-tree-row {
  display: grid;
  grid-template-columns: 6px 7px minmax(0, 1fr);
  align-items: center;
  gap: 1px;
  width: 100%;
  min-height: 7px;
  padding: 0;
  border: 0;
  background: transparent;
  color: #111827;
  font-size: 11px;
  line-height: 7px;
  text-align: left;
  cursor: pointer;
}

.bc-tree-row.child {
  padding-left: 7px;
  font-size: 11px;
}

.bc-tree-row.saved {
  padding-left: 16px;
  font-size: 11px;
}

.bc-tree-row:hover,
.bc-tree-row:focus-visible {
  outline: 0;
  background: #c7dcf6;
}

.bc-tree-row strong {
  overflow: hidden;
  font-weight: 400;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.bc-tree-footer {
  display: grid;
  grid-template-columns: 7px 7px minmax(0, 1fr);
  align-items: center;
  gap: 1px;
  padding: 1px;
  border-top: 1px solid #a0a0a0;
  background: #eceff3;
}

.bc-tree-footer button {
  height: 7px;
  border: 1px solid #a0a0a0;
  border-radius: 0;
  background: #ffffff;
  color: #2f343a;
  font-size: 11px;
  line-height: 1;
}

.bc-tree-footer input {
  width: 100%;
  min-width: 0;
  height: 7px;
  padding: 0 1px;
  overflow: hidden;
  border: 1px solid #a0a0a0;
  border-radius: 0;
  background: #ffffff;
  color: #111827;
  font-size: 11px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.bc-home-main {
  display: grid;
  align-content: start;
  grid-template-rows: auto minmax(0, 1fr) auto;
  min-width: 0;
  min-height: 0;
  overflow: auto;
  background: #ffffff;
}

.bc-selected-session {
  display: grid;
  gap: 0;
  padding: 0;
}

.bc-selected-title {
  display: flex;
  align-items: flex-start;
  gap: 1px;
  min-width: 0;
  color: #111827;
  font-size: 11px;
}

.bc-selected-title div {
  display: grid;
  gap: 1px;
  min-width: 0;
}

.bc-selected-title strong,
.bc-selected-title span {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.bc-selected-title strong {
  font-size: 11px;
  font-weight: 500;
  line-height: 1.1;
}

.bc-selected-title span {
  color: #374151;
  font-size: 11px;
  line-height: 1.1;
}

.bc-selected-actions {
  display: flex;
  gap: 1px;
}

.bc-selected-actions button {
  width: 48px;
  max-width: 100%;
  height: 7px;
  overflow: hidden;
  border: 1px solid #a0a0a0;
  border-radius: 0;
  background: #ffffff;
  color: #1d4f91;
  font-size: 11px;
  text-overflow: ellipsis;
  white-space: nowrap;
  cursor: pointer;
}

.bc-selected-actions button:first-child {
  border-color: #4aa3ff;
  color: #1d4f91;
}

.bc-selected-actions button:last-child {
  color: #111827;
}

.new-session-panel,
.recent-session-panel {
  display: grid;
  gap: 2px;
  min-width: 0;
}

.new-session-panel {
  padding: 0;
}

.new-session-panel h2,
.recent-session-panel h2 {
  margin: 0;
  font-size: 11px;
  line-height: 12px;
}

.new-session-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(64px, 1fr));
  gap: 0 1px;
  width: min(380px, calc(100% - 2px));
  margin: 0 auto;
}

.bc-home-instructions {
  display: grid;
  gap: 0;
  justify-items: center;
  margin: 0;
  color: #111827;
  font-size: 11px;
  line-height: 1;
}

.bc-home-instructions strong {
  font-size: 11px;
  font-weight: 500;
}

.new-session-card {
  display: grid;
  gap: 0;
  width: 100%;
  min-width: 0;
  max-width: 100%;
  min-height: 24px;
  padding: 0;
  overflow: hidden;
  border: 0;
  border-radius: 0;
  background: transparent;
  color: #111827;
  cursor: pointer;
  justify-items: center;
  align-content: start;
  box-sizing: border-box;
}

.new-session-card:hover,
.new-session-card:focus {
  outline: 0;
  background: #eaf4ff;
}

.session-card-icon {
  display: inline-grid;
  width: 16px;
  height: 12px;
  color: #2f353d;
  place-items: center;
}

.new-session-card h3 {
  max-width: 100%;
  margin: 0;
  overflow: hidden;
  font-size: 11px;
  font-weight: 400;
  line-height: 1.1;
  text-align: center;
  white-space: nowrap;
  text-overflow: ellipsis;
}

.new-session-card p {
  display: -webkit-box;
  max-width: 100%;
  margin: 0;
  overflow: hidden;
  color: #4b5563;
  font-size: 11px;
  line-height: 1.2;
  text-align: center;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 3;
  line-clamp: 3;
}

.bc-home-secondary {
  position: fixed;
  top: auto;
  left: -10000px;
  width: 1px;
  height: 1px;
  overflow: hidden;
}

.recent-session-panel header {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 320px;
  align-items: center;
  gap: 12px;
}

.recent-session-actions {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr);
  gap: 8px;
}

.recent-session-actions button,
.session-save-panel button {
  height: 30px;
  padding: 0 10px;
  border: 1px solid var(--app-border);
  border-radius: 4px;
  background: var(--app-canvas);
  color: var(--app-text);
  font-size: 12px;
  cursor: pointer;
}

.recent-session-panel input[type='search'],
.session-save-panel input {
  width: 100%;
  height: 30px;
  padding: 0 10px;
  border: 1px solid var(--app-border);
  border-radius: 4px;
  background: var(--app-canvas);
  color: var(--app-text);
  font-size: 12px;
}

.session-save-panel {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  gap: 8px;
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
  min-width: 0;
  padding: 8px 10px;
  border: 1px solid var(--app-primary);
  border-radius: 4px;
  background: var(--app-primary-soft);
  font-size: 12px;
}

.recovery-entry > span,
.save-prompt > span,
.save-prompt > p {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
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

.bc-home-instructions.dragging {
  padding: 0;
  border: 1px dashed #4aa3ff;
  border-radius: 0;
  background: #eaf4ff;
}

.home-primary-ctas {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: center;
  gap: 1px;
  margin-top: 0;
}

.home-primary-cta {
  min-width: 58px;
  max-width: 100%;
  height: 16px;
  padding: 0 3px;
  overflow: hidden;
  border: 1px solid #a0a0a0;
  border-radius: 0;
  background: #e8f3ff;
  color: #111827;
  font-size: 11px;
  white-space: nowrap;
  cursor: pointer;
  text-overflow: ellipsis;
}

.home-primary-cta:focus-visible,
.bc-selected-actions button:focus-visible,
.new-session-card:focus-visible {
  outline: 2px solid #4aa3ff;
  outline-offset: 2px;
}

.home-drop-cta {
  display: inline-flex;
  align-items: center;
  max-width: 100%;
  min-height: 16px;
  padding: 0 3px;
  overflow: hidden;
  border: 1px dashed #a0a0a0;
  border-radius: 0;
  color: #4b5563;
  font-size: 11px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

@media (width <= 900px) {
  .new-session-grid,
  .recent-session-panel header {
    grid-template-columns: 1fr;
  }
}

.session-maturity {
  display: inline-flex;
  margin-top: 0;
  padding: 0 3px;
  border-radius: 0;
  background: color-mix(in srgb, var(--accent, #2563eb) 12%, transparent);
  color: var(--text-muted, #64748b);
  font-size: 9px;
  letter-spacing: 0.01em;
  line-height: 12px;
}

.session-maturity[data-maturity='limited'] {
  background: color-mix(in srgb, #b45309 18%, transparent);
}

.bc-tree-row.selected {
  background: #c7dcf6;
}

.session-edit-panel {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto auto;
  gap: 1px;
  max-width: 380px;
}

.session-edit-panel input {
  min-width: 0;
  height: 14px;
  padding: 0 2px;
  border: 1px solid #a0a0a0;
  border-radius: 0;
  background: #ffffff;
  color: #111827;
  font-size: 11px;
}

.session-edit-panel button {
  height: 14px;
  padding: 0 3px;
  border: 1px solid #a0a0a0;
  border-radius: 0;
  background: #ffffff;
  color: #111827;
  font-size: 11px;
  cursor: pointer;
}

.home-view :deep(.workbench-main) {
  padding: 0;
  background: #ffffff;
}

.home-view :deep(.workbench-shell-compact) {
  background: #ffffff;
}

.home-view :deep(.workbench-grid-compact) {
  gap: 0;
}
</style>
