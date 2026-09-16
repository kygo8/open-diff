import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  openPathExternal,
  registerUnixShellIntegration,
  revealPathInOs,
  writeGitIntegration,
  writeSvnIntegration,
} from './integration'
import { invoke } from '@tauri-apps/api/core'

vi.mock('@tauri-apps/api/core', () => ({
  invoke: vi.fn().mockResolvedValue('wrote config'),
}))

describe('integration api', () => {
  beforeEach(() => {
    vi.mocked(invoke).mockClear()
  })

  it('writes git and svn integration snippets through Tauri commands', async () => {
    await writeGitIntegration('mergetool', '/usr/bin/open-diff', 'global')
    await writeSvnIntegration('/usr/bin/open-diff', '/tmp/open-diff-svn.sh')

    expect(invoke).toHaveBeenCalledWith('write_git_integration', {
      kind: 'mergetool',
      executablePath: '/usr/bin/open-diff',
      scope: 'global',
    })
    expect(invoke).toHaveBeenCalledWith('write_svn_integration', {
      executablePath: '/usr/bin/open-diff',
      wrapperPath: '/tmp/open-diff-svn.sh',
    })
  })

  it('opens paths externally and registers unix shell integration', async () => {
    vi.mocked(invoke).mockResolvedValueOnce({ path: '/tmp/a.txt', launched: true })
    await openPathExternal('/tmp/a.txt', 'code')
    expect(invoke).toHaveBeenCalledWith('open_path_external', {
      path: '/tmp/a.txt',
      executable: 'code',
    })

    vi.mocked(invoke).mockResolvedValueOnce({
      windows: false,
      applied: true,
      script: '',
      message: 'ok',
    })
    await registerUnixShellIntegration('/usr/bin/open-diff-app')
    expect(invoke).toHaveBeenCalledWith('register_unix_shell_integration', {
      executablePath: '/usr/bin/open-diff-app',
    })
  })

  it('reveals paths in the OS file manager through Tauri', async () => {
    vi.mocked(invoke).mockResolvedValueOnce({
      path: '/tmp/a.txt',
      selected: true,
      fallbackOpened: false,
      launched: true,
    })
    await revealPathInOs('/tmp/a.txt')
    expect(invoke).toHaveBeenCalledWith('reveal_path_in_os', {
      path: '/tmp/a.txt',
    })
  })
})
