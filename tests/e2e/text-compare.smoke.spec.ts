import { expect, test } from '@playwright/test'
import { ensureAnimationFrames } from './helpers/ensureAnimationFrames'

interface TauriInternalsMock {
  invoke: (command: string, args?: unknown) => Promise<unknown>
}

type WindowWithTauriMock = Window & {
  __TAURI_INTERNALS__?: TauriInternalsMock
}

test('opens the home page and runs a text comparison', async ({ page }) => {
  await ensureAnimationFrames(page)
  await page.addInitScript(() => {
    const tauriWindow = window as WindowWithTauriMock

    tauriWindow.__TAURI_INTERNALS__ = {
      invoke: (command: string, args?: unknown) => {
        if (command === 'load_admin_policy') {
          return Promise.resolve({
            savePasswords: true,
            remoteProfiles: true,
            updateChecks: true,
          })
        }

        if (command === 'app_runtime_info') {
          return Promise.resolve({ os: 'linux', family: 'unix' })
        }

        if (command === 'read_text_file') {
          const path =
            args && typeof args === 'object' && 'path' in args
              ? (args as { path: string }).path
              : 'file.txt'

          return Promise.resolve({
            path,
            text: path.includes('right')
              ? 'line one\nline 2\nline three\nline four'
              : 'line one\nline two\nline four',
            encoding: 'UTF-8',
            lineEnding: 'LF',
            fileStamp: { size: 8, modifiedAtMs: 1 },
          })
        }

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

  await expect(page.getByTestId('home-new-session')).toBeVisible()

  await page.locator('[data-session-type="text-compare"]').click()
  await expect(page.getByTestId('run-diff')).toBeVisible()
  await expect(page.locator('body')).not.toContainText('generated-120.log')

  await page.getByTestId('ignore-whitespace').check()
  await page.getByTestId('run-diff').click()

  await expect(page.locator('.workbench-subtitle')).toHaveText(
    '2 equal, 1 modified, 1 added, 0 deleted',
  )
  await expect(page.getByTestId('text-diff-scroll-container')).toContainText('line 2')
  await expect(page.getByTestId('text-details')).toContainText('Left 2: line two')

  await page.getByTestId('text-left-path').fill('tests/fixtures/text/left.txt')
  await page.getByTestId('text-right-path').fill('tests/fixtures/text/right.txt')
  await page.getByTestId('load-text-files').click()
  await expect(page.getByTestId('text-left-path')).toHaveValue('tests/fixtures/text/left.txt')
})
