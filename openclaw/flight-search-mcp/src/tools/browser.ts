import { chromium, type Browser, type BrowserContext } from 'playwright'

let browser: Browser | null = null
let context: BrowserContext | null = null

const USER_DATA_DIR =
  process.env.BROWSER_DATA_DIR ||
  new URL('../../.browser-data', import.meta.url).pathname

export async function getBrowserContext(): Promise<BrowserContext> {
  if (context) return context

  context = await chromium.launchPersistentContext(USER_DATA_DIR, {
    headless: process.env.HEADLESS !== 'false',
    channel: 'chrome',
    viewport: { width: 1280, height: 900 },
    args: ['--disable-blink-features=AutomationControlled'],
  })

  return context
}

export async function closeBrowser(): Promise<void> {
  if (context) {
    await context.close()
    context = null
  }
  if (browser) {
    await browser.close()
    browser = null
  }
}
