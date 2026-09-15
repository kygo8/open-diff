import { flushPromises, mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import VersionCompareView from './VersionCompareView.vue'
import { compareVersionFiles, saveTextFile } from '@/api/diff'
import { useSessionLaunchStore } from '@/stores/sessionLaunch'
import { useTabsStore } from '@/stores/tabs'

const clipboardWriteText = vi.fn<(text: string) => Promise<void>>().mockResolvedValue(undefined)

vi.mock('vue-router', () => ({
  useRouter: () => ({ push: vi.fn() }),
}))

vi.mock('@/api/diff', () => ({
  pathFileStamp: vi.fn().mockResolvedValue({
    size: 128,
    modifiedAtMs: Date.UTC(2026, 0, 15, 8, 30),
  }),
  saveTextFile: vi.fn().mockResolvedValue({
    path: 'C:/apps/version-compare.txt',
    bytesWritten: 64,
  }),
  compareVersionFiles: vi.fn().mockResolvedValue({
    left: {
      name: 'fixture-left.exe',
      fileType: 'Application',
      targetOs: 'Windows 32-bit',
      fileVersion: '1.0.0.0',
      productVersion: '1.0.0.0',
    },
    right: {
      name: 'fixture-right.exe',
      fileType: 'Application',
      targetOs: 'Windows 32-bit',
      fileVersion: '1.1.0.0',
      productVersion: '1.0.0.0',
    },
    fields: [
      {
        field: 'FileVersion',
        group: 'Fixed Info',
        left: '1.0.0.0',
        right: '1.1.0.0',
        status: 'modified',
      },
      {
        field: 'CompanyName',
        group: 'String Info',
        left: 'Open Diff',
        right: 'Open Diff',
        status: 'unchanged',
      },
      {
        field: 'Comments',
        group: 'String Info',
        left: 'alpha',
        right: 'beta',
        status: 'modified',
      },
    ],
    summary: {
      added: 0,
      removed: 0,
      modified: 2,
      unchanged: 1,
    },
  }),
}))

describe('VersionCompareView', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    localStorage.clear()
    vi.mocked(compareVersionFiles).mockClear()
    vi.mocked(saveTextFile).mockClear()
    clipboardWriteText.mockClear()
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: {
        writeText: clipboardWriteText,
      },
    })
  })

  it('runs a real version comparison request and renders returned fields', async () => {
    const wrapper = mount(VersionCompareView)

    await wrapper.find('[data-testid="version-left-path"]').setValue('C:/apps/fixture-left.exe')
    await wrapper.find('[data-testid="version-right-path"]').setValue('C:/apps/fixture-right.exe')
    await wrapper.find('[data-testid="run-version-compare"]').trigger('click')
    await wrapper.vm.$nextTick()

    expect(compareVersionFiles).toHaveBeenCalledWith({
      leftPath: 'C:/apps/fixture-left.exe',
      rightPath: 'C:/apps/fixture-right.exe',
    })
    expect(wrapper.text()).toContain('fixture-left.exe')
    expect(wrapper.text()).toContain('fixture-right.exe')
    expect(wrapper.find('[data-testid="version-summary-modified"]').text()).toContain('2')
    expect(wrapper.find('[data-testid="version-summary-minor"]').text()).toContain('1')
    expect(wrapper.find('[data-testid="version-field-FileVersion"]').text()).toContain('1.1.0.0')
  })

  it('runs automatically from dropped version launch paths', async () => {
    useSessionLaunchStore().setPendingLaunch({
      id: 'launch-version',
      source: 'drop',
      sessionType: 'version-compare',
      title: 'left.exe vs right.exe',
      route: '/compare/version',
      autoRun: true,
      locations: {
        left: { uri: 'C:/drop/left.exe', kind: 'file', readOnly: false },
        right: { uri: 'C:/drop/right.exe', kind: 'file', readOnly: false },
      },
    })

    mount(VersionCompareView)
    await Promise.resolve()

    expect(compareVersionFiles).toHaveBeenCalledWith({
      leftPath: 'C:/drop/left.exe',
      rightPath: 'C:/drop/right.exe',
    })
  })

  it('starts empty without demo version resources', () => {
    const wrapper = mount(VersionCompareView)

    expect(wrapper.find('.workbench-shell').exists()).toBe(true)
    expect(wrapper.find('[data-testid="version-session-toolbar-bar"]').exists()).toBe(true)
    expect(wrapper.text()).toContain('Version Compare')
    expect(wrapper.text()).not.toContain('left-app.exe')
    expect(wrapper.find('[data-testid="version-summary-modified"]').text()).toContain('0')
    expect(wrapper.find('[data-testid="version-session-toolbar-home"]').exists()).toBe(true)
    expect(
      wrapper.find('[data-testid="version-session-toolbar-minor"]').attributes('disabled'),
    ).toBeUndefined()
    expect(
      wrapper.find('[data-testid="version-session-toolbar-rules"]').attributes('disabled'),
    ).toBeUndefined()
  })

  it('filters minor differences and toggles importance rules', async () => {
    const wrapper = mount(VersionCompareView)

    await wrapper.find('[data-testid="version-left-path"]').setValue('C:/apps/fixture-left.exe')
    await wrapper.find('[data-testid="version-right-path"]').setValue('C:/apps/fixture-right.exe')
    await wrapper.find('[data-testid="run-version-compare"]').trigger('click')
    await wrapper.vm.$nextTick()

    await wrapper.find('[data-testid="version-session-toolbar-minor"]').trigger('click')
    expect(wrapper.find('[data-testid="version-field-Comments"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="version-field-FileVersion"]').exists()).toBe(false)

    await wrapper.find('[data-testid="version-session-toolbar-rules"]').trigger('click')
    expect(wrapper.find('[data-testid="version-rules-panel"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="version-rule-FileVersion"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="version-rule-LegalCopyright"]').exists()).toBe(true)
    await wrapper.find('[data-testid="version-rule-Comments"] input').setValue(true)
    await wrapper.find('[data-testid="version-session-toolbar-diffs"]').trigger('click')
    expect(wrapper.find('[data-testid="version-field-Comments"]').exists()).toBe(true)

    await wrapper.find('[data-testid="version-rules-reset"]').trigger('click')
    await wrapper.find('[data-testid="version-session-toolbar-minor"]').trigger('click')
    expect(wrapper.find('[data-testid="version-field-Comments"]').exists()).toBe(true)
  })

  it('filters diffs and swaps paths from the toolbar', async () => {
    const wrapper = mount(VersionCompareView)

    await wrapper.find('[data-testid="version-left-path"]').setValue('C:/apps/fixture-left.exe')
    await wrapper.find('[data-testid="version-right-path"]').setValue('C:/apps/fixture-right.exe')
    await wrapper.find('[data-testid="run-version-compare"]').trigger('click')
    await wrapper.vm.$nextTick()

    expect(wrapper.find('[data-testid="version-field-FileVersion"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="version-field-CompanyName"]').exists()).toBe(true)

    await wrapper.find('[data-testid="version-session-toolbar-diffs"]').trigger('click')

    expect(wrapper.find('[data-testid="version-field-FileVersion"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="version-field-Comments"]').exists()).toBe(false)
    expect(wrapper.find('[data-testid="version-field-CompanyName"]').exists()).toBe(false)

    await wrapper.find('[data-testid="version-session-toolbar-swap"]').trigger('click')

    expect(
      (wrapper.find('[data-testid="version-left-path"]').element as HTMLInputElement).value,
    ).toBe('C:/apps/fixture-right.exe')
  })

  it('sets path-pair tab titles for version sessions', async () => {
    const wrapper = mount(VersionCompareView)
    const tabs = useTabsStore()

    tabs.openTab({
      title: 'Version Compare',
      titleKey: 'ui.versionCompare',
      route: '/compare/version',
      dirty: false,
    })

    await wrapper.find('[data-testid="version-left-path"]').setValue('C:/apps/fixture-left.exe')
    await wrapper.find('[data-testid="version-right-path"]').setValue('C:/apps/fixture-right.exe')
    await wrapper.vm.$nextTick()

    expect(tabs.activeTab.title).toBe('fixture-left.exe <--> fixture-right.exe')
  })

  it('updates the minor summary when importance rules change', async () => {
    const wrapper = mount(VersionCompareView)

    await wrapper.find('[data-testid="version-left-path"]').setValue('C:/apps/fixture-left.exe')
    await wrapper.find('[data-testid="version-right-path"]').setValue('C:/apps/fixture-right.exe')
    await wrapper.find('[data-testid="run-version-compare"]').trigger('click')
    await wrapper.vm.$nextTick()

    expect(wrapper.find('[data-testid="version-summary-minor"]').text()).toContain('1')

    await wrapper.find('[data-testid="version-session-toolbar-rules"]').trigger('click')
    await wrapper.find('[data-testid="version-rule-Comments"] input').setValue(true)
    await wrapper.vm.$nextTick()

    expect(wrapper.find('[data-testid="version-summary-minor"]').text()).toContain('0')
  })

  it('shows a readable error when compare invoke rejects an AppErrorPayload', async () => {
    vi.mocked(compareVersionFiles).mockRejectedValueOnce({
      code: 'app.unknown',
      messageKey: 'error.app.unknown.title',
      params: {},
      debugMessage: 'PE resource table missing',
    })

    const wrapper = mount(VersionCompareView)

    await wrapper.find('[data-testid="version-left-path"]').setValue('C:/apps/fixture-left.exe')
    await wrapper.find('[data-testid="version-right-path"]').setValue('C:/apps/fixture-right.exe')
    await wrapper.find('[data-testid="run-version-compare"]').trigger('click')
    await wrapper.vm.$nextTick()
    await Promise.resolve()
    await wrapper.vm.$nextTick()

    const errorEl = wrapper.find('[data-testid="version-compare-error"]')

    expect(errorEl.exists()).toBe(true)
    expect(errorEl.text()).toContain('PE resource table missing')
    expect(errorEl.text()).not.toContain('[object Object]')
  })
})

