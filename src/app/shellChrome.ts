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
    routePath.includes('/merge')
  )
}
