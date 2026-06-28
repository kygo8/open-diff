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
})
