import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { useSettingsStore } from '@/stores/settings'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import TableCompareView from './TableCompareView.vue'
import { compareTable, readTextFile, saveTextFile } from '@/api/diff'
import { useSessionLaunchStore } from '@/stores/sessionLaunch'
import type { TableCompareRequest } from '@/types/diff'

vi.mock('vue-router', () => ({
  useRouter: () => ({ push: vi.fn() }),
}))

const clipboardWriteText = vi.fn<(text: string) => Promise<void>>().mockResolvedValue(undefined)

vi.mock('@/api/diff', () => ({
  saveTextFile: vi.fn().mockResolvedValue({
    path: 'C:/data/table-compare.txt',
    bytesWritten: 48,
  }),
  compareTable: vi.fn().mockResolvedValue({
    leftColumns: [
      { side: 'left', name: 'SKU' },
      { side: 'left', name: 'Quantity' },
    ],
    rightColumns: [
      { side: 'right', name: 'sku' },
      { side: 'right', name: 'Quantity' },
    ],
    columnMappings: [
      { leftColumn: 'SKU', rightColumn: 'sku', source: 'Automatic' },
      { leftColumn: 'Quantity', rightColumn: 'Quantity', source: 'Automatic' },
    ],
    rows: [
      {
        index: 0,
        leftCells: ['A-1', '12'],
        rightCells: ['A-1', '14'],
        status: 'Modified',
      },
    ],
    changedCells: [
      {
        rowIndex: 0,
        columnIndex: 1,
        leftValue: '12',
        rightValue: '14',
        status: 'Modified',
      },
    ],
    summary: {
      rowCount: 1,
      changedRowCount: 1,
      changedCellCount: 1,
    },
    leftSheets: ['Sheet1'],
    rightSheets: ['Sheet1'],
    leftSheet: 'Sheet1',
    rightSheet: 'Sheet1',
  }),
  readTextFile: vi.fn().mockImplementation((path: string) =>
    Promise.resolve({
      path,
      text: path.includes('left') ? 'SKU,Quantity\nA-1,12' : 'sku,Quantity\nA-1,14',
      encoding: 'UTF-8',
      lineEnding: 'LF',
      fileStamp: { size: 20, modifiedAtMs: 1 },
    }),
  ),
}))

