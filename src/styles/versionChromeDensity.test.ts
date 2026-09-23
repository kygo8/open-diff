import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..')
const css = readFileSync(resolve(root, 'src/styles/main.css'), 'utf8')
const versionView = readFileSync(resolve(root, 'src/views/VersionCompareView.vue'), 'utf8')
const layout = readFileSync(resolve(root, 'src/layouts/AppLayout.vue'), 'utf8')

describe('version compare chrome density', () => {
  it('keeps Version Compare path/status/toolbar/footer chrome at capture CSS scale', () => {
    expect(css).toMatch(/\.version-compare-view\s*\{[\s\S]*?padding:\s*2px 4px/)
    expect(css).toMatch(
      /\.version-compare-view \.version-path-panel\s*\{[\s\S]*?min-height:\s*20px/,
    )
    expect(css).toMatch(
      /\.version-compare-view \.version-path-panel input,\s*\.version-compare-view \.version-path-panel button\s*\{[\s\S]*?height:\s*20px/,
    )
    expect(css).toMatch(/\.version-compare-view \.path-side-footer\s*\{[\s\S]*?font-size:\s*11px/)
    expect(css).toMatch(/\.version-compare-view \.path-side-footer\s*\{[\s\S]*?min-height:\s*18px/)
    expect(css).toMatch(/\.version-compare-view \.path-side-footer\s*\{[\s\S]*?line-height:\s*16px/)

    expect(versionView).toMatch(/\.version-compare-view\s*\{[\s\S]*?padding:\s*2px 4px/)
    expect(versionView).toMatch(/\.path-side-footer\s*\{[\s\S]*?font-size:\s*11px/)
    expect(versionView).toMatch(/\.path-side-footer\s*\{[\s\S]*?min-height:\s*18px/)
    expect(versionView).toMatch(/SessionPathActions/)
    expect(versionView).toMatch(/PathMetaFooter/)
    expect(versionView).toMatch(/\.version-path-panel input\s*\{[\s\S]*?height:\s*20px/)
    expect(versionView).toMatch(/chromeKind:\s*'version-session'/)
    expect(versionView).toMatch(/sessions:\s*true/)
    expect(versionView).not.toMatch(/font-size:\s*9px/)
    expect(versionView).not.toMatch(/min-height:\s*9px/)

    expect(layout).toMatch(/data-chrome-kind='version-session'[\s\S]*?height:\s*19\.5px/)
    expect(css).toMatch(/\.bc-session-toolbar\s*\{[\s\S]*?min-height:\s*39\.5px/)
  })

  it('keeps Version summary/side/report/rules/row chrome on capture band', () => {
    expect(css).toMatch(/\.version-compare-view \.version-report-panel[\s\S]*?padding:\s*4px 6px/)
    expect(css).toMatch(/\.version-compare-view \.version-rules-panel[\s\S]*?padding:\s*4px 6px/)
    expect(css).toMatch(
      /\.version-compare-view \.version-report-panel[\s\S]*?border:\s*1px solid #a0a0a0/,
    )
    expect(css).toMatch(/\.version-compare-view \.version-field-row\s*\{[\s\S]*?min-height:\s*18px/)
    expect(css).toMatch(
      /\.version-compare-view \.version-summary-item strong\s*\{[\s\S]*?font-size:\s*12px/,
    )
    expect(css).toMatch(
      /\.version-compare-view \.version-report-panel header button[\s\S]*?height:\s*18px/,
    )
    expect(css).toMatch(/\.version-compare-view \.version-rule-row\s*\{[\s\S]*?min-height:\s*18px/)
    expect(css).toMatch(/\.version-compare-view \.version-side header[\s\S]*?min-height:\s*20px/)

    expect(versionView).toMatch(/data-version-chrome-density="capture-1to1"/)
    expect(versionView).toMatch(/data-version-rows-density="capture-1to1"/)
    expect(versionView).toMatch(/\.version-summary-item[\s\S]*?padding:\s*4px 6px/)
    expect(versionView).toMatch(/\.version-report-panel[\s\S]*?padding:\s*4px 6px/)
    expect(versionView).toMatch(/\.version-rules-panel[\s\S]*?padding:\s*4px 6px/)
    expect(versionView).toMatch(/\.version-summary-item strong\s*\{[\s\S]*?font-size:\s*12px/)
    expect(versionView).toMatch(/\.version-field-row\s*\{[\s\S]*?min-height:\s*18px/)
    expect(versionView).toMatch(/\.version-field-row\s*\{[\s\S]*?font-size:\s*11px/)
    expect(versionView).toMatch(/\.version-field-row > \*\s*\{[\s\S]*?padding:\s*2px 6px/)
    expect(versionView).toMatch(/\.version-field-row > \*\s*\{[\s\S]*?line-height:\s*16px/)
    expect(versionView).toMatch(/\.version-side dl div\s*\{[\s\S]*?padding:\s*2px 6px/)
    expect(versionView).toMatch(/\.version-rule-row\s*\{[\s\S]*?min-height:\s*18px/)
  })
})

describe('version secondary strip density', () => {
  it('keeps Version secondary path-meta strip on capture band', () => {
    expect(versionView).toMatch(/data-testid="version-path-footers"/)
    expect(versionView).toMatch(/data-secondary-density="capture-1to1"/)
    expect(versionView).toMatch(/version-secondary-strip/)
    expect(versionView).toMatch(/\.version-secondary-strip\s*\{[\s\S]*?min-height:\s*18px/)
    expect(versionView).toMatch(/\.version-secondary-strip\s*\{[\s\S]*?background:\s*#f5f5f5/)
    expect(versionView).toMatch(
      /\.version-secondary-strip :deep\(\.path-meta-footer\)\s*\{[\s\S]*?gap:\s*6px/,
    )
    expect(css).toMatch(
      /\.version-compare-view \.version-secondary-strip\s*\{[\s\S]*?min-height:\s*18px/,
    )
    expect(css).toMatch(
      /\.version-compare-view \.version-secondary-strip\s*\{[\s\S]*?background:\s*#f5f5f5/,
    )
    expect(css).toMatch(/\.version-compare-view \.path-side-footer\s*\{[\s\S]*?min-height:\s*18px/)
    expect(versionView).not.toMatch(/min-height:\s*6px/)
  })
})
