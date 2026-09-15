import { describe, expect, it } from 'vitest'
import {
  isSettingsPackage,
  parseSettingsPackage,
  settingsPackageKind,
  settingsPackageVersion,
  type SettingsPackage,
} from './settingsPackage'

const sample: SettingsPackage = {
  kind: settingsPackageKind,
  version: settingsPackageVersion,
  theme: 'dark',
  locale: 'en-US',
  sharedSessionPaths: [],
  shortcutOverrides: {},
  autoSaveLimit: 10,
  fontFamily: 'system',
  fontSize: 14,
  diffColors: {
    addedBg: '#f4fff4',
    addedFg: '#005f18',
    deletedBg: '#ffe3e3',
    deletedFg: '#e00000',
    modifiedBg: '#ffe3e3',
    modifiedFg: '#e00000',
  },
  confirmBeforeDelete: true,
  wrapTextDefault: false,
  showSessionToolbars: true,
  showToolbarLabels: true,
  largeToolbarButtons: true,
  createBackupOnSave: false,
  backupRetentionCount: 1,
  showSessionsInToolbar: false,
  showGotoInToolbar: false,
  showWrapInToolbar: false,
  showSyncNowInToolbar: false,
  showStatusBar: true,
  showPathBars: true,
}

describe('settingsPackage', () => {
  it('accepts a well-formed settings package', () => {
    expect(isSettingsPackage(sample)).toBe(true)
    expect(parseSettingsPackage(JSON.stringify(sample))).toEqual(sample)
  })

  it('rejects malformed payloads', () => {
    expect(parseSettingsPackage('{')).toBeNull()
    expect(isSettingsPackage({ kind: 'other' })).toBe(false)
  })
})
