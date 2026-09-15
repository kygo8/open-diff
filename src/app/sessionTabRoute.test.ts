import { describe, expect, it } from 'vitest'
import {
  isSessionWorkbenchRoute,
  tabRoutePathname,
  withUniqueSessionQuery,
} from './sessionTabRoute'

describe('sessionTabRoute', () => {
  it('strips query and hash for pathname matching', () => {
    expect(tabRoutePathname('/compare/hex?session=abc#top')).toBe('/compare/hex')
    expect(tabRoutePathname('/compare/folder')).toBe('/compare/folder')
  })

  it('appends a unique session query for remount isolation', () => {
    const first = withUniqueSessionQuery('/compare/text', 'tab-1')
    const second = withUniqueSessionQuery('/compare/text', 'tab-2')

    expect(first).toBe('/compare/text?session=tab-1')
    expect(second).toBe('/compare/text?session=tab-2')
    expect(first).not.toBe(second)
  })

  it('preserves existing query keys while setting session', () => {
    expect(withUniqueSessionQuery('/compare/folder?focus=left', 'x')).toBe(
      '/compare/folder?focus=left&session=x',
    )
  })

  it('recognizes workbench session routes', () => {
    expect(isSessionWorkbenchRoute('/compare/hex')).toBe(true)
    expect(isSessionWorkbenchRoute('/merge/text?session=1')).toBe(true)
    expect(isSessionWorkbenchRoute('/settings')).toBe(false)
    expect(isSessionWorkbenchRoute('/')).toBe(false)
  })
})
