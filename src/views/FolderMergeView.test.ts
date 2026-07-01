import { flushPromises, mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { buildFolderMergePlan, executeFolderMergePlan } from '@/api/folderMerge'
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

describe('FolderMergeView', () => {
  beforeEach(() => {
    push.mockClear()
    vi.mocked(buildFolderMergePlan).mockReset()
    vi.mocked(executeFolderMergePlan).mockReset()
    vi.mocked(buildFolderMergePlan).mockResolvedValue(createMergePlanResponse())
    vi.mocked(executeFolderMergePlan).mockResolvedValue(createMergeExecutionResponse())
  })

  it('renders left, base, right, and output folder inputs', () => {
    const wrapper = mountFolderMergeView()

    expect(wrapper.find('[data-testid="folder-merge-left-path"]').exists()).toBe(true)
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
    })
    expect(summary.text()).toContain('4')
    expect(summary.text()).toContain('1')
    expect(plan.exists()).toBe(true)
    expect(wrapper.findAll('[data-testid="folder-merge-row"]')).toHaveLength(4)
    expect(plan.text()).toContain('same.txt')
    expect(plan.text()).toContain('left-add.txt')
    expect(plan.text()).toContain('right-add.txt')
    expect(plan.text()).toContain('config')
    expect(plan.text()).toContain('Mark conflict')
  })

  it('executes the folder merge plan into the output folder', async () => {
    const wrapper = mountFolderMergeView()

    await wrapper.find('[data-testid="folder-merge-build-plan"]').trigger('click')
    await flushPromises()
    await wrapper.find('[data-testid="folder-merge-execute-plan"]').trigger('click')
    await flushPromises()

    expect(executeFolderMergePlan).toHaveBeenCalledWith({
      leftRoot: 'D:/workspace/merge/left',
      baseRoot: 'D:/workspace/merge/base',
      rightRoot: 'D:/workspace/merge/right',
      outputRoot: 'D:/workspace/merge/output',
    })
    expect(wrapper.find('[data-testid="folder-merge-execution-status"]').text()).toContain(
      'Completed 4 / 4',
    )
  })

  it('shows conflict details with three-way context', async () => {
    const wrapper = mountFolderMergeView()

    await wrapper.find('[data-testid="folder-merge-build-plan"]').trigger('click')
    await flushPromises()

    const conflicts = wrapper.find('[data-testid="folder-merge-conflict-list"]')

    expect(conflicts.exists()).toBe(true)
    expect(conflicts.text()).toContain('config')
    expect(conflicts.text()).toContain('Base: Directory')
    expect(conflicts.text()).toContain('Left: File')
    expect(conflicts.text()).toContain('Right: Directory')
    expect(conflicts.text()).toContain('Left and right changed the same path differently')
  })

  it('opens a folder conflict in the text merge workspace', async () => {
    const wrapper = mountFolderMergeView()

    await wrapper.find('[data-testid="folder-merge-build-plan"]').trigger('click')
    await flushPromises()
    await wrapper.find('[data-testid="open-folder-conflict-config"]').trigger('click')

    expect(wrapper.text()).toContain('Opening Text Merge for config')
    expect(wrapper.text()).toContain('/merge/text')
    expect(push).toHaveBeenCalledWith('/merge/text')
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
      actions: 4,
      automatic: 3,
      conflicts: 1,
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
