<script setup lang="ts">
import { computed, ref } from 'vue'
import { useRoute, useRouter, RouterView } from 'vue-router'
import {
  ArrowDown,
  ArrowLeft,
  ArrowRight,
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
  ListTree,
  Moon,
  PanelRight,
  Play,
  Rows3,
  Save,
  Search,
  Settings,
  Sun,
  SunMoon,
  Table2,
  TerminalSquare,
  type LucideIcon,
} from '@lucide/vue'
import { commandRegistry, filterCommands } from '@/app/commandRegistry'
import { createCommandExecutor, getCommandsForPlacement } from '@/app/commandSystem'
import { sessionCatalog } from '@/app/sessionCatalog'
import { useI18n } from '@/i18n'
import { useSettingsStore } from '@/stores/settings'
import { useStatusBarStore } from '@/stores/statusBar'
import { useTabsStore } from '@/stores/tabs'
import type { CommandId } from '@/app/commandRegistry'
import type { SessionCatalogEntry } from '@/app/sessionCatalog'
import type { AppTab } from '@/stores/tabs'
import type { SessionType } from '@/types/session'

interface NavigationItem {
  title: string
  route: string
  type: SessionType
  icon: LucideIcon
  count: string
  group: 'compare' | 'sources'
}

const route = useRoute()
const router = useRouter()
const i18n = useI18n()
const { t } = i18n
const settings = useSettingsStore()
const statusBar = useStatusBarStore()
const tabs = useTabsStore()
const commandPaletteOpen = ref(false)
const commandQuery = ref('')
const inspectorVisible = ref(true)
const languageMenuOpen = ref(false)
const visibleCommands = computed(() => filterCommands(commandRegistry, commandQuery.value))
const toolbarCommands = computed(() => getCommandsForPlacement(commandRegistry, 'toolbar'))
const availableLocales = i18n.availableLocales
const executeRegisteredCommand = createCommandExecutor(commandRegistry, {
  navigate: (nextRoute) => {
    void router.push(nextRoute)
  },
  openTab: (tab) => {
    tabs.openTab(tab)
  },
  t,
  toggleTheme: settings.toggleTheme,
})

const navigationItems = computed<NavigationItem[]>(() =>
  sessionCatalog
    .filter((entry): entry is SessionCatalogEntry & { route: string } => Boolean(entry.route))
    .map((entry) => ({
      title: entry.title,
      route: entry.route,
      type: entry.type,
      icon: sessionIcon(entry.type),
      count: sessionCount(entry.type),
      group: sourceSessionTypes.has(entry.type) ? 'sources' : 'compare',
    })),
)
const activeNavigationItem = computed(() =>
  route.path === '/'
    ? null
    : (navigationItems.value.find((item) => item.route === route.path) ?? null),
)
const pathPair = computed(() => routePathPair(route.path))
const statusSegments = computed(() => statusBar.segments)
const workspaceTitle = computed(() => activeNavigationItem.value?.title ?? t('ui.home'))
const routeSummary = computed(() => activeNavigationItem.value?.type ?? 'workspace')
const routeChangeCount = computed(() => activeNavigationItem.value?.count ?? '142')

function navigate(nextRoute: string, title: string): void {
  tabs.openTab({ route: nextRoute, title, dirty: false })
  void router.push(nextRoute)
}

function activateTab(tab: AppTab): void {
  tabs.activeTabId = tab.id
  void router.push(tab.route)
}

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
  navigate(item.route, item.title)
}

function compareNow(): void {
  const current = activeNavigationItem.value

  if (current) {
    navigate(current.route, current.title)

    return
  }

  navigate('/', t('ui.home'))
}

function toggleInspector(): void {
  inspectorVisible.value = !inspectorVisible.value
}

function toggleLanguageMenu(): void {
  languageMenuOpen.value = !languageMenuOpen.value
}

function selectLocale(locale: string): void {
  if (settings.setLocale(locale)) {
    i18n.setLocale(settings.locale)
  }

  languageMenuOpen.value = false
}

