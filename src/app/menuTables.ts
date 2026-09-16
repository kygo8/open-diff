import type { CommandId } from './commandRegistry'
import {
  isClipboardCompareRoute,
  isFolderCompareRoute,
  isFolderishSessionRoute,
  isFolderMergeRoute,
  isFolderSyncRoute,
  isHexCompareRoute,
  isPictureCompareRoute,
  isRegistrySessionRoute,
  isSessionWorkbenchPath,
  isTableCompareRoute,
  isTextEditRoute,
  isTextEditVerbRoute,
  isTextMergeRoute,
  isTextPatchRoute,
  isTextSideCopyRoute,
  sessionSupportsReportSave,
} from './shellChrome'

/** Actions that need a checked row or focused selection to run honestly. */
export const MENU_COMMANDS_REQUIRING_SELECTION: ReadonlySet<CommandId> = new Set([
  'actions.open',
  'actions.openWith',
  'actions.quickCompare',
  'actions.compareContents',
  'actions.copyToSide',
  'actions.moveToSide',
  'actions.copyToFolder',
  'actions.moveToFolder',
  'actions.delete',
  'actions.rename',
  'actions.attributes',
  'actions.touch',
  'actions.exclude',
  'actions.copyFilename',
  'actions.ignored',
  'actions.refreshSelection',
  'actions.synchronize',
  'actions.explorer',
  'actions.alignWith',
  'actions.breakAlignment',
  'actions.fileCompareReport',
  'actions.copyToOutput',
  'actions.merge',
  'actions.leaveAlone',
  'actions.copyLeftToRight',
  'actions.copyRightToLeft',
  'actions.deleteLeft',
  'actions.deleteRight',
])

export interface MenuEnablementContext {
  routePath: string
  hasSelection: boolean
  canGoBack: boolean
  canGoForward: boolean
  canCloseTab: boolean
  hasLockableSession: boolean
}

export function folderishOrRegistryRoute(path: string): boolean {
  return isFolderishSessionRoute(path) || isRegistrySessionRoute(path)
}

/**
 * Session-type and chrome enablement for menu commands (before selection gate).
 * Selection-sensitive Actions are gated separately via applySelectionEnablement.
 */
