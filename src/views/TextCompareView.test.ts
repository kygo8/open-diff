import { mount, flushPromises, type VueWrapper } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { defineComponent } from 'vue'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import TextCompareView from './TextCompareView.vue'
import { diffText, exportTextCompareReport, readTextFile } from '@/api/diff'
import { createAppI18n, installI18n } from '@/i18n'
import { useSessionLaunchStore } from '@/stores/sessionLaunch'
import { useStatusBarStore } from '@/stores/statusBar'
import type { TextDiffRequest } from '@/types/diff'

const push = vi.fn()

vi.mock('vue-router', () => ({
  useRouter: () => ({ push }),
}))

vi.mock('@/api/diff', () => ({
  diffText: vi.fn().mockResolvedValue({
    lines: [],
    stats: { added: 0, deleted: 0, modified: 0, equal: 0 },
  }),
  exportTextCompareReport: vi.fn().mockResolvedValue({
    format: 'html',
    content: '<html></html>',
    outputPath: 'text-compare.html',
    bytesWritten: 13,
  }),
  readTextFile: vi.fn().mockImplementation((path: string) =>
    Promise.resolve({
      path,
      text: path.includes('left') ? 'left from file' : 'right from file',
      encoding: 'UTF-8',
      lineEnding: 'LF',
      fileStamp: { size: 12, modifiedAtMs: 1 },
    }),
  ),
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

const TextDiffPanelStub = {
  name: 'TextDiffPanel',
  props: {
    lines: {
      type: Array,
      default: () => [],
    },
    grammar: {
      type: Object,
      default: undefined,
    },
  },
  template:
    '<section data-testid="text-diff-panel-stub" :data-grammar-items="grammar?.items?.length ?? 0" />',
}

function mountTextCompareView(): VueWrapper {
  return mount(TextCompareView, {
    global: {
      plugins: [
        {
          install(app) {
            installI18n(app, createAppI18n('en-US'))
          },
        },
      ],
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
        TextDiffPanel: TextDiffPanelStub,
      },
    },
  })
}

describe('TextCompareView', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.mocked(diffText).mockClear()
    vi.mocked(readTextFile).mockClear()
  })

  it('renders the Text Compare session toolbar order', () => {
    const wrapper = mountTextCompareView()
    const ids = [
      'home',
      'all',
      'diffs',
      'same',
      'context',
      'minor',
      'rules',
      'format',
      'sessions',
      'copy',
      'next-section',
      'prev-section',
      'swap',
      'reload',
    ]

    expect(wrapper.find('[data-testid="text-session-toolbar-bar"]').exists()).toBe(true)
    expect(
      wrapper
        .findAll('[data-testid^="text-session-toolbar-"]')
        .filter((node) => node.attributes('data-testid') !== 'text-session-toolbar-bar')
        .map((node) => node.attributes('data-testid')?.replace('text-session-toolbar-', '')),
    ).toEqual(ids)
    expect(
      wrapper.find('[data-testid="text-session-toolbar-same"]').attributes('disabled'),
    ).toBeUndefined()
    expect(
      wrapper.find('[data-testid="text-session-toolbar-context"]').attributes('disabled'),
    ).toBeUndefined()
    expect(
      wrapper.find('[data-testid="text-session-toolbar-minor"]').attributes('disabled'),
    ).toBeUndefined()
    expect(
      wrapper.find('[data-testid="text-session-toolbar-rules"]').attributes('disabled'),
    ).toBeUndefined()
    expect(wrapper.find('[data-testid="text-session-toolbar-all"]').attributes('data-active')).toBe(
      'true',
    )
    expect(
      wrapper.find('[data-testid="text-session-toolbar-rules"]').attributes('data-active'),
    ).toBe('true')
    expect(
      wrapper.find('[data-testid="text-session-toolbar-bar"]').attributes('data-large-buttons'),
    ).toBe('true')
    expect(wrapper.html()).not.toContain('未实现')
  })

  it('toggles the text rules panel from the session toolbar', async () => {
    const wrapper = mountTextCompareView()

    expect(
      wrapper.find('[data-testid="text-rules-panel"]').attributes('style') ?? '',
    ).not.toContain('display: none')
    expect(
      wrapper.find('[data-testid="text-session-toolbar-rules"]').attributes('data-active'),
    ).toBe('true')
    await wrapper.find('[data-testid="text-session-toolbar-rules"]').trigger('click')
    expect(wrapper.find('[data-testid="text-rules-panel"]').attributes('style') ?? '').toContain(
      'display: none',
    )
    expect(
      wrapper.find('[data-testid="text-session-toolbar-rules"]').attributes('data-active'),
    ).toBe('false')
    await wrapper.find('[data-testid="text-session-toolbar-rules"]').trigger('click')
    expect(
      wrapper.find('[data-testid="text-rules-panel"]').attributes('style') ?? '',
    ).not.toContain('display: none')
  })

  it('opens context chrome and adjusts surrounding lines from the session toolbar', async () => {
    const wrapper = mountTextCompareView()

    expect(wrapper.find('[data-testid="text-context-panel"]').exists()).toBe(false)

    await wrapper.find('[data-testid="text-session-toolbar-context"]').trigger('click')
    await wrapper.vm.$nextTick()

    expect(wrapper.find('[data-testid="text-context-panel"]').exists()).toBe(true)
    expect(
      (wrapper.find('[data-testid="text-context-lines"]').element as HTMLInputElement).value,
    ).toBe('2')

    await wrapper.find('[data-testid="text-context-lines"]').setValue('5')
    await wrapper.find('[data-testid="text-context-lines"]').trigger('input')
    await wrapper.vm.$nextTick()

    expect(
      (wrapper.find('[data-testid="text-context-lines"]').element as HTMLInputElement).value,
    ).toBe('5')

    await wrapper.find('[data-testid="text-session-toolbar-context"]').trigger('click')
    await wrapper.vm.$nextTick()
    expect(wrapper.find('[data-testid="text-context-panel"]').exists()).toBe(false)

    await wrapper.find('[data-testid="text-session-toolbar-context"]').trigger('click')
    await wrapper.vm.$nextTick()
    expect(wrapper.find('[data-testid="text-context-panel"]').exists()).toBe(true)
    expect(
      (wrapper.find('[data-testid="text-context-lines"]').element as HTMLInputElement).value,
    ).toBe('5')

    await wrapper.find('[data-testid="text-session-toolbar-all"]').trigger('click')
    await wrapper.vm.$nextTick()
    expect(wrapper.find('[data-testid="text-context-panel"]').exists()).toBe(false)
  })

  it('marks display-mode toolbar buttons as active when pressed', async () => {
    const wrapper = mountTextCompareView()

    await wrapper.find('[data-testid="text-session-toolbar-diffs"]').trigger('click')
    expect(
      wrapper.find('[data-testid="text-session-toolbar-diffs"]').attributes('data-active'),
    ).toBe('true')
    expect(wrapper.find('[data-testid="text-session-toolbar-all"]').attributes('data-active')).toBe(
      'false',
    )

    await wrapper.find('[data-testid="text-session-toolbar-context"]').trigger('click')
    expect(
      wrapper.find('[data-testid="text-session-toolbar-context"]').attributes('data-active'),
    ).toBe('true')
  })

  it('toggles minor whitespace ignore from the session toolbar', async () => {
    localStorage.clear()
    const wrapper = mountTextCompareView()

    expect(
      wrapper.find('[data-testid="text-session-toolbar-minor"]').attributes('data-active'),
    ).toBe('false')
    await wrapper.find('[data-testid="text-session-toolbar-minor"]').trigger('click')
    expect(
      (wrapper.find('[data-testid="ignore-whitespace"]').element as HTMLInputElement).checked,
    ).toBe(true)
    expect(
      wrapper.find('[data-testid="text-session-toolbar-minor"]').attributes('data-active'),
    ).toBe('true')
  })

  it('swaps paths from the session toolbar', async () => {
    const wrapper = mountTextCompareView()

    await wrapper.find('[data-testid="text-left-path"]').setValue('D:/left.txt')
    await wrapper.find('[data-testid="text-right-path"]').setValue('D:/right.txt')
    await wrapper.find('[data-testid="text-session-toolbar-swap"]').trigger('click')

    expect((wrapper.find('[data-testid="text-left-path"]').element as HTMLInputElement).value).toBe(
      'D:/right.txt',
    )
    expect(
      (wrapper.find('[data-testid="text-right-path"]').element as HTMLInputElement).value,
    ).toBe('D:/left.txt')
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

  it('starts empty until the user runs a comparison', async () => {
    const wrapper = mountTextCompareView()

    await wrapper.vm.$nextTick()

    expect(wrapper.find('[data-testid="text-workbench"]').exists()).toBe(true)
    expect(wrapper.find('.empty').exists()).toBe(true)
    expect(wrapper.text()).not.toContain('line one')
    expect(wrapper.text()).not.toContain('line two')
  })

  it('applies selected file format rules to text compare options', async () => {
    const wrapper = mountTextCompareView()

    await wrapper.find('[data-testid="text-format-select"]').setValue('plain-text')
    await wrapper.find('[data-testid="apply-text-format"]').trigger('click')

    expect(
      (wrapper.find('[data-testid="ignore-whitespace"]').element as HTMLInputElement).checked,
    ).toBe(true)
  })

  it('passes ignore rules through to the text diff command', async () => {
    const wrapper = mountTextCompareView()

    await wrapper.find('[data-testid="ignore-whitespace"]').setValue(true)
    await wrapper.find('[data-testid="ignore-case"]').setValue(true)
    await wrapper.find('[data-testid="ignore-line-endings"]').setValue(true)
    await wrapper.find('[data-testid="ignore-regexes"]').setValue('^#')
    await wrapper.find('[data-testid="run-diff"]').trigger('click')

    expect(diffText).toHaveBeenCalledWith(
      expect.objectContaining({
        ignoreWhitespace: true,
        ignoreCase: true,
        ignoreLineEndings: true,
        ignoreRegexes: ['^#'],
      }),
    )
  })

  it('exports the current text compare as an HTML report', async () => {
    const wrapper = mountTextCompareView()

    await wrapper.find('[data-testid="export-text-html-report"]').trigger('click')
    await flushPromises()

    expect(exportTextCompareReport).toHaveBeenCalledWith(
      expect.objectContaining({
        format: 'html',
      }),
    )
    expect(wrapper.find('[data-testid="text-report-status"]').text()).toContain('text-compare.html')
  })

  it('exports the current text compare as a CSV report', async () => {
    const wrapper = mountTextCompareView()

    expect(wrapper.find('[data-testid="export-text-markdown-report"]').exists()).toBe(true)
    await wrapper.find('[data-testid="export-text-csv-report"]').trigger('click')
    await flushPromises()

    expect(exportTextCompareReport).toHaveBeenCalledWith(
      expect.objectContaining({
        format: 'csv',
      }),
    )
  })

  it('shows detected line endings for the current text inputs', async () => {
    const wrapper = mountTextCompareView()

    expect(wrapper.find('[data-testid="line-ending-status"]').text()).toContain('Left: None')
    expect(wrapper.find('[data-testid="line-ending-status"]').text()).toContain('Right: None')

    wrapper.findAllComponents(NInputStub)[0]?.vm.$emit('update:value', 'one\r\ntwo')
    await wrapper.vm.$nextTick()

    expect(wrapper.find('[data-testid="line-ending-status"]').text()).toContain('Left: CRLF')
  })

  it('reports text comparison status to the shared status bar protocol', async () => {
    const wrapper = mountTextCompareView()
    const statusBar = useStatusBarStore()

    expect(statusBar.report).toEqual(
      expect.objectContaining({
        comparisonStatus: 'Editing',
        differenceCount: null,
        source: 'text-compare',
        loadTimeSeconds: null,
      }),
    )

    await wrapper.find('[data-testid="run-diff"]').trigger('click')

    expect(statusBar.report).toEqual(
      expect.objectContaining({
        comparisonStatus: 'Compared',
        differenceCount: 0,
        encoding: 'UTF-8 | Left: None | Right: None',
        filterStatus: 'All rows',
        source: 'text-compare',
      }),
    )
    expect(typeof statusBar.report.loadTimeSeconds).toBe('number')
    expect(statusBar.report.loadTimeSeconds ?? -1).toBeGreaterThanOrEqual(0)
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

    wrapper.findAllComponents(NInputStub)[0]?.vm.$emit('update:value', 'line one\nline two')
    wrapper.findAllComponents(NInputStub)[1]?.vm.$emit('update:value', 'line one\nline two')
    await wrapper.vm.$nextTick()

    await wrapper.find('[data-testid="find-query"]').setValue('line')

    expect(wrapper.find('[data-testid="find-status"]').text()).toContain('1 / 4')

    await wrapper.find('[data-testid="find-next"]').trigger('click')

    expect(wrapper.find('[data-testid="find-status"]').text()).toContain('2 / 4')

    await wrapper.find('[data-testid="find-previous"]').trigger('click')

    expect(wrapper.find('[data-testid="find-status"]').text()).toContain('1 / 4')
  })

  it('replaces matches with regex search enabled', async () => {
    const wrapper = mountTextCompareView()

    wrapper.findAllComponents(NInputStub)[0]?.vm.$emit('update:value', 'line one\nline two')
    wrapper.findAllComponents(NInputStub)[1]?.vm.$emit('update:value', 'line one\nline two')
    await wrapper.vm.$nextTick()

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
    expect(useStatusBarStore().report.filterStatus).toBe('1 ignored')

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

  it('shows text and hex details for the current active difference', async () => {
    vi.mocked(diffText).mockResolvedValueOnce({
      lines: [
        {
          leftNumber: 1,
          rightNumber: 1,
          leftText: 'AZ',
          rightText: 'A!',
          kind: 'modified',
          inlineSegments: { left: [], right: [] },
        },
      ],
      stats: { added: 0, deleted: 0, modified: 1, equal: 0 },
    })

    const wrapper = mountTextCompareView()

    await wrapper.find('[data-testid="run-diff"]').trigger('click')
    await wrapper.vm.$nextTick()

    expect(wrapper.find('[data-testid="text-details"]').text()).toContain('Left 1: AZ')
    expect(wrapper.find('[data-testid="text-details"]').text()).toContain('Right 1: A!')
    expect(wrapper.find('[data-testid="hex-details"]').text()).toContain('41 5A')
    expect(wrapper.find('[data-testid="hex-details"]').text()).toContain('41 21')
  })

  it('toggles an HTML preview panel for HTML text input', async () => {
    const wrapper = mountTextCompareView()
    const leftInput = wrapper.findAllComponents(NInputStub)[0]

    leftInput.vm.$emit('update:value', '<h1>Hello preview</h1>')
    await wrapper.vm.$nextTick()

    expect(wrapper.find('[data-testid="html-preview"]').exists()).toBe(false)

    await wrapper.find('[data-testid="toggle-html-preview"]').trigger('click')

    const preview = wrapper.find('[data-testid="html-preview"]')

    expect(preview.exists()).toBe(true)
    expect(preview.attributes('srcdoc')).toContain('<h1>Hello preview</h1>')
  })

  it('passes a built-in syntax grammar to the text diff panel', async () => {
    vi.mocked(diffText).mockResolvedValueOnce({
      lines: [
        {
          leftNumber: 1,
          rightNumber: 1,
          leftText: 'fn main()',
          rightText: '// comment',
          kind: 'modified',
          inlineSegments: { left: [], right: [] },
        },
      ],
      stats: { added: 0, deleted: 0, modified: 1, equal: 0 },
    })

    const wrapper = mountTextCompareView()

    await wrapper.find('[data-testid="run-diff"]').trigger('click')
    await wrapper.vm.$nextTick()

    expect(
      wrapper.find('[data-testid="text-diff-panel-stub"]').attributes('data-grammar-items'),
    ).toBe('2')
  })

  it('loads dropped text file paths from a launch payload and runs the diff', async () => {
    useSessionLaunchStore().setPendingLaunch({
      id: 'launch-text',
      source: 'drop',
      sessionType: 'text-compare',
      title: 'left.txt vs right.txt',
      route: '/compare/text',
      autoRun: true,
      locations: {
        left: { uri: 'C:/work/left.txt', kind: 'file', readOnly: false },
        right: { uri: 'C:/work/right.txt', kind: 'file', readOnly: false },
      },
    })

    const wrapper = mountTextCompareView()

    await flushPromises()

    expect(readTextFile).toHaveBeenCalledWith('C:/work/left.txt')
    expect(readTextFile).toHaveBeenCalledWith('C:/work/right.txt')
    expect(diffText).toHaveBeenCalledWith(
      expect.objectContaining({
        left: 'left from file',
        right: 'right from file',
      }),
    )
    expect(wrapper.find('[data-testid="left-path-label"]').text()).toContain('left.txt')
    expect(wrapper.find('[data-testid="right-path-label"]').text()).toContain('right.txt')
  })

  it('opens text session settings and persists importance options', async () => {
    localStorage.clear()
    const wrapper = mount(TextCompareView)

    await wrapper.find('[data-testid="open-text-session-settings"]').trigger('click')
    expect(wrapper.find('[data-testid="session-settings-dialog"]').exists()).toBe(true)
    await wrapper.find('[data-testid="session-settings-ignore-whitespace"]').setValue(true)
    await wrapper.find('[data-testid="session-settings-tab-alignment"]').trigger('click')
    await wrapper.find('[data-testid="session-settings-algorithm"]').setValue('histogram')
    await wrapper.find('[data-testid="session-settings-apply"]').trigger('click')
    expect(wrapper.find('[data-testid="session-settings-dialog"]').exists()).toBe(false)
    expect(
      (wrapper.find('[data-testid="ignore-whitespace"]').element as HTMLInputElement).checked,
    ).toBe(true)
    expect(
      (wrapper.find('[data-testid="algorithm-select"]').element as HTMLSelectElement).value,
    ).toBe('histogram')
  })
})