it('opens rules catalog before compare', async () => {
  const wrapper = mount(VersionCompareView)

  await wrapper.find('[data-testid="version-session-toolbar-rules"]').trigger('click')

  expect(wrapper.find('[data-testid="version-rules-panel"]').exists()).toBe(true)
  expect(wrapper.find('[data-testid="version-rule-FileVersion"]').exists()).toBe(true)
  expect(wrapper.find('[data-testid="version-rule-Comments"]').exists()).toBe(true)
})

it('exports the version report to clipboard and a sibling text file', async () => {
  const wrapper = mount(VersionCompareView)

  await wrapper.find('[data-testid="version-left-path"]').setValue('C:/apps/fixture-left.exe')
  await wrapper.find('[data-testid="version-right-path"]').setValue('C:/apps/fixture-right.exe')
  await wrapper.find('[data-testid="run-version-compare"]').trigger('click')
  await wrapper.vm.$nextTick()

  await wrapper.find('[data-testid="export-version-report"]').trigger('click')
  await wrapper.vm.$nextTick()
  await Promise.resolve()

  expect(clipboardWriteText).toHaveBeenCalled()
  const payload = clipboardWriteText.mock.calls[0]?.[0] ?? ''

  expect(payload).toContain('VERSION-REPORT')
  expect(payload).toContain('left: C:/apps/fixture-left.exe')
  expect(payload).toContain('FileVersion')
  expect(saveTextFile).toHaveBeenCalledWith({
    path: 'C:/apps/version-compare.txt',
    text: payload,
    createBackup: false,
  })
  expect(wrapper.find('[data-testid="version-report-status"]').text()).toBe(
    'C:/apps/version-compare.txt',
  )
})

it('shows size/date path footers after compare', async () => {
  const wrapper = mount(VersionCompareView)

  await wrapper.find('[data-testid="version-left-path"]').setValue('C:/left.bin')
  await wrapper.find('[data-testid="version-right-path"]').setValue('C:/right.bin')
  await wrapper.find('[data-testid="run-version-compare"]').trigger('click')
  await flushPromises()

  expect(wrapper.find('[data-testid="version-path-footers"]').exists()).toBe(true)
  expect(wrapper.find('[data-testid="version-left-path-footer"]').text()).toMatch(/bytes/)
  expect(wrapper.find('[data-testid="version-right-path-footer"]').text()).toMatch(/bytes/)
})
