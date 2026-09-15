import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..')
const css = readFileSync(resolve(root, 'src/styles/main.css'), 'utf8')
const folderView = readFileSync(resolve(root, 'src/views/FolderCompareView.vue'), 'utf8')
const syncView = readFileSync(resolve(root, 'src/views/FolderSyncView.vue'), 'utf8')
const mergeView = readFileSync(resolve(root, 'src/views/FolderMergeView.vue'), 'utf8')

describe('folder chrome density', () => {
  it('keeps Folder/Sync/Merge session bodies and strips dense toward capture', () => {
    expect(css).toMatch(
      /\.folder-compare-view,\s*\.folder-sync-view,\s*\.folder-merge-view\s*\{[\s\S]*?padding:\s*4px 6px/,
    )
    expect(css).toMatch(/\.folder-toolbar\s*\{[\s\S]*?gap:\s*4px\s*!important/)
    expect(css).toMatch(/\.folder-toolbar \.folder-criteria\s*\{[\s\S]*?gap:\s*3px 8px/)
    expect(css).toMatch(/\.folder-toolbar \.folder-actions\s*\{[\s\S]*?gap:\s*4px/)
    expect(folderView).toMatch(/\.folder-compare-view\s*\{[\s\S]*?padding:\s*4px 6px/)
    expect(folderView).toMatch(/\.path-side-footer\s*\{[\s\S]*?font-size:\s*10px/)
    expect(folderView).toMatch(/\.folder-criteria\s*\{[\s\S]*?gap:\s*3px 8px/)
    expect(syncView).toMatch(/\.folder-sync-view\s*\{[\s\S]*?padding:\s*4px 6px/)
    expect(syncView).toMatch(/\.path-side-footer\s*\{[\s\S]*?font-size:\s*10px/)
    expect(mergeView).toMatch(/\.folder-merge-view\s*\{[\s\S]*?padding:\s*4px 6px/)
  })
})