function routePathPair(path: string): { left: string; right: string } {
  const pairs: Record<string, { left: string; right: string }> = {
    '/': { left: 'workspace://release-audit', right: 'workspace://team-shared' },
    '/compare/text': { left: 'C:/Projects/app/main.ts', right: 'C:/Projects/app/main.remote.ts' },
    '/compare/clipboard': { left: 'clipboard://previous', right: 'clipboard://current' },
    '/edit/text': { left: 'C:/Projects/app/notes.md', right: 'editor://draft' },
    '/merge/text': { left: '~/git/repo/auth.base.ts', right: '~/git/repo/auth.output.ts' },
    '/compare/folder': { left: 'D:/workspace/left', right: 'D:/workspace/right' },
    '/merge/folder': { left: 'D:/merge/base', right: 'D:/merge/output' },
    '/sync/folder': { left: 'C:/Projects/frontend-v2/src', right: '\\\\server\\deployments\\src' },
    '/compare/table': { left: 'customers_Q1.csv', right: 'customers_Q2.csv' },
    '/compare/hex': { left: 'firmware.bin', right: 'firmware-patched.bin' },
    '/compare/picture': { left: 'hero-light.png', right: 'hero-dark.png' },
    '/compare/registry': { left: 'HKCU/Software/OpenDiff', right: 'user-before.reg' },
    '/compare/media': { left: 'trailer-master.mp4', right: 'trailer-export.mp4' },
    '/compare/version': { left: 'OpenDiff.exe', right: 'OpenDiff-preview.exe' },
    '/settings': { left: 'User settings', right: 'Admin policy' },
    '/settings/file-formats': { left: 'Format rules', right: 'Team presets' },
    '/settings/remote-profiles': { left: 'SFTP://prod-us-east', right: 'snapshot://release' },
  }

  return pairs[path] ?? pairs['/']
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
  }

  return icons[type] ?? FileText
}

