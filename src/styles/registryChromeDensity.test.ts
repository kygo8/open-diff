import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..')
const css = readFileSync(resolve(root, 'src/styles/main.css'), 'utf8')
const registryView = readFileSync(resolve(root, 'src/views/RegistryCompareView.vue'), 'utf8')
const layout = readFileSync(resolve(root, 'src/layouts/AppLayout.vue'), 'utf8')

describe('registry compare chrome density', () => {
  it('keeps Registry Compare path/status/toolbar/footer chrome dense toward capture', () => {
    expect(css).toMatch(/\.registry-compare-view\s*\{[\s\S]*?padding:\s*2px 4px/)
    expect(css).toMatch(
      /\.registry-compare-view \.registry-input-panel\s*\{[\s\S]*?min-height:\s*22px/,
    )
    expect(css).toMatch(/\.registry-compare-view \.path-side-footer\s*\{[\s\S]*?font-size:\s*9px/)

    expect(registryView).toMatch(/\.registry-compare-view\s*\{[\s\S]*?padding:\s*2px 4px/)
    expect(registryView).toMatch(/\.path-side-footer\s*\{[\s\S]*?font-size:\s*9px/)
    expect(registryView).toMatch(/chromeKind:\s*'registry-session'/)

    expect(layout).toMatch(/data-chrome-kind='registry-session'[\s\S]*?height:\s*22px/)
  })

  it('keeps Registry summary/pane/row chrome dense one more notch toward capture', () => {
    expect(css).toMatch(
      /\.registry-compare-view \.registry-summary-item\s*\{[\s\S]*?padding:\s*1px 4px/,
    )
    expect(css).toMatch(
      /\.registry-compare-view \.registry-summary-item strong\s*\{[\s\S]*?font-size:\s*11px/,
    )
    expect(css).toMatch(/\.registry-compare-view \.registry-key-pane[\s\S]*?padding:\s*1px 4px/)
    expect(css).toMatch(/\.registry-compare-view \.registry-key-row\s*\{[\s\S]*?min-height:\s*24px/)
    expect(css).toMatch(
      /\.registry-compare-view \.registry-value-row\s*\{[\s\S]*?min-height:\s*20px/,
    )
    expect(css).toMatch(
      /\.registry-compare-view \.registry-value-row > \*\s*\{[\s\S]*?padding:\s*1px 4px/,
    )

    expect(registryView).toMatch(/\.registry-summary-item\s*\{[\s\S]*?padding:\s*1px 4px/)
    expect(registryView).toMatch(/\.registry-summary-item strong\s*\{[\s\S]*?font-size:\s*11px/)
    expect(registryView).toMatch(/\.registry-key-pane[\s\S]*?padding:\s*1px 4px/)
    expect(registryView).toMatch(/\.registry-key-row\s*\{[\s\S]*?min-height:\s*24px/)
    expect(registryView).toMatch(/\.registry-value-row\s*\{[\s\S]*?min-height:\s*20px/)
    expect(registryView).toMatch(/\.registry-value-row > \*\s*\{[\s\S]*?padding:\s*1px 4px/)
  })
})
