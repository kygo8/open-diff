<script setup lang="ts">
import { computed, onMounted, onUnmounted, provide, ref, watch } from 'vue'
import { useRoute, useRouter, RouterView } from 'vue-router'
import {
  ArrowDown,
  ArrowUp,
  Binary,
  Braces,
  ClipboardList,
  Cloud,
  Code2,
  Columns3,
  Database,
  FileCog,
  FileText,
  FolderGit2,
  FolderSync,
  FolderTree,
  GitMerge,
  HelpCircle,
  Home,
  Image,
  Languages,
  Package,
  Play,
  Moon,
  Rows3,
  Search,
  Settings,
  Sun,
  SunMoon,
  Table2,
  type LucideIcon,
} from '@lucide/vue'
import { commandRegistry, filterCommands } from '@/app/commandRegistry'
import { createCommandExecutor, getCommandsForPlacement } from '@/app/commandSystem'
import {
  findCommandIdForKeyboardEvent,
  formatShortcutLabel,
  isEditableKeyboardTarget,
} from '@/app/keyboardShortcuts'
import { listenDesktopPathDrop } from '@/app/desktopDrop'
import { openSessionWindow } from '@/app/sessionWindow'
import { resolveDropLaunchFromPaths } from '@/app/dropLaunch'
import { sessionCatalog } from '@/app/sessionCatalog'
import { createUntitledSession } from '@/app/sessionFactory'
import { isSessionWorkbenchRoute, tabRoutePathname } from '@/app/sessionTabRoute'
import {
  isSingleSessionFrame,
  preferDenseAppChrome,
  shouldShowTabStrip,
  supportsFolderStatusLegend,
} from '@/app/shellChrome'
import { setArchiveExtensions as syncArchiveExtensionsBackend } from '@/api/diff'
import { useI18n } from '@/i18n'
import { usePolicyStore } from '@/stores/policy'
import { clearRecentReportExports, loadReportPreferences } from '@/app/reportExports'
import { useSettingsStore } from '@/stores/settings'
import { useStatusBarStore } from '@/stores/statusBar'
import {
  buildFolderPairStatusPanes,
  isEditModeStatusSource,
  isHexSessionStatusSource,
  isTextSessionStatusSource,
  padStatusChromePanes,
} from '@/app/statusBarPhrases'
import { useSavedSessionsStore } from '@/stores/savedSessions'
import { useSessionLaunchStore } from '@/stores/sessionLaunch'
import { useTabsStore } from '@/stores/tabs'
import { useViewActionsStore } from '@/stores/viewActions'
import { useFolderPathNavStore } from '@/stores/folderPathNav'
import { useLastCompareStore } from '@/stores/lastCompare'
import { useWorkspacesStore } from '@/stores/workspaces'
import { createFolderSnapshot } from '@/api/diff'
import { folderSnapshotOutputPath } from '@/app/snapshotPath'
import { openPathExternal, takeShellCompareLaunch } from '@/api/integration'
import { pickNativePath } from '@/app/filePicker'
import { pathBaseName } from '@/app/sessionToolbars'
import { APP_VERSION, DOCS_URL, RELEASES_URL, SUPPORT_URL } from '@/app/appMeta'
import type { SessionType } from '@/types/session'
import type { AppCommand, CommandId } from '@/app/commandRegistry'
import type { ViewActionName } from '@/app/commandSystem'
import type { SessionCatalogEntry } from '@/app/sessionCatalog'

type AppMenuId = 'session' | 'file' | 'actions' | 'edit' | 'search' | 'view' | 'tools' | 'help'

interface NavigationItem {
  title: string
  titleKey: string
  route: string
  type: SessionType
  icon: LucideIcon
  count: string
  group: 'compare' | 'sources'
}

interface AppMenuDefinition {
  id: AppMenuId
  titleKey: string
  commandIds: CommandId[]
}

const route = useRoute()
const router = useRouter()
const i18n = useI18n()
const { t } = i18n
const settings = useSettingsStore()
const policy = usePolicyStore()
const statusBar = useStatusBarStore()
const tabs = useTabsStore()
const viewActions = useViewActionsStore()
const folderPathNav = useFolderPathNavStore()
const sessionLaunch = useSessionLaunchStore()
const savedSessions = useSavedSessionsStore()
const workspaces = useWorkspacesStore()
const lastCompare = useLastCompareStore()

let stopDesktopDrop: (() => void) | undefined

onMounted(() => {
  void syncArchiveExtensionsBackend([...settings.archiveExtensions]).catch(() => {
    // ponytail: web/dev without Tauri keeps frontend-only archive detection
  })
  void (async () => {
    try {
      const launch = await takeShellCompareLaunch()

      if (!launch) {
        maybeRestoreLastWorkspaceOnStartup()

        return
      }

      const sessionType = launch.sessionType as SessionType
      const folderish =
        sessionType === 'folder-compare' ||
        sessionType === 'folder-sync' ||
        sessionType === 'folder-merge'
      const kind = folderish ? 'directory' : 'file'
      const leftReadOnly = Boolean(launch.leftReadOnly)
      const rightReadOnly = Boolean(launch.rightReadOnly)
      const title = `${launch.left.split(/[/\\]/).pop() ?? launch.left} <--> ${launch.right.split(/[/\\]/).pop() ?? launch.right}`
      const favor = launch.favor === 'left' || launch.favor === 'right' ? launch.favor : undefined

      sessionLaunch.setPendingLaunch({
        id: crypto.randomUUID(),
        source: 'shell',
        sessionType,
        title,
        route: launch.route,
        locations: {
          left: { uri: launch.left, kind, readOnly: leftReadOnly },
          right: { uri: launch.right, kind, readOnly: rightReadOnly },
          center: launch.center ? { uri: launch.center, kind, readOnly: false } : undefined,
          output: launch.output ? { uri: launch.output, kind, readOnly: false } : undefined,
        },
        autoRun: true,
        favor,
      })
      const opened = tabs.openTab({
        title,
        route: launch.route,
        dirty: false,
        forceNew: settings.openSessionsInNewTab,
      })

      void router.push(opened.route)
    } catch {
      // ponytail: ignore missing shell launch outside Windows Explorer flow
      maybeRestoreLastWorkspaceOnStartup()
    }
  })()

  void listenDesktopPathDrop(
    async (paths) => {
      const result = await resolveDropLaunchFromPaths(paths, { autoRun: true })

      if (!result.ok) {
        statusBar.reportStatus({
          comparisonStatus: result.reason,
          source: 'drop',
        })

        return
      }

      sessionLaunch.setPendingLaunch(result.payload)
      const opened = tabs.openTab({
        title: result.selection.title,
        titleKey: result.selection.titleKey,
        route: result.selection.route,
        dirty: false,
        forceNew: settings.openSessionsInNewTab,
      })

      void router.push(opened.route)
    },
    (phase) => {
      // Subtle status only for real drag activity (not a permanent "Listening" banner).
      if (phase === 'enter') {
        statusBar.reportStatus({
          comparisonStatus: 'Drop to open compare',
          source: 'drop',
        })
      } else if (phase === 'leave') {
        statusBar.reportStatus({
          comparisonStatus: 'Ready',
          source: 'drop',
        })
      } else if (phase === 'drop') {
        statusBar.reportStatus({
          comparisonStatus: 'Opening dropped files…',
          source: 'drop',
        })
      } else if (phase === 'unavailable') {
        console.warn('[OpenDiff] desktop drop listener phase unavailable')
      }
    },
  ).then((stop) => {
    stopDesktopDrop = stop
  })

  window.addEventListener('keydown', onChromeKeydown)
})

onUnmounted(() => {
  stopDesktopDrop?.()
  window.removeEventListener('keydown', onChromeKeydown)
})

