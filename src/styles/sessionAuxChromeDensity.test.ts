import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..')
const confirmDialog = readFileSync(
  resolve(root, 'src/components/files/FileOperationConfirmDialog.vue'),
  'utf8',
)
const errorPanel = readFileSync(
  resolve(root, 'src/components/files/StructuredErrorPanel.vue'),
  'utf8',
)
const jobsPanel = readFileSync(resolve(root, 'src/components/jobs/JobsProgressPanel.vue'), 'utf8')

describe('session aux chrome density', () => {
  it('keeps file-op confirm chrome dense toward report-panel spacing', () => {
    expect(confirmDialog).toMatch(/\.file-operation-confirm\s*\{[\s\S]*?padding:\s*4px 6px/)
    expect(confirmDialog).toMatch(/\.file-operation-confirm\s*\{[\s\S]*?gap:\s*4px/)
    expect(confirmDialog).toMatch(/\.file-operation-confirm\s*\{[\s\S]*?border-radius:\s*0/)
    expect(confirmDialog).toMatch(/h2\s*\{[\s\S]*?font-size:\s*12px/)
    expect(confirmDialog).toMatch(/\.path-list\s*\{[\s\S]*?padding:\s*2px 4px/)
    expect(confirmDialog).toMatch(/\.path-list\s*\{[\s\S]*?border-radius:\s*0/)
    expect(confirmDialog).toMatch(
      /\.primary-action,\s*\.secondary-action\s*\{[\s\S]*?height:\s*18px/,
    )
    expect(confirmDialog).not.toMatch(/box-shadow:\s*0 18px 44px/)
    expect(confirmDialog).not.toMatch(/padding:\s*16px/)
  })

  it('keeps structured error and jobs aux chrome dense toward session panels', () => {
    expect(errorPanel).toMatch(/\.structured-error-panel\s*\{[\s\S]*?padding:\s*2px 4px/)
    expect(errorPanel).toMatch(/\.structured-error-panel\s*\{[\s\S]*?border-radius:\s*0/)
    expect(errorPanel).toMatch(/\.operation-label\s*\{[\s\S]*?border-radius:\s*0/)

    expect(jobsPanel).toMatch(/\.jobs-progress-panel\s*\{[\s\S]*?padding:\s*2px 4px/)
    expect(jobsPanel).toMatch(/\.jobs-progress-panel\s*\{[\s\S]*?border-radius:\s*0/)
    expect(jobsPanel).toMatch(/\.jobs-header h2\s*\{[\s\S]*?font-size:\s*12px/)
    expect(jobsPanel).toMatch(/\.job-row button\s*\{[\s\S]*?height:\s*18px/)
    expect(jobsPanel).toMatch(/\.job-progress\s*\{[\s\S]*?border-radius:\s*0/)
    expect(jobsPanel).not.toMatch(/padding:\s*12px/)
  })
})
