import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..')
const homeView = readFileSync(resolve(root, 'src/views/HomeView.vue'), 'utf8')

describe('home chrome density', () => {
  it('keeps Home CTA/tree/header/footer chrome dense toward capture', () => {
    expect(homeView).toMatch(/data-home-density="capture-pass8"/)
    expect(homeView).toMatch(/data-home-chrome="minimal"/)
    expect(homeView).toMatch(
      /\.bc-session-tree\s*\{[\s\S]*?grid-template-rows:\s*13px minmax\(0, 1fr\) 14px/,
    )
    expect(homeView).toMatch(/\.bc-session-tree header\s*\{[\s\S]*?font-size:\s*11px/)
    expect(homeView).toMatch(/\.bc-tree-row\s*\{[\s\S]*?min-height:\s*12px/)
    expect(homeView).toMatch(/\.bc-tree-footer button\s*\{[\s\S]*?height:\s*12px/)
    expect(homeView).toMatch(/\.bc-tree-footer input\s*\{[\s\S]*?height:\s*12px/)
    expect(homeView).toMatch(/\.bc-selected-session\s*\{[\s\S]*?padding:\s*1px/)
    expect(homeView).toMatch(/\.bc-selected-actions button\s*\{[\s\S]*?height:\s*14px/)
    expect(homeView).toMatch(/\.new-session-grid\s*\{[\s\S]*?gap:\s*0 2px/)
    expect(homeView).toMatch(/\.session-card-icon\s*\{[\s\S]*?width:\s*30px/)
    expect(homeView).toMatch(/\.new-session-card\s*\{[\s\S]*?min-height:\s*40px/)
    expect(homeView).toMatch(/\.new-session-card\s*\{[\s\S]*?border-radius:\s*0/)
    expect(homeView).toMatch(/:size="24"/)
  })
})
