import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import VersionCompareView from './VersionCompareView.vue'
import { compareVersionFiles } from '@/api/diff'
import { useSessionLaunchStore } from '@/stores/sessionLaunch'

vi.mock('@/api/diff', () => ({
  compareVersionFiles: vi.fn().mockResolvedValue({
    left: {
      name: 'fixture-left.exe',
      fileType: 'Application',
      targetOs: 'Windows 32-bit',
      fileVersion: '1.0.0.0',
      productVersion: '1.0.0.0',
    },
    right: {
      name: 'fixture-right.exe',
      fileType: 'Application',
      targetOs: 'Windows 32-bit',
      fileVersion: '1.1.0.0',
      productVersion: '1.0.0.0',
    },
    fields: [
      {
        field: 'FileVersion',
        group: 'Fixed Info',
        left: '1.0.0.0',
        right: '1.1.0.0',
        status: 'modified',
      },
      {
        field: 'CompanyName',
        group: 'String Info',
        left: 'Open Diff',
        right: 'Open Diff',
        status: 'unchanged',
      },
    ],
    summary: {
      added: 0,
      removed: 0,
      modified: 1,
      unchanged: 1,
    },
  }),
}))

describe('VersionCompareView', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.mocked(compareVersionFiles).mockClear()
  })

  it('runs a real version comparison request and renders returned fields', async () => {
    const wrapper = mount(VersionCompareView)

    await wrapper.find('[data-testid="version-left-path"]').setValue('C:/apps/fixture-left.exe')
    await wrapper.find('[data-testid="version-right-path"]').setValue('C:/apps/fixture-right.exe')
    await wrapper.find('[data-testid="run-version-compare"]').trigger('click')
    await wrapper.vm.$nextTick()

    expect(compareVersionFiles).toHaveBeenCalledWith({
      leftPath: 'C:/apps/fixture-left.exe',
      rightPath: 'C:/apps/fixture-right.exe',
    })
    expect(wrapper.text()).toContain('fixture-left.exe')
    expect(wrapper.text()).toContain('fixture-right.exe')
    expect(wrapper.find('[data-testid="version-summary-modified"]').text()).toContain('1')
    expect(wrapper.find('[data-testid="version-field-FileVersion"]').text()).toContain('1.1.0.0')
  })

  it('runs automatically from dropped version launch paths', async () => {
    useSessionLaunchStore().setPendingLaunch({
      id: 'launch-version',
      source: 'drop',
      sessionType: 'version-compare',
      title: 'left.exe vs right.exe',
      route: '/compare/version',
      autoRun: true,
      locations: {
        left: { uri: 'C:/drop/left.exe', kind: 'file', readOnly: false },
        right: { uri: 'C:/drop/right.exe', kind: 'file', readOnly: false },
      },
    })

    mount(VersionCompareView)
    await Promise.resolve()

    expect(compareVersionFiles).toHaveBeenCalledWith({
      leftPath: 'C:/drop/left.exe',
      rightPath: 'C:/drop/right.exe',
    })
  })

  it('renders executable identity and version difference counts', () => {
    const wrapper = mount(VersionCompareView)

    expect(wrapper.text()).toContain('Version Compare')
    expect(wrapper.text()).toContain('left-app.exe')
    expect(wrapper.text()).toContain('right-app.exe')
    expect(wrapper.find('[data-testid="version-summary-added"]').text()).toContain('1')
    expect(wrapper.find('[data-testid="version-summary-removed"]').text()).toContain('1')
    expect(wrapper.find('[data-testid="version-summary-modified"]').text()).toContain('2')
    expect(wrapper.find('[data-testid="version-summary-unchanged"]').text()).toContain('2')
  })

  it('renders fixed version resource fields with status highlighting', () => {
    const wrapper = mount(VersionCompareView)

    const fileVersion = wrapper.find('[data-testid="version-field-FileVersion"]')
    const productVersion = wrapper.find('[data-testid="version-field-ProductVersion"]')

    expect(fileVersion.exists()).toBe(true)
    expect(fileVersion.classes()).toContain('status-modified')
    expect(fileVersion.text()).toContain('1.4.2.0')
    expect(fileVersion.text()).toContain('1.5.0.0')

    expect(productVersion.exists()).toBe(true)
    expect(productVersion.classes()).toContain('status-unchanged')
    expect(productVersion.text()).toContain('1.5.0.0')
  })

  it('renders string table fields from both sides for report review', () => {
    const wrapper = mount(VersionCompareView)

    const companyName = wrapper.find('[data-testid="version-field-CompanyName"]')
    const legalCopyright = wrapper.find('[data-testid="version-field-LegalCopyright"]')

    expect(wrapper.find('[data-testid="version-report-table"]').exists()).toBe(true)
    expect(companyName.exists()).toBe(true)
    expect(companyName.classes()).toContain('status-added')
    expect(companyName.text()).toContain('--')
    expect(companyName.text()).toContain('Open Diff Labs')

    expect(legalCopyright.exists()).toBe(true)
    expect(legalCopyright.classes()).toContain('status-removed')
    expect(legalCopyright.text()).toContain('Copyright 2025')
  })
})
