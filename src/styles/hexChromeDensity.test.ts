import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..')
const css = readFileSync(resolve(root, 'src/styles/main.css'), 'utf8')
const hexView = readFileSync(resolve(root, 'src/views/HexCompareView.vue'), 'utf8')
const layout = readFileSync(resolve(root, 'src/layouts/AppLayout.vue'), 'utf8')

describe('hex compare chrome density', () => {
  it('keeps Hex Compare path/status/toolbar/footer chrome dense toward capture', () => {
    expect(css).toMatch(/\.hex-compare-view\s*\{[\s\S]*?padding:\s*4px 6px/)
    expect(css).toMatch(/\.hex-compare-view \.bc-path-row\s*\{[\s\S]*?min-height:\s*26px/)
    expect(css).toMatch(/\.hex-compare-view \.bc-path-row input\s*\{[\s\S]*?height:\s*20px/)
    expect(css).toMatch(/\.hex-compare-view \.path-side-footer\s*\{[\s\S]*?font-size:\s*10px/)
    expect(css).toMatch(/\.hex-compare-view \.hex-row\s*\{[\s\S]*?min-height:\s*18px/)

    expect(hexView).toMatch(/\.hex-compare-view\s*\{[\s\S]*?padding:\s*4px 6px/)
    expect(hexView).toMatch(/\.path-side-footer\s*\{[\s\S]*?font-size:\s*10px/)
    expect(hexView).toMatch(/\.hex-row\s*\{[\s\S]*?min-height:\s*18px/)
    expect(hexView).toMatch(/chromeKind:\s*'hex-session'/)

    expect(layout).toMatch(/data-chrome-kind='hex-session'[\s\S]*?height:\s*22px/)
  })
})
