import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..')
const css = readFileSync(resolve(root, 'src/styles/main.css'), 'utf8')
const folderView = readFileSync(resolve(root, 'src/views/FolderCompareView.vue'), 'utf8')
const folderLegend = readFileSync(
  resolve(root, 'src/components/workbench/FolderStatusLegend.vue'),
  'utf8',
)
const syncView = readFileSync(resolve(root, 'src/views/FolderSyncView.vue'), 'utf8')
const mergeView = readFileSync(resolve(root, 'src/views/FolderMergeView.vue'), 'utf8')

describe('folder chrome density', () => {
  it('keeps Folder/Sync/Merge session bodies at capture CSS scale', () => {
    expect(css).toMatch(
      /\.folder-compare-view,\s*\.folder-sync-view,\s*\.folder-merge-view\s*\{[\s\S]*?padding:\s*2px 4px/,
    )
    expect(css).toMatch(/\.folder-toolbar\s*\{[\s\S]*?gap:\s*2px\s*!important/)
    expect(css).toMatch(/\.folder-toolbar\s*\{[\s\S]*?padding:\s*2px 4px/)
    expect(css).toMatch(/\.folder-toolbar \.folder-criteria\s*\{[\s\S]*?gap:\s*1px 4px/)
    expect(css).toMatch(/\.folder-toolbar \.folder-actions\s*\{[\s\S]*?gap:\s*2px/)
    expect(css).toMatch(
      /\.folder-toolbar \.folder-actions \.n-button,[\s\S]*?height:\s*18px\s*!important/,
    )
    expect(folderView).toMatch(/\.folder-compare-view\s*\{[\s\S]*?padding:\s*2px 4px/)
    expect(folderView).toMatch(/PathMetaFooter/)
    expect(folderView).toMatch(/folder-left-path-footer/)
    expect(folderView).toMatch(/folder-right-path-footer/)
    expect(css).toMatch(/\.folder-compare-view \.path-meta-footer[\s\S]*?min-height:\s*20px/)
    expect(css).toMatch(/\.folder-compare-view \.path-meta-footer[\s\S]*?font-size:\s*11px/)
    expect(folderView).toMatch(/\.path-pair input\s*\{[\s\S]*?height:\s*20px/)
    expect(folderView).toMatch(/\.path-pair input\s*\{[\s\S]*?border-radius:\s*0/)
    expect(folderView).toMatch(/\.folder-toolbar\s*\{[\s\S]*?gap:\s*2px/)
    expect(folderView).toMatch(/\.folder-criteria\s*\{[\s\S]*?gap:\s*1px 4px/)
    expect(folderView).toMatch(/\.folder-actions\s*\{[\s\S]*?gap:\s*2px/)
    expect(syncView).toMatch(/\.folder-sync-view\s*\{[\s\S]*?padding:\s*2px 4px/)
    expect(syncView).toMatch(/PathMetaFooter/)
    expect(mergeView).toMatch(/\.folder-merge-view\s*\{[\s\S]*?padding:\s*2px 4px/)
    expect(folderView).toMatch(/\.folder-summary div\s*\{[\s\S]*?padding:\s*2px 4px/)
    expect(folderView).toMatch(/\.folder-summary div\s*\{[\s\S]*?border-radius:\s*0/)
    expect(folderView).toMatch(/\.folder-copy-confirmation\s*\{[\s\S]*?padding:\s*2px 4px/)
    expect(folderView).toMatch(/\.sync-preview-panel\s*\{[\s\S]*?padding:\s*2px 4px/)
    expect(folderView).toMatch(/\.sync-safety-confirmation\s*\{[\s\S]*?border-radius:\s*0/)
    expect(folderView).toMatch(/\.sync-preview-row span,[\s\S]*?padding:\s*1px 4px/)
    expect(folderView).toMatch(/\.folder-select-name input\s*\{[\s\S]*?height:\s*16px/)
    expect(folderView).toMatch(/\.folder-select-name input\s*\{[\s\S]*?border-radius:\s*0/)
    expect(folderView).toMatch(/\.folder-compare-progress button\s*\{[\s\S]*?height:\s*18px/)
    expect(folderView).toMatch(/\.in-app-context-menu\s*\{[\s\S]*?border-radius:\s*0/)
    expect(folderView).toMatch(/\.file-compare-report-backdrop\s*\{[\s\S]*?padding:\s*4px/)
    expect(folderView).not.toMatch(/font-size:\s*6px/)
    expect(folderView).not.toMatch(/min-height:\s*6px/)
  })
})

it('surfaces Filters/Peek strip at capture CSS scale', () => {
  expect(css).not.toMatch(/\.folder-root-summary,\s*\.display-filters,\s*\.folder-summary/)
  expect(css).toMatch(/\.folder-filter-strip\s*\{/)
  expect(css).toMatch(/\.folder-filter-pattern\s*\{/)
  expect(css).toMatch(/\.folder-filter-strip-btn\s*\{/)
  expect(css).toMatch(/\.folder-filter-strip-btn\s*\{[\s\S]*?height:\s*37\.5px/)
  expect(css).toMatch(/\.folder-filter-strip-btn\s*\{[\s\S]*?grid-template-rows:\s*20px auto/)
  expect(css).toMatch(/\.folder-filter-pattern\s*\{[\s\S]*?height:\s*20px/)
  expect(css).toMatch(/\.folder-filter-pattern\s*\{[\s\S]*?border-radius:\s*0/)
  expect(css).toMatch(
    /\.folder-filter-chrome\[data-mainbar-row2='capture-1to1-residual'\][\s\S]*?min-height:\s*43\.5px/,
  )
  expect(css).toMatch(
    /\.workbench-toolbar-stack:has\(\.folder-filter-chrome\[data-mainbar-row2='capture-1to1-residual'\]\)\s*\{[\s\S]*?min-height:\s*83px/,
  )
  expect(css).toMatch(/\.folder-compare-view \.display-filters,[\s\S]*?gap:\s*2px 6px/)
  expect(css).toMatch(/\.folder-compare-view \.display-filters,[\s\S]*?min-height:\s*20px/)
  expect(folderView).toMatch(/data-testid="folder-filter-strip"/)
  expect(folderView).toMatch(/data-testid="folder-filter-pattern"/)
  expect(folderView).toMatch(/data-testid="folder-filter-strip-filters"/)
  expect(folderView).toMatch(/data-testid="folder-filter-strip-peek"/)
  expect(folderView).toMatch(/data-filters-density="capture-1to1"/)
  expect(folderView).toMatch(/data-filters-align="capture-1to1-residual"/)
  expect(folderView).toMatch(/data-mainbar-row2="capture-1to1-residual"/)
  expect(folderView).toMatch(/<template #toolbar>/)
  expect(folderView).toMatch(/showFiltersPanel:/)
  expect(css).toMatch(/\.folder-filter-strip-btn\s*\{[\s\S]*?width:\s*59px/)
  expect(css).toMatch(/\.folder-filter-strip-btn\s*\{[\s\S]*?height:\s*37\.5px/)
  expect(folderView).toMatch(/\.folder-filter-chrome\s*\{[\s\S]*?min-height:\s*43\.5px/)
  expect(folderView).toMatch(/background:\s*#ffffff/)
  expect(folderView).toMatch(/\.folder-filter-strip-btn\s*\{[\s\S]*?height:\s*37\.5px/)
  expect(folderView).toMatch(/\.folder-filter-pattern\s*\{[\s\S]*?height:\s*20px/)
  expect(folderView).toMatch(/\.folder-filter-pattern\s*\{[\s\S]*?border-radius:\s*0/)
  expect(folderView).toMatch(/:size="16"/)
  expect(syncView).toMatch(/data-testid="folder-sync-filter-strip"/)
  expect(syncView).toMatch(/data-testid="folder-sync-filter-strip-filters"/)
  expect(syncView).not.toMatch(/data-testid="folder-sync-filter-strip-peek"/)
  expect(syncView).toMatch(/data-sync-filters-place="capture-1to1-residual"/)
  expect(syncView).toMatch(/data-sync-pattern-place="capture-1to1-residual"/)
  expect(syncView).toMatch(/data-testid="folder-sync-filter-pattern"/)
  expect(syncView).toMatch(/data-filters-density="capture-1to1"/)
  expect(syncView).toMatch(/\.folder-filter-chrome\s*\{[\s\S]*?min-height:\s*37\.5px/)
  expect(syncView).toMatch(/\.folder-filter-chrome\s*\{[\s\S]*?background:\s*#f0f0f0/)
  expect(syncView).toMatch(/\.folder-filter-strip-btn\s*\{[\s\S]*?height:\s*37\.5px/)
  expect(syncView).toMatch(
    /\.sync-filter-pattern-field \.folder-filter-pattern\s*\{[\s\S]*?height:\s*19\.5px/,
  )
  expect(mergeView).toMatch(/data-testid="folder-merge-filter-strip"/)
  expect(mergeView).toMatch(/data-testid="folder-merge-filter-pattern"/)
  expect(mergeView).toMatch(/data-testid="folder-merge-filter-strip-filters"/)
  expect(mergeView).toMatch(/data-testid="folder-merge-filter-strip-peek"/)
  expect(mergeView).toMatch(/data-filters-density="capture-1to1"/)
  expect(mergeView).toMatch(/data-mainbar-row2="capture-1to1-residual"/)
  expect(mergeView).toMatch(/<template #toolbar>/)
  expect(mergeView).toMatch(/\.folder-filter-chrome\s*\{[\s\S]*?min-height:\s*43\.5px/)
  expect(mergeView).toMatch(/\.folder-filter-strip-btn\s*\{[\s\S]*?height:\s*37\.5px/)
})

describe('folder compare tree chrome density', () => {
  it('keeps Folder Compare tree/header at capture CSS scale', () => {
    expect(css).toMatch(/\.folder-compare-view \.tree-head\s*\{[\s\S]*?min-height:\s*20px/)
    expect(css).toMatch(/\.folder-compare-view \.tree-row\s*\{[\s\S]*?min-height:\s*16px/)
    expect(css).toMatch(/\.folder-compare-view \.tree-head\s*\{[\s\S]*?font-weight:\s*400/)
    expect(css).toMatch(
      /\.folder-compare-view \.tree-row\.selected\s*\{[\s\S]*?background:\s*#a8cdf1/,
    )
    expect(css).toMatch(/\.folder-compare-view \.tree-head span,[\s\S]*?padding:\s*1px 6px/)
    expect(css).toMatch(/\.folder-compare-view \.tree-head span,[\s\S]*?font-size:\s*11px/)
    expect(css).toMatch(/\.folder-compare-view \.tree-head span,[\s\S]*?line-height:\s*14px/)
    expect(css).toMatch(/\.folder-compare-view \.folder-toggle\s*\{[\s\S]*?width:\s*14px/)
    expect(css).toMatch(/\.folder-compare-view \.folder-row-check\s*\{[\s\S]*?width:\s*12px/)
    expect(css).toMatch(/\.folder-compare-view \.folder-tree-table\s*\{[\s\S]*?border-radius:\s*0/)

    expect(folderView).toMatch(/const rowHeight = 16/)
    expect(folderView).toMatch(/row\.depth \* 14/)
    expect(folderView).toMatch(/\.tree-head\s*\{[\s\S]*?min-height:\s*20px/)
    expect(folderView).toMatch(/\.tree-row\s*\{[\s\S]*?min-height:\s*16px/)
    expect(folderView).toMatch(/\.tree-head span,[\s\S]*?padding:\s*1px 6px/)
    expect(folderView).toMatch(/\.tree-head span,[\s\S]*?font-size:\s*11px/)
    expect(folderView).toMatch(/\.tree-head span,[\s\S]*?line-height:\s*14px/)
    expect(folderView).toMatch(/\.folder-toggle\s*\{[\s\S]*?width:\s*14px/)
    expect(folderView).toMatch(/\.folder-row-check\s*\{[\s\S]*?width:\s*12px/)
    expect(folderView).toMatch(/\.tree-row \.name-cell\s*\{[\s\S]*?gap:\s*2px/)
    expect(folderView).toMatch(/columns\.push\('96px', 'minmax\(180px, 1\.2fr\)'/)
    expect(folderView).not.toMatch(/const rowHeight = 22/)
    expect(folderView).not.toMatch(/const rowHeight = 34/)
    expect(folderView).not.toMatch(/padding:\s*3px 8px/)
  })
})

describe('folder compare session log chrome density', () => {
  it('keeps Folder Compare session log pane at capture CSS scale', () => {
    expect(folderView).toMatch(/data-testid="folder-session-log"/)
    expect(folderView).toMatch(/data-log-density="capture-1to1"/)
    expect(folderView).toMatch(/\.folder-session-log\s*\{[\s\S]*?height:\s*96px/)
    expect(folderView).toMatch(/\.folder-session-log\s*\{[\s\S]*?grid-template-columns:\s*22px/)
    expect(folderView).toMatch(/\.folder-session-log-body\s*\{[\s\S]*?font-size:\s*11px/)
    expect(folderView).toMatch(/\.folder-session-log-body\s*\{[\s\S]*?line-height:\s*14px/)
    expect(folderView).toMatch(/case 'toggle-log':/)
    expect(css).toMatch(/\.folder-compare-view \.folder-session-log\s*\{[\s\S]*?height:\s*96px/)
    expect(css).toMatch(
      /\.folder-compare-view \.folder-session-log-body\s*\{[\s\S]*?font-size:\s*11px/,
    )
    expect(folderView).not.toMatch(/height:\s*6px/)
    expect(folderView).not.toMatch(/font-size:\s*6px/)
  })
})

describe('folder column header legend residual', () => {
  it('keeps tree-head and legend residual chrome toward capture', () => {
    expect(folderView).toMatch(/data-column-legend="capture-1to1-residual"/)
    expect(folderView).toMatch(/\.tree-head\s*\{[\s\S]*?border-bottom:\s*1px solid #a0a0a0/)
    expect(folderLegend).toMatch(/data-legend-chrome="capture-1to1-residual"/)
    expect(css).toMatch(
      /\.folder-status-legend\[data-legend-chrome='capture-1to1-residual'\][\s\S]*?background:\s*#f0f0f0/,
    )
  })
})

describe('folder MainBar Filters row residual', () => {
  it('keeps Filters strip as MainBar second row toward folder-compare capture (~83px)', () => {
    expect(css).toMatch(
      /\.folder-filter-chrome\[data-mainbar-row2='capture-1to1-residual'\][\s\S]*?background:\s*#ffffff/,
    )
    expect(css).toMatch(
      /\.workbench-toolbar-stack:has\(\.folder-filter-chrome\[data-mainbar-row2='capture-1to1-residual'\]\)\s*\{[\s\S]*?min-height:\s*83px/,
    )
    expect(folderView).toMatch(/data-mainbar-row2="capture-1to1-residual"/)
    expect(mergeView).toMatch(/data-mainbar-row2="capture-1to1-residual"/)
  })
})

describe('folder sync Filters/Peek placement residual', () => {
  it('keeps Peek on MainBar and pattern near Accept/Cancel with separate #f0f0f0 Filters strip', () => {
    expect(syncView).toMatch(/buildFolderSyncToolbar/)
    expect(css).toMatch(
      /\.folder-sync-view \.folder-filter-chrome\[data-sync-filters-place='capture-1to1-residual'\][\s\S]*?background:\s*#f0f0f0/,
    )
    expect(css).toMatch(
      /\.folder-filter-pattern\[data-sync-pattern-place='capture-1to1-residual'\][\s\S]*?height:\s*19\.5px/,
    )
    expect(syncView).not.toMatch(/data-mainbar-row2="capture-1to1-residual"/)
    expect(syncView).not.toMatch(/data-testid="folder-sync-filter-strip-peek"/)
  })
})
