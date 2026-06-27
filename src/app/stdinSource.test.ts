import { describe, expect, it } from 'vitest'
import { createStdinTextSource } from './stdinSource'

describe('createStdinTextSource', () => {
  it('creates a text input source from standard input text', () => {
    expect(createStdinTextSource('hello from stdin')).toEqual({
      kind: 'stdin-text',
      title: 'Standard Input',
      text: 'hello from stdin',
      readonly: true,
    })
  })

  it('uses a custom label when provided', () => {
    expect(createStdinTextSource('left', 'Left stdin')).toMatchObject({
      title: 'Left stdin',
    })
  })

  it('rejects empty standard input text', () => {
    expect(() => createStdinTextSource('')).toThrow('Standard input is empty.')
  })
})
