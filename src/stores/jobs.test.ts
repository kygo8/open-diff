import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it } from 'vitest'
import { useJobsStore } from './jobs'

describe('useJobsStore', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  it('adds jobs and exposes running jobs', () => {
    const store = useJobsStore()

    store.addJob({
      id: 'scan-1',
      title: 'Scan folder',
      status: 'running',
      progress: { current: 2, total: 10, message: 'Scanning' },
      cancellable: true,
    })

    expect(store.runningJobs).toHaveLength(1)
    expect(store.runningJobs[0]?.title).toBe('Scan folder')
  })

  it('updates progress and cancels cancellable jobs', () => {
    const store = useJobsStore()

    store.addJob({
      id: 'scan-1',
      title: 'Scan folder',
      status: 'running',
      progress: { current: 2, total: 10, message: 'Scanning' },
      cancellable: true,
    })
    store.updateProgress('scan-1', { current: 7, total: 10, message: 'Indexing' })
    store.cancelJob('scan-1')

    expect(store.jobs[0]?.progress.current).toBe(7)
    expect(store.jobs[0]?.status).toBe('cancelled')
  })
})
