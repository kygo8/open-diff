export type CommandId =
  | 'open.textCompare'
  | 'open.settings'
  | 'theme.toggle'
  | 'diff.previous'
  | 'diff.next'

export interface AppCommand {
  id: CommandId
  titleKey: string
  keywords: string[]
  enabled: boolean
}

export const commandRegistry: AppCommand[] = [
  {
    id: 'open.textCompare',
    titleKey: 'command.openTextCompare',
    keywords: ['text', 'compare', 'open'],
    enabled: true,
  },
  {
    id: 'open.settings',
    titleKey: 'command.openSettings',
    keywords: ['settings', 'preferences', 'open'],
    enabled: true,
  },
  {
    id: 'theme.toggle',
    titleKey: 'command.toggleTheme',
    keywords: ['theme', 'appearance', 'dark', 'light'],
    enabled: true,
  },
  {
    id: 'diff.previous',
    titleKey: 'command.previousDifference',
    keywords: ['previous', 'diff', 'difference', 'navigation'],
    enabled: false,
  },
  {
    id: 'diff.next',
    titleKey: 'command.nextDifference',
    keywords: ['next', 'diff', 'difference', 'navigation'],
    enabled: false,
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
