import { computed, ref } from 'vue'
import { defineStore } from 'pinia'
import { formatDifferenceCountPhrase, formatLoadTimePhrase } from '@/app/statusBarPhrases'

export interface StatusBarReport {
  comparisonStatus: string
  differenceCount: number | null
  encoding: string
  filterStatus: string
  source: string
  /** Elapsed compare/load time in seconds when a compare has completed. */
  loadTimeSeconds: number | null
}

const defaultReport: StatusBarReport = {
  comparisonStatus: 'Ready',
  differenceCount: null,
  encoding: 'UTF-8',
  filterStatus: 'All rows',
  source: 'workspace',
  loadTimeSeconds: null,
}

export const useStatusBarStore = defineStore('statusBar', () => {
  const report = ref<StatusBarReport>({ ...defaultReport })
  const segments = computed(() => {
    const next = [
      report.value.comparisonStatus,
      formatDifferenceCountPhrase(report.value.differenceCount, report.value.source),
      `Encoding: ${report.value.encoding}`,
      `Filter: ${report.value.filterStatus}`,
    ]

    if (report.value.loadTimeSeconds !== null) {
      next.push(formatLoadTimePhrase(report.value.loadTimeSeconds))
    }

    return next
  })

  function reportStatus(nextReport: Partial<StatusBarReport>): void {
    report.value = {
      ...report.value,
      ...nextReport,
    }
  }

  return {
    report,
    segments,
    reportStatus,
  }
})
