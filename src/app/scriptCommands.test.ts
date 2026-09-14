import { describe, expect, it } from 'vitest'
import {
  formatCommandList,
  supportedScriptCommands,
  unsupportedScriptCommands,
} from './scriptCommands'

describe('scriptCommands', () => {
  it('lists supported compare/report commands without trademarked product names', () => {
    expect(supportedScriptCommands).toContain('COMPARE')
    expect(supportedScriptCommands).toContain('HEX-REPORT')
    expect(supportedScriptCommands).toContain('TABLE-REPORT')
    expect(supportedScriptCommands).toContain('FILE-REPORT')
    expect(supportedScriptCommands).toContain('REPORT')
    expect(supportedScriptCommands).toContain('MEDIA-REPORT')
    expect(supportedScriptCommands).toContain('PICTURE-REPORT')
    expect(supportedScriptCommands).toContain('ATTRIB')
    expect(supportedScriptCommands).toContain('EXPAND')
    expect(supportedScriptCommands).toContain('COLLAPSE')
    expect(supportedScriptCommands).toContain('MOVE')
    expect(supportedScriptCommands).toContain('MOVETO')
    expect(formatCommandList(supportedScriptCommands)).not.toMatch(/Beyond|BC5?|Scooter/i)
  })

  it('keeps an honest unsupported list for known legacy gaps', () => {
    expect(unsupportedScriptCommands).toEqual([])
    expect(supportedScriptCommands).toContain('CRITERIA')
    expect(supportedScriptCommands).toContain('FOLDER-SYNC-REPORT')
    expect(supportedScriptCommands).toContain('FOLDER-MERGE-REPORT')
    expect(supportedScriptCommands).toContain('ARCHIVE-REPORT')
    expect(supportedScriptCommands).toContain('DATA-REPORT')
    expect(supportedScriptCommands).toContain('SET')
    expect(supportedScriptCommands).toContain('EXIT')
    expect(unsupportedScriptCommands).not.toContain('HEX-REPORT')
    expect(unsupportedScriptCommands).not.toContain('FILE-REPORT')
    expect(unsupportedScriptCommands).not.toContain('MEDIA-REPORT')
    expect(unsupportedScriptCommands).not.toContain('ATTRIB')
  })

  it('keeps supported and unsupported catalogs disjoint', () => {
    const overlap = supportedScriptCommands.filter((command) =>
      (unsupportedScriptCommands as readonly string[]).includes(command),
    )

    expect(overlap).toEqual([])
  })
})
