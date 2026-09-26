import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..')
const css = readFileSync(resolve(root, 'src/styles/main.css'), 'utf8')
const folderView = readFileSync(resolve(root, 'src/views/FolderCompareView.vue'), 'utf8')
const reportsView = readFileSync(resolve(root, 'src/views/reports/ReportsScriptView.vue'), 'utf8')

describe('report dialog chrome density', () => {
  it('keeps File Compare Report dialog dense toward native Report UI spacing', () => {
    expect(folderView).toMatch(/data-testid="file-compare-report-panel"/)
    expect(folderView).toMatch(/data-testid="file-compare-report-backdrop"/)
    expect(folderView).toMatch(/aria-modal="true"/)
    expect(folderView).toMatch(/\.file-compare-report-panel\s*\{[\s\S]*?padding:\s*4px 6px/)
    expect(folderView).toMatch(/\.file-compare-report-panel\s*\{[\s\S]*?gap:\s*4px/)
    expect(folderView).toMatch(/\.file-compare-report-header\s*\{[\s\S]*?min-height:\s*18px/)
    expect(folderView).toMatch(/\.file-compare-report-row select\s*\{[\s\S]*?height:\s*20px/)
    expect(folderView).toMatch(/\.file-compare-report-scope\s*\{[\s\S]*?padding:\s*2px 4px/)
    expect(folderView).toMatch(/\.file-compare-report-scope label\s*\{[\s\S]*?min-height:\s*18px/)
    expect(folderView).toMatch(/\.file-compare-report-scope label\s*\{[\s\S]*?gap:\s*4px/)
    expect(folderView).toMatch(/\.file-compare-report-footer\s*\{[\s\S]*?min-height:\s*20px/)
    expect(folderView).toMatch(/\.file-compare-report-footer\s*\{[\s\S]*?gap:\s*4px/)
    expect(folderView).not.toMatch(/class="folder-operation-panel file-compare-report-panel"/)

    expect(css).toMatch(/\.file-compare-report-panel\s*\{[\s\S]*?display:\s*grid\s*!important/)
    expect(css).toMatch(/\.file-compare-report-panel\s*\{[\s\S]*?padding:\s*4px 6px\s*!important/)
    expect(css).toMatch(/\.file-compare-report-row select\s*\{[\s\S]*?height:\s*20px\s*!important/)
    expect(css).toMatch(
      /\.file-compare-report-scope label\s*\{[\s\S]*?min-height:\s*18px\s*!important/,
    )
    expect(css).toMatch(/\.file-compare-report-footer\s*\{[\s\S]*?min-height:\s*20px\s*!important/)
  })

  it('keeps Reports / Scripts export form chrome dense one more notch', () => {
    expect(reportsView).toMatch(/\.report-export-form\s*\{[\s\S]*?padding:\s*2px 4px/)
    expect(reportsView).toMatch(
      /\.report-export-form input,\s*\.report-export-form select\s*\{[\s\S]*?height:\s*20px/,
    )
    expect(reportsView).toMatch(/\.report-row\s*\{[\s\S]*?min-height:\s*20px/)
    expect(reportsView).toMatch(/\.script-path\s*\{[\s\S]*?padding:\s*2px 4px 0/)
    expect(reportsView).toMatch(
      /\.script-path input,\s*\.script-path select,\s*\.script-panel textarea\s*\{[\s\S]*?padding:\s*2px 4px/,
    )
    expect(css).toMatch(/\.reports-script-view \.report-export-form\s*\{[\s\S]*?padding:\s*2px 4px/)
    expect(css).toMatch(
      /\.reports-script-view \.report-export-form input,\s*\.reports-script-view \.report-export-form select\s*\{[\s\S]*?height:\s*20px/,
    )
    expect(css).toMatch(/\.reports-script-view \.report-row\s*\{[\s\S]*?min-height:\s*20px/)
    expect(reportsView).toMatch(
      /\.script-path input,\s*\.script-path select,\s*\.script-panel textarea\s*\{[\s\S]*?border-radius:\s*0/,
    )
    expect(reportsView).toMatch(/\.script-command-lists\s*\{[\s\S]*?padding:\s*2px 4px/)
    expect(reportsView).toMatch(/\.script-command-lists\s*\{[\s\S]*?border-radius:\s*0/)
    expect(css).toMatch(/\.reports-script-view \.script-path\s*\{[\s\S]*?padding:\s*2px 4px 0/)
    expect(reportsView).toMatch(/\.reports-script-view\s*\{[\s\S]*?padding:\s*2px 4px/)
    expect(reportsView).toMatch(/\.reports-script-view\s*\{[\s\S]*?gap:\s*4px/)
    expect(reportsView).toMatch(/\.report-error,\s*\.report-empty\s*\{[\s\S]*?padding:\s*2px 4px/)
  })
})

describe('report-scope fill', () => {
  it('matches capture report-scope fill #f0f0f0', () => {
    expect(css).toMatch(/\.file-compare-report-scope\s*\{[\s\S]*?background:\s*#f0f0f0/)
  })
})

describe('report-scope border', () => {
  it('matches capture report-scope border #c0c0c0', () => {
    expect(css).toMatch(/\.file-compare-report-scope\s*\{[\s\S]*?border:\s*1px solid #c0c0c0/)
  })
})

describe('report-panel border', () => {
  it('matches capture report-panel border #c0c0c0', () => {
    expect(css).toMatch(/\.file-compare-report-panel\s*\{[\s\S]*?border:\s*1px solid #c0c0c0/)
  })
})

describe('report-header border', () => {
  it('matches capture report-header border #c0c0c0', () => {
    expect(css).toMatch(
      /\.file-compare-report-header\s*\{[\s\S]*?border-bottom:\s*1px solid #c0c0c0/,
    )
  })
})

describe('report-row select border', () => {
  it('matches capture report-row select border #c0c0c0', () => {
    expect(css).toMatch(/\.file-compare-report-row select\s*\{[\s\S]*?border:\s*1px solid #c0c0c0/)
  })
})
