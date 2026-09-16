import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..')
const css = readFileSync(resolve(root, 'src/styles/main.css'), 'utf8')
const folderView = readFileSync(resolve(root, 'src/views/FolderCompareView.vue'), 'utf8')
const syncView = readFileSync(resolve(root, 'src/views/FolderSyncView.vue'), 'utf8')
const mergeView = readFileSync(resolve(root, 'src/views/FolderMergeView.vue'), 'utf8')
const settingsView = readFileSync(resolve(root, 'src/views/SettingsView.vue'), 'utf8')
const rafHelper = readFileSync(resolve(root, 'tests/e2e/helpers/ensureAnimationFrames.ts'), 'utf8')
const tauriMock = readFileSync(resolve(root, 'tests/e2e/helpers/tauriMock.ts'), 'utf8')

describe('peek panel densify', () => {
  it('keeps Folder/Sync/Merge peek panels dense with tab chrome', () => {
    expect(css).toMatch(
      /\.folder-peek-panel,\s*\.folder-sync-peek-panel,\s*\.folder-merge-peek-panel/,
    )
    expect(css).toMatch(/\.peek-tabs\s*\{/)
    expect(css).toMatch(/\.peek-tab\s*\{/)
    expect(css).toMatch(/\.peek-tab-active\s*\{/)

    expect(folderView).toMatch(/data-testid="folder-peek-tabs"/)
    expect(folderView).toMatch(/\.folder-peek-panel\s*\{[\s\S]*?padding:\s*2px 6px 4px/)
    expect(folderView).toMatch(/\.folder-peek-panel\s*\{[\s\S]*?font-size:\s*11px/)

    expect(syncView).toMatch(/data-testid="folder-sync-peek-tabs"/)
    expect(syncView).toMatch(/\.folder-sync-peek-panel\s*\{[\s\S]*?padding:\s*2px 6px 4px/)

    expect(mergeView).toMatch(/data-testid="folder-merge-peek-tabs"/)
    expect(mergeView).toMatch(/\.folder-merge-peek-panel\s*\{[\s\S]*?padding:\s*2px 6px 4px/)
  })
})

describe('options dialog densify', () => {
  it('uses a dense tree/content Options layout and keeps wired section ids', () => {
    expect(settingsView).toMatch(/\.settings-view\s*\{[\s\S]*?grid-template-columns:\s*196px/)
    expect(settingsView).toMatch(/\.settings-view\s*\{[\s\S]*?padding:\s*8px/)
    expect(settingsView).toMatch(/\.options-section-button\s*\{[\s\S]*?min-height:\s*22px/)
    expect(settingsView).toMatch(
      /\.stack-row input,\s*\.stack-row select\s*\{[\s\S]*?height:\s*22px/,
    )
    expect(settingsView).toMatch(/data-testid="options-content"/)
    expect(settingsView).toMatch(/data-testid="options-section-nav"/)
    expect(settingsView).toMatch(/options-section-\$\{section\.id\}/)
    expect(settingsView).toMatch(/'folderCompare'/)
    expect(settingsView).toMatch(/'hexCompare'/)
    expect(settingsView).toMatch(/'pictureCompare'/)
    expect(settingsView).toMatch(/'mediaCompare'/)
    expect(settingsView).toMatch(/'versionCompare'/)
    expect(settingsView).toMatch(/'tableCompare'/)
    expect(settingsView).toMatch(/'formats'/)
    expect(settingsView).toMatch(/'profiles'/)
    expect(settingsView).toMatch(/'reports'/)
  })
})

describe('e2e animation-frame harness', () => {
  it('polyfills requestAnimationFrame in main and Playwright utility worlds', () => {
    expect(rafHelper).toMatch(/requestAnimationFrame/)
    expect(rafHelper).toMatch(/setTimeout/)
    expect(rafHelper).toMatch(/playwright_utility/)
    expect(rafHelper).toMatch(/newCDPSession/)
    expect(tauriMock).toMatch(/ensureAnimationFrames/)
  })
})
