import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..')
const homeView = readFileSync(resolve(root, 'src/views/HomeView.vue'), 'utf8')

describe('home chrome density', () => {
  it('keeps Home CTA/tree/header/footer chrome dense toward capture', () => {
    expect(homeView).toMatch(/data-home-density="capture-tight"/)
    expect(homeView).toMatch(/data-home-chrome="minimal"/)
    expect(homeView).toMatch(
      /\.bc-session-tree\s*\{[\s\S]*?grid-template-rows:\s*22px minmax\(0, 1fr\) 26px/,
    )
    expect(homeView).toMatch(/\.bc-session-tree header\s*\{[\s\S]*?font-size:\s*11px/)
    expect(homeView).toMatch(/\.bc-tree-row\s*\{[\s\S]*?min-height:\s*18px/)
    expect(homeView).toMatch(/\.bc-tree-footer button\s*\{[\s\S]*?height:\s*20px/)
    expect(homeView).toMatch(/\.bc-tree-footer input\s*\{[\s\S]*?height:\s*20px/)
    expect(homeView).toMatch(/\.bc-selected-session\s*\{[\s\S]*?padding:\s*4px 10px 2px/)
    expect(homeView).toMatch(/\.bc-selected-actions button\s*\{[\s\S]*?height:\s*24px/)
    expect(homeView).toMatch(/\.new-session-grid\s*\{[\s\S]*?gap:\s*6px 18px/)
    expect(homeView).toMatch(/\.session-card-icon\s*\{[\s\S]*?width:\s*64px/)
    expect(homeView).toMatch(/\.new-session-card\s*\{[\s\S]*?min-height:\s*74px/)
    expect(homeView).toMatch(/:size="48"/)
  })
})
