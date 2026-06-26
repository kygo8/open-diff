import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import TextDiffPanel from './TextDiffPanel.vue'
import type { DiffLine } from '@/types/diff'

describe('TextDiffPanel', () => {
  it('renders line numbers and diff text', () => {
    const lines: DiffLine[] = [
      {
        leftNumber: 1,
        rightNumber: 1,
        leftText: 'same',
        rightText: 'same',
        kind: 'equal',
        inlineSegments: { left: [], right: [] },
      },
      {
        leftNumber: 2,
        rightNumber: 2,
        leftText: 'old',
        rightText: 'new',
        kind: 'modified',
        inlineSegments: { left: [], right: [] },
      },
    ]

    const wrapper = mount(TextDiffPanel, { props: { lines } })

    expect(wrapper.text()).toContain('same')
    expect(wrapper.text()).toContain('old')
    expect(wrapper.text()).toContain('new')
    expect(wrapper.find('.modified').exists()).toBe(true)
  })

  it('renders changed inline segments as highlighted spans', () => {
    const lines: DiffLine[] = [
      {
        leftNumber: 1,
        rightNumber: 1,
        leftText: 'old value',
        rightText: 'new value',
        kind: 'modified',
        inlineSegments: {
          left: [
            { text: 'old', changed: true },
            { text: ' value', changed: false },
          ],
          right: [
            { text: 'new', changed: true },
            { text: ' value', changed: false },
          ],
        },
      },
    ]

    const wrapper = mount(TextDiffPanel, { props: { lines } })
    const changedSegments = wrapper.findAll('.inline-segment-changed')

    expect(changedSegments).toHaveLength(2)
    expect(changedSegments.map((segment) => segment.text())).toEqual(['old', 'new'])
    expect(wrapper.text()).toContain('old value')
    expect(wrapper.text()).toContain('new value')
  })

  it('keeps left and right cells in fixed-height synchronized rows', () => {
    const lines: DiffLine[] = Array.from({ length: 3 }, (_, index) => {
      const lineNumber = index + 1

      return {
        leftNumber: lineNumber,
        rightNumber: lineNumber,
        leftText: `left ${String(lineNumber)}`,
        rightText: `right ${String(lineNumber)}`,
        kind: 'equal',
        inlineSegments: { left: [], right: [] },
      }
    })

    const wrapper = mount(TextDiffPanel, { props: { lines } })
    const body = wrapper.find('[data-testid="text-diff-scroll-container"]')
    const rows = wrapper.findAll('.diff-row')

    expect(body.exists()).toBe(true)
    expect(body.classes()).toContain('diff-body-synchronized')
    expect(rows).toHaveLength(3)

    for (const row of rows) {
      expect(row.attributes('style')).toContain('--text-diff-row-height: 24px')
      expect(row.findAll('.cell')).toHaveLength(2)
    }
  })
})
