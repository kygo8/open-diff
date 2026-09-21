import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import TextMergeView from './TextMergeView.vue'
import { mergeTextFiles, saveTextFile } from '@/api/diff'
import { useSessionLaunchStore } from '@/stores/sessionLaunch'
import { useSettingsStore } from '@/stores/settings'

vi.mock('@/api/diff', () => ({
  saveTextFile: vi.fn().mockResolvedValue({
    path: 'out.txt',
    bytesWritten: 32,
    backupPath: 'out.txt.bak',
  }),
  pathFileStamp: vi
    .fn()
    .mockResolvedValue({ size: 12, modifiedAtMs: Date.UTC(2026, 0, 15, 8, 30) }),
  mergeTextFiles: vi.fn().mockResolvedValue({
    leftPath: 'left.txt',
    rightPath: 'right.txt',
    centerPath: 'base.txt',
    outputPath: 'out.txt',
    leftText: 'export const mode = "fast"\ntimeout = 45\nretry = true',
    rightText: 'export const mode = "fast"\ntimeout = 60\nretry = true',
    centerText: 'export const mode = "fast"\ntimeout = 30\nretry = true',
    outputText:
      'export const mode = "fast"\n<<<<<<< Left\ntimeout = 45\n||||||| Base\ntimeout = 30\n=======\ntimeout = 60\n>>>>>>> Right\nretry = true',
    conflicts: [
      {
        lineIndex: 1,
        title: 'Lines 2-8',
        base: 'timeout = 30',
        left: 'timeout = 45',
        right: 'timeout = 60',
        outputSpan: 7,
      },
    ],
  }),
}))

