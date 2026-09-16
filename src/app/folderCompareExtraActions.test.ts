import { describe, expect, it } from 'vitest'
import {
  createFolderSyncHandoffLaunch,
  explorerRevealPath,
  explorerSelectTargetPath,
  toggleIgnoredRowId,
} from './folderCompareExtraActions'

describe('folderCompareExtraActions', () => {
  it('selects the entry itself and falls back to parent folder for files', () => {
    expect(explorerSelectTargetPath(' /tmp/demo/a.txt ')).toBe('/tmp/demo/a.txt')
    expect(explorerRevealPath('/tmp/demo/a.txt', 'file')).toBe('/tmp/demo')
    expect(explorerRevealPath('/tmp/demo', 'directory')).toBe('/tmp/demo')
    expect(explorerRevealPath('D:\\left\\src\\main.ts', 'file')).toBe('D:\\left\\src')
  })

  it('toggles ignored row ids', () => {
    const first = toggleIgnoredRowId(new Set(), 'row-1')

    expect(first.marked).toBe(true)
    expect([...first.next]).toEqual(['row-1'])

    const second = toggleIgnoredRowId(first.next, 'row-1')

    expect(second.marked).toBe(false)
    expect([...second.next]).toEqual([])
  })

  it('builds a Sync handoff launch only when both roots exist', () => {
    expect(createFolderSyncHandoffLaunch('', '/right', 'Sync')).toBeUndefined()
    const launch = createFolderSyncHandoffLaunch('/left', '/right', 'Update: left <--> right')

    expect(launch?.route).toBe('/sync/folder')
    expect(launch?.sessionType).toBe('folder-sync')
    expect(launch?.locations.left?.uri).toBe('/left')
    expect(launch?.locations.right?.uri).toBe('/right')
    expect(launch?.autoRun).toBe(true)
  })
})
