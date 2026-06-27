import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import FolderCompareView from './FolderCompareView.vue'

describe('FolderCompareView', () => {
  it('renders left and right folder tree tables with core columns', () => {
    const wrapper = mount(FolderCompareView, {
      global: {
        stubs: {
          NButton: {
            props: ['disabled'],
            template: '<button :disabled="disabled"><slot /></button>',
          },
        },
      },
    })

    expect(wrapper.find('[data-testid="folder-tree-table"]').exists()).toBe(true)
    expect(wrapper.findAll('[data-testid="folder-row"]')).toHaveLength(4)
    expect(wrapper.text()).toContain('Name')
    expect(wrapper.text()).toContain('Size')
    expect(wrapper.text()).toContain('Modified')
    expect(wrapper.text()).toContain('Status')
    expect(wrapper.text()).toContain('src')
    expect(wrapper.text()).toContain('README.md')
    expect(wrapper.text()).toContain('Different')
  })
})
