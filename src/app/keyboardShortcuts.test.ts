import { describe, expect, it } from 'vitest'
import { commandRegistry } from './commandRegistry'
import {
  eventMatchesShortcut,
  findCommandIdForKeyboardEvent,
  isEditableKeyboardTarget,
  keyboardEventToShortcutParts,
} from './keyboardShortcuts'

function keyEvent(key: string, init: Partial<KeyboardEventInit> = {}): KeyboardEvent {
  return new KeyboardEvent('keydown', { key, ...init })
}

describe('keyboardShortcuts', () => {
  it('matches ctrl/meta chord parts case-insensitively', () => {
    expect(keyboardEventToShortcutParts(keyEvent('r', { ctrlKey: true }))).toEqual(['Ctrl', 'R'])
    expect(
      eventMatchesShortcut(keyEvent('r', { ctrlKey: true }), {
        keys: ['Ctrl', 'R'],
        scope: 'global',
      }),
    ).toBe(true)
    expect(
      eventMatchesShortcut(keyEvent('F7', { shiftKey: true }), {
        keys: ['Shift', 'F7'],
        scope: 'text-compare',
      }),
    ).toBe(true)
    expect(
      eventMatchesShortcut(keyEvent('F7'), {
        keys: ['Shift', 'F7'],
        scope: 'text-compare',
      }),
    ).toBe(false)
  })

  it('resolves rebound shortcuts over defaults for high-value actions', () => {
    const overrides: Record<string, { keys: string[]; scope: 'global' | 'text-compare' }> = {
      'session.compare': { keys: ['F8'], scope: 'global' },
      'diff.next': { keys: ['Ctrl', 'Down'], scope: 'text-compare' },
    }

    expect(
      findCommandIdForKeyboardEvent(commandRegistry, keyEvent('F8'), {
        getEffectiveShortcut: (command) => overrides[command.id] ?? command.defaultShortcut,
        routePath: '/compare/folder',
      }),
    ).toBe('session.compare')

    expect(
      findCommandIdForKeyboardEvent(commandRegistry, keyEvent('F7'), {
        getEffectiveShortcut: (command) => overrides[command.id] ?? command.defaultShortcut,
        routePath: '/compare/text',
      }),
    ).toBeUndefined()

    expect(
      findCommandIdForKeyboardEvent(commandRegistry, keyEvent('ArrowDown', { ctrlKey: true }), {
        getEffectiveShortcut: (command) => overrides[command.id] ?? command.defaultShortcut,
        routePath: '/compare/text',
      }),
    ).toBe('diff.next')

    expect(
      findCommandIdForKeyboardEvent(commandRegistry, keyEvent('F5'), {
        getEffectiveShortcut: (command) => command.defaultShortcut,
        routePath: '/compare/folder',
      }),
    ).toBe('session.reload')
  })

  it('keeps text-compare scoped shortcuts off unrelated routes', () => {
    expect(
      findCommandIdForKeyboardEvent(commandRegistry, keyEvent('F7'), {
        getEffectiveShortcut: (command) => command.defaultShortcut,
        routePath: '/compare/folder',
      }),
    ).toBeUndefined()

    expect(
      findCommandIdForKeyboardEvent(commandRegistry, keyEvent('F7'), {
        getEffectiveShortcut: (command) => command.defaultShortcut,
        routePath: '/compare/text',
      }),
    ).toBe('diff.next')
  })

  it('detects editable keyboard targets', () => {
    const input = document.createElement('input')
    const div = document.createElement('div')

    div.contentEditable = 'false'
    document.body.append(input, div)

    expect(isEditableKeyboardTarget(input)).toBe(true)
    expect(isEditableKeyboardTarget(div)).toBe(false)
    expect(isEditableKeyboardTarget(null)).toBe(false)

    input.remove()
    div.remove()
  })

  it('matches niche default chords for sync, minor, expand, and merge conflicts', () => {
    expect(
      findCommandIdForKeyboardEvent(
        commandRegistry,
        keyEvent('g', { ctrlKey: true, altKey: true }),
        {
          getEffectiveShortcut: (command) => command.defaultShortcut,
          routePath: '/',
        },
      ),
    ).toBe('open.folderSync')

    expect(
      findCommandIdForKeyboardEvent(
        commandRegistry,
        keyEvent('n', { ctrlKey: true, altKey: true }),
        {
          getEffectiveShortcut: (command) => command.defaultShortcut,
          routePath: '/',
        },
      ),
    ).toBe('open.registryCompare')

    expect(
      findCommandIdForKeyboardEvent(
        commandRegistry,
        keyEvent('m', { ctrlKey: true, shiftKey: true }),
        {
          getEffectiveShortcut: (command) => command.defaultShortcut,
          routePath: '/compare/folder',
        },
      ),
    ).toBe('view.toggleMinor')

    expect(
      findCommandIdForKeyboardEvent(
        commandRegistry,
        keyEvent('e', { ctrlKey: true, shiftKey: true }),
        {
          getEffectiveShortcut: (command) => command.defaultShortcut,
          routePath: '/compare/folder',
        },
      ),
    ).toBe('view.expandAll')

    expect(
      findCommandIdForKeyboardEvent(
        commandRegistry,
        keyEvent('Enter', { ctrlKey: true, shiftKey: true }),
        {
          getEffectiveShortcut: (command) => command.defaultShortcut,
          routePath: '/sync/folder',
        },
      ),
    ).toBe('sync.syncNow')

    expect(
      findCommandIdForKeyboardEvent(commandRegistry, keyEvent('F8'), {
        getEffectiveShortcut: (command) => command.defaultShortcut,
        routePath: '/merge/text',
      }),
    ).toBe('merge.nextConflict')

    expect(
      findCommandIdForKeyboardEvent(commandRegistry, keyEvent('F8', { shiftKey: true }), {
        getEffectiveShortcut: (command) => command.defaultShortcut,
        routePath: '/merge/text',
      }),
    ).toBe('merge.previousConflict')

    expect(
      findCommandIdForKeyboardEvent(commandRegistry, keyEvent('F8'), {
        getEffectiveShortcut: (command) => command.defaultShortcut,
        routePath: '/compare/folder',
      }),
    ).toBeUndefined()
  })

  it('resolves picture/media/version/archive opens and script/report chords', () => {
    expect(
      findCommandIdForKeyboardEvent(
        commandRegistry,
        keyEvent('u', { ctrlKey: true, altKey: true }),
        {
          getEffectiveShortcut: (command) => command.defaultShortcut,
          routePath: '/',
        },
      ),
    ).toBe('open.pictureCompare')

    expect(
      findCommandIdForKeyboardEvent(
        commandRegistry,
        keyEvent('a', { ctrlKey: true, altKey: true }),
        {
          getEffectiveShortcut: (command) => command.defaultShortcut,
          routePath: '/',
        },
      ),
    ).toBe('open.mediaCompare')

    expect(
      findCommandIdForKeyboardEvent(
        commandRegistry,
        keyEvent('v', { ctrlKey: true, altKey: true }),
        {
          getEffectiveShortcut: (command) => command.defaultShortcut,
          routePath: '/',
        },
      ),
    ).toBe('open.versionCompare')

    expect(
      findCommandIdForKeyboardEvent(
        commandRegistry,
        keyEvent('z', { ctrlKey: true, altKey: true }),
        {
          getEffectiveShortcut: (command) => command.defaultShortcut,
          routePath: '/',
        },
      ),
    ).toBe('open.archiveCompare')

    expect(
      findCommandIdForKeyboardEvent(
        commandRegistry,
        keyEvent('c', { ctrlKey: true, altKey: true }),
        {
          getEffectiveShortcut: (command) => command.defaultShortcut,
          routePath: '/reports/scripts',
        },
      ),
    ).toBe('script.run')

    expect(
      findCommandIdForKeyboardEvent(
        commandRegistry,
        keyEvent('p', { ctrlKey: true, shiftKey: true }),
        {
          getEffectiveShortcut: (command) => command.defaultShortcut,
          routePath: '/reports/scripts',
        },
      ),
    ).toBe('report.save')
  })
})
