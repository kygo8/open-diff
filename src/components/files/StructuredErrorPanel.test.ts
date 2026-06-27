import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import StructuredErrorPanel from './StructuredErrorPanel.vue'

describe('StructuredErrorPanel', () => {
  it('renders operation, path, reason, and suggestion', () => {
    const wrapper = mount(StructuredErrorPanel, {
      props: {
        error: {
          operation: 'write',
          path: 'C:/work/locked.txt',
          reason: 'Permission denied',
          suggestion: 'Check file permissions and try again.',
        },
      },
    })

    expect(wrapper.text()).toContain('write')
    expect(wrapper.text()).toContain('C:/work/locked.txt')
    expect(wrapper.text()).toContain('Permission denied')
    expect(wrapper.text()).toContain('Check file permissions and try again.')
  })
})
