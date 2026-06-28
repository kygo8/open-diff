import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const checklistPath = resolve(process.cwd(), 'docs/安全操作审计清单.md')

describe('security audit checklist documentation', () => {
  it('defines gates for destructive actions, credentials, scripts, and external commands', () => {
    const checklist = readFileSync(checklistPath, 'utf8')

    expect(checklist).toContain('Destructive Action Gate')
    expect(checklist).toContain('Credential Handling Gate')
    expect(checklist).toContain('Script And Automation Gate')
    expect(checklist).toContain('External Command Gate')
    expect(checklist).toContain('delete')
    expect(checklist).toContain('overwrite')
    expect(checklist).toContain('mirror sync')
    expect(checklist).toContain('remote credentials')
    expect(checklist).toContain('silent script')
    expect(checklist).toContain('Evidence')
  })
})
