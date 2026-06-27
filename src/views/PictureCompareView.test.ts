import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import PictureCompareView from './PictureCompareView.vue'

describe('PictureCompareView', () => {
  it('renders left and right image panes with synced pan controls', async () => {
    const wrapper = mount(PictureCompareView)

    expect(wrapper.text()).toContain('Picture Compare')
    expect(wrapper.find('[data-testid="left-picture-pane"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="right-picture-pane"]').exists()).toBe(true)
    expect(wrapper.findAll('[data-testid="picture-canvas-frame"]')).toHaveLength(2)

    await wrapper.find('[data-testid="picture-pan-x"]').setValue(24)
    await wrapper.find('[data-testid="picture-pan-y"]').setValue(12)

    expect(wrapper.find('[data-testid="left-picture-image"]').attributes('style')).toContain(
      'translate(24px, 12px)',
    )
    expect(wrapper.find('[data-testid="right-picture-image"]').attributes('style')).toContain(
      'translate(24px, 12px)',
    )
  })

  it('scales both image panes from the same zoom control', async () => {
    const wrapper = mount(PictureCompareView)

    expect(wrapper.find('[data-testid="picture-zoom-value"]').text()).toContain('100%')

    await wrapper.find('[data-testid="picture-zoom-control"]').setValue(150)

    expect(wrapper.find('[data-testid="picture-zoom-value"]').text()).toContain('150%')
    expect(wrapper.find('[data-testid="left-picture-image"]').attributes('style')).toContain(
      'scale(1.5)',
    )
    expect(wrapper.find('[data-testid="right-picture-image"]').attributes('style')).toContain(
      'scale(1.5)',
    )
  })

  it('toggles the picture difference overlay layer', async () => {
    const wrapper = mount(PictureCompareView)

    expect(wrapper.findAll('[data-testid="picture-diff-overlay"]')).toHaveLength(2)
    expect(wrapper.find('[data-testid="picture-diff-region"]').exists()).toBe(true)

    await wrapper.find('[data-testid="picture-overlay-toggle"]').setValue(false)

    expect(wrapper.findAll('[data-testid="picture-diff-overlay"]')).toHaveLength(0)
  })

  it('applies rotation and flip transforms to both panes', async () => {
    const wrapper = mount(PictureCompareView)

    await wrapper.find('[data-testid="picture-rotate-clockwise"]').trigger('click')
    await wrapper.find('[data-testid="picture-flip-horizontal"]').trigger('click')

    expect(wrapper.find('[data-testid="left-picture-image"]').attributes('style')).toContain(
      'rotate(90deg) scaleX(-1)',
    )
    expect(wrapper.find('[data-testid="right-picture-image"]').attributes('style')).toContain(
      'rotate(90deg) scaleX(-1)',
    )
  })

  it('applies manual alignment offset only to the right pane', async () => {
    const wrapper = mount(PictureCompareView)

    await wrapper.find<HTMLInputElement>('[data-testid="picture-align-x"]').setValue('12')
    await wrapper.find<HTMLInputElement>('[data-testid="picture-align-y"]').setValue('-8')

    expect(wrapper.find('[data-testid="left-picture-image"]').attributes('style')).toContain(
      'translate(0px, 0px)',
    )
    expect(wrapper.find('[data-testid="right-picture-image"]').attributes('style')).toContain(
      'translate(12px, -8px)',
    )
  })
})
