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

export interface ScriptPromptAnswerRequest {
  id: number
  value?: string
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

export function answerScriptPrompt(request: ScriptPromptAnswerRequest): Promise<boolean> {
  return invoke<boolean>('answer_script_prompt', {
    id: request.id,
    value: request.value,
    cancelled: request.cancelled ?? false,
  })
}
