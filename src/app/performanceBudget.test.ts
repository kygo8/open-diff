import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const budgetPath = resolve(process.cwd(), 'docs/性能预算.md')

describe('performance budget documentation', () => {
  it('defines measurable budgets for large files, scanning, scrolling, and report generation', () => {
    const budget = readFileSync(budgetPath, 'utf8')

    expect(budget).toContain('Large File Budget')
    expect(budget).toContain('Folder Scan Budget')
    expect(budget).toContain('Scrolling Budget')
    expect(budget).toContain('Report Generation Budget')
    expect(budget).toContain('20,000')
    expect(budget).toContain('5,000')
    expect(budget).toContain('2 MiB')
    expect(budget).toContain('60 FPS')
    expect(budget).toContain('Evidence')
  })
})
