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
import { parseSessionPackage } from '@/app/sessionFile'
import {
  registerUnixShellIntegration,
  registerWindowsShellExtension,
  unregisterUnixShellIntegration,
  unregisterWindowsShellExtension,
  writeGitIntegration,
  writeSvnIntegration,
} from '@/api/integration'
import { usePolicyStore } from '@/stores/policy'
import { useSavedSessionsStore } from '@/stores/savedSessions'
import { type DiffHighlightColors, useSettingsStore } from '@/stores/settings'
import WorkbenchShell from '@/components/workbench/WorkbenchShell.vue'
import WorkbenchInspector from '@/components/workbench/WorkbenchInspector.vue'
import { useI18n } from '@/i18n'

const settings = useSettingsStore()
const policy = usePolicyStore()
const savedSessions = useSavedSessionsStore()
const router = useRouter()
const { t } = useI18n()
const sharedSessionPathDraft = ref('')
const sharedSessionJsonDraft = ref('')
const sharedSessionImportError = ref('')
const gitKind = ref<'difftool' | 'mergetool'>('mergetool')
const gitScope = ref<'global' | 'local'>('global')
const executablePath = ref('open-diff')
const svnWrapperPath = ref('')
const integrationStatus = ref('')
const integrationError = ref('')
const integrationWriting = ref(false)
const shortcutSearch = ref('')
const optionsSection = ref<
  'appearance' | 'colors' | 'tweaks' | 'formats' | 'shortcuts' | 'integration' | 'sessions'
>('appearance')
const optionsSections = [
  { id: 'appearance' as const, labelKey: 'ui.appearance' },
  { id: 'colors' as const, labelKey: 'ui.colors' },
  { id: 'tweaks' as const, labelKey: 'ui.tweaks' },
  { id: 'formats' as const, labelKey: 'ui.fileFormats' },
  { id: 'shortcuts' as const, labelKey: 'ui.shortcuts' },
  { id: 'integration' as const, labelKey: 'ui.integration' },
  { id: 'sessions' as const, labelKey: 'ui.sessions' },
]
const fontFamilySelectOptions: SelectOption[] = [
  { label: 'System UI', value: 'system' },
  { label: 'Segoe UI', value: 'segoe' },
  { label: 'Inter', value: 'inter' },
  { label: 'Noto Sans', value: 'noto' },
  { label: 'Monospace', value: 'mono' },
]
const diffColorFields: { key: keyof DiffHighlightColors; labelKey: string }[] = [
  { key: 'addedBg', labelKey: 'ui.addedBackground' },
  { key: 'addedFg', labelKey: 'ui.addedForeground' },
  { key: 'deletedBg', labelKey: 'ui.deletedBackground' },
  { key: 'deletedFg', labelKey: 'ui.deletedForeground' },
  { key: 'modifiedBg', labelKey: 'ui.modifiedBackground' },
  { key: 'modifiedFg', labelKey: 'ui.modifiedForeground' },
]
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
  { label: '日本語', value: 'ja-JP' },
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

async function writeGitConfig(): Promise<void> {
  // eslint-disable-next-line no-alert -- existing Git write confirmation
  if (!window.confirm(t('ui.confirmWriteGitConfig', { kind: gitKind.value }))) {
    return
  }

  integrationWriting.value = true
  integrationError.value = ''

  try {
    await writeGitIntegration(
      gitKind.value,
      executablePath.value.trim() || 'open-diff',
      gitScope.value,
    )
    integrationStatus.value = t('status.gitConfigWritten', { kind: gitKind.value })
  } catch (error) {
    integrationError.value = error instanceof Error ? error.message : String(error)
  } finally {
    integrationWriting.value = false
  }
}

async function writeSvnConfig(): Promise<void> {
  // eslint-disable-next-line no-alert -- existing SVN write confirmation
  if (!window.confirm(t('ui.confirmWriteSvnConfig'))) {
    return
  }

  integrationWriting.value = true
  integrationError.value = ''

  try {
    const wrapper =
      svnWrapperPath.value.trim() || `${executablePath.value.trim() || 'open-diff'}-svn.sh`

    await writeSvnIntegration(executablePath.value.trim() || 'open-diff', wrapper)
    integrationStatus.value = t('status.svnConfigWritten')
  } catch (error) {
    integrationError.value = error instanceof Error ? error.message : String(error)
  } finally {
    integrationWriting.value = false
  }
}

