import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..')
const css = readFileSync(resolve(root, 'src/styles/main.css'), 'utf8')
const clipboardView = readFileSync(resolve(root, 'src/views/ClipboardCompareView.vue'), 'utf8')
const layout = readFileSync(resolve(root, 'src/layouts/AppLayout.vue'), 'utf8')

describe('clipboard compare chrome density', () => {
  it('keeps Clipboard Compare toolbar/history/status chrome at capture CSS scale', () => {
    expect(css).toMatch(/\.clipboard-compare-view\s*\{[\s\S]*?padding:\s*2px 4px/)
    expect(css).toMatch(
      /\.clipboard-compare-view \.clipboard-toolbar\s*\{[\s\S]*?min-height:\s*22px/,
    )
    expect(css).toMatch(
      /\.clipboard-compare-view \.clipboard-toolbar\s*\{[\s\S]*?border:\s*1px solid #a0a0a0/,
    )
    expect(css).toMatch(
      /\.clipboard-compare-view \.clipboard-toolbar \.n-button[\s\S]*?height:\s*18px/,
    )
    expect(css).toMatch(/\.clipboard-compare-view \.history-entry\s*\{[\s\S]*?padding:\s*2px 6px/)
    expect(css).toMatch(
      /\.clipboard-compare-view \.path-side-footer\s*\{[\s\S]*?line-height:\s*16px/,
    )

    expect(clipboardView).toMatch(/data-clipboard-chrome-density="capture-1to1"/)
    expect(clipboardView).toMatch(/\.clipboard-compare-view\s*\{[\s\S]*?padding:\s*2px 4px/)
    expect(clipboardView).toMatch(/chromeKind:\s*'clipboard-session'/)
    expect(clipboardView).toMatch(/PathMetaFooter/)
    expect(clipboardView).toMatch(/clipboard-path-footers/)
    expect(clipboardView).toMatch(/:deep\(\.clipboard-toolbar \.n-button\)[\s\S]*?height:\s*18px/)
    expect(clipboardView).not.toMatch(/font-size:\s*9px/)
    expect(clipboardView).not.toMatch(/min-height:\s*9px/)

    expect(layout).toMatch(/data-chrome-kind='clipboard-session'[\s\S]*?height:\s*19\.5px/)
    expect(css).toMatch(/\.bc-session-toolbar\s*\{[\s\S]*?min-height:\s*38px/)
  })

  it('keeps Clipboard history pane/entry chrome on capture band', () => {
    expect(css).toMatch(/\.clipboard-compare-view \.history-pane\s*\{[\s\S]*?padding:\s*4px 6px/)
    expect(css).toMatch(
      /\.clipboard-compare-view \.history-pane header\s*\{[\s\S]*?min-height:\s*20px/,
    )
    expect(css).toMatch(/\.clipboard-compare-view \.history-entry\s*\{[\s\S]*?min-height:\s*18px/)
    expect(css).toMatch(
      /\.clipboard-compare-view \.history-entry\s*\{[\s\S]*?border:\s*1px solid #a0a0a0/,
    )

    expect(clipboardView).toMatch(/data-clipboard-rows-density="capture-1to1"/)
    expect(clipboardView).toMatch(/\.history-pane\s*\{[\s\S]*?padding:\s*4px 6px/)
    expect(clipboardView).toMatch(/\.history-pane header\s*\{[\s\S]*?min-height:\s*20px/)
    expect(clipboardView).toMatch(/\.history-entry\s*\{[\s\S]*?min-height:\s*18px/)
    expect(clipboardView).toMatch(/\.history-entry\s*\{[\s\S]*?padding:\s*2px 6px/)
    expect(clipboardView).toMatch(/\.history-pane header span\s*\{[\s\S]*?line-height:\s*16px/)
  })
})
