export type CommandId =
  | 'open.textCompare'
  | 'open.folderCompare'
  | 'open.textPatch'
  | 'open.textEdit'
  | 'open.fileFormats'
  | 'open.remoteProfiles'
  | 'open.settings'
  | 'theme.toggle'
  | 'session.save'
  | 'session.saveAs'
  | 'session.export'
  | 'session.newTab'
  | 'session.newWindow'
  | 'session.openSession'
  | 'session.loadWorkspace'
  | 'session.closeTab'
  | 'session.clear'
  | 'session.locked'
  | 'session.browseFolder'
  | 'session.upOneLevel'
  | 'session.back'
  | 'session.forward'
  | 'session.exit'
  | 'session.settings'
  | 'edit.copyLeft'
  | 'edit.copyRight'
  | 'edit.undo'
  | 'edit.redo'
  | 'edit.cut'
  | 'edit.copy'
  | 'edit.paste'
  | 'edit.delete'
  | 'diff.previous'
  | 'diff.next'
  | 'view.showAll'
  | 'view.showDifferences'
  | 'workspace.save'
  | 'session.compare'
  | 'session.swap'
  | 'session.reload'
  | 'session.rules'
  | 'view.filters'
  | 'tools.exportSettings'
  | 'tools.importSettings'
  | 'tools.restoreFactoryDefaults'
  | 'tools.saveSnapshot'
  | 'help.contents'
  | 'help.about'
  | 'help.checkForUpdates'
  | 'help.support'
  | 'open.folderSync'
  | 'open.folderMerge'
  | 'open.textMerge'
  | 'open.registryCompare'
  | 'open.hexCompare'
  | 'open.tableCompare'
  | 'merge.previousConflict'
  | 'merge.nextConflict'
  | 'view.toggleMinor'
  | 'view.expandAll'
  | 'view.collapseAll'
  | 'sync.syncNow'
  | 'open.pictureCompare'
  | 'open.mediaCompare'
  | 'open.versionCompare'
  | 'open.archiveCompare'
  | 'edit.selectAll'
  | 'edit.selectAllFiles'
  | 'edit.selectOrphans'
  | 'edit.invertSelection'
  | 'actions.open'
  | 'actions.openWith'
  | 'actions.quickCompare'
  | 'actions.exclude'
  | 'actions.refreshSelection'
  | 'view.showSame'
  | 'search.findFilename'
  | 'view.columns'
  | 'view.log'
  | 'view.toolbar'
  | 'actions.attributes'
  | 'actions.touch'
  | 'actions.newFolder'
  | 'actions.leaveAlone'
  | 'actions.copyLeftToRight'
  | 'actions.copyRightToLeft'
  | 'actions.deleteLeft'
  | 'actions.deleteRight'
  | 'actions.copyToSide'
  | 'actions.moveToSide'
  | 'actions.copyToFolder'
  | 'actions.moveToFolder'
  | 'actions.rename'
  | 'actions.delete'
  | 'actions.copyFilename'
  | 'actions.compareContents'
  | 'actions.synchronize'
  | 'actions.explorer'
  | 'actions.ignored'
  | 'actions.alignWith'
  | 'actions.breakAlignment'
  | 'actions.fileCompareReport'
  | 'session.mergeBaseFolders'
  | 'session.syncBaseFolders'
  | 'script.run'
  | 'report.save'

export type CommandVisibility = 'global' | 'view' | 'hidden'
export type ShortcutScope = 'global' | 'text-compare'
export type CommandPlacement = 'command-palette' | 'toolbar' | 'menu'
export type CommandAction =
  | { type: 'navigate'; route: string; titleKey: string }
  | { type: 'toggle-theme' }
  | { type: 'quit' }
  | { type: 'new-window' }
  | { type: 'noop' }
  | {
      type: 'view-action'
      name:
        | 'previous-difference'
        | 'next-difference'
        | 'copy-left'
        | 'copy-right'
        | 'undo'
        | 'redo'
        | 'cut'
        | 'copy'
        | 'paste'
        | 'delete'
        | 'save'
        | 'save-as'
        | 'export'
        | 'show-all'
        | 'show-differences'
        | 'workspace-save'
        | 'close-tab'
        | 'clear-session'
        | 'about'
        | 'check-for-updates'
        | 'help-contents'
        | 'help-support'
        | 'session-settings'
        | 'compare'
        | 'swap'
        | 'reload'
        | 'rules'
        | 'filters'
        | 'workspace-load'
        | 'export-settings'
        | 'import-settings'
        | 'restore-factory-defaults'
        | 'save-snapshot'
        | 'previous-conflict'
        | 'next-conflict'
        | 'toggle-minor'
        | 'expand-all'
        | 'collapse-all'
        | 'sync-now'
        | 'browse-folder'
        | 'up-one-level'
        | 'path-back'
        | 'path-forward'
        | 'toggle-session-locked'
        | 'run-script'
        | 'save-report'
        | 'select-all'
        | 'select-all-files'
        | 'select-orphans'
        | 'invert-selection'
        | 'open-selected'
        | 'open-with'
        | 'quick-compare'
        | 'exclude-selected'
        | 'refresh-selection'
        | 'show-same'
        | 'find-filename'
        | 'toggle-columns'
        | 'toggle-log'
        | 'toggle-toolbar'
        | 'change-attributes'
        | 'touch-selected'
        | 'new-folder'
        | 'leave-alone'
        | 'sync-copy-left-to-right'
        | 'sync-copy-right-to-left'
        | 'sync-delete-left'
        | 'sync-delete-right'
        | 'copy-to-side'
        | 'move-to-side'
        | 'copy-to-folder'
        | 'move-to-folder'
        | 'rename-selected'
        | 'copy-filename'
        | 'compare-contents'
        | 'synchronize'
        | 'explorer'
        | 'ignored'
        | 'align-with'
        | 'break-alignment'
        | 'file-compare-report'
    }

export interface CommandShortcut {
  keys: string[]
  scope: ShortcutScope
}

export interface AppCommand {
  id: CommandId
  titleKey: string
  keywords: string[]
  enabled: boolean
  visibility: CommandVisibility
  defaultShortcut: CommandShortcut
  placements: CommandPlacement[]
  action: CommandAction
}

interface ShortcutConflictCandidate {
  id: string
  enabled: boolean
  visibility: CommandVisibility
  defaultShortcut: CommandShortcut
}

