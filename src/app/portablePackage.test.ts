import { describe, expect, it } from 'vitest'
import { createWindowsPortablePackagePlan } from './portablePackage'

describe('portablePackage', () => {
  it('creates a stable Windows portable package plan', () => {
    const plan = createWindowsPortablePackagePlan({
      productName: 'Open Diff',
      version: '1.0.0',
      releaseDir: 'src-tauri/target/release',
      outputDir: 'src-tauri/target/release/bundle/portable',
    })

    expect(plan.archiveName).toBe('Open Diff_1.0.0_x64_portable.zip')
    expect(plan.files).toEqual([
      {
        source: 'src-tauri/target/release/open-diff-app.exe',
        target: 'open-diff-app.exe',
      },
      {
        source: 'src-tauri/target/release/open-diff-cli.exe',
        target: 'open-diff-cli.exe',
      },
      {
        source: 'README.md',
        target: 'README.md',
      },
      {
        source: 'LICENSE',
        target: 'LICENSE',
      },
    ])
  })
})
