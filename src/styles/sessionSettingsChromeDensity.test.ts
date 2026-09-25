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
const css = readFileSync(resolve(root, 'src/styles/main.css'), 'utf8')
const settingsView = readFileSync(resolve(root, 'src/views/SettingsView.vue'), 'utf8')

describe('session settings and hex goto chrome density', () => {
  it('keeps Session Settings dialog chrome dense toward report-panel spacing', () => {
    expect(settingsDialog).toMatch(/\.session-settings-backdrop\s*\{[\s\S]*?padding:\s*4px/)
    expect(settingsDialog).toMatch(/\.session-settings-dialog\s*\{[\s\S]*?padding:\s*4px 6px/)
    expect(settingsDialog).toMatch(/\.session-settings-dialog\s*\{[\s\S]*?gap:\s*4px/)
    expect(settingsDialog).toMatch(/\.session-settings-dialog\s*\{[\s\S]*?border-radius:\s*0/)
    expect(settingsDialog).toMatch(
      /\.session-settings-dialog\s*\{[\s\S]*?border:\s*1px solid #a0a0a0/,
    )
    expect(settingsDialog).toMatch(/data-options-rules-density="capture-1to1"/)
    expect(settingsDialog).toMatch(/\.settings-body\s*\{[\s\S]*?padding:\s*4px 6px/)
    expect(settingsDialog).toMatch(/\.settings-body\s*\{[\s\S]*?border:\s*1px solid #a0a0a0/)
    expect(settingsDialog).toMatch(/\.settings-body label\s*\{[\s\S]*?font-size:\s*11px/)
    expect(settingsDialog).toMatch(/\.settings-tabs button\s*\{[\s\S]*?border:\s*1px solid #a0a0a0/)
    expect(settingsDialog).toMatch(/h2\s*\{[\s\S]*?font-size:\s*12px/)
    expect(settingsDialog).toMatch(/\.settings-tabs button\s*\{[\s\S]*?height:\s*18px/)
    expect(settingsDialog).toMatch(/\.settings-body\s*\{[\s\S]*?gap:\s*4px/)
    expect(settingsDialog).toMatch(
      /\.settings-body input:not\(\[type='checkbox'\]\),\s*\.settings-body select\s*\{[\s\S]*?height:\s*20px/,
    )
    expect(settingsDialog).toMatch(/\.settings-body textarea\s*\{[\s\S]*?padding:\s*2px 6px/)
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

describe('options/rules dialog content depth', () => {
  it('deepens Options content and Session Rules dialog beyond shell chrome', () => {
    expect(settingsView).toMatch(/data-options-content-density="capture-1to1"/)
    expect(settingsView).toMatch(/\.options-content\s*\{[\s\S]*?gap:\s*4px/)
    expect(settingsView).toMatch(
      /\.options-content :deep\(\[class='n-card__content'\]\)\s*\{[\s\S]*?padding:\s*4px 6px/,
    )
    expect(settingsView).toMatch(
      /\.options-content :deep\(\.n-checkbox\)\s*\{[\s\S]*?min-height:\s*18px/,
    )
    expect(css).toMatch(/\.settings-view \.options-content\s*\{[\s\S]*?gap:\s*4px/)
    expect(css).toMatch(
      /\.settings-view \.options-content \[class='n-card__content'\]\s*\{[\s\S]*?padding:\s*4px 6px/,
    )
    expect(css).toMatch(/\.session-settings-dialog\s*\{[\s\S]*?border:\s*1px solid #a0a0a0/)
    expect(css).toMatch(/\.session-settings-dialog \.settings-body\s*\{[\s\S]*?padding:\s*4px 6px/)
    expect(css).toMatch(
      /\.session-settings-dialog \.settings-body input:not\(\[type='checkbox'\]\)[\s\S]*?height:\s*20px/,
    )
    expect(settingsDialog).not.toMatch(/min-height:\s*6px/)
  })
})

describe('session rules residual depth', () => {
  it('deepens Session Rules dialog chrome beyond #342/#333 content band', () => {
    expect(settingsDialog).toMatch(/data-rules-depth="capture-1to1-residual"/)
    expect(settingsDialog).toMatch(/\.settings-tabs\s*\{[\s\S]*?background:\s*#f0f0f0/)
    expect(settingsDialog).toMatch(/footer\s*\{[\s\S]*?border-top:\s*1px solid #c0c0c0/)
    expect(css).toMatch(
      /\.session-settings-dialog\[data-rules-depth='capture-1to1-residual'\]\s*\{[\s\S]*?background:\s*#f0f0f0/,
    )
    expect(css).toMatch(
      /\.session-settings-dialog\[data-rules-depth='capture-1to1-residual'\] \.settings-body\s*\{[\s\S]*?gap:\s*2px/,
    )
    expect(css).toMatch(
      /\.session-settings-dialog\[data-rules-depth='capture-1to1-residual'\] \.settings-tabs\s*\{[\s\S]*?gap:\s*2px/,
    )
    expect(settingsDialog).not.toMatch(/min-height:\s*6px/)
  })
})

describe('options footer residual', () => {
  const settingsView = readFileSync(resolve(root, 'src/views/SettingsView.vue'), 'utf8')

  it('keeps Options OK/Cancel/Apply footer at capture scale', () => {
    expect(settingsView).toMatch(/data-options-footer="capture-1to1-residual"/)
    expect(settingsView).toMatch(/data-testid="options-footer-ok"/)
    expect(settingsView).toMatch(/data-testid="options-footer-cancel"/)
    expect(settingsView).toMatch(/data-testid="options-footer-apply"/)
    expect(settingsView).toMatch(/\.options-footer-btn\s*\{[\s\S]*?height:\s*18px/)
    expect(settingsDialog).toMatch(/data-testid="session-settings-ok"/)
    expect(settingsDialog).toMatch(/footer button\s*\{[\s\S]*?height:\s*18px/)
  })
})

describe('session rules micro residual', () => {
  it('closes Session Rules micro-drift vs Options/About sibling chrome', () => {
    expect(settingsDialog).toMatch(/data-rules-micro="capture-1to1-residual"/)
    expect(settingsDialog).toMatch(/header button\s*\{[\s\S]*?height:\s*18px/)
    expect(settingsDialog).toMatch(/header\s*\{[\s\S]*?border-bottom:\s*1px solid #c0c0c0/)
    expect(settingsDialog).toMatch(
      /\.settings-tabs button\.active\s*\{[\s\S]*?background:\s*#c8e4ff/,
    )
    expect(settingsDialog).toMatch(/footer button\s*\{[\s\S]*?background:\s*#ffffff/)
    expect(css).toMatch(
      /\.session-settings-dialog\[data-rules-depth='capture-1to1-residual'\]\s*\{[\s\S]*?gap:\s*2px/,
    )
    expect(css).toMatch(
      /\.session-settings-dialog\[data-rules-depth='capture-1to1-residual'\] \.settings-body\s*\{[\s\S]*?padding:\s*2px 4px/,
    )
    expect(css).toMatch(/button\.active[\s\S]*?background:\s*#c8e4ff/)
    expect(settingsDialog).not.toMatch(/min-height:\s*6px/)
  })
})
