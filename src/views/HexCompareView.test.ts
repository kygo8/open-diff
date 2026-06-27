import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import HexCompareView from './HexCompareView.vue'

describe('HexCompareView', () => {
  it('renders offset, hex and ascii panes with stable rows', () => {
    const wrapper = mount(HexCompareView)

    expect(wrapper.text()).toContain('Hex Compare')
    expect(wrapper.find('[data-testid="hex-offset-pane"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="hex-byte-pane"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="hex-ascii-pane"]').exists()).toBe(true)
    expect(wrapper.findAll('[data-testid="hex-row"]')).toHaveLength(4)
    expect(wrapper.text()).toContain('00000000')
    expect(wrapper.text()).toContain('41 42 43 44')
    expect(wrapper.text()).toContain('ABCD')
  })

  it('keeps left and right hex viewports synchronized', async () => {
    const wrapper = mount(HexCompareView, {
      attachTo: document.body,
    })
    const leftViewport = wrapper.find<HTMLElement>('[data-testid="left-hex-viewport"]')
    const rightViewport = wrapper.find<HTMLElement>('[data-testid="right-hex-viewport"]')

    expect(leftViewport.exists()).toBe(true)
    expect(rightViewport.exists()).toBe(true)

    leftViewport.element.scrollTop = 48
    await leftViewport.trigger('scroll')

    expect(rightViewport.element.scrollTop).toBe(48)

    wrapper.unmount()
  })
})
