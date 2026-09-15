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
    expect(css).toMatch(/\.registry-compare-view\s*\{[\s\S]*?padding:\s*4px 6px/)
    expect(css).toMatch(
      /\.registry-compare-view \.registry-input-panel\s*\{[\s\S]*?min-height:\s*26px/,
    )
    expect(css).toMatch(/\.registry-compare-view \.path-side-footer\s*\{[\s\S]*?font-size:\s*10px/)

    expect(registryView).toMatch(/\.registry-compare-view\s*\{[\s\S]*?padding:\s*4px 6px/)
    expect(registryView).toMatch(/\.path-side-footer\s*\{[\s\S]*?font-size:\s*10px/)
    expect(registryView).toMatch(/chromeKind:\s*'registry-session'/)

    expect(layout).toMatch(/data-chrome-kind='registry-session'[\s\S]*?height:\s*22px/)
  })
})
