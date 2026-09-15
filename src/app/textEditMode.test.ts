import { describe, expect, it } from 'vitest'
import {
  applyOverwriteTyping,
  isInsertToggleKey,
  shouldHandleOverwriteKeydown,
  toggleTextEditMode,
} from './textEditMode'

describe('textEditMode', () => {
  it('toggles insert and overwrite', () => {
    expect(toggleTextEditMode('insert')).toBe('overwrite')
    expect(toggleTextEditMode('overwrite')).toBe('insert')
    expect(
      isInsertToggleKey({ key: 'Insert', ctrlKey: false, metaKey: false, altKey: false }),
    ).toBe(true)
    expect(isInsertToggleKey({ key: 'Insert', ctrlKey: true, metaKey: false, altKey: false })).toBe(
      false,
    )
  })

  it('replaces the next character when typing in overwrite mode', () => {
    expect(applyOverwriteTyping('abcd', 1, 1, 'X')).toEqual({ text: 'aXcd', caret: 2 })
    expect(applyOverwriteTyping('abcd', 4, 4, 'Z')).toEqual({ text: 'abcdZ', caret: 5 })
    expect(applyOverwriteTyping('abcd', 1, 3, 'X')).toEqual({ text: 'aXd', caret: 2 })
  })

  it('only handles plain character keydowns for overwrite typing', () => {
    expect(
      shouldHandleOverwriteKeydown({
        key: 'a',
        ctrlKey: false,
        metaKey: false,
        altKey: false,
        isComposing: false,
      }),
    ).toBe(true)
    expect(
      shouldHandleOverwriteKeydown({
        key: 'Enter',
        ctrlKey: false,
        metaKey: false,
        altKey: false,
        isComposing: false,
      }),
    ).toBe(false)
  })
})
