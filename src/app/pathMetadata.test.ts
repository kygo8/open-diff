import { describe, expect, it } from 'vitest'
import { formatPathFileMetadata, formatPathModifiedAt } from './pathMetadata'

describe('pathMetadata', () => {
  it('formats modified timestamps as local YYYY-MM-DD HH:mm', () => {
    expect(formatPathModifiedAt(undefined)).toBe('')
    expect(formatPathModifiedAt(0)).toBe('')
    expect(formatPathModifiedAt(Date.UTC(2026, 8, 15, 2, 30))).toMatch(/2026-09-1[45] \d{2}:\d{2}/)
  })

  it('formats file size and date for path footers', () => {
    expect(formatPathFileMetadata(null)).toBe('')
    expect(formatPathFileMetadata({ size: 12, modifiedAtMs: 0 })).toBe('12 bytes')
    expect(formatPathFileMetadata({ size: 42, modifiedAtMs: Date.UTC(2026, 0, 2, 3, 4) })).toMatch(
      /^2026-01-0[12] \d{2}:\d{2} · 42 bytes$/,
    )
  })
})
