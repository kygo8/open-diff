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
      'open.folderCompare',
      'open.textPatch',
      'open.settings',
      'theme.toggle',
      'session.save',
      'session.saveAs',
      'session.export',
      'edit.copyLeft',
      'edit.copyRight',
      'diff.previous',
      'diff.next',
      'view.showAll',
      'view.showDifferences',
      'workspace.save',
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
      expect(command.placements).toContain('command-palette')
      expect(command.action).toBeDefined()
    }
  })

  it('detects duplicate active shortcuts in the same scope', () => {
    expect(getShortcutConflicts(commandRegistry)).toEqual([])

    const settingsCommand = commandRegistry.find((command) => command.id === 'open.settings')

    if (!settingsCommand) {
      throw new Error('open.settings command is missing')
    }

    const duplicateCommands: (AppCommand | (Omit<AppCommand, 'id'> & { id: string }))[] = [
      ...commandRegistry,
      {
        ...commandRegistry[0],
        id: 'duplicate.command',
        defaultShortcut: settingsCommand.defaultShortcut,
      },
    ]

    const conflicts = getShortcutConflicts(duplicateCommands)

    expect(conflicts).toHaveLength(1)
    expect(conflicts[0]?.commandIds).toEqual(['open.settings', 'duplicate.command'])
  })
})
