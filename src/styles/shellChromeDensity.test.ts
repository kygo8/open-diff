import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

describe('shell chrome density', () => {
  const source = readFileSync(resolve(__dirname, '../layouts/AppLayout.vue'), 'utf8')

  it('keeps single-session dense chrome at 54px menu bar', () => {
    expect(source).toMatch(/\.app-shell-dense-chrome\s*\{[\s\S]*?grid-template-rows:\s*54px/)
    expect(source).toMatch(
      /\.app-shell-dense-chrome \.menu-bar\s*\{[\s\S]*?grid-template-rows:\s*28px 26px/,
    )
  })

  it('densifies multi-tab title/menu/tab strip one notch toward captures', () => {
    expect(source).toMatch(/grid-template-rows:\s*64px minmax\(0, 1fr\) 24px/)
    expect(source).toMatch(/\.menu-bar\s*\{[\s\S]*?grid-template-rows:\s*32px 32px/)
    expect(source).toMatch(/\.tab-strip\s*\{[\s\S]*?padding:\s*3px 6px 0/)
    expect(source).toMatch(/\.tab-chip button\s*\{[\s\S]*?height:\s*22px/)
  })
})
