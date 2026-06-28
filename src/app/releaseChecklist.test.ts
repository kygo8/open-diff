import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const checklistPath = resolve(process.cwd(), 'docs/发布检查清单.md')

describe('release checklist documentation', () => {
  it('covers release quality, packaging, documentation, license, and rollback gates', () => {
    const checklist = readFileSync(checklistPath, 'utf8')

    expect(checklist).toContain('corepack pnpm test')
    expect(checklist).toContain('corepack pnpm quality')
    expect(checklist).toContain('cargo test --workspace --manifest-path src-tauri/Cargo.toml')
    expect(checklist).toContain('corepack pnpm tauri:build')
    expect(checklist).toContain('corepack pnpm tauri:portable:windows')
    expect(checklist).toContain('corepack pnpm tauri:build:linux:deb')
    expect(checklist).toContain('corepack pnpm tauri:build:linux:rpm')
    expect(checklist).toContain('corepack pnpm tauri:build:macos')
    expect(checklist).toContain('README.md')
    expect(checklist).toContain('docs/readme/README.zh-CN.md')
    expect(checklist).toContain('LICENSE')
    expect(checklist).toContain('SECURITY.md')
    expect(checklist).toContain('Rollback')
    expect(checklist).toContain('Evidence')
  })
})
