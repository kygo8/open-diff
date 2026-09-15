import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..')
const css = readFileSync(resolve(root, 'src/styles/main.css'), 'utf8')
const textView = readFileSync(resolve(root, 'src/views/TextCompareView.vue'), 'utf8')
const diffPanel = readFileSync(resolve(root, 'src/components/diff/TextDiffPanel.vue'), 'utf8')
const layout = readFileSync(resolve(root, 'src/layouts/AppLayout.vue'), 'utf8')

describe('text compare chrome density', () => {
  it('keeps Text Compare path/status/editor chrome dense toward capture', () => {
    expect(css).toMatch(/\.text-compare-view\s*\{[\s\S]*?padding:\s*4px 6px/)
    expect(css).toMatch(/\.text-compare-view \.bc-path-row\s*\{[\s\S]*?min-height:\s*26px/)
    expect(css).toMatch(/\.text-compare-view \.bc-path-row input\s*\{[\s\S]*?height:\s*20px/)
    expect(css).toMatch(/\.text-compare-view \.path-side-footer\s*\{[\s\S]*?font-size:\s*10px/)
    expect(css).toMatch(/\.text-compare-view \.diff-header\s*\{[\s\S]*?height:\s*22px/)

    expect(textView).toMatch(/\.text-workbench-main\s*\{[\s\S]*?padding:\s*4px 6px/)
    expect(textView).toMatch(/\.bc-path-block\s*\{[\s\S]*?gap:\s*1px/)
    expect(textView).toMatch(/\.path-side-footer\s*\{[\s\S]*?font-size:\s*10px/)
    expect(textView).toMatch(/\.toolbar-button\s*\{[\s\S]*?height:\s*22px/)

    expect(diffPanel).toMatch(/const textDiffRowHeightPx = 20/)
    expect(diffPanel).toMatch(/\.diff-header\s*\{[\s\S]*?height:\s*22px/)
    expect(diffPanel).toMatch(/\.gutter\s*\{[\s\S]*?padding:\s*1px 6px/)

    expect(layout).toMatch(/\.status-bar\[data-chrome-kind='text-session'\][\s\S]*?height:\s*22px/)
  })
})
