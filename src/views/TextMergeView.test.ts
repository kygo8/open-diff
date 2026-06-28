import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import TextMergeView from './TextMergeView.vue'

describe('TextMergeView', () => {
  it('renders the four text merge panes', () => {
    const wrapper = mount(TextMergeView)

    expect(wrapper.find('[data-testid="merge-pane-left"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="merge-pane-base"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="merge-pane-right"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="merge-pane-output"]').exists()).toBe(true)
  })

  it('summarizes conflicts and shows the merged output', () => {
    const wrapper = mount(TextMergeView)

    expect(wrapper.find('[data-testid="merge-conflict-status"]').text()).toContain('1 conflict')
    expect(wrapper.find('[data-testid="merge-pane-output"]').text()).toContain('<<<<<<< LEFT')
    expect(wrapper.find('[data-testid="merge-conflict-list"]').text()).toContain('Line 2')
  })

  it('accepts the left side for the current conflict', async () => {
    const wrapper = mount(TextMergeView)

    await wrapper.find('[data-testid="accept-left-conflict"]').trigger('click')

    expect(wrapper.find('[data-testid="merge-pane-output"]').text()).toContain('timeout = 45')
    expect(wrapper.find('[data-testid="merge-pane-output"]').text()).not.toContain('<<<<<<< LEFT')
    expect(wrapper.find('[data-testid="merge-conflict-status"]').text()).toContain('0 conflicts')
  })

  it('accepts the right side for the current conflict', async () => {
    const wrapper = mount(TextMergeView)

    await wrapper.find('[data-testid="accept-right-conflict"]').trigger('click')

    expect(wrapper.find('[data-testid="merge-pane-output"]').text()).toContain('timeout = 60')
    expect(wrapper.find('[data-testid="merge-pane-output"]').text()).not.toContain('>>>>>>> RIGHT')
    expect(wrapper.find('[data-testid="merge-conflict-status"]').text()).toContain('0 conflicts')
  })

  it('accepts the base side for the current conflict', async () => {
    const wrapper = mount(TextMergeView)

    await wrapper.find('[data-testid="accept-base-conflict"]').trigger('click')

    expect(wrapper.find('[data-testid="merge-pane-output"]').text()).toContain('timeout = 30')
    expect(wrapper.find('[data-testid="merge-pane-output"]').text()).not.toContain('=======')
    expect(wrapper.find('[data-testid="merge-conflict-status"]').text()).toContain('0 conflicts')
  })
})
