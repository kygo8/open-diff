import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const desktop = readFileSync(
  resolve(process.cwd(), 'src-tauri/bundle/linux/open-diff.desktop'),
  'utf8',
)
const linuxConf = readFileSync(resolve(process.cwd(), 'src-tauri/tauri.linux.conf.json'), 'utf8')

describe('linux desktop handoff', () => {
  it('passes selected files into the GUI via %F', () => {
    expect(desktop).toMatch(/Exec=\{\{exec\}\} %F/)
    expect(desktop).toMatch(/MimeType=/)
  })

  it('wires the desktop template into deb and rpm bundles', () => {
    expect(linuxConf).toContain('bundle/linux/open-diff.desktop')
    expect(linuxConf).toMatch(/"desktopTemplate":\s*"bundle\/linux\/open-diff\.desktop"/)
  })
})
