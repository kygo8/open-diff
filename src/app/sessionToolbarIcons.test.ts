import { describe, expect, it } from 'vitest'
import {
  iconForSessionToolbarCommand,
  plateForSessionToolbarCommand,
  sessionToolbarHasSeparatorBefore,
  sessionToolbarIcons,
  sessionToolbarPlates,
  visualForSessionToolbarCommand,
} from './sessionToolbarIcons'

const plateIds = [
  'home',
  'sessions',
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
  'context',
  'format',
  'font',
  'goto',
  'wrap',
  'favor-left',
  'favor-right',
  'conflict',
  'left',
  'center',
  'right',
  'capture',
  'compare',
  'tol',
  'range',
  'blend',
  'meta',
  'play2',
  'edit',
  'undo',
  'redo',
  'cut',
  'paste',
  'delete',
  'syntax',
] as const

describe('sessionToolbarIcons', () => {
  it('prefers denser CSS glyph plates for capture MainBar actions including pass-2 leftovers', () => {
    for (const id of plateIds) {
      const plate = plateForSessionToolbarCommand(id)

      expect(plate?.kind).toBe('plate')
      expect(sessionToolbarPlates[id]).toBe(plate)
      expect(visualForSessionToolbarCommand(id)).toEqual(plate)
    }
  })

  it('keeps Lucide icons as fallbacks for plate-covered ids', () => {
    for (const id of ['sessions', 'format', 'font', 'capture', 'tol', 'edit', 'syntax'] as const) {
      expect(iconForSessionToolbarCommand(id)).toBeDefined()
      expect(sessionToolbarIcons[id]).toBe(iconForSessionToolbarCommand(id))
    }
  })

  it('marks capture-like MainBar group separators after Home and key clusters', () => {
    expect(sessionToolbarHasSeparatorBefore('all', 'home')).toBe(true)
    expect(sessionToolbarHasSeparatorBefore('minor', 'home')).toBe(true)
    expect(sessionToolbarHasSeparatorBefore('expand', 'minor')).toBe(true)
    expect(sessionToolbarHasSeparatorBefore('peek', 'stop')).toBe(true)
    expect(sessionToolbarHasSeparatorBefore('collapse', 'expand')).toBe(false)
    expect(sessionToolbarHasSeparatorBefore('home', undefined)).toBe(false)
    // Capture text MainBar: Context+Minor and Rules+Format stay adjacent
    expect(sessionToolbarHasSeparatorBefore('minor', 'context')).toBe(false)
    expect(sessionToolbarHasSeparatorBefore('format', 'rules')).toBe(false)
    expect(sessionToolbarHasSeparatorBefore('context', 'same')).toBe(true)
    // Capture picture MainBar: Tol+Range+Blend adjacent
    expect(sessionToolbarHasSeparatorBefore('range', 'tol')).toBe(false)
    expect(sessionToolbarHasSeparatorBefore('blend', 'range')).toBe(false)
  })

  it('returns undefined for unknown command ids instead of inventing icons', () => {
    expect(iconForSessionToolbarCommand('not-a-real-toolbar-id')).toBeUndefined()
    expect(plateForSessionToolbarCommand('not-a-real-toolbar-id')).toBeUndefined()
    expect(visualForSessionToolbarCommand('not-a-real-toolbar-id')).toBeUndefined()
  })
})
