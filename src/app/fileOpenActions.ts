export type FileOpenActionKind = 'default' | 'open-with' | 'associated'

export interface FileOpenAction {
  kind: FileOpenActionKind
  path: string
  label: string
  executable?: string
}

export function createDefaultOpenAction(path: string): FileOpenAction {
  return {
    kind: 'default',
    path,
    label: 'Open',
    executable: undefined,
  }
}

export function createOpenWithAction(
  path: string,
  applicationName: string,
  executable: string,
): FileOpenAction {
  return {
    kind: 'open-with',
    path,
    label: `Open With ${applicationName}`,
    executable,
  }
}

export function createAssociatedApplicationOpenAction(path: string): FileOpenAction {
  return {
    kind: 'associated',
    path,
    label: 'Open With Associated Application',
    executable: undefined,
  }
}
