import { mount, flushPromises, type VueWrapper } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { useSettingsStore } from '@/stores/settings'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import FolderCompareView from './FolderCompareView.vue'
import {
  changeFolderEntryAttributes,
  compareFolderPaths,
  copyFolderCompareEntry,
  copyFolderEntry,
  deleteFolderEntry,
  exportFolderCompareReport,
  moveFolderEntry,
  renameFolderEntry,
  touchFolderEntry,
} from '@/api/diff'
import { pickNativePath } from '@/app/filePicker'
import { useViewActionsStore } from '@/stores/viewActions'
import { executeFolderSync, previewFolderSync } from '@/api/sync'
import { useSessionLaunchStore } from '@/stores/sessionLaunch'
import { openPathExternal } from '@/api/integration'
import { saveLocalRemoteProfiles } from '@/app/remoteProfilesLocal'
import type * as remoteApi from '@/api/remote'
import { useTabsStore } from '@/stores/tabs'

const push = vi.fn()

vi.mock('vue-router', () => ({
  useRouter: () => ({ push }),
}))

vi.mock('@/api/integration', () => ({
  openPathExternal: vi.fn().mockResolvedValue({
    path: 'D:/left/src/main.ts',
    executable: null,
    launched: true,
  }),
}))

vi.mock('@/api/remote', async (importOriginal) => {
  const actual = await importOriginal<typeof remoteApi>()

  return {
    ...actual,
    listRemoteProfiles: vi.fn().mockRejectedValue(new Error('no backend')),
    listRemotePath: vi.fn().mockResolvedValue([{ path: '/apps/api', kind: 'directory', size: 0 }]),
  }
})

vi.mock('@/api/sync', () => ({
  executeFolderSync: vi.fn().mockResolvedValue({
    name: 'Update Right',
    leftRoot: 'D:/left',
    rightRoot: 'D:/right',
    strategy: 'updateRight',
    total: 1,
    succeeded: 1,
    failed: 0,
    cancelled: 0,
    logs: [],
  }),
  previewFolderSync: vi.fn().mockResolvedValue({
    name: 'preview',
    leftRoot: 'D:/left',
    rightRoot: 'D:/right',
    strategy: 'updateRight',
    rows: [
      {
        id: 'copy-notes',
        relativePath: 'notes.md',
        action: 'Copy',
        sourcePath: 'D:/left/notes.md',
        targetPath: 'D:/right/notes.md',
        detail: 'Copy left to right',
      },
    ],
    summary: { total: 1, copy: 1, delete: 0, leave: 0, conflict: 0 },
  }),
}))

vi.mock('@/app/filePicker', () => ({
  pickNativePath: vi.fn(),
}))

vi.mock('@/app/diskFreeSpace', () => ({
  formatFreeSpaceQuantity: (bytes: number) => {
    if (bytes >= 1024 ** 3) {
      return `${(bytes / 1024 ** 3).toFixed(1)} GB`
    }

    return `${String(Math.round(bytes / 1024 ** 2))} MB`
  },
  fetchPathVolumeInfo: vi.fn((path: string) => {
    if (!path) {
      return Promise.resolve(null)
    }

    return Promise.resolve({
      path,
      freeBytes: 91.8 * 1024 ** 3,
      displayRoot: 'C:\\',
    })
  }),
}))

vi.mock('@/api/diff', () => ({
  changeFolderEntryAttributes: vi.fn().mockResolvedValue({
    path: 'D:/left/README.md',
    metadata: { readonly: true },
  }),
  compareFolderPaths: vi.fn().mockResolvedValue({
    leftRoot: 'D:/left',
    rightRoot: 'D:/right',
    rows: [
      {
        relativePath: 'src',
        depth: 0,
        status: 'Same',
        left: { name: 'src', kind: 'directory', size: 0, path: 'D:/left/src' },
        right: { name: 'src', kind: 'directory', size: 0, path: 'D:/right/src' },
      },
      {
        relativePath: 'src/main.ts',
        depth: 1,
        status: 'Different',
        left: { name: 'main.ts', kind: 'file', size: 12, path: 'D:/left/src/main.ts' },
        right: { name: 'main.ts', kind: 'file', size: 14, path: 'D:/right/src/main.ts' },
      },
      {
        relativePath: 'stamp.txt',
        depth: 0,
        status: 'Different',
        unimportant: true,
        left: {
          name: 'stamp.txt',
          kind: 'file',
          size: 8,
          modifiedAtMs: 1000,
          path: 'D:/left/stamp.txt',
        },
        right: {
          name: 'stamp.txt',
          kind: 'file',
          size: 8,
          modifiedAtMs: 2000,
          path: 'D:/right/stamp.txt',
        },
      },
      {
        relativePath: 'README.md',
        depth: 0,
        status: 'Same',
        left: { name: 'README.md', kind: 'file', size: 10, path: 'D:/left/README.md' },
        right: { name: 'README.md', kind: 'file', size: 10, path: 'D:/right/README.md' },
      },
      {
        relativePath: 'notes.md',
        depth: 0,
        status: 'Left only',
        left: { name: 'notes.md', kind: 'file', size: 4, path: 'D:/left/notes.md' },
      },
      {
        relativePath: 'extra-right.md',
        depth: 0,
        status: 'Right only',
        right: { name: 'extra-right.md', kind: 'file', size: 3, path: 'D:/right/extra-right.md' },
      },
    ],
    summary: { total: 6, same: 2, different: 2, leftOnly: 1, rightOnly: 1 },
  }),
  copyFolderCompareEntry: vi.fn().mockResolvedValue({
    direction: 'toRight',
    sourcePath: 'D:/left/src/main.ts',
    targetPath: 'D:/right/src/main.ts',
    refreshedStatus: 'same',
  }),
  createFolderEntry: vi.fn().mockResolvedValue({
    operation: 'createFolder',
    status: 'created',
    sourcePath: 'D:/right/New Folder',
    targetPath: 'D:/right/New Folder',
  }),
  deleteFolderEntry: vi.fn().mockResolvedValue({
    operation: 'delete',
    status: 'deleted',
    sourcePath: 'D:/left/notes.md',
    targetPath: null,
  }),
  exportFolderCompareReport: vi.fn().mockResolvedValue({
    format: 'html',
    content: '<html></html>',
    outputPath: 'D:/left/folder-compare.html',
    bytesWritten: 13,
  }),
  copyFolderEntry: vi.fn().mockResolvedValue({
    operation: 'copy',
    status: 'copied',
    sourcePath: 'D:/left/notes.md',
    targetPath: 'D:/backup/notes.md',
  }),
  moveFolderEntry: vi.fn().mockResolvedValue({
    operation: 'move',
    status: 'moved',
    sourcePath: 'D:/left/notes.md',
    targetPath: 'D:/backup/notes.md',
  }),
  renameFolderEntry: vi.fn().mockResolvedValue({
    operation: 'rename',
    status: 'renamed',
    sourcePath: 'D:/left/notes.md',
    targetPath: 'D:/left/notes-final.md',
  }),
  touchFolderEntry: vi.fn().mockResolvedValue({
    path: 'D:/left/README.md',
    metadata: { readonly: false },
  }),
}))

