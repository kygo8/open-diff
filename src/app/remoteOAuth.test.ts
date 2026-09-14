import { describe, expect, it } from 'vitest'
import {
  buildRemoteAuthorizeUrl,
  dropboxTokenRedirectUri,
  extractOAuthAccessToken,
  oneDriveTokenRedirectUri,
} from './remoteOAuth'

describe('remoteOAuth', () => {
  it('builds Dropbox and OneDrive authorize URLs from a user client id', () => {
    const dropbox = buildRemoteAuthorizeUrl('dropbox', 'dbx-app-id')
    const oneDrive = buildRemoteAuthorizeUrl('one-drive', 'ms-app-id')

    expect(dropbox).toContain('https://www.dropbox.com/oauth2/authorize?')
    expect(dropbox).toContain('client_id=dbx-app-id')
    expect(dropbox).toContain(`redirect_uri=${encodeURIComponent(dropboxTokenRedirectUri)}`)
    expect(oneDrive).toContain('login.microsoftonline.com/common/oauth2/v2.0/authorize')
    expect(oneDrive).toContain('client_id=ms-app-id')
    expect(oneDrive).toContain(`redirect_uri=${encodeURIComponent(oneDriveTokenRedirectUri)}`)
    expect(buildRemoteAuthorizeUrl('dropbox', '   ')).toBeNull()
  })

  it('extracts access tokens from redirect URLs or bare paste', () => {
    expect(
      extractOAuthAccessToken(
        'https://www.dropbox.com/1/oauth2/redirect_receiver#access_token=tok123&token_type=bearer',
      ),
    ).toBe('tok123')
    expect(
      extractOAuthAccessToken(
        'https://login.microsoftonline.com/common/oauth2/nativeclient#access_token=graph-tok&expires_in=3600',
      ),
    ).toBe('graph-tok')
    expect(extractOAuthAccessToken('plain-token-value')).toBe('plain-token-value')
    expect(extractOAuthAccessToken('https://example.com/callback?code=abc')).toBeNull()
  })
})
