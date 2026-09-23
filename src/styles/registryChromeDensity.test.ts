import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..')
const css = readFileSync(resolve(root, 'src/styles/main.css'), 'utf8')
const registryView = readFileSync(resolve(root, 'src/views/RegistryCompareView.vue'), 'utf8')
const layout = readFileSync(resolve(root, 'src/layouts/AppLayout.vue'), 'utf8')

describe('registry compare chrome density', () => {
  it('keeps Registry Compare path/status/toolbar/footer chrome at capture CSS scale', () => {
    expect(css).toMatch(/\.registry-compare-view\s*\{[\s\S]*?padding:\s*2px 4px/)
    expect(css).toMatch(
      /\.registry-compare-view \.registry-input-panel\s*\{[\s\S]*?min-height:\s*22px/,
    )
    expect(css).toMatch(
      /\.registry-compare-view \.registry-report-panel\s*\{[\s\S]*?padding:\s*4px 6px/,
    )
    expect(css).toMatch(
      /\.registry-compare-view \.registry-report-panel header\s*\{[\s\S]*?gap:\s*6px/,
    )
    expect(css).toMatch(/\.registry-compare-view \.path-side-footer\s*\{[\s\S]*?font-size:\s*11px/)
    expect(css).toMatch(/\.registry-compare-view \.path-side-footer\s*\{[\s\S]*?min-height:\s*18px/)
    expect(css).toMatch(
      /\.registry-compare-view \.path-side-footer\s*\{[\s\S]*?line-height:\s*16px/,
    )

    expect(registryView).toMatch(/\.registry-compare-view\s*\{[\s\S]*?padding:\s*2px 4px/)
    expect(registryView).toMatch(/\.path-side-footer\s*\{[\s\S]*?font-size:\s*11px/)
    expect(registryView).toMatch(/\.path-side-footer\s*\{[\s\S]*?min-height:\s*18px/)
    expect(registryView).toMatch(/SessionPathActions/)
    expect(registryView).toMatch(/PathMetaFooter/)
    expect(registryView).toMatch(/chromeKind:\s*'registry-session'/)
    expect(registryView).toMatch(/sessions:\s*true/)
    expect(registryView).not.toMatch(/font-size:\s*9px/)
    expect(registryView).not.toMatch(/min-height:\s*9px/)

    expect(layout).toMatch(/data-chrome-kind='registry-session'[\s\S]*?height:\s*19\.5px/)
    expect(css).toMatch(/\.bc-session-toolbar\s*\{[\s\S]*?min-height:\s*39\.5px/)
  })

  it('keeps Registry summary/pane/row chrome on capture band', () => {
    expect(css).toMatch(
      /\.registry-compare-view \.registry-summary-item\s*\{[\s\S]*?padding:\s*2px 6px/,
    )
    expect(css).toMatch(
      /\.registry-compare-view \.registry-summary-item strong\s*\{[\s\S]*?font-size:\s*12px/,
    )
    expect(css).toMatch(/\.registry-compare-view \.registry-key-pane[\s\S]*?padding:\s*4px 6px/)
    expect(css).toMatch(/\.registry-compare-view \.registry-key-row\s*\{[\s\S]*?min-height:\s*18px/)
    expect(css).toMatch(
      /\.registry-compare-view \.registry-value-row\s*\{[\s\S]*?min-height:\s*18px/,
    )
    expect(css).toMatch(
      /\.registry-compare-view \.registry-value-row > \*\s*\{[\s\S]*?padding:\s*2px 6px/,
    )
    expect(css).toMatch(
      /\.registry-compare-view \.registry-input-panel textarea\s*\{[\s\S]*?padding:\s*2px 6px/,
    )
    expect(css).toMatch(
      /\.registry-compare-view \.registry-input-panel textarea\s*\{[\s\S]*?min-height:\s*64px/,
    )
    expect(css).toMatch(
      /\.registry-compare-view \.registry-report-panel\s*\{[\s\S]*?border:\s*1px solid #a0a0a0/,
    )

    expect(registryView).toMatch(/data-registry-chrome-density="capture-1to1"/)
    expect(registryView).toMatch(/data-registry-rows-density="capture-1to1"/)
    expect(registryView).toMatch(/\.registry-report-panel\s*\{[\s\S]*?padding:\s*4px 6px/)
    expect(registryView).toMatch(/\.registry-report-panel header\s*\{[\s\S]*?gap:\s*6px/)
    expect(registryView).toMatch(/\.registry-summary-item\s*\{[\s\S]*?padding:\s*2px 6px/)
    expect(registryView).toMatch(/\.registry-summary-item strong\s*\{[\s\S]*?font-size:\s*12px/)
    expect(registryView).toMatch(/\.registry-key-pane[\s\S]*?padding:\s*4px 6px/)
    expect(registryView).toMatch(/\.registry-key-row\s*\{[\s\S]*?min-height:\s*18px/)
    expect(registryView).toMatch(/\.registry-value-row\s*\{[\s\S]*?min-height:\s*18px/)
    expect(registryView).toMatch(/\.registry-value-row > \*\s*\{[\s\S]*?padding:\s*2px 6px/)
    expect(registryView).toMatch(/\.registry-input-panel textarea\s*\{[\s\S]*?padding:\s*2px 6px/)
    expect(registryView).toMatch(/\.registry-input-panel textarea\s*\{[\s\S]*?min-height:\s*64px/)
    expect(registryView).toMatch(
      /\.registry-input-panel textarea,\s*\.registry-input-panel button\s*\{[\s\S]*?border-radius:\s*0/,
    )
    expect(registryView).toMatch(
      /\.registry-filter-bar button,\s*\.registry-live-row button,\s*\.registry-live-row input\s*\{[\s\S]*?border-radius:\s*0/,
    )
  })
})

describe('registry secondary strip density', () => {
  it('keeps Registry secondary path-meta strip on capture band', () => {
    expect(registryView).toMatch(/data-testid="registry-path-footers"/)
    expect(registryView).toMatch(/data-secondary-density="capture-1to1"/)
    expect(registryView).toMatch(/registry-secondary-strip/)
    expect(registryView).toMatch(/\.registry-secondary-strip\s*\{[\s\S]*?min-height:\s*18px/)
    expect(registryView).toMatch(/\.registry-secondary-strip\s*\{[\s\S]*?background:\s*#f5f5f5/)
    expect(registryView).toMatch(
      /\.registry-secondary-strip :deep\(\.path-meta-footer\)\s*\{[\s\S]*?gap:\s*6px/,
    )
    expect(css).toMatch(
      /\.registry-compare-view \.registry-secondary-strip\s*\{[\s\S]*?min-height:\s*18px/,
    )
    expect(css).toMatch(
      /\.registry-compare-view \.registry-secondary-strip\s*\{[\s\S]*?background:\s*#f5f5f5/,
    )
    expect(css).toMatch(/\.registry-compare-view \.path-side-footer\s*\{[\s\S]*?min-height:\s*18px/)
    expect(registryView).not.toMatch(/min-height:\s*6px/)
  })
})
