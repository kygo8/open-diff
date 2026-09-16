import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..')
const homeView = readFileSync(resolve(root, 'src/views/HomeView.vue'), 'utf8')
const workspaceManager = readFileSync(
  resolve(root, 'src/components/session/WorkspaceManager.vue'),
  'utf8',
)

describe('home chrome density', () => {
  it('keeps Home CTA/tree/header/footer chrome dense toward capture', () => {
    expect(homeView).toMatch(/data-home-density="capture-pass18"/)
    expect(homeView).toMatch(/data-home-chrome="minimal"/)
    expect(homeView).toMatch(
      /\.bc-session-tree\s*\{[\s\S]*?grid-template-rows:\s*8px minmax\(0, 1fr\) 9px/,
    )
    expect(homeView).toMatch(/\.bc-session-tree header\s*\{[\s\S]*?font-size:\s*9px/)
    expect(homeView).toMatch(/\.bc-tree-row\s*\{[\s\S]*?min-height:\s*7px/)
    expect(homeView).toMatch(/\.bc-tree-footer button\s*\{[\s\S]*?height:\s*7px/)
    expect(homeView).toMatch(/\.bc-tree-footer input\s*\{[\s\S]*?height:\s*7px/)
    expect(homeView).toMatch(/\.bc-selected-session\s*\{[\s\S]*?padding:\s*0/)
    expect(homeView).toMatch(/\.bc-selected-actions button\s*\{[\s\S]*?height:\s*6px/)
    expect(homeView).toMatch(/\.new-session-grid\s*\{[\s\S]*?gap:\s*0 1px/)
    expect(homeView).toMatch(/\.session-card-icon\s*\{[\s\S]*?width:\s*14px/)
    expect(homeView).toMatch(/\.new-session-card\s*\{[\s\S]*?min-height:\s*22px/)
    expect(homeView).toMatch(/\.new-session-card\s*\{[\s\S]*?border-radius:\s*0/)
    expect(homeView).toMatch(/:size="10"/)
    expect(homeView).toMatch(/\.new-session-panel,\s*\.recent-session-panel\s*\{[\s\S]*?gap:\s*1px/)
    expect(homeView).toMatch(/\.home-title-count\s*\{[\s\S]*?font-size:\s*11px/)
  })

  it('keeps leftover workspace manager chrome dense toward Home session lists', () => {
    expect(workspaceManager).toMatch(/\.workspace-manager\s*\{[\s\S]*?padding:\s*2px 4px/)
    expect(workspaceManager).toMatch(/\.workspace-manager\s*\{[\s\S]*?gap:\s*4px/)
    expect(workspaceManager).toMatch(/\.workspace-save-row input\s*\{[\s\S]*?height:\s*20px/)
    expect(workspaceManager).toMatch(/\.workspace-save-row input\s*\{[\s\S]*?border-radius:\s*0/)
    expect(workspaceManager).toMatch(
      /\.workspace-save-row button,\s*\.workspace-row button\s*\{[\s\S]*?height:\s*18px/,
    )
    expect(workspaceManager).toMatch(
      /\.workspace-save-row button,\s*\.workspace-row button\s*\{[\s\S]*?border-radius:\s*0/,
    )
    expect(workspaceManager).not.toMatch(/padding:\s*8px/)
  })

  it('keeps leftover Home restore and save banners dense toward session lists', () => {
    expect(homeView).toMatch(/\.recovery-entry,\s*\.save-prompt\s*\{[\s\S]*?padding:\s*2px 4px/)
    expect(homeView).toMatch(/\.recovery-entry,\s*\.save-prompt\s*\{[\s\S]*?border-radius:\s*0/)
    expect(homeView).toMatch(/\.recovery-entry,\s*\.save-prompt\s*\{[\s\S]*?font-size:\s*11px/)
    expect(homeView).toMatch(
      /\.recovery-entry button,\s*\.save-prompt button\s*\{[\s\S]*?height:\s*18px/,
    )
    expect(homeView).toMatch(
      /\.recovery-entry button,\s*\.save-prompt button\s*\{[\s\S]*?border-radius:\s*0/,
    )
    expect(homeView).not.toMatch(
      /\.recovery-entry,\s*\.save-prompt\s*\{[\s\S]*?padding:\s*8px 10px/,
    )
  })
})