const commandPaletteOpen = ref(false)
const commandQuery = ref('')
const languageMenuOpen = ref(false)
const activeMenu = ref<AppMenuId>()
const lastViewAction = ref<ViewActionName>()
const lastMenuSavedSessionId = ref<string>()
const aboutDialogOpen = ref(false)
const helpStatusMessage = ref('')
const pendingCloseTab = ref<{ id: string; title: string }>()
const tabContextMenu = ref<{ x: number; y: number; tabId: string }>()
const visibleCommands = computed(() => filterCommands(commandRegistry, commandQuery.value))
const toolbarCommands = computed(() => getCommandsForPlacement(commandRegistry, 'toolbar'))
const availableLocales = i18n.availableLocales
const appMenus: AppMenuDefinition[] = [
  {
    id: 'session',
    titleKey: 'ui.session',
    commandIds: [
      'open.textCompare',
      'open.folderCompare',
      'open.folderSync',
      'open.textMerge',
      'open.registryCompare',
      'session.newTab',
      'session.newWindow',
      'session.openSession',
      'session.loadWorkspace',
      'workspace.save',
      'session.save',
      'session.saveAs',
      'session.export',
      'session.compare',
      'session.swap',
      'session.reload',
      'session.rules',
      'session.settings',
      'session.clear',
      'session.locked',
      'session.back',
      'session.forward',
      'session.browseFolder',
      'session.upOneLevel',
      'actions.newFolder',
      'session.mergeBaseFolders',
      'session.syncBaseFolders',
      'sync.syncNow',
      'session.closeTab',
      'report.save',
      'session.exit',
    ],
  },
  {
    id: 'file',
    titleKey: 'ui.file',
    commandIds: [
      'open.textCompare',
      'open.folderCompare',
      'open.folderSync',
      'open.folderMerge',
      'open.textMerge',
      'open.registryCompare',
      'open.hexCompare',
      'open.tableCompare',
      'open.textPatch',
      'session.save',
      'session.saveAs',
      'session.export',
      'session.reload',
      'session.back',
      'session.forward',
      'session.browseFolder',
      'session.upOneLevel',
      'actions.newFolder',
      'open.settings',
    ],
  },
  {
    id: 'actions',
    titleKey: 'ui.actions',
    commandIds: [
      'actions.leaveAlone',
      'actions.copyRightToLeft',
      'actions.copyLeftToRight',
      'actions.deleteLeft',
      'actions.deleteRight',
      'actions.open',
      'actions.openWith',
      'actions.quickCompare',
      'actions.compareContents',
      'session.compare',
      'session.swap',
      'session.reload',
      'session.rules',
      'sync.syncNow',
      'view.filters',
      'edit.copyLeft',
      'edit.copyRight',
      'actions.copyToSide',
      'actions.moveToSide',
      'actions.copyToFolder',
      'actions.moveToFolder',
      'actions.delete',
      'actions.rename',
      'actions.attributes',
      'actions.touch',
      'actions.copyToOutput',
      'actions.merge',
      'actions.newFolder',
      'actions.exclude',
      'actions.copyFilename',
      'actions.ignored',
      'actions.refreshSelection',
      'actions.fileCompareReport',
      'actions.synchronize',
      'actions.explorer',
      'actions.alignWith',
      'actions.breakAlignment',
      'report.save',
      'workspace.save',
    ],
  },
  {
    id: 'edit',
    titleKey: 'ui.edit',
    commandIds: [
      'view.expandAll',
      'view.collapseAll',
      'edit.selectAll',
      'edit.selectAllFiles',
      'edit.selectOrphans',
      'edit.invertSelection',
      'session.reload',
      'edit.fullRefresh',
      'edit.undo',
      'edit.redo',
      'edit.cut',
      'edit.copy',
      'edit.paste',
      'edit.delete',
      'edit.copyLeft',
      'edit.copyRight',
    ],
  },
  {
    id: 'search',
    titleKey: 'ui.search',
    commandIds: [
      'diff.previous',
      'diff.next',
      'merge.previousConflict',
      'merge.nextConflict',
      'search.findFilename',
      'search.findNextFilename',
      'search.findPreviousFilename',
    ],
  },
  {
    id: 'view',
    titleKey: 'ui.view',
    commandIds: [
      'view.showAll',
      'view.showDifferences',
      'view.showSame',
      'view.toggleMinor',
      'view.expandAll',
      'view.collapseAll',
      'diff.next',
      'diff.previous',
      'view.filters',
      'view.columns',
      'view.legend',
      'view.log',
      'view.toolbar',
      'session.swap',
      'session.reload',
      'session.back',
      'session.forward',
      'session.browseFolder',
      'session.upOneLevel',
      'theme.toggle',
    ],
  },
  {
    id: 'tools',
    titleKey: 'ui.tools',
    commandIds: [
      'open.settings',
      'open.fileFormats',
      'open.remoteProfiles',
      'tools.exportSettings',
      'tools.importSettings',
      'tools.restoreFactoryDefaults',
      'tools.saveSnapshot',
      'open.textEdit',
      'open.textPatch',
      'script.run',
      'theme.toggle',
    ],
  },
  {
    id: 'help',
    titleKey: 'ui.help',
    commandIds: ['help.contents', 'help.about', 'help.checkForUpdates', 'help.support'],
  },
]
const visibleAppMenus = computed(() => {
  const homeMenus: AppMenuId[] = ['session', 'view', 'tools', 'help']
  const folderMenus: AppMenuId[] = ['session', 'actions', 'edit', 'search', 'view', 'tools', 'help']
  const fileMenus: AppMenuId[] = ['session', 'file', 'edit', 'search', 'view', 'tools', 'help']
  const pictureMenus: AppMenuId[] = ['session', 'file', 'edit', 'view', 'tools', 'help']
  let wantedMenus = fileMenus

  if (route.path === '/') {
    wantedMenus = homeMenus
  } else if (
    route.path.includes('/folder') ||
    route.path.includes('/sync') ||
    route.path.includes('/merge')
  ) {
    wantedMenus = folderMenus
  } else if (route.path.includes('/picture')) {
    wantedMenus = pictureMenus
  }

  const menuById = new Map(appMenus.map((menu) => [menu.id, menu]))

  return wantedMenus.map((menuId) => menuById.get(menuId)).filter((menu) => menu !== undefined)
})
const menuCommandLookup = computed(
  () => new Map(commandRegistry.map((command) => [command.id, command])),
)

async function openHelpLink(url: string, kind: 'updates' | 'docs' | 'support'): Promise<void> {
  if (kind === 'updates' && !policy.updateChecks) {
    helpStatusMessage.value = t('ui.updatesCheckDisabled')

    return
  }

  try {
    await openPathExternal(url)
  } catch {
    window.open(url, '_blank', 'noopener,noreferrer')
  }

  if (kind === 'updates') {
    helpStatusMessage.value = t('ui.updatesCheckOpened')
  }
}

function closeAboutDialog(): void {
  aboutDialogOpen.value = false
}

function sessionTypeForActiveRoute(): SessionType | undefined {
  const pathname = tabRoutePathname(route.fullPath)
  const entry = sessionCatalog.find((item) => item.route === pathname)

  return entry?.type
}

function saveCurrentSessionFromMenu(saveAs: boolean): void {
  const sessionType = sessionTypeForActiveRoute()

  if (!sessionType || !isSessionWorkbenchPath(route.path)) {
    statusBar.reportStatus({
      comparisonStatus: t('ui.saveSession'),
      source: 'session',
    })

    return
  }

  const active = tabs.activeTab
  let name = active.titleKey ? t(active.titleKey) : active.title

  if (saveAs) {
    name = `${name} Copy`
  }

  const session = createUntitledSession(sessionType)

  session.name = name

  if (lastCompare.folder && sessionType.startsWith('folder')) {
    session.locations = {
      left: { uri: lastCompare.folder.leftRoot, readOnly: false },
      right: { uri: lastCompare.folder.rightRoot, readOnly: false },
    }
  } else if (lastCompare.text && sessionType.includes('text')) {
    session.locations = {
      left: lastCompare.text.leftSource
        ? { uri: lastCompare.text.leftSource, readOnly: false }
        : undefined,
      right: lastCompare.text.rightSource
        ? { uri: lastCompare.text.rightSource, readOnly: false }
        : undefined,
    }
  }

  savedSessions.saveSession(session)
  lastMenuSavedSessionId.value = session.id

  if (active.id !== 'home') {
    tabs.setTabDirty(active.id, false)
  }

  statusBar.reportStatus({
    comparisonStatus: saveAs ? t('ui.saveSessionAs') : t('ui.saveSession'),
    source: 'session',
  })
}

function resolveLockableSessionId(): string | undefined {
  if (lastMenuSavedSessionId.value) {
    const remembered = savedSessions.sessions.find(
      (session) => session.id === lastMenuSavedSessionId.value,
    )

    if (remembered) {
      return remembered.id
    }
  }

  const sessionType = sessionTypeForActiveRoute()

  if (!sessionType) {
    return undefined
  }

  const matches = savedSessions.sessions.filter((session) => session.sessionType === sessionType)

  return matches.at(-1)?.id
}

function toggleSessionLockedFromMenu(): void {
  const sessionId = resolveLockableSessionId()

  if (!sessionId || !isSessionWorkbenchPath(route.path)) {
    statusBar.reportStatus({
      comparisonStatus: t('ui.locked'),
      source: 'session',
    })

    return
  }

  const session = savedSessions.sessions.find((item) => item.id === sessionId)

  if (!session) {
    statusBar.reportStatus({
      comparisonStatus: t('ui.locked'),
      source: 'session',
    })

    return
  }

  savedSessions.setSessionLocked(sessionId, !session.metadata.locked)
  statusBar.reportStatus({
    comparisonStatus: t('ui.locked'),
    source: 'session',
  })
}

function clearSessionFromMenu(): void {
  const sessionType = sessionTypeForActiveRoute()
  const active = tabs.activeTab

  if (!sessionType || !isSessionWorkbenchPath(route.path) || !tabs.canCloseTab(active.id)) {
    statusBar.reportStatus({
      comparisonStatus: t('ui.clearSession'),
      source: 'session',
    })

    return
  }

  const entry = sessionCatalog.find((item) => item.type === sessionType)
  const routePath = entry?.route ?? tabRoutePathname(active.route)

  tabs.closeTab(active.id)
  const opened = tabs.openTab({
    title: entry ? t(entry.titleKey) : active.title,
    titleKey: entry?.titleKey,
    route: routePath,
    dirty: false,
    forceNew: true,
  })

  void router.push(opened.route)
  statusBar.reportStatus({
    comparisonStatus: t('ui.clearSession'),
    source: 'session',
  })
}

function saveCurrentWorkspaceFromMenu(): void {
  const name = `Workspace ${new Date().toLocaleString()}`

  workspaces.saveWorkspace(name, tabs.workspaceSnapshot())
  statusBar.reportStatus({
    comparisonStatus: t('ui.saveWorkspaceAs'),
    source: 'workspace',
  })
}

