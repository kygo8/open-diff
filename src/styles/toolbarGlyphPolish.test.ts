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
    expect(icons).toContain("plate: 'sessions'")
    expect(icons).toContain("plate: 'capture'")
    expect(icons).toContain("plate: 'format'")
    expect(icons).toContain("plate: 'context'")
    expect(icons).toContain("plate: 'play2'")
    expect(icons).toContain("plate: 'syntax'")
    expect(icons).toContain('sessionToolbarHasSeparatorBefore')
    expect(icons).toContain('sessionToolbarSeparatorBeforeIds')
    expect(icons).toContain('Pass 3:')
    expect(icons).toContain("['same-ok', 'minor']")

    expect(shell).toContain('bc-toolbar-command-group-start')
    expect(shell).toContain('data-group-start')
    expect(shell).toContain('data-command-id')
    expect(shell).toContain('sessionToolbarHasSeparatorBefore')

    expect(css).toContain('.bc-toolbar-command-group-start')
    expect(css).toContain('margin-left: 12px')
    expect(css).toContain('border-left: 1px solid #9a9a9a')
    expect(css).toContain('background: #ffffff')
    expect(css).toContain('background: #f0f0f0')
    expect(css).toContain('background: #cce8ff')
    expect(css).toContain("data-plate='sync-now'")
    expect(css).toContain("data-plate='peek'")
    expect(css).toContain("data-plate='merge'")
    expect(css).toContain("data-plate='stop'")
    expect(css).toContain("data-plate='sessions'")
    expect(css).toContain("data-plate='capture'")
    expect(css).toContain("data-plate='compare'")
    expect(css).toContain("data-plate='play2'")
    expect(css).toContain("data-plate='syntax'")
    expect(css).toContain('color: #cf2b2c')
    expect(css).toContain('#ffffb6')
    expect(css).toContain('#66b6ff')
    expect(css).toContain('#660000')
    expect(css).toContain('#db8f39')
    expect(css).toContain('Pass 3:')
    expect(css).toMatch(
      /\.bc-toolbar-command:active:not\(:disabled\)\s*\{[\s\S]*?box-shadow:\s*inset/,
    )
    expect(css).toMatch(/\.bc-toolbar-command:hover:not\(:disabled\) \.bc-toolbar-plate\s*\{/)
    expect(css).toContain("data-command-id='refresh'] .bc-toolbar-icon")
    expect(css).toMatch(/\.workbench-toolbar[\s\S]*?flex-wrap:\s*wrap/)
    expect(css).not.toMatch(/beyond-compare|bc5|scooter software/i)
    expect(icons).not.toMatch(/beyond-compare|bc5|scooter software/i)
  })
})
