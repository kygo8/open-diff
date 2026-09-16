import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..')
const css = readFileSync(resolve(root, 'src/styles/main.css'), 'utf8')
const patchView = readFileSync(resolve(root, 'src/views/TextPatchView.vue'), 'utf8')
const layout = readFileSync(resolve(root, 'src/layouts/AppLayout.vue'), 'utf8')

describe('text patch chrome density', () => {
  it('keeps Text Patch path/toolbar/editor/status chrome dense toward capture', () => {
    expect(css).toMatch(/\.text-patch-view \.patch-workbench-main\s*\{[\s\S]*?padding:\s*4px 6px/)
    expect(css).toMatch(/\.text-patch-view \.patch-toolbar\s*\{[\s\S]*?min-height:\s*26px/)
    expect(css).toMatch(
      /\.text-patch-view \.patch-input-pane[\s\S]*?grid-template-rows:\s*22px minmax\(0, 1fr\)/,
    )
    expect(css).toMatch(/\.text-patch-view \.patch-line\s*\{[\s\S]*?line-height:\s*20px/)
    expect(css).toMatch(/\.text-patch-view \.path-side-footer\s*\{[\s\S]*?font-size:\s*10px/)

    expect(patchView).toMatch(/\.patch-workbench-main\s*\{[\s\S]*?padding:\s*4px 6px/)
    expect(patchView).toMatch(/\.patch-toolbar\s*\{[\s\S]*?min-height:\s*26px/)
    expect(patchView).toMatch(/\.patch-input-pane\s*\{[\s\S]*?grid-template-rows:\s*22px/)
    expect(patchView).toMatch(/\.patch-line\s*\{[\s\S]*?line-height:\s*20px/)
    expect(patchView).toMatch(/\.path-side-footer\s*\{[\s\S]*?font-size:\s*10px/)
    expect(patchView).toMatch(/chromeKind:\s*'text-session'/)

    expect(layout).toMatch(/\.status-bar\[data-chrome-kind='text-session'\][\s\S]*?height:\s*22px/)
  })
})
