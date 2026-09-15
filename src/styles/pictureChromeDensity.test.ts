import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..')
const css = readFileSync(resolve(root, 'src/styles/main.css'), 'utf8')
const pictureView = readFileSync(resolve(root, 'src/views/PictureCompareView.vue'), 'utf8')
const layout = readFileSync(resolve(root, 'src/layouts/AppLayout.vue'), 'utf8')

describe('picture compare chrome density', () => {
  it('keeps Picture Compare path/status/toolbar/footer chrome dense toward capture', () => {
    expect(css).toMatch(/\.picture-compare-view\s*\{[\s\S]*?padding:\s*4px 6px/)
    expect(css).toMatch(
      /\.picture-compare-view \.picture-path-panel\s*\{[\s\S]*?min-height:\s*26px/,
    )
    expect(css).toMatch(
      /\.picture-compare-view \.picture-path-panel input,\s*\.picture-compare-view \.picture-path-panel button\s*\{[\s\S]*?height:\s*20px/,
    )
    expect(css).toMatch(/\.picture-compare-view \.path-side-footer\s*\{[\s\S]*?font-size:\s*10px/)

    expect(pictureView).toMatch(/\.picture-compare-view\s*\{[\s\S]*?padding:\s*4px 6px/)
    expect(pictureView).toMatch(/\.path-side-footer\s*\{[\s\S]*?font-size:\s*10px/)
    expect(pictureView).toMatch(/chromeKind:\s*'picture-session'/)

    expect(layout).toMatch(/data-chrome-kind='picture-session'[\s\S]*?height:\s*22px/)
  })
})
