import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..')
const css = readFileSync(resolve(root, 'src/styles/main.css'), 'utf8')
const formatView = readFileSync(resolve(root, 'src/views/FileFormatView.vue'), 'utf8')
const profileView = readFileSync(resolve(root, 'src/views/RemoteProfileView.vue'), 'utf8')

describe('formats and profiles chrome density', () => {
  it('keeps File Formats chrome dense toward session-panel spacing', () => {
    expect(css).toMatch(
      /\.file-format-view,\s*\.remote-profile-view\s*\{[\s\S]*?padding:\s*2px 4px/,
    )
    expect(css).toMatch(
      /\.file-format-view \.format-row,\s*\.remote-profile-view \.profile-row\s*\{[\s\S]*?min-height:\s*22px/,
    )
    expect(css).toMatch(/\.file-format-view textarea\s*\{[\s\S]*?min-height:\s*64px/)

    expect(formatView).toMatch(/\.file-format-view\s*\{[\s\S]*?padding:\s*2px 4px/)
    expect(formatView).toMatch(/\.format-list-panel,[\s\S]*?padding:\s*2px 4px/)
    expect(formatView).toMatch(/\.format-list-panel,[\s\S]*?border-radius:\s*0/)
    expect(formatView).toMatch(/\.format-row\s*\{[\s\S]*?min-height:\s*22px/)
    expect(formatView).toMatch(/\.format-row\s*\{[\s\S]*?padding:\s*1px 4px/)
    expect(formatView).toMatch(/button\s*\{[\s\S]*?min-height:\s*18px/)
    expect(formatView).toMatch(/input,\s*select\s*\{[\s\S]*?height:\s*20px/)
    expect(formatView).toMatch(/textarea\s*\{[\s\S]*?padding:\s*2px 4px/)
    expect(formatView).toMatch(/textarea\s*\{[\s\S]*?min-height:\s*64px/)
    expect(formatView).not.toMatch(/padding:\s*16px/)
  })

  it('keeps Remote Profiles chrome dense toward session-panel spacing', () => {
    expect(profileView).toMatch(/\.remote-profile-view\s*\{[\s\S]*?padding:\s*2px 4px/)
    expect(profileView).toMatch(/\.profile-list-panel,[\s\S]*?padding:\s*2px 4px/)
    expect(profileView).toMatch(/\.profile-list-panel,[\s\S]*?border-radius:\s*0/)
    expect(profileView).toMatch(/\.profile-row\s*\{[\s\S]*?min-height:\s*22px/)
    expect(profileView).toMatch(/\.profile-row\s*\{[\s\S]*?padding:\s*1px 4px/)
    expect(profileView).toMatch(/button\s*\{[\s\S]*?min-height:\s*18px/)
    expect(profileView).toMatch(/input,\s*select\s*\{[\s\S]*?height:\s*20px/)
    expect(profileView).toMatch(/\.remote-unavailable\s*\{[\s\S]*?padding:\s*2px 4px/)
    expect(profileView).not.toMatch(/padding:\s*16px/)
  })
})
