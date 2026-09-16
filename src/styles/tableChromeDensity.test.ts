import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..')
const css = readFileSync(resolve(root, 'src/styles/main.css'), 'utf8')
const tableView = readFileSync(resolve(root, 'src/views/TableCompareView.vue'), 'utf8')
const layout = readFileSync(resolve(root, 'src/layouts/AppLayout.vue'), 'utf8')

describe('table compare chrome density', () => {
  it('keeps Table Compare path/status/controls chrome dense toward capture', () => {
    expect(css).toMatch(/\.table-compare-view\s*\{[\s\S]*?padding:\s*2px 4px/)
    expect(css).toMatch(/\.table-compare-view \.table-source-controls[\s\S]*?min-height:\s*20px/)
    expect(css).toMatch(/\.table-compare-view \.table-source-controls input[\s\S]*?height:\s*16px/)
    expect(css).toMatch(/\.table-compare-view \.path-side-footer\s*\{[\s\S]*?font-size:\s*9px/)
    expect(css).toMatch(/\.table-compare-view \.table-grid-row\s*\{[\s\S]*?min-height:\s*20px/)

    expect(tableView).toMatch(/\.table-compare-view\s*\{[\s\S]*?padding:\s*2px 4px/)
    expect(tableView).toMatch(/\.table-source-controls[\s\S]*?padding:\s*1px 3px/)
    expect(tableView).toMatch(/\.table-source-controls input[\s\S]*?height:\s*16px/)
    expect(tableView).toMatch(/\.table-navigation-bar button\s*\{[\s\S]*?height:\s*18px/)
    expect(tableView).toMatch(/\.table-grid-row\s*\{[\s\S]*?min-height:\s*20px/)
    expect(tableView).toMatch(/\.path-side-footer\s*\{[\s\S]*?font-size:\s*9px/)
    expect(tableView).toMatch(/chromeKind:\s*'table-session'/)

    expect(layout).toMatch(/data-chrome-kind='table-session'[\s\S]*?height:\s*22px/)
  })
})
