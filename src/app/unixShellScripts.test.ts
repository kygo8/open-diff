import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const linuxRoot = resolve(process.cwd(), 'scripts/linux')
const macosRoot = resolve(process.cwd(), 'scripts/macos')

describe('unix shell integration scripts', () => {
  it('installs a linux desktop entry that reuses shell-compare', () => {
    const script = readFileSync(resolve(linuxRoot, 'install-shell-integration.sh'), 'utf8')

    expect(script).toContain('open-diff-compare.desktop')
    expect(script).toContain('--shell-compare')
    expect(script).toContain('--select-left')
    expect(script).toContain('MimeType=')
    expect(script).toContain('inode/directory')
    expect(script).toContain('Actions=SelectLeft')
    expect(script).toContain('Compare files or folders')
    expect(script).toContain('open-diff-cli --help')
    expect(script).not.toContain('via shell-compare')
  })

  it('uninstalls the linux desktop entry', () => {
    const script = readFileSync(resolve(linuxRoot, 'uninstall-shell-integration.sh'), 'utf8')

    expect(script).toContain('rm -f')
    expect(script).toContain('open-diff-compare.desktop')
  })

  it('installs a macos shell-compare helper and open-with app stub', () => {
    const script = readFileSync(resolve(macosRoot, 'install-shell-integration.sh'), 'utf8')

    expect(script).toContain('open-diff-shell-compare')
    expect(script).toContain('Open Diff Compare.app')
    expect(script).toContain('CFBundleDocumentTypes')
    expect(script).toContain('--shell-compare')
    expect(script).toContain('--select-left')
  })

  it('uninstalls macos shell helpers', () => {
    const script = readFileSync(resolve(macosRoot, 'uninstall-shell-integration.sh'), 'utf8')

    expect(script).toContain('Open Diff Compare.app')
    expect(script).toContain('open-diff-shell-compare')
  })
})
