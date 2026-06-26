<script setup lang="ts">
import { useRouter, RouterView } from 'vue-router'
import { FileText, FolderTree, Settings, SunMoon } from '@lucide/vue'
import { useSettingsStore } from '@/stores/settings'
import { useTabsStore } from '@/stores/tabs'
import type { AppTab } from '@/stores/tabs'

const router = useRouter()
const settings = useSettingsStore()
const tabs = useTabsStore()

function navigate(route: string, title: string): void {
  tabs.openTab({ route, title, dirty: false })
  void router.push(route)
}

function activateTab(tab: AppTab): void {
  tabs.activeTabId = tab.id
  void router.push(tab.route)
}
</script>

<template>
  <div class="app-shell">
    <header class="top-bar">
      <button
        class="brand"
        @click="navigate('/', 'Home')"
      >
        Open Diff
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
          disabled
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
      <span>Ready</span>
      <span>Local-first comparison workspace</span>
    </footer>
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
</style>
