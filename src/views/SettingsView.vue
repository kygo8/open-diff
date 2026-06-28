<script setup lang="ts">
import { useRouter } from 'vue-router'
import { useSettingsStore } from '@/stores/settings'

const settings = useSettingsStore()
const router = useRouter()

function openFileFormats(): void {
  void router.push('/settings/file-formats')
}

function openRemoteProfiles(): void {
  void router.push('/settings/remote-profiles')
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
</style>
