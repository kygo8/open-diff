import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..')
const css = readFileSync(resolve(root, 'src/styles/main.css'), 'utf8')
const pictureView = readFileSync(resolve(root, 'src/views/PictureCompareView.vue'), 'utf8')
const layout = readFileSync(resolve(root, 'src/layouts/AppLayout.vue'), 'utf8')

describe('picture compare chrome density', () => {
  it('keeps Picture Compare path/status/toolbar/footer chrome at capture CSS scale', () => {
    expect(css).toMatch(/\.picture-compare-view\s*\{[\s\S]*?padding:\s*2px 4px/)
    expect(css).toMatch(
      /\.picture-compare-view \.picture-path-panel\s*\{[\s\S]*?min-height:\s*20px/,
    )
    expect(css).toMatch(
      /\.picture-compare-view \.picture-path-panel input,\s*\.picture-compare-view \.picture-path-panel button\s*\{[\s\S]*?height:\s*20px/,
    )
    expect(css).toMatch(/\.picture-compare-view \.path-side-footer\s*\{[\s\S]*?font-size:\s*11px/)
    expect(css).toMatch(/\.picture-compare-view \.path-side-footer\s*\{[\s\S]*?min-height:\s*20px/)

    expect(pictureView).toMatch(/\.picture-compare-view\s*\{[\s\S]*?padding:\s*2px 4px/)
    expect(pictureView).toMatch(/\.path-side-footer\s*\{[\s\S]*?font-size:\s*11px/)
    expect(pictureView).toMatch(/\.path-side-footer\s*\{[\s\S]*?min-height:\s*20px/)
    expect(pictureView).toMatch(/SessionPathActions/)
    expect(pictureView).toMatch(/PathMetaFooter/)
    expect(pictureView).toMatch(/\.picture-path-panel input\s*\{[\s\S]*?height:\s*20px/)
    expect(pictureView).toMatch(/chromeKind:\s*'picture-session'/)
    expect(pictureView).not.toMatch(/font-size:\s*9px/)
    expect(pictureView).not.toMatch(/min-height:\s*9px/)

    expect(layout).toMatch(/data-chrome-kind='picture-session'[\s\S]*?height:\s*19\.5px/)
    expect(css).toMatch(/\.bc-session-toolbar\s*\{[\s\S]*?min-height:\s*38px/)
  })

  it('keeps Picture Meta/Blend/Tol chrome on capture band', () => {
    expect(css).toMatch(
      /\.picture-compare-view \.picture-options-panel,\s*\.picture-compare-view \.picture-blend-panel,\s*\.picture-compare-view \.picture-metadata-panel[\s\S]*?padding:\s*4px 6px/,
    )
    expect(css).toMatch(
      /\.picture-compare-view \.picture-options-panel,\s*\.picture-compare-view \.picture-blend-panel,\s*\.picture-compare-view \.picture-metadata-panel[\s\S]*?border:\s*1px solid #a0a0a0/,
    )
    expect(css).toMatch(
      /\.picture-compare-view \.picture-options-panel header[\s\S]*?min-height:\s*20px/,
    )
    expect(css).toMatch(
      /\.picture-compare-view \.metadata-grid-heading,\s*\.picture-compare-view \.metadata-cell\s*\{[\s\S]*?padding:\s*2px 6px/,
    )
    expect(css).toMatch(
      /\.picture-compare-view \.picture-options-panel input\[type='number'\],\s*\.picture-compare-view \.picture-options-panel button,\s*\.picture-compare-view \.picture-blend-panel select[\s\S]*?height:\s*18px/,
    )
    expect(css).toMatch(/\.picture-compare-view \.picture-panel-title[\s\S]*?font-size:\s*12px/)

    expect(pictureView).toMatch(/data-picture-panel-density="capture-1to1"/)
    expect(pictureView).toMatch(/\.picture-options-panel\s*\{[\s\S]*?padding:\s*4px 6px/)
    expect(pictureView).toMatch(/\.picture-options-panel header\s*\{[\s\S]*?min-height:\s*20px/)
    expect(pictureView).toMatch(/\.picture-blend-panel\s*\{[\s\S]*?border:\s*1px solid #a0a0a0/)
    expect(pictureView).toMatch(/\.picture-metadata-panel\s*\{[\s\S]*?padding:\s*4px 6px/)
    expect(pictureView).toMatch(/\.metadata-cell\s*\{[\s\S]*?padding:\s*2px 6px/)
    expect(pictureView).toMatch(/\.picture-panel-title\s*\{[\s\S]*?font-size:\s*12px/)
    expect(pictureView).toMatch(/from '@lucide\/vue'/)
    expect(pictureView).toMatch(/CircleGauge/)
    expect(pictureView).toMatch(/:size="14"/)
    expect(pictureView).toMatch(/<Blend[\s\S]*?aria-hidden="true"/)
    expect(pictureView).toMatch(/<Tag[\s\S]*?aria-hidden="true"/)
    expect(pictureView).toMatch(/picture-minor-banner/)
    expect(pictureView).toMatch(/\.picture-minor-banner\s*\{[\s\S]*?padding:\s*4px 6px/)
    expect(pictureView).toMatch(
      /\.picture-blend-panel input\[type='range'\]\s*\{[\s\S]*?height:\s*20px/,
    )
  })

  it('keeps Picture toolbar/pane chrome on Hex/Table/Version rhythm', () => {
    expect(css).toMatch(/\.picture-compare-view \.picture-controls[\s\S]*?min-height:\s*20px/)
    expect(css).toMatch(/\.picture-compare-view \.picture-controls input[\s\S]*?height:\s*18px/)
    expect(css).toMatch(/\.picture-compare-view \.picture-side\s*\{[\s\S]*?padding:\s*2px 4px/)
    expect(css).toMatch(/\.picture-compare-view \.picture-pane-grid\s*\{[\s\S]*?gap:\s*1px/)
    expect(css).toMatch(
      /\.picture-compare-view \.picture-options-panel header[\s\S]*?min-height:\s*20px/,
    )

    expect(pictureView).toMatch(/\.picture-controls\s*\{[\s\S]*?min-height:\s*20px/)
    expect(pictureView).toMatch(/\.picture-transform-tools button\s*\{[\s\S]*?height:\s*18px/)
    expect(pictureView).toMatch(/\.picture-side\s*\{[\s\S]*?padding:\s*2px 4px/)
    expect(pictureView).toMatch(/\.picture-pane-grid\s*\{[\s\S]*?gap:\s*1px/)
    expect(pictureView).toMatch(/\.picture-options-panel\s*\{[\s\S]*?min-height:\s*20px/)
    expect(pictureView).toMatch(/\.picture-report-panel\s*\{[\s\S]*?padding:\s*4px 6px/)
  })

  it('keeps Picture canvas and summary chrome flat toward the pane rhythm', () => {
    expect(css).toMatch(/\.picture-compare-view \.picture-summary\s*\{[\s\S]*?padding:\s*2px 4px/)
    expect(css).toMatch(/\.picture-compare-view \.picture-summary\s*\{[\s\S]*?border-radius:\s*0/)
    expect(css).toMatch(/\.picture-compare-view \.picture-canvas-frame\s*\{[\s\S]*?min-height:\s*0/)
    expect(css).toMatch(/\.picture-compare-view \.picture-image\s*\{[\s\S]*?box-shadow:\s*none/)
    expect(css).toMatch(
      /\.picture-compare-view \.picture-diff-region\s*\{[\s\S]*?border-radius:\s*0/,
    )

    expect(pictureView).toMatch(/\.picture-summary\s*\{[\s\S]*?padding:\s*2px 4px/)
    expect(pictureView).toMatch(/\.picture-summary\s*\{[\s\S]*?border-radius:\s*0/)
    expect(pictureView).toMatch(/\.picture-image\s*\{[\s\S]*?box-shadow:\s*none/)
    expect(pictureView).toMatch(/\.picture-image\s*\{[\s\S]*?width:\s*100%/)
    expect(pictureView).toMatch(/\.picture-diff-region\s*\{[\s\S]*?border-radius:\s*0/)
    expect(pictureView).not.toMatch(/min\(78%, 420px\)/)
    expect(pictureView).not.toMatch(/box-shadow:\s*0 16px 42px/)
  })
})

describe('picture stage canvas density', () => {
  it('keeps Picture stage/quadrant canvas and Tol overlay on capture band', () => {
    expect(pictureView).toMatch(/data-testid="picture-stage"/)
    expect(pictureView).toMatch(/data-canvas-density="capture-1to1"/)
    expect(pictureView).toMatch(/data-testid="picture-diff-stage"/)
    expect(pictureView).toMatch(/picture-tol-overlay/)
    expect(pictureView).toMatch(/data-tol-placement="stage-overlay"/)
    expect(pictureView).toMatch(/\.picture-stage\s*\{[\s\S]*?background:\s*#1c1c16/)
    expect(pictureView).toMatch(/\.picture-stage\s*\{[\s\S]*?min-height:\s*360px/)
    expect(pictureView).toMatch(/\.picture-pane-grid\s*\{[\s\S]*?gap:\s*1px/)
    expect(pictureView).toMatch(/\.picture-tol-overlay\s*\{[\s\S]*?top:\s*8px/)
    expect(css).toMatch(/\.picture-compare-view \.picture-stage\s*\{[\s\S]*?background:\s*#1c1c16/)
    expect(css).toMatch(/\.picture-compare-view \.picture-pane-grid\s*\{[\s\S]*?gap:\s*1px/)
    expect(pictureView).not.toMatch(/min-height:\s*6px/)
  })
})
