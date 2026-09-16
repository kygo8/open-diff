import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..')
const browser = readFileSync(resolve(root, 'src/components/remote/RemotePathBrowser.vue'), 'utf8')

describe('remote path browser chrome density', () => {
  it('keeps remote browse dialog chrome dense toward report-panel spacing', () => {
    expect(browser).toMatch(/\.remote-path-browser-backdrop\s*\{[\s\S]*?padding:\s*4px/)
    expect(browser).toMatch(/\.remote-path-browser\s*\{[\s\S]*?padding:\s*4px 6px/)
    expect(browser).toMatch(/\.remote-path-browser\s*\{[\s\S]*?gap:\s*4px/)
    expect(browser).toMatch(/\.remote-path-browser\s*\{[\s\S]*?border-radius:\s*0/)
    expect(browser).toMatch(/h2\s*\{[\s\S]*?font-size:\s*12px/)
    expect(browser).toMatch(/\.entry-row\s*\{[\s\S]*?min-height:\s*20px/)
    expect(browser).toMatch(/\.entry-row\s*\{[\s\S]*?padding:\s*2px 4px/)
    expect(browser).toMatch(/button\s*\{[\s\S]*?height:\s*18px/)
    expect(browser).not.toMatch(/box-shadow:\s*0 18px 44px/)
    expect(browser).not.toMatch(/min-height:\s*44px/)
    expect(browser).not.toMatch(/padding:\s*16px/)
  })
})
