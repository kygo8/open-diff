export interface StdinTextSource {
  kind: 'stdin-text'
  title: string
  text: string
  readonly: true
}

export function createStdinTextSource(text: string, title = 'Standard Input'): StdinTextSource {
  if (!text) {
    throw new Error('Standard input is empty.')
  }

  return {
    kind: 'stdin-text',
    title,
    text,
    readonly: true,
  }
}
