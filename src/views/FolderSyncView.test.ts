import { flushPromises, mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import FolderSyncView from './FolderSyncView.vue'
import { executeFolderSync, previewFolderSync } from '@/api/sync'

vi.mock('@/api/sync', () => ({
  executeFolderSync: vi.fn().mockResolvedValue({
    name: 'Mirror to Right',
    leftRoot: 'D:/deploy/package',
    rightRoot: 'D:/deploy/prod',
    strategy: 'mirrorRight',
    total: 2,
    succeeded: 2,
    failed: 0,
    cancelled: 0,
    logs: [
      {
        relativePath: 'package/app.exe',
        action: 'copyLeftToRight',
        sourcePath: 'D:/deploy/package/package/app.exe',
        targetPath: 'D:/deploy/prod/package/app.exe',
        status: 'succeeded',
      },
      {
        relativePath: 'prod/old.dll',
        action: 'delete',
        targetPath: 'D:/deploy/prod/prod/old.dll',
        status: 'succeeded',
      },
    ],
  }),
  previewFolderSync: vi.fn().mockResolvedValue({
    name: 'Mirror to Right',
    leftRoot: 'D:/deploy/package',
    rightRoot: 'D:/deploy/prod',
    strategy: 'mirrorRight',
    rows: [
      {
        id: 'copy-app',
        relativePath: 'package/app.exe',
        action: 'Copy',
        sourcePath: 'D:/deploy/package/package/app.exe',
        targetPath: 'D:/deploy/prod/package/app.exe',
        detail: 'Left item only exists',
      },
      {
        id: 'delete-old',
        relativePath: 'prod/old.dll',
        action: 'Delete',
        targetPath: 'D:/deploy/prod/prod/old.dll',
        detail: 'Right item does not exist on left',
      },
    ],
    summary: {
      total: 2,
      copy: 1,
      delete: 1,
      leave: 0,
      conflict: 0,
    },
  }),
}))

describe('FolderSyncView', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('configures folder paths, strategy, preview, and run status', async () => {
    const wrapper = mount(FolderSyncView, {
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

    expect(wrapper.text()).toContain('Folder Sync')
    expect(
      (wrapper.find('[data-testid="folder-sync-left-path"]').element as HTMLInputElement).value,
    ).toBe('D:/workspace/left')
    expect(
      (wrapper.find('[data-testid="folder-sync-right-path"]').element as HTMLInputElement).value,
    ).toBe('D:/workspace/right')

    await wrapper.find('[data-testid="folder-sync-left-path"]').setValue('D:/deploy/package')
    await wrapper.find('[data-testid="folder-sync-right-path"]').setValue('D:/deploy/prod')
    await wrapper.find('[data-testid="folder-sync-strategy"]').setValue('mirrorRight')
    await wrapper.find('[data-testid="folder-sync-preview"]').trigger('click')
    await flushPromises()

    expect(previewFolderSync).toHaveBeenCalledWith({
      leftRoot: 'D:/deploy/package',
      rightRoot: 'D:/deploy/prod',
      strategy: 'mirrorRight',
    })
    expect(wrapper.find('[data-testid="folder-sync-preview-panel"]').exists()).toBe(true)
    expect(wrapper.text()).toContain('Mirror to Right')
    expect(wrapper.text()).toContain('D:/deploy/package')
    expect(wrapper.text()).toContain('D:/deploy/prod')
    expect(wrapper.text()).toContain('Copy')
    expect(wrapper.text()).toContain('Delete')

    await wrapper.find('[data-testid="folder-sync-run"]').trigger('click')
    await flushPromises()

    expect(executeFolderSync).toHaveBeenCalledWith({
      leftRoot: 'D:/deploy/package',
      rightRoot: 'D:/deploy/prod',
      strategy: 'mirrorRight',
    })
    expect(wrapper.text()).toContain('Completed 2 / 2')
    expect(wrapper.text()).toContain('Copied package/app.exe')
    expect(wrapper.text()).toContain('Deleted prod/old.dll')
  })
})