export interface ShortcutConflict {
  shortcut: CommandShortcut
  commandIds: string[]
}

export const commandRegistry: AppCommand[] = [
  {
    id: 'open.textCompare',
    titleKey: 'command.openTextCompare',
    keywords: ['text', 'compare', 'open'],
    enabled: true,
    visibility: 'global',
    defaultShortcut: { keys: ['Ctrl', 'Alt', 'T'], scope: 'global' },
    placements: ['command-palette', 'toolbar', 'menu'],
    action: { type: 'navigate', route: '/compare/text', titleKey: 'ui.textCompare' },
  },
  {
    id: 'open.folderCompare',
    titleKey: 'ui.folderCompare',
    keywords: ['folder', 'compare', 'open'],
    enabled: true,
    visibility: 'global',
    defaultShortcut: { keys: ['Ctrl', 'Alt', 'F'], scope: 'global' },
    placements: ['command-palette', 'toolbar', 'menu'],
    action: { type: 'navigate', route: '/compare/folder', titleKey: 'ui.folderCompare' },
  },
  {
    id: 'open.textPatch',
    titleKey: 'ui.textPatch',
    keywords: ['patch', 'diff', 'open'],
    enabled: true,
    visibility: 'global',
    defaultShortcut: { keys: ['Ctrl', 'Alt', 'P'], scope: 'global' },
    placements: ['command-palette', 'toolbar', 'menu'],
    action: { type: 'navigate', route: '/patch/text', titleKey: 'ui.textPatch' },
  },
  {
    id: 'open.settings',
    titleKey: 'ui.options',
    keywords: ['settings', 'preferences', 'open'],
    enabled: true,
    visibility: 'global',
    defaultShortcut: { keys: ['Ctrl', ','], scope: 'global' },
    placements: ['command-palette', 'menu'],
    action: { type: 'navigate', route: '/settings', titleKey: 'ui.settings' },
  },
  {
    id: 'theme.toggle',
    titleKey: 'command.toggleTheme',
    keywords: ['theme', 'appearance', 'dark', 'light'],
    enabled: true,
    visibility: 'global',
    defaultShortcut: { keys: ['Ctrl', 'Alt', 'L'], scope: 'global' },
    placements: ['command-palette', 'menu'],
    action: { type: 'toggle-theme' },
  },
  {
    id: 'session.save',
    titleKey: 'ui.saveSession',
    keywords: ['save', 'session'],
    enabled: true,
    visibility: 'view',
    defaultShortcut: { keys: ['Ctrl', 'S'], scope: 'global' },
    placements: ['command-palette', 'toolbar', 'menu'],
    action: { type: 'view-action', name: 'save' },
  },
  {
    id: 'session.saveAs',
    titleKey: 'ui.saveSessionAs',
    keywords: ['save', 'as', 'session'],
    enabled: true,
    visibility: 'view',
    defaultShortcut: { keys: ['Ctrl', 'Shift', 'S'], scope: 'global' },
    placements: ['command-palette', 'menu'],
    action: { type: 'view-action', name: 'save-as' },
  },
  {
    id: 'session.export',
    titleKey: 'ui.export',
    keywords: ['export', 'session', 'report'],
    enabled: true,
    visibility: 'view',
    defaultShortcut: { keys: ['Ctrl', 'E'], scope: 'global' },
    placements: ['command-palette', 'menu'],
    action: { type: 'view-action', name: 'export' },
  },
  {
    id: 'session.settings',
    titleKey: 'ui.sessionSettings',
    keywords: ['session', 'settings', 'rules', 'importance', 'alignment'],
    enabled: true,
    visibility: 'view',
    defaultShortcut: { keys: ['Ctrl', 'Shift', 'T'], scope: 'global' },
    placements: ['command-palette', 'menu'],
    action: { type: 'view-action', name: 'session-settings' },
  },
  {
    id: 'edit.copyLeft',
    titleKey: 'ui.copyLeft',
    keywords: ['copy', 'left'],
    enabled: true,
    visibility: 'view',
    defaultShortcut: { keys: ['Ctrl', 'Alt', 'Left'], scope: 'global' },
    placements: ['command-palette', 'toolbar', 'menu'],
    action: { type: 'view-action', name: 'copy-left' },
  },
  {
    id: 'edit.copyRight',
    titleKey: 'ui.copyRight',
    keywords: ['copy', 'right'],
    enabled: true,
    visibility: 'view',
    defaultShortcut: { keys: ['Ctrl', 'Alt', 'Right'], scope: 'global' },
    placements: ['command-palette', 'toolbar', 'menu'],
    action: { type: 'view-action', name: 'copy-right' },
  },
  {
    id: 'edit.undo',
    titleKey: 'ui.undo',
    keywords: ['edit', 'undo'],
    enabled: true,
    visibility: 'view',
    defaultShortcut: { keys: ['Ctrl', 'Z'], scope: 'global' },
    placements: ['command-palette', 'menu'],
    action: { type: 'view-action', name: 'undo' },
  },
  {
    id: 'edit.redo',
    titleKey: 'ui.redo',
    keywords: ['edit', 'redo'],
    enabled: true,
    visibility: 'view',
    defaultShortcut: { keys: ['Ctrl', 'Y'], scope: 'global' },
    placements: ['command-palette', 'menu'],
    action: { type: 'view-action', name: 'redo' },
  },
  {
    id: 'edit.cut',
    titleKey: 'ui.cut',
    keywords: ['edit', 'cut', 'clipboard'],
    enabled: true,
    visibility: 'view',
    defaultShortcut: { keys: ['Ctrl', 'X'], scope: 'global' },
    placements: ['command-palette', 'menu'],
    action: { type: 'view-action', name: 'cut' },
  },
  {
    id: 'edit.copy',
    titleKey: 'ui.copy',
    keywords: ['edit', 'copy', 'clipboard'],
    enabled: true,
    visibility: 'view',
    defaultShortcut: { keys: ['Ctrl', 'C'], scope: 'global' },
    placements: ['command-palette', 'menu'],
    action: { type: 'view-action', name: 'copy' },
  },
  {
    id: 'edit.paste',
    titleKey: 'ui.paste',
    keywords: ['edit', 'paste', 'clipboard'],
    enabled: true,
    visibility: 'view',
    defaultShortcut: { keys: ['Ctrl', 'V'], scope: 'global' },
    placements: ['command-palette', 'menu'],
    action: { type: 'view-action', name: 'paste' },
  },
  {
    id: 'edit.delete',
    titleKey: 'ui.delete',
    keywords: ['edit', 'delete'],
    enabled: true,
    visibility: 'view',
    defaultShortcut: { keys: ['Delete'], scope: 'global' },
    placements: ['command-palette', 'menu'],
    action: { type: 'view-action', name: 'delete' },
  },
  {
    id: 'diff.previous',
    titleKey: 'command.previousDifference',
    keywords: ['previous', 'diff', 'difference', 'navigation'],
    enabled: true,
    visibility: 'view',
    defaultShortcut: { keys: ['Shift', 'F7'], scope: 'text-compare' },
    placements: ['command-palette', 'menu'],
    action: { type: 'view-action', name: 'previous-difference' },
  },
  {
    id: 'diff.next',
    titleKey: 'command.nextDifference',
    keywords: ['next', 'diff', 'difference', 'navigation'],
    enabled: true,
    visibility: 'view',
    defaultShortcut: { keys: ['F7'], scope: 'text-compare' },
    placements: ['command-palette', 'menu'],
    action: { type: 'view-action', name: 'next-difference' },
  },
  {
    id: 'view.showAll',
    titleKey: 'ui.showAll',
    keywords: ['show', 'all', 'filter'],
    enabled: true,
    visibility: 'view',
    defaultShortcut: { keys: ['Ctrl', '0'], scope: 'global' },
    placements: ['command-palette', 'toolbar', 'menu'],
    action: { type: 'view-action', name: 'show-all' },
  },
  {
    id: 'view.showDifferences',
    titleKey: 'ui.differencesOnly',
    keywords: ['show', 'differences', 'filter'],
    enabled: true,
    visibility: 'view',
    defaultShortcut: { keys: ['Ctrl', '1'], scope: 'global' },
    placements: ['command-palette', 'toolbar', 'menu'],
    action: { type: 'view-action', name: 'show-differences' },
  },
  {
    id: 'workspace.save',
    titleKey: 'ui.saveWorkspaceAs',
    keywords: ['workspace', 'save'],
    enabled: true,
    visibility: 'global',
    defaultShortcut: { keys: ['Ctrl', 'Alt', 'S'], scope: 'global' },
    placements: ['command-palette', 'menu'],
    action: { type: 'view-action', name: 'workspace-save' },
  },
  {
    id: 'open.textEdit',
    titleKey: 'ui.editTextFile',
    keywords: ['text', 'edit', 'open'],
    enabled: true,
    visibility: 'global',
    defaultShortcut: { keys: ['Ctrl', 'Alt', 'E'], scope: 'global' },
    placements: ['command-palette', 'menu'],
    action: { type: 'navigate', route: '/edit/text', titleKey: 'ui.textEdit' },
  },
  {
    id: 'open.fileFormats',
    titleKey: 'ui.fileFormats',
    keywords: ['file', 'formats', 'tools'],
    enabled: true,
    visibility: 'global',
    defaultShortcut: { keys: ['Ctrl', 'Alt', 'M'], scope: 'global' },
    placements: ['command-palette', 'menu'],
    action: { type: 'navigate', route: '/settings/file-formats', titleKey: 'ui.fileFormats' },
  },
  {
    id: 'open.remoteProfiles',
    titleKey: 'ui.profiles',
    keywords: ['profiles', 'remote', 'ftp', 'tools'],
    enabled: true,
    visibility: 'global',
    defaultShortcut: { keys: ['Ctrl', 'Alt', 'R'], scope: 'global' },
    placements: ['command-palette', 'menu'],
    action: {
      type: 'navigate',
      route: '/settings/remote-profiles',
      titleKey: 'ui.remoteProfiles',
    },
  },
  {
    id: 'session.newTab',
    titleKey: 'ui.newTab',
    keywords: ['session', 'tab', 'home', 'new'],
    enabled: true,
    visibility: 'global',
    defaultShortcut: { keys: ['Ctrl', 'T'], scope: 'global' },
    placements: ['command-palette', 'menu'],
    action: { type: 'navigate', route: '/', titleKey: 'ui.home' },
  },
  {
    id: 'session.newWindow',
    titleKey: 'ui.newWindow',
    keywords: ['session', 'window', 'new'],
    // Real multi-window: capabilities grant session-* labels plus
    // core:webview:allow-create-webview-window; openSessionWindow creates the shell.
    enabled: true,
    visibility: 'global',
    defaultShortcut: { keys: ['Ctrl', 'Shift', 'N'], scope: 'global' },
    placements: ['command-palette', 'menu'],
    action: { type: 'new-window' },
  },
  {
    id: 'session.openSession',
    titleKey: 'ui.openSession',
    keywords: ['session', 'open', 'home'],
    enabled: true,
    visibility: 'global',
    defaultShortcut: { keys: ['Ctrl', 'O'], scope: 'global' },
    placements: ['command-palette', 'menu'],
    action: { type: 'navigate', route: '/', titleKey: 'ui.home' },
  },
  {
    id: 'session.loadWorkspace',
    titleKey: 'ui.loadWorkspace',
    keywords: ['workspace', 'load'],
    enabled: true,
    visibility: 'global',
    defaultShortcut: { keys: ['Ctrl', 'Alt', 'O'], scope: 'global' },
    placements: ['command-palette', 'menu'],
    action: { type: 'view-action', name: 'workspace-load' },
  },
  {
    id: 'session.closeTab',
    titleKey: 'ui.closeTab',
    keywords: ['session', 'close', 'tab'],
    enabled: true,
    visibility: 'global',
    defaultShortcut: { keys: ['Ctrl', 'W'], scope: 'global' },
    placements: ['command-palette', 'menu'],
    action: { type: 'view-action', name: 'close-tab' },
  },
  {
    id: 'session.clear',
    titleKey: 'ui.clearSession',
    keywords: ['session', 'clear', 'reset'],
    enabled: true,
    visibility: 'view',
    defaultShortcut: { keys: ['Ctrl', 'Shift', 'C'], scope: 'global' },
    placements: ['command-palette', 'menu'],
    action: { type: 'view-action', name: 'clear-session' },
  },
  {
    id: 'session.locked',
    titleKey: 'ui.locked',
    keywords: ['session', 'locked', 'lock'],
    enabled: true,
    visibility: 'view',
    defaultShortcut: { keys: ['Ctrl', 'Alt', 'Q'], scope: 'global' },
    placements: ['command-palette', 'menu'],
    action: { type: 'view-action', name: 'toggle-session-locked' },
  },
  {
    id: 'session.browseFolder',
    titleKey: 'ui.browseForFolder',
    keywords: ['session', 'browse', 'folder'],
    enabled: true,
    visibility: 'view',
    defaultShortcut: { keys: ['Ctrl', 'Alt', 'W'], scope: 'global' },
    placements: ['command-palette', 'menu'],
    action: { type: 'view-action', name: 'browse-folder' },
  },
  {
    id: 'session.upOneLevel',
    titleKey: 'ui.upOneLevel',
    keywords: ['session', 'up', 'parent', 'folder'],
    enabled: true,
    visibility: 'view',
    defaultShortcut: { keys: ['Alt', 'Up'], scope: 'global' },
    placements: ['command-palette', 'menu'],
    action: { type: 'view-action', name: 'up-one-level' },
  },
  {
    id: 'session.back',
    titleKey: 'ui.back',
    keywords: ['session', 'back', 'history', 'folder', 'path'],
    enabled: true,
    visibility: 'view',
    defaultShortcut: { keys: ['Alt', 'Left'], scope: 'global' },
    placements: ['command-palette', 'menu'],
    action: { type: 'view-action', name: 'path-back' },
  },
  {
    id: 'session.forward',
    titleKey: 'ui.forward',
    keywords: ['session', 'forward', 'history', 'folder', 'path'],
    enabled: true,
    visibility: 'view',
    defaultShortcut: { keys: ['Alt', 'Right'], scope: 'global' },
    placements: ['command-palette', 'menu'],
    action: { type: 'view-action', name: 'path-forward' },
  },
  {
    id: 'session.exit',
    titleKey: 'ui.exit',
    keywords: ['exit', 'quit'],
    enabled: true,
    visibility: 'global',
    defaultShortcut: { keys: ['Alt', 'F4'], scope: 'global' },
    placements: ['command-palette', 'menu'],
    action: { type: 'quit' },
  },
  {
    id: 'session.compare',
    titleKey: 'ui.compare',
    keywords: ['session', 'compare', 'run'],
    enabled: true,
    visibility: 'view',
    defaultShortcut: { keys: ['Ctrl', 'R'], scope: 'global' },
    placements: ['command-palette', 'menu'],
    action: { type: 'view-action', name: 'compare' },
  },
  {
    id: 'session.swap',
    titleKey: 'ui.swapSides',
    keywords: ['session', 'swap', 'sides'],
    enabled: true,
    visibility: 'view',
    defaultShortcut: { keys: ['Ctrl', 'Shift', 'W'], scope: 'global' },
    placements: ['command-palette', 'menu'],
    action: { type: 'view-action', name: 'swap' },
  },
  {
    id: 'session.reload',
    titleKey: 'ui.reload',
    keywords: ['session', 'reload', 'refresh'],
    enabled: true,
    visibility: 'view',
    defaultShortcut: { keys: ['F5'], scope: 'global' },
    placements: ['command-palette', 'menu'],
    action: { type: 'view-action', name: 'reload' },
  },
  {
    id: 'session.rules',
    titleKey: 'ui.rules',
    keywords: ['session', 'rules'],
    enabled: true,
    visibility: 'view',
    defaultShortcut: { keys: ['Ctrl', 'Shift', 'R'], scope: 'global' },
    placements: ['command-palette', 'menu'],
    action: { type: 'view-action', name: 'rules' },
  },
  {
    id: 'view.filters',
    titleKey: 'ui.filters',
    keywords: ['view', 'filters', 'filter'],
    enabled: true,
    visibility: 'view',
    defaultShortcut: { keys: ['Ctrl', 'Shift', 'F'], scope: 'global' },
    placements: ['command-palette', 'menu'],
    action: { type: 'view-action', name: 'filters' },
  },
  {
    id: 'tools.exportSettings',
    titleKey: 'ui.exportSettings',
    keywords: ['export', 'settings', 'tools'],
    enabled: true,
    visibility: 'global',
    defaultShortcut: { keys: ['Ctrl', 'Alt', 'X'], scope: 'global' },
    placements: ['command-palette', 'menu'],
    action: { type: 'view-action', name: 'export-settings' },
  },
  {
    id: 'tools.importSettings',
    titleKey: 'ui.importSettings',
    keywords: ['import', 'settings', 'tools'],
    enabled: true,
    visibility: 'global',
    defaultShortcut: { keys: ['Ctrl', 'Alt', 'I'], scope: 'global' },
    placements: ['command-palette', 'menu'],
    action: { type: 'view-action', name: 'import-settings' },
  },
  {
    id: 'tools.restoreFactoryDefaults',
    titleKey: 'ui.restoreFactoryDefaults',
    keywords: ['restore', 'factory', 'defaults', 'tools'],
    enabled: true,
    visibility: 'global',
    defaultShortcut: { keys: ['Ctrl', 'Alt', 'D'], scope: 'global' },
    placements: ['command-palette', 'menu'],
    action: { type: 'view-action', name: 'restore-factory-defaults' },
  },
  {
    id: 'tools.saveSnapshot',
    titleKey: 'ui.saveSnapshot',
    keywords: ['snapshot', 'save', 'tools'],
    enabled: true,
    visibility: 'global',
    defaultShortcut: { keys: ['Ctrl', 'Alt', 'Y'], scope: 'global' },
    placements: ['command-palette', 'menu'],
    action: { type: 'view-action', name: 'save-snapshot' },
  },
  {
    id: 'help.contents',
    titleKey: 'ui.helpContents',
    keywords: ['help', 'contents'],
    enabled: true,
    visibility: 'global',
    defaultShortcut: { keys: ['F1'], scope: 'global' },
    placements: ['command-palette', 'menu'],
    action: { type: 'view-action', name: 'help-contents' },
  },
  {
    id: 'help.about',
    titleKey: 'ui.about',
    keywords: ['help', 'about'],
    enabled: true,
    visibility: 'global',
    defaultShortcut: { keys: ['Ctrl', 'Shift', 'A'], scope: 'global' },
    placements: ['command-palette', 'menu'],
    action: { type: 'view-action', name: 'about' },
  },
  {
    id: 'help.checkForUpdates',
    titleKey: 'ui.checkForUpdates',
    keywords: ['help', 'update', 'updates'],
    enabled: true,
    visibility: 'global',
    defaultShortcut: { keys: ['Ctrl', 'Shift', 'U'], scope: 'global' },
    placements: ['command-palette', 'menu'],
    action: { type: 'view-action', name: 'check-for-updates' },
  },
  {
    id: 'help.support',
    titleKey: 'ui.support',
    keywords: ['help', 'support'],
    enabled: true,
    visibility: 'global',
    defaultShortcut: { keys: ['Ctrl', 'Shift', 'H'], scope: 'global' },
    placements: ['command-palette', 'menu'],
    action: { type: 'view-action', name: 'help-support' },
  },
  {
    id: 'open.folderSync',
    titleKey: 'ui.folderSync',
    keywords: ['folder', 'sync', 'open'],
    enabled: true,
    visibility: 'global',
    defaultShortcut: { keys: ['Ctrl', 'Alt', 'G'], scope: 'global' },
    placements: ['command-palette', 'menu'],
    action: { type: 'navigate', route: '/sync/folder', titleKey: 'ui.folderSync' },
  },
  {
    id: 'open.folderMerge',
    titleKey: 'ui.folderMerge',
    keywords: ['folder', 'merge', 'open'],
    enabled: true,
    visibility: 'global',
    defaultShortcut: { keys: ['Ctrl', 'Alt', 'B'], scope: 'global' },
    placements: ['command-palette', 'menu'],
    action: { type: 'navigate', route: '/merge/folder', titleKey: 'ui.folderMerge' },
  },
  {
    id: 'open.textMerge',
    titleKey: 'ui.textMerge',
    keywords: ['text', 'merge', 'open', 'conflict'],
    enabled: true,
    visibility: 'global',
    defaultShortcut: { keys: ['Ctrl', 'Alt', 'K'], scope: 'global' },
    placements: ['command-palette', 'menu'],
    action: { type: 'navigate', route: '/merge/text', titleKey: 'ui.textMerge' },
  },
  {
    id: 'open.registryCompare',
    titleKey: 'ui.registryCompare',
    keywords: ['registry', 'compare', 'open', 'reg'],
    enabled: true,
    visibility: 'global',
    defaultShortcut: { keys: ['Ctrl', 'Alt', 'N'], scope: 'global' },
    placements: ['command-palette', 'menu'],
    action: { type: 'navigate', route: '/compare/registry', titleKey: 'ui.registryCompare' },
  },
  {
    id: 'open.hexCompare',
    titleKey: 'ui.hexCompare',
    keywords: ['hex', 'binary', 'compare', 'open'],
    enabled: true,
    visibility: 'global',
    defaultShortcut: { keys: ['Ctrl', 'Alt', 'H'], scope: 'global' },
    placements: ['command-palette', 'menu'],
    action: { type: 'navigate', route: '/compare/hex', titleKey: 'ui.hexCompare' },
  },
  {
    id: 'open.tableCompare',
    titleKey: 'ui.tableCompare',
    keywords: ['table', 'csv', 'compare', 'open'],
    enabled: true,
    visibility: 'global',
    defaultShortcut: { keys: ['Ctrl', 'Alt', 'J'], scope: 'global' },
    placements: ['command-palette', 'menu'],
    action: { type: 'navigate', route: '/compare/table', titleKey: 'ui.tableCompare' },
  },
  {
    id: 'merge.previousConflict',
    titleKey: 'ui.previousConflict',
    keywords: ['previous', 'conflict', 'merge', 'navigation'],
    enabled: true,
    visibility: 'view',
    defaultShortcut: { keys: ['Shift', 'F8'], scope: 'text-compare' },
    placements: ['command-palette', 'menu'],
    action: { type: 'view-action', name: 'previous-conflict' },
  },
  {
    id: 'merge.nextConflict',
    titleKey: 'ui.nextConflict',
    keywords: ['next', 'conflict', 'merge', 'navigation'],
    enabled: true,
    visibility: 'view',
    defaultShortcut: { keys: ['F8'], scope: 'text-compare' },
    placements: ['command-palette', 'menu'],
    action: { type: 'view-action', name: 'next-conflict' },
  },
  {
    id: 'view.toggleMinor',
    titleKey: 'command.toggleMinor',
    keywords: ['toggle', 'minor', 'unimportant', 'view'],
    enabled: true,
    visibility: 'view',
    defaultShortcut: { keys: ['Ctrl', 'Shift', 'M'], scope: 'global' },
    placements: ['command-palette', 'menu'],
    action: { type: 'view-action', name: 'toggle-minor' },
  },
  {
    id: 'view.expandAll',
    titleKey: 'command.expandAll',
    keywords: ['expand', 'all', 'tree', 'view'],
    enabled: true,
    visibility: 'view',
    defaultShortcut: { keys: ['Ctrl', 'Shift', 'E'], scope: 'global' },
    placements: ['command-palette', 'menu'],
    action: { type: 'view-action', name: 'expand-all' },
  },
  {
    id: 'view.collapseAll',
    titleKey: 'command.collapseAll',
    keywords: ['collapse', 'all', 'tree', 'view'],
    enabled: true,
    visibility: 'view',
    defaultShortcut: { keys: ['Ctrl', 'Shift', 'L'], scope: 'global' },
    placements: ['command-palette', 'menu'],
    action: { type: 'view-action', name: 'collapse-all' },
  },
  {
    id: 'sync.syncNow',
    titleKey: 'ui.syncNow',
    keywords: ['sync', 'now', 'folder', 'execute'],
    enabled: true,
    visibility: 'view',
    defaultShortcut: { keys: ['Ctrl', 'Shift', 'Enter'], scope: 'global' },
    placements: ['command-palette', 'menu'],
    action: { type: 'view-action', name: 'sync-now' },
  },
  {
    id: 'open.pictureCompare',
    titleKey: 'ui.pictureCompare',
    keywords: ['picture', 'image', 'compare', 'open'],
    enabled: true,
    visibility: 'global',
    defaultShortcut: { keys: ['Ctrl', 'Alt', 'U'], scope: 'global' },
    placements: ['command-palette', 'menu'],
    action: { type: 'navigate', route: '/compare/picture', titleKey: 'ui.pictureCompare' },
  },
  {
    id: 'open.mediaCompare',
    titleKey: 'ui.mediaCompare',
    keywords: ['media', 'audio', 'video', 'compare', 'open'],
    enabled: true,
    visibility: 'global',
    defaultShortcut: { keys: ['Ctrl', 'Alt', 'A'], scope: 'global' },
    placements: ['command-palette', 'menu'],
    action: { type: 'navigate', route: '/compare/media', titleKey: 'ui.mediaCompare' },
  },
  {
    id: 'open.versionCompare',
    titleKey: 'ui.versionCompare',
    keywords: ['version', 'exe', 'dll', 'compare', 'open'],
    enabled: true,
    visibility: 'global',
    defaultShortcut: { keys: ['Ctrl', 'Alt', 'V'], scope: 'global' },
    placements: ['command-palette', 'menu'],
    action: { type: 'navigate', route: '/compare/version', titleKey: 'ui.versionCompare' },
  },
  {
    id: 'open.archiveCompare',
    titleKey: 'ui.archiveCompare',
    keywords: ['archive', 'zip', 'tar', '7z', 'compare', 'open'],
    enabled: true,
    visibility: 'global',
    defaultShortcut: { keys: ['Ctrl', 'Alt', 'Z'], scope: 'global' },
    placements: ['command-palette', 'menu'],
    action: { type: 'navigate', route: '/compare/folder', titleKey: 'ui.archiveCompare' },
  },
  {
    id: 'edit.selectAll',
    titleKey: 'ui.selectAll',
    keywords: ['select', 'all', 'edit'],
    enabled: true,
    visibility: 'view',
    defaultShortcut: { keys: ['Ctrl', 'A'], scope: 'global' },
    placements: ['command-palette', 'menu'],
    action: { type: 'view-action', name: 'select-all' },
  },
  {
    id: 'edit.selectAllFiles',
    titleKey: 'ui.selectAllFiles',
    keywords: ['select', 'files', 'all', 'edit'],
    enabled: true,
    visibility: 'view',
    defaultShortcut: { keys: ['Ctrl', 'Alt', 'Shift', 'A'], scope: 'global' },
    placements: ['command-palette', 'menu'],
    action: { type: 'view-action', name: 'select-all-files' },
  },
  {
    id: 'edit.selectOrphans',
    titleKey: 'ui.selectOrphans',
    keywords: ['select', 'orphans', 'edit'],
    enabled: true,
    visibility: 'view',
    defaultShortcut: { keys: ['Ctrl', 'Alt', 'Shift', 'O'], scope: 'global' },
    placements: ['command-palette', 'menu'],
    action: { type: 'view-action', name: 'select-orphans' },
  },
  {
    id: 'edit.invertSelection',
    titleKey: 'ui.invertSelection',
    keywords: ['invert', 'selection', 'edit'],
    enabled: true,
    visibility: 'view',
    defaultShortcut: { keys: ['Ctrl', 'Alt', 'Shift', 'I'], scope: 'global' },
    placements: ['command-palette', 'menu'],
    action: { type: 'view-action', name: 'invert-selection' },
  },
  {
    id: 'actions.open',
    titleKey: 'ui.open',
    keywords: ['open', 'actions', 'file'],
    enabled: true,
    visibility: 'view',
    defaultShortcut: { keys: ['Ctrl', 'Alt', 'Enter'], scope: 'global' },
    placements: ['command-palette', 'menu'],
    action: { type: 'view-action', name: 'open-selected' },
  },
  {
    id: 'actions.openWith',
    titleKey: 'ui.openWith',
    keywords: ['open', 'with', 'actions', 'application'],
    enabled: true,
    visibility: 'view',
    defaultShortcut: { keys: ['Ctrl', 'Alt', 'Shift', 'W'], scope: 'global' },
    placements: ['command-palette', 'menu'],
    action: { type: 'view-action', name: 'open-with' },
  },
  {
    id: 'actions.quickCompare',
    titleKey: 'ui.quickCompare',
    keywords: ['quick', 'compare', 'actions'],
    enabled: true,
    visibility: 'view',
    defaultShortcut: { keys: ['Ctrl', 'Alt', 'Shift', 'Q'], scope: 'global' },
    placements: ['command-palette', 'menu'],
    action: { type: 'view-action', name: 'quick-compare' },
  },
  {
    id: 'actions.exclude',
    titleKey: 'ui.exclude',
    keywords: ['exclude', 'actions', 'filter'],
    enabled: true,
    visibility: 'view',
    defaultShortcut: { keys: ['Ctrl', 'Alt', 'Shift', 'X'], scope: 'global' },
    placements: ['command-palette', 'menu'],
    action: { type: 'view-action', name: 'exclude-selected' },
  },
  {
    id: 'actions.refreshSelection',
    titleKey: 'ui.refreshSelection',
    keywords: ['refresh', 'selection', 'actions'],
    enabled: true,
    visibility: 'view',
    defaultShortcut: { keys: ['Shift', 'F5'], scope: 'global' },
    placements: ['command-palette', 'menu'],
    action: { type: 'view-action', name: 'refresh-selection' },
  },
  {
    id: 'view.showSame',
    titleKey: 'ui.showSame',
    keywords: ['show', 'same', 'view', 'filter'],
    enabled: true,
    visibility: 'view',
    defaultShortcut: { keys: ['Ctrl', 'Alt', 'Shift', 'S'], scope: 'global' },
    placements: ['command-palette', 'menu'],
    action: { type: 'view-action', name: 'show-same' },
  },
  {
    id: 'session.mergeBaseFolders',
    titleKey: 'ui.mergeBaseFolders',
    keywords: ['merge', 'base', 'folders', 'session'],
    enabled: true,
    visibility: 'view',
    defaultShortcut: { keys: ['Ctrl', 'Alt', 'Shift', 'M'], scope: 'global' },
    placements: ['command-palette', 'menu'],
    action: { type: 'navigate', route: '/merge/folder', titleKey: 'ui.folderMerge' },
  },
  {
    id: 'session.syncBaseFolders',
    titleKey: 'ui.syncBaseFolders',
    keywords: ['sync', 'base', 'folders', 'session'],
    enabled: true,
    visibility: 'view',
    defaultShortcut: { keys: ['Ctrl', 'Alt', 'Shift', 'Y'], scope: 'global' },
    placements: ['command-palette', 'menu'],
    action: { type: 'navigate', route: '/sync/folder', titleKey: 'ui.folderSync' },
  },
  {
    id: 'script.run',
    titleKey: 'ui.runScript',
    keywords: ['script', 'run', 'automation'],
    enabled: true,
    visibility: 'view',
    defaultShortcut: { keys: ['Ctrl', 'Alt', 'C'], scope: 'global' },
    placements: ['command-palette', 'menu'],
    action: { type: 'view-action', name: 'run-script' },
  },
  {
    id: 'report.save',
    titleKey: 'ui.saveReport',
    keywords: ['report', 'save', 'export'],
    enabled: true,
    visibility: 'view',
    defaultShortcut: { keys: ['Ctrl', 'Shift', 'P'], scope: 'global' },
    placements: ['command-palette', 'menu'],
    action: { type: 'view-action', name: 'save-report' },
  },
  {
    id: 'search.findFilename',
    titleKey: 'ui.findFilename',
    keywords: ['find', 'filename', 'search'],
    enabled: true,
    visibility: 'view',
    defaultShortcut: { keys: ['Ctrl', 'F'], scope: 'global' },
    placements: ['command-palette', 'menu'],
    action: { type: 'view-action', name: 'find-filename' },
  },
  {
    id: 'view.columns',
    titleKey: 'ui.columns',
    keywords: ['columns', 'view'],
    enabled: true,
    visibility: 'view',
    defaultShortcut: { keys: ['Ctrl', 'Alt', 'Shift', 'C'], scope: 'global' },
    placements: ['command-palette', 'menu'],
    action: { type: 'view-action', name: 'toggle-columns' },
  },
  {
    id: 'view.log',
    titleKey: 'ui.log',
    keywords: ['log', 'view'],
    enabled: true,
    visibility: 'view',
    defaultShortcut: { keys: ['Ctrl', 'Alt', 'Shift', 'G'], scope: 'global' },
    placements: ['command-palette', 'menu'],
    action: { type: 'view-action', name: 'toggle-log' },
  },
  {
    id: 'view.toolbar',
    titleKey: 'ui.toolbar',
    keywords: ['toolbar', 'view'],
    enabled: true,
    visibility: 'view',
    defaultShortcut: { keys: ['Ctrl', 'Alt', 'Shift', 'T'], scope: 'global' },
    placements: ['command-palette', 'menu'],
    action: { type: 'view-action', name: 'toggle-toolbar' },
  },
  {
    id: 'actions.attributes',
    titleKey: 'ui.attributes',
    keywords: ['attributes', 'readonly', 'actions'],
    enabled: true,
    visibility: 'view',
    defaultShortcut: { keys: ['Ctrl', 'Alt', 'Shift', 'R'], scope: 'global' },
    placements: ['command-palette', 'menu'],
    action: { type: 'view-action', name: 'change-attributes' },
  },
  {
    id: 'actions.touch',
    titleKey: 'ui.touch',
    keywords: ['touch', 'timestamp', 'actions'],
    enabled: true,
    visibility: 'view',
    defaultShortcut: { keys: ['Ctrl', 'Alt', 'Shift', 'U'], scope: 'global' },
    placements: ['command-palette', 'menu'],
    action: { type: 'view-action', name: 'touch-selected' },
  },
  {
    id: 'actions.newFolder',
    titleKey: 'ui.newFolder',
    keywords: ['new', 'folder', 'mkdir', 'actions', 'insert'],
    enabled: true,
    visibility: 'view',
    defaultShortcut: { keys: ['Ins'], scope: 'global' },
    placements: ['command-palette', 'menu'],
    action: { type: 'view-action', name: 'new-folder' },
  },
  {
    id: 'actions.leaveAlone',
    titleKey: 'ui.leaveAlone',
    keywords: ['leave', 'alone', 'sync', 'override', 'actions'],
    enabled: true,
    visibility: 'view',
    defaultShortcut: { keys: ['Ctrl', 'Alt', 'Shift', 'L'], scope: 'global' },
    placements: ['command-palette', 'menu'],
    action: { type: 'view-action', name: 'leave-alone' },
  },
  {
    id: 'actions.copyRightToLeft',
    titleKey: 'ui.copyRightToLeft',
    keywords: ['copy', 'right', 'left', 'sync', 'override', 'actions'],
    enabled: true,
    visibility: 'view',
    defaultShortcut: { keys: ['Ctrl', 'Alt', 'Shift', 'H'], scope: 'global' },
    placements: ['command-palette', 'menu'],
    action: { type: 'view-action', name: 'sync-copy-right-to-left' },
  },
  {
    id: 'actions.copyLeftToRight',
    titleKey: 'ui.copyLeftToRight',
    keywords: ['copy', 'left', 'right', 'sync', 'override', 'actions'],
    enabled: true,
    visibility: 'view',
    defaultShortcut: { keys: ['Ctrl', 'Alt', 'Shift', 'J'], scope: 'global' },
    placements: ['command-palette', 'menu'],
    action: { type: 'view-action', name: 'sync-copy-left-to-right' },
  },
  {
    id: 'actions.deleteLeft',
    titleKey: 'ui.deleteLeft',
    keywords: ['delete', 'left', 'sync', 'override', 'actions'],
    enabled: true,
    visibility: 'view',
    defaultShortcut: { keys: ['Ctrl', 'Alt', 'Shift', 'D'], scope: 'global' },
    placements: ['command-palette', 'menu'],
    action: { type: 'view-action', name: 'sync-delete-left' },
  },
  {
    id: 'actions.deleteRight',
    titleKey: 'ui.deleteRight',
    keywords: ['delete', 'right', 'sync', 'override', 'actions'],
    enabled: true,
    visibility: 'view',
    defaultShortcut: { keys: ['Ctrl', 'Alt', 'Shift', 'E'], scope: 'global' },
    placements: ['command-palette', 'menu'],
    action: { type: 'view-action', name: 'sync-delete-right' },
  },
  {
    id: 'actions.copyToSide',
    titleKey: 'ui.copyToSide',
    keywords: ['copy', 'side', 'folder', 'actions'],
    enabled: true,
    visibility: 'view',
    defaultShortcut: { keys: ['Ctrl', 'Alt', 'Shift', 'B'], scope: 'global' },
    placements: ['command-palette', 'menu'],
    action: { type: 'view-action', name: 'copy-to-side' },
  },
  {
    id: 'actions.moveToSide',
    titleKey: 'ui.moveToSide',
    keywords: ['move', 'side', 'folder', 'actions'],
    enabled: true,
    visibility: 'view',
    defaultShortcut: { keys: ['Ctrl', 'Alt', 'Shift', 'K'], scope: 'global' },
    placements: ['command-palette', 'menu'],
    action: { type: 'view-action', name: 'move-to-side' },
  },
  {
    id: 'actions.copyToFolder',
    titleKey: 'ui.copyToFolder',
    keywords: ['copy', 'folder', 'actions'],
    enabled: true,
    visibility: 'view',
    defaultShortcut: { keys: ['Ctrl', 'Alt', 'Shift', 'P'], scope: 'global' },
    placements: ['command-palette', 'menu'],
    action: { type: 'view-action', name: 'copy-to-folder' },
  },
  {
    id: 'actions.moveToFolder',
    titleKey: 'ui.moveToFolder',
    keywords: ['move', 'folder', 'actions'],
    enabled: true,
    visibility: 'view',
    defaultShortcut: { keys: ['Ctrl', 'Alt', 'Shift', 'V'], scope: 'global' },
    placements: ['command-palette', 'menu'],
    action: { type: 'view-action', name: 'move-to-folder' },
  },
  {
    id: 'actions.rename',
    titleKey: 'ui.rename',
    keywords: ['rename', 'folder', 'actions', 'f2'],
    enabled: true,
    visibility: 'view',
    defaultShortcut: { keys: ['F2'], scope: 'global' },
    placements: ['command-palette', 'menu'],
    action: { type: 'view-action', name: 'rename-selected' },
  },
  {
    id: 'actions.delete',
    titleKey: 'ui.delete',
    keywords: ['delete', 'folder', 'actions'],
    enabled: true,
    visibility: 'view',
    defaultShortcut: { keys: ['Ctrl', 'Alt', 'Shift', 'Delete'], scope: 'global' },
    placements: ['command-palette', 'menu'],
    action: { type: 'view-action', name: 'delete' },
  },
  {
    id: 'actions.copyFilename',
    titleKey: 'ui.copyFilename',
    keywords: ['copy', 'filename', 'path', 'actions'],
    enabled: true,
    visibility: 'view',
    defaultShortcut: { keys: ['Ctrl', 'Alt', 'Shift', 'N'], scope: 'global' },
    placements: ['command-palette', 'menu'],
    action: { type: 'view-action', name: 'copy-filename' },
  },
  {
    id: 'actions.compareContents',
    titleKey: 'ui.compareContents',
    keywords: ['compare', 'contents', 'actions', 'content'],
    enabled: true,
    visibility: 'view',
    defaultShortcut: { keys: ['Ctrl', 'Alt', 'Shift', '1'], scope: 'global' },
    placements: ['command-palette', 'menu'],
    action: { type: 'view-action', name: 'compare-contents' },
  },
  {
    id: 'actions.synchronize',
    titleKey: 'ui.synchronize',
    keywords: ['synchronize', 'sync', 'folder', 'actions'],
    enabled: true,
    visibility: 'view',
    defaultShortcut: { keys: ['Ctrl', 'Alt', 'Shift', '2'], scope: 'global' },
    placements: ['command-palette', 'menu'],
    action: { type: 'view-action', name: 'synchronize' },
  },
  {
    id: 'actions.explorer',
    titleKey: 'ui.explorer',
    keywords: ['explorer', 'reveal', 'folder', 'actions', 'shell'],
    enabled: true,
    visibility: 'view',
    defaultShortcut: { keys: ['Ctrl', 'Alt', 'Shift', 'F'], scope: 'global' },
    placements: ['command-palette', 'menu'],
    action: { type: 'view-action', name: 'explorer' },
  },
  {
    id: 'actions.ignored',
    titleKey: 'ui.ignored',
    keywords: ['ignored', 'ignore', 'actions', 'filter'],
    enabled: true,
    visibility: 'view',
    defaultShortcut: { keys: ['Ctrl', 'Alt', 'Shift', '3'], scope: 'global' },
    placements: ['command-palette', 'menu'],
    action: { type: 'view-action', name: 'ignored' },
  },
  {
    id: 'actions.alignWith',
    titleKey: 'ui.alignWith',
    keywords: ['align', 'with', 'actions', 'orphan'],
    enabled: true,
    visibility: 'view',
    defaultShortcut: { keys: ['Ctrl', 'Alt', 'Shift', '4'], scope: 'global' },
    placements: ['command-palette', 'menu'],
    action: { type: 'view-action', name: 'align-with' },
  },
  {
    id: 'actions.breakAlignment',
    titleKey: 'ui.breakAlignment',
    keywords: ['break', 'alignment', 'actions'],
    enabled: true,
    visibility: 'view',
    defaultShortcut: { keys: ['Ctrl', 'Alt', 'Shift', '5'], scope: 'global' },
    placements: ['command-palette', 'menu'],
    action: { type: 'view-action', name: 'break-alignment' },
  },
  {
    id: 'actions.fileCompareReport',
    titleKey: 'ui.fileCompareReport',
    keywords: ['file', 'compare', 'report', 'actions', 'export'],
    enabled: true,
    visibility: 'view',
    defaultShortcut: { keys: ['Ctrl', 'Alt', 'Shift', '6'], scope: 'global' },
    placements: ['command-palette', 'menu'],
    action: { type: 'view-action', name: 'file-compare-report' },
  },
]

