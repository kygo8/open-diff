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
    expect(source).toMatch(/\.tab-chip button\s*\{[\s\S]*?height:\s*11px/)
    expect(source).toMatch(/\.menu-panel\s*\{[\s\S]*?border-radius:\s*0/)
    expect(source).toMatch(/\.tab-context-menu\s*\{[\s\S]*?border-radius:\s*0/)
    expect(source).toMatch(/\.dirty-tab-prompt\s*\{[\s\S]*?min-height:\s*22px/)
    expect(source).toMatch(/\.menu-bar\s*\{[\s\S]*?border-bottom:\s*1px solid #a0a0a0/)
    expect(source).toMatch(/\.language-panel\s*\{[\s\S]*?border-radius:\s*0/)
    expect(source).toMatch(/\.language-option\s*\{[\s\S]*?min-height:\s*20px/)
    expect(source).toMatch(/\.command-palette\s*\{[\s\S]*?border-radius:\s*0/)
    expect(source).toMatch(/\.command-palette header\s*\{[\s\S]*?height:\s*22px/)
    expect(source).toMatch(/\.command-item\s*\{[\s\S]*?min-height:\s*20px/)
    expect(source).toMatch(/\.command-backdrop\s*\{[\s\S]*?padding-top:\s*52px/)
    expect(source).toMatch(/\.command-palette\s*\{[\s\S]*?padding:\s*2px 4px/)
    expect(source).toMatch(/\.top-actions\s*\{[\s\S]*?gap:\s*2px/)
    expect(source).toMatch(/\.about-dialog\s*\{[\s\S]*?padding:\s*4px 6px/)
    expect(source).toMatch(/\.about-dialog\s*\{[\s\S]*?border-radius:\s*0/)
    expect(source).toMatch(/\.about-dialog button\s*\{[\s\S]*?height:\s*18px/)
    expect(source).toMatch(/\.help-status\s*\{[\s\S]*?padding:\s*2px 4px/)
    expect(source).toMatch(/\.help-status\s*\{[\s\S]*?border-radius:\s*0/)
    expect(source).not.toMatch(/box-shadow:\s*0 10px 28px/)
    expect(source).not.toMatch(/box-shadow:\s*0 8px 22px/)
    expect(source).not.toMatch(/box-shadow:\s*0 18px 50px/)
    expect(source).not.toMatch(/padding:\s*1rem 1\.25rem/)
    expect(source).not.toMatch(/padding-top:\s*84px/)
  })

  it('keeps WorkbenchShell session toolbar/content frame denser', () => {
    expect(mainCss).toMatch(
      /\.workbench-shell-single-session \.bc-session-toolbar\s*\{[\s\S]*?min-height:\s*34px/,
    )
    expect(mainCss).toMatch(/\.workbench-titlebar\s*\{[\s\S]*?height:\s*10px/)
    expect(mainCss).toMatch(/\.bc-session-toolbar\s*\{[\s\S]*?min-height:\s*34px/)
    expect(mainCss).toMatch(/\.bc-session-toolbar\s*\{[\s\S]*?border-bottom:\s*1px solid #a0a0a0/)
    expect(mainCss).toMatch(/\.workbench-inspector-stack\s*\{[\s\S]*?padding:\s*2px 4px/)
    expect(mainCss).toMatch(/\.workbench-inspector-section\s*\{[\s\S]*?border-radius:\s*0/)
    expect(mainCss).toMatch(/\.workbench-inspector-section h2\s*\{[\s\S]*?height:\s*16px/)
    expect(mainCss).toMatch(/\.status-summary-grid article\s*\{[\s\S]*?padding:\s*2px 4px/)
    expect(mainCss).toMatch(/\.status-summary-grid article\s*\{[\s\S]*?border-radius:\s*0/)
    expect(mainCss).toMatch(/\.status-summary-grid strong\s*\{[\s\S]*?font-size:\s*12px/)
    expect(mainCss).toMatch(
      /\.split-pane-header,\s*\.pane-header,\s*\.metadata-header\s*\{[\s\S]*?min-height:\s*20px/,
    )
    expect(mainCss).toMatch(
      /\.path-context-menu,\s*\.in-app-context-menu\s*\{[\s\S]*?border-radius:\s*0/,
    )
    expect(mainCss).toMatch(
      /\.path-context-menu button,\s*\.in-app-context-menu button\s*\{[\s\S]*?padding:\s*2px 4px/,
    )
  })

  it('marks WorkbenchShell frame densify pass 18', () => {
    expect(workbench).toMatch(/data-shell-density="capture-pass18"/)
  })
})
