/** Unique query keys so duplicate session tabs remount independent Vue state. */

export const SESSION_TAB_QUERY_KEY = 'session'

export function tabRoutePathname(route: string): string {
  const hashIndex = route.indexOf('#')
  const withoutHash = hashIndex >= 0 ? route.slice(0, hashIndex) : route
  const queryIndex = withoutHash.indexOf('?')

  return queryIndex >= 0 ? withoutHash.slice(0, queryIndex) : withoutHash
}

export function withUniqueSessionQuery(
  route: string,
  sessionId: string = crypto.randomUUID(),
): string {
  const url = new URL(route, 'https://open-diff.local')

  url.searchParams.set(SESSION_TAB_QUERY_KEY, sessionId)

  return `${url.pathname}${url.search}${url.hash}`
}

export function isSessionWorkbenchRoute(route: string): boolean {
  const pathname = tabRoutePathname(route)

  return (
    pathname.startsWith('/compare') ||
    pathname.startsWith('/merge') ||
    pathname.startsWith('/sync') ||
    pathname.startsWith('/patch') ||
    pathname.startsWith('/edit')
  )
}
