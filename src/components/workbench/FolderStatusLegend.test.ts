import { mount, type VueWrapper } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import type { App } from 'vue'
import FolderStatusLegend from './FolderStatusLegend.vue'
import { createAppI18n, installI18n } from '@/i18n'
import { folderStatusLegendItems } from '@/app/folderStatusLegend'

function mountLegend(): VueWrapper {
  return mount(FolderStatusLegend, {
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

describe('FolderStatusLegend', () => {
  it('renders compact status swatches for folder vocabulary', () => {
    const wrapper = mountLegend()

    expect(wrapper.find('[data-testid="folder-status-legend"]').exists()).toBe(true)
    expect(wrapper.text()).toContain('Legend')

    for (const item of folderStatusLegendItems) {
      expect(wrapper.find(`[data-testid="folder-legend-item-${item.id}"]`).exists()).toBe(true)
    }

    wrapper.unmount()
  })
})
