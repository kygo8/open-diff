import { mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import PictureCompareView from './PictureCompareView.vue'
import { comparePictureFiles } from '@/api/diff'

vi.mock('@/api/diff', () => ({
  comparePictureFiles: vi.fn().mockResolvedValue({
    left: {
      name: 'left-fixture.png',
      format: 'PNG',
      dimensions: '2 x 1',
      colorDepth: '32-bit',
    },
    right: {
      name: 'right-fixture.png',
      format: 'PNG',
      dimensions: '2 x 1',
      colorDepth: '32-bit',
    },
    statistics: {
      totalPixels: 2,
      differentPixels: 1,
      differenceRatio: 0.5,
      boundingRect: {
        x: 1,
        y: 0,
        width: 1,
        height: 1,
      },
    },
    metadataRows: [
      {
        key: 'dimensions',
        label: 'Dimensions',
        left: '2 x 1',
        right: '2 x 1',
        status: 'equal',
      },
      {
        key: 'color-depth',
        label: 'Color Depth',
        left: '32-bit',
        right: '32-bit',
        status: 'equal',
      },
    ],
  }),
}))

describe('PictureCompareView', () => {
  beforeEach(() => {
    vi.mocked(comparePictureFiles).mockClear()
  })

  it('runs a real picture comparison request and renders returned pixel statistics', async () => {
    const wrapper = mount(PictureCompareView)

    await wrapper.find('[data-testid="picture-left-path"]').setValue('C:/images/left-fixture.png')
    await wrapper.find('[data-testid="picture-right-path"]').setValue('C:/images/right-fixture.png')
    await wrapper.find('[data-testid="run-picture-compare"]').trigger('click')
    await wrapper.vm.$nextTick()

    expect(comparePictureFiles).toHaveBeenCalledWith({
      leftPath: 'C:/images/left-fixture.png',
      rightPath: 'C:/images/right-fixture.png',
    })
    expect(wrapper.text()).toContain('left-fixture.png')
    expect(wrapper.text()).toContain('right-fixture.png')
    expect(wrapper.find('[data-testid="picture-different-pixels"]').text()).toContain('1')
    expect(wrapper.find('[data-testid="picture-difference-ratio"]').text()).toContain('50.00%')
    expect(wrapper.find('[data-testid="picture-bounding-rect"]').text()).toContain('1, 0, 1 x 1')
  })

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

  it('shows pointer pixel preview with coordinates and color', async () => {
    const wrapper = mount(PictureCompareView)

    await wrapper.find('[data-testid="right-picture-image"]').trigger('mousemove', {
      clientX: 42,
      clientY: 24,
    })

    expect(wrapper.find('[data-testid="picture-pixel-preview"]').text()).toContain('Right')
    expect(wrapper.find('[data-testid="picture-pixel-coordinates"]').text()).toBe('42, 24')
    expect(wrapper.find('[data-testid="picture-pixel-color"]').text()).toMatch(
      /^rgb\(\d+, \d+, \d+\)$/,
    )
  })

  it('renders image metadata comparison rows with difference states', () => {
    const wrapper = mount(PictureCompareView)

    expect(wrapper.find('[data-testid="picture-metadata-panel"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="picture-metadata-dimensions"]').text()).toContain(
      '1024 x 768',
    )
    expect(wrapper.find('[data-testid="picture-metadata-color-depth"]').text()).toContain('24-bit')
    expect(wrapper.find('[data-testid="picture-metadata-exif"]').text()).toContain('Camera Model')
    expect(wrapper.findAll('[data-metadata-status="different"]')).toHaveLength(3)
  })
})
