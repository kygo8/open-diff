import { describe, expect, it } from 'vitest'
import { iconForSessionToolbarCommand, sessionToolbarIcons } from './sessionToolbarIcons'

describe('sessionToolbarIcons', () => {
  it('maps common capture-density actions to Lucide icons', () => {
    for (const id of [
      'home',
      'refresh',
      'swap',
      'copy',
      'next-diff',
      'prev-diff',
      'expand',
      'collapse',
      'rules',
      'filters',
    ]) {
      expect(iconForSessionToolbarCommand(id)).toBeDefined()
      expect(sessionToolbarIcons[id]).toBe(iconForSessionToolbarCommand(id))
    }
  })

  it('returns undefined for unknown command ids instead of inventing icons', () => {
    expect(iconForSessionToolbarCommand('not-a-real-toolbar-id')).toBeUndefined()
  })
})
