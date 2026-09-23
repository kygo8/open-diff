import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..')

describe('folder toolbar narrow layout CSS', () => {
  it('keeps path-pair and toolbar from collapsing under results', () => {
    const mainCss = readFileSync(resolve(root, 'src/styles/main.css'), 'utf8')
    const view = readFileSync(resolve(root, 'src/views/FolderCompareView.vue'), 'utf8')

    expect(mainCss).toMatch(/\.folder-toolbar\s*\{[\s\S]*?min-height:\s*min-content\s*!important/)
    expect(mainCss).toMatch(
      /\.folder-toolbar \.path-pair\s*\{[\s\S]*?min-height:\s*min-content\s*!important/,
    )
    expect(mainCss).toMatch(
      /@media \(width <= 1100px\)\s*\{[\s\S]*?grid-template-columns:\s*minmax\(0, 1fr\)\s*!important/,
    )
    expect(view).toContain('min-height: min-content')
    expect(view).toMatch(
      /grid-template-rows:\s*max-content max-content max-content max-content max-content minmax\(0, 1fr\)\s*max-content/,
    )
    expect(view).toMatch(
      /@media \(width <= 1100px\)[\s\S]*?grid-template-columns:\s*minmax\(0, 1fr\)/,
    )
  })
})
