<script setup lang="ts">
import type { FileOperationConfirmation } from '@/app/fileOperationConfirmation'
import { useI18n } from '@/i18n'

const props = defineProps<{
  confirmation: FileOperationConfirmation
}>()

defineEmits<{
  confirm: []
  cancel: []
}>()
const { t } = useI18n()

function confirmationTitle(): string {
  return t(props.confirmation.titleKey, props.confirmation.titleParams)
}
</script>

<template>
  <section
    class="file-operation-confirm"
    role="dialog"
    aria-modal="true"
    :aria-label="confirmationTitle()"
  >
    <header class="confirm-header">
      <div>
        <p class="risk-label">{{ $t(confirmation.riskKey) }}</p>
        <h2>{{ confirmationTitle() }}</h2>
      </div>
    </header>

    <p class="confirm-message">{{ $t(confirmation.messageKey) }}</p>

    <ul class="path-list">
      <li
        v-for="path in confirmation.paths"
        :key="path"
      >
        {{ path }}
      </li>
    </ul>

    <footer class="confirm-actions">
      <button
        type="button"
        class="secondary-action"
        data-testid="cancel-file-operation"
        @click="$emit('cancel')"
      >
        {{ $t('ui.cancel') }}
      </button>
      <button
        type="button"
        class="primary-action"
        data-testid="confirm-file-operation"
        @click="$emit('confirm')"
      >
        {{ $t(confirmation.confirmLabelKey) }}
      </button>
    </footer>
  </section>
</template>
<style scoped>
.file-operation-confirm {
  display: grid;
  gap: 12px;
  width: min(520px, 100%);
  padding: 16px;
  border: 1px solid var(--app-border);
  border-radius: 8px;
  background: var(--app-surface);
  box-shadow: 0 18px 44px rgb(15 23 42 / 0.18);
}

.confirm-header {
  display: flex;
  align-items: start;
  justify-content: space-between;
  gap: 12px;
}

.risk-label {
  margin: 0 0 4px;
  color: var(--diff-deleted-fg);
  font-size: 12px;
  font-weight: 700;
  letter-spacing: 0;
  text-transform: uppercase;
}

h2 {
  margin: 0;
  font-size: 18px;
  line-height: 1.25;
}

.confirm-message {
  margin: 0;
  color: var(--app-text-muted);
  font-size: 13px;
  line-height: 1.45;
}

.path-list {
  display: grid;
  gap: 6px;
  max-height: 180px;
  margin: 0;
  padding: 10px;
  overflow: auto;
  border: 1px solid var(--app-border);
  border-radius: 6px;
  background: var(--app-bg);
  font-family: var(--app-font-mono);
  font-size: 12px;
  list-style: none;
}

.path-list li {
  overflow-wrap: anywhere;
}

.confirm-actions {
  display: flex;
  justify-content: end;
  gap: 8px;
}

.primary-action,
.secondary-action {
  height: 30px;
  padding: 0 12px;
  border: 1px solid var(--app-border);
  border-radius: 6px;
  color: var(--app-text);
  cursor: pointer;
}

.primary-action {
  border-color: var(--diff-deleted-fg);
  background: var(--diff-deleted-bg);
}

.secondary-action {
  background: var(--app-surface);
}
</style>