function addSharedSessionPath(): void {
  if (settings.addSharedSessionPath(sharedSessionPathDraft.value)) {
    sharedSessionPathDraft.value = ''
  }
}

function loadSharedSessionJson(): void {
  sharedSessionImportError.value = ''

  try {
    const parsed = parseSessionPackage(sharedSessionJsonDraft.value)

    for (const session of parsed.sessions) {
      savedSessions.loadSharedSession(session)
    }

    sharedSessionJsonDraft.value = ''
  } catch (error) {
    sharedSessionImportError.value = error instanceof Error ? error.message : String(error)
  }
}

function updateLocale(value: string): void {
  settings.setLocale(value)
}

function updateFontFamily(value: string): void {
  settings.setFontFamily(value)
}

function onFontSizeInput(event: Event): void {
  const target = event.target

  if (!(target instanceof HTMLInputElement)) {
    return
  }

  settings.setFontSize(Number(target.value))
}

function onDiffColorInput(key: keyof DiffHighlightColors, event: Event): void {
  const target = event.target

  if (!(target instanceof HTMLInputElement)) {
    return
  }

  settings.setDiffColor(key, target.value)
}

function colorInputValue(value: string): string {
  if (/^#[0-9a-fA-F]{6}$/.test(value)) {
    return value
  }

  if (/^#[0-9a-fA-F]{3}$/.test(value)) {
    const [, a, b, c] = value

    return `#${a}${a}${b}${b}${c}${c}`
  }

  return '#000000'
}

function onConfirmBeforeDeleteChange(event: Event): void {
  const target = event.target

  if (!(target instanceof HTMLInputElement)) {
    return
  }

  settings.setConfirmBeforeDelete(target.checked)
}

function onWrapTextDefaultChange(event: Event): void {
  const target = event.target

  if (!(target instanceof HTMLInputElement)) {
    return
  }

  settings.setWrapTextDefault(target.checked)
}

async function registerShellExtension(): Promise<void> {
  integrationWriting.value = true
  integrationError.value = ''

  try {
    const result = await registerWindowsShellExtension(executablePath.value.trim() || undefined)

    integrationStatus.value = result.applied
      ? t('status.shellRegistered')
      : t('status.shellScriptGenerated')
  } catch (error) {
    integrationError.value = error instanceof Error ? error.message : String(error)
  } finally {
    integrationWriting.value = false
  }
}

async function unregisterShellExtension(): Promise<void> {
  integrationWriting.value = true
  integrationError.value = ''

  try {
    const result = await unregisterWindowsShellExtension(executablePath.value.trim() || undefined)

    integrationStatus.value = result.applied
      ? t('status.shellUnregistered')
      : t('status.shellUnregisterScriptGenerated')
  } catch (error) {
    integrationError.value = error instanceof Error ? error.message : String(error)
  } finally {
    integrationWriting.value = false
  }
}

async function registerUnixShell(): Promise<void> {
  integrationWriting.value = true
  integrationError.value = ''

  try {
    const result = await registerUnixShellIntegration(executablePath.value.trim() || undefined)

    integrationStatus.value = result.applied
      ? t('status.unixShellRegistered')
      : t('status.unixShellScriptGenerated')
  } catch (error) {
    integrationError.value = error instanceof Error ? error.message : String(error)
  } finally {
    integrationWriting.value = false
  }
}

