import { describe, expect, it } from 'vitest'
import {
  commandRegistry,
  filterCommands,
  getShortcutConflicts,
  type AppCommand,
} from './commandRegistry'

describe('commandRegistry', () => {
  it('contains open, theme, and diff navigation commands', () => {
    const ids = commandRegistry.map((command) => command.id)

    expect(ids).toEqual(
      expect.arrayContaining([
        'open.textCompare',
        'open.folderCompare',
        'open.textPatch',
        'open.settings',
        'theme.toggle',
        'session.save',
        'session.saveAs',
        'session.export',
        'session.newTab',
        'help.about',
        'help.checkForUpdates',
        'edit.copyLeft',
        'edit.copyRight',
        'edit.undo',
        'edit.redo',
        'edit.cut',
        'edit.copy',
        'edit.paste',
        'edit.delete',
        'diff.previous',
        'diff.next',
        'view.showAll',
        'view.showDifferences',
        'workspace.save',
        'edit.selectAll',
        'actions.open',
        'view.showSame',
        'search.findFilename',
        'view.columns',
        'view.legend',
        'view.log',
        'view.toolbar',
        'actions.attributes',
        'actions.touch',
        'actions.copyToOutput',
        'session.mergeBaseFolders',
      ]),
    )
    expect(commandRegistry.find((command) => command.id === 'session.newWindow')?.enabled).toBe(
      true,
    )
    expect(commandRegistry.find((command) => command.id === 'session.newWindow')?.action).toEqual({
      type: 'new-window',
    })
    expect(commandRegistry.find((command) => command.id === 'session.exit')?.enabled).toBe(true)
    expect(commandRegistry.find((command) => command.id === 'tools.saveSnapshot')?.enabled).toBe(
      true,
    )
    expect(commandRegistry.find((command) => command.id === 'session.loadWorkspace')?.enabled).toBe(
      true,
    )
    expect(commandRegistry.find((command) => command.id === 'session.compare')?.enabled).toBe(true)
    expect(commandRegistry.find((command) => command.id === 'session.swap')?.enabled).toBe(true)
    expect(commandRegistry.find((command) => command.id === 'session.reload')?.enabled).toBe(true)
    expect(commandRegistry.find((command) => command.id === 'session.rules')?.enabled).toBe(true)
    expect(commandRegistry.find((command) => command.id === 'view.filters')?.enabled).toBe(true)
    expect(commandRegistry.find((command) => command.id === 'tools.exportSettings')?.enabled).toBe(
      true,
    )
    expect(commandRegistry.find((command) => command.id === 'tools.importSettings')?.enabled).toBe(
      true,
    )
    expect(
      commandRegistry.find((command) => command.id === 'tools.restoreFactoryDefaults')?.enabled,
    ).toBe(true)
    expect(commandRegistry.find((command) => command.id === 'help.about')?.enabled).toBe(true)
    expect(commandRegistry.find((command) => command.id === 'edit.undo')?.enabled).toBe(true)
    expect(commandRegistry.find((command) => command.id === 'edit.paste')?.enabled).toBe(true)
    expect(commandRegistry.find((command) => command.id === 'open.folderSync')?.enabled).toBe(true)
    expect(commandRegistry.find((command) => command.id === 'open.registryCompare')?.enabled).toBe(
      true,
    )
    expect(commandRegistry.find((command) => command.id === 'open.textMerge')?.enabled).toBe(true)
    expect(
      commandRegistry.find((command) => command.id === 'merge.nextConflict')?.defaultShortcut,
    ).toEqual({ keys: ['F8'], scope: 'text-compare' })
    expect(commandRegistry.find((command) => command.id === 'view.toggleMinor')?.enabled).toBe(true)
    expect(commandRegistry.find((command) => command.id === 'view.expandAll')?.enabled).toBe(true)
    expect(commandRegistry.find((command) => command.id === 'view.collapseAll')?.enabled).toBe(true)
    expect(commandRegistry.find((command) => command.id === 'sync.syncNow')?.enabled).toBe(true)
    expect(commandRegistry.find((command) => command.id === 'actions.newFolder')?.action).toEqual({
      type: 'view-action',
      name: 'new-folder',
    })
    expect(commandRegistry.find((command) => command.id === 'actions.leaveAlone')?.enabled).toBe(
      true,
    )
    expect(
      commandRegistry.find((command) => command.id === 'actions.copyToOutput')?.action,
    ).toEqual({
      type: 'view-action',
      name: 'copy-to-output',
    })
    expect(commandRegistry.find((command) => command.id === 'actions.merge')?.action).toEqual({
      type: 'view-action',
      name: 'merge-execute',
    })
    expect(commandRegistry.find((command) => command.id === 'actions.delete')?.titleKey).toBe(
      'ui.deleteAction',
    )
    expect(commandRegistry.find((command) => command.id === 'actions.rename')?.titleKey).toBe(
      'ui.renameAction',
    )

    expect(
      commandRegistry.find((command) => command.id === 'actions.compareContents')?.action,
    ).toEqual({
      type: 'view-action',
      name: 'compare-contents',
    })
    expect(commandRegistry.find((command) => command.id === 'actions.synchronize')?.action).toEqual(
      {
        type: 'view-action',
        name: 'synchronize',
      },
    )
    expect(commandRegistry.find((command) => command.id === 'actions.explorer')?.action).toEqual({
      type: 'view-action',
      name: 'explorer',
    })
    expect(commandRegistry.find((command) => command.id === 'actions.ignored')?.action).toEqual({
      type: 'view-action',
      name: 'ignored',
    })
    expect(commandRegistry.find((command) => command.id === 'actions.alignWith')?.action).toEqual({
      type: 'view-action',
      name: 'align-with',
    })
    expect(
      commandRegistry.find((command) => command.id === 'actions.breakAlignment')?.action,
    ).toEqual({
      type: 'view-action',
      name: 'break-alignment',
    })
    expect(
      commandRegistry.find((command) => command.id === 'actions.fileCompareReport')?.action,
    ).toEqual({
      type: 'view-action',
      name: 'file-compare-report',
    })

    expect(commandRegistry.find((command) => command.id === 'open.pictureCompare')?.enabled).toBe(
      true,
    )
    expect(
      commandRegistry.find((command) => command.id === 'open.mediaCompare')?.defaultShortcut,
    ).toEqual({
      keys: ['Ctrl', 'Alt', 'A'],
      scope: 'global',
    })
    expect(commandRegistry.find((command) => command.id === 'script.run')?.action).toEqual({
      type: 'view-action',
      name: 'run-script',
    })
    expect(
      commandRegistry.find((command) => command.id === 'report.save')?.defaultShortcut,
    ).toEqual({
      keys: ['Ctrl', 'Shift', 'P'],
      scope: 'global',
    })
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
