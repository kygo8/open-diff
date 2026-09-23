import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..')
const css = readFileSync(resolve(root, 'src/styles/main.css'), 'utf8')
const patchView = readFileSync(resolve(root, 'src/views/TextPatchView.vue'), 'utf8')
const layout = readFileSync(resolve(root, 'src/layouts/AppLayout.vue'), 'utf8')

describe('text patch chrome density', () => {
  it('keeps Text Patch path/toolbar/editor/status chrome at capture CSS scale', () => {
    expect(css).toMatch(/\.text-patch-view \.patch-workbench-main\s*\{[\s\S]*?padding:\s*2px 4px/)
    expect(css).toMatch(/\.text-patch-view \.patch-toolbar\s*\{[\s\S]*?min-height:\s*18px/)
    expect(css).toMatch(
      /\.text-patch-view \.patch-input-pane[\s\S]*?grid-template-rows:\s*20px minmax\(0, 1fr\)/,
    )
    expect(css).toMatch(/\.text-patch-view \.patch-line\s*\{[\s\S]*?line-height:\s*18px/)
    expect(css).toMatch(/\.text-patch-view \.path-side-footer\s*\{[\s\S]*?font-size:\s*11px/)
    expect(css).toMatch(/\.text-patch-view \.path-side-footer\s*\{[\s\S]*?min-height:\s*18px/)
    expect(css).toMatch(/\.text-patch-view \.path-side-footer\s*\{[\s\S]*?line-height:\s*16px/)

    expect(patchView).toMatch(/\.patch-workbench-main\s*\{[\s\S]*?padding:\s*2px 4px/)
    expect(patchView).toMatch(/\.patch-toolbar\s*\{[\s\S]*?min-height:\s*18px/)
    expect(patchView).toMatch(/\.patch-input-pane\s*\{[\s\S]*?grid-template-rows:\s*20px/)
    expect(patchView).toMatch(/\.patch-line\s*\{[\s\S]*?line-height:\s*18px/)
    expect(patchView).toMatch(/\.path-side-footer\s*\{[\s\S]*?font-size:\s*11px/)
    expect(patchView).toMatch(/\.path-side-footer\s*\{[\s\S]*?min-height:\s*18px/)
    expect(patchView).toMatch(/SessionPathActions/)
    expect(patchView).toMatch(/PathMetaFooter/)
    expect(patchView).toMatch(/chromeKind:\s*'text-session'/)
    expect(patchView).not.toMatch(/font-size:\s*9px/)
    expect(patchView).not.toMatch(/min-height:\s*9px/)

    expect(layout).toMatch(
      /\.status-bar\[data-chrome-kind='text-session'\][\s\S]*?height:\s*19\.5px/,
    )
    expect(css).toMatch(/\.bc-session-toolbar\s*\{[\s\S]*?min-height:\s*39\.5px/)
  })

  it('keeps Text Patch chrome on capture band with Text Compare path scale', () => {
    expect(css).toMatch(/\.text-patch-view \.patch-toolbar \.n-button[\s\S]*?height:\s*18px/)
    expect(css).toMatch(/\.text-patch-view \.patch-hunk > header\s*\{[\s\S]*?line-height:\s*16px/)
    expect(css).toMatch(
      /\.text-patch-view \.patch-line\s*\{[\s\S]*?36px 36px 18px minmax\(0, 1fr\)/,
    )
    expect(css).toMatch(/\.text-patch-view \.patch-preview-row\s*\{[\s\S]*?min-height:\s*18px/)

    expect(patchView).toMatch(/\.patch-open-file\s*\{[\s\S]*?height:\s*20px/)
    expect(patchView).toMatch(/\.path-field-row\s*\{[\s\S]*?min-height:\s*18px/)
    expect(patchView).toMatch(/\.path-field-row input[\s\S]*?height:\s*20px/)
    expect(patchView).toMatch(/\.path-field-row input[\s\S]*?font-size:\s*12px/)
    expect(css).toMatch(/\.text-patch-view \.path-field-row input[\s\S]*?height:\s*20px/)
    expect(css).toMatch(/\.text-patch-view \.path-field-row input[\s\S]*?font-size:\s*12px/)
    expect(patchView).toMatch(/\.patch-section-pane-body\s*\{[\s\S]*?line-height:\s*18px/)
    expect(patchView).toMatch(/:deep\(\.patch-toolbar \.n-button\)[\s\S]*?height:\s*18px/)
  })
})

describe('text patch section nav residual', () => {
  it('keeps Text Patch section-nav and open-compare chrome on the capture band', () => {
    expect(patchView).toMatch(/data-testid="patch-section-nav-chrome"/)
    expect(patchView).toMatch(/data-section-nav-density="capture-1to1"/)
    expect(patchView).toMatch(/data-secondary-density="capture-1to1"/)
    expect(patchView).toMatch(/patch-path-meta-strip/)
    expect(patchView).toMatch(/\.patch-section-nav-chrome\s*\{[\s\S]*?min-height:\s*20px/)
    expect(patchView).toMatch(/\.patch-section-nav-chrome\s*\{[\s\S]*?background:\s*#f5f5f5/)
    expect(patchView).toMatch(/\.patch-path-meta-strip\s*\{[\s\S]*?background:\s*#f0f0f0/)
    expect(css).toMatch(
      /\.text-patch-view \.patch-section-nav-chrome\s*\{[\s\S]*?min-height:\s*20px/,
    )
    expect(css).toMatch(
      /\.text-patch-view \.patch-path-meta-strip\s*\{[\s\S]*?background:\s*#f0f0f0/,
    )
    expect(patchView).not.toMatch(/min-height:\s*6px/)
  })
})
