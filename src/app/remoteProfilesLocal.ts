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

export const remoteProfileDefaultsStorageKey = 'open-diff-remote-profile-defaults'

export interface RemoteProfileDefaults {
  defaultName: string
  defaultProtocol: RemoteProtocol
  defaultRootPath: string
}

const remoteProfileProtocols: readonly RemoteProtocol[] = [
  'ftp',
  'ftps',
  'sftp',
  'web-dav',
  's3',
  'dropbox',
  'one-drive',
  'subversion',
]

export function defaultRemoteProfileDefaults(): RemoteProfileDefaults {
  return {
    defaultName: 'New Profile',
    defaultProtocol: 'sftp',
    defaultRootPath: '/',
  }
}

export function normalizeRemoteProfileProtocol(value: unknown): RemoteProtocol {
  if (typeof value === 'string' && (remoteProfileProtocols as readonly string[]).includes(value)) {
    return value as RemoteProtocol
  }

  return 'sftp'
}

export function loadRemoteProfileDefaults(
  storage: Pick<Storage, 'getItem'> = localStorage,
): RemoteProfileDefaults {
  try {
    const raw = storage.getItem(remoteProfileDefaultsStorageKey)

    if (!raw) {
      return defaultRemoteProfileDefaults()
    }

    const parsed = JSON.parse(raw) as Partial<RemoteProfileDefaults>
    const defaults = defaultRemoteProfileDefaults()
    const name =
      typeof parsed.defaultName === 'string' && parsed.defaultName.trim().length > 0
        ? parsed.defaultName.trim()
        : defaults.defaultName
    const rootPath =
      typeof parsed.defaultRootPath === 'string' && parsed.defaultRootPath.trim().length > 0
        ? parsed.defaultRootPath.trim()
        : defaults.defaultRootPath

    return {
      defaultName: name,
      defaultProtocol: normalizeRemoteProfileProtocol(parsed.defaultProtocol),
      defaultRootPath: rootPath,
    }
  } catch {
    return defaultRemoteProfileDefaults()
  }
}

export function saveRemoteProfileDefaults(
  prefs: RemoteProfileDefaults,
  storage: Pick<Storage, 'setItem'> = localStorage,
): void {
  storage.setItem(
    remoteProfileDefaultsStorageKey,
    JSON.stringify({
      defaultName: prefs.defaultName.trim() || defaultRemoteProfileDefaults().defaultName,
      defaultProtocol: normalizeRemoteProfileProtocol(prefs.defaultProtocol),
      defaultRootPath: prefs.defaultRootPath.trim() || '/',
    }),
  )
}
