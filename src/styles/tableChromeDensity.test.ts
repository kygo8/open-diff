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
    expect(css).toMatch(/\.table-compare-view\s*\{[\s\S]*?padding:\s*6px 8px/)
    expect(css).toMatch(/\.table-compare-view \.table-source-controls input[\s\S]*?height:\s*24px/)
    expect(css).toMatch(/\.table-compare-view \.path-side-footer\s*\{[\s\S]*?font-size:\s*10px/)

    expect(tableView).toMatch(/\.table-compare-view\s*\{[\s\S]*?padding:\s*6px 8px/)
    expect(tableView).toMatch(/chromeKind:\s*'table-session'/)

    expect(layout).toMatch(/data-chrome-kind='table-session'[\s\S]*?height:\s*22px/)
  })
})