describe('TextMergeView', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    useSettingsStore().setShowSessionsInToolbar(true)
    vi.mocked(saveTextFile).mockClear()
    vi.mocked(mergeTextFiles).mockClear()
  })

  it('shows Sessions after Home on the Text Merge MainBar and enables wrap', () => {
    const wrapper = mount(TextMergeView)
    const ids = wrapper
      .findAll('[data-testid^="merge-session-toolbar-"]')
      .filter((node) => node.attributes('data-testid') !== 'merge-session-toolbar-bar')
      .map((node) => node.attributes('data-testid')?.replace('merge-session-toolbar-', ''))

    expect(ids.slice(0, 2)).toEqual(['home', 'sessions'])
    expect(
      wrapper.find('[data-testid="merge-session-toolbar-bar"]').attributes('data-toolbar-wrap'),
    ).toBe('true')
  })

  it('renders capture-style path meta footers for merge paths', () => {
    const wrapper = mount(TextMergeView)

    expect(wrapper.find('[data-testid="merge-path-footers"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="merge-left-path-footer"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="merge-center-path-footer"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="merge-right-path-footer"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="merge-output-path-footer"]').exists()).toBe(true)
  })

  it('starts without hardcoded merge conflicts', () => {
    const wrapper = mount(TextMergeView)

    expect(wrapper.find('[data-testid="merge-pane-left"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="merge-conflict-status"]').text()).toContain('0 conflicts')
    expect(outputEditorValue(wrapper)).not.toContain('timeout = 45')
  })

  it('loads a real three-way merge from launch paths', async () => {
    useSessionLaunchStore().setPendingLaunch({
      id: 'merge-launch',
      source: 'command',
      sessionType: 'text-merge',
      title: 'Merge',
      route: '/merge/text',
      autoRun: true,
      locations: {
        left: { uri: 'left.txt', kind: 'file', readOnly: false },
        right: { uri: 'right.txt', kind: 'file', readOnly: false },
        center: { uri: 'base.txt', kind: 'file', readOnly: false },
        output: { uri: 'out.txt', kind: 'file', readOnly: false },
      },
    })

    const wrapper = mount(TextMergeView)

    await flushPromises()

    expect(mergeTextFiles).toHaveBeenCalledWith({
      leftPath: 'left.txt',
      rightPath: 'right.txt',
      centerPath: 'base.txt',
      outputPath: 'out.txt',
      conflictPolicy: 'markConflict',
    })
    expect(wrapper.find('[data-testid="merge-conflict-status"]').text()).toContain('1 conflict')
    expect(wrapper.find('[data-testid="merge-conflict-list"]').text()).toContain('Lines 2-8')
    expect(wrapper.find('[data-testid="merge-conflict-markers-chip"]').exists()).toBe(true)
  })

  it('applies launch favor into the conflict policy before auto-run', async () => {
    useSessionLaunchStore().setPendingLaunch({
      id: 'favor-launch',
      source: 'shell',
      sessionType: 'text-merge',
      title: 'Merge',
      route: '/merge/text',
      autoRun: true,
      favor: 'left',
      locations: {
        left: { uri: 'left.txt', kind: 'file', readOnly: true },
        right: { uri: 'right.txt', kind: 'file', readOnly: false },
        center: { uri: 'base.txt', kind: 'file', readOnly: false },
        output: { uri: 'out.txt', kind: 'file', readOnly: false },
      },
    })

    mount(TextMergeView)
    await flushPromises()

    expect(mergeTextFiles).toHaveBeenCalledWith(
      expect.objectContaining({
        conflictPolicy: 'favorLeft',
      }),
    )
  })

  it('accepts the left side for the current conflict', async () => {
    const wrapper = await mountLoadedMerge()

    await wrapper.find('[data-testid="accept-left-conflict"]').trigger('click')

    expect(outputEditorValue(wrapper)).toContain('timeout = 45')
    expect(wrapper.find('[data-testid="merge-conflict-status"]').text()).toContain('0 conflicts')
  })

  it('accepts the right side for the current conflict', async () => {
    const wrapper = await mountLoadedMerge()

    await wrapper.find('[data-testid="accept-right-conflict"]').trigger('click')

    expect(outputEditorValue(wrapper)).toContain('timeout = 60')
    expect(wrapper.find('[data-testid="merge-conflict-status"]').text()).toContain('0 conflicts')
  })

  it('accepts the base side for the current conflict', async () => {
    const wrapper = await mountLoadedMerge()

    await wrapper.find('[data-testid="accept-base-conflict"]').trigger('click')

    expect(outputEditorValue(wrapper)).toContain('timeout = 30')
    expect(wrapper.find('[data-testid="merge-conflict-status"]').text()).toContain('0 conflicts')
  })

  it('passes the selected conflict policy when loading a merge', async () => {
    const wrapper = mount(TextMergeView)

    await wrapper.find('[data-testid="merge-conflict-policy"]').setValue('favorLeft')
    await wrapper.find('[data-testid="merge-left-path"]').setValue('left.txt')
    await wrapper.find('[data-testid="merge-right-path"]').setValue('right.txt')
    await wrapper.find('[data-testid="load-text-merge"]').trigger('click')
    await flushPromises()

    expect(mergeTextFiles).toHaveBeenCalledWith(
      expect.objectContaining({ conflictPolicy: 'favorLeft' }),
    )
  })

  it('edits the output text and saves it to the configured output path', async () => {
    const wrapper = await mountLoadedMerge()

    await wrapper.find('[data-testid="merge-output-editor"]').setValue('merged output\nsaved')
    await wrapper.find('[data-testid="save-merge-output"]').trigger('click')

    expect(saveTextFile).toHaveBeenCalledWith({
      path: 'out.txt',
      text: 'merged output\nsaved',
      createBackup: true,
      backupRetention: 1,
    })
    expect(wrapper.find('[data-testid="merge-save-status"]').text()).toContain('Saved 32 bytes')
  })

  it('orders Favor then Next Conflict then Prev Conflict before accept actions', () => {
    const wrapper = mount(TextMergeView)
    const toolbar = wrapper.find('.merge-toolbar').text()
    const html = wrapper.find('.merge-toolbar').html()
    const favorIdx = html.indexOf('merge-favor-chrome')
    const nextIdx = html.indexOf('merge-next-conflict')
    const prevIdx = html.indexOf('merge-prev-conflict')
    const acceptIdx = html.indexOf('merge-accept-chrome')

    expect(favorIdx).toBeGreaterThan(-1)
    expect(nextIdx).toBeGreaterThan(favorIdx)
    expect(prevIdx).toBeGreaterThan(nextIdx)
    expect(acceptIdx).toBeGreaterThan(prevIdx)
    expect(toolbar).toBeTruthy()
  })

  it('exposes Favor Left/Right chrome for the current conflict', () => {
    const wrapper = mount(TextMergeView)

    expect(wrapper.find('[data-testid="merge-favor-chrome"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="merge-favor-left"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="merge-favor-right"]').exists()).toBe(true)
  })

  it('navigates conflicts and accepts then next', async () => {
    vi.mocked(mergeTextFiles).mockResolvedValueOnce({
      leftPath: 'left.txt',
      rightPath: 'right.txt',
      centerPath: 'base.txt',
      outputPath: 'out.txt',
      leftText: 'a\nb-left\nc\nd-left',
      rightText: 'a\nb-right\nc\nd-right',
      centerText: 'a\nb-base\nc\nd-base',
      outputText:
        'a\n<<<<<<< Left\nb-left\n=======\nb-right\n>>>>>>> Right\nc\n<<<<<<< Left\nd-left\n=======\nd-right\n>>>>>>> Right',
      conflicts: [
        {
          lineIndex: 1,
          title: 'Conflict A',
          base: 'b-base',
          left: 'b-left',
          right: 'b-right',
          outputSpan: 5,
        },
        {
          lineIndex: 7,
          title: 'Conflict B',
          base: 'd-base',
          left: 'd-left',
          right: 'd-right',
          outputSpan: 5,
        },
      ],
    })

    const wrapper = mount(TextMergeView)

    await wrapper.find('[data-testid="merge-left-path"]').setValue('left.txt')
    await wrapper.find('[data-testid="merge-right-path"]').setValue('right.txt')
    await wrapper.find('[data-testid="load-text-merge"]').trigger('click')
    await flushPromises()

    expect(wrapper.find('[data-testid="merge-conflict-position"]').text()).toContain('1')
    expect(wrapper.find('[data-testid="merge-sync-panes"]').exists()).toBe(true)

    await wrapper.find('[data-testid="merge-next-conflict"]').trigger('click')
    expect(wrapper.find('[data-testid="merge-conflict-position"]').text()).toContain('2')
    expect(wrapper.find('[data-testid="merge-conflict-item-1"]').classes()).toContain('active')

    await wrapper.find('[data-testid="merge-accept-left-then-next"]').trigger('click')
    await flushPromises()
    expect(wrapper.find('[data-testid="merge-conflict-status"]').text()).toContain('1 conflict')
    expect(outputEditorValue(wrapper)).toContain('d-left')
  })

  it('uses a four-way layout with Merge to Left/Right/Other chrome', async () => {
    const wrapper = await mountLoadedMerge()

    expect(wrapper.find('[data-testid="merge-four-way-grid"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="merge-pane-output"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="merge-to-chrome"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="merge-to-other"]').exists()).toBe(true)

    await wrapper.find('[data-testid="merge-to-left"]').setValue(true)
    await flushPromises()
    expect(
      (wrapper.find('[data-testid="merge-output-path"]').element as HTMLInputElement).value,
    ).toBe('left.txt')
    expect(
      (wrapper.find('[data-testid="merge-output-path"]').element as HTMLInputElement).disabled,
    ).toBe(true)

    await wrapper.find('[data-testid="merge-to-right"]').setValue(true)
    await flushPromises()
    expect(
      (wrapper.find('[data-testid="merge-output-path"]').element as HTMLInputElement).value,
    ).toBe('right.txt')

    await wrapper.find('[data-testid="merge-to-other"]').setValue(true)
    await wrapper.find('[data-testid="merge-output-path"]').setValue('custom-out.txt')
    await flushPromises()
    expect(
      (wrapper.find('[data-testid="merge-output-path"]').element as HTMLInputElement).value,
    ).toBe('custom-out.txt')
    expect(
      (wrapper.find('[data-testid="merge-output-path"]').element as HTMLInputElement).disabled,
    ).toBe(false)
  })

  it('exports a text merge report beside the output path', async () => {
    const wrapper = await mountLoadedMerge()

    await wrapper.find('[data-testid="export-text-merge-report"]').trigger('click')
    await flushPromises()

    expect(saveTextFile).toHaveBeenCalled()

    const call = vi.mocked(saveTextFile).mock.calls.at(-1)?.[0]

    expect(call?.path).toContain('text-merge-report.txt')
    expect(call?.text ?? '').toContain('TEXT-MERGE-REPORT')
    expect(wrapper.find('[data-testid="text-merge-report-status"]').text()).toContain(
      'text-merge-report.txt',
    )
  })

  it('accepts the base side then advances to the next conflict', async () => {
    vi.mocked(mergeTextFiles).mockResolvedValueOnce({
      leftPath: 'left.txt',
      rightPath: 'right.txt',
      centerPath: 'base.txt',
      outputPath: 'out.txt',
      leftText: 'a\nb-left\nc\nd-left',
      rightText: 'a\nb-right\nc\nd-right',
      centerText: 'a\nb-base\nc\nd-base',
      outputText:
        'a\n<<<<<<< Left\nb-left\n=======\nb-right\n>>>>>>> Right\nc\n<<<<<<< Left\nd-left\n=======\nd-right\n>>>>>>> Right',
      conflicts: [
        {
          lineIndex: 1,
          title: 'Conflict A',
          base: 'b-base',
          left: 'b-left',
          right: 'b-right',
          outputSpan: 5,
        },
        {
          lineIndex: 7,
          title: 'Conflict B',
          base: 'd-base',
          left: 'd-left',
          right: 'd-right',
          outputSpan: 5,
        },
      ],
    })

    const wrapper = mount(TextMergeView)

    await wrapper.find('[data-testid="merge-left-path"]').setValue('left.txt')
    await wrapper.find('[data-testid="merge-right-path"]').setValue('right.txt')
    await wrapper.find('[data-testid="load-text-merge"]').trigger('click')
    await flushPromises()

    await wrapper.find('[data-testid="merge-accept-base-then-next"]').trigger('click')
    await flushPromises()
    expect(wrapper.find('[data-testid="merge-conflict-status"]').text()).toContain('1 conflict')
    expect(outputEditorValue(wrapper)).toContain('b-base')
  })
})

async function mountLoadedMerge(): Promise<VueWrapper> {
  const wrapper = mount(TextMergeView)

  await wrapper.find('[data-testid="merge-left-path"]').setValue('left.txt')
  await wrapper.find('[data-testid="merge-right-path"]').setValue('right.txt')
  await wrapper.find('[data-testid="merge-center-path"]').setValue('base.txt')
  await wrapper.find('[data-testid="merge-output-path"]').setValue('out.txt')
  await wrapper.find('[data-testid="load-text-merge"]').trigger('click')
  await flushPromises()

  return wrapper
}

function outputEditorValue(wrapper: ReturnType<typeof mount>): string {
  return (wrapper.find('[data-testid="merge-output-editor"]').element as HTMLTextAreaElement).value
}
