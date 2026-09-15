import { flushPromises, mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useSessionLaunchStore } from '@/stores/sessionLaunch'
import { useTabsStore } from '@/stores/tabs'
import { buildFolderMergePlan, executeFolderMergePlan } from '@/api/folderMerge'
import { saveTextFile } from '@/api/diff'
import { useViewActionsStore } from '@/stores/viewActions'
import FolderMergeView from './FolderMergeView.vue'
import type {
  FolderMergeEntryKind,
  FolderMergeExecutionResponse,
  FolderMergePlanResponse,
  FolderMergeRole,
  FolderMergeSide,
} from '@/types/folderMerge'
import type { VueWrapper } from '@vue/test-utils'

const push = vi.fn()

vi.mock('vue-router', () => ({
  useRouter: () => ({ push }),
}))

vi.mock('@/api/folderMerge', () => ({
  buildFolderMergePlan: vi.fn(),
  executeFolderMergePlan: vi.fn(),
}))

vi.mock('@/api/diff', () => ({
  createFolderSnapshot: vi.fn(),
  saveTextFile: vi.fn().mockResolvedValue({
    path: 'D:/workspace/merge/folder-merge.txt',
    bytesWritten: 64,
  }),
}))

const clipboardWriteText = vi.fn<(text: string) => Promise<void>>().mockResolvedValue(undefined)

function mountFolderMergeView(): VueWrapper {
  return mount(FolderMergeView, {
    global: {
      stubs: {
        NButton: {
          props: ['disabled', 'loading'],
          emits: ['click'],
          template: '<button :disabled="disabled" @click="$emit(\'click\')"><slot /></button>',
        },
      },
    },
  })
}

async function fillMergePaths(wrapper: VueWrapper): Promise<void> {
  await wrapper.find('[data-testid="folder-merge-left-path"]').setValue('D:/workspace/merge/left')
  await wrapper.find('[data-testid="folder-merge-base-path"]').setValue('D:/workspace/merge/base')
  await wrapper.find('[data-testid="folder-merge-right-path"]').setValue('D:/workspace/merge/right')
  await wrapper
    .find('[data-testid="folder-merge-output-path"]')
    .setValue('D:/workspace/merge/output')
}