function maybeRestoreLastWorkspaceOnStartup(): void {
  if (!settings.loadLastWorkspaceOnStartup) {
    return
  }

  const latest = workspaces.workspaces.at(0)

  if (!latest) {
    return
  }

  tabs.restoreWorkspaceTabs(latest.tabs)
  const active = tabs.activeTab

  void router.push(active.route)
  statusBar.reportStatus({
    comparisonStatus: latest.name,
    source: 'workspace',
  })
}

function loadWorkspaceFromMenu(): void {
  const latest = workspaces.workspaces.at(0)

  if (!latest) {
    tabs.openTab({ title: t('ui.home'), titleKey: 'ui.home', route: '/', dirty: false })
    void router.push('/')
    statusBar.reportStatus({
      comparisonStatus: t('ui.loadWorkspace'),
      source: 'workspace',
    })

    return
  }

  tabs.restoreWorkspaceTabs(latest.tabs)

  const active = tabs.activeTab

  void router.push(active.route)
  statusBar.reportStatus({
    comparisonStatus: latest.name,
    source: 'workspace',
  })
}

async function exportSettingsFromMenu(): Promise<void> {
  const payload = JSON.stringify(settings.exportSettingsPackage(), null, 2)

  try {
    await navigator.clipboard.writeText(payload)
    statusBar.reportStatus({
      comparisonStatus: t('ui.exportSettings'),
      source: 'settings',
    })
  } catch {
    statusBar.reportStatus({
      comparisonStatus: t('ui.exportSettings'),
      source: 'settings',
    })
  }
}

async function importSettingsFromMenu(): Promise<void> {
  let raw: string

  try {
    raw = await navigator.clipboard.readText()
  } catch {
    raw = ''
  }

  const imported = settings.importSettingsPackage(raw.trim())

  statusBar.reportStatus({
    comparisonStatus: imported ? t('ui.importSettings') : t('ui.importJson'),
    source: 'settings',
  })
}

function restoreFactoryDefaultsFromMenu(): void {
  settings.restoreFactoryDefaults()
  statusBar.reportStatus({
    comparisonStatus: t('ui.restoreFactoryDefaults'),
    source: 'settings',
  })
}

async function closeMainWindow(): Promise<void> {
  if (settings.confirmBeforeQuit) {
    // eslint-disable-next-line no-alert -- quit confirmation from Options → Tweaks
    const confirmed = window.confirm(t('ui.confirmQuitMessage'))

    if (!confirmed) {
      return
    }
  }

  if (loadReportPreferences().clearHistoryOnExit) {
    clearRecentReportExports()
  }

  try {
    const { getCurrentWindow } = await import('@tauri-apps/api/window')

    await getCurrentWindow().close()
  } catch {
    window.close()
  }
}

async function openSessionWindowFromMenu(): Promise<void> {
  const opened = await openSessionWindow(undefined, route.fullPath || '/')

  if (!opened) {
    statusBar.reportStatus({
      comparisonStatus: t('ui.newWindow'),
      source: 'session',
    })
  }
}

async function saveSnapshotFromMenu(): Promise<void> {
  let sourceRoot = lastCompare.folder?.leftRoot ?? ''

  if (!sourceRoot) {
    sourceRoot = (await pickNativePath({ directory: true })) ?? ''
  }

  if (!sourceRoot) {
    statusBar.reportStatus({
      comparisonStatus: t('status.snapshotNeedsFolder'),
      source: 'tools',
    })

    return
  }

  const normalizedRoot = sourceRoot.replace(/[/\\]+$/u, '')
  const outputPath = folderSnapshotOutputPath(normalizedRoot)

  try {
    const written = await createFolderSnapshot({
      sourceRoot: normalizedRoot,
      outputPath,
      name: pathBaseName(normalizedRoot),
    })

    statusBar.reportStatus({
      comparisonStatus: t('status.snapshotSaved', { path: written }),
      source: 'tools',
    })
  } catch (error) {
    statusBar.reportStatus({
      comparisonStatus: error instanceof Error ? error.message : String(error),
      source: 'tools',
    })
  }
}

const executeRegisteredCommand = createCommandExecutor(commandRegistry, {
  navigate: (nextRoute) => {
    void router.push(nextRoute)
  },
  openTab: (tab) => {
    const forceNew = settings.openSessionsInNewTab && isSessionWorkbenchRoute(tab.route)

    return tabs.openTab({ ...tab, forceNew })
  },
  t,
  toggleTheme: settings.toggleTheme,
  leaveApp: () => {
    void closeMainWindow()
  },
  openNewWindow: () => {
    void openSessionWindowFromMenu()
  },
  dispatchViewAction: (name) => {
    lastViewAction.value = name
    if (name === 'toggle-toolbar') {
      settings.setShowSessionToolbars(!settings.showSessionToolbars)
    }
    if (name === 'toggle-legend') {
      settings.setShowFolderLegend(!settings.showFolderLegend)
    }
    viewActions.dispatch(name)
    if (name === 'about') {
      aboutDialogOpen.value = true
      helpStatusMessage.value = ''
    }
    if (name === 'check-for-updates') {
      void openHelpLink(RELEASES_URL, 'updates')
    }
    if (name === 'help-contents') {
      void openHelpLink(DOCS_URL, 'docs')
    }
    if (name === 'help-support') {
      void openHelpLink(SUPPORT_URL, 'support')
    }
    if (name === 'save' || name === 'save-as') {
      saveCurrentSessionFromMenu(name === 'save-as')
    }
    if (name === 'clear-session') {
      clearSessionFromMenu()
    }
    if (name === 'toggle-session-locked') {
      toggleSessionLockedFromMenu()
    }
    if (name === 'close-tab') {
      const active = tabs.activeTab

      if (tabs.canCloseTab(active.id)) {
        requestCloseTab({ id: active.id, title: displayTabTitle(active), dirty: active.dirty })
      }
    }
    if (name === 'workspace-save') {
      saveCurrentWorkspaceFromMenu()
    }
    if (name === 'workspace-load') {
      loadWorkspaceFromMenu()
    }
    if (name === 'export-settings') {
      void exportSettingsFromMenu()
    }
    if (name === 'import-settings') {
      void importSettingsFromMenu()
    }
    if (name === 'restore-factory-defaults') {
      restoreFactoryDefaultsFromMenu()
    }
    if (name === 'save-snapshot') {
      const folderish =
        route.path.includes('/folder') ||
        route.path.includes('/sync') ||
        route.path.includes('/merge')

      if (!folderish) {
        void saveSnapshotFromMenu()
      }
    }
  },
})

const navigationItems = computed<NavigationItem[]>(() =>
  sessionCatalog
    .filter(
      (entry): entry is SessionCatalogEntry & { route: string } =>
        Boolean(entry.route) && entry.implemented,
    )
    .map((entry) => ({
      title: entry.title,
      titleKey: entry.titleKey,
      route: entry.route,
      type: entry.type,
      icon: sessionIcon(entry.type),
      count: sessionCount(entry.type),
      group: sourceSessionTypes.has(entry.type) ? 'sources' : 'compare',
    })),
)
const statusSegments = computed(() => statusBar.segments)

interface StatusChromePane {
  text: string
  muted: boolean
  testId: string
}

function localizedDifferenceSegment(differenceCount: number | null, source: string): string {
  if (isHexSessionStatusSource(source)) {
    if (differenceCount === null || differenceCount === 0) {
      return t('status.hexSame')
    }

    return t('status.binaryDifferences')
  }

  if (!isTextSessionStatusSource(source)) {
    return `${t('status.differences')}: ${differenceCount === null ? '-' : String(differenceCount)}`
  }

  if (differenceCount === null) {
    return t('status.differenceSectionUnknown')
  }

  if (differenceCount === 1) {
    return t('status.differenceSection', { count: differenceCount })
  }

  return t('status.differenceSections', { count: differenceCount })
}

function localizedImportanceSegment(
  importantCount: number | null,
  unimportantCount: number | null,
): string | null {
  if (importantCount === null || unimportantCount === null) {
    return null
  }

  if (importantCount === 0 && unimportantCount === 0) {
    return t('status.same')
  }

  if (importantCount > 0 && unimportantCount === 0) {
    return t('status.importantDifference')
  }

  if (importantCount === 0 && unimportantCount > 0) {
    return t('status.unimportantDifference')
  }

  return t('status.importantUnimportantCounts', {
    important: importantCount,
    unimportant: unimportantCount,
  })
}

function statusPane(
  text: string | null | undefined,
  testId: string,
  forceMuted = false,
): StatusChromePane {
  const value = text?.trim() ?? ''

  return {
    text: value || t('status.panePlaceholder'),
    muted: forceMuted || !value,
    testId,
  }
}

const localizedStatusSegments = computed(() => {
  const segments = [
    localizeStatusValue(statusSegments.value[0]),
    localizedDifferenceSegment(statusBar.report.differenceCount, statusBar.report.source),
    `${t('status.encoding')}: ${statusBar.report.encoding}`,
    `${t('status.filter')}: ${localizeStatusValue(statusBar.report.filterStatus)}`,
  ]

  const importance = localizedImportanceSegment(
    statusBar.report.importantDifferenceCount,
    statusBar.report.unimportantDifferenceCount,
  )

  if (importance) {
    segments.push(importance)
  }

  if (isEditModeStatusSource(statusBar.report.source) && statusBar.report.editMode) {
    segments.push(
      statusBar.report.editMode === 'overwrite'
        ? t('status.overwriteMode')
        : t('status.insertMode'),
    )
  }

  if (statusBar.report.loadTimeSeconds !== null) {
    segments.push(t('status.loadTime', { seconds: statusBar.report.loadTimeSeconds.toFixed(2) }))
  }

  return segments
})

