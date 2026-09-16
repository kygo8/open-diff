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
  hasFolderRoots: true,
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

  it('enables Save Report on sessions that already export reports', () => {
    expect(resolveMenuCommandEnabled('report.save', true, baseCtx)).toBe(true)
    expect(
      resolveMenuCommandEnabled('report.save', true, {
        ...baseCtx,
        routePath: '/sync/folder',
      }),
    ).toBe(true)
    expect(
      resolveMenuCommandEnabled('report.save', true, {
        ...baseCtx,
        routePath: '/compare/text',
      }),
    ).toBe(true)
    expect(
      resolveMenuCommandEnabled('report.save', true, {
        ...baseCtx,
        routePath: '/compare/picture',
      }),
    ).toBe(true)
    expect(
      resolveMenuCommandEnabled('report.save', true, {
        ...baseCtx,
        routePath: '/',
      }),
    ).toBe(false)
  })

  it('keeps inapplicable View commands disabled on Picture, Hex, and Table', () => {
    const pictureCtx = { ...baseCtx, routePath: '/compare/picture' }
    const hexCtx = { ...baseCtx, routePath: '/compare/hex' }
    const tableCtx = { ...baseCtx, routePath: '/compare/table' }

    expect(resolveMenuCommandEnabled('view.showAll', true, pictureCtx)).toBe(false)
    expect(resolveMenuCommandEnabled('view.showDifferences', true, pictureCtx)).toBe(false)
    expect(resolveMenuCommandEnabled('view.toggleMinor', true, pictureCtx)).toBe(true)
    expect(resolveMenuCommandEnabled('diff.next', true, pictureCtx)).toBe(false)
    expect(resolveMenuCommandEnabled('edit.paste', true, pictureCtx)).toBe(false)

    expect(resolveMenuCommandEnabled('view.showAll', true, hexCtx)).toBe(true)
    expect(resolveMenuCommandEnabled('view.toggleMinor', true, hexCtx)).toBe(false)
    expect(resolveMenuCommandEnabled('edit.cut', true, hexCtx)).toBe(false)

    expect(resolveMenuCommandEnabled('view.showAll', true, tableCtx)).toBe(false)
    expect(resolveMenuCommandEnabled('view.toggleMinor', true, tableCtx)).toBe(false)
    expect(resolveMenuCommandEnabled('edit.copy', true, tableCtx)).toBe(false)
  })

  it('keeps Media/Version View filters enabled and disables leftover Clipboard/Patch/Edit/Registry verbs', () => {
    const mediaCtx = { ...baseCtx, routePath: '/compare/media' }
    const versionCtx = { ...baseCtx, routePath: '/compare/version' }
    const clipboardCtx = { ...baseCtx, routePath: '/compare/clipboard' }
    const patchCtx = { ...baseCtx, routePath: '/patch/text' }
    const editCtx = { ...baseCtx, routePath: '/edit/text' }
    const registryCtx = { ...baseCtx, routePath: '/compare/registry' }

    expect(resolveMenuCommandEnabled('view.showAll', true, mediaCtx)).toBe(true)
    expect(resolveMenuCommandEnabled('view.showDifferences', true, mediaCtx)).toBe(true)
    expect(resolveMenuCommandEnabled('view.toggleMinor', true, mediaCtx)).toBe(true)
    expect(resolveMenuCommandEnabled('diff.next', true, mediaCtx)).toBe(true)
    expect(resolveMenuCommandEnabled('session.rules', true, mediaCtx)).toBe(true)
    expect(resolveMenuCommandEnabled('session.settings', true, mediaCtx)).toBe(true)
    expect(resolveMenuCommandEnabled('view.showAll', true, versionCtx)).toBe(true)
    expect(resolveMenuCommandEnabled('diff.previous', true, versionCtx)).toBe(true)
    expect(resolveMenuCommandEnabled('session.rules', true, versionCtx)).toBe(true)
    expect(resolveMenuCommandEnabled('session.settings', true, versionCtx)).toBe(true)

    expect(resolveMenuCommandEnabled('view.showAll', true, clipboardCtx)).toBe(false)
    expect(resolveMenuCommandEnabled('view.toggleMinor', true, clipboardCtx)).toBe(false)
    expect(resolveMenuCommandEnabled('diff.next', true, clipboardCtx)).toBe(false)
    expect(resolveMenuCommandEnabled('edit.paste', true, clipboardCtx)).toBe(false)
    expect(resolveMenuCommandEnabled('edit.copyLeft', true, clipboardCtx)).toBe(false)
    expect(resolveMenuCommandEnabled('session.compare', true, clipboardCtx)).toBe(true)
    expect(resolveMenuCommandEnabled('session.swap', true, clipboardCtx)).toBe(true)
    expect(resolveMenuCommandEnabled('session.reload', true, clipboardCtx)).toBe(true)
    expect(resolveMenuCommandEnabled('session.rules', true, clipboardCtx)).toBe(false)
    expect(resolveMenuCommandEnabled('session.settings', true, clipboardCtx)).toBe(false)
    expect(resolveMenuCommandEnabled('session.export', true, clipboardCtx)).toBe(false)

    expect(resolveMenuCommandEnabled('view.showDifferences', true, patchCtx)).toBe(false)
    expect(resolveMenuCommandEnabled('edit.cut', true, patchCtx)).toBe(false)
    expect(resolveMenuCommandEnabled('diff.previous', true, patchCtx)).toBe(true)
    expect(resolveMenuCommandEnabled('session.compare', true, patchCtx)).toBe(true)
    expect(resolveMenuCommandEnabled('session.swap', true, patchCtx)).toBe(false)
    expect(resolveMenuCommandEnabled('session.settings', true, patchCtx)).toBe(false)

    expect(resolveMenuCommandEnabled('edit.paste', true, editCtx)).toBe(true)
    expect(resolveMenuCommandEnabled('edit.copyLeft', true, editCtx)).toBe(false)
    expect(resolveMenuCommandEnabled('view.showAll', true, editCtx)).toBe(false)
    expect(resolveMenuCommandEnabled('view.toggleMinor', true, editCtx)).toBe(false)
    expect(resolveMenuCommandEnabled('diff.next', true, editCtx)).toBe(false)
    expect(resolveMenuCommandEnabled('session.compare', true, editCtx)).toBe(false)
    expect(resolveMenuCommandEnabled('session.swap', true, editCtx)).toBe(false)
    expect(resolveMenuCommandEnabled('session.settings', true, editCtx)).toBe(false)

    expect(resolveMenuCommandEnabled('view.showAll', true, registryCtx)).toBe(true)
    expect(resolveMenuCommandEnabled('view.expandAll', true, registryCtx)).toBe(true)
    expect(resolveMenuCommandEnabled('view.filters', true, registryCtx)).toBe(true)
    expect(resolveMenuCommandEnabled('diff.next', true, registryCtx)).toBe(true)
    expect(resolveMenuCommandEnabled('session.rules', true, registryCtx)).toBe(false)
    expect(resolveMenuCommandEnabled('session.settings', true, registryCtx)).toBe(false)
    expect(resolveMenuCommandEnabled('actions.open', true, registryCtx)).toBe(false)
    expect(resolveMenuCommandEnabled('actions.exclude', true, registryCtx)).toBe(false)
    expect(resolveMenuCommandEnabled('edit.selectAll', true, registryCtx)).toBe(false)
    expect(resolveMenuCommandEnabled('edit.selectNewer', true, registryCtx)).toBe(false)
    expect(resolveMenuCommandEnabled('view.showSame', true, registryCtx)).toBe(false)
    expect(resolveMenuCommandEnabled('view.toggleMinor', true, registryCtx)).toBe(false)
    expect(resolveMenuCommandEnabled('search.findFilename', true, registryCtx)).toBe(false)
    expect(resolveMenuCommandEnabled('edit.fullRefresh', true, registryCtx)).toBe(false)
  })

  it('disables Next/Previous Difference on Folder Sync and Merge', () => {
    const syncCtx = { ...baseCtx, routePath: '/sync/folder' }
    const mergeCtx = { ...baseCtx, routePath: '/merge/folder' }

    expect(resolveMenuCommandEnabled('diff.next', true, baseCtx)).toBe(true)
    expect(resolveMenuCommandEnabled('diff.previous', true, baseCtx)).toBe(true)
    expect(resolveMenuCommandEnabled('diff.next', true, syncCtx)).toBe(false)
    expect(resolveMenuCommandEnabled('diff.previous', true, syncCtx)).toBe(false)
    expect(resolveMenuCommandEnabled('diff.next', true, mergeCtx)).toBe(false)
    expect(resolveMenuCommandEnabled('diff.previous', true, mergeCtx)).toBe(false)
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
  const textMergeCtx = { ...baseCtx, routePath: '/merge/text' }

  expect(resolveMenuCommandEnabled('view.showChanges', true, mergeCtx)).toBe(true)
  expect(resolveMenuCommandEnabled('view.showConflicts', true, mergeCtx)).toBe(true)
  expect(resolveMenuCommandEnabled('view.centerPane', true, mergeCtx)).toBe(true)
  expect(resolveMenuCommandEnabled('session.compareToOutput', true, mergeCtx)).toBe(true)
  expect(resolveMenuCommandEnabled('view.alwaysShowFolders', true, mergeCtx)).toBe(true)
  expect(resolveMenuCommandEnabled('session.swap', true, mergeCtx)).toBe(true)
  expect(resolveMenuCommandEnabled('merge.nextConflict', true, mergeCtx)).toBe(true)
  expect(resolveMenuCommandEnabled('view.showChanges', true, baseCtx)).toBe(false)
  expect(resolveMenuCommandEnabled('view.centerPane', true, baseCtx)).toBe(false)
  expect(resolveMenuCommandEnabled('session.compareToOutput', true, baseCtx)).toBe(false)
  expect(resolveMenuCommandEnabled('view.centerPane', true, textMergeCtx)).toBe(false)
  expect(resolveMenuCommandEnabled('merge.nextConflict', true, textMergeCtx)).toBe(true)
  expect(resolveMenuCommandEnabled('view.showAll', true, textMergeCtx)).toBe(false)
  expect(resolveMenuCommandEnabled('view.toggleMinor', true, textMergeCtx)).toBe(false)
  expect(resolveMenuCommandEnabled('diff.next', true, textMergeCtx)).toBe(false)
  expect(resolveMenuCommandEnabled('session.swap', true, textMergeCtx)).toBe(false)
  expect(resolveMenuCommandEnabled('session.settings', true, textMergeCtx)).toBe(false)
  expect(resolveMenuCommandEnabled('merge.nextConflict', true, baseCtx)).toBe(false)
  expect(
    resolveMenuCommandEnabled('merge.nextConflict', true, {
      ...baseCtx,
      routePath: '/sync/folder',
    }),
  ).toBe(true)
  expect(
    resolveMenuCommandEnabled('view.showConflicts', true, {
      ...baseCtx,
      routePath: '/sync/folder',
    }),
  ).toBe(true)
  expect(resolveMenuCommandEnabled('view.showConflicts', true, baseCtx)).toBe(false)
})

