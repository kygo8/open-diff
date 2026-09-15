import { describe, expect, it } from 'vitest'
import { isSingleSessionFrame, shouldShowTabStrip } from './shellChrome'

describe('shouldShowTabStrip', () => {
  it('shows when more than one tab is open', () => {
    expect(
      shouldShowTabStrip({
        alwaysShowTabBar: false,
        tabCount: 2,
        soleTabId: 'home',
        soleTabRoute: '/',
      }),
    ).toBe(true)
  })

  it('hides for a sole Home tab even when alwaysShowTabBar is true', () => {
    expect(
      shouldShowTabStrip({
        alwaysShowTabBar: true,
        tabCount: 1,
        soleTabId: 'home',
        soleTabRoute: '/',
      }),
    ).toBe(false)
  })

  it('hides when alwaysShowTabBar is false and a single session tab is open', () => {
    expect(
      shouldShowTabStrip({
        alwaysShowTabBar: false,
        tabCount: 1,
        soleTabId: 'abc',
        soleTabRoute: '/compare/text',
      }),
    ).toBe(false)
  })

  it('shows a sole session tab when alwaysShowTabBar is true', () => {
    expect(
      shouldShowTabStrip({
        alwaysShowTabBar: true,
        tabCount: 1,
        soleTabId: 'abc',
        soleTabRoute: '/compare/text',
      }),
    ).toBe(true)
  })
})

describe('isSingleSessionFrame', () => {
  it('is true for a session route with the tab strip hidden', () => {
    expect(
      isSingleSessionFrame({
        showTabStrip: false,
        routePath: '/compare/text',
      }),
    ).toBe(true)
  })

  it('is false on Home even when the tab strip is hidden', () => {
    expect(
      isSingleSessionFrame({
        showTabStrip: false,
        routePath: '/',
      }),
    ).toBe(false)
  })

  it('is false when the tab strip is visible', () => {
    expect(
      isSingleSessionFrame({
        showTabStrip: true,
        routePath: '/compare/folder',
      }),
    ).toBe(false)
  })
})
