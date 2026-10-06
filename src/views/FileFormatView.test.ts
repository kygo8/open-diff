import { mount } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { fileFormatsStorageKey } from '@/app/fileFormats'
import FileFormatView from './FileFormatView.vue'

describe('FileFormatView', () => {
  afterEach(() => {
    localStorage.removeItem(fileFormatsStorageKey)
  })

  beforeEach(() => {
    localStorage.removeItem(fileFormatsStorageKey)
  })

  it('shows a plain Formats page hint for first-time users', () => {
    const wrapper = mount(FileFormatView)

    expect(wrapper.find('[data-testid="file-formats-page-hint"]').text()).toContain(
      'compare view opens',
    )
  })

  it('renders built-in file formats and selected format details', () => {
    const wrapper = mount(FileFormatView)

    expect(wrapper.text()).toContain('File Formats')
    expect(wrapper.find('[data-testid="format-list"]').text()).toContain('Plain Text')
    expect(wrapper.find('[data-testid="format-list"]').text()).toContain('Rust Source')
    expect(wrapper.find('[data-testid="format-name-input"]').element).toHaveProperty(
      'value',
      'Plain Text',
    )
    expect(
      (wrapper.find('[data-testid="format-extension-input"]').element as HTMLInputElement).value,
    ).toContain('txt')
    expect(wrapper.find('[data-testid="format-rule-summary"]').text()).toContain(
      'Ignore: whitespace-trim',
    )
  })

  it('selects and edits a format definition', async () => {
    const wrapper = mount(FileFormatView)

    await wrapper.find('[data-testid="select-format-rust"]').trigger('click')
    await wrapper.find('[data-testid="format-priority-input"]').setValue('95')
    await wrapper.find('[data-testid="format-view-select"]').setValue('table')
    await wrapper.find('[data-testid="format-grammar-input"]').setValue('rust-grammar-v2')

    expect(wrapper.find('[data-testid="format-detail"]').text()).toContain('Rust Source')
    expect(wrapper.find('[data-testid="selected-format-summary"]').text()).toContain('Priority 95')
    expect(wrapper.find('[data-testid="selected-format-summary"]').text()).toContain('Table')
    expect(wrapper.find('[data-testid="format-rule-summary"]').text()).toContain(
      'Grammar: rust-grammar-v2',
    )
  })

  it('creates a custom format from form values', async () => {
    const wrapper = mount(FileFormatView)

    await wrapper.find('[data-testid="new-format"]').trigger('click')
    await wrapper.find('[data-testid="format-name-input"]').setValue('Build Manifest')
    await wrapper.find('[data-testid="format-extension-input"]').setValue('toml, lock')
    await wrapper.find('[data-testid="format-priority-input"]').setValue('88')
    await wrapper.find('[data-testid="format-view-select"]').setValue('text')
    await wrapper.find('[data-testid="format-ignore-input"]').setValue('comments')
    await wrapper.find('[data-testid="save-format"]').trigger('click')

    expect(wrapper.find('[data-testid="format-list"]').text()).toContain('Build Manifest')
    expect(wrapper.find('[data-testid="selected-format-summary"]').text()).toContain('Priority 88')
    expect(wrapper.find('[data-testid="format-rule-summary"]').text()).toContain('Ignore: comments')
    expect(localStorage.getItem(fileFormatsStorageKey)).toContain('Build Manifest')
  })

  it('exports and imports format definitions as JSON', async () => {
    const wrapper = mount(FileFormatView)

    await wrapper.find('[data-testid="export-formats"]').trigger('click')

    const exportedJson = wrapper.find('[data-testid="format-export-json"]')
      .element as HTMLTextAreaElement

    expect(exportedJson.value).toContain('"name": "Plain Text"')

    await wrapper.find('[data-testid="format-import-json"]').setValue(
      JSON.stringify([
        {
          id: 'markdown-doc',
          name: 'Markdown Document',
          priority: 72,
          defaultView: 'text',
          matcher: { extensions: ['md', 'markdown'], fileNames: [], globs: [] },
          rules: { grammar: 'markdown', ignore: ['frontmatter'], conversion: '' },
        },
      ]),
    )
    await wrapper.find('[data-testid="import-formats"]').trigger('click')

    expect(wrapper.find('[data-testid="format-list"]').text()).toContain('Markdown Document')
    expect(wrapper.find('[data-testid="format-extension-input"]').element).toHaveProperty(
      'value',
      'md, markdown',
    )
  })
})
