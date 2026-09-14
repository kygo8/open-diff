import { beforeEach, describe, expect, it, vi } from 'vitest'
import { runScript, stopScript } from './script'
import { invoke } from '@tauri-apps/api/core'

vi.mock('@tauri-apps/api/core', () => ({
  invoke: vi.fn().mockResolvedValue({
    executed: 3,
    compared: 1,
    different: 1,
    reportsWritten: 1,
    logs: ['compared left.txt right.txt'],
  }),
}))

describe('script api', () => {
  beforeEach(() => {
    vi.mocked(invoke).mockClear()
  })

  it('runs a script source through the Tauri command', async () => {
    const result = await runScript({
      source: 'load left.txt\nload right.txt\ncompare\n',
    })

    expect(invoke).toHaveBeenCalledWith('run_script', {
      source: 'load left.txt\nload right.txt\ncompare\n',
      path: undefined,
    })
    expect(result.reportsWritten).toBe(1)
  })

  it('runs a script file through the Tauri command', async () => {
    await runScript({
      source: '',
      path: 'C:/work/job.bc',
    })

    expect(invoke).toHaveBeenCalledWith('run_script', {
      source: '',
      path: 'C:/work/job.bc',
    })
  })

  it('requests script stop through the Tauri command', async () => {
    vi.mocked(invoke).mockResolvedValueOnce(true)
    await expect(stopScript()).resolves.toBe(true)
    expect(invoke).toHaveBeenCalledWith('stop_script')
  })
})
