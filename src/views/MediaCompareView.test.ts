import { flushPromises, mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import MediaCompareView from './MediaCompareView.vue'
import { compareMediaFiles, saveTextFile } from '@/api/diff'
import { useSessionLaunchStore } from '@/stores/sessionLaunch'
import { useTabsStore } from '@/stores/tabs'
import { useViewActionsStore } from '@/stores/viewActions'

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
    path: 'C:/music/media-compare.txt',
    bytesWritten: 64,
  }),
  compareMediaFiles: vi.fn().mockResolvedValue({
    left: {
      name: 'fixture-left.mp3',
      container: 'MP3',
      duration: '00:00.000',
      stream: {
        codec: 'MP3',
        sampleRate: 'Unknown',
        channels: 'Unknown',
        bitrate: 'Unknown',
      },
    },
    right: {
      name: 'fixture-right.mp3',
      container: 'MP3',
      duration: '00:00.000',
      stream: {
        codec: 'MP3',
        sampleRate: 'Unknown',
        channels: 'Unknown',
        bitrate: 'Unknown',
      },
    },
    fields: [
      {
        field: 'Title',
        left: 'Left Song',
        right: 'Right Song',
        status: 'modified',
      },
      {
        field: 'Artist',
        left: 'Aster',
        right: 'Aster',
        status: 'unchanged',
      },
      {
        field: 'Comment',
        left: 'demo',
        right: 'demo-b',
        status: 'modified',
      },
    ],
    summary: {
      added: 0,
      removed: 0,
      modified: 2,
      unchanged: 1,
    },
  }),
}))

