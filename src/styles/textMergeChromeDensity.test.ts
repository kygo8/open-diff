import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..')
const css = readFileSync(resolve(root, 'src/styles/main.css'), 'utf8')
const mergeView = readFileSync(resolve(root, 'src/views/TextMergeView.vue'), 'utf8')
const layout = readFileSync(resolve(root, 'src/layouts/AppLayout.vue'), 'utf8')

describe('text merge chrome density', () => {
  it('keeps Text Merge path/toolbar/editor/status chrome at capture CSS scale', () => {
    expect(css).toMatch(/\.text-merge-view\s*\{[\s\S]*?padding:\s*2px 4px/)
    expect(css).toMatch(/\.text-merge-view \.merge-toolbar\s*\{[\s\S]*?min-height:\s*20px/)
    expect(css).toMatch(/\.text-merge-view \.toolbar-button\s*\{[\s\S]*?height:\s*18px/)
    expect(css).toMatch(/\.text-merge-view \.pane-header\s*\{[\s\S]*?min-height:\s*20px/)
    expect(css).toMatch(/\.text-merge-view \.output-editor\s*\{[\s\S]*?line-height:\s*18px/)
    expect(css).toMatch(/\.text-merge-view \.output-path-input\s*\{[\s\S]*?height:\s*20px/)

    expect(mergeView).toMatch(/\.text-merge-view\s*\{[\s\S]*?padding:\s*2px 4px/)
    expect(mergeView).toMatch(/\.merge-toolbar\s*\{[\s\S]*?min-height:\s*20px/)
    expect(mergeView).toMatch(/\.toolbar-button\s*\{[\s\S]*?height:\s*18px/)
    expect(mergeView).toMatch(/\.pane-header\s*\{[\s\S]*?min-height:\s*20px/)
    expect(mergeView).toMatch(/\.output-path-input\s*\{[\s\S]*?height:\s*20px/)
    expect(mergeView).toMatch(/chromeKind:\s*'text-session'/)
    expect(mergeView).not.toMatch(/\.output-path-input\s*\{[^}]*height:\s*16px/)

    expect(layout).toMatch(/\.status-bar\[data-chrome-kind='text-session'\][\s\S]*?height:\s*20px/)
    expect(css).toMatch(/\.bc-session-toolbar\s*\{[\s\S]*?min-height:\s*38px/)
  })

  it('keeps Text Merge three-pane chrome on capture band', () => {
    expect(css).toMatch(/\.text-merge-view \.merge-lines li\s*\{[\s\S]*?min-height:\s*18px/)
    expect(css).toMatch(/\.text-merge-view \.merge-lines\s*\{[\s\S]*?line-height:\s*16px/)
    expect(css).toMatch(/\.text-merge-view \.conflict-panel\s*\{[\s\S]*?padding:\s*2px 4px/)

    expect(mergeView).toMatch(/\.merge-lines li\s*\{[\s\S]*?min-height:\s*18px/)
    expect(mergeView).toMatch(/grid-template-columns:\s*36px minmax\(0, 1fr\)/)
    expect(mergeView).toMatch(/\.output-editor\s*\{[\s\S]*?line-height:\s*18px/)
  })
})
