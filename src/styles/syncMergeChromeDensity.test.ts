import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..')
const css = readFileSync(resolve(root, 'src/styles/main.css'), 'utf8')
const syncView = readFileSync(resolve(root, 'src/views/FolderSyncView.vue'), 'utf8')
const mergeView = readFileSync(resolve(root, 'src/views/FolderMergeView.vue'), 'utf8')
const layout = readFileSync(resolve(root, 'src/layouts/AppLayout.vue'), 'utf8')

describe('folder sync/merge chrome density', () => {
  it('keeps Sync/Merge path/filters/actions/status chrome dense toward Folder Compare', () => {
    expect(css).toMatch(/\.folder-sync-view \.sync-settings\s*\{[\s\S]*?padding:\s*3px 6px/)
    expect(css).toMatch(/\.folder-sync-view \.sync-settings input\s*,[\s\S]*?height:\s*18px/)
    expect(css).toMatch(
      /\.folder-sync-view \.sync-setting-actions \.n-button[\s\S]*?height:\s*22px/,
    )
    expect(css).toMatch(/\.folder-merge-view \.merge-paths\s*\{[\s\S]*?padding:\s*3px 6px/)
    expect(css).toMatch(/\.folder-merge-view \.merge-path-footer\s*\{[\s\S]*?font-size:\s*9px/)
    expect(css).toMatch(/\.folder-merge-view \.merge-actions \.n-button[\s\S]*?height:\s*22px/)

    expect(syncView).toMatch(/\.sync-settings\s*\{[\s\S]*?padding:\s*3px 6px/)
    expect(syncView).toMatch(/\.sync-settings\s*\{[\s\S]*?min-height:\s*26px/)
    expect(syncView).toMatch(/\.path-side-footer\s*\{[\s\S]*?font-size:\s*9px/)
    expect(syncView).toMatch(/\.path-side-footer\s*\{[\s\S]*?min-height:\s*10px/)
    expect(syncView).not.toMatch(
      /joinStatusFooterParts\(syncSelectionLabel\.value, leftFreeSpaceLabel\.value\)/,
    )
    expect(syncView).toMatch(/chromeKind:\s*'folder-pair'/)

    expect(mergeView).toMatch(/\.merge-paths\s*\{[\s\S]*?padding:\s*3px 6px/)
    expect(mergeView).toMatch(/\.merge-path-footer\s*\{[\s\S]*?font-size:\s*9px/)
    expect(mergeView).toMatch(/\.merge-paths\s*\{[\s\S]*?min-height:\s*26px/)
    expect(mergeView).toMatch(/chromeKind:\s*'folder-pair'/)

    expect(layout).toMatch(/\.status-bar\[data-chrome-kind='folder-pair'\][\s\S]*?height:\s*22px/)
  })
})
