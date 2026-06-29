<script setup lang="ts">
import { computed } from 'vue'
import { darkTheme, lightTheme, type GlobalThemeOverrides } from 'naive-ui'
import AppLayout from '@/layouts/AppLayout.vue'
import { useSettingsStore } from '@/stores/settings'

const settings = useSettingsStore()

const naiveTheme = computed(() => (settings.theme === 'dark' ? darkTheme : lightTheme))

const themeOverrides: GlobalThemeOverrides = {
  common: {
    borderColor: '#c2c6d6',
    borderRadius: '4px',
    borderRadiusSmall: '4px',
    fontFamily:
      'Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", "PingFang SC", "Microsoft YaHei", sans-serif',
    fontFamilyMono: '"JetBrains Mono", "Cascadia Mono", Consolas, monospace',
    fontSize: '13px',
    primaryColor: '#0058be',
    primaryColorHover: '#2170e4',
    primaryColorPressed: '#004395',
    textColorBase: '#191c1e',
  },
  Button: {
    heightSmall: '26px',
    paddingSmall: '0 9px',
  },
  Card: {
    borderRadius: '4px',
  },
  Input: {
    borderRadius: '4px',
    heightSmall: '28px',
  },
}
</script>

<template>
  <NConfigProvider
    :theme="naiveTheme"
    :theme-overrides="themeOverrides"
  >
    <NMessageProvider>
      <NDialogProvider>
        <NNotificationProvider>
          <AppLayout />
        </NNotificationProvider>
      </NDialogProvider>
    </NMessageProvider>
  </NConfigProvider>
</template>
