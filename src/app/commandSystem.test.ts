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
    ).toEqual([
      'open.textCompare',
      'open.folderCompare',
      'open.textPatch',
      'session.save',
      'edit.copyLeft',
      'edit.copyRight',
      'view.showAll',
      'view.showDifferences',
    ])
    expect(getCommandsForPlacement(commandRegistry, 'command-palette')).toEqual(commandRegistry)
    expect(getCommandsForPlacement(commandRegistry, 'menu').map((command) => command.id)).toEqual([
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

  it('dispatches view action commands through the shared executor', () => {
    const context = createExecutionContext()
    const executeCommand = createCommandExecutor(commandRegistry, context)

    expect(executeCommand('diff.next')).toBe(true)

    expect(context.navigate).not.toHaveBeenCalled()
    expect(context.toggleTheme).not.toHaveBeenCalled()
    expect(context.dispatchViewAction).toHaveBeenCalledWith('next-difference')
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
    dispatchViewAction: vi.fn(),
  }
}
