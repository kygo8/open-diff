import { mount, type VueWrapper } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import type { App } from 'vue'
import PathMetaFooter from './PathMetaFooter.vue'
import { createAppI18n, installI18n } from '@/i18n'

function mountFooter(props: Record<string, unknown> = {}): VueWrapper {
  return mount(PathMetaFooter, {
    props: {
      stamp: { size: 42, modifiedAtMs: Date.UTC(2026, 0, 2, 3, 4, 5) },
      formatLabel: 'Everything Else',
      encoding: 'UTF-8',
      lineEnding: 'MIX',
      testId: 'meta',
      ...props,
    },
    global: {
      plugins: [
        {
          install(app: App) {
            installI18n(app, createAppI18n('en-US'))
          },
        },
      ],
    },
  })
}

describe('PathMetaFooter chip menus', () => {
  it('opens format and encoding menus and emits selection', async () => {
    const wrapper = mountFooter({
      formatOptions: [
        { id: 'plain-text', label: 'Plain Text' },
        { id: 'source-code', label: 'Source Code' },
      ],
      encodingOptions: ['UTF-8', 'GBK'],
    })

    expect(wrapper.find('[data-testid="meta-format-chip"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="meta-encoding-chip"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="meta-format-menu"]').exists()).toBe(false)

    await wrapper.find('[data-testid="meta-format-chip"]').trigger('click')
    expect(wrapper.find('[data-testid="meta-format-menu"]').exists()).toBe(true)

    await wrapper.find('[data-testid="meta-format-option-plain-text"]').trigger('click')
    expect(wrapper.emitted('select-format')?.[0]?.[0]).toEqual({
      id: 'plain-text',
      label: 'Plain Text',
    })
    expect(wrapper.emitted('update:format-label')?.[0]?.[0]).toBe('Plain Text')
    expect(wrapper.find('[data-testid="meta-format-menu"]').exists()).toBe(false)

    await wrapper.find('[data-testid="meta-encoding-chip"]').trigger('click')
    expect(wrapper.find('[data-testid="meta-encoding-menu"]').exists()).toBe(true)

    await wrapper.find('[data-testid="meta-encoding-option-GBK"]').trigger('click')
    expect(wrapper.emitted('select-encoding')?.[0]?.[0]).toEqual({ id: 'GBK', label: 'GBK' })
    expect(wrapper.emitted('update:encoding')?.[0]?.[0]).toBe('GBK')

    wrapper.unmount()
  })

  it('keeps chip chrome at capture scale', () => {
    const wrapper = mountFooter()
    const chip = wrapper.find('[data-testid="meta-format-chip"]')

    expect(chip.classes()).toContain('path-meta-chip')
    expect(wrapper.find('.path-meta-footer').attributes('data-path-meta-density')).toBe(
      'capture-1to1',
    )
    wrapper.unmount()
  })
})
