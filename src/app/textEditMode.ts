export type TextEditMode = 'insert' | 'overwrite'

export function toggleTextEditMode(mode: TextEditMode): TextEditMode {
  return mode === 'insert' ? 'overwrite' : 'insert'
}

export function isInsertToggleKey(
  event: Pick<KeyboardEvent, 'key' | 'ctrlKey' | 'metaKey' | 'altKey'>,
): boolean {
  return event.key === 'Insert' && !event.ctrlKey && !event.metaKey && !event.altKey
}

/** Apply typed text using overwrite semantics when there is no selection. */
export function applyOverwriteTyping(
  text: string,
  selectionStart: number,
  selectionEnd: number,
  insert: string,
): { text: string; caret: number } {
  if (!insert) {
    return { text, caret: selectionStart }
  }

  const start = Math.max(0, Math.min(selectionStart, text.length))
  const end = Math.max(start, Math.min(selectionEnd, text.length))

  if (start !== end) {
    const next = text.slice(0, start) + insert + text.slice(end)

    return { text: next, caret: start + insert.length }
  }

  const deleteEnd = Math.min(text.length, start + insert.length)
  const next = text.slice(0, start) + insert + text.slice(deleteEnd)

  return { text: next, caret: start + insert.length }
}

export function shouldHandleOverwriteKeydown(
  event: Pick<KeyboardEvent, 'key' | 'ctrlKey' | 'metaKey' | 'altKey' | 'isComposing'>,
): boolean {
  if (event.isComposing || event.ctrlKey || event.metaKey || event.altKey) {
    return false
  }

  if (event.key.length !== 1) {
    return false
  }

  return true
}
