import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import VersionCompareView from './VersionCompareView.vue'

describe('VersionCompareView', () => {
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
