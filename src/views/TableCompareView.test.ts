import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import TableCompareView from './TableCompareView.vue'

describe('TableCompareView', () => {
  it('allows manual column mapping and renders the applied mapping list', async () => {
    const wrapper = mount(TableCompareView, {
      global: {
        stubs: {
          NButton: {
            props: ['disabled'],
            emits: ['click'],
            template: '<button :disabled="disabled" @click="$emit(\'click\')"><slot /></button>',
          },
        },
      },
    })

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
    const wrapper = mount(TableCompareView, {
      global: {
        stubs: {
          NButton: {
            props: ['disabled'],
            emits: ['click'],
            template: '<button :disabled="disabled" @click="$emit(\'click\')"><slot /></button>',
          },
        },
      },
    })

    const grid = wrapper.find('[data-testid="table-virtual-grid"]')

    expect(grid.exists()).toBe(true)
    expect(grid.attributes('style')).toContain('--visible-rows: 8')
    expect(grid.attributes('style')).toContain('--visible-columns: 5')
    expect(wrapper.findAll('[data-testid="table-grid-row"]')).toHaveLength(8)
    expect(wrapper.findAll('[data-testid="table-grid-cell"]').length).toBe(40)
    expect(wrapper.text()).toContain('R1C1')
    expect(wrapper.text()).toContain('R8C5')
  })
})
