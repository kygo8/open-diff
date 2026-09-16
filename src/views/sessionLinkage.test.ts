import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { InvokeArgs } from '@tauri-apps/api/core'
import { invokeArgs, invokeCalls, lastInvoke, resetInvokeCalls } from '@/test/invokeMock'
import HomeView from './HomeView.vue'
import TextCompareView from './TextCompareView.vue'
import TextMergeView from './TextMergeView.vue'
import FolderCompareView from './FolderCompareView.vue'
import FolderSyncView from './FolderSyncView.vue'
import FolderMergeView from './FolderMergeView.vue'
import TableCompareView from './TableCompareView.vue'
import HexCompareView from './HexCompareView.vue'
import PictureCompareView from './PictureCompareView.vue'
import RegistryCompareView from './RegistryCompareView.vue'
import MediaCompareView from './MediaCompareView.vue'
import VersionCompareView from './VersionCompareView.vue'
import TextEditView from './TextEditView.vue'
import TextPatchView from './TextPatchView.vue'
import ClipboardCompareView from './ClipboardCompareView.vue'
import SettingsView from './SettingsView.vue'
import RemoteProfileView from './RemoteProfileView.vue'
import ReportsScriptView from './reports/ReportsScriptView.vue'
import { readClipboardTextSource } from '@/app/clipboardSource'

vi.mock('@tauri-apps/api/core', async () => {
  const helper = await import('@/test/invokeMock')

  return {
    convertFileSrc: (path: string) => path,
    invoke: vi.fn((command: string, args: Record<string, unknown> = {}) => {
      helper.invokeCalls.push({ command, args })

      return Promise.resolve(helper.invokeResponse(command, args))
    }),
  }
})

vi.mock('vue-router', () => ({
  useRouter: () => ({ push: vi.fn() }),
}))

vi.mock('@/app/clipboardSource', () => ({
  readClipboardTextSource: vi.fn().mockResolvedValue({
    kind: 'clipboard-text',
    title: 'Clipboard Text',
    text: 'clipboard captured',
  }),
}))

const nButtonStub = {
  props: ['disabled', 'loading'],
  emits: ['click'],
  template: '<button :disabled="disabled" @click="$emit(\'click\')"><slot /></button>',
}

const nInputStub = {
  props: ['value'],
  emits: ['update:value'],
  template: '<input :value="value" @input="$emit(\'update:value\', $event.target.value)" />',
}

const viewStubs = {
  NButton: nButtonStub,
  NInput: nInputStub,
  NAlert: { template: '<div><slot /></div>' },
  NCard: { props: ['title'], template: '<section><h2>{{ title }}</h2><slot /></section>' },
  NSpace: { template: '<div><slot /></div>' },
  NSelect: {
    props: ['value', 'options'],
    emits: ['update:value'],
    template:
      '<select :value="value" @change="$emit(\'update:value\', $event.target.value)"><slot /></select>',
  },
  NRadioGroup: {
    props: ['value'],
    emits: ['update:value'],
    template: '<div><slot /></div>',
  },
  NRadioButton: {
    props: ['value'],
    template:
      '<button type="button" @click="$parent.$emit(\'update:value\', value)"><slot /></button>',
  },
  TextDiffPanel: { template: '<section data-testid="text-diff-panel-stub" />' },
}

function mountView(component: object): VueWrapper {
  return mount(component, {
    global: {
      stubs: viewStubs,
    },
  })
}

function expectCommand(command: string, args?: Record<string, unknown>): void {
  const call = lastInvoke(command)

  expect(call?.command, `missing invoke('${command}')`).toBe(command)

  if (args) {
    expect(call?.args).toMatchObject(args)
  }
}

function assertNoDemoData(wrapper: VueWrapper): void {
  const text = wrapper.text()

  expect(text).not.toContain('generated-')
  expect(text).not.toMatch(/generated-\d+\.log/)
  expect(text).not.toContain('line one')
  expect(text).not.toContain('line two')
  expect(text).not.toContain('timeout = 45')
  expect(text).not.toContain('Studio A')
  expect(text).not.toContain('1.4.2')
  expect(text).not.toContain('D:\\workspace')
}

