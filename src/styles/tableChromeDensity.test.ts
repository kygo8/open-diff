import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..')
const css = readFileSync(resolve(root, 'src/styles/main.css'), 'utf8')
const tableView = readFileSync(resolve(root, 'src/views/TableCompareView.vue'), 'utf8')
const layout = readFileSync(resolve(root, 'src/layouts/AppLayout.vue'), 'utf8')

describe('table compare chrome density', () => {
  it('keeps Table Compare path/status/controls chrome at capture CSS scale', () => {
    expect(css).toMatch(/\.table-compare-view\s*\{[\s\S]*?padding:\s*2px 4px/)
    expect(tableView).toMatch(/\.path-field-row \.path-input\s*\{[\s\S]*?height:\s*16\.5px/)
    expect(css).toMatch(/\.table-compare-view \.table-source-controls[\s\S]*?min-height:\s*20px/)
    expect(css).toMatch(/\.table-compare-view \.table-source-controls input[\s\S]*?height:\s*20px/)
    expect(css).toMatch(/\.table-compare-view \.path-side-footer\s*\{[\s\S]*?font-size:\s*11px/)
    expect(css).toMatch(/\.table-compare-view \.path-side-footer\s*\{[\s\S]*?min-height:\s*18px/)
    expect(css).toMatch(/\.table-compare-view \.table-grid-row\s*\{[\s\S]*?min-height:\s*16px/)

    expect(tableView).toMatch(/\.table-compare-view\s*\{[\s\S]*?padding:\s*2px 4px/)
    expect(tableView).toMatch(/\.table-source-controls[\s\S]*?padding:\s*1px 3px/)
    expect(tableView).toMatch(/\.table-source-controls input[\s\S]*?height:\s*20px/)
    expect(tableView).toMatch(/\.table-navigation-bar button\s*\{[\s\S]*?height:\s*18px/)
    expect(tableView).toMatch(/\.table-grid-row\s*\{[\s\S]*?min-height:\s*16px/)
    expect(tableView).toMatch(/\.path-side-footer\s*\{[\s\S]*?font-size:\s*11px/)
    expect(tableView).toMatch(/\.path-side-footer\s*\{[\s\S]*?min-height:\s*18px/)
    expect(tableView).toMatch(/SessionPathActions/)
    expect(tableView).toMatch(/PathMetaFooter/)
    expect(tableView).toMatch(/chromeKind:\s*'table-session'/)
    expect(tableView).not.toMatch(/font-size:\s*9px/)
    expect(tableView).not.toMatch(/min-height:\s*9px/)

    expect(layout).toMatch(/data-chrome-kind='table-session'[\s\S]*?height:\s*19\.5px/)
    expect(css).toMatch(/\.bc-session-toolbar\s*\{[\s\S]*?min-height:\s*39\.5px/)
  })

  it('shows Table header/report chrome under sole-session frame', () => {
    expect(css).toMatch(
      /\.app-shell:not\(\.app-shell-single-session\) \.table-compare-header[\s\S]*?display:\s*none/,
    )
    expect(css).toMatch(
      /\.app-shell-single-session \.table-compare-header\s*\{[\s\S]*?display:\s*flex !important/,
    )
    expect(css).toMatch(
      /\.app-shell-single-session \.table-compare-header \.table-report-actions \.n-button[\s\S]*?height:\s*18px/,
    )
    expect(tableView).toMatch(/data-table-secondary-density="capture-1to1"/)
    expect(tableView).toMatch(/table-compare-header/)
    expect(tableView).toMatch(/export-table-report/)
  })

  it('keeps Table secondary nav/report chrome on capture band', () => {
    expect(css).toMatch(
      /\.table-compare-view \.table-navigation-bar\s*\{[\s\S]*?border:\s*1px solid #a0a0a0/,
    )
    expect(css).toMatch(
      /\.table-compare-view \.table-navigation-bar\s*\{[\s\S]*?min-height:\s*22px/,
    )
    expect(css).toMatch(
      /\.table-compare-view \.table-navigation-bar input,[\s\S]*?\.table-compare-view \.table-navigation-bar button[\s\S]*?height:\s*18px/,
    )
    expect(css).toMatch(
      /\.table-compare-view \.table-report-actions \.n-button[\s\S]*?height:\s*18px/,
    )
    expect(css).toMatch(
      /\.table-compare-view \.table-summary,[\s\S]*?\.table-compare-view \.table-report-actions[\s\S]*?padding:\s*4px 6px/,
    )

    expect(tableView).toMatch(/data-table-secondary-density="capture-1to1"/)
    expect(tableView).toMatch(/\.table-navigation-bar\s*\{[\s\S]*?border:\s*1px solid #a0a0a0/)
    expect(tableView).toMatch(/\.table-navigation-bar button\s*\{[\s\S]*?height:\s*18px/)
    expect(tableView).toMatch(/\.table-navigation-bar label span[\s\S]*?line-height:\s*16px/)
    expect(tableView).toMatch(/\.table-report-actions\s*\{[\s\S]*?gap:\s*6px/)
    expect(tableView).toMatch(/:deep\(\.table-report-actions \.n-button\)[\s\S]*?height:\s*18px/)
    expect(tableView).not.toMatch(/\.table-report-actions\s*\{[\s\S]*?gap:\s*0\.5rem/)
  })

  it('keeps Table in-view grid/panel chrome on capture band', () => {
    expect(css).toMatch(
      /\.table-compare-view \.column-source-grid,[\s\S]*?\.table-compare-view \.table-grid-panel[\s\S]*?padding:\s*4px 6px/,
    )
    expect(css).toMatch(/\.table-compare-view \.table-grid-panel header[\s\S]*?min-height:\s*20px/)
    expect(css).toMatch(/\.table-compare-view \.table-column-rule[\s\S]*?min-height:\s*18px/)

    expect(tableView).toMatch(/\.table-grid-panel\s*\{[\s\S]*?padding:\s*4px 6px/)
    expect(tableView).toMatch(/\.table-grid-panel header\s*\{[\s\S]*?min-height:\s*20px/)
    expect(tableView).toMatch(/\.table-column-rule\s*\{[\s\S]*?padding:\s*2px 6px/)
    expect(tableView).toMatch(/\.table-grid-cell\s*\{[\s\S]*?padding:\s*2px 6px/)
  })
})

describe('table path-meta secondary strip density', () => {
  it('keeps Table secondary path-meta strip on capture band', () => {
    expect(tableView).toMatch(/data-testid="table-path-footers"/)
    expect(tableView).toMatch(/data-secondary-density="capture-1to1"/)
    expect(tableView).toMatch(/table-secondary-strip/)
    expect(tableView).toMatch(/\.table-secondary-strip\s*\{[\s\S]*?min-height:\s*18px/)
    expect(tableView).toMatch(/\.table-secondary-strip\s*\{[\s\S]*?background:\s*#f0f0f0/)
    expect(tableView).toMatch(
      /\.table-secondary-strip :deep\(\.path-meta-footer\)\s*\{[\s\S]*?gap:\s*6px/,
    )
    expect(css).toMatch(
      /\.table-compare-view \.table-secondary-strip\s*\{[\s\S]*?min-height:\s*18px/,
    )
    expect(css).toMatch(
      /\.table-compare-view \.table-secondary-strip\s*\{[\s\S]*?background:\s*#f0f0f0/,
    )
    expect(css).toMatch(/\.table-compare-view \.path-side-footer\s*\{[\s\S]*?min-height:\s*18px/)
    expect(tableView).not.toMatch(/min-height:\s*6px/)
  })
})

describe('table grid residual', () => {
  it('keeps table header/row density residual toward capture', () => {
    expect(tableView).toMatch(/data-table-grid-density="capture-1to1-residual"/)
    expect(tableView).toMatch(/\.table-grid-row\s*\{[\s\S]*?min-height:\s*16px/)
    expect(css).toMatch(/\.table-compare-view \.table-grid-row[\s\S]*?min-height:\s*16px/)
    expect(css).toMatch(
      /data-table-grid-density='capture-1to1-residual'\] \.table-grid-panel header[\s\S]*?min-height:\s*20px/,
    )
  })
})

describe('table grid header fill', () => {
  it('matches capture header fill #f0f0f0', () => {
    expect(css).toMatch(
      /data-table-grid-density='capture-1to1-residual'\] \.table-grid-panel header[\s\S]*?background:\s*#f0f0f0/,
    )
  })
})

describe('table secondary strip border', () => {
  it('matches capture path-meta border #c0c0c0', () => {
    expect(css).toMatch(
      /\.table-compare-view \.table-secondary-strip[\s\S]*?border:\s*1px solid #c0c0c0/,
    )
  })
})

describe('table virtual grid row track', () => {
  it('locks virtual row track to capture 16px', () => {
    expect(css).toMatch(
      /\.table-compare-view \.table-virtual-grid\s*\{[\s\S]*?grid-template-rows:\s*repeat\(var\(--visible-rows\), 16px\)/,
    )
  })
})

describe('table grid row border', () => {
  it('matches capture grid row border #c0c0c0', () => {
    expect(css).toMatch(
      /\.table-compare-view \.table-grid-row\s*\{[\s\S]*?border-bottom:\s*1px solid #c0c0c0/,
    )
  })
})

describe('table grid cell border', () => {
  it('matches capture grid cell border #c0c0c0', () => {
    expect(css).toMatch(
      /data-table-grid-density='capture-1to1-residual'\] \.table-grid-cell[\s\S]*?border-right:\s*1px solid #c0c0c0/,
    )
  })
})
