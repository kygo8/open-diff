import { flushPromises, mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import ReportsScriptView from './ReportsScriptView.vue'
import { exportFolderCompareReport, exportTextCompareReport } from '@/api/diff'
import { runScript } from '@/api/script'
import { reportExportsStorageKey, saveRecentReportExports } from '@/app/reportExports'
import { useLastCompareStore } from '@/stores/lastCompare'

vi.mock('@/api/diff', () => ({
  exportTextCompareReport: vi.fn().mockResolvedValue({
    format: 'html',
    content: '<html></html>',
    outputPath: 'text-compare.html',
    bytesWritten: 13,
  }),
  exportFolderCompareReport: vi.fn().mockResolvedValue({
    format: 'text',
    content: 'folder',
    outputPath: 'folder-compare.txt',
    bytesWritten: 6,
  }),
}))

vi.mock('@/api/script', () => ({
  runScript: vi.fn().mockResolvedValue({
    executed: 4,
    compared: 1,
    different: 1,
    reportsWritten: 1,
    logs: ['wrote report.txt'],
  }),
}))

describe('ReportsScriptView', () => {
  beforeEach(() => {
    localStorage.removeItem(reportExportsStorageKey)
    setActivePinia(createPinia())
    vi.mocked(exportTextCompareReport).mockClear()
    vi.mocked(exportFolderCompareReport).mockClear()
    vi.mocked(runScript).mockClear()
  })

  it('starts with no fake completed jobs', () => {
    const wrapper = mount(ReportsScriptView)

    expect(wrapper.find('[data-testid="report-empty-jobs"]').exists()).toBe(true)
    expect(wrapper.text()).not.toContain('release-folder-diff.md')
    expect(wrapper.text()).not.toContain('D:/workspace/left')
  })

  it('exports the current text compare snapshot when Run is clicked', async () => {
    useLastCompareStore().recordTextCompare({
      left: 'line one',
      right: 'line two',
      leftSource: 'C:/work/left.txt',
      rightSource: 'C:/work/right.txt',
    })

    const wrapper = mount(ReportsScriptView)

    await wrapper.find('[data-testid="fill-last-compare"]').trigger('click')
    await wrapper.find('[data-testid="report-output-path"]').setValue('out.html')
    await wrapper.find('[data-testid="run-report-export"]').trigger('click')
    await flushPromises()

    expect(exportTextCompareReport).toHaveBeenCalledWith(
      expect.objectContaining({
        left: 'line one',
        right: 'line two',
        format: 'html',
        outputPath: 'out.html',
      }),
    )
    expect(wrapper.find('[data-testid="report-export-status"]').text()).toContain(
      'text-compare.html',
    )
    expect(wrapper.find('[data-testid="report-empty-jobs"]').exists()).toBe(false)
  })

  it('exports a folder compare report', async () => {
    const wrapper = mount(ReportsScriptView)

    await wrapper.find('[data-testid="report-kind"]').setValue('folder')
    await wrapper.find('[data-testid="report-format"]').setValue('text')
    await wrapper.find('[data-testid="report-left-path"]').setValue('D:/left')
    await wrapper.find('[data-testid="report-right-path"]').setValue('D:/right')
    await wrapper.find('[data-testid="run-report-export"]').trigger('click')
    await flushPromises()

    expect(exportFolderCompareReport).toHaveBeenCalledWith({
      leftRoot: 'D:/left',
      rightRoot: 'D:/right',
      format: 'text',
      outputPath: 'folder-compare.txt',
    })
  })

  it('lists recently persisted exports instead of demo jobs', () => {
    saveRecentReportExports([
      {
        name: 'folder-compare.html',
        type: 'HTML',
        stateKey: 'ui.completed',
        target: '/tmp/folder-compare.html',
        createdAt: '2026-09-06T00:00:00.000Z',
      },
    ])

    const wrapper = mount(ReportsScriptView)

    expect(wrapper.find('[data-testid="report-empty-jobs"]').exists()).toBe(false)
    expect(wrapper.text()).toContain('folder-compare.html')
    expect(wrapper.text()).toContain('/tmp/folder-compare.html')
    expect(wrapper.text()).not.toContain('release-folder-diff.md')
  })

  it('runs a script from the editor', async () => {
    const wrapper = mount(ReportsScriptView)

    await wrapper.find('[data-testid="script-path"]').setValue('C:/work/job.open-diff-script')
    await wrapper
      .find('[data-testid="script-source"]')
      .setValue('load left.txt\nload right.txt\ncompare\ntext-report out.txt\n')
    await wrapper.find('[data-testid="run-script"]').trigger('click')
    await flushPromises()

    expect(runScript).toHaveBeenCalledWith({
      source: 'load left.txt\nload right.txt\ncompare\ntext-report out.txt\n',
      path: 'C:/work/job.open-diff-script',
    })
    expect(wrapper.find('[data-testid="script-result"]').text()).toContain('reports=1')
    expect(wrapper.find('[data-testid="script-result"]').text()).toContain('wrote report.txt')
  })

  it('shows honest supported and unsupported script command lists', () => {
    const wrapper = mount(ReportsScriptView)

    expect(wrapper.find('[data-testid="script-command-lists"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="script-supported-commands"]').text()).toContain('HEX-REPORT')
    expect(wrapper.find('[data-testid="script-supported-commands"]').text()).toContain(
      'TABLE-REPORT',
    )
    expect(wrapper.find('[data-testid="script-supported-commands"]').text()).toContain(
      'MEDIA-REPORT',
    )
    expect(wrapper.find('[data-testid="script-supported-commands"]').text()).toContain('ATTRIB')
    expect(wrapper.find('[data-testid="script-supported-commands"]').text()).toContain('MOVETO')
    expect(wrapper.find('[data-testid="script-supported-commands"]').text()).toContain('CRITERIA')
    expect(wrapper.find('[data-testid="script-unsupported-commands"]').text()).not.toContain(
      'CRITERIA',
    )
    expect(wrapper.find('[data-testid="script-unsupported-commands"]').text()).not.toContain(
      'MEDIA-REPORT',
    )
    expect(wrapper.text()).not.toMatch(/Beyond Compare|\bBC5?\b|Scooter/i)
  })

  it('offers csv as a report export format', () => {
    const wrapper = mount(ReportsScriptView)

    const options = wrapper
      .find('[data-testid="report-format"]')
      .findAll('option')
      .map((option) => (option.element as HTMLOptionElement).value)

    expect(options).toContain('csv')
    expect(options).toContain('markdown')
  })
})
