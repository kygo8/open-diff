<script setup lang="ts">
import { ref } from 'vue'
import { useWorkspacesStore } from '@/stores/workspaces'
import type { WorkspaceTabsSnapshot } from '@/stores/tabs'

const props = defineProps<{
  snapshot: WorkspaceTabsSnapshot
}>()

const emit = defineEmits<{
  restore: [id: string]
}>()

const workspaces = useWorkspacesStore()
const workspaceName = ref('')

function saveWorkspace(): void {
  const name = workspaceName.value.trim()

  if (!name) {
    return
  }

  workspaces.saveWorkspace(name, props.snapshot)
  workspaceName.value = ''
}
</script>

<template>
  <section
    class="workspace-manager"
    data-testid="workspace-manager"
  >
    <div class="workspace-save-row">
      <input
        v-model="workspaceName"
        data-testid="workspace-name-input"
        type="text"
        :placeholder="$t('ui.workspace')"
      />
      <button
        type="button"
        data-testid="save-workspace"
        @click="saveWorkspace"
      >
        {{ $t('ui.save') }}
      </button>
    </div>
    <div
      v-for="workspace in workspaces.workspaces"
      :key="workspace.id"
      class="workspace-row"
      data-testid="workspace-row"
    >
      <span>{{ workspace.name }}</span>
      <button
        type="button"
        :data-testid="`restore-workspace-${workspace.id}`"
        @click="emit('restore', workspace.id)"
      >
        {{ $t('ui.restoreRecent') }}
      </button>
      <button
        type="button"
        :data-testid="`delete-workspace-${workspace.id}`"
        @click="workspaces.deleteWorkspace(workspace.id)"
      >
        {{ $t('ui.delete') }}
      </button>
    </div>
  </section>
</template>

<style scoped>
.workspace-manager {
  display: grid;
  gap: 8px;
  padding: 8px;
}

.workspace-save-row,
.workspace-row {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto auto;
  align-items: center;
  gap: 6px;
}

.workspace-save-row input {
  min-width: 0;
  height: 26px;
  padding: 0 8px;
  border: 1px solid var(--app-border);
  border-radius: 4px;
  background: var(--app-canvas);
  color: var(--app-text);
  font-size: 12px;
}

.workspace-save-row button,
.workspace-row button {
  height: 24px;
  padding: 0 7px;
  border: 1px solid var(--app-border);
  border-radius: 4px;
  background: var(--app-canvas);
  color: var(--app-text-muted);
  font-size: 11px;
  cursor: pointer;
}

.workspace-row span {
  min-width: 0;
  overflow: hidden;
  color: var(--app-text);
  font-size: 12px;
  text-overflow: ellipsis;
  white-space: nowrap;
}
</style>
