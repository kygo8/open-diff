import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..')
const css = readFileSync(resolve(root, 'src/styles/main.css'), 'utf8')
const icons = readFileSync(resolve(root, 'src/app/sessionToolbarIcons.ts'), 'utf8')
const shell = readFileSync(resolve(root, 'src/components/workbench/WorkbenchShell.vue'), 'utf8')

describe('session toolbar glyph polish', () => {
  it('keeps OpenDiff plates/Lucide fills, separators, and hover/pressed toward capture MainBar', () => {
    expect(icons).toContain("plate: 'home'")
    expect(icons).toContain("plate: 'sync-now'")
    expect(icons).toContain("plate: 'peek'")
    expect(icons).toContain("plate: 'merge'")
    expect(icons).toContain('sessionToolbarHasSeparatorBefore')
    expect(icons).toContain('sessionToolbarSeparatorBeforeIds')

    expect(shell).toContain('bc-toolbar-command-group-start')
    expect(shell).toContain('data-group-start')
    expect(shell).toContain('data-command-id')
    expect(shell).toContain('sessionToolbarHasSeparatorBefore')

    expect(css).toContain('.bc-toolbar-command-group-start')
    expect(css).toContain('margin-left: 10px')
    expect(css).toContain("data-plate='sync-now'")
    expect(css).toContain("data-plate='peek'")
    expect(css).toContain("data-plate='merge'")
    expect(css).toContain("data-plate='stop'")
    expect(css).toMatch(
      /\.bc-toolbar-command:active:not\(:disabled\)\s*\{[\s\S]*?box-shadow:\s*inset/,
    )
    expect(css).toMatch(/\.bc-toolbar-command:hover:not\(:disabled\) \.bc-toolbar-plate\s*\{/)
    expect(css).toContain("data-command-id='refresh'] .bc-toolbar-icon")
    expect(css).toMatch(/\.workbench-toolbar[\s\S]*?flex-wrap:\s*wrap/)
    expect(css).not.toMatch(/beyond-compare|bc5|scooter software/i)
  })
})
