import { describe, expect, it } from 'vitest'
import {
  commandRegistry,
  filterCommands,
  getShortcutConflicts,
  type AppCommand,
} from './commandRegistry'

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

  it('defines unique command ids, default shortcuts, and visibility for every command', () => {
    const ids = commandRegistry.map((command) => command.id)
    const allowedVisibilities = new Set(['global', 'view', 'hidden'])
    const allowedScopes = new Set(['global', 'text-compare'])

    expect(new Set(ids).size).toBe(ids.length)

    for (const command of commandRegistry) {
      expect(allowedVisibilities.has(command.visibility)).toBe(true)
      expect(Array.isArray(command.defaultShortcut.keys)).toBe(true)
      expect(allowedScopes.has(command.defaultShortcut.scope)).toBe(true)
      expect(command.defaultShortcut.keys.length).toBeGreaterThan(0)
      expect(command.defaultShortcut.keys.every((key) => key.length > 0)).toBe(true)
    }
  })

  it('detects duplicate active shortcuts in the same scope', () => {
    expect(getShortcutConflicts(commandRegistry)).toEqual([])

    const duplicateCommands: (AppCommand | (Omit<AppCommand, 'id'> & { id: string }))[] = [
      ...commandRegistry,
      {
        ...commandRegistry[0],
        id: 'duplicate.command',
        defaultShortcut: commandRegistry[1]?.defaultShortcut ?? commandRegistry[0].defaultShortcut,
      },
    ]

    const conflicts = getShortcutConflicts(duplicateCommands)

    expect(conflicts).toHaveLength(1)
    expect(conflicts[0]?.commandIds).toEqual(['open.settings', 'duplicate.command'])
  })
})
