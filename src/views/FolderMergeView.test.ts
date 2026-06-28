import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import FolderMergeView from './FolderMergeView.vue'
import type { VueWrapper } from '@vue/test-utils'

function mountFolderMergeView(): VueWrapper {
  return mount(FolderMergeView, {
    global: {
      stubs: {
        NButton: {
          props: ['disabled'],
          emits: ['click'],
          template: '<button :disabled="disabled" @click="$emit(\'click\')"><slot /></button>',
        },
      },
    },
  })
}

describe('FolderMergeView', () => {
  it('renders left, base, right, and output folder inputs', () => {
    const wrapper = mountFolderMergeView()

    expect(wrapper.find('[data-testid="folder-merge-left-path"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="folder-merge-base-path"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="folder-merge-right-path"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="folder-merge-output-path"]').exists()).toBe(true)
    expect(wrapper.text()).toContain('Left folder')
    expect(wrapper.text()).toContain('Base folder')
    expect(wrapper.text()).toContain('Right folder')
    expect(wrapper.text()).toContain('Output folder')
  })

  it('builds a folder merge plan with automatic actions and conflicts', async () => {
    const wrapper = mountFolderMergeView()

    expect(wrapper.find('[data-testid="folder-merge-plan"]').exists()).toBe(false)

    await wrapper.find('[data-testid="folder-merge-build-plan"]').trigger('click')

    const summary = wrapper.find('[data-testid="folder-merge-summary"]')
    const plan = wrapper.find('[data-testid="folder-merge-plan"]')

    expect(summary.text()).toContain('5')
    expect(summary.text()).toContain('1')
    expect(plan.exists()).toBe(true)
    expect(wrapper.findAll('[data-testid="folder-merge-row"]')).toHaveLength(5)
    expect(plan.text()).toContain('same.txt')
    expect(plan.text()).toContain('left-add.txt')
    expect(plan.text()).toContain('right-add.txt')
    expect(plan.text()).toContain('config')
    expect(plan.text()).toContain('Mark conflict')
  })

  it('shows conflict details with three-way context', async () => {
    const wrapper = mountFolderMergeView()

    await wrapper.find('[data-testid="folder-merge-build-plan"]').trigger('click')

    const conflicts = wrapper.find('[data-testid="folder-merge-conflict-list"]')

    expect(conflicts.exists()).toBe(true)
    expect(conflicts.text()).toContain('config')
    expect(conflicts.text()).toContain('Base: Directory')
    expect(conflicts.text()).toContain('Left: File')
    expect(conflicts.text()).toContain('Right: Directory')
    expect(conflicts.text()).toContain('Left and right changed the same path differently')
  })
})
