<script setup lang="ts">
import { useRouter } from 'vue-router'
import { useTabsStore } from '@/stores/tabs'

const router = useRouter()
const tabs = useTabsStore()

function openTextCompare(): void {
  tabs.openTab({ title: 'Text Compare', route: '/compare/text', dirty: false })
  void router.push('/compare/text')
}
</script>

<template>
  <section class="home-view">
    <div class="hero">
      <p class="eyebrow">Local-first diff workspace</p>
      <h1>Compare, merge, and understand changes.</h1>
      <p class="intro">
        Open Diff is being built around a Rust core and a compact Vue desktop interface. Naive UI
        powers the shell, while the diff surfaces stay custom-built for professional comparison
        workflows.
      </p>
      <div class="actions">
        <NButton
          type="primary"
          @click="openTextCompare"
          >Start Text Compare</NButton
        >
        <NButton
          secondary
          disabled
          >Folder Compare</NButton
        >
        <NButton
          secondary
          disabled
          >Table Compare</NButton
        >
      </div>
    </div>

    <div class="feature-grid">
      <article>
        <h2>Rust Core</h2>
        <p>
          Heavy comparison, scanning, merge, and sync work belongs in Rust crates with testable
          boundaries.
        </p>
      </article>
      <article>
        <h2>Custom Diff Views</h2>
        <p>
          Text, folder, table, image, and hex comparison surfaces are purpose-built instead of
          generic data tables.
        </p>
      </article>
      <article>
        <h2>Desktop UX</h2>
        <p>
          The shell uses compact controls, stable panels, progress feedback, and local-first
          defaults for ordinary users.
        </p>
      </article>
    </div>
  </section>
</template>

<style scoped>
.home-view {
  height: 100%;
  padding: 40px;
  overflow: auto;
}

.hero {
  max-width: 760px;
}

.eyebrow {
  color: #2563eb;
  font-size: 12px;
  font-weight: 700;
  letter-spacing: 0.12em;
  text-transform: uppercase;
}

h1 {
  margin: 0;
  font-size: 42px;
  line-height: 1.08;
}

.intro {
  max-width: 680px;
  color: var(--app-text-muted);
  font-size: 16px;
  line-height: 1.7;
}

.actions {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  margin-top: 24px;
}

.feature-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
  gap: 14px;
  margin-top: 42px;
}

article {
  padding: 18px;
  border: 1px solid var(--app-border);
  border-radius: 8px;
  background: var(--app-surface);
}

article h2 {
  margin: 0 0 8px;
  font-size: 16px;
}

article p {
  margin: 0;
  color: var(--app-text-muted);
  line-height: 1.6;
}
</style>
