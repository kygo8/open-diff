import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

interface TauriConfig {
  productName: string
  identifier: string
  bundle: {
    targets: string[] | string
    category?: string
    publisher?: string
    homepage?: string
    icon: string[]
    license?: string
    copyright?: string
    shortDescription?: string
    longDescription?: string
    macOS?: {
      bundleName?: string
      bundleVersion?: string
      minimumSystemVersion?: string
      hardenedRuntime?: boolean
      exceptionDomain?: string
      dmg?: {
        windowSize?: {
          width: number
          height: number
        }
        appPosition?: {
          x: number
          y: number
        }
        applicationFolderPosition?: {
          x: number
          y: number
        }
      }
    }
    linux?: {
      deb?: {
        depends?: string[]
        recommends?: string[]
        provides?: string[]
        section?: string
        priority?: string
        files?: Record<string, string>
      }
    }
    windows?: {
      webviewInstallMode?: {
        type: string
        silent?: boolean
      }
      wix?: {
        upgradeCode?: string
        language?: string
      }
    }
  }
}

interface PackageManifest {
  scripts: Record<string, string>
}

describe('packagingConfig', () => {
  it('defines complete Windows MSI metadata', () => {
    const config = JSON.parse(
      readFileSync(resolve(process.cwd(), 'src-tauri/tauri.conf.json'), 'utf8'),
    ) as TauriConfig

    expect(config.productName).toBe('Open Diff')
    expect(config.identifier).toBe('io.github.kygo8.open-diff')
    expect(config.bundle.targets).toEqual(['msi'])
    expect(config.bundle.icon).toContain('icons/icon.ico')
    expect(config.bundle.publisher).toBe('Open Diff Contributors')
    expect(config.bundle.homepage).toBe('https://github.com/kygo8/open-diff')
    expect(config.bundle.license).toBe('Apache-2.0')
    expect(config.bundle.copyright).toBe('Copyright (c) 2026 Open Diff Contributors')
    expect(config.bundle.windows?.webviewInstallMode).toEqual({
      type: 'downloadBootstrapper',
      silent: true,
    })
    expect(config.bundle.windows?.wix?.upgradeCode).toBe('90ffd755-2be3-5b35-8809-0f6022d8f999')
    expect(config.bundle.windows?.wix?.language).toBe('en-US')
  })

  it('defines macOS app and DMG bundle metadata for macOS builders', () => {
    const config = JSON.parse(
      readFileSync(resolve(process.cwd(), 'src-tauri/tauri.macos.conf.json'), 'utf8'),
    ) as Pick<TauriConfig, 'bundle'>

    expect(config.bundle.targets).toEqual(['app', 'dmg'])
    expect(config.bundle.category).toBe('DeveloperTool')
    expect(config.bundle.icon).toContain('icons/icon.icns')
    expect(config.bundle.macOS?.bundleName).toBe('Open Diff')
    expect(config.bundle.macOS?.bundleVersion).toBe('1.0.0')
    expect(config.bundle.macOS?.minimumSystemVersion).toBe('11.0')
    expect(config.bundle.macOS?.hardenedRuntime).toBe(true)
    expect(config.bundle.macOS?.exceptionDomain).toBe('github.com')
    expect(config.bundle.macOS?.dmg?.windowSize).toEqual({ width: 660, height: 400 })
    expect(config.bundle.macOS?.dmg?.appPosition).toEqual({ x: 180, y: 170 })
    expect(config.bundle.macOS?.dmg?.applicationFolderPosition).toEqual({ x: 480, y: 170 })
    const iconPath = resolve(process.cwd(), 'src-tauri/icons/icon.icns')

    expect(existsSync(iconPath)).toBe(true)

    const icon = readFileSync(iconPath)

    expect(icon.subarray(0, 4).toString('ascii')).toBe('icns')
    expect(icon.subarray(8, 12).toString('ascii')).toBe('icp5')
  })

  it('exposes a macOS bundle script for macOS release runners', () => {
    const manifest = JSON.parse(
      readFileSync(resolve(process.cwd(), 'package.json'), 'utf8'),
    ) as PackageManifest
    const script = readFileSync(resolve(process.cwd(), 'scripts/macos/package-macos.sh'), 'utf8')

    expect(manifest.scripts['tauri:build:macos']).toBe('bash scripts/macos/package-macos.sh')
    expect(script).toContain('set -euo pipefail')
    expect(script).toContain('corepack pnpm tauri build --bundles app,dmg')
    expect(script).toContain('TAURI_SIGNING_IDENTITY')
  })

  it('defines Linux deb metadata for Debian compatible builders', () => {
    const config = JSON.parse(
      readFileSync(resolve(process.cwd(), 'src-tauri/tauri.linux.conf.json'), 'utf8'),
    ) as Pick<TauriConfig, 'bundle'>

    expect(config.bundle.targets).toEqual(['deb'])
    expect(config.bundle.category).toBe('DeveloperTool')
    expect(config.bundle.icon).toContain('icons/icon.png')
    expect(config.bundle.shortDescription).toBe('Professional file and folder comparison tool')
    expect(config.bundle.longDescription).toContain('text, folder, table, image, binary')
    expect(config.bundle.linux?.deb?.section).toBe('devel')
    expect(config.bundle.linux?.deb?.priority).toBe('optional')
    expect(config.bundle.linux?.deb?.depends).toEqual([
      'libwebkit2gtk-4.1-0',
      'libgtk-3-0',
      'libayatana-appindicator3-1',
      'librsvg2-2',
    ])
    expect(config.bundle.linux?.deb?.recommends).toEqual(['xdg-utils'])
    expect(config.bundle.linux?.deb?.provides).toEqual(['open-diff'])
    expect(config.bundle.linux?.deb?.files).toEqual({
      'README.md': '/usr/share/doc/open-diff/README.md',
      LICENSE: '/usr/share/doc/open-diff/LICENSE',
    })

    const iconPath = resolve(process.cwd(), 'src-tauri/icons/icon.png')

    expect(existsSync(iconPath)).toBe(true)
    expect(readFileSync(iconPath).subarray(0, 8)).toEqual(
      Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    )
  })

  it('exposes a Linux deb bundle script for Linux release runners', () => {
    const manifest = JSON.parse(
      readFileSync(resolve(process.cwd(), 'package.json'), 'utf8'),
    ) as PackageManifest
    const script = readFileSync(resolve(process.cwd(), 'scripts/linux/package-deb.sh'), 'utf8')

    expect(manifest.scripts['tauri:build:linux:deb']).toBe('bash scripts/linux/package-deb.sh')
    expect(script).toContain('set -euo pipefail')
    expect(script).toContain('corepack pnpm tauri build --bundles deb')
  })
})