function sessionCount(type: SessionType): string {
  const counts: Partial<Record<SessionType, string>> = {
    'clipboard-compare': '2',
    'folder-compare': '42',
    'folder-merge': '8',
    'folder-sync': '61',
    'hex-compare': '128',
    'media-compare': '6',
    'picture-compare': '4.8%',
    'registry-compare': '11',
    'table-compare': '17',
    'text-compare': '14',
    'text-edit': '1',
    'text-merge': '3',
    'version-compare': '6',
  }

  return counts[type] ?? '0'
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
    :class="{ 'inspector-collapsed': !inspectorVisible }"
  >
    <header class="menu-bar">
      <button
        class="brand"
        type="button"
        @click="navigate('/', t('ui.home'))"
      >
        <Rows3 :size="15" />
        <span>{{ t('app.brand') }}</span>
      </button>
      <nav
        class="menus"
        :aria-label="t('ui.applicationMenus')"
      >
        <button type="button">{{ t('ui.file') }}</button>
        <button type="button">{{ t('ui.edit') }}</button>
        <button type="button">{{ t('ui.search') }}</button>
        <button type="button">{{ t('ui.view') }}</button>
        <button type="button">{{ t('ui.session') }}</button>
        <button type="button">{{ t('ui.actions') }}</button>
        <button type="button">{{ t('ui.tools') }}</button>
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
            v-if="settings.theme === 'dark'"
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
            @click="toggleLanguageMenu"
          >
            <Languages :size="15" />
          </button>
          <div
            v-if="languageMenuOpen"
            class="language-panel"
            data-testid="language-menu"
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

    <section class="command-bar">
      <button
        v-for="command in toolbarCommands"
        :key="command.id"
        class="tool-button"
        type="button"
        :data-testid="`toolbar-command-${command.id}`"
        @click="executeCommand(command.id)"
      >
        <component
          :is="commandIcon(command.id)"
          :size="15"
        />
        <span>{{ t(command.titleKey) }}</span>
      </button>
      <span class="toolbar-separator" />
      <button
        class="tool-button"
        type="button"
        @click="executeCommand('diff.previous')"
      >
        <ArrowUp :size="15" />
        <span>{{ t('ui.previousDifference') }}</span>
      </button>
      <button
        class="tool-button"
        type="button"
        @click="executeCommand('diff.next')"
      >
        <ArrowDown :size="15" />
        <span>{{ t('ui.nextDifference') }}</span>
      </button>
      <span class="toolbar-separator" />
      <button
        class="tool-button"
        type="button"
      >
        <ArrowRight :size="15" />
        <span>{{ t('ui.copyRight') }}</span>
      </button>
      <button
        class="tool-button"
        type="button"
      >
        <ArrowLeft :size="15" />
        <span>{{ t('ui.copyLeft') }}</span>
      </button>
      <button
        class="tool-button"
        type="button"
      >
        <Save :size="15" />
        <span>{{ t('ui.save') }}</span>
      </button>
      <button
        class="tool-button"
        type="button"
        @click="toggleInspector"
      >
        <PanelRight :size="15" />
        <span>{{ t('ui.detail') }}</span>
      </button>
    </section>

    <main class="desktop">
      <aside class="sidebar">
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
            @click="navigate('/', t('ui.home'))"
          >
            <Home :size="15" />
            <span>{{ t('ui.home') }}</span>
            <b>142</b>
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
            <span>{{ item.title }}</span>
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
            <span>{{ item.title }}</span>
            <b>{{ item.count }}</b>
          </button>
          <button
            class="nav-item"
            type="button"
            :class="{ active: route.path === '/settings/remote-profiles' }"
            @click="navigate('/settings/remote-profiles', t('ui.remoteProfiles'))"
          >
            <Cloud :size="15" />
            <span>{{ t('ui.remoteProfiles') }}</span>
            <b>5</b>
          </button>
          <button
            class="nav-item"
            type="button"
            :class="{ active: route.path === '/settings/file-formats' }"
            @click="navigate('/settings/file-formats', t('ui.fileFormats'))"
          >
            <Braces :size="15" />
            <span>{{ t('ui.fileFormats') }}</span>
            <b>34</b>
          </button>
          <button
            class="nav-item"
            type="button"
            :class="{ active: route.path === '/settings' }"
            @click="navigate('/settings', t('ui.settings'))"
          >
            <Settings :size="15" />
            <span>{{ t('ui.settings') }}</span>
            <b>34</b>
          </button>
        </nav>
      </aside>

      <section class="workspace">
        <div class="pathbar">
          <div class="pathbox">
            <ListTree :size="14" />
            <span>{{ pathPair.left }}</span>
          </div>
          <button
            class="swap-button"
            type="button"
            :aria-label="t('ui.swapPaths')"
          >
            ⇄
          </button>
          <div class="pathbox">
            <ListTree :size="14" />
            <span>{{ pathPair.right }}</span>
          </div>
          <button
            class="compare-button"
            type="button"
            @click="compareNow"
          >
            <Play :size="14" />
            <span>{{ t('ui.compare') }}</span>
          </button>
        </div>

        <div class="tab-strip">
          <button
            v-for="tab in tabs.tabs"
            :key="tab.id"
            class="tab"
            type="button"
            :class="{ active: tab.id === tabs.activeTabId }"
            @click="activateTab(tab)"
          >
            <span>{{ tab.title }}</span
            ><b v-if="tab.dirty">*</b>
          </button>
        </div>

        <div class="page-head">
          <div>
            <h1>{{ workspaceTitle }}</h1>
            <span>{{ routeSummary }}</span>
          </div>
          <div class="chips">
            <span>{{ t('ui.differencesOnly') }}</span>
            <span>{{ t('ui.showAll') }}</span>
            <span>{{ t('ui.ignoreRules') }}</span>
            <span>{{ t('ui.export') }}</span>
          </div>
        </div>

        <section class="content">
          <RouterView />
        </section>
      </section>

      <aside
        v-if="inspectorVisible"
        class="inspector"
      >
        <div class="inspector-head">{{ t('ui.detail') }}</div>
        <section class="inspector-panel">
          <h2>{{ t('ui.selection') }}</h2>
          <dl>
            <div>
              <dt>{{ t('ui.session') }}</dt>
              <dd>{{ workspaceTitle }}</dd>
            </div>
            <div>
              <dt>{{ t('ui.left') }}</dt>
              <dd>{{ pathPair.left }}</dd>
            </div>
            <div>
              <dt>{{ t('ui.right') }}</dt>
              <dd>{{ pathPair.right }}</dd>
            </div>
            <div>
              <dt>{{ t('ui.encoding') }}</dt>
              <dd>{{ t('ui.utf8') }}</dd>
            </div>
          </dl>
        </section>
        <section class="inspector-panel">
          <h2>{{ t('ui.change') }}</h2>
          <dl>
            <div>
              <dt>{{ t('ui.add') }}</dt>
              <dd class="positive">8</dd>
            </div>
            <div>
              <dt>{{ t('ui.delete') }}</dt>
              <dd class="negative">4</dd>
            </div>
            <div>
              <dt>{{ t('ui.modified') }}</dt>
              <dd class="warning">2</dd>
            </div>
            <div>
              <dt>{{ t('ui.differencesOnly') }}</dt>
              <dd>{{ routeChangeCount }}</dd>
            </div>
          </dl>
        </section>
        <section class="inspector-panel">
          <h2>{{ t('ui.jobs') }}</h2>
          <div class="job-row">
            <TerminalSquare :size="15" />
            <span>{{ t('ui.noRunningJobs') }}</span>
          </div>
        </section>
      </aside>
    </main>

    <footer
      class="status-bar"
      data-testid="status-bar"
    >
      <span>{{ statusSegments[0] }}</span>
      <span>{{ statusSegments[1] }}</span>
      <span>{{ statusSegments[2] }}</span>
      <span>{{ statusSegments[3] }}</span>
    </footer>

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
  grid-template-rows: 32px 32px minmax(0, 1fr) 24px;
  height: 100vh;
  overflow: hidden;
  background: var(--app-bg);
  color: var(--app-text);
}

