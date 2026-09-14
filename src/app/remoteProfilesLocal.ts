import type { RemoteProtocol } from '@/api/remote'

export const remoteProfilesStorageKey = 'open-diff-remote-profiles'

export interface LocalRemoteProfile {
  id: string
  name: string
  protocol: RemoteProtocol
  host: string
  port: number | null
  rootPath: string
  username?: string
  /** User-configured OAuth app client id for Dropbox/OneDrive browser helper. */
  oauthClientId?: string
}

export function loadLocalRemoteProfiles(): LocalRemoteProfile[] {
  try {
    const parsed = JSON.parse(localStorage.getItem(remoteProfilesStorageKey) ?? 'null') as unknown

    if (!Array.isArray(parsed)) {
      return []
    }

    return parsed.filter(isLocalRemoteProfile)
  } catch {
    return []
  }
}

export function saveLocalRemoteProfiles(profiles: LocalRemoteProfile[]): void {
  localStorage.setItem(remoteProfilesStorageKey, JSON.stringify(profiles))
}

export function upsertLocalRemoteProfile(
  profiles: LocalRemoteProfile[],
  next: LocalRemoteProfile,
): LocalRemoteProfile[] {
  const copy = [...profiles]
  const index = copy.findIndex((profile) => profile.id === next.id)

  if (index >= 0) {
    copy.splice(index, 1, next)
  } else {
    copy.push(next)
  }

  saveLocalRemoteProfiles(copy)

  return copy
}

export function deleteLocalRemoteProfile(
  profiles: LocalRemoteProfile[],
  id: string,
): LocalRemoteProfile[] {
  const next = profiles.filter((profile) => profile.id !== id)

  saveLocalRemoteProfiles(next)

  return next
}

function isLocalRemoteProfile(value: unknown): value is LocalRemoteProfile {
  if (!value || typeof value !== 'object') {
    return false
  }

  const profile = value as Partial<LocalRemoteProfile>

  return (
    typeof profile.id === 'string' &&
    typeof profile.name === 'string' &&
    typeof profile.protocol === 'string' &&
    typeof profile.host === 'string' &&
    (typeof profile.port === 'number' || profile.port === null) &&
    typeof profile.rootPath === 'string'
  )
}
