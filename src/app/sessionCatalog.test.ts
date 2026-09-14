import { describe, expect, it } from 'vitest'
import { sessionCatalog } from './sessionCatalog'

describe('sessionCatalog', () => {
  it('marks only sessions with a real UI path as implemented', () => {
    const implemented = sessionCatalog
      .filter((entry) => entry.implemented)
      .map((entry) => entry.type)

    expect(implemented).toEqual([
      'text-compare',
      'folder-compare',
      'folder-sync',
      'text-merge',
      'table-compare',
      'hex-compare',
      'picture-compare',
      'folder-merge',
      'text-edit',
      'text-patch',
      'clipboard-compare',
      'registry-compare',
      'media-compare',
      'version-compare',
      'archive-compare',
      'script',
    ])
    expect(sessionCatalog.every((entry) => entry.route)).toBe(true)
  })

  it('records honest maturity instead of implying every session is complete', () => {
    const byType = Object.fromEntries(sessionCatalog.map((entry) => [entry.type, entry.maturity]))

    expect(byType['text-compare']).toBe('ready')
    expect(byType['folder-compare']).toBe('ready')
    expect(byType['text-edit']).toBe('ready')
    expect(byType['folder-sync']).toBe('ready')
    expect(byType['text-merge']).toBe('ready')
    expect(byType['media-compare']).toBe('ready')
    expect(byType['archive-compare']).toBe('ready')
    expect(byType['hex-compare']).toBe('ready')
    expect(byType['picture-compare']).toBe('ready')
    expect(byType['folder-merge']).toBe('ready')
    expect(byType['table-compare']).toBe('ready')
    expect(byType['clipboard-compare']).toBe('ready')
    expect(byType['version-compare']).toBe('ready')
    expect(byType['text-patch']).toBe('ready')
    expect(byType['registry-compare']).toBe('partial')

    expect(byType.script).toBe('limited')
    expect(sessionCatalog.every((entry) => Boolean(entry.maturity))).toBe(true)
  })
})
