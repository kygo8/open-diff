import { describe, expect, it } from 'vitest'
import {
  elapsedSecondsSince,
  formatDifferenceCountPhrase,
  formatEditModePhrase,
  formatImportancePhrase,
  formatLoadTimePhrase,
  isEditModeStatusSource,
  isFolderPairStatusSource,
  isHexSessionStatusSource,
  isMediaSessionStatusSource,
  isPictureSessionStatusSource,
  isTextSessionStatusSource,
  isVersionSessionStatusSource,
  isTableSessionStatusSource,
  padStatusChromePanes,
} from './statusBarPhrases'

describe('statusBarPhrases', () => {
  it('detects text session sources for difference phrasing', () => {
    expect(isTextSessionStatusSource('text-compare')).toBe(true)
    expect(isTextSessionStatusSource('folder-compare')).toBe(false)
  })

  it('detects edit-mode and folder-pair status sources', () => {
    expect(isEditModeStatusSource('text-compare')).toBe(true)
    expect(isEditModeStatusSource('text-edit')).toBe(true)
    expect(isEditModeStatusSource('text-patch')).toBe(false)
    expect(isFolderPairStatusSource('folder-compare')).toBe(true)
    expect(isFolderPairStatusSource('folder-sync')).toBe(true)
    expect(isFolderPairStatusSource('folder-merge')).toBe(true)
    expect(isFolderPairStatusSource('text-compare')).toBe(false)
  })

  it('formats text difference section phrases', () => {
    expect(formatDifferenceCountPhrase(null, 'text-compare')).toBe('≠ -')
    expect(formatDifferenceCountPhrase(1, 'text-compare')).toBe('≠ 1 difference section')
    expect(formatDifferenceCountPhrase(3, 'text-merge')).toBe('≠ 3 difference sections')
    expect(formatDifferenceCountPhrase(2, 'folder-compare')).toBe('Differences: 2')
    expect(formatDifferenceCountPhrase(0, 'hex-compare')).toBe('≠ Same')
    expect(formatDifferenceCountPhrase(3, 'hex-compare')).toBe('≠ Binary differences')
    expect(isHexSessionStatusSource('hex-compare')).toBe(true)
    expect(formatDifferenceCountPhrase(null, 'picture-compare')).toBe('≠ -')
    expect(formatDifferenceCountPhrase(0, 'picture-compare')).toBe('≠ Same')
    expect(formatDifferenceCountPhrase(1, 'picture-compare')).toBe('≠ 1 pixel')
    expect(formatDifferenceCountPhrase(4, 'picture-compare')).toBe('≠ 4 pixels')
    expect(isPictureSessionStatusSource('picture-compare')).toBe(true)
    expect(isMediaSessionStatusSource('media-compare')).toBe(true)
    expect(isVersionSessionStatusSource('version-compare')).toBe(true)
    expect(isTableSessionStatusSource('table-compare')).toBe(true)
    expect(isMediaSessionStatusSource('picture-compare')).toBe(false)
    expect(isVersionSessionStatusSource('media-compare')).toBe(false)
  })

  it('formats importance phrases from important/unimportant counts', () => {
    expect(formatImportancePhrase(null, null)).toBeNull()
    expect(formatImportancePhrase(0, 0)).toBe('Same')
    expect(formatImportancePhrase(2, 0)).toBe('Important Difference')
    expect(formatImportancePhrase(0, 3)).toBe('Unimportant Difference')
    expect(formatImportancePhrase(2, 3)).toBe('2 important, 3 unimportant')
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

  it('pads status chrome panes to a fixed structure', () => {
    expect(
      padStatusChromePanes([{ text: 'Ready' }], 4, () => ({ text: '—', muted: true })),
    ).toEqual([
      { text: 'Ready' },
      { text: '—', muted: true },
      { text: '—', muted: true },
      { text: '—', muted: true },
    ])
  })
})
