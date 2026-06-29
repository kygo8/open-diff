import type { SessionDocument } from '@/types/session'

export interface SessionPackage {
  version: 1
  sessions: SessionDocument[]
}

export function serializeSessionPackage(sessions: SessionDocument[]): string {
  return JSON.stringify({ version: 1, sessions }, null, 2)
}

export function parseSessionPackage(input: string): SessionPackage {
  const parsed = JSON.parse(input) as Partial<SessionPackage>

  if (parsed.version !== 1 || !Array.isArray(parsed.sessions)) {
    throw new Error('Unsupported session package.')
  }

  return { version: 1, sessions: parsed.sessions }
}
