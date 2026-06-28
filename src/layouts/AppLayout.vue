<script setup lang="ts">
import { computed, ref } from 'vue'
import { useRouter, RouterView } from 'vue-router'
import { FileText, FolderTree, Search, Settings, SunMoon } from '@lucide/vue'
import { commandRegistry, filterCommands } from '@/app/commandRegistry'
import { useI18n } from '@/i18n'
import { useSettingsStore } from '@/stores/settings'
import { useTabsStore } from '@/stores/tabs'
import type { CommandId } from '@/app/commandRegistry'
import type { AppTab } from '@/stores/tabs'

const router = useRouter()
const { t } = useI18n()
const settings = useSettingsStore()
const tabs = useTabsStore()
const commandPaletteOpen = ref(false)
const commandQuery = ref('')
const visibleCommands = computed(() => filterCommands(commandRegistry, commandQuery.value))

function navigate(route: string, title: string): void {
  tabs.openTab({ route, title, dirty: false })
  void router.push(route)
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
  if (commandId === 'open.textCompare') {
    navigate('/compare/text', 'Text Compare')
  }

  if (commandId === 'open.settings') {
    navigate('/settings', 'Settings')
  }

  if (commandId === 'theme.toggle') {
    settings.toggleTheme()
  }

  closeCommandPalette()
}
</script>

<template>
  <div class="app-shell">
    <header class="top-bar">
      <button
        class="brand"
        @click="navigate('/', 'Home')"
      >
        {{ t('app.brand') }}
      </button>
      <nav class="toolbar">
        <NButton
          quaternary
          size="small"
          @click="navigate('/compare/text', 'Text Compare')"
        >
          <template #icon><FileText :size="16" /></template>
          Text
        </NButton>
        <NButton
          quaternary
          size="small"
          data-testid="open-folder-compare"
          @click="navigate('/compare/folder', 'Folder Compare')"
        >
          <template #icon><FolderTree :size="16" /></template>
          Folder
        </NButton>
      </nav>
      <div class="top-spacer" />
      <NButton
        quaternary
        circle
        size="small"
        data-testid="open-command-palette"
        @click="openCommandPalette"
      >
        <template #icon><Search :size="16" /></template>
      </NButton>
      <NButton
        quaternary
        circle
        size="small"
        @click="settings.toggleTheme"
      >
        <template #icon><SunMoon :size="16" /></template>
      </NButton>
      <NButton
        quaternary
        circle
        size="small"
        @click="navigate('/settings', 'Settings')"
      >
        <template #icon><Settings :size="16" /></template>
      </NButton>
    </header>

    <div class="tab-strip">
      <button
        v-for="tab in tabs.tabs"
        :key="tab.id"
        class="tab"
        :class="{ active: tab.id === tabs.activeTabId }"
        @click="activateTab(tab)"
      >
        {{ tab.title }}<span v-if="tab.dirty">*</span>
      </button>
    </div>

    <main class="content">
      <RouterView />
    </main>

    <footer class="status-bar">
      <span>{{ t('app.ready') }}</span>
      <span>{{ t('app.workspaceStatus') }}</span>
    </footer>

    <div
      v-if="commandPaletteOpen"
      class="command-backdrop"
      @click.self="closeCommandPalette"
    >
      <section class="command-palette">
        <input
          v-model="commandQuery"
          data-testid="command-search"
          type="search"
          :placeholder="t('command.searchPlaceholder')"
        />
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
            <span>{{ command.title }}</span>
            <small>{{ command.enabled ? 'Ready' : 'Planned' }}</small>
          </button>
        </div>
      </section>
    </div>
  </div>
</template>

<style scoped>
.app-shell {
  display: flex;
  flex-direction: column;
  height: 100%;
  overflow: hidden;
}

.top-bar {
  display: flex;
  align-items: center;
  gap: 8px;
  height: 42px;
  padding: 0 12px;
  border-bottom: 1px solid var(--app-border);
  background: var(--app-surface);
}

.brand {
  padding: 4px 8px;
  border: 0;
  background: transparent;
  color: var(--app-text);
  font-weight: 700;
  cursor: pointer;
}

.toolbar {
  display: flex;
  align-items: center;
  gap: 2px;
}

.top-spacer {
  flex: 1;
}

.tab-strip {
  display: flex;
  height: 32px;
  overflow-x: auto;
  border-bottom: 1px solid var(--app-border);
  background: var(--app-surface-muted);
}

.tab {
  min-width: 120px;
  border: 0;
  border-right: 1px solid var(--app-border);
  background: transparent;
  color: var(--app-text-muted);
  cursor: pointer;
}

.tab.active {
  background: var(--app-bg);
  color: var(--app-text);
  font-weight: 600;
}

.content {
  flex: 1;
  min-height: 0;
  overflow: hidden;
}

.status-bar {
  display: flex;
  justify-content: space-between;
  height: 24px;
  padding: 3px 10px;
  border-top: 1px solid var(--app-border);
  background: var(--app-surface);
  color: var(--app-text-muted);
  font-size: 12px;
}

.command-backdrop {
  position: fixed;
  inset: 0;
  z-index: 20;
  display: grid;
  place-items: start center;
  padding-top: 80px;
  background: rgb(0 0 0 / 0.32);
}

.command-palette {
  display: grid;
  gap: 10px;
  width: min(560px, calc(100vw - 32px));
  padding: 12px;
  border: 1px solid var(--app-border);
  border-radius: 8px;
  background: var(--app-surface);
  box-shadow: 0 18px 40px rgb(0 0 0 / 0.24);
}

.command-palette input {
  height: 36px;
  padding: 0 10px;
  border: 1px solid var(--app-border);
  border-radius: 6px;
  background: var(--app-bg);
  color: var(--app-text);
}

.command-list {
  display: grid;
  gap: 4px;
}

.command-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  min-height: 34px;
  padding: 0 10px;
  border: 0;
  border-radius: 6px;
  background: transparent;
  color: var(--app-text);
  text-align: left;
  cursor: pointer;
}

.command-item:hover {
  background: var(--app-surface-muted);
}

.command-item:disabled {
  color: var(--app-text-muted);
  cursor: not-allowed;
}

.command-item small {
  color: var(--app-text-muted);
  font-size: 11px;
}
</style>
