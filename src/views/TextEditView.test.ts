import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { defineComponent } from 'vue'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import TextEditView from './TextEditView.vue'
import { readTextFile, saveTextFile } from '@/api/diff'
import { useSessionLaunchStore } from '@/stores/sessionLaunch'
import { useSettingsStore } from '@/stores/settings'
import { useStatusBarStore } from '@/stores/statusBar'

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
        NInput: NInputStub,
        NAlert: { template: '<div><slot /></div>' },
      },
    },
  })
}

describe('TextEditView', () => {
  beforeEach(() => {
    localStorage.clear()
    setActivePinia(createPinia())
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
      createBackup: true,
      backupRetention: 1,
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

  it('starts with an empty path and wires undo after an edit', async () => {
    const wrapper = mountTextEditView()

    expect((wrapper.find('[data-testid="text-edit-path"]').element as HTMLInputElement).value).toBe(
      '',
    )
    expect(
      wrapper.find('[data-testid="text-edit-toolbar-syntax"]').attributes('disabled'),
    ).toBeUndefined()

    await wrapper.find('[data-testid="text-edit-path"]').setValue('D:/workspace/notes.txt')
    await wrapper.find('[data-testid="text-edit-open"]').trigger('click')
    await wrapper.vm.$nextTick()
    await wrapper.find('[data-testid="text-edit-editor"]').setValue('changed')
    await wrapper.find('[data-testid="text-edit-toolbar-undo"]').trigger('click')

    expect(
      (wrapper.find('[data-testid="text-edit-editor"]').element as HTMLTextAreaElement).value,
    ).toContain('release line')
  })

  it('consumes a launch path and opens the document', async () => {
    useSessionLaunchStore().setPendingLaunch({
      id: 'edit-launch',
      source: 'saved-session',
      sessionType: 'text-edit',
      title: 'notes',
      route: '/edit/text',
      autoRun: true,
      locations: {
        left: { uri: 'D:/workspace/notes.txt', kind: 'file', readOnly: false },
      },
    })

    const wrapper = mountTextEditView()

    await flushPromises()

    expect(readTextFile).toHaveBeenCalledWith('D:/workspace/notes.txt')
    expect(wrapper.find('[data-testid="text-edit-title"]').text()).toContain('notes.txt')
  })

  it('enables undo and clipboard toolbar actions after an edit', async () => {
    const wrapper = mountTextEditView()

    expect(
      wrapper.find('[data-testid="text-edit-toolbar-undo"]').attributes('disabled'),
    ).toBeDefined()
    expect(
      wrapper.find('[data-testid="text-edit-toolbar-cut"]').attributes('disabled'),
    ).toBeDefined()

    await wrapper.find('[data-testid="text-edit-path"]').setValue('D:/workspace/notes.txt')
    await wrapper.find('[data-testid="text-edit-open"]').trigger('click')
    await wrapper.vm.$nextTick()

    expect(
      wrapper.find('[data-testid="text-edit-toolbar-cut"]').attributes('disabled'),
    ).toBeUndefined()
    expect(
      wrapper.find('[data-testid="text-edit-toolbar-paste"]').attributes('disabled'),
    ).toBeUndefined()

    await wrapper.find('[data-testid="text-edit-editor"]').setValue('changed')
    await wrapper.vm.$nextTick()

    expect(
      wrapper.find('[data-testid="text-edit-toolbar-undo"]').attributes('disabled'),
    ).toBeUndefined()

    await wrapper.find('[data-testid="text-edit-toolbar-copy"]').trigger('click')
    await wrapper.vm.$nextTick()
    expect(
      wrapper.find('[data-testid="text-edit-toolbar-paste"]').attributes('disabled'),
    ).toBeUndefined()
  })

  it('opens the syntax menu and changes highlight language', async () => {
    const wrapper = mountTextEditView()

    await wrapper.find('[data-testid="text-edit-path"]').setValue('D:/workspace/app.ts')
    await wrapper.find('[data-testid="text-edit-open"]').trigger('click')
    await wrapper.vm.$nextTick()
    await wrapper.find('[data-testid="text-edit-editor"]').setValue('const value = 1')
    await wrapper.find('[data-testid="text-edit-toolbar-syntax"]').trigger('click')

    expect(wrapper.find('[data-testid="text-edit-syntax-menu"]').exists()).toBe(true)

    await wrapper.find('[data-testid="text-edit-syntax-language"]').setValue('source')
    await wrapper.vm.$nextTick()

    expect(wrapper.find('[data-testid="text-edit-syntax-grammar"]').text()).toContain('source')
    expect(wrapper.find('[data-testid="text-edit-syntax-preview"]').html()).toContain(
      'syntax-keyword',
    )
  })

  it('opens the font menu and updates family/size from Options settings', async () => {
    const wrapper = mountTextEditView()
    const settings = useSettingsStore()

    await wrapper.find('[data-testid="text-edit-toolbar-font"]').trigger('click')
    await wrapper.vm.$nextTick()

    expect(wrapper.find('[data-testid="text-edit-font-menu"]').exists()).toBe(true)

    await wrapper.find('[data-testid="text-edit-font-family"]').setValue('mono')
    await wrapper.find('[data-testid="text-edit-font-size"]').setValue('18')
    await wrapper.vm.$nextTick()

    expect(settings.fontFamily).toBe('mono')
    expect(settings.fontSize).toBe(18)
  })

  it('starts wrap from Options default and toggles from the toolbar', async () => {
    localStorage.setItem('open-diff-wrap-text-default', '1')
    setActivePinia(createPinia())
    expect(useSettingsStore().wrapTextDefault).toBe(true)

    const wrapper = mountTextEditView()
    const wrapButton = wrapper.find('[data-testid="text-edit-toolbar-wrap"]')

    expect(wrapButton.exists()).toBe(true)
    expect(wrapButton.attributes('aria-pressed')).toBe('true')

    await wrapButton.trigger('click')
    await wrapper.vm.$nextTick()

    expect(wrapButton.attributes('aria-pressed')).toBe('false')
  })

  it('opens Go To Line and selects the requested line in the editor', async () => {
    const wrapper = mountTextEditView()

    await wrapper.find('[data-testid="text-edit-path"]').setValue('D:/workspace/notes.txt')
    await wrapper.find('[data-testid="text-edit-open"]').trigger('click')
    await wrapper.vm.$nextTick()

    expect(
      wrapper.find('[data-testid="text-edit-toolbar-goto"]').attributes('disabled'),
    ).toBeUndefined()

    await wrapper.find('[data-testid="text-edit-toolbar-goto"]').trigger('click')
    expect(wrapper.find('[data-testid="text-edit-goto-menu"]').exists()).toBe(true)

    await wrapper.find('[data-testid="text-edit-goto-line"]').setValue('2')
    await wrapper.find('[data-testid="text-edit-goto-apply"]').trigger('click')
    await wrapper.vm.$nextTick()

    expect(wrapper.find('[data-testid="text-edit-goto-status"]').text()).toContain('Line 2 of 3')

    const editor = wrapper.find('[data-testid="text-edit-editor"]').element as HTMLTextAreaElement

    expect(editor.selectionStart).toBe(13)
    expect(editor.selectionEnd).toBe(24)
    expect(editor.value.slice(editor.selectionStart, editor.selectionEnd)).toBe('second line')
  })

  it('toggles Insert/Overwrite and replaces the next character while overwriting', async () => {
    const wrapper = mountTextEditView()
    const statusBar = useStatusBarStore()

    await wrapper.find('[data-testid="text-edit-path"]').setValue('D:/workspace/notes.txt')
    await wrapper.find('[data-testid="text-edit-open"]').trigger('click')
    await flushPromises()

    expect(statusBar.report.editMode).toBe('insert')

    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Insert' }))
    await wrapper.vm.$nextTick()
    expect(statusBar.report.editMode).toBe('overwrite')

    const editor = wrapper.find('[data-testid="text-edit-editor"]').element as HTMLTextAreaElement

    editor.focus()
    editor.setSelectionRange(0, 0)
    await wrapper.find('[data-testid="text-edit-editor"]').trigger('keydown', { key: 'Z' })
    await wrapper.vm.$nextTick()

    expect(editor.value.startsWith('Z')).toBe(true)
    expect(editor.value.slice(0, 2)).toBe('Ze')
  })
})
