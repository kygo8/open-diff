import { describe, expect, it, vi } from 'vitest'
import { commandRegistry } from './commandRegistry'
import {
  createCommandExecutor,
  getCommandsForPlacement,
  type CommandExecutionContext,
} from './commandSystem'

describe('commandSystem', () => {
  it('derives toolbar and command palette commands from the shared registry', () => {
    expect(
      getCommandsForPlacement(commandRegistry, 'toolbar').map((command) => command.id),
    ).toEqual(['open.textCompare', 'open.folderCompare'])
    expect(getCommandsForPlacement(commandRegistry, 'command-palette')).toEqual(commandRegistry)
    expect(getCommandsForPlacement(commandRegistry, 'menu').map((command) => command.id)).toEqual([
      'open.textCompare',
      'open.folderCompare',
      'open.settings',
      'theme.toggle',
      'diff.previous',
      'diff.next',
    ])
  })

  it('executes navigation commands through the shared command action contract', () => {
    const context = createExecutionContext()
    const executeCommand = createCommandExecutor(commandRegistry, context)

    expect(executeCommand('open.textCompare')).toBe(true)

    expect(context.openTab).toHaveBeenCalledWith({
      route: '/compare/text',
      title: 'Text Compare',
      dirty: false,
    })
    expect(context.navigate).toHaveBeenCalledWith('/compare/text')
  })

  it('executes non-navigation commands through the same command executor', () => {
    const context = createExecutionContext()
    const executeCommand = createCommandExecutor(commandRegistry, context)

    expect(executeCommand('theme.toggle')).toBe(true)

    expect(context.toggleTheme).toHaveBeenCalledTimes(1)
    expect(context.navigate).not.toHaveBeenCalled()
  })

  it('does not execute disabled commands', () => {
    const context = createExecutionContext()
    const executeCommand = createCommandExecutor(commandRegistry, context)

    expect(executeCommand('diff.next')).toBe(false)

    expect(context.navigate).not.toHaveBeenCalled()
    expect(context.toggleTheme).not.toHaveBeenCalled()
  })
})

function createExecutionContext(): CommandExecutionContext {
  return {
    navigate: vi.fn(),
    openTab: vi.fn(),
    t: (key: string) =>
      ({
        'ui.folderCompare': 'Folder Compare',
        'ui.settings': 'Settings',
        'ui.textCompare': 'Text Compare',
      })[key] ?? key,
    toggleTheme: vi.fn(),
  }
}
