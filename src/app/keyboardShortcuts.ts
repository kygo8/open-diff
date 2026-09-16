import type { AppCommand, CommandId, CommandShortcut, ShortcutScope } from './commandRegistry'

export function isEditableKeyboardTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) {
    return false
  }

  const tag = target.tagName

  if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') {
    return true
  }

  // Some test DOM implementations leave this unset on plain elements.
  // eslint-disable-next-line @typescript-eslint/no-unnecessary-type-conversion -- coerce sparse DOM boolean
  return Boolean(target.isContentEditable)
}

export function normalizeShortcutKey(key: string): string {
  const trimmed = key.trim()

  if (!trimmed) {
    return ''
  }

  const lower = trimmed.toLowerCase()

  if (lower === 'control' || lower === 'ctrl') {
    return 'Ctrl'
  }
  if (lower === 'meta' || lower === 'cmd' || lower === 'command' || lower === 'super') {
    return 'Meta'
  }
  if (lower === 'alt' || lower === 'option') {
    return 'Alt'
  }
  if (lower === 'shift') {
    return 'Shift'
  }
  if (lower === 'escape' || lower === 'esc') {
    return 'Escape'
  }
  if (lower === ' ' || lower === 'space' || lower === 'spacebar') {
    return 'Space'
  }
  if (lower.startsWith('arrow') && lower.length > 5) {
    return lower.slice(5, 6).toUpperCase() + lower.slice(6)
  }
  if (lower.length === 1) {
    return lower.toUpperCase()
  }

  return trimmed.length === 1 ? trimmed.toUpperCase() : trimmed[0].toUpperCase() + trimmed.slice(1)
}

export function keyboardEventToShortcutParts(event: KeyboardEvent): string[] {
  const parts: string[] = []

  if (event.ctrlKey) {
    parts.push('Ctrl')
  }
  if (event.metaKey) {
    parts.push('Meta')
  }
  if (event.altKey) {
    parts.push('Alt')
  }
  if (event.shiftKey) {
    parts.push('Shift')
  }

  const raw = event.key

  if (!raw) {
    return parts
  }

  const lower = raw.toLowerCase()

  if (
    lower === 'control' ||
    lower === 'ctrl' ||
    lower === 'meta' ||
    lower === 'shift' ||
    lower === 'alt' ||
    lower === 'os'
  ) {
    return parts
  }

  parts.push(normalizeShortcutKey(raw))

  return parts
}

export function eventMatchesShortcut(event: KeyboardEvent, shortcut: CommandShortcut): boolean {
  const eventParts = keyboardEventToShortcutParts(event)
  const shortcutParts = shortcut.keys.map(normalizeShortcutKey).filter(Boolean)

  if (eventParts.length === 0 || shortcutParts.length === 0) {
    return false
  }

  if (eventParts.length !== shortcutParts.length) {
    return false
  }

  const eventSet = new Set(eventParts)

  return shortcutParts.every((part) => eventSet.has(part))
}

export function shortcutSpecificity(shortcut: CommandShortcut): number {
  return shortcut.keys.map(normalizeShortcutKey).filter(Boolean).length
}

export function isShortcutScopeActive(scope: ShortcutScope, routePath: string): boolean {
  if (scope === 'global') {
    return true
  }

  return routePath.includes('/compare/text') || routePath.includes('/merge/text')
}

export function findCommandIdForKeyboardEvent(
  commands: AppCommand[],
  event: KeyboardEvent,
  options: {
    getEffectiveShortcut: (command: AppCommand) => CommandShortcut
    routePath: string
  },
): CommandId | undefined {
  const matches = commands
    .filter((command) => command.enabled)
    .map((command) => {
      const shortcut = options.getEffectiveShortcut(command)

      return { command, shortcut }
    })
    .filter(
      ({ shortcut }) =>
        isShortcutScopeActive(shortcut.scope, options.routePath) &&
        eventMatchesShortcut(event, shortcut),
    )
    .sort((left, right) => shortcutSpecificity(right.shortcut) - shortcutSpecificity(left.shortcut))

  return matches[0]?.command.id
}

export function formatShortcutLabel(shortcut: CommandShortcut): string {
  return shortcut.keys.map(normalizeShortcutKey).filter(Boolean).join('+')
}
