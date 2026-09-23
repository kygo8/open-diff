import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..')
const layout = readFileSync(resolve(root, 'src/layouts/AppLayout.vue'), 'utf8')

describe('status strip pixel density', () => {
  it('keeps folder-pair 4-segment strip at 20px with capture-like separators', () => {
    expect(layout).toMatch(
      /\.status-bar\[data-chrome-kind='folder-pair'\][\s\S]*?height:\s*19\.5px/,
    )
    expect(layout).toMatch(
      /\.status-bar\[data-chrome-kind='folder-pair'\][\s\S]*?line-height:\s*18px/,
    )
    expect(layout).toMatch(
      /\.status-bar\[data-chrome-kind='folder-pair'\] \.status-bar-pane\s*\{[\s\S]*?padding:\s*0 1px/,
    )
    expect(layout).toMatch(/\.status-bar-pane\s*\{[\s\S]*?border-right:\s*1px solid #c0c0c0/)
    expect(layout).toMatch(
      /data-pane-count='4'\] \.status-bar-pane:nth-child\(2\)[\s\S]*?border-right-color:\s*#8e8e8e/,
    )
    expect(layout).toMatch(
      /gridTemplateColumns: `repeat\(\$\{statusChromePanes\.length\}, minmax\(0, 1fr\)\)`/,
    )
    expect(layout).toMatch(/buildFolderPairStatusPanes/)
    expect(layout).not.toMatch(/data-pane-count='5'/)
  })

  it('keeps session status bars at 19.5px with shared typography', () => {
    expect(layout).toMatch(/\.status-bar\s*\{[\s\S]*?background:\s*#f0f0f0/)
    expect(layout).toMatch(/\.status-bar\s*\{[\s\S]*?color:\s*#000000/)
    expect(layout).toMatch(/\.status-bar\s*\{[\s\S]*?font-size:\s*11px/)
    expect(layout).toMatch(
      /\.status-bar\[data-chrome-kind='text-session'\][\s\S]*?height:\s*19\.5px/,
    )
    expect(layout).toMatch(
      /\.status-bar\[data-chrome-kind='text-session'\] \.status-bar-pane[\s\S]*?padding:\s*0 1px/,
    )
    expect(layout).toMatch(
      /\.app-shell-dense-chrome:has\(\.status-bar\[data-chrome-kind='folder-pair'\]\)[\s\S]*?19\.5px/,
    )
    expect(layout).toMatch(
      /\.app-shell-dense-chrome:has\(\.status-bar\[data-chrome-kind\$='-session'\]\)[\s\S]*?19\.5px/,
    )
  })

  it('keeps folder-merge 6-segment strip at capture height with column dividers', () => {
    expect(layout).toMatch(
      /\.status-bar\[data-chrome-kind='folder-merge'\][\s\S]*?height:\s*19\.5px/,
    )
    expect(layout).toMatch(
      /\.status-bar\[data-chrome-kind='folder-merge'\][\s\S]*?line-height:\s*18px/,
    )
    expect(layout).toMatch(
      /\.status-bar\[data-chrome-kind='folder-merge'\] \.status-bar-pane\s*\{[\s\S]*?padding:\s*0 1px/,
    )
    expect(layout).toMatch(
      /\.status-bar\[data-chrome-kind='folder-merge'\]\[data-pane-count='6'\] \.status-bar-pane:nth-child\(2\)/,
    )
    expect(layout).toMatch(
      /\.app-shell-dense-chrome:has\(\.status-bar\[data-chrome-kind='folder-merge'\]\)/,
    )
  })
})
