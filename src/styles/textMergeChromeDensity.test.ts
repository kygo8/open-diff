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
    expect(css).toMatch(/\.text-merge-view \.pane-header\s*\{[\s\S]*?min-height:\s*18px/)
    expect(css).toMatch(/\.text-merge-view \.output-editor\s*\{[\s\S]*?line-height:\s*16px/)
    expect(css).toMatch(/\.text-merge-view \.output-path-input\s*\{[\s\S]*?height:\s*20px/)

    expect(mergeView).toMatch(/\.text-merge-view\s*\{[\s\S]*?padding:\s*2px 4px/)
    expect(mergeView).toMatch(/\.merge-toolbar\s*\{[\s\S]*?min-height:\s*20px/)
    expect(mergeView).toMatch(/\.toolbar-button\s*\{[\s\S]*?height:\s*18px/)
    expect(mergeView).toMatch(/\.pane-header\s*\{[\s\S]*?min-height:\s*18px/)
    expect(mergeView).toMatch(/\.output-path-input\s*\{[\s\S]*?height:\s*20px/)
    expect(mergeView).toMatch(/chromeKind:\s*'text-session'/)
    expect(mergeView).toMatch(/session-toolbar-wrap/)
    expect(mergeView).toMatch(/SessionSettingsDialog/)
    expect(mergeView).toMatch(/PathMetaFooter/)
    expect(mergeView).toMatch(/merge-path-footers/)
    expect(css).toMatch(
      /\.bc-session-toolbar\.bc-session-toolbar-wrap\s*\{[\s\S]*?min-height:\s*83px/,
    )
    expect(css).toMatch(
      /\.bc-session-toolbar\.bc-session-toolbar-wrap\s*\{[\s\S]*?flex-wrap:\s*wrap/,
    )
    expect(mergeView).toMatch(/SessionPathActions/)
    expect(mergeView).toMatch(/bc-path-load/)
    expect(mergeView).not.toMatch(/\.output-path-input\s*\{[^}]*height:\s*16px/)

    expect(layout).toMatch(
      /\.status-bar\[data-chrome-kind='text-session'\][\s\S]*?height:\s*19\.5px/,
    )
    expect(css).toMatch(/\.bc-session-toolbar\s*\{[\s\S]*?min-height:\s*39\.5px/)
  })

  it('keeps Text Merge three-pane chrome on capture band', () => {
    expect(css).toMatch(/\.text-merge-view \.merge-lines li\s*\{[\s\S]*?min-height:\s*18px/)
    expect(css).toMatch(/\.text-merge-view \.merge-lines\s*\{[\s\S]*?line-height:\s*16px/)
    expect(css).toMatch(/\.text-merge-view \.conflict-panel\s*\{[\s\S]*?padding:\s*2px 4px/)

    expect(mergeView).toMatch(/\.merge-lines li\s*\{[\s\S]*?min-height:\s*18px/)
    expect(mergeView).toMatch(/grid-template-columns:\s*36px minmax\(0, 1fr\)/)
    expect(mergeView).toMatch(/\.output-editor\s*\{[\s\S]*?line-height:\s*16px/)
  })
})

describe('text merge multi-pane path chrome density', () => {
  it('keeps Text Merge path chrome on the capture multi-pane band', () => {
    expect(mergeView).toMatch(/data-testid="merge-path-chrome"/)
    expect(mergeView).toMatch(/data-path-density="capture-1to1"/)
    expect(mergeView).toMatch(/\.merge-path-chrome\s*\{[\s\S]*?grid-template-columns:\s*repeat\(3/)
    expect(mergeView).toMatch(/\.merge-path-chrome\s*\{[\s\S]*?gap:\s*2px/)
    expect(mergeView).toMatch(/\.merge-path-swatch\s*\{[\s\S]*?width:\s*10px/)
    expect(mergeView).toMatch(/\.merge-path-footers\s*\{[\s\S]*?gap:\s*2px/)
    expect(mergeView).toMatch(/\.merge-to-chrome\s*\{[\s\S]*?min-height:\s*22px/)
    expect(css).toMatch(/\.text-merge-view \.merge-path-chrome\s*\{[\s\S]*?min-height:\s*22px/)
    expect(css).toMatch(/\.text-merge-view \.merge-to-chrome\s*\{[\s\S]*?min-height:\s*22px/)
    expect(css).toMatch(/\.text-merge-view \.merge-path-footers\s*\{[\s\S]*?gap:\s*2px/)
    expect(mergeView).not.toMatch(/\.merge-path-footers\s*\{[\s\S]*?gap:\s*8px/)
  })
})

describe('text merge editor pane residual', () => {
  it('keeps Text Merge editor pane chrome on the capture band (Clipboard swap)', () => {
    // No dedicated Clipboard capture PNG remains drifting after #322; swap to Text Merge editor.
    expect(mergeView).toMatch(/data-editor-chrome="capture-1to1"/)
    expect(mergeView).toMatch(/data-editor-density="capture-1to1"/)
    expect(mergeView).toMatch(/\.merge-grid\s*\{[\s\S]*?gap:\s*1px/)
    expect(mergeView).toMatch(/\.output-editor\s*\{[\s\S]*?line-height:\s*16px/)
    expect(mergeView).toMatch(/\.conflict-panel\s*\{[\s\S]*?background:\s*#f5f5f5/)
    expect(css).toMatch(/\.text-merge-view \.merge-grid\s*\{[\s\S]*?gap:\s*1px/)
    expect(css).toMatch(/\.text-merge-view \.pane-header\s*\{[\s\S]*?min-height:\s*18px/)
    expect(css).toMatch(/\.text-merge-view \.output-editor\s*\{[\s\S]*?line-height:\s*16px/)
    expect(mergeView).not.toMatch(/min-height:\s*6px/)
  })
})

describe('text merge conflict chrome residual', () => {
  it('keeps conflict panel and pane sync chrome residual toward capture', () => {
    expect(mergeView).toMatch(/data-conflict-chrome="capture-1to1-residual"/)
    expect(mergeView).toMatch(/data-pane-sync="capture-1to1-residual"/)
    expect(css).toMatch(
      /data-conflict-chrome='capture-1to1-residual'\][\s\S]*?background:\s*#f5f5f5/,
    )
    expect(css).toMatch(
      /data-pane-sync='capture-1to1-residual'\] \.pane-header[\s\S]*?min-height:\s*18px/,
    )
  })
})

describe('text merge path meta residual', () => {
  it('keeps Text Merge path meta footers on capture 18px band', () => {
    expect(mergeView).toMatch(
      /\.merge-path-footers \.path-meta-footer\s*\{[\s\S]*?min-height:\s*18px/,
    )
  })
})
