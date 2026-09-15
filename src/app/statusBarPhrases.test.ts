import { describe, expect, it } from 'vitest'
import {
  elapsedSecondsSince,
  formatDifferenceCountPhrase,
  formatEditModePhrase,
  formatLoadTimePhrase,
  isEditModeStatusSource,
  isTextSessionStatusSource,
} from './statusBarPhrases'

describe('statusBarPhrases', () => {
  it('detects text session sources for difference phrasing', () => {
    expect(isTextSessionStatusSource('text-compare')).toBe(true)
    expect(isTextSessionStatusSource('folder-compare')).toBe(false)
  })

  it('detects edit-mode status sources', () => {
    expect(isEditModeStatusSource('text-compare')).toBe(true)
    expect(isEditModeStatusSource('text-edit')).toBe(true)
    expect(isEditModeStatusSource('text-patch')).toBe(false)
  })

  it('formats text difference section phrases', () => {
    expect(formatDifferenceCountPhrase(null, 'text-compare')).toBe('≠ -')
    expect(formatDifferenceCountPhrase(1, 'text-compare')).toBe('≠ 1 difference section')
    expect(formatDifferenceCountPhrase(3, 'text-merge')).toBe('≠ 3 difference sections')
    expect(formatDifferenceCountPhrase(2, 'folder-compare')).toBe('Differences: 2')
  })

  it('formats load time and edit mode phrases', () => {
    expect(formatLoadTimePhrase(0.03)).toBe('Load time: 0.03 seconds')
    expect(formatEditModePhrase('insert')).toBe('Insert')
    expect(formatEditModePhrase('overwrite')).toBe('Overwrite')
    expect(formatEditModePhrase(null)).toBeNull()
  })

  it('computes elapsed seconds', () => {
    expect(elapsedSecondsSince(1000, 2500)).toBe(1.5)
  })
})