export function filterCommands(commands: AppCommand[], query: string): AppCommand[] {
  const terms = query.trim().toLowerCase().split(/\s+/u).filter(Boolean)

  if (terms.length === 0) {
    return commands
  }

  return commands.filter((command) => {
    const searchable = [command.titleKey, ...command.keywords].join(' ').toLowerCase()

    return terms.every((term) => searchable.includes(term))
  })
}

export function getShortcutConflicts(commands: ShortcutConflictCandidate[]): ShortcutConflict[] {
  const shortcutGroups = new Map<string, ShortcutConflictCandidate[]>()

  for (const command of commands) {
    if (!command.enabled || command.visibility === 'hidden') {
      continue
    }

    const shortcutKey = shortcutSignature(command.defaultShortcut)
    const existingCommands = shortcutGroups.get(shortcutKey) ?? []

    shortcutGroups.set(shortcutKey, [...existingCommands, command])
  }

  return [...shortcutGroups.values()]
    .filter((commandsWithShortcut) => commandsWithShortcut.length > 1)
    .map((commandsWithShortcut) => ({
      shortcut: commandsWithShortcut[0].defaultShortcut,
      commandIds: commandsWithShortcut.map((command) => command.id),
    }))
}

function shortcutSignature(shortcut: CommandShortcut): string {
  return `${shortcut.scope}:${shortcut.keys.map((key) => key.trim().toLowerCase()).join('+')}`
}
