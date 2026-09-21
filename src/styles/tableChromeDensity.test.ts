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
    expect(css).toMatch(/\.table-compare-view \.table-source-controls[\s\S]*?min-height:\s*20px/)
    expect(css).toMatch(/\.table-compare-view \.table-source-controls input[\s\S]*?height:\s*20px/)
    expect(css).toMatch(/\.table-compare-view \.path-side-footer\s*\{[\s\S]*?font-size:\s*11px/)
    expect(css).toMatch(/\.table-compare-view \.path-side-footer\s*\{[\s\S]*?min-height:\s*20px/)
    expect(css).toMatch(/\.table-compare-view \.table-grid-row\s*\{[\s\S]*?min-height:\s*20px/)

    expect(tableView).toMatch(/\.table-compare-view\s*\{[\s\S]*?padding:\s*2px 4px/)
    expect(tableView).toMatch(/\.table-source-controls[\s\S]*?padding:\s*1px 3px/)
    expect(tableView).toMatch(/\.table-source-controls input[\s\S]*?height:\s*20px/)
    expect(tableView).toMatch(/\.table-navigation-bar button\s*\{[\s\S]*?height:\s*18px/)
    expect(tableView).toMatch(/\.table-grid-row\s*\{[\s\S]*?min-height:\s*20px/)
    expect(tableView).toMatch(/\.path-side-footer\s*\{[\s\S]*?font-size:\s*11px/)
    expect(tableView).toMatch(/\.path-side-footer\s*\{[\s\S]*?min-height:\s*20px/)
    expect(tableView).toMatch(/chromeKind:\s*'table-session'/)
    expect(tableView).not.toMatch(/font-size:\s*9px/)
    expect(tableView).not.toMatch(/min-height:\s*9px/)

    expect(layout).toMatch(/data-chrome-kind='table-session'[\s\S]*?height:\s*22px/)
    expect(css).toMatch(/\.bc-session-toolbar\s*\{[\s\S]*?min-height:\s*38px/)
  })

  it('keeps Table report-action chrome on the session-panel band', () => {
    expect(tableView).toMatch(/\.table-report-actions\s*\{[\s\S]*?gap:\s*4px/)
    expect(tableView).not.toMatch(/\.table-report-actions\s*\{[\s\S]*?gap:\s*0\.5rem/)
  })
})
