import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..')
const css = readFileSync(resolve(root, 'src/styles/main.css'), 'utf8')
const folderView = readFileSync(resolve(root, 'src/views/FolderCompareView.vue'), 'utf8')
const textView = readFileSync(resolve(root, 'src/views/TextCompareView.vue'), 'utf8')
const filters = readFileSync(resolve(root, 'src/app/folderDisplayFilters.ts'), 'utf8')
const e2e = readFileSync(resolve(root, 'tests/e2e/ui-design-alignment.spec.ts'), 'utf8')

describe('HTML demo simplify chrome', () => {
  it('defaults Rules and Filters panels off to match demo hierarchy', () => {
    expect(folderView).toMatch(/const showFolderRules = ref\(false\)/)
    expect(textView).toMatch(/const showTextRules = ref\(false\)/)
    expect(filters).toMatch(/showFiltersPanel:\s*false/)
    expect(filters).toMatch(/showFiltersPanel:\s*parsed\.showFiltersPanel === true/)
  })

  it('tucks non-demo headers and export docks while keeping Compare/Run CTAs', () => {
    expect(css).toMatch(/\.hex-header[\s\S]*?display:\s*none\s*!important/)
    expect(css).toMatch(/\.picture-header[\s\S]*?display:\s*none\s*!important/)
    expect(css).toMatch(/\.file-format-view \.format-io-panel[\s\S]*?display:\s*none\s*!important/)
    expect(css).toMatch(/\.options-hint[\s\S]*?display:\s*none\s*!important/)
    expect(css).toMatch(
      /\.folder-compare-view \.path-meta-footer[\s\S]*?display:\s*none\s*!important/,
    )
    expect(css).toMatch(/\.merge-header[\s\S]*?display:\s*none\s*!important/)
    expect(css).toMatch(/\.hex-report-panel[\s\S]*?display:\s*none\s*!important/)
    expect(css).toMatch(
      /\.folder-actions button\[data-testid\^=.export-.[^\]]*\][\s\S]*?display:\s*none\s*!important/,
    )
    expect(css).toMatch(
      /\.workbench-toolbar\.compare-toolbar,\s*\.text-compare-view \.compare-toolbar\s*\{[\s\S]*?min-height:\s*28px/,
    )
    expect(e2e).toMatch(/toHaveCSS\('height', '26px'\)/)
  })
})