describe('FolderMergeView', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    push.mockClear()
    vi.mocked(buildFolderMergePlan).mockReset()
    vi.mocked(executeFolderMergePlan).mockReset()
    vi.mocked(saveTextFile).mockClear()
    clipboardWriteText.mockClear()
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: {
        writeText: clipboardWriteText,
      },
    })
    vi.mocked(buildFolderMergePlan).mockResolvedValue(createMergePlanResponse())
    vi.mocked(executeFolderMergePlan).mockResolvedValue(createMergeExecutionResponse())
  })

  it('renders left, base, right, and output folder inputs', () => {
    const wrapper = mountFolderMergeView()

    expect(wrapper.find('[data-testid="folder-merge-left-path"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="folder-merge-left-editing-status"]').text()).toContain(
      'Editing disabled',
    )
    expect(wrapper.find('[data-testid="folder-merge-base-editing-status"]').text()).toContain(
      'Editing disabled',
    )
    expect(wrapper.find('[data-testid="folder-merge-right-editing-status"]').text()).toContain(
      'Editing disabled',
    )
    expect(wrapper.find('[data-testid="folder-merge-base-path"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="folder-merge-right-path"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="folder-merge-output-path"]').exists()).toBe(true)
    expect(wrapper.text()).toContain('Left folder')
    expect(wrapper.text()).toContain('Base folder')
    expect(wrapper.text()).toContain('Right folder')
    expect(wrapper.text()).toContain('Output folder')
  })

  it('builds a folder merge plan with automatic actions and conflicts', async () => {
    const wrapper = mountFolderMergeView()

    await fillMergePaths(wrapper)

    expect(wrapper.find('[data-testid="folder-merge-plan"]').exists()).toBe(false)

    await wrapper.find('[data-testid="folder-merge-build-plan"]').trigger('click')
    await flushPromises()

    const summary = wrapper.find('[data-testid="folder-merge-summary"]')
    const plan = wrapper.find('[data-testid="folder-merge-plan"]')

    expect(buildFolderMergePlan).toHaveBeenCalledWith({
      leftRoot: 'D:/workspace/merge/left',
      baseRoot: 'D:/workspace/merge/base',
      rightRoot: 'D:/workspace/merge/right',
      outputRoot: 'D:/workspace/merge/output',
      archiveExtensions: ['.tar.gz', '.tar', '.tgz', '.zip', '.7z', '.gz'],
    })
    expect(summary.text()).toContain('5')
    expect(summary.text()).toContain('2')
    expect(plan.exists()).toBe(true)
    expect(wrapper.findAll('[data-testid="folder-merge-row"]')).toHaveLength(5)
    expect(plan.text()).toContain('same.txt')
    expect(plan.text()).toContain('left-add.txt')
    expect(plan.text()).toContain('right-add.txt')
    expect(plan.text()).toContain('notes.txt')
    expect(plan.text()).toContain('config')
    expect(plan.text()).toContain('Mark conflict')
  })

  it('executes the folder merge plan into the output folder', async () => {
    const wrapper = mountFolderMergeView()

    await fillMergePaths(wrapper)

    await wrapper.find('[data-testid="folder-merge-build-plan"]').trigger('click')
    await flushPromises()
    await wrapper.find('[data-testid="folder-merge-execute-plan"]').trigger('click')
    await flushPromises()

    expect(executeFolderMergePlan).toHaveBeenCalledWith({
      leftRoot: 'D:/workspace/merge/left',
      baseRoot: 'D:/workspace/merge/base',
      rightRoot: 'D:/workspace/merge/right',
      outputRoot: 'D:/workspace/merge/output',
      archiveExtensions: ['.tar.gz', '.tar', '.tgz', '.zip', '.7z', '.gz'],
    })
    expect(wrapper.find('[data-testid="folder-merge-execution-status"]').text()).toContain(
      'Completed 4 / 4',
    )
  })

  it('shows conflict details with three-way context', async () => {
    const wrapper = mountFolderMergeView()

    await fillMergePaths(wrapper)

    await wrapper.find('[data-testid="folder-merge-build-plan"]').trigger('click')
    await flushPromises()

    const conflicts = wrapper.find('[data-testid="folder-merge-conflict-list"]')

    expect(conflicts.exists()).toBe(true)
    expect(conflicts.text()).toContain('config')
    expect(conflicts.text()).toContain('notes.txt')
    expect(conflicts.text()).toContain('Base: Directory')
    expect(conflicts.text()).toContain('Left: File')
    expect(conflicts.text()).toContain('Right: Directory')
    expect(conflicts.text()).toContain('Left and right changed the same path differently')
  })

  it('opens a file content conflict in the text merge workspace', async () => {
    const wrapper = mountFolderMergeView()

    await fillMergePaths(wrapper)

    await wrapper.find('[data-testid="folder-merge-build-plan"]').trigger('click')
    await flushPromises()
    expect(wrapper.find('[data-testid="open-folder-conflict-config"]').exists()).toBe(false)
    await wrapper.find('[data-testid="open-folder-conflict-notes.txt"]').trigger('click')

    expect(push).toHaveBeenCalledWith('/merge/text')
    expect(useSessionLaunchStore().pendingLaunch).toMatchObject({
      route: '/merge/text',
      autoRun: true,
      locations: {
        left: { uri: 'D:/workspace/merge/left/notes.txt' },
        right: { uri: 'D:/workspace/merge/right/notes.txt' },
        center: { uri: 'D:/workspace/merge/base/notes.txt' },
        output: { uri: 'D:/workspace/merge/output/notes.txt' },
      },
    })
    expect(useTabsStore().tabs.some((tab) => tab.route === '/merge/text')).toBe(true)
  })

  it('consumes a saved-session launch and builds a plan', async () => {
    useSessionLaunchStore().setPendingLaunch({
      id: 'merge-launch',
      source: 'saved-session',
      sessionType: 'folder-merge',
      title: 'Folder merge',
      route: '/merge/folder',
      autoRun: true,
      locations: {
        left: { uri: 'D:/workspace/merge/left', kind: 'directory', readOnly: false },
        right: { uri: 'D:/workspace/merge/right', kind: 'directory', readOnly: false },
        center: { uri: 'D:/workspace/merge/base', kind: 'directory', readOnly: false },
        output: { uri: 'D:/workspace/merge/output', kind: 'directory', readOnly: false },
      },
    })

    mountFolderMergeView()
    await flushPromises()

    expect(buildFolderMergePlan).toHaveBeenCalledWith({
      leftRoot: 'D:/workspace/merge/left',
      baseRoot: 'D:/workspace/merge/base',
      rightRoot: 'D:/workspace/merge/right',
      outputRoot: 'D:/workspace/merge/output',
      archiveExtensions: ['.tar.gz', '.tar', '.tgz', '.zip', '.7z', '.gz'],
    })
  })

  it('filters Same OK rows and peeks a selected plan row', async () => {
    const wrapper = mountFolderMergeView()

    await fillMergePaths(wrapper)
    await wrapper.find('[data-testid="folder-merge-build-plan"]').trigger('click')
    await flushPromises()

    expect(wrapper.findAll('[data-testid="folder-merge-row"]')).toHaveLength(5)
    await wrapper.find('[data-testid="folder-merge-same-ok"]').trigger('click')
    expect(wrapper.findAll('[data-testid="folder-merge-row"]')).toHaveLength(1)
    expect(wrapper.text()).toContain('same.txt')

    await wrapper.find('[data-testid="folder-merge-same-ok"]').trigger('click')
    await wrapper.find('[data-testid="folder-merge-peek"]').trigger('click')
    expect(wrapper.find('[data-testid="folder-merge-peek-panel"]').exists()).toBe(true)
    await wrapper.findAll('[data-testid="folder-merge-row"]')[1].trigger('click')
    expect(wrapper.find('[data-testid="folder-merge-peek-path"]').text()).toContain('left-add.txt')
  })

  it('sets a path-pair style tab title that includes the output folder', async () => {
    const tabs = useTabsStore()

    tabs.openTab({
      title: 'Folder Merge',
      titleKey: 'ui.folderMerge',
      route: '/merge/folder',
      dirty: false,
    })
    const wrapper = mountFolderMergeView()

    await fillMergePaths(wrapper)

    expect(tabs.activeTab.title).toBe('left <--> right → output')
  })

  it('exposes Expand/Collapse/Select session toolbar polish', async () => {
    const wrapper = mountFolderMergeView()

    await fillMergePaths(wrapper)
    await wrapper.find('[data-testid="folder-merge-build-plan"]').trigger('click')
    await flushPromises()

    expect(wrapper.find('[data-testid="folder-merge-session-toolbar-bar"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="folder-merge-session-toolbar-expand"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="folder-merge-session-toolbar-collapse"]').exists()).toBe(
      true,
    )
    expect(wrapper.find('[data-testid="folder-merge-session-toolbar-select"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="folder-merge-session-toolbar-same-ok"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="folder-merge-session-toolbar-merge"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="folder-merge-session-toolbar-to-output"]').exists()).toBe(
      true,
    )

    await wrapper.find('[data-testid="folder-merge-session-toolbar-select"]').trigger('click')
    expect(wrapper.find('[data-testid="folder-merge-select-panel"]').exists()).toBe(true)
    await wrapper.find('[data-testid="folder-merge-select-all"]').trigger('click')
    expect(
      wrapper.find('[data-testid="folder-merge-selection-status"]').text().length,
    ).toBeGreaterThan(0)

    await wrapper.find('[data-testid="folder-merge-session-toolbar-filters"]').trigger('click')
    expect(wrapper.find('[data-testid="folder-merge-filters-panel"]').exists()).toBe(true)

    await wrapper.find('[data-testid="folder-merge-session-toolbar-rules"]').trigger('click')
    expect(wrapper.find('[data-testid="folder-merge-rules-panel"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="folder-merge-rules-summary"]').text()).toContain('1')

    await wrapper.find('[data-testid="folder-merge-session-toolbar-same"]').trigger('click')
    expect(wrapper.find('[data-testid="folder-merge-filter-state"]').text()).toContain('Same')

    await wrapper.find('[data-testid="folder-merge-session-toolbar-merge"]').trigger('click')
    await flushPromises()
    expect(executeFolderMergePlan).toHaveBeenCalled()
  })

  it('exports the folder merge report to clipboard and a sibling text file', async () => {
    const wrapper = mountFolderMergeView()

    await fillMergePaths(wrapper)
    await wrapper.find('[data-testid="folder-merge-build-plan"]').trigger('click')
    await flushPromises()

    await wrapper.find('[data-testid="export-folder-merge-report"]').trigger('click')
    await flushPromises()

    expect(clipboardWriteText).toHaveBeenCalled()
    const payload = clipboardWriteText.mock.calls[0]?.[0] ?? ''

    expect(payload).toContain('FOLDER-MERGE-REPORT')
    expect(payload).toContain('left: D:/workspace/merge/left')
    expect(payload).toContain('same.txt')
    expect(saveTextFile).toHaveBeenCalledWith({
      path: 'D:/workspace/merge/folder-merge.txt',
      text: payload,
      createBackup: false,
    })
    expect(wrapper.find('[data-testid="folder-merge-report-status"]').text()).toBe(
      'D:/workspace/merge/folder-merge.txt',
    )
  })

  it('wires Session Export to the merge report instead of toggling filters', async () => {
    const wrapper = mountFolderMergeView()

    await fillMergePaths(wrapper)
    await wrapper.find('[data-testid="folder-merge-build-plan"]').trigger('click')
    await flushPromises()

    expect(wrapper.find('[data-testid="folder-merge-filters-panel"]').exists()).toBe(false)

    useViewActionsStore().dispatch('export')
    await flushPromises()

    expect(wrapper.find('[data-testid="folder-merge-filters-panel"]').exists()).toBe(false)
    expect(saveTextFile).toHaveBeenCalled()
    expect(wrapper.find('[data-testid="folder-merge-report-status"]').text()).toBe(
      'D:/workspace/merge/folder-merge.txt',
    )
  })
})

