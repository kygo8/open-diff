<script setup lang="ts">
import { computed, ref } from 'vue'
import { useRouter } from 'vue-router'
import { classifyDropInputs } from '@/app/dropInput'
import { selectSessionForDrop } from '@/app/sessionAutoSelect'
import { sessionCatalog, sessionPriorities } from '@/app/sessionCatalog'
import { useTabsStore } from '@/stores/tabs'
import type { DropClassification, DropInput } from '@/app/dropInput'
import type { SessionSelection } from '@/app/sessionAutoSelect'
import type { SessionCatalogEntry, SessionPriority } from '@/app/sessionCatalog'

const router = useRouter()
const tabs = useTabsStore()
const dropResult = ref<DropClassification>({
  kind: 'invalid',
  reason: 'Drop exactly two files or folders.',
})
const selectedDropSession = ref<SessionSelection>()
const isDragging = ref(false)

const groupedEntries = computed(() =>
  sessionPriorities.map((priority) => ({
    priority,
    entries: sessionCatalog.filter((entry) => entry.priority === priority),
  })),
)

function priorityLabel(priority: SessionPriority): string {
  const labels: Record<SessionPriority, string> = {
    P0: 'Core',
    P1: 'Primary',
    P2: 'Advanced',
    P3: 'Extended',
  }

  return labels[priority]
}

function openSession(entry: SessionCatalogEntry): void {
  if (!entry.implemented || !entry.route) {
    return
  }

  tabs.openTab({ title: entry.title, route: entry.route, dirty: false })
  void router.push(entry.route)
}

function handleDragOver(event: DragEvent): void {
  event.preventDefault()
  isDragging.value = true
}

function handleDragLeave(): void {
  isDragging.value = false
}

function handleDrop(event: DragEvent): void {
  event.preventDefault()
  isDragging.value = false
  dropResult.value = classifyDropInputs(inputsFromDataTransfer(event.dataTransfer))
  selectedDropSession.value =
    dropResult.value.kind === 'invalid' ? undefined : selectSessionForDrop(dropResult.value)
}

function inputsFromDataTransfer(dataTransfer: DataTransfer | null): DropInput[] {
  if (!dataTransfer) {
    return []
  }

  const fileInputs = [...dataTransfer.files].map<DropInput>((file) => ({
    path: file.webkitRelativePath || file.name,
    kind: 'file',
  }))

  if (fileInputs.length > 0) {
    return fileInputs
  }

  return [...dataTransfer.items]
    .filter((item) => item.kind === 'file')
    .map<DropInput>((item) => ({ path: item.type || 'Unknown item', kind: 'unknown' }))
}

function openSelectedDropSession(): void {
  if (!selectedDropSession.value?.enabled || !selectedDropSession.value.route) {
    return
  }

  tabs.openTab({
    title: selectedDropSession.value.title,
    route: selectedDropSession.value.route,
    dirty: false,
  })
  void router.push(selectedDropSession.value.route)
}
</script>

