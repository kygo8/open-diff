export type FileOpenActionKind = 'default' | 'open-with' | 'associated'

export interface FileOpenAction {
  kind: FileOpenActionKind
  path: string
  labelKey: string
  labelParams?: Record<string, string>
  executable?: string
}

export interface ExternalApplicationConfig {
  id: string
  name: string
  executable: string
  enabled: boolean
}

export function createDefaultOpenAction(path: string): FileOpenAction {
  return {
    kind: 'default',
    path,
    labelKey: 'ui.open',
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
    labelKey: 'fileOpen.openWithApplication',
    labelParams: { applicationName },
    executable,
  }
}

export function listEnabledExternalApplications(
  applications: ExternalApplicationConfig[],
): ExternalApplicationConfig[] {
  return applications.filter((application) => application.enabled)
}

export function createAssociatedApplicationOpenAction(path: string): FileOpenAction {
  return {
    kind: 'associated',
    path,
    labelKey: 'fileOpen.openWithAssociatedApplication',
    executable: undefined,
  }
}
