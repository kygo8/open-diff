export type CommandId =
  | 'open.textCompare'
  | 'open.settings'
  | 'theme.toggle'
  | 'diff.previous'
  | 'diff.next'

export interface AppCommand {
  id: CommandId
  title: string
  keywords: string[]
  enabled: boolean
}

export const commandRegistry: AppCommand[] = [
  {
    id: 'open.textCompare',
    title: 'Open Text Compare',
    keywords: ['text', 'compare', 'open'],
    enabled: true,
  },
  {
    id: 'open.settings',
    title: 'Open Settings',
    keywords: ['settings', 'preferences', 'open'],
    enabled: true,
  },
  {
    id: 'theme.toggle',
    title: 'Toggle Theme',
    keywords: ['theme', 'appearance', 'dark', 'light'],
    enabled: true,
  },
  {
    id: 'diff.previous',
    title: 'Previous Difference',
    keywords: ['previous', 'diff', 'difference', 'navigation'],
    enabled: false,
  },
  {
    id: 'diff.next',
    title: 'Next Difference',
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
    const searchable = [command.title, ...command.keywords].join(' ').toLowerCase()

    return terms.every((term) => searchable.includes(term))
  })
}