describe('MediaCompareView', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    localStorage.clear()
    vi.mocked(compareMediaFiles).mockClear()
    vi.mocked(saveTextFile).mockClear()
    clipboardWriteText.mockClear()
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: {
        writeText: clipboardWriteText,
      },
    })
  })

  it('runs a real media comparison request and renders returned metadata', async () => {
    const wrapper = mount(MediaCompareView)

    await wrapper.find('[data-testid="media-left-path"]').setValue('C:/music/fixture-left.mp3')
    await wrapper.find('[data-testid="media-right-path"]').setValue('C:/music/fixture-right.mp3')
    await wrapper.find('[data-testid="run-media-compare"]').trigger('click')
    await wrapper.vm.$nextTick()

    expect(compareMediaFiles).toHaveBeenCalledWith({
      leftPath: 'C:/music/fixture-left.mp3',
      rightPath: 'C:/music/fixture-right.mp3',
    })
    expect(wrapper.text()).toContain('fixture-left.mp3')
    expect(wrapper.text()).toContain('fixture-right.mp3')
    expect(wrapper.find('[data-testid="media-summary-modified"]').text()).toContain('2')
    expect(wrapper.find('[data-testid="media-summary-minor"]').text()).toContain('1')
    expect(wrapper.find('[data-testid="media-field-Title"]').text()).toContain('Left Song')
    expect(wrapper.find('[data-testid="media-field-Title"]').text()).toContain('Right Song')
  })

  it('runs automatically from dropped media launch paths', async () => {
    useSessionLaunchStore().setPendingLaunch({
      id: 'launch-media',
      source: 'drop',
      sessionType: 'media-compare',
      title: 'left.mp3 vs right.mp3',
      route: '/compare/media',
      autoRun: true,
      locations: {
        left: { uri: 'C:/drop/left.mp3', kind: 'file', readOnly: false },
        right: { uri: 'C:/drop/right.mp3', kind: 'file', readOnly: false },
      },
    })

    mount(MediaCompareView)
    await Promise.resolve()

    expect(compareMediaFiles).toHaveBeenCalledWith({
      leftPath: 'C:/drop/left.mp3',
      rightPath: 'C:/drop/right.mp3',
    })
  })

  it('starts empty without demo media tags', () => {
    const wrapper = mount(MediaCompareView)

    expect(wrapper.text()).toContain('Media Compare')
    expect(wrapper.text()).not.toContain('left-track.flac')
    expect(wrapper.text()).not.toContain('Northern Lights')
    expect(wrapper.find('[data-testid="media-summary-modified"]').text()).toContain('0')
  })

  it('renders dual HTML5 media elements for local paths', async () => {
    const wrapper = mount(MediaCompareView)

    await wrapper.find('[data-testid="media-left-path"]').setValue('C:/music/fixture-left.mp3')
    await wrapper.find('[data-testid="media-right-path"]').setValue('C:/music/fixture-right.mp3')
    await wrapper.vm.$nextTick()

    expect(wrapper.find('[data-testid="media-playback-panel"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="media-left-audio"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="media-right-audio"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="media-scrub"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="media-play-toggle"]').exists()).toBe(true)
  })

  it('sets path-pair tab titles for media sessions', async () => {
    const wrapper = mount(MediaCompareView)
    const tabs = useTabsStore()

    tabs.openTab({
      title: 'Media Compare',
      titleKey: 'ui.mediaCompare',
      route: '/compare/media',
      dirty: false,
    })

    await wrapper.find('[data-testid="media-left-path"]').setValue('C:/music/fixture-left.mp3')
    await wrapper.find('[data-testid="media-right-path"]').setValue('C:/music/fixture-right.mp3')
    await wrapper.vm.$nextTick()

    expect(tabs.activeTab.title).toBe('fixture-left.mp3 <--> fixture-right.mp3')
  })

  it('enables filter and rules toolbar actions', () => {
    const wrapper = mount(MediaCompareView)

    expect(
      wrapper.find('[data-testid="media-session-toolbar-all"]').attributes('disabled'),
    ).toBeUndefined()
    expect(
      wrapper.find('[data-testid="media-session-toolbar-diffs"]').attributes('disabled'),
    ).toBeUndefined()
    expect(
      wrapper.find('[data-testid="media-session-toolbar-same"]').attributes('disabled'),
    ).toBeUndefined()
    expect(
      wrapper.find('[data-testid="media-session-toolbar-minor"]').attributes('disabled'),
    ).toBeUndefined()
    expect(wrapper.find('[data-testid="media-session-toolbar-play2"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="media-session-toolbar-next-diff"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="media-session-toolbar-prev-diff"]').exists()).toBe(true)
    expect(
      wrapper.find('[data-testid="media-session-toolbar-rules"]').attributes('disabled'),
    ).toBeUndefined()
  })

  it('filters minor differences and toggles importance rules', async () => {
    const wrapper = mount(MediaCompareView)

    await wrapper.find('[data-testid="media-left-path"]').setValue('C:/music/fixture-left.mp3')
    await wrapper.find('[data-testid="media-right-path"]').setValue('C:/music/fixture-right.mp3')
    await wrapper.find('[data-testid="run-media-compare"]').trigger('click')
    await wrapper.vm.$nextTick()

    await wrapper.find('[data-testid="media-session-toolbar-minor"]').trigger('click')
    expect(wrapper.find('[data-testid="media-field-Comment"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="media-field-Title"]').exists()).toBe(false)

    await wrapper.find('[data-testid="media-session-toolbar-rules"]').trigger('click')
    expect(wrapper.find('[data-testid="media-rules-panel"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="media-rule-Title"]').exists()).toBe(true)
    await wrapper.find('[data-testid="media-rule-Comment"] input').setValue(true)
    await wrapper.find('[data-testid="media-session-toolbar-diffs"]').trigger('click')
    expect(wrapper.find('[data-testid="media-field-Comment"]').exists()).toBe(true)

    await wrapper.find('[data-testid="media-rules-reset"]').trigger('click')
    await wrapper.find('[data-testid="media-session-toolbar-minor"]').trigger('click')
    expect(wrapper.find('[data-testid="media-field-Comment"]').exists()).toBe(true)
  })

  it('filters diffs and same tag rows from the toolbar', async () => {
    const wrapper = mount(MediaCompareView)

    await wrapper.find('[data-testid="media-left-path"]').setValue('C:/music/fixture-left.mp3')
    await wrapper.find('[data-testid="media-right-path"]').setValue('C:/music/fixture-right.mp3')
    await wrapper.find('[data-testid="run-media-compare"]').trigger('click')
    await wrapper.vm.$nextTick()

    await wrapper.find('[data-testid="media-session-toolbar-diffs"]').trigger('click')
    expect(wrapper.find('[data-testid="media-field-Title"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="media-field-Comment"]').exists()).toBe(false)
    expect(wrapper.find('[data-testid="media-field-Artist"]').exists()).toBe(false)

    await wrapper.find('[data-testid="media-session-toolbar-same"]').trigger('click')
    expect(wrapper.find('[data-testid="media-field-Artist"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="media-field-Title"]').exists()).toBe(false)
  })

  it('exports the media report to clipboard and a sibling text file', async () => {
    const wrapper = mount(MediaCompareView)

    await wrapper.find('[data-testid="media-left-path"]').setValue('C:/music/fixture-left.mp3')
    await wrapper.find('[data-testid="media-right-path"]').setValue('C:/music/fixture-right.mp3')
    await wrapper.find('[data-testid="run-media-compare"]').trigger('click')
    await wrapper.vm.$nextTick()
    await Promise.resolve()

    await wrapper.find('[data-testid="export-media-report"]').trigger('click')
    await wrapper.vm.$nextTick()
    await Promise.resolve()

    expect(clipboardWriteText).toHaveBeenCalled()
    const payload = clipboardWriteText.mock.calls[0]?.[0] ?? ''

    expect(payload).toContain('MEDIA-REPORT')
    expect(payload).toContain('left: C:/music/fixture-left.mp3')
    expect(payload).toContain('Title')
    expect(saveTextFile).toHaveBeenCalledWith({
      path: 'C:/music/media-compare.txt',
      text: payload,
      createBackup: false,
      backupRetention: 1,
    })
    expect(wrapper.find('[data-testid="media-report-status"]').text()).toBe(
      'C:/music/media-compare.txt',
    )
  })

  it('shows a readable error when compare invoke rejects an AppErrorPayload', async () => {
    vi.mocked(compareMediaFiles).mockRejectedValueOnce({
      code: 'app.unknown',
      messageKey: 'error.app.unknown.title',
      params: {},
      debugMessage: 'unsupported media container',
    })

    const wrapper = mount(MediaCompareView)

    await wrapper.find('[data-testid="media-left-path"]').setValue('C:/music/fixture-left.mp3')
    await wrapper.find('[data-testid="media-right-path"]').setValue('C:/music/fixture-right.mp3')
    await wrapper.find('[data-testid="run-media-compare"]').trigger('click')
    await wrapper.vm.$nextTick()
    await Promise.resolve()
    await wrapper.vm.$nextTick()

    const errorEl = wrapper.find('[data-testid="media-compare-error"]')

    expect(errorEl.exists()).toBe(true)
    expect(errorEl.text()).toContain('unsupported media container')
    expect(errorEl.text()).not.toContain('[object Object]')
  })

  it('exposes Next Diff and Prev Diff and navigates differing tag fields', async () => {
    const wrapper = mount(MediaCompareView)

    expect(wrapper.find('[data-testid="media-session-toolbar-next-diff"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="media-session-toolbar-prev-diff"]').exists()).toBe(true)

    await wrapper.find('[data-testid="media-left-path"]').setValue('C:/music/fixture-left.mp3')
    await wrapper.find('[data-testid="media-right-path"]').setValue('C:/music/fixture-right.mp3')
    await wrapper.find('[data-testid="run-media-compare"]').trigger('click')
    await wrapper.vm.$nextTick()

    expect(
      wrapper.find('[data-testid="media-session-toolbar-next-diff"]').attributes('disabled'),
    ).toBeUndefined()

    expect(wrapper.find('[data-testid="media-field-Title"]').attributes('data-selected')).toBe(
      'true',
    )

    await wrapper.find('[data-testid="media-session-toolbar-next-diff"]').trigger('click')
    expect(wrapper.find('[data-testid="media-field-Comment"]').attributes('data-selected')).toBe(
      'true',
    )
  })

  it('applies View filter and next-diff commands from the menu action bus', async () => {
    const wrapper = mount(MediaCompareView)

    await wrapper.find('[data-testid="media-left-path"]').setValue('C:/music/fixture-left.mp3')
    await wrapper.find('[data-testid="media-right-path"]').setValue('C:/music/fixture-right.mp3')
    await wrapper.find('[data-testid="run-media-compare"]').trigger('click')
    await wrapper.vm.$nextTick()

    const viewActions = useViewActionsStore()

    viewActions.dispatch('show-differences')
    await wrapper.vm.$nextTick()
    expect(wrapper.find('[data-testid="media-field-Title"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="media-field-Artist"]').exists()).toBe(false)

    viewActions.dispatch('toggle-minor')
    await wrapper.vm.$nextTick()
    expect(wrapper.find('[data-testid="media-field-Comment"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="media-field-Title"]').exists()).toBe(false)

    viewActions.dispatch('show-all')
    await wrapper.vm.$nextTick()
    expect(wrapper.find('[data-testid="media-field-Title"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="media-field-Artist"]').exists()).toBe(true)

    expect(wrapper.find('[data-testid="media-field-Title"]').attributes('data-selected')).toBe(
      'true',
    )
    viewActions.dispatch('next-difference')
    await wrapper.vm.$nextTick()
    expect(wrapper.find('[data-testid="media-field-Comment"]').attributes('data-selected')).toBe(
      'true',
    )

    expect(wrapper.find('[data-testid="media-rules-panel"]').exists()).toBe(false)
    viewActions.dispatch('rules')
    await wrapper.vm.$nextTick()
    expect(wrapper.find('[data-testid="media-rules-panel"]').exists()).toBe(true)
    viewActions.dispatch('session-settings')
    await wrapper.vm.$nextTick()
    expect(wrapper.find('[data-testid="media-rules-panel"]').exists()).toBe(false)
  })
  it('shows size/date path footers after compare', async () => {
    const wrapper = mount(MediaCompareView, {
      global: { stubs: { teleport: true } },
    })

    await wrapper.find('[data-testid="media-left-path"]').setValue('C:/left.bin')
    await wrapper.find('[data-testid="media-right-path"]').setValue('C:/right.bin')
    await wrapper.find('[data-testid="run-media-compare"]').trigger('click')
    await flushPromises()

    expect(wrapper.find('[data-testid="media-path-footers"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="media-left-path-footer"]').text()).toMatch(/bytes/)
    expect(wrapper.find('[data-testid="media-right-path-footer"]').text()).toMatch(/bytes/)
  })
})
