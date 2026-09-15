import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..')
const css = readFileSync(resolve(root, 'src/styles/main.css'), 'utf8')
const mediaView = readFileSync(resolve(root, 'src/views/MediaCompareView.vue'), 'utf8')
const layout = readFileSync(resolve(root, 'src/layouts/AppLayout.vue'), 'utf8')

describe('media compare chrome density', () => {
  it('keeps Media Compare path/status/toolbar/footer chrome dense toward capture', () => {
    expect(css).toMatch(/\.media-compare-view\s*\{[\s\S]*?padding:\s*4px 6px/)
    expect(css).toMatch(/\.media-compare-view \.media-path-panel\s*\{[\s\S]*?min-height:\s*26px/)
    expect(css).toMatch(
      /\.media-compare-view \.media-path-panel input,\s*\.media-compare-view \.media-path-panel button\s*\{[\s\S]*?height:\s*20px/,
    )
    expect(css).toMatch(/\.media-compare-view \.path-side-footer\s*\{[\s\S]*?font-size:\s*10px/)

    expect(mediaView).toMatch(/\.media-compare-view\s*\{[\s\S]*?padding:\s*4px 6px/)
    expect(mediaView).toMatch(/\.path-side-footer\s*\{[\s\S]*?font-size:\s*10px/)
    expect(mediaView).toMatch(/chromeKind:\s*'media-session'/)

    expect(layout).toMatch(/data-chrome-kind='media-session'[\s\S]*?height:\s*22px/)
  })
})
