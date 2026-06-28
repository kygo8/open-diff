import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import RemoteProfileView from './RemoteProfileView.vue'

describe('RemoteProfileView', () => {
  it('renders built-in remote profiles without plaintext credentials', () => {
    const wrapper = mount(RemoteProfileView)

    expect(wrapper.text()).toContain('Remote Profiles')
    expect(wrapper.find('[data-testid="remote-profile-list"]').text()).toContain('Production SFTP')
    expect(wrapper.find('[data-testid="remote-profile-list"]').text()).toContain('Team WebDAV')
    expect(wrapper.text()).toContain('Credential reference')
    expect(wrapper.text()).toContain('System keychain')
    expect(wrapper.text()).not.toContain('password')
    expect(wrapper.text()).not.toContain('token')
  })

  it('selects and edits a remote profile', async () => {
    const wrapper = mount(RemoteProfileView)

    await wrapper.find('[data-testid="select-remote-profile-team-webdav"]').trigger('click')
    await wrapper.find('[data-testid="remote-profile-name-input"]').setValue('Team WebDAV Primary')
    await wrapper.find('[data-testid="remote-profile-host-input"]').setValue('dav2.example.com')
    await wrapper.find('[data-testid="remote-profile-root-input"]').setValue('/shared/v2')
    await wrapper.find('[data-testid="save-remote-profile"]').trigger('click')

    expect(wrapper.find('[data-testid="remote-profile-list"]').text()).toContain(
      'Team WebDAV Primary',
    )
    expect(wrapper.find('[data-testid="remote-profile-summary"]').text()).toContain(
      'dav2.example.com',
    )
    expect(wrapper.find('[data-testid="remote-profile-summary"]').text()).toContain('/shared/v2')
  })

  it('creates, tests, and deletes a remote profile', async () => {
    const wrapper = mount(RemoteProfileView)

    await wrapper.find('[data-testid="new-remote-profile"]').trigger('click')
    await wrapper.find('[data-testid="remote-profile-name-input"]').setValue('Release FTP')
    await wrapper.find('[data-testid="remote-profile-protocol-select"]').setValue('ftp')
    await wrapper.find('[data-testid="remote-profile-host-input"]').setValue('ftp.example.com')
    await wrapper.find('[data-testid="remote-profile-port-input"]').setValue('21')
    await wrapper
      .find('[data-testid="remote-profile-credential-key-input"]')
      .setValue('release-ftp')
    await wrapper.find('[data-testid="save-remote-profile"]').trigger('click')

    expect(wrapper.find('[data-testid="remote-profile-list"]').text()).toContain('Release FTP')

    await wrapper.find('[data-testid="test-remote-profile"]').trigger('click')

    expect(wrapper.find('[data-testid="remote-profile-test-status"]').text()).toContain(
      'Connection check queued for ftp.example.com',
    )

    await wrapper.find('[data-testid="delete-remote-profile"]').trigger('click')

    expect(wrapper.find('[data-testid="remote-profile-list"]').text()).not.toContain('Release FTP')
  })
})