.menu-bar,
.command-bar {
  display: flex;
  align-items: center;
  min-width: 0;
  border-bottom: 1px solid var(--app-border);
  background: var(--app-surface-low);
}

.menu-bar {
  gap: 22px;
  padding: 0 10px;
}

.brand {
  display: inline-flex;
  align-items: center;
  gap: 7px;
  min-width: 104px;
  padding: 0;
  border: 0;
  background: transparent;
  color: var(--app-primary);
  font-size: 14px;
  font-weight: 700;
  cursor: pointer;
}

.menus {
  display: flex;
  align-items: center;
  gap: 12px;
}

.menus button,
.chrome-button,
.tool-button,
.swap-button,
.compare-button,
.nav-item,
.tab {
  font: inherit;
}

.menus button,
.chrome-button {
  height: 24px;
  border: 0;
  border-radius: 4px;
  background: transparent;
  color: var(--app-text);
  cursor: pointer;
}

.menus button {
  padding: 0 6px;
}

.menus button:hover,
.chrome-button:hover {
  background: var(--app-surface-highest);
}

.top-actions {
  display: flex;
  gap: 6px;
  margin-left: auto;
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

.command-bar {
  gap: 6px;
  padding: 0 10px;
  background: var(--app-bg);
}

.tool-button,
.compare-button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  height: 26px;
  padding: 0 9px;
  border: 1px solid var(--app-border);
  border-radius: 4px;
  background: var(--app-surface-container);
  color: var(--app-text);
  cursor: pointer;
}

.tool-button:hover {
  background: var(--app-surface-high);
}

.toolbar-separator {
  width: 1px;
  height: 18px;
  background: var(--app-border);
}

.desktop {
  display: grid;
  grid-template-columns: 240px minmax(0, 1fr) 300px;
  min-height: 0;
}

.inspector-collapsed .desktop {
  grid-template-columns: 240px minmax(0, 1fr);
}

