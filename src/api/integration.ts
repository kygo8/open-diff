import { invoke } from '@tauri-apps/api/core'

export type GitIntegrationKind = 'difftool' | 'mergetool'
export type GitIntegrationScope = 'global' | 'local'

export function writeGitIntegration(
  kind: GitIntegrationKind,
  executablePath: string,
  scope: GitIntegrationScope = 'global',
): Promise<string> {
  return invoke<string>('write_git_integration', {
    kind,
    executablePath,
    scope,
  })
}

export function writeSvnIntegration(executablePath: string, wrapperPath: string): Promise<string> {
  return invoke<string>('write_svn_integration', {
    executablePath,
    wrapperPath,
  })
}

export interface ShellRegistrationResult {
  windows: boolean
  applied: boolean
  script: string
  message: string
}

export function registerWindowsShellExtension(
  executablePath?: string,
): Promise<ShellRegistrationResult> {
  return invoke<ShellRegistrationResult>('register_windows_shell_extension', {
    executablePath,
  })
}

export function unregisterWindowsShellExtension(
  executablePath?: string,
): Promise<ShellRegistrationResult> {
  return invoke<ShellRegistrationResult>('unregister_windows_shell_extension', {
    executablePath,
  })
}

export interface ShellCompareLaunchPayload {
  left: string
  right: string
  route: string
  sessionType: string
  center?: string
  output?: string
  leftReadOnly?: boolean
  rightReadOnly?: boolean
  favor?: 'left' | 'right'
}

export function takeShellCompareLaunch(): Promise<ShellCompareLaunchPayload | null> {
  return invoke<ShellCompareLaunchPayload | null>('take_shell_compare_launch')
}

export function registerUnixShellIntegration(
  executablePath?: string,
): Promise<ShellRegistrationResult> {
  return invoke<ShellRegistrationResult>('register_unix_shell_integration', {
    executablePath,
  })
}

export function unregisterUnixShellIntegration(
  executablePath?: string,
): Promise<ShellRegistrationResult> {
  return invoke<ShellRegistrationResult>('unregister_unix_shell_integration', {
    executablePath,
  })
}

export interface OpenPathExternalResult {
  path: string
  executable?: string | null
  launched: boolean
}

export function openPathExternal(
  path: string,
  executable?: string,
): Promise<OpenPathExternalResult> {
  return invoke<OpenPathExternalResult>('open_path_external', {
    path,
    executable,
  })
}

export interface RevealPathInOsResult {
  path: string
  selected: boolean
  fallbackOpened: boolean
  launched: boolean
}

export function revealPathInOs(path: string): Promise<RevealPathInOsResult> {
  return invoke<RevealPathInOsResult>('reveal_path_in_os', {
    path,
  })
}