async function unregisterUnixShell(): Promise<void> {
  integrationWriting.value = true
  integrationError.value = ''

  try {
    const result = await unregisterUnixShellIntegration(executablePath.value.trim() || undefined)

    integrationStatus.value = result.applied
      ? t('status.unixShellUnregistered')
      : t('status.unixShellScriptGenerated')
  } catch (error) {
    integrationError.value = error instanceof Error ? error.message : String(error)
  } finally {
    integrationWriting.value = false
  }
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

function onAutoSaveLimitInput(event: Event): void {
  const target = event.target

  if (!(target instanceof HTMLInputElement)) {
    return
  }

  settings.setAutoSaveLimit(Number(target.value))
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
    :eyebrow="$t('ui.policy')"
    :subtitle="$t('ui.manageMatchingRulesDefaultViewsAndRuleReferences')"
    :inspector-label="$t('ui.settingsInspector')"
  >
    <section class="settings-view">
      <nav
        class="options-section-nav"
        data-testid="options-section-nav"
        :aria-label="$t('ui.options')"
      >
        <button
          v-for="section in optionsSections"
          :key="section.id"
          type="button"
          class="options-section-button"
          :class="{ active: optionsSection === section.id }"
          :data-testid="`options-section-${section.id}`"
          @click="optionsSection = section.id"
        >
          {{ $t(section.labelKey) }}
        </button>
      </nav>

      <NCard
        v-show="optionsSection === 'appearance'"
        :title="$t('ui.appearance')"
        size="small"
        data-testid="options-appearance-card"
      >
        <NSpace align="center">
          <span>{{ $t('ui.theme') }}</span>
          <NRadioGroup v-model:value="settings.theme">
            <NRadioButton value="dark">{{ $t('ui.dark') }}</NRadioButton>
            <NRadioButton value="light">{{ $t('ui.light') }}</NRadioButton>
            <NRadioButton
              data-testid="theme-follow-system"
              value="system"
              >{{ $t('ui.followSystem') }}</NRadioButton
            >
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
        <label class="auto-save-limit-row">
          <span>{{ $t('ui.autoSaveLimit') }}</span>
          <input
            class="auto-save-limit-input"
            data-testid="auto-save-limit"
            type="number"
            min="0"
            max="50"
            :value="settings.autoSaveLimit"
            @input="onAutoSaveLimitInput"
          />
        </label>
        <NSpace align="center">
          <span>{{ $t('ui.fontFamily') }}</span>
          <NSelect
            :value="settings.fontFamily"
            class="font-family-select"
            data-testid="font-family-select"
            :options="fontFamilySelectOptions"
            @update:value="updateFontFamily"
          />
        </NSpace>
        <label class="font-size-row">
          <span>{{ $t('ui.fontSize') }}</span>
          <input
            class="font-size-input"
            data-testid="font-size-input"
            type="number"
            min="12"
            max="24"
            :value="settings.fontSize"
            @input="onFontSizeInput"
          />
        </label>
      </NCard>

      <NCard
        v-show="optionsSection === 'colors'"
        :title="$t('ui.diffHighlightColors')"
        size="small"
        data-testid="options-colors-card"
      >
        <div class="diff-color-grid">
          <label
            v-for="field in diffColorFields"
            :key="field.key"
            class="diff-color-row"
          >
            <span>{{ $t(field.labelKey) }}</span>
            <input
              class="diff-color-picker"
              type="color"
              :data-testid="`diff-color-${field.key}`"
              :value="colorInputValue(settings.diffColors[field.key])"
              @input="onDiffColorInput(field.key, $event)"
            />
            <input
              class="diff-color-text"
              type="text"
              :data-testid="`diff-color-text-${field.key}`"
              :value="settings.diffColors[field.key]"
              @change="onDiffColorInput(field.key, $event)"
            />
          </label>
        </div>
        <div
          class="diff-color-preview"
          data-testid="diff-color-preview"
        >
          <span class="preview-swatch added">{{ $t('ui.added') }}</span>
          <span class="preview-swatch deleted">{{ $t('ui.removed') }}</span>
          <span class="preview-swatch modified">{{ $t('ui.modified') }}</span>
        </div>
        <NButton
          size="small"
          data-testid="reset-diff-colors"
          @click="settings.resetDiffColors()"
          >{{ $t('ui.resetColors') }}</NButton
        >
      </NCard>

      <NCard
        v-show="optionsSection === 'tweaks'"
        :title="$t('ui.tweaks')"
        size="small"
        data-testid="options-tweaks-card"
      >
        <label class="tweak-row">
          <input
            data-testid="confirm-before-delete"
            type="checkbox"
            :checked="settings.confirmBeforeDelete"
            @change="onConfirmBeforeDeleteChange"
          />
          <span>{{ $t('ui.confirmBeforeDelete') }}</span>
        </label>
        <label class="tweak-row">
          <input
            data-testid="wrap-text-default"
            type="checkbox"
            :checked="settings.wrapTextDefault"
            @change="onWrapTextDefaultChange"
          />
          <span>{{ $t('ui.wrapTextDefault') }}</span>
        </label>
      </NCard>

      <NCard
        v-show="optionsSection === 'formats'"
        :title="$t('ui.fileFormats')"
        size="small"
        data-testid="options-formats-card"
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
        v-if="policy.remoteProfiles && optionsSection === 'formats'"
        :title="$t('ui.remoteProfiles')"
        size="small"
        data-testid="options-remote-card"
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
        v-show="optionsSection === 'shortcuts'"
        :title="$t('ui.shortcuts')"
        size="small"
        data-testid="options-shortcuts-card"
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
        v-show="optionsSection === 'integration'"
        :title="$t('ui.gitIntegration')"
        size="small"
        data-testid="options-integration-card"
      >
        <div class="integration-config">
          <p>{{ $t('ui.gitIntegration') }}</p>
          <div class="settings-row">
            <label>
              <span>{{ $t('ui.executablePath') }}</span>
              <input
                v-model="executablePath"
                type="text"
                data-testid="integration-executable-path"
              />
            </label>
            <label>
              <span>{{ $t('ui.gitScope') }}</span>
              <select
                v-model="gitScope"
                data-testid="git-scope"
              >
                <option value="global">{{ $t('ui.globalScope') }}</option>
                <option value="local">{{ $t('ui.localScope') }}</option>
              </select>
            </label>
            <label>
              <span>{{ $t('ui.gitIntegration') }}</span>
              <select
                v-model="gitKind"
                data-testid="git-kind"
              >
                <option value="difftool">{{ $t('ui.difftool') }}</option>
                <option value="mergetool">{{ $t('ui.mergetool') }}</option>
              </select>
            </label>
          </div>
          <div class="settings-row">
            <NButton
              size="small"
              data-testid="write-git-config"
              :disabled="integrationWriting"
              @click="writeGitConfig"
              >{{ $t('ui.writeGitConfig') }}</NButton
            >
          </div>
          <div class="settings-row">
            <label>
              <span>{{ $t('ui.wrapperPath') }}</span>
              <input
                v-model="svnWrapperPath"
                type="text"
                data-testid="svn-wrapper-path"
              />
            </label>
            <NButton
              size="small"
              data-testid="write-svn-config"
              :disabled="integrationWriting"
              @click="writeSvnConfig"
              >{{ $t('ui.writeSvnConfig') }}</NButton
            >
          </div>
          <p
            v-if="integrationStatus"
            data-testid="integration-status"
          >
            {{ integrationStatus }}
          </p>
          <p
            v-if="integrationError"
            data-testid="integration-error"
          >
            {{ integrationError }}
          </p>
          <div class="settings-row shell-extension-row">
            <div>
              <strong>{{ $t('ui.windowsShell') }}</strong>
              <span>{{ $t('ui.shellExtensionHint') }}</span>
              <span>{{ $t('ui.shellExtensionFlowHint') }}</span>
            </div>
            <NSpace>
              <NButton
                size="small"
                type="primary"
                data-testid="register-shell-extension"
                :disabled="!policy.isWindows || integrationWriting"
                @click="registerShellExtension"
                >{{ $t('ui.installExplorerContextMenu') }}</NButton
              >
              <NButton
                size="small"
                data-testid="unregister-shell-extension"
                :disabled="!policy.isWindows || integrationWriting"
                @click="unregisterShellExtension"
                >{{ $t('ui.removeExplorerContextMenu') }}</NButton
              >
            </NSpace>
          </div>
          <div class="settings-row shell-extension-row">
            <div>
              <strong>{{ $t('ui.unixShell') }}</strong>
              <span>{{ $t('ui.unixShellHint') }}</span>
              <span>{{ $t('ui.unixShellCliHint') }}</span>
            </div>
            <NSpace>
              <NButton
                size="small"
                type="primary"
                data-testid="register-unix-shell-integration"
                :disabled="!policy.supportsUnixShell || integrationWriting"
                @click="registerUnixShell"
                >{{ $t('ui.installUnixShellIntegration') }}</NButton
              >
              <NButton
                size="small"
                data-testid="unregister-unix-shell-integration"
                :disabled="!policy.supportsUnixShell || integrationWriting"
                @click="unregisterUnixShell"
                >{{ $t('ui.removeUnixShellIntegration') }}</NButton
              >
            </NSpace>
          </div>
        </div>
      </NCard>

      <NCard
        v-show="optionsSection === 'sessions'"
        :title="$t('ui.sharedSessions')"
        size="small"
        data-testid="options-sessions-card"
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
          <div class="shared-session-import">
            <NInput
              v-model:value="sharedSessionJsonDraft"
              type="textarea"
              data-testid="shared-session-json-input"
              :placeholder="$t('ui.importJson')"
            />
            <NButton
              size="small"
              data-testid="load-shared-session-json"
              @click="loadSharedSessionJson"
              >{{ $t('ui.import') }}</NButton
            >
          </div>
          <p
            v-if="sharedSessionImportError"
            class="shared-session-error"
            data-testid="shared-session-import-error"
          >
            {{ sharedSessionImportError }}
          </p>
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
              <dt>{{ $t('ui.fontFamily') }}</dt>
              <dd>{{ settings.fontFamily }}</dd>
            </div>
            <div>
              <dt>{{ $t('ui.fontSize') }}</dt>
              <dd>{{ settings.fontSize }}</dd>
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

.options-section-nav {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.options-section-button {
  min-height: 32px;
  padding: 0 12px;
  border: 1px solid var(--app-border);
  border-radius: 6px;
  background: var(--app-surface);
  color: var(--app-text);
  font: inherit;
  cursor: pointer;
}

.options-section-button.active {
  border-color: #2563eb;
  background: rgb(37 99 235 / 0.12);
}

.auto-save-limit-input,
.font-size-input {
  width: 120px;
}

.font-family-select {
  width: 180px;
}

.auto-save-limit-row,
.font-size-row,
.tweak-row {
  display: flex;
  align-items: center;
  gap: 10px;
}

.diff-color-grid {
  display: grid;
  gap: 10px;
  margin-bottom: 12px;
}

.diff-color-row {
  display: grid;
  grid-template-columns: minmax(140px, 1fr) 44px minmax(120px, 0.8fr);
  align-items: center;
  gap: 10px;
}

.diff-color-picker {
  width: 44px;
  height: 32px;
  padding: 0;
  border: 1px solid var(--app-border);
  border-radius: 6px;
  background: transparent;
  cursor: pointer;
}

.diff-color-text {
  min-width: 0;
  height: 32px;
  padding: 0 8px;
  border: 1px solid var(--app-border);
  border-radius: 6px;
  background: var(--app-bg);
  color: var(--app-text);
  font-family: var(--font-mono);
  font-size: 12px;
}

.diff-color-preview {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-bottom: 12px;
}

.preview-swatch {
  display: inline-flex;
  align-items: center;
  min-height: 28px;
  padding: 0 10px;
  border-radius: 6px;
  font-size: 12px;
  font-weight: 600;
}

.preview-swatch.added {
  background: var(--diff-added-bg);
  color: var(--diff-added-fg);
}

.preview-swatch.deleted {
  background: var(--diff-deleted-bg);
  color: var(--diff-deleted-fg);
}

.preview-swatch.modified {
  background: var(--diff-modified-bg);
  color: var(--diff-modified-fg);
}

h1 {
  margin-top: 0;
}

.integration-config {
  display: grid;
  gap: 12px;
}

.integration-config label {
  display: grid;
  gap: 4px;
  min-width: 0;
}

.integration-config span {
  color: var(--app-text-muted);
  font-size: 12px;
}

.integration-config input,
.integration-config select {
  min-width: 180px;
  height: 32px;
  padding: 0 8px;
  border: 1px solid var(--app-border);
  border-radius: 6px;
  background: var(--app-bg);
  color: var(--app-text);
}

.settings-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  min-width: 0;
}

.settings-row div {
  display: grid;
  gap: 4px;
  min-width: 0;
}

.settings-row strong {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.settings-row span {
  min-width: 0;
  color: var(--app-text-muted);
  font-size: 12px;
  overflow-wrap: anywhere;
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

.shared-session-import {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  align-items: end;
  gap: 10px;
}

.shared-session-error {
  margin: 0;
  color: var(--diff-deleted-fg);
  font-size: 12px;
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
