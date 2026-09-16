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
    expect(css).toMatch(/\.folder-peek-panel/)
    expect(css).toMatch(/\.folder-sync-peek-panel/)
    expect(css).toMatch(/\.folder-merge-peek-panel/)
    expect(css).toMatch(/\.peek-tabs\s*\{/)
    expect(css).toMatch(/\.peek-tab\s*\{/)
    expect(css).toMatch(/\.peek-tab-active\s*\{/)
    expect(css).toMatch(/\.peek-tab\s*\{[\s\S]*?height:\s*14px/)
    expect(css).toMatch(/\.peek-tab\s*\{[\s\S]*?font-size:\s*10px/)
    expect(css).toMatch(/\.folder-peek-panel,[\s\S]*?padding:\s*0 2px 1px/)
    expect(css).toMatch(/\.peek-dual-columns\s*\{/)
    expect(css).toMatch(/grid-template-columns:\s*minmax\(0, 1fr\) minmax\(0, 1fr\)/)
    expect(css).toMatch(/\.peek-dual-columns\s*\{[\s\S]*?gap:\s*1px/)
    expect(css).toMatch(/\.folder-peek-panel dl > div,[\s\S]*?min-height:\s*18px/)
    expect(css).toMatch(/\.folder-peek-panel header,[\s\S]*?min-height:\s*14px/)
    expect(css).toMatch(/\.peek-tabs\s*\{[\s\S]*?min-height:\s*14px/)

    expect(folderView).toMatch(/data-testid="folder-peek-tabs"/)
    expect(folderView).toMatch(/data-testid="folder-peek-dual"/)
    expect(folderView).toMatch(/data-testid="folder-peek-left-col"/)
    expect(folderView).toMatch(/data-testid="folder-peek-right-col"/)
    expect(folderView).toMatch(/data-testid="folder-peek-importance"/)
    expect(folderView).toMatch(/\.folder-peek-panel\s*\{[\s\S]*?padding:\s*0 2px 1px/)
    expect(folderView).toMatch(/\.folder-peek-panel\s*\{[\s\S]*?font-size:\s*11px/)
    expect(folderView).toMatch(/\.folder-peek-panel header\s*\{[\s\S]*?min-height:\s*14px/)
    expect(folderView).toMatch(/\.peek-dual-columns\s*\{[\s\S]*?gap:\s*1px/)

    expect(syncView).toMatch(/data-testid="folder-sync-peek-tabs"/)
    expect(syncView).toMatch(/data-testid="folder-sync-peek-dual"/)
    expect(syncView).toMatch(/\.folder-sync-peek-panel\s*\{[\s\S]*?padding:\s*0 2px 1px/)
    expect(syncView).toMatch(/\.folder-sync-peek-panel header\s*\{[\s\S]*?min-height:\s*14px/)

    expect(mergeView).toMatch(/data-testid="folder-merge-peek-tabs"/)
    expect(mergeView).toMatch(/data-testid="folder-merge-peek-dual"/)
    expect(mergeView).toMatch(/\.folder-merge-peek-panel\s*\{[\s\S]*?padding:\s*0 2px 1px/)
    expect(mergeView).toMatch(/\.folder-merge-peek-panel header\s*\{[\s\S]*?min-height:\s*14px/)
  })
})

describe('options dialog densify', () => {
  it('uses a dense tree/content Options layout and keeps wired section ids', () => {
    expect(settingsView).toMatch(/\.settings-view\s*\{[\s\S]*?grid-template-columns:\s*168px/)
    expect(settingsView).toMatch(/\.settings-view\s*\{[\s\S]*?padding:\s*6px/)
    expect(settingsView).toMatch(/\.options-section-button\s*\{[\s\S]*?min-height:\s*18px/)
    expect(settingsView).toMatch(
      /\.stack-row input,\s*\.stack-row select\s*\{[\s\S]*?height:\s*20px/,
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
    expect(settingsView).toMatch(/data-testid="show-folder-legend"/)
    expect(settingsView).toMatch(/data-testid="confirm-before-copy"/)
    expect(settingsView).toMatch(/data-testid="confirm-before-move"/)
    expect(settingsView).toMatch(/data-testid="confirm-before-sync-delete"/)
    expect(settingsView).toMatch(/data-testid="create-backup-on-report-export"/)
    expect(settingsView).toMatch(/data-testid="folder-compare-crc"/)
    expect(settingsView).toMatch(/data-testid="folder-compare-attributes"/)
    expect(settingsView).toMatch(/data-testid="profile-default-host"/)
    expect(settingsView).toMatch(/data-testid="report-open-after-export"/)
    expect(settingsView).toMatch(/data-testid="report-clear-history-on-exit"/)
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