it('enables Run Script only on the reports session', () => {
  expect(
    resolveMenuCommandEnabled('script.run', true, {
      ...baseCtx,
      routePath: '/reports/scripts',
    }),
  ).toBe(true)
  expect(resolveMenuCommandEnabled('script.run', true, baseCtx)).toBe(false)
  expect(
    resolveMenuCommandEnabled('script.run', true, {
      ...baseCtx,
      routePath: '/compare/text',
    }),
  ).toBe(false)
})

it('disables leftover compare-session verbs on Reports and unused Clipboard Session items', () => {
  const reportsCtx = { ...baseCtx, routePath: '/reports/scripts' }
  const clipboardCtx = { ...baseCtx, routePath: '/compare/clipboard' }

  expect(resolveMenuCommandEnabled('session.compare', true, reportsCtx)).toBe(false)
  expect(resolveMenuCommandEnabled('session.swap', true, reportsCtx)).toBe(false)
  expect(resolveMenuCommandEnabled('session.reload', true, reportsCtx)).toBe(false)
  expect(resolveMenuCommandEnabled('session.rules', true, reportsCtx)).toBe(false)
  expect(resolveMenuCommandEnabled('session.settings', true, reportsCtx)).toBe(false)
  expect(resolveMenuCommandEnabled('session.export', true, reportsCtx)).toBe(false)
  expect(resolveMenuCommandEnabled('view.showAll', true, reportsCtx)).toBe(false)
  expect(resolveMenuCommandEnabled('view.toggleMinor', true, reportsCtx)).toBe(false)
  expect(resolveMenuCommandEnabled('diff.next', true, reportsCtx)).toBe(false)
  expect(resolveMenuCommandEnabled('script.run', true, reportsCtx)).toBe(true)
  expect(resolveMenuCommandEnabled('report.save', true, reportsCtx)).toBe(true)
  expect(resolveMenuCommandEnabled('session.save', true, reportsCtx)).toBe(true)

  expect(resolveMenuCommandEnabled('session.rules', true, clipboardCtx)).toBe(false)
  expect(resolveMenuCommandEnabled('session.settings', true, clipboardCtx)).toBe(false)
  expect(resolveMenuCommandEnabled('session.export', true, clipboardCtx)).toBe(false)
  expect(resolveMenuCommandEnabled('session.compare', true, clipboardCtx)).toBe(true)
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
  expect(
    resolveMenuCommandEnabled('edit.paste', true, {
      ...baseCtx,
      routePath: '/compare/text',
    }),
  ).toBe(false)
  expect(
    resolveMenuCommandEnabled('edit.paste', true, {
      ...baseCtx,
      routePath: '/edit/text',
    }),
  ).toBe(true)
  expect(resolveMenuCommandEnabled('edit.paste', true, baseCtx)).toBe(false)
  expect(
    resolveMenuCommandEnabled('edit.undo', true, {
      ...baseCtx,
      routePath: '/',
    }),
  ).toBe(false)
})

it('gates Compare Parent / Base Folders and keeps New Session global', () => {
  expect(resolveMenuCommandEnabled('session.compareParentFolders', true, baseCtx)).toBe(true)
  expect(
    resolveMenuCommandEnabled('session.compareBaseFolders', true, {
      ...baseCtx,
      routePath: '/sync/folder',
    }),
  ).toBe(true)
  expect(
    resolveMenuCommandEnabled('session.compareBaseFolders', true, {
      ...baseCtx,
      routePath: '/sync/folder',
      hasFolderRoots: false,
    }),
  ).toBe(false)
  expect(resolveMenuCommandEnabled('session.mergeBaseFolders', true, baseCtx)).toBe(true)
  expect(
    resolveMenuCommandEnabled('session.mergeBaseFolders', true, {
      ...baseCtx,
      hasFolderRoots: false,
    }),
  ).toBe(false)
  expect(resolveMenuCommandEnabled('session.compareBaseFolders', true, baseCtx)).toBe(false)
  expect(
    resolveMenuCommandEnabled('session.newSession', true, {
      ...baseCtx,
      routePath: '/',
    }),
  ).toBe(true)
})