function mountTableCompareView(): VueWrapper {
  return mount(TableCompareView, {
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

describe('TableCompareView', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    useSettingsStore().setShowSessionsInToolbar(true)
    localStorage.clear()
    vi.mocked(compareTable).mockReset()
    vi.mocked(compareTable).mockResolvedValue({
      leftColumns: [
        { side: 'left', name: 'SKU' },
        { side: 'left', name: 'Quantity' },
      ],
      rightColumns: [
        { side: 'right', name: 'sku' },
        { side: 'right', name: 'Quantity' },
      ],
      columnMappings: [
        { leftColumn: 'SKU', rightColumn: 'sku', source: 'Automatic' },
        { leftColumn: 'Quantity', rightColumn: 'Quantity', source: 'Automatic' },
      ],
      rows: [
        {
          index: 0,
          leftCells: ['A-1', '12'],
          rightCells: ['A-1', '14'],
          status: 'Modified',
        },
      ],
      changedCells: [
        {
          rowIndex: 0,
          columnIndex: 1,
          leftValue: '12',
          rightValue: '14',
          status: 'Modified',
        },
      ],
      summary: {
        rowCount: 1,
        changedRowCount: 1,
        changedCellCount: 1,
      },
      leftSheets: ['Sheet1'],
      rightSheets: ['Sheet1'],
      leftSheet: 'Sheet1',
      rightSheet: 'Sheet1',
    })
    vi.mocked(readTextFile).mockReset()
    vi.mocked(readTextFile).mockImplementation((path: string) =>
      Promise.resolve({
        path,
        text: path.includes('left') ? 'SKU,Quantity\nA-1,12' : 'sku,Quantity\nA-1,14',
        encoding: 'UTF-8',
        lineEnding: 'LF',
        fileStamp: { size: 20, modifiedAtMs: 1 },
      }),
    )
    vi.mocked(saveTextFile).mockClear()
    clipboardWriteText.mockClear()
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: {
        writeText: clipboardWriteText,
      },
    })
  })

  it('starts empty without a demo grid or sample CSV', () => {
    const wrapper = mountTableCompareView()

    expect(wrapper.text()).not.toContain('R1C1')
    expect(wrapper.findAll('[data-testid="table-grid-row"]')).toHaveLength(0)
    expect(
      (wrapper.find('[data-testid="table-left-path"]').element as HTMLInputElement).value,
    ).toBe('')
  })

  it('runs a table comparison with format, keys, and mappings', async () => {
    const wrapper = mountTableCompareView()

    await wrapper.find('[data-testid="table-left-path"]').setValue('C:/data/left.tsv')
    await wrapper.find('[data-testid="table-right-path"]').setValue('C:/data/right.tsv')
    await wrapper.find('[data-testid="table-format"]').setValue('tsv')
    await wrapper.find('[data-testid="table-key-columns"]').setValue('0')
    await wrapper.find('[data-testid="run-table-compare"]').trigger('click')
    await wrapper.vm.$nextTick()

    const lastCall = vi.mocked(compareTable).mock.lastCall

    expect(lastCall).toBeDefined()
    const [request] = lastCall as [TableCompareRequest]

    expect(request.format).toBe('tsv')
    expect(request.leftPath).toBe('C:/data/left.tsv')
    expect(request.rightPath).toBe('C:/data/right.tsv')
    expect(request.keyColumnIndices).toEqual([0])
    expect(wrapper.find('[data-testid="table-grid-cell-quantity"]').text()).toContain('12')
    expect(wrapper.find('[data-testid="active-table-cell"]').text()).toContain('12 -> 14')
  })

  it('reads dropped CSV launch paths and runs the table comparison', async () => {
    useSessionLaunchStore().setPendingLaunch({
      id: 'launch-table',
      source: 'drop',
      sessionType: 'table-compare',
      title: 'left.csv vs right.csv',
      route: '/compare/table',
      autoRun: true,
      locations: {
        left: { uri: 'C:/drop/left.csv', kind: 'file', readOnly: false },
        right: { uri: 'C:/drop/right.csv', kind: 'file', readOnly: false },
      },
    })

    mountTableCompareView()
    await Promise.resolve()
    await Promise.resolve()

    expect(readTextFile).toHaveBeenCalledWith('C:/drop/left.csv')
    expect(readTextFile).toHaveBeenCalledWith('C:/drop/right.csv')
    expect(compareTable).toHaveBeenCalledWith(
      expect.objectContaining({
        left: 'SKU,Quantity\nA-1,12',
        right: 'sku,Quantity\nA-1,14',
        format: 'csv',
        leftPath: 'C:/drop/left.csv',
        rightPath: 'C:/drop/right.csv',
      }),
    )
  })

  it('passes ignored columns and manual mappings to the backend', async () => {
    const wrapper = mountTableCompareView()

    await wrapper.find('[data-testid="run-table-compare"]').trigger('click')
    await wrapper.vm.$nextTick()
    await wrapper.find('[data-testid="manual-left-column"]').setValue('SKU')
    await wrapper.find('[data-testid="manual-right-column"]').setValue('sku')
    await wrapper.find('[data-testid="add-column-mapping"]').trigger('click')
    await wrapper.find('[data-testid="ignore-column-quantity"]').setValue(true)
    await wrapper.find('[data-testid="run-table-compare"]').trigger('click')
    await wrapper.vm.$nextTick()

    const request = vi.mocked(compareTable).mock.calls.at(-1)?.[0]

    if (!request) {
      throw new Error('compareTable was not called')
    }

    expect(request.ignoredColumns).toContain('Quantity')
    expect(request.manualMappings).toEqual([{ leftColumn: 'SKU', rightColumn: 'sku' }])
    expect(wrapper.find('[data-testid="column-mapping-list"]').text()).toContain('SKU -> sku')
  })

  it('keeps left and right table grid scroll positions synchronized', async () => {
    const wrapper = mount(TableCompareView, {
      global: {
        stubs: {
          NButton: {
            props: ['disabled', 'loading'],
            emits: ['click'],
            template: '<button :disabled="disabled" @click="$emit(\'click\')"><slot /></button>',
          },
        },
      },
      attachTo: document.body,
    })

    await wrapper.find('[data-testid="run-table-compare"]').trigger('click')
    await wrapper.vm.$nextTick()

    const leftViewport = wrapper.find<HTMLElement>('[data-testid="left-table-grid-viewport"]')
    const rightViewport = wrapper.find<HTMLElement>('[data-testid="right-table-grid-viewport"]')

    leftViewport.element.scrollTop = 96
    leftViewport.element.scrollLeft = 44
    await leftViewport.trigger('scroll')

    expect(rightViewport.element.scrollTop).toBe(96)
    expect(rightViewport.element.scrollLeft).toBe(44)

    wrapper.unmount()
  })

  it('searches compared table cells and navigates to the next difference', async () => {
    const wrapper = mountTableCompareView()

    await wrapper.find('[data-testid="run-table-compare"]').trigger('click')
    await wrapper.vm.$nextTick()

    await wrapper.find('[data-testid="table-search-input"]').setValue('A-1')

    expect(wrapper.find('[data-testid="table-search-summary"]').text()).toContain('1 match')
    expect(wrapper.find('[data-testid="active-table-cell"]').text()).toContain('A-1')

    await wrapper.find('[data-testid="next-table-difference"]').trigger('click')

    expect(wrapper.find('[data-testid="active-table-cell"]').text()).toContain('12 -> 14')
  })

  it('renders the Table Compare session toolbar order', () => {
    const wrapper = mountTableCompareView()
    const ids = [
      'home',
      'sessions',
      'all',
      'diffs',
      'same',
      'minor',
      'rules',
      'format',
      'copy',
      'next-diff',
      'prev-diff',
      'swap',
      'reload',
    ]

    expect(wrapper.find('[data-testid="table-session-toolbar-bar"]').exists()).toBe(true)
    expect(
      wrapper
        .findAll('[data-testid^="table-session-toolbar-"]')
        .filter((node) => node.attributes('data-testid') !== 'table-session-toolbar-bar')
        .map((node) => node.attributes('data-testid')?.replace('table-session-toolbar-', '')),
    ).toEqual(ids)
    expect(
      wrapper.find('[data-testid="table-session-toolbar-minor"]').attributes('disabled'),
    ).toBeDefined()
  })

  it('navigates differences from the Table session toolbar', async () => {
    const wrapper = mountTableCompareView()

    await wrapper.find('[data-testid="run-table-compare"]').trigger('click')
    await wrapper.vm.$nextTick()
    await wrapper.find('[data-testid="table-session-toolbar-next-diff"]').trigger('click')

    expect(wrapper.find('[data-testid="active-table-cell"]').text()).toContain('12 -> 14')
  })

  it('launches Excel workbooks by path and surfaces sheet selectors', async () => {
    vi.mocked(compareTable).mockResolvedValueOnce({
      leftColumns: [{ side: 'left', name: 'id' }],
      rightColumns: [{ side: 'right', name: 'id' }],
      columnMappings: [{ leftColumn: 'id', rightColumn: 'id', source: 'Automatic' }],
      rows: [{ index: 0, leftCells: ['1'], rightCells: ['1'], status: 'Same' }],
      changedCells: [],
      summary: { rowCount: 1, changedRowCount: 0, changedCellCount: 0 },
      leftSheets: ['Inventory', 'Flags'],
      rightSheets: ['Flags', 'Inventory'],
      leftSheet: 'Inventory',
      rightSheet: 'Inventory',
    })

    useSessionLaunchStore().setPendingLaunch({
      id: 'launch-xlsx',
      source: 'drop',
      sessionType: 'table-compare',
      title: 'left.xlsx vs right.xlsx',
      route: '/compare/table',
      autoRun: true,
      locations: {
        left: { uri: 'C:/drop/left.xlsx', kind: 'file', readOnly: false },
        right: { uri: 'C:/drop/right.xlsx', kind: 'file', readOnly: false },
      },
    })

    const wrapper = mountTableCompareView()

    await flushPromises()
    await wrapper.vm.$nextTick()

    expect(readTextFile).not.toHaveBeenCalled()
    expect(compareTable).toHaveBeenCalledWith(
      expect.objectContaining({
        format: 'xlsx',
        leftPath: 'C:/drop/left.xlsx',
        rightPath: 'C:/drop/right.xlsx',
      }),
    )
    expect(wrapper.find('[data-testid="table-sheet-summary"]').text()).toContain('Inventory')
    expect(
      (wrapper.find('[data-testid="table-left-sheet"]').element as HTMLSelectElement).value,
    ).toBe('Inventory')
    expect(
      (wrapper.find('[data-testid="table-right-sheet"]').element as HTMLSelectElement).value,
    ).toBe('Inventory')
  })

  it('recompares when the selected Excel sheet changes', async () => {
    vi.mocked(compareTable).mockImplementation((request) => {
      const sheet =
        request.leftSheet === 'Flags' || request.rightSheet === 'Flags' ? 'Flags' : 'Inventory'

      return Promise.resolve({
        leftColumns: [{ side: 'left', name: sheet === 'Flags' ? 'flag' : 'id' }],
        rightColumns: [{ side: 'right', name: sheet === 'Flags' ? 'flag' : 'id' }],
        columnMappings: [
          {
            leftColumn: sheet === 'Flags' ? 'flag' : 'id',
            rightColumn: sheet === 'Flags' ? 'flag' : 'id',
            source: 'Automatic',
          },
        ],
        rows: [
          {
            index: 0,
            leftCells: [sheet === 'Flags' ? 'yes' : '1'],
            rightCells: [sheet === 'Flags' ? 'no' : '1'],
            status: sheet === 'Flags' ? 'Modified' : 'Same',
          },
        ],
        changedCells:
          sheet === 'Flags'
            ? [
                {
                  rowIndex: 0,
                  columnIndex: 0,
                  leftValue: 'yes',
                  rightValue: 'no',
                  status: 'Modified',
                },
              ]
            : [],
        summary: {
          rowCount: 1,
          changedRowCount: sheet === 'Flags' ? 1 : 0,
          changedCellCount: sheet === 'Flags' ? 1 : 0,
        },
        leftSheets: ['Inventory', 'Flags'],
        rightSheets: ['Inventory', 'Flags'],
        leftSheet: sheet,
        rightSheet: sheet,
      })
    })

    const wrapper = mountTableCompareView()

    await wrapper.find('[data-testid="table-left-path"]').setValue('C:/data/left.xlsx')
    await wrapper.find('[data-testid="table-right-path"]').setValue('C:/data/right.xlsx')
    await wrapper.find('[data-testid="table-format"]').setValue('xlsx')
    await wrapper.find('[data-testid="run-table-compare"]').trigger('click')
    await Promise.resolve()
    await wrapper.vm.$nextTick()

    expect(wrapper.find('[data-testid="table-left-sheet"]').exists()).toBe(true)

    await wrapper.find('[data-testid="table-left-sheet"]').setValue('Flags')
    await wrapper.find('[data-testid="table-right-sheet"]').setValue('Flags')
    await wrapper.find('[data-testid="table-left-sheet"]').trigger('change')
    await flushPromises()
    await wrapper.vm.$nextTick()

    const request = vi.mocked(compareTable).mock.calls.at(-1)?.[0]

    expect(request).toEqual(
      expect.objectContaining({
        format: 'xlsx',
        leftSheet: 'Flags',
        rightSheet: 'Flags',
      }),
    )
  })

  it('launches HTML tables with format detection and named sheet options', async () => {
    vi.mocked(compareTable).mockResolvedValue({
      leftColumns: [{ side: 'left', name: 'id' }],
      rightColumns: [{ side: 'right', name: 'id' }],
      columnMappings: [{ leftColumn: 'id', rightColumn: 'id', source: 'Automatic' }],
      rows: [{ index: 0, leftCells: ['1'], rightCells: ['2'], status: 'Modified' }],
      changedCells: [
        {
          rowIndex: 0,
          columnIndex: 0,
          leftValue: '1',
          rightValue: '2',
          status: 'Modified',
        },
      ],
      summary: { rowCount: 1, changedRowCount: 1, changedCellCount: 1 },
      leftSheets: ['people', 'pets'],
      rightSheets: ['pets', 'people'],
      leftSheet: 'people',
      rightSheet: 'people',
    })
    vi.mocked(readTextFile).mockImplementation((path: string) =>
      Promise.resolve({
        path,
        text: path.includes('left')
          ? '<table id="people"><tr><th>id</th></tr><tr><td>1</td></tr></table>'
          : '<table id="people"><tr><th>id</th></tr><tr><td>2</td></tr></table>',
        encoding: 'UTF-8',
        lineEnding: 'LF',
        fileStamp: { size: 40, modifiedAtMs: 1 },
      }),
    )

    useSessionLaunchStore().setPendingLaunch({
      id: 'launch-html',
      source: 'drop',
      sessionType: 'table-compare',
      title: 'left.html vs right.html',
      route: '/compare/table',
      autoRun: true,
      locations: {
        left: { uri: 'C:/drop/left.html', kind: 'file', readOnly: false },
        right: { uri: 'C:/drop/right.html', kind: 'file', readOnly: false },
      },
    })

    const wrapper = mountTableCompareView()

    await flushPromises()
    await wrapper.vm.$nextTick()

    expect(compareTable).toHaveBeenCalledWith(
      expect.objectContaining({
        format: 'html',
        leftPath: 'C:/drop/left.html',
        rightPath: 'C:/drop/right.html',
      }),
    )
    expect(wrapper.find('[data-testid="table-sheet-summary"]').text()).toContain('people')
    expect(
      Array.from(
        (wrapper.find('[data-testid="table-left-sheet"]').element as HTMLSelectElement).options,
      ).map((option) => option.value),
    ).toEqual(['people', 'pets'])
  })

  it('persists key and ignore column choices and sends them on compare', async () => {
    const wrapper = mountTableCompareView()

    await wrapper.find('[data-testid="run-table-compare"]').trigger('click')
    await wrapper.vm.$nextTick()

    expect(wrapper.find('[data-testid="ignore-column-quantity"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="key-column-quantity"]').exists()).toBe(true)

    await wrapper.find('[data-testid="table-key-columns"]').setValue('0,1')
    await wrapper.find('[data-testid="ignore-column-quantity"]').setValue(true)
    await flushPromises()
    await wrapper.vm.$nextTick()

    const request = vi.mocked(compareTable).mock.calls.at(-1)?.[0]

    expect(request?.keyColumnIndices).toEqual([0, 1])
    expect(request?.ignoredColumns).toContain('Quantity')
  })

  it('exports the table report to clipboard and a sibling text file', async () => {
    const wrapper = mountTableCompareView()

    await wrapper.find('[data-testid="table-left-path"]').setValue('C:/data/left.csv')
    await wrapper.find('[data-testid="table-right-path"]').setValue('C:/data/right.csv')
    await wrapper.find('[data-testid="run-table-compare"]').trigger('click')
    await flushPromises()

    await wrapper.find('[data-testid="export-table-report"]').trigger('click')
    await flushPromises()

    expect(clipboardWriteText).toHaveBeenCalled()
    const payload = clipboardWriteText.mock.calls[0]?.[0] ?? ''

    expect(payload).toContain('TABLE-REPORT')
    expect(payload).toContain('left: C:/data/left.csv')
    expect(saveTextFile).toHaveBeenCalledWith({
      path: 'C:/data/table-compare.txt',
      text: payload,
      createBackup: false,
      backupRetention: 1,
    })
    expect(wrapper.find('[data-testid="table-report-status"]').text()).toBe(
      'C:/data/table-compare.txt',
    )
  })
  it('renders table compare header and report action', () => {
    const wrapper = mount(TableCompareView)

    expect(wrapper.find('.table-compare-header').exists()).toBe(true)
    expect(wrapper.find('[data-testid="export-table-report"]').exists()).toBe(true)

    wrapper.unmount()
  })
})
