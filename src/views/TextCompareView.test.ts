import { mount, type VueWrapper } from '@vue/test-utils'
import { defineComponent } from 'vue'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import TextCompareView from './TextCompareView.vue'
import { diffText } from '@/api/diff'
import type { TextDiffRequest } from '@/types/diff'

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

  it('undoes and redoes left-side edits', async () => {
    const wrapper = mountTextCompareView()
    const leftInput = wrapper.findAllComponents(NInputStub)[0]

    leftInput.vm.$emit('update:value', 'first edit')
    await wrapper.vm.$nextTick()
    leftInput.vm.$emit('update:value', 'second edit')
    await wrapper.vm.$nextTick()

    await wrapper.find('[data-testid="undo-left"]').trigger('click')
    await wrapper.vm.$nextTick()

    expect(wrapper.findAll('textarea')[0]?.element.value).toBe('first edit')

    await wrapper.find('[data-testid="redo-left"]').trigger('click')
    await wrapper.vm.$nextTick()

    expect(wrapper.findAll('textarea')[0]?.element.value).toBe('second edit')
  })

  it('copies the current diff from left to right and marks the view dirty', async () => {
    vi.mocked(diffText).mockResolvedValueOnce({
      lines: [
        {
          leftNumber: 1,
          rightNumber: 1,
          leftText: 'left changed',
          rightText: 'right changed',
          kind: 'modified',
          inlineSegments: { left: [], right: [] },
        },
      ],
      stats: { added: 0, deleted: 0, modified: 1, equal: 0 },
    })

    const wrapper = mountTextCompareView()

    await wrapper.find('[data-testid="run-diff"]').trigger('click')
    await wrapper.vm.$nextTick()
    await wrapper.find('[data-testid="copy-left-to-right"]').trigger('click')
    await wrapper.vm.$nextTick()

    expect(wrapper.find('[data-testid="dirty-status"]').text()).toContain('Unsaved edits')

    await wrapper.find('[data-testid="run-diff"]').trigger('click')

    const lastCall = vi.mocked(diffText).mock.lastCall

    expect(lastCall).toBeDefined()

    const [lastRequest] = lastCall as [TextDiffRequest]

    expect(lastRequest.right).toContain('left changed')
  })

  it('advances to the next diff after copying', async () => {
    vi.mocked(diffText).mockResolvedValueOnce({
      lines: [
        {
          leftNumber: 1,
          rightNumber: 1,
          leftText: 'left first',
          rightText: 'right first',
          kind: 'modified',
          inlineSegments: { left: [], right: [] },
        },
        {
          leftNumber: 2,
          rightNumber: 2,
          leftText: 'left second',
          rightText: 'right second',
          kind: 'modified',
          inlineSegments: { left: [], right: [] },
        },
      ],
      stats: { added: 0, deleted: 0, modified: 2, equal: 0 },
    })

    const wrapper = mountTextCompareView()

    await wrapper.find('[data-testid="run-diff"]').trigger('click')
    await wrapper.vm.$nextTick()
    await wrapper.find('[data-testid="copy-left-to-right"]').trigger('click')
    await wrapper.find('[data-testid="copy-left-to-right"]').trigger('click')
    await wrapper.find('[data-testid="run-diff"]').trigger('click')

    const lastCall = vi.mocked(diffText).mock.lastCall

    expect(lastCall).toBeDefined()

    const [lastRequest] = lastCall as [TextDiffRequest]

    expect(lastRequest.right).toContain('left first')
    expect(lastRequest.right).toContain('left second')
  })

  it('finds text matches and navigates between them', async () => {
    const wrapper = mountTextCompareView()

    await wrapper.find('[data-testid="find-query"]').setValue('line')

    expect(wrapper.find('[data-testid="find-status"]').text()).toContain('1 / 7')

    await wrapper.find('[data-testid="find-next"]').trigger('click')

    expect(wrapper.find('[data-testid="find-status"]').text()).toContain('2 / 7')

    await wrapper.find('[data-testid="find-previous"]').trigger('click')

    expect(wrapper.find('[data-testid="find-status"]').text()).toContain('1 / 7')
  })

  it('replaces matches with regex search enabled', async () => {
    const wrapper = mountTextCompareView()

    await wrapper.find('[data-testid="find-query"]').setValue('line\\s+(one|two)')
    await wrapper.find('[data-testid="replace-query"]').setValue('row')
    await wrapper.find('[data-testid="find-regex"]').setValue(true)
    await wrapper.find('[data-testid="replace-all"]').trigger('click')
    await wrapper.find('[data-testid="run-diff"]').trigger('click')

    const lastCall = vi.mocked(diffText).mock.lastCall

    expect(lastCall).toBeDefined()

    const [lastRequest] = lastCall as [TextDiffRequest]

    expect(lastRequest.left).toContain('row')
    expect(lastRequest.left).not.toContain('line one')
    expect(lastRequest.left).not.toContain('line two')
    expect(wrapper.find('[data-testid="dirty-status"]').text()).toContain('No edits')
  })

  it('ignores the selected difference and skips it for copy actions', async () => {
    vi.mocked(diffText).mockResolvedValueOnce({
      lines: [
        {
          leftNumber: 1,
          rightNumber: 1,
          leftText: 'ignore this',
          rightText: 'right first',
          kind: 'modified',
          inlineSegments: { left: [], right: [] },
        },
        {
          leftNumber: 2,
          rightNumber: 2,
          leftText: 'copy this',
          rightText: 'right second',
          kind: 'modified',
          inlineSegments: { left: [], right: [] },
        },
      ],
      stats: { added: 0, deleted: 0, modified: 2, equal: 0 },
    })

    const wrapper = mountTextCompareView()

    await wrapper.find('[data-testid="run-diff"]').trigger('click')
    await wrapper.vm.$nextTick()
    await wrapper.find('[data-testid="ignore-current-diff"]').trigger('click')

    expect(wrapper.find('[data-testid="active-diff-status"]').text()).toContain('1 active diff')

    await wrapper.find('[data-testid="copy-left-to-right"]').trigger('click')
    await wrapper.find('[data-testid="run-diff"]').trigger('click')

    const lastCall = vi.mocked(diffText).mock.lastCall

    expect(lastCall).toBeDefined()

    const [lastRequest] = lastCall as [TextDiffRequest]

    expect(lastRequest.right).toContain('copy this')
    expect(lastRequest.right).not.toContain('ignore this')
  })

  it('sets, jumps to, and clears numbered bookmarks for active differences', async () => {
    vi.mocked(diffText).mockResolvedValueOnce({
      lines: [
        {
          leftNumber: 1,
          rightNumber: 1,
          leftText: 'bookmarked left',
          rightText: 'first right',
          kind: 'modified',
          inlineSegments: { left: [], right: [] },
        },
        {
          leftNumber: 2,
          rightNumber: 2,
          leftText: 'second left',
          rightText: 'second right',
          kind: 'modified',
          inlineSegments: { left: [], right: [] },
        },
      ],
      stats: { added: 0, deleted: 0, modified: 2, equal: 0 },
    })

    const wrapper = mountTextCompareView()

    await wrapper.find('[data-testid="run-diff"]').trigger('click')
    await wrapper.vm.$nextTick()
    await wrapper.find('[data-testid="bookmark-slot"]').setValue('0')
    await wrapper.find('[data-testid="set-bookmark"]').trigger('click')

    expect(wrapper.find('[data-testid="bookmark-status"]').text()).toContain('Bookmark 0 set')

    await wrapper.find('[data-testid="copy-left-to-right"]').trigger('click')
    await wrapper.find('[data-testid="jump-bookmark"]').trigger('click')
    await wrapper.find('[data-testid="copy-left-to-right"]').trigger('click')
    await wrapper.find('[data-testid="run-diff"]').trigger('click')

    const lastCall = vi.mocked(diffText).mock.lastCall

    expect(lastCall).toBeDefined()

    const [lastRequest] = lastCall as [TextDiffRequest]

    expect(lastRequest.right).toContain('bookmarked left')
    expect(lastRequest.right).not.toContain('second left')

    await wrapper.find('[data-testid="clear-bookmark"]').trigger('click')

    expect(wrapper.find('[data-testid="bookmark-status"]').text()).toContain('No bookmark 0')
  })
})
