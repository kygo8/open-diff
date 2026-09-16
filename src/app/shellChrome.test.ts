import { describe, expect, it } from 'vitest'
import {
  contextHelpTopic,
  isFolderCompareRoute,
  isFolderishSessionRoute,
  isFolderMergeRoute,
  isHexCompareRoute,
  isPictureCompareRoute,
  isSessionWorkbenchPath,
  isTableCompareRoute,
  isTextishSessionRoute,
  isTextMergeRoute,
  isSingleSessionFrame,
  preferDenseAppChrome,
  sessionSupportsReportSave,
  shouldShowTabStrip,
  supportsFolderStatusLegend,
} from './shellChrome'

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

describe('preferDenseAppChrome', () => {
  it('is true when the tab strip is hidden', () => {
    expect(preferDenseAppChrome({ showTabStrip: false })).toBe(true)
  })

  it('is false when the tab strip is visible', () => {
    expect(preferDenseAppChrome({ showTabStrip: true })).toBe(false)
  })
})

describe('supportsFolderStatusLegend', () => {
  it('is true on Folder Compare, Sync, and Merge routes', () => {
    expect(supportsFolderStatusLegend('/compare/folder')).toBe(true)
    expect(supportsFolderStatusLegend('/sync/folder')).toBe(true)
    expect(supportsFolderStatusLegend('/merge/folder')).toBe(true)
  })

  it('is false on Home and non-folder sessions', () => {
    expect(supportsFolderStatusLegend('/')).toBe(false)
    expect(supportsFolderStatusLegend('/compare/text')).toBe(false)
    expect(supportsFolderStatusLegend('/merge/text')).toBe(false)
    expect(supportsFolderStatusLegend('/settings')).toBe(false)
  })
})

describe('session route helpers', () => {
  it('detects workbench and folderish routes', () => {
    expect(isSessionWorkbenchPath('/')).toBe(false)
    expect(isSessionWorkbenchPath('/compare/folder')).toBe(true)
    expect(isFolderishSessionRoute('/compare/folder')).toBe(true)
    expect(isFolderishSessionRoute('/sync/folder')).toBe(true)
    expect(isFolderishSessionRoute('/merge/folder')).toBe(true)
    expect(isFolderishSessionRoute('/merge/text')).toBe(false)
    expect(isFolderCompareRoute('/compare/folder')).toBe(true)
    expect(isFolderCompareRoute('/sync/folder')).toBe(false)
    expect(isTextishSessionRoute('/compare/text')).toBe(true)
    expect(isTextishSessionRoute('/patch/text')).toBe(true)
    expect(isTextishSessionRoute('/compare/clipboard')).toBe(true)
    expect(isTextishSessionRoute('/compare/folder')).toBe(false)
    expect(isFolderMergeRoute('/merge/folder')).toBe(true)
    expect(isFolderMergeRoute('/merge/text')).toBe(false)
    expect(isTextMergeRoute('/merge/text')).toBe(true)
    expect(isPictureCompareRoute('/compare/picture')).toBe(true)
    expect(isHexCompareRoute('/compare/hex')).toBe(true)
    expect(isTableCompareRoute('/compare/table')).toBe(true)
    expect(sessionSupportsReportSave('/compare/folder')).toBe(true)
    expect(sessionSupportsReportSave('/sync/folder')).toBe(true)
    expect(sessionSupportsReportSave('/compare/text')).toBe(true)
    expect(sessionSupportsReportSave('/compare/picture')).toBe(true)
    expect(sessionSupportsReportSave('/compare/clipboard')).toBe(false)
    expect(sessionSupportsReportSave('/')).toBe(false)
    expect(contextHelpTopic('/compare/hex')).toBe('hex-compare')
    expect(contextHelpTopic('/')).toBe('home')
  })
})
