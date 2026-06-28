import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const checklistPath = resolve(process.cwd(), 'docs/可访问性检查清单.md')

describe('accessibility checklist documentation', () => {
  it('defines keyboard, non-color, and high-contrast gates for release review', () => {
    const checklist = readFileSync(checklistPath, 'utf8')

    expect(checklist).toContain('Keyboard Access Gate')
    expect(checklist).toContain('Non-Color Status Gate')
    expect(checklist).toContain('High Contrast Gate')
    expect(checklist).toContain('Tab')
    expect(checklist).toContain('Enter')
    expect(checklist).toContain('Escape')
    expect(checklist).toContain('aria-label')
    expect(checklist).toContain('WCAG 2.2 AA')
    expect(checklist).toContain('Evidence')
  })
})
