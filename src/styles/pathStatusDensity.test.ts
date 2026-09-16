import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const css = readFileSync(resolve(dirname(fileURLToPath(import.meta.url)), 'main.css'), 'utf8')

describe('path/status strip density', () => {
  it('keeps path bars and footers denser toward capture chrome', () => {
    expect(css).toMatch(/\.bc-path-row\s*\{[\s\S]*?min-height:\s*18px/)
    expect(css).toMatch(/\.bc-path-row input\s*\{[\s\S]*?height:\s*13px/)
    expect(css).toMatch(/\.path-pair-bar\s*\{[\s\S]*?min-height:\s*20px/)
    expect(css).toMatch(/\.path-side-footer\s*\{[\s\S]*?font-size:\s*7px/)
    expect(css).toMatch(/\.path-side-footer\s*\{[\s\S]*?min-height:\s*7px/)
    expect(css).toMatch(/\.path-side-footer\s*\{[\s\S]*?line-height:\s*7px/)
  })

  it('fuses path row corners and borders into the shell frame', () => {
    expect(css).toMatch(/\.bc-path-row input\s*\{[\s\S]*?border-radius:\s*0/)
    expect(css).toMatch(/\.bc-path-row button\s*\{[\s\S]*?border-radius:\s*0/)
    expect(css).toMatch(/\.bc-path-row button\s*\{[\s\S]*?border:\s*1px solid #a0a0a0/)
    expect(css).toMatch(/\.path-pair-bar input\s*\{[\s\S]*?border-radius:\s*0/)
    expect(css).toMatch(
      /\.app-shell-single-session \.folder-toolbar \.path-pair\s*\{[\s\S]*?min-height:\s*18px/,
    )
  })
})
