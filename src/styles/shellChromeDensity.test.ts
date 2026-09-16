import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

describe('shell chrome density', () => {
  const source = readFileSync(resolve(__dirname, '../layouts/AppLayout.vue'), 'utf8')
  const mainCss = readFileSync(resolve(__dirname, './main.css'), 'utf8')

  it('keeps single-session dense chrome at 52px menu bar', () => {
    expect(source).toMatch(/\.app-shell-dense-chrome\s*\{[\s\S]*?grid-template-rows:\s*52px/)
    expect(source).toMatch(
      /\.app-shell-dense-chrome \.menu-bar\s*\{[\s\S]*?grid-template-rows:\s*26px 26px/,
    )
  })

  it('densifies multi-tab title/menu/tab strip toward captures', () => {
    expect(source).toMatch(/grid-template-rows:\s*58px minmax\(0, 1fr\) 24px/)
    expect(source).toMatch(/\.menu-bar\s*\{[\s\S]*?grid-template-rows:\s*30px 28px/)
    expect(source).toMatch(/\.tab-strip\s*\{[\s\S]*?padding:\s*2px 5px 0/)
    expect(source).toMatch(/\.tab-chip button\s*\{[\s\S]*?height:\s*20px/)
  })

  it('keeps WorkbenchShell session toolbar/content frame denser', () => {
    expect(mainCss).toMatch(
      /\.workbench-shell-single-session \.bc-session-toolbar\s*\{[\s\S]*?min-height:\s*48px/,
    )
    expect(mainCss).toMatch(/\.workbench-titlebar\s*\{[\s\S]*?height:\s*28px/)
    expect(mainCss).toMatch(/\.bc-session-toolbar\s*\{[\s\S]*?min-height:\s*48px/)
  })
})