const statusChromePanes = computed((): StatusChromePane[] => {
  const kind = statusBar.chromeKind

  if (kind === 'folder-pair') {
    // Capture folder-pair strip is always 4 panes. Importance would be a 5th —
    // hide it from the strip until Peek (or another toggle) surfaces it.
    return buildFolderPairStatusPanes({
      leftSelection: statusBar.report.leftSelection,
      leftFreeSpace: statusBar.report.leftFreeSpace,
      rightSelection: statusBar.report.rightSelection,
      rightFreeSpace: statusBar.report.rightFreeSpace,
      placeholder: t('status.panePlaceholder'),
    })
  }

  if (kind === 'text-session' || kind === 'hex-session' || kind === 'registry-session') {
    let editModeText = ''

    if (statusBar.report.editMode === 'overwrite') {
      editModeText = t('status.overwriteMode')
    } else if (statusBar.report.editMode === 'insert') {
      editModeText = t('status.insertMode')
    }
    const loadTimeText =
      statusBar.report.loadTimeSeconds !== null
        ? t('status.loadTime', { seconds: statusBar.report.loadTimeSeconds.toFixed(2) })
        : ''
    const importance = localizedImportanceSegment(
      statusBar.report.importantDifferenceCount,
      statusBar.report.unimportantDifferenceCount,
    )
    const primaryStatus =
      importance ??
      localizedDifferenceSegment(statusBar.report.differenceCount, statusBar.report.source)

    return [
      statusPane(
        primaryStatus,
        importance ? 'status-pane-importance' : 'status-pane-diff',
        !importance && statusBar.report.differenceCount === null,
      ),
      statusPane(
        localizeStatusValue(statusBar.report.filterStatus) ||
          localizeStatusValue(statusBar.report.comparisonStatus) ||
          t('status.readyIdle'),
        'status-pane-filter',
      ),
      statusPane(editModeText, 'status-pane-edit', !editModeText),
      statusPane(loadTimeText, 'status-pane-load', !loadTimeText),
    ]
  }

  return padStatusChromePanes(
    localizedStatusSegments.value.map((segmentText, index) => ({
      text: segmentText,
      muted: false,
      testId: `status-pane-${String(index)}`,
    })),
    4,
    () => statusPane('', 'status-pane-placeholder', true),
  ).map((pane, index) => ({
    text: pane.text,
    muted: Boolean(pane.muted),
    testId: pane.testId ?? `status-pane-${String(index)}`,
  }))
})
const windowTitle = computed(() => {
  if (route.path === '/') {
    return 'Home - OpenDiff'
  }

  const entry = sessionCatalog.find((item) => item.route === route.path)
  const sessionName = entry ? t(entry.titleKey) : t('app.brand')
  const active = tabs.activeTab
  const pathAwareTitle =
    tabRoutePathname(active.route) === route.path &&
    !active.titleKey &&
    (active.title.includes('<-->') || active.title.includes('→'))
      ? active.title
      : undefined

  if (pathAwareTitle) {
    return `${pathAwareTitle} - ${sessionName} - OpenDiff`
  }

  return `${sessionName} - OpenDiff`
})

watch(
  windowTitle,
  (title) => {
    if (typeof document !== 'undefined') {
      document.title = title
    }
  },
  { immediate: true },
)

function navigate(nextRoute: string, title: string, titleKey?: string): void {
  const forceNew = settings.openSessionsInNewTab && isSessionWorkbenchRoute(nextRoute)

  const opened = tabs.openTab({ route: nextRoute, title, titleKey, dirty: false, forceNew })

  void router.push(opened.route)
}

function activateTab(tabId: string): void {
  const tab = tabs.activateTab(tabId)

  if (!tab) {
    return
  }

  void router.push(tab.route)
}

const showTabStrip = computed(() => {
  const sole = tabs.tabs.length === 1 ? tabs.tabs[0] : undefined

  return shouldShowTabStrip({
    alwaysShowTabBar: settings.alwaysShowTabBar,
    tabCount: tabs.tabs.length,
    soleTabId: sole?.id,
    soleTabRoute: sole ? tabRoutePathname(sole.route) : undefined,
  })
})

const singleSessionFrame = computed(() =>
  isSingleSessionFrame({
    showTabStrip: showTabStrip.value,
    routePath: route.path,
  }),
)

const denseAppChrome = computed(() => preferDenseAppChrome({ showTabStrip: showTabStrip.value }))

provide('shellChrome', {
  showTabStrip,
  singleSessionFrame,
  denseAppChrome,
})

function openCommandPalette(): void {
  commandPaletteOpen.value = true
  commandQuery.value = ''
}

function closeCommandPalette(): void {
  commandPaletteOpen.value = false
}

function executeCommand(commandId: CommandId): void {
  executeRegisteredCommand(commandId)
  closeCommandPalette()
  languageMenuOpen.value = false
  activeMenu.value = undefined
}

function commandIcon(commandId: CommandId): LucideIcon {
  if (commandId === 'open.folderCompare') {
    return FolderTree
  }

  if (commandId === 'open.settings') {
    return Settings
  }

  if (commandId === 'theme.toggle') {
    return SunMoon
  }

  if (commandId === 'diff.previous') {
    return ArrowUp
  }

  if (commandId === 'diff.next') {
    return ArrowDown
  }

  return FileText
}

function openNavigationItem(item: NavigationItem): void {
  navigate(item.route, t(item.titleKey), item.titleKey)
}

function displayTabTitle(tab: { title: string; titleKey?: string }): string {
  return tab.titleKey ? t(tab.titleKey) : tab.title
}

function localizeStatusValue(value: string): string {
  const keys: Record<string, string> = {
    'All rows': 'status.allRows',
    Compared: 'status.compared',
    Ready: 'app.ready',
  }

  return keys[value] ? t(keys[value]) : value
}

function isSessionWorkbenchPath(path: string): boolean {
  return path !== '/' && path !== '/settings' && !path.startsWith('/settings/')
}

function resolveMenuCommand(command: AppCommand): AppCommand {
  if (command.id === 'session.closeTab') {
    return { ...command, enabled: tabs.canCloseTab(tabs.activeTab.id) }
  }

  if (
    command.id === 'session.save' ||
    command.id === 'session.saveAs' ||
    command.id === 'session.clear' ||
    command.id === 'session.export' ||
    command.id === 'session.compare' ||
    command.id === 'session.swap' ||
    command.id === 'session.reload' ||
    command.id === 'session.rules' ||
    command.id === 'session.settings' ||
    command.id === 'report.save' ||
    command.id === 'diff.next' ||
    command.id === 'diff.previous'
  ) {
    return { ...command, enabled: command.enabled && isSessionWorkbenchPath(route.path) }
  }

  if (command.id === 'session.locked') {
    return {
      ...command,
      enabled:
        command.enabled &&
        isSessionWorkbenchPath(route.path) &&
        Boolean(resolveLockableSessionId()),
    }
  }

  if (command.id === 'session.browseFolder' || command.id === 'session.upOneLevel') {
    const folderish =
      route.path.includes('/folder') ||
      route.path.includes('/sync') ||
      route.path.includes('/merge')

    return { ...command, enabled: command.enabled && folderish }
  }

  if (command.id === 'session.back' || command.id === 'session.forward') {
    const folderish =
      route.path.includes('/folder') ||
      route.path.includes('/sync') ||
      route.path.includes('/merge')
    const historyReady =
      command.id === 'session.back' ? folderPathNav.canGoBack : folderPathNav.canGoForward

    return { ...command, enabled: command.enabled && folderish && historyReady }
  }

  if (command.id === 'edit.selectAll' || command.id === 'edit.invertSelection') {
    const folderish =
      route.path.includes('/folder') ||
      route.path.includes('/sync') ||
      route.path.includes('/merge') ||
      route.path.includes('/registry')

    return { ...command, enabled: command.enabled && folderish }
  }

  if (command.id === 'edit.selectAllFiles' || command.id === 'edit.selectOrphans') {
    const supported =
      route.path.includes('/compare/folder') ||
      route.path.includes('/merge') ||
      route.path.includes('/registry')

    return { ...command, enabled: command.enabled && supported }
  }

  if (
    command.id === 'actions.open' ||
    command.id === 'actions.openWith' ||
    command.id === 'actions.quickCompare' ||
    command.id === 'actions.exclude' ||
    command.id === 'actions.refreshSelection' ||
    command.id === 'view.showSame' ||
    command.id === 'view.expandAll' ||
    command.id === 'view.collapseAll' ||
    command.id === 'search.findFilename' ||
    command.id === 'search.findNextFilename' ||
    command.id === 'search.findPreviousFilename' ||
    command.id === 'edit.fullRefresh'
  ) {
    const folderish =
      route.path.includes('/folder') ||
      route.path.includes('/sync') ||
      route.path.includes('/merge') ||
      route.path.includes('/registry')

    return { ...command, enabled: command.enabled && folderish }
  }

  if (command.id === 'view.columns') {
    return {
      ...command,
      enabled: command.enabled && route.path.includes('/compare/folder'),
    }
  }

  if (command.id === 'view.legend') {
    return {
      ...command,
      enabled: command.enabled && supportsFolderStatusLegend(route.path),
    }
  }

  if (command.id === 'view.log') {
    const supported = route.path.includes('/sync') || route.path.includes('/merge')

    return { ...command, enabled: command.enabled && supported }
  }

  if (command.id === 'view.toolbar') {
    return { ...command, enabled: command.enabled }
  }

  if (command.id === 'actions.attributes' || command.id === 'actions.touch') {
    return {
      ...command,
      enabled: command.enabled && route.path.includes('/compare/folder'),
    }
  }

  if (command.id === 'actions.copyToOutput' || command.id === 'actions.merge') {
    return {
      ...command,
      enabled: command.enabled && route.path.includes('/merge'),
    }
  }

  if (command.id === 'actions.newFolder') {
    const folderish =
      route.path.includes('/compare/folder') ||
      route.path.includes('/sync') ||
      route.path.includes('/merge')

    return { ...command, enabled: command.enabled && folderish }
  }

  if (
    command.id === 'actions.leaveAlone' ||
    command.id === 'actions.copyLeftToRight' ||
    command.id === 'actions.copyRightToLeft' ||
    command.id === 'actions.deleteLeft' ||
    command.id === 'actions.deleteRight'
  ) {
    return {
      ...command,
      enabled: command.enabled && route.path.includes('/sync'),
    }
  }

  if (command.id === 'actions.explorer') {
    const folderish =
      route.path.includes('/compare/folder') ||
      route.path.includes('/sync') ||
      route.path.includes('/merge')

    return { ...command, enabled: command.enabled && folderish }
  }

  if (command.id === 'actions.compareContents') {
    const supported = route.path.includes('/compare/folder') || route.path.includes('/merge')

    return { ...command, enabled: command.enabled && supported }
  }

  if (
    command.id === 'actions.copyToSide' ||
    command.id === 'actions.moveToSide' ||
    command.id === 'actions.copyToFolder' ||
    command.id === 'actions.moveToFolder' ||
    command.id === 'actions.rename' ||
    command.id === 'actions.delete' ||
    command.id === 'actions.copyFilename' ||
    command.id === 'actions.synchronize' ||
    command.id === 'actions.ignored' ||
    command.id === 'actions.alignWith' ||
    command.id === 'actions.breakAlignment' ||
    command.id === 'actions.fileCompareReport'
  ) {
    return {
      ...command,
      enabled: command.enabled && route.path.includes('/compare/folder'),
    }
  }

  if (command.id === 'session.mergeBaseFolders' || command.id === 'session.syncBaseFolders') {
    const onFolderCompare = route.path.includes('/compare/folder')

    return { ...command, enabled: command.enabled && onFolderCompare }
  }

  if (command.id === 'sync.syncNow') {
    const onSync = route.path.includes('/sync')

    return { ...command, enabled: command.enabled && onSync }
  }

  if (command.id === 'script.run') {
    return { ...command, enabled: command.enabled && isSessionWorkbenchPath(route.path) }
  }

  if (command.id === 'merge.previousConflict' || command.id === 'merge.nextConflict') {
    const onMerge = route.path.includes('/merge')

    return { ...command, enabled: command.enabled && onMerge }
  }

  return command
}

