import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import MediaCompareView from './MediaCompareView.vue'
import { compareMediaFiles } from '@/api/diff'
import { useSessionLaunchStore } from '@/stores/sessionLaunch'

vi.mock('@/api/diff', () => ({
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
    ],
    summary: {
      added: 0,
      removed: 0,
      modified: 1,
      unchanged: 1,
    },
  }),
}))

describe('MediaCompareView', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.mocked(compareMediaFiles).mockClear()
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
    expect(wrapper.find('[data-testid="media-summary-modified"]').text()).toContain('1')
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

  it('renders media metadata summary and field difference counts', () => {
    const wrapper = mount(MediaCompareView)

    expect(wrapper.text()).toContain('Media Compare')
    expect(wrapper.text()).toContain('left-track.flac')
    expect(wrapper.text()).toContain('right-track.flac')
    expect(wrapper.find('[data-testid="media-summary-added"]').text()).toContain('1')
    expect(wrapper.find('[data-testid="media-summary-removed"]').text()).toContain('1')
    expect(wrapper.find('[data-testid="media-summary-modified"]').text()).toContain('2')
    expect(wrapper.find('[data-testid="media-summary-unchanged"]').text()).toContain('1')
  })

  it('renders tag rows from both sides with status highlighting', () => {
    const wrapper = mount(MediaCompareView)

    const titleRow = wrapper.find('[data-testid="media-field-Title"]')
    const genreRow = wrapper.find('[data-testid="media-field-Genre"]')
    const commentRow = wrapper.find('[data-testid="media-field-Comment"]')

    expect(titleRow.exists()).toBe(true)
    expect(titleRow.classes()).toContain('status-modified')
    expect(titleRow.text()).toContain('Northern Lights')
    expect(titleRow.text()).toContain('Northern Lights (Remaster)')

    expect(genreRow.exists()).toBe(true)
    expect(genreRow.classes()).toContain('status-added')
    expect(genreRow.text()).toContain('--')
    expect(genreRow.text()).toContain('Ambient')

    expect(commentRow.exists()).toBe(true)
    expect(commentRow.classes()).toContain('status-removed')
    expect(commentRow.text()).toContain('Draft')
  })

  it('renders a report-ready field table with stream context', () => {
    const wrapper = mount(MediaCompareView)

    expect(wrapper.find('[data-testid="media-report-table"]').exists()).toBe(true)
    expect(wrapper.text()).toContain('FLAC')
    expect(wrapper.text()).toContain('44.1 kHz')
    expect(wrapper.text()).toContain('2 channels')
    expect(wrapper.text()).toContain('Lossless')
  })
})
