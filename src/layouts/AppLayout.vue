<script setup lang="ts">
import { computed, ref } from 'vue'
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
import { sessionCatalog } from '@/app/sessionCatalog'
import { useI18n } from '@/i18n'
import { useSettingsStore } from '@/stores/settings'
import { useStatusBarStore } from '@/stores/statusBar'
import { useTabsStore } from '@/stores/tabs'
import type { CommandId } from '@/app/commandRegistry'
import type { ViewActionName } from '@/app/commandSystem'
import type { SessionCatalogEntry } from '@/app/sessionCatalog'
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
const languageMenuOpen = ref(false)
const activeMenu = ref<string>()
const lastViewAction = ref<ViewActionName>()
const pendingCloseTab = ref<{ id: string; title: string }>()
const visibleCommands = computed(() => filterCommands(commandRegistry, commandQuery.value))
const toolbarCommands = computed(() => getCommandsForPlacement(commandRegistry, 'toolbar'))
const menuCommands = computed(() => getCommandsForPlacement(commandRegistry, 'menu'))
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
  dispatchViewAction: (name) => {
    lastViewAction.value = name
    if (name === 'save' && tabs.activeTab.id !== 'home') {
      tabs.setTabDirty(tabs.activeTab.id, true)
    }
  },
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
const statusSegments = computed(() => statusBar.segments)

function navigate(nextRoute: string, title: string): void {
  tabs.openTab({ route: nextRoute, title, dirty: false })
  void router.push(nextRoute)
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
  navigate(item.route, item.title)
}

function openMenu(menu: string): void {
  activeMenu.value = activeMenu.value === menu ? undefined : menu
}

function requestCloseTab(tab: { id: string; title: string; dirty: boolean }): void {
  if (tab.dirty) {
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

function toggleLanguageMenu(): void {
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
  <div class="app-shell">
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
        <button
          type="button"
          data-testid="menu-file"
          @click="openMenu('file')"
        >
          {{ t('ui.file') }}
        </button>
        <button
          type="button"
          data-testid="menu-edit"
          @click="openMenu('edit')"
        >
          {{ t('ui.edit') }}
        </button>
        <button
          type="button"
          data-testid="menu-search"
          @click="openMenu('search')"
        >
          {{ t('ui.search') }}
        </button>
        <button
          type="button"
          data-testid="menu-view"
          @click="openMenu('view')"
        >
          {{ t('ui.view') }}
        </button>
        <button
          type="button"
          data-testid="menu-session"
          @click="openMenu('session')"
        >
          {{ t('ui.session') }}
        </button>
        <button
          type="button"
          data-testid="menu-actions"
          @click="openMenu('actions')"
        >
          {{ t('ui.actions') }}
        </button>
        <button
          type="button"
          data-testid="menu-tools"
          @click="openMenu('tools')"
        >
          {{ t('ui.tools') }}
        </button>
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

    <section
      v-if="activeMenu"
      class="menu-panel"
      data-testid="menu-panel"
    >
      <button
        v-for="command in menuCommands"
        :key="command.id"
        type="button"
        :disabled="!command.enabled"
        :data-testid="`menu-command-${command.id}`"
        @click="executeCommand(command.id)"
      >
        {{ t(command.titleKey) }}
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
        <section
          class="tab-strip"
          data-testid="tab-strip"
        >
          <div
            v-for="tab in tabs.tabs"
            :key="tab.id"
            class="tab-chip"
            :class="{ active: tabs.activeTabId === tab.id, dirty: tab.dirty }"
          >
            <button
              type="button"
              @click="navigate(tab.route, tab.title)"
            >
              {{ tab.title }}
            </button>
            <button
              v-if="tab.id !== 'home'"
              type="button"
              :data-testid="`close-tab-${tab.id}`"
              @click.stop="requestCloseTab(tab)"
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
          <RouterView />
        </section>
      </section>
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
  grid-template-rows: 32px minmax(0, 1fr) 24px;
  height: 100vh;
  overflow: hidden;
  background: var(--app-bg);
  color: var(--app-text);
}

.menu-bar {
  display: flex;
  align-items: center;
  gap: 22px;
  min-width: 0;
  padding: 0 10px;
  border-bottom: 1px solid var(--app-border);
  background: var(--app-surface-low);
}

.menu-panel {
  position: fixed;
  top: 32px;
  left: 126px;
  z-index: 60;
  display: grid;
  width: 210px;
  max-height: calc(100vh - 72px);
  padding: 6px;
  overflow: auto;
  border: 1px solid var(--app-border);
  border-radius: 4px;
  background: var(--app-canvas);
  box-shadow: 0 8px 22px rgb(25 28 30 / 0.18);
}

.menu-panel button {
  min-height: 28px;
  padding: 0 8px;
  border: 0;
  border-radius: 4px;
  background: transparent;
  color: var(--app-text);
  font-size: 12px;
  text-align: left;
  cursor: pointer;
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
.nav-item {
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

.desktop {
  display: grid;
  grid-template-columns: 240px minmax(0, 1fr);
  min-height: 0;
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

.workspace,
.content {
  min-width: 0;
  min-height: 0;
  overflow: hidden;
}

.workspace {
  display: grid;
  grid-template-rows: auto auto auto minmax(0, 1fr);
}

.tab-strip {
  display: flex;
  gap: 4px;
  min-width: 0;
  min-height: 30px;
  padding: 4px 8px 0;
  overflow: auto hidden;
  border-bottom: 1px solid var(--app-border);
  background: var(--app-surface-low);
}

.tab-chip {
  display: inline-flex;
  align-items: center;
  min-width: 0;
  border: 1px solid var(--app-border);
  border-bottom: 0;
  border-radius: 4px 4px 0 0;
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
  height: 25px;
  padding: 0 8px;
  border: 0;
  background: transparent;
  color: var(--app-text);
  font-size: 12px;
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
  min-height: 30px;
  padding: 4px 8px;
  border-bottom: 1px solid var(--app-border);
  background: var(--app-primary-soft);
  color: var(--app-text);
  font-size: 12px;
}

.dirty-tab-prompt button {
  height: 22px;
  padding: 0 8px;
  border: 1px solid var(--app-border);
  border-radius: 4px;
  background: var(--app-canvas);
  color: var(--app-text);
  cursor: pointer;
}

.global-toolbar {
  display: flex;
  align-items: center;
  gap: 6px;
  min-width: 0;
  min-height: 34px;
  padding: 5px 8px;
  border-bottom: 1px solid var(--app-border);
  background: var(--app-surface-low);
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
  height: 100%;
  background: var(--app-canvas);
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
}
</style>
