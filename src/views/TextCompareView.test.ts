import { mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import TextCompareView from './TextCompareView.vue'
import { diffText } from '@/api/diff'

vi.mock('@/api/diff', () => ({
  diffText: vi.fn().mockResolvedValue({
    lines: [],
    stats: { added: 0, deleted: 0, modified: 0, equal: 0 },
  }),
}))

describe('TextCompareView', () => {
  beforeEach(() => {
    vi.mocked(diffText).mockClear()
  })

  it('passes the selected algorithm when running a diff', async () => {
    const wrapper = mount(TextCompareView, {
      global: {
        stubs: {
          NButton: {
            props: ['loading'],
            emits: ['click'],
            template: '<button @click="$emit(\'click\')"><slot /></button>',
          },
          NInput: {
            props: ['value'],
            emits: ['update:value'],
            template:
              '<textarea :value="value" @input="$emit(\'update:value\', $event.target.value)" />',
          },
          NAlert: { template: '<div><slot /></div>' },
        },
      },
    })

    await wrapper.find('[data-testid="algorithm-select"]').setValue('histogram')
    await wrapper.find('[data-testid="run-diff"]').trigger('click')

    expect(diffText).toHaveBeenCalledWith(
      expect.objectContaining({
        algorithm: 'histogram',
      }),
    )
  })
})
