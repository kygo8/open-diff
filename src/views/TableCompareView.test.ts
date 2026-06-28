import { mount, type VueWrapper } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import TableCompareView from './TableCompareView.vue'
import { compareTableCsv } from '@/api/diff'
import type { TableCompareRequest } from '@/types/diff'

vi.mock('@/api/diff', () => ({
  compareTableCsv: vi.fn().mockResolvedValue({
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
  }),
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
    vi.mocked(compareTableCsv).mockClear()
  })

  it('runs a CSV comparison and renders returned table cells', async () => {
    const wrapper = mountTableCompareView()

    await wrapper.find('[data-testid="run-table-compare"]').trigger('click')
    await wrapper.vm.$nextTick()

    const lastCall = vi.mocked(compareTableCsv).mock.lastCall

    expect(lastCall).toBeDefined()

    const [request] = lastCall as [TableCompareRequest]

    expect(request.left).toContain('SKU')
    expect(request.right).toContain('sku')
    expect(wrapper.find('[data-testid="column-mapping-list"]').text()).toContain(
      'Quantity -> Quantity',
    )
    expect(wrapper.find('[data-testid="table-grid-cell-quantity"]').text()).toContain('12')
    expect(wrapper.find('[data-testid="active-table-cell"]').text()).toContain('12 -> 14')
  })

  it('allows manual column mapping and renders the applied mapping list', async () => {
    const wrapper = mountTableCompareView()

    expect(wrapper.text()).toContain('Table Compare')
    expect(wrapper.text()).toContain('Left Columns')
    expect(wrapper.text()).toContain('Right Columns')
    expect(wrapper.text()).toContain('SKU -> sku')

    await wrapper.find('[data-testid="manual-left-column"]').setValue('Unit Price')
    await wrapper.find('[data-testid="manual-right-column"]').setValue('unitprice')
    await wrapper.find('[data-testid="add-column-mapping"]').trigger('click')

    expect(wrapper.find('[data-testid="column-mapping-list"]').text()).toContain(
      'Unit Price -> unitprice',
    )
    expect(wrapper.text()).toContain('Manual')
  })

  it('renders a fixed virtual grid window for large table data', () => {
    const wrapper = mountTableCompareView()

    const grid = wrapper.find('[data-testid="table-virtual-grid"]')

    expect(grid.exists()).toBe(true)
    expect(grid.attributes('style')).toContain('--visible-rows: 8')
    expect(grid.attributes('style')).toContain('--visible-columns: 5')
    expect(grid.findAll('[data-testid="table-grid-row"]')).toHaveLength(8)
    expect(grid.findAll('[data-testid="table-grid-cell"]').length).toBe(40)
    expect(wrapper.text()).toContain('R1C1')
    expect(wrapper.text()).toContain('R8C5')
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

    const leftViewport = wrapper.find<HTMLElement>('[data-testid="left-table-grid-viewport"]')
    const rightViewport = wrapper.find<HTMLElement>('[data-testid="right-table-grid-viewport"]')

    expect(leftViewport.exists()).toBe(true)
    expect(rightViewport.exists()).toBe(true)

    leftViewport.element.scrollTop = 96
    leftViewport.element.scrollLeft = 44
    await leftViewport.trigger('scroll')

    expect(rightViewport.element.scrollTop).toBe(96)
    expect(rightViewport.element.scrollLeft).toBe(44)

    wrapper.unmount()
  })

  it('hides ignored columns and marks them as unimportant', async () => {
    const wrapper = mountTableCompareView()

    expect(wrapper.find('[data-testid="table-grid-cell-quantity"]').exists()).toBe(true)

    await wrapper.find('[data-testid="ignore-column-quantity"]').setValue(true)

    expect(wrapper.find('[data-testid="table-grid-cell-quantity"]').exists()).toBe(false)
    expect(wrapper.find('[data-testid="column-rule-quantity"]').text()).toContain('Ignored')
    expect(wrapper.find('[data-testid="column-rule-quantity"]').text()).toContain('Unimportant')
  })

  it('searches table cells and navigates to the next difference', async () => {
    const wrapper = mountTableCompareView()

    await wrapper.find('[data-testid="table-search-input"]').setValue('R8C5')

    expect(wrapper.find('[data-testid="table-search-summary"]').text()).toContain('1 match')
    expect(wrapper.find('[data-testid="active-table-cell"]').text()).toContain('R8C5')

    await wrapper.find('[data-testid="next-table-difference"]').trigger('click')

    expect(wrapper.find('[data-testid="active-table-cell"]').text()).toContain('R2C3')
    expect(wrapper.find('[data-testid="table-difference-summary"]').text()).toContain('1 / 2')
  })
})
