import { mount, flushPromises, type VueWrapper } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { defineComponent } from 'vue'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import TextPatchView from './TextPatchView.vue'
import { parseTextPatch, readTextFile } from '@/api/diff'
import { useSessionLaunchStore } from '@/stores/sessionLaunch'

vi.mock('@/api/diff', () => ({
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
      stubs: {
        NAlert: { template: '<div><slot /></div>' },
        NButton: {
          props: ['loading'],
          emits: ['click'],
          template: '<button @click="$emit(\'click\')"><slot /></button>',
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
})
