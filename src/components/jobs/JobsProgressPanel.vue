<script setup lang="ts">
import type { AppJob } from '@/stores/jobs'

defineProps<{
  jobs: AppJob[]
}>()

defineEmits<{
  cancel: [id: string]
}>()

function progressPercent(job: AppJob): string {
  if (!job.progress.total || job.progress.total <= 0) {
    return '0%'
  }

  return `${String(Math.round((job.progress.current / job.progress.total) * 100))}%`
}
</script>

<template>
  <section
    class="jobs-progress-panel"
    :aria-label="$t('ui.jobsProgress')"
  >
    <header class="jobs-header">
      <h2>{{ $t('ui.jobs') }}</h2>
      <span>{{ jobs.length }}</span>
    </header>

    <p
      v-if="jobs.length === 0"
      class="empty-state"
    >
      {{ $t('ui.noRunningJobs') }}
    </p>

    <ul
      v-else
      class="job-list"
    >
      <li
        v-for="job in jobs"
        :key="job.id"
        class="job-item"
      >
        <div class="job-row">
          <strong>{{ job.title }}</strong>
          <span>{{ progressPercent(job) }}</span>
        </div>
        <div
          class="job-progress"
          role="progressbar"
          :aria-valuenow="job.progress.current"
          :aria-valuemax="job.progress.total ?? undefined"
        >
          <span :style="{ width: progressPercent(job) }" />
        </div>
        <div class="job-row">
          <span class="job-message">{{ job.progress.message }}</span>
          <button
            v-if="job.cancellable"
            type="button"
            :data-testid="`cancel-job-${job.id}`"
            @click="$emit('cancel', job.id)"
          >
            {{ $t('ui.cancel') }}
          </button>
        </div>
      </li>
    </ul>
  </section>
</template>
<style scoped>
.jobs-progress-panel {
  display: grid;
  gap: 10px;
  padding: 12px;
  border: 1px solid var(--app-border);
  border-radius: 8px;
  background: var(--app-surface);
}

.jobs-header,
.job-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
}

.jobs-header h2 {
  margin: 0;
  font-size: 15px;
}

.jobs-header span,
.job-message,
.empty-state {
  color: var(--app-text-muted);
  font-size: 12px;
}

.empty-state {
  margin: 0;
}

.job-list {
  display: grid;
  gap: 10px;
  margin: 0;
  padding: 0;
  list-style: none;
}

.job-item {
  display: grid;
  gap: 8px;
}

.job-progress {
  height: 6px;
  overflow: hidden;
  border-radius: 999px;
  background: var(--app-surface-muted);
}

.job-progress span {
  display: block;
  height: 100%;
  border-radius: inherit;
  background: #2563eb;
}

.job-row button {
  height: 26px;
  padding: 0 10px;
  border: 1px solid var(--app-border);
  border-radius: 6px;
  background: var(--app-surface);
  color: var(--app-text);
  cursor: pointer;
}
</style>
