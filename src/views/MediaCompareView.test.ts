import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import MediaCompareView from './MediaCompareView.vue'

describe('MediaCompareView', () => {
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