describe('session UI to command linkage', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    resetInvokeCalls()
    vi.mocked(readClipboardTextSource).mockClear()
  })

  it('home catalog opens implemented sessions without demo trees', () => {
    const wrapper = mountView(HomeView)

    assertNoDemoData(wrapper)
    expect(wrapper.findAll('[data-testid="home-new-session-card"]').length).toBeGreaterThan(0)
    expect(wrapper.text()).not.toContain('Compare sample text')
    expect(wrapper.text()).not.toContain('Config updated')
    expect(wrapper.text()).not.toContain('Release v1.2')
    // BC5 Home center grid: Text Edit (not Text Patch / Clipboard Compare).
    expect(wrapper.find('[data-session-type="text-edit"]').exists()).toBe(true)
    expect(wrapper.find('[data-session-type="folder-compare"]').exists()).toBe(true)
    expect(wrapper.find('[data-session-type="text-patch"]').exists()).toBe(false)
    expect(wrapper.find('[data-session-type="clipboard-compare"]').exists()).toBe(false)
    expect(wrapper.find('[data-testid="home-edit-selected"]').attributes('disabled')).toBeDefined()
    expect(invokeCalls).toEqual([])
  })

  it('text compare forwards ignore flags through invoke', async () => {
    const wrapper = mountView(TextCompareView)

    assertNoDemoData(wrapper)
    expect(wrapper.text()).toContain('Choose left and right paths, then click Compare.')
    expect(wrapper.text()).not.toContain('sample comparison')
    await wrapper.find('[data-testid="ignore-whitespace"]').setValue(true)
    await wrapper.find('[data-testid="ignore-case"]').setValue(true)
    await wrapper.find('[data-testid="ignore-line-endings"]').setValue(true)
    await wrapper.find('[data-testid="ignore-regexes"]').setValue('stamp=\\d+')
    await wrapper.find('[data-testid="run-diff"]').trigger('click')
    await flushPromises()

    expectCommand('diff_text', {
      ignoreWhitespace: true,
      ignoreCase: true,
      ignoreLineEndings: true,
      ignoreRegexes: ['stamp=\\d+'],
    })
  })

  it('text compare load files invokes read_text_file then diff_text', async () => {
    const wrapper = mountView(TextCompareView)

    await wrapper.find('[data-testid="text-left-path"]').setValue('/tmp/left.txt')
    await wrapper.find('[data-testid="text-right-path"]').setValue('/tmp/right.txt')
    await wrapper.find('[data-testid="load-text-files"]').trigger('click')
    await flushPromises()

    expect(invokeCalls.map((call) => call.command)).toEqual([
      'read_text_file',
      'read_text_file',
      'diff_text',
    ])
    expect(invokeArgs('read_text_file').path).toBe('/tmp/right.txt')
  })

  it('text merge loads files through merge_text_files', async () => {
    const wrapper = mountView(TextMergeView)

    assertNoDemoData(wrapper)
    await wrapper.find('[data-testid="merge-left-path"]').setValue('/tmp/left.txt')
    await wrapper.find('[data-testid="merge-center-path"]').setValue('/tmp/base.txt')
    await wrapper.find('[data-testid="merge-right-path"]').setValue('/tmp/right.txt')
    await wrapper.find('[data-testid="merge-output-path"]').setValue('/tmp/out.txt')
    await wrapper.find('[data-testid="load-text-merge"]').trigger('click')
    await flushPromises()

    expectCommand('merge_text_files', {
      leftPath: '/tmp/left.txt',
      rightPath: '/tmp/right.txt',
      centerPath: '/tmp/base.txt',
      outputPath: '/tmp/out.txt',
    })
    expect(wrapper.text()).not.toContain('timeout = 45')
  })

  it('folder compare forwards criteria and keeps unimplemented actions disabled', async () => {
    const wrapper = mountView(FolderCompareView)

    assertNoDemoData(wrapper)
    await wrapper.find('[data-testid="folder-left-root"]').setValue('/tmp/left')
    await wrapper.find('[data-testid="folder-right-root"]').setValue('/tmp/right.zip')
    await wrapper.find('[data-testid="run-folder-compare"]').trigger('click')
    await flushPromises()

    expectCommand('compare_folder_paths', {
      leftRoot: '/tmp/left',
      rightRoot: '/tmp/right.zip',
      criteria: {
        compareSize: true,
        compareModifiedTime: false,
        compareContents: true,
        compareCrc: false,
      },
    })
    expect(
      wrapper.find('[data-testid="open-with-selected-file"]').attributes('disabled'),
    ).toBeDefined()
    expect(
      wrapper.find('[data-testid="align-with-selected-file"]').attributes('disabled'),
    ).toBeDefined()

    await wrapper.find('[data-testid="preview-sync-plan"]').trigger('click')
    await flushPromises()
    await wrapper.find('[data-testid="run-sync-preview"]').trigger('click')
    await flushPromises()

    expectCommand('execute_folder_sync', {
      leftRoot: '/tmp/left',
      rightRoot: '/tmp/right.zip',
      strategy: 'updateRight',
    })
  })

  it('folder sync previews and executes through invoke', async () => {
    const wrapper = mountView(FolderSyncView)

    assertNoDemoData(wrapper)
    await wrapper.find('[data-testid="folder-sync-left-path"]').setValue('/tmp/left')
    await wrapper.find('[data-testid="folder-sync-right-path"]').setValue('/tmp/right')
    await wrapper.find('[data-testid="folder-sync-preview"]').trigger('click')
    await flushPromises()

    expectCommand('preview_folder_sync', {
      leftRoot: '/tmp/left',
      rightRoot: '/tmp/right',
      strategy: 'updateBoth',
    })

    await wrapper.find('[data-testid="folder-sync-accept"]').trigger('click')
    await wrapper.find('[data-testid="folder-sync-run"]').trigger('click')
    expect(wrapper.find('[data-testid="folder-sync-safety-confirmation"]').exists()).toBe(true)
    await wrapper.find('[data-testid="folder-sync-confirm-safety"]').trigger('click')
    await flushPromises()

    expectCommand('execute_folder_sync', {
      leftRoot: '/tmp/left',
      rightRoot: '/tmp/right',
      strategy: 'updateBoth',
    })
    expect(invokeArgs('execute_folder_sync').overrides).toEqual(expect.any(Array))
  })

  it('folder merge plans and executes with real path arguments', async () => {
    const wrapper = mountView(FolderMergeView)

    assertNoDemoData(wrapper)
    await wrapper.find('[data-testid="folder-merge-left-path"]').setValue('/tmp/left')
    await wrapper.find('[data-testid="folder-merge-base-path"]').setValue('/tmp/base')
    await wrapper.find('[data-testid="folder-merge-right-path"]').setValue('/tmp/right')
    await wrapper.find('[data-testid="folder-merge-output-path"]').setValue('/tmp/out')
    await wrapper.find('[data-testid="folder-merge-build-plan"]').trigger('click')
    await flushPromises()

    expectCommand('build_folder_merge_plan', {
      leftRoot: '/tmp/left',
      baseRoot: '/tmp/base',
      rightRoot: '/tmp/right',
      outputRoot: '/tmp/out',
    })

    await wrapper.find('[data-testid="folder-merge-execute-plan"]').trigger('click')
    await flushPromises()

    expectCommand('execute_folder_merge_plan', {
      leftRoot: '/tmp/left',
      baseRoot: '/tmp/base',
      rightRoot: '/tmp/right',
      outputRoot: '/tmp/out',
    })
  })

  it('table compare invokes compare_table with format and key columns', async () => {
    const wrapper = mountView(TableCompareView)

    assertNoDemoData(wrapper)
    await wrapper.find('[data-testid="table-left-path"]').setValue('/tmp/left.csv')
    await wrapper.find('[data-testid="table-right-path"]').setValue('/tmp/right.csv')
    await wrapper.find('[data-testid="table-format"]').setValue('csv')
    await wrapper.find('[data-testid="table-key-columns"]').setValue('0')
    await wrapper.find('[data-testid="run-table-compare"]').trigger('click')
    await flushPromises()

    expectCommand('compare_table', {
      format: 'csv',
      leftPath: '/tmp/left.csv',
      rightPath: '/tmp/right.csv',
      keyColumnIndices: [0],
    })
  })

  it('hex compare starts empty and forwards offset/length', async () => {
    const wrapper = mountView(HexCompareView)

    expect(wrapper.findAll('[data-testid="hex-row"]')).toHaveLength(0)
    expect(wrapper.text()).not.toMatch(/\bABCD\b/)
    await wrapper.find('[data-testid="hex-left-path"]').setValue('/tmp/left.bin')
    await wrapper.find('[data-testid="hex-right-path"]').setValue('/tmp/right.bin')
    await wrapper.find('[data-testid="hex-offset"]').setValue('2')
    await wrapper.find('[data-testid="hex-length"]').setValue('16')
    await wrapper.find('[data-testid="run-hex-compare"]').trigger('click')
    await flushPromises()

    expectCommand('compare_hex_files', {
      leftPath: '/tmp/left.bin',
      rightPath: '/tmp/right.bin',
      offset: 2,
      length: 16,
    })
  })

  it('picture compare forwards tolerance and does not invent overlay RGB', async () => {
    const wrapper = mountView(PictureCompareView)

    expect(wrapper.find('[data-testid="picture-diff-overlay"]').exists()).toBe(false)
    await wrapper.find('[data-testid="picture-left-path"]').setValue('/tmp/left.png')
    await wrapper.find('[data-testid="picture-right-path"]').setValue('/tmp/right.png')
    await wrapper.find('[data-testid="run-picture-compare"]').trigger('click')
    await flushPromises()

    expectCommand('compare_picture_files', {
      leftPath: '/tmp/left.png',
      rightPath: '/tmp/right.png',
      rgbTolerance: 0,
      compareAlpha: true,
    })
    await wrapper.find('[data-testid="right-picture-image"]').trigger('mousemove', {
      clientX: 3,
      clientY: 4,
    })
    expect(wrapper.find('[data-testid="picture-pixel-color"]').text()).toBe('rgb(--, --, --)')
  })

  it('registry compare invokes compare_registry_exports for .reg text', async () => {
    const wrapper = mountView(RegistryCompareView)

    assertNoDemoData(wrapper)
    await wrapper.find('[data-testid="registry-left-export"]').setValue('Windows Registry Editor')
    await wrapper.find('[data-testid="registry-right-export"]').setValue('Windows Registry Editor')
    await wrapper.find('[data-testid="run-registry-compare"]').trigger('click')
    await flushPromises()

    expectCommand('compare_registry_exports', {
      left: 'Windows Registry Editor',
      right: 'Windows Registry Editor',
    })
  })

  it('media compare invokes compare_media_files', async () => {
    const wrapper = mountView(MediaCompareView)

    assertNoDemoData(wrapper)
    await wrapper.find('[data-testid="media-left-path"]').setValue('/tmp/left.mp3')
    await wrapper.find('[data-testid="media-right-path"]').setValue('/tmp/right.mp3')
    await wrapper.find('[data-testid="run-media-compare"]').trigger('click')
    await flushPromises()

    expectCommand('compare_media_files', {
      leftPath: '/tmp/left.mp3',
      rightPath: '/tmp/right.mp3',
    })
  })

  it('version compare invokes compare_version_files', async () => {
    const wrapper = mountView(VersionCompareView)

    assertNoDemoData(wrapper)
    expect(wrapper.text()).not.toContain('1.4.2')
    await wrapper.find('[data-testid="version-left-path"]').setValue('/tmp/left.exe')
    await wrapper.find('[data-testid="version-right-path"]').setValue('/tmp/right.exe')
    await wrapper.find('[data-testid="run-version-compare"]').trigger('click')
    await flushPromises()

    expectCommand('compare_version_files', {
      leftPath: '/tmp/left.exe',
      rightPath: '/tmp/right.exe',
    })
  })

  it('text edit opens and saves through read_text_file and save_text_file', async () => {
    const wrapper = mountView(TextEditView)

    assertNoDemoData(wrapper)
    await wrapper.find('[data-testid="text-edit-path"]').setValue('/tmp/note.txt')
    await wrapper.find('[data-testid="text-edit-open"]').trigger('click')
    await flushPromises()

    expectCommand('read_text_file', { path: '/tmp/note.txt' })

    await wrapper.find('[data-testid="text-edit-save"]').trigger('click')
    await flushPromises()

    expectCommand('save_text_file', {
      path: '/tmp/note.txt',
      text: 'loaded:/tmp/note.txt',
      createBackup: true,
    })
  })

  it('text patch applies through apply_text_patch', async () => {
    const wrapper = mountView(TextPatchView)

    assertNoDemoData(wrapper)
    await wrapper.find('[data-testid="patch-source-text"]').setValue('hello')
    await wrapper.find('[data-testid="text-patch-input"]').setValue('--- a\n+++ b\n')
    await wrapper.find('[data-testid="apply-text-patch"]').trigger('click')
    await flushPromises()

    expectCommand('apply_text_patch', {
      source: 'hello',
    })
    expect(String(invokeArgs('apply_text_patch').patch)).toContain('+++ b')
  })

  it('clipboard compare captures then diffs through invoke', async () => {
    const wrapper = mountView(ClipboardCompareView)

    assertNoDemoData(wrapper)
    vi.mocked(readClipboardTextSource)
      .mockResolvedValueOnce({
        kind: 'clipboard-text',
        title: 'Clipboard Text',
        text: 'clipboard left',
      })
      .mockResolvedValueOnce({
        kind: 'clipboard-text',
        title: 'Clipboard Text',
        text: 'clipboard right',
      })
    await wrapper.find('[data-testid="clipboard-capture"]').trigger('click')
    await flushPromises()
    await wrapper.find('[data-testid="clipboard-capture"]').trigger('click')
    await flushPromises()
    await wrapper.find('[data-testid="clipboard-compare"]').trigger('click')
    await flushPromises()

    expectCommand('diff_text', {
      left: 'clipboard left',
      right: 'clipboard right',
      algorithm: 'myers',
    })
  })

  it('reports export and script run use export and run_script commands', async () => {
    const wrapper = mountView(ReportsScriptView)

    await wrapper.find('[data-testid="report-left-path"]').setValue('/tmp/left.txt')
    await wrapper.find('[data-testid="report-right-path"]').setValue('/tmp/right.txt')
    await wrapper.find('[data-testid="report-output-path"]').setValue('/tmp/out.html')
    await wrapper.find('[data-testid="run-report-export"]').trigger('click')
    await flushPromises()

    expect(invokeCalls.some((call) => call.command.startsWith('export_'))).toBe(true)

    await wrapper.find('[data-testid="script-source"]').setValue('COMPARE left right')
    await wrapper.find('[data-testid="run-script"]').trigger('click')
    await flushPromises()

    expectCommand('run_script', {
      source: 'COMPARE left right',
    })
  })

  it('remote profiles test connection through test_remote_profile', async () => {
    Object.defineProperty(window, '__TAURI_INTERNALS__', {
      configurable: true,
      value: {},
    })

    const { invoke } = await import('@tauri-apps/api/core')
    const helper = await import('@/test/invokeMock')
    const seeded = {
      id: 'prod-sftp',
      name: 'Prod SFTP',
      protocol: 'sftp' as const,
      host: 'files.example.com',
      port: 22,
      rootPath: '/',
      implemented: true,
      uri: 'sftp://profile/prod-sftp/',
    }

    vi.mocked(invoke).mockImplementation((command: string, args: InvokeArgs = {}) => {
      const recordArgs = args as Record<string, unknown>

      helper.invokeCalls.push({ command, args: recordArgs })

      if (command === 'list_remote_profiles') {
        return Promise.resolve([seeded])
      }

      return Promise.resolve(helper.invokeResponse(command, recordArgs))
    })

    try {
      const wrapper = mountView(RemoteProfileView)

      await flushPromises()
      await wrapper.find('[data-testid="select-remote-profile-prod-sftp"]').trigger('click')
      await wrapper.find('[data-testid="test-remote-profile"]').trigger('click')
      await flushPromises()

      expectCommand('test_remote_profile', { id: 'prod-sftp' })
    } finally {
      Reflect.deleteProperty(window, '__TAURI_INTERNALS__')
      vi.mocked(invoke).mockImplementation((command: string, args: InvokeArgs = {}) => {
        const recordArgs = args as Record<string, unknown>

        helper.invokeCalls.push({ command, args: recordArgs })

        return Promise.resolve(helper.invokeResponse(command, recordArgs))
      })
    }
  })

  it('settings writes git and svn integration through invoke', async () => {
    const wrapper = mountView(SettingsView)

    vi.spyOn(window, 'confirm').mockReturnValue(true)
    await wrapper.find('[data-testid="theme-follow-system"]').trigger('click')
    await wrapper.find('[data-testid="integration-executable-path"]').setValue('/tmp/open-diff')
    await wrapper.find('[data-testid="write-git-config"]').trigger('click')
    await flushPromises()

    expectCommand('write_git_integration', {
      kind: 'mergetool',
      executablePath: '/tmp/open-diff',
      scope: 'global',
    })

    await wrapper.find('[data-testid="svn-wrapper-path"]').setValue('/tmp/svn-diff.sh')
    await wrapper.find('[data-testid="write-svn-config"]').trigger('click')
    await flushPromises()

    expectCommand('write_svn_integration', {
      executablePath: '/tmp/open-diff',
      wrapperPath: '/tmp/svn-diff.sh',
    })
  })
})
