import { describe, expect, it } from 'vitest'
import {
  createAssociatedApplicationOpenAction,
  createDefaultOpenAction,
  createOpenWithAction,
} from './fileOpenActions'

describe('fileOpenActions', () => {
  it('creates stable file open action payloads for system and configured applications', () => {
    expect(createDefaultOpenAction('D:/workspace/left/README.md')).toEqual({
      kind: 'default',
      path: 'D:/workspace/left/README.md',
      label: 'Open',
      executable: undefined,
    })
    expect(createOpenWithAction('D:/workspace/left/README.md', 'Code', 'code')).toEqual({
      kind: 'open-with',
      path: 'D:/workspace/left/README.md',
      label: 'Open With Code',
      executable: 'code',
    })
    expect(createAssociatedApplicationOpenAction('D:/workspace/left/README.md')).toEqual({
      kind: 'associated',
      path: 'D:/workspace/left/README.md',
      label: 'Open With Associated Application',
      executable: undefined,
    })
  })
})
