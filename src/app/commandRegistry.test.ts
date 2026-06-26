import { describe, expect, it } from 'vitest'
import { commandRegistry, filterCommands } from './commandRegistry'

describe('commandRegistry', () => {
  it('contains open, theme, and diff navigation commands', () => {
    expect(commandRegistry.map((command) => command.id)).toEqual([
      'open.textCompare',
      'open.settings',
      'theme.toggle',
      'diff.previous',
      'diff.next',
    ])
  })

  it('filters commands by title and keywords', () => {
    expect(filterCommands(commandRegistry, 'theme')).toHaveLength(1)
    expect(filterCommands(commandRegistry, 'next diff')[0]?.id).toBe('diff.next')
  })
})