export function resolveMenuCommandEnabled(
  commandId: CommandId,
  baseEnabled: boolean,
  ctx: MenuEnablementContext,
): boolean {
  if (!baseEnabled) {
    return false
  }

  const path = ctx.routePath

  if (commandId === 'session.closeTab') {
    return ctx.canCloseTab
  }

  if (
    commandId === 'session.save' ||
    commandId === 'session.saveAs' ||
    commandId === 'session.clear' ||
    commandId === 'session.export' ||
    commandId === 'session.compare' ||
    commandId === 'session.swap' ||
    commandId === 'session.reload' ||
    commandId === 'session.rules' ||
    commandId === 'session.settings'
  ) {
    return isSessionWorkbenchPath(path)
  }

  if (commandId === 'diff.next' || commandId === 'diff.previous') {
    return (
      isSessionWorkbenchPath(path) &&
      !isPictureCompareRoute(path) &&
      !isClipboardCompareRoute(path) &&
      !isTextPatchRoute(path) &&
      !isTextEditRoute(path)
    )
  }

  if (commandId === 'session.locked') {
    return isSessionWorkbenchPath(path) && ctx.hasLockableSession
  }

  if (commandId === 'session.browseFolder' || commandId === 'session.upOneLevel') {
    return isFolderishSessionRoute(path)
  }

  if (commandId === 'session.back') {
    return isFolderishSessionRoute(path) && ctx.canGoBack
  }

  if (commandId === 'session.forward') {
    return isFolderishSessionRoute(path) && ctx.canGoForward
  }

  if (commandId === 'edit.selectAll' || commandId === 'edit.invertSelection') {
    return isFolderishSessionRoute(path)
  }

  if (
    commandId === 'edit.selectAllFiles' ||
    commandId === 'edit.selectOrphans' ||
    commandId === 'edit.selectNewer'
  ) {
    return isFolderCompareRoute(path) || isFolderMergeRoute(path)
  }

  if (
    commandId === 'actions.open' ||
    commandId === 'actions.openWith' ||
    commandId === 'actions.quickCompare' ||
    commandId === 'actions.exclude' ||
    commandId === 'actions.refreshSelection' ||
    commandId === 'view.expandAll' ||
    commandId === 'view.collapseAll'
  ) {
    return folderishOrRegistryRoute(path)
  }

  if (
    commandId === 'view.showSame' ||
    commandId === 'search.findFilename' ||
    commandId === 'search.findNextFilename' ||
    commandId === 'search.findPreviousFilename' ||
    commandId === 'edit.fullRefresh'
  ) {
    return isFolderishSessionRoute(path)
  }

  if (
    commandId === 'view.showOrphans' ||
    commandId === 'view.showNoOrphans' ||
    commandId === 'view.showDifferencesNoOrphans' ||
    commandId === 'view.showLeftOrphans' ||
    commandId === 'view.showRightOrphans' ||
    commandId === 'view.showLeftNewer' ||
    commandId === 'view.showRightNewer' ||
    commandId === 'view.showLeftNewerAndOrphans' ||
    commandId === 'view.showRightNewerAndOrphans' ||
    commandId === 'view.suppressFilters' ||
    commandId === 'view.columns'
  ) {
    return isFolderCompareRoute(path)
  }

  if (commandId === 'view.alwaysShowFolders') {
    return isFolderCompareRoute(path) || isFolderMergeRoute(path)
  }

  if (
    commandId === 'view.showChanges' ||
    commandId === 'view.showConflicts' ||
    commandId === 'view.centerPane' ||
    commandId === 'session.compareToOutput'
  ) {
    return isFolderMergeRoute(path)
  }

  if (
    commandId === 'view.onlyCompareFiles' ||
    commandId === 'view.compareFilesAndFolderStructure' ||
    commandId === 'view.ignoreFolderStructure'
  ) {
    return isFolderCompareRoute(path) || isFolderMergeRoute(path)
  }

  if (commandId === 'view.legend') {
    return isFolderCompareRoute(path) || isFolderSyncRoute(path) || isFolderMergeRoute(path)
  }

  if (commandId === 'view.log') {
    return isFolderSyncRoute(path) || isFolderMergeRoute(path)
  }

  if (commandId === 'view.toolbar') {
    return true
  }

  if (commandId === 'view.showAll' || commandId === 'view.showDifferences') {
    return (
      isSessionWorkbenchPath(path) &&
      !isPictureCompareRoute(path) &&
      !isTableCompareRoute(path) &&
      !isClipboardCompareRoute(path) &&
      !isTextPatchRoute(path) &&
      !isTextEditRoute(path)
    )
  }

  if (commandId === 'view.toggleMinor') {
    return (
      isSessionWorkbenchPath(path) &&
      !isHexCompareRoute(path) &&
      !isTableCompareRoute(path) &&
      !isRegistrySessionRoute(path) &&
      !isClipboardCompareRoute(path) &&
      !isTextPatchRoute(path) &&
      !isTextEditRoute(path)
    )
  }

  if (commandId === 'view.filters') {
    return folderishOrRegistryRoute(path)
  }

  if (commandId === 'edit.copyLeft' || commandId === 'edit.copyRight') {
    return isTextSideCopyRoute(path)
  }

  if (
    commandId === 'edit.undo' ||
    commandId === 'edit.redo' ||
    commandId === 'edit.cut' ||
    commandId === 'edit.copy' ||
    commandId === 'edit.paste' ||
    commandId === 'edit.delete'
  ) {
    return isTextEditVerbRoute(path)
  }

  if (commandId === 'actions.attributes' || commandId === 'actions.touch') {
    return isFolderCompareRoute(path)
  }

  if (commandId === 'actions.copyToOutput' || commandId === 'actions.merge') {
    return isFolderMergeRoute(path)
  }

  if (commandId === 'actions.newFolder') {
    return isFolderCompareRoute(path) || isFolderSyncRoute(path) || isFolderMergeRoute(path)
  }

  if (
    commandId === 'actions.leaveAlone' ||
    commandId === 'actions.copyLeftToRight' ||
    commandId === 'actions.copyRightToLeft' ||
    commandId === 'actions.deleteLeft' ||
    commandId === 'actions.deleteRight'
  ) {
    return isFolderSyncRoute(path)
  }

  if (commandId === 'actions.explorer') {
    return isFolderCompareRoute(path) || isFolderSyncRoute(path) || isFolderMergeRoute(path)
  }

  if (commandId === 'actions.compareContents') {
    return isFolderCompareRoute(path) || isFolderMergeRoute(path)
  }

  if (
    commandId === 'actions.copyToSide' ||
    commandId === 'actions.moveToSide' ||
    commandId === 'actions.copyToFolder' ||
    commandId === 'actions.moveToFolder' ||
    commandId === 'actions.rename' ||
    commandId === 'actions.delete' ||
    commandId === 'actions.copyFilename' ||
    commandId === 'actions.synchronize' ||
    commandId === 'actions.ignored' ||
    commandId === 'actions.alignWith' ||
    commandId === 'actions.breakAlignment' ||
    commandId === 'actions.fileCompareReport'
  ) {
    return isFolderCompareRoute(path)
  }

  if (commandId === 'session.mergeBaseFolders' || commandId === 'session.syncBaseFolders') {
    return isFolderCompareRoute(path)
  }

  if (commandId === 'session.compareBaseFolders') {
    return isFolderSyncRoute(path)
  }

  if (commandId === 'session.compareParentFolders') {
    return isFolderishSessionRoute(path)
  }

  if (commandId === 'session.info') {
    return isFolderCompareRoute(path) || isFolderSyncRoute(path) || isFolderMergeRoute(path)
  }

  if (commandId === 'report.save') {
    return sessionSupportsReportSave(path)
  }

  if (commandId === 'sync.syncNow') {
    return isFolderSyncRoute(path)
  }

  if (commandId === 'script.run') {
    return isSessionWorkbenchPath(path)
  }

  if (commandId === 'merge.previousConflict' || commandId === 'merge.nextConflict') {
    return isFolderMergeRoute(path) || isTextMergeRoute(path)
  }

  return true
}

/** Apply selection gate after session-type enablement. */
export function applySelectionEnablement(
  commandId: CommandId,
  enabled: boolean,
  hasSelection: boolean,
): boolean {
  if (!enabled) {
    return false
  }

  if (MENU_COMMANDS_REQUIRING_SELECTION.has(commandId)) {
    return hasSelection
  }

  return true
}
