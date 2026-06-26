<script setup lang="ts">
import type { SavedSessionTreeNode } from '@/app/savedSessions'

defineProps<{
  node: SavedSessionTreeNode
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
    </div>
  </li>
</template>

<style scoped>
.saved-session-node {
  list-style: none;
}

.node-row {
  display: grid;
  grid-template-columns: 18px minmax(0, 1fr) auto;
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

.node-children {
  display: grid;
  gap: 2px;
  margin: 2px 0 2px 16px;
  padding: 0;
}
</style>