function menuShortcutLabel(command: AppCommand): string {
  return formatShortcutLabel(settings.getEffectiveShortcut(command))
}

function commandsForMenu(menu: AppMenuDefinition): AppCommand[] {
  return menu.commandIds
    .map((commandId) => menuCommandLookup.value.get(commandId))
    .filter((command): command is AppCommand => Boolean(command?.placements.includes('menu')))
    .map(resolveMenuCommand)
}

function toggleApplicationMenu(menu: AppMenuId): void {
  languageMenuOpen.value = false
  activeMenu.value = activeMenu.value === menu ? undefined : menu
}

function closeChromeMenus(): void {
  activeMenu.value = undefined
  languageMenuOpen.value = false
  tabContextMenu.value = undefined
}

function isEscCloseableFileViewPath(path: string): boolean {
  const pathname = tabRoutePathname(path)

  return (
    (pathname.startsWith('/compare/') && !pathname.startsWith('/compare/folder')) ||
    pathname.startsWith('/edit/') ||
    pathname.startsWith('/patch/') ||
    pathname === '/merge/text'
  )
}

function onChromeKeydown(event: KeyboardEvent): void {
  if (event.key === 'Escape') {
    if (
      activeMenu.value ||
      languageMenuOpen.value ||
      tabContextMenu.value ||
      commandPaletteOpen.value
    ) {
      event.preventDefault()
      closeChromeMenus()
      commandPaletteOpen.value = false

      return
    }

    if (settings.escClosesFileViews && isEscCloseableFileViewPath(route.path)) {
      const active = tabs.activeTab

      if (tabs.canCloseTab(active.id)) {
        event.preventDefault()
        requestCloseTab({ id: active.id, title: displayTabTitle(active), dirty: active.dirty })
      }
    }

    return
  }

  if (commandPaletteOpen.value || isEditableKeyboardTarget(event.target)) {
    return
  }

  const commandId = findCommandIdForKeyboardEvent(commandRegistry.map(resolveMenuCommand), event, {
    getEffectiveShortcut: (command) => settings.getEffectiveShortcut(command),
    routePath: route.path,
  })

  if (!commandId) {
    return
  }

  event.preventDefault()
  executeRegisteredCommand(commandId)
}

function requestCloseTab(tab: { id: string; title: string; dirty: boolean }): void {
  if (tab.dirty && settings.confirmBeforeCloseDirtyTab) {
    pendingCloseTab.value = { id: tab.id, title: tab.title }

    return
  }

  tabs.closeTab(tab.id)
}

function confirmCloseDirtyTab(): void {
  if (!pendingCloseTab.value) {
    return
  }

  tabs.closeTab(pendingCloseTab.value.id)
  pendingCloseTab.value = undefined
}

function openTabContextMenu(event: MouseEvent, tabId: string): void {
  event.preventDefault()
  tabContextMenu.value = { x: event.clientX, y: event.clientY, tabId }
  activeMenu.value = undefined
  languageMenuOpen.value = false
}

function contextTab():
  { id: string; title: string; titleKey?: string; dirty: boolean } | undefined {
  const menu = tabContextMenu.value

  if (!menu) {
    return undefined
  }

  return tabs.tabs.find((tab) => tab.id === menu.tabId)
}

function requestCloseContextTab(): void {
  const tab = contextTab()

  tabContextMenu.value = undefined
  if (!tab || !tabs.canCloseTab(tab.id)) {
    return
  }

  requestCloseTab({ id: tab.id, title: displayTabTitle(tab), dirty: tab.dirty })
}

function requestCloseOtherTabs(): void {
  const tab = contextTab()

  tabContextMenu.value = undefined
  if (!tab || !tabs.canCloseOtherTabs(tab.id)) {
    return
  }

  tabs.closeOtherTabs(tab.id)
}

function requestCloseTabsToTheRight(): void {
  const tab = contextTab()

  tabContextMenu.value = undefined
  if (!tab || !tabs.canCloseTabsToTheRight(tab.id)) {
    return
  }

  tabs.closeTabsToTheRight(tab.id)
}

function toggleLanguageMenu(): void {
  activeMenu.value = undefined
  languageMenuOpen.value = !languageMenuOpen.value
}

function selectLocale(locale: string): void {
  if (settings.setLocale(locale)) {
    i18n.setLocale(settings.locale)
  }

  languageMenuOpen.value = false
}

function sessionIcon(type: SessionType): LucideIcon {
  const icons: Partial<Record<SessionType, LucideIcon>> = {
    'clipboard-compare': ClipboardList,
    'folder-compare': FolderTree,
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
    'archive-compare': Package,
    script: Play,
  }

  return icons[type] ?? FileText
}

function sessionCount(type: SessionType): string {
  const route = sessionCatalog.find((entry) => entry.type === type)?.route

  if (!route) {
    return '0'
  }

  return String(tabs.tabs.filter((tab) => tabRoutePathname(tab.route) === route).length)
}

const sourceSessionTypes = new Set<SessionType>([
  'media-compare',
  'registry-compare',
  'version-compare',
])
</script>

