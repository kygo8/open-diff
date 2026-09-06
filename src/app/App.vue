<script setup lang="ts">
import { computed, onMounted } from 'vue'
import { darkTheme, lightTheme, type GlobalThemeOverrides } from 'naive-ui'
import AppLayout from '@/layouts/AppLayout.vue'
import { usePolicyStore } from '@/stores/policy'
import { fontFamilyOptions, useSettingsStore } from '@/stores/settings'

const settings = useSettingsStore()
const policy = usePolicyStore()

const naiveTheme = computed(() => (settings.resolvedTheme === 'dark' ? darkTheme : lightTheme))

onMounted(() => {
  void policy.load()
})

const themeOverrides = computed<GlobalThemeOverrides>(() => ({
  common: {
    borderColor: '#c2c6d6',
    borderRadius: '4px',
    borderRadiusSmall: '4px',
    fontFamily: fontFamilyOptions[settings.fontFamily],
    fontFamilyMono: '"JetBrains Mono", "Cascadia Mono", Consolas, monospace',
    fontSize: `${String(Math.max(12, Math.min(16, settings.fontSize - 5)))}px`,
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
}))
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
