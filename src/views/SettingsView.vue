<script setup lang="ts">
import { useSettingsStore } from '@/stores/settings'

const settings = useSettingsStore()
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
  </section>
</template>

<style scoped>
.settings-view {
  height: 100%;
  padding: 24px;
  overflow: auto;
}

h1 {
  margin-top: 0;
}
</style>
