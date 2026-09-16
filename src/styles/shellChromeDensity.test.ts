import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

describe('shell chrome density', () => {
  const source = readFileSync(resolve(__dirname, '../layouts/AppLayout.vue'), 'utf8')
  const mainCss = readFileSync(resolve(__dirname, './main.css'), 'utf8')
  const workbench = readFileSync(
    resolve(__dirname, '../components/workbench/WorkbenchShell.vue'),
    'utf8',
  )

  it('keeps single-session dense chrome at 48px menu bar', () => {
    expect(source).toMatch(/\.app-shell-dense-chrome\s*\{[\s\S]*?grid-template-rows:\s*48px/)
    expect(source).toMatch(
      /\.app-shell-dense-chrome \.menu-bar\s*\{[\s\S]*?grid-template-rows:\s*24px 24px/,
    )
    expect(source).toMatch(
      /\.app-shell-dense-chrome:has\(\.status-bar\[data-chrome-kind='folder-pair'\]\)[\s\S]*?grid-template-rows:\s*48px minmax\(0, 1fr\) 22px/,
    )
  })

  it('densifies multi-tab title/menu/tab strip toward captures', () => {
    expect(source).toMatch(/grid-template-rows:\s*48px minmax\(0, 1fr\) 24px/)
    expect(source).toMatch(/\.menu-bar\s*\{[\s\S]*?grid-template-rows:\s*24px 24px/)
    expect(source).toMatch(/\.tab-strip\s*\{[\s\S]*?padding:\s*0/)
    expect(source).toMatch(/\.tab-chip button\s*\{[\s\S]*?height:\s*12px/)
    expect(source).toMatch(/\.menu-bar\s*\{[\s\S]*?border-bottom:\s*1px solid #a0a0a0/)
  })

  it('keeps WorkbenchShell session toolbar/content frame denser', () => {
    expect(mainCss).toMatch(
      /\.workbench-shell-single-session \.bc-session-toolbar\s*\{[\s\S]*?min-height:\s*44px/,
    )
    expect(mainCss).toMatch(/\.workbench-titlebar\s*\{[\s\S]*?height:\s*16px/)
    expect(mainCss).toMatch(/\.bc-session-toolbar\s*\{[\s\S]*?min-height:\s*44px/)
    expect(mainCss).toMatch(/\.bc-session-toolbar\s*\{[\s\S]*?border-bottom:\s*1px solid #a0a0a0/)
  })

  it('marks WorkbenchShell frame densify pass 9', () => {
    expect(workbench).toMatch(/data-shell-density="capture-pass9"/)
  })
})
