import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..')
const css = readFileSync(resolve(root, 'src/styles/main.css'), 'utf8')
const hexView = readFileSync(resolve(root, 'src/views/HexCompareView.vue'), 'utf8')
const layout = readFileSync(resolve(root, 'src/layouts/AppLayout.vue'), 'utf8')

describe('hex compare chrome density', () => {
  it('keeps Hex Compare path/status/toolbar/footer chrome at capture CSS scale', () => {
    expect(css).toMatch(/\.hex-compare-view\s*\{[\s\S]*?padding:\s*2px 4px/)
    expect(css).toMatch(/\.hex-compare-view \.bc-path-row\s*\{[\s\S]*?min-height:\s*18px/)
    expect(css).toMatch(/\.hex-compare-view \.bc-path-row input\s*\{[\s\S]*?height:\s*20px/)
    expect(hexView).toMatch(/\.hex-path-field \.path-input\s*\{[\s\S]*?height:\s*16\.5px/)
    expect(css).toMatch(/\.hex-compare-view \.path-side-footer\s*\{[\s\S]*?font-size:\s*11px/)
    expect(css).toMatch(/\.hex-compare-view \.path-side-footer\s*\{[\s\S]*?min-height:\s*18px/)
    expect(css).toMatch(/\.hex-compare-view \.path-side-footer\s*\{[\s\S]*?line-height:\s*16px/)
    expect(css).toMatch(/\.hex-compare-view \.hex-row\s*\{[\s\S]*?min-height:\s*16px/)

    expect(hexView).toMatch(/\.hex-compare-view\s*\{[\s\S]*?padding:\s*2px 4px/)
    expect(hexView).toMatch(/\.path-side-footer\s*\{[\s\S]*?font-size:\s*11px/)
    expect(hexView).toMatch(/\.path-side-footer\s*\{[\s\S]*?min-height:\s*18px/)
    expect(hexView).toMatch(/SessionPathActions/)
    expect(hexView).toMatch(/PathMetaFooter/)
    expect(hexView).toMatch(/\.hex-row\s*\{[\s\S]*?min-height:\s*16px/)
    expect(hexView).toMatch(/chromeKind:\s*'hex-session'/)
    expect(hexView).not.toMatch(/font-size:\s*9px/)
    expect(hexView).not.toMatch(/min-height:\s*9px/)

    expect(layout).toMatch(/data-chrome-kind='hex-session'[\s\S]*?height:\s*19\.5px/)
    expect(css).toMatch(/\.bc-session-toolbar\s*\{[\s\S]*?min-height:\s*39\.5px/)
  })

  it('keeps Hex wrap/gutter/row chrome on capture band', () => {
    expect(css).toMatch(
      /\.hex-compare-view \.hex-wrap-controls\s*\{[\s\S]*?border:\s*1px solid #a0a0a0/,
    )
    expect(css).toMatch(/\.hex-compare-view \.hex-wrap-controls\s*\{[\s\S]*?min-height:\s*22px/)
    expect(css).toMatch(/\.hex-compare-view \.hex-wrap-controls input[\s\S]*?height:\s*16\.5px/)
    expect(css).toMatch(/\.hex-compare-view \.hex-row\s*\{[\s\S]*?min-height:\s*16px/)
    expect(css).toMatch(/\.hex-compare-view \.hex-offset\s*\{[\s\S]*?background:\s*#f7f7f7/)

    expect(hexView).toMatch(/data-hex-chrome-density="capture-1to1"/)
    expect(hexView).toMatch(/data-hex-rows-density="capture-1to1"/)
    expect(hexView).toMatch(/\.hex-wrap-controls\s*\{[\s\S]*?border:\s*1px solid #a0a0a0/)
    expect(hexView).toMatch(/\.hex-wrap-controls\s*\{[\s\S]*?min-height:\s*22px/)
    expect(hexView).toMatch(/\.hex-wrap-controls strong\s*\{[\s\S]*?height:\s*20px/)
    expect(hexView).toMatch(/\.hex-wrap-controls span\s*\{[\s\S]*?line-height:\s*16px/)
    expect(hexView).toMatch(/\.hex-row\s*\{[\s\S]*?font-size:\s*11px/)
    expect(hexView).toMatch(/\.hex-offset\s*\{[\s\S]*?background:\s*#f7f7f7/)
  })

  it('keeps Hex summary/report/side chrome on capture band', () => {
    expect(css).toMatch(
      /\.hex-compare-view \.hex-summary,[\s\S]*?\.hex-compare-view \.hex-report-panel[\s\S]*?padding:\s*4px 6px/,
    )
    expect(css).toMatch(/\.hex-compare-view \.hex-report-panel header[\s\S]*?min-height:\s*18px/)
    expect(css).toMatch(/\.hex-compare-view \.hex-side[\s\S]*?padding:\s*4px 6px/)
    expect(css).toMatch(/\.hex-compare-view \.hex-summary strong\s*\{[\s\S]*?font-size:\s*12px/)

    expect(hexView).toMatch(/\.hex-summary\s*\{[\s\S]*?padding:\s*4px 6px/)
    expect(hexView).toMatch(/\.hex-report-panel\s*\{[\s\S]*?padding:\s*4px 6px/)
    expect(hexView).toMatch(/\.hex-report-panel header\s*\{[\s\S]*?min-height:\s*18px/)
    expect(hexView).toMatch(/\.hex-side\s*\{[\s\S]*?padding:\s*4px 6px/)
  })

  it('keeps Hex rules strip chrome on the session-panel band', () => {
    expect(hexView).toMatch(/data-hex-panel-density="capture-1to1"/)
    expect(hexView).toMatch(/\.hex-rules-panel\s*\{[\s\S]*?padding:\s*4px 6px/)
    expect(hexView).toMatch(/\.hex-rules-row\s*\{[\s\S]*?gap:\s*6px/)
    expect(hexView).toMatch(/\.hex-rules-row\s*\{[\s\S]*?min-height:\s*18px/)
    expect(hexView).toMatch(/\.hex-rules-row\s*\{[\s\S]*?margin:\s*0/)
    expect(hexView).toMatch(/\.hex-rules-row input\[type='number'\]\s*\{[\s\S]*?height:\s*20px/)
    expect(hexView).toMatch(/\.hex-rules-row ~ button\s*\{[\s\S]*?height:\s*20px/)
    expect(hexView).not.toMatch(/\.hex-rules-row\s*\{[\s\S]*?margin:\s*8px 0/)
    expect(css).toMatch(
      /\.hex-compare-view \.hex-rules-row input\[type='number'\][\s\S]*?height:\s*20px/,
    )
    expect(css).toMatch(/\.hex-compare-view \.hex-rules-panel\s*\{[\s\S]*?padding:\s*4px 6px/)
  })
})

describe('hex path and windowed grid chrome residual', () => {
  it('keeps Hex path chrome and windowed grid on the capture band', () => {
    expect(hexView).toMatch(/data-testid="hex-path-chrome"/)
    expect(hexView).toMatch(/data-path-density="capture-1to1"/)
    expect(hexView).toMatch(/data-secondary-density="capture-1to1"/)
    expect(hexView).toMatch(/hex-path-meta-strip/)
    expect(hexView).toMatch(
      /\.hex-path-fields\s*\{[\s\S]*?grid-template-columns:\s*minmax\(0, 1fr\) minmax\(0, 1fr\)/,
    )
    expect(hexView).toMatch(/\.hex-path-meta-strip\s*\{[\s\S]*?background:\s*#f0f0f0/)
    expect(hexView).toMatch(/\.hex-row\s*\{[\s\S]*?grid-template-columns:\s*72px/)
    expect(hexView).toMatch(/\.hex-byte-selected\s*\{[\s\S]*?background:\s*#a8ffff/)
    expect(css).toMatch(/\.hex-compare-view \.hex-path-fields\s*\{[\s\S]*?min-height:\s*22px/)
    expect(css).toMatch(
      /\.hex-compare-view \.hex-path-meta-strip\s*\{[\s\S]*?background:\s*#f0f0f0/,
    )
    expect(css).toMatch(/\.hex-compare-view \.hex-row\s*\{[\s\S]*?min-height:\s*16px/)
    expect(hexView).not.toMatch(/min-height:\s*6px/)
  })
})

it('keeps Hex path meta MIX EOL gap on capture residual', () => {
  expect(hexView).toMatch(
    /\.hex-path-meta-strip :deep\(\.path-meta-footer\)\s*\{[\s\S]*?gap:\s*6px/,
  )
})

describe('hex goto offset chrome residual', () => {
  it('keeps Hex Go To and offset chrome on the capture band', () => {
    expect(hexView).toMatch(/data-testid="hex-offset-chrome"/)
    expect(hexView).toMatch(/data-offset-density="capture-1to1"/)
    expect(hexView).toMatch(/data-goto-density="capture-1to1"/)
    expect(hexView).toMatch(/\.hex-offset-chrome\s*\{[\s\S]*?min-height:\s*22px/)
    expect(hexView).toMatch(/\.hex-offset-chrome\s*\{[\s\S]*?background:\s*#f5f5f5/)
    expect(hexView).toMatch(/\.hex-goto-dialog\s*\{[\s\S]*?background:\s*#f0f0f0/)
    expect(hexView).toMatch(/\.hex-goto-dialog input\s*\{[\s\S]*?height:\s*20px/)
    expect(hexView).toMatch(/\.hex-goto-dialog footer button\s*\{[\s\S]*?height:\s*18px/)
    expect(css).toMatch(/\.hex-compare-view \.hex-offset-chrome\s*\{[\s\S]*?min-height:\s*22px/)
    expect(css).toMatch(/\.hex-goto-dialog footer button\s*\{[\s\S]*?height:\s*18px/)
    expect(hexView).not.toMatch(/min-height:\s*6px/)
  })
})

describe('hex byte cell residual', () => {
  it('keeps Hex byte/ascii cell chrome on the capture grid band', () => {
    expect(hexView).toMatch(/data-hex-rows-density="capture-1to1"/)
    expect(hexView).toMatch(/data-hex-byte-residual="capture-1to1"/)
    expect(hexView).toMatch(/\.hex-byte\s*\{[\s\S]*?width:\s*20px/)
    expect(hexView).toMatch(/\.hex-row\s*\{[\s\S]*?line-height:\s*16px/)
    expect(hexView).toMatch(/\.hex-ascii\s*\{[\s\S]*?line-height:\s*16px/)
    expect(css).toMatch(/\.hex-compare-view \.hex-byte[\s\S]*?width:\s*20px/)
    expect(css).toMatch(/\.hex-compare-view \.hex-row\s*\{[\s\S]*?line-height:\s*16px/)
    expect(hexView).not.toMatch(/min-height:\s*6px/)
  })
})
