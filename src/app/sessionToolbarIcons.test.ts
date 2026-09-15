import { describe, expect, it } from 'vitest'
import {
  iconForSessionToolbarCommand,
  plateForSessionToolbarCommand,
  sessionToolbarHasSeparatorBefore,
  sessionToolbarIcons,
  sessionToolbarPlates,
  visualForSessionToolbarCommand,
} from './sessionToolbarIcons'

describe('sessionToolbarIcons', () => {
  it('prefers denser CSS glyph plates for common capture actions', () => {
    for (const id of [
      'home',
      'refresh',
      'swap',
      'copy',
      'copy-left',
      'copy-right',
      'next-diff',
      'prev-diff',
      'expand',
      'collapse',
      'filters',
      'rules',
      'stop',
      'peek',
      'sync-now',
      'accept',
      'cancel',
      'merge',
      'same-ok',
      'to-output',
      'select',
      'all',
      'diffs',
      'same',
      'structure',
      'minor',
      'files',
    ]) {
      const plate = plateForSessionToolbarCommand(id)

      expect(plate?.kind).toBe('plate')
      expect(sessionToolbarPlates[id]).toBe(plate)
      expect(visualForSessionToolbarCommand(id)).toEqual(plate)
    }
  })

  it('maps remaining letter-glyph ids to Lucide icons', () => {
    for (const id of [
      'capture',
      'compare',
      'tol',
      'range',
      'blend',
      'meta',
      'edit',
      'undo',
      'redo',
      'cut',
      'paste',
      'delete',
      'syntax',
    ]) {
      expect(iconForSessionToolbarCommand(id)).toBeDefined()
      expect(sessionToolbarIcons[id]).toBe(iconForSessionToolbarCommand(id))
      expect(visualForSessionToolbarCommand(id)?.kind).toBe('icon')
    }
  })

  it('keeps Lucide icons for non-plate mapped actions', () => {
    for (const id of ['sessions', 'format', 'font']) {
      expect(iconForSessionToolbarCommand(id)).toBeDefined()
      expect(visualForSessionToolbarCommand(id)?.kind).toBe('icon')
    }
  })

  it('marks capture-like MainBar group separators after Home and key clusters', () => {
    expect(sessionToolbarHasSeparatorBefore('all', 'home')).toBe(true)
    expect(sessionToolbarHasSeparatorBefore('minor', 'home')).toBe(true)
    expect(sessionToolbarHasSeparatorBefore('expand', 'minor')).toBe(true)
    expect(sessionToolbarHasSeparatorBefore('peek', 'stop')).toBe(true)
    expect(sessionToolbarHasSeparatorBefore('collapse', 'expand')).toBe(false)
    expect(sessionToolbarHasSeparatorBefore('home', undefined)).toBe(false)
  })

  it('returns undefined for unknown command ids instead of inventing icons', () => {
    expect(iconForSessionToolbarCommand('not-a-real-toolbar-id')).toBeUndefined()
    expect(plateForSessionToolbarCommand('not-a-real-toolbar-id')).toBeUndefined()
    expect(visualForSessionToolbarCommand('not-a-real-toolbar-id')).toBeUndefined()
  })
})
