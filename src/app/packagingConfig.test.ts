import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

interface TauriConfig {
  productName: string
  identifier: string
  bundle: {
    targets: string[] | string
    publisher?: string
    homepage?: string
    icon: string[]
    license?: string
    copyright?: string
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
})
