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
    expect(css).toMatch(/\.hex-compare-view\s*\{[\s\S]*?padding:\s*2px 4px/)
    expect(css).toMatch(/\.hex-compare-view \.bc-path-row\s*\{[\s\S]*?min-height:\s*20px/)
    expect(css).toMatch(/\.hex-compare-view \.bc-path-row input\s*\{[\s\S]*?height:\s*16px/)
    expect(css).toMatch(/\.hex-compare-view \.path-side-footer\s*\{[\s\S]*?font-size:\s*9px/)
    expect(css).toMatch(/\.hex-compare-view \.hex-row\s*\{[\s\S]*?min-height:\s*16px/)

    expect(hexView).toMatch(/\.hex-compare-view\s*\{[\s\S]*?padding:\s*2px 4px/)
    expect(hexView).toMatch(/\.path-side-footer\s*\{[\s\S]*?font-size:\s*9px/)
    expect(hexView).toMatch(/\.hex-row\s*\{[\s\S]*?min-height:\s*16px/)
    expect(hexView).toMatch(/chromeKind:\s*'hex-session'/)

    expect(layout).toMatch(/data-chrome-kind='hex-session'[\s\S]*?height:\s*22px/)
  })

  it('keeps Hex summary/report/toolbar chrome dense one more notch toward capture', () => {
    expect(css).toMatch(/\.hex-compare-view \.hex-summary[\s\S]*?padding:\s*1px 4px/)
    expect(css).toMatch(/\.hex-compare-view \.hex-report-panel\s*\{[\s\S]*?padding:\s*1px 4px/)
    expect(css).toMatch(/\.hex-compare-view \.hex-wrap-controls\s*\{[\s\S]*?min-height:\s*20px/)
    expect(css).toMatch(/\.hex-compare-view \.hex-wrap-controls input[\s\S]*?height:\s*16px/)
    expect(css).toMatch(/\.hex-compare-view \.hex-summary strong\s*\{[\s\S]*?font-size:\s*12px/)

    expect(hexView).toMatch(/\.hex-summary\s*\{[\s\S]*?padding:\s*1px 4px/)
    expect(hexView).toMatch(/\.hex-report-panel\s*\{[\s\S]*?padding:\s*1px 4px/)
    expect(hexView).toMatch(/\.hex-wrap-controls\s*\{[\s\S]*?min-height:\s*20px/)
    expect(hexView).toMatch(/\.hex-wrap-controls strong\s*\{[\s\S]*?height:\s*16px/)
    expect(hexView).toMatch(/\.hex-row\s*\{[\s\S]*?font-size:\s*11px/)
  })

  it('keeps Hex rules strip chrome dense toward the session-panel band', () => {
    expect(hexView).toMatch(/\.hex-rules-row\s*\{[\s\S]*?gap:\s*4px/)
    expect(hexView).toMatch(/\.hex-rules-row\s*\{[\s\S]*?min-height:\s*18px/)
    expect(hexView).toMatch(/\.hex-rules-row\s*\{[\s\S]*?margin:\s*0/)
    expect(hexView).toMatch(/\.hex-rules-row input\[type='number'\]\s*\{[\s\S]*?height:\s*16px/)
    expect(hexView).toMatch(/\.hex-rules-row ~ button\s*\{[\s\S]*?height:\s*18px/)
    expect(hexView).not.toMatch(/\.hex-rules-row\s*\{[\s\S]*?margin:\s*8px 0/)
  })
})
