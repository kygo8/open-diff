import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..')
const layout = readFileSync(resolve(root, 'src/layouts/AppLayout.vue'), 'utf8')

describe('status strip pixel density', () => {
  it('keeps folder-pair 7-segment strip at 20px with capture-like separators', () => {
    expect(layout).toMatch(
      /\.status-bar\[data-chrome-kind='folder-pair'\][\s\S]*?height:\s*19\.5px/,
    )
    expect(layout).toMatch(
      /\.status-bar\[data-chrome-kind='folder-pair'\][\s\S]*?line-height:\s*18px/,
    )
    expect(layout).toMatch(
      /\.status-bar\[data-chrome-kind='folder-pair'\] \.status-bar-pane\s*\{[\s\S]*?padding:\s*0 4px/,
    )
    expect(layout).toMatch(/\.status-bar-pane\s*\{[\s\S]*?border-right:\s*1px solid #c0c0c0/)
    expect(layout).toMatch(
      /data-pane-count='7'\] \.status-bar-pane:nth-child\(3\)[\s\S]*?border-right-color:\s*#8e8e8e/,
    )
    expect(layout).toMatch(/const statusBarGridStyle = computed/)
    expect(layout).toMatch(
      /gridTemplateColumns: `repeat\(\$\{String\(statusChromePanes\.value\.length\)\}, minmax\(0, 1fr\)\)`/,
    )
    expect(layout).toMatch(/chromeKind === 'table-session'/)
    expect(layout).toMatch(
      /chromeKind === 'folder-merge'[\s\S]*?chromeKind === 'folder-pair'[\s\S]*?chromeKind === 'text-session'[\s\S]*?chromeKind === 'table-session'/,
    )
    expect(layout).toMatch(
      /\.status-bar\[data-chrome-kind='folder-pair'\][\s\S]*?222px 130px 221\.5px 38px 222px 130px minmax\(0, 1fr\)/,
    )
    expect(layout).toMatch(/buildFolderPairStatusPanes/)
    expect(layout).toMatch(/buildFolderSyncStatusPanes/)
    expect(layout).toMatch(/data-chrome-kind='folder-sync'\]\[data-pane-count='5'\]/)
    expect(layout).toMatch(/data-chrome-kind='folder-pair'\]\[data-pane-count='7'\]/)
  })

  it('keeps session status bars at 19.5px with shared typography', () => {
    expect(layout).toMatch(/\.status-bar\s*\{[\s\S]*?background:\s*#f0f0f0/)
    expect(layout).toMatch(/\.status-bar\s*\{[\s\S]*?color:\s*#000000/)
    expect(layout).toMatch(/\.status-bar\s*\{[\s\S]*?font-size:\s*11px/)
    expect(layout).toMatch(
      /\.status-bar\[data-chrome-kind='text-session'\][\s\S]*?height:\s*19\.5px/,
    )
    expect(layout).toMatch(
      /\.status-bar\[data-chrome-kind='text-session'\]\s*\{[\s\S]*?grid-template-columns:\s*294px minmax\(0, 391\.5px\) 91\.5px minmax\(0, 1fr\)/,
    )
    expect(layout).toMatch(
      /\.status-bar\[data-chrome-kind='text-session'\] \.status-bar-pane[\s\S]*?padding:\s*0 4px/,
    )
    expect(layout).toMatch(
      /\.app-shell-dense-chrome:has\(\.status-bar\[data-chrome-kind='folder-pair'\]\)[\s\S]*?19\.5px/,
    )
    expect(layout).toMatch(
      /\.app-shell-dense-chrome:has\(\.status-bar\[data-chrome-kind\$='-session'\]\)[\s\S]*?19\.5px/,
    )
  })

  it('keeps folder-merge 12-segment strip at capture height with column dividers', () => {
    expect(layout).toMatch(
      /\.status-bar\[data-chrome-kind='folder-merge'\][\s\S]*?height:\s*19\.5px/,
    )
    expect(layout).toMatch(
      /\.status-bar\[data-chrome-kind='folder-merge'\][\s\S]*?line-height:\s*18px/,
    )
    expect(layout).toMatch(
      /\.status-bar\[data-chrome-kind='folder-merge'\] \.status-bar-pane\s*\{[\s\S]*?padding:\s*0 4px/,
    )
    expect(layout).toMatch(
      /\.status-bar\[data-chrome-kind='folder-merge'\]\[data-pane-count='12'\] \.status-bar-pane:nth-child\(4\)/,
    )
    expect(layout).toMatch(
      /\.status-bar\[data-chrome-kind='folder-merge'\][\s\S]*?38px 113\.5px 131px 113\.5px 39px 113px 131px 113\.5px 39px 113px 131px minmax\(\s*0,\s*1fr\s*\)/,
    )
    expect(layout).toMatch(
      /\.app-shell-dense-chrome:has\(\.status-bar\[data-chrome-kind='folder-merge'\]\)/,
    )
  })
})

describe('status strip band residual', () => {
  it('keeps 19.5px band content chrome residual toward capture', () => {
    expect(layout).toMatch(/data-status-band="capture-1to1-residual"/)
    expect(layout).toMatch(/\.status-bar\s*\{[\s\S]*?border-top:\s*1px solid #a0a0a0/)
    expect(layout).toMatch(/\.status-bar\s*\{[\s\S]*?height:\s*19\.5px/)
    expect(layout).toMatch(
      /\.status-bar\[data-status-band='capture-1to1-residual'\] \.status-bar-pane\s*\{[\s\S]*?text-overflow:\s*ellipsis/,
    )
  })

  it('keeps text/hex Insert status pane on capture 91.5px band', () => {
    expect(layout).toMatch(/data-testid='status-pane-edit'\][\s\S]*?width:\s*91\.5px/)
  })
})

describe('table status strip columns residual', () => {
  it('pins Table Compare status columns to capture widths', () => {
    expect(layout).toMatch(
      /\.status-bar\[data-chrome-kind='table-session'\]\s*\{[\s\S]*?grid-template-columns:\s*294px minmax\(0, 391\.5px\) minmax\(0, 1fr\)/,
    )
  })
})

describe('registry-session status strip columns residual', () => {
  it('pins Registry Compare status columns to capture widths', () => {
    expect(layout).toMatch(
      /\.status-bar\[data-chrome-kind='registry-session'\]\s*\{[\s\S]*?grid-template-columns:\s*294px minmax\(0, 391\.5px\) minmax\(0, 1fr\)/,
    )
  })
})

describe('picture-session status strip columns residual', () => {
  it('pins Picture Compare status columns to capture widths', () => {
    expect(layout).toMatch(
      /\.status-bar\[data-chrome-kind='picture-session'\]\s*\{[\s\S]*?grid-template-columns:\s*294px minmax\(0, 391\.5px\) minmax\(0, 1fr\)/,
    )
  })
})

describe('media-session status strip columns residual', () => {
  it('pins Media Compare status columns to capture widths', () => {
    expect(layout).toMatch(
      /\.status-bar\[data-chrome-kind='media-session'\]\s*\{[\s\S]*?grid-template-columns:\s*294px minmax\(0, 391\.5px\) minmax\(0, 1fr\)/,
    )
  })
})

describe('version-session status strip columns residual', () => {
  it('pins Version Compare status columns to capture widths', () => {
    expect(layout).toMatch(
      /\.status-bar\[data-chrome-kind='version-session'\]\s*\{[\s\S]*?grid-template-columns:\s*294px minmax\(0, 391\.5px\) minmax\(0, 1fr\)/,
    )
  })
})

describe('hex-session status strip columns residual', () => {
  it('pins Hex Compare status columns to capture widths', () => {
    expect(layout).toMatch(
      /\.status-bar\[data-chrome-kind='hex-session'\]\s*\{[\s\S]*?grid-template-columns:\s*294px 91\.5px minmax\(0, 1fr\)/,
    )
  })
})

describe('text-edit status strip columns residual', () => {
  it('pins Text Edit status columns to capture widths', () => {
    expect(layout).toMatch(
      /\.status-bar\[data-chrome-kind='text-edit-session'\]\s*\{[\s\S]*?grid-template-columns:\s*91\.5px minmax\(0, 1fr\)/,
    )
  })
})

describe('clipboard status strip columns residual', () => {
  it('pins Clipboard Compare status columns to capture widths', () => {
    expect(layout).toMatch(
      /\.status-bar\[data-chrome-kind='clipboard-session'\]\s*\{[\s\S]*?grid-template-columns:\s*294px minmax\(0, 391\.5px\) minmax\(0, 1fr\)/,
    )
  })
})
