import { flushPromises, mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { useSettingsStore } from '@/stores/settings'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import FolderSyncView from './FolderSyncView.vue'

const push = vi.fn()

vi.mock('vue-router', () => ({
  useRouter: () => ({ push }),
}))
import { executeFolderSync, previewFolderSync } from '@/api/sync'
import { openPathExternal, revealPathInOs } from '@/api/integration'
import { createFolderEntry, saveTextFile } from '@/api/diff'
import { useSessionLaunchStore } from '@/stores/sessionLaunch'
import { useViewActionsStore } from '@/stores/viewActions'

vi.mock('@/api/diff', () => ({
  createFolderEntry: vi.fn(),
  createFolderSnapshot: vi.fn(),
  saveTextFile: vi.fn().mockResolvedValue({
    path: 'D:/deploy/folder-sync.txt',
    bytesWritten: 64,
  }),
}))

vi.mock('@/api/integration', () => ({
  openPathExternal: vi
    .fn()
    .mockResolvedValue({ path: 'D:/deploy/package/package/app.exe', launched: true }),
  revealPathInOs: vi.fn().mockResolvedValue({
    path: 'D:/deploy/package/package/app.exe',
    selected: true,
    fallbackOpened: false,
    launched: true,
  }),
}))

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

const clipboardWriteText = vi.fn<(text: string) => Promise<void>>().mockResolvedValue(undefined)

describe('FolderSyncView', () => {
  afterEach(() => {
    vi.useRealTimers()
  })

  beforeEach(() => {
    localStorage.clear()
    setActivePinia(createPinia())
    useSettingsStore().setShowSyncNowInToolbar(true)
    useSettingsStore().setShowSyncCancelAcceptInToolbar(true)
    vi.spyOn(window, 'confirm').mockReturnValue(true)
    vi.clearAllMocks()
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { writeText: clipboardWriteText },
    })
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
      (wrapper.find('[data-testid="folder-sync-strategy"]').element as HTMLSelectElement).value,
    ).toBe('updateBoth')
    expect(
      (wrapper.find('[data-testid="folder-sync-left-path"]').element as HTMLInputElement).value,
    ).toBe('')
    expect(
      (wrapper.find('[data-testid="folder-sync-right-path"]').element as HTMLInputElement).value,
    ).toBe('')

    await wrapper.find('[data-testid="folder-sync-left-path"]').setValue('D:/deploy/package')
    await wrapper.find('[data-testid="folder-sync-right-path"]').setValue('D:/deploy/prod')
    await wrapper.find('[data-testid="folder-sync-strategy"]').setValue('mirrorRight')
    await wrapper.find('[data-testid="folder-sync-preview"]').trigger('click')
    await flushPromises()

    expect(previewFolderSync).toHaveBeenCalledWith({
      leftRoot: 'D:/deploy/package',
      rightRoot: 'D:/deploy/prod',
      strategy: 'mirrorRight',
      archiveExtensions: ['.tar.gz', '.tar', '.tgz', '.zip', '.7z', '.gz'],
      filters: { include: [], exclude: [], caseSensitive: false },
    })
    expect(wrapper.find('[data-testid="folder-sync-preview-panel"]').exists()).toBe(true)
    expect(wrapper.text()).toContain('Mirror to Right')
    expect(wrapper.text()).toContain('D:/deploy/package')
    expect(wrapper.text()).toContain('D:/deploy/prod')
    expect(wrapper.text()).toContain('Copy Left to Right')
    expect(wrapper.text()).toContain('Delete')

    expect(wrapper.find('[data-testid="folder-sync-title"]').text()).toContain('Update:')
    // Sync Now is available as soon as a preview exists; Accept remains optional densify chrome.
    expect(wrapper.find('[data-testid="folder-sync-run"]').attributes('disabled')).toBeUndefined()

    await wrapper.find('[data-testid="folder-sync-accept"]').trigger('click')
    expect(wrapper.find('[data-testid="folder-sync-chrome-status"]').text()).toContain('accepted')
    expect(wrapper.find('[data-testid="folder-sync-run"]').attributes('disabled')).toBeUndefined()

    await wrapper.find('[data-testid="sync-override-copy-app"]').setValue('leave')
    expect(wrapper.find('[data-testid="folder-sync-run"]').attributes('disabled')).toBeUndefined()
    await wrapper.find('[data-testid="folder-sync-accept"]').trigger('click')
    await wrapper.find('[data-testid="folder-sync-run"]').trigger('click')
    expect(executeFolderSync).not.toHaveBeenCalled()
    expect(wrapper.find('[data-testid="folder-sync-safety-confirmation"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="folder-sync-safety-confirmation"]').text()).toContain(
      'package/app.exe',
    )
    expect(wrapper.find('[data-testid="folder-sync-safety-confirmation"]').text()).toContain(
      'prod/old.dll',
    )
    await wrapper.find('[data-testid="folder-sync-confirm-safety"]').trigger('click')
    await flushPromises()

    expect(executeFolderSync).toHaveBeenCalledWith({
      leftRoot: 'D:/deploy/package',
      rightRoot: 'D:/deploy/prod',
      strategy: 'mirrorRight',
      overrides: [
        { relativePath: 'package/app.exe', action: 'copyLeftToRight' },
        { relativePath: 'prod/old.dll', action: 'deleteRight' },
      ],
      archiveExtensions: ['.tar.gz', '.tar', '.tgz', '.zip', '.7z', '.gz'],
    })
    expect(wrapper.text()).toContain('Completed 2 / 2')
    expect(wrapper.text()).toContain('Copied package/app.exe')
    expect(wrapper.text()).toContain('Deleted prod/old.dll')
  })

  it('loads the Options Folder Sync strategy default', () => {
    localStorage.setItem(
      'open-diff-folder-sync-session-options',
      JSON.stringify({ strategy: 'mirrorLeft' }),
    )

    const wrapper = mount(FolderSyncView, {
      global: {
        stubs: {
          NButton: {
            props: ['disabled', 'loading'],
            template: '<button :disabled="disabled"><slot /></button>',
          },
        },
      },
    })

    expect(
      (wrapper.find('[data-testid="folder-sync-strategy"]').element as HTMLSelectElement).value,
    ).toBe('mirrorLeft')
  })

  it('cancels overrides to leave and resets a single row', async () => {
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

    await wrapper.find('[data-testid="folder-sync-left-path"]').setValue('D:/deploy/package')
    await wrapper.find('[data-testid="folder-sync-right-path"]').setValue('D:/deploy/prod')
    await wrapper.find('[data-testid="folder-sync-strategy"]').setValue('mirrorRight')
    await wrapper.find('[data-testid="folder-sync-preview"]').trigger('click')
    await flushPromises()

    await wrapper.find('[data-testid="folder-sync-cancel"]').trigger('click')
    expect(
      (wrapper.find('[data-testid="sync-override-copy-app"]').element as HTMLSelectElement).value,
    ).toBe('leave')
    expect(
      (wrapper.find('[data-testid="sync-override-delete-old"]').element as HTMLSelectElement).value,
    ).toBe('leave')

    await wrapper.find('[data-testid="sync-reset-copy-app"]').trigger('click')
    expect(
      (wrapper.find('[data-testid="sync-override-copy-app"]').element as HTMLSelectElement).value,
    ).toBe('copyLeftToRight')
  })

  it('consumes a saved-session launch and auto-previews', async () => {
    useSessionLaunchStore().setPendingLaunch({
      id: 'sync-launch',
      source: 'saved-session',
      sessionType: 'folder-sync',
      title: 'Deploy sync',
      route: '/sync/folder',
      autoRun: true,
      locations: {
        left: { uri: 'D:/deploy/package', kind: 'directory', readOnly: false },
        right: { uri: 'D:/deploy/prod', kind: 'directory', readOnly: false },
      },
    })

    mount(FolderSyncView, {
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
    await flushPromises()

    expect(previewFolderSync).toHaveBeenCalledWith({
      leftRoot: 'D:/deploy/package',
      rightRoot: 'D:/deploy/prod',
      strategy: 'updateBoth',
      archiveExtensions: ['.tar.gz', '.tar', '.tgz', '.zip', '.7z', '.gz'],
      filters: { include: [], exclude: [], caseSensitive: false },
    })
  })

  it('hides Sync Cancel/Accept on the session toolbar by default', () => {
    useSettingsStore().setShowSyncNowInToolbar(false)
    useSettingsStore().setShowSyncCancelAcceptInToolbar(false)

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

    expect(wrapper.find('[data-testid="folder-sync-session-toolbar-cancel"]').exists()).toBe(false)
    expect(wrapper.find('[data-testid="folder-sync-session-toolbar-accept"]').exists()).toBe(false)
    expect(wrapper.find('[data-testid="folder-sync-session-toolbar-sync-now"]').exists()).toBe(
      false,
    )
    expect(wrapper.find('[data-testid="folder-sync-cancel"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="folder-sync-accept"]').exists()).toBe(true)
  })

  it('exposes Expand/Collapse/Select/Filters/Home session toolbar chrome', async () => {
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

    await wrapper.find('[data-testid="folder-sync-left-path"]').setValue('D:/deploy/package')
    await wrapper.find('[data-testid="folder-sync-right-path"]').setValue('D:/deploy/prod')
    await wrapper.find('[data-testid="folder-sync-preview"]').trigger('click')
    await flushPromises()

    expect(wrapper.find('[data-testid="folder-sync-session-toolbar-bar"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="folder-sync-session-toolbar-home"]').exists()).toBe(true)
    expect(
      wrapper.find('[data-testid="folder-sync-session-toolbar-expand"]').attributes('disabled'),
    ).toBeUndefined()
    expect(
      wrapper.find('[data-testid="folder-sync-session-toolbar-collapse"]').attributes('disabled'),
    ).toBeUndefined()

    expect(wrapper.find('[data-testid="folder-sync-session-toolbar-accept"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="folder-sync-session-toolbar-cancel"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="folder-sync-session-toolbar-sync-now"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="folder-sync-session-toolbar-minor"]').exists()).toBe(true)

    expect(
      wrapper.find('[data-testid="folder-sync-session-toolbar-sync-now"]').attributes('disabled'),
    ).toBeUndefined()

    await wrapper.find('[data-testid="folder-sync-session-toolbar-accept"]').trigger('click')
    expect(
      wrapper.find('[data-testid="folder-sync-chrome-status"]').text().toLowerCase(),
    ).toContain('accept')
    expect(
      wrapper.find('[data-testid="folder-sync-session-toolbar-sync-now"]').attributes('disabled'),
    ).toBeUndefined()
    expect(
      wrapper.find('[data-testid="folder-sync-session-toolbar-accept"]').attributes('data-active'),
    ).toBe('true')

    await wrapper.find('[data-testid="folder-sync-session-toolbar-minor"]').trigger('click')
    expect(wrapper.find('[data-testid="sync-row-copy-app"]').exists()).toBe(false)

    await wrapper.find('[data-testid="folder-sync-session-toolbar-minor"]').trigger('click')
    expect(wrapper.find('[data-testid="sync-row-copy-app"]').exists()).toBe(true)

    await wrapper.find('[data-testid="folder-sync-session-toolbar-select"]').trigger('click')
    expect(wrapper.find('[data-testid="folder-sync-select-panel"]').exists()).toBe(true)
    await wrapper.find('[data-testid="folder-sync-select-all"]').trigger('click')
    expect(wrapper.find('[data-testid="folder-sync-selection-status"]').text()).toContain('2')

    await wrapper.find('[data-testid="folder-sync-session-toolbar-collapse"]').trigger('click')
    expect(wrapper.find('[data-testid="sync-row-copy-app"]').exists()).toBe(false)
    await wrapper.find('[data-testid="folder-sync-session-toolbar-expand"]').trigger('click')
    expect(wrapper.find('[data-testid="sync-row-copy-app"]').exists()).toBe(true)

    await wrapper.find('[data-testid="folder-sync-session-toolbar-peek"]').trigger('click')
    expect(wrapper.find('[data-testid="folder-sync-peek-panel"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="folder-sync-peek-path"]').text()).toContain(
      'package/app.exe',
    )
    await wrapper.find('[data-testid="sync-row-delete-old"]').trigger('click')
    expect(wrapper.find('[data-testid="folder-sync-peek-path"]').text()).toContain('prod/old.dll')
    await wrapper.find('[data-testid="folder-sync-peek-close"]').trigger('click')
    expect(wrapper.find('[data-testid="folder-sync-peek-panel"]').exists()).toBe(false)
  })

  it('exposes Filters and Peek glyph buttons on the Filters strip', async () => {
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

    expect(wrapper.find('[data-testid="folder-sync-filter-strip"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="folder-sync-filter-strip-filters"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="folder-sync-filter-strip-peek"]').exists()).toBe(true)
    expect(
      wrapper.find('[data-testid="folder-sync-filter-strip-filters"]').attributes('disabled'),
    ).toBeDefined()
    expect(
      wrapper.find('[data-testid="folder-sync-filter-strip-peek"]').attributes('disabled'),
    ).toBeDefined()

    await wrapper.find('[data-testid="folder-sync-left-path"]').setValue('D:/deploy/package')
    await wrapper.find('[data-testid="folder-sync-right-path"]').setValue('D:/deploy/prod')
    await wrapper.find('[data-testid="folder-sync-preview"]').trigger('click')
    await flushPromises()

    expect(
      wrapper.find('[data-testid="folder-sync-filter-strip-filters"]').attributes('disabled'),
    ).toBeUndefined()
    expect(
      wrapper.find('[data-testid="folder-sync-filter-strip-peek"]').attributes('disabled'),
    ).toBeUndefined()

    await wrapper.find('[data-testid="folder-sync-filter-strip-filters"]').trigger('click')
    expect(wrapper.find('[data-testid="folder-sync-filters-panel"]').exists()).toBe(true)

    await wrapper.find('[data-testid="folder-sync-filter-strip-peek"]').trigger('click')
    expect(wrapper.find('[data-testid="folder-sync-peek-panel"]').exists()).toBe(true)
  })

  it('debounces Filters strip changes into an automatic sync preview rebuild', async () => {
    vi.useFakeTimers()
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

    await wrapper.find('[data-testid="folder-sync-left-path"]').setValue('D:/deploy/package')
    await wrapper.find('[data-testid="folder-sync-right-path"]').setValue('D:/deploy/prod')
    await wrapper.find('[data-testid="folder-sync-preview"]').trigger('click')
    await flushPromises()
    vi.mocked(previewFolderSync).mockClear()

    const pattern = wrapper.find('[data-testid="folder-sync-filter-pattern"]')

    await pattern.setValue('*.exe')
    await pattern.trigger('change')
    await flushPromises()

    expect(previewFolderSync).not.toHaveBeenCalled()

    await vi.advanceTimersByTimeAsync(350)
    await flushPromises()

    expect(previewFolderSync).toHaveBeenCalledWith({
      leftRoot: 'D:/deploy/package',
      rightRoot: 'D:/deploy/prod',
      strategy: 'updateBoth',
      archiveExtensions: ['.tar.gz', '.tar', '.tgz', '.zip', '.7z', '.gz'],
      filters: { include: ['*.exe'], exclude: [], caseSensitive: false },
    })

    vi.useRealTimers()
  })

  it('exports the folder sync report to clipboard and a sibling text file', async () => {
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

    await wrapper.find('[data-testid="folder-sync-left-path"]').setValue('D:/deploy/package')
    await wrapper.find('[data-testid="folder-sync-right-path"]').setValue('D:/deploy/prod')
    await wrapper.find('[data-testid="folder-sync-strategy"]').setValue('mirrorRight')
    await wrapper.find('[data-testid="folder-sync-preview"]').trigger('click')
    await flushPromises()

    await wrapper.find('[data-testid="export-folder-sync-report"]').trigger('click')
    await flushPromises()

    expect(clipboardWriteText).toHaveBeenCalled()
    const payload = clipboardWriteText.mock.calls[0]?.[0] ?? ''

    expect(payload).toContain('FOLDER-SYNC-REPORT')
    expect(payload).toContain('left: D:/deploy/package')
    expect(payload).toContain('package/app.exe')
    expect(saveTextFile).toHaveBeenCalledWith({
      path: 'D:/deploy/folder-sync.txt',
      text: payload,
      createBackup: false,
      backupRetention: 1,
    })
    expect(wrapper.find('[data-testid="folder-sync-report-status"]').text()).toBe(
      'D:/deploy/folder-sync.txt',
    )
  })

  it('wires Session Export to the sync report instead of toggling filters', async () => {
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

    await wrapper.find('[data-testid="folder-sync-left-path"]').setValue('D:/deploy/package')
    await wrapper.find('[data-testid="folder-sync-right-path"]').setValue('D:/deploy/prod')
    await wrapper.find('[data-testid="folder-sync-preview"]').trigger('click')
    await flushPromises()

    expect(wrapper.find('[data-testid="folder-sync-filters-panel"]').exists()).toBe(false)

    useViewActionsStore().dispatch('export')
    await flushPromises()

    expect(wrapper.find('[data-testid="folder-sync-filters-panel"]').exists()).toBe(false)
    expect(saveTextFile).toHaveBeenCalled()
    expect(wrapper.find('[data-testid="folder-sync-report-status"]').text()).toBe(
      'D:/deploy/folder-sync.txt',
    )
  })

  it('wires Actions/Edit selection commands for Sync preview rows', async () => {
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

    await wrapper.find('[data-testid="folder-sync-left-path"]').setValue('D:/deploy/package')
    await wrapper.find('[data-testid="folder-sync-right-path"]').setValue('D:/deploy/prod')
    await wrapper.find('[data-testid="folder-sync-preview"]').trigger('click')
    await flushPromises()

    await wrapper.find('[data-testid="sync-row-copy-app"]').trigger('click')

    useViewActionsStore().dispatch('select-all')
    await flushPromises()
    expect(wrapper.find('[data-testid="folder-sync-select-panel"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="folder-sync-selection-status"]').text()).toContain('2')

    useViewActionsStore().dispatch('invert-selection')
    await flushPromises()
    expect(wrapper.find('[data-testid="folder-sync-selection-status"]').text()).toContain('0')

    await wrapper.find('[data-testid="sync-row-copy-app"]').trigger('click')
    useViewActionsStore().dispatch('exclude-selected')
    await flushPromises()
    expect(wrapper.find('[data-testid="sync-row-copy-app"]').exists()).toBe(false)
    expect(
      wrapper.find('[data-testid="folder-sync-selection-status"]').text().toLowerCase(),
    ).toContain('exclude')

    useViewActionsStore().dispatch('find-filename')
    await wrapper.find('[data-testid="folder-sync-find-filename"]').setValue('old.dll')
    await wrapper.find('[data-testid="folder-sync-find-filename-apply"]').trigger('click')
    expect(wrapper.find('[data-testid="folder-sync-selection-status"]').text()).toContain('1')

    await wrapper.find('[data-testid="sync-row-delete-old"]').trigger('click')
    useViewActionsStore().dispatch('open-with')
    await flushPromises()
    expect(openPathExternal).toHaveBeenCalled()

    useViewActionsStore().dispatch('open-selected')
    await flushPromises()
    expect(push).toHaveBeenCalled()

    vi.mocked(previewFolderSync).mockClear()
    useViewActionsStore().dispatch('refresh-selection')
    await flushPromises()
    expect(previewFolderSync).toHaveBeenCalled()

    useViewActionsStore().dispatch('toggle-log')
    await flushPromises()
  })

  it('wires Explorer reveal_path_in_os for the selected sync row', async () => {
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

    await wrapper.find('[data-testid="folder-sync-left-path"]').setValue('D:/deploy/package')
    await wrapper.find('[data-testid="folder-sync-right-path"]').setValue('D:/deploy/prod')
    await wrapper.find('[data-testid="folder-sync-preview"]').trigger('click')
    await flushPromises()

    const explorer = wrapper.find('[data-testid="reveal-sync-selected-in-explorer"]')

    expect(explorer.exists()).toBe(true)
    expect(explorer.attributes('disabled')).toBeDefined()

    await wrapper.find('[data-testid="sync-row-copy-app"]').trigger('click')
    expect(explorer.attributes('disabled')).toBeUndefined()

    vi.mocked(revealPathInOs).mockClear()
    await explorer.trigger('click')
    await flushPromises()
    expect(revealPathInOs).toHaveBeenCalledWith('D:/deploy/package/package/app.exe')

    vi.mocked(revealPathInOs).mockClear()
    useViewActionsStore().dispatch('select-all')
    await flushPromises()
    useViewActionsStore().dispatch('explorer')
    await flushPromises()
    expect(revealPathInOs).toHaveBeenCalledWith('D:/deploy/package/package/app.exe')
    expect(wrapper.text()).toMatch(/Revealed|file manager/i)
  })

  it('wires Sync Actions Leave Alone / Copy / Delete overrides for selection', async () => {
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

    await wrapper.find('[data-testid="folder-sync-left-path"]').setValue('D:/deploy/package')
    await wrapper.find('[data-testid="folder-sync-right-path"]').setValue('D:/deploy/prod')
    await wrapper.find('[data-testid="folder-sync-preview"]').trigger('click')
    await flushPromises()

    await wrapper.find('[data-testid="sync-row-copy-app"]').trigger('click')
    useViewActionsStore().dispatch('leave-alone')
    await flushPromises()
    expect(
      (wrapper.find('[data-testid="sync-override-copy-app"]').element as HTMLSelectElement).value,
    ).toBe('leave')

    useViewActionsStore().dispatch('sync-copy-right-to-left')
    await flushPromises()
    expect(
      (wrapper.find('[data-testid="sync-override-copy-app"]').element as HTMLSelectElement).value,
    ).toBe('copyRightToLeft')

    useViewActionsStore().dispatch('sync-delete-left')
    await flushPromises()
    expect(
      (wrapper.find('[data-testid="sync-override-copy-app"]').element as HTMLSelectElement).value,
    ).toBe('deleteLeft')

    useViewActionsStore().dispatch('sync-delete-right')
    await flushPromises()
    expect(
      (wrapper.find('[data-testid="sync-override-copy-app"]').element as HTMLSelectElement).value,
    ).toBe('deleteRight')
  })

  it('applies the selected override to all visible rows and can skip the rest', async () => {
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

    await wrapper.find('[data-testid="folder-sync-left-path"]').setValue('D:/deploy/package')
    await wrapper.find('[data-testid="folder-sync-right-path"]').setValue('D:/deploy/prod')
    await wrapper.find('[data-testid="folder-sync-preview"]').trigger('click')
    await flushPromises()

    await wrapper.find('[data-testid="sync-row-copy-app"]').trigger('click')
    await wrapper.find('[data-testid="sync-override-copy-app"]').setValue('copyRightToLeft')
    await wrapper.find('[data-testid="folder-sync-apply-to-all"]').trigger('click')
    await flushPromises()

    expect(
      (wrapper.find('[data-testid="sync-override-copy-app"]').element as HTMLSelectElement).value,
    ).toBe('copyRightToLeft')
    expect(
      (wrapper.find('[data-testid="sync-override-delete-old"]').element as HTMLSelectElement).value,
    ).toBe('copyRightToLeft')

    await wrapper.find('[data-testid="folder-sync-skip-remaining"]').trigger('click')
    await flushPromises()
    expect(
      (wrapper.find('[data-testid="sync-override-copy-app"]').element as HTMLSelectElement).value,
    ).toBe('leave')
    expect(
      (wrapper.find('[data-testid="sync-override-delete-old"]').element as HTMLSelectElement).value,
    ).toBe('leave')
  })

  it('creates a new folder under Sync path roots', async () => {
    vi.mocked(createFolderEntry).mockResolvedValue({
      operation: 'createFolder',
      status: 'created',
      sourcePath: 'D:/deploy/package/New Folder',
      targetPath: 'D:/deploy/package/New Folder',
    })

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

    await wrapper.find('[data-testid="folder-sync-left-path"]').setValue('D:/deploy/package')
    await wrapper.find('[data-testid="folder-sync-right-path"]').setValue('D:/deploy/prod')

    useViewActionsStore().dispatch('new-folder')
    await flushPromises()
    expect(wrapper.find('[data-testid="folder-sync-new-folder-panel"]').exists()).toBe(true)

    await wrapper.find('[data-testid="folder-sync-new-folder-name"]').setValue('Fresh')
    await wrapper.find('[data-testid="folder-sync-confirm-new-folder"]').trigger('click')
    await flushPromises()

    expect(createFolderEntry).toHaveBeenCalledWith({ path: 'D:/deploy/package/Fresh' })
    expect(createFolderEntry).toHaveBeenCalledWith({ path: 'D:/deploy/prod/Fresh' })
    expect(previewFolderSync).toHaveBeenCalled()
  })

  it('cancels overwrite/delete confirmation without executing', async () => {
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

    await wrapper.find('[data-testid="folder-sync-left-path"]').setValue('D:/deploy/package')
    await wrapper.find('[data-testid="folder-sync-right-path"]').setValue('D:/deploy/prod')
    await wrapper.find('[data-testid="folder-sync-preview"]').trigger('click')
    await flushPromises()
    await wrapper.find('[data-testid="folder-sync-run"]').trigger('click')

    expect(wrapper.find('[data-testid="folder-sync-safety-confirmation"]').exists()).toBe(true)
    await wrapper.find('[data-testid="folder-sync-cancel-safety"]').trigger('click')
    await flushPromises()

    expect(wrapper.find('[data-testid="folder-sync-safety-confirmation"]').exists()).toBe(false)
    expect(executeFolderSync).not.toHaveBeenCalled()
  })

  it('sends leave for excluded sync rows and omits them from confirm', async () => {
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

    await wrapper.find('[data-testid="folder-sync-left-path"]').setValue('D:/deploy/package')
    await wrapper.find('[data-testid="folder-sync-right-path"]').setValue('D:/deploy/prod')
    await wrapper.find('[data-testid="folder-sync-preview"]').trigger('click')
    await flushPromises()
    await wrapper.find('[data-testid="sync-row-copy-app"]').trigger('click')
    useViewActionsStore().dispatch('exclude-selected')
    await flushPromises()

    expect(wrapper.find('[data-testid="sync-row-copy-app"]').exists()).toBe(false)
    await wrapper.find('[data-testid="folder-sync-run"]').trigger('click')
    expect(wrapper.find('[data-testid="folder-sync-safety-confirmation"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="folder-sync-safety-confirmation"]').text()).not.toContain(
      'package/app.exe',
    )
    expect(wrapper.find('[data-testid="folder-sync-safety-confirmation"]').text()).toContain(
      'prod/old.dll',
    )
    await wrapper.find('[data-testid="folder-sync-confirm-safety"]').trigger('click')
    await flushPromises()

    expect(executeFolderSync).toHaveBeenCalledWith(
      expect.objectContaining({
        leftRoot: 'D:/deploy/package',
        rightRoot: 'D:/deploy/prod',
        overrides: [
          { relativePath: 'package/app.exe', action: 'leave' },
          { relativePath: 'prod/old.dll', action: 'deleteRight' },
        ],
      }),
    )
  })

  it('skips the safety panel when overwrite and delete confirms are off', async () => {
    const settings = useSettingsStore()

    settings.setConfirmBeforeSyncOverwrite(false)
    settings.setConfirmBeforeSyncDelete(false)

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

    await wrapper.find('[data-testid="folder-sync-left-path"]').setValue('D:/deploy/package')
    await wrapper.find('[data-testid="folder-sync-right-path"]').setValue('D:/deploy/prod')
    await wrapper.find('[data-testid="folder-sync-preview"]').trigger('click')
    await flushPromises()
    await wrapper.find('[data-testid="folder-sync-run"]').trigger('click')
    await flushPromises()

    expect(wrapper.find('[data-testid="folder-sync-safety-confirmation"]').exists()).toBe(false)
    expect(executeFolderSync).toHaveBeenCalled()
  })
})
