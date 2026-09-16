import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..')
const homeView = readFileSync(resolve(root, 'src/views/HomeView.vue'), 'utf8')

describe('home chrome density', () => {
  it('keeps Home CTA/tree/header/footer chrome dense toward capture', () => {
    expect(homeView).toMatch(/data-home-density="capture-pass10"/)
    expect(homeView).toMatch(/data-home-chrome="minimal"/)
    expect(homeView).toMatch(
      /\.bc-session-tree\s*\{[\s\S]*?grid-template-rows:\s*11px minmax\(0, 1fr\) 12px/,
    )
    expect(homeView).toMatch(/\.bc-session-tree header\s*\{[\s\S]*?font-size:\s*11px/)
    expect(homeView).toMatch(/\.bc-tree-row\s*\{[\s\S]*?min-height:\s*10px/)
    expect(homeView).toMatch(/\.bc-tree-footer button\s*\{[\s\S]*?height:\s*10px/)
    expect(homeView).toMatch(/\.bc-tree-footer input\s*\{[\s\S]*?height:\s*10px/)
    expect(homeView).toMatch(/\.bc-selected-session\s*\{[\s\S]*?padding:\s*0/)
    expect(homeView).toMatch(/\.bc-selected-actions button\s*\{[\s\S]*?height:\s*12px/)
    expect(homeView).toMatch(/\.new-session-grid\s*\{[\s\S]*?gap:\s*0 1px/)
    expect(homeView).toMatch(/\.session-card-icon\s*\{[\s\S]*?width:\s*26px/)
    expect(homeView).toMatch(/\.new-session-card\s*\{[\s\S]*?min-height:\s*34px/)
    expect(homeView).toMatch(/\.new-session-card\s*\{[\s\S]*?border-radius:\s*0/)
    expect(homeView).toMatch(/:size="20"/)
  })
})
