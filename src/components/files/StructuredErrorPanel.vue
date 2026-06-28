<script setup lang="ts">
import type { StructuredFileOperationError } from '@/app/structuredError'

defineProps<{
  error: StructuredFileOperationError
}>()
</script>

<template>
  <section
    class="structured-error-panel"
    role="alert"
  >
    <header>
      <span class="operation-label">{{ error.operation }}</span>
      <strong>{{ error.reason }}</strong>
    </header>

    <dl>
      <div>
        <dt>{{ $t('ui.path') }}</dt>
        <dd>{{ error.path }}</dd>
      </div>
      <div>
        <dt>{{ $t('ui.suggestion') }}</dt>
        <dd>{{ error.suggestion }}</dd>
      </div>
    </dl>
  </section>
</template>
<style scoped>
.structured-error-panel {
  display: grid;
  gap: 10px;
  padding: 12px;
  border: 1px solid var(--diff-deleted-fg);
  border-radius: 8px;
  background: var(--diff-deleted-bg);
}

header {
  display: flex;
  align-items: center;
  gap: 8px;
}

.operation-label {
  padding: 2px 6px;
  border: 1px solid var(--diff-deleted-fg);
  border-radius: 6px;
  color: var(--diff-deleted-fg);
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0;
  text-transform: uppercase;
}

dl {
  display: grid;
  gap: 8px;
  margin: 0;
}

dl div {
  display: grid;
  gap: 3px;
}

dt {
  color: var(--app-text-muted);
  font-size: 12px;
}

dd {
  margin: 0;
  overflow-wrap: anywhere;
  font-family: var(--app-font-mono);
  font-size: 12px;
}
</style>
