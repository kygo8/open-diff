import { mount, type VueWrapper } from '@vue/test-utils'
import { defineComponent } from 'vue'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import ClipboardCompareView from './ClipboardCompareView.vue'
import { diffText } from '@/api/diff'
import { readClipboardTextSource } from '@/app/clipboardSource'

vi.mock('@/app/clipboardSource', () => ({
  readClipboardTextSource: vi.fn(),
}))

vi.mock('@/api/diff', () => ({
  diffText: vi.fn().mockResolvedValue({
    lines: [],
    stats: { added: 0, deleted: 0, modified: 1, equal: 1 },
  }),
}))

const TextDiffPanelStub = defineComponent({
  name: 'TextDiffPanel',
  props: {
    lines: {
      type: Array,
      default: () => [],
    },
  },
  template: '<section data-testid="clipboard-diff-panel" />',
})

function mountClipboardCompareView(): VueWrapper {
  return mount(ClipboardCompareView, {
    global: {
      stubs: {
        NButton: {
          props: ['disabled', 'loading'],
          emits: ['click'],
          template: '<button :disabled="disabled" @click="$emit(\'click\')"><slot /></button>',
        },
        NAlert: { template: '<div><slot /></div>' },
        TextDiffPanel: TextDiffPanelStub,
      },
    },
  })
}

describe('ClipboardCompareView', () => {
  beforeEach(() => {
    vi.mocked(readClipboardTextSource).mockReset()
    vi.mocked(diffText).mockClear()
  })

  it('captures unique clipboard text entries into history', async () => {
    vi.mocked(readClipboardTextSource)
      .mockResolvedValueOnce({ kind: 'clipboard-text', title: 'Clipboard Text', text: 'alpha' })
      .mockResolvedValueOnce({ kind: 'clipboard-text', title: 'Clipboard Text', text: 'alpha' })
      .mockResolvedValueOnce({ kind: 'clipboard-text', title: 'Clipboard Text', text: 'beta' })

    const wrapper = mountClipboardCompareView()

    await wrapper.find('[data-testid="clipboard-capture"]').trigger('click')
    await wrapper.find('[data-testid="clipboard-capture"]').trigger('click')
    await wrapper.find('[data-testid="clipboard-capture"]').trigger('click')

    expect(wrapper.findAll('[data-testid="clipboard-history-entry"]')).toHaveLength(2)
    expect(wrapper.text()).toContain('alpha')
    expect(wrapper.text()).toContain('beta')
    expect(wrapper.find('[data-testid="clipboard-history-count"]').text()).toContain('2')
  })

  it('compares the selected clipboard history entries as text', async () => {
    vi.mocked(readClipboardTextSource)
      .mockResolvedValueOnce({ kind: 'clipboard-text', title: 'Clipboard Text', text: 'left text' })
      .mockResolvedValueOnce({
        kind: 'clipboard-text',
        title: 'Clipboard Text',
        text: 'right text',
      })

    const wrapper = mountClipboardCompareView()

    await wrapper.find('[data-testid="clipboard-capture"]').trigger('click')
    await wrapper.find('[data-testid="clipboard-capture"]').trigger('click')
    await wrapper.find('[data-testid="clipboard-compare"]').trigger('click')

    expect(diffText).toHaveBeenCalledWith(
      expect.objectContaining({
        left: 'left text',
        right: 'right text',
        algorithm: 'myers',
      }),
    )
    expect(wrapper.find('[data-testid="clipboard-diff-panel"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="clipboard-diff-stats"]').text()).toContain('1 modified')
  })
})
