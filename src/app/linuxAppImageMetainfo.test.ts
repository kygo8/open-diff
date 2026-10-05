import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const metainfo = readFileSync(
  resolve(process.cwd(), 'src-tauri/bundle/linux/io.github.kygo8.open-diff.metainfo.xml'),
  'utf8',
)
const desktop = readFileSync(
  resolve(process.cwd(), 'src-tauri/bundle/linux/open-diff.desktop'),
  'utf8',
)
const linuxConf = readFileSync(resolve(process.cwd(), 'src-tauri/tauri.linux.conf.json'), 'utf8')
const packageJson = readFileSync(resolve(process.cwd(), 'package.json'), 'utf8')

describe('linux AppImage and AppStream metadata', () => {
  it('publishes a stable OpenDiff name for software centers', () => {
    expect(metainfo).toContain('<name>OpenDiff</name>')
    expect(metainfo).toContain('<id>io.github.kygo8.open-diff</id>')
    expect(desktop).toMatch(/^Name=OpenDiff$/m)
  })

  it('bundles AppImage with metainfo and desktop template', () => {
    expect(linuxConf).toContain('"appimage"')
    expect(linuxConf).toContain('io.github.kygo8.open-diff.metainfo.xml')
    expect(linuxConf).toContain('bundle/linux/open-diff.desktop')
    expect(packageJson).toContain('tauri:build:linux:appimage')
  })
})
