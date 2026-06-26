import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import TextDiffPanel from './TextDiffPanel.vue'
import type { DiffLine } from '@/types/diff'

describe('TextDiffPanel', () => {
  it('renders line numbers and diff text', () => {
    const lines: DiffLine[] = [
      { leftNumber: 1, rightNumber: 1, leftText: 'same', rightText: 'same', kind: 'equal' },
      { leftNumber: 2, rightNumber: 2, leftText: 'old', rightText: 'new', kind: 'modified' },
    ]

    const wrapper = mount(TextDiffPanel, { props: { lines } })

    expect(wrapper.text()).toContain('same')
    expect(wrapper.text()).toContain('old')
    expect(wrapper.text()).toContain('new')
    expect(wrapper.find('.modified').exists()).toBe(true)
  })
})
