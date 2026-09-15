/** Serializable app settings package for Tools export/import. */

import type { DiffHighlightColors, FontFamilyId, ThemeMode } from '@/stores/settings'
import type { SupportedLocale } from '@/i18n/core'
import type { CommandId, CommandShortcut } from '@/app/commandRegistry'

export const settingsPackageKind = 'open-diff-settings' as const
export const settingsPackageVersion = 1 as const

export interface SettingsPackage {
  kind: typeof settingsPackageKind
  version: typeof settingsPackageVersion
  theme: ThemeMode
  locale: SupportedLocale
  sharedSessionPaths: string[]
  shortcutOverrides: Partial<Record<CommandId, CommandShortcut>>
  autoSaveLimit: number
  fontFamily: FontFamilyId
  fontSize: number
  diffColors: DiffHighlightColors
  confirmBeforeDelete: boolean
  wrapTextDefault: boolean
  confirmBeforeSyncOverwrite?: boolean
  autoScrollToFirstDifference?: boolean
  collapseIdenticalFoldersDefault?: boolean
  showHiddenFilesDefault?: boolean
  notifyOnCompareComplete?: boolean
  showSessionToolbars: boolean
  showToolbarLabels: boolean
  largeToolbarButtons: boolean
  createBackupOnSave: boolean
  backupRetentionCount?: number
  showSessionsInToolbar?: boolean
  showGotoInToolbar?: boolean
  showWrapInToolbar?: boolean
  showSyncNowInToolbar?: boolean
  showSyncCancelAcceptInToolbar?: boolean
  showStatusBar?: boolean
  showPathBars?: boolean
  showSidebar?: boolean
  showToolbarIcons?: boolean
  confirmBeforeCloseDirtyTab?: boolean
  confirmBeforeOverwriteSave?: boolean
  alwaysShowTabBar?: boolean
  openSessionsInNewTab?: boolean
  showNextDifferenceInToolbar?: boolean
  showPrevDifferenceInToolbar?: boolean
  archiveExtensions?: string[]
  loadLastWorkspaceOnStartup?: boolean
}

export function isSettingsPackage(value: unknown): value is SettingsPackage {
  if (typeof value !== 'object' || value === null) {
    return false
  }

  const candidate = value as Record<string, unknown>

  return (
    candidate.kind === settingsPackageKind &&
    candidate.version === settingsPackageVersion &&
    typeof candidate.theme === 'string' &&
    typeof candidate.locale === 'string' &&
    Array.isArray(candidate.sharedSessionPaths) &&
    typeof candidate.shortcutOverrides === 'object' &&
    candidate.shortcutOverrides !== null &&
    typeof candidate.autoSaveLimit === 'number' &&
    typeof candidate.fontFamily === 'string' &&
    typeof candidate.fontSize === 'number' &&
    typeof candidate.diffColors === 'object' &&
    candidate.diffColors !== null &&
    typeof candidate.confirmBeforeDelete === 'boolean' &&
    typeof candidate.wrapTextDefault === 'boolean' &&
    typeof candidate.showSessionToolbars === 'boolean' &&
    typeof candidate.showToolbarLabels === 'boolean' &&
    typeof candidate.largeToolbarButtons === 'boolean' &&
    typeof candidate.createBackupOnSave === 'boolean'
  )
}

export function parseSettingsPackage(raw: string): SettingsPackage | null {
  try {
    const parsed = JSON.parse(raw) as unknown

    return isSettingsPackage(parsed) ? parsed : null
  } catch {
    return null
  }
}
