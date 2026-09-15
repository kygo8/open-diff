import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..')

describe('session toolbar icon presentation', () => {
  it('renders plates and Lucide icons from the shared map in WorkbenchShell', () => {
    const shell = readFileSync(resolve(root, 'src/components/workbench/WorkbenchShell.vue'), 'utf8')
    const css = readFileSync(resolve(root, 'src/styles/main.css'), 'utf8')
    const icons = readFileSync(resolve(root, 'src/app/sessionToolbarIcons.ts'), 'utf8')
    const textEdit = readFileSync(resolve(root, 'src/views/TextEditView.vue'), 'utf8')

    expect(shell).toContain('visualForSessionToolbarCommand')
    expect(shell).toContain('bc-toolbar-icon')
    expect(shell).toContain('bc-toolbar-plate')
    expect(shell).toContain('aria-label')
    expect(shell).toContain('largeToolbarButtons')
    expect(shell).toContain('showToolbarIcons')
    expect(css).toContain('.bc-toolbar-icon')
    expect(css).toContain('.bc-toolbar-plate')
    expect(css).toContain("data-plate='refresh'")
    expect(css).toContain("data-has-icon='true'")
    expect(icons).toContain('sessionToolbarPlates')
    expect(icons).toContain('tol:')
    expect(icons).toContain('range:')
    expect(icons).toContain('blend:')
    expect(icons).toContain('meta:')
    expect(icons).toContain('edit:')
    expect(textEdit).toContain('visualForSessionToolbarCommand')
    expect(textEdit).toContain('showToolbarIcons')
    expect(textEdit).toContain('aria-label')
  })
})
