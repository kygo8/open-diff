import { flushPromises, mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import HexCompareView from './HexCompareView.vue'
import { compareHexFiles, findHexInFile, saveHexEdits, saveTextFile } from '@/api/diff'
import { useSessionLaunchStore } from '@/stores/sessionLaunch'

const push = vi.fn()
const clipboardWriteText = vi.fn<(text: string) => Promise<void>>().mockResolvedValue(undefined)

vi.mock('vue-router', () => ({
  useRouter: () => ({ push }),
}))

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
  findHexInFile: vi.fn().mockResolvedValue([
    { offset: 256, length: 2 },
    { offset: 512, length: 2 },
  ]),
  saveHexEdits: vi.fn().mockResolvedValue({ bytesWritten: 1 }),
  saveTextFile: vi.fn().mockResolvedValue({ bytesWritten: 12 }),
}))

async function runCompare(wrapper: ReturnType<typeof mount>): Promise<void> {
  await wrapper.find('[data-testid="hex-left-path"]').setValue('C:/bin/left.bin')
  await wrapper.find('[data-testid="hex-right-path"]').setValue('C:/bin/right.bin')
  await wrapper.find('[data-testid="run-hex-compare"]').trigger('click')
  await flushPromises()
}

describe('HexCompareView', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.mocked(compareHexFiles).mockReset()
    vi.mocked(compareHexFiles).mockResolvedValue({
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
    })
    vi.mocked(findHexInFile).mockClear()
    vi.mocked(saveHexEdits).mockClear()
    vi.mocked(saveTextFile).mockClear()
    clipboardWriteText.mockClear()
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: {
        writeText: clipboardWriteText,
      },
    })
  })

  it('starts empty without a demo hex dump', () => {
    const wrapper = mount(HexCompareView)

    expect(wrapper.findAll('[data-testid="hex-row"]')).toHaveLength(0)
    expect(wrapper.text()).not.toContain('ABCD')
    expect((wrapper.find('[data-testid="hex-left-path"]').element as HTMLInputElement).value).toBe(
      '',
    )
  })

  it('renders the Hex Compare session toolbar order', () => {
    const wrapper = mount(HexCompareView)
    const ids = [
      'home',
      'all',
      'diffs',
      'same',
      'rules',
      'format',
      'sessions',
      'copy',
      'next-diff',
      'prev-diff',
      'swap',
      'reload',
    ]

    expect(wrapper.find('[data-testid="hex-session-toolbar-bar"]').exists()).toBe(true)
    expect(
      wrapper
        .findAll('[data-testid^="hex-session-toolbar-"]')
        .filter((node) => node.attributes('data-testid') !== 'hex-session-toolbar-bar')
        .map((node) => node.attributes('data-testid')?.replace('hex-session-toolbar-', '')),
    ).toEqual(ids)
    expect(
      wrapper.find('[data-testid="hex-session-toolbar-same"]').attributes('disabled'),
    ).toBeDefined()
    expect(
      wrapper.find('[data-testid="hex-session-toolbar-rules"]').attributes('disabled'),
    ).toBeUndefined()
  })

  it('filters equal-only rows from the Same toolbar command', async () => {
    vi.mocked(compareHexFiles).mockResolvedValueOnce({
      left: {
        path: 'C:/bin/left.bin',
        totalLen: 16,
        cells: [
          ...Array.from({ length: 8 }, (_, offset) => ({
            offset,
            byte: 65,
            hex: '41',
            ascii: 'A',
            different: false,
          })),
          ...Array.from({ length: 8 }, (_, index) => ({
            offset: index + 8,
            byte: index === 0 ? 66 : 65,
            hex: index === 0 ? '42' : '41',
            ascii: index === 0 ? 'B' : 'A',
            different: index === 0,
          })),
        ],
      },
      right: {
        path: 'C:/bin/right.bin',
        totalLen: 16,
        cells: [
          ...Array.from({ length: 8 }, (_, offset) => ({
            offset,
            byte: 65,
            hex: '41',
            ascii: 'A',
            different: false,
          })),
          ...Array.from({ length: 8 }, (_, index) => ({
            offset: index + 8,
            byte: index === 0 ? 88 : 65,
            hex: index === 0 ? '58' : '41',
            ascii: index === 0 ? 'X' : 'A',
            different: index === 0,
          })),
        ],
      },
      diffRanges: [{ offset: 8, leftBytes: [66], rightBytes: [88] }],
      summary: {
        leftBytes: 16,
        rightBytes: 16,
        differentRanges: 1,
      },
    })

    const wrapper = mount(HexCompareView)

    await wrapper.find('[data-testid="hex-width-control"]').setValue(320)
    await runCompare(wrapper)

    expect(
      wrapper.find('[data-testid="hex-session-toolbar-same"]').attributes('disabled'),
    ).toBeUndefined()
    expect(
      wrapper.findAll('[data-testid="left-hex-viewport"] [data-testid="hex-row"]'),
    ).toHaveLength(2)

    await wrapper.find('[data-testid="hex-session-toolbar-same"]').trigger('click')
    expect(
      wrapper.findAll('[data-testid="left-hex-viewport"] [data-testid="hex-row"]'),
    ).toHaveLength(1)

    await wrapper.find('[data-testid="hex-session-toolbar-diffs"]').trigger('click')
    expect(
      wrapper.findAll('[data-testid="left-hex-viewport"] [data-testid="hex-row"]'),
    ).toHaveLength(1)

    await wrapper.find('[data-testid="hex-session-toolbar-all"]').trigger('click')
    expect(
      wrapper.findAll('[data-testid="left-hex-viewport"] [data-testid="hex-row"]'),
    ).toHaveLength(2)
  })

  it('swaps paths and reloads from the session toolbar', async () => {
    const wrapper = mount(HexCompareView)

    await wrapper.find('[data-testid="hex-left-path"]').setValue('C:/bin/left.bin')
    await wrapper.find('[data-testid="hex-right-path"]').setValue('C:/bin/right.bin')
    await wrapper.find('[data-testid="hex-session-toolbar-swap"]').trigger('click')

    expect((wrapper.find('[data-testid="hex-left-path"]').element as HTMLInputElement).value).toBe(
      'C:/bin/right.bin',
    )
    expect((wrapper.find('[data-testid="hex-right-path"]').element as HTMLInputElement).value).toBe(
      'C:/bin/left.bin',
    )
  })

  it('jumps to the next difference range from the session toolbar', async () => {
    const wrapper = mount(HexCompareView)

    await runCompare(wrapper)

    expect(
      wrapper.find('[data-testid="hex-session-toolbar-next-diff"]').attributes('disabled'),
    ).toBeUndefined()

    await wrapper.find('[data-testid="hex-session-toolbar-next-diff"]').trigger('click')
    await flushPromises()

    expect(compareHexFiles).toHaveBeenLastCalledWith(expect.objectContaining({ offset: 1 }))
  })

  it('runs a hex comparison request and renders returned byte windows', async () => {
    const wrapper = mount(HexCompareView)

    await runCompare(wrapper)

    expect(compareHexFiles).toHaveBeenCalledWith({
      leftPath: 'C:/bin/left.bin',
      rightPath: 'C:/bin/right.bin',
      offset: 0,
      length: 256,
    })
    expect(wrapper.find('[data-testid="left-hex-byte-diff-00000001"]').text()).toBe('42')
    expect(wrapper.find('[data-testid="right-hex-byte-diff-00000001"]').text()).toBe('58')
  })

  it('Go To dialog accepts offsets past 0x7FFFFFFF', async () => {
    const wrapper = mount(HexCompareView)

    await runCompare(wrapper)
    await wrapper.find('[data-testid="hex-go-to-open"]').trigger('click')
    expect(wrapper.find('[data-testid="hex-goto-dialog"]').exists()).toBe(true)

    await wrapper.find('[data-testid="hex-goto-input"]').setValue('0x80000000')
    await wrapper.find('[data-testid="hex-goto-apply"]').trigger('click')
    await flushPromises()

    expect(compareHexFiles).toHaveBeenLastCalledWith(
      expect.objectContaining({ offset: 0x80000000 }),
    )
    expect(
      (
        wrapper.find('[data-testid="hex-jump-offset"]').element as HTMLInputElement
      ).value.toLowerCase(),
    ).toContain('80000000')
  })

  it('pages and jumps through chunked offsets', async () => {
    vi.mocked(compareHexFiles).mockResolvedValue({
      left: {
        path: 'C:/bin/left.bin',
        totalLen: 2048,
        cells: [{ offset: 0, byte: 65, hex: '41', ascii: 'A', different: false }],
      },
      right: {
        path: 'C:/bin/right.bin',
        totalLen: 2048,
        cells: [{ offset: 0, byte: 65, hex: '41', ascii: 'A', different: false }],
      },
      diffRanges: [],
      summary: {
        leftBytes: 2048,
        rightBytes: 2048,
        differentRanges: 0,
      },
    })

    const wrapper = mount(HexCompareView)

    await runCompare(wrapper)
    expect(wrapper.find('[data-testid="hex-window-range"]').text()).toContain('00000000')
    expect(
      (wrapper.find('[data-testid="hex-next-page"]').element as HTMLButtonElement).disabled,
    ).toBe(false)

    await wrapper.find('[data-testid="hex-next-page"]').trigger('click')
    await wrapper.vm.$nextTick()

    expect(compareHexFiles).toHaveBeenLastCalledWith(
      expect.objectContaining({ offset: 256, length: 256 }),
    )

    await wrapper.find('[data-testid="hex-jump-offset"]').setValue('512')
    await wrapper.find('[data-testid="hex-jump"]').trigger('click')
    await flushPromises()

    expect(compareHexFiles).toHaveBeenLastCalledWith(
      expect.objectContaining({ offset: 512, length: 256 }),
    )
  })

  it('clamps windowed browse at EOF and disables next/last there', async () => {
    vi.mocked(compareHexFiles).mockResolvedValue({
      left: {
        path: 'C:/bin/left.bin',
        totalLen: 300,
        cells: [{ offset: 0, byte: 65, hex: '41', ascii: 'A', different: false }],
      },
      right: {
        path: 'C:/bin/right.bin',
        totalLen: 300,
        cells: [{ offset: 0, byte: 65, hex: '41', ascii: 'A', different: false }],
      },
      diffRanges: [],
      summary: {
        leftBytes: 300,
        rightBytes: 300,
        differentRanges: 0,
      },
    })

    const wrapper = mount(HexCompareView)

    await runCompare(wrapper)
    await wrapper.find('[data-testid="hex-next-page"]').trigger('click')
    await flushPromises()

    expect(compareHexFiles).toHaveBeenLastCalledWith(
      expect.objectContaining({ offset: 44, length: 256 }),
    )
    expect(
      (wrapper.find('[data-testid="hex-next-page"]').element as HTMLButtonElement).disabled,
    ).toBe(true)
    expect(
      (wrapper.find('[data-testid="hex-last-page"]').element as HTMLButtonElement).disabled,
    ).toBe(true)
    expect(wrapper.find('[data-testid="hex-window-range"]').text()).toMatch(/0000002C/i)
  })

  it('finds bytes and saves queued edits', async () => {
    const wrapper = mount(HexCompareView)

    await runCompare(wrapper)
    await wrapper.find('[data-testid="hex-find-query"]').setValue('4142')
    await wrapper.find('[data-testid="hex-find"]').trigger('click')
    await wrapper.vm.$nextTick()

    expect(findHexInFile).toHaveBeenCalledWith({
      path: 'C:/bin/left.bin',
      queryKind: 'hex',
      query: '4142',
    })
    expect(wrapper.find('[data-testid="hex-find-status"]').text()).toBe('1/2')

    await wrapper.find('[data-testid="hex-find-next"]').trigger('click')
    await wrapper.vm.$nextTick()
    expect(wrapper.find('[data-testid="hex-find-status"]').text()).toBe('2/2')

    await wrapper.find('[data-testid="hex-find-prev"]').trigger('click')
    await wrapper.vm.$nextTick()
    expect(wrapper.find('[data-testid="hex-find-status"]').text()).toBe('1/2')

    await wrapper.find('[data-testid="hex-edit-offset"]').setValue(1)
    await wrapper.find('[data-testid="hex-edit-value"]').setValue('58')
    await wrapper.find('[data-testid="hex-add-edit"]').trigger('click')
    await wrapper.find('[data-testid="hex-save"]').trigger('click')
    await wrapper.vm.$nextTick()

    expect(saveHexEdits).toHaveBeenCalledWith({
      path: 'C:/bin/left.bin',
      edits: [{ offset: 1, value: 88 }],
      createBackup: true,
    })
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

  it('renders offset, hex and ascii panes after a real compare', async () => {
    const wrapper = mount(HexCompareView)

    await runCompare(wrapper)

    expect(wrapper.find('[data-testid="hex-offset-pane"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="hex-byte-pane"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="hex-ascii-pane"]').exists()).toBe(true)
    expect(wrapper.findAll('[data-testid="hex-row"]')).toHaveLength(1)
    expect(wrapper.find('[data-testid="hex-byte-pane"]').text()).toContain('41424344')
  })

  it('keeps left and right hex viewports synchronized', async () => {
    const wrapper = mount(HexCompareView, {
      attachTo: document.body,
    })

    await runCompare(wrapper)
    const leftViewport = wrapper.find<HTMLElement>('[data-testid="left-hex-viewport"]')
    const rightViewport = wrapper.find<HTMLElement>('[data-testid="right-hex-viewport"]')

    leftViewport.element.scrollTop = 48
    await leftViewport.trigger('scroll')

    expect(rightViewport.element.scrollTop).toBe(48)

    wrapper.unmount()
  })

  it('shows only rows containing byte differences when diff-only mode is enabled', async () => {
    const wrapper = mount(HexCompareView)

    await runCompare(wrapper)

    await wrapper.find('[data-testid="hex-diff-only-toggle"]').setValue(true)

    expect(wrapper.findAll('[data-testid="hex-row"]')).toHaveLength(1)
    expect(wrapper.find('[data-testid="left-hex-byte-diff-00000001"]').text()).toBe('42')
  })

  it('selects a byte and copies it from the session toolbar', async () => {
    const wrapper = mount(HexCompareView)

    await runCompare(wrapper)
    expect(
      wrapper.find('[data-testid="hex-session-toolbar-copy"]').attributes('disabled'),
    ).toBeDefined()

    await wrapper.find('[data-testid="left-hex-byte-diff-00000001"]').trigger('click')
    await wrapper.vm.$nextTick()

    expect(
      (wrapper.find('[data-testid="hex-edit-offset"]').element as HTMLInputElement).value,
    ).toBe('1')
    expect((wrapper.find('[data-testid="hex-edit-value"]').element as HTMLInputElement).value).toBe(
      '42',
    )
    expect(
      wrapper.find('[data-testid="hex-session-toolbar-copy"]').attributes('disabled'),
    ).toBeUndefined()

    await wrapper.find('[data-testid="hex-session-toolbar-copy"]').trigger('click')
    await flushPromises()

    expect(clipboardWriteText).toHaveBeenCalledWith(expect.stringContaining('42'))
    expect(wrapper.find('[data-testid="hex-copy-status"]').exists()).toBe(true)
  })

  it('exports a hex report to clipboard and disk', async () => {
    const wrapper = mount(HexCompareView)

    await runCompare(wrapper)
    expect(wrapper.find('[data-testid="hex-report-panel"]').exists()).toBe(true)

    await wrapper.find('[data-testid="export-hex-report"]').trigger('click')
    await flushPromises()

    expect(clipboardWriteText).toHaveBeenCalled()
    const payload = clipboardWriteText.mock.calls[0]?.[0] ?? ''

    expect(payload).toContain('HEX-REPORT')
    expect(payload).toContain('00000001\t42\t58')
    expect(saveTextFile).toHaveBeenCalledWith({
      path: 'C:/bin/hex-compare.txt',
      text: payload,
      createBackup: false,
    })
    expect(wrapper.find('[data-testid="hex-report-status"]').text()).toBe('C:/bin/hex-compare.txt')
  })
})
