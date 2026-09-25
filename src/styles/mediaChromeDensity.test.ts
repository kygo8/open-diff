import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..')
const css = readFileSync(resolve(root, 'src/styles/main.css'), 'utf8')
const mediaView = readFileSync(resolve(root, 'src/views/MediaCompareView.vue'), 'utf8')
const layout = readFileSync(resolve(root, 'src/layouts/AppLayout.vue'), 'utf8')

describe('media compare chrome density', () => {
  it('keeps Media Compare path/status/toolbar/footer chrome at capture CSS scale', () => {
    expect(css).toMatch(/\.media-compare-view\s*\{[\s\S]*?padding:\s*2px 4px/)
    expect(css).toMatch(/\.media-compare-view \.media-path-panel\s*\{[\s\S]*?min-height:\s*22px/)
    expect(mediaView).toMatch(/\.media-path-field \.path-input\s*\{[\s\S]*?height:\s*16\.5px/)
    expect(css).toMatch(
      /\.media-compare-view \.media-path-panel input,\s*\.media-compare-view \.media-path-panel button\s*\{[\s\S]*?height:\s*20px/,
    )
    expect(css).toMatch(/\.media-compare-view \.path-side-footer\s*\{[\s\S]*?font-size:\s*11px/)
    expect(css).toMatch(/\.media-compare-view \.path-side-footer\s*\{[\s\S]*?min-height:\s*18px/)

    expect(mediaView).toMatch(/\.media-compare-view\s*\{[\s\S]*?padding:\s*2px 4px/)
    expect(mediaView).toMatch(/\.path-side-footer\s*\{[\s\S]*?font-size:\s*11px/)
    expect(mediaView).toMatch(/\.path-side-footer\s*\{[\s\S]*?min-height:\s*18px/)
    expect(mediaView).toMatch(/SessionPathActions/)
    expect(mediaView).toMatch(/PathMetaFooter/)
    expect(mediaView).toMatch(
      /\.media-path-panel input,\s*\.media-path-panel button\s*\{[\s\S]*?height:\s*20px/,
    )
    expect(mediaView).toMatch(/chromeKind:\s*'media-session'/)
    expect(mediaView).toMatch(/sessions:\s*true/)
    expect(mediaView).toMatch(/SessionSettingsDialog/)
    expect(mediaView).not.toMatch(/font-size:\s*9px/)
    expect(mediaView).not.toMatch(/min-height:\s*9px/)

    expect(layout).toMatch(/data-chrome-kind='media-session'[\s\S]*?height:\s*19\.5px/)
    expect(css).toMatch(/\.bc-session-toolbar\s*\{[\s\S]*?min-height:\s*39\.5px/)
  })

  it('keeps Media scrub/footer chrome on capture band', () => {
    expect(css).toMatch(/\.media-compare-view \.media-scrub-row\s*\{[\s\S]*?min-height:\s*26px/)
    expect(css).toMatch(/\.media-compare-view \.media-scrub-row\s*\{[\s\S]*?gap:\s*4px/)
    expect(css).toMatch(
      /\.media-compare-view \.media-scrub-row\s*\{[\s\S]*?border:\s*1px solid #a0a0a0/,
    )
    expect(css).toMatch(/\.media-compare-view \.media-scrub-row button\s*\{[\s\S]*?height:\s*26px/)
    expect(css).toMatch(/\.media-compare-view \.media-scrub\s*\{[\s\S]*?height:\s*19\.5px/)
    expect(css).toMatch(/\.media-compare-view \.media-playback-hint\s*\{[\s\S]*?font-size:\s*11px/)
    expect(css).toMatch(/\.media-compare-view \.path-side-footer\s*\{[\s\S]*?line-height:\s*16px/)
    expect(css).toMatch(/\.media-compare-view \.media-playback-header[\s\S]*?min-height:\s*20px/)

    expect(mediaView).toMatch(/data-media-scrub-density="capture-1to1"/)
    expect(mediaView).toMatch(/\.media-scrub-row\s*\{[\s\S]*?min-height:\s*26px/)
    expect(mediaView).toMatch(/\.media-scrub-play\s*\{[\s\S]*?height:\s*26px/)
    expect(mediaView).toMatch(/\.media-scrub\s*\{[\s\S]*?height:\s*19\.5px/)
    expect(mediaView).toMatch(/\.path-side-footer\s*\{[\s\S]*?line-height:\s*16px/)
    expect(mediaView).toMatch(/from '@lucide\/vue'/)
    expect(mediaView).toMatch(/:size="14"/)
    expect(mediaView).toMatch(/<Play[\s\S]*?aria-hidden="true"/)
    expect(mediaView).toMatch(/<Pause[\s\S]*?aria-hidden="true"/)
    expect(mediaView).toMatch(/:aria-label="isPlaying \? \$t\('ui.pause'\) : \$t\('ui.play'\)"/)
    expect(mediaView).not.toMatch(
      /class="media-scrub-play"[\s\S]*?<span>\{\{ isPlaying \? \$t\('ui.pause'\) : \$t\('ui.play'\) \}\}<\/span>/,
    )
  })

  it('keeps Media transport/pane chrome on Hex/Table/Version rhythm', () => {
    expect(css).toMatch(/\.media-compare-view \.media-summary-item[\s\S]*?padding:\s*2px 4px/)
    expect(css).toMatch(/\.media-compare-view \.media-report-panel[\s\S]*?padding:\s*4px 6px/)
    expect(css).toMatch(/\.media-compare-view \.media-rules-panel[\s\S]*?padding:\s*2px 4px/)
    expect(css).toMatch(/\.media-compare-view \.media-field-row\s*\{[\s\S]*?min-height:\s*18px/)
    expect(css).toMatch(/\.media-compare-view \.media-rule-row\s*\{[\s\S]*?min-height:\s*16px/)
    expect(css).toMatch(/\.media-compare-view \.media-players\s*\{[\s\S]*?gap:\s*4px/)

    expect(mediaView).toMatch(/data-media-field-density="capture-1to1"/)
    expect(mediaView).toMatch(/\.media-summary-item[\s\S]*?padding:\s*2px 4px/)
    expect(mediaView).toMatch(/\.media-report-panel[\s\S]*?padding:\s*4px 6px/)
    expect(mediaView).toMatch(/\.media-rules-panel[\s\S]*?padding:\s*2px 4px/)
    expect(mediaView).toMatch(/\.media-field-row\s*\{[\s\S]*?min-height:\s*18px/)
    expect(mediaView).toMatch(/\.media-field-row > \*\s*\{[\s\S]*?padding:\s*2px 6px/)
    expect(mediaView).toMatch(/\.media-side dl div\s*\{[\s\S]*?padding:\s*2px 4px/)
    expect(mediaView).toMatch(/\.media-rule-row\s*\{[\s\S]*?min-height:\s*16px/)
    expect(mediaView).toMatch(/\.media-players\s*\{[\s\S]*?gap:\s*4px/)
    expect(mediaView).toMatch(/\.media-source-pair\s*\{[\s\S]*?padding:\s*2px 4px/)
    expect(mediaView).toMatch(/\.media-source-pair\s*\{[\s\S]*?border-radius:\s*0/)
    expect(mediaView).toMatch(
      /\.media-path-panel input,\s*\.media-path-panel button\s*\{[\s\S]*?border-radius:\s*0/,
    )
  })
})

describe('media path scrub chrome residual', () => {
  it('keeps Media path and play/scrub chrome on the capture band', () => {
    expect(mediaView).toMatch(/data-testid="media-path-chrome"/)
    expect(mediaView).toMatch(/data-path-density="capture-1to1"/)
    expect(mediaView).toMatch(/data-secondary-density="capture-1to1"/)
    expect(mediaView).toMatch(/data-testid="media-scrub-chrome"/)
    expect(mediaView).toMatch(/media-path-fields/)
    expect(mediaView).toMatch(/media-path-meta-strip/)
    expect(mediaView).toMatch(/\.media-path-fields\s*\{[\s\S]*?min-height:\s*22px/)
    expect(mediaView).toMatch(/\.media-path-meta-strip\s*\{[\s\S]*?background:\s*#f0f0f0/)
    expect(mediaView).toMatch(/\.media-scrub-row\s*\{[\s\S]*?background:\s*#f0f0f0/)
    expect(css).toMatch(/\.media-compare-view \.media-path-fields\s*\{[\s\S]*?min-height:\s*22px/)
    expect(css).toMatch(
      /\.media-compare-view \.media-path-meta-strip\s*\{[\s\S]*?background:\s*#f0f0f0/,
    )
    expect(mediaView).not.toMatch(/min-height:\s*6px/)
  })
})

describe('media rules importance strip residual', () => {
  it('keeps Media rules/importance strip on the capture band', () => {
    expect(mediaView).toMatch(/data-rules-density="capture-1to1"/)
    expect(mediaView).toMatch(/data-importance-chrome="capture-1to1"/)
    expect(mediaView).toMatch(/\.media-rules-panel\s*\{[\s\S]*?background:\s*#f5f5f5/)
    expect(mediaView).toMatch(/\.media-rules-panel\s*\{[\s\S]*?min-height:\s*18px/)
    expect(mediaView).toMatch(/\.media-rule-row\s*\{[\s\S]*?min-height:\s*16px/)
    expect(css).toMatch(
      /\.media-compare-view \.media-rules-panel\s*\{[\s\S]*?background:\s*#f5f5f5/,
    )
    expect(css).toMatch(/\.media-compare-view \.media-rule-row\s*\{[\s\S]*?min-height:\s*16px/)
    expect(mediaView).not.toMatch(/min-height:\s*6px/)
  })
})

describe('media scrub surface residual', () => {
  it('keeps Media scrub strip on capture #f5f5f5 without surface override', () => {
    expect(mediaView).toMatch(/data-media-scrub-residual="capture-1to1"/)
    expect(mediaView).toMatch(/\.media-scrub-row\s*\{[\s\S]*?background:\s*#f0f0f0/)
    expect(mediaView).not.toMatch(
      /\.media-scrub-row\s*\{[\s\S]*?background:\s*#f0f0f0;[\s\S]*?background:\s*var\(--app-surface\)/,
    )
    expect(mediaView).toMatch(/\.media-players\s*\{[\s\S]*?gap:\s*4px/)
    expect(css).toMatch(/\.media-compare-view \.media-scrub-row\s*\{[\s\S]*?background:\s*#f0f0f0/)
    expect(css).toMatch(/\.media-compare-view \.media-players\s*\{[\s\S]*?gap:\s*4px/)
  })
})

describe('media path meta residual', () => {
  it('keeps Media path meta MIX EOL gap on capture residual', () => {
    expect(mediaView).toMatch(
      /\.media-path-meta-strip :deep\(\.path-meta-footer\)\s*\{[\s\S]*?gap:\s*6px/,
    )
    expect(mediaView).toMatch(
      /\.media-path-meta-strip :deep\(\.path-meta-footer\)\s*\{[\s\S]*?min-height:\s*18px/,
    )
  })
})
