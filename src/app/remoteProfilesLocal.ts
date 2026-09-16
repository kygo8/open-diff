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
  connectionTimeoutSeconds?: number
  passiveFtp?: boolean
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
  defaultHost: string
  defaultRootPath: string
  defaultUsername: string
  defaultPort: number | null
  connectionTimeoutSeconds: number
  passiveFtp: boolean
  /** New profiles leave username empty even when a default username is stored. */
  anonymousLogin: boolean
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
    defaultHost: '',
    defaultRootPath: '/',
    defaultUsername: '',
    defaultPort: null,
    connectionTimeoutSeconds: 30,
    passiveFtp: true,
    anonymousLogin: false,
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

    const host = typeof parsed.defaultHost === 'string' ? parsed.defaultHost.trim() : ''
    const username = typeof parsed.defaultUsername === 'string' ? parsed.defaultUsername.trim() : ''
    const port =
      typeof parsed.defaultPort === 'number' && Number.isFinite(parsed.defaultPort)
        ? Math.max(0, Math.round(parsed.defaultPort))
        : null
    const timeout =
      typeof parsed.connectionTimeoutSeconds === 'number' &&
      Number.isFinite(parsed.connectionTimeoutSeconds)
        ? Math.max(1, Math.round(parsed.connectionTimeoutSeconds))
        : defaults.connectionTimeoutSeconds

    return {
      defaultName: name,
      defaultProtocol: normalizeRemoteProfileProtocol(parsed.defaultProtocol),
      defaultHost: host,
      defaultRootPath: rootPath,
      defaultUsername: username,
      defaultPort: port,
      connectionTimeoutSeconds: timeout,
      passiveFtp: parsed.passiveFtp !== false,
      anonymousLogin: Boolean(parsed.anonymousLogin),
    }
  } catch {
    return defaultRemoteProfileDefaults()
  }
}

export function applyRemoteProfileConnectionDefaults(
  profile: LocalRemoteProfile,
  defaults: RemoteProfileDefaults = loadRemoteProfileDefaults(),
): LocalRemoteProfile {
  return {
    ...profile,
    connectionTimeoutSeconds:
      typeof profile.connectionTimeoutSeconds === 'number' &&
      Number.isFinite(profile.connectionTimeoutSeconds)
        ? Math.max(1, Math.round(profile.connectionTimeoutSeconds))
        : defaults.connectionTimeoutSeconds,
    passiveFtp: profile.passiveFtp ?? defaults.passiveFtp,
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
      defaultHost: prefs.defaultHost.trim(),
      defaultRootPath: prefs.defaultRootPath.trim() || '/',
      defaultUsername: prefs.defaultUsername.trim(),
      defaultPort:
        typeof prefs.defaultPort === 'number' && Number.isFinite(prefs.defaultPort)
          ? Math.max(0, Math.round(prefs.defaultPort))
          : null,
      connectionTimeoutSeconds:
        typeof prefs.connectionTimeoutSeconds === 'number' &&
        Number.isFinite(prefs.connectionTimeoutSeconds)
          ? Math.max(1, Math.round(prefs.connectionTimeoutSeconds))
          : defaultRemoteProfileDefaults().connectionTimeoutSeconds,
      passiveFtp: prefs.passiveFtp,
      anonymousLogin: prefs.anonymousLogin,
    }),
  )
}
