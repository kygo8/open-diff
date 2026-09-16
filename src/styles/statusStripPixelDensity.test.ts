import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..')
const layout = readFileSync(resolve(root, 'src/layouts/AppLayout.vue'), 'utf8')

describe('status strip pixel density', () => {
  it('keeps folder-pair 4-segment strip at 22px with capture-like separators', () => {
    expect(layout).toMatch(/\.status-bar\[data-chrome-kind='folder-pair'\][\s\S]*?height:\s*22px/)
    expect(layout).toMatch(
      /\.status-bar\[data-chrome-kind='folder-pair'\][\s\S]*?line-height:\s*20px/,
    )
    expect(layout).toMatch(
      /\.status-bar\[data-chrome-kind='folder-pair'\] \.status-bar-pane\s*\{[\s\S]*?padding:\s*0 4px/,
    )
    expect(layout).toMatch(/\.status-bar-pane\s*\{[\s\S]*?border-right:\s*1px solid #c0c0c0/)
    expect(layout).toMatch(
      /data-pane-count='4'\] \.status-bar-pane:nth-child\(2\)[\s\S]*?border-right-color:\s*#8e8e8e/,
    )
    expect(layout).toMatch(
      /gridTemplateColumns: `repeat\(\$\{statusChromePanes\.length\}, minmax\(0, 1fr\)\)`/,
    )
  })

  it('keeps session status bars at 22px with shared typography', () => {
    expect(layout).toMatch(/\.status-bar\s*\{[\s\S]*?background:\s*#f0f0f0/)
    expect(layout).toMatch(/\.status-bar\s*\{[\s\S]*?color:\s*#000000/)
    expect(layout).toMatch(/\.status-bar\s*\{[\s\S]*?font-size:\s*11px/)
    expect(layout).toMatch(/\.status-bar\[data-chrome-kind='text-session'\][\s\S]*?height:\s*22px/)
    expect(layout).toMatch(
      /\.app-shell-dense-chrome:has\(\.status-bar\[data-chrome-kind='folder-pair'\]\)[\s\S]*?22px/,
    )
    expect(layout).toMatch(
      /\.app-shell-dense-chrome:has\(\.status-bar\[data-chrome-kind\$='-session'\]\)[\s\S]*?22px/,
    )
  })
})
