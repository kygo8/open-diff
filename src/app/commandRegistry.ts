export type CommandId =
  | 'open.textCompare'
  | 'open.settings'
  | 'theme.toggle'
  | 'diff.previous'
  | 'diff.next'

export type CommandVisibility = 'global' | 'view' | 'hidden'
export type ShortcutScope = 'global' | 'text-compare'

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
  },
  {
    id: 'open.settings',
    titleKey: 'command.openSettings',
    keywords: ['settings', 'preferences', 'open'],
    enabled: true,
    visibility: 'global',
    defaultShortcut: { keys: ['Ctrl', ','], scope: 'global' },
  },
  {
    id: 'theme.toggle',
    titleKey: 'command.toggleTheme',
    keywords: ['theme', 'appearance', 'dark', 'light'],
    enabled: true,
    visibility: 'global',
    defaultShortcut: { keys: ['Ctrl', 'Alt', 'L'], scope: 'global' },
  },
  {
    id: 'diff.previous',
    titleKey: 'command.previousDifference',
    keywords: ['previous', 'diff', 'difference', 'navigation'],
    enabled: false,
    visibility: 'view',
    defaultShortcut: { keys: ['Shift', 'F7'], scope: 'text-compare' },
  },
  {
    id: 'diff.next',
    titleKey: 'command.nextDifference',
    keywords: ['next', 'diff', 'difference', 'navigation'],
    enabled: false,
    visibility: 'view',
    defaultShortcut: { keys: ['F7'], scope: 'text-compare' },
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
