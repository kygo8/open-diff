import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const css = readFileSync(resolve(dirname(fileURLToPath(import.meta.url)), 'main.css'), 'utf8')

describe('path/status strip density', () => {
  it('keeps path bars and footers denser toward capture chrome', () => {
    expect(css).toMatch(/\.bc-path-row\s*\{[\s\S]*?min-height:\s*28px/)
    expect(css).toMatch(/\.bc-path-row input\s*\{[\s\S]*?height:\s*22px/)
    expect(css).toMatch(/\.path-pair-bar\s*\{[\s\S]*?min-height:\s*32px/)
    expect(css).toMatch(/\.path-side-footer\s*\{[\s\S]*?font-size:\s*10px/)
  })
})
