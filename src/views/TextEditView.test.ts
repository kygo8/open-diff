import { mount, type VueWrapper } from '@vue/test-utils'
import { defineComponent } from 'vue'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import TextEditView from './TextEditView.vue'
import { readTextFile, saveTextFile } from '@/api/diff'

vi.mock('@/api/diff', () => ({
  readTextFile: vi.fn().mockResolvedValue({
    path: 'D:/workspace/notes.txt',
    text: 'release line\nsecond line\nrelease note',
    encoding: 'utf-8',
    lineEnding: 'LF',
    fileStamp: { size: 37, modifiedAtMs: 12 },
  }),
  saveTextFile: vi.fn().mockResolvedValue({
    path: 'D:/workspace/notes.txt',
    bytesWritten: 42,
    backupPath: 'D:/workspace/notes.txt.bak',
    fileStamp: { size: 42, modifiedAtMs: 15 },
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
  template:
    '<textarea data-testid="text-edit-editor" :value="value" @input="$emit(\'update:value\', $event.target.value)" />',
})

function mountTextEditView(): VueWrapper {
  return mount(TextEditView, {
    global: {
      stubs: {
        NButton: {
          props: ['loading', 'disabled'],
          emits: ['click'],
          template: '<button :disabled="disabled" @click="$emit(\'click\')"><slot /></button>',
        },
        NInput: {
          ...NInputStub,
        },
        NAlert: { template: '<div><slot /></div>' },
      },
    },
  })
}

describe('TextEditView', () => {
  beforeEach(() => {
    vi.mocked(readTextFile).mockClear()
    vi.mocked(saveTextFile).mockClear()
  })

  it('opens a text file and shows metadata for the loaded document', async () => {
    const wrapper = mountTextEditView()

    await wrapper.find('[data-testid="text-edit-path"]').setValue('D:/workspace/notes.txt')
    await wrapper.find('[data-testid="text-edit-open"]').trigger('click')
    await wrapper.vm.$nextTick()

    expect(readTextFile).toHaveBeenCalledWith('D:/workspace/notes.txt')
    expect(wrapper.find('[data-testid="text-edit-title"]').text()).toContain('notes.txt')
    expect(wrapper.find('[data-testid="text-edit-metadata"]').text()).toContain('utf-8')
    expect(wrapper.find('[data-testid="text-edit-metadata"]').text()).toContain('LF')
    expect(
      (wrapper.find('[data-testid="text-edit-editor"]').element as HTMLTextAreaElement).value,
    ).toContain('release line')
  })

  it('marks edits dirty and saves the current content through the text file API', async () => {
    const wrapper = mountTextEditView()

    await wrapper.find('[data-testid="text-edit-path"]').setValue('D:/workspace/notes.txt')
    await wrapper.find('[data-testid="text-edit-open"]').trigger('click')
    await wrapper.vm.$nextTick()
    await wrapper
      .find('[data-testid="text-edit-editor"]')
      .setValue('release line\nchanged line\nrelease note')

    expect(wrapper.find('[data-testid="text-edit-dirty"]').text()).toContain('Unsaved changes')

    await wrapper.find('[data-testid="text-edit-save"]').trigger('click')
    await wrapper.vm.$nextTick()

    expect(saveTextFile).toHaveBeenCalledWith({
      path: 'D:/workspace/notes.txt',
      text: 'release line\nchanged line\nrelease note',
    })
    expect(wrapper.find('[data-testid="text-edit-dirty"]').text()).toContain('Saved')
    expect(wrapper.find('[data-testid="text-edit-save-status"]').text()).toContain('42 bytes')
    expect(wrapper.find('[data-testid="text-edit-save-status"]').text()).toContain('backup')
  })

  it('finds matches, navigates between them, and replaces all matches', async () => {
    const wrapper = mountTextEditView()

    await wrapper.find('[data-testid="text-edit-path"]').setValue('D:/workspace/notes.txt')
    await wrapper.find('[data-testid="text-edit-open"]').trigger('click')
    await wrapper.vm.$nextTick()
    await wrapper.find('[data-testid="text-edit-find"]').setValue('release')

    expect(wrapper.find('[data-testid="text-edit-find-status"]').text()).toContain('1 / 2')

    await wrapper.find('[data-testid="text-edit-find-next"]').trigger('click')

    expect(wrapper.find('[data-testid="text-edit-find-status"]').text()).toContain('2 / 2')

    await wrapper.find('[data-testid="text-edit-replace"]').setValue('stable')
    await wrapper.find('[data-testid="text-edit-replace-all"]').trigger('click')

    const editorValue = (
      wrapper.find('[data-testid="text-edit-editor"]').element as HTMLTextAreaElement
    ).value

    expect(editorValue).toContain('stable line')
    expect(editorValue).not.toContain('release')
    expect(wrapper.find('[data-testid="text-edit-dirty"]').text()).toContain('Unsaved changes')
  })
})
