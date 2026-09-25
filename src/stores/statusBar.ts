import { computed, ref } from 'vue'
import { defineStore } from 'pinia'
import {
  formatDifferenceCountPhrase,
  formatEditModePhrase,
  formatImportancePhrase,
  formatLoadTimePhrase,
  isEditModeStatusSource,
  isTextEditStatusSource,
  isFolderPairStatusSource,
  isFolderSyncStatusSource,
  isFolderMergeStatusSource,
  isHexSessionStatusSource,
  isMediaSessionStatusSource,
  isPictureSessionStatusSource,
  isTextSessionStatusSource,
  isVersionSessionStatusSource,
  isTableSessionStatusSource,
  isRegistrySessionStatusSource,
  isClipboardSessionStatusSource,
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
  /** Important (non-minor) difference count when classification is available. */
  importantDifferenceCount: number | null
  /** Unimportant (minor) difference count when classification is available. */
  unimportantDifferenceCount: number | null
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
  /** Folder-merge center selection / editing label when known. */
  centerSelection: string | null
  /** Folder-merge center free-space label when known. */
  centerFreeSpace: string | null
}

const defaultReport: StatusBarReport = {
  comparisonStatus: 'Ready',
  differenceCount: null,
  encoding: 'UTF-8',
  filterStatus: 'All rows',
  source: 'workspace',
  loadTimeSeconds: null,
  importantDifferenceCount: null,
  unimportantDifferenceCount: null,
  editMode: null,
  chromeKind: 'standard',
  leftSelection: null,
  leftFreeSpace: null,
  rightSelection: null,
  rightFreeSpace: null,
  centerSelection: null,
  centerFreeSpace: null,
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

    const importance = formatImportancePhrase(
      report.value.importantDifferenceCount,
      report.value.unimportantDifferenceCount,
    )

    if (importance) {
      next.push(importance)
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

    if (isFolderMergeStatusSource(report.value.source)) {
      return 'folder-merge'
    }

    if (isFolderSyncStatusSource(report.value.source)) {
      return 'folder-sync'
    }

    if (isFolderPairStatusSource(report.value.source)) {
      return 'folder-pair'
    }

    if (isTextEditStatusSource(report.value.source)) {
      return 'text-edit-session'
    }

    if (
      isTextSessionStatusSource(report.value.source) ||
      isEditModeStatusSource(report.value.source)
    ) {
      return 'text-session'
    }

    if (isHexSessionStatusSource(report.value.source)) {
      return 'hex-session'
    }

    if (isPictureSessionStatusSource(report.value.source)) {
      return 'picture-session'
    }

    if (isMediaSessionStatusSource(report.value.source)) {
      return 'media-session'
    }

    if (isVersionSessionStatusSource(report.value.source)) {
      return 'version-session'
    }

    if (isTableSessionStatusSource(report.value.source)) {
      return 'table-session'
    }

    if (isRegistrySessionStatusSource(report.value.source)) {
      return 'registry-session'
    }

    if (isClipboardSessionStatusSource(report.value.source)) {
      return 'clipboard-session'
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
