import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

interface FixtureManifestEntry {
  category: 'text' | 'table' | 'image' | 'binary' | 'folder'
  path: string
  description: string
}

interface FixtureManifest {
  version: number
  fixtures: FixtureManifestEntry[]
}

const fixtureRoot = resolve(process.cwd(), 'tests/fixtures')
const manifestPath = resolve(fixtureRoot, 'manifest.json')

describe('shared test fixtures', () => {
  it('provides reusable text, table, image, binary, and folder fixtures', () => {
    const manifest = JSON.parse(readFileSync(manifestPath, 'utf8')) as FixtureManifest
    const categories = new Set(manifest.fixtures.map((fixture) => fixture.category))

    expect(manifest.version).toBe(1)
    expect(categories).toEqual(new Set(['text', 'table', 'image', 'binary', 'folder']))

    for (const fixture of manifest.fixtures) {
      expect(fixture.description.length).toBeGreaterThan(12)
      expect(existsSync(resolve(fixtureRoot, fixture.path))).toBe(true)
    }
  })
})