.sidebar {
  display: grid;
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
  color: var(--app-text-muted);
  font-size: 11px;
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

.workspace {
  display: grid;
  grid-template-rows: 36px 28px 34px minmax(0, 1fr);
  min-width: 0;
  min-height: 0;
  background: var(--app-bg);
}

.pathbar {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 34px minmax(0, 1fr) auto;
  align-items: center;
  gap: 8px;
  padding: 5px 10px;
  border-bottom: 1px solid var(--app-border);
}

.pathbox {
  display: flex;
  align-items: center;
  gap: 7px;
  min-width: 0;
  height: 26px;
  padding: 0 8px;
  border: 1px solid var(--app-border);
  border-radius: 4px;
  background: var(--app-surface-low);
  color: var(--app-text);
}

.pathbox span {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.swap-button {
  height: 26px;
  border: 1px solid var(--app-border);
  border-radius: 4px;
  background: var(--app-surface-container);
  color: var(--app-text);
  cursor: pointer;
}

.compare-button {
  border-color: var(--app-primary);
  background: var(--app-primary);
  color: #ffffff;
}

.tab-strip {
  display: flex;
  min-width: 0;
  overflow-x: auto;
  border-bottom: 1px solid var(--app-border);
  background: var(--app-surface-container);
}

.tab {
  display: inline-flex;
  align-items: center;
  gap: 3px;
  min-width: 122px;
  max-width: 220px;
  height: 28px;
  padding: 0 10px;
  border: 0;
  border-right: 1px solid var(--app-border);
  background: transparent;
  color: var(--app-text-muted);
  cursor: pointer;
}

.tab span {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.tab.active {
  background: var(--app-canvas);
  color: var(--app-text);
  font-weight: 600;
  box-shadow: inset 0 2px 0 var(--app-primary);
}

.page-head {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  align-items: center;
  gap: 12px;
  padding: 0 10px;
  border-bottom: 1px solid rgb(194 198 214 / 0.7);
  background: var(--app-surface-low);
}

.page-head h1 {
  margin: 0;
  overflow: hidden;
  color: var(--app-text);
  font-size: 14px;
  font-weight: 600;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.page-head span {
  color: var(--app-text-muted);
  font-size: 11px;
}

.chips {
  display: flex;
  gap: 5px;
}

.chips span {
  display: inline-flex;
  align-items: center;
  height: 21px;
  padding: 0 7px;
  border: 1px solid var(--app-border);
  border-radius: 999px;
  background: var(--app-canvas);
  color: var(--app-text-muted);
  font-size: 11px;
}

.content {
  min-height: 0;
  overflow: hidden;
  background: var(--app-canvas);
}

.inspector {
  display: grid;
  grid-template-rows: 32px min-content min-content min-content;
  min-height: 0;
  overflow: auto;
  border-left: 1px solid var(--app-border);
  background: var(--app-bg);
}

.inspector-head {
  display: flex;
  align-items: center;
  padding: 0 10px;
  border-bottom: 1px solid var(--app-border);
  color: var(--app-text-muted);
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.05em;
  text-transform: uppercase;
}

.inspector-panel {
  margin: 10px 10px 0;
  border: 1px solid var(--app-border);
  border-radius: 4px;
  background: var(--app-canvas);
}

.inspector-panel h2 {
  height: 28px;
  margin: 0;
  padding: 5px 8px;
  border-bottom: 1px solid var(--app-border);
  font-size: 12px;
  font-weight: 600;
}

.inspector-panel dl {
  margin: 0;
}

.inspector-panel dl div {
  display: grid;
  grid-template-columns: 92px minmax(0, 1fr);
  gap: 8px;
  padding: 6px 8px;
  border-bottom: 1px solid rgb(194 198 214 / 0.45);
}

.inspector-panel dl div:last-child {
  border-bottom: 0;
}

.inspector-panel dt {
  color: var(--app-text-muted);
}

.inspector-panel dd {
  min-width: 0;
  margin: 0;
  overflow-wrap: anywhere;
  font-weight: 600;
}

.positive {
  color: var(--diff-added-fg);
}

.negative {
  color: var(--diff-deleted-fg);
}

.warning {
  color: var(--diff-modified-fg);
}

.job-row {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px;
  color: var(--app-text-muted);
}

.status-bar {
  display: grid;
  grid-template-columns: 1fr auto auto auto;
  align-items: center;
  gap: 18px;
  min-width: 0;
  padding: 0 12px;
  background: var(--app-status);
  color: var(--app-status-text);
  font-family: var(--font-mono);
  font-size: 12px;
}

.status-bar span {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
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
}

.command-item:hover {
  background: var(--app-primary-soft);
}

.command-item:disabled {
  color: var(--app-text-muted);
  cursor: not-allowed;
}

.command-item small {
  color: var(--app-text-muted);
  font-size: 11px;
}

@media (width <= 1180px) {
  .desktop {
    grid-template-columns: 220px minmax(0, 1fr);
  }

  .inspector {
    display: none;
  }
}
</style>
