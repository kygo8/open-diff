import { describe, expect, it } from 'vitest'
import {
  MENU_COMMANDS_REQUIRING_SELECTION,
  applySelectionEnablement,
  resolveMenuCommandEnabled,
} from './menuTables'

const baseCtx = {
  routePath: '/compare/folder',
  hasSelection: false,
  canGoBack: false,
  canGoForward: false,
  canCloseTab: true,
  hasLockableSession: false,
}

describe('menuTables', () => {
  it('enables folder View presets only on Folder Compare', () => {
    expect(resolveMenuCommandEnabled('view.showOrphans', true, baseCtx)).toBe(true)
    expect(
      resolveMenuCommandEnabled('view.suppressFilters', true, {
        ...baseCtx,
        routePath: '/sync/folder',
      }),
    ).toBe(false)
  })

  it('enables Session Info on folderish routes with Ctrl+I target', () => {
    expect(resolveMenuCommandEnabled('session.info', true, baseCtx)).toBe(true)
    expect(
      resolveMenuCommandEnabled('session.info', true, {
        ...baseCtx,
        routePath: '/compare/text',
      }),
    ).toBe(false)
  })

  it('limits Folder Compare Report to Folder Compare', () => {
    expect(resolveMenuCommandEnabled('report.save', true, baseCtx)).toBe(true)
    expect(
      resolveMenuCommandEnabled('report.save', true, {
        ...baseCtx,
        routePath: '/sync/folder',
      }),
    ).toBe(false)
  })

  it('honestly disables selection Actions when nothing is selected', () => {
    expect(MENU_COMMANDS_REQUIRING_SELECTION.has('actions.rename')).toBe(true)
    expect(applySelectionEnablement('actions.rename', true, false)).toBe(false)
    expect(applySelectionEnablement('actions.rename', true, true)).toBe(true)
    expect(applySelectionEnablement('actions.newFolder', true, false)).toBe(true)
  })

  it('keeps Select Newer on Folder Compare / Merge only', () => {
    expect(resolveMenuCommandEnabled('edit.selectNewer', true, baseCtx)).toBe(true)
    expect(
      resolveMenuCommandEnabled('edit.selectNewer', true, {
        ...baseCtx,
        routePath: '/sync/folder',
      }),
    ).toBe(false)
  })
})

it('enables deeper View presets and structure modes on Folder Compare', () => {
  expect(resolveMenuCommandEnabled('view.showLeftNewer', true, baseCtx)).toBe(true)
  expect(resolveMenuCommandEnabled('view.showDifferencesNoOrphans', true, baseCtx)).toBe(true)
  expect(resolveMenuCommandEnabled('view.ignoreFolderStructure', true, baseCtx)).toBe(true)
  expect(resolveMenuCommandEnabled('view.alwaysShowFolders', true, baseCtx)).toBe(true)
  expect(
    resolveMenuCommandEnabled('view.showLeftOrphans', true, {
      ...baseCtx,
      routePath: '/sync/folder',
    }),
  ).toBe(false)
  expect(
    resolveMenuCommandEnabled('view.onlyCompareFiles', true, {
      ...baseCtx,
      routePath: '/merge/folder',
    }),
  ).toBe(true)
})

it('enables Merge View Show Changes / Conflicts / Center Pane and Compare to Output only on Folder Merge', () => {
  const mergeCtx = { ...baseCtx, routePath: '/merge/folder' }

  expect(resolveMenuCommandEnabled('view.showChanges', true, mergeCtx)).toBe(true)
  expect(resolveMenuCommandEnabled('view.showConflicts', true, mergeCtx)).toBe(true)
  expect(resolveMenuCommandEnabled('view.centerPane', true, mergeCtx)).toBe(true)
  expect(resolveMenuCommandEnabled('session.compareToOutput', true, mergeCtx)).toBe(true)
  expect(resolveMenuCommandEnabled('view.alwaysShowFolders', true, mergeCtx)).toBe(true)
  expect(resolveMenuCommandEnabled('view.showChanges', true, baseCtx)).toBe(false)
  expect(resolveMenuCommandEnabled('view.centerPane', true, baseCtx)).toBe(false)
  expect(resolveMenuCommandEnabled('session.compareToOutput', true, baseCtx)).toBe(false)
})

it('enables Show All / Differences / Minor and Filters only where they run', () => {
  expect(resolveMenuCommandEnabled('view.showAll', true, baseCtx)).toBe(true)
  expect(resolveMenuCommandEnabled('view.showDifferences', true, baseCtx)).toBe(true)
  expect(resolveMenuCommandEnabled('view.toggleMinor', true, baseCtx)).toBe(true)
  expect(resolveMenuCommandEnabled('view.filters', true, baseCtx)).toBe(true)
  expect(
    resolveMenuCommandEnabled('view.showAll', true, {
      ...baseCtx,
      routePath: '/',
    }),
  ).toBe(false)
  expect(
    resolveMenuCommandEnabled('view.filters', true, {
      ...baseCtx,
      routePath: '/compare/text',
    }),
  ).toBe(false)
  expect(
    resolveMenuCommandEnabled('edit.copyLeft', true, {
      ...baseCtx,
      routePath: '/compare/text',
    }),
  ).toBe(true)
  expect(resolveMenuCommandEnabled('edit.copyLeft', true, baseCtx)).toBe(false)
})

it('gates Compare Parent / Base Folders and keeps New Session global', () => {
  expect(resolveMenuCommandEnabled('session.compareParentFolders', true, baseCtx)).toBe(true)
  expect(
    resolveMenuCommandEnabled('session.compareBaseFolders', true, {
      ...baseCtx,
      routePath: '/sync/folder',
    }),
  ).toBe(true)
  expect(resolveMenuCommandEnabled('session.compareBaseFolders', true, baseCtx)).toBe(false)
  expect(
    resolveMenuCommandEnabled('session.newSession', true, {
      ...baseCtx,
      routePath: '/',
    }),
  ).toBe(true)
})
