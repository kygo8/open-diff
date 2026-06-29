import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import HexCompareView from './HexCompareView.vue'
import { compareHexFiles } from '@/api/diff'
import { useSessionLaunchStore } from '@/stores/sessionLaunch'

vi.mock('@/api/diff', () => ({
  compareHexFiles: vi.fn().mockResolvedValue({
    left: {
      path: 'C:/bin/left.bin',
      totalLen: 4,
      cells: [
        { offset: 0, byte: 65, hex: '41', ascii: 'A', different: false },
        { offset: 1, byte: 66, hex: '42', ascii: 'B', different: true },
        { offset: 2, byte: 67, hex: '43', ascii: 'C', different: false },
        { offset: 3, byte: 68, hex: '44', ascii: 'D', different: false },
      ],
    },
    right: {
      path: 'C:/bin/right.bin',
      totalLen: 4,
      cells: [
        { offset: 0, byte: 65, hex: '41', ascii: 'A', different: false },
        { offset: 1, byte: 88, hex: '58', ascii: 'X', different: true },
        { offset: 2, byte: 67, hex: '43', ascii: 'C', different: false },
        { offset: 3, byte: 68, hex: '44', ascii: 'D', different: false },
      ],
    },
    diffRanges: [{ offset: 1, leftBytes: [66], rightBytes: [88] }],
    summary: {
      leftBytes: 4,
      rightBytes: 4,
      differentRanges: 1,
    },
  }),
}))

describe('HexCompareView', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.mocked(compareHexFiles).mockClear()
  })

  it('runs a hex comparison request and renders returned byte windows', async () => {
    const wrapper = mount(HexCompareView)

    await wrapper.find('[data-testid="hex-left-path"]').setValue('C:/bin/left.bin')
    await wrapper.find('[data-testid="hex-right-path"]').setValue('C:/bin/right.bin')
    await wrapper.find('[data-testid="run-hex-compare"]').trigger('click')
    await wrapper.vm.$nextTick()

    expect(compareHexFiles).toHaveBeenCalledWith({
      leftPath: 'C:/bin/left.bin',
      rightPath: 'C:/bin/right.bin',
      offset: 0,
      length: 256,
    })
    expect(wrapper.text()).toContain('C:/bin/left.bin')
    expect(wrapper.text()).toContain('C:/bin/right.bin')
    expect(wrapper.find('[data-testid="left-hex-byte-diff-00000001"]').text()).toBe('42')
    expect(wrapper.find('[data-testid="right-hex-byte-diff-00000001"]').text()).toBe('58')
  })

  it('runs automatically from dropped hex file launch paths', async () => {
    useSessionLaunchStore().setPendingLaunch({
      id: 'launch-hex',
      source: 'drop',
      sessionType: 'hex-compare',
      title: 'left.bin vs right.bin',
      route: '/compare/hex',
      autoRun: true,
      locations: {
        left: { uri: 'C:/drop/left.bin', kind: 'file', readOnly: false },
        right: { uri: 'C:/drop/right.bin', kind: 'file', readOnly: false },
      },
    })

    mount(HexCompareView)
    await Promise.resolve()

    expect(compareHexFiles).toHaveBeenCalledWith(
      expect.objectContaining({
        leftPath: 'C:/drop/left.bin',
        rightPath: 'C:/drop/right.bin',
      }),
    )
  })

  it('renders offset, hex and ascii panes with stable rows', () => {
    const wrapper = mount(HexCompareView)

    expect(wrapper.text()).toContain('Hex Compare')
    expect(wrapper.find('[data-testid="hex-offset-pane"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="hex-byte-pane"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="hex-ascii-pane"]').exists()).toBe(true)
    expect(wrapper.findAll('[data-testid="hex-row"]')).toHaveLength(4)
    expect(wrapper.text()).toContain('00000000')
    expect(wrapper.find('[data-testid="hex-byte-pane"]').text()).toContain('41424344')
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

  it('marks changed bytes with a dedicated highlight class', () => {
    const wrapper = mount(HexCompareView)
    const changedByte = wrapper.find('[data-testid="left-hex-byte-diff-00000001"]')

    expect(changedByte.exists()).toBe(true)
    expect(changedByte.classes()).toContain('hex-byte-different')
    expect(changedByte.text()).toBe('42')
  })

  it('adjusts bytes per row from the available viewport width', async () => {
    const wrapper = mount(HexCompareView)

    expect(wrapper.find('[data-testid="hex-bytes-per-row"]').text()).toContain('16')
    expect(wrapper.findAll('[data-testid="hex-row"]')).toHaveLength(4)

    await wrapper.find('[data-testid="hex-width-control"]').setValue(360)

    expect(wrapper.find('[data-testid="hex-bytes-per-row"]').text()).toContain('8')
    expect(wrapper.findAll('[data-testid="hex-row"]')).toHaveLength(8)
  })

  it('shows only rows containing byte differences when diff-only mode is enabled', async () => {
    const wrapper = mount(HexCompareView)

    expect(wrapper.findAll('[data-testid="hex-row"]')).toHaveLength(4)

    await wrapper.find('[data-testid="hex-diff-only-toggle"]').setValue(true)

    const visibleRows = wrapper.findAll('[data-testid="hex-row"]')

    expect(visibleRows).toHaveLength(1)
    expect(visibleRows[0].text()).toContain('00000000')
    expect(wrapper.find('[data-testid="left-hex-byte-diff-00000001"]').text()).toBe('42')
  })
})
