import { computed, ref } from 'vue'
import { defineStore } from 'pinia'

export interface StatusBarReport {
  comparisonStatus: string
  differenceCount: number | null
  encoding: string
  filterStatus: string
  source: string
}

const defaultReport: StatusBarReport = {
  comparisonStatus: 'Ready',
  differenceCount: null,
  encoding: 'UTF-8',
  filterStatus: 'All rows',
  source: 'workspace',
}

export const useStatusBarStore = defineStore('statusBar', () => {
  const report = ref<StatusBarReport>({ ...defaultReport })
  const segments = computed(() => [
    report.value.comparisonStatus,
    `Differences: ${report.value.differenceCount === null ? '-' : String(report.value.differenceCount)}`,
    `Encoding: ${report.value.encoding}`,
    `Filter: ${report.value.filterStatus}`,
  ])

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
