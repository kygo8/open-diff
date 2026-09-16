/**
 * Layout flags for capture-aligned shell chrome.
 * Native home / single-session frames omit the tab strip; multi-tab keeps it.
 */

export interface TabStripVisibilityInput {
  alwaysShowTabBar: boolean
  tabCount: number
  soleTabId?: string
  soleTabRoute?: string
}

export interface SingleSessionFrameInput {
  showTabStrip: boolean
  routePath: string
}

/** Whether the workspace tab strip should render. */
export function shouldShowTabStrip(input: TabStripVisibilityInput): boolean {
  if (input.tabCount > 1) {
    return true
  }

  if (!input.alwaysShowTabBar) {
    return false
  }

  // home.png has no tab strip — suppress Home-only chrome even when "always show" is on.
  const isHomeOnly =
    input.tabCount === 1 &&
    (input.soleTabId === 'home' || input.soleTabRoute === '/' || input.soleTabRoute === '')

  return !isHomeOnly
}

/**
 * Single open session with tab strip hidden — prefer cleaner title/path chrome
 * closer to native single-window captures.
 */
export function isSingleSessionFrame(input: SingleSessionFrameInput): boolean {
  if (input.showTabStrip) {
    return false
  }

  const path = input.routePath || '/'

  return path !== '/'
}

/**
 * When the tab strip is hidden (sole Home or single session), densify title/menu
 * chrome and suppress redundant web-only top actions to match native frames.
 */
export function preferDenseAppChrome(input: { showTabStrip: boolean }): boolean {
  return !input.showTabStrip
}

/** Folder Compare / Sync / Merge routes that can show the status legend. */
export function supportsFolderStatusLegend(routePath: string): boolean {
  return (
    routePath.includes('/compare/folder') ||
    routePath.includes('/sync') ||
    routePath.includes('/merge/folder')
  )
}

/** True for any open session workbench (not Home or Settings). */
export function isSessionWorkbenchPath(path: string): boolean {
  return path !== '/' && path !== '/settings' && !path.startsWith('/settings/')
}

/** Folder Compare / Sync / Merge routes that share folder-tree menus. */
export function isFolderishSessionRoute(path: string): boolean {
  return path.includes('/folder') || path.includes('/sync')
}

export function isFolderCompareRoute(path: string): boolean {
  return path.includes('/compare/folder')
}

export function isFolderSyncRoute(path: string): boolean {
  return path.includes('/sync')
}

export function isFolderMergeRoute(path: string): boolean {
  return path.includes('/merge/folder')
}

export function isTextMergeRoute(path: string): boolean {
  return path.includes('/merge/text')
}

export function isRegistrySessionRoute(path: string): boolean {
  return path.includes('/registry')
}

export function isPictureCompareRoute(path: string): boolean {
  return path.includes('/compare/picture')
}

export function isHexCompareRoute(path: string): boolean {
  return path.includes('/compare/hex')
}

export function isTableCompareRoute(path: string): boolean {
  return path.includes('/compare/table')
}

/** Sessions that already implement a report export or report dialog. */
export function sessionSupportsReportSave(path: string): boolean {
  return (
    isFolderCompareRoute(path) ||
    isFolderSyncRoute(path) ||
    isFolderMergeRoute(path) ||
    path.includes('/compare/text') ||
    path.includes('/merge/text') ||
    isHexCompareRoute(path) ||
    isTableCompareRoute(path) ||
    isPictureCompareRoute(path) ||
    path.includes('/compare/media') ||
    path.includes('/compare/version') ||
    isRegistrySessionRoute(path) ||
    path.includes('/reports')
  )
}

/** Text Compare / Merge / Edit / Patch / Clipboard routes that implement text edit verbs. */
export function isTextishSessionRoute(path: string): boolean {
  return (
    path.includes('/compare/text') ||
    path.includes('/merge/text') ||
    path.includes('/edit/text') ||
    path.includes('/patch/text') ||
    path.includes('/compare/clipboard')
  )
}

/** Help topic label for the current route (OpenDiff docs, not third-party). */
export function contextHelpTopic(path: string): string {
  if (path.includes('/compare/folder')) {
    return 'folder-compare'
  }

  if (path.includes('/sync')) {
    return 'folder-sync'
  }

  if (path.includes('/merge/folder')) {
    return 'folder-merge'
  }

  if (path.includes('/compare/text')) {
    return 'text-compare'
  }

  if (path.includes('/merge/text')) {
    return 'text-merge'
  }

  if (path.includes('/edit/text')) {
    return 'text-edit'
  }

  if (path.includes('/compare/hex')) {
    return 'hex-compare'
  }

  if (path.includes('/compare/table')) {
    return 'table-compare'
  }

  if (path.includes('/compare/picture')) {
    return 'picture-compare'
  }

  if (path.includes('/compare/media')) {
    return 'media-compare'
  }

  if (path.includes('/compare/registry')) {
    return 'registry-compare'
  }

  if (path.includes('/compare/version')) {
    return 'version-compare'
  }

  if (path.includes('/settings')) {
    return 'options'
  }

  return 'home'
}
