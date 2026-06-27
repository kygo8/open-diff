import { defineStore } from 'pinia'
import { computed, ref } from 'vue'

export type JobStatus = 'queued' | 'running' | 'completed' | 'failed' | 'cancelled'

export interface JobProgress {
  current: number
  total: number | null
  message: string
}

export interface AppJob {
  id: string
  title: string
  status: JobStatus
  progress: JobProgress
  cancellable: boolean
}

export const useJobsStore = defineStore('jobs', () => {
  const jobs = ref<AppJob[]>([])
  const runningJobs = computed(() =>
    jobs.value.filter((job) => job.status === 'queued' || job.status === 'running'),
  )

  function addJob(job: AppJob): void {
    const existingIndex = jobs.value.findIndex((item) => item.id === job.id)

    if (existingIndex >= 0) {
      jobs.value[existingIndex] = { ...job }

      return
    }

    jobs.value.unshift({ ...job })
  }

  function updateProgress(id: string, progress: JobProgress): void {
    const job = jobs.value.find((item) => item.id === id)

    if (!job) {
      return
    }

    job.progress = { ...progress }
  }

  function cancelJob(id: string): void {
    const job = jobs.value.find((item) => item.id === id)

    if (!job?.cancellable) {
      return
    }

    job.status = 'cancelled'
  }

  return {
    jobs,
    runningJobs,
    addJob,
    updateProgress,
    cancelJob,
  }
})
