import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..')
const css = readFileSync(resolve(root, 'src/styles/main.css'), 'utf8')
const versionView = readFileSync(resolve(root, 'src/views/VersionCompareView.vue'), 'utf8')
const layout = readFileSync(resolve(root, 'src/layouts/AppLayout.vue'), 'utf8')

describe('version compare chrome density', () => {
  it('keeps Version Compare path/status/toolbar/footer chrome dense toward capture', () => {
    expect(css).toMatch(/\.version-compare-view\s*\{[\s\S]*?padding:\s*4px 6px/)
    expect(css).toMatch(
      /\.version-compare-view \.version-path-panel\s*\{[\s\S]*?min-height:\s*26px/,
    )
    expect(css).toMatch(
      /\.version-compare-view \.version-path-panel input,\s*\.version-compare-view \.version-path-panel button\s*\{[\s\S]*?height:\s*20px/,
    )
    expect(css).toMatch(/\.version-compare-view \.path-side-footer\s*\{[\s\S]*?font-size:\s*10px/)

    expect(versionView).toMatch(/\.version-compare-view\s*\{[\s\S]*?padding:\s*4px 6px/)
    expect(versionView).toMatch(/\.path-side-footer\s*\{[\s\S]*?font-size:\s*10px/)
    expect(versionView).toMatch(/chromeKind:\s*'version-session'/)

    expect(layout).toMatch(/data-chrome-kind='version-session'[\s\S]*?height:\s*22px/)
  })
})