<template>
  <div
    class="app-shell"
    :class="{
      'app-shell-single-session': singleSessionFrame,
      'app-shell-dense-chrome': denseAppChrome,
      'app-shell-hide-chrome-utilities': !settings.showChromeUtilities,
    }"
    :data-show-tab-strip="showTabStrip ? 'true' : 'false'"
    :data-single-session-frame="singleSessionFrame ? 'true' : 'false'"
    :data-dense-chrome="denseAppChrome ? 'true' : 'false'"
    :data-chrome-utilities="settings.showChromeUtilities ? 'true' : 'false'"
    data-testid="app-shell"
    @click="closeChromeMenus"
  >
    <header class="menu-bar">
      <button
        class="brand"
        type="button"
        @click="navigate('/', t('ui.home'), 'ui.home')"
      >
        <Rows3 :size="15" />
        <span>{{ windowTitle }}</span>
      </button>
      <nav
        class="menus"
        :aria-label="t('ui.applicationMenus')"
      >
        <div
          v-for="menu in visibleAppMenus"
          :key="menu.id"
          class="menu-group"
          :data-testid="`menu-${menu.id}-group`"
          @click.stop
        >
          <button
            type="button"
            :class="{ active: activeMenu === menu.id }"
            :aria-expanded="activeMenu === menu.id"
            aria-haspopup="menu"
            :data-testid="`menu-${menu.id}`"
            @click="toggleApplicationMenu(menu.id)"
          >
            {{ t(menu.titleKey) }}
          </button>
          <section
            v-if="activeMenu === menu.id"
            class="menu-panel"
            role="menu"
            data-testid="menu-panel"
            @click.stop
          >
            <button
              v-for="command in commandsForMenu(menu)"
              :key="command.id"
              type="button"
              class="menu-command"
              :disabled="!command.enabled"
              :data-testid="`menu-command-${command.id}`"
              :data-shortcut="menuShortcutLabel(command)"
              @click="executeCommand(command.id)"
            >
              <span class="menu-command-label">{{ t(command.titleKey) }}</span>
              <span
                v-if="menuShortcutLabel(command)"
                class="menu-command-shortcut"
                data-testid="menu-command-shortcut"
                >{{ menuShortcutLabel(command) }}</span
              >
            </button>
          </section>
        </div>
      </nav>
      <div class="top-actions">
        <button
          class="chrome-button"
          type="button"
          data-testid="open-command-palette"
          :title="t('command.searchPlaceholder')"
          @click="openCommandPalette"
        >
          <Search :size="15" />
        </button>
        <button
          class="chrome-button"
          type="button"
          data-testid="top-command-theme.toggle"
          :title="t('command.toggleTheme')"
          @click="executeCommand('theme.toggle')"
        >
          <Sun
            v-if="settings.resolvedTheme === 'dark'"
            :size="15"
          />
          <Moon
            v-else
            :size="15"
          />
        </button>
        <div class="language-menu">
          <button
            class="chrome-button"
            type="button"
            :aria-expanded="languageMenuOpen"
            :aria-label="t('ui.language')"
            :title="t('ui.language')"
            data-testid="language-menu-trigger"
            @click.stop="toggleLanguageMenu"
          >
            <Languages :size="15" />
          </button>
          <div
            v-if="languageMenuOpen"
            class="language-panel"
            data-testid="language-menu"
            @click.stop
          >
            <button
              v-for="locale in availableLocales"
              :key="locale.code"
              class="language-option"
              type="button"
              :class="{ active: settings.locale === locale.code }"
              :data-testid="`language-option-${locale.code}`"
              @click="selectLocale(locale.code)"
            >
              <span>{{ locale.label }}</span>
            </button>
          </div>
        </div>
        <button
          class="chrome-button"
          type="button"
          data-testid="top-command-open.settings"
          :title="t('command.openSettings')"
          @click="executeCommand('open.settings')"
        >
          <Settings :size="15" />
        </button>
        <button
          class="chrome-button"
          type="button"
          :title="t('ui.help')"
        >
          <HelpCircle :size="15" />
        </button>
      </div>
    </header>

    <main class="desktop">
      <aside
        class="sidebar"
        data-testid="workspace-sidebar"
        :data-visible="settings.showSidebar ? 'true' : 'false'"
      >
        <div class="sidebar-head">
          <strong>{{ t('ui.workspace') }}</strong>
          <span>{{ t('app.workspaceStatus') }}</span>
        </div>
        <label class="session-search">
          <Search :size="14" />
          <input
            type="search"
            :placeholder="t('ui.searchSessions')"
          />
        </label>
        <nav class="session-nav">
          <p class="nav-section">{{ t('ui.compare') }}</p>
          <button
            class="nav-item"
            type="button"
            :class="{ active: route.path === '/' }"
            @click="navigate('/', t('ui.home'), 'ui.home')"
          >
            <Home :size="15" />
            <span>{{ t('ui.home') }}</span>
            <b data-testid="home-session-count">{{ savedSessions.sessions.length }}</b>
          </button>
          <button
            v-for="item in navigationItems.filter((entry) => entry.group === 'compare')"
            :key="item.route"
            class="nav-item"
            type="button"
            :class="{ active: route.path === item.route }"
            @click="openNavigationItem(item)"
          >
            <component
              :is="item.icon"
              :size="15"
            />
            <span>{{ t(item.titleKey) }}</span>
            <b>{{ item.count }}</b>
          </button>
          <p class="nav-section">{{ t('ui.sources') }}</p>
          <button
            v-for="item in navigationItems.filter((entry) => entry.group === 'sources')"
            :key="item.route"
            class="nav-item"
            type="button"
            :class="{ active: route.path === item.route }"
            @click="openNavigationItem(item)"
          >
            <component
              :is="item.icon"
              :size="15"
            />
            <span>{{ t(item.titleKey) }}</span>
            <b>{{ item.count }}</b>
          </button>
          <button
            v-if="policy.remoteProfiles"
            class="nav-item"
            type="button"
            :class="{ active: route.path === '/settings/remote-profiles' }"
            @click="
              navigate('/settings/remote-profiles', t('ui.remoteProfiles'), 'ui.remoteProfiles')
            "
          >
            <Cloud :size="15" />
            <span>{{ t('ui.remoteProfiles') }}</span>
          </button>
          <button
            class="nav-item"
            type="button"
            :class="{ active: route.path === '/settings/file-formats' }"
            @click="navigate('/settings/file-formats', t('ui.fileFormats'), 'ui.fileFormats')"
          >
            <Braces :size="15" />
            <span>{{ t('ui.fileFormats') }}</span>
          </button>
          <button
            class="nav-item"
            type="button"
            :class="{ active: route.path === '/settings' }"
            @click="navigate('/settings', t('ui.settings'), 'ui.settings')"
          >
            <Settings :size="15" />
            <span>{{ t('ui.settings') }}</span>
          </button>
        </nav>
      </aside>

      <section class="workspace">
        <section
          v-show="showTabStrip"
          class="tab-strip"
          data-testid="tab-strip"
          :data-visible="showTabStrip ? 'true' : 'false'"
        >
          <div
            v-for="tab in tabs.tabs"
            :key="tab.id"
            class="tab-chip"
            :class="{ active: tabs.activeTabId === tab.id, dirty: tab.dirty }"
            :data-testid="`tab-chip-${tab.id}`"
            @contextmenu="openTabContextMenu($event, tab.id)"
          >
            <button
              type="button"
              @click="activateTab(tab.id)"
            >
              {{ displayTabTitle(tab) }}
            </button>
            <button
              v-if="tab.id !== 'home'"
              type="button"
              :data-testid="`close-tab-${tab.id}`"
              @click.stop="requestCloseTab({ ...tab, title: displayTabTitle(tab) })"
            >
              ×
            </button>
          </div>
        </section>
        <section
          v-if="pendingCloseTab"
          class="dirty-tab-prompt"
          data-testid="close-dirty-tab-prompt"
        >
          <span>{{ pendingCloseTab.title }}</span>
          <button
            type="button"
            data-testid="confirm-close-dirty-tab"
            @click="confirmCloseDirtyTab"
          >
            {{ t('ui.close') }}
          </button>
        </section>

        <div
          v-if="tabContextMenu"
          class="tab-context-menu"
          data-testid="tab-context-menu"
          :style="{ left: `${tabContextMenu.x}px`, top: `${tabContextMenu.y}px` }"
          @click.stop
        >
          <button
            type="button"
            data-testid="tab-ctx-close"
            :disabled="!tabs.canCloseTab(tabContextMenu.tabId)"
            @click="requestCloseContextTab"
          >
            {{ t('ui.close') }}
          </button>
          <button
            type="button"
            data-testid="tab-ctx-close-others"
            :disabled="!tabs.canCloseOtherTabs(tabContextMenu.tabId)"
            @click="requestCloseOtherTabs"
          >
            {{ t('ui.closeOthers') }}
          </button>
          <button
            type="button"
            data-testid="tab-ctx-close-to-the-right"
            :disabled="!tabs.canCloseTabsToTheRight(tabContextMenu.tabId)"
            @click="requestCloseTabsToTheRight"
          >
            {{ t('ui.closeToTheRight') }}
          </button>
        </div>

        <section
          class="global-toolbar"
          data-testid="global-toolbar"
        >
          <button
            v-for="command in toolbarCommands"
            :key="command.id"
            type="button"
            :disabled="!command.enabled"
            :data-testid="`toolbar-command-${command.id}`"
            @click="executeCommand(command.id)"
          >
            {{ t(command.titleKey) }}
          </button>
          <button
            type="button"
            data-testid="view-show-differences"
            @click="executeCommand('view.showDifferences')"
          >
            {{ t('ui.differencesOnly') }}
          </button>
          <span
            v-if="lastViewAction"
            data-testid="last-view-action"
          >
            {{ lastViewAction }}
          </span>
        </section>
        <section class="content">
          <RouterView :key="route.fullPath" />
        </section>
      </section>
    </main>

    <footer
      v-if="settings.showStatusBar"
      class="status-bar"
      data-testid="status-bar"
      :data-chrome-kind="statusBar.chromeKind"
      :data-pane-count="String(statusChromePanes.length)"
      :style="{ gridTemplateColumns: `repeat(${statusChromePanes.length}, minmax(0, 1fr))` }"
    >
      <span
        v-for="(pane, index) in statusChromePanes"
        :key="`status-segment-${index}`"
        class="status-bar-pane"
        :class="{ 'status-bar-pane-muted': pane.muted }"
        :data-testid="pane.testId"
        :data-muted="pane.muted ? 'true' : 'false'"
        >{{ pane.text }}</span
      >
    </footer>

    <div
      v-if="aboutDialogOpen"
      class="about-backdrop"
      data-testid="about-dialog"
      @click.self="closeAboutDialog"
    >
      <section
        class="about-dialog"
        role="dialog"
        aria-modal="true"
        :aria-label="t('ui.aboutTitle')"
      >
        <header>
          <strong>{{ t('ui.aboutTitle') }}</strong>
        </header>
        <p>{{ t('ui.aboutVersion', { version: APP_VERSION }) }}</p>
        <p>{{ t('ui.aboutLicense') }}</p>
        <p>
          <button
            type="button"
            data-testid="about-open-homepage"
            @click="openHelpLink(DOCS_URL, 'docs')"
          >
            {{ t('ui.aboutHomepage') }}
          </button>
        </p>
        <footer>
          <button
            type="button"
            data-testid="about-close"
            @click="closeAboutDialog"
          >
            {{ t('ui.aboutClose') }}
          </button>
        </footer>
      </section>
    </div>
    <p
      v-if="helpStatusMessage"
      class="help-status"
      data-testid="help-status-message"
    >
      {{ helpStatusMessage }}
    </p>

    <div
      v-if="commandPaletteOpen"
      class="command-backdrop"
      @click.self="closeCommandPalette"
    >
      <section class="command-palette">
        <header>
          <Search :size="16" />
          <input
            v-model="commandQuery"
            data-testid="command-search"
            type="search"
            :placeholder="t('command.searchPlaceholder')"
          />
        </header>
        <div class="command-list">
          <button
            v-for="command in visibleCommands"
            :key="command.id"
            type="button"
            class="command-item"
            :disabled="!command.enabled"
            :data-command-id="command.id"
            @click="executeCommand(command.id)"
          >
            <span>
              <component
                :is="commandIcon(command.id)"
                :size="15"
              />
              {{ t(command.titleKey) }}
            </span>
            <small>{{ command.enabled ? t('command.ready') : t('command.planned') }}</small>
          </button>
        </div>
      </section>
    </div>
  </div>
