export type CommandId =
  | 'open.textCompare'
  | 'open.folderCompare'
  | 'open.textPatch'
  | 'open.settings'
  | 'theme.toggle'
  | 'session.save'
  | 'session.saveAs'
  | 'session.export'
  | 'edit.copyLeft'
  | 'edit.copyRight'
  | 'diff.previous'
  | 'diff.next'
  | 'view.showAll'
  | 'view.showDifferences'
  | 'workspace.save'

export type CommandVisibility = 'global' | 'view' | 'hidden'
export type ShortcutScope = 'global' | 'text-compare'
export type CommandPlacement = 'command-palette' | 'toolbar' | 'menu'
export type CommandAction =
  | { type: 'navigate'; route: string; titleKey: string }
  | { type: 'toggle-theme' }
  | {
      type: 'view-action'
      name:
        | 'previous-difference'
        | 'next-difference'
        | 'copy-left'
        | 'copy-right'
        | 'save'
        | 'save-as'
        | 'export'
        | 'show-all'
        | 'show-differences'
        | 'workspace-save'
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
    titleKey: 'command.openSettings',
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
    titleKey: 'ui.save',
    keywords: ['save', 'session'],
    enabled: true,
    visibility: 'view',
    defaultShortcut: { keys: ['Ctrl', 'S'], scope: 'global' },
    placements: ['command-palette', 'toolbar', 'menu'],
    action: { type: 'view-action', name: 'save' },
  },
  {
    id: 'session.saveAs',
    titleKey: 'ui.saveAs',
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
    id: 'edit.copyLeft',
    titleKey: 'ui.copyLeft',
    keywords: ['copy', 'left'],
    enabled: true,
    visibility: 'view',
    defaultShortcut: { keys: ['Alt', 'Left'], scope: 'global' },
    placements: ['command-palette', 'toolbar', 'menu'],
    action: { type: 'view-action', name: 'copy-left' },
  },
  {
    id: 'edit.copyRight',
    titleKey: 'ui.copyRight',
    keywords: ['copy', 'right'],
    enabled: true,
    visibility: 'view',
    defaultShortcut: { keys: ['Alt', 'Right'], scope: 'global' },
    placements: ['command-palette', 'toolbar', 'menu'],
    action: { type: 'view-action', name: 'copy-right' },
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
    titleKey: 'ui.workspace',
    keywords: ['workspace', 'save'],
    enabled: true,
    visibility: 'global',
    defaultShortcut: { keys: ['Ctrl', 'Alt', 'S'], scope: 'global' },
    placements: ['command-palette', 'menu'],
    action: { type: 'view-action', name: 'workspace-save' },
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
