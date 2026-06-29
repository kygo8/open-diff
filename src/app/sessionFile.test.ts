import { describe, expect, it } from 'vitest'
import { parseSessionPackage, serializeSessionPackage } from './sessionFile'
import { sampleSavedSessions } from './savedSessions'

describe('sessionFile', () => {
  it('serializes and parses a versioned session package', () => {
    const serialized = serializeSessionPackage(sampleSavedSessions)

    expect(parseSessionPackage(serialized).sessions).toHaveLength(sampleSavedSessions.length)
  })

  it('rejects unsupported packages', () => {
    expect(() => parseSessionPackage('{"version":2,"sessions":[]}')).toThrow(
      'Unsupported session package.',
    )
  })
})
