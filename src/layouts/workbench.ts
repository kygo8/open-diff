export interface WorkbenchPathPair {
  left: string
  right: string
}

export interface WorkbenchInspectorRow {
  label: string
  value: string
  tone?: 'default' | 'added' | 'deleted' | 'modified' | 'conflict'
}

export interface WorkbenchInspectorSection {
  title: string
  rows?: WorkbenchInspectorRow[]
}

export interface WorkbenchSummaryItem {
  label: string
  value: string | number
  tone?: 'default' | 'added' | 'deleted' | 'modified' | 'conflict'
}

export interface WorkbenchToolbarAction {
  label: string
  active?: boolean
  disabled?: boolean
  tone?: 'default' | 'primary' | 'danger'
}
