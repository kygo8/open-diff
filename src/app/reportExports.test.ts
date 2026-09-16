import { afterEach, describe, expect, it } from 'vitest'
import {
  clearRecentReportExports,
  loadRecentReportExports,
  loadReportPreferences,
  recordRecentReportExport,
  reportExportsStorageKey,
  reportFileExtension,
  reportPreferencesStorageKey,
  saveRecentReportExports,
  saveReportPreferences,
} from './reportExports'

describe('reportExports', () => {
  afterEach(() => {
    localStorage.removeItem(reportExportsStorageKey)
  })

  it('starts empty and records real export targets', () => {
    expect(loadRecentReportExports()).toEqual([])

    const next = recordRecentReportExport([], {
      name: 'folder-compare.html',
      type: 'HTML',
      stateKey: 'ui.completed',
      target: '/tmp/folder-compare.html',
      createdAt: '2026-09-06T00:00:00.000Z',
    })

    expect(next).toHaveLength(1)
    expect(loadRecentReportExports()[0]?.target).toBe('/tmp/folder-compare.html')
  })

  it('deduplicates by target and keeps newest first', () => {
    saveRecentReportExports([
      {
        name: 'old.html',
        type: 'HTML',
        stateKey: 'ui.completed',
        target: '/tmp/report.html',
        createdAt: '2026-09-01T00:00:00.000Z',
      },
    ])

    const next = recordRecentReportExport(loadRecentReportExports(), {
      name: 'new.html',
      type: 'HTML',
      stateKey: 'ui.completed',
      target: '/tmp/report.html',
      createdAt: '2026-09-06T12:00:00.000Z',
    })

    expect(next).toHaveLength(1)
    expect(next[0]?.name).toBe('new.html')
  })

  it('maps report formats to file extensions', () => {
    expect(reportFileExtension('text')).toBe('txt')
    expect(reportFileExtension('csv')).toBe('csv')
    expect(reportFileExtension('markdown')).toBe('md')
    expect(reportFileExtension('html')).toBe('html')
    expect(reportFileExtension('json')).toBe('json')
    expect(reportFileExtension('xml')).toBe('xml')
  })
})

describe('reportPreferences', () => {
  afterEach(() => {
    localStorage.removeItem(reportPreferencesStorageKey)
    localStorage.removeItem(reportExportsStorageKey)
  })

  it('persists default report format, kind, and leftover toggles', () => {
    saveReportPreferences({
      defaultFormat: 'markdown',
      defaultKind: 'folder',
      openAfterExport: true,
      clearHistoryOnExit: true,
      includeIdentical: false,
      includeOrphans: false,
      includeUnimportant: false,
    })

    expect(loadReportPreferences()).toEqual({
      defaultFormat: 'markdown',
      defaultKind: 'folder',
      openAfterExport: true,
      clearHistoryOnExit: true,
      includeIdentical: false,
      includeOrphans: false,
      includeUnimportant: false,
    })
  })

  it('clears recent report export history', () => {
    recordRecentReportExport([], {
      name: 'a.html',
      type: 'HTML',
      stateKey: 'ui.completed',
      target: '/tmp/a.html',
    })
    expect(loadRecentReportExports()).toHaveLength(1)
    clearRecentReportExports()
    expect(loadRecentReportExports()).toEqual([])
  })
})
