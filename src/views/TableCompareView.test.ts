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
            props: ['disabled'],
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

    expect(wrapper.find('[data-testid="table-grid-cell-quantity"]').exists()).toBe(true)

    await wrapper.find('[data-testid="ignore-column-quantity"]').setValue(true)

    expect(wrapper.find('[data-testid="table-grid-cell-quantity"]').exists()).toBe(false)
    expect(wrapper.find('[data-testid="column-rule-quantity"]').text()).toContain('Ignored')
    expect(wrapper.find('[data-testid="column-rule-quantity"]').text()).toContain('Unimportant')
  })
})