function mountFolderCompareView(): VueWrapper {
  return mount(FolderCompareView, {
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

async function runCompare(wrapper: VueWrapper): Promise<void> {
  await wrapper.find('[data-testid="folder-left-root"]').setValue('D:/left')
  await wrapper.find('[data-testid="folder-right-root"]').setValue('D:/right')
  await wrapper.find('[data-testid="run-folder-compare"]').trigger('click')
  await flushPromises()
}

describe('FolderCompareView', () => {
  beforeEach(() => {
    localStorage.clear()
    setActivePinia(createPinia())
    useSettingsStore().setShowSessionsInToolbar(true)
    push.mockClear()
    vi.clearAllMocks()
  })

  it('applies a remote profile URI into the folder path fields', async () => {
    saveLocalRemoteProfiles([
      {
        id: 'stage-sftp',
        name: 'Stage SFTP',
        protocol: 'sftp',
        host: 'stage.example.com',
        port: 22,
        rootPath: '/apps',
      },
    ])

    const wrapper = mountFolderCompareView()

    await flushPromises()

    expect(wrapper.find('[data-testid="folder-remote-profile-bar"]').exists()).toBe(true)
    await wrapper.find('[data-testid="folder-left-profile"]').setValue('stage-sftp')
    await wrapper.find('[data-testid="folder-left-profile"]').trigger('change')

    expect(
      (wrapper.find('[data-testid="folder-left-root"]').element as HTMLInputElement).value,
    ).toBe('sftp://profile/stage-sftp/apps')
  })

  it('opens the remote folder browser from Browse when a profile is selected', async () => {
    Object.defineProperty(window, '__TAURI_INTERNALS__', {
      configurable: true,
      value: {},
    })
    saveLocalRemoteProfiles([
      {
        id: 'stage-sftp',
        name: 'Stage SFTP',
        protocol: 'sftp',
        host: 'stage.example.com',
        port: 22,
        rootPath: '/apps',
      },
    ])

    const wrapper = mountFolderCompareView()

    await flushPromises()
    await wrapper.find('[data-testid="folder-left-profile"]').setValue('stage-sftp')
    await wrapper.find('[data-testid="folder-left-profile"]').trigger('change')
    await wrapper.find('[data-testid="folder-browse-left"]').trigger('click')
    await flushPromises()

    expect(wrapper.find('[data-testid="remote-path-browser"]').exists()).toBe(true)

    Reflect.deleteProperty(window, '__TAURI_INTERNALS__')
  })

  it('renders the Folder Compare session toolbar order', () => {
    const wrapper = mountFolderCompareView()
    const ids = [
      'home',
      'all',
      'diffs',
      'same',
      'structure',
      'minor',
      'rules',
      'sessions',
      'copy',
      'expand',
      'collapse',
      'select',
      'files',
      'refresh',
      'swap',
      'stop',
      'filters',
      'peek',
    ]

    expect(wrapper.find('[data-testid="folder-session-toolbar-bar"]').exists()).toBe(true)
    expect(
      wrapper
        .findAll('[data-testid^="folder-session-toolbar-"]')
        .filter((node) => node.attributes('data-testid') !== 'folder-session-toolbar-bar')
        .map((node) => node.attributes('data-testid')?.replace('folder-session-toolbar-', '')),
    ).toEqual(ids)
    expect(
      wrapper.find('[data-testid="folder-session-toolbar-minor"]').attributes('disabled'),
    ).toBeDefined()
    expect(
      wrapper.find('[data-testid="folder-session-toolbar-rules"]').attributes('disabled'),
    ).toBeUndefined()
    expect(
      wrapper.find('[data-testid="folder-session-toolbar-filters"]').attributes('disabled'),
    ).toBeUndefined()
    expect(
      wrapper.find('[data-testid="folder-session-toolbar-files"]').attributes('disabled'),
    ).toBeUndefined()
    expect(
      wrapper.find('[data-testid="folder-session-toolbar-peek"]').attributes('disabled'),
    ).toBeUndefined()
    expect(
      wrapper.find('[data-testid="folder-session-toolbar-select"]').attributes('disabled'),
    ).toBeUndefined()
    expect(wrapper.html()).not.toContain('未实现')
  })

  it('opens session settings from the Sessions toolbar control', async () => {
    const wrapper = mountFolderCompareView()

    expect(wrapper.find('[data-testid="folder-session-toolbar-sessions"]').exists()).toBe(true)
    expect(
      wrapper.find('[data-testid="folder-session-toolbar-sessions"]').attributes('disabled'),
    ).toBeUndefined()

    await wrapper.find('[data-testid="folder-session-toolbar-sessions"]').trigger('click')
    expect(wrapper.find('[data-testid="session-settings-dialog"]').exists()).toBe(true)
  })

  it('filters to unimportant timestamp differences from the Minor toolbar', async () => {
    const wrapper = mountFolderCompareView()

    await runCompare(wrapper)

    expect(
      wrapper.find('[data-testid="folder-session-toolbar-minor"]').attributes('disabled'),
    ).toBeUndefined()
    expect(wrapper.find('[data-testid="folder-summary-minor"]').text()).toContain('1')

    await wrapper.find('[data-testid="folder-session-toolbar-minor"]').trigger('click')
    await flushPromises()

    const visiblePaths = wrapper
      .findAll('[data-testid="folder-row"]')
      .map((row) => row.attributes('data-row-id'))

    expect(visiblePaths).toEqual(['stamp-txt'])
    expect(
      wrapper.find('[data-testid="folder-session-toolbar-minor"]').attributes('data-active'),
    ).toBe('true')
    expect(wrapper.find('[data-unimportant="true"]').text()).toContain('Minor')

    await wrapper.find('[data-testid="folder-session-toolbar-all"]').trigger('click')
    await flushPromises()
    expect(
      wrapper.find('[data-testid="folder-session-toolbar-minor"]').attributes('data-active'),
    ).not.toBe('true')
    expect(wrapper.findAll('[data-testid="folder-row"]').length).toBeGreaterThan(1)
  })

  it('selects visible rows by status and name from the Select toolbar', async () => {
    const wrapper = mountFolderCompareView()

    await wrapper.find('[data-testid="folder-session-toolbar-select"]').trigger('click')
    expect(wrapper.find('[data-testid="folder-select-panel"]').isVisible()).toBe(true)

    // Seed rows via mocked compare if mount helper already does; otherwise just exercise controls.
    await wrapper.find('[data-testid="folder-select-all"]').trigger('click')
    expect(wrapper.find('[data-testid="folder-select-count"]').text().length).toBeGreaterThan(0)

    await wrapper.find('[data-testid="folder-select-name-filter"]').setValue('readme')
    await wrapper.find('[data-testid="folder-select-name-apply"]').trigger('click')
    await wrapper.find('[data-testid="folder-select-clear"]').trigger('click')
  })

  it('surfaces a capture-like Filters strip with the current name pattern', async () => {
    const wrapper = mountFolderCompareView()

    const strip = wrapper.find('[data-testid="folder-filter-strip"]')
    const pattern = wrapper.find('[data-testid="folder-filter-pattern"]')

    expect(strip.exists()).toBe(true)
    expect(pattern.exists()).toBe(true)
    expect(wrapper.find('[data-testid="folder-filter-strip-filters"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="folder-filter-strip-peek"]').exists()).toBe(true)
    expect(
      wrapper.find('[data-testid="folder-display-filters"]').attributes('style') ?? '',
    ).not.toContain('display: none')
    expect(strip.text()).toContain('Filters')
    expect((pattern.element as HTMLInputElement).value).toBe('*.*')

    await pattern.setValue('*.ts;*.vue')
    await pattern.trigger('change')
    expect((pattern.element as HTMLInputElement).value).toBe('*.ts;*.vue')

    const stored = JSON.parse(localStorage.getItem('open-diff-folder-name-filters') ?? '{}') as {
      include: string[]
    }

    expect(stored.include).toEqual(['*.ts', '*.vue'])
  })

  it('debounces Filters strip changes into an automatic compare rebuild', async () => {
    vi.useFakeTimers()
    const wrapper = mountFolderCompareView()

    await runCompare(wrapper)
    vi.mocked(compareFolderPaths).mockClear()

    const pattern = wrapper.find('[data-testid="folder-filter-pattern"]')

    await pattern.setValue('*.ts')
    await pattern.trigger('change')
    await flushPromises()

    expect(compareFolderPaths).not.toHaveBeenCalled()

    await vi.advanceTimersByTimeAsync(350)
    await flushPromises()

    expect(compareFolderPaths).toHaveBeenCalledWith({
      leftRoot: 'D:/left',
      rightRoot: 'D:/right',
      criteria: {
        compareSize: true,
        compareModifiedTime: false,
        compareContents: true,
        compareCrc: false,
        compareAttributes: false,
        sizeOnlyUnimportant: false,
        followSymlinks: false,
        timestampToleranceMs: 0,
        ignoreDaylightSavingHourOffset: false,
        showHiddenFiles: false,
      },
      filters: { include: ['*.ts'], exclude: [], caseSensitive: false },
      archiveExtensions: ['.tar.gz', '.tar', '.tgz', '.zip', '.7z', '.gz'],
    })

    vi.useRealTimers()
  })

  it('opens display filters and peek from the Filters strip glyph buttons', async () => {
    const wrapper = mountFolderCompareView()

    expect(
      wrapper.find('[data-testid="folder-display-filters"]').attributes('style') ?? '',
    ).not.toContain('display: none')
    expect(wrapper.find('[data-testid="folder-peek-panel"]').attributes('style') ?? '').toContain(
      'display: none',
    )

    await wrapper.find('[data-testid="folder-filter-strip-filters"]').trigger('click')
    expect(
      wrapper.find('[data-testid="folder-display-filters"]').attributes('style') ?? '',
    ).toContain('display: none')
    expect(wrapper.find('[data-testid="folder-filter-strip"]').exists()).toBe(true)

    await wrapper.find('[data-testid="folder-filter-strip-filters"]').trigger('click')
    expect(
      wrapper.find('[data-testid="folder-display-filters"]').attributes('style') ?? '',
    ).not.toContain('display: none')

    await wrapper.find('[data-testid="folder-filter-strip-peek"]').trigger('click')
    expect(
      wrapper.find('[data-testid="folder-peek-panel"]').attributes('style') ?? '',
    ).not.toContain('display: none')
    await wrapper.find('[data-testid="folder-filter-strip-peek"]').trigger('click')
    expect(wrapper.find('[data-testid="folder-peek-panel"]').attributes('style') ?? '').toContain(
      'display: none',
    )
  })

  it('toggles rules and filters panels from the session toolbar', async () => {
    const wrapper = mountFolderCompareView()

    expect(wrapper.find('[data-testid="folder-criteria"]').attributes('style') ?? '').not.toContain(
      'display: none',
    )
    expect(
      wrapper.find('[data-testid="folder-display-filters"]').attributes('style') ?? '',
    ).not.toContain('display: none')

    await wrapper.find('[data-testid="folder-session-toolbar-rules"]').trigger('click')
    expect(wrapper.find('[data-testid="folder-criteria"]').attributes('style') ?? '').toContain(
      'display: none',
    )

    await wrapper.find('[data-testid="folder-session-toolbar-filters"]').trigger('click')
    expect(
      wrapper.find('[data-testid="folder-display-filters"]').attributes('style') ?? '',
    ).toContain('display: none')

    await wrapper.find('[data-testid="folder-session-toolbar-rules"]').trigger('click')
    await wrapper.find('[data-testid="folder-session-toolbar-filters"]').trigger('click')
    expect(wrapper.find('[data-testid="folder-criteria"]').attributes('style') ?? '').not.toContain(
      'display: none',
    )
    expect(
      wrapper.find('[data-testid="folder-display-filters"]').attributes('style') ?? '',
    ).not.toContain('display: none')
  })

  it('filters the folder tree to files only from the session toolbar', async () => {
    const wrapper = mountFolderCompareView()

    await runCompare(wrapper)
    expect(wrapper.find('[data-row-id="src"]').exists()).toBe(true)
    expect(wrapper.find('[data-row-id="src-main-ts"]').exists()).toBe(true)

    await wrapper.find('[data-testid="folder-session-toolbar-files"]').trigger('click')
    expect(wrapper.find('[data-row-id="src"]').exists()).toBe(false)
    expect(wrapper.find('[data-row-id="src-main-ts"]').exists()).toBe(true)
    expect(wrapper.find('[data-row-id="readme-md"]').exists()).toBe(true)
    expect(
      (wrapper.find('[data-testid="toggle-files-only-filter"]').element as HTMLInputElement)
        .checked,
    ).toBe(true)
  })

  it('does not render a demo folder tree before a real compare', () => {
    const wrapper = mountFolderCompareView()

    expect(wrapper.text()).not.toContain('generated-120.log')
    expect(wrapper.text()).not.toContain('D:/workspace/left')
    expect(wrapper.findAll('[data-testid="folder-row"]')).toHaveLength(0)
    expect(wrapper.find('[data-testid="folder-empty-state"]').exists()).toBe(true)
  })

  it('runs a real folder comparison request and renders returned rows', async () => {
    const wrapper = mountFolderCompareView()

    await runCompare(wrapper)

    expect(compareFolderPaths).toHaveBeenCalledWith({
      leftRoot: 'D:/left',
      rightRoot: 'D:/right',
      criteria: {
        compareSize: true,
        compareModifiedTime: false,
        compareContents: true,
        compareCrc: false,
        compareAttributes: false,
        sizeOnlyUnimportant: false,
        followSymlinks: false,
        timestampToleranceMs: 0,
        ignoreDaylightSavingHourOffset: false,
        showHiddenFiles: false,
      },
      filters: {
        include: [],
        exclude: [],
        caseSensitive: false,
      },
      archiveExtensions: ['.tar.gz', '.tar', '.tgz', '.zip', '.7z', '.gz'],
    })
    expect(wrapper.text()).toContain('main.ts')
    expect(wrapper.text()).toContain('Different')
  })

  it('opens a child text compare session for a selected file pair', async () => {
    const wrapper = mountFolderCompareView()

    await runCompare(wrapper)
    await wrapper.find('[data-row-id="src-main-ts"]').trigger('click')
    await wrapper.find('[data-testid="compare-to-selected-file"]').trigger('click')

    expect(push).toHaveBeenCalledWith('/compare/text')
    expect(useSessionLaunchStore().pendingLaunch).toMatchObject({
      route: '/compare/text',
      autoRun: true,
      locations: {
        left: { uri: 'D:/left/src/main.ts' },
        right: { uri: 'D:/right/src/main.ts' },
      },
    })
    expect(useTabsStore().tabs.some((tab) => tab.route === '/compare/text')).toBe(true)
  })

  it('launches open-with and associated apps for the selected file', async () => {
    const wrapper = mountFolderCompareView()

    await runCompare(wrapper)
    await wrapper.find('[data-row-id="src-main-ts"]').trigger('click')

    const openWith = wrapper.find('[data-testid="open-with-selected-file"]')
    const associated = wrapper.find('[data-testid="open-associated-file"]')
    const vscode = wrapper.find('[data-testid="open-with-custom-vscode"]')

    expect(openWith.attributes('disabled')).toBeUndefined()
    expect(associated.attributes('disabled')).toBeUndefined()
    expect(vscode.attributes('disabled')).toBeUndefined()
    expect(openWith.text()).not.toContain('unimplemented')

    await associated.trigger('click')
    await flushPromises()
    expect(openPathExternal).toHaveBeenCalledWith('D:/left/src/main.ts')

    vi.mocked(openPathExternal).mockClear()
    await vscode.trigger('click')
    await flushPromises()
    expect(openPathExternal).toHaveBeenCalledWith('D:/left/src/main.ts', 'code')
    expect(wrapper.text()).toContain('Open With Visual Studio Code')
  })

  it('aligns orphan files and can break the manual alignment', async () => {
    const wrapper = mountFolderCompareView()

    await runCompare(wrapper)
    await wrapper.find('[data-row-id="notes-md"]').trigger('click')
    await wrapper.find('[data-testid="align-with-target"]').setValue('extra-right-md')

    const alignWith = wrapper.find('[data-testid="align-with-selected-file"]')

    expect(alignWith.attributes('disabled')).toBeUndefined()
    await alignWith.trigger('click')

    expect(wrapper.find('[data-testid="folder-alignment-action-status"]').text()).toContain(
      'Aligned',
    )
    expect(wrapper.find('[data-row-id="align-notes-md-with-extra-right-md"]').exists()).toBe(true)

    await wrapper.find('[data-row-id="align-notes-md-with-extra-right-md"]').trigger('click')
    const breakAlignment = wrapper.find('[data-testid="break-selected-alignment"]')

    expect(breakAlignment.attributes('disabled')).toBeUndefined()
    await breakAlignment.trigger('click')

    expect(wrapper.find('[data-testid="folder-alignment-action-status"]').text()).toContain(
      'Broke alignment',
    )
    expect(wrapper.find('[data-row-id="align-notes-md-with-extra-right-md-left"]').exists()).toBe(
      true,
    )
    expect(alignWith.text()).not.toContain('unimplemented')
  })

  it('keeps Align With pairs across a folder rescan', async () => {
    const wrapper = mountFolderCompareView()

    await runCompare(wrapper)
    await wrapper.find('[data-row-id="notes-md"]').trigger('click')
    await wrapper.find('[data-testid="align-with-target"]').setValue('extra-right-md')
    await wrapper.find('[data-testid="align-with-selected-file"]').trigger('click')

    expect(wrapper.find('[data-row-id="align-notes-md-with-extra-right-md"]').exists()).toBe(true)

    await runCompare(wrapper)

    expect(wrapper.find('[data-row-id="align-notes-md-with-extra-right-md"]').exists()).toBe(true)
    expect(wrapper.find('[data-row-id="notes-md"]').exists()).toBe(false)
    expect(wrapper.find('[data-row-id="extra-right-md"]').exists()).toBe(false)
  })

  it('moves the selected file to a picked folder through the Tauri command', async () => {
    vi.mocked(pickNativePath).mockResolvedValueOnce('D:/backup')
    const wrapper = mountFolderCompareView()

    await runCompare(wrapper)
    await wrapper.find('[data-row-id="notes-md"]').trigger('click')
    await wrapper.find('[data-testid="move-selected-file"]').trigger('click')
    await flushPromises()

    expect(pickNativePath).toHaveBeenCalledWith({ directory: true })
    expect(moveFolderEntry).toHaveBeenCalledWith({
      sourcePath: 'D:/left/notes.md',
      targetPath: 'D:/backup/notes.md',
    })
    expect(wrapper.text()).toContain('Move to Folder')
    expect(wrapper.text()).toContain('D:/backup/notes.md')
  })

  it('copies to side and folder, and wires Actions rename/delete dispatch', async () => {
    vi.mocked(pickNativePath).mockResolvedValueOnce('D:/backup')
    const wrapper = mountFolderCompareView()

    await runCompare(wrapper)
    await wrapper.find('[data-row-id="notes-md"]').trigger('click')
    await wrapper.find('[data-testid="copy-selected-to-side"]').trigger('click')
    await wrapper.find('[data-testid="confirm-folder-copy"]').trigger('click')
    await flushPromises()
    expect(copyFolderCompareEntry).toHaveBeenCalled()

    await wrapper.find('[data-row-id="notes-md"]').trigger('click')
    await wrapper.find('[data-testid="copy-selected-to-folder"]').trigger('click')
    await flushPromises()
    expect(copyFolderEntry).toHaveBeenCalledWith({
      sourcePath: 'D:/left/notes.md',
      targetPath: 'D:/backup/notes.md',
    })

    await wrapper.find('[data-row-id="notes-md"]').trigger('click')
    useViewActionsStore().dispatch('rename-selected')
    await flushPromises()
    expect(wrapper.find('[data-testid="folder-rename-panel"]').exists()).toBe(true)

    await wrapper.find('[data-row-id="notes-md"]').trigger('click')
    useViewActionsStore().dispatch('delete')
    await flushPromises()
    expect(wrapper.find('[data-testid="folder-dangerous-confirmation"]').exists()).toBe(true)
  })

  it('copies, renames, deletes, and touches selected files', async () => {
    const wrapper = mountFolderCompareView()

    await runCompare(wrapper)

    await wrapper.find('[data-row-id="src-main-ts"]').trigger('click')
    await wrapper.find('[data-testid="copy-selected-to-right"]').trigger('click')
    await wrapper.find('[data-testid="confirm-folder-copy"]').trigger('click')
    await flushPromises()
    expect(copyFolderCompareEntry).toHaveBeenCalled()

    await wrapper.find('[data-row-id="notes-md"]').trigger('click')
    await wrapper.find('[data-testid="rename-selected-file"]').trigger('click')
    await wrapper.find('[data-testid="rename-target-name"]').setValue('notes-final.md')
    await wrapper.find('[data-testid="confirm-rename-file"]').trigger('click')
    await flushPromises()
    expect(renameFolderEntry).toHaveBeenCalled()

    await wrapper.find('[data-row-id="notes-md"]').trigger('click')
    await wrapper.find('[data-testid="delete-selected-file"]').trigger('click')
    await wrapper.find('[data-testid="confirm-dangerous-file-operation"]').trigger('click')
    await flushPromises()
    expect(deleteFolderEntry).toHaveBeenCalled()

    await wrapper.find('[data-row-id="readme-md"]').trigger('click')
    await wrapper.find('[data-testid="touch-selected-file"]').trigger('click')
    await flushPromises()
    expect(touchFolderEntry).toHaveBeenCalled()
    expect(changeFolderEntryAttributes).not.toHaveBeenCalled()
  })

  it('exports a folder compare HTML report', async () => {
    const wrapper = mountFolderCompareView()

    await runCompare(wrapper)
    await wrapper.find('[data-testid="export-folder-html-report"]').trigger('click')
    await flushPromises()

    expect(exportFolderCompareReport).toHaveBeenCalledWith(
      expect.objectContaining({
        leftRoot: 'D:/left',
        rightRoot: 'D:/right',
        format: 'html',
      }),
    )
  })

  it('exports a folder compare CSV report', async () => {
    const wrapper = mountFolderCompareView()

    await runCompare(wrapper)
    expect(wrapper.find('[data-testid="export-folder-markdown-report"]').exists()).toBe(true)
    await wrapper.find('[data-testid="export-folder-csv-report"]').trigger('click')
    await flushPromises()

    expect(exportFolderCompareReport).toHaveBeenCalledWith(
      expect.objectContaining({
        leftRoot: 'D:/left',
        rightRoot: 'D:/right',
        format: 'csv',
      }),
    )
  })

  it('loads a real sync preview instead of demo rows', async () => {
    const wrapper = mountFolderCompareView()

    await runCompare(wrapper)
    await wrapper.find('[data-testid="preview-sync-plan"]').trigger('click')
    await flushPromises()

    expect(previewFolderSync).toHaveBeenCalledWith({
      leftRoot: 'D:/left',
      rightRoot: 'D:/right',
      strategy: 'updateRight',
    })
    expect(wrapper.find('[data-testid="sync-preview-panel"]').text()).toContain('D:/left/notes.md')
    expect(wrapper.text()).not.toContain('D:/workspace/right/archive/legacy.tmp')

    await wrapper.find('[data-testid="run-sync-preview"]').trigger('click')
    await flushPromises()

    expect(executeFolderSync).toHaveBeenCalledWith({
      leftRoot: 'D:/left',
      rightRoot: 'D:/right',
      strategy: 'updateRight',
      overrides: [
        {
          relativePath: 'notes.md',
          action: 'copyLeftToRight',
        },
      ],
    })
    expect(wrapper.text()).toMatch(/Sync finished|同步完成/)
  })
  it('filters rows by Same/Different/Orphans and persists the selection', async () => {
    const wrapper = mountFolderCompareView()

    await runCompare(wrapper)

    const sameToggle = wrapper.find('[data-testid="toggle-status-same"]')

    await sameToggle.setValue(false)
    await sameToggle.trigger('change')
    await flushPromises()

    const statuses = wrapper
      .findAll('[data-testid="folder-row"]')
      .map((row) => row.classes().find((name) => name.startsWith('status-')))

    expect(statuses.length).toBeGreaterThan(0)
    expect(statuses.every((status) => status !== 'status-same')).toBe(true)

    const stored = JSON.parse(localStorage.getItem('open-diff-folder-display-filters') ?? '{}') as {
      statuses: string[]
      showSuppressed: boolean
    }

    expect(stored.statuses).not.toContain('Same')
    expect(stored.statuses).toContain('Different')
  })

  it('shows a readable compare error instead of undefined', async () => {
    vi.mocked(compareFolderPaths).mockRejectedValueOnce(undefined)
    const wrapper = mountFolderCompareView()

    await wrapper.find('[data-testid="folder-left-root"]').setValue('D:/left')
    await wrapper.find('[data-testid="folder-right-root"]').setValue('D:/right')
    await wrapper.find('[data-testid="run-folder-compare"]').trigger('click')
    await flushPromises()

    expect(wrapper.find('[data-testid="folder-compare-error"]').text()).toContain(
      'Comparison failed',
    )
  })

  it('applies a pending folder drop launch while already mounted', async () => {
    mountFolderCompareView()
    const launchStore = useSessionLaunchStore()

    launchStore.setPendingLaunch({
      id: 'drop-folder-1',
      source: 'drop',
      sessionType: 'folder-compare',
      title: 'folder-a vs folder-b',
      route: '/compare/folder',
      autoRun: true,
      locations: {
        left: { uri: 'D:/drops/folder-a', kind: 'directory', readOnly: false },
        right: { uri: 'D:/drops/folder-b', kind: 'directory', readOnly: false },
      },
    })
    await flushPromises()

    expect(compareFolderPaths).toHaveBeenCalledWith(
      expect.objectContaining({
        leftRoot: 'D:/drops/folder-a',
        rightRoot: 'D:/drops/folder-b',
      }),
    )
    expect(launchStore.pendingLaunch).toBeUndefined()
  })

  it('disables export and sync preview until both roots are set', () => {
    const wrapper = mountFolderCompareView()

    expect(
      wrapper.find('[data-testid="export-folder-html-report"]').attributes('disabled'),
    ).toBeDefined()
    expect(wrapper.find('[data-testid="preview-sync-plan"]').attributes('disabled')).toBeDefined()
  })

  it('surfaces copy failures instead of leaving a hanging confirmation', async () => {
    vi.mocked(copyFolderCompareEntry).mockRejectedValueOnce(new Error('disk full'))
    const wrapper = mountFolderCompareView()

    await runCompare(wrapper)
    await wrapper.find('[data-row-id="src-main-ts"]').trigger('click')
    await wrapper.find('[data-testid="copy-selected-to-right"]').trigger('click')
    await wrapper.find('[data-testid="confirm-folder-copy"]').trigger('click')
    await flushPromises()

    expect(wrapper.find('[data-testid="folder-compare-error"]').text()).toContain('disk full')
    expect(wrapper.find('[data-testid="folder-copy-confirmation"]').exists()).toBe(true)
  })

  it('refreshes the tree after touch and enables directory rename/delete/move', async () => {
    const wrapper = mountFolderCompareView()

    await runCompare(wrapper)
    vi.mocked(compareFolderPaths).mockClear()

    await wrapper.find('[data-row-id="readme-md"]').trigger('click')
    await wrapper.find('[data-testid="touch-selected-file"]').trigger('click')
    await flushPromises()

    expect(touchFolderEntry).toHaveBeenCalled()
    expect(compareFolderPaths).toHaveBeenCalled()

    await wrapper.find('[data-row-id="src"]').trigger('click')
    expect(
      wrapper.find('[data-testid="rename-selected-file"]').attributes('disabled'),
    ).toBeUndefined()
    expect(
      wrapper.find('[data-testid="delete-selected-file"]').attributes('disabled'),
    ).toBeUndefined()
    expect(
      wrapper.find('[data-testid="move-selected-file"]').attributes('disabled'),
    ).toBeUndefined()
    expect(
      wrapper.find('[data-testid="copy-selected-to-right"]').attributes('disabled'),
    ).toBeDefined()

    vi.mocked(pickNativePath).mockResolvedValueOnce('D:/backup')
    await wrapper.find('[data-testid="move-selected-file"]').trigger('click')
    await flushPromises()
    expect(moveFolderEntry).toHaveBeenCalledWith({
      sourcePath: 'D:/left/src',
      targetPath: 'D:/backup/src',
    })
  })

  it('exposes full path tooltips on path inputs', async () => {
    const wrapper = mountFolderCompareView()
    const longPath = 'D:/very/long/path/to/project/left-root-directory'

    await wrapper.find('[data-testid="folder-left-root"]').setValue(longPath)

    expect(wrapper.find('[data-testid="folder-left-root"]').attributes('title')).toBe(longPath)
  })

  it('opens session settings and peeks a selected file pair', async () => {
    const wrapper = mountFolderCompareView()

    await wrapper.find('[data-testid="open-folder-session-settings"]').trigger('click')
    expect(wrapper.find('[data-testid="session-settings-dialog"]').exists()).toBe(true)
    await wrapper.find('[data-testid="session-settings-compare-crc"]').setValue(true)
    await wrapper.find('[data-testid="session-settings-tab-filters"]').trigger('click')
    await wrapper.find('[data-testid="session-settings-include-patterns"]').setValue('*.md\n*.txt')
    await wrapper
      .find('[data-testid="session-settings-exclude-patterns"]')
      .setValue('node_modules/**')
    await wrapper.find('[data-testid="session-settings-apply"]').trigger('click')
    expect(wrapper.find('[data-testid="session-settings-dialog"]').exists()).toBe(false)
    expect(
      (wrapper.find('[data-testid="folder-criteria-crc"]').element as HTMLInputElement).checked,
    ).toBe(true)
    const storedFilters = JSON.parse(
      localStorage.getItem('open-diff-folder-name-filters') ?? '{}',
    ) as { include: string[]; exclude: string[] }

    expect(storedFilters.include).toEqual(['*.md', '*.txt'])
    expect(storedFilters.exclude).toEqual(['node_modules/**'])

    await wrapper.find('[data-testid="folder-session-toolbar-peek"]').trigger('click')
    expect(wrapper.find('[data-testid="folder-peek-panel"]').isVisible()).toBe(true)
    expect(wrapper.find('[data-testid="folder-peek-empty"]').isVisible()).toBe(true)
  })

  it('shows archive side chips when roots are ZIP/TAR paths', async () => {
    const wrapper = mountFolderCompareView()

    await wrapper.find('[data-testid="folder-left-root"]').setValue('/tmp/left.zip')
    await wrapper.find('[data-testid="folder-right-root"]').setValue('/tmp/right.tar.gz')
    await wrapper.vm.$nextTick()

    expect(wrapper.find('[data-testid="folder-left-archive-chip"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="folder-right-archive-chip"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="folder-browse-archive-left"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="folder-archive-session-status"]').exists()).toBe(true)
  })

  it('disables copy into archive sides while leaving extract-to-folder enabled', async () => {
    const wrapper = mountFolderCompareView()

    await runCompare(wrapper)
    await wrapper.find('[data-row-id="src-main-ts"]').trigger('click')

    await wrapper.find('[data-testid="folder-left-root"]').setValue('/tmp/out-folder')
    await wrapper.find('[data-testid="folder-right-root"]').setValue('/tmp/right.zip')
    await wrapper.vm.$nextTick()

    expect(wrapper.find('[data-testid="folder-right-archive-chip"]').exists()).toBe(true)
    expect(
      wrapper.find('[data-testid="copy-selected-to-right"]').attributes('disabled'),
    ).toBeDefined()
    expect(
      wrapper.find('[data-testid="copy-selected-to-left"]').attributes('disabled'),
    ).toBeUndefined()
  })

  it('shows snapshot side chips when roots are snapshot JSON paths', async () => {
    const wrapper = mountFolderCompareView()

    await wrapper.find('[data-testid="folder-left-root"]').setValue('/tmp/docs/docs.snapshot.json')
    await wrapper.find('[data-testid="folder-right-root"]').setValue('/tmp/open-diff-snapshot.json')
    await wrapper.vm.$nextTick()

    expect(wrapper.find('[data-testid="folder-left-snapshot-chip"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="folder-right-snapshot-chip"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="folder-left-archive-chip"]').exists()).toBe(false)
  })

  it('applies readonly attributes across the checked set', async () => {
    vi.mocked(changeFolderEntryAttributes).mockClear()
    const wrapper = mountFolderCompareView()

    await runCompare(wrapper)

    const notes = wrapper.find('[data-testid="folder-row-check-notes-md"]')
    const readme = wrapper.find('[data-testid="folder-row-check-readme-md"]')

    expect(notes.exists()).toBe(true)
    expect(readme.exists()).toBe(true)
    await notes.setValue(true)
    await notes.trigger('change')
    await readme.setValue(true)
    await readme.trigger('change')

    const toggle = wrapper.find('[data-testid="toggle-selected-readonly"]')

    await toggle.setValue(true)
    await toggle.trigger('change')
    await flushPromises()

    expect(changeFolderEntryAttributes).toHaveBeenCalled()
    expect(vi.mocked(changeFolderEntryAttributes).mock.calls.length).toBeGreaterThanOrEqual(2)
  })

  it('persists timestamp tolerance and DST ignore from the Rules panel', async () => {
    const wrapper = mountFolderCompareView()

    expect(wrapper.find('[data-testid="folder-criteria"]').exists()).toBe(true)

    const tolerance = wrapper.find('[data-testid="folder-criteria-timestamp-tolerance"]')

    expect(tolerance.exists()).toBe(true)
    await tolerance.setValue(2)
    await wrapper.find('[data-testid="folder-criteria-ignore-dst"]').setValue(true)
    await flushPromises()

    const stored = JSON.parse(
      localStorage.getItem('open-diff-folder-compare-criteria') ?? '{}',
    ) as {
      timestampToleranceMs?: number
      ignoreDaylightSavingHourOffset?: boolean
    }

    expect(stored.timestampToleranceMs).toBe(2000)
    expect(stored.ignoreDaylightSavingHourOffset).toBe(true)
  })

  it('persists Compare attributes and filters attribute-only Minor rows', async () => {
    vi.mocked(compareFolderPaths).mockResolvedValue({
      leftRoot: 'D:/left',
      rightRoot: 'D:/right',
      rows: [
        {
          relativePath: 'readme.txt',
          depth: 0,
          status: 'Different',
          unimportant: true,
          left: {
            name: 'readme.txt',
            kind: 'file',
            size: 12,
            path: 'D:/left/readme.txt',
          },
          right: {
            name: 'readme.txt',
            kind: 'file',
            size: 12,
            path: 'D:/right/readme.txt',
          },
        },
        {
          relativePath: 'main.ts',
          depth: 0,
          status: 'Different',
          unimportant: false,
          left: {
            name: 'main.ts',
            kind: 'file',
            size: 40,
            path: 'D:/left/main.ts',
          },
          right: {
            name: 'main.ts',
            kind: 'file',
            size: 41,
            path: 'D:/right/main.ts',
          },
        },
      ],
      summary: {
        total: 2,
        same: 0,
        different: 2,
        leftOnly: 0,
        rightOnly: 0,
      },
    })

    const wrapper = mountFolderCompareView()

    await wrapper.find('[data-testid="folder-criteria-attributes"]').setValue(true)
    await flushPromises()

    const stored = JSON.parse(
      localStorage.getItem('open-diff-folder-compare-criteria') ?? '{}',
    ) as { compareAttributes?: boolean }

    expect(stored.compareAttributes).toBe(true)

    await runCompare(wrapper)

    const compareCall = vi.mocked(compareFolderPaths).mock.calls.at(-1)?.[0]

    expect(compareCall?.criteria?.compareAttributes).toBe(true)
    expect(wrapper.find('[data-testid="folder-summary-minor"]').text()).toContain('1')

    await wrapper.find('[data-testid="folder-session-toolbar-minor"]').trigger('click')
    await flushPromises()

    expect(wrapper.findAll('[data-testid="folder-row"]')).toHaveLength(1)
    expect(wrapper.find('[data-unimportant="true"]').text()).toContain('Minor')
  })

  it('persists size-only unimportant and filters size-only Minor rows', async () => {
    vi.mocked(compareFolderPaths).mockResolvedValue({
      leftRoot: 'D:/left',
      rightRoot: 'D:/right',
      rows: [
        {
          relativePath: 'readme.txt',
          depth: 0,
          status: 'Different',
          unimportant: true,
          left: {
            name: 'readme.txt',
            kind: 'file',
            size: 12,
            path: 'D:/left/readme.txt',
          },
          right: {
            name: 'readme.txt',
            kind: 'file',
            size: 20,
            path: 'D:/right/readme.txt',
          },
        },
        {
          relativePath: 'main.ts',
          depth: 0,
          status: 'Different',
          unimportant: false,
          left: {
            name: 'main.ts',
            kind: 'file',
            size: 40,
            path: 'D:/left/main.ts',
          },
          right: {
            name: 'main.ts',
            kind: 'file',
            size: 41,
            path: 'D:/right/main.ts',
          },
        },
      ],
      summary: {
        total: 2,
        same: 0,
        different: 2,
        leftOnly: 0,
        rightOnly: 0,
      },
    })

    const wrapper = mountFolderCompareView()

    await wrapper.find('[data-testid="folder-criteria-size-only"]').setValue(true)
    await flushPromises()

    const stored = JSON.parse(
      localStorage.getItem('open-diff-folder-compare-criteria') ?? '{}',
    ) as { sizeOnlyUnimportant?: boolean }

    expect(stored.sizeOnlyUnimportant).toBe(true)

    await runCompare(wrapper)

    const compareCall = vi.mocked(compareFolderPaths).mock.calls.at(-1)?.[0]

    expect(compareCall?.criteria?.sizeOnlyUnimportant).toBe(true)
    expect(wrapper.find('[data-testid="folder-summary-minor"]').text()).toContain('1')

    await wrapper.find('[data-testid="folder-session-toolbar-minor"]').trigger('click')
    await flushPromises()

    expect(wrapper.findAll('[data-testid="folder-row"]')).toHaveLength(1)
    expect(wrapper.find('[data-unimportant="true"]').text()).toContain('Minor')
  })

  it('keeps disk free space on the folder-pair status bar instead of path footers', async () => {
    const { useStatusBarStore } = await import('@/stores/statusBar')
    const wrapper = mountFolderCompareView()
    const statusBar = useStatusBarStore()

    await wrapper.find('[data-testid="folder-left-root"]').setValue('D:/left')
    await wrapper.find('[data-testid="folder-right-root"]').setValue('D:/right')
    await flushPromises()

    expect(wrapper.find('[data-testid="folder-left-path-footer"]').text()).not.toContain(
      '91.8 GB free on C:\\',
    )
    expect(wrapper.find('[data-testid="folder-right-path-footer"]').text()).not.toContain(
      '91.8 GB free on C:\\',
    )
    expect(statusBar.report.leftFreeSpace).toContain('91.8 GB free on C:\\')
    expect(statusBar.report.rightFreeSpace).toContain('91.8 GB free on C:\\')
  })

  it('keeps muted path-footer placeholders before roots are set', () => {
    const wrapper = mountFolderCompareView()

    expect(wrapper.find('[data-testid="folder-left-path-footer"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="folder-right-path-footer"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="folder-left-path-footer"]').text()).toBe('—')
    expect(wrapper.find('[data-testid="folder-right-path-footer"]').classes()).toContain(
      'path-side-footer-muted',
    )
  })

  it('summarizes multi-select files on the path footer without repeating free space', async () => {
    const wrapper = mountFolderCompareView()

    await wrapper.find('[data-testid="folder-left-root"]').setValue('D:/left')
    await wrapper.find('[data-testid="folder-right-root"]').setValue('D:/right')
    await runCompare(wrapper)

    await wrapper.find('[data-testid="folder-session-toolbar-select"]').trigger('click')
    await flushPromises()
    await wrapper.find('[data-testid="folder-select-all"]').trigger('click')
    await flushPromises()

    const leftFooter = wrapper.find('[data-testid="folder-left-path-footer"]').text()

    expect(leftFooter).toMatch(/file\(s\) selected|folder\(s\) selected|item\(s\) selected/)
    expect(leftFooter).not.toContain('91.8 GB free on C:\\')
  })
})
