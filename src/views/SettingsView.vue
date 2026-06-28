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
    <h1>{{ $t('ui.settings') }}</h1>
    <NCard
      :title="$t('ui.appearance')"
      size="small"
    >
      <NSpace align="center">
        <span>{{ $t('ui.theme') }}</span>
        <NRadioGroup v-model:value="settings.theme">
          <NRadioButton value="dark">{{ $t('ui.dark') }}</NRadioButton>
          <NRadioButton value="light">{{ $t('ui.light') }}</NRadioButton>
        </NRadioGroup>
      </NSpace>
      <NSpace align="center">
        <span>{{ $t('ui.language') }}</span>
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
      :title="$t('ui.fileFormats')"
      size="small"
    >
      <div class="settings-row">
        <div>
          <strong>{{ $t('ui.formatDefinitions') }}</strong>
          <span>{{ $t('ui.manageMatchingRulesDefaultViewsAndRuleReferences') }}</span>
        </div>
        <NButton
          size="small"
          data-testid="open-file-formats"
          @click="openFileFormats"
          >{{ $t('ui.manage') }}</NButton
        >
      </div>
    </NCard>

    <NCard
      :title="$t('ui.remoteProfiles')"
      size="small"
    >
      <div class="settings-row">
        <div>
          <strong>{{ $t('ui.connectionProfiles') }}</strong>
          <span>{{ $t('ui.manageRemoteEndpointsAndCredentialReferences') }}</span>
        </div>
        <NButton
          size="small"
          data-testid="open-remote-profiles"
          @click="openRemoteProfiles"
          >{{ $t('ui.manage') }}</NButton
        >
      </div>
    </NCard>

    <NCard
      :title="$t('ui.sharedSessions')"
      size="small"
    >
      <div class="shared-session-config">
        <div class="settings-row">
          <div>
            <strong>{{ $t('ui.sessionFilePaths') }}</strong>
            <span>{{ $t('ui.loadTeamSessionsAsReadOnlyEntries') }}</span>
          </div>
        </div>
        <div class="shared-session-input">
          <NInput
            v-model:value="sharedSessionPathDraft"
            data-testid="shared-session-path-input"
            :placeholder="$t('ui.sharedSessionPathPlaceholder')"
          />
          <NButton
            size="small"
            data-testid="add-shared-session-path"
            @click="addSharedSessionPath"
            >{{ $t('ui.add') }}</NButton
          >
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
              >{{ $t('ui.remove') }}</NButton
            >
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
