import { mount, flushPromises, type VueWrapper } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { useSettingsStore } from '@/stores/settings'
import { defineComponent } from 'vue'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import TextPatchView from './TextPatchView.vue'
import { applyTextPatch, applyTextPatchToFile, parseTextPatch, readTextFile } from '@/api/diff'
import { pickNativePath } from '@/app/filePicker'
import { createAppI18n, installI18n } from '@/i18n'
import { useSessionLaunchStore } from '@/stores/sessionLaunch'
import { useViewActionsStore } from '@/stores/viewActions'

const push = vi.fn()

vi.mock('vue-router', () => ({
  useRouter: () => ({ push }),
}))

vi.mock('@/app/filePicker', () => ({
  pickNativePath: vi.fn(),
}))

vi.mock('@/api/diff', () => ({
  applyTextPatch: vi.fn().mockResolvedValue({
    text: 'const a = 1\nnew\n',
    appliedHunks: 1,
    files: 1,
  }),
  applyTextPatchToFile: vi.fn().mockResolvedValue({
    text: 'const a = 1\nnew\n',
    appliedHunks: 1,
    files: 1,
  }),
  parseTextPatch: vi.fn().mockResolvedValue({
    files: [
      {
        oldPath: 'a/src/main.ts',
        newPath: 'b/src/main.ts',
        hunks: [
          {
            oldStart: 1,
            oldCount: 2,
            newStart: 1,
            newCount: 2,
            heading: 'main',
            lines: [
              { kind: 'context', oldNumber: 1, newNumber: 1, text: 'const a = 1' },
              { kind: 'removed', oldNumber: 2, newNumber: null, text: 'old' },
              { kind: 'added', oldNumber: null, newNumber: 2, text: 'new' },
            ],
          },
          {
            oldStart: 10,
            oldCount: 1,
            newStart: 10,
            newCount: 1,
            heading: 'later',
            lines: [
              { kind: 'removed', oldNumber: 10, newNumber: null, text: 'gone' },
              { kind: 'added', oldNumber: null, newNumber: 10, text: 'here' },
            ],
          },
        ],
      },
    ],
  }),
  readTextFile: vi.fn().mockResolvedValue({
    path: 'C:/work/change.patch',
    text: 'diff --git a/src/main.ts b/src/main.ts',
    encoding: 'UTF-8',
    lineEnding: 'LF',
    fileStamp: { size: 42, modifiedAtMs: 1 },
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

function mountTextPatchView(): VueWrapper {
  return mount(TextPatchView, {
    global: {
      plugins: [
        {
          install(app) {
            installI18n(app, createAppI18n('en-US'))
          },
        },
      ],
      stubs: {
        NAlert: { template: '<div><slot /></div>' },
        NButton: {
          props: {
            loading: { type: Boolean, default: false },
            disabled: { type: Boolean, default: false },
            title: { type: String, default: undefined },
            type: { type: String, default: undefined },
            size: { type: String, default: undefined },
          },
          emits: ['click'],
          template:
            '<button :disabled="disabled" :title="title" @click="$emit(\'click\')"><slot /></button>',
        },
        NInput: NInputStub,
      },
    },
  })
}

describe('TextPatchView', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.mocked(parseTextPatch).mockClear()
    vi.mocked(readTextFile).mockClear()
    vi.mocked(applyTextPatch).mockClear()
    vi.mocked(applyTextPatchToFile).mockClear()
    vi.mocked(pickNativePath).mockReset()
    push.mockClear()
  })

  it('shows a friendly empty state, path placeholders, and disabled parse tip', async () => {
    const wrapper = mountTextPatchView()

    expect(wrapper.find('[data-testid="text-patch-empty-hint"]').text()).toContain('Parse Patch')
    expect(wrapper.find('[data-testid="patch-source-file"]').attributes('placeholder')).toContain(
      'Browse or paste a file path',
    )
    expect(wrapper.find('[data-testid="patch-target-file"]').attributes('placeholder')).toContain(
      'Browse or paste a file path',
    )
    expect(wrapper.find('[data-testid="parse-text-patch"]').attributes('title')).toContain(
      'patch first',
    )
    expect(wrapper.find('[data-testid="parse-text-patch"]').attributes('disabled')).toBeDefined()
    expect(wrapper.find('[data-testid="open-patch-file"]').exists()).toBe(true)

    wrapper
      .findComponent(NInputStub)
      .vm.$emit('update:value', 'diff --git a/src/main.ts b/src/main.ts')
    await wrapper.vm.$nextTick()

    expect(wrapper.find('[data-testid="text-patch-empty-hint"]').text()).toContain('Parse Patch')
    expect(wrapper.find('[data-testid="parse-text-patch"]').attributes('disabled')).toBeUndefined()
  })

  it('opens a patch file from Open Patch and parses it', async () => {
    vi.mocked(pickNativePath).mockResolvedValueOnce('C:/work/change.patch')

    const wrapper = mountTextPatchView()

    await wrapper.find('[data-testid="open-patch-file"]').trigger('click')
    await flushPromises()

    expect(pickNativePath).toHaveBeenCalledWith({ directory: false })
    expect(readTextFile).toHaveBeenCalledWith('C:/work/change.patch')
    expect(parseTextPatch).toHaveBeenCalledWith('diff --git a/src/main.ts b/src/main.ts')
    expect(wrapper.find('[data-testid="patch-source-path"]').text()).toContain('change.patch')
    expect(wrapper.find('[data-testid="text-patch-empty-hint"]').exists()).toBe(false)
  })

  it('loads a source file on Enter for Apply Patch', async () => {
    vi.mocked(readTextFile).mockResolvedValueOnce({
      path: 'C:/work/main.ts',
      text: 'const a = 1\nold\n',
      encoding: 'UTF-8',
      lineEnding: 'LF',
      fileStamp: { size: 12, modifiedAtMs: 2 },
    })

    const wrapper = mountTextPatchView()

    await wrapper.find('[data-testid="patch-source-file"]').setValue('C:/work/main.ts')
    await wrapper.find('[data-testid="patch-source-file"]').trigger('keydown.enter')
    await flushPromises()

    expect(readTextFile).toHaveBeenCalledWith('C:/work/main.ts')

    const inputs = wrapper.findAllComponents(NInputStub)

    expect(inputs[1]?.props('value')).toContain('const a = 1')
  })

  it('asks for a source file before Apply to File', async () => {
    const wrapper = mountTextPatchView()

    wrapper
      .findComponent(NInputStub)
      .vm.$emit('update:value', 'diff --git a/src/main.ts b/src/main.ts')
    await wrapper.vm.$nextTick()

    expect(wrapper.find('[data-testid="apply-text-patch-to-file"]').attributes('title')).toContain(
      'source file first',
    )
    expect(
      wrapper.find('[data-testid="apply-text-patch-to-file"]').attributes('disabled'),
    ).toBeDefined()
  })

  it('parses pasted unified patch text and renders files, hunks, and lines', async () => {
    const wrapper = mountTextPatchView()

    wrapper
      .findComponent(NInputStub)
      .vm.$emit('update:value', 'diff --git a/src/main.ts b/src/main.ts')
    await wrapper.vm.$nextTick()
    await wrapper.find('[data-testid="parse-text-patch"]').trigger('click')
    await flushPromises()

    expect(parseTextPatch).toHaveBeenCalledWith('diff --git a/src/main.ts b/src/main.ts')
    expect(wrapper.find('[data-testid="text-patch-file"]').text()).toContain('a/src/main.ts')
    expect(wrapper.find('[data-testid="text-patch-hunk"]').text()).toContain('main')
    expect(
      wrapper
        .findAll('[data-testid="text-patch-line"]')
        .map((line) => line.attributes('data-line-label')),
    ).toEqual(expect.arrayContaining(['1 1 const a = 1', '2 - old', '- 2 new']))
  })

  it('consumes a patch launch payload and parses the dropped patch file automatically', async () => {
    const launchStore = useSessionLaunchStore()

    launchStore.setPendingLaunch({
      id: 'launch-patch',
      source: 'drop',
      sessionType: 'text-patch',
      title: 'change.patch',
      route: '/patch/text',
      autoRun: true,
      locations: {
        left: {
          uri: 'C:/work/change.patch',
          displayName: 'change.patch',
          kind: 'file',
          readOnly: false,
        },
      },
    })

    const wrapper = mountTextPatchView()

    await flushPromises()

    expect(readTextFile).toHaveBeenCalledWith('C:/work/change.patch')
    expect(parseTextPatch).toHaveBeenCalledWith('diff --git a/src/main.ts b/src/main.ts')
    expect(launchStore.pendingLaunch).toBeUndefined()
    expect(wrapper.find('[data-testid="patch-source-path"]').text()).toContain('change.patch')
  })

  it('applies a unified patch to source text', async () => {
    const wrapper = mountTextPatchView()
    const inputs = wrapper.findAllComponents(NInputStub)

    inputs[0]?.vm.$emit('update:value', 'diff --git a/src/main.ts b/src/main.ts')
    inputs[1]?.vm.$emit('update:value', 'const a = 1\nold\n')
    await wrapper.vm.$nextTick()
    await wrapper.find('[data-testid="apply-text-patch"]').trigger('click')
    await flushPromises()

    expect(applyTextPatch).toHaveBeenCalledWith({
      source: 'const a = 1\nold\n',
      patch: 'diff --git a/src/main.ts b/src/main.ts',
    })
    expect(wrapper.find('[data-testid="patch-apply-status"]').text()).toContain('Patch applied')
  })

  it('applies a unified patch to a target file', async () => {
    const wrapper = mountTextPatchView()
    const inputs = wrapper.findAllComponents(NInputStub)

    inputs[0]?.vm.$emit('update:value', 'diff --git a/src/main.ts b/src/main.ts')
    await wrapper.find('[data-testid="patch-source-file"]').setValue('C:/work/main.ts')
    await wrapper.find('[data-testid="patch-target-file"]').setValue('C:/work/main.patched.ts')
    await wrapper.find('[data-testid="apply-text-patch-to-file"]').trigger('click')
    await flushPromises()

    expect(applyTextPatchToFile).toHaveBeenCalledWith({
      sourcePath: 'C:/work/main.ts',
      patch: 'diff --git a/src/main.ts b/src/main.ts',
      outputPath: 'C:/work/main.patched.ts',
    })
    expect(wrapper.find('[data-testid="patch-apply-status"]').text()).toContain(
      'C:/work/main.patched.ts',
    )
  })

  it('shows a dual-pane reconstructed preview for the selected section', async () => {
    const wrapper = mountTextPatchView()

    wrapper
      .findComponent(NInputStub)
      .vm.$emit('update:value', 'diff --git a/src/main.ts b/src/main.ts')
    await wrapper.vm.$nextTick()
    await wrapper.find('[data-testid="parse-text-patch"]').trigger('click')
    await flushPromises()

    expect(wrapper.find('[data-testid="patch-section-preview"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="patch-section-preview-left-path"]').text()).toContain(
      'a/src/main.ts',
    )
    expect(wrapper.find('[data-testid="patch-section-preview-right-path"]').text()).toContain(
      'b/src/main.ts',
    )
    const leftRows = wrapper
      .findAll('[data-testid="patch-section-preview-left-row"]')
      .map((row) => row.text())
    const rightRows = wrapper
      .findAll('[data-testid="patch-section-preview-right-row"]')
      .map((row) => row.text())

    expect(leftRows.some((text) => text.includes('old'))).toBe(true)
    expect(rightRows.some((text) => text.includes('new'))).toBe(true)

    await wrapper.find('[data-testid="patch-next-section"]').trigger('click')
    await wrapper.vm.$nextTick()

    expect(wrapper.find('[data-testid="patch-section-preview-position"]').text()).toContain(
      '2 of 2',
    )
    const nextLeft = wrapper
      .findAll('[data-testid="patch-section-preview-left-row"]')
      .map((row) => row.text())
    const nextRight = wrapper
      .findAll('[data-testid="patch-section-preview-right-row"]')
      .map((row) => row.text())

    expect(nextLeft.some((text) => text.includes('gone'))).toBe(true)
    expect(nextRight.some((text) => text.includes('here'))).toBe(true)
  })

  it('opens reconstructed sides in Text Compare', async () => {
    const wrapper = mountTextPatchView()
    const inputs = wrapper.findAllComponents(NInputStub)

    inputs[0]?.vm.$emit('update:value', 'diff --git a/src/main.ts b/src/main.ts')
    inputs[1]?.vm.$emit('update:value', 'const a = 1\nold\n')
    await wrapper.vm.$nextTick()
    await wrapper.find('[data-testid="apply-text-patch"]').trigger('click')
    await flushPromises()
    await wrapper.find('[data-testid="open-patched-text-compare"]').trigger('click')
    await flushPromises()

    expect(push).toHaveBeenCalledWith('/compare/text')
  })

  it('navigates patch sections and opens the selected hunk in Text Compare', async () => {
    const wrapper = mountTextPatchView()

    wrapper
      .findComponent(NInputStub)
      .vm.$emit('update:value', 'diff --git a/src/main.ts b/src/main.ts')
    await wrapper.vm.$nextTick()
    await wrapper.find('[data-testid="parse-text-patch"]').trigger('click')
    await flushPromises()

    expect(wrapper.find('[data-testid="patch-section-position"]').text()).toContain('1 of 2')
    expect(wrapper.find('[data-testid="patch-session-toolbar-bar"]').exists()).toBe(true)

    await wrapper.find('[data-testid="patch-next-section"]').trigger('click')
    await wrapper.vm.$nextTick()

    expect(wrapper.find('[data-testid="patch-section-position"]').text()).toContain('2 of 2')
    expect(wrapper.findAll('[data-testid="text-patch-hunk"]')[1]?.classes()).toContain(
      'patch-hunk-selected',
    )

    await wrapper.find('[data-testid="open-selected-text-compare"]').trigger('click')
    await flushPromises()

    expect(push).toHaveBeenCalledWith('/compare/text')
  })

  it('opens a reconstructed file pair from the file header action', async () => {
    const wrapper = mountTextPatchView()

    wrapper
      .findComponent(NInputStub)
      .vm.$emit('update:value', 'diff --git a/src/main.ts b/src/main.ts')
    await wrapper.vm.$nextTick()
    await wrapper.find('[data-testid="parse-text-patch"]').trigger('click')
    await flushPromises()
    await wrapper.find('[data-testid="open-file-text-compare"]').trigger('click')
    await flushPromises()

    expect(push).toHaveBeenCalledWith('/compare/text')
  })

  it('parses, applies, and steps sections from Session and Search', async () => {
    const wrapper = mountTextPatchView()

    wrapper
      .findComponent(NInputStub)
      .vm.$emit('update:value', 'diff --git a/src/main.ts b/src/main.ts')
    await wrapper.find('[data-testid="patch-source-file"]').setValue('C:/work/main.ts')
    await wrapper.vm.$nextTick()

    useViewActionsStore().dispatch('compare')
    await flushPromises()
    expect(parseTextPatch).toHaveBeenCalledWith('diff --git a/src/main.ts b/src/main.ts')
    expect(wrapper.find('[data-testid="patch-section-position"]').text()).toContain('1 of 2')

    useViewActionsStore().dispatch('next-difference')
    await wrapper.vm.$nextTick()
    expect(wrapper.find('[data-testid="patch-section-position"]').text()).toContain('2 of 2')

    useViewActionsStore().dispatch('previous-difference')
    await wrapper.vm.$nextTick()
    expect(wrapper.find('[data-testid="patch-section-position"]').text()).toContain('1 of 2')

    useViewActionsStore().dispatch('save')
    await flushPromises()
    expect(applyTextPatchToFile).toHaveBeenCalledWith({
      sourcePath: 'C:/work/main.ts',
      patch: 'diff --git a/src/main.ts b/src/main.ts',
      outputPath: 'C:/work/main.ts',
    })
  })
  it('shows Sessions on the main toolbar and opens session settings', async () => {
    const settings = useSettingsStore()

    settings.setShowSessionsInToolbar(true)

    const wrapper = mount(TextPatchView)
    const sessionsButton = wrapper.find('[data-testid="patch-session-toolbar-sessions"]')

    expect(sessionsButton.exists()).toBe(true)
    await sessionsButton.trigger('click')
    expect(wrapper.find('[data-testid="session-settings-dialog"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="session-settings-patch"]').exists()).toBe(true)

    wrapper.unmount()
  })
})
