<script setup lang="ts">
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import type { SelectOption } from 'naive-ui'
import { useSettingsStore } from '@/stores/settings'

const settings = useSettingsStore()
const router = useRouter()
const sharedSessionPathDraft = ref('')
const localeOptions: SelectOption[] = [
  { label: 'English', value: 'en-US' },
  { label: '简体中文', value: 'zh-CN' },
  { label: '繁體中文', value: 'zh-TW' },
  { label: 'Deutsch', value: 'de-DE' },
  { label: 'Français', value: 'fr-FR' },
  { label: 'Español', value: 'es-ES' },
  { label: '한국어', value: 'ko-KR' },
]

function openFileFormats(): void {
  void router.push('/settings/file-formats')
}

function openRemoteProfiles(): void {
  void router.push('/settings/remote-profiles')
}

function addSharedSessionPath(): void {
  if (settings.addSharedSessionPath(sharedSessionPathDraft.value)) {
    sharedSessionPathDraft.value = ''
  }
}

function updateLocale(value: string): void {
  settings.setLocale(value)
}
</script>

<template>
  <section class="settings-view">
    <h1>Settings</h1>
    <NCard
      title="Appearance"
      size="small"
    >
      <NSpace align="center">
        <span>Theme</span>
        <NRadioGroup v-model:value="settings.theme">
          <NRadioButton value="dark">Dark</NRadioButton>
          <NRadioButton value="light">Light</NRadioButton>
        </NRadioGroup>
      </NSpace>
      <NSpace align="center">
        <span>Language</span>
        <NSelect
          :value="settings.locale"
          class="locale-select"
          data-testid="locale-select"
          :options="localeOptions"
          @update:value="updateLocale"
        />
      </NSpace>
    </NCard>

    <NCard
      title="File Formats"
      size="small"
    >
      <div class="settings-row">
        <div>
          <strong>Format definitions</strong>
          <span>Manage matching rules, default views, and rule references.</span>
        </div>
        <NButton
          size="small"
          data-testid="open-file-formats"
          @click="openFileFormats"
        >
          Manage
        </NButton>
      </div>
    </NCard>

    <NCard
      title="Remote Profiles"
      size="small"
    >
      <div class="settings-row">
        <div>
          <strong>Connection profiles</strong>
          <span>Manage remote endpoints and credential references.</span>
        </div>
        <NButton
          size="small"
          data-testid="open-remote-profiles"
          @click="openRemoteProfiles"
        >
          Manage
        </NButton>
      </div>
    </NCard>

    <NCard
      title="Shared Sessions"
      size="small"
    >
      <div class="shared-session-config">
        <div class="settings-row">
          <div>
            <strong>Session file paths</strong>
            <span>Load team sessions as read-only entries.</span>
          </div>
        </div>
        <div class="shared-session-input">
          <NInput
            v-model:value="sharedSessionPathDraft"
            data-testid="shared-session-path-input"
            placeholder="C:/team/shared.open-diff-session.json"
          />
          <NButton
            size="small"
            data-testid="add-shared-session-path"
            @click="addSharedSessionPath"
          >
            Add
          </NButton>
        </div>
        <ul class="shared-session-list">
          <li
            v-for="path in settings.sharedSessionPaths"
            :key="path"
          >
            <span>{{ path }}</span>
            <NButton
              text
              size="small"
              @click="settings.removeSharedSessionPath(path)"
            >
              Remove
            </NButton>
          </li>
        </ul>
      </div>
    </NCard>
  </section>
</template>

<style scoped>
.settings-view {
  display: grid;
  align-content: start;
  gap: 14px;
  height: 100%;
  padding: 24px;
  overflow: auto;
}

h1 {
  margin-top: 0;
}

.settings-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
}

.settings-row div {
  display: grid;
  gap: 4px;
}

.settings-row span {
  color: var(--app-text-muted);
  font-size: 12px;
}

.locale-select {
  width: 180px;
}

.shared-session-config {
  display: grid;
  gap: 12px;
}

.shared-session-input {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  gap: 10px;
}

.shared-session-list {
  display: grid;
  gap: 8px;
  margin: 0;
  padding: 0;
  list-style: none;
}

.shared-session-list li {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  align-items: center;
  gap: 10px;
  padding: 8px 10px;
  border: 1px solid var(--app-border);
  border-radius: 6px;
}

.shared-session-list span {
  overflow: hidden;
  color: var(--app-text-muted);
  font-family:
    ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New',
    monospace;
  font-size: 12px;
  text-overflow: ellipsis;
  white-space: nowrap;
}
</style>
