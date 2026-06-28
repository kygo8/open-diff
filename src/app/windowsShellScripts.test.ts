import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const scriptRoot = resolve(process.cwd(), 'scripts/windows')

describe('windows shell extension scripts', () => {
  it('registers current-user file and directory context menu entries', () => {
    const script = readFileSync(resolve(scriptRoot, 'register-shell-extension.ps1'), 'utf8')

    expect(script).toContain('[string]$AppPath')
    expect(script).toContain('HKCU:\\Software\\Classes\\*\\shell\\$VerbKey')
    expect(script).toContain('HKCU:\\Software\\Classes\\Directory\\shell\\$VerbKey')
    expect(script).toContain('--shell-compare')
    expect(script).toContain('%1')
  })

  it('unregisters current-user file and directory context menu entries', () => {
    const script = readFileSync(resolve(scriptRoot, 'unregister-shell-extension.ps1'), 'utf8')

    expect(script).toContain('Remove-Item')
    expect(script).toContain('HKCU:\\Software\\Classes\\*\\shell\\$VerbKey')
    expect(script).toContain('HKCU:\\Software\\Classes\\Directory\\shell\\$VerbKey')
  })
})
