import { describe, expect, it } from 'vitest'
import { buildPathFooterMeta, formatPathFileMetadata, formatPathModifiedAt } from './pathMetadata'

describe('pathMetadata', () => {
  it('formats modified timestamps as local YYYY-MM-DD HH:mm', () => {
    expect(formatPathModifiedAt(undefined)).toBe('')
    expect(formatPathModifiedAt(0)).toBe('')
    expect(formatPathModifiedAt(Date.UTC(2026, 8, 15, 2, 30))).toMatch(/2026-09-1[45] \d{2}:\d{2}/)
  })

  it('formats capture-style timestamps as YYYY/M/D H:mm:ss', () => {
    expect(formatPathModifiedAt(Date.UTC(2026, 6, 1, 6, 11, 24), { captureStyle: true })).toMatch(
      /2026\/7\/1 \d{2}:\d{2}:\d{2}/,
    )
  })

  it('formats file size and date for path footers', () => {
    expect(formatPathFileMetadata(null)).toBe('')
    expect(formatPathFileMetadata({ size: 12, modifiedAtMs: 0 })).toBe('12 bytes')
    expect(formatPathFileMetadata({ size: 42, modifiedAtMs: Date.UTC(2026, 0, 2, 3, 4) })).toMatch(
      /^2026-01-0[12] \d{2}:\d{2} · 42 bytes$/,
    )
  })

  it('builds capture footer meta with format/encoding/line ending', () => {
    expect(buildPathFooterMeta(null)).toBeNull()
    const meta = buildPathFooterMeta(
      { size: 14, modifiedAtMs: Date.UTC(2026, 6, 1, 6, 11, 24) },
      { formatLabel: 'Everything Else', encoding: 'UTF-8', lineEnding: 'MIX' },
    )

    expect(meta?.sizeLabel).toBe('14 bytes')
    expect(meta?.formatLabel).toBe('Everything Else')
    expect(meta?.encoding).toBe('UTF-8')
    expect(meta?.lineEnding).toBe('MIX')
    expect(meta?.modified).toMatch(/2026\/7\/1 \d{2}:\d{2}:\d{2}/)
  })

  it('can include seconds and milliseconds when requested', () => {
    expect(
      formatPathModifiedAt(Date.UTC(2026, 8, 15, 2, 30, 4, 56), { showMilliseconds: true }),
    ).toMatch(/2026-09-1[45] \d{2}:\d{2}:\d{2}\.\d{3}/)
  })
})
