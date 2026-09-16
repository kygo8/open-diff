import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..')
const settingsDialog = readFileSync(
  resolve(root, 'src/components/session/SessionSettingsDialog.vue'),
  'utf8',
)
const hexView = readFileSync(resolve(root, 'src/views/HexCompareView.vue'), 'utf8')

describe('session settings and hex goto chrome density', () => {
  it('keeps Session Settings dialog chrome dense toward report-panel spacing', () => {
    expect(settingsDialog).toMatch(/\.session-settings-backdrop\s*\{[\s\S]*?padding:\s*4px/)
    expect(settingsDialog).toMatch(/\.session-settings-dialog\s*\{[\s\S]*?padding:\s*4px 6px/)
    expect(settingsDialog).toMatch(/\.session-settings-dialog\s*\{[\s\S]*?gap:\s*4px/)
    expect(settingsDialog).toMatch(/\.session-settings-dialog\s*\{[\s\S]*?border-radius:\s*0/)
    expect(settingsDialog).toMatch(/h2\s*\{[\s\S]*?font-size:\s*12px/)
    expect(settingsDialog).toMatch(/\.settings-tabs button\s*\{[\s\S]*?height:\s*18px/)
    expect(settingsDialog).toMatch(/\.settings-body\s*\{[\s\S]*?gap:\s*4px/)
    expect(settingsDialog).toMatch(
      /\.settings-body input:not\(\[type='checkbox'\]\),\s*\.settings-body select\s*\{[\s\S]*?height:\s*20px/,
    )
    expect(settingsDialog).toMatch(/\.settings-body textarea\s*\{[\s\S]*?padding:\s*2px 4px/)
    expect(settingsDialog).toMatch(/\.settings-body textarea\s*\{[\s\S]*?border-radius:\s*0/)
    expect(settingsDialog).toMatch(/footer button\s*\{[\s\S]*?height:\s*18px/)
    expect(settingsDialog).not.toMatch(/box-shadow:\s*0 18px 44px/)
    expect(settingsDialog).not.toMatch(/padding:\s*16px/)
  })

  it('keeps Hex Go To dialog chrome dense toward report-panel spacing', () => {
    expect(hexView).toMatch(/\.hex-goto-backdrop\s*\{[\s\S]*?padding:\s*4px/)
    expect(hexView).toMatch(/\.hex-goto-dialog\s*\{[\s\S]*?padding:\s*4px 6px/)
    expect(hexView).toMatch(/\.hex-goto-dialog\s*\{[\s\S]*?gap:\s*4px/)
    expect(hexView).toMatch(/\.hex-goto-dialog\s*\{[\s\S]*?border-radius:\s*0/)
    expect(hexView).toMatch(/\.hex-goto-dialog input\s*\{[\s\S]*?height:\s*20px/)
    expect(hexView).toMatch(/\.hex-goto-dialog footer\s*\{[\s\S]*?gap:\s*4px/)
    expect(hexView).toMatch(/\.hex-goto-dialog footer button\s*\{[\s\S]*?height:\s*18px/)
    expect(hexView).not.toMatch(/\.hex-goto-dialog\s*\{[\s\S]*?padding:\s*16px/)
  })
})
