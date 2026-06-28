import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import RegistryCompareView from './RegistryCompareView.vue'

describe('RegistryCompareView', () => {
  it('renders recursive registry keys with status highlighting', () => {
    const wrapper = mount(RegistryCompareView)

    expect(wrapper.text()).toContain('Registry Compare')
    expect(wrapper.find('[data-testid="registry-summary-added"]').text()).toContain('1')
    expect(wrapper.find('[data-testid="registry-summary-removed"]').text()).toContain('1')
    expect(wrapper.find('[data-testid="registry-summary-modified"]').text()).toContain('2')
    expect(wrapper.find('[data-testid="registry-summary-unchanged"]').text()).toContain('2')

    const rootKey = wrapper.find('[data-testid="registry-key-HKCU/Software/OpenDiff"]')
    const editorKey = wrapper.find('[data-testid="registry-key-HKCU/Software/OpenDiff/Editor"]')
    const legacyKey = wrapper.find('[data-testid="registry-key-HKCU/Software/OpenDiff/Legacy"]')

    expect(rootKey.exists()).toBe(true)
    expect(rootKey.classes()).toContain('status-modified')
    expect(editorKey.exists()).toBe(true)
    expect(editorKey.classes()).toContain('status-added')
    expect(legacyKey.exists()).toBe(true)
    expect(legacyKey.classes()).toContain('status-removed')
  })

  it('renders registry values from both sides and highlights changed data', () => {
    const wrapper = mount(RegistryCompareView)

    const themeValue = wrapper.find('[data-testid="registry-value-HKCU/Software/OpenDiff::Theme"]')
    const fontSizeValue = wrapper.find(
      '[data-testid="registry-value-HKCU/Software/OpenDiff/Editor::FontSize"]',
    )

    expect(themeValue.exists()).toBe(true)
    expect(themeValue.classes()).toContain('status-modified')
    expect(themeValue.text()).toContain('dark')
    expect(themeValue.text()).toContain('light')

    expect(fontSizeValue.exists()).toBe(true)
    expect(fontSizeValue.classes()).toContain('status-added')
    expect(fontSizeValue.text()).toContain('--')
    expect(fontSizeValue.text()).toContain('14')
  })
})
