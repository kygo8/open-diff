import { mount, type VueWrapper } from '@vue/test-utils'
import { defineComponent } from 'vue'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import TextCompareView from './TextCompareView.vue'
import { diffText } from '@/api/diff'

vi.mock('@/api/diff', () => ({
  diffText: vi.fn().mockResolvedValue({
    lines: [],
    stats: { added: 0, deleted: 0, modified: 0, equal: 0 },
  }),
}))

const NInputStub = defineComponent({
  name: 'NInput',
  props: {
    value: {
      type: String,
      default: '',
    },
  },
  emits: ['update:value'],
  template: '<textarea :value="value" @input="$emit(\'update:value\', $event.target.value)" />',
})

function mountTextCompareView(): VueWrapper {
  return mount(TextCompareView, {
    global: {
      stubs: {
        NButton: {
          props: ['loading'],
          emits: ['click'],
          template: '<button @click="$emit(\'click\')"><slot /></button>',
        },
        NInput: {
          ...NInputStub,
        },
        NAlert: { template: '<div><slot /></div>' },
      },
    },
  })
}

describe('TextCompareView', () => {
  beforeEach(() => {
    vi.mocked(diffText).mockClear()
  })

  it('passes the selected algorithm when running a diff', async () => {
    const wrapper = mountTextCompareView()

    await wrapper.find('[data-testid="algorithm-select"]').setValue('histogram')
    await wrapper.find('[data-testid="run-diff"]').trigger('click')

    expect(diffText).toHaveBeenCalledWith(
      expect.objectContaining({
        algorithm: 'histogram',
      }),
    )
  })

  it('shows detected line endings for the current text inputs', async () => {
    const wrapper = mountTextCompareView()

    expect(wrapper.find('[data-testid="line-ending-status"]').text()).toContain('Left: LF')
    expect(wrapper.find('[data-testid="line-ending-status"]').text()).toContain('Right: LF')

    wrapper.findAllComponents(NInputStub)[0]?.vm.$emit('update:value', 'one\r\ntwo')
    await wrapper.vm.$nextTick()

    expect(wrapper.find('[data-testid="line-ending-status"]').text()).toContain('Left: CRLF')
  })

  it('marks edits as dirty and recomputes diff from edited text', async () => {
    const wrapper = mountTextCompareView()

    wrapper.findAllComponents(NInputStub)[0]?.vm.$emit('update:value', 'edited left')
    await wrapper.vm.$nextTick()

    expect(wrapper.find('[data-testid="dirty-status"]').text()).toContain('Unsaved edits')

    await wrapper.find('[data-testid="run-diff"]').trigger('click')

    expect(diffText).toHaveBeenLastCalledWith(
      expect.objectContaining({
        left: 'edited left',
      }),
    )
    expect(wrapper.find('[data-testid="dirty-status"]').text()).toContain('No edits')
  })
})
