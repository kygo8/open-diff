import { afterEach, describe, expect, it } from 'vitest'
import {
  deleteLocalRemoteProfile,
  loadLocalRemoteProfiles,
  loadRemoteProfileDefaults,
  remoteProfileDefaultsStorageKey,
  remoteProfilesStorageKey,
  saveLocalRemoteProfiles,
  saveRemoteProfileDefaults,
  upsertLocalRemoteProfile,
} from './remoteProfilesLocal'

describe('remoteProfilesLocal', () => {
  afterEach(() => {
    localStorage.removeItem(remoteProfilesStorageKey)
  })

  it('persists remote profiles without inventing demo entries', () => {
    expect(loadLocalRemoteProfiles()).toEqual([])

    const saved = upsertLocalRemoteProfile([], {
      id: 'stage-sftp',
      name: 'Stage SFTP',
      protocol: 'sftp',
      host: 'stage.example.com',
      port: 22,
      rootPath: '/apps',
      username: 'deploy',
    })

    expect(saved).toHaveLength(1)
    expect(loadLocalRemoteProfiles()).toEqual(saved)
    const stored = JSON.parse(localStorage.getItem(remoteProfilesStorageKey) ?? '[]') as Record<
      string,
      unknown
    >[]

    expect(stored[0]).not.toHaveProperty('password')
  })

  it('updates and deletes persisted profiles by id', () => {
    saveLocalRemoteProfiles([
      {
        id: 'a',
        name: 'A',
        protocol: 'ftp',
        host: 'a.example.com',
        port: 21,
        rootPath: '/',
      },
    ])

    const updated = upsertLocalRemoteProfile(loadLocalRemoteProfiles(), {
      id: 'a',
      name: 'A2',
      protocol: 'ftp',
      host: 'a2.example.com',
      port: 2121,
      rootPath: '/pub',
    })

    expect(updated[0]?.name).toBe('A2')
    expect(deleteLocalRemoteProfile(updated, 'a')).toEqual([])
    expect(loadLocalRemoteProfiles()).toEqual([])
  })
})

describe('remoteProfileDefaults', () => {
  afterEach(() => {
    localStorage.removeItem(remoteProfileDefaultsStorageKey)
  })

  it('persists default name, protocol, and root path', () => {
    saveRemoteProfileDefaults({
      defaultName: 'Lab Profile',
      defaultProtocol: 'ftps',
      defaultRootPath: '/srv',
    })

    expect(loadRemoteProfileDefaults()).toEqual({
      defaultName: 'Lab Profile',
      defaultProtocol: 'ftps',
      defaultRootPath: '/srv',
    })
  })
})
