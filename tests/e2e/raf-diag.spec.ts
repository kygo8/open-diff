import { expect, test } from '@playwright/test'
import { installTauriInvokeMock } from './helpers/tauriMock'

test.beforeEach(async ({ page }) => {
  await installTauriInvokeMock(page)
})

test('animation frames settle so clicks stay actionable', async ({ page }) => {
  await page.goto('/')

  const race = await page.evaluate(
    () =>
      new Promise<string>((resolve) => {
        requestAnimationFrame(() => resolve('raf'))
        setTimeout(() => resolve('timeout'), 1000)
      }),
  )

  expect(race).toBe('raf')

  await page.locator('[data-session-type="text-compare"]').click()
  await expect(page.getByTestId('run-diff')).toBeVisible()
})
