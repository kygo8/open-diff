import type { Page } from '@playwright/test'

const POLYFILL = `(() => {
  if (globalThis.__OPEN_DIFF_RAF_POLYFILL__) {
    return
  }
  globalThis.__OPEN_DIFF_RAF_POLYFILL__ = true
  globalThis.requestAnimationFrame = (callback) =>
    globalThis.setTimeout(() => callback(performance.now()), 16)
  globalThis.cancelAnimationFrame = (id) => globalThis.clearTimeout(id)
})()`

/**
 * Local Playwright Chromium never delivers compositor animation frames, so
 * utility-world requestAnimationFrame (used for actionability "stable" waits)
 * never settles and every click hangs. Polyfill rAF with setTimeout in both the
 * main document world and Playwright's utility world.
 */
export async function ensureAnimationFrames(page: Page): Promise<void> {
  await page.addInitScript(POLYFILL)

  const client = await page.context().newCDPSession(page)

  await client.send('Runtime.enable')
  await client.send('Page.addScriptToEvaluateOnNewDocument', {
    source: POLYFILL,
  })

  for (const worldName of ['__playwright_utility_world__', 'utility']) {
    try {
      await client.send('Page.addScriptToEvaluateOnNewDocument', {
        source: POLYFILL,
        worldName,
      })
    } catch {
      // world may not exist yet; executionContextCreated covers dynamic names
    }
  }

  client.on('Runtime.executionContextCreated', (event) => {
    const name = event.context.name || ''

    if (!name.includes('playwright_utility') && !name.includes('__playwright')) {
      return
    }

    void client
      .send('Runtime.evaluate', {
        expression: POLYFILL,
        contextId: event.context.id,
      })
      .catch(() => undefined)
  })
}
