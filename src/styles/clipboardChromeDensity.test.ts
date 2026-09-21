import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..')
const css = readFileSync(resolve(root, 'src/styles/main.css'), 'utf8')
const clipboardView = readFileSync(resolve(root, 'src/views/ClipboardCompareView.vue'), 'utf8')
const layout = readFileSync(resolve(root, 'src/layouts/AppLayout.vue'), 'utf8')

describe('clipboard compare chrome density', () => {
  it('keeps Clipboard Compare toolbar/history/status chrome dense toward capture', () => {
    expect(css).toMatch(/\.clipboard-compare-view\s*\{[\s\S]*?padding:\s*2px 4px/)
    expect(css).toMatch(
      /\.clipboard-compare-view \.clipboard-toolbar\s*\{[\s\S]*?min-height:\s*20px/,
    )
    expect(css).toMatch(/\.clipboard-compare-view \.history-entry\s*\{[\s\S]*?padding:\s*1px 4px/)

    expect(clipboardView).toMatch(/\.clipboard-compare-view\s*\{[\s\S]*?padding:\s*2px 4px/)
    expect(clipboardView).toMatch(/chromeKind:\s*'clipboard-session'/)

    expect(layout).toMatch(/data-chrome-kind='clipboard-session'[\s\S]*?height:\s*20px/)
  })

  it('keeps Clipboard history pane/entry chrome dense one more notch toward capture', () => {
    expect(css).toMatch(/\.clipboard-compare-view \.history-pane\s*\{[\s\S]*?padding:\s*1px 4px/)
    expect(css).toMatch(
      /\.clipboard-compare-view \.history-pane header\s*\{[\s\S]*?min-height:\s*16px/,
    )
    expect(css).toMatch(/\.clipboard-compare-view \.history-entry\s*\{[\s\S]*?min-height:\s*20px/)

    expect(clipboardView).toMatch(/\.history-pane\s*\{[\s\S]*?padding:\s*1px 4px/)
    expect(clipboardView).toMatch(/\.history-pane header\s*\{[\s\S]*?min-height:\s*16px/)
    expect(clipboardView).toMatch(/\.history-entry\s*\{[\s\S]*?min-height:\s*20px/)
    expect(clipboardView).toMatch(/\.history-entry\s*\{[\s\S]*?padding:\s*1px 4px/)
  })
})
