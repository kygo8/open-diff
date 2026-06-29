<template>
  <section class="dense-data-table">
    <slot />
  </section>
</template>

<style scoped>
.dense-data-table {
  min-width: 0;
  overflow: auto;
  border: 1px solid var(--app-border);
  border-radius: 4px;
  background: var(--app-canvas);
}
</style>
