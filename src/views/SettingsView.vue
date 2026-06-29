<script setup lang="ts">
import { computed, ref } from 'vue'
import { useRouter } from 'vue-router'
import type { SelectOption } from 'naive-ui'
import {
  commandRegistry,
  filterCommands,
  type AppCommand,
  type CommandShortcut,
} from '@/app/commandRegistry'
import { useSettingsStore } from '@/stores/settings'
import WorkbenchShell from '@/components/workbench/WorkbenchShell.vue'
import WorkbenchInspector from '@/components/workbench/WorkbenchInspector.vue'

const settings = useSettingsStore()
const router = useRouter()
const sharedSessionPathDraft = ref('')
const shortcutSearch = ref('')
const shortcutDrafts = ref<Record<string, string>>(
  Object.fromEntries(
    commandRegistry.map((command) => [
      command.id,
      shortcutToText(settings.getEffectiveShortcut(command)),
    ]),
  ),
)
const localeOptions: SelectOption[] = [
  { label: 'English', value: 'en-US' },
  { label: '简体中文', value: 'zh-CN' },
  { label: '繁體中文', value: 'zh-TW' },
  { label: 'Deutsch', value: 'de-DE' },
  { label: 'Français', value: 'fr-FR' },
  { label: 'Español', value: 'es-ES' },
  { label: '한국어', value: 'ko-KR' },
]
const filteredShortcutCommands = computed(() =>
  filterCommands(commandRegistry, shortcutSearch.value),
)

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

function saveShortcut(command: AppCommand): void {
  const keys = parseShortcutText(shortcutDrafts.value[command.id] ?? '')

  if (
    settings.setShortcutOverride(command.id, {
      keys,
      scope: command.defaultShortcut.scope,
    })
  ) {
    shortcutDrafts.value[command.id] = shortcutToText(settings.getEffectiveShortcut(command))
  }
}

function resetShortcut(command: AppCommand): void {
  settings.resetShortcutOverride(command.id)
  shortcutDrafts.value[command.id] = shortcutToText(command.defaultShortcut)
}

function shortcutToText(shortcut: CommandShortcut): string {
  return shortcut.keys.join('+')
}

function parseShortcutText(value: string): string[] {
  return value
    .split('+')
    .map((key) => key.trim())
    .filter(Boolean)
}
</script>

<template>
  <WorkbenchShell
    :title="$t('ui.settings')"
    eyebrow="Policy"
    :subtitle="$t('ui.manageMatchingRulesDefaultViewsAndRuleReferences')"
    inspector-label="Settings inspector"
  >
    <section class="settings-view">
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
        :title="$t('ui.shortcuts')"
        size="small"
      >
        <div class="shortcut-config">
          <div class="settings-row">
            <div>
              <strong>{{ $t('ui.keyboardShortcuts') }}</strong>
              <span>{{ $t('ui.searchModifyAndRestoreCommandShortcuts') }}</span>
            </div>
          </div>
          <NInput
            v-model:value="shortcutSearch"
            data-testid="shortcut-search"
            :placeholder="$t('ui.searchCommands')"
          />
          <div class="shortcut-list">
            <div
              v-for="command in filteredShortcutCommands"
              :key="command.id"
              class="shortcut-row"
            >
              <div class="shortcut-command">
                <strong>{{ $t(command.titleKey) }}</strong>
                <span>{{ command.id }}</span>
              </div>
              <span class="shortcut-default">{{ shortcutToText(command.defaultShortcut) }}</span>
              <span
                class="shortcut-current"
                :data-testid="`shortcut-current-${command.id}`"
                >{{ shortcutToText(settings.getEffectiveShortcut(command)) }}</span
              >
              <NInput
                v-model:value="shortcutDrafts[command.id]"
                class="shortcut-input"
                :data-testid="`shortcut-input-${command.id}`"
              />
              <NButton
                size="small"
                :data-testid="`save-shortcut-${command.id}`"
                @click="saveShortcut(command)"
                >{{ $t('ui.save') }}</NButton
              >
              <NButton
                size="small"
                :data-testid="`reset-shortcut-${command.id}`"
                @click="resetShortcut(command)"
                >{{ $t('ui.restoreDefault') }}</NButton
              >
            </div>
          </div>
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

    <template #inspector>
      <WorkbenchInspector>
        <section class="workbench-inspector-section">
          <h2>{{ $t('ui.shortcuts') }}</h2>
          <dl>
            <div>
              <dt>{{ $t('ui.theme') }}</dt>
              <dd>{{ settings.theme }}</dd>
            </div>
            <div>
              <dt>{{ $t('ui.language') }}</dt>
              <dd>{{ settings.locale }}</dd>
            </div>
            <div>
              <dt>{{ $t('ui.searchCommands') }}</dt>
              <dd>{{ filteredShortcutCommands.length }}</dd>
            </div>
            <div>
              <dt>{{ $t('ui.sharedSessions') }}</dt>
              <dd>{{ settings.sharedSessionPaths.length }}</dd>
            </div>
          </dl>
        </section>
      </WorkbenchInspector>
    </template>
  </WorkbenchShell>
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

.shortcut-config {
  display: grid;
  gap: 12px;
}

.shortcut-list {
  display: grid;
  gap: 8px;
}

.shortcut-row {
  display: grid;
  grid-template-columns:
    minmax(160px, 1.3fr) minmax(90px, 0.7fr) minmax(90px, 0.7fr) minmax(140px, 1fr)
    auto auto;
  align-items: center;
  gap: 10px;
  padding: 10px;
  border: 1px solid var(--app-border);
  border-radius: 6px;
}

.shortcut-command {
  display: grid;
  gap: 4px;
  min-width: 0;
}

.shortcut-command span,
.shortcut-default,
.shortcut-current {
  overflow: hidden;
  color: var(--app-text-muted);
  font-family:
    ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New',
    monospace;
  font-size: 12px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.shortcut-input {
  min-width: 0;
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
