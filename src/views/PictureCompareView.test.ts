import { flushPromises, mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { useSettingsStore } from '@/stores/settings'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import PictureCompareView from './PictureCompareView.vue'
import { comparePictureFiles, saveTextFile } from '@/api/diff'
import { useSessionLaunchStore } from '@/stores/sessionLaunch'

const clipboardWriteText = vi.fn<(text: string) => Promise<void>>().mockResolvedValue(undefined)

vi.mock('vue-router', () => ({
  useRouter: () => ({ push: vi.fn() }),
}))

vi.mock('@/api/diff', () => ({
  pathFileStamp: vi.fn().mockResolvedValue({
    size: 128,
    modifiedAtMs: Date.UTC(2026, 0, 15, 8, 30),
  }),
  saveTextFile: vi.fn().mockResolvedValue({
    path: 'C:/images/picture-compare.txt',
    bytesWritten: 32,
  }),
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
    setActivePinia(createPinia())
    useSettingsStore().setShowSessionsInToolbar(true)
    localStorage.clear()
    vi.mocked(comparePictureFiles).mockClear()
    vi.mocked(saveTextFile).mockClear()
    clipboardWriteText.mockClear()
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: {
        writeText: clipboardWriteText,
      },
    })
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
      rgbTolerance: 0,
      compareAlpha: true,
      alphaTolerance: 0,
    })
    expect(wrapper.find('[data-testid="left-picture-img"]').exists()).toBe(true)
    expect(wrapper.text()).toContain('left-fixture.png')
    expect(wrapper.text()).toContain('right-fixture.png')
    expect(wrapper.find('[data-testid="picture-different-pixels"]').text()).toContain('1')
    expect(wrapper.find('[data-testid="picture-difference-ratio"]').text()).toContain('50.00%')
    expect(wrapper.find('[data-testid="picture-bounding-rect"]').text()).toContain('1, 0, 1 x 1')
  })

  it('runs automatically from dropped picture launch paths', async () => {
    useSessionLaunchStore().setPendingLaunch({
      id: 'launch-picture',
      source: 'drop',
      sessionType: 'picture-compare',
      title: 'left.png vs right.png',
      route: '/compare/picture',
      autoRun: true,
      locations: {
        left: { uri: 'C:/drop/left.png', kind: 'file', readOnly: false },
        right: { uri: 'C:/drop/right.png', kind: 'file', readOnly: false },
      },
    })

    mount(PictureCompareView)
    await Promise.resolve()

    expect(comparePictureFiles).toHaveBeenCalledWith({
      leftPath: 'C:/drop/left.png',
      rightPath: 'C:/drop/right.png',
      rgbTolerance: 0,
      compareAlpha: true,
      alphaTolerance: 0,
    })
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

  it('toggles the picture difference overlay layer after a real compare', async () => {
    const wrapper = mount(PictureCompareView)

    expect(wrapper.find('[data-testid="picture-diff-overlay"]').exists()).toBe(false)
    expect(wrapper.find('[data-testid="picture-diff-region"]').exists()).toBe(false)

    await wrapper.find('[data-testid="picture-left-path"]').setValue('C:/images/left-fixture.png')
    await wrapper.find('[data-testid="picture-right-path"]').setValue('C:/images/right-fixture.png')
    await wrapper.find('[data-testid="run-picture-compare"]').trigger('click')
    await wrapper.vm.$nextTick()

    expect(wrapper.findAll('[data-testid="picture-diff-overlay"]')).toHaveLength(2)
    expect(wrapper.find('[data-testid="picture-diff-region"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="picture-diff-region"]').attributes('style')).toContain(
      'left: 1px',
    )

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

  it('shows pointer pixel coordinates without inventing a sampled color', async () => {
    const wrapper = mount(PictureCompareView)

    await wrapper.find('[data-testid="right-picture-image"]').trigger('mousemove', {
      clientX: 42,
      clientY: 24,
    })

    expect(wrapper.find('[data-testid="picture-pixel-preview"]').text()).toContain('Right')
    expect(wrapper.find('[data-testid="picture-pixel-coordinates"]').text()).toBe('42, 24')
    expect(wrapper.find('[data-testid="picture-pixel-color"]').text()).toBe('rgb(--, --, --)')
  })

  it('renders image metadata comparison rows with difference states', async () => {
    const wrapper = mount(PictureCompareView)

    await wrapper.find('[data-testid="picture-left-path"]').setValue('C:/images/left.png')
    await wrapper.find('[data-testid="picture-right-path"]').setValue('C:/images/right.png')
    await wrapper.find('[data-testid="run-picture-compare"]').trigger('click')
    await wrapper.vm.$nextTick()

    expect(wrapper.find('[data-testid="picture-metadata-panel"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="picture-report-panel"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="picture-report-stats"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="picture-metadata-dimensions"]').text()).toContain('2 x 1')
    expect(wrapper.find('[data-testid="picture-metadata-dimensions"]').exists()).toBe(true)
  })

  it('starts without hardcoded picture statistics before a compare', () => {
    const wrapper = mount(PictureCompareView)

    expect(wrapper.find('[data-testid="picture-total-pixels"]').text()).toBe('--')
    expect(wrapper.find('[data-testid="picture-different-pixels"]').text()).toBe('--')
    expect(wrapper.find('[data-testid="picture-difference-ratio"]').text()).toBe('--')
    expect(wrapper.find('[data-testid="picture-bounding-rect"]').text()).toBe('--')
  })

  it('enables Tol and Range on the Picture session toolbar', () => {
    const wrapper = mount(PictureCompareView)
    const ids = [
      'home',
      'tol',
      'range',
      'blend',
      'minor',
      'rules',
      'format',
      'sessions',
      'swap',
      'reload',
      'meta',
    ]

    expect(wrapper.find('[data-testid="picture-session-toolbar-bar"]').exists()).toBe(true)
    expect(
      wrapper
        .findAll('[data-testid^="picture-session-toolbar-"]')
        .filter((node) => node.attributes('data-testid') !== 'picture-session-toolbar-bar')
        .map((node) => node.attributes('data-testid')?.replace('picture-session-toolbar-', '')),
    ).toEqual(ids)
    expect(
      wrapper.find('[data-testid="picture-session-toolbar-tol"]').attributes('disabled'),
    ).toBeUndefined()
    expect(
      wrapper.find('[data-testid="picture-session-toolbar-range"]').attributes('disabled'),
    ).toBeUndefined()
    expect(
      wrapper.find('[data-testid="picture-session-toolbar-blend"]').attributes('disabled'),
    ).toBeUndefined()
    expect(
      wrapper.find('[data-testid="picture-session-toolbar-meta"]').attributes('disabled'),
    ).toBeUndefined()
    expect(
      wrapper.find('[data-testid="picture-session-toolbar-minor"]').attributes('disabled'),
    ).toBeUndefined()
    expect(
      wrapper.find('[data-testid="picture-session-toolbar-rules"]').attributes('disabled'),
    ).toBeUndefined()
    expect(
      wrapper.find('[data-testid="picture-session-toolbar-format"]').attributes('disabled'),
    ).toBeUndefined()
    expect(
      wrapper.find('[data-testid="picture-session-toolbar-meta"]').attributes('data-active'),
    ).toBe('true')
    expect(
      wrapper.find('[data-testid="picture-session-toolbar-tol"]').attributes('data-active'),
    ).toBe('false')
    expect(wrapper.html()).not.toContain('unimplemented')
  })

  it('forwards RGB tolerance from the Tol panel into picture compare', async () => {
    const wrapper = mount(PictureCompareView)

    await wrapper.find('[data-testid="picture-left-path"]').setValue('C:/images/left-fixture.png')
    await wrapper.find('[data-testid="picture-right-path"]').setValue('C:/images/right-fixture.png')
    await wrapper.find('[data-testid="picture-session-toolbar-tol"]').trigger('click')
    expect(wrapper.find('[data-testid="picture-tol-panel"]').exists()).toBe(true)

    await wrapper.find('[data-testid="picture-rgb-tolerance"]').setValue(12)
    await wrapper.find('[data-testid="picture-compare-alpha"]').setValue(false)
    await wrapper.find('[data-testid="run-picture-compare"]').trigger('click')
    await wrapper.vm.$nextTick()

    expect(comparePictureFiles).toHaveBeenCalledWith({
      leftPath: 'C:/images/left-fixture.png',
      rightPath: 'C:/images/right-fixture.png',
      rgbTolerance: 12,
      compareAlpha: false,
      alphaTolerance: 0,
    })
    expect(wrapper.find('[data-testid="picture-inspector-tolerance"]').text()).toContain('12')
  })

  it('forwards alpha tolerance from the Tol panel into picture compare', async () => {
    const wrapper = mount(PictureCompareView)

    await wrapper.find('[data-testid="picture-left-path"]').setValue('C:/images/left-fixture.png')
    await wrapper.find('[data-testid="picture-right-path"]').setValue('C:/images/right-fixture.png')
    await wrapper.find('[data-testid="picture-session-toolbar-tol"]').trigger('click')
    expect(wrapper.find('[data-testid="picture-tol-panel"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="picture-compare-alpha"]').exists()).toBe(true)

    await wrapper.find('[data-testid="picture-alpha-tolerance"]').setValue(7)
    await wrapper.find('[data-testid="run-picture-compare"]').trigger('click')
    await wrapper.vm.$nextTick()

    expect(comparePictureFiles).toHaveBeenCalledWith({
      leftPath: 'C:/images/left-fixture.png',
      rightPath: 'C:/images/right-fixture.png',
      rgbTolerance: 0,
      compareAlpha: true,
      alphaTolerance: 7,
    })
    expect(wrapper.find('[data-testid="picture-inspector-alpha-tolerance"]').text()).toContain('7')
  })

  it('forwards ignore color replacement from the Range panel', async () => {
    const wrapper = mount(PictureCompareView)

    await wrapper.find('[data-testid="picture-left-path"]').setValue('C:/images/left-fixture.png')
    await wrapper.find('[data-testid="picture-right-path"]').setValue('C:/images/right-fixture.png')
    await wrapper.find('[data-testid="picture-session-toolbar-range"]').trigger('click')
    expect(wrapper.find('[data-testid="picture-range-panel"]').exists()).toBe(true)

    await wrapper.find('[data-testid="picture-ignore-from-r"]').setValue(255)
    await wrapper.find('[data-testid="picture-ignore-from-g"]').setValue(0)
    await wrapper.find('[data-testid="picture-ignore-from-b"]').setValue(0)
    await wrapper.find('[data-testid="picture-ignore-to-r"]').setValue(0)
    await wrapper.find('[data-testid="picture-ignore-to-g"]').setValue(255)
    await wrapper.find('[data-testid="picture-ignore-to-b"]').setValue(0)
    await wrapper.find('[data-testid="run-picture-compare"]').trigger('click')
    await wrapper.vm.$nextTick()

    expect(comparePictureFiles).toHaveBeenCalledWith({
      leftPath: 'C:/images/left-fixture.png',
      rightPath: 'C:/images/right-fixture.png',
      rgbTolerance: 0,
      compareAlpha: true,
      alphaTolerance: 0,
      ignoreColorFrom: [255, 0, 0, 255],
      ignoreColorTo: [0, 255, 0, 255],
    })
  })

  it('swaps paths from the Picture session toolbar', async () => {
    const wrapper = mount(PictureCompareView)

    await wrapper.find('[data-testid="picture-left-path"]').setValue('C:/images/left.png')
    await wrapper.find('[data-testid="picture-right-path"]').setValue('C:/images/right.png')
    await wrapper.find('[data-testid="picture-session-toolbar-swap"]').trigger('click')

    expect(
      (wrapper.find('[data-testid="picture-left-path"]').element as HTMLInputElement).value,
    ).toBe('C:/images/right.png')
    expect(
      (wrapper.find('[data-testid="picture-right-path"]').element as HTMLInputElement).value,
    ).toBe('C:/images/left.png')
  })

  it('wires Blend Meta and Minor toolbar chrome', async () => {
    const wrapper = mount(PictureCompareView)

    await wrapper.find('[data-testid="picture-left-path"]').setValue('C:/images/left-fixture.png')
    await wrapper.find('[data-testid="picture-right-path"]').setValue('C:/images/right-fixture.png')
    await wrapper.find('[data-testid="run-picture-compare"]').trigger('click')
    await wrapper.vm.$nextTick()

    expect(
      wrapper.find('[data-testid="picture-session-toolbar-blend"]').attributes('disabled'),
    ).toBeUndefined()
    await wrapper.find('[data-testid="picture-session-toolbar-blend"]').trigger('click')
    expect(wrapper.find('[data-testid="picture-blend-panel"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="picture-blend-overlay"]').exists()).toBe(true)
    expect(
      wrapper.find('[data-testid="picture-session-toolbar-blend"]').attributes('data-active'),
    ).toBe('true')

    const modeSelect = wrapper.find('[data-testid="picture-blend-mode"]')

    expect(modeSelect.exists()).toBe(true)
    await modeSelect.setValue('difference')
    await modeSelect.trigger('change')
    expect(wrapper.find('[data-testid="picture-blend-overlay"]').attributes('style')).toContain(
      'mix-blend-mode: difference',
    )
    expect(
      JSON.parse(localStorage.getItem('open-diff-picture-compare-options') ?? '{}'),
    ).toMatchObject({
      blendMode: 'difference',
      blendEnabled: true,
    })

    await wrapper.find('[data-testid="picture-session-toolbar-tol"]').trigger('click')
    expect(wrapper.find('[data-testid="picture-tol-panel"]').exists()).toBe(true)
    expect(
      wrapper.find('[data-testid="picture-session-toolbar-tol"]').attributes('data-active'),
    ).toBe('true')

    await wrapper.find('[data-testid="picture-session-toolbar-meta"]').trigger('click')
    expect(wrapper.find('[data-testid="picture-metadata-panel"]').exists()).toBe(false)
    expect(
      wrapper.find('[data-testid="picture-session-toolbar-meta"]').attributes('data-active'),
    ).toBe('false')
    await wrapper.find('[data-testid="picture-session-toolbar-meta"]').trigger('click')
    expect(wrapper.find('[data-testid="picture-metadata-panel"]').exists()).toBe(true)

    await wrapper.find('[data-testid="picture-session-toolbar-minor"]').trigger('click')
    expect(wrapper.find('[data-testid="picture-metadata-dimensions"]').exists()).toBe(false)
    expect(
      wrapper.find('[data-testid="picture-session-toolbar-minor"]').attributes('data-active'),
    ).toBe('true')
  })

  it('exports the picture report to clipboard and a sibling text file', async () => {
    const wrapper = mount(PictureCompareView)

    await wrapper.find('[data-testid="picture-left-path"]').setValue('C:/images/left-fixture.png')
    await wrapper.find('[data-testid="picture-right-path"]').setValue('C:/images/right-fixture.png')
    await wrapper.find('[data-testid="run-picture-compare"]').trigger('click')
    await wrapper.vm.$nextTick()

    await wrapper.find('[data-testid="export-picture-report"]').trigger('click')
    await wrapper.vm.$nextTick()
    await Promise.resolve()

    expect(clipboardWriteText).toHaveBeenCalled()
    const payload = clipboardWriteText.mock.calls[0]?.[0] ?? ''

    expect(payload).toContain('PICTURE-REPORT')
    expect(payload).toContain('left: C:/images/left-fixture.png')
    expect(saveTextFile).toHaveBeenCalledWith({
      path: 'C:/images/picture-compare.txt',
      text: payload,
      createBackup: false,
    })
    expect(wrapper.find('[data-testid="picture-report-status"]').text()).toBe(
      'C:/images/picture-compare.txt',
    )
  })
  it('shows size/date path footers after compare', async () => {
    const wrapper = mount(PictureCompareView, {
      global: { stubs: { teleport: true } },
    })

    await wrapper.find('[data-testid="picture-left-path"]').setValue('C:/left.bin')
    await wrapper.find('[data-testid="picture-right-path"]').setValue('C:/right.bin')
    await wrapper.find('[data-testid="run-picture-compare"]').trigger('click')
    await flushPromises()

    expect(wrapper.find('[data-testid="picture-path-footers"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="picture-left-path-footer"]').text()).toMatch(/bytes/)
    expect(wrapper.find('[data-testid="picture-right-path-footer"]').text()).toMatch(/bytes/)
  })
})