</template>

<style scoped>
.app-shell {
  display: grid;
  grid-template-rows: 48px minmax(0, 1fr) 24px;
  height: 100vh;
  overflow: hidden;
  background: #ffffff;
  color: var(--app-text);
}

.menu-bar {
  position: relative;
  z-index: 80;
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  grid-template-rows: 24px 24px;
  align-items: center;
  gap: 0;
  min-width: 0;
  padding: 0;
  overflow: visible;
  border-bottom: 1px solid #a0a0a0;
  background: #ffffff;
}

.menu-panel {
  position: absolute;
  top: calc(100% + 4px);
  left: 0;
  z-index: 90;
  display: grid;
  width: 280px;
  max-height: calc(100vh - 72px);
  padding: 6px;
  overflow: auto;
  border: 1px solid var(--app-border);
  border-radius: 4px;
  background: var(--app-canvas);
  box-shadow: 0 8px 22px rgb(25 28 30 / 0.18);
}

.menu-panel button,
.menu-panel .menu-command {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  align-items: center;
  gap: 12px;
  min-width: 0;
  min-height: 28px;
  padding: 0 8px;
  overflow: hidden;
  border: 0;
  border-radius: 4px;
  background: transparent;
  color: var(--app-text);
  font-size: 12px;
  text-align: left;
  white-space: nowrap;
  cursor: pointer;
}

