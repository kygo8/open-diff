import { flushPromises, mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import RemoteProfileView from './RemoteProfileView.vue'
import type * as remoteApi from '@/api/remote'
import {
  deleteRemoteProfile,
  listRemotePath,
  listRemoteProfiles,
  saveRemoteProfile,
  testRemoteProfile,
} from '@/api/remote'
import { remoteProfilesStorageKey, saveLocalRemoteProfiles } from '@/app/remoteProfilesLocal'

vi.mock('@/api/remote', async (importOriginal) => {
  const actual = await importOriginal<typeof remoteApi>()

  return {
    ...actual,
    listRemoteProfiles: vi.fn().mockRejectedValue(new Error('no backend')),
    saveRemoteProfile: vi.fn().mockRejectedValue(new Error('no backend')),
    deleteRemoteProfile: vi.fn().mockRejectedValue(new Error('no backend')),
    listRemotePath: vi.fn().mockResolvedValue([
      { path: '/apps', kind: 'directory', size: 0 },
      { path: '/readme.txt', kind: 'file', size: 12 },
    ]),
    testRemoteProfile: vi
      .fn()
      .mockResolvedValue('SFTP connected to files.example.com:22 and listed 1 entries'),
  }
})

describe('RemoteProfileView', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    localStorage.clear()
    vi.mocked(listRemoteProfiles).mockClear()
    vi.mocked(saveRemoteProfile).mockClear()
    vi.mocked(deleteRemoteProfile).mockClear()
    vi.mocked(testRemoteProfile).mockClear()
    vi.mocked(listRemotePath).mockClear()
    vi.mocked(listRemoteProfiles).mockRejectedValue(new Error('no backend'))
    vi.mocked(saveRemoteProfile).mockRejectedValue(new Error('no backend'))
    vi.mocked(deleteRemoteProfile).mockRejectedValue(new Error('no backend'))
  })

  it('loads persisted local profiles and does not invent demo hosts', async () => {
    saveLocalRemoteProfiles([
      {
        id: 'stage-sftp',
        name: 'Stage SFTP',
        protocol: 'sftp',
        host: 'stage.example.com',
        port: 22,
        rootPath: '/apps',
      },
    ])

    const wrapper = mount(RemoteProfileView, {
      global: { plugins: [createPinia()] },
    })

    await flushPromises()

    expect(wrapper.find('[data-testid="remote-unavailable-notice"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="remote-profile-list"]').text()).toContain('Stage SFTP')
    expect(wrapper.text()).not.toContain('files.example.com')
    expect(wrapper.text()).not.toContain('dav.example.com')
    expect(wrapper.find('[data-testid="remote-profile-test-status"]').text()).toContain(
      'desktop app',
    )
    expect(wrapper.find('[data-testid="test-remote-profile"]').attributes('disabled')).toBeDefined()
  })

  it('persists edited profiles to localStorage when the desktop backend is unavailable', async () => {
    const wrapper = mount(RemoteProfileView, {
      global: { plugins: [createPinia()] },
    })

    await flushPromises()
    await wrapper.find('[data-testid="new-remote-profile"]').trigger('click')
    await wrapper.find('[data-testid="remote-profile-name-input"]').setValue('Team WebDAV Primary')
    await wrapper.find('[data-testid="remote-profile-protocol-select"]').setValue('web-dav')
    await wrapper.find('[data-testid="remote-profile-host-input"]').setValue('dav2.example.com')
    await wrapper.find('[data-testid="remote-profile-root-input"]').setValue('/shared/v2')
    await wrapper.find('[data-testid="save-remote-profile"]').trigger('click')
    await flushPromises()

    expect(wrapper.find('[data-testid="remote-profile-list"]').text()).toContain(
      'Team WebDAV Primary',
    )
    expect(wrapper.find('[data-testid="remote-profile-summary"]').text()).toContain(
      'dav2.example.com',
    )
    expect(localStorage.getItem(remoteProfilesStorageKey)).toContain('Team WebDAV Primary')
    expect(wrapper.find('[data-testid="test-remote-profile"]').attributes('disabled')).toBeDefined()
  })

  it('creates, tests, and deletes a real FTP profile through the desktop API', async () => {
    Object.defineProperty(window, '__TAURI_INTERNALS__', {
      configurable: true,
      value: {},
    })
    vi.mocked(listRemoteProfiles).mockResolvedValue([])
    vi.mocked(saveRemoteProfile).mockResolvedValue([
      {
        id: 'release-ftp',
        name: 'Release FTP',
        protocol: 'ftp',
        host: 'ftp.example.com',
        port: 21,
        rootPath: '/',
        implemented: true,
        uri: 'ftp://profile/release-ftp/',
      },
    ])
    vi.mocked(testRemoteProfile).mockResolvedValue(
      'FTP connected to ftp.example.com:21 and listed 0 entries',
    )
    vi.mocked(deleteRemoteProfile).mockResolvedValue([])

    const wrapper = mount(RemoteProfileView, {
      global: { plugins: [createPinia()] },
    })

    await flushPromises()

    await wrapper.find('[data-testid="new-remote-profile"]').trigger('click')
    await wrapper.find('[data-testid="remote-profile-name-input"]').setValue('Release FTP')
    await wrapper.find('[data-testid="remote-profile-protocol-select"]').setValue('ftp')
    await wrapper.find('[data-testid="remote-profile-host-input"]').setValue('ftp.example.com')
    await wrapper.find('[data-testid="remote-profile-port-input"]').setValue('21')
    await wrapper.find('[data-testid="remote-profile-username-input"]').setValue('deploy')
    await wrapper.find('[data-testid="remote-profile-password-input"]').setValue('secret')
    await wrapper
      .find('[data-testid="remote-profile-credential-key-input"]')
      .setValue('release-ftp')
    await wrapper.find('[data-testid="save-remote-profile"]').trigger('click')
    await flushPromises()

    expect(saveRemoteProfile).toHaveBeenCalledWith(
      expect.objectContaining({
        name: 'Release FTP',
        protocol: 'ftp',
        host: 'ftp.example.com',
        username: 'deploy',
        password: 'secret',
      }),
    )
    expect(wrapper.find('[data-testid="remote-profile-list"]').text()).toContain('Release FTP')
    expect(
      wrapper.find('[data-testid="test-remote-profile"]').attributes('disabled'),
    ).toBeUndefined()

    await wrapper.find('[data-testid="test-remote-profile"]').trigger('click')
    await flushPromises()

    expect(testRemoteProfile).toHaveBeenCalled()
    expect(wrapper.find('[data-testid="remote-profile-test-status"]').text()).toContain('Connected')

    await wrapper.find('[data-testid="delete-remote-profile"]').trigger('click')
    await flushPromises()

    expect(deleteRemoteProfile).toHaveBeenCalledWith('release-ftp')

    Reflect.deleteProperty(window, '__TAURI_INTERNALS__')
  })

  it('browses a saved profile and applies the selected remote folder as root path', async () => {
    Object.defineProperty(window, '__TAURI_INTERNALS__', {
      configurable: true,
      value: {},
    })
    vi.mocked(listRemoteProfiles).mockResolvedValue([
      {
        id: 'stage-sftp',
        name: 'Stage SFTP',
        protocol: 'sftp',
        host: 'stage.example.com',
        port: 22,
        rootPath: '/',
        implemented: true,
        uri: 'sftp://profile/stage-sftp/',
      },
    ])
    vi.mocked(listRemotePath).mockResolvedValue([
      { path: '/apps', kind: 'directory', size: 0 },
      { path: '/readme.txt', kind: 'file', size: 12 },
    ])

    const wrapper = mount(RemoteProfileView, {
      global: { plugins: [createPinia()] },
    })

    await flushPromises()

    expect(
      wrapper.find('[data-testid="browse-remote-profile"]').attributes('disabled'),
    ).toBeUndefined()

    await wrapper.find('[data-testid="browse-remote-profile"]').trigger('click')
    await flushPromises()

    expect(listRemotePath).toHaveBeenCalledWith('stage-sftp', '/')
    expect(wrapper.find('[data-testid="remote-path-browser"]').exists()).toBe(true)

    await wrapper.find('[data-testid="remote-browse-entry-directory"]').trigger('click')
    await flushPromises()
    await wrapper.find('[data-testid="remote-browse-use-path"]').trigger('click')
    await flushPromises()

    expect(
      (wrapper.find('[data-testid="remote-profile-root-input"]').element as HTMLInputElement).value,
    ).toBe('/apps')
    expect(wrapper.find('[data-testid="remote-path-browser"]').exists()).toBe(false)

    Reflect.deleteProperty(window, '__TAURI_INTERNALS__')
  })

  it('enables save for Dropbox and OneDrive token-based remotes', async () => {
    const wrapper = mount(RemoteProfileView, {
      global: { plugins: [createPinia()] },
    })

    await flushPromises()
    await wrapper.find('[data-testid="new-remote-profile"]').trigger('click')
    await wrapper.find('[data-testid="remote-profile-protocol-select"]').setValue('dropbox')

    const save = wrapper.find('[data-testid="save-remote-profile"]')

    expect(save.attributes('disabled')).toBeUndefined()
    expect(save.text()).toBe('Save')
    expect(save.text()).not.toContain('unimplemented')
    expect(
      wrapper
        .find('[data-testid="remote-profile-protocol-select"] option[value="dropbox"]')
        .attributes('disabled'),
    ).toBeUndefined()
    expect(
      wrapper
        .find('[data-testid="remote-profile-protocol-select"] option[value="one-drive"]')
        .attributes('disabled'),
    ).toBeUndefined()
    expect(
      wrapper
        .find('[data-testid="remote-profile-protocol-select"] option[value="s3"]')
        .attributes('disabled'),
    ).toBeUndefined()
    expect(
      wrapper
        .find('[data-testid="remote-profile-protocol-select"] option[value="subversion"]')
        .attributes('disabled'),
    ).toBeUndefined()
    expect(wrapper.find('[data-testid="remote-oauth-token-hint"]').exists()).toBe(true)
  })
})