function createMergePlanResponse(): FolderMergePlanResponse {
  return {
    leftRoot: 'D:/workspace/merge/left',
    baseRoot: 'D:/workspace/merge/base',
    rightRoot: 'D:/workspace/merge/right',
    outputRoot: 'D:/workspace/merge/output',
    rows: [
      {
        id: 'same-txt',
        path: 'same.txt',
        base: createSide('Base', 'File', '4 B'),
        left: createSide('Left', 'File', '4 B'),
        right: createSide('Right', 'File', '4 B'),
        action: 'Keep output',
        detail: 'All sides match; output keeps the current file.',
      },
      {
        id: 'left-add',
        path: 'left-add.txt',
        base: createSide('Base', 'Missing'),
        left: createSide('Left', 'File', '5 B'),
        right: createSide('Right', 'Missing'),
        action: 'Copy left to output',
        detail: 'Left added a new file and right has no competing change.',
      },
      {
        id: 'right-add',
        path: 'right-add.txt',
        base: createSide('Base', 'Missing'),
        left: createSide('Left', 'Missing'),
        right: createSide('Right', 'File', '6 B'),
        action: 'Copy right to output',
        detail: 'Right added a new file and left has no competing change.',
      },
      {
        id: 'notes-txt',
        path: 'notes.txt',
        base: createSide('Base', 'File', '10 B'),
        left: createSide('Left', 'File', '11 B'),
        right: createSide('Right', 'File', '12 B'),
        action: 'Mark conflict',
        detail: 'Left and right changed the same path differently.',
        conflict: {
          path: 'notes.txt',
          reason: 'Left and right changed the same path differently',
          baseContext: 'Base: File',
          leftContext: 'Left: File',
          rightContext: 'Right: File',
        },
      },
      {
        id: 'config',
        path: 'config',
        base: createSide('Base', 'Directory'),
        left: createSide('Left', 'File', '7 B'),
        right: createSide('Right', 'Directory'),
        action: 'Mark conflict',
        detail: 'Left and right changed the same path differently.',
        conflict: {
          path: 'config',
          reason: 'Left and right changed the same path differently',
          baseContext: 'Base: Directory',
          leftContext: 'Left: File',
          rightContext: 'Right: Directory',
        },
      },
    ],
    summary: {
      actions: 5,
      automatic: 3,
      conflicts: 2,
    },
  }
}

function createMergeExecutionResponse(): FolderMergeExecutionResponse {
  return {
    leftRoot: 'D:/workspace/merge/left',
    baseRoot: 'D:/workspace/merge/base',
    rightRoot: 'D:/workspace/merge/right',
    outputRoot: 'D:/workspace/merge/output',
    rows: [
      {
        path: 'same.txt',
        action: 'Keep output',
        status: 'executed',
        detail: 'Copied unchanged item to output.',
      },
      {
        path: 'left-add.txt',
        action: 'Copy left to output',
        status: 'executed',
        detail: 'Copied from left to output.',
      },
      {
        path: 'right-add.txt',
        action: 'Copy right to output',
        status: 'executed',
        detail: 'Copied from right to output.',
      },
      {
        path: 'config',
        action: 'Mark conflict',
        status: 'conflict',
        detail: 'Skipped conflicting item.',
      },
    ],
    summary: {
      total: 4,
      executed: 3,
      skipped: 0,
      conflicts: 1,
      failed: 0,
    },
  }
}

function createSide(
  role: FolderMergeRole,
  kind: FolderMergeEntryKind,
  size?: string,
): FolderMergeSide {
  return {
    role,
    kind,
    size,
  }
}