.menu-command-label {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.menu-command-shortcut {
  color: var(--app-text-muted);
  font-size: 11px;
  letter-spacing: 0.02em;
}

.menu-panel button:hover {
  background: var(--app-primary-soft);
}

.menu-panel button:disabled {
  color: var(--app-text-muted);
  cursor: not-allowed;
}

.brand {
  display: inline-flex;
  grid-column: 1;
  grid-row: 1;
  align-items: center;
  gap: 5px;
  min-width: 0;
  max-width: 100%;
  height: 24px;
  padding: 0 4px;
  overflow: hidden;
  border: 0;
  background: #f0f3f9;
  color: #111827;
  font-size: 12px;
  font-weight: 400;
  text-overflow: ellipsis;
  white-space: nowrap;
  cursor: pointer;
}

.menus {
  display: flex;
  grid-column: 1 / -1;
  grid-row: 2;
  align-items: center;
  gap: 2px;
  min-width: 0;
  height: 24px;
  padding: 0 2px;
  overflow: visible;
  border-top: 1px solid #e0e0e0;
  background: #ffffff;
}

.menu-group {
  position: relative;
  z-index: 70;
}

.menus button,
.chrome-button,
.nav-item {
  font: inherit;
}

.menus button,
.chrome-button {
  height: 22px;
  border: 0;
  border-radius: 0;
  background: transparent;
  color: #000000;
  cursor: pointer;
}

.menus button {
  max-width: 9em;
  height: 18px;
  padding: 0 2px;
  overflow: hidden;
  font-size: 11px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.menus button:hover,
.menus button.active,
.chrome-button:hover {
  background: #eef4ff;
}

.top-actions {
  display: flex;
  grid-column: 2;
  grid-row: 1;
  gap: 6px;
  margin-left: auto;
  padding: 4px 10px 0 0;
}

.language-menu {
  position: relative;
}

.chrome-button {
  display: inline-grid;
  width: 24px;
  place-items: center;
  color: var(--app-text-muted);
}

.language-panel {
  position: absolute;
  top: 29px;
  right: 0;
  z-index: 50;
  display: grid;
  width: 100px;
  max-width: calc(100vw - 24px);
  padding: 6px;
  border: 1px solid var(--app-border);
  border-radius: 4px;
  background: var(--app-canvas);
  box-shadow: 0 8px 22px rgb(25 28 30 / 0.18);
}

.language-option {
  display: grid;
  align-items: center;
  min-height: 28px;
  padding: 4px 7px;
  border: 0;
  border-radius: 4px;
  background: transparent;
  color: var(--app-text);
  text-align: left;
  cursor: pointer;
}

.language-option:hover {
  background: var(--app-primary-soft);
}

.language-option.active {
  background: var(--app-primary-strong);
  color: #ffffff;
}

.language-option span {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.desktop {
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  min-height: 0;
}

.sidebar {
  display: none;
  grid-template-rows: auto auto minmax(0, 1fr);
  min-height: 0;
  border-right: 1px solid var(--app-border);
  background: var(--app-surface-low);
}

.sidebar-head {
  display: grid;
  gap: 2px;
  padding: 12px 10px 8px;
}

.sidebar-head strong {
  font-size: 11px;
  letter-spacing: 0.05em;
  text-transform: uppercase;
}

.sidebar-head span {
  overflow: hidden;
  color: var(--app-text-muted);
  font-size: 11px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.session-search {
  display: flex;
  align-items: center;
  gap: 6px;
  height: 28px;
  margin: 0 10px 8px;
  padding: 0 8px;
  border: 1px solid var(--app-border);
  border-radius: 4px;
  background: var(--app-canvas);
  color: var(--app-text-muted);
}

.session-search input {
  width: 100%;
  min-width: 0;
  border: 0;
  outline: 0;
  background: transparent;
  color: var(--app-text);
}

.session-nav {
  min-height: 0;
  padding: 0 6px 8px;
  overflow: auto;
}

.nav-section {
  margin: 10px 6px 5px;
  color: var(--app-text-faint);
  font-size: 10px;
  font-weight: 700;
  letter-spacing: 0.05em;
  text-transform: uppercase;
}

.nav-item {
  display: grid;
  grid-template-columns: 22px minmax(0, 1fr) auto;
  align-items: center;
  gap: 6px;
  width: 100%;
  min-height: 30px;
  padding: 4px 8px;
  border: 0;
  border-radius: 4px;
  background: transparent;
  color: var(--app-text-muted);
  text-align: left;
  cursor: pointer;
}

.nav-item span {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.nav-item b {
  min-width: 22px;
  padding: 0 5px;
  border-radius: 999px;
  background: rgb(66 71 84 / 0.12);
  font-size: 11px;
  font-weight: 500;
  text-align: center;
}

.nav-item:hover {
  background: var(--app-surface-highest);
}

.nav-item.active {
  background: var(--app-primary-strong);
  color: #ffffff;
}

.nav-item.active b {
  background: rgb(255 255 255 / 0.2);
}

.workspace,
.content {
  min-width: 0;
  min-height: 0;
  overflow: hidden;
}

.workspace {
  display: flex;
  flex-direction: column;
}

.tab-strip {
  display: flex;
  gap: 1px;
  min-width: 0;
  padding: 0 1px;
  overflow: auto hidden;
  border-bottom: 1px solid #a0a0a0;
  background: var(--app-panel, var(--app-canvas));
}

.tab-context-menu {
  position: fixed;
  z-index: 40;
  display: flex;
  flex-direction: column;
  min-width: 160px;
  padding: 4px;
  border: 1px solid var(--app-border);
  border-radius: 6px;
  background: var(--app-canvas);
  box-shadow: 0 8px 24px rgb(0 0 0 / 0.18);
}

.tab-context-menu button {
  padding: 6px 10px;
  border: 0;
  border-radius: 4px;
  background: transparent;
  color: var(--app-text);
  text-align: left;
  cursor: pointer;
}

.tab-context-menu button:hover:not(:disabled),
.tab-context-menu button:focus-visible:not(:disabled) {
  background: var(--app-hover, rgb(127 127 127 / 0.16));
}

.tab-context-menu button:disabled {
  cursor: default;
  opacity: 0.45;
}

.tab-chip {
  display: inline-flex;
  align-items: center;
  min-width: 0;
  border: 1px solid #a0a0a0;
  border-bottom: 0;
  border-radius: 0;
  background: var(--app-canvas);
}

.tab-chip.active {
  border-color: var(--app-primary);
}

.tab-chip.dirty {
  font-weight: 700;
}

.tab-chip button {
  min-width: 0;
  height: 14px;
  padding: 0 2px;
  border: 0;
  background: transparent;
  color: var(--app-text);
  font-size: 11px;
  cursor: pointer;
}

.tab-chip button:first-child {
  max-width: 160px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.dirty-tab-prompt {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  min-width: 0;
  min-height: 30px;
  padding: 4px 8px;
  overflow: hidden;
  border-bottom: 1px solid var(--app-border);
  background: var(--app-primary-soft);
  color: var(--app-text);
  font-size: 12px;
}

.dirty-tab-prompt > span,
.dirty-tab-prompt > p {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.dirty-tab-prompt button {
  flex: 0 0 auto;
  max-width: 8em;
  height: 22px;
  padding: 0 8px;
  overflow: hidden;
  border: 1px solid var(--app-border);
  border-radius: 4px;
  background: var(--app-canvas);
  color: var(--app-text);
  text-overflow: ellipsis;
  white-space: nowrap;
  cursor: pointer;
}

.global-toolbar {
  position: relative;
  z-index: -1;
  display: flex;
  align-items: center;
  gap: 6px;
  width: 1px;
  min-width: 0;
  height: 0;
  min-height: 0;
  padding: 0;
  overflow: hidden;
  border: 0;
  background: transparent;
  opacity: 0;
}

.global-toolbar button {
  height: 24px;
  padding: 0 8px;
  border: 1px solid var(--app-border);
  border-radius: 4px;
  background: var(--app-canvas);
  color: var(--app-text-muted);
  font-size: 12px;
  cursor: pointer;
}

.global-toolbar button:hover {
  color: var(--app-text);
}

.global-toolbar span {
  margin-left: auto;
  color: var(--app-text-muted);
  font-size: 12px;
}

.content {
  flex: 1 1 auto;
  height: 100%;
  border-top: 0;
  background: #ffffff;
}

.status-bar {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  align-items: stretch;
  min-width: 0;
  height: 24px;
  min-height: 24px;
  padding: 0;
  border-top: 1px solid #b8b8b8;
  background: #f0f0f0;
  color: #000000;
  font-family: 'Segoe UI', 'Microsoft YaHei', sans-serif;
  font-size: 11px;
  line-height: 22px;
}

.status-bar[data-chrome-kind='folder-pair'] {
  grid-template-columns: repeat(4, minmax(0, 1fr));
  height: 22px;
  min-height: 22px;
  font-size: 11px;
  line-height: 20px;
}

.status-bar[data-chrome-kind='folder-pair'] .status-bar-pane {
  padding: 0 4px;
}

/* Capture folder-pair strip: stronger center divider between left/right pairs */
.status-bar[data-chrome-kind='folder-pair'][data-pane-count='4'] .status-bar-pane:nth-child(2) {
  border-right-color: #8e8e8e;
}

.status-bar[data-chrome-kind='text-session'],
.status-bar[data-chrome-kind='hex-session'],
.status-bar[data-chrome-kind='picture-session'],
.status-bar[data-chrome-kind='media-session'],
.status-bar[data-chrome-kind='version-session'],
.status-bar[data-chrome-kind='table-session'],
.status-bar[data-chrome-kind='registry-session'],
.status-bar[data-chrome-kind='clipboard-session'] {
  height: 22px;
  min-height: 22px;
  font-size: 11px;
  line-height: 20px;
}

.status-bar[data-chrome-kind='text-session'] .status-bar-pane,
.status-bar[data-chrome-kind='hex-session'] .status-bar-pane,
.status-bar[data-chrome-kind='picture-session'] .status-bar-pane,
.status-bar[data-chrome-kind='media-session'] .status-bar-pane,
.status-bar[data-chrome-kind='version-session'] .status-bar-pane,
.status-bar[data-chrome-kind='table-session'] .status-bar-pane,
.status-bar[data-chrome-kind='registry-session'] .status-bar-pane,
.status-bar[data-chrome-kind='clipboard-session'] .status-bar-pane {
  padding: 0 4px;
}

.status-bar-pane {
  display: flex;
  align-items: center;
  min-width: 0;
  padding: 0 4px;
  overflow: hidden;
  border-right: 1px solid #c0c0c0;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.status-bar-pane:last-child {
  border-right: 0;
}

.status-bar-pane-muted {
  color: #808080;
}

.command-backdrop {
  position: fixed;
  inset: 0;
  z-index: 40;
  display: grid;
  background: rgb(25 28 30 / 0.28);
  place-items: start center;
  padding-top: 84px;
}

.command-palette {
  display: grid;
  gap: 8px;
  width: min(640px, calc(100vw - 40px));
  padding: 10px;
  border: 1px solid var(--app-border);
  border-radius: 6px;
  background: var(--app-canvas);
  box-shadow: 0 10px 28px rgb(25 28 30 / 0.2);
}

.command-palette header {
  display: flex;
  align-items: center;
  gap: 8px;
  height: 32px;
  padding: 0 9px;
  border: 1px solid var(--app-border);
  border-radius: 4px;
  background: var(--app-surface-low);
  color: var(--app-text-muted);
}

.command-palette input {
  width: 100%;
  min-width: 0;
  border: 0;
  outline: 0;
  background: transparent;
  color: var(--app-text);
}

.command-list {
  display: grid;
  gap: 3px;
}

.command-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  min-height: 30px;
  padding: 0 8px;
  border: 0;
  border-radius: 4px;
  background: transparent;
  color: var(--app-text);
  text-align: left;
  cursor: pointer;
}

.command-item span {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.command-item:hover {
  background: var(--app-primary-soft);
}

.command-item:disabled {
  color: var(--app-text-muted);
  cursor: not-allowed;
}

.command-item small {
  flex: 0 0 auto;
  color: var(--app-text-muted);
  font-size: 11px;
}

html[data-show-sidebar='1'] .desktop {
  grid-template-columns: 220px minmax(0, 1fr);
}

html[data-show-sidebar='1'] .sidebar {
  display: grid;
}

@media (width <= 1180px) {
  .desktop {
    grid-template-columns: minmax(0, 1fr);
  }

  html[data-show-sidebar='1'] .desktop {
    grid-template-columns: minmax(0, 1fr);
  }

  html[data-show-sidebar='1'] .sidebar {
    display: none;
  }
}

.about-backdrop {
  position: fixed;
  inset: 0;
  z-index: 80;
  display: grid;
  place-items: center;
  background: rgb(15 23 42 / 0.45);
}

.about-dialog {
  min-width: min(420px, 92vw);
  padding: 1rem 1.25rem;
  border-radius: 10px;
  background: var(--panel, #ffffff);
  color: var(--text, #0f172a);
  box-shadow: 0 18px 50px rgb(15 23 42 / 0.25);
}

.about-dialog header {
  margin-bottom: 0.75rem;
}

.about-dialog footer {
  margin-top: 1rem;
  display: flex;
  justify-content: flex-end;
}

.help-status {
  position: fixed;
  right: 1rem;
  bottom: 2.5rem;
  z-index: 70;
  max-width: min(420px, 90vw);
  padding: 0.5rem 0.75rem;
  border-radius: 8px;
  background: var(--panel, #ffffff);
  box-shadow: 0 8px 24px rgb(15 23 42 / 0.18);
}

.app-shell-dense-chrome {
  /* Title + menu only — closer to native frames without a tab strip. */
  grid-template-rows: 48px minmax(0, 1fr) 24px;
}

.app-shell-dense-chrome:has(.status-bar[data-chrome-kind='folder-pair']),
.app-shell-dense-chrome:has(.status-bar[data-chrome-kind$='-session']) {
  /* Keep dense brand/menu at 48px; only the status track shrinks to 22px. */
  grid-template-rows: 48px minmax(0, 1fr) 22px;
}

.app-shell:not(.app-shell-dense-chrome):has(.status-bar[data-chrome-kind='folder-pair']),
.app-shell:not(.app-shell-dense-chrome):has(.status-bar[data-chrome-kind$='-session']) {
  grid-template-rows: 48px minmax(0, 1fr) 22px;
}

.app-shell-dense-chrome .menu-bar {
  grid-template-rows: 24px 24px;
}

.app-shell-dense-chrome .brand {
  height: 24px;
  padding: 0 5px;
  font-size: 12px;
}

.app-shell-dense-chrome .brand :deep(svg) {
  width: 10px;
  height: 10px;
}

.app-shell-dense-chrome .menus {
  gap: 2px;
  height: 24px;
  padding: 0 3px;
}

.app-shell-dense-chrome .menus button {
  height: 18px;
  padding: 0 3px;
  font-size: 11px;
}

.app-shell-dense-chrome .top-actions {
  /* Capture frames omit web utility chrome; keep nodes for command-palette tests. */
  position: absolute;
  top: auto;
  left: -10000px;
  display: block;
  width: 1px;
  height: 1px;
  margin: 0;
  padding: 0;
  overflow: hidden;
  border: 0;
}

.app-shell-hide-chrome-utilities .top-actions {
  /* Capture frames omit web utility chrome; keep nodes for command-palette tests. */
  position: absolute;
  top: auto;
  left: -10000px;
  display: block;
  width: 1px;
  height: 1px;
  margin: 0;
  padding: 0;
  overflow: hidden;
  border: 0;
}
</style>
