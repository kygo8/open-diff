import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const remoteCargo = readFileSync(
  resolve(process.cwd(), 'src-tauri/crates/remote-core/Cargo.toml'),
  'utf8',
)
const packageMacos = readFileSync(resolve(process.cwd(), 'scripts/macos/package-macos.sh'), 'utf8')

describe('macOS OpenSSL packaging', () => {
  it('vendors OpenSSL for ssh2 so DMGs do not need Homebrew libssl', () => {
    expect(remoteCargo).toMatch(/target_os = "macos"[\s\S]*vendored-openssl/)
  })

  it('documents unsigned builds when Apple signing identity is absent', () => {
    expect(packageMacos).toMatch(/TAURI_SIGNING_IDENTITY/)
    expect(packageMacos).toMatch(/notar/i)
    expect(packageMacos).toMatch(/--no-sign/)
  })
})
