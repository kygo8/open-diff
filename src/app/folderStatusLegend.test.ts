import { describe, expect, it } from 'vitest'
import { folderStatusLegendItems } from './folderStatusLegend'
import { enUS } from '@/i18n/locales/en-US'

describe('folderStatusLegendItems', () => {
  it('covers capture-like folder status vocabulary without proprietary assets', () => {
    expect(folderStatusLegendItems.map((item) => item.id)).toEqual([
      'same',
      'different',
      'orphan',
      'ignored',
      'minor',
    ])

    for (const item of folderStatusLegendItems) {
      expect(enUS.messages[item.labelKey]).toBeTruthy()
      expect(enUS.messages[item.descriptionKey]).toBeTruthy()
      expect(item.tone).toBe(item.id)
    }
  })
})
