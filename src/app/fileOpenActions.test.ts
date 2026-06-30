import { describe, expect, it } from 'vitest'
import {
  createAssociatedApplicationOpenAction,
  createDefaultOpenAction,
  createOpenWithAction,
  listEnabledExternalApplications,
} from './fileOpenActions'

describe('fileOpenActions', () => {
  it('creates stable file open action payloads for system and configured applications', () => {
    expect(createDefaultOpenAction('D:/workspace/left/README.md')).toEqual({
      kind: 'default',
      path: 'D:/workspace/left/README.md',
      labelKey: 'ui.open',
      executable: undefined,
    })
    expect(createOpenWithAction('D:/workspace/left/README.md', 'Code', 'code')).toEqual({
      kind: 'open-with',
      path: 'D:/workspace/left/README.md',
      labelKey: 'fileOpen.openWithApplication',
      labelParams: { applicationName: 'Code' },
      executable: 'code',
    })
    expect(createAssociatedApplicationOpenAction('D:/workspace/left/README.md')).toEqual({
      kind: 'associated',
      path: 'D:/workspace/left/README.md',
      labelKey: 'fileOpen.openWithAssociatedApplication',
      executable: undefined,
    })
  })

  it('builds open-with actions from enabled custom external applications', () => {
    const applications = listEnabledExternalApplications([
      {
        id: 'vscode',
        name: 'Visual Studio Code',
        executable: 'code',
        enabled: true,
      },
      {
        id: 'disabled',
        name: 'Disabled Tool',
        executable: 'disabled-tool',
        enabled: false,
      },
    ])

    expect(applications).toEqual([
      {
        id: 'vscode',
        name: 'Visual Studio Code',
        executable: 'code',
        enabled: true,
      },
    ])
    expect(
      createOpenWithAction(
        'D:/workspace/left/README.md',
        applications[0].name,
        applications[0].executable,
      ),
    ).toEqual({
      kind: 'open-with',
      path: 'D:/workspace/left/README.md',
      labelKey: 'fileOpen.openWithApplication',
      labelParams: { applicationName: 'Visual Studio Code' },
      executable: 'code',
    })
  })
})