<template>
  <section class="home-view">
    <header class="home-header">
      <div>
        <p class="eyebrow">Session launcher</p>
        <h1>Choose a comparison workspace</h1>
      </div>
      <div class="home-summary">
        <strong>{{ sessionCatalog.length }}</strong>
        <span>session types</span>
      </div>
    </header>

    <section
      class="drop-zone"
      :class="{ dragging: isDragging }"
      @dragover="handleDragOver"
      @dragleave="handleDragLeave"
      @drop="handleDrop"
    >
      <div>
        <strong>Drop two files or folders</strong>
        <span v-if="dropResult.kind === 'invalid'">{{ dropResult.reason }}</span>
        <span v-else>
          {{ dropResult.kind }} detected: {{ dropResult.left.displayName }} and
          {{ dropResult.right.displayName }}
        </span>
        <span v-if="selectedDropSession">
          Suggested: {{ selectedDropSession.title }}
          {{ selectedDropSession.enabled ? '' : '(planned)' }}
        </span>
      </div>
      <NButton
        size="small"
        :disabled="!selectedDropSession?.enabled"
        @click="openSelectedDropSession"
      >
        Open Suggested View
      </NButton>
    </section>

    <div class="priority-groups">
      <section
        v-for="group in groupedEntries"
        :key="group.priority"
        class="priority-group"
        data-testid="session-priority"
      >
        <div class="priority-title">
          <span>{{ group.priority }}</span>
          <strong>{{ priorityLabel(group.priority) }}</strong>
        </div>

        <div class="session-grid">
          <article
            v-for="entry in group.entries"
            :key="entry.type"
            class="session-entry"
            :class="{ disabled: !entry.implemented }"
            data-testid="session-entry"
            :data-session-type="entry.type"
          >
            <div class="entry-copy">
              <h2>{{ entry.title }}</h2>
              <p>{{ entry.summary }}</p>
            </div>
            <NButton
              size="small"
              :type="entry.implemented ? 'primary' : 'default'"
              :secondary="!entry.implemented"
              :disabled="!entry.implemented"
              @click="openSession(entry)"
            >
              {{ entry.implemented ? 'Open' : 'Planned' }}
            </NButton>
          </article>
        </div>
      </section>
    </div>
  </section>
</template>

<style scoped>
.home-view {
  height: 100%;
  padding: 28px;
  overflow: auto;
}

.home-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 24px;
  padding-bottom: 18px;
  border-bottom: 1px solid var(--app-border);
}

.eyebrow {
  margin: 0 0 8px;
  color: #2563eb;
  font-size: 12px;
  font-weight: 700;
  letter-spacing: 0;
  text-transform: uppercase;
}

h1 {
  margin: 0;
  font-size: 24px;
  line-height: 1.2;
}

.home-summary {
  display: grid;
  min-width: 108px;
  padding: 10px 12px;
  border: 1px solid var(--app-border);
  border-radius: 8px;
  background: var(--app-surface);
  text-align: right;
}

.home-summary strong {
  font-size: 22px;
  line-height: 1;
}

.home-summary span {
  color: var(--app-text-muted);
  font-size: 12px;
}

.priority-groups {
  display: grid;
  gap: 22px;
  margin-top: 22px;
}

.drop-zone {
  display: grid;
  min-height: 92px;
  margin-top: 18px;
  padding: 16px;
  border: 1px dashed var(--app-border);
  border-radius: 8px;
  background: var(--app-surface);
  place-items: center;
  text-align: center;
}

.drop-zone.dragging {
  border-color: #2563eb;
  background: rgb(37 99 235 / 0.08);
}

.drop-zone div {
  display: grid;
  gap: 6px;
}

.drop-zone strong {
  font-size: 15px;
}

.drop-zone span {
  color: var(--app-text-muted);
  font-size: 13px;
}

.priority-group {
  display: grid;
  gap: 12px;
}

.priority-title {
  display: flex;
  align-items: center;
  gap: 8px;
  color: var(--app-text-muted);
  font-size: 12px;
}

.priority-title span {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 34px;
  height: 22px;
  border: 1px solid var(--app-border);
  border-radius: 6px;
  background: var(--app-surface);
  color: var(--app-text);
  font-weight: 700;
}

.session-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
  gap: 10px;
}

.session-entry {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  align-items: center;
  gap: 14px;
  min-height: 86px;
  padding: 14px;
  border: 1px solid var(--app-border);
  border-radius: 8px;
  background: var(--app-surface);
}

.session-entry.disabled {
  background: var(--app-surface-muted);
}

.entry-copy {
  min-width: 0;
}

.entry-copy h2 {
  margin: 0 0 6px;
  font-size: 16px;
  line-height: 1.25;
}

.entry-copy p {
  margin: 0;
  color: var(--app-text-muted);
  font-size: 13px;
  line-height: 1.4;
}

@media (width <= 640px) {
  .home-view {
    padding: 18px;
  }

  .home-header {
    display: grid;
  }

  .home-summary {
    text-align: left;
  }

  .session-entry {
    grid-template-columns: 1fr;
  }
}
</style>
