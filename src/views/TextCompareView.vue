<script setup lang="ts">
import { computed, ref } from 'vue'
import { diffText } from '@/api/diff'
import type { TextDiffResponse } from '@/types/diff'
import TextDiffPanel from '@/components/diff/TextDiffPanel.vue'

const left = ref('line one\nline two\nline four')
const right = ref('line one\nline 2\nline three\nline four')
const result = ref<TextDiffResponse | null>(null)
const loading = ref(false)
const error = ref('')

const statsLabel = computed(() => {
  if (!result.value) return 'No comparison yet'
  const { added, deleted, modified, equal } = result.value.stats

  return `${String(equal)} equal, ${String(modified)} modified, ${String(added)} added, ${String(
    deleted,
  )} deleted`
})

async function runDiff(): Promise<void> {
  loading.value = true
  error.value = ''
  try {
    result.value = await diffText({ left: left.value, right: right.value })
  } catch (event) {
    error.value = String(event)
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <section class="text-compare-view">
    <div class="compare-toolbar">
      <strong>Text Compare</strong>
      <span class="stats">{{ statsLabel }}</span>
      <div class="spacer" />
      <NButton
        size="small"
        type="primary"
        :loading="loading"
        @click="runDiff"
        >Run Diff</NButton
      >
    </div>

    <div class="input-row">
      <NInput
        v-model:value="left"
        type="textarea"
        placeholder="Left content"
      />
      <NInput
        v-model:value="right"
        type="textarea"
        placeholder="Right content"
      />
    </div>

    <NAlert
      v-if="error"
      type="error"
      :bordered="false"
      >{{ error }}</NAlert
    >

    <TextDiffPanel
      v-if="result"
      :lines="result.lines"
    />
    <div
      v-else
      class="empty"
    >
      Run the sample comparison to render the custom diff view.
    </div>
  </section>
</template>

<style scoped>
.text-compare-view {
  display: flex;
  flex-direction: column;
  gap: 10px;
  height: 100%;
  padding: 10px;
}

.compare-toolbar {
  display: flex;
  align-items: center;
  gap: 12px;
  min-height: 34px;
}

.stats {
  color: var(--app-text-muted);
  font-size: 12px;
}

.spacer {
  flex: 1;
}

.input-row {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 10px;
  min-height: 120px;
}

.empty {
  display: grid;
  flex: 1;
  border: 1px dashed var(--app-border);
  border-radius: 8px;
  color: var(--app-text-muted);
  place-items: center;
}
</style>
