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

describe('linux Wayland display workaround', () => {
  it('documents that Wayland→X11 is applied in-process (not via .desktop Exec)', () => {
    // Packaging keeps Exec={{exec}} %F; open-diff-app sets GDK_BACKEND=x11 on Wayland
    // unless OPEN_DIFF_ALLOW_WAYLAND=1 / GDK_BACKEND is already set (see linux_display_env.rs).
    expect(desktop).toMatch(/Exec=\{\{exec\}\} %F/)

    const rust = readFileSync(resolve(process.cwd(), 'src-tauri/src/linux_display_env.rs'), 'utf8')

    expect(rust).toContain('GDK_BACKEND')
    expect(rust).toContain('OPEN_DIFF_ALLOW_WAYLAND')
    expect(rust).toContain('should_force_gdk_x11')
  })
})
