import { describe, expect, it } from 'vitest'
import { defaultPathEncodings, resolvePathMetaChipOptions } from './pathMetaChipOptions'

describe('pathMetaChipOptions', () => {
  it('exposes capture-aligned default encodings', () => {
    expect(defaultPathEncodings).toContain('UTF-8')
    expect(defaultPathEncodings).toContain('GBK')
  })

  it('keeps the active label selectable when missing from the list', () => {
    const options = resolvePathMetaChipOptions(
      [{ id: 'plain-text', label: 'Plain Text' }],
      'Everything Else',
    )

    expect(options[0]).toEqual({ id: 'Everything Else', label: 'Everything Else' })
    expect(options.some((item) => item.label === 'Plain Text')).toBe(true)
  })

  it('falls back to string defaults when options are empty', () => {
    const options = resolvePathMetaChipOptions(undefined, 'UTF-8', ['UTF-8', 'GBK'])

    expect(options.map((item) => item.label)).toEqual(['UTF-8', 'GBK'])
  })
})
