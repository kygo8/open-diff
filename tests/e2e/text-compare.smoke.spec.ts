import { expect, test } from '@playwright/test'

interface TauriInternalsMock {
  invoke: (command: string) => Promise<unknown>
}

type WindowWithTauriMock = Window & {
  __TAURI_INTERNALS__?: TauriInternalsMock
}

test('opens the home page and runs a text comparison', async ({ page }) => {
  await page.addInitScript(() => {
    const tauriWindow = window as WindowWithTauriMock

    tauriWindow.__TAURI_INTERNALS__ = {
      invoke: (command: string) => {
        if (command !== 'diff_text') {
          throw new Error(`Unexpected Tauri command: ${command}`)
        }

        return Promise.resolve({
          lines: [
            {
              leftNumber: 1,
              rightNumber: 1,
              leftText: 'line one',
              rightText: 'line one',
              kind: 'equal',
              inlineSegments: { left: [], right: [] },
            },
            {
              leftNumber: 2,
              rightNumber: 2,
              leftText: 'line two',
              rightText: 'line 2',
              kind: 'modified',
              inlineSegments: {
                left: [{ text: 'line two', changed: true }],
                right: [{ text: 'line 2', changed: true }],
              },
            },
            {
              leftNumber: null,
              rightNumber: 3,
              leftText: '',
              rightText: 'line three',
              kind: 'added',
              inlineSegments: {
                left: [],
                right: [{ text: 'line three', changed: true }],
              },
            },
            {
              leftNumber: 3,
              rightNumber: 4,
              leftText: 'line four',
              rightText: 'line four',
              kind: 'equal',
              inlineSegments: { left: [], right: [] },
            },
          ],
          stats: { added: 1, deleted: 0, modified: 1, equal: 2 },
        })
      },
    }
  })

  await page.goto('/')

  await expect(
    page.locator('.workbench-titlebar').getByRole('heading', { name: 'New Session' }),
  ).toBeVisible()

  await page
    .locator('[data-session-type="text-compare"]')
    .getByRole('button', { name: 'Open' })
    .click()
  await expect(page.locator('.workbench-subtitle')).toHaveText(
    '2 equal, 1 modified, 1 added, 0 deleted',
  )

  await page.getByTestId('run-diff').click()

  await expect(page.locator('.workbench-subtitle')).toHaveText(
    '2 equal, 1 modified, 1 added, 0 deleted',
  )
  await expect(page.getByTestId('text-diff-scroll-container')).toContainText('line 2')
  await expect(page.getByTestId('text-details')).toContainText('Left 2: line two')
})
