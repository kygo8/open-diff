/**
 * Browser authorize-URL helper for Dropbox/OneDrive using a *user-supplied*
 * client id only. Open Diff does not ship app secrets; production-hardened
 * OAuth (PKCE app registration, refresh-token vaulting) remains Planned.
 */
import type { RemoteProtocol } from '@/api/remote'

/** Dropbox token redirect receiver used by desktop helpers (no client secret). */
export const dropboxTokenRedirectUri = 'https://www.dropbox.com/1/oauth2/redirect_receiver'

/** Microsoft public native-client redirect for fragment tokens (no client secret). */
export const oneDriveTokenRedirectUri =
  'https://login.microsoftonline.com/common/oauth2/nativeclient'

export type OAuthCloudProtocol = Extract<RemoteProtocol, 'dropbox' | 'one-drive'>

export function isOAuthCloudProtocol(protocol: RemoteProtocol): protocol is OAuthCloudProtocol {
  return protocol === 'dropbox' || protocol === 'one-drive'
}

export function buildRemoteAuthorizeUrl(
  protocol: OAuthCloudProtocol,
  clientId: string,
  redirectUri?: string,
): string | null {
  const trimmedClientId = clientId.trim()

  if (!trimmedClientId) {
    return null
  }

  if (protocol === 'dropbox') {
    const redirect = (redirectUri ?? dropboxTokenRedirectUri).trim()
    const params = new URLSearchParams({
      client_id: trimmedClientId,
      response_type: 'token',
      token_access_type: 'offline',
      redirect_uri: redirect,
    })

    return `https://www.dropbox.com/oauth2/authorize?${params.toString()}`
  }

  const redirect = (redirectUri ?? oneDriveTokenRedirectUri).trim()
  const params = new URLSearchParams({
    client_id: trimmedClientId,
    response_type: 'token',
    redirect_uri: redirect,
    scope: 'Files.ReadWrite.All offline_access',
    response_mode: 'fragment',
  })

  return `https://login.microsoftonline.com/common/oauth2/v2.0/authorize?${params.toString()}`
}

/**
 * Pull an access token out of a pasted OAuth redirect URL (fragment or query)
 * or return a bare token string unchanged.
 */
export function extractOAuthAccessToken(pasted: string): string | null {
  const trimmed = pasted.trim()

  if (!trimmed) {
    return null
  }

  if (!trimmed.includes('://') && !trimmed.includes('access_token=')) {
    return trimmed
  }

  try {
    const hashIndex = trimmed.indexOf('#')
    const queryIndex = trimmed.indexOf('?')
    let search = ''

    if (hashIndex >= 0) {
      search = trimmed.slice(hashIndex + 1)
    } else if (queryIndex >= 0) {
      search = trimmed.slice(queryIndex + 1)
    }

    if (!search) {
      return null
    }

    const params = new URLSearchParams(search)
    const token = params.get('access_token')?.trim()

    if (!token) {
      return null
    }

    return token
  } catch {
    return null
  }
}
