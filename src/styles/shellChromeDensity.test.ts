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

  it('collapses single-session dense chrome to capture 23.5px menu row', () => {
    expect(source).toMatch(/\.app-shell-dense-chrome\s*\{[\s\S]*?grid-template-rows:\s*23\.5px/)
    expect(source).toMatch(
      /\.app-shell-dense-chrome \.menu-bar\s*\{[\s\S]*?grid-template-rows:\s*23\.5px/,
    )
    expect(source).toMatch(/\.app-shell-dense-chrome \.brand\s*\{[\s\S]*?display:\s*none/)
    expect(source).toMatch(
      /\.app-shell-dense-chrome:has\(\.status-bar\[data-chrome-kind='folder-pair'\]\)[\s\S]*?grid-template-rows:\s*23\.5px minmax\(0, 1fr\) 19\.5px/,
    )
  })

  it('keeps multi-tab title/menu/tab strip at capture CSS scale', () => {
    expect(source).toMatch(/grid-template-rows:\s*48px minmax\(0, 1fr\) 24px/)
    expect(source).toMatch(/\.menu-bar\s*\{[\s\S]*?grid-template-rows:\s*24px 24px/)
    expect(source).toMatch(/\.tab-strip\s*\{[\s\S]*?padding:\s*0/)
    expect(source).toMatch(/\.tab-strip\s*\{[\s\S]*?min-height:\s*22px/)
    expect(source).toMatch(/\.tab-chip button\s*\{[\s\S]*?height:\s*22px/)
    expect(source).toMatch(/\.tab-chip button\s*\{[\s\S]*?font-size:\s*11px/)
    expect(source).toMatch(/data-menu-density="capture-1to1"/)
    expect(source).toMatch(/\.menu-bar\s*\{[\s\S]*?background:\s*#f0f0f0/)
    expect(source).toMatch(/\.menu-panel\s*\{[\s\S]*?border-radius:\s*0/)
    expect(source).toMatch(/\.menu-panel button,[\s\S]*?min-height:\s*22px/)
    expect(source).toMatch(/\.menu-panel button,[\s\S]*?font-size:\s*12px/)
    expect(source).toMatch(/\.menus\s*\{[\s\S]*?border-top:\s*1px solid #d0d0d0/)
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
      /\.workbench-shell-single-session \.bc-session-toolbar\s*\{[\s\S]*?min-height:\s*39\.5px/,
    )
    expect(mainCss).toMatch(/\.workbench-titlebar\s*\{[\s\S]*?height:\s*22px/)
    expect(mainCss).toMatch(/\.bc-session-toolbar\s*\{[\s\S]*?min-height:\s*39\.5px/)
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

  it('marks WorkbenchShell frame at capture-1to1 density', () => {
    expect(workbench).toMatch(/data-shell-density="capture-1to1"/)
  })

  it('keeps Help About dialog residual capture chrome', () => {
    expect(source).toMatch(/data-about-chrome="capture-1to1-residual"/)
    expect(source).toMatch(
      /\.about-dialog\[data-about-chrome='capture-1to1-residual'\]\s*\{[\s\S]*?background:\s*#f0f0f0/,
    )
    expect(source).toMatch(/\.about-dialog button\s*\{[\s\S]*?height:\s*18px/)
  })

  it('keeps Session/Tools menu visible separator and enabled chrome', () => {
    expect(source).toMatch(/data-menu-chrome="capture-1to1-residual"/)
    expect(source).toMatch(/menuPanelEntries/)
    expect(source).toMatch(/class="menu-separator"/)
    expect(source).toMatch(/data-enabled/)
    expect(source).toMatch(/\.menu-separator\s*\{[\s\S]*?background:\s*#c0c0c0/)
    expect(source).toMatch(/menu-command\[data-enabled='false'\]/)
    expect(source).toMatch(/data-menu-sep="capture-1to1-residual"/)
    expect(source).toMatch(/\.menu-separator\s*\{[\s\S]*?margin:\s*2px 4px/)
    expect(source).toMatch(
      /data-menu-chrome='capture-1to1-residual'\] \.menus button\s*\{[\s\S]*?height:\s*21\.5px/,
    )
    expect(source).toMatch(/menus button\.active\s*\{[\s\S]*?background:\s*#c8e4ff/)
  })

  it('keeps tab strip and sole-session frame residual capture chrome', () => {
    expect(source).toMatch(/data-tab-strip-density="capture-1to1-residual"/)
    expect(source).toMatch(
      /\.tab-strip\[data-tab-strip-density='capture-1to1-residual'\]\s*\{[\s\S]*?background:\s*#f0f0f0/,
    )
    expect(mainCss).toMatch(
      /\.workbench-shell-single-session \.bc-session-toolbar\s*\{[\s\S]*?background:\s*#f0f0f0/,
    )
  })
})

describe('menu session width residual', () => {
  const source = readFileSync(resolve(__dirname, '../layouts/AppLayout.vue'), 'utf8')

  it('pins session menu top-level width to capture 55px', () => {
    expect(source).toMatch(/data-menu-id='session'\][\s\S]*?width:\s*55px/)
  })
})

describe('menu file width residual', () => {
  const source = readFileSync(resolve(__dirname, '../layouts/AppLayout.vue'), 'utf8')

  it('pins file menu top-level width to capture 31.5px', () => {
    expect(source).toMatch(/data-menu-id='file'\][\s\S]*?width:\s*31\.5px/)
  })
})

describe('menu edit width residual', () => {
  const source = readFileSync(resolve(__dirname, '../layouts/AppLayout.vue'), 'utf8')

  it('pins edit menu top-level width to capture 33.5px', () => {
    expect(source).toMatch(/data-menu-id='edit'\][\s\S]*?width:\s*33\.5px/)
  })
})

describe('menu search width residual', () => {
  const source = readFileSync(resolve(__dirname, '../layouts/AppLayout.vue'), 'utf8')

  it('pins search menu top-level width to capture 50.5px', () => {
    expect(source).toMatch(/data-menu-id='search'\][\s\S]*?width:\s*50\.5px/)
  })
})

describe('menu view width residual', () => {
  const source = readFileSync(resolve(__dirname, '../layouts/AppLayout.vue'), 'utf8')

  it('pins view menu top-level width to capture 39.5px', () => {
    expect(source).toMatch(/data-menu-id='view'\][\s\S]*?width:\s*39\.5px/)
  })
})

describe('menu tools width residual', () => {
  const source = readFileSync(resolve(__dirname, '../layouts/AppLayout.vue'), 'utf8')

  it('pins tools menu top-level width to capture 42.5px', () => {
    expect(source).toMatch(/data-menu-id='tools'\][\s\S]*?width:\s*42\.5px/)
  })
})

describe('menu help width residual', () => {
  const source = readFileSync(resolve(__dirname, '../layouts/AppLayout.vue'), 'utf8')

  it('pins help menu top-level width to capture 39px', () => {
    expect(source).toMatch(/data-menu-id='help'\][\s\S]*?width:\s*39px/)
  })
})

describe('menu actions width residual', () => {
  const source = readFileSync(resolve(__dirname, '../layouts/AppLayout.vue'), 'utf8')

  it('pins actions menu top-level width to capture 54.5px', () => {
    expect(source).toMatch(/data-menu-id='actions'\][\s\S]*?width:\s*54\.5px/)
  })
})
