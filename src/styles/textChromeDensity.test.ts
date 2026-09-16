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
    expect(css).toMatch(/\.text-compare-view\s*\{[\s\S]*?padding:\s*2px 4px/)
    expect(css).toMatch(/\.text-compare-view \.bc-path-row\s*\{[\s\S]*?min-height:\s*20px/)
    expect(css).toMatch(/\.text-compare-view \.bc-path-row input\s*\{[\s\S]*?height:\s*16px/)
    expect(css).toMatch(/\.text-compare-view \.path-side-footer\s*\{[\s\S]*?font-size:\s*9px/)
    expect(css).toMatch(/\.text-compare-view \.diff-header\s*\{[\s\S]*?height:\s*20px/)

    expect(textView).toMatch(/\.text-workbench-main\s*\{[\s\S]*?padding:\s*2px 4px/)
    expect(textView).toMatch(/\.bc-path-block\s*\{[\s\S]*?gap:\s*1px/)
    expect(textView).toMatch(/\.path-side-footer\s*\{[\s\S]*?font-size:\s*9px/)
    expect(textView).toMatch(/\.toolbar-button\s*\{[\s\S]*?height:\s*18px/)

    expect(diffPanel).toMatch(/const textDiffRowHeightPx = 18/)
    expect(diffPanel).toMatch(/\.diff-header\s*\{[\s\S]*?height:\s*20px/)
    expect(diffPanel).toMatch(/\.gutter\s*\{[\s\S]*?padding:\s*0 4px/)

    expect(layout).toMatch(/\.status-bar\[data-chrome-kind='text-session'\][\s\S]*?height:\s*22px/)
  })

  it('keeps Text Compare toolbar/gutter/header/wrap chrome dense one more notch', () => {
    expect(css).toMatch(/\.text-compare-view \.toolbar-button\s*\{[\s\S]*?height:\s*18px/)
    expect(css).toMatch(/\.text-compare-view \.diff-context-input\s*\{[\s\S]*?height:\s*16px/)
    expect(css).toMatch(/\.text-compare-view \.diff-row\s*\{[\s\S]*?36px minmax\(0, 1fr\) 36px/)
    expect(css).toMatch(/\.text-compare-view \.gutter[\s\S]*?line-height:\s*16px/)

    expect(textView).toMatch(/\.text-rules-panel\s*\{[\s\S]*?padding:\s*2px 4px/)
    expect(textView).toMatch(/\.text-context-panel\s*\{[\s\S]*?padding:\s*2px 4px/)
    expect(textView).toMatch(/\.compare-toolbar\s*\{[\s\S]*?gap:\s*2px/)

    expect(diffPanel).toMatch(/grid-template-columns:\s*36px minmax\(0, 1fr\) 36px/)
    expect(diffPanel).toMatch(/\.diff-tools\s*\{[\s\S]*?gap:\s*4px/)
    expect(diffPanel).toMatch(/\.diff-option-button\s*\{[\s\S]*?height:\s*16px/)
    expect(diffPanel).toMatch(/\.cell\s*\{[\s\S]*?line-height:\s*16px/)
  })
})
