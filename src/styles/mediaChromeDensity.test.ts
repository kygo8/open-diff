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
    expect(css).toMatch(/\.media-compare-view \.media-path-panel\s*\{[\s\S]*?min-height:\s*20px/)
    expect(css).toMatch(
      /\.media-compare-view \.media-path-panel input,\s*\.media-compare-view \.media-path-panel button\s*\{[\s\S]*?height:\s*20px/,
    )
    expect(css).toMatch(/\.media-compare-view \.path-side-footer\s*\{[\s\S]*?font-size:\s*11px/)
    expect(css).toMatch(/\.media-compare-view \.path-side-footer\s*\{[\s\S]*?min-height:\s*20px/)

    expect(mediaView).toMatch(/\.media-compare-view\s*\{[\s\S]*?padding:\s*2px 4px/)
    expect(mediaView).toMatch(/\.path-side-footer\s*\{[\s\S]*?font-size:\s*11px/)
    expect(mediaView).toMatch(/\.path-side-footer\s*\{[\s\S]*?min-height:\s*20px/)
    expect(mediaView).toMatch(/SessionPathActions/)
    expect(mediaView).toMatch(/PathMetaFooter/)
    expect(mediaView).toMatch(
      /\.media-path-panel input,\s*\.media-path-panel button\s*\{[\s\S]*?height:\s*20px/,
    )
    expect(mediaView).toMatch(/chromeKind:\s*'media-session'/)
    expect(mediaView).toMatch(/sessions:\s*true/)
    expect(mediaView).not.toMatch(/font-size:\s*9px/)
    expect(mediaView).not.toMatch(/min-height:\s*9px/)

    expect(layout).toMatch(/data-chrome-kind='media-session'[\s\S]*?height:\s*20px/)
    expect(css).toMatch(/\.bc-session-toolbar\s*\{[\s\S]*?min-height:\s*38px/)
  })

  it('keeps Media scrub/footer chrome on capture band', () => {
    expect(css).toMatch(/\.media-compare-view \.media-scrub-row\s*\{[\s\S]*?min-height:\s*20px/)
    expect(css).toMatch(/\.media-compare-view \.media-scrub-row\s*\{[\s\S]*?gap:\s*4px/)
    expect(css).toMatch(/\.media-compare-view \.media-scrub-row button\s*\{[\s\S]*?height:\s*18px/)
    expect(css).toMatch(/\.media-compare-view \.media-scrub\s*\{[\s\S]*?height:\s*16px/)
    expect(css).toMatch(/\.media-compare-view \.media-playback-hint\s*\{[\s\S]*?font-size:\s*11px/)
    expect(css).toMatch(/\.media-compare-view \.path-side-footer\s*\{[\s\S]*?line-height:\s*16px/)

    expect(mediaView).toMatch(/\.media-scrub-row\s*\{[\s\S]*?min-height:\s*20px/)
    expect(mediaView).toMatch(/\.media-scrub-play\s*\{[\s\S]*?height:\s*18px/)
    expect(mediaView).toMatch(/\.media-scrub\s*\{[\s\S]*?height:\s*16px/)
    expect(mediaView).toMatch(/\.path-side-footer\s*\{[\s\S]*?line-height:\s*16px/)
    expect(mediaView).toMatch(/from '@lucide\/vue'/)
    expect(mediaView).toMatch(/<Play[\s\S]*?aria-hidden="true"/)
    expect(mediaView).toMatch(/<Pause[\s\S]*?aria-hidden="true"/)
  })

  it('keeps Media transport/pane chrome on Hex/Table/Version rhythm', () => {
    expect(css).toMatch(/\.media-compare-view \.media-summary-item[\s\S]*?padding:\s*2px 4px/)
    expect(css).toMatch(/\.media-compare-view \.media-report-panel[\s\S]*?padding:\s*2px 4px/)
    expect(css).toMatch(/\.media-compare-view \.media-rules-panel[\s\S]*?padding:\s*2px 4px/)
    expect(css).toMatch(/\.media-compare-view \.media-field-row\s*\{[\s\S]*?min-height:\s*16px/)
    expect(css).toMatch(/\.media-compare-view \.media-rule-row\s*\{[\s\S]*?min-height:\s*18px/)
    expect(css).toMatch(/\.media-compare-view \.media-players\s*\{[\s\S]*?gap:\s*6px/)

    expect(mediaView).toMatch(/\.media-summary-item[\s\S]*?padding:\s*2px 4px/)
    expect(mediaView).toMatch(/\.media-report-panel[\s\S]*?padding:\s*2px 4px/)
    expect(mediaView).toMatch(/\.media-rules-panel[\s\S]*?padding:\s*2px 4px/)
    expect(mediaView).toMatch(/\.media-field-row\s*\{[\s\S]*?min-height:\s*16px/)
    expect(mediaView).toMatch(/\.media-side dl div\s*\{[\s\S]*?padding:\s*2px 4px/)
    expect(mediaView).toMatch(/\.media-rule-row\s*\{[\s\S]*?min-height:\s*18px/)
    expect(mediaView).toMatch(/\.media-players\s*\{[\s\S]*?gap:\s*6px/)
    expect(mediaView).toMatch(/\.media-source-pair\s*\{[\s\S]*?padding:\s*2px 4px/)
    expect(mediaView).toMatch(/\.media-source-pair\s*\{[\s\S]*?border-radius:\s*0/)
    expect(mediaView).toMatch(
      /\.media-path-panel input,\s*\.media-path-panel button\s*\{[\s\S]*?border-radius:\s*0/,
    )
  })
})
