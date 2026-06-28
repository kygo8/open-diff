import { mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import TextMergeView from './TextMergeView.vue'
import { saveTextFile } from '@/api/diff'

vi.mock('@/api/diff', () => ({
  saveTextFile: vi.fn().mockResolvedValue({
    path: 'D:/workspace/output.txt',
    bytesWritten: 32,
    backupPath: 'D:/workspace/output.txt.bak',
  }),
}))

describe('TextMergeView', () => {
  beforeEach(() => {
    vi.mocked(saveTextFile).mockClear()
  })

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
    expect(outputEditorValue(wrapper)).toContain('<<<<<<< LEFT')
    expect(wrapper.find('[data-testid="merge-conflict-list"]').text()).toContain('Line 2')
  })

  it('accepts the left side for the current conflict', async () => {
    const wrapper = mount(TextMergeView)

    await wrapper.find('[data-testid="accept-left-conflict"]').trigger('click')

    expect(outputEditorValue(wrapper)).toContain('timeout = 45')
    expect(outputEditorValue(wrapper)).not.toContain('<<<<<<< LEFT')
    expect(wrapper.find('[data-testid="merge-conflict-status"]').text()).toContain('0 conflicts')
  })

  it('accepts the right side for the current conflict', async () => {
    const wrapper = mount(TextMergeView)

    await wrapper.find('[data-testid="accept-right-conflict"]').trigger('click')

    expect(outputEditorValue(wrapper)).toContain('timeout = 60')
    expect(outputEditorValue(wrapper)).not.toContain('>>>>>>> RIGHT')
    expect(wrapper.find('[data-testid="merge-conflict-status"]').text()).toContain('0 conflicts')
  })

  it('accepts the base side for the current conflict', async () => {
    const wrapper = mount(TextMergeView)

    await wrapper.find('[data-testid="accept-base-conflict"]').trigger('click')

    expect(outputEditorValue(wrapper)).toContain('timeout = 30')
    expect(outputEditorValue(wrapper)).not.toContain('=======')
    expect(wrapper.find('[data-testid="merge-conflict-status"]').text()).toContain('0 conflicts')
  })

  it('edits the output text and saves it to the configured output path', async () => {
    const wrapper = mount(TextMergeView)

    await wrapper.find('[data-testid="merge-output-editor"]').setValue('merged output\nsaved')
    await wrapper.find('[data-testid="save-merge-output"]').trigger('click')

    expect(saveTextFile).toHaveBeenCalledWith({
      path: 'D:/workspace/output.txt',
      text: 'merged output\nsaved',
    })
    expect(wrapper.find('[data-testid="merge-save-status"]').text()).toContain('Saved 32 bytes')
  })
})

function outputEditorValue(wrapper: ReturnType<typeof mount>): string {
  return (wrapper.find('[data-testid="merge-output-editor"]').element as HTMLTextAreaElement).value
}
