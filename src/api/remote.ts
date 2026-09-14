import { invoke } from '@tauri-apps/api/core'

export type RemoteProtocol =
  'ftp' | 'ftps' | 'sftp' | 'web-dav' | 's3' | 'dropbox' | 'one-drive' | 'subversion'

export interface RemoteProfileDraft {
  id: string
  name: string
  protocol: RemoteProtocol
  host: string
  port: number | null
  rootPath: string
  username?: string
  password?: string
}

export interface RemoteProfileView {
  id: string
  name: string
  protocol: RemoteProtocol
  host: string
  port: number | null
  rootPath: string
  implemented: boolean
  uri: string
  username?: string | null
}

export interface RemoteEntry {
  path: string
  kind: 'file' | 'directory'
  size: number
}

export function isImplementedRemoteProtocol(protocol: RemoteProtocol): boolean {
  return protocol === 'sftp' || protocol === 'ftp' || protocol === 'ftps' || protocol === 'web-dav'
}

export function formatRemoteUri(
  protocol: RemoteProtocol,
  profileRef: string,
  remotePath = '/',
): string {
  let scheme: string = protocol

  if (protocol === 'web-dav') {
    scheme = 'webdav'
  } else if (protocol === 'subversion') {
    scheme = 'svn'
  }
  const normalized = remotePath.startsWith('/') ? remotePath : `/${remotePath}`

  return `${scheme}://profile/${profileRef}${normalized}`
}

export interface ParsedRemoteUri {
  protocol: RemoteProtocol
  profileRef: string
  remotePath: string
}

const remoteSchemeToProtocol: Record<string, RemoteProtocol> = {
  ftp: 'ftp',
  ftps: 'ftps',
  sftp: 'sftp',
  webdav: 'web-dav',
  dav: 'web-dav',
  s3: 's3',
  dropbox: 'dropbox',
  onedrive: 'one-drive',
  svn: 'subversion',
  subversion: 'subversion',
}

export function parseRemoteUri(value: string): ParsedRemoteUri | null {
  const trimmed = value.trim()
  const separator = trimmed.indexOf('://')

  if (separator < 0) {
    return null
  }

  const scheme = trimmed.slice(0, separator).toLowerCase()

  if (!(scheme in remoteSchemeToProtocol)) {
    return null
  }

  const protocol = remoteSchemeToProtocol[scheme]

  const rest = trimmed.slice(separator + 3).replace(/^\/+/, '')
  const parts = rest.split('/')
  const first = parts[0] ?? ''
  const second = parts[1] ?? ''
  const remainder = parts.slice(2).join('/')

  if (first.toLowerCase() === 'profile') {
    if (!second) {
      return null
    }

    return {
      protocol,
      profileRef: second,
      remotePath: remainder ? `/${remainder}` : '/',
    }
  }

  if (!first) {
    return null
  }

  if (!second) {
    return {
      protocol,
      profileRef: first,
      remotePath: '/',
    }
  }

  return {
    protocol,
    profileRef: first,
    remotePath: remainder ? `/${second}/${remainder}` : `/${second}`,
  }
}

export function isRemoteUri(value: string): boolean {
  return parseRemoteUri(value) !== null
}

export function remoteParentPath(path: string): string {
  const normalized = path.replace(/\\/g, '/').replace(/\/+$/, '') || '/'

  if (normalized === '/') {
    return '/'
  }

  const index = normalized.lastIndexOf('/')

  return index <= 0 ? '/' : normalized.slice(0, index) || '/'
}

export function remoteEntryName(path: string): string {
  const normalized = path.replace(/\\/g, '/').replace(/\/+$/, '')
  const parts = normalized.split('/').filter(Boolean)

  return parts.at(-1) ?? normalized
}

export function listRemoteProfiles(): Promise<RemoteProfileView[]> {
  return invoke<RemoteProfileView[]>('list_remote_profiles')
}

export function saveRemoteProfile(draft: RemoteProfileDraft): Promise<RemoteProfileView[]> {
  return invoke<RemoteProfileView[]>('save_remote_profile', { draft })
}

export function deleteRemoteProfile(id: string): Promise<RemoteProfileView[]> {
  return invoke<RemoteProfileView[]>('delete_remote_profile', { id })
}

export function testRemoteProfile(id: string): Promise<string> {
  return invoke<string>('test_remote_profile', { id })
}

export function listRemotePath(profileId: string, path: string): Promise<RemoteEntry[]> {
  return invoke<RemoteEntry[]>('list_remote_path', { profileId, path })
}
