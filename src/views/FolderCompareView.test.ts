import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import FolderCompareView from './FolderCompareView.vue'

describe('FolderCompareView', () => {
  it('renders left and right folder tree tables with core columns', () => {
    const wrapper = mount(FolderCompareView, {
      global: {
        stubs: {
          NButton: {
            props: ['disabled'],
            template: '<button :disabled="disabled"><slot /></button>',
          },
        },
      },
    })

    expect(wrapper.find('[data-testid="folder-tree-table"]').exists()).toBe(true)
    expect(wrapper.findAll('[data-testid="folder-row"]').length).toBeLessThan(40)
    expect(wrapper.text()).toContain('Name')
    expect(wrapper.text()).toContain('Size')
    expect(wrapper.text()).toContain('Modified')
    expect(wrapper.text()).toContain('Status')
    expect(wrapper.text()).toContain('src')
    expect(wrapper.text()).toContain('README.md')
    expect(wrapper.text()).toContain('Different')
  })

  it('expands and collapses directory rows', async () => {
    const wrapper = mount(FolderCompareView, {
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

    expect(wrapper.text()).toContain('main.ts')

    await wrapper.find('[data-testid="toggle-folder-src"]').trigger('click')

    expect(wrapper.text()).not.toContain('main.ts')

    await wrapper.find('[data-testid="expand-all-folders"]').trigger('click')

    expect(wrapper.text()).toContain('main.ts')

    await wrapper.find('[data-testid="collapse-all-folders"]').trigger('click')

    expect(wrapper.text()).not.toContain('main.ts')
  })

  it('virtualizes large folder lists and updates the rendered window on scroll', async () => {
    const wrapper = mount(FolderCompareView, {
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

    expect(wrapper.find('[data-testid="folder-virtual-spacer"]').exists()).toBe(true)
    expect(wrapper.findAll('[data-testid="folder-row"]').length).toBeLessThan(40)
    expect(wrapper.text()).not.toContain('generated-120.log')

    const table = wrapper.find('[data-testid="folder-tree-table"]')

    Object.defineProperty(table.element, 'scrollTop', { value: 3600, configurable: true })
    await table.trigger('scroll')

    expect(wrapper.text()).toContain('generated-120.log')
    expect(wrapper.findAll('[data-testid="folder-row"]').length).toBeLessThan(40)
  })

  it('configures visible folder table columns', async () => {
    const wrapper = mount(FolderCompareView, {
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

    expect(wrapper.findAll('[data-column="left-size"]').length).toBeGreaterThan(0)
    expect(wrapper.find('[data-column="left-type"]').exists()).toBe(false)

    await wrapper.find('[data-testid="toggle-column-size"]').setValue(false)
    await wrapper.find('[data-testid="toggle-column-modified"]').setValue(false)
    await wrapper.find('[data-testid="toggle-column-type"]').setValue(true)

    expect(wrapper.find('[data-column="left-size"]').exists()).toBe(false)
    expect(wrapper.find('[data-column="left-modified"]').exists()).toBe(false)
    expect(wrapper.find('[data-column="left-type"]').exists()).toBe(true)
    expect(wrapper.text()).toContain('Directory')
  })

  it('filters rows by comparison status', async () => {
    const wrapper = mount(FolderCompareView, {
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

    expect(wrapper.text()).toContain('README.md')
    expect(wrapper.text()).toContain('main.ts')
    expect(wrapper.text()).toContain('release-notes.md')

    await wrapper.find('[data-testid="toggle-status-same"]').setValue(false)

    expect(wrapper.text()).not.toContain('README.md')
    expect(wrapper.text()).toContain('main.ts')
    expect(wrapper.text()).toContain('release-notes.md')

    await wrapper.find('[data-testid="toggle-status-different"]').setValue(false)

    expect(wrapper.text()).not.toContain('main.ts')
    expect(wrapper.text()).toContain('release-notes.md')
  })

  it('temporarily shows suppressed rows with a marker', async () => {
    const wrapper = mount(FolderCompareView, {
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

    await wrapper.find('[data-testid="toggle-status-same"]').setValue(false)

    expect(wrapper.text()).not.toContain('README.md')

    await wrapper.find('[data-testid="toggle-suppressed-filters"]').setValue(true)

    expect(wrapper.text()).toContain('README.md')
    expect(wrapper.find('[data-testid="suppressed-marker-readme"]').exists()).toBe(true)
  })

  it('selects a file row and records open actions for default, configured, and associated applications', async () => {
    const wrapper = mount(FolderCompareView, {
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

    await wrapper.find('[data-row-id="readme"]').trigger('click')

    expect(
      wrapper.find('[data-testid="open-selected-file"]').attributes('disabled'),
    ).toBeUndefined()

    await wrapper.find('[data-testid="open-selected-file"]').trigger('click')

    expect(wrapper.text()).toContain('Open -> D:/workspace/left/README.md')

    await wrapper.find('[data-testid="open-with-selected-file"]').trigger('click')

    expect(wrapper.text()).toContain('Open With Text Edit -> D:/workspace/left/README.md')

    await wrapper.find('[data-testid="open-associated-file"]').trigger('click')

    expect(wrapper.text()).toContain(
      'Open With Associated Application -> D:/workspace/left/README.md',
    )
  })

  it('starts quick compare and compare-to actions for the selected folder file', async () => {
    const wrapper = mount(FolderCompareView, {
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

    await wrapper.find('[data-row-id="src-main"]').trigger('click')
    await wrapper.find('[data-testid="quick-compare-selected-file"]').trigger('click')

    expect(wrapper.text()).toContain('Quick Compare -> D:/workspace/left/src/main.ts')

    await wrapper.find('[data-testid="compare-to-selected-file"]').trigger('click')

    expect(wrapper.text()).toContain(
      'Compare To -> D:/workspace/left/src/main.ts => D:/workspace/right/src/main.ts',
    )
  })

  it('manually aligns an orphan with a selected counterpart and breaks the alignment', async () => {
    const wrapper = mount(FolderCompareView, {
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

    await wrapper.find('[data-row-id="notes"]').trigger('click')
    await wrapper.find('[data-testid="align-with-target"]').setValue('release-summary')
    await wrapper.find('[data-testid="align-with-selected-file"]').trigger('click')

    expect(wrapper.text()).toContain('release-notes.md aligned with release-summary.md')

    await wrapper.find('[data-testid="break-selected-alignment"]').trigger('click')

    expect(wrapper.text()).not.toContain('release-notes.md aligned with release-summary.md')
    expect(wrapper.text()).toContain('Alignment cleared for release-notes.md')
  })

  it('requires confirmation before copying selected files between left and right sides', async () => {
    const wrapper = mount(FolderCompareView, {
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

    await wrapper.find('[data-row-id="src-main"]').trigger('click')
    await wrapper.find('[data-testid="copy-selected-to-right"]').trigger('click')

    expect(wrapper.text()).toContain('Copy 1 item?')
    expect(wrapper.text()).toContain('D:/workspace/right/src/main.ts')

    await wrapper.find('[data-testid="confirm-folder-copy"]').trigger('click')

    expect(wrapper.text()).toContain('Copied to Right -> D:/workspace/right/src/main.ts')
    expect(wrapper.text()).toContain('Status refreshed')
  })

  it('confirms delete, move, and rename operations for the selected file', async () => {
    const wrapper = mount(FolderCompareView, {
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

    await wrapper.find('[data-row-id="notes"]').trigger('click')
    await wrapper.find('[data-testid="rename-selected-file"]').trigger('click')
    await wrapper.find('[data-testid="rename-target-name"]').setValue('release-notes-final.md')
    await wrapper.find('[data-testid="confirm-rename-file"]').trigger('click')

    expect(wrapper.text()).toContain('Renamed -> release-notes-final.md')

    await wrapper.find('[data-testid="move-selected-file"]').trigger('click')

    expect(wrapper.text()).toContain('Move -> D:/workspace/left/archive/release-notes.md')

    await wrapper.find('[data-testid="delete-selected-file"]').trigger('click')

    expect(wrapper.text()).toContain('Delete 1 item?')

    await wrapper.find('[data-testid="confirm-dangerous-file-operation"]').trigger('click')

    expect(wrapper.text()).toContain('Deleted -> D:/workspace/left/release-notes.md')
  })

  it('changes selected file attributes and touch timestamp from the folder toolbar', async () => {
    const wrapper = mount(FolderCompareView, {
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

    await wrapper.find('[data-row-id="readme"]').trigger('click')
    await wrapper.find('[data-testid="toggle-selected-readonly"]').setValue(true)

    expect(wrapper.text()).toContain('Attributes changed -> readonly')

    await wrapper.find('[data-testid="touch-selected-file"]').trigger('click')

    expect(wrapper.text()).toContain('Touched -> D:/workspace/left/README.md')
  })
})
