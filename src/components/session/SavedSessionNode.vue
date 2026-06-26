<script setup lang="ts">
import type { SavedSessionTreeNode } from '@/app/savedSessions'

defineProps<{
  node: SavedSessionTreeNode
}>()

const emit = defineEmits<{
  rename: [id: string]
  copy: [id: string]
  move: [id: string]
  delete: [id: string]
}>()
</script>

<template>
  <li class="saved-session-node">
    <template v-if="node.kind === 'folder'">
      <div class="node-row folder-row">
        <span class="node-icon">▸</span>
        <strong>{{ node.name }}</strong>
      </div>
      <ul class="node-children">
        <SavedSessionNode
          v-for="child in node.children"
          :key="child.id"
          :node="child"
          @rename="emit('rename', $event)"
          @copy="emit('copy', $event)"
          @move="emit('move', $event)"
          @delete="emit('delete', $event)"
        />
      </ul>
    </template>

    <div
      v-else
      class="node-row session-row"
    >
      <span class="node-icon">□</span>
      <span>{{ node.name }}</span>
      <small>{{ node.session.sessionType }}</small>
      <div class="node-actions">
        <button
          type="button"
          title="Rename"
          :data-testid="`rename-session-${node.id}`"
          @click="emit('rename', node.id)"
        >
          R
        </button>
        <button
          type="button"
          title="Copy"
          :data-testid="`copy-session-${node.id}`"
          @click="emit('copy', node.id)"
        >
          C
        </button>
        <button
          type="button"
          title="Move"
          :data-testid="`move-session-${node.id}`"
          @click="emit('move', node.id)"
        >
          M
        </button>
        <button
          type="button"
          title="Delete"
          :data-testid="`delete-session-${node.id}`"
          @click="emit('delete', node.id)"
        >
          D
        </button>
      </div>
    </div>
  </li>
</template>

<style scoped>
.saved-session-node {
  list-style: none;
}

.node-row {
  display: grid;
  grid-template-columns: 18px minmax(0, 1fr) auto auto;
  align-items: center;
  gap: 6px;
  min-height: 28px;
  padding: 4px 6px;
  border-radius: 6px;
  font-size: 13px;
}

.node-row:hover {
  background: var(--app-surface-muted);
}

.folder-row {
  color: var(--app-text);
}

.session-row {
  color: var(--app-text-muted);
}

.node-icon {
  color: var(--app-text-muted);
  font-size: 11px;
}

.node-row small {
  color: var(--app-text-muted);
  font-size: 11px;
}

.node-actions {
  display: inline-flex;
  gap: 2px;
}

.node-actions button {
  width: 20px;
  height: 20px;
  padding: 0;
  border: 1px solid var(--app-border);
  border-radius: 4px;
  background: var(--app-surface);
  color: var(--app-text-muted);
  font-size: 10px;
  cursor: pointer;
}

.node-actions button:hover {
  color: var(--app-text);
}

.node-children {
  display: grid;
  gap: 2px;
  margin: 2px 0 2px 16px;
  padding: 0;
}
</style>
