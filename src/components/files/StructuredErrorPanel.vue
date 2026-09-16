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
  gap: 4px;
  padding: 2px 4px;
  border: 1px solid var(--diff-deleted-fg);
  border-radius: 0;
  background: var(--diff-deleted-bg);
}

header {
  display: flex;
  align-items: center;
  gap: 4px;
  min-height: 18px;
}

.operation-label {
  padding: 0 4px;
  border: 1px solid var(--diff-deleted-fg);
  border-radius: 0;
  color: var(--diff-deleted-fg);
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0;
  text-transform: uppercase;
}

dl {
  display: grid;
  gap: 4px;
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
