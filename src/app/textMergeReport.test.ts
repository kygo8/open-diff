import { describe, expect, it } from 'vitest'
import { buildTextMergeReportText, defaultTextMergeReportOutputPath } from './textMergeReport'

describe('textMergeReport', () => {
  it('builds a sibling report path next to the merge output', () => {
    expect(defaultTextMergeReportOutputPath('/tmp/out.txt')).toBe('/tmp/text-merge-report.txt')
    expect(defaultTextMergeReportOutputPath('')).toBe('text-merge-report.txt')
  })

  it('serializes conflict rows for export', () => {
    const text = buildTextMergeReportText({
      leftPath: 'left.txt',
      rightPath: 'right.txt',
      centerPath: 'base.txt',
      outputPath: 'out.txt',
      conflictPolicy: 'favorLeft',
      outputLineCount: 4,
      conflicts: [
        {
          line: 2,
          title: 'Conflict A',
          resolved: false,
          base: 'b',
          left: 'l',
          right: 'r',
        },
      ],
    })

    expect(text).toContain('TEXT-MERGE-REPORT')
    expect(text).toContain('unresolved: 1')
    expect(text).toContain('2\topen\tConflict A\tl\tb\tr')
  })
})
