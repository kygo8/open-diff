import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..')

describe('session toolbar icon presentation', () => {
  it('renders Lucide icons from the shared map in WorkbenchShell', () => {
    const shell = readFileSync(resolve(root, 'src/components/workbench/WorkbenchShell.vue'), 'utf8')
    const css = readFileSync(resolve(root, 'src/styles/main.css'), 'utf8')
    const icons = readFileSync(resolve(root, 'src/app/sessionToolbarIcons.ts'), 'utf8')

    expect(shell).toContain('iconForSessionToolbarCommand')
    expect(shell).toContain('bc-toolbar-icon')
    expect(shell).toContain('aria-label')
    expect(shell).toContain('largeToolbarButtons')
    expect(css).toContain('.bc-toolbar-icon')
    expect(css).toContain("data-has-icon='true'")
    expect(icons).toContain('refresh:')
    expect(icons).toContain('swap:')
    expect(icons).toContain('filters:')
  })
})
