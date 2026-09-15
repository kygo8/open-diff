import { describe, expect, it } from 'vitest'
import {
  elapsedSecondsSince,
  formatDifferenceCountPhrase,
  formatLoadTimePhrase,
  isTextSessionStatusSource,
} from './statusBarPhrases'

describe('statusBarPhrases', () => {
  it('keeps generic Differences wording for non-text sources', () => {
    expect(formatDifferenceCountPhrase(null, 'workspace')).toBe('Differences: -')
    expect(formatDifferenceCountPhrase(3, 'folder-compare')).toBe('Differences: 3')
  })

  it('uses difference section wording for text sessions', () => {
    expect(isTextSessionStatusSource('text-compare')).toBe(true)
    expect(formatDifferenceCountPhrase(null, 'text-compare')).toBe('≠ -')
    expect(formatDifferenceCountPhrase(1, 'text-compare')).toBe('≠ 1 difference section')
    expect(formatDifferenceCountPhrase(4, 'text-merge')).toBe('≠ 4 difference sections')
  })

  it('formats load time with two decimal places', () => {
    expect(formatLoadTimePhrase(0.03)).toBe('Load time: 0.03 seconds')
    expect(formatLoadTimePhrase(1)).toBe('Load time: 1.00 seconds')
  })

  it('measures elapsed seconds from a start mark', () => {
    expect(elapsedSecondsSince(1000, 1042)).toBeCloseTo(0.042, 5)
  })
})
