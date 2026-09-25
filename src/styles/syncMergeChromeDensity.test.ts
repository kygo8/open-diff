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
    expect(css).toMatch(/\.folder-sync-view \.sync-settings\s*\{[\s\S]*?padding:\s*2px 4px/)
    expect(css).toMatch(/\.folder-sync-view \.sync-settings input\s*,[\s\S]*?height:\s*20px/)
    expect(css).toMatch(
      /\.folder-sync-view \.sync-setting-actions \.n-button[\s\S]*?height:\s*30px/,
    )
    expect(css).toMatch(/\.folder-merge-view \.merge-paths\s*\{[\s\S]*?padding:\s*2px 4px/)
    expect(css).toMatch(/\.folder-merge-view \.merge-to-chrome\s*\{[\s\S]*?min-height:\s*22px/)
    expect(mergeView).toMatch(/\.merge-to-path input\s*\{[\s\S]*?height:\s*16\.5px/)
    expect(css).toMatch(
      /\.folder-merge-view \.merge-actions \.n-button\[data-testid='folder-merge-execute-plan'\][\s\S]*?height:\s*36px/,
    )
    expect(css).toMatch(/\.folder-merge-view \.path-meta-footer[\s\S]*?min-height:\s*20px/)
    expect(css).toMatch(/\.folder-merge-view \.path-meta-footer[\s\S]*?font-size:\s*11px/)
    expect(css).toMatch(/\.folder-merge-view \.merge-actions \.n-button[\s\S]*?height:\s*30px/)

    expect(syncView).toMatch(/\.sync-settings\s*\{[\s\S]*?padding:\s*2px 4px/)
    expect(syncView).toMatch(/\.path-field-row \.path-input\s*\{[\s\S]*?height:\s*16\.5px/)
    expect(syncView).toMatch(/\.sync-settings\s*\{[\s\S]*?min-height:\s*22px/)
    expect(syncView).toMatch(/grid-template-columns:[\s\S]*?326\.5px/)
    expect(syncView).toMatch(/\.sync-settings input,[\s\S]*?height:\s*20px/)
    expect(syncView).toMatch(
      /\.sync-setting-actions :deep\(\.n-button\)\s*\{[\s\S]*?height:\s*30px/,
    )
    expect(css).toMatch(
      /\.folder-sync-view \.sync-setting-actions \.n-button\[data-testid='folder-sync-run'\][\s\S]*?height:\s*74\.5px/,
    )
    expect(syncView).toMatch(/PathMetaFooter/)
    expect(syncView).toMatch(/folder-sync-left-path-footer/)
    expect(syncView).toMatch(/folder-sync-right-path-footer/)
    expect(css).toMatch(/\.folder-sync-view \.path-meta-footer[\s\S]*?min-height:\s*20px/)
    expect(css).toMatch(/\.folder-sync-view \.path-meta-footer[\s\S]*?font-size:\s*11px/)
    expect(syncView).not.toMatch(
      /joinStatusFooterParts\(syncSelectionLabel\.value, leftFreeSpaceLabel\.value\)/,
    )
    expect(syncView).toMatch(/chromeKind:\s*'folder-pair'/)

    expect(mergeView).toMatch(/\.merge-paths\s*\{[\s\S]*?padding:\s*2px 4px/)
    expect(mergeView).toMatch(/PathMetaFooter/)
    expect(mergeView).toMatch(/folder-merge-left-path-footer/)
    expect(mergeView).toMatch(/folder-merge-output-path-footer/)
    expect(css).toMatch(/\.folder-merge-view \.path-meta-footer[\s\S]*?min-height:\s*20px/)
    expect(css).toMatch(/\.folder-merge-view \.path-meta-footer[\s\S]*?font-size:\s*11px/)
    expect(mergeView).toMatch(/\.merge-paths\s*\{[\s\S]*?min-height:\s*22px/)
    expect(mergeView).toMatch(/folder-merge-to-chrome/)
    expect(mergeView).toMatch(/\.merge-actions :deep\(\.n-button\)\s*\{[\s\S]*?height:\s*30px/)
    expect(mergeView).toMatch(/chromeKind:\s*'folder-merge'/)
    expect(mergeView).toMatch(/centerSelection:/)
    expect(mergeView).toMatch(/centerFreeSpace:/)
    expect(mergeView).toMatch(/refreshMergeFreeSpace/)

    expect(layout).toMatch(
      /\.status-bar\[data-chrome-kind='folder-pair'\][\s\S]*?height:\s*19\.5px/,
    )
    expect(layout).toMatch(
      /\.status-bar\[data-chrome-kind='folder-merge'\][\s\S]*?height:\s*19\.5px/,
    )
    expect(layout).toMatch(
      /\.status-bar\[data-chrome-kind='folder-merge'\]\[data-pane-count='12'\]/,
    )
  })

  it('keeps Sync/Merge plan/preview/action chrome dense one more notch vs Folder Compare band', () => {
    expect(css).toMatch(/\.folder-sync-view \.sync-preview-row span[\s\S]*?padding:\s*1px 4px/)
    expect(css).toMatch(/\.folder-sync-view \.sync-preview-row select[\s\S]*?height:\s*20px/)
    expect(css).toMatch(/\.folder-sync-view \.sync-chrome-panel\s*\{[\s\S]*?min-height:\s*18px/)
    expect(css).toMatch(
      /\.folder-sync-view \.sync-setting-actions \.n-button\[data-testid='folder-sync-run'\][\s\S]*?height:\s*74\.5px/,
    )
    expect(css).toMatch(/\.folder-merge-view \.merge-plan-row span[\s\S]*?padding:\s*1px 4px/)
    expect(css).toMatch(/\.folder-merge-view \.merge-actions \.n-button[\s\S]*?height:\s*30px/)
    expect(css).toMatch(/\.folder-merge-view \.conflict-panel li\s*\{[\s\S]*?padding:\s*2px 4px/)

    expect(syncView).toMatch(/\.sync-preview-row span[\s\S]*?padding:\s*1px 4px/)
    expect(syncView).toMatch(/\.sync-preview-row select\s*\{[\s\S]*?height:\s*20px/)
    expect(syncView).toMatch(/data-sync-action-strip="capture-1to1-residual"/)
    expect(syncView).toMatch(/data-sync-capture-actions="capture-1to1-residual"/)
    expect(syncView).toMatch(
      /\.sync-setting-actions-capture\s*\{[\s\S]*?grid-template-columns:\s*95\.5px 95\.5px/,
    )
    expect(syncView).toMatch(
      /\.sync-setting-actions-capture\s*\{[\s\S]*?grid-template-rows:\s*30px 74\.5px/,
    )
    expect(syncView).toMatch(/data-sync-override-density="capture-1to1-residual"/)
    expect(syncView).toMatch(
      /\.sync-setting-actions :deep\(\.n-button\[data-testid='folder-sync-run'\]\)\s*\{[\s\S]*?height:\s*74\.5px/,
    )
    expect(syncView).toMatch(/\.sync-chrome-panel\s*\{[\s\S]*?min-height:\s*18px/)
    expect(syncView).toMatch(/\.sync-preview,\s*\.sync-run-status\s*\{[\s\S]*?padding:\s*2px 4px/)

    expect(mergeView).toMatch(/\.merge-plan-row span[\s\S]*?padding:\s*1px 4px/)
    expect(mergeView).toMatch(/\.merge-chrome-panel\s*\{[\s\S]*?min-height:\s*18px/)
    expect(mergeView).toMatch(/\.merge-chrome-panel button\s*\{[\s\S]*?height:\s*18px/)
    expect(mergeView).toMatch(
      /\.merge-open-status,\s*\.merge-plan,\s*\.conflict-panel\s*\{[\s\S]*?padding:\s*2px 4px/,
    )
    expect(syncView).toMatch(/\.sync-progress\s*\{[\s\S]*?padding:\s*2px 4px/)
    expect(syncView).toMatch(/\.sync-progress\s*\{[\s\S]*?border-radius:\s*0/)
    expect(mergeView).toMatch(/\.merge-summary div\s*\{[\s\S]*?padding:\s*2px 4px/)
    expect(mergeView).toMatch(/\.merge-summary div\s*\{[\s\S]*?border-radius:\s*0/)
  })
})

describe('folder sync tree and session log chrome density', () => {
  it('keeps Folder Sync preview rows and session log at capture CSS scale', () => {
    expect(syncView).toMatch(/data-testid="folder-sync-session-log"/)
    expect(syncView).toMatch(/data-log-density="capture-1to1"/)
    expect(syncView).toMatch(/\.sync-preview-row\s*\{[\s\S]*?min-height:\s*20px/)
    expect(syncView).toMatch(/\.sync-preview-head\s*\{[\s\S]*?font-weight:\s*400/)
    expect(syncView).toMatch(/\.sync-row-selected\s*\{[\s\S]*?background:\s*#a8cdf1/)
    expect(syncView).toMatch(/\.folder-session-log\s*\{[\s\S]*?height:\s*96px/)
    expect(syncView).toMatch(/\.folder-session-log-body\s*\{[\s\S]*?font-size:\s*11px/)
    expect(syncView).toMatch(/\.folder-session-log-body\s*\{[\s\S]*?line-height:\s*14px/)
    expect(css).toMatch(/\.folder-sync-view \.sync-preview-row\s*\{[\s\S]*?min-height:\s*20px/)
    expect(css).toMatch(/\.folder-sync-view \.folder-session-log\s*\{[\s\S]*?height:\s*96px/)
    expect(syncView).not.toMatch(/min-height:\s*6px/)
    expect(syncView).not.toMatch(/font-size:\s*6px/)
  })
})

describe('folder merge tree and session log chrome density', () => {
  it('keeps Folder Merge plan rows and session log at capture CSS scale', () => {
    expect(mergeView).toMatch(/data-testid="folder-merge-session-log"/)
    expect(mergeView).toMatch(/data-log-density="capture-1to1"/)
    expect(mergeView).toMatch(/\.merge-plan-row\s*\{[\s\S]*?min-height:\s*20px/)
    expect(mergeView).toMatch(/\.merge-plan-head\s*\{[\s\S]*?font-weight:\s*400/)
    expect(mergeView).toMatch(/\.merge-plan-row\.selected\s*\{[\s\S]*?background:\s*#a8cdf1/)
    expect(mergeView).toMatch(/\.folder-session-log\s*\{[\s\S]*?height:\s*96px/)
    expect(mergeView).toMatch(/\.folder-session-log-body\s*\{[\s\S]*?font-size:\s*11px/)
    expect(css).toMatch(/\.folder-merge-view \.merge-plan-row\s*\{[\s\S]*?min-height:\s*20px/)
    expect(css).toMatch(/\.folder-merge-view \.folder-session-log\s*\{[\s\S]*?height:\s*96px/)
    expect(mergeView).not.toMatch(/min-height:\s*6px/)
    expect(mergeView).not.toMatch(/font-size:\s*6px/)
  })
})
