import { computed, ref } from 'vue'
import { defineStore } from 'pinia'
import {
  formatDifferenceCountPhrase,
  formatEditModePhrase,
  formatLoadTimePhrase,
  isEditModeStatusSource,
  isFolderPairStatusSource,
  isTextSessionStatusSource,
  type StatusChromeKind,
  type StatusEditMode,
} from '@/app/statusBarPhrases'

export interface StatusBarReport {
  comparisonStatus: string
  differenceCount: number | null
  encoding: string
  filterStatus: string
  source: string
  /** Elapsed compare/load time in seconds when a compare has completed. */
  loadTimeSeconds: number | null
  /** Insert/Overwrite indicator for text editing sessions when known. */
  editMode: StatusEditMode | null
  /** Capture-style chrome layout for the bottom status panes. */
  chromeKind: StatusChromeKind
  /** Folder-pair left selection summary (already localized) when known. */
  leftSelection: string | null
  /** Folder-pair left free-space label (already localized) when known. */
  leftFreeSpace: string | null
  /** Folder-pair right selection summary (already localized) when known. */
  rightSelection: string | null
  /** Folder-pair right free-space label (already localized) when known. */
  rightFreeSpace: string | null
}

const defaultReport: StatusBarReport = {
  comparisonStatus: 'Ready',
  differenceCount: null,
  encoding: 'UTF-8',
  filterStatus: 'All rows',
  source: 'workspace',
  loadTimeSeconds: null,
  editMode: null,
  chromeKind: 'standard',
  leftSelection: null,
  leftFreeSpace: null,
  rightSelection: null,
  rightFreeSpace: null,
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

    if (isEditModeStatusSource(report.value.source)) {
      const editMode = formatEditModePhrase(report.value.editMode)

      if (editMode) {
        next.push(editMode)
      }
    }

    if (report.value.loadTimeSeconds !== null) {
      next.push(formatLoadTimePhrase(report.value.loadTimeSeconds))
    }

    return next
  })

  const chromeKind = computed((): StatusChromeKind => {
    if (report.value.chromeKind !== 'standard') {
      return report.value.chromeKind
    }

    if (isFolderPairStatusSource(report.value.source)) {
      return 'folder-pair'
    }

    if (
      isTextSessionStatusSource(report.value.source) ||
      isEditModeStatusSource(report.value.source)
    ) {
      return 'text-session'
    }

    return 'standard'
  })

  function reportStatus(nextReport: Partial<StatusBarReport>): void {
    report.value = {
      ...report.value,
      ...nextReport,
    }
  }

  function resetStatus(): void {
    report.value = { ...defaultReport }
  }

  return {
    report,
    segments,
    chromeKind,
    reportStatus,
    resetStatus,
  }
})
