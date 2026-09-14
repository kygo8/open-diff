import { invoke } from '@tauri-apps/api/core'

export interface ScriptRunRequest {
  source: string
  path?: string
}

export interface ScriptRunResponse {
  executed: number
  compared: number
  different: number
  reportsWritten: number
  logs: string[]
  cancelled?: boolean
}

export function runScript(request: ScriptRunRequest): Promise<ScriptRunResponse> {
  return invoke<ScriptRunResponse>('run_script', {
    source: request.source,
    path: request.path,
  })
}

export function stopScript(): Promise<boolean> {
  return invoke<boolean>('stop_script')
}
