import { Browser, Page, BrowserContext } from '@playwright/test'

export async function createContext(
  browser: Browser
): Promise<{ page: Page; context: BrowserContext }> {
  const context = await browser.newContext()
  const page = await context.newPage()
  return { page, context }
}

export async function closeContext(context: BrowserContext): Promise<void> {
  await context.close()
}
